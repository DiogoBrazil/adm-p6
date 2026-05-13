use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::AppError;

use super::domain::{Art29Item, CrimeItem, LocalOrigemItem, MunicipalityItem, NaturezaItem, PostoGraduacaoItem, SaveArt29Request, SaveCrimeRequest, SaveTransgressionRequest, TransgressionItem};

pub async fn list_crimes(pool: &PgPool, limit: i64) -> Result<Vec<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
               paragrafo, inciso, alinea, ativo
        FROM crimes_contravencoes
        WHERE coalesce(ativo, true) = true
        ORDER BY tipo, dispositivo_legal, artigo
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
            SET tipo = $2,
                dispositivo_legal = $3,
                artigo = $4,
                descricao_artigo = $5,
                paragrafo = $6,
                inciso = $7,
                alinea = $8
            WHERE id = $1
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
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO crimes_contravencoes (
                id, tipo, dispositivo_legal, artigo, descricao_artigo,
                paragrafo, inciso, alinea, ativo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            "#,
        )
        .bind(&id)
        .bind(request.tipo.as_deref())
        .bind(request.dispositivo_legal.as_deref())
        .bind(&request.artigo)
        .bind(request.descricao_artigo.as_deref())
        .bind(request.paragrafo.as_deref())
        .bind(request.inciso.as_deref())
        .bind(request.alinea.as_deref())
        .execute(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_crime(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE crimes_contravencoes SET ativo = false WHERE id = $1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn save_transgression(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveTransgressionRequest,
) -> Result<i32, sqlx::Error> {
    if let Some(id) = request.id {
        sqlx::query(
            r#"
            UPDATE transgressoes
            SET artigo = $2, gravidade = $3, inciso = $4, texto = $5
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(request.artigo)
        .bind(request.gravidade.as_deref())
        .bind(request.inciso.as_deref())
        .bind(&request.texto)
        .execute(&mut **tx)
        .await?;
        Ok(id)
    } else {
        let row: (i32,) = sqlx::query_as(
            r#"
            INSERT INTO transgressoes (artigo, gravidade, inciso, texto, ativo, created_at)
            VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
            RETURNING id
            "#,
        )
        .bind(request.artigo)
        .bind(request.gravidade.as_deref())
        .bind(request.inciso.as_deref())
        .bind(&request.texto)
        .fetch_one(&mut **tx)
        .await?;
        Ok(row.0)
    }
}

pub async fn referenced_transgression_count(pool: &PgPool, id: i32) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        r#"
        SELECT (
          (SELECT count(*) FROM pm_envolvido_rdpm WHERE transgressao_id = $1)
          + (SELECT count(*) FROM procedimentos_indicios_rdpm WHERE transgressao_id = $1)
        )::bigint
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn hard_delete_transgression(tx: &mut Transaction<'_, Postgres>, id: i32) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM transgressoes WHERE id = $1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn save_art29(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveArt29Request,
) -> Result<String, sqlx::Error> {
    if let Some(id) = request.id.as_deref() {
        sqlx::query("UPDATE infracoes_estatuto_art29 SET inciso = $2, texto = $3 WHERE id = $1")
            .bind(id)
            .bind(&request.inciso)
            .bind(&request.texto)
            .execute(&mut **tx)
            .await?;
        Ok(id.to_string())
    } else {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO infracoes_estatuto_art29 (id, inciso, texto, ativo) VALUES ($1, $2, $3, true)",
        )
        .bind(&id)
        .bind(&request.inciso)
        .bind(&request.texto)
        .execute(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_art29(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE infracoes_estatuto_art29 SET ativo = false WHERE id = $1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn get_crime_by_id(pool: &PgPool, id: &str) -> Result<Option<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
               paragrafo, inciso, alinea, ativo
        FROM crimes_contravencoes
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_transgressions(pool: &PgPool, limit: i64) -> Result<Vec<TransgressionItem>, sqlx::Error> {
    sqlx::query_as::<_, TransgressionItem>(
        r#"
        SELECT id, artigo, gravidade, inciso, texto, ativo
        FROM transgressoes
        WHERE coalesce(ativo, true) = true
        ORDER BY artigo NULLS LAST, inciso NULLS LAST
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
        SELECT id, nome, tipo, municipio_pai,
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
        SELECT id, inciso, texto, ativo
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

pub async fn get_transgression_by_id(pool: &PgPool, id: i32) -> Result<Option<TransgressionItem>, sqlx::Error> {
    sqlx::query_as::<_, TransgressionItem>(
        "SELECT id, artigo, gravidade, inciso, texto, ativo FROM transgressoes WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_art29_by_id(pool: &PgPool, id: &str) -> Result<Option<Art29Item>, sqlx::Error> {
    sqlx::query_as::<_, Art29Item>(
        "SELECT id, inciso, texto, ativo FROM infracoes_estatuto_art29 WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_locais_origem(pool: &PgPool) -> Result<Vec<LocalOrigemItem>, sqlx::Error> {
    sqlx::query_as::<_, LocalOrigemItem>(
        "SELECT id, nome, ativo FROM locais_origem WHERE coalesce(ativo, true) = true ORDER BY nome",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_postos_graduacoes(pool: &PgPool) -> Result<Vec<PostoGraduacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, PostoGraduacaoItem>(
        "SELECT id, nome, sigla, ativo FROM postos_graduacoes WHERE coalesce(ativo, true) = true ORDER BY nome",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_naturezas(pool: &PgPool) -> Result<Vec<NaturezaItem>, sqlx::Error> {
    sqlx::query_as::<_, NaturezaItem>(
        "SELECT id, nome, ativo FROM naturezas WHERE coalesce(ativo, true) = true ORDER BY nome",
    )
    .fetch_all(pool)
    .await
}
