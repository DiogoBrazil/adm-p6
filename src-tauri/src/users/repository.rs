use bcrypt::{hash, DEFAULT_COST};
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::error::AppError;
use crate::users::domain::{
    ContagemRotulada, SaveUserRequest, UserListItem, UserListResult, UserProcessItem,
    UserStatistics,
};

/// Projeção comum de policial militar + conta (quando existe).
const SELECT_PM: &str = r#"
    SELECT pm.id::text                  AS id,
           pm.nome                      AS nome,
           pm.matricula                 AS matricula,
           pg.id::text                  AS posto_graduacao_id,
           pg.nome                      AS posto_graduacao,
           pg.sigla                     AS posto_graduacao_sigla,
           ch.nome                      AS circulo_hierarquico,
           pm.is_encarregado            AS is_encarregado,
           pm.ativo                     AS ativo,
           u.id::text                   AS conta_id,
           u.email                      AS conta_email,
           pa.id::text                  AS conta_perfil_id,
           pa.nome                      AS conta_perfil,
           u.ativo                      AS conta_ativa
    FROM policiais_militares pm
    JOIN postos_graduacoes pg     ON pg.id = pm.posto_graduacao_id
    JOIN circulos_hierarquicos ch ON ch.id = pg.circulo_hierarquico_id
    LEFT JOIN usuarios u          ON u.policial_militar_id = pm.id
    LEFT JOIN perfis_acesso pa    ON pa.id = u.perfil_id
"#;

pub async fn list_paginated(
    pool: &PgPool,
    search: Option<&str>,
    page: i64,
    per_page: i64,
) -> Result<UserListResult, sqlx::Error> {
    let page = page.max(1);
    let per_page = per_page.clamp(1, 200);
    let termo = search.map(|s| format!("%{}%", s.trim().to_lowercase()));

    let total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM policiais_militares pm
          WHERE ($1::text IS NULL
                 OR lower(pm.nome) LIKE $1 OR lower(pm.matricula) LIKE $1)",
    )
    .bind(termo.as_deref())
    .fetch_one(pool)
    .await?;

    let items = sqlx::query_as::<_, UserListItem>(&format!(
        "{SELECT_PM}
         WHERE ($1::text IS NULL
                OR lower(pm.nome) LIKE $1 OR lower(pm.matricula) LIKE $1)
         ORDER BY pm.nome
         LIMIT $2 OFFSET $3"
    ))
    .bind(termo.as_deref())
    .bind(per_page)
    .bind((page - 1) * per_page)
    .fetch_all(pool)
    .await?;

    Ok(UserListResult {
        items,
        total,
        page,
        per_page,
    })
}

pub async fn get_by_id(pool: &PgPool, id: &str) -> Result<Option<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!("{SELECT_PM} WHERE pm.id = $1::uuid"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// Militares ativos, **sem limite** — é a lista de *opções* dos seletores de
/// militar, não uma listagem de tela.
///
/// `list_paginated` não serve aqui: ela pagina e trava o `per_page` em 200, e a
/// tela pedia 500 achando que recebia 500. Com 235 militares no efetivo, os 35
/// últimos em ordem alfabética simplesmente não apareciam em seletor nenhum —
/// sem erro e sem aviso, porque o clamp corta calado. Lista de opções não pagina.
///
/// Filtra `ativo` porque é lista de opções (princípio 6): quem foi desativado não
/// pode ser escolhido de novo. Leitura de registro já gravado continua não
/// filtrando — um envolvido lançado antes da desativação segue aparecendo.
pub async fn list_ativos(pool: &PgPool) -> Result<Vec<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!(
        "{SELECT_PM}
         WHERE pm.ativo
         ORDER BY pm.nome"
    ))
    .fetch_all(pool)
    .await
}

/// Encarregados ativos, **sem limite** — mesma razão de `list_ativos`, recortada
/// a quem pode ser designado.
pub async fn list_encarregados(pool: &PgPool) -> Result<Vec<UserListItem>, sqlx::Error> {
    sqlx::query_as::<_, UserListItem>(&format!(
        "{SELECT_PM}
         WHERE pm.ativo AND pm.is_encarregado
         ORDER BY pm.nome"
    ))
    .fetch_all(pool)
    .await
}

