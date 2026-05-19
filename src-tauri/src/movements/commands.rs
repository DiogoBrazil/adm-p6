use serde_json::Value;
use tauri::State;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::auth::guards::require_session;
use crate::error::AppError;
use crate::movements::domain::{normalize_andamentos, AddMovementRequest};
use crate::response::{from_result, ApiResponse};

#[tauri::command]
pub async fn movements_types(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<&'static str>>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        Ok(vec![
            "Despacho",
            "Distribuição",
            "Juntada",
            "Remessa",
            "Retorno",
            "Decisão",
            "Notificação",
            "Citação",
            "Prorrogação",
            "Conclusão",
            "Outros",
        ])
    }.await).await)
}

#[tauri::command]
pub async fn movements_list(
    state: State<'_, AppState>,
    processo_id: String,
) -> Result<ApiResponse<Value>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;
        let row: (Option<String>,) =
            sqlx::query_as("SELECT andamentos::text FROM processos_procedimentos WHERE id = $1")
                .bind(processo_id)
                .fetch_one(&pool)
                .await?;
        let raw: Vec<Value> = row
            .0
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();
        Ok(Value::Array(normalize_andamentos(raw)))
    }.await).await)
}

#[tauri::command]
pub async fn movements_add(
    state: State<'_, AppState>,
    request: AddMovementRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(async {
        let actor = require_session(&state).await?;
        request.validate().map_err(AppError::Domain)?;

        let pool = state.pool().await?;

        // Fetch current andamentos
        let row: (Option<String>,) = sqlx::query_as(
            "SELECT andamentos::text FROM processos_procedimentos WHERE id = $1 AND coalesce(ativo, true) = true",
        )
        .bind(&request.processo_id)
        .fetch_one(&pool)
        .await?;

        let mut list: Vec<Value> = row
            .0
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let entry_id = Uuid::new_v4().to_string();
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let usuario = request.usuario.unwrap_or_else(|| actor.nome.clone());

        let entry = serde_json::json!({
            "id": entry_id,
            "tipo": request.tipo,
            "texto": request.texto.trim(),
            "data": today,
            "usuario": usuario,
        });

        // Prepend: new entry first
        list.insert(0, entry);

        let updated = serde_json::to_string(&list)
            .map_err(|e| AppError::Domain(format!("Falha ao serializar andamentos: {e}")))?;

        sqlx::query(
            "UPDATE processos_procedimentos SET andamentos = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(&request.processo_id)
        .bind(&updated)
        .execute(&pool)
        .await?;

        Ok(entry_id)
    }.await).await)
}

#[tauri::command]
pub async fn movements_remove(
    state: State<'_, AppState>,
    processo_id: String,
    andamento_id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        let pool = state.pool().await?;

        let row: (Option<String>,) = sqlx::query_as(
            "SELECT andamentos::text FROM processos_procedimentos WHERE id = $1 AND coalesce(ativo, true) = true",
        )
        .bind(&processo_id)
        .fetch_one(&pool)
        .await?;

        let mut list: Vec<Value> = row
            .0
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        list.retain(|entry| entry.get("id").and_then(|v| v.as_str()) != Some(&andamento_id));

        let updated = serde_json::to_string(&list)
            .map_err(|e| AppError::Domain(format!("Falha ao serializar andamentos: {e}")))?;

        sqlx::query(
            "UPDATE processos_procedimentos SET andamentos = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(&processo_id)
        .bind(&updated)
        .execute(&pool)
        .await?;

        Ok(true)
    }.await).await)
}
