use tauri::State;

use crate::app_state::AppState;
use crate::audit::assunto;
use crate::audit::repository::{self as audit_repository, Acao};
use crate::auth::guards::{require_admin, require_session};
use crate::db::paginacao::PADRAO;
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};
use crate::users::domain::{
    SaveUserRequest, SaveUserResult, UserFormSchema, UserListItem, UserListResult, UserProcessItem,
    UserStatistics,
};
use crate::users::repository;

#[tauri::command]
pub async fn users_list(
    state: State<'_, AppState>,
    search: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
) -> Result<ApiResponse<UserListResult>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_paginated(
                &pool,
                search.as_deref(),
                page.unwrap_or(1),
                per_page.unwrap_or(PADRAO),
            )
            .await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_save(
    state: State<'_, AppState>,
    request: SaveUserRequest,
) -> Result<ApiResponse<SaveUserResult>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            request.validate().map_err(AppError::Domain)?;

            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            // Trava do último administrador: rebaixar ou remover o acesso da própria
            // conta só é permitido se sobrar outra que possa administrar.
            if let Some(id) = request.id.as_deref() {
                if let Some(conta) = repository::conta_do_policial(&mut *tx, id).await? {
                    if conta == actor.id {
                        let perde_admin = match &request.conta {
                            None => true,
                            Some(c) => !sqlx::query_scalar::<_, bool>(
                                "SELECT pode_administrar FROM perfis_acesso WHERE id = $1::uuid",
                            )
                            .bind(&c.perfil_id)
                            .fetch_optional(&mut *tx)
                            .await?
                            .unwrap_or(false),
                        };
                        if perde_admin
                            && repository::outros_administradores_ativos(&mut *tx, Some(&conta))
                                .await?
                                == 0
                        {
                            return Err(AppError::Domain(
                                "Esta é a única conta que pode administrar o sistema. Dê perfil de administrador \
                                 a outra conta antes."
                                    .to_string(),
                            ));
                        }
                    }
                }
            }

            let existente = request.id.is_some();
            let (id, conta_id) = repository::save(&mut tx, &request).await?;
            let assunto = assunto::de_militar(&mut tx, &id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "policiais_militares",
                    registro_id: &id,
                    operacao: if existente { "UPDATE" } else { "CREATE" },
                    acao: if existente { "Editou o cadastro do militar" } else { "Cadastrou o militar" },
                    assunto,
                    alteracoes: None,
                },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(SaveUserResult { id, conta_id })
        }
        .await,
    )
    .await)
}

