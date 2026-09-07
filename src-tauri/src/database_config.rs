//! Configuração local por usuário. Nenhum segredo é retornado no IPC ou logado.
use serde::{Deserialize, Serialize};
use sqlx::postgres::{PgConnectOptions, PgSslMode};
use std::str::FromStr;
use tauri::State;

use crate::{app_state::AppState, response::ApiResponse};

// Não derivar Debug: URL, senha e erros dos drivers podem conter segredos.
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case", deny_unknown_fields)]
pub enum ConnectionInput {
    Url {
        url: String,
    },
    Fields {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: String,
        sslmode: String,
    },
}

impl ConnectionInput {
    fn options(&self) -> Result<PgConnectOptions, &'static str> {
        let invalid = "Confira a URL de conexão ou os campos informados e tente novamente.";
        match self {
            Self::Url { url } => {
                let parsed = url::Url::parse(url.trim()).map_err(|_| invalid)?;
                if !matches!(parsed.scheme(), "postgres" | "postgresql")
                    || parsed.host_str().is_none()
                    || parsed.username().is_empty()
                    || (parsed.password().is_none_or(str::is_empty)
                        && !parsed
                            .query_pairs()
                            .any(|(k, v)| k == "password" && !v.is_empty()))
                    || parsed.path().trim_matches('/').is_empty()
                    || parsed.fragment().is_some()
                    || parsed.port() == Some(0)
                {
                    return Err(invalid);
                }
                // Rejeitar parâmetros desconhecidos: o sqlx os registra com o valor
                // em tracing, que poderia conter um segredo digitado por engano.
                if parsed.query_pairs().any(|(key, _)| {
                    !matches!(
                        key.as_ref(),
                        "sslmode"
                            | "ssl-mode"
                            | "sslrootcert"
                            | "ssl-root-cert"
                            | "ssl-ca"
                            | "sslcert"
                            | "ssl-cert"
                            | "sslkey"
                            | "ssl-key"
                            | "statement-cache-capacity"
                            | "host"
                            | "hostaddr"
                            | "port"
                            | "dbname"
                            | "user"
                            | "password"
                            | "application_name"
                            | "options"
                    ) && !(key.starts_with("options[") && key.ends_with(']'))
                }) {
                    return Err("A URL contém uma opção de conexão não suportada. Confira a URL com o responsável pelo banco.");
                }
                let mut options = PgConnectOptions::from_str(url.trim()).map_err(|_| invalid)?;
                if options.get_port() == 0
                    || options.get_username().is_empty()
                    || options.get_database().is_none_or(str::is_empty)
                {
                    return Err(invalid);
                }
                if !parsed
                    .query_pairs()
                    .any(|(key, _)| matches!(key.as_ref(), "sslmode" | "ssl-mode"))
                {
                    options = options.ssl_mode(PgSslMode::VerifyFull);
                }
                Ok(options)
            }
            Self::Fields {
                host,
                port,
                database,
                username,
                password,
                sslmode,
            } => {
                if host.trim().is_empty()
                    || *port == 0
                    || database.trim().is_empty()
                    || username.trim().is_empty()
                    || password.is_empty()
                {
                    return Err("Preencha servidor, porta, banco, usuário e senha para continuar.");
                }
                let ssl = PgSslMode::from_str(if sslmode.is_empty() {
                    "verify-full"
                } else {
                    sslmode
                })
                .map_err(|_| "Selecione um modo SSL válido.")?;
                // Builders evitam interpolar senha/usuário em uma URL sem escaping.
                Ok(PgConnectOptions::new_without_pgpass()
                    .host(host.trim())
                    .port(*port)
                    .database(database.trim())
                    .username(username.trim())
                    .password(password)
                    .ssl_mode(ssl))
            }
        }
    }
}

