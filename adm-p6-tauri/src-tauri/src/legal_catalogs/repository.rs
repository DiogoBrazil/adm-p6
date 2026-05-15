use sqlx::{PgPool, Postgres, Transaction};

use crate::error::AppError;

use super::domain::{Art29Item, Art32Item, ArtigoRdpmItem, CrimeItem, DispositivoLegalItem, LocalOrigemItem, MunicipalityItem, NaturezaItem, PostoGraduacaoItem, SaveArt29Request, SaveArt32Request, SaveArtigoRdpmRequest, SaveCrimeRequest, SaveDispositivoLegalRequest, SavePostoGraduacaoRequest, SaveTransgressionRequest, SaveTipoUsuarioRequest, TipoUsuarioItem, TransgressionItem};

pub async fn list_crimes(pool: &PgPool, limit: i64) -> Result<Vec<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT c.id::text AS id,
               dl.nome AS dispositivo_legal,
               c.dispositivo_legal_id::text AS dispositivo_legal_id,
               c.artigo, c.descricao_artigo,
               c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM crimes_contravencoes c
        LEFT JOIN dispositivos_legais dl ON dl.id = c.dispositivo_legal_id
        WHERE coalesce(c.ativo, true) = true
        ORDER BY dl.nome, c.artigo
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
            SET dispositivo_legal_id = $2::uuid,
                artigo               = $3,
                descricao_artigo     = $4,
                paragrafo            = $5,
                inciso               = $6,
                alinea               = $7
            WHERE id = $1::uuid
            "#,
        )
        .bind(id)
        .bind(request.dispositivo_legal_id.as_deref())
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
                dispositivo_legal_id, artigo, descricao_artigo,
                paragrafo, inciso, alinea, ativo
            )
            VALUES ($1::uuid, $2, $3, $4, $5, $6, true)
            RETURNING id::text
            "#,
        )
        .bind(request.dispositivo_legal_id.as_deref())
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
    if let Some(art_id) = request.artigo_id.as_deref() {
        if !art_id.is_empty() {
            let (count,): (i64,) = sqlx::query_as(
                r#"
                SELECT count(*)::bigint FROM transgressoes
                WHERE artigo_id = $1::uuid
                  AND ($2::text IS NULL OR lower(inciso) = lower($2))
                  AND ($3::uuid IS NULL OR id != $3::uuid)
                "#,
            )
            .bind(art_id)
            .bind(request.inciso.as_deref())
            .bind(request.id.as_deref())
            .fetch_one(&mut **tx)
            .await?;
            if count > 0 {
                return Err(AppError::Domain(
                    "ja existe transgressao com esse artigo e inciso".to_string(),
                ));
            }
        }
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            r#"
            UPDATE transgressoes
            SET artigo_id = $2::uuid,
                inciso    = COALESCE($3, ''),
                texto     = $4
            WHERE id = $1::uuid
            "#,
        )
        .bind(id)
        .bind(request.artigo_id.as_deref())
        .bind(request.inciso.as_deref())
        .bind(&request.texto)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            r#"
            INSERT INTO transgressoes (artigo_id, inciso, texto, ativo, created_at)
            VALUES ($1::uuid, COALESCE($2, ''), $3, true, CURRENT_TIMESTAMP)
            RETURNING id::text
            "#,
        )
        .bind(request.artigo_id.as_deref())
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
               dl.nome AS dispositivo_legal,
               c.dispositivo_legal_id::text AS dispositivo_legal_id,
               c.artigo, c.descricao_artigo,
               c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM crimes_contravencoes c
        LEFT JOIN dispositivos_legais dl ON dl.id = c.dispositivo_legal_id
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
        SELECT t.id::text AS id,
               ar.artigo AS artigo,
               ar.natureza AS natureza,
               t.artigo_id::text AS artigo_id,
               t.inciso, t.texto, t.ativo
        FROM transgressoes t
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = t.artigo_id
        WHERE coalesce(t.ativo, true) = true
        ORDER BY ar.artigo NULLS LAST, t.inciso NULLS LAST
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
        SELECT t.id::text AS id,
               ar.artigo AS artigo,
               ar.natureza AS natureza,
               t.artigo_id::text AS artigo_id,
               t.inciso, t.texto, t.ativo
        FROM transgressoes t
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = t.artigo_id
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

