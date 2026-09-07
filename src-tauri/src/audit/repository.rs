use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};

use crate::db::paginacao::Recorte;

use super::domain::{
    rotulo_da_entidade, AuditDetailItem, AuditOperationStat, AuditPageResult, AuditStatistics,
    AuditStatisticsFilter, AuditTableStat,
};

/// O autor de uma operação é uma CONTA (`usuarios`); o nome exibido pode vir do
/// policial militar vinculado ou do rótulo da própria conta técnica.
const DETAIL_SELECT: &str = r#"
    SELECT a.id::text                            AS id,
           a.entidade                            AS entidade,
           a.registro_id                         AS registro_id,
           a.operacao                            AS operacao,
           a.usuario_id::text                    AS usuario_id,
           COALESCE(u.nome_exibicao, pm.nome)    AS usuario_nome,
           pg.sigla                              AS usuario_posto,
           pm.matricula                          AS usuario_matricula,
           a.acao                                AS acao,
           a.assunto                             AS assunto,
           a.alteracoes                          AS alteracoes,
           a.ocorrido_em                         AS ocorrido_em
    FROM auditoria a
    LEFT JOIN usuarios u             ON u.id = a.usuario_id
    LEFT JOIN policiais_militares pm ON pm.id = u.policial_militar_id
    LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
"#;

/// Os três filtros da tela, escritos uma vez e usados nas duas consultas.
///
/// Contagem e página **têm de compartilhar o `WHERE`**: se divergirem, o total
/// no rodapé passa a contar um escopo que a tabela não mostra, e ninguém
/// percebe — o número simplesmente fica errado.
const FILTRO_LISTA: &str = "WHERE ($1::text IS NULL OR a.entidade  = $1)
          AND ($2::text IS NULL OR a.operacao  = $2)
          AND ($3::uuid IS NULL OR a.usuario_id = $3::uuid)";

/// Uma página da trilha de auditoria, com o total do escopo filtrado.
///
/// Antes devolvia um `Vec` recortado por `limit`/`offset` **sem total**, e a
/// tela anunciava "últimos 200 registros" porque era tudo que podia saber: não
/// havia como descobrir que existia um 201º, nem como alcançá-lo. É a mesma
/// armadilha dos seletores truncados da §8.9, desta vez na listagem.
pub async fn list(
    pool: &PgPool,
    recorte: Recorte,
    entidade: Option<&str>,
    operacao: Option<&str>,
    usuario_id: Option<&str>,
) -> Result<AuditPageResult, sqlx::Error> {
    let total: i64 =
        sqlx::query_scalar(&format!("SELECT count(*) FROM auditoria a {FILTRO_LISTA}"))
            .bind(entidade)
            .bind(operacao)
            .bind(usuario_id)
            .fetch_one(pool)
            .await?;

    let items = sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT}
        {FILTRO_LISTA}
        ORDER BY a.ocorrido_em DESC, a.id DESC
        LIMIT $4 OFFSET $5"
    ))
    .bind(entidade)
    .bind(operacao)
    .bind(usuario_id)
    .bind(recorte.per_page)
    .bind(recorte.offset)
    .fetch_all(pool)
    .await?;

    Ok(AuditPageResult {
        items,
        total,
        page: recorte.page,
        per_page: recorte.per_page,
    })
}

pub async fn get_by_id(pool: &PgPool, id: &str) -> Result<Option<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!("{DETAIL_SELECT} WHERE a.id = $1::uuid"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_by_record(
    pool: &PgPool,
    entidade: &str,
    registro_id: &str,
) -> Result<Vec<AuditDetailItem>, sqlx::Error> {
    sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT} WHERE a.entidade = $1 AND a.registro_id = $2 ORDER BY a.ocorrido_em DESC"
    ))
    .bind(entidade)
    .bind(registro_id)
    .fetch_all(pool)
    .await
}

pub async fn list_by_user(
    pool: &PgPool,
    usuario_id: &str,
    recorte: Recorte,
) -> Result<AuditPageResult, sqlx::Error> {
    let total: i64 =
        sqlx::query_scalar("SELECT count(*) FROM auditoria WHERE usuario_id = $1::uuid")
            .bind(usuario_id)
            .fetch_one(pool)
            .await?;

    let items = sqlx::query_as::<_, AuditDetailItem>(&format!(
        "{DETAIL_SELECT} WHERE a.usuario_id = $1::uuid
          ORDER BY a.ocorrido_em DESC, a.id DESC LIMIT $2 OFFSET $3"
    ))
    .bind(usuario_id)
    .bind(recorte.per_page)
    .bind(recorte.offset)
    .fetch_all(pool)
    .await?;

    Ok(AuditPageResult {
        items,
        total,
        page: recorte.page,
        per_page: recorte.per_page,
    })
}

