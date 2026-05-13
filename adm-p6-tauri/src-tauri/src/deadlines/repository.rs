use chrono::NaiveDate;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::AppError;

use super::domain::{AddExtensionRequest, DeadlineItem, DeadlineReportFilter, DeadlineReportItem, DeadlineSummary, OverdueDeadlineItem, UpcomingDeadlineItem};

pub async fn dashboard(pool: &PgPool) -> Result<DeadlineSummary, sqlx::Error> {
    sqlx::query_as::<_, DeadlineSummary>(
        r#"
        SELECT
          count(*)::bigint AS total,
          count(*) FILTER (WHERE data_vencimento < CURRENT_DATE)::bigint AS vencidos,
          count(*) FILTER (WHERE data_vencimento >= CURRENT_DATE AND data_vencimento <= CURRENT_DATE + INTERVAL '7 days')::bigint AS proximos_7_dias
        FROM prazos_processo
        WHERE coalesce(ativo, true) = true
        "#,
    )
    .fetch_one(pool)
    .await
}

pub async fn list(pool: &PgPool, processo_id: &str) -> Result<Vec<DeadlineItem>, sqlx::Error> {
    sqlx::query_as::<_, DeadlineItem>(
        r#"
        SELECT id, processo_id, tipo_prazo, data_inicio, data_vencimento, dias_adicionados,
               motivo, autorizado_por, autorizado_tipo, ativo,
               numero_portaria, data_portaria, ordem_prorrogacao
        FROM prazos_processo
        WHERE processo_id = $1
        ORDER BY
            CASE tipo_prazo WHEN 'inicial' THEN 0 ELSE 1 END,
            COALESCE(ordem_prorrogacao, 0)
        "#,
    )
    .bind(processo_id)
    .fetch_all(pool)
    .await
}

pub async fn upcoming(
    pool: &PgPool,
    days_ahead: i32,
) -> Result<Vec<UpcomingDeadlineItem>, sqlx::Error> {
    sqlx::query_as::<_, UpcomingDeadlineItem>(
        r#"
        SELECT pr.processo_id,
               p.numero AS numero_processo,
               p.tipo_detalhe,
               pr.data_vencimento,
               (pr.data_vencimento - CURRENT_DATE)::integer AS dias_restantes
        FROM prazos_processo pr
        JOIN processos_procedimentos p ON p.id = pr.processo_id
        WHERE coalesce(pr.ativo, true) = true
          AND coalesce(p.ativo, true) = true
          AND coalesce(p.concluido, false) = false
          AND pr.data_vencimento >= CURRENT_DATE
          AND pr.data_vencimento <= CURRENT_DATE + ($1 * INTERVAL '1 day')
        ORDER BY pr.data_vencimento
        "#,
    )
    .bind(days_ahead)
    .fetch_all(pool)
    .await
}