pub async fn list_art32(pool: &PgPool, limit: i64) -> Result<Vec<Art32Item>, sqlx::Error> {
    sqlx::query_as::<_, Art32Item>(
        r#"
        SELECT id::text AS id, inciso, texto, ativo
        FROM infracoes_estatuto_art32
        WHERE coalesce(ativo, true) = true
        ORDER BY length(inciso), inciso
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn save_art32(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveArt32Request,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM infracoes_estatuto_art32
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
        sqlx::query("UPDATE infracoes_estatuto_art32 SET inciso = $2, texto = $3 WHERE id = $1::uuid")
            .bind(id)
            .bind(&request.inciso)
            .bind(&request.texto)
            .execute(&mut **tx)
            .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO infracoes_estatuto_art32 (inciso, texto, ativo) VALUES ($1, $2, true) RETURNING id::text",
        )
        .bind(&request.inciso)
        .bind(&request.texto)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn soft_delete_art32(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE infracoes_estatuto_art32 SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn get_art32_by_id(pool: &PgPool, id: &str) -> Result<Option<Art32Item>, sqlx::Error> {
    sqlx::query_as::<_, Art32Item>(
        "SELECT id::text AS id, inciso, texto, ativo FROM infracoes_estatuto_art32 WHERE id = $1::uuid",
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
        "SELECT id::text AS id, nome, tipo, ativo FROM postos_graduacoes WHERE coalesce(ativo, true) = true ORDER BY nome",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_posto_graduacao_by_id(pool: &PgPool, id: &str) -> Result<Option<PostoGraduacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, PostoGraduacaoItem>(
        "SELECT id::text AS id, nome, tipo, ativo FROM postos_graduacoes WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn save_posto_graduacao(
    tx: &mut Transaction<'_, Postgres>,
    request: &SavePostoGraduacaoRequest,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM postos_graduacoes
        WHERE lower(nome) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.nome)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe posto/graduacao com nome '{}'", request.nome)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            "UPDATE postos_graduacoes SET nome = $2, tipo = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&request.nome)
        .bind(&request.tipo)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO postos_graduacoes (nome, tipo, ativo, created_at, updated_at) VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id::text",
        )
        .bind(&request.nome)
        .bind(&request.tipo)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn soft_delete_posto_graduacao(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE postos_graduacoes SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn list_tipos_usuario(pool: &PgPool) -> Result<Vec<TipoUsuarioItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoUsuarioItem>(
        "SELECT id::text AS id, nome, ativo FROM tipos_usuario WHERE coalesce(ativo, true) = true ORDER BY nome",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_tipo_usuario_by_id(pool: &PgPool, id: &str) -> Result<Option<TipoUsuarioItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoUsuarioItem>(
        "SELECT id::text AS id, nome, ativo FROM tipos_usuario WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn save_tipo_usuario(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveTipoUsuarioRequest,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM tipos_usuario
        WHERE lower(nome) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.nome)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe tipo de usuario com nome '{}'", request.nome)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query("UPDATE tipos_usuario SET nome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid")
            .bind(id)
            .bind(&request.nome)
            .execute(&mut **tx)
            .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO tipos_usuario (nome, ativo, created_at, updated_at) VALUES ($1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id::text",
        )
        .bind(&request.nome)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn soft_delete_tipo_usuario(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tipos_usuario SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn list_naturezas(pool: &PgPool) -> Result<Vec<NaturezaItem>, sqlx::Error> {
    sqlx::query_as::<_, NaturezaItem>(
        "SELECT id::text AS id, codigo AS nome, ativo FROM natureza_transgressao WHERE coalesce(ativo, true) = true ORDER BY codigo",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_dispositivos_legais(pool: &PgPool) -> Result<Vec<DispositivoLegalItem>, sqlx::Error> {
    sqlx::query_as::<_, DispositivoLegalItem>(
        "SELECT id::text AS id, nome, ativo FROM dispositivos_legais WHERE coalesce(ativo, true) = true ORDER BY nome",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_dispositivo_legal_by_id(pool: &PgPool, id: &str) -> Result<Option<DispositivoLegalItem>, sqlx::Error> {
    sqlx::query_as::<_, DispositivoLegalItem>(
        "SELECT id::text AS id, nome, ativo FROM dispositivos_legais WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn save_dispositivo_legal(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveDispositivoLegalRequest,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM dispositivos_legais
        WHERE lower(nome) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.nome)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe dispositivo legal com nome '{}'", request.nome)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            "UPDATE dispositivos_legais SET nome = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&request.nome)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO dispositivos_legais (nome) VALUES ($1) RETURNING id::text",
        )
        .bind(&request.nome)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn soft_delete_dispositivo_legal(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE dispositivos_legais SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn list_artigos_rdpm(pool: &PgPool) -> Result<Vec<ArtigoRdpmItem>, sqlx::Error> {
    sqlx::query_as::<_, ArtigoRdpmItem>(
        r#"
        SELECT id::text AS id,
               artigo || ' (' || natureza || ')' AS nome,
               artigo, natureza, ativo
        FROM artigo_rdpm_natureza_transgressao
        WHERE coalesce(ativo, true) = true
        ORDER BY artigo
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn get_artigo_rdpm_by_id(pool: &PgPool, id: &str) -> Result<Option<ArtigoRdpmItem>, sqlx::Error> {
    sqlx::query_as::<_, ArtigoRdpmItem>(
        r#"
        SELECT id::text AS id,
               artigo || ' (' || natureza || ')' AS nome,
               artigo, natureza, ativo
        FROM artigo_rdpm_natureza_transgressao
        WHERE id = $1::uuid
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn save_artigo_rdpm(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveArtigoRdpmRequest,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM artigo_rdpm_natureza_transgressao
        WHERE lower(artigo) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.artigo)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe artigo RDPM '{}'", request.artigo)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            "UPDATE artigo_rdpm_natureza_transgressao SET artigo = $2, natureza = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&request.artigo)
        .bind(&request.natureza)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO artigo_rdpm_natureza_transgressao (artigo, natureza) VALUES ($1, $2) RETURNING id::text",
        )
        .bind(&request.artigo)
        .bind(&request.natureza)
        .fetch_one(&mut **tx)
        .await?;
        Ok(new_id)
    }
}

pub async fn soft_delete_artigo_rdpm(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE artigo_rdpm_natureza_transgressao SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
