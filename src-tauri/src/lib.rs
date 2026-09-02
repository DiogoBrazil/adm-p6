// Público para que o teste de integração possa montar um estado apontando
// para o banco descartável.
pub mod app_state;
pub mod apuratorio_config;
pub mod audit;
pub mod auth;
pub mod db;
pub mod deadlines;
pub mod error;
pub mod evidence;
pub mod files;
pub mod legal_catalogs;
pub mod maps_reports;
pub mod movements;
pub mod print;
pub mod proceedings;
pub mod response;
pub mod users;

use app_state::AppState;

/// Plugins e comandos da aplicação, num lugar só.
///
/// Genérica no runtime **de propósito**: é assim que o teste de integração
/// monta o mesmo app sobre o `MockRuntime` do Tauri e exercita os comandos por
/// IPC de verdade. Se esta lista e a do teste fossem duas, um comando poderia
/// passar no teste e não estar registrado no app.
pub fn registrar_comandos<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            auth::commands::auth_login,
            auth::commands::auth_logout,
            auth::commands::auth_current_user,
            users::commands::users_list,
            users::commands::users_get,
            users::commands::users_save,
            users::commands::users_deactivate,
            users::commands::users_delete,
            users::commands::users_reactivate,
            users::commands::users_list_ativos,
            users::commands::users_list_encarregados,
            users::commands::users_statistics,
            users::commands::users_proceedings_designated,
            users::commands::users_proceedings_involved,
            users::commands::users_form_schema,
            // Catálogos: sete comandos genéricos no lugar dos 68 específicos.
            // O que existe é dado (legal_catalogs::domain::CATALOGOS), não código.
            legal_catalogs::commands::legal_catalogs_definitions,
            legal_catalogs::commands::legal_catalogs_list,
            legal_catalogs::commands::legal_catalogs_get,
            legal_catalogs::commands::legal_catalogs_search,
            legal_catalogs::commands::legal_catalogs_save,
            legal_catalogs::commands::legal_catalogs_deactivate,
            legal_catalogs::commands::legal_catalogs_reactivate,
            legal_catalogs::commands::legal_catalogs_delete,
            // Configuração do apuratório: as duas tabelas de associação que a
            // FK composta de `processos_procedimentos` exige. Não cabem no CRUD
            // genérico de catálogos (PK composta, sem `id` e sem `nome`).
            apuratorio_config::commands::apuratorio_config_get,
            apuratorio_config::commands::apuratorio_config_save_documento,
            apuratorio_config::commands::apuratorio_config_save_papel,
            apuratorio_config::commands::apuratorio_config_deactivate_documento,
            apuratorio_config::commands::apuratorio_config_deactivate_papel,
            proceedings::commands::proceedings_list,
            proceedings::commands::proceedings_filter_options,
            proceedings::commands::proceedings_get,
            proceedings::commands::proceedings_save,
            proceedings::commands::proceedings_delete,
            proceedings::commands::proceedings_reopen,
            proceedings::commands::proceedings_update_dates,
            proceedings::commands::proceedings_update_involved_outcome,
            proceedings::commands::proceedings_substitute_designation,
            proceedings::commands::proceedings_update_substitution,
            proceedings::commands::proceedings_delete_substitution,
            proceedings::commands::proceedings_list_attachments,
            proceedings::commands::proceedings_upload_attachment,
            proceedings::commands::proceedings_get_attachment,
            proceedings::commands::proceedings_remove_attachment,
            proceedings::commands::dashboard_summary,
            deadlines::commands::deadlines_dashboard,
            deadlines::commands::deadlines_list,
            deadlines::commands::deadlines_calculate,
            deadlines::commands::deadlines_report,
            deadlines::commands::deadlines_add_extension,
            deadlines::commands::deadlines_update_extension,
            deadlines::commands::deadlines_delete_extension,
            movements::commands::movements_list,
            movements::commands::movements_add,
            movements::commands::movements_update,
            movements::commands::movements_remove,
            evidence::commands::evidence_load_for_pm,
            evidence::commands::evidence_save_for_pm,
            evidence::commands::evidence_remove_for_pm,
            evidence::commands::evidence_list_for_proceeding,
            evidence::commands::evidence_search_infracoes_penais,
            evidence::commands::evidence_search_transgressoes,
            evidence::commands::evidence_search_infracoes_estatuto,
            maps_reports::commands::reports_map_rows,
            maps_reports::commands::reports_map_print_data,
            maps_reports::commands::reports_save_map,
            maps_reports::commands::reports_saved_maps,
            maps_reports::commands::reports_get_saved_map,
            maps_reports::commands::reports_delete_saved_map,
            maps_reports::commands::reports_by_responsible,
            maps_reports::commands::reports_by_nature,
            maps_reports::commands::reports_driver_ranking,
            maps_reports::commands::reports_available_years,
            maps_reports::commands::reports_export_csv,
            maps_reports::commands::reports_status_by_apuratorio,
            maps_reports::commands::reports_by_solution,
            maps_reports::commands::reports_by_evidence_category,
            maps_reports::commands::reports_transgressoes,
            maps_reports::commands::reports_infracoes_estatuto,
            maps_reports::commands::reports_infracoes_penais,
            maps_reports::commands::reports_by_unit,
            maps_reports::commands::reports_by_year,
            maps_reports::commands::reports_designations_matrix,
            files::commands::files_save_download,
            print::commands::print_landscape,
            print::commands::print_report_landscape,
            print::commands::print_portrait,
            audit::commands::audit_list,
            audit::commands::audit_get,
            audit::commands::audit_by_record,
            audit::commands::audit_by_user,
            audit::commands::audit_statistics,
        ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    let state = AppState::from_env();

    tauri::async_runtime::block_on(async {
        let pool = state
            .pool()
            .await
            .expect("Falha ao conectar ao banco de dados");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Falha ao aplicar migrations do banco de dados");
    });

    registrar_comandos(tauri::Builder::default())
        .manage(state)
        .run(tauri::generate_context!())
        .expect("error while running ADM P6 Tauri application");
}
