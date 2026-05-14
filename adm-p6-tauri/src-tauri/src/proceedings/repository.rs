use chrono::NaiveDate;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::AppError;

use super::domain::{
    ActiveDeadline, CommonCrimeItem, CreateProceedingRequest, DriverRankingItem, IpmEvidenceStats,
    InProgressStats, MilitaryCrimeItem, NatureStatItem, PadsSolutionCount, PdfMetadata, PmEnvolvido,
    ProceedingDetail, ProceedingListFilter, ProceedingListItem, ProceedingListResult,
    SrEvidenceStats, SubstituteResponsibleRequest, TipoCount, TopTransgressionItem,
    UpdateProceedingRequest,
};

pub async fn list_filtered(
    pool: &PgPool,
    filter: &ProceedingListFilter,
) -> Result<ProceedingListResult, sqlx::Error> {
    let limit = filter.limit.unwrap_or(50).min(200);
    let offset = filter.offset.unwrap_or(0).max(0);
    let ano = filter.ano.map(|a| a as i64);
    let search = filter
        .search
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.to_lowercase()));

    let (total,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint
        FROM processos_procedimentos p
        WHERE coalesce(p.ativo, true) = true
          AND ($1::text IS NULL OR p.tipo_geral = $1)
          AND ($2::text IS NULL OR p.tipo_detalhe = $2)
          AND ($3::bool IS NULL OR p.concluido = $3)
          AND ($4::text IS NULL OR p.responsavel_id = $4)
          AND ($5::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $5)
          AND ($6::text IS NULL OR lower(p.numero) LIKE $6 OR lower(p.resumo_fatos) LIKE $6)
        "#,
    )
    .bind(filter.tipo_geral.as_deref())
    .bind(filter.tipo_detalhe.as_deref())
    .bind(filter.concluido)
    .bind(filter.responsavel_id.as_deref())
    .bind(ano)
    .bind(search.as_deref())
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, ProceedingListItem>(
        r#"
        SELECT p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador,
               p.local_origem, p.data_instauracao, p.concluido, p.ativo,
               u.nome AS responsavel_nome
        FROM processos_procedimentos p
        LEFT JOIN usuarios u ON u.id = p.responsavel_id
        WHERE coalesce(p.ativo, true) = true
          AND ($1::text IS NULL OR p.tipo_geral = $1)
          AND ($2::text IS NULL OR p.tipo_detalhe = $2)
          AND ($3::bool IS NULL OR p.concluido = $3)
          AND ($4::text IS NULL OR p.responsavel_id = $4)
          AND ($5::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $5)
          AND ($6::text IS NULL OR lower(p.numero) LIKE $6 OR lower(p.resumo_fatos) LIKE $6)
        ORDER BY p.created_at DESC NULLS LAST
        LIMIT $7 OFFSET $8
        "#,
    )
    .bind(filter.tipo_geral.as_deref())
    .bind(filter.tipo_detalhe.as_deref())
    .bind(filter.concluido)
    .bind(filter.responsavel_id.as_deref())
    .bind(ano)
    .bind(search.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(ProceedingListResult { items, total })
}

pub async fn number_exists(
    pool: &PgPool,
    numero: &str,
    documento_iniciador: &str,
    tipo_detalhe: &str,
    local_origem: Option<&str>,
    ano_instauracao: Option<&str>,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint
        FROM processos_procedimentos
        WHERE coalesce(ativo, true) = true
          AND numero = $1
          AND documento_iniciador = $2
          AND tipo_detalhe = $3
          AND local_origem IS NOT DISTINCT FROM $4
          AND ano_instauracao IS NOT DISTINCT FROM $5
          AND ($6::text IS NULL OR id != $6)
        "#,
    )
    .bind(numero)
    .bind(documento_iniciador)
    .bind(tipo_detalhe)
    .bind(local_origem)
    .bind(ano_instauracao)
    .bind(exclude_id)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

