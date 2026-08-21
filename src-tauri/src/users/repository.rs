use bcrypt::{hash, DEFAULT_COST};
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::error::AppError;
use crate::users::domain::{
    ContagemRotulada, SaveUserRequest, UserListItem, UserListResult, UserProcessItem,
    UserStatistics,
};

/// Projeção comum de policial militar + conta (quando existe).
const SELECT_PM: &str = r#"
    SELECT pm.id::text                  AS id,
           pm.nome                      AS nome,
           pm.matricula                 AS matricula,
           pg.id::text                  AS posto_graduacao_id,
           pg.nome                      AS posto_graduacao,
           ch.nome                      AS circulo_hierarquico,
           pg.ordem_hierarquica         AS ordem_hierarquica,
           pm.is_encarregado            AS is_encarregado,
           pm.ativo                     AS ativo,
           u.id::text                   AS conta_id,
           u.email                      AS conta_email,
           pa.id::text                  AS conta_perfil_id,
           pa.nome                      AS conta_perfil,
           u.ativo                      AS conta_ativa
    FROM policiais_militares pm
    JOIN postos_graduacoes pg     ON pg.id = pm.posto_graduacao_id
    JOIN circulos_hierarquicos ch ON ch.id = pg.circulo_hierarquico_id
    LEFT JOIN usuarios u          ON u.policial_militar_id = pm.id
    LEFT JOIN perfis_acesso pa    ON pa.id = u.perfil_id
"#;

pub async fn list_paginated(
    pool: &PgPool,
    search: Option<&str>,
    page: i64,
    per_page: i64,
) -> Result<UserListResult, sqlx::Error> {
    let page = page.max(1);
    let per_page = per_page.clamp(1, 200);
    let termo = search.map(|s| format!("%{}%", s.trim().to_lowercase()));

    let total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM policiais_militares pm
          WHERE ($1::text IS NULL
                 OR lower(pm.nome) LIKE $1 OR lower(pm.matricula) LIKE $1)",
    )
    .bind(termo.as_deref())
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, UserListItem>(&format!(
        "{SELECT_PM}
         WHERE ($1::text IS NULL
                OR lower(pm.nome) LIKE $1 OR lower(pm.matricula) LIKE $1)
         ORDER BY pg.ordem_hierarquica DESC, pm.nome
         LIMIT $2 OFFSET $3"
    ))
    .bind(termo.as_deref())
    .bind(per_page)
    .bind((page - 1) * per_page)
    .fetch_all(pool)
    .await?;

    Ok(UserListResult {
        items,
        total,
        page,
        per_page,
    })
}

pub async fn get_by_id(pool: &PgPool, id: &str) -> Result<Option<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!("{SELECT_PM} WHERE pm.id = $1::uuid"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_encarregados(pool: &PgPool) -> Result<Vec<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!(
        "{SELECT_PM}
         WHERE pm.ativo AND pm.is_encarregado
         ORDER BY pg.ordem_hierarquica DESC, pm.nome"
    ))
    .fetch_all(pool)
    .await
}

