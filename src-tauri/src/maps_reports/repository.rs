use base64::Engine;
use sqlx::{PgPool, Postgres, Transaction};

use crate::db::paginacao::Recorte;
use crate::error::AppError;
use crate::maps_reports::domain::{
    ContagemRotulada, CsvExport, DesignacaoMatrizFiltro, DesignacaoMatrizLinha, DriverRankingItem,
    EnquadramentoContagem, MapPeriodRequest, MapPrintItem, MapPrintRequest, MapRow, ReportFilter,
    SaveMapRequest, SavedMapFull, SavedMapListItem, SavedMapListResult, SolucoesResumo,
    StatusPorApuratorio,
};
use crate::{deadlines, evidence, movements, proceedings};

/// Lista de escopo vazia significa "todos", não "nenhum".
///
/// Sem isto, `= ANY('{}')` é falso para toda linha e a tela devolve zero
/// resultados justamente quando o operador não filtrou nada — que é o caso
/// mais comum. `MapPeriodRequest.apuratorio_ids` já documentava "vazio =
/// todas"; agora o código cumpre o que estava escrito.
fn escopo(ids: &Option<Vec<String>>) -> Option<&[String]> {
    ids.as_deref().filter(|lista| !lista.is_empty())
}

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
///
/// **A regra do período não é `data_instauracao BETWEEN`.** O mapa responde
/// "o que a Seção tinha em mãos neste período": os processos **ainda abertos**
/// instaurados até o fim dele — inclusive os de anos anteriores — mais os
/// **concluídos dentro** dele. Um filtro por instauração esconderia justamente
/// o processo antigo que continua pendente, que é o que o mapa existe para
/// mostrar. Travado por `mapa_acumula_o_que_estava_aberto_no_periodo`.
pub async fn map_rows(
    pool: &PgPool,
    request: &MapPeriodRequest,
) -> Result<Vec<MapRow>, sqlx::Error> {
    sqlx::query_as::<_, MapRow>(
        r#"
        SELECT v.id::text          AS processo_id,
               v.apuratorio_sigla  AS apuratorio_sigla,
               v.rotulo            AS rotulo,
               v.unidade_origem    AS unidade_origem,
               v.subunidade_secao_origem AS subunidade_secao_origem,
               v.natureza_fato     AS natureza_fato,
               v.data_instauracao  AS data_instauracao,
               v.data_conclusao    AS data_conclusao,
               v.responsavel_nome  AS responsavel_nome,
               env.lista           AS envolvidos,
               v.prazo_vencimento  AS prazo_vencimento,
               andam.descricao     AS ultimo_andamento,
               andam.ocorrido_em   AS ultimo_andamento_em
          FROM v_processos_detalhados v
          -- Os envolvidos por extenso e o último andamento são do mapa, não da
          -- composição comum: ficam aqui.
          LEFT JOIN LATERAL (
              SELECT string_agg(pg.sigla || ' ' || pme.nome, ', ' ORDER BY e.ordem) AS lista
                FROM processo_envolvidos e
                JOIN policiais_militares pme ON pme.id = e.policial_militar_id
                JOIN postos_graduacoes pg    ON pg.id = pme.posto_graduacao_id
               WHERE e.processo_id = v.id
          ) env ON true
          LEFT JOIN LATERAL (
              SELECT an.descricao, an.ocorrido_em FROM processo_andamentos an
               WHERE an.processo_id = v.id AND an.cancelado_em IS NULL
               ORDER BY an.ocorrido_em DESC LIMIT 1
          ) andam ON true
         WHERE v.ativo
           AND (   (v.data_conclusao IS NULL     AND v.data_instauracao <= $2)
                OR (v.data_conclusao IS NOT NULL AND v.data_conclusao BETWEEN $1 AND $2) )
           AND ($3::uuid[] IS NULL OR v.apuratorio_id = ANY($3::uuid[]))
         ORDER BY v.apuratorio_sigla, v.data_instauracao, v.rotulo, v.id
        "#,
    )
    .bind(request.periodo_inicio)
    .bind(request.periodo_fim)
    .bind(escopo(&request.apuratorio_ids))
    .fetch_all(pool)
    .await
}

