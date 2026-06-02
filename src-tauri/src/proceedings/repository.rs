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

fn tipo_to_table(tipo: &str) -> Result<&'static str, AppError> {
    match tipo {
        "SR"   => Ok("sindicancia_regular"),
        "IPM"  => Ok("inquerito_policial_militar"),
        "FP"   => Ok("feito_preliminar"),
        "CP"   => Ok("carta_precatoria"),
        "SV"   => Ok("sindicancia_verbal"),
        "PADS" => Ok("processo_apuratorio_disciplinar_sumario"),
        "PADE" => Ok("processo_apuratorio_dano_herario"),
        "PAD"  => Ok("processo_administrativo_disciplinar"),
        "CD"   => Ok("conselho_disciplina"),
        "CJ"   => Ok("conselho_justificacao"),
        other  => Err(AppError::Domain(format!("tipo_detalhe desconhecido: {other}"))),
    }
}

async fn get_tipo_detalhe<'e, E>(executor: E, id: &str) -> Result<String, AppError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    sqlx::query_scalar::<_, String>(
        r#"SELECT a.nome_apuratorio
           FROM historico_processo_procedimentos hpp
           JOIN apuratorios a ON a.id = hpp.apuratorio_id
           WHERE hpp.processo_procedimento_id = $1::uuid"#,
    )
    .bind(id)
    .fetch_optional(executor)
    .await?
    .ok_or_else(|| AppError::Domain("processo nao encontrado".to_string()))
}

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
        FROM v_processos p
        WHERE coalesce(p.ativo, true) = true
          AND ($1::text IS NULL OR p.tipo_geral = $1)
          AND ($2::text IS NULL OR p.tipo_detalhe = $2)
          AND ($3::bool IS NULL OR p.concluido = $3)
          AND ($4::text IS NULL OR p.responsavel_id = $4::uuid)
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
        SELECT p.id::text AS id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador,
               p.local_origem, p.data_instauracao, p.concluido, p.ativo,
               u.nome AS responsavel_nome
        FROM v_processos p
        LEFT JOIN usuarios u ON u.id = p.responsavel_id
        WHERE coalesce(p.ativo, true) = true
          AND ($1::text IS NULL OR p.tipo_geral = $1)
          AND ($2::text IS NULL OR p.tipo_detalhe = $2)
          AND ($3::bool IS NULL OR p.concluido = $3)
          AND ($4::text IS NULL OR p.responsavel_id = $4::uuid)
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
    ano_instauracao: Option<i32>,
    exclude_id: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let ano = ano_instauracao.map(|a| a as i64);
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint
        FROM v_processos
        WHERE coalesce(ativo, true) = true
          AND numero = $1
          AND documento_iniciador = $2
          AND tipo_detalhe = $3
          AND local_origem IS NOT DISTINCT FROM $4
          AND ($5::bigint IS NULL OR EXTRACT(YEAR FROM data_instauracao)::bigint = $5)
          AND ($6::uuid IS NULL OR id != $6::uuid)
        "#,
    )
    .bind(numero)
    .bind(documento_iniciador)
    .bind(tipo_detalhe)
    .bind(local_origem)
    .bind(ano)
    .bind(exclude_id)
    .fetch_one(pool)
    .await?;
    Ok(count > 0)
}

