use sqlx::PgPool;

use super::domain::UserAuthRow;

pub async fn find_operator_by_email(pool: &PgPool, email: &str) -> Result<Option<UserAuthRow>, sqlx::Error> {
    sqlx::query_as::<_, UserAuthRow>(
        r#"
        SELECT u.id::text AS id, u.nome, u.email, u.senha,
               pa.nome_perfil AS perfil, u.is_operador, u.ativo
        FROM usuarios u
        LEFT JOIN perfis_acesso pa ON u.perfil_id = pa.id
        WHERE lower(u.email) = lower($1)
          AND coalesce(u.is_operador, false) = true
          AND coalesce(u.ativo, true) = true
        LIMIT 1
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn update_password_hash(pool: &PgPool, user_id: &str, password_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE usuarios SET senha = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2")
        .bind(password_hash)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
