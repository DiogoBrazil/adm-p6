use base64::Engine;
use sqlx::{PgPool, Postgres, Transaction};

use crate::error::AppError;
use crate::maps_reports::domain::{
    ContagemRotulada, CsvExport, DriverRankingItem, MapPeriodRequest, MapRow, ReportFilter,
    SaveMapRequest, SavedMapFull, SavedMapListItem,
};

const SAVED_MAP_COLS: &str = r#"
    m.id::text                         AS id,
    m.titulo                           AS titulo,
    m.apuratorio_id::text              AS apuratorio_id,
    a.sigla                            AS apuratorio_sigla,
    m.periodo_inicio                   AS periodo_inicio,
    m.periodo_fim                      AS periodo_fim,
    m.total_processos                  AS total_processos,
    m.total_concluidos                 AS total_concluidos,
    m.total_andamento                  AS total_andamento,
    COALESCE(u.nome_exibicao, pm.nome) AS gerado_por,
    m.created_at                       AS created_at
"#;

const SAVED_MAP_JOINS: &str = r#"
    FROM mapas_salvos m
    LEFT JOIN apuratorios a          ON a.id = m.apuratorio_id
    LEFT JOIN usuarios u             ON u.id = m.gerado_por_id
    LEFT JOIN policiais_militares pm ON pm.id = u.policial_militar_id
"#;

/// Mapa do período: uma linha por processo, com responsável vigente, envolvidos,
/// prazo vigente e último andamento. O último andamento vem da tabela relacional
/// — antes o mapa lia um jsonb que nenhum código escrevia mais.
pub async fn map_rows(
    pool: &PgPool,
    request: &MapPeriodRequest,
) -> Result<Vec<MapRow>, sqlx::Error> {
    sqlx::query_as::<_, MapRow>(
        r#"
        SELECT p.id::text                                      AS processo_id,
               a.sigla                                         AS apuratorio_sigla,
               a.sigla || ' nº ' || COALESCE(p.numero_controle, p.numero_documento)
                   || '/' || un.nome || '/'
                   || EXTRACT(YEAR FROM p.data_instauracao)::int::text AS rotulo,
               un.nome                                         AS unidade_origem,
               nf.nome                                         AS natureza_fato,
               p.data_instauracao                              AS data_instauracao,
               p.data_conclusao                                AS data_conclusao,
               resp.nome                                       AS responsavel_nome,
               env.lista                                       AS envolvidos,
               prazo.data_vencimento                           AS prazo_vencimento,
               andam.descricao                                 AS ultimo_andamento,
               andam.ocorrido_em                               AS ultimo_andamento_em
          FROM processos_procedimentos p
          JOIN apuratorios a    ON a.id = p.apuratorio_id
          JOIN unidades_pm un   ON un.id = p.unidade_origem_id
          LEFT JOIN naturezas_fato nf ON nf.id = p.natureza_fato_id
          LEFT JOIN LATERAL (
              SELECT pmr.nome
                FROM processo_designacoes d
                JOIN apuratorio_papeis ap    ON ap.apuratorio_id = d.apuratorio_id
                                            AND ap.papel_id = d.papel_id
                JOIN policiais_militares pmr ON pmr.id = d.policial_militar_id
               WHERE d.processo_id = p.id AND d.data_fim IS NULL AND ap.e_responsavel
               LIMIT 1
          ) resp ON true
          LEFT JOIN LATERAL (
              SELECT string_agg(pg.sigla || ' ' || pme.nome, ', ' ORDER BY e.ordem) AS lista
                FROM processo_envolvidos e
                JOIN policiais_militares pme ON pme.id = e.policial_militar_id
                JOIN postos_graduacoes pg    ON pg.id = pme.posto_graduacao_id
               WHERE e.processo_id = p.id
          ) env ON true
          LEFT JOIN LATERAL (
              SELECT pr.data_vencimento FROM processo_prazos pr
               WHERE pr.processo_id = p.id ORDER BY pr.ordem DESC LIMIT 1
          ) prazo ON true
          LEFT JOIN LATERAL (
              SELECT an.descricao, an.ocorrido_em FROM processo_andamentos an
               WHERE an.processo_id = p.id AND an.cancelado_em IS NULL
               ORDER BY an.ocorrido_em DESC LIMIT 1
          ) andam ON true
         WHERE p.ativo
           AND p.data_instauracao BETWEEN $1 AND $2
           AND ($3::uuid[] IS NULL OR p.apuratorio_id = ANY($3::uuid[]))
         ORDER BY a.sigla, p.data_instauracao
        "#,
    )
    .bind(request.periodo_inicio)
    .bind(request.periodo_fim)
    .bind(request.apuratorio_ids.as_deref())
    .fetch_all(pool)
    .await
}

