use serde_json::json;
use tauri::State;

use crate::app_state::AppState;
use crate::apuratorio_config::domain::{
    ApuratorioConfig, SaveDocumentoIniciadorRequest, SavePapelRequest,
};
use crate::apuratorio_config::repository;
use crate::audit::assunto;
use crate::audit::repository::{self as audit_repository, Acao};
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};

/// Identificador da linha na trilha de auditoria. A PK é composta, então o par
/// vai concatenado — `auditoria.registro_id` é TEXT justamente por isso.
///
/// Quem resolve o par de volta em texto legível é
/// `audit::assunto::{de_papel_do_apuratorio, de_documento_do_apuratorio}`, que
/// recebe os dois ids separados em vez de repartir esta string.
fn registro(a: &str, b: &str) -> String {
    format!("{a}:{b}")
}

#[tauri::command]
pub async fn apuratorio_config_get(
    state: State<'_, AppState>,
    apuratorio_id: String,
) -> Result<ApiResponse<Option<ApuratorioConfig>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            repository::get(&pool, &apuratorio_id).await
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn apuratorio_config_save_documento(
    state: State<'_, AppState>,
    request: SaveDocumentoIniciadorRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            repository::save_documento(&mut tx, &request).await?;
            let assunto = assunto::de_documento_do_apuratorio(
                &mut tx,
                &request.apuratorio_id,
                &request.tipo_documento_id,
            )
            .await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "apuratorio_documentos_iniciadores",
                    registro_id: &registro(&request.apuratorio_id, &request.tipo_documento_id),
                    operacao: "UPDATE",
                    acao: "Configurou um documento iniciador do apuratório",
                    assunto,
                    alteracoes: Some(json!({
                        "prazo_base_dias": request.prazo_base_dias,
                        "padrao": request.padrao,
                        "ativo": request.ativo,
                    })),
                },
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
pub async fn apuratorio_config_save_papel(
    state: State<'_, AppState>,
    request: SavePapelRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            repository::save_papel(&mut tx, &request).await?;
            let assunto =
                assunto::de_papel_do_apuratorio(&mut tx, &request.apuratorio_id, &request.papel_id)
                    .await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "apuratorio_papeis",
                    registro_id: &registro(&request.apuratorio_id, &request.papel_id),
                    operacao: "UPDATE",
                    acao: "Configurou uma função do apuratório",
                    assunto,
                    alteracoes: Some(json!({
                        "obrigatorio": request.obrigatorio,
                        "max_ocupantes": request.max_ocupantes,
                        "e_responsavel": request.e_responsavel,
                        "usa_documento_designacao": request.usa_documento_designacao,
                        "ativo": request.ativo,
                    })),
                },
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
pub async fn apuratorio_config_deactivate_documento(
    state: State<'_, AppState>,
    apuratorio_id: String,
    tipo_documento_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            let ok = repository::deactivate_documento(&mut tx, &apuratorio_id, &tipo_documento_id)
                .await?;
            if ok {
                let assunto = assunto::de_documento_do_apuratorio(
                    &mut tx,
                    &apuratorio_id,
                    &tipo_documento_id,
                )
                .await;
                audit_repository::registrar(
                    &mut tx,
                    Acao {
                        entidade: "apuratorio_documentos_iniciadores",
                        registro_id: &registro(&apuratorio_id, &tipo_documento_id),
                        operacao: "UPDATE",
                        acao: "Desativou um documento iniciador do apuratório",
                        assunto,
                        alteracoes: None,
                    },
                    Some(&actor.id),
                )
                .await?;
            }
            tx.commit().await?;
            Ok(ok)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn apuratorio_config_deactivate_papel(
    state: State<'_, AppState>,
    apuratorio_id: String,
    papel_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            let ok = repository::deactivate_papel(&mut tx, &apuratorio_id, &papel_id).await?;
            if ok {
                let assunto =
                    assunto::de_papel_do_apuratorio(&mut tx, &apuratorio_id, &papel_id).await;
                audit_repository::registrar(
                    &mut tx,
                    Acao {
                        entidade: "apuratorio_papeis",
                        registro_id: &registro(&apuratorio_id, &papel_id),
                        operacao: "UPDATE",
                        acao: "Desativou uma função do apuratório",
                        assunto,
                        alteracoes: None,
                    },
                    Some(&actor.id),
                )
                .await?;
            }
            tx.commit().await?;
            Ok(ok)
        }
        .await,
    )
    .await)
}
