use sqlx::PgPool;
use tokio::sync::RwLock;

use crate::auth::domain::SessionUser;

pub struct AppState {
    database_url: String,
    pool: RwLock<Option<PgPool>>,
    session: RwLock<Option<SessionUser>>,
}

impl AppState {
    pub fn from_env() -> Self {
        let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:postgres@localhost:5438/adm_p6_db".to_string()
        });

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
