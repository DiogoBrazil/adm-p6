use sqlx::PgExecutor;

use super::domain::UserAuthRow;

/// Toda linha de `usuarios` é uma conta de acesso — o antigo `is_operador` deixou
/// de existir quando policial militar e conta viraram entidades separadas.
pub async fn find_account_by_email<'e, E: PgExecutor<'e>>(
    executor: E,
    email: &str,
) -> Result<Option<UserAuthRow>, sqlx::Error> {
    sqlx::query_as::<_, UserAuthRow>(
        r#"
        SELECT u.id::text                                AS id,
               COALESCE(u.nome_exibicao, pm.nome)        AS nome,
               u.email                                   AS email,
               u.senha_hash                              AS senha_hash,
               pa.nome                                   AS perfil,
               pa.pode_administrar                       AS pode_administrar,
               u.policial_militar_id::text               AS policial_militar_id,
               pm.matricula                              AS matricula,
               pg.sigla                                  AS posto_graduacao
        FROM usuarios u
        JOIN perfis_acesso pa ON pa.id = u.perfil_id
        LEFT JOIN policiais_militares pm ON pm.id = u.policial_militar_id
        LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
        WHERE lower(u.email) = lower($1)
          AND u.ativo
          AND pa.ativo
        LIMIT 1
        "#,
    )
    .bind(email)
    .fetch_optional(executor)
    .await
}

pub async fn update_password_hash<'e, E: PgExecutor<'e>>(
    executor: E,
    user_id: &str,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE usuarios SET senha_hash = $1, updated_at = now() WHERE id = $2::uuid")
        .bind(password_hash)
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}