/// Grava o policial militar e, quando houver credenciais, a conta de acesso —
/// tudo na mesma transação. São duas entidades; continua sendo um só formulário.
pub async fn save(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveUserRequest,
) -> Result<(String, Option<String>), AppError> {
    let nome = request.nome.trim().to_uppercase();
    let matricula = request.matricula.trim();

    let pm_id: String = match request.id.as_deref() {
        Some(id) => sqlx::query_scalar(
            "UPDATE policiais_militares
                    SET nome = $2, matricula = $3, posto_graduacao_id = $4::uuid,
                        is_encarregado = $5, updated_at = now()
                  WHERE id = $1::uuid
              RETURNING id::text",
        )
        .bind(id)
        .bind(&nome)
        .bind(matricula)
        .bind(&request.posto_graduacao_id)
        .bind(request.is_encarregado)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("policial militar nao encontrado".to_string()))?,
        None => sqlx::query_scalar(
            "INSERT INTO policiais_militares (nome, matricula, posto_graduacao_id, is_encarregado)
                 VALUES ($1, $2, $3::uuid, $4)
              RETURNING id::text",
        )
        .bind(&nome)
        .bind(matricula)
        .bind(&request.posto_graduacao_id)
        .bind(request.is_encarregado)
        .fetch_one(&mut **tx)
        .await?,
    };

    let conta_atual: Option<String> =
        sqlx::query_scalar("SELECT id::text FROM usuarios WHERE policial_militar_id = $1::uuid")
            .bind(&pm_id)
            .fetch_optional(&mut **tx)
            .await?;

    let conta_id = match (&request.conta, conta_atual) {
        (None, Some(existente)) => {
            // Deixou de operar o sistema: a conta é desativada, nunca apagada —
            // ela é referenciada por andamentos, anexos e auditoria.
            sqlx::query(
                "UPDATE usuarios SET ativo = false, updated_at = now() WHERE id = $1::uuid",
            )
            .bind(&existente)
            .execute(&mut **tx)
            .await?;
            Some(existente)
        }
        (None, None) => None,
        (Some(conta), existente) => {
            let email = conta.email.trim().to_lowercase();
            let senha_hash = match conta.senha.as_deref().filter(|s| !s.is_empty()) {
                Some(senha) => Some(
                    hash(senha, DEFAULT_COST)
                        .map_err(|e| AppError::Domain(format!("falha ao gerar hash: {e}")))?,
                ),
                None => None,
            };

            match existente {
                Some(id) => {
                    sqlx::query(
                        "UPDATE usuarios
                            SET email = $2, perfil_id = $3::uuid,
                                senha_hash = COALESCE($4, senha_hash),
                                ativo = true, updated_at = now()
                          WHERE id = $1::uuid",
                    )
                    .bind(&id)
                    .bind(&email)
                    .bind(&conta.perfil_id)
                    .bind(senha_hash.as_deref())
                    .execute(&mut **tx)
                    .await?;
                    Some(id)
                }
                None => {
                    let senha_hash = senha_hash.ok_or_else(|| {
                        AppError::Domain("senha e obrigatoria ao criar o acesso".to_string())
                    })?;
                    let id: String = sqlx::query_scalar(
                        "INSERT INTO usuarios (policial_militar_id, email, senha_hash, perfil_id)
                         VALUES ($1::uuid, $2, $3, $4::uuid)
                      RETURNING id::text",
                    )
                    .bind(&pm_id)
                    .bind(&email)
                    .bind(&senha_hash)
                    .bind(&conta.perfil_id)
                    .fetch_one(&mut **tx)
                    .await?;
                    Some(id)
                }
            }
        }
    };

    Ok((pm_id, conta_id))
}

pub async fn set_ativo(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
    ativo: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE policiais_militares SET ativo = $2, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(id)
    .bind(ativo)
    .execute(&mut **tx)
    .await?;
    // A conta acompanha o militar: desativar o cadastro tira o acesso junto.
    sqlx::query(
        "UPDATE usuarios SET ativo = $2, updated_at = now() WHERE policial_militar_id = $1::uuid",
    )
    .bind(id)
    .bind(ativo)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Quantos administradores ativos existiriam se a conta indicada saísse do ar.
/// Sustenta a trava que impede o sistema de ficar sem ninguém que administre.
pub async fn outros_administradores_ativos<'e, E: PgExecutor<'e>>(
    executor: E,
    conta_excluida: Option<&str>,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT count(*)
           FROM usuarios u
           JOIN perfis_acesso pa ON pa.id = u.perfil_id
          WHERE u.ativo AND pa.ativo AND pa.pode_administrar
            AND ($1::uuid IS NULL OR u.id <> $1::uuid)",
    )
    .bind(conta_excluida)
    .fetch_one(executor)
    .await
}

pub async fn conta_do_policial<'e, E: PgExecutor<'e>>(
    executor: E,
    policial_id: &str,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT id::text FROM usuarios WHERE policial_militar_id = $1::uuid")
        .bind(policial_id)
        .fetch_optional(executor)
        .await
}

