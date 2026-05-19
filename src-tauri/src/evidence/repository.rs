use sqlx::{PgPool, Postgres, Transaction};

use crate::legal_catalogs::domain::{Art29Item, Art32Item, CrimeItem, TransgressionItem};

use super::domain::{EvidenceData, InfractionEvidence, PmWithEvidence, SaveEvidenceRequest};

/// Resolve o vínculo PM<->procedimento para o par canônico (processo_procedimento_id, envolvido_id).
async fn resolve_pm<'e, E>(executor: E, pm_envolvido_id: &str) -> Result<Option<(String, String)>, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    sqlx::query_as::<_, (String, String)>(
        "SELECT procedimento_id::text, pm_id::text FROM procedimento_pms_envolvidos WHERE id = $1::uuid",
    )
    .bind(pm_envolvido_id)
    .fetch_optional(executor)
    .await
}

const EVIDENCE_TABLES: [&str; 5] = [
    "pm_envolvido_crimes_militares",
    "pm_envolvido_crimes_comuns",
    "pm_envolvido_rdpm",
    "pm_envolvido_art29",
    "pm_envolvido_art32",
];

pub async fn save_for_pm(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveEvidenceRequest,
) -> Result<(), sqlx::Error> {
    let (proc_id, envolvido_id) = match resolve_pm(&mut **tx, &request.pm_envolvido_id).await? {
        Some(pair) => pair,
        None => return Err(sqlx::Error::RowNotFound),
    };

    // Categorias permanecem em pm_envolvido_indicios (jsonb).
    let categorias_json = serde_json::to_value(&request.categorias)
        .unwrap_or(serde_json::Value::Array(vec![]));
    let primeira = request.categorias.first().map(String::as_str).unwrap_or("");

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id::text FROM pm_envolvido_indicios WHERE pm_envolvido_id = $1::uuid AND coalesce(ativo, true) = true",
    )
    .bind(&request.pm_envolvido_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some((iid,)) = existing {
        sqlx::query(
            "UPDATE pm_envolvido_indicios SET categorias_indicios = $2, categoria = $3, ativo = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(&iid)
        .bind(&categorias_json)
        .bind(primeira)
        .execute(&mut **tx)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO pm_envolvido_indicios (pm_envolvido_id, procedimento_id, categorias_indicios, categoria, ativo) VALUES ($1::uuid, $2::uuid, $3, $4, true)",
        )
        .bind(&request.pm_envolvido_id)
        .bind(&proc_id)
        .bind(&categorias_json)
        .bind(primeira)
        .execute(&mut **tx)
        .await?;
    }

    // Substituição destrutiva das 5 famílias de evidência por (processo, envolvido).
    for table in EVIDENCE_TABLES {
        sqlx::query(&format!(
            "DELETE FROM {table} WHERE processo_procedimento_id = $1::uuid AND envolvido_id = $2::uuid"
        ))
        .bind(&proc_id)
        .bind(&envolvido_id)
        .execute(&mut **tx)
        .await?;
    }

    for crime_id in &request.crimes_militares {
        sqlx::query(
            "INSERT INTO pm_envolvido_crimes_militares (processo_procedimento_id, envolvido_id, crime_id) VALUES ($1::uuid, $2::uuid, $3::uuid)",
        )
        .bind(&proc_id).bind(&envolvido_id).bind(crime_id)
        .execute(&mut **tx).await?;
    }

    for crime_id in &request.crimes_comuns {
        sqlx::query(
            "INSERT INTO pm_envolvido_crimes_comuns (processo_procedimento_id, envolvido_id, crime_id) VALUES ($1::uuid, $2::uuid, $3::uuid)",
        )
        .bind(&proc_id).bind(&envolvido_id).bind(crime_id)
        .execute(&mut **tx).await?;
    }

    for trans_id in &request.rdpm {
        sqlx::query(
            "INSERT INTO pm_envolvido_rdpm (processo_procedimento_id, envolvido_id, transgressao_id) VALUES ($1::uuid, $2::uuid, $3::uuid)",
        )
        .bind(&proc_id).bind(&envolvido_id).bind(trans_id)
        .execute(&mut **tx).await?;
    }

    for sel in &request.art29 {
        sqlx::query(
            "INSERT INTO pm_envolvido_art29 (processo_procedimento_id, envolvido_id, infracao_art29_id, analogia_art_rdpm_id) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)",
        )
        .bind(&proc_id).bind(&envolvido_id).bind(&sel.infracao_id).bind(&sel.analogia_id)
        .execute(&mut **tx).await?;
    }

    for sel in &request.art32 {
        sqlx::query(
            "INSERT INTO pm_envolvido_art32 (processo_procedimento_id, envolvido_id, infracao_art32_id, analogia_art_rdpm_id) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)",
        )
        .bind(&proc_id).bind(&envolvido_id).bind(&sel.infracao_id).bind(&sel.analogia_id)
        .execute(&mut **tx).await?;
    }

    Ok(())
}