#[cfg(debug_assertions)]
pub fn development_config() -> ConnectionInput {
    let get = |key: &str, default: &str| {
        std::env::var(key)
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| default.into())
    };
    // DB_* explícitos preservam o script rodar_contra_neon.sh, mesmo se o .env
    // local contiver DATABASE_URL. Não há consulta a ambiente em builds release.
    if std::env::var("DB_HOST").is_err() {
        if let Ok(url) = std::env::var("DATABASE_URL") {
            if !url.trim().is_empty() {
                return ConnectionInput::Url { url };
            }
        }
    }
    ConnectionInput::Fields {
        host: get("DB_HOST", "localhost"),
        port: get("DB_PORT", "5438").parse().unwrap_or(0),
        database: get("DB_NAME", "adm_p6_db"),
        username: get("DB_USER", "adm_p6_user"),
        password: get("DB_PASSWORD", "adm_p6_password"),
        sslmode: get("DB_SSLMODE", "prefer"),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum StartupState {
    Ready,
    Missing,
    VaultError,
    InvalidConfig,
    ConnectionError,
    MigrationError,
}

#[derive(Serialize)]
pub struct StartupStatus {
    pub state: StartupState,
    pub message: String,
}

impl StartupStatus {
    fn new(state: StartupState, message: &str) -> Self {
        Self {
            state,
            message: message.into(),
        }
    }
    fn ready() -> Self {
        Self::new(StartupState::Ready, "Conexão pronta.")
    }
}

const VAULT_ERROR: &str = "Não foi possível acessar ou salvar no cofre seguro. Habilite ou desbloqueie o cofre da sua conta no sistema operacional e tente novamente. O acesso ao sistema depende desse cofre.";

// Interface pequena, para testar falhas sem tocar no cofre real do desenvolvedor.
trait CredentialStore {
    fn read(&self) -> Result<Option<String>, ()>;
    fn write(&self, secret: &str) -> Result<(), ()>;
}
struct OsStore;
#[cfg(any(target_os = "linux", target_os = "windows"))]
impl CredentialStore for OsStore {
    fn read(&self) -> Result<Option<String>, ()> {
        let entry = keyring::Entry::new("br.gov.pmro.admp6", "database-v1").map_err(|_| ())?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(()),
        }
    }
    fn write(&self, secret: &str) -> Result<(), ()> {
        keyring::Entry::new("br.gov.pmro.admp6", "database-v1")
            .map_err(|_| ())?
            .set_password(secret)
            .map_err(|_| ())
    }
}
#[cfg(not(any(target_os = "linux", target_os = "windows")))]
impl CredentialStore for OsStore {
    fn read(&self) -> Result<Option<String>, ()> {
        Err(())
    }
    fn write(&self, _: &str) -> Result<(), ()> {
        Err(())
    }
}

fn read_config(store: &impl CredentialStore) -> Result<ConnectionInput, StartupStatus> {
    let secret = store
        .read()
        .map_err(|_| StartupStatus::new(StartupState::VaultError, VAULT_ERROR))?
        .ok_or_else(|| {
            StartupStatus::new(
                StartupState::Missing,
                "Configure a conexão com o banco para começar.",
            )
        })?;
    serde_json::from_str(&secret).map_err(|_| {
        StartupStatus::new(
            StartupState::InvalidConfig,
            "A configuração salva não pôde ser lida. Configure a conexão novamente.",
        )
    })
}
fn write_config(
    store: &impl CredentialStore,
    input: &ConnectionInput,
) -> Result<(), StartupStatus> {
    let secret = serde_json::to_string(input).map_err(|_| {
        StartupStatus::new(
            StartupState::InvalidConfig,
            "Não foi possível preparar a configuração. Confira os campos e tente novamente.",
        )
    })?;
    store
        .write(&secret)
        .map_err(|_| StartupStatus::new(StartupState::VaultError, VAULT_ERROR))
}

// Separar efeitos permite testar a ordem salvar/migrar/publicar e falhas sem
// acessar o cofre pessoal ou um banco real.
trait SetupBackend: Sync {
    fn connect(
        &self,
        options: PgConnectOptions,
    ) -> impl std::future::Future<Output = Result<sqlx::PgPool, ()>> + Send;
    fn save(
        &self,
        input: ConnectionInput,
    ) -> impl std::future::Future<Output = Result<(), StartupStatus>> + Send;
    fn migrate(
        &self,
        pool: &sqlx::PgPool,
    ) -> impl std::future::Future<Output = Result<(), ()>> + Send;
}
struct NativeSetup;
impl SetupBackend for NativeSetup {
    async fn connect(&self, options: PgConnectOptions) -> Result<sqlx::PgPool, ()> {
        crate::db::pool::connect_options(options)
            .await
            .map_err(|_| ())
    }
    async fn save(&self, input: ConnectionInput) -> Result<(), StartupStatus> {
        tauri::async_runtime::spawn_blocking(move || write_config(&OsStore, &input))
            .await
            .unwrap_or_else(|_| Err(StartupStatus::new(StartupState::VaultError, VAULT_ERROR)))
    }
    async fn migrate(&self, pool: &sqlx::PgPool) -> Result<(), ()> {
        sqlx::migrate!("./migrations")
            .run(pool)
            .await
            .map_err(|_| ())
    }
}

