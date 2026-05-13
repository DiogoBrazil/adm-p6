use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::proceedings::domain::{
    CommonCrimeItem, CreateProceedingRequest, CreateProceedingResult, DriverRankingItem,
    IpmEvidenceStats, InProgressStats, MilitaryCrimeItem, NatureStatItem, PadsSolutionCount,
    PdfMetadata, ProceedingDetail, ProceedingFormSchema, ProceedingListFilter, ProceedingListResult,
    SrEvidenceStats, SubstituteResponsibleRequest, TopTransgressionItem, UpdateProceedingRequest,
    UploadPdfRequest,
};
use crate::proceedings::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn proceedings_list(
    state: State<'_, AppState>,
    filter: Option<ProceedingListFilter>,
) -> Result<ApiResponse<ProceedingListResult>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_filtered(&pool, &filter.unwrap_or_default()).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_form_schema(
    state: State<'_, AppState>,
) -> Result<ApiResponse<ProceedingFormSchema>, String> {
    Ok(from_result(async {
        require_admin(&state).await?;
        Ok(ProceedingFormSchema {
            title: "Procedimento",
            admin_only: true,
            allowed_tipo_detalhe: vec!["PAD", "PADE", "CD", "CJ", "SR", "SV", "IPM", "FP", "CP", "PADS"],
            forbidden_tipo_detalhe: vec!["IPPM"],
            sections: vec![
                "identificacao",
                "papeis_responsaveis",
                "envolvidos",
                "enquadramento",
                "prazos",
                "indicios",
                "pdf",
            ],
            validations: vec![
                "IPM tem prazo inicial de 40 dias",
                "PADS exige transgressao",
                "datas de instauracao e conclusao nao podem ser futuras",
                "penalidade_dias apenas para Prisao ou Detencao",
                "PDF limitado a 100 MB",
            ],
        })
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_create(
    state: State<'_, AppState>,
    request: CreateProceedingRequest,
) -> Result<ApiResponse<CreateProceedingResult>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        request.validate().map_err(AppError::Domain)?;

        let pool = state.pool().await?;

        let ano = request.data_instauracao.map(|d| d.format("%Y").to_string());
        if repository::number_exists(
            &pool, &request.numero, &request.documento_iniciador,
            &request.tipo_detalhe, request.local_origem.as_deref(),
            ano.as_deref(), None,
        ).await? {
            return Err(AppError::Domain(
                "Numero de processo ja cadastrado para este local, tipo e ano".to_string(),
            ));
        }

        let mut tx = pool.begin().await?;

        let dias = request.deadline_days();
        let data_recebimento = request.data_recebimento;

        let id = repository::create(&mut tx, &request).await?;

        if let Some(data_inicio) = data_recebimento {
            repository::insert_initial_deadline(&mut tx, &id, data_inicio, dias).await?;
        }

        audit_repository::register_tx(&mut tx, "processos_procedimentos", &id, "CREATE", Some(&actor.id)).await?;

        tx.commit().await?;
        Ok(CreateProceedingResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<ProceedingDetail>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_update(
    state: State<'_, AppState>,
    request: UpdateProceedingRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        request.validate().map_err(AppError::Domain)?;

        let pool = state.pool().await?;

        let ano = request.data_instauracao.map(|d| d.format("%Y").to_string());
        if repository::number_exists(
            &pool, &request.numero, &request.documento_iniciador,
            &request.tipo_detalhe, request.local_origem.as_deref(),
            ano.as_deref(), Some(&request.id),
        ).await? {
            return Err(AppError::Domain(
                "Numero de processo ja cadastrado para este local, tipo e ano".to_string(),
            ));
        }

        let mut tx = pool.begin().await?;
        let id = request.id.clone();
        repository::update(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "processos_procedimentos", &id, "UPDATE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_delete(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::delete(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "processos_procedimentos", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_reopen(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::reopen(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "processos_procedimentos", &id, "UPDATE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_upload_pdf(
    state: State<'_, AppState>,
    request: UploadPdfRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let bytes = request.decode_and_validate().map_err(AppError::Domain)?;

        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;

        repository::save_pdf(&mut tx, &request.processo_id, &request.nome_arquivo, &request.content_type, &bytes).await?;
        audit_repository::register_tx(&mut tx, "processos_procedimentos", &request.processo_id, "UPDATE", Some(&actor.id)).await?;

        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_get_pdf(
    state: State<'_, AppState>,
    processo_id: String,
    include_content: bool,
) -> Result<ApiResponse<Option<PdfMetadata>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_pdf(&pool, &processo_id, include_content).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_substitute_responsible(
    state: State<'_, AppState>,
    request: SubstituteResponsibleRequest,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::substitute_responsible(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx, "processos_procedimentos", &request.id, "UPDATE", Some(&actor.id),
        ).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_pads_solutions(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<PadsSolutionCount>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::pads_solutions(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_ipm_evidence(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<IpmEvidenceStats>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::ipm_evidence_stats(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_common_crimes(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<CommonCrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::common_crimes_stats(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_sr_evidence(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<SrEvidenceStats>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::sr_evidence_stats(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_top10_transgressions(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<TopTransgressionItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::top10_transgressions(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_driver_ranking(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<DriverRankingItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::driver_ranking(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_nature_stats(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<NatureStatItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::nature_stats(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_military_crimes(
    state: State<'_, AppState>,
    ano: Option<i32>,
) -> Result<ApiResponse<Vec<MilitaryCrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::military_crimes_stats(&pool, ano).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_in_progress_stats(
    state: State<'_, AppState>,
) -> Result<ApiResponse<InProgressStats>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::in_progress_stats(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn proceedings_remove_pdf(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;

        repository::remove_pdf(&mut tx, &processo_id).await?;
        audit_repository::register_tx(&mut tx, "processos_procedimentos", &processo_id, "UPDATE", Some(&actor.id)).await?;

        tx.commit().await?;
        Ok(true)
    }.await).await)
}
