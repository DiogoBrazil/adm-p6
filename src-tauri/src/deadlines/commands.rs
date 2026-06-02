use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::require_session;
use chrono::NaiveDate;
use crate::deadlines::domain::{
    AddExtensionRequest, CalculateDeadlineResult, DeadlineItem, DeadlineReportFilter,
    DeadlineReportItem, DeadlineSummary, OverdueDeadlineItem, UpcomingDeadlineItem,
};
use crate::deadlines::repository;
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn deadlines_dashboard(
    state: State<'_, AppState>,
) -> Result<ApiResponse<DeadlineSummary>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::dashboard(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_list(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<Vec<DeadlineItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list(&pool, &processo_id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_upcoming(
    state: State<'_, AppState>,
    days_ahead: Option<i32>,
) -> Result<ApiResponse<Vec<UpcomingDeadlineItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::upcoming(&pool, days_ahead.unwrap_or(7)).await?)
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_close(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::close_active(&mut tx, &processo_id).await?;
        audit_repository::register_tx(
            &mut tx, "prazos_processo", &processo_id, "UPDATE", Some(&actor.id),
        ).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_calculate(
    state: State<'_, AppState>,
    tipo_detalhe: String,
    documento_iniciador: String,
    data_inicio: NaiveDate,
    dias_prazo: Option<i32>,
) -> Result<ApiResponse<CalculateDeadlineResult>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let dias = dias_prazo.unwrap_or_else(|| {
            if documento_iniciador == "Feito Preliminar" { return 15; }
            match tipo_detalhe.as_str() {
                "SV" => 15,
                "IPM" => 40,
                _ => 30,
            }
        });
        let data_vencimento = data_inicio + chrono::Duration::days(dias as i64 - 1);
        Ok(CalculateDeadlineResult { data_vencimento, dias_prazo: dias })
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_overdue(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<OverdueDeadlineItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::overdue(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_report(
    state: State<'_, AppState>,
    filter: Option<DeadlineReportFilter>,
) -> Result<ApiResponse<Vec<DeadlineReportItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::report(&pool, &filter.unwrap_or_default()).await?)
    }.await).await)
}

#[tauri::command]
pub async fn deadlines_add_extension(
    state: State<'_, AppState>,
    request: AddExtensionRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let new_id = repository::add_extension(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx, "prazos_processo", &request.processo_id, "UPDATE", Some(&actor.id),
        ).await?;
        tx.commit().await?;
        Ok(new_id)
    }.await).await)
}