pub async fn statistics(pool: &PgPool, policial_id: &str) -> Result<UserStatistics, sqlx::Error> {
    let designacoes_por_papel = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT pp.id::text AS id, pp.nome AS rotulo, count(*) AS total
           FROM processo_designacoes d
           JOIN papeis_processo pp ON pp.id = d.papel_id
          WHERE d.policial_militar_id = $1::uuid
          GROUP BY pp.id, pp.nome
          ORDER BY total DESC, pp.nome",
    )
    .bind(policial_id)
    .fetch_all(pool)
    .await?;

    let designacoes_por_apuratorio = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT a.id::text AS id, a.sigla AS rotulo, count(*) AS total
           FROM processo_designacoes d
           JOIN apuratorios a ON a.id = d.apuratorio_id
          WHERE d.policial_militar_id = $1::uuid
          GROUP BY a.id, a.sigla
          ORDER BY total DESC, a.sigla",
    )
    .bind(policial_id)
    .fetch_all(pool)
    .await?;

    let envolvimentos_por_status = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT se.id::text AS id, se.nome AS rotulo, count(*) AS total
           FROM processo_envolvidos e
           JOIN status_envolvido se ON se.id = e.status_envolvido_id
          WHERE e.policial_militar_id = $1::uuid
          GROUP BY se.id, se.nome
          ORDER BY total DESC, se.nome",
    )
    .bind(policial_id)
    .fetch_all(pool)
    .await?;

    Ok(UserStatistics {
        designacoes_por_papel,
        designacoes_por_apuratorio,
        envolvimentos_por_status,
    })
}

/// Colunas de processo compartilhadas pelas duas listagens abaixo.
const COLUNAS_PROCESSO: &str = r#"
           p.id::text                                       AS id,
           a.id::text                                       AS apuratorio_id,
           a.sigla                                          AS apuratorio_sigla,
           a.nome                                           AS apuratorio_nome,
           ta.nome                                          AS tipo_apuratorio,
           p.numero_documento                               AS numero_documento,
           COALESCE(p.numero_controle, p.numero_documento)  AS numero_controle,
           p.resumo_fatos                                   AS resumo_fatos,
           p.data_instauracao                               AS data_instauracao,
           p.data_conclusao                                 AS data_conclusao
"#;

const JOIN_PROCESSO: &str = r#"
    FROM processos_procedimentos p
    JOIN apuratorios a       ON a.id = p.apuratorio_id
    JOIN tipos_apuratorio ta ON ta.id = a.tipo_apuratorio_id
"#;

/// Processos em que o militar foi designado. `papel_id` nulo traz todos os papéis
/// — o chamador escolhe, em vez de existirem comandos separados por papel.
pub async fn proceedings_as_designated(
    pool: &PgPool,
    policial_id: &str,
    papel_id: Option<&str>,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(&format!(
        "SELECT {COLUNAS_PROCESSO},
                pp.nome    AS papel,
                NULL::text AS status_envolvido
         {JOIN_PROCESSO}
         JOIN processo_designacoes d ON d.processo_id = p.id
         JOIN papeis_processo pp     ON pp.id = d.papel_id
         WHERE d.policial_militar_id = $1::uuid
           AND ($2::uuid IS NULL OR d.papel_id = $2::uuid)
           AND p.ativo
         ORDER BY p.data_instauracao DESC"
    ))
    .bind(policial_id)
    .bind(papel_id)
    .fetch_all(pool)
    .await
}

pub async fn proceedings_as_involved(
    pool: &PgPool,
    policial_id: &str,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(&format!(
        "SELECT {COLUNAS_PROCESSO},
                NULL::text AS papel,
                se.nome    AS status_envolvido
         {JOIN_PROCESSO}
         JOIN processo_envolvidos e  ON e.processo_id = p.id
         JOIN status_envolvido se    ON se.id = e.status_envolvido_id
         WHERE e.policial_militar_id = $1::uuid
           AND p.ativo
         ORDER BY p.data_instauracao DESC"
    ))
    .bind(policial_id)
    .fetch_all(pool)
    .await
}
