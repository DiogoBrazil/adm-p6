use bcrypt::{hash, DEFAULT_COST};
use sqlx::{PgPool, Postgres, Transaction};

use crate::error::AppError;

use super::domain::{SaveUserRequest, UserListItem, UserListResult, UserProcessItem, UserStatistics};

const USER_LIST_SELECT: &str = r#"
    SELECT u.id::text AS id, u.nome, u.matricula,
           pg.nome_posto_graduacao AS posto_graduacao,
           tu.nome_tipo_usuario AS tipo_usuario,
           u.email,
           pa.nome_perfil AS perfil,
           u.is_encarregado, u.is_operador, u.ativo
    FROM usuarios u
    JOIN postos_graduacoes pg ON pg.id = u.posto_graduacao_id
    JOIN tipos_usuario tu     ON tu.id = u.tipo_usuario_id
    LEFT JOIN perfis_acesso pa ON pa.id = u.perfil_id
"#;

const USER_PROCESS_QUERY: &str = r#"
    SELECT p.id::text AS id, p.tipo_geral, p.tipo_detalhe, p.numero, p.resumo_fatos,
           p.data_instauracao, p.data_conclusao, p.concluido
    FROM v_processos p
    WHERE coalesce(p.ativo, true) = true
"#;

pub async fn list_paginated(
    pool: &PgPool,
    search: Option<&str>,
    page: i64,
    per_page: i64,
) -> Result<UserListResult, sqlx::Error> {
    let page = page.max(1);
    let per_page = per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let pattern = search.map(|s| format!("%{s}%"));
    let pat = pattern.as_deref();

    let (total,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint
        FROM usuarios
        WHERE coalesce(ativo, true) = true
          AND ($1::text IS NULL OR nome ILIKE $1 OR matricula ILIKE $1)
        "#,
    )
    .bind(pat)
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, UserListItem>(&format!(
        r#"{USER_LIST_SELECT}
        WHERE coalesce(u.ativo, true) = true
          AND ($1::text IS NULL OR u.nome ILIKE $1 OR u.matricula ILIKE $1)
        ORDER BY u.nome
        LIMIT $2 OFFSET $3
        "#
    ))
    .bind(pat)
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(UserListResult { items, total, page, per_page })
}

async fn check_matricula_unique(
    tx: &mut Transaction<'_, Postgres>,
    matricula: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM usuarios
        WHERE lower(matricula) = lower($1)
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(matricula)
    .bind(exclude_id)
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("matricula '{}' ja esta em uso", matricula)));
    }
    Ok(())
}

async fn check_email_unique(
    tx: &mut Transaction<'_, Postgres>,
    email: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let (count,): (i64,) = sqlx::query_as(
        r#"
        SELECT count(*)::bigint FROM usuarios
        WHERE lower(email) = lower($1)
          AND email IS NOT NULL
          AND coalesce(ativo, true) = true
          AND ($2::uuid IS NULL OR id != $2::uuid)
        "#,
    )
    .bind(email)
    .bind(exclude_id)
    .fetch_one(&mut **tx)
    .await?;
    if count > 0 {
        return Err(AppError::Domain(format!("email '{}' ja esta em uso", email)));
    }
    Ok(())
}

pub async fn create(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveUserRequest,
) -> Result<String, AppError> {
    check_matricula_unique(tx, &request.matricula, None).await?;
    if let Some(email) = request.email.as_deref().filter(|e| !e.trim().is_empty()) {
        check_email_unique(tx, email, None).await?;
    }
    let password_hash = match request.senha.as_deref() {
        Some(value) if !value.is_empty() => Some(
            hash(value, DEFAULT_COST)
                .map_err(|error| AppError::Domain(format!("falha ao gerar hash bcrypt: {error}")))?,
        ),
        _ => None,
    };

    let id: String = sqlx::query_scalar(
        r#"
        INSERT INTO usuarios (
            tipo_usuario_id, posto_graduacao_id, perfil_id,
            nome, matricula, is_encarregado, is_operador,
            email, senha, ativo, created_at, updated_at
        )
        SELECT pg.tipo_usuario_id, pg.id, pa.id,
               upper($2), $3, $4, $5, lower($6), $7, true,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM postos_graduacoes pg
        LEFT JOIN perfis_acesso pa ON pa.nome_perfil = $8
        WHERE pg.nome_posto_graduacao = $1
        RETURNING id::text
        "#,
    )
    .bind(&request.posto_graduacao)  // $1
    .bind(&request.nome)             // $2
    .bind(&request.matricula)        // $3
    .bind(request.is_encarregado)    // $4
    .bind(request.is_operador)       // $5
    .bind(request.email.as_deref())  // $6
    .bind(password_hash.as_deref())  // $7
    .bind(request.perfil.as_deref()) // $8
    .fetch_one(&mut **tx)
    .await?;

    Ok(id)
}