pub async fn close_active(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE prazos_processo SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE processo_id = $1 AND coalesce(ativo, true) = true",
    )
    .bind(processo_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn add_extension(
    tx: &mut Transaction<'_, Postgres>,
    request: &AddExtensionRequest,
) -> Result<String, AppError> {
    // Fetch the current active deadline
    let current = sqlx::query_as::<_, (String, NaiveDate)>(
        "SELECT id, data_vencimento FROM prazos_processo WHERE processo_id = $1 AND coalesce(ativo, true) = true ORDER BY created_at DESC NULLS LAST LIMIT 1",
    )
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("Nenhum prazo ativo encontrado para este processo".to_string()))?;

    let (current_id, current_venc) = current;

    // Deactivate current deadline
    sqlx::query(
        "UPDATE prazos_processo SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    )
    .bind(&current_id)
    .execute(&mut **tx)
    .await?;

    // Calculate new dates: start = day after current vencimento; end = start + dias - 1
    let new_start = current_venc + chrono::Duration::days(1);
    let new_end = new_start + chrono::Duration::days((request.dias_prorrogacao - 1).max(0) as i64);

    // Get next prorrogacao order
    let max_ordem: (Option<i32>,) = sqlx::query_as(
        "SELECT MAX(ordem_prorrogacao) FROM prazos_processo WHERE processo_id = $1 AND tipo_prazo = 'prorrogacao'",
    )
    .bind(&request.processo_id)
    .fetch_one(&mut **tx)
    .await?;
    let next_ordem = max_ordem.0.unwrap_or(0) + 1;

    let new_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO prazos_processo (
            id, processo_id, tipo_prazo, data_inicio, data_vencimento, dias_adicionados,
            motivo, autorizado_por, autorizado_tipo, ativo,
            numero_portaria, data_portaria, ordem_prorrogacao, created_at
        )
        VALUES ($1, $2, 'prorrogacao', $3, $4, $5, $6, $7, $8, true, $9, $10, $11, CURRENT_TIMESTAMP)
        "#,
    )
    .bind(&new_id)
    .bind(&request.processo_id)
    .bind(new_start)
    .bind(new_end)
    .bind(request.dias_prorrogacao)
    .bind(&request.motivo)
    .bind(&request.autorizado_por)
    .bind(&request.autorizado_tipo)
    .bind(request.numero_portaria.as_deref())
    .bind(request.data_portaria)
    .bind(next_ordem)
    .execute(&mut **tx)
    .await?;

    Ok(new_id)
}

pub async fn overdue(pool: &PgPool) -> Result<Vec<OverdueDeadlineItem>, sqlx::Error> {
    sqlx::query_as::<_, OverdueDeadlineItem>(
        r#"
        SELECT pr.processo_id,
               p.numero AS numero_processo,
               p.tipo_detalhe,
               u.nome  AS responsavel_nome,
               pr.data_vencimento,
               (CURRENT_DATE - pr.data_vencimento)::integer AS dias_atraso
        FROM prazos_processo pr
        JOIN processos_procedimentos p ON p.id = pr.processo_id
        LEFT JOIN usuarios u ON u.id = p.responsavel_id
        WHERE coalesce(pr.ativo, true) = true
          AND coalesce(p.ativo, true) = true
          AND coalesce(p.concluido, false) = false
          AND pr.data_vencimento < CURRENT_DATE
        ORDER BY pr.data_vencimento
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn report(
    pool: &PgPool,
    filter: &DeadlineReportFilter,
) -> Result<Vec<DeadlineReportItem>, sqlx::Error> {
    let limit = filter.limit.unwrap_or(200).min(500);
    let ano = filter.ano.map(|a| a as i64);
    sqlx::query_as::<_, DeadlineReportItem>(
        r#"
        SELECT pr.processo_id,
               p.numero  AS numero_processo,
               p.tipo_detalhe,
               u.nome    AS responsavel_nome,
               pr.data_vencimento,
               (pr.data_vencimento - CURRENT_DATE)::integer AS dias_restantes,
               pr.tipo_prazo
        FROM prazos_processo pr
        JOIN processos_procedimentos p ON p.id = pr.processo_id
        LEFT JOIN usuarios u ON u.id = p.responsavel_id
        WHERE coalesce(pr.ativo, true) = true
          AND coalesce(p.ativo, true) = true
          AND ($1::text IS NULL OR p.tipo_detalhe = $1)
          AND ($2::text IS NULL OR p.responsavel_id = $2)
          AND (
               $3::boolean IS NULL
               OR ($3 = true  AND pr.data_vencimento <  CURRENT_DATE)
               OR ($3 = false AND pr.data_vencimento >= CURRENT_DATE)
              )
          AND ($4::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $4)
        ORDER BY pr.data_vencimento
        LIMIT $5
        "#,
    )
    .bind(filter.tipo_detalhe.as_deref())
    .bind(filter.responsavel_id.as_deref())
    .bind(filter.apenas_vencidos)
    .bind(ano)
    .bind(limit)
    .fetch_all(pool)
    .await
}