/// Grava o policial militar e, quando houver credenciais, a conta de acesso —
/// tudo na mesma transação. São duas entidades; continua sendo um só formulário.
pub async fn save(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveUserRequest,
) -> Result<(String, Option<String>), AppError> {
    let nome = request.nome.trim().to_uppercase();
    let matricula = request.matricula.trim();

    let pm_id: String = match request.id.as_deref() {
        Some(id) => sqlx::query_scalar(
            "UPDATE policiais_militares
                    SET nome = $2, matricula = $3, posto_graduacao_id = $4::uuid,
                        is_encarregado = $5, updated_at = now()
                  WHERE id = $1::uuid
              RETURNING id::text",
        )
        .bind(id)
        .bind(&nome)
        .bind(matricula)
        .bind(&request.posto_graduacao_id)
        .bind(request.is_encarregado)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| {
            AppError::Domain(
                "Este militar não existe mais no cadastro. Recarregue a página.".to_string(),
            )
        })?,
        None => sqlx::query_scalar(
            "INSERT INTO policiais_militares (nome, matricula, posto_graduacao_id, is_encarregado)
                 VALUES ($1, $2, $3::uuid, $4)
              RETURNING id::text",
        )
        .bind(&nome)
        .bind(matricula)
        .bind(&request.posto_graduacao_id)
        .bind(request.is_encarregado)
        .fetch_one(&mut **tx)
        .await?,
    };

    let conta_atual: Option<String> =
        sqlx::query_scalar("SELECT id::text FROM usuarios WHERE policial_militar_id = $1::uuid")
            .bind(&pm_id)
            .fetch_optional(&mut **tx)
            .await?;

    let conta_id = match (&request.conta, conta_atual) {
        (None, Some(existente)) => {
            // Deixou de operar o sistema: a conta é desativada, nunca apagada —
            // ela é referenciada por andamentos, anexos e auditoria.
            sqlx::query(
                "UPDATE usuarios SET ativo = false, updated_at = now() WHERE id = $1::uuid",
            )
            .bind(&existente)
            .execute(&mut **tx)
            .await?;
            Some(existente)
        }
        (None, None) => None,
        (Some(conta), existente) => {
            let email = conta.email.trim().to_lowercase();
            let senha_hash = match conta.senha.as_deref().filter(|s| !s.is_empty()) {
                Some(senha) => Some(
                    hash(senha, DEFAULT_COST)
                        .map_err(|erro| AppError::Interno(format!("hash da senha: {erro}")))?,
                ),
                None => None,
            };

            match existente {
                Some(id) => {
                    sqlx::query(
                        "UPDATE usuarios
                            SET email = $2, perfil_id = $3::uuid,
                                senha_hash = COALESCE($4, senha_hash),
                                ativo = true, updated_at = now()
                          WHERE id = $1::uuid",
                    )
                    .bind(&id)
                    .bind(&email)
                    .bind(&conta.perfil_id)
                    .bind(senha_hash.as_deref())
                    .execute(&mut **tx)
                    .await?;
                    Some(id)
                }
                None => {
                    let senha_hash = senha_hash.ok_or_else(|| {
                        AppError::Domain(
                            "Defina uma senha para a nova conta de acesso.".to_string(),
                        )
                    })?;
                    let id: String = sqlx::query_scalar(
                        "INSERT INTO usuarios (policial_militar_id, email, senha_hash, perfil_id)
                         VALUES ($1::uuid, $2, $3, $4::uuid)
                      RETURNING id::text",
                    )
                    .bind(&pm_id)
                    .bind(&email)
                    .bind(&senha_hash)
                    .bind(&conta.perfil_id)
                    .fetch_one(&mut **tx)
                    .await?;
                    Some(id)
                }
            }
        }
    };

    Ok((pm_id, conta_id))
}

pub async fn set_ativo(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
    ativo: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE policiais_militares SET ativo = $2, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(id)
    .bind(ativo)
    .execute(&mut **tx)
    .await?;
    // A conta acompanha o militar: desativar o cadastro tira o acesso junto.
    sqlx::query(
        "UPDATE usuarios SET ativo = $2, updated_at = now() WHERE policial_militar_id = $1::uuid",
    )
    .bind(id)
    .bind(ativo)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Quantos administradores ativos existiriam se a conta indicada saísse do ar.
/// Sustenta a trava que impede o sistema de ficar sem ninguém que administre.
pub async fn outros_administradores_ativos<'e, E: PgExecutor<'e>>(
    executor: E,
    conta_excluida: Option<&str>,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT count(*)
           FROM usuarios u
           JOIN perfis_acesso pa ON pa.id = u.perfil_id
          WHERE u.ativo AND pa.ativo AND pa.pode_administrar
            AND ($1::uuid IS NULL OR u.id <> $1::uuid)",
    )
    .bind(conta_excluida)
    .fetch_one(executor)
    .await
}

pub async fn conta_do_policial<'e, E: PgExecutor<'e>>(
    executor: E,
    policial_id: &str,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT id::text FROM usuarios WHERE policial_militar_id = $1::uuid")
        .bind(policial_id)
        .fetch_optional(executor)
        .await
}

