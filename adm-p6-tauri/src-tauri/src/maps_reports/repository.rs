use chrono::NaiveDate;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use super::domain::{
    AnnualStatistics, CompleteMapResult, CsvExportRequest, CsvExportResult, DashboardSummary,
    GenerateCompleteMapRequest, GenerateMapRequest, MonthlyMapResult, PrazoVencidoItem,
    ResponsavelRelatorio, SaveMapRequest, SaveMapResult, SavedMapFull, SavedMapListItem,
    TipoProcessoItem, TipoRelatorio, TipoStatusCount,
};

// ── Internal row structs ─────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct ProcessoMapRow {
    id: String,
    numero: Option<String>,
    tipo_detalhe: Option<String>,
    numero_portaria: Option<String>,
    numero_memorando: Option<String>,
    numero_feito: Option<String>,
    numero_rgf: Option<String>,
    data_instauracao: Option<NaiveDate>,
    data_conclusao: Option<NaiveDate>,
    data_remessa_encarregado: Option<NaiveDate>,
    data_julgamento: Option<NaiveDate>,
    resumo_fatos: Option<String>,
    nome_vitima: Option<String>,
    concluido: Option<bool>,
    solucao_final: Option<String>,
    solucao_tipo: Option<String>,
    penalidade_tipo: Option<String>,
    penalidade_dias: Option<i32>,
    responsavel_nome: String,
    responsavel_posto: String,
    responsavel_matricula: String,
    status_processo: String,
    ano_instauracao: Option<String>,
    presidente_id: Option<String>,
    interrogante_id: Option<String>,
    escrivao_processo_id: Option<String>,
    presidente_nome: String,
    presidente_posto: String,
    presidente_matricula: String,
    interrogante_nome: String,
    interrogante_posto: String,
    interrogante_matricula: String,
    escrivao_processo_nome: String,
    escrivao_processo_posto: String,
    escrivao_processo_matricula: String,
    unidade_deprecada: Option<String>,
    deprecante: Option<String>,
    andamentos: Option<String>,
}

#[derive(sqlx::FromRow)]
struct PmMapRow {
    nome: Option<String>,
    posto_graduacao: Option<String>,
    matricula: Option<String>,
    tipo_envolvimento: Option<String>,
    pm_envolvido_id: String,
}

#[derive(sqlx::FromRow)]
struct IndiciosRow {
    id: String,
    categorias_indicios: Option<Value>,
}