/// Dados completos do mapa atual para o documento A4.
///
/// A lista nasce obrigatoriamente de `map_rows`: além de manter uma única regra
/// para o mês, isto impede que um `processo_id` enviado por IPC imprima uma
/// ficha que não pertence ao filtro visível. As leituras detalhadas reutilizam
/// os quatro repositórios da tela de processo em vez de duplicar seus JOINs.
pub async fn map_print_data(
    pool: &PgPool,
    request: &MapPrintRequest,
) -> Result<Vec<MapPrintItem>, AppError> {
    if request.periodo_fim < request.periodo_inicio {
        return Err(AppError::Domain(
            "A data final do mapa não pode ser anterior à data inicial.".to_string(),
        ));
    }

    let mut linhas = map_rows(pool, &request.periodo()).await?;
    if let Some(processo_id) = request.processo_id.as_deref() {
        if !linhas.iter().any(|linha| linha.processo_id == processo_id) {
            return Err(AppError::Domain(
                "O processo escolhido não pertence ao mês e aos apuratórios deste mapa. Gere o mapa novamente e selecione uma ficha da lista."
                    .to_string(),
            ));
        }
        linhas.retain(|linha| linha.processo_id == processo_id);
    }

    let mut itens = Vec::with_capacity(linhas.len());
    for linha in linhas {
        let processo = proceedings::repository::get(pool, &linha.processo_id)
            .await?
            .ok_or_else(|| {
                AppError::Domain(
                    "Um processo do mapa não foi encontrado. Gere o mapa novamente antes de imprimir."
                        .to_string(),
                )
            })?;
        itens.push(MapPrintItem {
            prazos: deadlines::repository::list(pool, &linha.processo_id).await?,
            andamentos: movements::repository::list(pool, &linha.processo_id).await?,
            enquadramentos: evidence::repository::list_for_proceeding(pool, &linha.processo_id)
                .await?,
            processo,
        });
    }

    Ok(itens)
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

/// Uma página de mapas salvos, do mais recente para o mais antigo.
///
/// Continua filtrando `m.ativo`, e a contagem filtra igual: um mapa excluído
/// não pode inflar o total de um escopo em que ele não aparece.
pub async fn list_saved_maps(
    pool: &PgPool,
    recorte: Recorte,
) -> Result<SavedMapListResult, sqlx::Error> {
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM mapas_salvos m WHERE m.ativo")
        .fetch_one(pool)
        .await?;

    // `id` desempata dois mapas salvos no mesmo instante, para que a fronteira
    // entre páginas não oscile.
    let items = sqlx::query_as::<_, SavedMapListItem>(&format!(
        "SELECT {SAVED_MAP_COLS} {SAVED_MAP_JOINS}
          WHERE m.ativo ORDER BY m.created_at DESC, m.id DESC
          LIMIT $1 OFFSET $2"
    ))
    .bind(recorte.per_page)
    .bind(recorte.offset)
    .fetch_all(pool)
    .await?;

    Ok(SavedMapListResult {
        items,
        total,
        page: recorte.page,
        per_page: recorte.per_page,
    })
}

/// Leitura por id **não filtra `ativo`** — e isso é deliberado, não esquecimento.
///
/// O princípio 6 do modelo separa os dois casos: lista de *opções* filtra
/// `ativo` (e `list_saved_maps` filtra), leitura de *registro existente* não.
/// Um mapa é documento já emitido; excluí-lo o tira da lista sem apagar o que
/// foi emitido, e quem tiver o id continua alcançando o que foi lido na época.
///
/// A assimetria com `list_saved_maps` estava registrada na §9 do guia como
/// pendente de decisão. Fica **como está**, pelo princípio 6.
pub async fn get_saved_map(pool: &PgPool, id: &str) -> Result<Option<SavedMapFull>, sqlx::Error> {
    sqlx::query_as::<_, SavedMapFull>(&format!(
        "SELECT {SAVED_MAP_COLS}, m.dados_mapa AS dados_mapa {SAVED_MAP_JOINS}
          WHERE m.id = $1::uuid"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Exclusão lógica. Excluir duas vezes **não** é erro: o `UPDATE` alcança a
/// mesma linha e a operação é idempotente, que é o que se quer de uma exclusão.
/// O que é recusado, com regra legível, é id que não existe.
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
        return Err(AppError::Domain(
            "Este mapa não existe mais. Recarregue a lista de mapas salvos.".to_string(),
        ));
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
    .bind(escopo(&filter.apuratorio_ids))
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
            AND ($1::uuid[] IS NULL OR p.apuratorio_id = ANY($1::uuid[]))
            AND ($2::int IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $2)
          GROUP BY pm.id, pm.nome, pm.matricula, pg.sigla
          ORDER BY total DESC, pm.nome
          LIMIT $3",
    )
    .bind(escopo(&filter.apuratorio_ids))
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
    .bind(escopo(&filter.apuratorio_ids))
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
    fn origem(unidade: &str, subunidade: &Option<String>) -> String {
        subunidade
            .as_deref()
            .map(|sub| format!("{unidade} / {sub}"))
            .unwrap_or_else(|| unidade.to_string())
    }

    let mut csv = String::from(
        "Apuratorio;Numero;Unidade;Natureza;Instauracao;Conclusao;Responsavel;Envolvidos;Vencimento;Ultimo andamento\n",
    );
    for l in &linhas {
        csv.push_str(&format!(
            "{};{};{};{};{};{};{};{};{};{}\n",
            escapar(&l.apuratorio_sigla),
            escapar(&l.rotulo),
            escapar(&origem(&l.unidade_origem, &l.subunidade_secao_origem)),
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

// =============================================================================
// Relatórios de escopo configurável
//
// Substituem os 9 comandos `proceedings_*_stats` do frontend legado, que
// escreviam a espécie no SQL (`IN ('IPM','SR','SV')`) e conheciam as quatro
// categorias de indício pelo nome. Aqui o escopo é sempre PARÂMETRO.
//
// Regra de leitura (princípio 6 do guia): os JOINs para catálogos NÃO filtram
// `ativo`. Relatório lê registro existente, não lista opções — um enquadramento
// de 2019 continua contando mesmo que o artigo tenha sido desativado depois.
// =============================================================================

/// Filtro comum a todos os relatórios abaixo: escopo de apuratórios e ano de
/// instauração. `$1` e `$2` ficam reservados para ele.
const FILTRO_ESCOPO: &str = "AND ($1::uuid[] IS NULL OR p.apuratorio_id = ANY($1::uuid[]))
            AND ($2::int    IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $2)";

/// Situação por apuratório. Substitui `in_progress_stats`, que agrupava pela
/// coluna de texto `tipo_detalhe` e só sabia contar o que estava em andamento.
pub async fn status_by_apuratorio(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<StatusPorApuratorio>, sqlx::Error> {
    sqlx::query_as::<_, StatusPorApuratorio>(&format!(
        "SELECT a.id::text  AS apuratorio_id,
                a.sigla     AS sigla,
                a.nome      AS nome,
                ta.id::text AS tipo_apuratorio_id,
                ta.nome     AS tipo_apuratorio_nome,
                count(*) FILTER (WHERE p.data_conclusao IS NULL)     AS em_andamento,
                count(*) FILTER (WHERE p.data_conclusao IS NOT NULL) AS concluidos,
                count(*)                                             AS total
           FROM processos_procedimentos p
           JOIN apuratorios a       ON a.id = p.apuratorio_id
           JOIN tipos_apuratorio ta ON ta.id = a.tipo_apuratorio_id
          WHERE p.ativo
            {FILTRO_ESCOPO}
          GROUP BY a.id, a.sigla, a.nome, ta.id, ta.nome
          ORDER BY ta.nome, a.sigla"
    ))
    .bind(escopo(&filter.apuratorio_ids))
    .bind(filter.ano)
    .fetch_all(pool)
    .await
}

/// O que foi sugerido e o que foi decidido, por envolvido.
///
/// São dois catálogos porque são dois atos distintos: o encarregado sugere, a
/// autoridade decide (seção 2 do guia). O legado tinha uma coluna só,
/// `solucao_tipo`, e o relatório classificava por `'punido' in solucao.lower()`.
pub async fn by_solution(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<SolucoesResumo, sqlx::Error> {
    async fn contar(
        pool: &PgPool,
        filter: &ReportFilter,
        tabela: &str,
        coluna: &str,
    ) -> Result<Vec<ContagemRotulada>, sqlx::Error> {
        // `tabela` e `coluna` são literais do código, nunca da requisição.
        sqlx::query_as::<_, ContagemRotulada>(&format!(
            "SELECT s.id::text AS id, s.nome AS rotulo, count(*) AS total
               FROM processo_envolvidos e
               JOIN processos_procedimentos p ON p.id = e.processo_id
               JOIN {tabela} s                ON s.id = e.{coluna}
              WHERE p.ativo
                {FILTRO_ESCOPO}
              GROUP BY s.id, s.nome
              ORDER BY total DESC, s.nome"
        ))
        .bind(escopo(&filter.apuratorio_ids))
        .bind(filter.ano)
        .fetch_all(pool)
        .await
    }

    Ok(SolucoesResumo {
        sugeridas: contar(
            pool,
            filter,
            "tipos_solucao_sugerida",
            "solucao_sugerida_id",
        )
        .await?,
        decididas: contar(
            pool,
            filter,
            "tipos_solucao_decidida",
            "solucao_decidida_id",
        )
        .await?,
    })
}

/// Envolvidos por categoria de indício. As categorias vêm do catálogo — antes
/// eram as quatro strings fixas que `ipm_evidence_stats` procurava dentro de um
/// array JSONB.
pub async fn by_evidence_category(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<ContagemRotulada>, sqlx::Error> {
    sqlx::query_as::<_, ContagemRotulada>(&format!(
        "SELECT c.id::text AS id, c.nome AS rotulo, count(*) AS total
           FROM envolvido_categorias_indicio eci
           JOIN categorias_indicio c      ON c.id = eci.categoria_indicio_id
           JOIN processo_envolvidos e     ON e.id = eci.envolvido_id
           JOIN processos_procedimentos p ON p.id = e.processo_id
          WHERE p.ativo
            {FILTRO_ESCOPO}
          GROUP BY c.id, c.nome
          ORDER BY total DESC, c.nome"
    ))
    .bind(escopo(&filter.apuratorio_ids))
    .bind(filter.ano)
    .fetch_all(pool)
    .await
}

/// Transgressões do RDPM mais imputadas. A gravidade sai do artigo, não de um
/// `CASE nt.codigo WHEN 'leve' THEN '15'` — que era como o legado a reconstruía.
pub async fn transgressoes(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<EnquadramentoContagem>, sqlx::Error> {
    sqlx::query_as::<_, EnquadramentoContagem>(&format!(
        "SELECT t.id::text                          AS id,
                ar.artigo || ', inc. ' || t.inciso   AS rotulo,
                t.texto                              AS descricao,
                nt.nome                              AS classificacao,
                count(*)                             AS total
           FROM envolvido_transgressoes et
           JOIN transgressoes t           ON t.id = et.transgressao_id
           JOIN artigos_rdpm ar           ON ar.id = t.artigo_rdpm_id
           JOIN naturezas_transgressao nt ON nt.id = ar.natureza_transgressao_id
           JOIN processo_envolvidos e     ON e.id = et.envolvido_id
           JOIN processos_procedimentos p ON p.id = e.processo_id
          WHERE p.ativo
            {FILTRO_ESCOPO}
          GROUP BY t.id, ar.artigo, t.inciso, t.texto, nt.nome
          ORDER BY total DESC, ar.artigo, t.inciso
          LIMIT $3"
    ))
    .bind(escopo(&filter.apuratorio_ids))
    .bind(filter.ano)
    .bind(filter.limit.unwrap_or(10).clamp(1, 500))
    .fetch_all(pool)
    .await
}

/// Infrações do Estatuto mais imputadas. O rótulo se monta do dado — o legado
/// tinha `'Art. 29, Inc. ' || inciso` escrito no SQL, e por isso o art. 32 não
/// aparecia em relatório nenhum.
pub async fn infracoes_estatuto(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<EnquadramentoContagem>, sqlx::Error> {
    sqlx::query_as::<_, EnquadramentoContagem>(&format!(
        "SELECT ie.id::text                          AS id,
                ie.artigo || ', inc. ' || ie.inciso  AS rotulo,
                ie.texto                             AS descricao,
                dl.nome                              AS classificacao,
                count(*)                             AS total
           FROM envolvido_infracoes_estatuto eie
           JOIN infracoes_estatuto ie     ON ie.id = eie.infracao_estatuto_id
           JOIN dispositivos_legais dl    ON dl.id = ie.dispositivo_legal_id
           JOIN processo_envolvidos e     ON e.id = eie.envolvido_id
           JOIN processos_procedimentos p ON p.id = e.processo_id
          WHERE p.ativo
            {FILTRO_ESCOPO}
          GROUP BY ie.id, ie.artigo, ie.inciso, ie.texto, dl.nome
          ORDER BY total DESC, ie.artigo, ie.inciso
          LIMIT $3"
    ))
    .bind(escopo(&filter.apuratorio_ids))
    .bind(filter.ano)
    .bind(filter.limit.unwrap_or(10).clamp(1, 500))
    .fetch_all(pool)
    .await
}

/// Infrações penais imputadas, quebradas por **esfera**.
///
/// A esfera é escolhida no vínculo, não no artigo (art. 9º do CPM), então a
/// mesma infração pode aparecer em duas linhas — uma militar, outra comum. Isso
/// é o resultado correto, e é o que substitui os dois comandos separados
/// `common_crimes_stats` e `military_crimes_stats`, que decidiam a esfera pelo
/// nome do dispositivo legal escrito no SQL.
pub async fn infracoes_penais(
    pool: &PgPool,
    filter: &ReportFilter,
) -> Result<Vec<EnquadramentoContagem>, sqlx::Error> {
    sqlx::query_as::<_, EnquadramentoContagem>(&format!(
        "SELECT ip.id::text AS id,
                dl.nome || ', ' || ip.artigo
                    || COALESCE(', ' || ip.paragrafo, '')
                    || COALESCE(', inc. ' || ip.inciso, '')
                    || COALESCE(', al. ' || ip.alinea, '') AS rotulo,
                ip.descricao                               AS descricao,
                ef.nome || ' · ' || esp.nome               AS classificacao,
                count(*)                                   AS total
           FROM envolvido_infracoes_penais eip
           JOIN infracoes_penais ip          ON ip.id = eip.infracao_penal_id
           JOIN esferas_penais ef            ON ef.id = eip.esfera_penal_id
           JOIN especies_infracao_penal esp  ON esp.id = ip.especie_id
           JOIN dispositivos_legais dl       ON dl.id = ip.dispositivo_legal_id
           JOIN processo_envolvidos e        ON e.id = eip.envolvido_id
           JOIN processos_procedimentos p    ON p.id = e.processo_id
          WHERE p.ativo
            {FILTRO_ESCOPO}
          GROUP BY ip.id, dl.nome, ip.artigo, ip.paragrafo, ip.inciso, ip.alinea,
                   ip.descricao, ef.nome, esp.nome
          ORDER BY total DESC, dl.nome, ip.artigo
          LIMIT $3"
    ))
    .bind(escopo(&filter.apuratorio_ids))
    .bind(filter.ano)
    .bind(filter.limit.unwrap_or(20).clamp(1, 500))
    .fetch_all(pool)
    .await
}

/// Matriz militar × apuratório, contando designações.
///
/// Substitui `obter_estatisticas_encarregados`, que fazia 11 consultas por
/// militar, uma por sigla, e lia colunas fixas de papel (`escrivao_id`,
/// `presidente_id`, `interrogante_id`). Aqui o recorte por papel é o parâmetro
/// `papel_ids`, e as colunas saem do catálogo de apuratórios.
///
/// Conta **toda designação registrada**, inclusive as já encerradas: se um
/// militar foi encarregado e depois substituído, o trabalho que ele teve não
/// desaparece do panorama. Quem quer só o responsável vigente usa
/// `by_responsible`.
pub async fn designations_matrix(
    pool: &PgPool,
    filter: &DesignacaoMatrizFiltro,
) -> Result<Vec<DesignacaoMatrizLinha>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Celula {
        policial_militar_id: String,
        nome: String,
        matricula: String,
        posto_graduacao: String,
        apuratorio_id: String,
        apuratorio_sigla: String,
        total: i64,
    }

    let celulas: Vec<Celula> = sqlx::query_as(
        "SELECT pm.id::text AS policial_militar_id,
                pm.nome      AS nome,
                pm.matricula AS matricula,
                pg.sigla     AS posto_graduacao,
                a.id::text   AS apuratorio_id,
                a.sigla      AS apuratorio_sigla,
                count(DISTINCT d.processo_id) AS total
           FROM processo_designacoes d
           JOIN processos_procedimentos p ON p.id = d.processo_id
           JOIN apuratorios a             ON a.id = p.apuratorio_id
           JOIN policiais_militares pm    ON pm.id = d.policial_militar_id
           JOIN postos_graduacoes pg      ON pg.id = pm.posto_graduacao_id
          WHERE p.ativo
            AND ($1::uuid[] IS NULL OR p.apuratorio_id = ANY($1::uuid[]))
            AND ($2::uuid[] IS NULL OR d.papel_id = ANY($2::uuid[]))
            AND ($3::int    IS NULL OR EXTRACT(YEAR FROM p.data_instauracao)::int = $3)
          GROUP BY pm.id, pm.nome, pm.matricula, pg.sigla, a.id, a.sigla
          ORDER BY pm.nome, a.sigla",
    )
    .bind(escopo(&filter.apuratorio_ids))
    .bind(escopo(&filter.papel_ids))
    .bind(filter.ano)
    .fetch_all(pool)
    .await?;

    // As linhas já vêm ordenadas por militar, então basta agrupar em sequência.
    let mut linhas: Vec<DesignacaoMatrizLinha> = Vec::new();
    for celula in celulas {
        let linha = match linhas.last_mut() {
            Some(ultima) if ultima.policial_militar_id == celula.policial_militar_id => ultima,
            _ => {
                linhas.push(DesignacaoMatrizLinha {
                    policial_militar_id: celula.policial_militar_id.clone(),
                    nome: celula.nome,
                    matricula: celula.matricula,
                    posto_graduacao: celula.posto_graduacao,
                    celulas: Vec::new(),
                    total: 0,
                });
                linhas.last_mut().expect("acabou de ser inserida")
            }
        };
        linha.total += celula.total;
        linha.celulas.push(ContagemRotulada {
            id: celula.apuratorio_id,
            rotulo: celula.apuratorio_sigla,
            total: celula.total,
        });
    }

    linhas.sort_by(|a, b| b.total.cmp(&a.total).then_with(|| a.nome.cmp(&b.nome)));
    let limite = filter.limit.unwrap_or(100).clamp(1, 500) as usize;
    linhas.truncate(limite);
    Ok(linhas)
}
