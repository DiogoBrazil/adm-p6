use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};
use crate::users::domain::{
    SaveUserRequest, SaveUserResult, UserFormSchema, UserListItem, UserListResult, UserProcessItem,
    UserStatistics,
};
use crate::users::repository;

#[tauri::command]
pub async fn users_list(
    state: State<'_, AppState>,
    search: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<ApiResponse<UserListResult>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_paginated(
            &pool,
            search.as_deref(),
            page.unwrap_or(1),
            per_page.unwrap_or(50),
        ).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_save(
    state: State<'_, AppState>,
    request: SaveUserRequest,
) -> Result<ApiResponse<SaveUserResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        if request.id.as_deref() == Some(actor.id.as_str()) && request.is_operador && request.perfil.as_deref() != Some("admin") {
            return Err(AppError::Domain("admin nao pode remover o proprio perfil admin".to_string()));
        }

        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let (id, op) = if request.id.is_some() {
            (repository::update(&mut tx, &request).await?, "UPDATE")
        } else {
            (repository::create(&mut tx, &request).await?, "CREATE")
        };
        audit_repository::register_tx(&mut tx, "usuarios", &id, op, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveUserResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn users_delete(state: State<'_, AppState>, id: String) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        if actor.id == id {
            return Err(AppError::Domain("admin nao pode desativar a propria conta".to_string()));
        }
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::deactivate(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "usuarios", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn users_reactivate(state: State<'_, AppState>, id: String) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::reactivate(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "usuarios", &id, "UPDATE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn users_list_encarregados(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<UserListItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_encarregados(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<UserListItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_statistics(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<UserStatistics>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::statistics(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_proceedings_responsible(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Vec<UserProcessItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::proceedings_as_responsible(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_proceedings_escrivao(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Vec<UserProcessItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::proceedings_as_escrivao(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_proceedings_involved(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Vec<UserProcessItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::proceedings_as_involved(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn users_form_schema(state: State<'_, AppState>) -> Result<ApiResponse<UserFormSchema>, String> {
    Ok(from_result(async {
        require_admin(&state).await?;
        Ok(UserFormSchema {
            title: "Usuário",
            admin_only: true,
            fields: vec![
                "tipo_usuario",
                "posto_graduacao",
                "nome",
                "matricula",
                "is_encarregado",
                "is_operador",
                "email",
                "perfil",
                "senha",
            ],
            validations: vec![
                "nome uppercase",
                "email lowercase e obrigatorio para operador",
                "senha minima de 4 caracteres para operador",
                "criacao, edicao e remocao somente admin",
            ],
        })
    }.await).await)
}
