use chrono::NaiveDate;
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::deadlines::domain::{
    AddExtensionRequest, DeadlineItem, DeadlineReportFilter, DeadlineReportItem, DeadlineSummary,
};
use crate::error::AppError;

/// Prazo vigente de um processo: o de maior `ordem`. Não há coluna `ativo` —
/// a vigência é derivada, e o EXCLUDE do schema garante que os períodos nunca
/// se sobrepõem.
const VIGENTE: &str = r#"
    p.id IN (
        SELECT DISTINCT ON (processo_id) id FROM processo_prazos
         ORDER BY processo_id, ordem DESC
    )
"#;

/// Dias de prazo de uma combinação apuratório × documento iniciador.
/// O override que antes era `if documento_iniciador == "Feito Preliminar" { 15 }`
/// virou dado: `apuratorio_documentos_iniciadores.prazo_base_dias`.
pub async fn dias_base<'e, E: PgExecutor<'e>>(
    executor: E,
    apuratorio_id: &str,
    documento_iniciador_id: &str,
) -> Result<(i32, bool), sqlx::Error> {
    let (dias, do_documento): (i32, bool) = sqlx::query_as(
        "SELECT COALESCE(adi.prazo_base_dias, a.prazo_base_dias),
                adi.prazo_base_dias IS NOT NULL
           FROM apuratorios a
           JOIN apuratorio_documentos_iniciadores adi
             ON adi.apuratorio_id = a.id AND adi.tipo_documento_id = $2::uuid
          WHERE a.id = $1::uuid",
    )
    .bind(apuratorio_id)
    .bind(documento_iniciador_id)
    .fetch_one(executor)
    .await?;
    Ok((dias, do_documento))
}

/// Cria o prazo inicial (ordem 0). O vencimento é calculado pelo banco, na coluna
/// gerada `data_inicio + dias` — não há aritmética de prazo em Rust.
pub async fn create_initial(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    data_inicio: NaiveDate,
    dias: i32,
) -> Result<String, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
         VALUES ($1::uuid, 0, $2, $3)
      RETURNING id::text",
    )
    .bind(processo_id)
    .bind(data_inicio)
    .bind(dias)
    .fetch_one(&mut **tx)
    .await
}

pub async fn list(pool: &PgPool, processo_id: &str) -> Result<Vec<DeadlineItem>, sqlx::Error> {
    sqlx::query_as::<_, DeadlineItem>(&format!(
        "SELECT p.id::text                      AS id,
                p.processo_id::text             AS processo_id,
                p.ordem                         AS ordem,
                p.data_inicio                   AS data_inicio,
                p.dias                          AS dias,
                p.data_vencimento               AS data_vencimento,
                p.motivo                        AS motivo,
                p.documento_autorizador_id::text AS documento_autorizador_id,
                td.nome                         AS documento_autorizador,
                p.numero_documento              AS numero_documento,
                p.data_documento                AS data_documento,
                p.autoridade_id::text           AS autoridade_id,
                pm.nome                         AS autoridade,
                {VIGENTE}                       AS vigente
           FROM processo_prazos p
           LEFT JOIN tipos_documento td     ON td.id = p.documento_autorizador_id
           LEFT JOIN policiais_militares pm ON pm.id = p.autoridade_id
          WHERE p.processo_id = $1::uuid
          ORDER BY p.ordem"
    ))
    .bind(processo_id)
    .fetch_all(pool)
    .await
}

