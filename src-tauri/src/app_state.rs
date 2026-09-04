use sqlx::PgPool;
use tokio::sync::RwLock;

use crate::auth::domain::SessionUser;

pub struct AppState {
    database_url: String,
    pool: RwLock<Option<PgPool>>,
    session: RwLock<Option<SessionUser>>,
}

/// Uma definição do banco, nas três origens possíveis, nesta ordem.
///
/// 1. **Variável de ambiente**, que o `dotenvy` já pode ter carregado do `.env`.
///    Vence sempre: é o que mantém o desenvolvimento e os 186 testes apontados
///    para o docker-compose local, e é a única via de apontar um binário
///    empacotado para outro banco sem recompilá-lo.
/// 2. **Valor compilado** (`ADMP6_DB_*` no ambiente do `cargo`/`tauri build`).
///    É o que faz o `.deb` conectar sem nenhuma configuração na estação: não há
///    `.env` para achar quando o atalho abre o app com o `cwd` no `$HOME`.
/// 3. **Padrão do docker-compose**, para quem clonou o repositório e só rodou
///    `cargo run` sem preparar nada.
///
/// Vazio conta como ausente: `DB_HOST=` num `.env` é engano de edição, e cair
/// no valor compilado é melhor que montar uma URL sem host.
///
/// O valor compilado NÃO é segredo guardado: `strings` no binário o mostra.
/// Ele existe para dispensar configuração na estação, e a proteção real do
/// banco é o papel que essas credenciais têm no PostgreSQL, não o binário.
fn definicao(chave: &str, compilado: Option<&'static str>, padrao: &str) -> String {
    std::env::var(chave)
        .ok()
        .filter(|valor| !valor.trim().is_empty())
        .or_else(|| compilado.map(str::to_string))
        .unwrap_or_else(|| padrao.to_string())
}

impl AppState {
    pub fn from_env() -> Self {
        let database_url = {
            let host = definicao("DB_HOST", option_env!("ADMP6_DB_HOST"), "localhost");
            let port = definicao("DB_PORT", option_env!("ADMP6_DB_PORT"), "5438");
            let name = definicao("DB_NAME", option_env!("ADMP6_DB_NAME"), "adm_p6_db");
            let user = definicao("DB_USER", option_env!("ADMP6_DB_USER"), "adm_p6_user");
            let password = definicao(
                "DB_PASSWORD",
                option_env!("ADMP6_DB_PASSWORD"),
                "adm_p6_password",
            );
            // O modo de TLS é declarado, não herdado do padrão do driver.
            //
            // O `prefer` do sqlx tenta TLS e ACEITA texto claro se o servidor
            // dispensar — o que basta para produção parecer criptografada por
            // consequência do servidor, e não por exigência nossa. Com o banco
            // fora da rede da seção e dados pessoais de 244 militares no meio,
            // quem decide é a configuração: `require` em produção, `prefer` no
            // docker-compose local, que não fala TLS.
            let sslmode = definicao("DB_SSLMODE", option_env!("ADMP6_DB_SSLMODE"), "prefer");
            format!("postgres://{user}:{password}@{host}:{port}/{name}?sslmode={sslmode}")
        };

        Self::from_url(database_url)
    }

    /// Estado apontando para uma URL explícita. Existe para o teste de
    /// integração, que sobe um banco descartável por arquivo.
    pub fn from_url(database_url: String) -> Self {
        Self {
            database_url,
            pool: RwLock::new(None),
            session: RwLock::new(None),
        }
    }

    pub async fn pool(&self) -> Result<PgPool, sqlx::Error> {
        if let Some(pool) = self.pool.read().await.clone() {
            return Ok(pool);
        }

        let pool = crate::db::pool::connect(&self.database_url).await?;
        *self.pool.write().await = Some(pool.clone());
        Ok(pool)
    }

    pub async fn set_session(&self, user: Option<SessionUser>) {
        *self.session.write().await = user;
    }

    pub async fn session(&self) -> Option<SessionUser> {
        self.session.read().await.clone()
    }
}
