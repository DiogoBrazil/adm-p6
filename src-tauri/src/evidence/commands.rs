use serde::Serialize;
use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::require_session;
use crate::evidence::domain::{EvidenceData, PmWithEvidence, SaveEvidenceRequest};
use crate::evidence::repository;
use crate::legal_catalogs::domain::{Art29Item, Art32Item, CrimeItem, TransgressionItem};
use crate::response::{from_result, ApiResponse};

#[derive(Debug, Serialize)]
pub struct EvidenceSearchContract {
    pub sources: Vec<&'static str>,
    pub categories_jsonb: &'static str,
    pub save_semantics: &'static str,
}

#[tauri::command]
pub async fn evidence_search_catalogs(
    state: State<'_, AppState>,
) -> Result<ApiResponse<EvidenceSearchContract>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        Ok(EvidenceSearchContract {
            sources: vec![
                "crimes_contravencoes",
                "transgressoes",
                "infracoes_estatuto_art29",
                "infracoes_estatuto_art32",
            ],
            categories_jsonb: "pm_envolvido_indicios.categorias_indicios",
            save_semantics: "salvar indicios deve substituir vinculos existentes em transacao sqlx",
        })
    }.await).await)
}

#[tauri::command]
pub async fn evidence_save_for_pm(
    state: State<'_, AppState>,
    request: SaveEvidenceRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;

        repository::save_for_pm(&mut tx, &request).await?;

        audit_repository::register_tx(
            &mut tx,
            "pm_envolvido_indicios",
            &request.pm_envolvido_id,
            "UPDATE",
            Some(&actor.id),
        )
        .await?;

        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn evidence_load_for_pm(
    state: State<'_, AppState>,
    pm_envolvido_id: String,
) -> Result<ApiResponse<EvidenceData>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::load_for_pm(&pool, &pm_envolvido_id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn evidence_list_for_proceeding(
    state: State<'_, AppState>,
    procedimento_id: String,
) -> Result<ApiResponse<Vec<PmWithEvidence>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_for_proceeding(&pool, &procedimento_id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn evidence_remove_for_pm(
    state: State<'_, AppState>,
    pm_envolvido_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::remove_for_pm(&mut tx, &pm_envolvido_id).await?;
        audit_repository::register_tx(
            &mut tx, "pm_envolvido_indicios", &pm_envolvido_id, "DELETE", Some(&actor.id),
        ).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn evidence_categories(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<&'static str>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        Ok(vec!["crimes_cpm", "transgressoes_rdpm", "transgressoes_art29", "sem_indicios"])
    }.await).await)
}

#[tauri::command]
pub async fn evidence_search_crimes(
    state: State<'_, AppState>,
    termo: String,
) -> Result<ApiResponse<Vec<CrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::search_crimes(&pool, &termo).await?)
    }.await)
    .await)
}

#[tauri::command]
pub async fn evidence_search_rdpm(
    state: State<'_, AppState>,
    termo: String,
    natureza: Option<String>,
) -> Result<ApiResponse<Vec<TransgressionItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::search_rdpm(&pool, &termo, natureza.as_deref()).await?)
    }.await)
    .await)
}

#[tauri::command]
pub async fn evidence_search_art29(
    state: State<'_, AppState>,
    termo: String,
) -> Result<ApiResponse<Vec<Art29Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::search_art29(&pool, &termo).await?)
    }.await)
    .await)
}

#[tauri::command]
pub async fn evidence_search_art32(
    state: State<'_, AppState>,
    termo: String,
) -> Result<ApiResponse<Vec<Art32Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::search_art32(&pool, &termo).await?)
    }.await)
    .await)
}
