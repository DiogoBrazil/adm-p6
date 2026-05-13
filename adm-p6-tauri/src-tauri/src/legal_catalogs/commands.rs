use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::legal_catalogs::domain::{
    Art29Item, CrimeItem, LocalOrigemItem, MunicipalityItem, NaturezaItem, PostoGraduacaoItem,
    ProceedingCatalogs, SaveArt29Request, SaveCatalogResult, SaveCrimeRequest,
    SaveTransgressionRequest, TransgressionItem,
};
use crate::legal_catalogs::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn legal_catalogs_list_crimes(state: State<'_, AppState>) -> Result<ApiResponse<Vec<CrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_crimes(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_crime(
    state: State<'_, AppState>,
    request: SaveCrimeRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_crime(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "crimes_contravencoes",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_crime(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_crime(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "crimes_contravencoes", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_transgression(
    state: State<'_, AppState>,
    request: SaveTransgressionRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_transgression(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "transgressoes",
            &id.to_string(),
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id: id.to_string() })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_transgression(
    state: State<'_, AppState>,
    id: i32,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let refs = repository::referenced_transgression_count(&pool, id).await?;
        if refs > 0 {
            return Err(AppError::Domain("transgressao referenciada nao pode ser excluida".to_string()));
        }
        let mut tx = pool.begin().await?;
        repository::hard_delete_transgression(&mut tx, id).await?;
        audit_repository::register_tx(&mut tx, "transgressoes", &id.to_string(), "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_art29(
    state: State<'_, AppState>,
    request: SaveArt29Request,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_art29(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "infracoes_estatuto_art29",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_art29(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_art29(&mut tx, &id).await?;
        audit_repository::register_tx(
            &mut tx,
            "infracoes_estatuto_art29",
            &id,
            "DELETE",
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_crime(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<CrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_crime_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_transgressions(state: State<'_, AppState>) -> Result<ApiResponse<Vec<TransgressionItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_transgressions(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_art29(state: State<'_, AppState>) -> Result<ApiResponse<Vec<Art29Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_art29(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_search_municipalities(
    state: State<'_, AppState>,
    termo: Option<String>,
) -> Result<ApiResponse<Vec<MunicipalityItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::search_municipalities(&pool, termo.as_deref().unwrap_or("")).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_for_proceeding(state: State<'_, AppState>) -> Result<ApiResponse<ProceedingCatalogs>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(ProceedingCatalogs {
            crimes: repository::list_crimes(&pool, 100).await?,
            transgressoes: repository::list_transgressions(&pool, 100).await?,
            art29: repository::list_art29(&pool, 100).await?,
        })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_transgression(
    state: State<'_, AppState>,
    id: i32,
) -> Result<ApiResponse<Option<TransgressionItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_transgression_by_id(&pool, id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_art29(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<Art29Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_art29_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_locais_origem(state: State<'_, AppState>) -> Result<ApiResponse<Vec<LocalOrigemItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_locais_origem(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_postos_graduacoes(state: State<'_, AppState>) -> Result<ApiResponse<Vec<PostoGraduacaoItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_postos_graduacoes(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_naturezas(state: State<'_, AppState>) -> Result<ApiResponse<Vec<NaturezaItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_naturezas(&pool).await?)
    }.await).await)
}
