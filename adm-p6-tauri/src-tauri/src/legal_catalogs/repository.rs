use sqlx::{PgPool, Postgres, Transaction};

use crate::error::AppError;

use super::domain::{
    ApuratorioItem, Art29Item, Art32Item, ArtigoRdpmItem, CrimeItem, DispositivoLegalItem,
    LocalOrigemItem, MunicipalityItem, MunicipioCRUDItem,
    NaturezaItem, NaturezaTransgressaoItem, PostoGraduacaoItem,
    SaveApuratorioRequest, SaveArt29Request, SaveArt32Request,
    SaveArtigoRdpmRequest, SaveCrimeRequest, SaveDispositivoLegalRequest,
    SaveLocalOrigemRequest, SaveMunicipioDistritoRequest, SaveNaturezaTransgressaoRequest,
    SavePostoGraduacaoRequest, SaveSolucaoTipoRequest, SaveStatusEnvolvidoRequest,
    SaveSubdivisaoTextoNormativoRequest, SaveTipoApuratorioRequest, SaveTipoDocumentoRequest,
    SaveTipoPenalidadeRequest, SaveTipoPrazoRequest, SaveTipoUsuarioRequest,
    SaveTransgressionRequest, SolucaoTipoItem, StatusEnvolvidoItem, SubdivisaoTextoNormativoItem,
    TipoApuratorioItem, TipoDocumentoItem, TipoPenalidadeItem, TipoPrazoItem, TipoUsuarioItem,
    TransgressionItem,
};

