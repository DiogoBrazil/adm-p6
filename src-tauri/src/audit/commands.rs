use tauri::State;

use crate::app_state::AppState;
use crate::audit::domain::{
    AuditDetailItem, AuditPageResult, AuditStatistics, AuditStatisticsFilter,
};
use crate::audit::repository;
use crate::auth::guards::require_admin;
use crate::db::paginacao::Recorte;
use crate::response::{from_result, ApiResponse};

/// Uma página da trilha, com os três filtros da tela.
///
/// Recebia `limit`/`offset` **sem teto nenhum** — um pedido de 100.000 linhas
/// era servido. Agora fala a mesma língua das outras listagens: `page`,
/// `perPage` (camelCase no IPC) e o envelope com o total do escopo.
#[tauri::command]
pub async fn audit_list(
    state: State<'_, AppState>,
    page: Option<i64>,
    per_page: Option<i64>,
    entidade: Option<String>,
    operacao: Option<String>,
    usuario_id: Option<String>,
) -> Result<ApiResponse<AuditPageResult>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list(
                &pool,
                Recorte::novo(page, per_page),
                entidade.as_deref(),
                operacao.as_deref(),
                usuario_id.as_deref(),
            )
            .await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn audit_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<AuditDetailItem>>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::get_by_id(&pool, &id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn audit_by_record(
    state: State<'_, AppState>,
    entidade: String,
    registro_id: String,
) -> Result<ApiResponse<Vec<AuditDetailItem>>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_by_record(&pool, &entidade, &registro_id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn audit_by_user(
    state: State<'_, AppState>,
    usuario_id: String,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<ApiResponse<AuditPageResult>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_by_user(&pool, &usuario_id, Recorte::novo(page, per_page)).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn audit_statistics(
    state: State<'_, AppState>,
    filter: Option<AuditStatisticsFilter>,
) -> Result<ApiResponse<AuditStatistics>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::statistics(&pool, &filter.unwrap_or_default()).await?)
        }
        .await,
    )
    .await)
}
