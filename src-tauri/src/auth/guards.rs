use crate::app_state::AppState;
use crate::auth::domain::SessionUser;
use crate::error::AppError;

pub async fn require_session(state: &AppState) -> Result<SessionUser, AppError> {
    state.session().await.ok_or(AppError::Unauthorized)
}

pub async fn require_admin(state: &AppState) -> Result<SessionUser, AppError> {
    let session = require_session(state).await?;
    if session.is_admin {
        Ok(session)
    } else {
        Err(AppError::Forbidden)
    }
}
