use chrono::NaiveDate;
use tauri::State;

use crate::app_state::AppState;
use crate::audit::assunto;
use crate::audit::repository::{self as audit_repository, Acao};
use crate::auth::guards::{require_admin, require_session};
use crate::deadlines::domain::{
    AddExtensionRequest, CalculateDeadlineResult, DeadlineItem, DeadlineReportFilter,
    DeadlineReportResult, DeadlineSummary, UpdateExtensionRequest,
};
use crate::deadlines::repository;
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn deadlines_dashboard(
    state: State<'_, AppState>,
    dias_janela: Option<i32>,
) -> Result<ApiResponse<DeadlineSummary>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::dashboard(&pool, dias_janela.unwrap_or(7)).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn deadlines_list(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<Vec<DeadlineItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list(&pool, &processo_id).await?)
        }
        .await,
    )
    .await)
}

/// Prévia do prazo antes de gravar. Os dias vêm do cadastro — a combinação
/// apuratório × documento iniciador, com o padrão do apuratório como reserva —
/// e o vencimento é sempre `data_inicio + dias`, a mesma conta que a coluna
/// gerada do banco faz na hora de gravar.
#[tauri::command]
pub async fn deadlines_calculate(
    state: State<'_, AppState>,
    apuratorio_id: String,
    documento_iniciador_id: String,
    data_inicio: NaiveDate,
    dias: Option<i32>,
) -> Result<ApiResponse<CalculateDeadlineResult>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            let (dias, origem) = match dias {
                Some(d) if d > 0 => (d, "informado"),
                _ => {
                    let (d, do_documento) =
                        repository::dias_base(&pool, &apuratorio_id, &documento_iniciador_id)
                            .await?;
                    (
                        d,
                        if do_documento {
                            "documento iniciador"
                        } else {
                            "apuratorio"
                        },
                    )
                }
            };
            Ok(CalculateDeadlineResult {
                data_vencimento: data_inicio + chrono::Duration::days(dias as i64),
                dias,
                origem,
            })
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn deadlines_report(
    state: State<'_, AppState>,
    filter: Option<DeadlineReportFilter>,
) -> Result<ApiResponse<DeadlineReportResult>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::report(&pool, &filter.unwrap_or_default()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn deadlines_add_extension(
    state: State<'_, AppState>,
    request: AddExtensionRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let id = repository::add_extension(&mut tx, &request).await?;
            let assunto = assunto::de_prazo(&mut tx, &id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "processo_prazos",
                    registro_id: &id,
                    operacao: "CREATE",
                    acao: "Registrou uma prorrogação de prazo",
                    assunto,
                    alteracoes: None,
                },
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
pub async fn deadlines_update_extension(
    state: State<'_, AppState>,
    request: UpdateExtensionRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let alterado = repository::update_extension(&mut tx, &request).await?;
            let assunto = assunto::de_prazo(&mut tx, &request.prazo_id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "processo_prazos",
                    registro_id: &request.prazo_id,
                    operacao: "UPDATE",
                    acao: "Corrigiu uma prorrogação de prazo",
                    assunto,
                    alteracoes: None,
                },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(alterado)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn deadlines_delete_extension(
    state: State<'_, AppState>,
    processo_id: String,
    prazo_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let removido = repository::delete_extension(&mut tx, &processo_id, &prazo_id).await?;
            let assunto = assunto::de_apuratorio(&mut tx, &processo_id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "processo_prazos",
                    registro_id: &prazo_id,
                    operacao: "DELETE",
                    acao: "Removeu uma prorrogação de prazo",
                    assunto,
                    alteracoes: None,
                },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(removido)
        }
        .await,
    )
    .await)
}
