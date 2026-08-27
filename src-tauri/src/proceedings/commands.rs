use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::proceedings::domain::{
    AnexoItem, AttachmentContent, AtualizarSubstituicaoRequest, DashboardSummary, ProceedingDetail,
    ProceedingFilter, ProceedingListResult, SaveProceedingRequest, SubstituirDesignacaoRequest,
    UpdateInvolvedOutcomeRequest, UpdateProceedingClosureRequest, UploadAttachmentRequest,
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

#[tauri::command]
pub async fn proceedings_update_closure(
    state: State<'_, AppState>,
    request: UpdateProceedingClosureRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::update_closure(&mut tx, &request).await?;
            audit_repository::register_tx(
                &mut tx,
                "processos_procedimentos",
                &request.processo_id,
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
pub async fn proceedings_update_involved_outcome(
    state: State<'_, AppState>,
    request: UpdateInvolvedOutcomeRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::update_involved_outcome(&mut tx, &request).await?;
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

/// Registra na auditoria as duas designações que uma substituição sempre mexe.
///
/// A antecessora é tão alterada quanto a sucessora — ganha ou perde `data_fim` —
/// e uma trilha que registrasse só a sucessora deixaria a outra mudando sozinha,
/// sem autor nem instante.
async fn auditar_substituicao(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    aplicada: &repository::SubstituicaoAplicada,
    operacao_sucessora: &str,
    ator: &str,
) -> Result<(), AppError> {
    audit_repository::register_tx(
        tx,
        "processo_designacoes",
        &aplicada.designacao_id,
        operacao_sucessora,
        Some(ator),
    )
    .await?;
    audit_repository::register_tx(
        tx,
        "processo_designacoes",
        &aplicada.anterior_id,
        "UPDATE",
        Some(ator),
    )
    .await?;
    Ok(())
}

/// Substitui quem exerce um papel. O histórico é consequência: a designação
/// anterior fica registrada com `data_fim` e a sucessora aponta para ela, sem
/// jsonb nem tabela paralela.
#[tauri::command]
pub async fn proceedings_substitute_designation(
    state: State<'_, AppState>,
    request: SubstituirDesignacaoRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let aplicada = repository::substituir_designacao(&mut tx, &request).await?;
            auditar_substituicao(&mut tx, &aplicada, "CREATE", &actor.id).await?;
            tx.commit().await?;
            Ok(aplicada.designacao_id)
        }
        .await,
    )
    .await)
}

/// Corrige a última substituição de uma cadeia: sucessor, data, motivo e
/// documento. A função não muda — trocar de papel seria outra designação.
#[tauri::command]
pub async fn proceedings_update_substitution(
    state: State<'_, AppState>,
    request: AtualizarSubstituicaoRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let aplicada = repository::atualizar_substituicao(&mut tx, &request).await?;
            auditar_substituicao(&mut tx, &aplicada, "UPDATE", &actor.id).await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

/// Desfaz a última substituição de uma cadeia. A antecessora volta a ser a
/// designação vigente, e a substituição anterior a ela passa a ser a última.
#[tauri::command]
pub async fn proceedings_delete_substitution(
    state: State<'_, AppState>,
    processo_id: String,
    designacao_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let aplicada =
                repository::remover_substituicao(&mut tx, &processo_id, &designacao_id).await?;
            auditar_substituicao(&mut tx, &aplicada, "DELETE", &actor.id).await?;
            tx.commit().await?;
            Ok(true)
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