pub async fn update(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveUserRequest,
) -> Result<String, AppError> {
    let id = request
        .id
        .as_deref()
        .ok_or_else(|| AppError::Domain("id e obrigatorio para atualizar usuario".to_string()))?;

    check_matricula_unique(tx, &request.matricula, Some(id)).await?;
    if let Some(email) = request.email.as_deref().filter(|e| !e.trim().is_empty()) {
        check_email_unique(tx, email, Some(id)).await?;
    }

    let password_hash = match request.senha.as_deref() {
        Some(value) if !value.is_empty() => Some(
            hash(value, DEFAULT_COST)
                .map_err(|error| AppError::Domain(format!("falha ao gerar hash bcrypt: {error}")))?,
        ),
        _ => None,
    };

    sqlx::query(
        r#"
        UPDATE usuarios
        SET tipo_usuario_id    = (
                SELECT pg.tipo_usuario_id FROM postos_graduacoes pg
                WHERE pg.nome_posto_graduacao = $2
            ),
            posto_graduacao_id = (SELECT id FROM postos_graduacoes WHERE nome_posto_graduacao = $2),
            perfil_id          = (SELECT id FROM perfis_acesso    WHERE nome_perfil = $8),
            nome               = upper($3),
            matricula          = $4,
            is_encarregado     = $5,
            is_operador        = $6,
            email              = lower($7),
            senha              = coalesce($9, senha),
            updated_at         = CURRENT_TIMESTAMP
        WHERE id = $1::uuid
        "#,
    )
    .bind(id)                        // $1
    .bind(&request.posto_graduacao)  // $2
    .bind(&request.nome)             // $3
    .bind(&request.matricula)        // $4
    .bind(request.is_encarregado)    // $5
    .bind(request.is_operador)       // $6
    .bind(request.email.as_deref())  // $7
    .bind(request.perfil.as_deref()) // $8
    .bind(password_hash.as_deref())  // $9
    .execute(&mut **tx)
    .await?;

    Ok(id.to_string())
}

pub async fn deactivate(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE usuarios SET ativo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn reactivate(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE usuarios SET ativo = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn list_encarregados(pool: &PgPool) -> Result<Vec<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!(
        r#"{USER_LIST_SELECT}
        WHERE coalesce(u.ativo, true) = true
          AND (coalesce(u.is_encarregado, false) = true OR coalesce(u.is_operador, false) = true)
        ORDER BY u.nome
        "#
    ))
    .fetch_all(pool)
    .await
}

