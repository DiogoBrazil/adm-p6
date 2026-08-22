use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::proceedings::domain::{
    AnexoItem, AttachmentContent, DashboardSummary, ProceedingDetail, ProceedingFilter,
    ProceedingListResult, SaveProceedingRequest, SubstituirDesignacaoRequest,
    UploadAttachmentRequest,
};
use crate::proceedings::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn proceedings_list(
    state: State<'_, AppState>,
    filter: Option<ProceedingFilter>,
) -> Result<ApiResponse<ProceedingListResult>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list(&pool, &filter.unwrap_or_default()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn proceedings_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<ProceedingDetail>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::get(&pool, &id).await?)
        }
        .await,
    )
    .await)
}

/// Cria ou atualiza. Gravar processo é operação administrativa — antes a trava
/// era só do frontend (`canWrite()`), e qualquer sessão autenticada podia chamar
/// o comando direto.
#[tauri::command]
pub async fn proceedings_save(
    state: State<'_, AppState>,
    request: SaveProceedingRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let existente = request.id.is_some();
            let id = repository::save(&mut tx, &request).await?;
            audit_repository::register_tx(
                &mut tx,
                "processos_procedimentos",
                &id,
                if existente { "UPDATE" } else { "CREATE" },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(id)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn proceedings_delete(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::soft_delete(&mut tx, &id).await?;
            audit_repository::register_tx(
                &mut tx,
                "processos_procedimentos",
                &id,
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
pub async fn proceedings_reopen(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::reopen(&mut tx, &id).await?;
            audit_repository::register_tx(
                &mut tx,
                "processos_procedimentos",
                &id,
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

/// Substitui quem exerce um papel. O histórico é consequência: a designação
/// anterior fica registrada com `data_fim`, sem jsonb nem tabela paralela.
#[tauri::command]
pub async fn proceedings_substitute_designation(
    state: State<'_, AppState>,
    request: SubstituirDesignacaoRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let id = repository::substituir_designacao(
                &mut tx,
                &request.processo_id,
                &request.papel_id,
                &request.sucessor_id,
                request.data_troca,
                request.motivo.as_deref(),
                request.documento_autorizador_id.as_deref(),
                request.numero_documento.as_deref(),
            )
            .await?;
            audit_repository::register_tx(
                &mut tx,
                "processo_designacoes",
                &id,
                "CREATE",
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(id)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn proceedings_list_attachments(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<Vec<AnexoItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_anexos(&pool, &processo_id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn proceedings_upload_attachment(
    state: State<'_, AppState>,
    request: UploadAttachmentRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let id = repository::upload_anexo(&mut tx, &request, &actor.id).await?;
            audit_repository::register_tx(
                &mut tx,
                "processo_anexos",
                &id,
                "CREATE",
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(id)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn proceedings_get_attachment(
    state: State<'_, AppState>,
    anexo_id: String,
) -> Result<ApiResponse<Option<AttachmentContent>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::get_anexo(&pool, &anexo_id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn proceedings_remove_attachment(
    state: State<'_, AppState>,
    anexo_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::remove_anexo(&mut tx, &anexo_id).await?;
            audit_repository::register_tx(
                &mut tx,
                "processo_anexos",
                &anexo_id,
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
pub async fn dashboard_summary(
    state: State<'_, AppState>,
) -> Result<ApiResponse<DashboardSummary>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::dashboard(&pool).await?)
        }
        .await,
    )
    .await)
}