pub async fn list_crimes(pool: &PgPool, limit: i64) -> Result<Vec<CrimeItem>, sqlx::Error> {
    sqlx::query_as::<_, CrimeItem>(
        r#"
        SELECT c.id::text AS id,
               dl.nome_dispositivo_legal AS dispositivo_legal,
               c.dispositivo_legal_id::text AS dispositivo_legal_id,
               c.artigo, c.descricao_artigo,
               c.paragrafo, c.inciso, c.alinea, c.ativo
        FROM crimes_contravencoes c
        LEFT JOIN dispositivos_legais dl ON dl.id = c.dispositivo_legal_id
        WHERE coalesce(c.ativo, true) = true
        ORDER BY dl.nome_dispositivo_legal, c.artigo
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
               dl.nome_dispositivo_legal AS dispositivo_legal,
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
               nt.nome_natureza AS natureza,
               t.artigo_id::text AS artigo_id,
               t.inciso, t.texto, t.ativo
        FROM transgressoes t
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = t.artigo_id
        LEFT JOIN natureza_transgressao nt ON nt.id = ar.natureza_id
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
        SELECT m.id::text AS id, m.nome_municipio_distrito, m.tipo, m.municipio_pai::text,
               CASE WHEN m.tipo = 'Distrito' AND m.municipio_pai IS NOT NULL
                    THEN m.nome_municipio_distrito || ' (' || mp.nome_municipio_distrito || ')'
                    ELSE m.nome_municipio_distrito
               END AS nome_exibicao
        FROM municipios_distritos m
        LEFT JOIN municipios_distritos mp ON mp.id = m.municipio_pai
        WHERE coalesce(m.ativo, true) = true
          AND ($1::text IS NULL OR m.nome_municipio_distrito ILIKE $1 OR mp.nome_municipio_distrito ILIKE $1)
        ORDER BY m.nome_municipio_distrito
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
               nt.nome_natureza AS natureza,
               t.artigo_id::text AS artigo_id,
               t.inciso, t.texto, t.ativo
        FROM transgressoes t
        LEFT JOIN artigo_rdpm_natureza_transgressao ar ON ar.id = t.artigo_id
        LEFT JOIN natureza_transgressao nt ON nt.id = ar.natureza_id
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
        r#"SELECT l.id::text AS id, l.nome_unidade_pm, l.cidade_id::text AS cidade_id,
                  md.nome_municipio_distrito AS cidade_nome, l.ativo
           FROM locais_origem l
           LEFT JOIN municipios_distritos md ON md.id = l.cidade_id
           WHERE coalesce(l.ativo, true) = true
           ORDER BY l.nome_unidade_pm"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn save_local_origem(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveLocalOrigemRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE locais_origem SET nome_unidade_pm = $2, cidade_id = $3::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_unidade_pm)
        .bind(&r.cidade_id)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO locais_origem (nome_unidade_pm, cidade_id, ativo) VALUES ($1, $2::uuid, true) RETURNING id::text",
        )
        .bind(&r.nome_unidade_pm)
        .bind(&r.cidade_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_local_origem(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE locais_origem SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn list_postos_graduacoes(pool: &PgPool) -> Result<Vec<PostoGraduacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, PostoGraduacaoItem>(
        r#"SELECT p.id::text AS id, p.nome_posto_graduacao, p.tipo_usuario_id::text AS tipo_usuario_id,
                  tu.nome_tipo_usuario AS tipo_usuario, p.ativo
           FROM postos_graduacoes p
           LEFT JOIN tipos_usuario tu ON tu.id = p.tipo_usuario_id
           WHERE coalesce(p.ativo, true) = true ORDER BY p.nome_posto_graduacao"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn get_posto_graduacao_by_id(pool: &PgPool, id: &str) -> Result<Option<PostoGraduacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, PostoGraduacaoItem>(
        r#"SELECT p.id::text AS id, p.nome_posto_graduacao, p.tipo_usuario_id::text AS tipo_usuario_id,
                  tu.nome_tipo_usuario AS tipo_usuario, p.ativo
           FROM postos_graduacoes p
           LEFT JOIN tipos_usuario tu ON tu.id = p.tipo_usuario_id
           WHERE p.id = $1::uuid"#,
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
        WHERE lower(nome_posto_graduacao) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.nome_posto_graduacao)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe posto/graduacao com nome '{}'", request.nome_posto_graduacao)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            "UPDATE postos_graduacoes SET nome_posto_graduacao = $2, tipo_usuario_id = $3::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&request.nome_posto_graduacao)
        .bind(&request.tipo_usuario_id)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO postos_graduacoes (nome_posto_graduacao, tipo_usuario_id, ativo, created_at, updated_at) VALUES ($1, $2::uuid, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id::text",
        )
        .bind(&request.nome_posto_graduacao)
        .bind(&request.tipo_usuario_id)
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
        "SELECT id::text AS id, nome_tipo_usuario, ativo FROM tipos_usuario WHERE coalesce(ativo, true) = true ORDER BY nome_tipo_usuario",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_tipo_usuario_by_id(pool: &PgPool, id: &str) -> Result<Option<TipoUsuarioItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoUsuarioItem>(
        "SELECT id::text AS id, nome_tipo_usuario, ativo FROM tipos_usuario WHERE id = $1::uuid",
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
        WHERE lower(nome_tipo_usuario) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.nome_tipo_usuario)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe tipo de usuario com nome '{}'", request.nome_tipo_usuario)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query("UPDATE tipos_usuario SET nome_tipo_usuario = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid")
            .bind(id)
            .bind(&request.nome_tipo_usuario)
            .execute(&mut **tx)
            .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO tipos_usuario (nome_tipo_usuario, ativo, created_at, updated_at) VALUES ($1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id::text",
        )
        .bind(&request.nome_tipo_usuario)
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
        "SELECT id::text AS id, nome_natureza AS nome, ativo FROM natureza_transgressao WHERE coalesce(ativo, true) = true ORDER BY nome_natureza",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_dispositivos_legais(pool: &PgPool) -> Result<Vec<DispositivoLegalItem>, sqlx::Error> {
    sqlx::query_as::<_, DispositivoLegalItem>(
        "SELECT id::text AS id, nome_dispositivo_legal, ativo FROM dispositivos_legais WHERE coalesce(ativo, true) = true ORDER BY nome_dispositivo_legal",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_dispositivo_legal_by_id(pool: &PgPool, id: &str) -> Result<Option<DispositivoLegalItem>, sqlx::Error> {
    sqlx::query_as::<_, DispositivoLegalItem>(
        "SELECT id::text AS id, nome_dispositivo_legal, ativo FROM dispositivos_legais WHERE id = $1::uuid",
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
        WHERE lower(nome_dispositivo_legal) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(&request.nome_dispositivo_legal)
    .bind(request.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe dispositivo legal com nome '{}'", request.nome_dispositivo_legal)));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            "UPDATE dispositivos_legais SET nome_dispositivo_legal = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&request.nome_dispositivo_legal)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO dispositivos_legais (nome_dispositivo_legal) VALUES ($1) RETURNING id::text",
        )
        .bind(&request.nome_dispositivo_legal)
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
        SELECT ar.id::text AS id,
               ar.artigo || ' (' || coalesce(nt.nome_natureza, '') || ')' AS nome,
               ar.artigo, ar.natureza_id::text AS natureza_id, nt.nome_natureza AS natureza, ar.ativo
        FROM artigo_rdpm_natureza_transgressao ar
        LEFT JOIN natureza_transgressao nt ON nt.id = ar.natureza_id
        WHERE coalesce(ar.ativo, true) = true
        ORDER BY ar.artigo
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn get_artigo_rdpm_by_id(pool: &PgPool, id: &str) -> Result<Option<ArtigoRdpmItem>, sqlx::Error> {
    sqlx::query_as::<_, ArtigoRdpmItem>(
        r#"
        SELECT ar.id::text AS id,
               ar.artigo || ' (' || coalesce(nt.nome_natureza, '') || ')' AS nome,
               ar.artigo, ar.natureza_id::text AS natureza_id, nt.nome_natureza AS natureza, ar.ativo
        FROM artigo_rdpm_natureza_transgressao ar
        LEFT JOIN natureza_transgressao nt ON nt.id = ar.natureza_id
        WHERE ar.id = $1::uuid
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

    let existing_natureza: Option<(String,)> = sqlx::query_as(
        r#"
        SELECT artigo FROM artigo_rdpm_natureza_transgressao
        WHERE natureza_id = $1::uuid
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        LIMIT 1
        "#,
    )
    .bind(&request.natureza_id)
    .bind(request.id.as_deref())
    .fetch_optional(&mut **tx)
    .await?;
    if let Some((artigo_existente,)) = existing_natureza {
        return Err(AppError::Domain(format!(
            "Esta natureza já está vinculada ao artigo '{}'. Remova o vínculo antes de prosseguir.",
            artigo_existente
        )));
    }

    if let Some(id) = request.id.as_deref() {
        sqlx::query(
            "UPDATE artigo_rdpm_natureza_transgressao SET artigo = $2, natureza_id = $3::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&request.artigo)
        .bind(&request.natureza_id)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let new_id: String = sqlx::query_scalar(
            "INSERT INTO artigo_rdpm_natureza_transgressao (artigo, natureza_id) VALUES ($1, $2::uuid) RETURNING id::text",
        )
        .bind(&request.artigo)
        .bind(&request.natureza_id)
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

// ── MunicipiosDistritos ───────────────────────────────────────────────────────

pub async fn list_municipios_distritos_crud(pool: &PgPool) -> Result<Vec<MunicipioCRUDItem>, sqlx::Error> {
    sqlx::query_as::<_, MunicipioCRUDItem>(
        r#"SELECT m.id::text AS id, m.nome_municipio_distrito, m.tipo,
                  (m.tipo = 'Distrito') AS is_distrito,
                  m.municipio_pai::text AS municipio_pai,
                  mp.nome_municipio_distrito AS municipio_pai_nome,
                  m.ativo
           FROM municipios_distritos m
           LEFT JOIN municipios_distritos mp ON mp.id = m.municipio_pai
           WHERE coalesce(m.ativo, true) = true
           ORDER BY m.nome_municipio_distrito"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn save_municipio_distrito(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveMunicipioDistritoRequest,
) -> Result<String, AppError> {
    let tipo = if r.is_distrito { "Distrito" } else { "Município" };
    let pai: Option<&str> = if r.is_distrito { r.municipio_pai.as_deref() } else { None };
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE municipios_distritos SET nome_municipio_distrito = $2, tipo = $3, municipio_pai = $4::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_municipio_distrito)
        .bind(tipo)
        .bind(pai)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO municipios_distritos (nome_municipio_distrito, tipo, municipio_pai, ativo, created_at) VALUES ($1, $2, $3::uuid, true, CURRENT_TIMESTAMP) RETURNING id::text",
        )
        .bind(&r.nome_municipio_distrito)
        .bind(tipo)
        .bind(pai)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_municipio_distrito(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE municipios_distritos SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── StatusEnvolvido ───────────────────────────────────────────────────────────

pub async fn list_status_envolvido(pool: &PgPool) -> Result<Vec<StatusEnvolvidoItem>, sqlx::Error> {
    sqlx::query_as::<_, StatusEnvolvidoItem>(
        "SELECT id::text AS id, nome_status, ativo FROM status_envolvido WHERE coalesce(ativo, true) = true ORDER BY nome_status",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_status_envolvido(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveStatusEnvolvidoRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE status_envolvido SET nome_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_status)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO status_envolvido (nome_status, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_status)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_status_envolvido(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE status_envolvido SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── SolucaoTipo ───────────────────────────────────────────────────────────────

pub async fn list_solucoes_tipo(pool: &PgPool) -> Result<Vec<SolucaoTipoItem>, sqlx::Error> {
    sqlx::query_as::<_, SolucaoTipoItem>(
        "SELECT id::text AS id, nome_solucao, ativo FROM solucoes_tipo WHERE coalesce(ativo, true) = true ORDER BY nome_solucao",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_solucao_tipo(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveSolucaoTipoRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE solucoes_tipo SET nome_solucao = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_solucao)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO solucoes_tipo (nome_solucao, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_solucao)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_solucao_tipo(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE solucoes_tipo SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── NaturezaTransgressao ──────────────────────────────────────────────────────

pub async fn list_natureza_transgressao(pool: &PgPool) -> Result<Vec<NaturezaTransgressaoItem>, sqlx::Error> {
    sqlx::query_as::<_, NaturezaTransgressaoItem>(
        "SELECT id::text AS id, nome_natureza, ativo FROM natureza_transgressao WHERE coalesce(ativo, true) = true ORDER BY nome_natureza",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_natureza_transgressao(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveNaturezaTransgressaoRequest,
) -> Result<String, AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"SELECT count(*)::bigint FROM natureza_transgressao
           WHERE lower(nome_natureza) = lower($1)
             AND coalesce(ativo, true) = true
             AND ($2::uuid IS NULL OR id != $2::uuid)"#,
    )
    .bind(&r.nome_natureza)
    .bind(r.id.as_deref())
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("ja existe natureza '{}'", r.nome_natureza)));
    }

    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE natureza_transgressao SET nome_natureza = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_natureza)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO natureza_transgressao (nome_natureza, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_natureza)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_natureza_transgressao(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE natureza_transgressao SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── TipoPenalidade ────────────────────────────────────────────────────────────

pub async fn list_tipos_penalidade(pool: &PgPool) -> Result<Vec<TipoPenalidadeItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoPenalidadeItem>(
        "SELECT id::text AS id, nome_penalidade, ativo FROM tipos_penalidade WHERE coalesce(ativo, true) = true ORDER BY nome_penalidade",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_tipo_penalidade(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveTipoPenalidadeRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE tipos_penalidade SET nome_penalidade = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_penalidade)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO tipos_penalidade (nome_penalidade, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_penalidade)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_tipo_penalidade(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tipos_penalidade SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── TipoPrazo ─────────────────────────────────────────────────────────────────

pub async fn list_tipos_prazo(pool: &PgPool) -> Result<Vec<TipoPrazoItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoPrazoItem>(
        "SELECT id::text AS id, nome_prazo, ativo FROM tipos_prazo WHERE coalesce(ativo, true) = true ORDER BY nome_prazo",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_tipo_prazo(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveTipoPrazoRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE tipos_prazo SET nome_prazo = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_prazo)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO tipos_prazo (nome_prazo, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_prazo)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_tipo_prazo(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tipos_prazo SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── TipoApuratorio ────────────────────────────────────────────────────────────

pub async fn list_tipo_apuratorios(pool: &PgPool) -> Result<Vec<TipoApuratorioItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoApuratorioItem>(
        "SELECT id::text AS id, nome_tipo_apuratorio, ativo FROM tipo_apuratorios WHERE coalesce(ativo, true) = true ORDER BY nome_tipo_apuratorio",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_tipo_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveTipoApuratorioRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE tipo_apuratorios SET nome_tipo_apuratorio = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_tipo_apuratorio)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO tipo_apuratorios (nome_tipo_apuratorio, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_tipo_apuratorio)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_tipo_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tipo_apuratorios SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── Apuratorio ────────────────────────────────────────────────────────────────

pub async fn list_apuratorios(pool: &PgPool) -> Result<Vec<ApuratorioItem>, sqlx::Error> {
    sqlx::query_as::<_, ApuratorioItem>(
        r#"SELECT a.id::text AS id, a.nome_apuratorio, a.tipo_apuratorio_id::text AS tipo_apuratorio_id,
                  ta.nome_tipo_apuratorio AS tipo_apuratorio, a.prazo_base_dias,
                  a.documento_iniciador_id::text AS documento_iniciador_id,
                  td.nome_tipo_documento AS documento_iniciador, a.ativo
           FROM apuratorios a
           JOIN tipo_apuratorios ta ON ta.id = a.tipo_apuratorio_id
           JOIN tipos_documentos td ON td.id = a.documento_iniciador_id
           WHERE coalesce(a.ativo, true) = true ORDER BY a.nome_apuratorio"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn save_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveApuratorioRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE apuratorios SET nome_apuratorio = $2, tipo_apuratorio_id = $3::uuid, prazo_base_dias = $4, documento_iniciador_id = $5::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_apuratorio)
        .bind(&r.tipo_apuratorio_id)
        .bind(r.prazo_base_dias)
        .bind(&r.documento_iniciador_id)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO apuratorios (nome_apuratorio, tipo_apuratorio_id, prazo_base_dias, documento_iniciador_id, ativo) VALUES ($1, $2::uuid, $3, $4::uuid, true) RETURNING id::text",
        )
        .bind(&r.nome_apuratorio)
        .bind(&r.tipo_apuratorio_id)
        .bind(r.prazo_base_dias)
        .bind(&r.documento_iniciador_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE apuratorios SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── TiposDocumentos ───────────────────────────────────────────────────────────

pub async fn list_tipos_documentos(pool: &PgPool) -> Result<Vec<TipoDocumentoItem>, sqlx::Error> {
    sqlx::query_as::<_, TipoDocumentoItem>(
        "SELECT id::text AS id, nome_tipo_documento, ativo FROM tipos_documentos WHERE coalesce(ativo, true) = true ORDER BY nome_tipo_documento",
    )
    .fetch_all(pool)
    .await
}

pub async fn save_tipo_documento(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveTipoDocumentoRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE tipos_documentos SET nome_tipo_documento = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_tipo_documento)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO tipos_documentos (nome_tipo_documento, ativo) VALUES ($1, true) RETURNING id::text",
        )
        .bind(&r.nome_tipo_documento)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_tipo_documento(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE tipos_documentos SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn list_subdivisao_textos_normativos(pool: &PgPool) -> Result<Vec<SubdivisaoTextoNormativoItem>, sqlx::Error> {
    sqlx::query_as::<_, SubdivisaoTextoNormativoItem>(
        r#"SELECT s.id::text AS id, s.nome_subdivisao,
                  s.dispositivo_legal_id::text AS dispositivo_legal_id,
                  dl.nome_dispositivo_legal AS dispositivo_legal, s.ativo
           FROM subdivisao_textos_normativos s
           JOIN dispositivos_legais dl ON dl.id = s.dispositivo_legal_id
           WHERE coalesce(s.ativo, true) = true
           ORDER BY dl.nome_dispositivo_legal, s.nome_subdivisao"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn save_subdivisao_texto_normativo(
    tx: &mut Transaction<'_, Postgres>,
    r: &SaveSubdivisaoTextoNormativoRequest,
) -> Result<String, AppError> {
    if let Some(id) = r.id.as_deref() {
        sqlx::query(
            "UPDATE subdivisao_textos_normativos SET nome_subdivisao = $2, dispositivo_legal_id = $3::uuid, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        )
        .bind(id)
        .bind(&r.nome_subdivisao)
        .bind(&r.dispositivo_legal_id)
        .execute(&mut **tx)
        .await?;
        Ok(id.to_string())
    } else {
        let id: String = sqlx::query_scalar(
            "INSERT INTO subdivisao_textos_normativos (nome_subdivisao, dispositivo_legal_id, ativo) VALUES ($1, $2::uuid, true) RETURNING id::text",
        )
        .bind(&r.nome_subdivisao)
        .bind(&r.dispositivo_legal_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(id)
    }
}

pub async fn soft_delete_subdivisao_texto_normativo(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE subdivisao_textos_normativos SET ativo = false WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
