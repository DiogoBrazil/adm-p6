mod app_state;
mod audit;
mod auth;
mod db;
mod deadlines;
mod error;
mod evidence;
mod legal_catalogs;
mod maps_reports;
mod movements;
mod proceedings;
mod response;
mod users;

use app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    let state = AppState::from_env();

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            auth::commands::auth_login,
            auth::commands::auth_logout,
            auth::commands::auth_current_user,
            users::commands::users_list,
            users::commands::users_form_schema,
            users::commands::users_save,
            users::commands::users_delete,
            users::commands::users_reactivate,
            users::commands::users_list_encarregados,
            users::commands::users_get,
            users::commands::users_statistics,
            users::commands::users_proceedings_responsible,
            users::commands::users_proceedings_escrivao,
            users::commands::users_proceedings_involved,
            legal_catalogs::commands::legal_catalogs_list_crimes,
            legal_catalogs::commands::legal_catalogs_get_crime,
            legal_catalogs::commands::legal_catalogs_search_municipalities,
            legal_catalogs::commands::legal_catalogs_list_transgressions,
            legal_catalogs::commands::legal_catalogs_list_art29,
            legal_catalogs::commands::legal_catalogs_list_for_proceeding,
            legal_catalogs::commands::legal_catalogs_save_crime,
            legal_catalogs::commands::legal_catalogs_delete_crime,
            legal_catalogs::commands::legal_catalogs_save_transgression,
            legal_catalogs::commands::legal_catalogs_delete_transgression,
            legal_catalogs::commands::legal_catalogs_save_art29,
            legal_catalogs::commands::legal_catalogs_delete_art29,
            legal_catalogs::commands::legal_catalogs_get_transgression,
            legal_catalogs::commands::legal_catalogs_get_art29,
            legal_catalogs::commands::legal_catalogs_list_locais_origem,
            legal_catalogs::commands::legal_catalogs_list_postos_graduacoes,
            legal_catalogs::commands::legal_catalogs_list_naturezas,
            proceedings::commands::proceedings_list,
            proceedings::commands::proceedings_form_schema,
            proceedings::commands::proceedings_create,
            proceedings::commands::proceedings_get,
            proceedings::commands::proceedings_update,
            proceedings::commands::proceedings_delete,
            proceedings::commands::proceedings_reopen,
            proceedings::commands::proceedings_upload_pdf,
            proceedings::commands::proceedings_get_pdf,
            proceedings::commands::proceedings_remove_pdf,
            proceedings::commands::proceedings_pads_solutions,
            proceedings::commands::proceedings_ipm_evidence,
            proceedings::commands::proceedings_common_crimes,
            proceedings::commands::proceedings_sr_evidence,
            proceedings::commands::proceedings_top10_transgressions,
            proceedings::commands::proceedings_driver_ranking,
            proceedings::commands::proceedings_nature_stats,
            proceedings::commands::proceedings_military_crimes,
            proceedings::commands::proceedings_in_progress_stats,
            proceedings::commands::proceedings_substitute_responsible,
            deadlines::commands::deadlines_overdue,
            deadlines::commands::deadlines_report,
            deadlines::commands::deadlines_dashboard,
            deadlines::commands::deadlines_list,
            deadlines::commands::deadlines_add_extension,
            deadlines::commands::deadlines_upcoming,
            deadlines::commands::deadlines_close,
            deadlines::commands::deadlines_calculate,
            movements::commands::movements_types,
            movements::commands::movements_list,
            movements::commands::movements_add,
            movements::commands::movements_remove,
            evidence::commands::evidence_search_catalogs,
            evidence::commands::evidence_save_for_pm,
            evidence::commands::evidence_load_for_pm,
            evidence::commands::evidence_list_for_proceeding,
            evidence::commands::evidence_remove_for_pm,
            evidence::commands::evidence_categories,
            evidence::commands::evidence_search_crimes,
            evidence::commands::evidence_search_rdpm,
            evidence::commands::evidence_search_art29,
            maps_reports::commands::dashboard_summary,
            maps_reports::commands::reports_process_types,
            maps_reports::commands::reports_generate_monthly_map,
            maps_reports::commands::reports_generate_complete_map,
            maps_reports::commands::reports_save_map,
            maps_reports::commands::reports_get_saved_map,
            maps_reports::commands::reports_delete_saved_map,
            maps_reports::commands::reports_saved_maps,
            maps_reports::commands::reports_annual_statistics,
            maps_reports::commands::reports_by_responsible,
            maps_reports::commands::reports_by_type,
            maps_reports::commands::reports_overdue_deadlines,
            maps_reports::commands::reports_export_csv,
            maps_reports::commands::reports_responsible_statistics,
            maps_reports::commands::reports_process_statistics,
            maps_reports::commands::reports_monthly_map_schema,
            maps_reports::commands::reports_available_years,
            audit::commands::audit_list,
            audit::commands::audit_get,
            audit::commands::audit_by_record,
            audit::commands::audit_by_user,
            audit::commands::audit_statistics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ADM P6 Tauri application");
}