/// Concede uma prorrogação: ela começa no dia seguinte ao vencimento vigente e
/// recebe a próxima `ordem`. O EXCLUDE do schema recusa qualquer sobreposição,
/// então não é possível prorrogar duas vezes a partir do mesmo ponto.
pub async fn add_extension(
    tx: &mut Transaction<'_, Postgres>,
    request: &AddExtensionRequest,
) -> Result<String, AppError> {
    let atual: Option<(i32, NaiveDate)> = sqlx::query_as(
        "SELECT ordem, data_vencimento FROM processo_prazos
          WHERE processo_id = $1::uuid ORDER BY ordem DESC LIMIT 1",
    )
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?;

    let (ordem_atual, vencimento_atual) = atual.ok_or_else(|| {
        AppError::Domain("o processo ainda nao tem prazo inicial para prorrogar".to_string())
    })?;

    sqlx::query_scalar(
        "INSERT INTO processo_prazos
             (processo_id, ordem, data_inicio, dias, motivo,
              documento_autorizador_id, numero_documento, data_documento, autoridade_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8, $9::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(ordem_atual + 1)
    .bind(vencimento_atual + chrono::Duration::days(1))
    .bind(request.dias)
    .bind(request.motivo.trim())
    .bind(request.documento_autorizador_id.as_deref())
    .bind(request.numero_documento.as_deref())
    .bind(request.data_documento)
    .bind(request.autoridade_id.as_deref())
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::from)
}

/// Panorama dos prazos vigentes dos processos em andamento.
pub async fn dashboard(pool: &PgPool, dias_janela: i32) -> Result<DeadlineSummary, sqlx::Error> {
    sqlx::query_as::<_, DeadlineSummary>(&format!(
        "SELECT count(*)                                                        AS total,
                count(*) FILTER (WHERE p.data_vencimento < CURRENT_DATE)        AS vencidos,
                count(*) FILTER (WHERE p.data_vencimento >= CURRENT_DATE
                                   AND p.data_vencimento <= CURRENT_DATE + $1)  AS proximos
           FROM processo_prazos p
           JOIN processos_procedimentos pr ON pr.id = p.processo_id
          WHERE {VIGENTE} AND pr.ativo AND pr.data_conclusao IS NULL"
    ))
    .bind(dias_janela)
    .fetch_one(pool)
    .await
}

/// Relatório de prazos. O escopo de apuratórios vem por parâmetro — antes era um
/// `IN ('IPM','SR','SV')` escrito no SQL.
pub async fn report(
    pool: &PgPool,
    filter: &DeadlineReportFilter,
) -> Result<Vec<DeadlineReportItem>, sqlx::Error> {
    sqlx::query_as::<_, DeadlineReportItem>(&format!(
        r#"
        SELECT pr.id::text                                        AS processo_id,
               a.sigla                                            AS apuratorio_sigla,
               COALESCE(pr.numero_controle, pr.numero_documento)  AS numero_controle,
               un.nome                                            AS unidade_origem,
               resp.nome                                          AS responsavel_nome,
               p.data_vencimento                                  AS data_vencimento,
               (p.data_vencimento - CURRENT_DATE)::int             AS dias_restantes,
               p.ordem                                            AS ordem
          FROM processo_prazos p
          JOIN processos_procedimentos pr ON pr.id = p.processo_id
          JOIN apuratorios a              ON a.id = pr.apuratorio_id
          JOIN unidades_pm un             ON un.id = pr.unidade_origem_id
          -- Responsável = quem ocupa, neste apuratório, o papel marcado como
          -- responsável na configuração. Não há nome de papel no SQL.
          LEFT JOIN LATERAL (
              SELECT pm.nome
                FROM processo_designacoes d
                JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                         AND ap.papel_id = d.papel_id
                JOIN policiais_militares pm ON pm.id = d.policial_militar_id
               WHERE d.processo_id = pr.id AND d.data_fim IS NULL AND ap.e_responsavel
               LIMIT 1
          ) resp ON true
         WHERE {VIGENTE}
           AND pr.ativo
           AND pr.data_conclusao IS NULL
           AND ($1::uuid[] IS NULL OR pr.apuratorio_id = ANY($1::uuid[]))
           AND ($2::uuid IS NULL OR EXISTS (
                   SELECT 1 FROM processo_designacoes d
                    WHERE d.processo_id = pr.id AND d.data_fim IS NULL
                      AND d.policial_militar_id = $2::uuid))
           AND (NOT $3 OR p.data_vencimento < CURRENT_DATE)
           AND ($4::int IS NULL OR p.data_vencimento <= CURRENT_DATE + $4)
           AND ($5::int IS NULL OR EXTRACT(YEAR FROM pr.data_instauracao)::int = $5)
         ORDER BY p.data_vencimento
         LIMIT $6
        "#
    ))
    .bind(filter.apuratorio_ids.as_deref())
    .bind(filter.responsavel_id.as_deref())
    .bind(filter.apenas_vencidos.unwrap_or(false))
    .bind(filter.dias_ate_vencer)
    .bind(filter.ano)
    .bind(filter.limit.unwrap_or(200).clamp(1, 500))
    .fetch_all(pool)
    .await
}