async fn load_crimes(pool: &PgPool, table: &str, proc_id: &str, envolvido_id: &str) -> Result<Vec<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(&format!(
        r#"
        SELECT c.id::text AS id,
               dl.nome_dispositivo_legal AS dispositivo_legal,
               c.dispositivo_legal_id::text AS dispositivo_legal_id,
               c.artigo, c.descricao_artigo, c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM {table} ev
        JOIN crimes_contravencoes c ON c.id = ev.crime_id
        LEFT JOIN dispositivos_legais dl ON dl.id = c.dispositivo_legal_id
        WHERE ev.processo_procedimento_id = $1::uuid AND ev.envolvido_id = $2::uuid
        "#
    ))
    .bind(proc_id)
    .bind(envolvido_id)
    .fetch_all(pool)
    .await
}

async fn load_infractions(
    pool: &PgPool,
    table: &str,
    infracao_table: &str,
    infracao_fk: &str,
    proc_id: &str,
    envolvido_id: &str,
) -> Result<Vec<InfractionEvidence>, sqlx::Error> {
    sqlx::query_as::<_, InfractionEvidence>(&format!(
        r#"
        SELECT ev.id::text AS id,
               inf.id::text AS infracao_id, inf.inciso AS infracao_inciso, inf.texto AS infracao_texto,
               an.id::text AS analogia_id, an.inciso AS analogia_inciso, an.texto AS analogia_texto,
               ar.artigo AS analogia_artigo
        FROM {table} ev
        JOIN {infracao_table} inf ON inf.id = ev.{infracao_fk}
        JOIN transgressoes an ON an.id = ev.analogia_art_rdpm_id
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = an.artigo_id
        WHERE ev.processo_procedimento_id = $1::uuid AND ev.envolvido_id = $2::uuid
        "#
    ))
    .bind(proc_id)
    .bind(envolvido_id)
    .fetch_all(pool)
    .await
}

pub async fn load_for_pm(pool: &PgPool, pm_envolvido_id: &str) -> Result<EvidenceData, sqlx::Error> {
    let (proc_id, envolvido_id) = match resolve_pm(pool, pm_envolvido_id).await? {
        Some(pair) => pair,
        None => return Ok(EvidenceData::empty(pm_envolvido_id)),
    };

    let categorias: Vec<String> = sqlx::query_as::<_, (Option<serde_json::Value>,)>(
        "SELECT categorias_indicios FROM pm_envolvido_indicios WHERE pm_envolvido_id = $1::uuid AND coalesce(ativo, true) = true LIMIT 1",
    )
    .bind(pm_envolvido_id)
    .fetch_optional(pool)
    .await?
    .and_then(|(v,)| v)
    .and_then(|v| serde_json::from_value(v).ok())
    .unwrap_or_default();

    let crimes_militares = load_crimes(pool, "pm_envolvido_crimes_militares", &proc_id, &envolvido_id).await?;
    let crimes_comuns = load_crimes(pool, "pm_envolvido_crimes_comuns", &proc_id, &envolvido_id).await?;

    let rdpm = sqlx::query_as::<_, TransgressionItem>(
        r#"
        SELECT t.id::text AS id, ar.artigo AS artigo, nt.nome_natureza AS natureza,
               t.artigo_id::text AS artigo_id, t.inciso, t.texto, t.ativo
        FROM pm_envolvido_rdpm ev
        JOIN transgressoes t ON t.id = ev.transgressao_id
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = t.artigo_id
        LEFT JOIN natureza_transgressao nt ON nt.id = ar.natureza_id
        WHERE ev.processo_procedimento_id = $1::uuid AND ev.envolvido_id = $2::uuid
        "#,
    )
    .bind(&proc_id)
    .bind(&envolvido_id)
    .fetch_all(pool)
    .await?;

    let art29 = load_infractions(pool, "pm_envolvido_art29", "infracoes_estatuto_art29", "infracao_art29_id", &proc_id, &envolvido_id).await?;
    let art32 = load_infractions(pool, "pm_envolvido_art32", "infracoes_estatuto_art32", "infracao_art32_id", &proc_id, &envolvido_id).await?;

    Ok(EvidenceData {
        pm_envolvido_id: pm_envolvido_id.to_string(),
        categorias,
        crimes_militares,
        crimes_comuns,
        rdpm,
        art29,
        art32,
    })
}