#[derive(sqlx::FromRow)]
struct CrimeMapRow {
    tipo: Option<String>,
    dispositivo_legal: Option<String>,
    artigo: Option<String>,
    descricao_artigo: Option<String>,
    paragrafo: Option<String>,
    inciso: Option<String>,
    alinea: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RdpmMapRow {
    inciso: Option<String>,
    texto: Option<String>,
    gravidade: Option<String>,
}

#[derive(sqlx::FromRow)]
struct Art29MapRow {
    inciso: Option<String>,
    texto: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn mes_nome(mes: i32) -> &'static str {
    const NOMES: [&str; 13] = [
        "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    NOMES.get(mes as usize).copied().unwrap_or("")
}

fn rdpm_artigo(gravidade: &str) -> &'static str {
    match gravidade.to_lowercase().trim() {
        "leve" => "15",
        "media" | "média" => "16",
        "grave" => "17",
        _ => "15",
    }
}

fn user_completo(posto: &str, matricula: &str, nome: &str) -> String {
    format!("{posto} {matricula} {nome}").split_whitespace().collect::<Vec<_>>().join(" ")
}

fn last_movement(andamentos_text: &Option<String>) -> Option<Value> {
    let text = andamentos_text.as_deref()?;
    let arr: Vec<Value> = serde_json::from_str(text).ok()?;
    let first = arr.into_iter().next()?;
    let data = first
        .get("data")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_string();
    let texto = first
        .get("texto")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Some(json!({"data": data, "tipo": "outro", "descricao": texto, "destino": null}))
}

// ── Per-PM indícios ──────────────────────────────────────────────────────────

async fn indicios_for_pm(pool: &PgPool, pm_envolvido_id: &str) -> Result<Value, sqlx::Error> {
    let row: Option<IndiciosRow> = sqlx::query_as(
        "SELECT id::text AS id, categorias_indicios \
         FROM pm_envolvido_indicios \
         WHERE pm_envolvido_id = $1::uuid AND coalesce(ativo, true) = true \
         LIMIT 1",
    )
    .bind(pm_envolvido_id)
    .fetch_optional(pool)
    .await?;

    let Some(indicios) = row else {
        return Ok(json!({"categorias": [], "crimes": [], "transgressoes": [], "art29": []}));
    };

    let categorias: Vec<String> = indicios
        .categorias_indicios
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let crimes: Vec<CrimeMapRow> = sqlx::query_as(
        "SELECT ti.codigo AS tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo, \
                c.paragrafo, c.inciso, c.alinea \
         FROM pm_envolvido_crimes pec \
         JOIN crimes_contravencoes c ON c.id = pec.crime_id \
         LEFT JOIN tipos_infracao_penal ti ON ti.id = c.tipo_id \
         WHERE pec.pm_indicios_id = $1::uuid AND coalesce(c.ativo, true) = true",
    )
    .bind(&indicios.id)
    .fetch_all(pool)
    .await?;

    let rdpm: Vec<RdpmMapRow> = sqlx::query_as(
        "SELECT t.inciso, t.texto, nt.codigo AS gravidade \
         FROM pm_envolvido_rdpm per \
         JOIN transgressoes t ON t.id = per.transgressao_id \
         JOIN natureza_transgressao nt ON nt.id = t.gravidade_id \
         WHERE per.pm_indicios_id = $1::uuid AND coalesce(t.ativo, true) = true",
    )
    .bind(&indicios.id)
    .fetch_all(pool)
    .await?;

    let art29: Vec<Art29MapRow> = sqlx::query_as(
        "SELECT a.inciso, a.texto \
         FROM pm_envolvido_art29 pea \
         JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id \
         WHERE pea.pm_indicios_id = $1::uuid AND coalesce(a.ativo, true) = true",
    )
    .bind(&indicios.id)
    .fetch_all(pool)
    .await?;

    let crimes_json: Vec<Value> = crimes
        .iter()
        .map(|c| {
            let disp = c.dispositivo_legal.as_deref().unwrap_or("");
            let art = c.artigo.as_deref().unwrap_or("");
            let desc = c.descricao_artigo.as_deref().unwrap_or("");
            json!({
                "tipo": c.tipo,
                "dispositivo": disp,
                "artigo": art,
                "descricao": desc,
                "paragrafo": c.paragrafo,
                "inciso": c.inciso,
                "alinea": c.alinea,
                "texto_completo": format!("{disp} - Art. {art}, {desc}"),
            })
        })
        .collect();

    let trans_json: Vec<Value> = rdpm
        .iter()
        .map(|t| {
            let inciso = t.inciso.as_deref().unwrap_or("");
            let texto = t.texto.as_deref().unwrap_or("");
            let grav = t.gravidade.as_deref().unwrap_or("");
            let artigo = rdpm_artigo(grav);
            json!({
                "inciso": inciso,
                "texto": texto,
                "gravidade": grav,
                "artigo": artigo,
                "tipo": "rdpm",
                "texto_completo": format!("Inciso {inciso}, do RDPM - {texto} (art. {artigo} - {grav})"),
            })
        })
        .collect();

    let art29_json: Vec<Value> = art29
        .iter()
        .map(|a| {
            let inciso = a.inciso.as_deref().unwrap_or("");
            let texto = a.texto.as_deref().unwrap_or("");
            json!({
                "inciso": inciso,
                "texto": texto,
                "texto_completo": format!("Art. 29, Inciso {inciso}, do Decreto Lei 09A/1982 - {texto}"),
            })
        })
        .collect();

    Ok(json!({
        "categorias": categorias,
        "crimes": crimes_json,
        "transgressoes": trans_json,
        "art29": art29_json,
    }))
}

// ── PMs for map ───────────────────────────────────────────────────────────────

async fn pms_for_procedimento(pool: &PgPool, processo_id: &str) -> Result<Vec<Value>, sqlx::Error> {
    let rows: Vec<PmMapRow> = sqlx::query_as(
        "SELECT u.nome, pg.codigo AS posto_graduacao, u.matricula, \
                se.codigo AS tipo_envolvimento, pme.id::text AS pm_envolvido_id \
         FROM procedimento_pms_envolvidos pme \
         JOIN usuarios u ON pme.pm_id = u.id \
         JOIN postos_graduacoes pg ON u.posto_graduacao_id = pg.id \
         LEFT JOIN status_envolvido se ON pme.status_pm_id = se.id \
         WHERE pme.processo_id = $1::uuid \
         ORDER BY pme.ordem",
    )
    .bind(processo_id)
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(rows.len());
    for pm in rows {
        let nome = pm.nome.as_deref().unwrap_or("");
        let posto = pm.posto_graduacao.as_deref().unwrap_or("");
        let matricula = pm.matricula.as_deref().unwrap_or("");
        let indicios = indicios_for_pm(pool, &pm.pm_envolvido_id).await?;
        result.push(json!({
            "nome": nome,
            "posto_graduacao": posto,
            "matricula": matricula,
            "tipo_envolvimento": pm.tipo_envolvimento.as_deref().unwrap_or("Envolvido"),
            "completo": user_completo(posto, matricula, nome),
            "indicios": indicios,
        }));
    }
    Ok(result)
}

// ── Monthly map query ─────────────────────────────────────────────────────────

const MONTHLY_MAP_QUERY: &str = r#"
SELECT
    p.id::text AS id, p.numero, p.tipo_geral, p.tipo_detalhe,
    p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf,
    p.data_instauracao, p.data_conclusao, p.data_remessa_encarregado, p.data_julgamento,
    p.resumo_fatos, p.nome_vitima, p.concluido, p.solucao_final, p.solucao_tipo,
    p.penalidade_tipo, p.penalidade_dias,
    COALESCE(u_resp.nome, 'Não informado')  AS responsavel_nome,
    COALESCE(pg_resp.codigo, '')            AS responsavel_posto,
    COALESCE(u_resp.matricula, '')          AS responsavel_matricula,
    CASE WHEN p.concluido = TRUE THEN 'Concluído' ELSE 'Em andamento' END AS status_processo,
    p.ano_instauracao,
    p.presidente_id::text       AS presidente_id,
    p.interrogante_id::text     AS interrogante_id,
    p.escrivao_processo_id::text AS escrivao_processo_id,
    COALESCE(u_pres.nome, '')        AS presidente_nome,
    COALESCE(pg_pres.codigo, '')     AS presidente_posto,
    COALESCE(u_pres.matricula, '')   AS presidente_matricula,
    COALESCE(u_inter.nome, '')       AS interrogante_nome,
    COALESCE(pg_inter.codigo, '')    AS interrogante_posto,
    COALESCE(u_inter.matricula, '')  AS interrogante_matricula,
    COALESCE(u_esc.nome, '')         AS escrivao_processo_nome,
    COALESCE(pg_esc.codigo, '')      AS escrivao_processo_posto,
    COALESCE(u_esc.matricula, '')    AS escrivao_processo_matricula,
    p.unidade_deprecada, p.deprecante,
    p.andamentos::text AS andamentos
FROM v_processos p
LEFT JOIN usuarios u_resp    ON p.responsavel_id        = u_resp.id
LEFT JOIN postos_graduacoes pg_resp  ON u_resp.posto_graduacao_id  = pg_resp.id
LEFT JOIN usuarios u_pres    ON p.presidente_id         = u_pres.id
LEFT JOIN postos_graduacoes pg_pres  ON u_pres.posto_graduacao_id  = pg_pres.id
LEFT JOIN usuarios u_inter   ON p.interrogante_id       = u_inter.id
LEFT JOIN postos_graduacoes pg_inter ON u_inter.posto_graduacao_id = pg_inter.id
LEFT JOIN usuarios u_esc     ON p.escrivao_processo_id  = u_esc.id
LEFT JOIN postos_graduacoes pg_esc   ON u_esc.posto_graduacao_id   = pg_esc.id
WHERE coalesce(p.ativo, true) = true
  AND p.tipo_detalhe = $1
  AND (
    (coalesce(p.concluido, false) = false AND p.data_instauracao < $2)
    OR
    (p.concluido = true AND p.data_conclusao >= $3 AND p.data_conclusao < $2)
  )
ORDER BY p.data_instauracao DESC, p.created_at DESC
"#;

// ── Public functions ──────────────────────────────────────────────────────────

pub async fn dashboard_summary(pool: &PgPool) -> Result<DashboardSummary, sqlx::Error> {
    sqlx::query_as::<_, DashboardSummary>(
        r#"
        SELECT
          (SELECT count(*)::bigint FROM v_processos WHERE coalesce(ativo, true) = true)                                        AS total_processos,
          (SELECT count(*)::bigint FROM v_processos WHERE coalesce(ativo, true) = true AND coalesce(concluido, false) = false) AS em_andamento,
          (SELECT count(*)::bigint FROM v_processos WHERE coalesce(ativo, true) = true AND coalesce(concluido, false) = true)  AS concluidos,
          (SELECT count(*)::bigint FROM prazos_processo WHERE coalesce(ativo, true) = true AND data_vencimento < CURRENT_DATE) AS prazos_vencidos
        "#,
    )
    .fetch_one(pool)
    .await
}

pub async fn saved_maps(pool: &PgPool, limit: i64) -> Result<Vec<SavedMapListItem>, sqlx::Error> {
    sqlx::query_as::<_, SavedMapListItem>(
        r#"
        SELECT id, titulo, tipo_processo, periodo_descricao,
               total_processos, total_concluidos, total_andamento,
               usuario_nome, data_geracao, nome_arquivo
        FROM mapas_salvos
        WHERE coalesce(ativo, true) = true
        ORDER BY data_geracao DESC NULLS LAST
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn process_types(pool: &PgPool) -> Result<Vec<TipoProcessoItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoProcessoItem>(
        r#"
        SELECT tipo_detalhe AS codigo, count(*)::bigint AS total
        FROM v_processos
        WHERE coalesce(ativo, true) = true
        GROUP BY tipo_detalhe
        ORDER BY tipo_detalhe
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn generate_monthly_map(
    pool: &PgPool,
    req: &GenerateMapRequest,
) -> Result<MonthlyMapResult, sqlx::Error> {
    let data_inicio = NaiveDate::from_ymd_opt(req.ano, req.mes as u32, 1)
        .unwrap_or_default();
    let data_fim = NaiveDate::from_ymd_opt(
        if req.mes == 12 { req.ano + 1 } else { req.ano },
        if req.mes == 12 { 1 } else { (req.mes + 1) as u32 },
        1,
    )
    .unwrap_or_default();

    let rows: Vec<ProcessoMapRow> = sqlx::query_as::<_, ProcessoMapRow>(MONTHLY_MAP_QUERY)
        .bind(&req.tipo_processo)
        .bind(data_fim)
        .bind(data_inicio)
        .fetch_all(pool)
        .await?;

    let mut dados = Vec::with_capacity(rows.len());
    for row in &rows {
        let pms = pms_for_procedimento(pool, &row.id).await?;

        let mut all_crimes: Vec<Value> = Vec::new();
        let mut all_trans: Vec<Value> = Vec::new();
        let mut all_art29: Vec<Value> = Vec::new();
        for pm in &pms {
            if let Some(ind) = pm.get("indicios") {
                if let Some(arr) = ind.get("crimes").and_then(|v| v.as_array()) {
                    all_crimes.extend(arr.iter().cloned());
                }
                if let Some(arr) = ind.get("transgressoes").and_then(|v| v.as_array()) {
                    all_trans.extend(arr.iter().cloned());
                }
                if let Some(arr) = ind.get("art29").and_then(|v| v.as_array()) {
                    all_art29.extend(arr.iter().cloned());
                }
            }
        }

        let concluido = row.concluido.unwrap_or(false);
        let ultima_mov = if !concluido { last_movement(&row.andamentos) } else { None };

        let ano_val = row
            .ano_instauracao
            .clone()
            .or_else(|| row.data_instauracao.map(|d| d.format("%Y").to_string()))
            .unwrap_or_default();

        let tipo_detalhe = row.tipo_detalhe.as_deref().unwrap_or("");

        let mut processo_json = json!({
            "id": row.id,
            "numero": row.numero,
            "ano": ano_val,
            "numero_portaria": row.numero_portaria,
            "numero_memorando": row.numero_memorando,
            "numero_feito": row.numero_feito,
            "numero_rgf": row.numero_rgf,
            "data_instauracao": row.data_instauracao.map(|d| d.to_string()),
            "data_conclusao": row.data_conclusao.map(|d| d.to_string()),
            "resumo_fatos": row.resumo_fatos,
            "nome_vitima": row.nome_vitima,
            "status": row.status_processo,
            "concluido": concluido,
            "responsavel": {
                "nome": row.responsavel_nome,
                "posto": row.responsavel_posto,
                "matricula": row.responsavel_matricula,
                "completo": user_completo(&row.responsavel_posto, &row.responsavel_matricula, &row.responsavel_nome),
            },
            "pms_envolvidos": pms,
            "indicios": {
                "crimes": all_crimes,
                "transgressoes": all_trans,
                "art29": all_art29,
            },
            "solucao": {
                "data_remessa": row.data_remessa_encarregado.map(|d| d.to_string()),
                "data_julgamento": row.data_julgamento.map(|d| d.to_string()),
                "solucao_final": row.solucao_final,
                "solucao_tipo": row.solucao_tipo,
                "penalidade_tipo": row.penalidade_tipo,
                "penalidade_dias": row.penalidade_dias,
            },
            "ultima_movimentacao": ultima_mov,
        });

        if ["PAD", "CD", "CJ"].contains(&tipo_detalhe) {
            processo_json["presidente_processo"] = if row.presidente_id.is_some() {
                json!({
                    "nome": row.presidente_nome,
                    "posto": row.presidente_posto,
                    "matricula": row.presidente_matricula,
                    "completo": user_completo(&row.presidente_posto, &row.presidente_matricula, &row.presidente_nome),
                })
            } else {
                Value::Null
            };
            processo_json["interrogante_processo"] = if row.interrogante_id.is_some() {
                json!({
                    "nome": row.interrogante_nome,
                    "posto": row.interrogante_posto,
                    "matricula": row.interrogante_matricula,
                    "completo": user_completo(&row.interrogante_posto, &row.interrogante_matricula, &row.interrogante_nome),
                })
            } else {
                Value::Null
            };
            processo_json["escrivao_processo"] = if row.escrivao_processo_id.is_some() {
                json!({
                    "nome": row.escrivao_processo_nome,
                    "posto": row.escrivao_processo_posto,
                    "matricula": row.escrivao_processo_matricula,
                    "completo": user_completo(&row.escrivao_processo_posto, &row.escrivao_processo_matricula, &row.escrivao_processo_nome),
                })
            } else {
                Value::Null
            };
        }

        if tipo_detalhe == "CP" {
            processo_json["unidade_deprecada"] = json!(row.unidade_deprecada);
            processo_json["deprecante"] = json!(row.deprecante);
        }

        dados.push(processo_json);
    }

    let total_concluidos = dados
        .iter()
        .filter(|p| p["concluido"].as_bool().unwrap_or(false))
        .count() as i64;
    let total_andamento = dados.len() as i64 - total_concluidos;

    let meta = json!({
        "mes": req.mes,
        "ano": req.ano,
        "mes_nome": mes_nome(req.mes),
        "tipo_processo": req.tipo_processo,
        "total_processos": dados.len() as i64,
        "total_concluidos": total_concluidos,
        "total_andamento": total_andamento,
    });

    Ok(MonthlyMapResult { dados, meta })
}

pub async fn generate_complete_map(
    pool: &PgPool,
    req: &GenerateCompleteMapRequest,
) -> Result<CompleteMapResult, sqlx::Error> {
    let tipos: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT tipo_detalhe FROM v_processos \
         WHERE coalesce(ativo, true) = true ORDER BY tipo_detalhe",
    )
    .fetch_all(pool)
    .await?;

    let mut dados: HashMap<String, Value> = HashMap::new();
    let mut total_geral = 0i64;
    let mut total_concluidos = 0i64;
    let mut total_andamento = 0i64;

    for (tipo,) in tipos {
        let result = generate_monthly_map(
            pool,
            &GenerateMapRequest {
                mes: req.mes,
                ano: req.ano,
                tipo_processo: tipo.clone(),
            },
        )
        .await?;

        if !result.dados.is_empty() {
            let tp = result.meta["total_processos"].as_i64().unwrap_or(0);
            let tc = result.meta["total_concluidos"].as_i64().unwrap_or(0);
            let ta = result.meta["total_andamento"].as_i64().unwrap_or(0);
            total_geral += tp;
            total_concluidos += tc;
            total_andamento += ta;
            dados.insert(
                tipo.clone(),
                json!({"nome_completo": tipo, "dados": result.dados, "meta": result.meta}),
            );
        }
    }

    let tipos_incluidos: Vec<&String> = dados.keys().collect();
    let meta = json!({
        "mes": req.mes,
        "ano": req.ano,
        "mes_nome": mes_nome(req.mes),
        "tipo_processo": "COMPLETO",
        "total_processos": total_geral,
        "total_concluidos": total_concluidos,
        "total_andamento": total_andamento,
        "tipos_incluidos": tipos_incluidos,
    });

    Ok(CompleteMapResult { dados, meta })
}

pub async fn save_map(
    pool: &PgPool,
    req: &SaveMapRequest,
    actor_id: &str,
    actor_nome: &str,
) -> Result<SaveMapResult, sqlx::Error> {
    let meta = &req.dados_mapa["meta"];
    let mes = meta["mes"].as_i64().unwrap_or(0) as i32;
    let ano = meta["ano"].as_i64().unwrap_or(0) as i32;
    let tipo_processo = meta["tipo_processo"].as_str().unwrap_or("").to_string();
    let mes_nome_str = mes_nome(mes).to_string();
    let total_processos = meta["total_processos"].as_i64().unwrap_or(0) as i32;
    let total_concluidos = meta["total_concluidos"].as_i64().unwrap_or(0) as i32;
    let total_andamento = meta["total_andamento"].as_i64().unwrap_or(0) as i32;

    let periodo_descricao = format!("{mes_nome_str}/{ano}");
    let titulo = format!("Mapa {tipo_processo} - {periodo_descricao}");
    let nome_arquivo = format!("Mapa_{tipo_processo}_{ano}_{mes:02}.pdf");

    let periodo_inicio =
        NaiveDate::from_ymd_opt(ano, mes as u32, 1).unwrap_or_default();
    let periodo_fim = NaiveDate::from_ymd_opt(
        if mes == 12 { ano + 1 } else { ano },
        if mes == 12 { 1 } else { (mes + 1) as u32 },
        1,
    )
    .unwrap_or_default();

    let mapa_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO mapas_salvos (
            id, titulo, tipo_processo, periodo_inicio, periodo_fim,
            periodo_descricao, total_processos, total_concluidos, total_andamento,
            usuario_id, usuario_nome, dados_mapa, nome_arquivo
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        "#,
    )
    .bind(&mapa_id)
    .bind(&titulo)
    .bind(&tipo_processo)
    .bind(periodo_inicio)
    .bind(periodo_fim)
    .bind(&periodo_descricao)
    .bind(total_processos)
    .bind(total_concluidos)
    .bind(total_andamento)
    .bind(actor_id)
    .bind(actor_nome)
    .bind(&req.dados_mapa)
    .bind(&nome_arquivo)
    .execute(pool)
    .await?;

    Ok(SaveMapResult { mapa_id })
}

pub async fn get_saved_map(pool: &PgPool, id: &str) -> Result<Option<SavedMapFull>, sqlx::Error> {
    sqlx::query_as::<_, SavedMapFull>(
        r#"
        SELECT id, titulo, tipo_processo, periodo_descricao,
               total_processos, total_concluidos, total_andamento,
               usuario_nome, data_geracao, nome_arquivo, dados_mapa
        FROM mapas_salvos
        WHERE id = $1 AND coalesce(ativo, true) = true
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_saved_map(pool: &PgPool, id: &str) -> Result<bool, sqlx::Error> {
    let r = sqlx::query(
        "UPDATE mapas_salvos SET ativo = false WHERE id = $1 AND coalesce(ativo, true) = true",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(r.rows_affected() > 0)
}

// ── Relatórios ───────────────────────────────────────────────────────────────

pub async fn annual_statistics(
    pool: &PgPool,
    ano: i32,
) -> Result<AnnualStatistics, sqlx::Error> {
    let ano_i64 = ano as i64;

    let (total_processos,): (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_geral = 'processo' AND coalesce(ativo, true) = true",
    )
    .bind(ano_i64)
    .fetch_one(pool)
    .await?;

    let (total_procedimentos,): (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_geral = 'procedimento' AND coalesce(ativo, true) = true",
    )
    .bind(ano_i64)
    .fetch_one(pool)
    .await?;

    let processos_por_tipo: Vec<TipoStatusCount> = sqlx::query_as(
        "SELECT tipo_detalhe, \
                count(*)::bigint as total, \
                count(*) FILTER (WHERE coalesce(concluido, false) = true)::bigint  as concluidos, \
                count(*) FILTER (WHERE coalesce(concluido, false) = false)::bigint as em_andamento \
         FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_geral = 'processo' AND coalesce(ativo, true) = true \
         GROUP BY tipo_detalhe ORDER BY tipo_detalhe",
    )
    .bind(ano_i64)
    .fetch_all(pool)
    .await?;

    let procedimentos_por_tipo: Vec<TipoStatusCount> = sqlx::query_as(
        "SELECT tipo_detalhe, \
                count(*)::bigint as total, \
                count(*) FILTER (WHERE coalesce(concluido, false) = true)::bigint  as concluidos, \
                count(*) FILTER (WHERE coalesce(concluido, false) = false)::bigint as em_andamento \
         FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_geral = 'procedimento' AND coalesce(ativo, true) = true \
         GROUP BY tipo_detalhe ORDER BY tipo_detalhe",
    )
    .bind(ano_i64)
    .fetch_all(pool)
    .await?;

    let (indicios_crime,): (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint \
         FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_detalhe IN ('IPM', 'SR', 'SV') \
           AND concluido = true \
           AND coalesce(ativo, true) = true \
           AND indicios_categorias IS NOT NULL \
           AND jsonb_typeof(indicios_categorias) = 'array' \
           AND EXISTS ( \
             SELECT 1 FROM jsonb_array_elements_text(indicios_categorias) AS e(val) \
             WHERE lower(val) LIKE '%crime%' \
           )",
    )
    .bind(ano_i64)
    .fetch_one(pool)
    .await?;

    let (indicios_transgressao,): (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint \
         FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_detalhe IN ('IPM', 'SR', 'SV') \
           AND concluido = true \
           AND coalesce(ativo, true) = true \
           AND indicios_categorias IS NOT NULL \
           AND jsonb_typeof(indicios_categorias) = 'array' \
           AND EXISTS ( \
             SELECT 1 FROM jsonb_array_elements_text(indicios_categorias) AS e(val) \
             WHERE lower(val) LIKE '%transgressao%' OR lower(val) LIKE '%rdpm%' \
           )",
    )
    .bind(ano_i64)
    .fetch_one(pool)
    .await?;

    let solucoes: Vec<(Option<String>, i64)> = sqlx::query_as(
        "SELECT solucao_tipo, count(*)::bigint \
         FROM v_processos \
         WHERE EXTRACT(YEAR FROM data_instauracao)::bigint = $1 \
           AND tipo_detalhe IN ('PAD', 'PADS') \
           AND concluido = true \
           AND coalesce(ativo, true) = true \
           AND solucao_tipo IS NOT NULL \
         GROUP BY solucao_tipo",
    )
    .bind(ano_i64)
    .fetch_all(pool)
    .await?;

    let mut pad_pads_punidos = 0i64;
    let mut pad_pads_absolvidos_arquivados = 0i64;
    for (solucao, qtd) in solucoes {
        let s = solucao.unwrap_or_default().to_lowercase();
        if s.contains("punido") || s.contains("punicao") || s.contains("punição") {
            pad_pads_punidos += qtd;
        } else if s.contains("absolvido")
            || s.contains("arquivado")
            || s.contains("absolvicao")
            || s.contains("absolvição")
        {
            pad_pads_absolvidos_arquivados += qtd;
        }
    }

    Ok(AnnualStatistics {
        ano,
        total_processos,
        total_procedimentos,
        total_geral: total_processos + total_procedimentos,
        processos_por_tipo,
        procedimentos_por_tipo,
        ipm_sindicancia_indicios_crime: indicios_crime,
        ipm_sindicancia_indicios_transgressao: indicios_transgressao,
        pad_pads_punidos,
        pad_pads_absolvidos_arquivados,
    })
}

pub async fn by_responsible(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<ResponsavelRelatorio>, sqlx::Error> {
    let ano_i64 = ano.map(|a| a as i64);
    sqlx::query_as::<_, ResponsavelRelatorio>(
        "SELECT p.responsavel_id::text AS responsavel_id, \
                COALESCE(u.nome, 'Não informado') as responsavel_nome, \
                COALESCE(pg.codigo, '') as responsavel_posto, \
                COALESCE(u.matricula, '') as responsavel_matricula, \
                count(*)::bigint as total, \
                count(*) FILTER (WHERE coalesce(p.concluido, false) = true)::bigint  as concluidos, \
                count(*) FILTER (WHERE coalesce(p.concluido, false) = false)::bigint as em_andamento \
         FROM v_processos p \
         LEFT JOIN usuarios u ON p.responsavel_id = u.id \
         LEFT JOIN postos_graduacoes pg ON u.posto_graduacao_id = pg.id \
         WHERE coalesce(p.ativo, true) = true \
           AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1) \
         GROUP BY p.responsavel_id, u.nome, pg.codigo, u.matricula \
         ORDER BY total DESC \
         LIMIT 200",
    )
    .bind(ano_i64)
    .fetch_all(pool)
    .await
}

pub async fn by_type(
    pool: &PgPool,
    ano: Option<i32>,
) -> Result<Vec<TipoRelatorio>, sqlx::Error> {
    let ano_i64 = ano.map(|a| a as i64);
    sqlx::query_as::<_, TipoRelatorio>(
        "SELECT tipo_detalhe, tipo_geral as categoria, \
                count(*)::bigint as total, \
                count(*) FILTER (WHERE coalesce(concluido, false) = true)::bigint  as concluidos, \
                count(*) FILTER (WHERE coalesce(concluido, false) = false)::bigint as em_andamento \
         FROM v_processos \
         WHERE coalesce(ativo, true) = true \
           AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM data_instauracao)::bigint = $1) \
         GROUP BY tipo_detalhe, tipo_geral \
         ORDER BY tipo_geral, tipo_detalhe",
    )
    .bind(ano_i64)
    .fetch_all(pool)
    .await
}

pub async fn overdue_deadlines(
    pool: &PgPool,
    days_past: i32,
) -> Result<Vec<PrazoVencidoItem>, sqlx::Error> {
    sqlx::query_as::<_, PrazoVencidoItem>(
        "SELECT p.id::text AS id, p.numero, p.tipo_detalhe, \
                COALESCE(u.nome, 'Não informado') as responsavel_nome, \
                pr.data_vencimento, \
                (CURRENT_DATE - pr.data_vencimento)::integer as dias_atraso, \
                tp.codigo AS prazo_tipo \
         FROM prazos_processo pr \
         JOIN v_processos p ON pr.processo_id = p.id \
         LEFT JOIN usuarios u ON p.responsavel_id = u.id \
         JOIN tipos_prazo tp ON pr.tipo_prazo_id = tp.id \
         WHERE coalesce(pr.ativo, true) = true \
           AND pr.data_vencimento < CURRENT_DATE \
           AND (CURRENT_DATE - pr.data_vencimento)::integer >= $1 \
           AND coalesce(p.ativo, true) = true \
           AND coalesce(p.concluido, false) = false \
         ORDER BY dias_atraso DESC \
         LIMIT 200",
    )
    .bind(days_past)
    .fetch_all(pool)
    .await
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

fn csv_field(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

async fn csv_processos(pool: &PgPool, ano: Option<i32>) -> Result<String, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Row {
        numero: Option<String>,
        tipo_detalhe: Option<String>,
        data_instauracao: Option<NaiveDate>,
        data_conclusao: Option<NaiveDate>,
        concluido: Option<bool>,
        responsavel_nome: String,
        solucao_tipo: Option<String>,
    }

    let ano_i64 = ano.map(|a| a as i64);
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT p.numero, p.tipo_detalhe, p.data_instauracao, p.data_conclusao, \
                p.concluido, COALESCE(u.nome, 'Não informado') as responsavel_nome, \
                p.solucao_tipo \
         FROM v_processos p \
         LEFT JOIN usuarios u ON p.responsavel_id = u.id \
         WHERE coalesce(p.ativo, true) = true \
           AND ($1::bigint IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::bigint = $1) \
         ORDER BY p.data_instauracao DESC NULLS LAST \
         LIMIT 2000",
    )
    .bind(ano_i64)
    .fetch_all(pool)
    .await?;

    let mut csv =
        String::from("Número,Tipo,Data Instauração,Data Conclusão,Status,Encarregado,Solução\n");
    for r in rows {
        let status = if r.concluido.unwrap_or(false) { "Concluído" } else { "Em andamento" };
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            csv_field(r.numero.as_deref().unwrap_or("")),
            csv_field(r.tipo_detalhe.as_deref().unwrap_or("")),
            csv_field(&r.data_instauracao.map(|d| d.to_string()).unwrap_or_default()),
            csv_field(&r.data_conclusao.map(|d| d.to_string()).unwrap_or_default()),
            csv_field(status),
            csv_field(&r.responsavel_nome),
            csv_field(r.solucao_tipo.as_deref().unwrap_or("")),
        ));
    }
    Ok(csv)
}

async fn csv_prazos(pool: &PgPool) -> Result<String, sqlx::Error> {
    let rows = overdue_deadlines(pool, 0).await?;
    let mut csv =
        String::from("Processo,Tipo,Encarregado,Data Vencimento,Dias Atraso,Tipo Prazo\n");
    for r in rows {
        csv.push_str(&format!(
            "{},{},{},{},{},{}\n",
            csv_field(r.numero.as_deref().unwrap_or("")),
            csv_field(r.tipo_detalhe.as_deref().unwrap_or("")),
            csv_field(&r.responsavel_nome),
            csv_field(&r.data_vencimento.to_string()),
            r.dias_atraso,
            csv_field(r.prazo_tipo.as_deref().unwrap_or("")),
        ));
    }
    Ok(csv)
}

async fn csv_encarregados(pool: &PgPool, ano: Option<i32>) -> Result<String, sqlx::Error> {
    let rows = by_responsible(pool, ano).await?;
    let mut csv = String::from("Encarregado,Posto,Matrícula,Total,Concluídos,Em Andamento\n");
    for r in rows {
        csv.push_str(&format!(
            "{},{},{},{},{},{}\n",
            csv_field(&r.responsavel_nome),
            csv_field(&r.responsavel_posto),
            csv_field(&r.responsavel_matricula),
            r.total,
            r.concluidos,
            r.em_andamento,
        ));
    }
    Ok(csv)
}

pub async fn export_csv(
    pool: &PgPool,
    req: &CsvExportRequest,
) -> Result<CsvExportResult, sqlx::Error> {
    let csv = match req.tipo_relatorio.as_str() {
        "prazos" => csv_prazos(pool).await?,
        "encarregados" => csv_encarregados(pool, req.ano).await?,
        _ => csv_processos(pool, req.ano).await?,
    };

    use base64::Engine;
    let csv_base64 = base64::engine::general_purpose::STANDARD.encode(csv.as_bytes());
    let filename = format!(
        "relatorio_{}_{}.csv",
        req.tipo_relatorio,
        chrono::Local::now().format("%Y%m%d"),
    );

    Ok(CsvExportResult { csv_base64, filename })
}

pub async fn available_years(pool: &PgPool) -> Result<Vec<i32>, sqlx::Error> {
    let rows: Vec<(Option<i32>,)> = sqlx::query_as(
        r#"
        SELECT DISTINCT EXTRACT(YEAR FROM data_instauracao)::integer AS ano
        FROM v_processos
        WHERE coalesce(ativo, true) = true
          AND data_instauracao IS NOT NULL
        ORDER BY ano DESC
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().filter_map(|(y,)| y).collect())
}