pub async fn get_by_id(pool: &PgPool, id: &str) -> Result<Option<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!(
        r#"{USER_LIST_SELECT}
        WHERE u.id = $1::uuid
        "#
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn statistics(pool: &PgPool, user_id: &str) -> Result<UserStatistics, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct StatsRow {
        encarregado_sindicancia: i64,
        encarregado_pads: i64,
        encarregado_ipm: i64,
        encarregado_feito_preliminar: i64,
        encarregado_cp: i64,
        encarregado_pad: i64,
        encarregado_pade: i64,
        encarregado_cd: i64,
        encarregado_cj: i64,
        escrivao: i64,
    }

    let s: StatsRow = sqlx::query_as(
        r#"
        SELECT
          count(*) FILTER (WHERE tipo_detalhe IN ('SR','SV') AND responsavel_id = $1::uuid)::bigint
            AS encarregado_sindicancia,
          count(*) FILTER (WHERE tipo_detalhe = 'PADS' AND responsavel_id = $1::uuid)::bigint
            AS encarregado_pads,
          count(*) FILTER (WHERE tipo_detalhe = 'IPM' AND responsavel_id = $1::uuid)::bigint
            AS encarregado_ipm,
          count(*) FILTER (WHERE tipo_detalhe = 'FP' AND responsavel_id = $1::uuid)::bigint
            AS encarregado_feito_preliminar,
          count(*) FILTER (WHERE tipo_detalhe = 'CP' AND responsavel_id = $1::uuid)::bigint
            AS encarregado_cp,
          count(*) FILTER (WHERE tipo_detalhe = 'PAD'
            AND (responsavel_id = $1::uuid OR presidente_id = $1::uuid
                 OR interrogante_id = $1::uuid OR escrivao_processo_id = $1::uuid))::bigint
            AS encarregado_pad,
          count(*) FILTER (WHERE tipo_detalhe = 'PADE' AND responsavel_id = $1::uuid)::bigint
            AS encarregado_pade,
          count(*) FILTER (WHERE tipo_detalhe = 'CD'
            AND (responsavel_id = $1::uuid OR presidente_id = $1::uuid
                 OR interrogante_id = $1::uuid OR escrivao_processo_id = $1::uuid))::bigint
            AS encarregado_cd,
          count(*) FILTER (WHERE tipo_detalhe = 'CJ'
            AND (responsavel_id = $1::uuid OR presidente_id = $1::uuid
                 OR interrogante_id = $1::uuid OR escrivao_processo_id = $1::uuid))::bigint
            AS encarregado_cj,
          count(*) FILTER (WHERE escrivao_id = $1::uuid OR escrivao_processo_id = $1::uuid)::bigint
            AS escrivao
        FROM v_processos
        WHERE coalesce(ativo, true) = true
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    #[derive(sqlx::FromRow)]
    struct EnvolvidoRow {
        envolvido_sindicado: i64,
        envolvido_acusado: i64,
        envolvido_indiciado: i64,
        envolvido_investigado: i64,
    }

    let e: EnvolvidoRow = sqlx::query_as(
        r#"
        SELECT
          count(*) FILTER (WHERE se.codigo = 'Sindicado')::bigint   AS envolvido_sindicado,
          count(*) FILTER (WHERE se.codigo = 'Acusado')::bigint     AS envolvido_acusado,
          count(*) FILTER (WHERE se.codigo = 'Indiciado')::bigint   AS envolvido_indiciado,
          count(*) FILTER (WHERE se.codigo = 'Investigado')::bigint AS envolvido_investigado
        FROM procedimento_pms_envolvidos pme
        JOIN v_processos p ON p.id = pme.procedimento_id
        JOIN status_envolvido se ON se.id = pme.status_pm_id
        WHERE pme.pm_id = $1::uuid AND coalesce(p.ativo, true) = true
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(UserStatistics {
        encarregado_sindicancia: s.encarregado_sindicancia,
        encarregado_pads: s.encarregado_pads,
        encarregado_ipm: s.encarregado_ipm,
        encarregado_feito_preliminar: s.encarregado_feito_preliminar,
        encarregado_cp: s.encarregado_cp,
        encarregado_pad: s.encarregado_pad,
        encarregado_pade: s.encarregado_pade,
        encarregado_cd: s.encarregado_cd,
        encarregado_cj: s.encarregado_cj,
        escrivao: s.escrivao,
        envolvido_sindicado: e.envolvido_sindicado,
        envolvido_acusado: e.envolvido_acusado,
        envolvido_indiciado: e.envolvido_indiciado,
        envolvido_investigado: e.envolvido_investigado,
    })
}

pub async fn proceedings_as_responsible(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(&format!(
        "{USER_PROCESS_QUERY} AND p.responsavel_id = $1::uuid ORDER BY p.data_instauracao DESC"
    ))
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn proceedings_as_escrivao(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(&format!(
        "{USER_PROCESS_QUERY} AND (p.escrivao_id = $1::uuid OR p.escrivao_processo_id = $1::uuid) ORDER BY p.data_instauracao DESC"
    ))
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn proceedings_as_involved(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(
        r#"
        SELECT DISTINCT p.id::text AS id, p.tipo_geral, p.tipo_detalhe, p.numero, p.resumo_fatos,
               p.data_instauracao, p.data_conclusao, p.concluido
        FROM v_processos p
        JOIN procedimento_pms_envolvidos pme ON pme.procedimento_id = p.id AND pme.pm_id = $1::uuid
        JOIN status_envolvido se ON se.id = pme.status_pm_id
        WHERE coalesce(p.ativo, true) = true
          AND se.codigo IN ('Sindicado','Acusado','Indiciado','Investigado')
        ORDER BY p.data_instauracao DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}