pub async fn list_for_proceeding(
    pool: &PgPool,
    procedimento_id: &str,
) -> Result<Vec<PmWithEvidence>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct PmRow {
        id: String,
        pm_id: String,
        nome: Option<String>,
        posto_graduacao: Option<String>,
        matricula: Option<String>,
        status_pm: Option<String>,
    }

    let pms = sqlx::query_as::<_, PmRow>(
        r#"
        SELECT pe.id::text AS id, pe.pm_id::text AS pm_id,
               u.nome, pg.codigo AS posto_graduacao, u.matricula,
               se.codigo AS status_pm
        FROM procedimento_pms_envolvidos pe
        LEFT JOIN usuarios u ON pe.pm_id = u.id
        LEFT JOIN postos_graduacoes pg ON pg.id = u.posto_graduacao_id
        LEFT JOIN status_envolvido se ON se.id = pe.status_pm_id
        WHERE pe.procedimento_id = $1::uuid
        ORDER BY pe.ordem NULLS LAST
        "#,
    )
    .bind(procedimento_id)
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(pms.len());
    for pm in pms {
        let indicios = load_for_pm(pool, &pm.id).await?;
        result.push(PmWithEvidence {
            pm_envolvido_id: pm.id,
            pm_id: pm.pm_id,
            nome: pm.nome,
            posto_graduacao: pm.posto_graduacao,
            matricula: pm.matricula,
            status_pm: pm.status_pm,
            indicios,
        });
    }
    Ok(result)
}

