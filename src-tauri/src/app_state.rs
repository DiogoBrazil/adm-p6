use sqlx::PgPool;
use tokio::sync::{Mutex, RwLock};

use crate::auth::domain::SessionUser;
use crate::database_config::ConnectionInput;

pub struct AppState {
    // Serializa login, troca de conexão e migrations; nunca guardar este lock em pool().
    pub(crate) lifecycle: Mutex<()>,
    pub(crate) pool: RwLock<Option<PgPool>>,
    pub(crate) development: Option<ConnectionInput>,
    test_url: Option<String>,
    session: RwLock<Option<SessionUser>>,
}

impl AppState {
    pub fn for_application() -> Self {
        Self {
            lifecycle: Mutex::new(()),
            pool: RwLock::new(None),
            development: {
                #[cfg(debug_assertions)]
                {
                    Some(crate::database_config::development_config())
                }
                #[cfg(not(debug_assertions))]
                {
                    None
                }
            },
            test_url: None,
            session: RwLock::new(None),
        }
    }

    /// Estado explícito para testes com banco descartável, sem cofre/migrations automáticas.
    pub fn from_url(database_url: String) -> Self {
        Self {
            lifecycle: Mutex::new(()),
            pool: RwLock::new(None),
            development: None,
            test_url: Some(database_url),
            session: RwLock::new(None),
        }
    }

    pub async fn pool(&self) -> Result<PgPool, sqlx::Error> {
        let mut pool = self.pool.write().await;
        if let Some(pool) = pool.as_ref() {
            return Ok(pool.clone());
        }
        // A aplicação só publica o pool depois de salvar no cofre e migrar.
        let url = self.test_url.as_ref().ok_or(sqlx::Error::PoolClosed)?;
        let connected = crate::db::pool::connect(url).await?;
        *pool = Some(connected.clone());
        Ok(connected)
    }

    pub async fn set_session(&self, user: Option<SessionUser>) {
        *self.session.write().await = user;
    }

    pub async fn session(&self) -> Option<SessionUser> {
        self.session.read().await.clone()
    }
}
