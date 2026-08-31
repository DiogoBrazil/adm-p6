use tauri::State;

use crate::app_state::AppState;
use crate::audit::assunto;
use crate::audit::repository::{self as audit_repository, Acao};
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::movements::domain::{AddMovementRequest, MovementItem, UpdateMovementRequest};
use crate::movements::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn movements_list(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<Vec<MovementItem>>, String> {
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

#[tauri::command]
pub async fn movements_add(
    state: State<'_, AppState>,
    request: AddMovementRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let id = repository::add(&mut tx, &request, &actor.id).await?;
            let assunto = assunto::de_andamento(&mut tx, &id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "processo_andamentos",
                    registro_id: &id,
                    operacao: "CREATE",
                    acao: "Registrou um andamento",
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
pub async fn movements_update(
    state: State<'_, AppState>,
    request: UpdateMovementRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            if repository::update(&mut tx, &request).await? == 0 {
                return Err(AppError::Domain(
                    "Este andamento não existe mais. Recarregue a página.".to_string(),
                ));
            }
            let assunto = assunto::de_andamento(&mut tx, &request.andamento_id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "processo_andamentos",
                    registro_id: &request.andamento_id,
                    operacao: "UPDATE",
                    acao: "Corrigiu um andamento",
                    assunto,
                    alteracoes: None,
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
pub async fn movements_remove(
    state: State<'_, AppState>,
    processo_id: String,
    andamento_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            if repository::cancel(&mut tx, &processo_id, &andamento_id).await? == 0 {
                return Err(AppError::Domain(
                    "Este andamento não existe mais. Recarregue a página.".to_string(),
                ));
            }
            let assunto = assunto::de_andamento(&mut tx, &andamento_id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "processo_andamentos",
                    registro_id: &andamento_id,
                    operacao: "DELETE",
                    acao: "Cancelou um andamento",
                    assunto,
                    alteracoes: None,
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
