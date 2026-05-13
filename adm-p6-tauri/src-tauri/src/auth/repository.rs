use sqlx::PgPool;

use super::domain::UserAuthRow;

pub async fn find_operator_by_email(pool: &PgPool, email: &str) -> Result<Option<UserAuthRow>, sqlx::Error> {
    sqlx::query_as::<_, UserAuthRow>(
        r#"
        SELECT id, nome, email, senha, perfil, is_operador, ativo
        FROM usuarios
        WHERE lower(email) = lower($1)
          AND coalesce(is_operador, false) = true
          AND coalesce(ativo, true) = true
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
