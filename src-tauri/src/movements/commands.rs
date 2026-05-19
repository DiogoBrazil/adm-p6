use serde_json::{json, Value};
use tauri::State;

use crate::app_state::AppState;
use crate::auth::guards::require_session;
use crate::error::AppError;
use crate::movements::domain::AddMovementRequest;
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
        let rows: Vec<(String, String, chrono::NaiveDateTime)> = sqlx::query_as(
            r#"SELECT id::text, descricao_andamento, created_at
               FROM andamentos_processo_procedimentos
               WHERE processo_procedimento_id = $1::uuid AND coalesce(ativo, true) = true
               ORDER BY created_at DESC"#,
        )
        .bind(processo_id)
        .fetch_all(&pool)
        .await?;
        let list: Vec<Value> = rows
            .into_iter()
            .map(|(id, texto, created)| json!({
                "id": id,
                "texto": texto,
                "data": created.format("%Y-%m-%d").to_string(),
            }))
            .collect();
        Ok(Value::Array(list))
    }.await).await)
}

#[tauri::command]
pub async fn movements_add(
    state: State<'_, AppState>,
    request: AddMovementRequest,
) -> Result<ApiResponse<String>, String> {
    Ok(from_result(async {
        require_session(&state).await?;
        request.validate().map_err(AppError::Domain)?;

        let pool = state.pool().await?;

        let entry_id: String = sqlx::query_scalar(
            r#"INSERT INTO andamentos_processo_procedimentos (processo_procedimento_id, descricao_andamento)
               VALUES ($1::uuid, $2)
               RETURNING id::text"#,
        )
        .bind(&request.processo_id)
        .bind(request.texto.trim())
        .fetch_one(&pool)
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

        sqlx::query(
            r#"UPDATE andamentos_processo_procedimentos
               SET ativo = false, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1::uuid AND processo_procedimento_id = $2::uuid"#,
        )
        .bind(&andamento_id)
        .bind(&processo_id)
        .execute(&pool)
        .await?;

        Ok(true)
    }.await).await)
}
