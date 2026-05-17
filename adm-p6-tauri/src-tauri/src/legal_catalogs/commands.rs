use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::legal_catalogs::domain::{
    ApuratorioItem, Art29Item, Art32Item, ArtigoRdpmItem, CrimeItem, DispositivoLegalItem,
    LocalOrigemItem, MunicipalityItem, MunicipioCRUDItem,
    NaturezaItem, NaturezaTransgressaoItem, PostoGraduacaoItem, ProceedingCatalogs,
    SaveApuratorioRequest, SaveArt29Request, SaveArt32Request, SaveArtigoRdpmRequest,
    SaveCatalogResult, SaveCrimeRequest, SaveDispositivoLegalRequest, SaveLocalOrigemRequest,
    SaveMunicipioDistritoRequest, SaveNaturezaTransgressaoRequest, SavePostoGraduacaoRequest,
    SaveSolucaoTipoRequest, SaveStatusEnvolvidoRequest, SaveTipoApuratorioRequest,
    SaveTipoDocumentoRequest, SaveTipoPenalidadeRequest, SaveTipoPrazoRequest,
    SaveTipoUsuarioRequest, SaveTransgressionRequest, SolucaoTipoItem, StatusEnvolvidoItem,
    TipoApuratorioItem, TipoDocumentoItem, TipoPenalidadeItem, TipoPrazoItem,
    TipoUsuarioItem, TransgressionItem,
};
use crate::legal_catalogs::repository;
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn legal_catalogs_list_crimes(state: State<'_, AppState>) -> Result<ApiResponse<Vec<CrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_crimes(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_crime(
    state: State<'_, AppState>,
    request: SaveCrimeRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_crime(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "crimes_contravencoes",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_crime(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_crime(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "crimes_contravencoes", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_transgression(
    state: State<'_, AppState>,
    request: SaveTransgressionRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_transgression(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "transgressoes",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_transgression(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let refs = repository::referenced_transgression_count(&pool, &id).await?;
        if refs > 0 {
            return Err(AppError::Domain("transgressao referenciada nao pode ser excluida".to_string()));
        }
        let mut tx = pool.begin().await?;
        repository::hard_delete_transgression(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "transgressoes", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_art29(
    state: State<'_, AppState>,
    request: SaveArt29Request,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_art29(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "infracoes_estatuto_art29",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_art29(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_art29(&mut tx, &id).await?;
        audit_repository::register_tx(
            &mut tx,
            "infracoes_estatuto_art29",
            &id,
            "DELETE",
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_crime(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<CrimeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_crime_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_transgressions(state: State<'_, AppState>) -> Result<ApiResponse<Vec<TransgressionItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_transgressions(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_art29(state: State<'_, AppState>) -> Result<ApiResponse<Vec<Art29Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_art29(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_search_municipalities(
    state: State<'_, AppState>,
    termo: Option<String>,
) -> Result<ApiResponse<Vec<MunicipalityItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::search_municipalities(&pool, termo.as_deref().unwrap_or("")).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_for_proceeding(state: State<'_, AppState>) -> Result<ApiResponse<ProceedingCatalogs>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(ProceedingCatalogs {
            crimes: repository::list_crimes(&pool, 100).await?,
            transgressoes: repository::list_transgressions(&pool, 100).await?,
            art29: repository::list_art29(&pool, 100).await?,
        })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_transgression(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<TransgressionItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_transgression_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_art29(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<Art29Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_art29_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_locais_origem(state: State<'_, AppState>) -> Result<ApiResponse<Vec<LocalOrigemItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_locais_origem(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_postos_graduacoes(state: State<'_, AppState>) -> Result<ApiResponse<Vec<PostoGraduacaoItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_postos_graduacoes(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_tipos_usuario(state: State<'_, AppState>) -> Result<ApiResponse<Vec<TipoUsuarioItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_tipos_usuario(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_naturezas(state: State<'_, AppState>) -> Result<ApiResponse<Vec<NaturezaItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_naturezas(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_dispositivos_legais(state: State<'_, AppState>) -> Result<ApiResponse<Vec<DispositivoLegalItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_dispositivos_legais(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_dispositivo_legal(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<DispositivoLegalItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_dispositivo_legal_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_dispositivo_legal(
    state: State<'_, AppState>,
    request: SaveDispositivoLegalRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_dispositivo_legal(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "dispositivos_legais",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_art32(state: State<'_, AppState>) -> Result<ApiResponse<Vec<Art32Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_art32(&pool, 200).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_art32(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<Art32Item>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_art32_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_art32(
    state: State<'_, AppState>,
    request: SaveArt32Request,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_art32(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "infracoes_estatuto_art32",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_art32(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_art32(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "infracoes_estatuto_art32", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_list_artigos_rdpm(state: State<'_, AppState>) -> Result<ApiResponse<Vec<ArtigoRdpmItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_artigos_rdpm(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_artigo_rdpm(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<ArtigoRdpmItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_artigo_rdpm_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_artigo_rdpm(
    state: State<'_, AppState>,
    request: SaveArtigoRdpmRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_artigo_rdpm(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "artigo_rdpm_natureza_transgressao",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_artigo_rdpm(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_artigo_rdpm(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "artigo_rdpm_natureza_transgressao", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_dispositivo_legal(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_dispositivo_legal(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "dispositivos_legais", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_tipo_usuario(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<TipoUsuarioItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_tipo_usuario_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_tipo_usuario(
    state: State<'_, AppState>,
    request: SaveTipoUsuarioRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_tipo_usuario(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "tipos_usuario",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_tipo_usuario(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_tipo_usuario(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "tipos_usuario", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_get_posto_graduacao(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<PostoGraduacaoItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::get_posto_graduacao_by_id(&pool, &id).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_posto_graduacao(
    state: State<'_, AppState>,
    request: SavePostoGraduacaoRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_posto_graduacao(&mut tx, &request).await?;
        audit_repository::register_tx(
            &mut tx,
            "postos_graduacoes",
            &id,
            if is_update { "UPDATE" } else { "CREATE" },
            Some(&actor.id),
        )
        .await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_posto_graduacao(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_posto_graduacao(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "postos_graduacoes", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── LocalOrigem ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_save_local_origem(
    state: State<'_, AppState>,
    request: SaveLocalOrigemRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_local_origem(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "locais_origem", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_local_origem(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_local_origem(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "locais_origem", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── MunicipiosDistritos ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_municipios_distritos(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<MunicipioCRUDItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_municipios_distritos_crud(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_municipio_distrito(
    state: State<'_, AppState>,
    request: SaveMunicipioDistritoRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_municipio_distrito(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "municipios_distritos", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_municipio_distrito(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_municipio_distrito(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "municipios_distritos", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── Catálogos simples ─────────────────────────────────────────────────────────

macro_rules! simple_catalog_commands {
    (
        list: $list_fn:ident, $list_repo:ident, $list_item:ident;
        save: $save_fn:ident, $save_repo:ident, $save_req:ident, $table:literal;
        delete: $delete_fn:ident, $delete_repo:ident;
    ) => {
        #[tauri::command]
        pub async fn $list_fn(state: State<'_, AppState>) -> Result<ApiResponse<Vec<$list_item>>, String> {
            Ok(from_result(async {
                require_session(&state).await?;
                let pool = state.pool().await?;
                Ok(repository::$list_repo(&pool).await?)
            }.await).await)
        }

        #[tauri::command]
        pub async fn $save_fn(
            state: State<'_, AppState>,
            request: $save_req,
        ) -> Result<ApiResponse<SaveCatalogResult>, String> {
            Ok(from_result(async {
                let actor = require_admin(&state).await?;
                request.validate().map_err(AppError::Domain)?;
                let pool = state.pool().await?;
                let mut tx = pool.begin().await?;
                let is_update = request.id.is_some();
                let id = repository::$save_repo(&mut tx, &request).await?;
                audit_repository::register_tx(&mut tx, $table, &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
                tx.commit().await?;
                Ok(SaveCatalogResult { id })
            }.await).await)
        }

        #[tauri::command]
        pub async fn $delete_fn(
            state: State<'_, AppState>,
            id: String,
        ) -> Result<ApiResponse<bool>, String> {
            Ok(from_result(async {
                let actor = require_admin(&state).await?;
                let pool = state.pool().await?;
                let mut tx = pool.begin().await?;
                repository::$delete_repo(&mut tx, &id).await?;
                audit_repository::register_tx(&mut tx, $table, &id, "DELETE", Some(&actor.id)).await?;
                tx.commit().await?;
                Ok(true)
            }.await).await)
        }
    };
}

simple_catalog_commands!(
    list: legal_catalogs_list_status_envolvido, list_status_envolvido, StatusEnvolvidoItem;
    save: legal_catalogs_save_status_envolvido, save_status_envolvido, SaveStatusEnvolvidoRequest, "status_envolvido";
    delete: legal_catalogs_delete_status_envolvido, soft_delete_status_envolvido;
);
simple_catalog_commands!(
    list: legal_catalogs_list_solucoes_tipo, list_solucoes_tipo, SolucaoTipoItem;
    save: legal_catalogs_save_solucao_tipo, save_solucao_tipo, SaveSolucaoTipoRequest, "solucoes_tipo";
    delete: legal_catalogs_delete_solucao_tipo, soft_delete_solucao_tipo;
);

// ── NaturezaTransgressao ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_natureza_transgressao(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<NaturezaTransgressaoItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_natureza_transgressao(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_natureza_transgressao(
    state: State<'_, AppState>,
    request: SaveNaturezaTransgressaoRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_natureza_transgressao(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "natureza_transgressao", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_natureza_transgressao(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_natureza_transgressao(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "natureza_transgressao", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── TipoPenalidade ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_tipos_penalidade(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<TipoPenalidadeItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_tipos_penalidade(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_tipo_penalidade(
    state: State<'_, AppState>,
    request: SaveTipoPenalidadeRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_tipo_penalidade(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "tipos_penalidade", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_tipo_penalidade(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_tipo_penalidade(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "tipos_penalidade", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── TipoPrazo ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_tipos_prazo(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<TipoPrazoItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_tipos_prazo(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_tipo_prazo(
    state: State<'_, AppState>,
    request: SaveTipoPrazoRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_tipo_prazo(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "tipos_prazo", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_tipo_prazo(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_tipo_prazo(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "tipos_prazo", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── TipoApuratorio ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_tipo_apuratorios(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<TipoApuratorioItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_tipo_apuratorios(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_tipo_apuratorio(
    state: State<'_, AppState>,
    request: SaveTipoApuratorioRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_tipo_apuratorio(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "tipo_apuratorios", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_tipo_apuratorio(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_tipo_apuratorio(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "tipo_apuratorios", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── Apuratorio ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_apuratorios(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<ApuratorioItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_apuratorios(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_apuratorio(
    state: State<'_, AppState>,
    request: SaveApuratorioRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_apuratorio(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "apuratorios", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_apuratorio(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_apuratorio(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "apuratorios", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}

// ── TiposDocumentos ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn legal_catalogs_list_tipos_documentos(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<TipoDocumentoItem>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        Ok(repository::list_tipos_documentos(&pool).await?)
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_save_tipo_documento(
    state: State<'_, AppState>,
    request: SaveTipoDocumentoRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        request.validate().map_err(AppError::Domain)?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        let is_update = request.id.is_some();
        let id = repository::save_tipo_documento(&mut tx, &request).await?;
        audit_repository::register_tx(&mut tx, "tipos_documentos", &id, if is_update { "UPDATE" } else { "CREATE" }, Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(SaveCatalogResult { id })
    }.await).await)
}

#[tauri::command]
pub async fn legal_catalogs_delete_tipo_documento(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        let actor = require_admin(&state).await?;
        let pool = state.pool().await?;
        let mut tx = pool.begin().await?;
        repository::soft_delete_tipo_documento(&mut tx, &id).await?;
        audit_repository::register_tx(&mut tx, "tipos_documentos", &id, "DELETE", Some(&actor.id)).await?;
        tx.commit().await?;
        Ok(true)
    }.await).await)
}