async fn prepare(
    state: &AppState,
    input: ConnectionInput,
    save: bool,
    backend: &impl SetupBackend,
) -> StartupStatus {
    let options = match input.options() {
        Ok(options) => options,
        Err(message) => return StartupStatus::new(StartupState::InvalidConfig, message),
    };
    // Conexão de teste não publica pool nem executa migrations.
    let pool = match backend.connect(options).await {
        Ok(pool) => pool,
        Err(_) => return StartupStatus::new(StartupState::ConnectionError,
            "Não foi possível conectar. Confira as credenciais, a rede e a configuração SSL e tente novamente."),
    };
    if save {
        if let Err(status) = backend.save(input).await {
            pool.close().await;
            return status;
        }
    }
    // A partir daqui a nova configuração já foi persistida. Remover pool antigo
    // inclusive se migrations falharem, para impedir login no banco anterior.
    if let Some(old) = state.pool.write().await.take() {
        old.close().await;
    }
    if backend.migrate(&pool).await.is_err() {
        pool.close().await;
        return StartupStatus::new(StartupState::MigrationError,
            "A conexão foi aceita, mas a atualização do banco falhou. A configuração foi mantida. Tente novamente ou procure o suporte.");
    }
    *state.pool.write().await = Some(pool);
    StartupStatus::ready()
}

#[tauri::command]
pub async fn database_initialize(
    state: State<'_, AppState>,
) -> Result<ApiResponse<StartupStatus>, String> {
    let _guard = state.lifecycle.lock().await;
    if state.pool.read().await.is_some() {
        return Ok(ApiResponse::ok(StartupStatus::ready()));
    }
    let input = if let Some(input) = &state.development {
        input.clone()
    } else {
        match tauri::async_runtime::spawn_blocking(|| read_config(&OsStore)).await {
            Ok(Ok(input)) => input,
            Ok(Err(status)) => return Ok(ApiResponse::ok(status)),
            Err(_) => {
                return Ok(ApiResponse::ok(StartupStatus::new(
                    StartupState::VaultError,
                    VAULT_ERROR,
                )))
            }
        }
    };
    Ok(ApiResponse::ok(
        prepare(&state, input, false, &NativeSetup).await,
    ))
}

