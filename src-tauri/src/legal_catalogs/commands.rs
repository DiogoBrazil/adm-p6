use serde_json::{Map, Value};
use tauri::State;

use crate::app_state::AppState;
use crate::audit::repository as audit_repository;
use crate::auth::guards::{require_admin, require_session};
use crate::error::AppError;
use crate::legal_catalogs::domain::{
    catalogo, Catalogo, SaveCatalogRequest, SaveCatalogResult, CATALOGOS,
};
use crate::legal_catalogs::repository;
use crate::response::{from_result, ApiResponse};

fn resolver(chave: &str) -> Result<&'static Catalogo, AppError> {
    catalogo(chave).ok_or_else(|| AppError::Domain(format!("catalogo desconhecido: {chave}")))
}

/// Descreve todos os catálogos administráveis e seus campos.
///
/// É o que permite ao frontend montar as telas de cadastro sem conhecer nenhuma
/// tabela: rótulos, tipos, catálogos referenciados e o efeito de cada atributo
/// semântico saem daqui.
#[tauri::command]
pub async fn legal_catalogs_definitions(
    state: State<'_, AppState>,
) -> Result<ApiResponse<&'static [Catalogo]>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            Ok(CATALOGOS)
        }
        .await,
    )
    .await)
}

/// Opções de um catálogo. `incluir_inativos` distingue os dois usos: o formulário
/// de um cadastro novo pede só os ativos; a tela de administração pede tudo, para
/// poder reativar.
#[tauri::command]
pub async fn legal_catalogs_list(
    state: State<'_, AppState>,
    catalogo: String,
    incluir_inativos: Option<bool>,
) -> Result<ApiResponse<Vec<Map<String, Value>>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let cat = resolver(&catalogo)?;
            let pool = state.pool().await?;
            Ok(repository::list(&pool, cat, incluir_inativos.unwrap_or(false)).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn legal_catalogs_get(
    state: State<'_, AppState>,
    catalogo: String,
    id: String,
) -> Result<ApiResponse<Option<Map<String, Value>>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let cat = resolver(&catalogo)?;
            let pool = state.pool().await?;
            Ok(repository::get(&pool, cat, &id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn legal_catalogs_search(
    state: State<'_, AppState>,
    catalogo: String,
    campo: String,
    termo: String,
    limite: Option<i64>,
) -> Result<ApiResponse<Vec<Map<String, Value>>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let cat = resolver(&catalogo)?;
            let pool = state.pool().await?;
            Ok(repository::search(&pool, cat, &campo, &termo, limite.unwrap_or(20)).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn legal_catalogs_save(
    state: State<'_, AppState>,
    request: SaveCatalogRequest,
) -> Result<ApiResponse<SaveCatalogResult>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let cat = resolver(&request.catalogo)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            let antes = match request.id.as_deref() {
                Some(id) => repository::get(&pool, cat, id).await?,
                None => None,
            };

            let id =
                repository::save(&mut tx, cat, request.id.as_deref(), &request.valores).await?;
            let depois = repository::get(&pool, cat, &id).await?;

            // Alteração de configuração muda o comportamento futuro do sistema, então
            // fica registrado o que mudou — e não apenas que mudou.
            audit_repository::register_tx_com_alteracoes(
                &mut tx,
                cat.tabela,
                &id,
                if request.id.is_some() {
                    "UPDATE"
                } else {
                    "CREATE"
                },
                Some(&actor.id),
                diferenca(antes.as_ref(), depois.as_ref()),
            )
            .await?;
            tx.commit().await?;
            Ok(SaveCatalogResult { id })
        }
        .await,
    )
    .await)
}

/// Desativa um item: ele deixa de aparecer em cadastros novos e continua visível
/// nos registros históricos que já o usam.
#[tauri::command]
pub async fn legal_catalogs_deactivate(
    state: State<'_, AppState>,
    catalogo: String,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let cat = resolver(&catalogo)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            garantir_administracao_possivel(&mut tx, cat, &id).await?;
            repository::set_ativo(&mut tx, cat, &id, false).await?;
            audit_repository::register_tx(&mut tx, cat.tabela, &id, "UPDATE", Some(&actor.id))
                .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn legal_catalogs_reactivate(
    state: State<'_, AppState>,
    catalogo: String,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let cat = resolver(&catalogo)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::set_ativo(&mut tx, cat, &id, true).await?;
            audit_repository::register_tx(&mut tx, cat.tabela, &id, "UPDATE", Some(&actor.id))
                .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

/// Exclusão física. Só passa para item nunca referenciado — o PostgreSQL barra o
/// resto por FK, e a mensagem orienta a desativar.
#[tauri::command]
pub async fn legal_catalogs_delete(
    state: State<'_, AppState>,
    catalogo: String,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let cat = resolver(&catalogo)?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            garantir_administracao_possivel(&mut tx, cat, &id).await?;
            repository::delete(&mut tx, cat, &id).await?;
            audit_repository::register_tx(&mut tx, cat.tabela, &id, "DELETE", Some(&actor.id))
                .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

/// Impede que o sistema fique sem nenhum perfil capaz de administrar. É a única
/// regra de catálogo que não cabe numa constraint: depende de contas em uso.
async fn garantir_administracao_possivel(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    cat: &Catalogo,
    id: &str,
) -> Result<(), AppError> {
    if cat.chave != "perfis_acesso" {
        return Ok(());
    }
    let restantes: i64 = sqlx::query_scalar(
        "SELECT count(*)
           FROM usuarios u
           JOIN perfis_acesso pa ON pa.id = u.perfil_id
          WHERE u.ativo AND pa.ativo AND pa.pode_administrar AND pa.id <> $1::uuid",
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await?;
    if restantes == 0 {
        return Err(AppError::Domain(
            "este e o unico perfil que permite administrar o sistema".to_string(),
        ));
    }
    Ok(())
}

/// Diferença entre o estado anterior e o novo, em pares campo -> {de, para}.
fn diferenca(
    antes: Option<&Map<String, Value>>,
    depois: Option<&Map<String, Value>>,
) -> Option<Value> {
    let depois = depois?;
    let mut mudou = Map::new();
    match antes {
        None => return Some(Value::Object(depois.clone())),
        Some(antes) => {
            for (campo, novo) in depois {
                let velho = antes.get(campo).unwrap_or(&Value::Null);
                if velho != novo {
                    mudou.insert(
                        campo.clone(),
                        serde_json::json!({ "de": velho, "para": novo }),
                    );
                }
            }
        }
    }
    (!mudou.is_empty()).then(|| Value::Object(mudou))
}
