use serde_json::{Map, Value};
use sqlx::postgres::PgRow;
use sqlx::{PgExecutor, PgPool, Postgres, Row, Transaction};

use crate::error::AppError;
use crate::legal_catalogs::domain::{Catalogo, Coluna, TipoColuna};

/// Todo nome de tabela e de coluna interpolado no SQL abaixo vem do registro em
/// `domain::CATALOGOS`, nunca da requisição. O que vem do usuário são apenas
/// VALORES, sempre ligados como parâmetro.
fn colunas_select(cat: &Catalogo) -> String {
    let mut partes = vec!["id::text AS id".to_string()];
    for c in cat.colunas {
        match c.tipo {
            TipoColuna::Referencia | TipoColuna::ReferenciaOpcional => {
                partes.push(format!("{}::text AS {}", c.nome, c.nome))
            }
            _ => partes.push(c.nome.to_string()),
        }
    }
    partes.push("ativo".to_string());
    partes.join(", ")
}

fn ler_linha(cat: &Catalogo, row: &PgRow) -> Result<Map<String, Value>, sqlx::Error> {
    let mut mapa = Map::new();
    mapa.insert("id".into(), Value::String(row.try_get::<String, _>("id")?));
    for c in cat.colunas {
        let valor = match c.tipo {
            TipoColuna::Texto => Value::String(row.try_get::<String, _>(c.nome)?),
            TipoColuna::TextoOpcional | TipoColuna::ReferenciaOpcional => row
                .try_get::<Option<String>, _>(c.nome)?
                .map(Value::String)
                .unwrap_or(Value::Null),
            TipoColuna::Referencia => Value::String(row.try_get::<String, _>(c.nome)?),
            TipoColuna::Booleano => Value::Bool(row.try_get::<bool, _>(c.nome)?),
            TipoColuna::Inteiro => Value::from(row.try_get::<i32, _>(c.nome)?),
            TipoColuna::InteiroOpcional => row
                .try_get::<Option<i32>, _>(c.nome)?
                .map(Value::from)
                .unwrap_or(Value::Null),
        };
        mapa.insert(c.nome.into(), valor);
    }
    mapa.insert(
        "ativo".into(),
        Value::Bool(row.try_get::<bool, _>("ativo")?),
    );
    Ok(mapa)
}

/// Lista as opções de um catálogo.
///
/// `incluir_inativos` separa os dois usos que o schema exige distinguir: um
/// formulário de cadastro novo mostra só o que está ativo, enquanto a tela de
/// administração precisa ver tudo para poder reativar. A leitura de um registro
/// histórico nunca passa por aqui — ela faz JOIN direto, sem filtrar `ativo`,
/// para que um processo antigo continue exibindo o catálogo que usou.
pub async fn list(
    pool: &PgPool,
    cat: &Catalogo,
    incluir_inativos: bool,
) -> Result<Vec<Map<String, Value>>, sqlx::Error> {
    let sql = format!(
        "SELECT {} FROM {} WHERE ($1 OR ativo) ORDER BY {}",
        colunas_select(cat),
        cat.tabela,
        cat.ordenacao
    );
    sqlx::query(&sql)
        .bind(incluir_inativos)
        .fetch_all(pool)
        .await?
        .iter()
        .map(|row| ler_linha(cat, row))
        .collect()
}

pub async fn get(
    pool: &PgPool,
    cat: &Catalogo,
    id: &str,
) -> Result<Option<Map<String, Value>>, sqlx::Error> {
    let sql = format!(
        "SELECT {} FROM {} WHERE id = $1::uuid",
        colunas_select(cat),
        cat.tabela
    );
    let row = sqlx::query(&sql).bind(id).fetch_optional(pool).await?;
    row.as_ref().map(|r| ler_linha(cat, r)).transpose()
}

/// Placeholder com o cast que a coluna exige. Referências são uuid.
fn placeholder(coluna: &Coluna, posicao: usize) -> String {
    match coluna.tipo {
        TipoColuna::Referencia | TipoColuna::ReferenciaOpcional => format!("${posicao}::uuid"),
        _ => format!("${posicao}"),
    }
}

