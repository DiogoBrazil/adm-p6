use sqlx::{PgPool, Postgres, Transaction};

use crate::movements::domain::{AddMovementRequest, MovementItem, UpdateMovementRequest};

/// Andamentos ativos de um processo, do mais recente para o mais antigo.
/// Sem filtro de `ativo` nos catálogos: um tipo de andamento desativado hoje
/// precisa continuar legível nos registros que o usaram.
pub async fn list(pool: &PgPool, processo_id: &str) -> Result<Vec<MovementItem>, sqlx::Error> {
    sqlx::query_as::<_, MovementItem>(
        "SELECT a.id::text                         AS id,
                a.descricao                        AS descricao,
                a.ocorrido_em                      AS ocorrido_em,
                a.tipo_andamento_id::text          AS tipo_andamento_id,
                ta.nome                            AS tipo_andamento,
                a.registrado_por_id::text          AS registrado_por_id,
                COALESCE(u.nome_exibicao, pm.nome) AS registrado_por
           FROM processo_andamentos a
           LEFT JOIN tipos_andamento ta      ON ta.id = a.tipo_andamento_id
           LEFT JOIN usuarios u              ON u.id = a.registrado_por_id
           LEFT JOIN policiais_militares pm  ON pm.id = u.policial_militar_id
          WHERE a.processo_id = $1::uuid
            AND a.cancelado_em IS NULL
          ORDER BY a.ocorrido_em DESC",
    )
    .bind(processo_id)
    .fetch_all(pool)
    .await
}

pub async fn add(
    tx: &mut Transaction<'_, Postgres>,
    request: &AddMovementRequest,
    autor_id: &str,
) -> Result<String, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO processo_andamentos
             (processo_id, tipo_andamento_id, descricao, ocorrido_em, registrado_por_id)
         VALUES ($1::uuid, $2::uuid, $3, COALESCE($4, now()), $5::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(request.tipo_andamento_id.as_deref())
    .bind(request.descricao.trim())
    .bind(request.ocorrido_em)
    .bind(autor_id)
    .fetch_one(&mut **tx)
    .await
}

/// Corrige somente os dados que o operador informou ao registrar: tipo e
/// descrição. Autor e momento permanecem como fatos do lançamento original.
pub async fn update(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateMovementRequest,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query(
        "UPDATE processo_andamentos
            SET tipo_andamento_id = $3::uuid,
                descricao = $4
          WHERE id = $1::uuid
            AND processo_id = $2::uuid
            AND cancelado_em IS NULL",
    )
    .bind(&request.andamento_id)
    .bind(&request.processo_id)
    .bind(request.tipo_andamento_id.as_deref())
    .bind(request.descricao.trim())
    .execute(&mut **tx)
    .await?
    .rows_affected())
}

/// Andamento é fato datado: em vez de um booleano genérico, registra-se QUANDO
/// foi cancelado.
pub async fn cancel(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    andamento_id: &str,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query(
        "UPDATE processo_andamentos SET cancelado_em = now()
          WHERE id = $1::uuid AND processo_id = $2::uuid AND cancelado_em IS NULL",
    )
    .bind(andamento_id)
    .bind(processo_id)
    .execute(&mut **tx)
    .await?
    .rows_affected())
}
