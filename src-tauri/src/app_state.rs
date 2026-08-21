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
        let database_url = {
            let host = std::env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
            let port = std::env::var("DB_PORT").unwrap_or_else(|_| "5438".to_string());
            let name = std::env::var("DB_NAME").unwrap_or_else(|_| "adm_p6_db".to_string());
            let user = std::env::var("DB_USER").unwrap_or_else(|_| "adm_p6_user".to_string());
            let password =
                std::env::var("DB_PASSWORD").unwrap_or_else(|_| "adm_p6_password".to_string());
            format!("postgres://{user}:{password}@{host}:{port}/{name}")
        };

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