pub async fn save(
    tx: &mut Transaction<'_, Postgres>,
    cat: &Catalogo,
    id: Option<&str>,
    valores: &Map<String, Value>,
) -> Result<String, AppError> {
    let nomes: Vec<&str> = cat.colunas.iter().map(|c| c.nome).collect();

    let sql = match id {
        Some(_) => {
            let atribuicoes: Vec<String> = cat
                .colunas
                .iter()
                .enumerate()
                .map(|(i, c)| format!("{} = {}", c.nome, placeholder(c, i + 2)))
                .collect();
            format!(
                "UPDATE {} SET {}, updated_at = now() WHERE id = $1::uuid RETURNING id::text",
                cat.tabela,
                atribuicoes.join(", ")
            )
        }
        None => {
            let placeholders: Vec<String> = cat
                .colunas
                .iter()
                .enumerate()
                .map(|(i, c)| placeholder(c, i + 1))
                .collect();
            format!(
                "INSERT INTO {} ({}) VALUES ({}) RETURNING id::text",
                cat.tabela,
                nomes.join(", "),
                placeholders.join(", ")
            )
        }
    };

    let mut query = sqlx::query_scalar::<_, String>(&sql);
    if let Some(id) = id {
        query = query.bind(id.to_string());
    }
    // Cada valor é LIGADO como parâmetro, com o tipo que a coluna declara.
    for coluna in cat.colunas {
        let valor = valores.get(coluna.nome);
        query = match coluna.tipo {
            TipoColuna::Texto | TipoColuna::Referencia => {
                let v = valor
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| {
                        AppError::Domain(format!("campo '{}' e obrigatorio", coluna.rotulo))
                    })?;
                query.bind(v)
            }
            TipoColuna::TextoOpcional | TipoColuna::ReferenciaOpcional => query.bind(
                valor
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
            ),
            TipoColuna::Booleano => query.bind(valor.and_then(|v| v.as_bool()).unwrap_or(false)),
            TipoColuna::Inteiro => {
                let v = valor.and_then(|v| v.as_i64()).ok_or_else(|| {
                    AppError::Domain(format!("campo '{}' deve ser numerico", coluna.rotulo))
                })?;
                query.bind(v as i32)
            }
            TipoColuna::InteiroOpcional => {
                query.bind(valor.and_then(|v| v.as_i64()).map(|v| v as i32))
            }
        };
    }

    query
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("registro nao encontrado".to_string()))
}

/// Desativa em vez de apagar. As FKs do schema são `ON DELETE RESTRICT`: um item
/// já usado em algum processo não pode sumir sem levar o histórico junto.
pub async fn set_ativo(
    tx: &mut Transaction<'_, Postgres>,
    cat: &Catalogo,
    id: &str,
    ativo: bool,
) -> Result<(), AppError> {
    let sql = format!(
        "UPDATE {} SET ativo = $2, updated_at = now() WHERE id = $1::uuid",
        cat.tabela
    );
    let afetadas = sqlx::query(&sql)
        .bind(id)
        .bind(ativo)
        .execute(&mut **tx)
        .await?
        .rows_affected();
    if afetadas == 0 {
        return Err(AppError::Domain("registro nao encontrado".to_string()));
    }
    Ok(())
}

/// Remoção física, permitida apenas para item nunca referenciado. Se houver
/// qualquer uso, o próprio PostgreSQL barra por FK e a aplicação orienta a
/// desativação.
pub async fn delete(
    tx: &mut Transaction<'_, Postgres>,
    cat: &Catalogo,
    id: &str,
) -> Result<(), AppError> {
    let sql = format!("DELETE FROM {} WHERE id = $1::uuid", cat.tabela);
    match sqlx::query(&sql).bind(id).execute(&mut **tx).await {
        Ok(r) if r.rows_affected() == 0 => {
            Err(AppError::Domain("registro nao encontrado".to_string()))
        }
        Ok(_) => Ok(()),
        Err(sqlx::Error::Database(e)) if e.is_foreign_key_violation() => Err(AppError::Domain(
            "este item ja foi usado e nao pode ser excluido; desative-o".to_string(),
        )),
        Err(e) => Err(e.into()),
    }
}

/// Busca textual usada pelos campos de autocomplete do cadastro de processo.
pub async fn search<'e, E: PgExecutor<'e>>(
    executor: E,
    cat: &Catalogo,
    campo: &str,
    termo: &str,
    limite: i64,
) -> Result<Vec<Map<String, Value>>, AppError> {
    if !cat.colunas.iter().any(|c| c.nome == campo) {
        return Err(AppError::Domain(format!(
            "campo '{campo}' nao pertence ao catalogo '{}'",
            cat.chave
        )));
    }
    let sql = format!(
        "SELECT {} FROM {} WHERE ativo AND lower({campo}) LIKE $1 ORDER BY {} LIMIT $2",
        colunas_select(cat),
        cat.tabela,
        cat.ordenacao
    );
    let linhas = sqlx::query(&sql)
        .bind(format!("%{}%", termo.trim().to_lowercase()))
        .bind(limite.clamp(1, 100))
        .fetch_all(executor)
        .await?;
    linhas
        .iter()
        .map(|row| ler_linha(cat, row).map_err(AppError::from))
        .collect()
}