pub async fn statistics(
    pool: &PgPool,
    filter: &AuditStatisticsFilter,
) -> Result<AuditStatistics, sqlx::Error> {
    const PERIODO: &str = "($1::date IS NULL OR a.ocorrido_em::date >= $1)
                       AND ($2::date IS NULL OR a.ocorrido_em::date <= $2)";

    let total: i64 =
        sqlx::query_scalar(&format!("SELECT count(*) FROM auditoria a WHERE {PERIODO}"))
            .bind(filter.data_inicio)
            .bind(filter.data_fim)
            .fetch_one(pool)
            .await?;

    let por_operacao = sqlx::query_as::<_, AuditOperationStat>(&format!(
        "SELECT a.operacao, count(*) AS total FROM auditoria a
          WHERE {PERIODO} GROUP BY a.operacao ORDER BY total DESC"
    ))
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_all(pool)
    .await?;

    let mut por_entidade = sqlx::query_as::<_, AuditTableStat>(&format!(
        "SELECT a.entidade, count(*) AS total FROM auditoria a
          WHERE {PERIODO} GROUP BY a.entidade ORDER BY total DESC LIMIT 15"
    ))
    .bind(filter.data_inicio)
    .bind(filter.data_fim)
    .fetch_all(pool)
    .await?;
    // O rótulo em português nasce aqui, e não na tela: um segundo mapa de
    // tabela→nome no frontend divergiria do primeiro sem ninguém notar.
    for linha in &mut por_entidade {
        linha.rotulo = rotulo_da_entidade(&linha.entidade);
    }

    Ok(AuditStatistics {
        total,
        por_operacao,
        por_entidade,
    })
}

/// Uma ação a registrar na trilha.
///
/// Struct nomeada, e não sete argumentos posicionais: `entidade`, `registro_id`,
/// `operacao`, `acao` e `assunto` são todos texto, e trocar dois de lugar
/// compila calado. O erro só apareceria meses depois, numa trilha que ninguém
/// consegue mais conferir contra o que de fato aconteceu.
pub struct Acao<'a> {
    /// Nome físico da tabela. Continua sendo o eixo do filtro e do rastreio até
    /// o banco, mas deixou de ser o que a tela mostra.
    pub entidade: &'a str,
    pub registro_id: &'a str,
    /// `CREATE`, `UPDATE` ou `DELETE` — o domínio que `ck_auditoria_operacao`
    /// aceita, e só ele. Desativação é `UPDATE`: quem diz que foi desativação é
    /// a `acao`, não um quarto verbo.
    pub operacao: &'a str,
    /// O que foi feito, em frase curta no passado: "Reabriu o apuratório".
    ///
    /// Vem do comando porque só ele sabe. Reabrir, concluir, corrigir datas e
    /// editar o cadastro gravam a MESMA `operacao` na mesma `entidade`, e essa
    /// distinção não existe em lugar nenhum do banco depois do fato.
    pub acao: &'a str,
    /// Sobre o quê, como o registro se chamava **no momento da ação**. Ver
    /// `audit::assunto`, e a justificativa do snapshot na migration `0018`.
    pub assunto: Option<String>,
    /// Diff da operação, quando houver. Preenchido nas mudanças de
    /// configuração, que alteram o comportamento futuro do sistema.
    pub alteracoes: Option<Value>,
}

/// Grava a ação na mesma transação da operação auditada.
///
/// Quando a ação **apaga a linha de verdade** — `processo_designacoes` e a
/// exclusão de catálogo são os dois casos —, o `assunto` tem de ser lido antes
/// de executá-la. Depois do `DELETE` não há de onde ler, e foi assim que 7 dos
/// 8 prazos da trilha antiga ficaram sem identificação.
pub async fn registrar(
    tx: &mut Transaction<'_, Postgres>,
    acao: Acao<'_>,
    usuario_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO auditoria
             (entidade, registro_id, operacao, usuario_id, acao, assunto, alteracoes)
         VALUES ($1, $2, $3, $4::uuid, $5, $6, $7)",
    )
    .bind(acao.entidade)
    .bind(acao.registro_id)
    .bind(acao.operacao)
    .bind(usuario_id)
    .bind(acao.acao)
    .bind(acao.assunto)
    .bind(acao.alteracoes)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