pub async fn save_map(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveMapRequest,
    autor_id: &str,
) -> Result<String, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO mapas_salvos
             (titulo, apuratorio_id, periodo_inicio, periodo_fim, total_processos,
              total_concluidos, total_andamento, gerado_por_id, dados_mapa)
         VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::uuid, $9)
      RETURNING id::text",
    )
    .bind(request.titulo.trim())
    .bind(request.apuratorio_id.as_deref())
    .bind(request.periodo_inicio)
    .bind(request.periodo_fim)
    .bind(request.total_processos)
    .bind(request.total_concluidos)
    .bind(request.total_andamento)
    .bind(autor_id)
    .bind(&request.dados_mapa)
    .fetch_one(&mut **tx)
    .await
}

pub async fn list_saved_maps(pool: &PgPool) -> Result<Vec<SavedMapListItem>, sqlx::Error> {
    sqlx::query_as::<_, SavedMapListItem>(&format!(
        "SELECT {SAVED_MAP_COLS} {SAVED_MAP_JOINS}
          WHERE m.ativo ORDER BY m.created_at DESC"
    ))
    .fetch_all(pool)
    .await
}

pub async fn get_saved_map(pool: &PgPool, id: &str) -> Result<Option<SavedMapFull>, sqlx::Error> {
    sqlx::query_as::<_, SavedMapFull>(&format!(
        "SELECT {SAVED_MAP_COLS}, m.dados_mapa AS dados_mapa {SAVED_MAP_JOINS}
          WHERE m.id = $1::uuid"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_saved_map(
    tx: &mut Transaction<'_, Postgres>,
    id: &str,
) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE mapas_salvos SET ativo = false, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("mapa nao encontrado".to_string()));
    }
    Ok(())
}

