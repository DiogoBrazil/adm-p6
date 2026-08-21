use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::evidence::domain::{
    EnvolvidoComIndicios, EvidenceData, InfracaoEstatutoItem, InfracaoPenalItem,
    SaveEvidenceRequest, TransgressaoItem,
};
use crate::evidence::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn evidence_save_for_pm(
    state: State<'_, AppState>,
    request: SaveEvidenceRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::save_for_envolvido(&mut tx, &request).await?;
            audit_repository::register_tx(
                &mut tx,
                "processo_envolvidos",
                &request.envolvido_id,
                "UPDATE",
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn evidence_load_for_pm(
    state: State<'_, AppState>,
    envolvido_id: String,
) -> Result<ApiResponse<EvidenceData>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::load_for_envolvido(&pool, &envolvido_id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn evidence_list_for_proceeding(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<Vec<EnvolvidoComIndicios>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_for_proceeding(&pool, &processo_id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn evidence_remove_for_pm(
    state: State<'_, AppState>,
    envolvido_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::remove_for_envolvido(&mut tx, &envolvido_id).await?;
            audit_repository::register_tx(
                &mut tx,
                "processo_envolvidos",
                &envolvido_id,
                "DELETE",
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn evidence_search_infracoes_penais(
    state: State<'_, AppState>,
    termo: String,
    dispositivo_legal_id: Option<String>,
) -> Result<ApiResponse<Vec<InfracaoPenalItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(
                repository::search_infracoes_penais(&pool, &termo, dispositivo_legal_id.as_deref())
                    .await?,
            )
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn evidence_search_transgressoes(
    state: State<'_, AppState>,
    termo: String,
    natureza_id: Option<String>,
) -> Result<ApiResponse<Vec<TransgressaoItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::search_transgressoes(&pool, &termo, natureza_id.as_deref()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn evidence_search_infracoes_estatuto(
    state: State<'_, AppState>,
    termo: String,
    artigo: Option<String>,
) -> Result<ApiResponse<Vec<InfracaoEstatutoItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::search_infracoes_estatuto(&pool, &termo, artigo.as_deref()).await?)
        }
        .await,
    )
    .await)
}
