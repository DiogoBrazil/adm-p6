use sqlx::{PgPool, Postgres, Transaction};

use crate::error::AppError;

use super::domain::{Art29Item, CrimeItem, LocalOrigemItem, MunicipalityItem, NaturezaItem, PostoGraduacaoItem, SaveArt29Request, SaveCrimeRequest, SaveTransgressionRequest, TransgressionItem};

pub async fn list_crimes(pool: &PgPool, limit: i64) -> Result<Vec<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT c.id::text AS id,
               ti.codigo AS tipo,
               c.dispositivo_legal, c.artigo, c.descricao_artigo,
               c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM crimes_contravencoes c
        LEFT JOIN tipos_infracao_penal ti ON ti.id = c.tipo_id
        WHERE coalesce(c.ativo, true) = true
        ORDER BY ti.codigo, c.dispositivo_legal, c.artigo
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn save_crime(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveCrimeRequest,
) -> Result<String, AppError> {
    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            r#"
            UPDATE crimes_contravencoes
            SET tipo_id           = (SELECT id FROM tipos_infracao_penal WHERE codigo = $2),
                dispositivo_legal = $3,
                artigo            = $4,
                descricao_artigo  = $5,
                paragrafo         = $6,
                inciso            = $7,
                alinea            = $8
            WHERE id = $1::uuid
            "#,
        )
        .bind(id)
        .bind(request.tipo.as_deref())
        .bind(request.dispositivo_legal.as_deref())
        .bind(&request.artigo)
        .bind(request.descricao_artigo.as_deref())
        .bind(request.paragrafo.as_deref())
        .bind(request.inciso.as_deref())
        .bind(request.alinea.as_deref())
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            r#"
            INSERT INTO crimes_contravencoes (
                tipo_id, dispositivo_legal, artigo, descricao_artigo,
                paragrafo, inciso, alinea, ativo
            )
            VALUES (
                (SELECT id FROM tipos_infracao_penal WHERE codigo = $1),
                $2, $3, $4, $5, $6, $7, true
            )
            RETURNING id::text
            "#,
        )
        .bind(request.tipo.as_deref())
        .bind(request.dispositivo_legal.as_deref())
        .bind(&request.artigo)
        .bind(request.descricao_artigo.as_deref())
        .bind(request.paragrafo.as_deref())
        .bind(request.inciso.as_deref())
        .bind(request.alinea.as_deref())
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_crime(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE crimes_contravencoes SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn save_transgression(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveTransgressionRequest,
) -> Result<String, AppError> {
    if let (Some(grav), Some(inc)) = (request.gravidade.as_deref(), request.inciso.as_deref()) {
        if !grav.is_empty() && !inc.is_empty() {
            let (count,): (i64,) = sqlx::query_as(
                r#"
                SELECT count(*)::bigint FROM transgressoes
                WHERE gravidade_id = (SELECT id FROM natureza_transgressao WHERE codigo = $1)
                  AND lower(inciso) = lower($2)
                  AND ($3::uuid IS NULL OR id != $3::uuid)
                "#,
            )
            .bind(grav)
            .bind(inc)
            .bind(request.id.as_deref())
            .fetch_one(&mut **tx)
            .await?;
            if count > 0 {
                return Err(AppError::Domain(format!(
                    "ja existe transgressao com gravidade '{}' e inciso '{}'",
                    grav, inc
                )));
            }
        }
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            r#"
            UPDATE transgressoes
            SET artigo       = $2,
                gravidade_id = (SELECT id FROM natureza_transgressao WHERE codigo = $3),
                inciso       = $4,
                texto        = $5
            WHERE id = $1::uuid
            "#,
        )
        .bind(id)
        .bind(request.artigo)
        .bind(request.gravidade.as_deref())
        .bind(request.inciso.as_deref())
        .bind(&request.texto)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            r#"
            INSERT INTO transgressoes (artigo, gravidade_id, inciso, texto, ativo, created_at)
            VALUES (
                $1,
                (SELECT id FROM natureza_transgressao WHERE codigo = $2),
                $3, $4, true, CURRENT_TIMESTAMP
            )
            RETURNING id::text
            "#,
        )
        .bind(request.artigo)
        .bind(request.gravidade.as_deref())
        .bind(request.inciso.as_deref())
        .bind(&request.texto)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn referenced_transgression_count(pool: &PgPool, id: &str) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT count(*)::bigint FROM pm_envolvido_rdpm WHERE transgressao_id = $1::uuid",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn hard_delete_transgression(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM transgressoes WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn save_art29(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveArt29Request,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM infracoes_estatuto_art29
        WHERE lower(inciso) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.inciso)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!(
            "ja existe infracao ativa com inciso '{}'",
            request.inciso
        )));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query("UPDATE infracoes_estatuto_art29 SET inciso = $2, texto = $3 WHERE id = $1::uuid")
            .bind(id)
            .bind(&request.inciso)
            .bind(&request.texto)
            .execute(&mut **tx)
            .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO infracoes_estatuto_art29 (inciso, texto, ativo) VALUES ($1, $2, true) RETURNING id::text",
        )
        .bind(&request.inciso)
        .bind(&request.texto)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn soft_delete_art29(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE infracoes_estatuto_art29 SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn get_crime_by_id(pool: &PgPool, id: &str) -> Result<Option<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT c.id::text AS id,
               ti.codigo AS tipo,
               c.dispositivo_legal, c.artigo, c.descricao_artigo,
               c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM crimes_contravencoes c
        LEFT JOIN tipos_infracao_penal ti ON ti.id = c.tipo_id
        WHERE c.id = $1::uuid
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_transgressions(pool: &PgPool, limit: i64) -> Result<Vec<TransgressionItem>, sqlx::Error> {
    sqlx::query_as::<_, TransgressionItem>(
        r#"
        SELECT t.id::text AS id, t.artigo, nt.codigo AS gravidade, t.inciso, t.texto, t.ativo
        FROM transgressoes t
        JOIN natureza_transgressao nt ON nt.id = t.gravidade_id
        WHERE coalesce(t.ativo, true) = true
        ORDER BY t.artigo NULLS LAST, t.inciso NULLS LAST
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn search_municipalities(
    pool: &PgPool,
    termo: &str,
) -> Result<Vec<MunicipalityItem>, sqlx::Error> {
    let pattern = if termo.is_empty() { None } else { Some(format!("%{termo}%")) };
    sqlx::query_as::<_, MunicipalityItem>(
        r#"
        SELECT id::text AS id, nome, tipo, municipio_pai,
               CASE WHEN tipo = 'Distrito' AND municipio_pai IS NOT NULL
                    THEN nome || ' (' || municipio_pai || ')'
                    ELSE nome
               END AS nome_exibicao
        FROM municipios_distritos
        WHERE coalesce(ativo, true) = true
          AND ($1::text IS NULL OR nome ILIKE $1 OR municipio_pai ILIKE $1)
        ORDER BY nome
        LIMIT 50
        "#,
    )
    .bind(pattern.as_deref())
    .fetch_all(pool)
    .await
}

pub async fn list_art29(pool: &PgPool, limit: i64) -> Result<Vec<Art29Item>, sqlx::Error> {
    sqlx::query_as::<_, Art29Item>(
        r#"
        SELECT id::text AS id, inciso, texto, ativo
        FROM infracoes_estatuto_art29
        WHERE coalesce(ativo, true) = true
        ORDER BY length(inciso), inciso
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn get_transgression_by_id(pool: &PgPool, id: &str) -> Result<Option<TransgressionItem>, sqlx::Error> {
    sqlx::query_as::<_, TransgressionItem>(
        r#"
        SELECT t.id::text AS id, t.artigo, nt.codigo AS gravidade, t.inciso, t.texto, t.ativo
        FROM transgressoes t
        JOIN natureza_transgressao nt ON nt.id = t.gravidade_id
        WHERE t.id = $1::uuid
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_art29_by_id(pool: &PgPool, id: &str) -> Result<Option<Art29Item>, sqlx::Error> {
    sqlx::query_as::<_, Art29Item>(
        "SELECT id::text AS id, inciso, texto, ativo FROM infracoes_estatuto_art29 WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_locais_origem(pool: &PgPool) -> Result<Vec<LocalOrigemItem>, sqlx::Error> {
    sqlx::query_as::<_, LocalOrigemItem>(
        "SELECT id::text AS id, codigo AS nome, ativo FROM locais_origem WHERE coalesce(ativo, true) = true ORDER BY codigo",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_postos_graduacoes(pool: &PgPool) -> Result<Vec<PostoGraduacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, PostoGraduacaoItem>(
        "SELECT id::text AS id, codigo AS nome, NULL::text AS sigla, ativo FROM postos_graduacoes WHERE coalesce(ativo, true) = true ORDER BY ordem_hierarquica, codigo",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_naturezas(pool: &PgPool) -> Result<Vec<NaturezaItem>, sqlx::Error> {
    sqlx::query_as::<_, NaturezaItem>(
        "SELECT id::text AS id, codigo AS nome, ativo FROM natureza_transgressao WHERE coalesce(ativo, true) = true ORDER BY codigo",
    )
    .fetch_all(pool)
    .await
}
