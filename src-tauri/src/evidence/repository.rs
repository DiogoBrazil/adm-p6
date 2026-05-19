use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::legal_catalogs::domain::{Art29Item, CrimeItem, TransgressionItem};

use super::domain::{EvidenceData, PmWithEvidence, SaveEvidenceRequest};

pub async fn save_for_pm(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveEvidenceRequest,
) -> Result<(), sqlx::Error> {
    // Find existing indicios record (if any)
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = $1 AND coalesce(ativo, true) = true",
    )
    .bind(&request.pm_envolvido_id)
    .fetch_optional(&mut **tx)
    .await?;

    let pm_indicios_id = if let Some((id,)) = existing {
        // Destructive clear of junction tables
        sqlx::query("DELETE FROM pm_envolvido_crimes WHERE pm_indicios_id = $1")
            .bind(&id)
            .execute(&mut **tx)
            .await?;
        sqlx::query("DELETE FROM pm_envolvido_rdpm WHERE pm_indicios_id = $1")
            .bind(&id)
            .execute(&mut **tx)
            .await?;
        sqlx::query("DELETE FROM pm_envolvido_art29 WHERE pm_indicios_id = $1")
            .bind(&id)
            .execute(&mut **tx)
            .await?;
        id
    } else {
        // Need procedimento_id for the INSERT
        let proc: (String,) = sqlx::query_as(
            "SELECT procedimento_id FROM procedimento_pms_envolvidos WHERE id = $1",
        )
        .bind(&request.pm_envolvido_id)
        .fetch_one(&mut **tx)
        .await?;

        let new_id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO pm_envolvido_indicios (id, pm_envolvido_id, procedimento_id, categorias_indicios, categoria, ativo)
            VALUES ($1, $2, $3, '[]'::jsonb, '', true)
            "#,
        )
        .bind(&new_id)
        .bind(&request.pm_envolvido_id)
        .bind(&proc.0)
        .execute(&mut **tx)
        .await?;
        new_id
    };

    // Update categories
    let categorias_json = serde_json::to_value(&request.categorias)
        .unwrap_or(serde_json::Value::Array(vec![]));
    let primeira = request.categorias.first().map(String::as_str).unwrap_or("");

    sqlx::query(
        "UPDATE pm_envolvido_indicios SET categorias_indicios = $2, categoria = $3 WHERE id = $1",
    )
    .bind(&pm_indicios_id)
    .bind(categorias_json)
    .bind(primeira)
    .execute(&mut **tx)
    .await?;

    // Insert crimes
    for crime_id in &request.crimes {
        sqlx::query(
            "INSERT INTO pm_envolvido_crimes (id, pm_indicios_id, crime_id) VALUES ($1, $2, $3)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&pm_indicios_id)
        .bind(crime_id)
        .execute(&mut **tx)
        .await?;
    }

    // Insert RDPM
    for trans_id in &request.rdpm {
        sqlx::query(
            "INSERT INTO pm_envolvido_rdpm (id, pm_indicios_id, transgressao_id) VALUES ($1, $2, $3)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&pm_indicios_id)
        .bind(trans_id)
        .execute(&mut **tx)
        .await?;
    }

    // Insert Art.29
    for art29_id in &request.art29 {
        sqlx::query(
            "INSERT INTO pm_envolvido_art29 (id, pm_indicios_id, art29_id) VALUES ($1, $2, $3)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&pm_indicios_id)
        .bind(art29_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

pub async fn load_for_pm(
    pool: &PgPool,
    pm_envolvido_id: &str,
) -> Result<EvidenceData, sqlx::Error> {
    // Find the indicios record
    let indicios_row: Option<(String, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT id, categorias_indicios FROM pm_envolvido_indicios WHERE pm_envolvido_id = $1 AND coalesce(ativo, true) = true LIMIT 1",
    )
    .bind(pm_envolvido_id)
    .fetch_optional(pool)
    .await?;

    let (pm_indicios_id, categorias_json) = match indicios_row {
        Some(row) => row,
        None => {
            return Ok(EvidenceData {
                pm_envolvido_id: pm_envolvido_id.to_string(),
                categorias: vec![],
                crimes: vec![],
                rdpm: vec![],
                art29: vec![],
            });
        }
    };

    let categorias: Vec<String> = categorias_json
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let crimes = sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo,
               c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM pm_envolvido_crimes pec
        JOIN crimes_contravencoes c ON c.id = pec.crime_id
        WHERE pec.pm_indicios_id = $1
        "#,
    )
    .bind(&pm_indicios_id)
    .fetch_all(pool)
    .await?;

    let rdpm = sqlx::query_as::<_, TransgressionItem>(
        r#"
        SELECT t.id, t.artigo, t.gravidade, t.inciso, t.texto, t.ativo
        FROM pm_envolvido_rdpm per
        JOIN transgressoes t ON t.id = per.transgressao_id
        WHERE per.pm_indicios_id = $1
        "#,
    )
    .bind(&pm_indicios_id)
    .fetch_all(pool)
    .await?;

    let art29 = sqlx::query_as::<_, Art29Item>(
        r#"
        SELECT a.id, a.inciso, a.texto, a.ativo
        FROM pm_envolvido_art29 pea
        JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
        WHERE pea.pm_indicios_id = $1
        "#,
    )
    .bind(&pm_indicios_id)
    .fetch_all(pool)
    .await?;

    Ok(EvidenceData {
        pm_envolvido_id: pm_envolvido_id.to_string(),
        categorias,
        crimes,
        rdpm,
        art29,
    })
}

pub async fn search_crimes(pool: &PgPool, termo: &str) -> Result<Vec<CrimeItem>, sqlx::Error> {
    if termo.is_empty() {
        return sqlx::query_as::<_, CrimeItem>(
            r#"
            SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
                   paragrafo, inciso, alinea, ativo
            FROM crimes_contravencoes
            WHERE coalesce(ativo, true) = true
            ORDER BY tipo, dispositivo_legal, artigo
            LIMIT 50
            "#,
        )
        .fetch_all(pool)
        .await;
    }

    let pattern = format!("%{termo}%");
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
               paragrafo, inciso, alinea, ativo
        FROM crimes_contravencoes
        WHERE coalesce(ativo, true) = true
          AND (artigo ILIKE $1 OR descricao_artigo ILIKE $1 OR dispositivo_legal ILIKE $1)
        ORDER BY tipo, dispositivo_legal, artigo
        LIMIT 50
        "#,
    )
    .bind(pattern)
    .fetch_all(pool)
    .await
}

pub async fn search_rdpm(
    pool: &PgPool,
    termo: &str,
    gravidade: Option<&str>,
) -> Result<Vec<TransgressionItem>, sqlx::Error> {
    match (termo.is_empty(), gravidade) {
        (true, None) => {
            sqlx::query_as::<_, TransgressionItem>(
                r#"
                SELECT id, artigo, gravidade, inciso, texto, ativo
                FROM transgressoes
                WHERE coalesce(ativo, true) = true
                ORDER BY gravidade, inciso
                LIMIT 50
                "#,
            )
            .fetch_all(pool)
            .await
        }
        (true, Some(g)) => {
            sqlx::query_as::<_, TransgressionItem>(
                r#"
                SELECT id, artigo, gravidade, inciso, texto, ativo
                FROM transgressoes
                WHERE coalesce(ativo, true) = true AND gravidade = $1
                ORDER BY gravidade, inciso
                LIMIT 50
                "#,
            )
            .bind(g)
            .fetch_all(pool)
            .await
        }
        (false, None) => {
            let pattern = format!("%{termo}%");
            sqlx::query_as::<_, TransgressionItem>(
                r#"
                SELECT id, artigo, gravidade, inciso, texto, ativo
                FROM transgressoes
                WHERE coalesce(ativo, true) = true
                  AND (inciso ILIKE $1 OR texto ILIKE $1)
                ORDER BY gravidade, inciso
                LIMIT 50
                "#,
            )
            .bind(pattern)
            .fetch_all(pool)
            .await
        }
        (false, Some(g)) => {
            let pattern = format!("%{termo}%");
            sqlx::query_as::<_, TransgressionItem>(
                r#"
                SELECT id, artigo, gravidade, inciso, texto, ativo
                FROM transgressoes
                WHERE coalesce(ativo, true) = true AND gravidade = $2
                  AND (inciso ILIKE $1 OR texto ILIKE $1)
                ORDER BY gravidade, inciso
                LIMIT 50
                "#,
            )
            .bind(pattern)
            .bind(g)
            .fetch_all(pool)
            .await
        }
    }
}

pub async fn search_art29(pool: &PgPool, termo: &str) -> Result<Vec<Art29Item>, sqlx::Error> {
    if termo.is_empty() {
        return sqlx::query_as::<_, Art29Item>(
            r#"
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29
            WHERE coalesce(ativo, true) = true
            ORDER BY length(inciso), inciso
            LIMIT 50
            "#,
        )
        .fetch_all(pool)
        .await;
    }

    let pattern = format!("%{termo}%");
    sqlx::query_as::<_, Art29Item>(
        r#"
        SELECT id, inciso, texto, ativo
        FROM infracoes_estatuto_art29
        WHERE coalesce(ativo, true) = true
          AND (inciso ILIKE $1 OR texto ILIKE $1)
        ORDER BY length(inciso), inciso
        LIMIT 50
        "#,
    )
    .bind(pattern)
    .fetch_all(pool)
    .await
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
        SELECT pe.id, pe.pm_id, u.nome, u.posto_graduacao, u.matricula, pe.status_pm
        FROM procedimento_pms_envolvidos pe
        LEFT JOIN usuarios u ON pe.pm_id = u.id
        WHERE pe.procedimento_id = $1
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
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    pm_envolvido_id: &str,
) -> Result<(), sqlx::Error> {
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = $1 AND coalesce(ativo, true) = true",
    )
    .bind(pm_envolvido_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some((indicios_id,)) = existing {
        sqlx::query("DELETE FROM pm_envolvido_crimes WHERE pm_indicios_id = $1")
            .bind(&indicios_id)
            .execute(&mut **tx)
            .await?;
        sqlx::query("DELETE FROM pm_envolvido_rdpm WHERE pm_indicios_id = $1")
            .bind(&indicios_id)
            .execute(&mut **tx)
            .await?;
        sqlx::query("DELETE FROM pm_envolvido_art29 WHERE pm_indicios_id = $1")
            .bind(&indicios_id)
            .execute(&mut **tx)
            .await?;
        sqlx::query(
            "UPDATE pm_envolvido_indicios SET ativo = false WHERE id = $1",
        )
        .bind(&indicios_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