pub async fn statistics(pool: &PgPool, policial_id: &str) -> Result<UserStatistics, sqlx::Error> {
    let designacoes_por_papel = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT pp.id::text AS id, pp.nome AS rotulo, count(*) AS total
           FROM processo_designacoes d
           JOIN papeis_processo pp ON pp.id = d.papel_id
          WHERE d.policial_militar_id = $1::uuid
          GROUP BY pp.id, pp.nome
          ORDER BY total DESC, pp.nome",
    )
    .bind(policial_id)
    .fetch_all(pool)
    .await?;

    let designacoes_por_apuratorio = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT a.id::text AS id, a.sigla AS rotulo, count(*) AS total
           FROM processo_designacoes d
           JOIN apuratorios a ON a.id = d.apuratorio_id
          WHERE d.policial_militar_id = $1::uuid
          GROUP BY a.id, a.sigla
          ORDER BY total DESC, a.sigla",
    )
    .bind(policial_id)
    .fetch_all(pool)
    .await?;

    let envolvimentos_por_status = sqlx::query_as::<_, ContagemRotulada>(
        "SELECT se.id::text AS id, se.nome AS rotulo, count(*) AS total
           FROM processo_envolvidos e
           JOIN status_envolvido se ON se.id = e.status_envolvido_id
          WHERE e.policial_militar_id = $1::uuid
          GROUP BY se.id, se.nome
          ORDER BY total DESC, se.nome",
    )
    .bind(policial_id)
    .fetch_all(pool)
    .await?;

    Ok(UserStatistics {
        designacoes_por_papel,
        designacoes_por_apuratorio,
        envolvimentos_por_status,
    })
}

/// Colunas de processo das duas listagens abaixo. Saem de
/// `v_processos_detalhados` (criada na 0004 e ampliada na 0014), que já resolve
/// os catálogos —
/// antes esta composição estava escrita aqui, em `proceedings`, em
/// `maps_reports` e em `deadlines`.
const COLUNAS_PROCESSO: &str = r#"
           v.id::text            AS id,
           v.apuratorio_id::text AS apuratorio_id,
           v.apuratorio_sigla,
           v.apuratorio_nome,
           v.tipo_apuratorio,
           v.numero_documento,
           v.numero_controle,
           v.resumo_fatos,
           v.data_instauracao,
           v.data_conclusao
"#;

/// Processos em que o militar foi designado. `papel_id` nulo traz todos os papéis
/// — o chamador escolhe, em vez de existirem comandos separados por papel.
pub async fn proceedings_as_designated(
    pool: &PgPool,
    policial_id: &str,
    papel_id: Option<&str>,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(&format!(
        "SELECT {COLUNAS_PROCESSO},
                pp.nome    AS papel,
                NULL::text AS status_envolvido
         FROM v_processos_detalhados v
         JOIN processo_designacoes d ON d.processo_id = v.id
         JOIN papeis_processo pp     ON pp.id = d.papel_id
         WHERE d.policial_militar_id = $1::uuid
           AND ($2::uuid IS NULL OR d.papel_id = $2::uuid)
           AND v.ativo
         ORDER BY v.data_instauracao DESC"
    ))
    .bind(policial_id)
    .bind(papel_id)
    .fetch_all(pool)
    .await
}

pub async fn proceedings_as_involved(
    pool: &PgPool,
    policial_id: &str,
) -> Result<Vec<UserProcessItem>, sqlx::Error> {
    sqlx::query_as::<_, UserProcessItem>(&format!(
        "SELECT {COLUNAS_PROCESSO},
                NULL::text AS papel,
                se.nome    AS status_envolvido
         FROM v_processos_detalhados v
         JOIN processo_envolvidos e  ON e.processo_id = v.id
         JOIN status_envolvido se    ON se.id = e.status_envolvido_id
         WHERE e.policial_militar_id = $1::uuid
           AND v.ativo
         ORDER BY v.data_instauracao DESC"
    ))
    .bind(policial_id)
    .fetch_all(pool)
    .await
}

/// O que impede um militar de ser apagado, contado antes da tentativa.
///
/// As quatro FKs são `ON DELETE RESTRICT`, então o PostgreSQL já recusaria — mas
/// a mensagem dele é uma só para os quatro casos, e quem opera precisa saber
/// *qual* vínculo segurou. Ver `users::commands::users_delete`.
#[derive(Debug, Default, Clone, Copy)]
pub struct Vinculos {
    pub conta: bool,
    pub designacoes: i64,
    pub envolvimentos: i64,
    pub prazos: i64,
}

impl Vinculos {
    pub fn existe(&self) -> bool {
        self.conta || self.designacoes > 0 || self.envolvimentos > 0 || self.prazos > 0
    }
}

pub async fn vinculos(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<Vinculos, sqlx::Error> {
    let linha: (bool, i64, i64, i64) = sqlx::query_as(
        "SELECT EXISTS (SELECT 1 FROM usuarios WHERE policial_militar_id = $1::uuid),
                (SELECT count(*) FROM processo_designacoes WHERE policial_militar_id = $1::uuid),
                (SELECT count(*) FROM processo_envolvidos  WHERE policial_militar_id = $1::uuid),
                (SELECT count(*) FROM processo_prazos       WHERE autoridade_id       = $1::uuid)",
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(Vinculos {
        conta: linha.0,
        designacoes: linha.1,
        envolvimentos: linha.2,
        prazos: linha.3,
    })
}

/// Exclusão FÍSICA do militar. Só chega aqui quem não tem vínculo nenhum —
/// a conferência é do comando, e as FKs `RESTRICT` são a rede embaixo dela.
pub async fn delete(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM policiais_militares WHERE id = $1::uuid")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
