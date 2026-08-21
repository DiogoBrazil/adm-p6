use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};

use super::domain::{
    AuditDetailItem, AuditOperationStat, AuditPageResult, AuditStatistics, AuditStatisticsFilter,
    AuditTableStat,
};

/// O autor de uma operação é uma CONTA (`usuarios`); o nome exibido pode vir do
/// policial militar vinculado ou do rótulo da própria conta técnica.
const DETAIL_SELECT: &str = r#"
    SELECT a.id::text                            AS id,
           a.entidade                            AS entidade,
           a.registro_id                         AS registro_id,
           a.operacao                            AS operacao,
           a.usuario_id::text                    AS usuario_id,
           COALESCE(u.nome_exibicao, pm.nome)    AS usuario_nome,
           pg.sigla                              AS usuario_posto,
           a.alteracoes                          AS alteracoes,
           a.ocorrido_em                         AS ocorrido_em
    FROM auditoria a
    LEFT JOIN usuarios u             ON u.id = a.usuario_id
    LEFT JOIN policiais_militares pm ON pm.id = u.policial_militar_id
    LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
"#;

pub async fn list(
    pool: &PgPool,
    limit: i64,
    offset: i64,
    entidade: Option<&str>,
    operacao: Option<&str>,
    usuario_id: Option<&str>,
) -> Result<Vec<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT}
        WHERE ($1::text IS NULL OR a.entidade  = $1)
          AND ($2::text IS NULL OR a.operacao  = $2)
          AND ($3::uuid IS NULL OR a.usuario_id = $3::uuid)
        ORDER BY a.ocorrido_em DESC
        LIMIT $4 OFFSET $5"
    ))
    .bind(entidade)
    .bind(operacao)
    .bind(usuario_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}

pub async fn get_by_id(pool: &PgPool, id: &str) -> Result<Option<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!("{DETAIL_SELECT} WHERE a.id = $1::uuid"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_by_record(
    pool: &PgPool,
    entidade: &str,
    registro_id: &str,
) -> Result<Vec<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT} WHERE a.entidade = $1 AND a.registro_id = $2 ORDER BY a.ocorrido_em DESC"
    ))
    .bind(entidade)
    .bind(registro_id)
    .fetch_all(pool)
    .await
}

pub async fn list_by_user(
    pool: &PgPool,
    usuario_id: &str,
    limit: i64,
    offset: i64,
) -> Result<AuditPageResult, sqlx::Error> {
    let total: i64 =
        sqlx::query_scalar("SELECT count(*) FROM auditoria WHERE usuario_id = $1::uuid")
            .bind(usuario_id)
            .fetch_one(pool)
            .await?;

    let items = sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT} WHERE a.usuario_id = $1::uuid ORDER BY a.ocorrido_em DESC LIMIT $2 OFFSET $3"
    ))
    .bind(usuario_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(AuditPageResult { items, total })
}

pub async fn statistics(
    pool: &PgPool,
    filter: &AuditStatisticsFilter,
) -> Result<AuditStatistics, sqlx::Error> {
    const PERIODO: &str = "($1::date IS NULL OR a.ocorrido_em::date >= $1)
                       AND ($2::date IS NULL OR a.ocorrido_em::date <= $2)";

    let total: i64 =
        sqlx::query_scalar(&format!("SELECT count(*) FROM auditoria a WHERE {PERIODO}"))
            .bind(filter.data_inicio)
            .bind(filter.data_fim)
            .fetch_one(pool)
            .await?;

    let por_operacao = sqlx::query_as::<_, AuditOperationStat>(&format!(
        "SELECT a.operacao, count(*) AS total FROM auditoria a
          WHERE {PERIODO} GROUP BY a.operacao ORDER BY total DESC"
    ))
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_all(pool)
    .await?;

    let por_entidade = sqlx::query_as::<_, AuditTableStat>(&format!(
        "SELECT a.entidade, count(*) AS total FROM auditoria a
          WHERE {PERIODO} GROUP BY a.entidade ORDER BY total DESC LIMIT 15"
    ))
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_all(pool)
    .await?;

    Ok(AuditStatistics {
        total,
        por_operacao,
        por_entidade,
    })
}

/// Registro simples, na mesma transação da operação auditada.
pub async fn register_tx(
    tx: &mut Transaction<'_, Postgres>,
    entidade: &str,
    registro_id: &str,
    operacao: &str,
    usuario_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    register_tx_com_alteracoes(tx, entidade, registro_id, operacao, usuario_id, None).await
}

/// Registro com o diff da operação. Usado nas alterações de catálogo: agora que o
/// comportamento do sistema é configurável, importa saber quem mudou o quê — por
/// exemplo, quem reduziu o prazo base de um apuratório.
pub async fn register_tx_com_alteracoes(
    tx: &mut Transaction<'_, Postgres>,
    entidade: &str,
    registro_id: &str,
    operacao: &str,
    usuario_id: Option<&str>,
    alteracoes: Option<Value>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO auditoria (entidade, registro_id, operacao, usuario_id, alteracoes)
         VALUES ($1, $2, $3, $4::uuid, $5)",
    )
    .bind(entidade)
    .bind(registro_id)
    .bind(operacao)
    .bind(usuario_id)
    .bind(alteracoes)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