pub async fn create(
    tx: &mut Transaction<'_, Postgres>,
    request: &CreateProceedingRequest,
) -> Result<String, AppError> {
    let nome_vitima = request.nome_vitima.as_deref().map(|s| s.trim().to_uppercase());

    let punido = request.solucao_tipo.as_deref() == Some("Punido");
    let penalidade_tipo = if punido { request.penalidade_tipo.as_deref() } else { None };
    let penalidade_dias = if punido { request.penalidade_dias } else { None };

    // Step 1: id canônico do processo/procedimento (gerado pela app; vira a PK própria
    // da tabela específica e o processo_procedimento_id do registro histórico).
    let proc_id = Uuid::new_v4().to_string();

    // Step 2: Insert into type-specific table (id próprio, independente)
    insert_type_specific(tx, &proc_id, request, &nome_vitima, penalidade_tipo, penalidade_dias).await?;

    // Step 3: Registrar no histórico (alvo das FKs de processo/procedimento)
    sqlx::query(
        r#"INSERT INTO historico_processo_procedimentos (processo_procedimento_id, apuratorio_id)
           SELECT $1::uuid, id FROM apuratorios WHERE nome_apuratorio = $2"#,
    )
    .bind(&proc_id)
    .bind(&request.tipo_detalhe)
    .execute(&mut **tx)
    .await?;

    // Step 4: Insert PMs envolvidos
    if let Some(pms) = &request.pms_envolvidos {
        for pm_id in pms {
            sqlx::query(
                "INSERT INTO procedimento_pms_envolvidos (procedimento_id, pm_id) VALUES ($1::uuid, $2::uuid)",
            )
            .bind(&proc_id)
            .bind(pm_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(proc_id)
}

async fn insert_type_specific(
    tx: &mut Transaction<'_, Postgres>,
    proc_id: &str,
    r: &CreateProceedingRequest,
    nome_vitima: &Option<String>,
    penalidade_tipo: Option<&str>,
    penalidade_dias: Option<i32>,
) -> Result<(), AppError> {
    let table = tipo_to_table(&r.tipo_detalhe)?;

    match r.tipo_detalhe.as_str() {
        "SR" | "SV" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    nome_vitima, numero_portaria, data_conclusao, data_remessa_encarregado,
                    concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17, $18, $19, $20,
                    coalesce($21, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(nome_vitima.as_deref())
            .bind(r.numero_portaria.as_deref()).bind(r.data_conclusao)
            .bind(r.data_remessa_encarregado).bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        "IPM" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    escrivao_id, nome_vitima, numero_portaria, data_conclusao,
                    data_remessa_encarregado, concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17::uuid, $18, $19, $20, $21,
                    coalesce($22, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(r.escrivao_id.as_deref())
            .bind(nome_vitima.as_deref()).bind(r.numero_portaria.as_deref())
            .bind(r.data_conclusao).bind(r.data_remessa_encarregado).bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        "FP" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    nome_vitima, numero_feito, data_conclusao, data_remessa_encarregado,
                    concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17, $18, $19, $20,
                    coalesce($21, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(nome_vitima.as_deref())
            .bind(r.numero_feito.as_deref()).bind(r.data_conclusao)
            .bind(r.data_remessa_encarregado).bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        "CP" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    nome_vitima, numero_portaria, data_remessa_encarregado,
                    unidade_deprecada, deprecante,
                    concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17, $18, $19, $20, $21,
                    coalesce($22, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(nome_vitima.as_deref())
            .bind(r.numero_portaria.as_deref()).bind(r.data_remessa_encarregado)
            .bind(r.unidade_deprecada.as_deref()).bind(r.deprecante.as_deref())
            .bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        "PADS" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    numero_memorando, data_conclusao, data_remessa_encarregado,
                    data_julgamento, penalidade_dias, penalidade_tipo_id,
                    concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17, $18, $19, $20, $21,
                    (SELECT id FROM tipos_penalidade WHERE nome_penalidade = $22),
                    coalesce($23, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(r.numero_memorando.as_deref())
            .bind(r.data_conclusao).bind(r.data_remessa_encarregado)
            .bind(r.data_julgamento).bind(penalidade_dias).bind(penalidade_tipo)
            .bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        "PADE" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    numero_portaria, data_conclusao, data_remessa_encarregado,
                    data_julgamento, penalidade_tipo_id,
                    concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17, $18, $19, $20,
                    (SELECT id FROM tipos_penalidade WHERE nome_penalidade = $21),
                    coalesce($22, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(r.numero_portaria.as_deref())
            .bind(r.data_conclusao).bind(r.data_remessa_encarregado)
            .bind(r.data_julgamento).bind(penalidade_tipo)
            .bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        "PAD" | "CD" | "CJ" => {
            sqlx::query(&format!(r#"
                INSERT INTO {table} (
                    id, numero, tipo_geral, tipo_detalhe_id, documento_iniciador_id,
                    local_origem_id, local_fatos_id, processo_sei, responsavel_id,
                    data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
                    solucao_tipo_id, natureza_processo_id, solucao_final,
                    numero_portaria, data_conclusao, data_remessa_comissao,
                    data_julgamento, penalidade_dias, penalidade_tipo_id,
                    presidente_id, interrogante_id, escrivao_processo_id,
                    concluido, ativo, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2, $3,
                    (SELECT id FROM apuratorios WHERE nome_apuratorio = $4),
                    (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $5),
                    (SELECT id FROM locais_origem WHERE nome_unidade_pm = $6),
                    (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $7),
                    $8, $9::uuid, $10, $11, $12, $13,
                    (SELECT id FROM solucoes_tipo WHERE codigo = $14),
                    (SELECT id FROM natureza_transgressao WHERE codigo = $15),
                    $16, $17, $18, $19, $20, $21,
                    (SELECT id FROM tipos_penalidade WHERE nome_penalidade = $22),
                    $23::uuid, $24::uuid, $25::uuid,
                    coalesce($26, false), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )"#))
            .bind(proc_id).bind(&r.numero).bind(&r.tipo_geral).bind(&r.tipo_detalhe)
            .bind(&r.documento_iniciador).bind(r.local_origem.as_deref()).bind(&r.local_fatos)
            .bind(r.processo_sei.as_deref()).bind(r.responsavel_id.as_deref())
            .bind(r.data_instauracao).bind(r.data_recebimento)
            .bind(r.numero_rgf.as_deref()).bind(r.resumo_fatos.as_deref())
            .bind(r.solucao_tipo.as_deref()).bind(r.natureza_processo.as_deref())
            .bind(r.solucao_final.as_deref()).bind(r.numero_portaria.as_deref())
            .bind(r.data_conclusao).bind(r.data_remessa_comissao)
            .bind(r.data_julgamento).bind(penalidade_dias).bind(penalidade_tipo)
            .bind(r.presidente_id.as_deref()).bind(r.interrogante_id.as_deref())
            .bind(r.escrivao_processo_id.as_deref()).bind(r.concluido)
            .execute(&mut **tx).await?;
        }
        other => return Err(AppError::Domain(format!("tipo_detalhe nao suportado: {other}"))),
    }

    Ok(())
}

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
    nome_vitima: Option<String>,
    natureza_processo: Option<String>,
    resumo_fatos: Option<String>,
    numero_portaria: Option<String>,
    numero_memorando: Option<String>,
    numero_feito: Option<String>,
    numero_rgf: Option<String>,
    concluido: Option<bool>,
    data_conclusao: Option<NaiveDate>,
    solucao_final: Option<String>,
    data_remessa_encarregado: Option<NaiveDate>,
    data_remessa_comissao: Option<NaiveDate>,
    data_julgamento: Option<NaiveDate>,
    solucao_tipo: Option<String>,
    penalidade_tipo: Option<String>,
    penalidade_dias: Option<i32>,
    presidente_id: Option<String>,
    interrogante_id: Option<String>,
    escrivao_processo_id: Option<String>,
    unidade_deprecada: Option<String>,
    deprecante: Option<String>,
    indicios_categorias: Option<String>,
    historico_encarregados: Option<String>,
    pdf_nome: Option<String>,
    pdf_tamanho: Option<i64>,
    responsavel_nome: Option<String>,
    responsavel_posto: Option<String>,
    responsavel_matricula: Option<String>,
    escrivao_nome: Option<String>,
    presidente_nome: Option<String>,
    interrogante_nome: Option<String>,
    escrivao_processo_nome: Option<String>,
}

#[derive(sqlx::FromRow)]
struct PmRow {
    id: String,
    pm_id: String,
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
            p.id::text, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador,
            p.processo_sei,
            p.responsavel_id::text AS responsavel_id,
            p.local_origem, p.local_fatos, p.data_instauracao, p.data_recebimento,
            p.escrivao_id::text AS escrivao_id,
            p.nome_vitima, p.natureza_processo, p.resumo_fatos,
            p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf,
            p.concluido, p.data_conclusao, p.solucao_final,
            p.data_remessa_encarregado, p.data_remessa_comissao, p.data_julgamento,
            p.solucao_tipo, p.penalidade_tipo, p.penalidade_dias,
            p.presidente_id::text AS presidente_id,
            p.interrogante_id::text AS interrogante_id,
            p.escrivao_processo_id::text AS escrivao_processo_id,
            p.unidade_deprecada, p.deprecante,
            p.indicios_categorias::text AS indicios_categorias,
            p.historico_encarregados::text AS historico_encarregados,
            p.pdf_nome, p.pdf_tamanho,
            u_resp.nome             AS responsavel_nome,
            pg_resp.codigo          AS responsavel_posto,
            u_resp.matricula        AS responsavel_matricula,
            u_esc.nome              AS escrivao_nome,
            u_pres.nome             AS presidente_nome,
            u_int.nome              AS interrogante_nome,
            u_escrp.nome            AS escrivao_processo_nome
        FROM v_processos p
        LEFT JOIN usuarios u_resp    ON p.responsavel_id      = u_resp.id
        LEFT JOIN postos_graduacoes pg_resp ON pg_resp.id     = u_resp.posto_graduacao_id
        LEFT JOIN usuarios u_esc     ON p.escrivao_id         = u_esc.id
        LEFT JOIN usuarios u_pres    ON p.presidente_id       = u_pres.id
        LEFT JOIN usuarios u_int     ON p.interrogante_id     = u_int.id
        LEFT JOIN usuarios u_escrp   ON p.escrivao_processo_id = u_escrp.id
        WHERE p.id = $1::uuid AND coalesce(p.ativo, true) = true
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
        SELECT pe.id::text AS id, pe.pm_id::text AS pm_id,
               se.codigo AS status_pm,
               u.nome, pg.codigo AS posto_graduacao, u.matricula
        FROM procedimento_pms_envolvidos pe
        LEFT JOIN usuarios u ON pe.pm_id = u.id
        LEFT JOIN postos_graduacoes pg ON pg.id = u.posto_graduacao_id
        LEFT JOIN status_envolvido se ON se.id = pe.status_pm_id
        WHERE pe.procedimento_id = $1::uuid
        ORDER BY pe.ordem NULLS LAST
        "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let prazo_ativo = sqlx::query_as::<_, DeadlineRow>(
        r#"
        SELECT pr.id::text AS id, tp.codigo AS tipo_prazo,
               pr.data_inicio, pr.data_vencimento, pr.dias_adicionados
        FROM prazos_processo pr
        JOIN tipos_prazo tp ON tp.id = pr.tipo_prazo_id
        WHERE pr.processo_id = $1::uuid AND coalesce(pr.ativo, true) = true
        ORDER BY pr.created_at DESC NULLS LAST
        LIMIT 1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    let andamentos: Vec<serde_json::Value> = sqlx::query_as::<_, (String, String, NaiveDate)>(
        r#"SELECT id::text, descricao_andamento, created_at::date
           FROM andamentos_processo_procedimentos
           WHERE processo_procedimento_id = $1::uuid AND coalesce(ativo, true) = true
           ORDER BY created_at DESC"#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|(aid, texto, data)| serde_json::json!({
        "id": aid,
        "texto": texto,
        "data": data.format("%Y-%m-%d").to_string(),
    }))
    .collect();

    let historico_encarregados: Vec<serde_json::Value> = row
        .historico_encarregados
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let indicios_categorias: Option<serde_json::Value> = row
        .indicios_categorias
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());

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
        nome_vitima: row.nome_vitima,
        natureza_processo: row.natureza_processo,
        resumo_fatos: row.resumo_fatos,
        numero_portaria: row.numero_portaria,
        numero_memorando: row.numero_memorando,
        numero_feito: row.numero_feito,
        numero_rgf: row.numero_rgf,
        concluido: row.concluido,
        data_conclusao: row.data_conclusao,
        solucao_final: row.solucao_final,
        data_remessa_encarregado: row.data_remessa_encarregado,
        data_remessa_comissao: row.data_remessa_comissao,
        data_julgamento: row.data_julgamento,
        solucao_tipo: row.solucao_tipo,
        penalidade_tipo: row.penalidade_tipo,
        penalidade_dias: row.penalidade_dias,
        presidente_id: row.presidente_id,
        interrogante_id: row.interrogante_id,
        escrivao_processo_id: row.escrivao_processo_id,
        unidade_deprecada: row.unidade_deprecada,
        deprecante: row.deprecante,
        indicios_categorias,
        responsavel_nome: row.responsavel_nome,
        responsavel_posto: row.responsavel_posto,
        responsavel_matricula: row.responsavel_matricula,
        escrivao_nome: row.escrivao_nome,
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
    let tipo = get_tipo_detalhe(&mut **tx, &request.id).await?;
    let table = tipo_to_table(&tipo)?;

    let nome_vitima = request.nome_vitima.as_deref().map(|s| s.trim().to_uppercase());
    let punido = request.solucao_tipo.as_deref() == Some("Punido");
    let penalidade_tipo = if punido { request.penalidade_tipo.as_deref() } else { None };
    let penalidade_dias = if punido { request.penalidade_dias } else { None };

    match tipo.as_str() {
        "SR" | "SV" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    nome_vitima = $16, numero_portaria = $17, data_conclusao = $18,
                    data_remessa_encarregado = $19,
                    concluido = coalesce($20, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(nome_vitima.as_deref())
            .bind(request.numero_portaria.as_deref()).bind(request.data_conclusao)
            .bind(request.data_remessa_encarregado).bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        "IPM" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    escrivao_id = $16::uuid,
                    nome_vitima = $17, numero_portaria = $18, data_conclusao = $19,
                    data_remessa_encarregado = $20,
                    concluido = coalesce($21, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(request.escrivao_id.as_deref())
            .bind(nome_vitima.as_deref()).bind(request.numero_portaria.as_deref())
            .bind(request.data_conclusao).bind(request.data_remessa_encarregado)
            .bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        "FP" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    nome_vitima = $16, numero_feito = $17, data_conclusao = $18,
                    data_remessa_encarregado = $19,
                    concluido = coalesce($20, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(nome_vitima.as_deref())
            .bind(request.numero_feito.as_deref()).bind(request.data_conclusao)
            .bind(request.data_remessa_encarregado).bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        "CP" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    nome_vitima = $16, numero_portaria = $17, data_remessa_encarregado = $18,
                    unidade_deprecada = $19, deprecante = $20,
                    concluido = coalesce($21, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(nome_vitima.as_deref())
            .bind(request.numero_portaria.as_deref()).bind(request.data_remessa_encarregado)
            .bind(request.unidade_deprecada.as_deref()).bind(request.deprecante.as_deref())
            .bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        "PADS" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    numero_memorando = $16, data_conclusao = $17, data_remessa_encarregado = $18,
                    data_julgamento = $19, penalidade_dias = $20,
                    penalidade_tipo_id = (SELECT id FROM tipos_penalidade WHERE nome_penalidade = $21),
                    concluido = coalesce($22, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(request.numero_memorando.as_deref())
            .bind(request.data_conclusao).bind(request.data_remessa_encarregado)
            .bind(request.data_julgamento).bind(penalidade_dias).bind(penalidade_tipo)
            .bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        "PADE" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    numero_portaria = $16, data_conclusao = $17, data_remessa_encarregado = $18,
                    data_julgamento = $19,
                    penalidade_tipo_id = (SELECT id FROM tipos_penalidade WHERE nome_penalidade = $20),
                    concluido = coalesce($21, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(request.numero_portaria.as_deref())
            .bind(request.data_conclusao).bind(request.data_remessa_encarregado)
            .bind(request.data_julgamento).bind(penalidade_tipo)
            .bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        "PAD" | "CD" | "CJ" => {
            sqlx::query(&format!(r#"
                UPDATE {table} SET
                    numero = $2, tipo_geral = $3,
                    documento_iniciador_id = (SELECT id FROM tipos_documentos WHERE nome_tipo_documento = $4),
                    local_origem_id = (SELECT id FROM locais_origem WHERE nome_unidade_pm = $5),
                    local_fatos_id = (SELECT id FROM municipios_distritos WHERE nome_municipio_distrito = $6),
                    processo_sei = $7, responsavel_id = $8::uuid,
                    data_instauracao = $9, data_recebimento = $10,
                    numero_rgf = $11, resumo_fatos = $12,
                    solucao_tipo_id = (SELECT id FROM solucoes_tipo WHERE codigo = $13),
                    natureza_processo_id = (SELECT id FROM natureza_transgressao WHERE codigo = $14),
                    solucao_final = $15,
                    numero_portaria = $16, data_conclusao = $17, data_remessa_comissao = $18,
                    data_julgamento = $19, penalidade_dias = $20,
                    penalidade_tipo_id = (SELECT id FROM tipos_penalidade WHERE nome_penalidade = $21),
                    presidente_id = $22::uuid, interrogante_id = $23::uuid,
                    escrivao_processo_id = $24::uuid,
                    concluido = coalesce($25, false), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1::uuid AND coalesce(ativo, true) = true
            "#))
            .bind(&request.id).bind(&request.numero).bind(&request.tipo_geral)
            .bind(&request.documento_iniciador).bind(request.local_origem.as_deref())
            .bind(&request.local_fatos).bind(request.processo_sei.as_deref())
            .bind(request.responsavel_id.as_deref())
            .bind(request.data_instauracao).bind(request.data_recebimento)
            .bind(request.numero_rgf.as_deref()).bind(request.resumo_fatos.as_deref())
            .bind(request.solucao_tipo.as_deref()).bind(request.natureza_processo.as_deref())
            .bind(request.solucao_final.as_deref()).bind(request.numero_portaria.as_deref())
            .bind(request.data_conclusao).bind(request.data_remessa_comissao)
            .bind(request.data_julgamento).bind(penalidade_dias).bind(penalidade_tipo)
            .bind(request.presidente_id.as_deref()).bind(request.interrogante_id.as_deref())
            .bind(request.escrivao_processo_id.as_deref()).bind(request.concluido)
            .execute(&mut **tx).await?;
        }
        other => return Err(AppError::Domain(format!("tipo_detalhe nao suportado: {other}"))),
    }

    if let Some(pms) = &request.pms_envolvidos {
        sqlx::query("DELETE FROM procedimento_pms_envolvidos WHERE procedimento_id = $1::uuid")
            .bind(&request.id)
            .execute(&mut **tx)
            .await?;
        for pm_id in pms {
            sqlx::query(
                "INSERT INTO procedimento_pms_envolvidos (procedimento_id, pm_id) VALUES ($1::uuid, $2::uuid)",
            )
            .bind(&request.id)
            .bind(pm_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

pub async fn delete(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), AppError> {
    let tipo = get_tipo_detalhe(&mut **tx, id).await?;
    let table = tipo_to_table(&tipo)?;
    sqlx::query(&format!(
        "UPDATE {table} SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid"
    ))
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn reopen(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), AppError> {
    let tipo = get_tipo_detalhe(&mut **tx, id).await?;
    let table = tipo_to_table(&tipo)?;
    sqlx::query(&format!(
        "UPDATE {table} SET concluido = false, data_conclusao = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid AND coalesce(ativo, true) = true"
    ))
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
    let data_vencimento = data_inicio + chrono::Duration::days(dias as i64);
    sqlx::query(
        r#"
        INSERT INTO prazos_processo (
            processo_id, tipo_prazo_id, data_inicio, data_vencimento,
            dias_adicionados, ativo, created_at
        )
        VALUES (
            $1::uuid,
            (SELECT id FROM tipos_prazo WHERE codigo = 'inicial'),
            $2, $3, $4, true, CURRENT_TIMESTAMP
        )
        "#,
    )
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
) -> Result<(), AppError> {
    let tipo = get_tipo_detalhe(&mut **tx, processo_id).await?;
    let table = tipo_to_table(&tipo)?;
    sqlx::query(&format!(
        r#"UPDATE {table}
           SET pdf_arquivo = $2, pdf_nome = $3, pdf_content_type = $4,
               pdf_tamanho = $5, pdf_upload_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid AND coalesce(ativo, true) = true"#
    ))
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
            "SELECT pdf_nome, pdf_content_type, pdf_tamanho, pdf_upload_em, pdf_arquivo FROM v_processos WHERE id = $1::uuid AND coalesce(ativo, true) = true",
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
                conteudo: r.pdf_arquivo.map(|b| base64::engine::general_purpose::STANDARD.encode(b)),
            }
        }))
    } else {
        let row = sqlx::query_as::<_, PdfRowMeta>(
            "SELECT pdf_nome, pdf_content_type, pdf_tamanho, pdf_upload_em FROM v_processos WHERE id = $1::uuid AND coalesce(ativo, true) = true",
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
) -> Result<(), AppError> {
    let tipo = get_tipo_detalhe(&mut **tx, processo_id).await?;
    let table = tipo_to_table(&tipo)?;
    sqlx::query(&format!(
        r#"UPDATE {table}
           SET pdf_arquivo = NULL, pdf_nome = NULL, pdf_content_type = NULL,
               pdf_tamanho = NULL, pdf_upload_em = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid AND coalesce(ativo, true) = true"#
    ))
    .bind(processo_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn substitute_responsible(
    tx: &mut Transaction<'_, Postgres>,
    req: &SubstituteResponsibleRequest,
) -> Result<(), AppError> {
    let tipo = get_tipo_detalhe(&mut **tx, &req.id).await?;
    let table = tipo_to_table(&tipo)?;

    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(&format!(
        r#"SELECT t.responsavel_id::text, u.nome
           FROM {table} t
           LEFT JOIN usuarios u ON u.id = t.responsavel_id
           WHERE t.id = $1::uuid AND coalesce(t.ativo, true) = true"#
    ))
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

    sqlx::query(&format!(
        r#"UPDATE {table}
           SET responsavel_id = $2::uuid,
               historico_encarregados = coalesce(historico_encarregados, '[]'::jsonb)
                                        || jsonb_build_array($3::jsonb),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid AND coalesce(ativo, true) = true"#
    ))
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
        FROM v_processos
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
        JOIN v_processos p ON p.id = ppe.procedimento_id
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
            CASE WHEN ti.codigo = 'Crime' THEN 'Crime Comum' ELSE 'Contravenção Penal' END AS classificacao,
            COUNT(pec.id)::bigint AS quantidade
        FROM v_processos p
        JOIN pm_envolvido_indicios pei ON pei.procedimento_id = p.id
        JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
        JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
        LEFT JOIN tipos_infracao_penal ti ON ti.id = cc.tipo_id
        WHERE coalesce(p.ativo, true) = true
          AND p.tipo_detalhe IN ('IPM', 'IPPM', 'SR')
          AND cc.dispositivo_legal IN ('Código Penal', 'Lei de Contravenções Penais')
          AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
        GROUP BY cc.artigo, cc.descricao_artigo, cc.dispositivo_legal, ti.codigo
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
        FROM v_processos p
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
        FROM v_processos p
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
        FROM v_processos p
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
        JOIN v_processos p ON p.id = ppe.procedimento_id
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
                   CASE nt.codigo WHEN 'leve' THEN '15' WHEN 'media' THEN '16' WHEN 'grave' THEN '17' ELSE '?' END
                   || ', Inc. ' || coalesce(t.inciso, '') AS artigo_label,
                   LEFT(t.texto, 50) AS descricao_curta,
                   COUNT(*)::bigint AS quantidade
            FROM pm_envolvido_rdpm r
            JOIN pm_envolvido_indicios i ON r.pm_indicios_id = i.id
            JOIN v_processos p ON i.procedimento_id = p.id
            JOIN transgressoes t ON r.transgressao_id = t.id
            JOIN natureza_transgressao nt ON nt.id = t.gravidade_id
            WHERE coalesce(p.ativo, true) = true
              AND p.tipo_detalhe IN ('IPM', 'IPPM', 'SR')
              AND coalesce(p.concluido, false) = true
              AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1)
            GROUP BY t.id, t.inciso, nt.codigo, t.texto
        ),
        art29_counts AS (
            SELECT a.id::text AS transgressao_id,
                   'Art. 29, Inc. ' || coalesce(a.inciso, '') AS artigo_label,
                   LEFT(a.texto, 50) AS descricao_curta,
                   COUNT(*)::bigint AS quantidade
            FROM pm_envolvido_art29 pa
            JOIN pm_envolvido_indicios i ON pa.pm_indicios_id = i.id
            JOIN v_processos p ON i.procedimento_id = p.id
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
    _pool: &PgPool,
    _ano: Option<i32>,
) -> Result<Vec<DriverRankingItem>, sqlx::Error> {
    Ok(vec![])
}

pub async fn nature_stats(
    _pool: &PgPool,
    _ano: Option<i32>,
) -> Result<Vec<NatureStatItem>, sqlx::Error> {
    Ok(vec![])
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
        FROM v_processos p
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
        FROM v_processos
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
        "SELECT COUNT(*)::bigint FROM v_processos WHERE coalesce(ativo, true) = true AND data_conclusao IS NOT NULL",
    )
    .fetch_one(pool)
    .await?;

    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM v_processos WHERE coalesce(ativo, true) = true",
    )
    .fetch_one(pool)
    .await?;

    Ok(InProgressStats { por_tipo, concluidos, total })
}