pub async fn create(
    tx: &mut Transaction<'_, Postgres>,
    request: &CreateProceedingRequest,
) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();

    let ano_instauracao = request
        .data_instauracao
        .map(|d| d.format("%Y").to_string());

    let transgressoes_json = request
        .transgressoes_ids
        .as_ref()
        .map(|ids| serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_string()));

    let nome_vitima = request
        .nome_vitima
        .as_deref()
        .map(|s| s.trim().to_uppercase());

    let responsavel_tipo: Option<&str> = if request.responsavel_id.is_some() { Some("usuario") } else { None };
    let presidente_tipo: Option<&str>  = if request.presidente_id.is_some()  { Some("usuario") } else { None };
    let interrogante_tipo: Option<&str>= if request.interrogante_id.is_some(){ Some("usuario") } else { None };
    let escrivao_processo_tipo: Option<&str> = if request.escrivao_processo_id.is_some() { Some("usuario") } else { None };

    let punido = request.solucao_tipo.as_deref() == Some("Punido");
    let penalidade_tipo = if punido { request.penalidade_tipo.as_deref() } else { None };
    let penalidade_dias = if punido { request.penalidade_dias } else { None };

    sqlx::query(
        r#"
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
            responsavel_id, responsavel_tipo, local_origem, local_fatos,
            data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
            concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
            data_remessa_encarregado, data_julgamento, solucao_tipo,
            penalidade_tipo, penalidade_dias,
            presidente_id, presidente_tipo,
            interrogante_id, interrogante_tipo,
            escrivao_processo_id, escrivao_processo_tipo,
            motorista_id, ativo, created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, $23, $24,
            $25, $26, $27, $28, $29,
            $30, $31, $32,
            $33, $34,
            $35, $36,
            $37, $38,
            $39, $40,
            $41, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        "#,
    )
    .bind(&id)
    .bind(&request.numero)
    .bind(&request.tipo_geral)
    .bind(&request.tipo_detalhe)
    .bind(&request.documento_iniciador)
    .bind(request.processo_sei.as_deref())
    .bind(request.responsavel_id.as_deref())
    .bind(responsavel_tipo)
    .bind(request.local_origem.as_deref())
    .bind(&request.local_fatos)
    .bind(request.data_instauracao)
    .bind(request.data_recebimento)
    .bind(request.escrivao_id.as_deref())
    .bind(request.status_pm.as_deref())
    .bind(request.nome_pm_id.as_deref())
    .bind(nome_vitima.as_deref())
    .bind(request.natureza_processo.as_deref())
    .bind(request.natureza_procedimento.as_deref())
    .bind(request.resumo_fatos.as_deref())
    .bind(request.numero_portaria.as_deref())
    .bind(request.numero_memorando.as_deref())
    .bind(request.numero_feito.as_deref())
    .bind(request.numero_rgf.as_deref())
    .bind(request.numero_controle.as_deref())
    .bind(request.concluido)
    .bind(request.data_conclusao)
    .bind(request.solucao_final.as_deref())
    .bind(transgressoes_json.as_deref())
    .bind(ano_instauracao.as_deref())
    .bind(request.data_remessa_encarregado)
    .bind(request.data_julgamento)
    .bind(request.solucao_tipo.as_deref())
    .bind(penalidade_tipo)
    .bind(penalidade_dias)
    .bind(request.presidente_id.as_deref())
    .bind(presidente_tipo)
    .bind(request.interrogante_id.as_deref())
    .bind(interrogante_tipo)
    .bind(request.escrivao_processo_id.as_deref())
    .bind(escrivao_processo_tipo)
    .bind(request.motorista_id.as_deref())
    .execute(&mut **tx)
    .await?;

    if let Some(pms) = &request.pms_envolvidos {
        for pm_id in pms {
            let link_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO procedimento_pms_envolvidos (id, procedimento_id, pm_id, pm_tipo) VALUES ($1, $2, $3, 'usuario') ON CONFLICT DO NOTHING",
            )
            .bind(link_id)
            .bind(&id)
            .bind(pm_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(id)
}

// Intermediate row for the main get query
#[derive(sqlx::FromRow)]
struct ProceedingRow {
    id: String,
    numero: String,
    tipo_geral: String,
    tipo_detalhe: String,
    documento_iniciador: String,
    processo_sei: Option<String>,
    responsavel_id: Option<String>,
    local_origem: Option<String>,
    local_fatos: Option<String>,
    data_instauracao: Option<NaiveDate>,
    data_recebimento: Option<NaiveDate>,
    escrivao_id: Option<String>,
    status_pm: Option<String>,
    nome_pm_id: Option<String>,
    nome_vitima: Option<String>,
    natureza_processo: Option<String>,
    natureza_procedimento: Option<String>,
    resumo_fatos: Option<String>,
    numero_portaria: Option<String>,
    numero_memorando: Option<String>,
    numero_feito: Option<String>,
    numero_rgf: Option<String>,
    numero_controle: Option<String>,
    concluido: Option<bool>,
    data_conclusao: Option<NaiveDate>,
    solucao_final: Option<String>,
    transgressoes_ids: Option<String>,
    data_remessa_encarregado: Option<NaiveDate>,
    data_julgamento: Option<NaiveDate>,
    solucao_tipo: Option<String>,
    penalidade_tipo: Option<String>,
    penalidade_dias: Option<i32>,
    presidente_id: Option<String>,
    interrogante_id: Option<String>,
    escrivao_processo_id: Option<String>,
    motorista_id: Option<String>,
    andamentos: Option<String>,
    historico_encarregados: Option<String>,
    pdf_nome: Option<String>,
    pdf_tamanho: Option<i64>,
    responsavel_nome: Option<String>,
    responsavel_posto: Option<String>,
    responsavel_matricula: Option<String>,
    escrivao_nome: Option<String>,
    nome_pm_nome: Option<String>,
    presidente_nome: Option<String>,
    interrogante_nome: Option<String>,
    escrivao_processo_nome: Option<String>,
}

#[derive(sqlx::FromRow)]
struct PmRow {
    id: String,
    pm_id: String,
    pm_tipo: Option<String>,
    status_pm: Option<String>,
    nome: Option<String>,
    posto_graduacao: Option<String>,
    matricula: Option<String>,
}

#[derive(sqlx::FromRow)]
struct DeadlineRow {
    id: String,
    tipo_prazo: String,
    data_inicio: NaiveDate,
    data_vencimento: NaiveDate,
    dias_adicionados: Option<i32>,
}

pub async fn get(pool: &PgPool, id: &str) -> Result<Option<ProceedingDetail>, sqlx::Error> {
    let row = sqlx::query_as::<_, ProceedingRow>(
        r#"
        SELECT
            p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
            p.responsavel_id, p.local_origem, p.local_fatos, p.data_instauracao, p.data_recebimento,
            p.escrivao_id, p.status_pm, p.nome_pm_id,
            p.nome_vitima, p.natureza_processo, p.natureza_procedimento, p.resumo_fatos,
            p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf, p.numero_controle,
            p.concluido, p.data_conclusao, p.solucao_final, p.transgressoes_ids,
            p.data_remessa_encarregado, p.data_julgamento, p.solucao_tipo,
            p.penalidade_tipo, p.penalidade_dias,
            p.presidente_id, p.interrogante_id, p.escrivao_processo_id, p.motorista_id,
            p.andamentos::text AS andamentos,
            p.historico_encarregados::text AS historico_encarregados,
            p.pdf_nome, p.pdf_tamanho,
            u_resp.nome        AS responsavel_nome,
            u_resp.posto_graduacao AS responsavel_posto,
            u_resp.matricula   AS responsavel_matricula,
            u_esc.nome         AS escrivao_nome,
            u_pm.nome          AS nome_pm_nome,
            u_pres.nome        AS presidente_nome,
            u_int.nome         AS interrogante_nome,
            u_escrp.nome       AS escrivao_processo_nome
        FROM processos_procedimentos p
        LEFT JOIN usuarios u_resp  ON p.responsavel_id        = u_resp.id
        LEFT JOIN usuarios u_esc   ON p.escrivao_id           = u_esc.id
        LEFT JOIN usuarios u_pm    ON p.nome_pm_id            = u_pm.id
        LEFT JOIN usuarios u_pres  ON p.presidente_id         = u_pres.id
        LEFT JOIN usuarios u_int   ON p.interrogante_id       = u_int.id
        LEFT JOIN usuarios u_escrp ON p.escrivao_processo_id  = u_escrp.id
        WHERE p.id = $1 AND coalesce(p.ativo, true) = true
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    let row = match row {
        Some(r) => r,
        None => return Ok(None),
    };

    let pms_envolvidos = sqlx::query_as::<_, PmRow>(
        r#"
        SELECT pe.id, pe.pm_id, pe.pm_tipo, pe.status_pm,
               u.nome, u.posto_graduacao, u.matricula
        FROM procedimento_pms_envolvidos pe
        LEFT JOIN usuarios u ON pe.pm_id = u.id
        WHERE pe.procedimento_id = $1
        ORDER BY pe.ordem NULLS LAST
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let prazo_ativo = sqlx::query_as::<_, DeadlineRow>(
        r#"
        SELECT id, tipo_prazo, data_inicio, data_vencimento, dias_adicionados
        FROM prazos_processo
        WHERE processo_id = $1 AND coalesce(ativo, true) = true
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    let andamentos: Vec<serde_json::Value> = crate::movements::domain::normalize_andamentos(
        row.andamentos.as_deref().and_then(|s| serde_json::from_str(s).ok()).unwrap_or_default(),
    );

    let historico_encarregados: Vec<serde_json::Value> = row
        .historico_encarregados
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    Ok(Some(ProceedingDetail {
        id: row.id,
        numero: row.numero,
        tipo_geral: row.tipo_geral,
        tipo_detalhe: row.tipo_detalhe,
        documento_iniciador: row.documento_iniciador,
        processo_sei: row.processo_sei,
        responsavel_id: row.responsavel_id,
        local_origem: row.local_origem,
        local_fatos: row.local_fatos,
        data_instauracao: row.data_instauracao,
        data_recebimento: row.data_recebimento,
        escrivao_id: row.escrivao_id,
        status_pm: row.status_pm,
        nome_pm_id: row.nome_pm_id,
        nome_vitima: row.nome_vitima,
        natureza_processo: row.natureza_processo,
        natureza_procedimento: row.natureza_procedimento,
        resumo_fatos: row.resumo_fatos,
        numero_portaria: row.numero_portaria,
        numero_memorando: row.numero_memorando,
        numero_feito: row.numero_feito,
        numero_rgf: row.numero_rgf,
        numero_controle: row.numero_controle,
        concluido: row.concluido,
        data_conclusao: row.data_conclusao,
        solucao_final: row.solucao_final,
        transgressoes_ids: row.transgressoes_ids,
        data_remessa_encarregado: row.data_remessa_encarregado,
        data_julgamento: row.data_julgamento,
        solucao_tipo: row.solucao_tipo,
        penalidade_tipo: row.penalidade_tipo,
        penalidade_dias: row.penalidade_dias,
        presidente_id: row.presidente_id,
        interrogante_id: row.interrogante_id,
        escrivao_processo_id: row.escrivao_processo_id,
        motorista_id: row.motorista_id,
        responsavel_nome: row.responsavel_nome,
        responsavel_posto: row.responsavel_posto,
        responsavel_matricula: row.responsavel_matricula,
        escrivao_nome: row.escrivao_nome,
        nome_pm_nome: row.nome_pm_nome,
        presidente_nome: row.presidente_nome,
        interrogante_nome: row.interrogante_nome,
        escrivao_processo_nome: row.escrivao_processo_nome,
        pdf_nome: row.pdf_nome,
        pdf_tamanho: row.pdf_tamanho,
        pms_envolvidos: pms_envolvidos
            .into_iter()
            .map(|r| PmEnvolvido {
                id: r.id,
                pm_id: r.pm_id,
                nome: r.nome,
                posto_graduacao: r.posto_graduacao,
                matricula: r.matricula,
                pm_tipo: r.pm_tipo,
                status_pm: r.status_pm,
            })
            .collect(),
        prazo_ativo: prazo_ativo.map(|r| ActiveDeadline {
            id: r.id,
            tipo_prazo: r.tipo_prazo,
            data_inicio: r.data_inicio,
            data_vencimento: r.data_vencimento,
            dias_adicionados: r.dias_adicionados,
        }),
        andamentos,
        historico_encarregados,
    }))
}

pub async fn update(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateProceedingRequest,
) -> Result<(), AppError> {
    let ano_instauracao = request
        .data_instauracao
        .map(|d| d.format("%Y").to_string());

    let transgressoes_json = request
        .transgressoes_ids
        .as_ref()
        .map(|ids| serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_string()));

    let nome_vitima = request
        .nome_vitima
        .as_deref()
        .map(|s| s.trim().to_uppercase());

    let responsavel_tipo: Option<&str> = if request.responsavel_id.is_some() { Some("usuario") } else { None };
    let presidente_tipo: Option<&str>  = if request.presidente_id.is_some()  { Some("usuario") } else { None };
    let interrogante_tipo: Option<&str>= if request.interrogante_id.is_some(){ Some("usuario") } else { None };
    let escrivao_processo_tipo: Option<&str> = if request.escrivao_processo_id.is_some() { Some("usuario") } else { None };

    let punido = request.solucao_tipo.as_deref() == Some("Punido");
    let penalidade_tipo = if punido { request.penalidade_tipo.as_deref() } else { None };
    let penalidade_dias = if punido { request.penalidade_dias } else { None };

    sqlx::query(
        r#"
        UPDATE processos_procedimentos SET
            numero = $2, tipo_geral = $3, tipo_detalhe = $4, documento_iniciador = $5,
            processo_sei = $6, responsavel_id = $7, responsavel_tipo = $8,
            local_origem = $9, local_fatos = $10,
            data_instauracao = $11, data_recebimento = $12,
            escrivao_id = $13, status_pm = $14, nome_pm_id = $15,
            nome_vitima = $16, natureza_processo = $17, natureza_procedimento = $18,
            resumo_fatos = $19, numero_portaria = $20, numero_memorando = $21,
            numero_feito = $22, numero_rgf = $23, numero_controle = $24,
            concluido = $25, data_conclusao = $26, solucao_final = $27,
            transgressoes_ids = $28, ano_instauracao = $29,
            data_remessa_encarregado = $30, data_julgamento = $31, solucao_tipo = $32,
            penalidade_tipo = $33, penalidade_dias = $34,
            presidente_id = $35, presidente_tipo = $36,
            interrogante_id = $37, interrogante_tipo = $38,
            escrivao_processo_id = $39, escrivao_processo_tipo = $40,
            motorista_id = $41, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND coalesce(ativo, true) = true
        "#,
    )
    .bind(&request.id)
    .bind(&request.numero)
    .bind(&request.tipo_geral)
    .bind(&request.tipo_detalhe)
    .bind(&request.documento_iniciador)
    .bind(request.processo_sei.as_deref())
    .bind(request.responsavel_id.as_deref())
    .bind(responsavel_tipo)
    .bind(request.local_origem.as_deref())
    .bind(&request.local_fatos)
    .bind(request.data_instauracao)
    .bind(request.data_recebimento)
    .bind(request.escrivao_id.as_deref())
    .bind(request.status_pm.as_deref())
    .bind(request.nome_pm_id.as_deref())
    .bind(nome_vitima.as_deref())
    .bind(request.natureza_processo.as_deref())
    .bind(request.natureza_procedimento.as_deref())
    .bind(request.resumo_fatos.as_deref())
    .bind(request.numero_portaria.as_deref())
    .bind(request.numero_memorando.as_deref())
    .bind(request.numero_feito.as_deref())
    .bind(request.numero_rgf.as_deref())
    .bind(request.numero_controle.as_deref())
    .bind(request.concluido)
    .bind(request.data_conclusao)
    .bind(request.solucao_final.as_deref())
    .bind(transgressoes_json.as_deref())
    .bind(ano_instauracao.as_deref())
    .bind(request.data_remessa_encarregado)
    .bind(request.data_julgamento)
    .bind(request.solucao_tipo.as_deref())
    .bind(penalidade_tipo)
    .bind(penalidade_dias)
    .bind(request.presidente_id.as_deref())
    .bind(presidente_tipo)
    .bind(request.interrogante_id.as_deref())
    .bind(interrogante_tipo)
    .bind(request.escrivao_processo_id.as_deref())
    .bind(escrivao_processo_tipo)
    .bind(request.motorista_id.as_deref())
    .execute(&mut **tx)
    .await?;

    // Sync pms_envolvidos: delete old, re-insert new
    if let Some(pms) = &request.pms_envolvidos {
        sqlx::query("DELETE FROM procedimento_pms_envolvidos WHERE procedimento_id = $1")
            .bind(&request.id)
            .execute(&mut **tx)
            .await?;
        for pm_id in pms {
            let link_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO procedimento_pms_envolvidos (id, procedimento_id, pm_id, pm_tipo) VALUES ($1, $2, $3, 'usuario')",
            )
            .bind(link_id)
            .bind(&request.id)
            .bind(pm_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

pub async fn delete(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE processos_procedimentos SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn reopen(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE processos_procedimentos
        SET concluido = false, data_conclusao = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND coalesce(ativo, true) = true
        "#,
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_initial_deadline(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    data_inicio: NaiveDate,
    dias: i32,
) -> Result<(), sqlx::Error> {
    let prazo_id = Uuid::new_v4().to_string();
    let data_vencimento = data_inicio + chrono::Duration::days(dias as i64);
    sqlx::query(
        r#"
        INSERT INTO prazos_processo (
            id, processo_id, tipo_prazo, data_inicio, data_vencimento,
            dias_adicionados, ativo, created_at
        )
        VALUES ($1, $2, 'inicial', $3, $4, $5, true, CURRENT_TIMESTAMP)
        "#,
    )
    .bind(prazo_id)
    .bind(processo_id)
    .bind(data_inicio)
    .bind(data_vencimento)
    .bind(dias)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn save_pdf(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    nome: &str,
    content_type: &str,
    bytes: &[u8],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE processos_procedimentos
        SET pdf_arquivo    = $2,
            pdf_nome       = $3,
            pdf_content_type = $4,
            pdf_tamanho    = $5,
            pdf_upload_em  = CURRENT_TIMESTAMP,
            updated_at     = CURRENT_TIMESTAMP
        WHERE id = $1 AND coalesce(ativo, true) = true
        "#,
    )
    .bind(processo_id)
    .bind(bytes)
    .bind(nome)
    .bind(content_type)
    .bind(bytes.len() as i64)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct PdfRowMeta {
    pdf_nome: Option<String>,
    pdf_content_type: Option<String>,
    pdf_tamanho: Option<i64>,
    pdf_upload_em: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(sqlx::FromRow)]
struct PdfRowFull {
    pdf_nome: Option<String>,
    pdf_content_type: Option<String>,
    pdf_tamanho: Option<i64>,
    pdf_upload_em: Option<chrono::DateTime<chrono::Utc>>,
    pdf_arquivo: Option<Vec<u8>>,
}

pub async fn get_pdf(
    pool: &PgPool,
    processo_id: &str,
    include_content: bool,
) -> Result<Option<PdfMetadata>, sqlx::Error> {
    if include_content {
        let row = sqlx::query_as::<_, PdfRowFull>(
            r#"
            SELECT pdf_nome, pdf_content_type, pdf_tamanho, pdf_upload_em, pdf_arquivo
            FROM processos_procedimentos
            WHERE id = $1 AND coalesce(ativo, true) = true
            "#,
        )
        .bind(processo_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|r| {
            use base64::Engine as _;
            PdfMetadata {
                nome: r.pdf_nome,
                content_type: r.pdf_content_type,
                tamanho: r.pdf_tamanho,
                upload_em: r.pdf_upload_em.map(|dt| dt.to_rfc3339()),
                conteudo: r.pdf_arquivo.map(|b| {
                    base64::engine::general_purpose::STANDARD.encode(b)
                }),
            }
        }))
    } else {
        let row = sqlx::query_as::<_, PdfRowMeta>(
            r#"
            SELECT pdf_nome, pdf_content_type, pdf_tamanho, pdf_upload_em
            FROM processos_procedimentos
            WHERE id = $1 AND coalesce(ativo, true) = true
            "#,
        )
        .bind(processo_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|r| PdfMetadata {
            nome: r.pdf_nome,
            content_type: r.pdf_content_type,
            tamanho: r.pdf_tamanho,
            upload_em: r.pdf_upload_em.map(|dt| dt.to_rfc3339()),
            conteudo: None,
        }))
    }
}

pub async fn remove_pdf(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE processos_procedimentos
        SET pdf_arquivo     = NULL,
            pdf_nome        = NULL,
            pdf_content_type = NULL,
            pdf_tamanho     = NULL,
            pdf_upload_em   = NULL,
            updated_at      = CURRENT_TIMESTAMP
        WHERE id = $1 AND coalesce(ativo, true) = true
        "#,
    )
    .bind(processo_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn substitute_responsible(
    tx: &mut Transaction<'_, Postgres>,
    req: &SubstituteResponsibleRequest,
) -> Result<(), AppError> {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT p.responsavel_id, u.nome
        FROM processos_procedimentos p
        LEFT JOIN usuarios u ON u.id = p.responsavel_id
        WHERE p.id = $1 AND coalesce(p.ativo, true) = true
        "#,
    )
    .bind(&req.id)
    .fetch_optional(&mut **tx)
    .await?;

    let (responsavel_id, responsavel_nome) = row
        .ok_or_else(|| AppError::Domain("Processo nao encontrado".to_string()))?;

    let entry = serde_json::json!({
        "id": responsavel_id,
        "nome": responsavel_nome.unwrap_or_default(),
        "data_substituicao": chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
        "justificativa": req.justificativa,
    });

    let entry_str = serde_json::to_string(&entry)
        .map_err(|e| AppError::Domain(format!("falha ao serializar historico: {e}")))?;

    sqlx::query(
        r#"
        UPDATE processos_procedimentos
        SET responsavel_id = $2,
            historico_encarregados = coalesce(historico_encarregados, '[]'::jsonb)
                                     || jsonb_build_array($3::jsonb),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND coalesce(ativo, true) = true
        "#,
    )
    .bind(&req.id)
    .bind(&req.novo_responsavel_id)
    .bind(&entry_str)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

pub async fn pads_solutions(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<PadsSolutionCount>, sqlx::Error> {
    sqlx::query_as::<_, PadsSolutionCount>(
        r#"
        SELECT solucao_tipo, count(*)::bigint AS quantidade
        FROM processos_procedimentos
        WHERE coalesce(ativo, true) = true
          AND tipo_detalhe = 'PADS'
          AND coalesce(concluido, false) = true
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM data_instauracao)::bigint = $1::bigint)
        GROUP BY solucao_tipo
        ORDER BY quantidade DESC
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_all(pool)
    .await
}

pub async fn ipm_evidence_stats(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<IpmEvidenceStats, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Row {
        crimes_cpm: i64,
        transgressoes_rdpm: i64,
        transgressoes_art29: i64,
        sem_indicios: i64,
    }

    let row: Row = sqlx::query_as(
        r#"
        SELECT
          count(*) FILTER (
            WHERE 'crimes_cpm' = ANY(
              SELECT jsonb_array_elements_text(pei.categorias_indicios)
            )
          )::bigint AS crimes_cpm,
          count(*) FILTER (
            WHERE 'transgressoes_rdpm' = ANY(
              SELECT jsonb_array_elements_text(pei.categorias_indicios)
            )
          )::bigint AS transgressoes_rdpm,
          count(*) FILTER (
            WHERE 'transgressoes_art29' = ANY(
              SELECT jsonb_array_elements_text(pei.categorias_indicios)
            )
          )::bigint AS transgressoes_art29,
          count(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1 FROM pm_envolvido_indicios pei2
              WHERE pei2.pm_envolvido_id = ppe.id
                AND coalesce(pei2.ativo, true) = true
            )
          )::bigint AS sem_indicios
        FROM procedimento_pms_envolvidos ppe
        LEFT JOIN pm_envolvido_indicios pei
          ON pei.pm_envolvido_id = ppe.id AND coalesce(pei.ativo, true) = true
        JOIN processos_procedimentos p ON p.id = ppe.procedimento_id
        WHERE coalesce(p.ativo, true) = true
          AND p.tipo_detalhe IN ('IPM', 'IPPM')
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1::bigint)
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_one(pool)
    .await?;

    Ok(IpmEvidenceStats {
        crimes_cpm: row.crimes_cpm,
        transgressoes_rdpm: row.transgressoes_rdpm,
        transgressoes_art29: row.transgressoes_art29,
        sem_indicios: row.sem_indicios,
    })
}

pub async fn common_crimes_stats(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<CommonCrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CommonCrimeItem>(
        r#"
        SELECT
            (cc.dispositivo_legal || ' - Art. ' || cc.artigo) AS artigo,
            cc.descricao_artigo AS descricao,
            CASE WHEN cc.tipo = 'Crime' THEN 'Crime Comum' ELSE 'Contravenção Penal' END AS classificacao,
            COUNT(pec.id)::bigint AS quantidade
        FROM processos_procedimentos p
        JOIN pm_envolvido_indicios pei ON pei.procedimento_id = p.id
        JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
        JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
        WHERE coalesce(p.ativo, true) = true
          AND p.tipo_detalhe IN ('IPM', 'IPPM', 'SR')
          AND cc.dispositivo_legal IN ('Código Penal', 'Lei de Contravenções Penais')
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        GROUP BY cc.artigo, cc.descricao_artigo, cc.dispositivo_legal, cc.tipo
        ORDER BY quantidade DESC, cc.artigo
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_all(pool)
    .await
}

pub async fn sr_evidence_stats(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<SrEvidenceStats, sqlx::Error> {
    let ano_val = ano.map(|a| a as i64);
    let base_filter = "coalesce(p.ativo, true) = true AND p.tipo_detalhe = 'SR' AND coalesce(p.concluido, false) = true";

    let (crimes_comuns,): (i64,) = sqlx::query_as(&format!(
        r#"
        SELECT COUNT(pec.id)::bigint
        FROM processos_procedimentos p
        JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
        JOIN pm_envolvido_crimes pec ON pec.pm_indicios_id = i.id
        JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
        WHERE {base_filter}
          AND cc.dispositivo_legal IN ('Código Penal', 'Lei de Contravenções Penais')
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        "#
    ))
    .bind(ano_val)
    .fetch_one(pool)
    .await?;

    let (rdpm_count,): (i64,) = sqlx::query_as(&format!(
        r#"
        SELECT COUNT(r.id)::bigint
        FROM processos_procedimentos p
        JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
        JOIN pm_envolvido_rdpm r ON r.pm_indicios_id = i.id
        WHERE {base_filter}
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        "#
    ))
    .bind(ano_val)
    .fetch_one(pool)
    .await?;

    let (art29_count,): (i64,) = sqlx::query_as(&format!(
        r#"
        SELECT COUNT(a.id)::bigint
        FROM processos_procedimentos p
        JOIN pm_envolvido_indicios i ON i.procedimento_id = p.id
        JOIN pm_envolvido_art29 a ON a.pm_indicios_id = i.id
        WHERE {base_filter}
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        "#
    ))
    .bind(ano_val)
    .fetch_one(pool)
    .await?;

    let (sem_indicios,): (i64,) = sqlx::query_as(&format!(
        r#"
        SELECT COUNT(DISTINCT ppe.id)::bigint
        FROM procedimento_pms_envolvidos ppe
        LEFT JOIN pm_envolvido_indicios pei
          ON pei.pm_envolvido_id = ppe.id AND coalesce(pei.ativo, true) = true
        JOIN processos_procedimentos p ON p.id = ppe.procedimento_id
        WHERE {base_filter}
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
          AND pei.id IS NULL
        "#
    ))
    .bind(ano_val)
    .fetch_one(pool)
    .await?;

    Ok(SrEvidenceStats {
        crimes_comuns,
        transgressoes: rdpm_count + art29_count,
        sem_indicios,
    })
}

pub async fn top10_transgressions(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<TopTransgressionItem>, sqlx::Error> {
    sqlx::query_as::<_, TopTransgressionItem>(
        r#"
        WITH rdpm_counts AS (
            SELECT t.id::text AS transgressao_id,
                   'RDPM Art. ' ||
                   CASE t.gravidade WHEN 'leve' THEN '15' WHEN 'media' THEN '16' WHEN 'grave' THEN '17' ELSE '?' END
                   || ', Inc. ' || coalesce(t.inciso, '') AS artigo_label,
                   LEFT(t.texto, 50) AS descricao_curta,
                   COUNT(*)::bigint AS quantidade
            FROM pm_envolvido_rdpm r
            JOIN pm_envolvido_indicios i ON r.pm_indicios_id = i.id
            JOIN processos_procedimentos p ON i.procedimento_id = p.id
            JOIN transgressoes t ON r.transgressao_id = t.id
            WHERE coalesce(p.ativo, true) = true
              AND p.tipo_detalhe IN ('IPM', 'IPPM', 'SR')
              AND coalesce(p.concluido, false) = true
              AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
            GROUP BY t.id, t.inciso, t.gravidade, t.texto
        ),
        art29_counts AS (
            SELECT a.id AS transgressao_id,
                   'Art. 29, Inc. ' || coalesce(a.inciso, '') AS artigo_label,
                   LEFT(a.texto, 50) AS descricao_curta,
                   COUNT(*)::bigint AS quantidade
            FROM pm_envolvido_art29 pa
            JOIN pm_envolvido_indicios i ON pa.pm_indicios_id = i.id
            JOIN processos_procedimentos p ON i.procedimento_id = p.id
            JOIN infracoes_estatuto_art29 a ON pa.art29_id = a.id
            WHERE coalesce(p.ativo, true) = true
              AND p.tipo_detalhe IN ('IPM', 'IPPM', 'SR')
              AND coalesce(p.concluido, false) = true
              AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
            GROUP BY a.id, a.inciso, a.texto
        )
        SELECT transgressao_id, artigo_label, descricao_curta, SUM(quantidade)::bigint AS quantidade
        FROM (SELECT * FROM rdpm_counts UNION ALL SELECT * FROM art29_counts) combined
        GROUP BY transgressao_id, artigo_label, descricao_curta
        ORDER BY quantidade DESC
        LIMIT 10
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_all(pool)
    .await
}

pub async fn driver_ranking(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<DriverRankingItem>, sqlx::Error> {
    sqlx::query_as::<_, DriverRankingItem>(
        r#"
        SELECT u.posto_graduacao, u.matricula, u.nome, COUNT(*)::bigint AS total_sinistros
        FROM processos_procedimentos p
        JOIN usuarios u ON p.motorista_id = u.id
        WHERE coalesce(p.ativo, true) = true
          AND p.motorista_id IS NOT NULL
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        GROUP BY u.id, u.posto_graduacao, u.matricula, u.nome
        ORDER BY total_sinistros DESC
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_all(pool)
    .await
}

pub async fn nature_stats(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<NatureStatItem>, sqlx::Error> {
    sqlx::query_as::<_, NatureStatItem>(
        r#"
        SELECT natureza_procedimento AS natureza, COUNT(*)::bigint AS quantidade
        FROM processos_procedimentos
        WHERE coalesce(ativo, true) = true
          AND natureza_procedimento IS NOT NULL
          AND natureza_procedimento <> ''
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM data_instauracao)::bigint = $1)
        GROUP BY natureza_procedimento
        ORDER BY quantidade DESC
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_all(pool)
    .await
}

pub async fn military_crimes_stats(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<MilitaryCrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, MilitaryCrimeItem>(
        r#"
        SELECT
            (cc.dispositivo_legal || ' - Art. ' || cc.artigo) AS artigo,
            cc.descricao_artigo AS descricao,
            COUNT(pec.id)::bigint AS quantidade
        FROM processos_procedimentos p
        JOIN pm_envolvido_indicios pei ON pei.procedimento_id = p.id
        JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
        JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
        WHERE coalesce(p.ativo, true) = true
          AND p.tipo_detalhe IN ('IPM', 'IPPM')
          AND cc.dispositivo_legal = 'Código Penal Militar'
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        GROUP BY cc.artigo, cc.descricao_artigo, cc.dispositivo_legal
        ORDER BY quantidade DESC, cc.artigo
        "#,
    )
    .bind(ano.map(|a| a as i64))
    .fetch_all(pool)
    .await
}

pub async fn in_progress_stats(pool: &PgPool) -> Result<InProgressStats, sqlx::Error> {
    let por_tipo = sqlx::query_as::<_, TipoCount>(
        r#"
        SELECT tipo_detalhe AS tipo, COUNT(*)::bigint AS quantidade
        FROM processos_procedimentos
        WHERE coalesce(ativo, true) = true
          AND coalesce(concluido, false) = false
          AND data_conclusao IS NULL
        GROUP BY tipo_detalhe
        ORDER BY quantidade DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let (concluidos,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM processos_procedimentos WHERE coalesce(ativo, true) = true AND data_conclusao IS NOT NULL",
    )
    .fetch_one(pool)
    .await?;

    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM processos_procedimentos WHERE coalesce(ativo, true) = true",
    )
    .fetch_one(pool)
    .await?;

    Ok(InProgressStats { por_tipo, concluidos, total })
}