#[tauri::command]
pub async fn database_save(
    state: State<'_, AppState>,
    input: ConnectionInput,
) -> Result<ApiResponse<StartupStatus>, String> {
    let _guard = state.lifecycle.lock().await;
    if state.session().await.is_some() {
        return Ok(ApiResponse::err(crate::error::AppError::Domain(
            "Saia da sua sessão antes de alterar a conexão.".into(),
        )));
    }
    Ok(ApiResponse::ok(
        prepare(&state, input, true, &NativeSetup).await,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    struct Store {
        value: RefCell<Option<String>>,
        fail: bool,
    }
    impl CredentialStore for Store {
        fn read(&self) -> Result<Option<String>, ()> {
            if self.fail {
                Err(())
            } else {
                Ok(self.value.borrow().clone())
            }
        }
        fn write(&self, value: &str) -> Result<(), ()> {
            if self.fail {
                Err(())
            } else {
                *self.value.borrow_mut() = Some(value.into());
                Ok(())
            }
        }
    }
    fn fields() -> ConnectionInput {
        ConnectionInput::Fields {
            host: "localhost".into(),
            port: 5432,
            database: "test".into(),
            username: "a@b".into(),
            password: "p@:/?#% ç".into(),
            sslmode: "verify-full".into(),
        }
    }
    #[test]
    fn fields_preserve_special_characters() {
        let options = fields().options().unwrap();
        assert_eq!(options.get_username(), "a@b");
        assert_eq!(options.get_database(), Some("test"));
        assert!(matches!(options.get_ssl_mode(), PgSslMode::VerifyFull));
    }
    #[test]
    fn url_defaults_to_verified_tls_and_preserves_explicit_mode() {
        for (suffix, ssl) in [
            ("", PgSslMode::VerifyFull),
            ("?sslmode=disable", PgSslMode::Disable),
        ] {
            let input = ConnectionInput::Url {
                url: format!("postgres://user:p%40ss@localhost/test{suffix}"),
            };
            assert_eq!(
                format!("{:?}", input.options().unwrap().get_ssl_mode()),
                format!("{ssl:?}")
            );
        }
    }
    #[test]
    fn rejects_invalid_or_incomplete_inputs_without_exposing_them() {
        for url in [
            "SECRET",
            "https://user:SECRET@host/db",
            "postgres://host",
            "postgres://user:SECRET@host:0/db",
        ] {
            let error = ConnectionInput::Url { url: url.into() }
                .options()
                .unwrap_err();
            assert!(!error.contains("SECRET"));
        }
        let mut input = fields();
        if let ConnectionInput::Fields { port, .. } = &mut input {
            *port = 0;
        }
        assert!(input.options().is_err());
    }
    #[test]
    fn vault_missing_saved_corrupt_and_unavailable_are_distinct() {
        let store = Store {
            value: RefCell::new(None),
            fail: false,
        };
        assert_eq!(
            read_config(&store).err().unwrap().state,
            StartupState::Missing
        );
        assert!(write_config(&store, &fields()).is_ok());
        assert!(read_config(&store).is_ok());
        *store.value.borrow_mut() = Some("corrupted SECRET".into());
        let error = read_config(&store).err().unwrap();
        assert_eq!(error.state, StartupState::InvalidConfig);
        assert!(!error.message.contains("SECRET"));
        let unavailable = Store {
            value: RefCell::new(None),
            fail: true,
        };
        assert_eq!(
            read_config(&unavailable).err().unwrap().state,
            StartupState::VaultError
        );
        assert_eq!(
            write_config(&unavailable, &fields()).err().unwrap().state,
            StartupState::VaultError
        );
    }
    struct FakeSetup {
        fail: Option<StartupState>,
        events: std::sync::Mutex<Vec<&'static str>>,
    }
    impl SetupBackend for FakeSetup {
        async fn connect(&self, options: PgConnectOptions) -> Result<sqlx::PgPool, ()> {
            self.events.lock().unwrap().push("connect");
            if self.fail == Some(StartupState::ConnectionError) {
                return Err(());
            }
            Ok(sqlx::postgres::PgPoolOptions::new().connect_lazy_with(options))
        }
        async fn save(&self, _: ConnectionInput) -> Result<(), StartupStatus> {
            self.events.lock().unwrap().push("save");
            if self.fail == Some(StartupState::VaultError) {
                return Err(StartupStatus::new(StartupState::VaultError, VAULT_ERROR));
            }
            Ok(())
        }
        async fn migrate(&self, _: &sqlx::PgPool) -> Result<(), ()> {
            self.events.lock().unwrap().push("migrate");
            if self.fail == Some(StartupState::MigrationError) {
                Err(())
            } else {
                Ok(())
            }
        }
    }
    #[tokio::test]
    async fn only_publishes_pool_after_save_and_migrations() {
        for failure in [
            None,
            Some(StartupState::ConnectionError),
            Some(StartupState::VaultError),
            Some(StartupState::MigrationError),
        ] {
            let state = AppState::for_application();
            let backend = FakeSetup {
                fail: failure,
                events: Default::default(),
            };
            let status = prepare(&state, fields(), true, &backend).await;
            assert_eq!(status.state, failure.unwrap_or(StartupState::Ready));
            assert_eq!(state.pool.read().await.is_some(), failure.is_none());
            let expected = match failure {
                Some(StartupState::ConnectionError) => vec!["connect"],
                Some(StartupState::VaultError) => vec!["connect", "save"],
                _ => vec!["connect", "save", "migrate"],
            };
            assert_eq!(*backend.events.lock().unwrap(), expected);
        }
    }
    #[tokio::test]
    async fn reopening_does_not_rewrite_credentials() {
        let state = AppState::for_application();
        let backend = FakeSetup {
            fail: None,
            events: Default::default(),
        };
        assert_eq!(
            prepare(&state, fields(), false, &backend).await.state,
            StartupState::Ready
        );
        assert_eq!(*backend.events.lock().unwrap(), vec!["connect", "migrate"]);
    }
    #[tokio::test]
    async fn failed_replacement_preserves_old_pool_until_new_config_is_saved() {
        for failure in [
            StartupState::ConnectionError,
            StartupState::VaultError,
            StartupState::MigrationError,
        ] {
            let state = AppState::for_application();
            let old =
                sqlx::postgres::PgPoolOptions::new().connect_lazy_with(fields().options().unwrap());
            *state.pool.write().await = Some(old.clone());
            let backend = FakeSetup {
                fail: Some(failure),
                events: Default::default(),
            };
            prepare(&state, fields(), true, &backend).await;
            assert_eq!(old.is_closed(), failure == StartupState::MigrationError);
            assert_eq!(
                state.pool.read().await.is_some(),
                failure != StartupState::MigrationError
            );
        }
    }
    #[test]
    fn url_preserves_provider_options_and_ssl_alias() {
        let input = ConnectionInput::Url { url: "postgres://u:pw@host/db?ssl-mode=require&options=endpoint%3Dtest&application_name=gestao".into() };
        let options = input.options().unwrap();
        assert!(matches!(options.get_ssl_mode(), PgSslMode::Require));
        assert!(options.get_options().unwrap().contains("endpoint=test"));
        assert_eq!(options.get_application_name(), Some("gestao"));
        let input = ConnectionInput::Url {
            url: "postgres://u:pw@host/db?typo=SECRET".into(),
        };
        assert!(input.options().is_err());
    }
}
