use tauri::State;

use crate::app_state::AppState;
use crate::auth::guards::{require_admin, require_session};
use crate::maps_reports::domain::{
    AnnualStatistics, CompleteMapResult, CsvExportRequest, CsvExportResult, DashboardSummary,
    GenerateCompleteMapRequest, GenerateMapRequest, MonthlyMapResult, PrazoVencidoItem,
    ReportContract, ResponsavelRelatorio, SaveMapRequest, SaveMapResult, SavedMapFull,
    SavedMapListItem, TipoProcessoItem, TipoRelatorio,
};
use crate::maps_reports::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn dashboard_summary(
    state: State<'_, AppState>,
) -> Result<ApiResponse<DashboardSummary>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::dashboard_summary(&pool).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_process_types(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<TipoProcessoItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::process_types(&pool).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_generate_monthly_map(
    state: State<'_, AppState>,
    request: GenerateMapRequest,
) -> Result<ApiResponse<MonthlyMapResult>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::generate_monthly_map(&pool, &request).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_generate_complete_map(
    state: State<'_, AppState>,
    request: GenerateCompleteMapRequest,
) -> Result<ApiResponse<CompleteMapResult>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::generate_complete_map(&pool, &request).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_save_map(
    state: State<'_, AppState>,
    request: SaveMapRequest,
) -> Result<ApiResponse<SaveMapResult>, String> {
    Ok(from_result(
        async {
            let actor = require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::save_map(&pool, &request, &actor.id, &actor.nome).await?)
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
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::delete_saved_map(&pool, &id).await?)
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
            Ok(repository::saved_maps(&pool, 100).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_annual_statistics(
    state: State<'_, AppState>,
    ano: i32,
) -> Result<ApiResponse<AnnualStatistics>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::annual_statistics(&pool, ano).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_by_responsible(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<ResponsavelRelatorio>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::by_responsible(&pool, ano).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_by_type(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<TipoRelatorio>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::by_type(&pool, ano).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_overdue_deadlines(
    state: State<'_, AppState>,
    days_past: Option<i32>,
) -> Result<ApiResponse<Vec<PrazoVencidoItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::overdue_deadlines(&pool, days_past.unwrap_or(0)).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_export_csv(
    state: State<'_, AppState>,
    request: CsvExportRequest,
) -> Result<ApiResponse<CsvExportResult>, String> {
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

#[tauri::command]
pub async fn reports_responsible_statistics(
    state: State<'_, AppState>,
) -> Result<ApiResponse<ReportContract>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            Ok(ReportContract {
                name: "Estatísticas de Encarregados",
                parity: "agregacoes devem bater com o legado em Parallel Run",
                commands: vec![
                    "reports.get_responsible_statistics",
                    "reports.get_latest_proceedings_by_responsible",
                ],
            })
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn reports_process_statistics(
    state: State<'_, AppState>,
) -> Result<ApiResponse<ReportContract>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            Ok(ReportContract {
                name: "Estatísticas de Processos",
                parity: "rankings, contagens e graficos devem preservar agregacoes",
                commands: vec![
                    "reports.get_pads_solution_statistics",
                    "reports.get_ipm_evidence_statistics",
                    "reports.get_sr_evidence_statistics",
                    "reports.get_top_transgressions",
                ],
            })
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
pub async fn reports_monthly_map_schema(
    state: State<'_, AppState>,
) -> Result<ApiResponse<ReportContract>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            Ok(ReportContract {
                name: "Mapa Mensal",
                parity: "mapa mensal PDF e dados JSON sao prioridade confirmada",
                commands: vec![
                    "reports.generate_monthly_map",
                    "reports.generate_complete_monthly_map",
                    "reports.save_monthly_map",
                ],
            })
        }
        .await,
    )
    .await)
}