/// Processos por responsável vigente. O papel de responsável vem da configuração
/// do apuratório, não de um nome escrito no SQL.
pub async fn by_responsible(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<ContagemRotulada>, sqlx::Error> {
    sqlx::query_as::<_, ContagemRotulada>(
        "SELECT pm.id::text AS id,
                pg.sigla || ' ' || pm.nome AS rotulo,
                count(DISTINCT p.id) AS total
           FROM processos_procedimentos p
           JOIN processo_designacoes d  ON d.processo_id = p.id AND d.data_fim IS NULL
           JOIN apuratorio_papeis ap    ON ap.apuratorio_id = d.apuratorio_id
                                       AND ap.papel_id = d.papel_id AND ap.e_responsavel
           JOIN policiais_militares pm  ON pm.id = d.policial_militar_id
           JOIN postos_graduacoes pg    ON pg.id = pm.posto_graduacao_id
          WHERE p.ativo
            AND ($1::uuid[] IS NULL OR p.apuratorio_id = ANY($1::uuid[]))
            AND ($2::int IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $2)
          GROUP BY pm.id, pg.sigla, pm.nome
          ORDER BY total DESC, pm.nome
          LIMIT $3",
    )
    .bind(filter.apuratorio_ids.as_deref())
    .bind(filter.ano)
    .bind(filter.limit.unwrap_or(50).clamp(1, 500))
    .fetch_all(pool)
    .await
}

/// Ranking de condutores. Alcança os processos cuja natureza do fato exige
/// condutor — a flag `naturezas_fato.exige_condutor` no lugar do antigo
/// `natureza.includes('sinistro de trânsito')`.
pub async fn driver_ranking(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<DriverRankingItem>, sqlx::Error> {
    sqlx::query_as::<_, DriverRankingItem>(
        "SELECT pm.id::text AS policial_militar_id,
                pm.nome      AS nome,
                pm.matricula AS matricula,
                pg.sigla     AS posto_graduacao,
                count(*)     AS total
           FROM processo_envolvidos e
           JOIN processos_procedimentos p ON p.id = e.processo_id
           JOIN naturezas_fato nf         ON nf.id = p.natureza_fato_id
           JOIN policiais_militares pm    ON pm.id = e.policial_militar_id
           JOIN postos_graduacoes pg      ON pg.id = pm.posto_graduacao_id
          WHERE e.e_condutor AND nf.exige_condutor AND p.ativo
            AND ($1::int IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $1)
          GROUP BY pm.id, pm.nome, pm.matricula, pg.sigla
          ORDER BY total DESC, pm.nome
          LIMIT $2",
    )
    .bind(filter.ano)
    .bind(filter.limit.unwrap_or(20).clamp(1, 200))
    .fetch_all(pool)
    .await
}

/// Processos por rubrica do fato apurado. Antes era um stub `Ok(vec![])`, porque
/// a rubrica havia sido mapeada para o catálogo errado (Leve/Média/Grave).
pub async fn by_nature(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<ContagemRotulada>, sqlx::Error> {
    sqlx::query_as::<_, ContagemRotulada>(
        "SELECT nf.id::text AS id, nf.nome AS rotulo, count(*) AS total
           FROM processos_procedimentos p
           JOIN naturezas_fato nf ON nf.id = p.natureza_fato_id
          WHERE p.ativo
            AND ($1::uuid[] IS NULL OR p.apuratorio_id = ANY($1::uuid[]))
            AND ($2::int IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $2)
          GROUP BY nf.id, nf.nome
          ORDER BY total DESC, nf.nome",
    )
    .bind(filter.apuratorio_ids.as_deref())
    .bind(filter.ano)
    .fetch_all(pool)
    .await
}

pub async fn available_years(pool: &PgPool) -> Result<Vec<i32>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT DISTINCT EXTRACT(YEAR FROM data_instauracao)::int
           FROM processos_procedimentos WHERE ativo ORDER BY 1 DESC",
    )
    .fetch_all(pool)
    .await
}

/// Exporta o mapa do período em CSV.
pub async fn export_csv(
    pool: &PgPool,
    request: &MapPeriodRequest,
) -> Result<CsvExport, sqlx::Error> {
    let linhas = map_rows(pool, request).await?;

    fn escapar(valor: &str) -> String {
        if valor.contains([';', '"', '\n']) {
            format!("\"{}\"", valor.replace('"', "\"\""))
        } else {
            valor.to_string()
        }
    }
    fn opt(valor: &Option<String>) -> String {
        escapar(valor.as_deref().unwrap_or(""))
    }

    let mut csv = String::from(
        "Apuratorio;Numero;Unidade;Natureza;Instauracao;Conclusao;Responsavel;Envolvidos;Vencimento;Ultimo andamento\n",
    );
    for l in &linhas {
        csv.push_str(&format!(
            "{};{};{};{};{};{};{};{};{};{}\n",
            escapar(&l.apuratorio_sigla),
            escapar(&l.rotulo),
            escapar(&l.unidade_origem),
            opt(&l.natureza_fato),
            l.data_instauracao,
            l.data_conclusao.map(|d| d.to_string()).unwrap_or_default(),
            opt(&l.responsavel_nome),
            opt(&l.envolvidos),
            l.prazo_vencimento
                .map(|d| d.to_string())
                .unwrap_or_default(),
            opt(&l.ultimo_andamento),
        ));
    }

    Ok(CsvExport {
        nome_arquivo: format!(
            "mapa-{}-a-{}.csv",
            request.periodo_inicio, request.periodo_fim
        ),
        // BOM para o Excel reconhecer UTF-8.
        conteudo: base64::engine::general_purpose::STANDARD
            .encode(format!("\u{feff}{csv}").as_bytes()),
    })
}