/// Desativa o militar — **não** apaga.
///
/// O nome anterior deste comando era `users_delete`, e ele desativava: quem
/// lesse a lista de comandos entendia o contrário do que acontece. Quem apaga
/// de verdade é `users_delete`, logo abaixo, e são coisas diferentes o
/// bastante para não caberem no mesmo verbo.
#[tauri::command]
pub async fn users_deactivate(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            if let Some(conta) = repository::conta_do_policial(&mut *tx, &id).await? {
                if conta == actor.id {
                    return Err(AppError::Domain(
                        "Não é possível desativar a própria conta. Peça a outro administrador."
                            .to_string(),
                    ));
                }
                if repository::outros_administradores_ativos(&mut *tx, Some(&conta)).await? == 0 {
                    return Err(AppError::Domain(
                        "esta e a unica conta que pode administrar o sistema".to_string(),
                    ));
                }
            }

            repository::set_ativo(&mut tx, &id, false).await?;
            let assunto = assunto::de_militar(&mut tx, &id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "policiais_militares",
                    registro_id: &id,
                    // Desativar é `UPDATE`: a linha continua lá, com `ativo`
                    // em falso. Quem diz que foi desativação é a `acao`.
                    operacao: "UPDATE",
                    acao: "Desativou o militar",
                    assunto,
                    alteracoes: None,
                },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

/// Junta os vínculos achados numa frase que diga **qual** deles segurou.
///
/// O PostgreSQL recusaria sozinho — as quatro FKs são `RESTRICT` —, mas a
/// mensagem dele é a mesma para os quatro casos, e quem opera fica sem saber o
/// que remover ou por que desativar basta.
fn mensagem_de_vinculos(vinculos: &repository::Vinculos) -> String {
    let mut partes: Vec<String> = Vec::new();
    if vinculos.conta {
        partes.push("conta de acesso".to_string());
    }
    if vinculos.designacoes > 0 {
        partes.push(format!("{} designação(ões)", vinculos.designacoes));
    }
    if vinculos.envolvimentos > 0 {
        partes.push(format!(
            "{} envolvimento(s) em apuratório",
            vinculos.envolvimentos
        ));
    }
    if vinculos.prazos > 0 {
        partes.push(format!(
            "{} prorrogação(ões) como autoridade",
            vinculos.prazos
        ));
    }
    let lista = match partes.split_last() {
        Some((ultima, [])) => ultima.clone(),
        Some((ultima, resto)) => format!("{} e {}", resto.join(", "), ultima),
        None => "registros vinculados".to_string(),
    };
    format!(
        "Este militar não pode ser excluído porque tem {lista}. Desative-o em vez de \
         excluir: ele sai das listas de escolha e o histórico continua inteiro."
    )
}

/// Exclusão FÍSICA do militar — o cadastro digitado errado, que ainda não virou
/// histórico.
///
/// Não é o caminho comum, e não deve ser: cadastro em uso se **desativa**, não
/// se apaga (princípio 6), e é o que `users_deactivate` faz. Aqui a linha sai
/// do banco de vez, e por isso só conclui para quem não tem vínculo nenhum.
///
/// A conferência prévia não substitui as FKs `RESTRICT` — elas continuam sendo
/// a rede embaixo, e recusariam mesmo que esta função esquecesse um caso. Ela
/// existe para a mensagem dizer **qual** vínculo segurou, que é o que o erro do
/// banco não diz.
#[tauri::command]
pub async fn users_delete(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;

            let vinculos = repository::vinculos(&mut tx, &id).await?;
            if vinculos.existe() {
                return Err(AppError::Domain(mensagem_de_vinculos(&vinculos)));
            }

            // A exclusão aqui é FÍSICA: o assunto tem de ser lido **antes**,
            // senão a trilha guarda um UUID que não aponta mais para nada.
            let assunto = assunto::de_militar(&mut tx, &id).await;
            repository::delete(&mut tx, &id).await?;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "policiais_militares",
                    registro_id: &id,
                    operacao: "DELETE",
                    acao: "Excluiu o militar",
                    assunto,
                    alteracoes: None,
                },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_reactivate(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            let actor = require_admin(&state).await?;
            let pool = state.pool().await?;
            let mut tx = pool.begin().await?;
            repository::set_ativo(&mut tx, &id, true).await?;
            let assunto = assunto::de_militar(&mut tx, &id).await;
            audit_repository::registrar(
                &mut tx,
                Acao {
                    entidade: "policiais_militares",
                    registro_id: &id,
                    operacao: "UPDATE",
                    acao: "Reativou o militar",
                    assunto,
                    alteracoes: None,
                },
                Some(&actor.id),
            )
            .await?;
            tx.commit().await?;
            Ok(true)
        }
        .await,
    )
    .await)
}

/// Lista de **opções** para os seletores de militar. Sem paginação de propósito:
/// `users_list` pagina e trava em 200, e um seletor truncado esconde militar sem
/// dizer que escondeu. Ver `repository::list_ativos`.
#[tauri::command]
pub async fn users_list_ativos(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<UserListItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_ativos(&pool).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_list_encarregados(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Vec<UserListItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::list_encarregados(&pool).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Option<UserListItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::get_by_id(&pool, &id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_statistics(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<UserStatistics>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::statistics(&pool, &id).await?)
        }
        .await,
    )
    .await)
}

/// Processos em que o militar foi designado. `papel_id` opcional filtra o papel —
/// substitui os comandos separados `_responsible` e `_escrivao`, que só existiam
/// porque os papéis eram colunas fixas.
#[tauri::command]
pub async fn users_proceedings_designated(
    state: State<'_, AppState>,
    id: String,
    papel_id: Option<String>,
) -> Result<ApiResponse<Vec<UserProcessItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::proceedings_as_designated(&pool, &id, papel_id.as_deref()).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_proceedings_involved(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Vec<UserProcessItem>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            Ok(repository::proceedings_as_involved(&pool, &id).await?)
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn users_form_schema(
    state: State<'_, AppState>,
) -> Result<ApiResponse<UserFormSchema>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            Ok(UserFormSchema {
                title: "Policial militar",
                admin_only: true,
                fields: vec![
                    "nome",
                    "matricula",
                    "posto_graduacao_id",
                    "is_encarregado",
                    "conta.email",
                    "conta.perfil_id",
                    "conta.senha",
                ],
                validations: vec![
                    "nome gravado em maiusculas",
                    "matricula com 9 caracteres, iniciando em 1000 ou 3000",
                    "email em minusculas e obrigatorio para quem opera o sistema",
                    "senha minima de 4 caracteres",
                    "cadastro, edicao e desativacao somente por quem pode administrar",
                    "o sistema nunca fica sem uma conta que possa administrar",
                ],
            })
        }
        .await,
    )
    .await)
}
