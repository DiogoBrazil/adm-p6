use sqlx::{PgPool, Postgres, Transaction};

use super::domain::{AuditDetailItem, AuditOperationStat, AuditPageResult, AuditStatistics, AuditStatisticsFilter, AuditTableStat};

pub async fn list(
    pool: &PgPool,
    limit: i64,
    offset: i64,
    tabela: Option<&str>,
    operacao: Option<&str>,
    usuario_id: Option<&str>,
) -> Result<Vec<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT}
        WHERE ($1::text IS NULL OR a.tabela    = $1)
          AND ($2::text IS NULL OR a.operacao  = $2)
          AND ($3::text IS NULL OR a.usuario_id = $3)
        ORDER BY a.timestamp DESC NULLS LAST
        LIMIT $4 OFFSET $5"
    ))
    .bind(tabela)
    .bind(operacao)
    .bind(usuario_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}

const DETAIL_SELECT: &str = r#"
    SELECT a.id, a.tabela, a.registro_id, a.operacao, a.usuario_id, a.timestamp,
           u.nome            AS usuario_nome,
           u.posto_graduacao AS usuario_posto
    FROM auditoria a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
"#;

pub async fn get_by_id(pool: &PgPool, id: &str) -> Result<Option<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!("{DETAIL_SELECT} WHERE a.id = $1"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_by_record(
    pool: &PgPool,
    tabela: &str,
    registro_id: &str,
) -> Result<Vec<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT} WHERE a.tabela = $1 AND a.registro_id = $2 ORDER BY a.timestamp DESC NULLS LAST"
    ))
    .bind(tabela)
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
    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM auditoria WHERE usuario_id = $1",
    )
    .bind(usuario_id)
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT} WHERE a.usuario_id = $1 ORDER BY a.timestamp DESC NULLS LAST LIMIT $2 OFFSET $3"
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
    let (total,): (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint FROM auditoria
        WHERE ($1::date IS NULL OR timestamp::date >= $1)
          AND ($2::date IS NULL OR timestamp::date <= $2)
        "#,
    )
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_one(pool)
    .await?;

    let por_operacao = sqlx::query_as::<_, AuditOperationStat>(
        r#"
        SELECT coalesce(operacao, 'unknown') AS operacao, COUNT(*)::bigint AS total
        FROM auditoria
        WHERE ($1::date IS NULL OR timestamp::date >= $1)
          AND ($2::date IS NULL OR timestamp::date <= $2)
        GROUP BY operacao
        ORDER BY total DESC
        "#,
    )
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_all(pool)
    .await?;

    let por_tabela = sqlx::query_as::<_, AuditTableStat>(
        r#"
        SELECT coalesce(tabela, 'unknown') AS tabela, COUNT(*)::bigint AS total
        FROM auditoria
        WHERE ($1::date IS NULL OR timestamp::date >= $1)
          AND ($2::date IS NULL OR timestamp::date <= $2)
        GROUP BY tabela
        ORDER BY total DESC
        LIMIT 15
        "#,
    )
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_all(pool)
    .await?;

    Ok(AuditStatistics { total, por_operacao, por_tabela })
}

pub async fn register_tx(
    tx: &mut Transaction<'_, Postgres>,
    tabela: &str,
    registro_id: &str,
    operacao: &str,
    usuario_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO auditoria (id, tabela, registro_id, operacao, usuario_id, timestamp)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        "#,
    )
    .bind(id)
    .bind(tabela)
    .bind(registro_id)
    .bind(operacao)
    .bind(usuario_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