pub async fn remove_for_pm(
    tx: &mut Transaction<'_, Postgres>,
    pm_envolvido_id: &str,
) -> Result<(), sqlx::Error> {
    if let Some((proc_id, envolvido_id)) = resolve_pm(&mut **tx, pm_envolvido_id).await? {
        for table in EVIDENCE_TABLES {
            sqlx::query(&format!(
                "DELETE FROM {table} WHERE processo_procedimento_id = $1::uuid AND envolvido_id = $2::uuid"
            ))
            .bind(&proc_id)
            .bind(&envolvido_id)
            .execute(&mut **tx)
            .await?;
        }
        sqlx::query("UPDATE pm_envolvido_indicios SET ativo = false WHERE pm_envolvido_id = $1::uuid")
            .bind(pm_envolvido_id)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

pub async fn search_crimes(pool: &PgPool, termo: &str) -> Result<Vec<CrimeItem>, sqlx::Error> {
    let base = r#"
        SELECT c.id::text AS id,
               dl.nome_dispositivo_legal AS dispositivo_legal,
               c.dispositivo_legal_id::text AS dispositivo_legal_id,
               c.artigo, c.descricao_artigo, c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM crimes_contravencoes c
        LEFT JOIN dispositivos_legais dl ON dl.id = c.dispositivo_legal_id
        WHERE coalesce(c.ativo, true) = true
    "#;

    if termo.is_empty() {
        return sqlx::query_as::<_, CrimeItem>(&format!(
            "{base} ORDER BY dl.nome_dispositivo_legal, c.artigo LIMIT 50"
        ))
        .fetch_all(pool)
        .await;
    }

    let pattern = format!("%{termo}%");
    sqlx::query_as::<_, CrimeItem>(&format!(
        "{base} AND (c.artigo ILIKE $1 OR c.descricao_artigo ILIKE $1 OR dl.nome_dispositivo_legal ILIKE $1) ORDER BY dl.nome_dispositivo_legal, c.artigo LIMIT 50"
    ))
    .bind(pattern)
    .fetch_all(pool)
    .await
}

pub async fn search_rdpm(
    pool: &PgPool,
    termo: &str,
    natureza: Option<&str>,
) -> Result<Vec<TransgressionItem>, sqlx::Error> {
    let base = r#"
        SELECT t.id::text AS id, ar.artigo AS artigo, nt.nome_natureza AS natureza,
               t.artigo_id::text AS artigo_id, t.inciso, t.texto, t.ativo
        FROM transgressoes t
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = t.artigo_id
        LEFT JOIN natureza_transgressao nt ON nt.id = ar.natureza_id
        WHERE coalesce(t.ativo, true) = true
    "#;
    let order = " ORDER BY ar.artigo NULLS LAST, t.inciso NULLS LAST LIMIT 50";

    match (termo.is_empty(), natureza) {
        (true, None) => {
            sqlx::query_as::<_, TransgressionItem>(&format!("{base}{order}"))
                .fetch_all(pool).await
        }
        (true, Some(n)) => {
            sqlx::query_as::<_, TransgressionItem>(&format!("{base} AND nt.nome_natureza = $1{order}"))
                .bind(n).fetch_all(pool).await
        }
        (false, None) => {
            let pattern = format!("%{termo}%");
            sqlx::query_as::<_, TransgressionItem>(&format!("{base} AND (t.inciso ILIKE $1 OR t.texto ILIKE $1){order}"))
                .bind(pattern).fetch_all(pool).await
        }
        (false, Some(n)) => {
            let pattern = format!("%{termo}%");
            sqlx::query_as::<_, TransgressionItem>(&format!("{base} AND nt.nome_natureza = $2 AND (t.inciso ILIKE $1 OR t.texto ILIKE $1){order}"))
                .bind(pattern).bind(n).fetch_all(pool).await
        }
    }
}

pub async fn search_art29(pool: &PgPool, termo: &str) -> Result<Vec<Art29Item>, sqlx::Error> {
    if termo.is_empty() {
        return sqlx::query_as::<_, Art29Item>(
            r#"SELECT id::text AS id, inciso, texto, ativo FROM infracoes_estatuto_art29
               WHERE coalesce(ativo, true) = true ORDER BY length(inciso), inciso LIMIT 50"#,
        )
        .fetch_all(pool)
        .await;
    }
    let pattern = format!("%{termo}%");
    sqlx::query_as::<_, Art29Item>(
        r#"SELECT id::text AS id, inciso, texto, ativo FROM infracoes_estatuto_art29
           WHERE coalesce(ativo, true) = true AND (inciso ILIKE $1 OR texto ILIKE $1)
           ORDER BY length(inciso), inciso LIMIT 50"#,
    )
    .bind(pattern)
    .fetch_all(pool)
    .await
}

pub async fn search_art32(pool: &PgPool, termo: &str) -> Result<Vec<Art32Item>, sqlx::Error> {
    if termo.is_empty() {
        return sqlx::query_as::<_, Art32Item>(
            r#"SELECT id::text AS id, inciso, texto, ativo FROM infracoes_estatuto_art32
               WHERE coalesce(ativo, true) = true ORDER BY length(inciso), inciso LIMIT 50"#,
        )
        .fetch_all(pool)
        .await;
    }
    let pattern = format!("%{termo}%");
    sqlx::query_as::<_, Art32Item>(
        r#"SELECT id::text AS id, inciso, texto, ativo FROM infracoes_estatuto_art32
           WHERE coalesce(ativo, true) = true AND (inciso ILIKE $1 OR texto ILIKE $1)
           ORDER BY length(inciso), inciso LIMIT 50"#,
    )
    .bind(pattern)
    .fetch_all(pool)
    .await
}
