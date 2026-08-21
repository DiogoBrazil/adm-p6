use bcrypt::{hash, verify, DEFAULT_COST};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tauri::State;

use crate::app_state::AppState;
use crate::auth::domain::SessionUser;
use crate::auth::repository;
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub senha: String,
}

#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>,
    email: String,
    senha: String,
) -> Result<ApiResponse<SessionUser>, String> {
    Ok(from_result(login(&state, LoginRequest { email, senha }).await).await)
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AppState>) -> Result<ApiResponse<bool>, String> {
    state.set_session(None).await;
    Ok(ApiResponse::ok(true))
}

#[tauri::command]
pub async fn auth_current_user(
    state: State<'_, AppState>,
) -> Result<ApiResponse<SessionUser>, String> {
    Ok(match state.session().await {
        Some(user) => ApiResponse::ok(user),
        None => ApiResponse::err(AppError::Unauthorized),
    })
}

async fn login(state: &AppState, request: LoginRequest) -> Result<SessionUser, AppError> {
    let pool = state.pool().await?;
    let row = repository::find_account_by_email(&pool, request.email.trim())
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    let stored_hash = row.senha_hash.clone();
    let valid = if stored_hash.starts_with("$2") {
        verify(&request.senha, &stored_hash).unwrap_or(false)
    } else if stored_hash.len() == 64 {
        let mut hasher = Sha256::new();
        hasher.update(request.senha.as_bytes());
        let candidate = hex::encode(hasher.finalize());
        candidate.eq_ignore_ascii_case(&stored_hash)
    } else {
        false
    };

    if !valid {
        return Err(AppError::InvalidCredentials);
    }

    if !stored_hash.starts_with("$2") {
        let upgraded = hash(&request.senha, DEFAULT_COST)
            .map_err(|error| AppError::Domain(format!("falha ao atualizar hash: {error}")))?;
        repository::update_password_hash(&pool, &row.id, &upgraded).await?;
    }

    let session = SessionUser::from(row);
    state.set_session(Some(session.clone())).await;
    Ok(session)
}
