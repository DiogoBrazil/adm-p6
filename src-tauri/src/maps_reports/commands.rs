use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::maps_reports::domain::{
    ContagemRotulada, CsvExport, DriverRankingItem, MapPeriodRequest, MapRow, ReportFilter,
    SaveMapRequest, SavedMapFull, SavedMapListItem,
};
use crate::maps_reports::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn reports_map_rows(
    state: State<'_, AppState>,
    request: MapPeriodRequest,
) -> Result<ApiResponse<Vec<MapRow>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::map_rows(&pool, &request).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_save_map(
    state: State<'_, AppState>,
    request: SaveMapRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            let id = repository::save_map(&mut tx, &request, &actor.id).await?;
            audit_repository::register_tx(&mut tx, "mapas_salvos", &id, "CREATE", Some(&actor.id))
                .await?;
            tx.commit().await?;
            Ok(id)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_saved_maps(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<SavedMapListItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_saved_maps(&pool).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_get_saved_map(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<SavedMapFull>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::get_saved_map(&pool, &id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_delete_saved_map(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::delete_saved_map(&mut tx, &id).await?;
            audit_repository::register_tx(&mut tx, "mapas_salvos", &id, "DELETE", Some(&actor.id))
                .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_by_responsible(
    state: State<'_, AppState>,
    filter: Option<ReportFilter>,
) -> Result<ApiResponse<Vec<ContagemRotulada>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::by_responsible(&pool, &filter.unwrap_or_default()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_by_nature(
    state: State<'_, AppState>,
    filter: Option<ReportFilter>,
) -> Result<ApiResponse<Vec<ContagemRotulada>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::by_nature(&pool, &filter.unwrap_or_default()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_driver_ranking(
    state: State<'_, AppState>,
    filter: Option<ReportFilter>,
) -> Result<ApiResponse<Vec<DriverRankingItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::driver_ranking(&pool, &filter.unwrap_or_default()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_available_years(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<i32>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::available_years(&pool).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_export_csv(
    state: State<'_, AppState>,
    request: MapPeriodRequest,
) -> Result<ApiResponse<CsvExport>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::export_csv(&pool, &request).await?)
        }
        .await,
    )
    .await)
}
