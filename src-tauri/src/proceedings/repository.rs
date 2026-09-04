use base64::Engine;
use sqlx::{PgExecutor, PgPool, Postgres, Transaction};

use crate::db::paginacao::{PADRAO, TETO};
use crate::deadlines::repository as deadlines_repository;
use crate::error::AppError;
use crate::evidence::repository as evidence_repository;
use crate::proceedings::domain::{
    validar_ordem_datas, AnexoItem, AttachmentContent, AtualizarSubstituicaoRequest,
    CartaPrecatoriaDetalhes, DashboardSummary, DesignacaoItem, DesignacaoRequest, EnvolvidoItem,
    PessoaItem, ProceedingDetail, ProceedingFilter, ProceedingFilterOption,
    ProceedingFilterOptions, ProceedingListItem, ProceedingListResult,
    ProceedingMilitaryFilterOption, SaveProceedingRequest, SubstituirDesignacaoRequest,
    UpdateInvolvedOutcomeRequest, UpdateProceedingDatesRequest, UploadAttachmentRequest,
    VitimaItem, EXTENSAO_CARTA_PRECATORIA, MOTIVO_DESIGNACAO_INICIAL,
};

/// Limite de tamanho do anexo. Trafega em base64 pelo IPC, então o custo real em
/// memória é cerca de 1/3 maior.
const MAX_ANEXO_BYTES: usize = 100 * 1024 * 1024;

/// Colunas da listagem. Saem de `v_processos_detalhados` (criada na 0004 e
/// ampliada na 0014), que
/// já resolve os catálogos, o responsável vigente, o prazo vigente e a contagem
/// de envolvidos. Antes esta composição estava escrita aqui, em `maps_reports`,
/// em `deadlines` e em `users` — quatro cópias que podiam divergir, e duas já
/// divergiam.
///
/// Os ids saem como texto porque é assim que atravessam o IPC.
const COLUNAS_LISTA: &str = r#"
    v.id::text                     AS id,
    v.apuratorio_id::text          AS apuratorio_id,
    v.apuratorio_sigla,
    v.apuratorio_nome,
    v.tipo_apuratorio,
    v.documento_iniciador_id::text AS documento_iniciador_id,
    v.documento_iniciador,
    v.numero_documento,
    v.numero_controle,
    v.processo_sei,
    v.rotulo,
    v.unidade_origem_id::text      AS unidade_origem_id,
    v.unidade_origem,
    v.subunidade_secao_origem_id::text AS subunidade_secao_origem_id,
    v.subunidade_secao_origem,
    v.municipio_fato_id::text      AS municipio_fato_id,
    v.municipio_fato,
    v.natureza_fato_id::text       AS natureza_fato_id,
    v.natureza_fato,
    v.data_instauracao,
    v.data_recebimento,
    v.data_remessa,
    v.entregue,
    v.data_conclusao,
    v.concluido,
    v.resumo_fatos,
    v.responsavel_nome,
    responsavel_pm.matricula        AS responsavel_matricula,
    responsavel_posto.sigla         AS responsavel_posto_graduacao,
    v.responsavel_papel,
    v.total_envolvidos,
    COALESCE(envolvidos.lista, '[]'::jsonb) AS envolvidos_resumo,
    v.prazo_vencimento,
    v.prazo_dias_restantes
"#;

/// Dados complementares usados somente pelo CRUD de processos. Permanecem
/// fora da view comum para não obrigar mapas e relatórios a agregarem a lista
/// completa de envolvidos quando não precisam dela.
const JOINS_LISTA: &str = r#"
    LEFT JOIN policiais_militares responsavel_pm
           ON responsavel_pm.id = v.responsavel_id::uuid
    LEFT JOIN postos_graduacoes responsavel_posto
           ON responsavel_posto.id = responsavel_pm.posto_graduacao_id
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
                   jsonb_build_object(
                       'posto_graduacao', COALESCE(pg.sigla, ''),
                       'matricula', COALESCE(pm.matricula, ''),
                       'nome', COALESCE(pm.nome, 'À apurar'),
                       'a_apurar', e.policial_militar_id IS NULL
                   ) ORDER BY e.ordem
               ) AS lista
          FROM processo_envolvidos e
          LEFT JOIN policiais_militares pm ON pm.id = e.policial_militar_id
          LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
         WHERE e.processo_id = v.id
    ) envolvidos ON true
"#;

/// Fonte da CONTAGEM da listagem — deliberadamente as tabelas base, e não a
/// view.
///
/// Medido com 5.000 processos: contar sobre a view leva 408 ms, porque o
/// PostgreSQL não poda os `LATERAL` cujo resultado a contagem não usa. Esta
/// projeção enxuta leva 1,8 ms — e é mais rápida até que a versão anterior
/// (58 ms), que arrastava quatro joins de catálogo que a contagem nunca leu.
///
/// As colunas repetem os nomes que a view expõe, de propósito: é o que permite
/// o mesmo `FILTRO` valer para as duas fontes.
const BASE_CONTAGEM: &str = r#"
    FROM (
        SELECT pp.id,
               pp.ativo,
               pp.apuratorio_id,
               aa.tipo_apuratorio_id,
               pp.documento_iniciador_id,
               pp.unidade_origem_id,
               pp.municipio_fato_id,
               pp.natureza_fato_id,
               pp.numero_documento,
               COALESCE(pp.numero_controle, pp.numero_documento) AS numero_controle,
               pp.resumo_fatos,
               pp.processo_sei,
               pp.numero_rgf,
               pp.data_instauracao,
               pp.data_conclusao,
               (pp.data_conclusao IS NOT NULL) AS concluido,
               (COALESCE(pp.data_remessa_comissao,
                         pp.data_remessa_encarregado) IS NOT NULL) AS entregue
          FROM processos_procedimentos pp
          JOIN apuratorios aa ON aa.id = pp.apuratorio_id
    ) v
"#;

/// O filtro vale para as duas fontes acima, porque ambas expõem estes nomes.
const FILTRO: &str = r#"
    WHERE v.ativo
      AND ($1::text IS NULL
           OR lower(v.numero_documento) LIKE $1
           OR lower(v.numero_controle) LIKE $1
           OR lower(COALESCE(v.resumo_fatos, '')) LIKE $1
           OR lower(COALESCE(v.processo_sei, '')) LIKE $1
           OR lower(COALESCE(v.numero_rgf, '')) LIKE $1
           OR EXISTS (
              SELECT 1
                FROM processo_designacoes d
                JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                          AND ap.papel_id = d.papel_id
                JOIN policiais_militares pm ON pm.id = d.policial_militar_id
               WHERE d.processo_id = v.id AND d.data_fim IS NULL
                 AND ap.e_responsavel AND lower(pm.nome) LIKE $1)
           OR EXISTS (
              SELECT 1
                FROM processo_envolvidos e
                JOIN policiais_militares pm ON pm.id = e.policial_militar_id
               WHERE e.processo_id = v.id AND lower(pm.nome) LIKE $1))
      AND ($2::uuid[] IS NULL OR v.apuratorio_id = ANY($2::uuid[]))
      AND ($3::uuid IS NULL OR v.tipo_apuratorio_id = $3::uuid)
      AND ($4::uuid IS NULL OR v.unidade_origem_id = $4::uuid)
      AND ($5::uuid IS NULL OR v.natureza_fato_id = $5::uuid)
      AND ($6::uuid IS NULL OR EXISTS (
              SELECT 1
                FROM processo_designacoes d
                JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                          AND ap.papel_id = d.papel_id
               WHERE d.processo_id = v.id AND d.data_fim IS NULL
                 AND ap.e_responsavel AND d.policial_militar_id = $6::uuid))
      AND ($7::int IS NULL OR EXTRACT(YEAR FROM v.data_instauracao)::int = $7)
      AND ($8::text IS NULL OR EXISTS (
              SELECT 1 FROM processo_vitimas vit
               WHERE vit.processo_id = v.id
                 AND lower(btrim(vit.nome)) = lower(btrim($8))))
      AND ($9::text IS NULL
           OR ($9 = 'em_andamento' AND NOT v.concluido)
           OR ($9 = 'concluido' AND v.concluido)
           OR ($9 = 'entregue' AND NOT v.concluido AND v.entregue)
           OR ($9 = 'no_prazo' AND NOT v.concluido AND NOT v.entregue AND
               (SELECT pr.data_vencimento FROM processo_prazos pr
                 WHERE pr.processo_id = v.id ORDER BY pr.ordem DESC LIMIT 1) >= CURRENT_DATE)
           OR ($9 = 'vencido' AND NOT v.concluido AND NOT v.entregue AND
               (SELECT pr.data_vencimento FROM processo_prazos pr
                 WHERE pr.processo_id = v.id ORDER BY pr.ordem DESC LIMIT 1) < CURRENT_DATE))
      AND ($10::date IS NULL OR v.data_instauracao >= $10)
      AND ($11::date IS NULL OR v.data_instauracao <= $11)
      AND ($12::uuid IS NULL OR v.municipio_fato_id = $12::uuid)
      AND ($13::uuid IS NULL OR EXISTS (
              SELECT 1 FROM processo_envolvidos e
               WHERE e.processo_id = v.id AND e.policial_militar_id = $13::uuid))
      AND ($14::uuid IS NULL OR v.documento_iniciador_id = $14::uuid)
"#;

fn bind_filtro<'q, O>(
    query: sqlx::query::QueryAs<'q, Postgres, O, sqlx::postgres::PgArguments>,
    filtro: &'q ProceedingFilter,
    busca: Option<String>,
) -> sqlx::query::QueryAs<'q, Postgres, O, sqlx::postgres::PgArguments> {
    query
        .bind(busca)
        .bind(filtro.apuratorio_ids.as_deref())
        .bind(filtro.tipo_apuratorio_id.as_deref())
        .bind(filtro.unidade_origem_id.as_deref())
        .bind(filtro.natureza_fato_id.as_deref())
        .bind(filtro.responsavel_id.as_deref())
        .bind(filtro.ano)
        .bind(filtro.vitima_nome.as_deref())
        .bind(filtro.situacao.as_ref().map(|situacao| situacao.as_str()))
        .bind(filtro.data_instauracao_inicio)
        .bind(filtro.data_instauracao_fim)
        .bind(filtro.municipio_fato_id.as_deref())
        .bind(filtro.envolvido_id.as_deref())
        .bind(filtro.documento_iniciador_id.as_deref())
}

pub async fn list(
    pool: &PgPool,
    filtro: &ProceedingFilter,
) -> Result<ProceedingListResult, sqlx::Error> {
    let page = filtro.page.unwrap_or(1).max(1);
    let per_page = filtro.per_page.unwrap_or(PADRAO).clamp(1, TETO);
    let busca = filtro
        .busca
        .as_deref()
        .map(|s| format!("%{}%", s.trim().to_lowercase()));

    let total: (i64,) = bind_filtro(
        sqlx::query_as(&format!("SELECT count(*) {BASE_CONTAGEM} {FILTRO}")),
        filtro,
        busca.clone(),
    )
    .fetch_one(pool)
    .await?;

    let items = bind_filtro(
        sqlx::query_as::<_, ProceedingListItem>(&format!(
            "SELECT {COLUNAS_LISTA} FROM v_processos_detalhados v {JOINS_LISTA} {FILTRO}
             ORDER BY v.data_instauracao DESC, v.numero_documento
             LIMIT $15 OFFSET $16"
        )),
        filtro,
        busca,
    )
    .bind(per_page)
    .bind((page - 1) * per_page)
    .fetch_all(pool)
    .await?;

    Ok(ProceedingListResult {
        items,
        total: total.0,
        page,
        per_page,
    })
}

/// Opções do modal de filtros avançados da listagem.
///
/// **Desvio deliberado da regra da seção 2 do guia** ("lista de opções filtra
/// `WHERE ativo`"), e o motivo é que aqui a lista não é a mesma coisa. Um
/// seletor de formulário oferece o que *pode* ser escolhido daqui para frente, e
/// aí `ativo` é porta. Estas listas oferecem por onde *cortar o que já foi
/// registrado* — e um valor que nenhum apuratório usa não corta nada: seria uma
/// opção que devolve zero, em meio a dezenas de municípios semeados pela `0003`.
///
/// Então cada lista sai dos fatos: somente valores que algum apuratório **ativo**
/// de fato registrou, como `anos` e `vitimas` já faziam por natureza. `ativo`
/// continua no payload, mas como **rótulo** — é o princípio 6 pelo outro lado, o
/// que garante que o apuratório de 2019 continue encontrável pela unidade
/// desativada em 2026, marcada "(inativo)" na tela.
///
/// O envolvido "À apurar" é `policial_militar_id IS NULL` e por isso não gera
/// opção nenhuma em `envolvidos`, que é o certo: não há por quem filtrar.
pub async fn filter_options(pool: &PgPool) -> Result<ProceedingFilterOptions, sqlx::Error> {
    let tipos_apuratorio = sqlx::query_as::<_, ProceedingFilterOption>(
        "SELECT t.id::text AS id, t.nome AS rotulo, t.ativo
           FROM tipos_apuratorio t
          WHERE EXISTS (
                SELECT 1
                  FROM apuratorios a
                  JOIN processos_procedimentos p ON p.apuratorio_id = a.id AND p.ativo
                 WHERE a.tipo_apuratorio_id = t.id)
          ORDER BY t.ativo DESC, t.nome",
    )
    .fetch_all(pool)
    .await?;
    let unidades = sqlx::query_as::<_, ProceedingFilterOption>(
        "SELECT u.id::text AS id, u.nome AS rotulo, u.ativo
           FROM unidades_pm u
          WHERE EXISTS (
                SELECT 1 FROM processos_procedimentos p
                 WHERE p.unidade_origem_id = u.id AND p.ativo)
          ORDER BY u.ativo DESC, u.nome",
    )
    .fetch_all(pool)
    .await?;
    // Responsável é o papel marcado `e_responsavel` na configuração do
    // apuratório, com designação vigente — a mesma definição que o filtro usa e
    // que a view resolve para a coluna Encarregado. `is_encarregado` do militar
    // não entra: aqui a pergunta é quem responde por algum apuratório, não quem
    // pode vir a responder.
    let responsaveis = sqlx::query_as::<_, ProceedingMilitaryFilterOption>(
        "SELECT pm.id::text AS id, pm.nome, pm.matricula,
                pg.sigla AS posto_graduacao, pm.ativo
           FROM policiais_militares pm
           JOIN postos_graduacoes pg ON pg.id = pm.posto_graduacao_id
          WHERE EXISTS (
                SELECT 1
                  FROM processo_designacoes d
                  JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                            AND ap.papel_id = d.papel_id
                  JOIN processos_procedimentos p ON p.id = d.processo_id AND p.ativo
                 WHERE d.policial_militar_id = pm.id AND d.data_fim IS NULL
                   AND ap.e_responsavel)
          ORDER BY pm.ativo DESC, pm.nome",
    )
    .fetch_all(pool)
    .await?;
    // Nome de vítima é texto livre: o `upper(btrim(...))` colapsa as variações de
    // caixa numa opção só, e o filtro compara em `lower(btrim(...))` — de modo
    // que escolher a opção alcança todas as grafias gravadas.
    let vitimas = sqlx::query_scalar(
        "SELECT DISTINCT upper(btrim(v.nome))
           FROM processo_vitimas v
           JOIN processos_procedimentos p ON p.id = v.processo_id AND p.ativo
          ORDER BY 1",
    )
    .fetch_all(pool)
    .await?;
    let anos = sqlx::query_scalar(
        "SELECT DISTINCT EXTRACT(YEAR FROM data_instauracao)::int
           FROM processos_procedimentos WHERE ativo ORDER BY 1 DESC",
    )
    .fetch_all(pool)
    .await?;
    let locais_fato = sqlx::query_as::<_, ProceedingFilterOption>(
        "SELECT m.id::text AS id,
                m.nome || CASE WHEN m.e_distrito THEN ' — Distrito' ELSE ' — Município' END AS rotulo,
                m.ativo
           FROM municipios_distritos m
          WHERE EXISTS (
                SELECT 1 FROM processos_procedimentos p
                 WHERE p.municipio_fato_id = m.id AND p.ativo)
          ORDER BY m.ativo DESC, m.nome, m.e_distrito",
    )
    .fetch_all(pool)
    .await?;
    let envolvidos = sqlx::query_as::<_, ProceedingMilitaryFilterOption>(
        "SELECT pm.id::text AS id, pm.nome, pm.matricula,
                pg.sigla AS posto_graduacao, pm.ativo
           FROM policiais_militares pm
           JOIN postos_graduacoes pg ON pg.id = pm.posto_graduacao_id
          WHERE EXISTS (
                SELECT 1
                  FROM processo_envolvidos e
                  JOIN processos_procedimentos p ON p.id = e.processo_id AND p.ativo
                 WHERE e.policial_militar_id = pm.id)
          ORDER BY pm.ativo DESC, pm.nome",
    )
    .fetch_all(pool)
    .await?;
    let documentos_iniciadores = sqlx::query_as::<_, ProceedingFilterOption>(
        "SELECT d.id::text AS id, d.nome AS rotulo, d.ativo
           FROM tipos_documento d
          WHERE EXISTS (
                SELECT 1 FROM processos_procedimentos p
                 WHERE p.documento_iniciador_id = d.id AND p.ativo)
          ORDER BY d.ativo DESC, d.nome",
    )
    .fetch_all(pool)
    .await?;

    Ok(ProceedingFilterOptions {
        tipos_apuratorio,
        unidades,
        responsaveis,
        vitimas,
        anos,
        locais_fato,
        envolvidos,
        documentos_iniciadores,
    })
}

pub async fn get(pool: &PgPool, id: &str) -> Result<Option<ProceedingDetail>, sqlx::Error> {
    let cabecalho = sqlx::query_as::<_, ProceedingListItem>(&format!(
        "SELECT {COLUNAS_LISTA} FROM v_processos_detalhados v {JOINS_LISTA}
          WHERE v.id = $1::uuid"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;

    let Some(cabecalho) = cabecalho else {
        return Ok(None);
    };

    let extras: (
        Option<String>,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
    ) = sqlx::query_as(
        "SELECT numero_rgf, data_remessa_encarregado,
                    data_remessa_comissao, data_julgamento
               FROM processos_procedimentos WHERE id = $1::uuid",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(Some(ProceedingDetail {
        cabecalho,
        numero_rgf: extras.0,
        data_remessa_encarregado: extras.1,
        data_remessa_comissao: extras.2,
        data_julgamento: extras.3,
        envolvidos: list_envolvidos(pool, id).await?,
        designacoes: list_designacoes(pool, id).await?,
        pessoas: list_pessoas(pool, id).await?,
        vitimas: list_vitimas(pool, id).await?,
        anexos: list_anexos(pool, id).await?,
        carta_precatoria: carta_precatoria(pool, id).await?,
    }))
}

pub async fn list_envolvidos<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<EnvolvidoItem>, sqlx::Error> {
    sqlx::query_as::<_, EnvolvidoItem>(
        "SELECT e.id::text                    AS id,
                e.policial_militar_id::text   AS policial_militar_id,
                COALESCE(pm.nome, 'À apurar') AS nome,
                COALESCE(pm.matricula, '')    AS matricula,
                COALESCE(pg.sigla, '')        AS posto_graduacao,
                se.id::text                   AS status_envolvido_id,
                se.nome                       AS status_envolvido,
                e.ordem                       AS ordem,
                e.e_condutor                  AS e_condutor,
                e.solucao_sugerida_id::text   AS solucao_sugerida_id,
                ss.nome                       AS solucao_sugerida,
                e.solucao_decidida_id::text   AS solucao_decidida_id,
                sd.nome                       AS solucao_decidida,
                e.penalidade_tipo_id::text    AS penalidade_tipo_id,
                tp.nome                       AS penalidade_tipo,
                e.penalidade_dias             AS penalidade_dias
           FROM processo_envolvidos e
           LEFT JOIN policiais_militares pm ON pm.id = e.policial_militar_id
           LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
           JOIN status_envolvido se    ON se.id = e.status_envolvido_id
           LEFT JOIN tipos_solucao_sugerida ss ON ss.id = e.solucao_sugerida_id
           LEFT JOIN tipos_solucao_decidida sd ON sd.id = e.solucao_decidida_id
           LEFT JOIN tipos_penalidade tp       ON tp.id = e.penalidade_tipo_id
          WHERE e.processo_id = $1::uuid
          ORDER BY e.ordem",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

/// Designações vigentes e encerradas. O histórico de substituição de encarregado
/// é consequência desta tabela — não existe jsonb nem tabela paralela.
pub async fn list_designacoes<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<DesignacaoItem>, sqlx::Error> {
    sqlx::query_as::<_, DesignacaoItem>(
        "SELECT d.id::text                     AS id,
                pap.id::text                   AS papel_id,
                pap.nome                       AS papel,
                ap.e_responsavel               AS e_responsavel,
                ap.usa_documento_designacao    AS usa_documento_designacao,
                pm.id::text                    AS policial_militar_id,
                pm.nome                        AS nome,
                pg.sigla                       AS posto_graduacao,
                pm.matricula                   AS matricula,
                d.data_inicio                  AS data_inicio,
                d.data_fim                     AS data_fim,
                d.documento_autorizador_id::text AS documento_autorizador_id,
                td.nome                        AS documento_autorizador,
                d.numero_documento             AS numero_documento,
                d.motivo                       AS motivo,
                d.designacao_anterior_id::text AS designacao_anterior_id
           FROM processo_designacoes d
           JOIN papeis_processo pap    ON pap.id = d.papel_id
           JOIN apuratorio_papeis ap   ON ap.apuratorio_id = d.apuratorio_id
                                      AND ap.papel_id = d.papel_id
           JOIN policiais_militares pm ON pm.id = d.policial_militar_id
           JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
           LEFT JOIN tipos_documento td ON td.id = d.documento_autorizador_id
          WHERE d.processo_id = $1::uuid
          ORDER BY pap.nome, d.data_inicio",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

pub async fn list_pessoas<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<PessoaItem>, sqlx::Error> {
    sqlx::query_as::<_, PessoaItem>(
        "SELECT pp.id::text        AS id,
                pap.id::text       AS papel_pessoa_id,
                pap.nome           AS papel_pessoa,
                pp.nome            AS nome,
                pp.ordem           AS ordem
           FROM processo_pessoas pp
           JOIN papeis_pessoa pap ON pap.id = pp.papel_pessoa_id
          WHERE pp.processo_id = $1::uuid
          ORDER BY pap.nome, pp.ordem",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

/// Ofendidos/Vítimas, na ordem em que foram informados. Sem JOIN em catálogo:
/// o ofendido não tem papel, e é isso que faz a seção nunca depender de uma
/// linha que alguém precise ter cadastrado antes.
pub async fn list_vitimas<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<VitimaItem>, sqlx::Error> {
    sqlx::query_as::<_, VitimaItem>(
        "SELECT id::text AS id, nome, ordem
           FROM processo_vitimas
          WHERE processo_id = $1::uuid
          ORDER BY ordem",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

/// Metadados dos anexos. O conteúdo fica de fora: `octet_length` devolve o
/// tamanho sem carregar o arquivo, e sem uma coluna que possa divergir dele.
pub async fn list_anexos<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Vec<AnexoItem>, sqlx::Error> {
    sqlx::query_as::<_, AnexoItem>(
        "SELECT an.id::text                        AS id,
                an.nome_arquivo                    AS nome_arquivo,
                an.mime_type                       AS mime_type,
                octet_length(an.conteudo)::bigint  AS tamanho_bytes,
                CASE WHEN pm.id IS NULL THEN u.nome_exibicao
                     ELSE pg.sigla || ' ' || pm.matricula || ' ' || pm.nome END AS enviado_por,
                an.created_at                      AS created_at
           FROM processo_anexos an
           LEFT JOIN usuarios u             ON u.id = an.enviado_por_id
           LEFT JOIN policiais_militares pm ON pm.id = u.policial_militar_id
           LEFT JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
          WHERE an.processo_id = $1::uuid AND an.cancelado_em IS NULL
          ORDER BY an.created_at DESC",
    )
    .bind(processo_id)
    .fetch_all(executor)
    .await
}

pub async fn carta_precatoria<'e, E: PgExecutor<'e>>(
    executor: E,
    processo_id: &str,
) -> Result<Option<CartaPrecatoriaDetalhes>, sqlx::Error> {
    sqlx::query_as::<_, CartaPrecatoriaDetalhes>(
        "SELECT cp.deprecante, cp.unidade_deprecada_id::text, un.nome AS unidade_deprecada
           FROM carta_precatoria_detalhes cp
           JOIN unidades_pm un ON un.id = cp.unidade_deprecada_id
          WHERE cp.processo_id = $1::uuid",
    )
    .bind(processo_id)
    .fetch_optional(executor)
    .await
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/// Configuração do apuratório que a gravação precisa consultar. Tudo o que antes
/// era literal no Rust (`"IPM" => 40`, `tipo_detalhe == "CP"`, `exige natureza`)
/// vem daqui, do cadastro.
#[derive(sqlx::FromRow)]
struct ConfigApuratorio {
    exige_natureza_fato: bool,
    permite_acusacao: bool,
    permite_acusacao_penal: bool,
    permite_cadastro_vitima: bool,
    codigo_extensao: Option<String>,
}

async fn config_apuratorio(
    tx: &mut Transaction<'_, Postgres>,
    apuratorio_id: &str,
) -> Result<ConfigApuratorio, AppError> {
    sqlx::query_as::<_, ConfigApuratorio>(
        "SELECT exige_natureza_fato, permite_acusacao, permite_acusacao_penal,
                permite_cadastro_vitima, codigo_extensao
           FROM apuratorios WHERE id = $1::uuid",
    )
    .bind(apuratorio_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("apuratorio nao encontrado".to_string()))
}

/// Validações que dependem de configuração. Todas leem atributos semânticos dos
/// catálogos — nenhuma compara nome exibido.
async fn validar_contra_configuracao(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveProceedingRequest,
    config: &ConfigApuratorio,
) -> Result<(), AppError> {
    if let Some(processo_id) = request.id.as_deref() {
        let reclassificaria_enquadramento: bool = sqlx::query_scalar(
            "SELECT p.apuratorio_id <> $2::uuid
                    AND EXISTS (
                        SELECT 1 FROM processo_envolvidos e
                         WHERE e.processo_id = p.id
                           AND (EXISTS (SELECT 1 FROM envolvido_categorias_indicio c WHERE c.envolvido_id = e.id)
                             OR EXISTS (SELECT 1 FROM envolvido_infracoes_penais i WHERE i.envolvido_id = e.id)
                             OR EXISTS (SELECT 1 FROM envolvido_transgressoes t WHERE t.envolvido_id = e.id)
                             OR EXISTS (SELECT 1 FROM envolvido_infracoes_estatuto s WHERE s.envolvido_id = e.id))
                    )
               FROM processos_procedimentos p
              WHERE p.id = $1::uuid AND p.ativo",
        )
        .bind(processo_id)
        .bind(&request.apuratorio_id)
        .fetch_optional(&mut **tx)
        .await?
        .unwrap_or(false);
        if reclassificaria_enquadramento {
            return Err(AppError::Domain(
                "não é possível trocar a espécie porque já há acusação ou indícios registrados"
                    .to_string(),
            ));
        }
    }

    if config.exige_natureza_fato && request.natureza_fato_id.is_none() {
        return Err(AppError::Domain(
            "este apuratorio exige a natureza geral do fato apurado".to_string(),
        ));
    }

    // Recusar em vez de ignorar: uma vítima descartada em silêncio some sem
    // que ninguém saiba. A tela não desenha a seção quando o atributo está
    // desligado, então esta mensagem só alcança quem chamou o IPC direto.
    if !config.permite_cadastro_vitima && !request.vitimas.is_empty() {
        return Err(AppError::Domain(
            "este apuratório não registra ofendido/vítima".to_string(),
        ));
    }

    let enviou_acusacao = request.envolvidos.iter().any(|e| e.acusacoes.is_some());
    if !config.permite_acusacao && enviou_acusacao {
        return Err(AppError::Domain(
            "este apuratório não recebe acusação no cadastro".to_string(),
        ));
    }

    if config.permite_acusacao {
        if !config.permite_acusacao_penal
            && request.envolvidos.iter().any(|e| {
                e.acusacoes
                    .as_ref()
                    .is_some_and(|a| !a.infracoes_penais.is_empty())
            })
        {
            return Err(AppError::Domain(
                "este processo admite somente acusações disciplinares do RDPM ou do Estatuto"
                    .to_string(),
            ));
        }

        let quantidade_efetiva = if let Some(processo_id) = request.id.as_deref() {
            let mut total = 0_i64;
            for envolvido in &request.envolvidos {
                total += match &envolvido.acusacoes {
                    Some(acusacoes) => acusacoes.quantidade() as i64,
                    None => sqlx::query_scalar(
                        "SELECT
                            (SELECT count(*) FROM envolvido_infracoes_penais p WHERE p.envolvido_id = e.id)
                          + (SELECT count(*) FROM envolvido_transgressoes t WHERE t.envolvido_id = e.id)
                          + (SELECT count(*) FROM envolvido_infracoes_estatuto s WHERE s.envolvido_id = e.id)
                           FROM processo_envolvidos e
                          WHERE e.processo_id = $1::uuid
                            AND (($2::uuid IS NOT NULL AND e.id = $2::uuid)
                              OR ($2::uuid IS NULL AND $3::uuid IS NOT NULL
                                  AND e.policial_militar_id = $3::uuid)
                              OR ($2::uuid IS NULL AND $3::uuid IS NULL
                                  AND e.policial_militar_id IS NULL))",
                    )
                    .bind(processo_id)
                    .bind(envolvido.id.as_deref())
                    .bind(envolvido.policial_militar_id.as_deref())
                    .fetch_optional(&mut **tx)
                    .await?
                    .unwrap_or(0),
                };
            }
            total
        } else {
            request
                .envolvidos
                .iter()
                .filter_map(|e| e.acusacoes.as_ref())
                .map(|a| a.quantidade() as i64)
                .sum()
        };

        if request.id.is_none() {
            if request.envolvidos.len() != 1 {
                return Err(AppError::Domain(
                    "informe o policial militar acusado neste processo".to_string(),
                ));
            }
            if quantidade_efetiva == 0 {
                return Err(AppError::Domain(
                    "selecione ao menos uma acusação para o policial militar".to_string(),
                ));
            }
        } else {
            let processo_id = request.id.as_deref().expect("id verificado acima");
            let quantidade_atual: i64 = sqlx::query_scalar(
                "SELECT
                    (SELECT count(*) FROM envolvido_infracoes_penais p
                      JOIN processo_envolvidos e ON e.id = p.envolvido_id
                     WHERE e.processo_id = $1::uuid)
                  + (SELECT count(*) FROM envolvido_transgressoes t
                      JOIN processo_envolvidos e ON e.id = t.envolvido_id
                     WHERE e.processo_id = $1::uuid)
                  + (SELECT count(*) FROM envolvido_infracoes_estatuto s
                      JOIN processo_envolvidos e ON e.id = s.envolvido_id
                     WHERE e.processo_id = $1::uuid)",
            )
            .bind(processo_id)
            .fetch_one(&mut **tx)
            .await?;
            if quantidade_atual > 0 && quantidade_efetiva == 0 {
                return Err(AppError::Domain(
                    "um processo que já possui acusação não pode ficar sem enquadramento"
                        .to_string(),
                ));
            }
        }
    }

    // `naturezas_fato.exige_condutor` substitui o
    // `natureza.toLowerCase().includes('sinistro de trânsito')` do frontend legado.
    if let Some(natureza_id) = request.natureza_fato_id.as_deref() {
        let exige_condutor: bool =
            sqlx::query_scalar("SELECT exige_condutor FROM naturezas_fato WHERE id = $1::uuid")
                .bind(natureza_id)
                .fetch_optional(&mut **tx)
                .await?
                .ok_or_else(|| {
                    AppError::Domain("natureza geral do fato nao encontrada".to_string())
                })?;

        if exige_condutor && !request.envolvidos.iter().any(|e| e.e_condutor) {
            return Err(AppError::Domain(
                "esta natureza exige indicar o PM condutor entre os envolvidos".to_string(),
            ));
        }
    }

    if config.codigo_extensao.as_deref() == Some(EXTENSAO_CARTA_PRECATORIA)
        && request.carta_precatoria.is_none()
    {
        return Err(AppError::Domain(
            "este apuratorio exige deprecante e unidade deprecada".to_string(),
        ));
    }

    // Papéis obrigatórios do apuratório precisam estar designados.
    let faltando: Vec<String> = sqlx::query_scalar(
        "SELECT pap.nome
           FROM apuratorio_papeis ap
           JOIN papeis_processo pap ON pap.id = ap.papel_id
          WHERE ap.apuratorio_id = $1::uuid AND ap.obrigatorio AND ap.ativo
            AND NOT (ap.papel_id::text = ANY($2::text[]))",
    )
    .bind(&request.apuratorio_id)
    .bind(
        request
            .designacoes
            .iter()
            .map(|d| d.papel_id.clone())
            .collect::<Vec<_>>(),
    )
    .fetch_all(&mut **tx)
    .await?;
    if !faltando.is_empty() {
        return Err(AppError::Domain(format!(
            "Falta designar quem responde por: {}. Esta espécie de apuratório exige.",
            faltando.join(", ")
        )));
    }

    Ok(())
}

/// Grava o processo inteiro numa transação: cabeçalho, extensão, envolvidos,
/// designações e pessoas. Na criação, o prazo inicial nasce junto quando há data
/// de recebimento.
///
/// Uma tabela só — não existe mais o `match tipo_detalhe` que escolhia entre dez
/// tabelas físicas nem a segunda escrita no hub de identidade.
pub async fn save(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveProceedingRequest,
) -> Result<String, AppError> {
    let config = config_apuratorio(tx, &request.apuratorio_id).await?;
    validar_contra_configuracao(tx, request, &config).await?;

    if let Some(subunidade_id) = request.subunidade_secao_origem_id.as_deref() {
        let pertence: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                 SELECT 1 FROM subunidades_secoes
                  WHERE id = $1::uuid AND unidade_pm_id = $2::uuid
             )",
        )
        .bind(subunidade_id)
        .bind(&request.unidade_origem_id)
        .fetch_one(&mut **tx)
        .await?;
        if !pertence {
            return Err(AppError::Domain(
                "A subunidade/seção escolhida não pertence à unidade de origem informada."
                    .to_string(),
            ));
        }
    }

    let numero_controle = request
        .numero_controle
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    // A data anterior precisa ser lida antes do UPDATE para que a sincronização
    // do prazo saiba distinguir uma edição comum de uma tentativa de reescrever
    // uma cadeia que já possui prorrogações.
    let data_recebimento_anterior: Option<Option<chrono::NaiveDate>> = if let Some(id) =
        request.id.as_deref()
    {
        let (
            anterior,
            tem_prorrogacao,
            remessa_encarregado,
            remessa_comissao,
            julgamento,
            conclusao,
        ): (
            Option<chrono::NaiveDate>,
            bool,
            Option<chrono::NaiveDate>,
            Option<chrono::NaiveDate>,
            Option<chrono::NaiveDate>,
            Option<chrono::NaiveDate>,
        ) = sqlx::query_as(
            "SELECT p.data_recebimento,
                        EXISTS (SELECT 1 FROM processo_prazos pr
                                 WHERE pr.processo_id = p.id AND pr.ordem > 0),
                        p.data_remessa_encarregado, p.data_remessa_comissao,
                        p.data_julgamento, p.data_conclusao
                   FROM processos_procedimentos p
                  WHERE p.id = $1::uuid AND p.ativo",
        )
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("apuratório não encontrado".to_string()))?;

        validar_ordem_datas(
            request.data_instauracao,
            request.data_recebimento,
            remessa_encarregado,
            remessa_comissao,
            julgamento,
            conclusao,
        )
        .map_err(AppError::Domain)?;

        // A verificacao vem antes de qualquer UPDATE: assim nenhuma
        // constraint atingida mais adiante mascara a regra com o fallback
        // generico de banco de dados.
        if tem_prorrogacao && anterior != request.data_recebimento {
            return Err(AppError::Domain(
                    "A data de recebimento não pode ser alterada porque este apuratório já possui prorrogação de prazo.".to_string(),
                ));
        }
        Some(anterior)
    } else {
        None
    };

    // Trocar o apuratório de um processo que já tem designações é impossível:
    // `processo_designacoes` amarra `(processo_id, apuratorio_id)` por FK
    // composta e as designações NUNCA são apagadas — são registro histórico de
    // quem respondeu pelo apuratório e quando. Sem esta verificação o usuário
    // recebia a violação de FK crua do PostgreSQL na tela.
    if let Some(id) = request.id.as_deref() {
        let conflito: Option<String> = sqlx::query_scalar(
            "SELECT a.sigla
               FROM processos_procedimentos p
               JOIN apuratorios a ON a.id = p.apuratorio_id
              WHERE p.id = $1::uuid
                AND p.apuratorio_id <> $2::uuid
                AND EXISTS (SELECT 1 FROM processo_designacoes d WHERE d.processo_id = p.id)",
        )
        .bind(id)
        .bind(&request.apuratorio_id)
        .fetch_optional(&mut **tx)
        .await?;
        if let Some(sigla) = conflito {
            return Err(AppError::Domain(format!(
                "este apuratório já tem designações registradas como {sigla}; não é possível trocar a espécie do apuratório"
            )));
        }
    }

    let id: String = match request.id.as_deref() {
        Some(id) => sqlx::query_scalar(
            "UPDATE processos_procedimentos SET
                     apuratorio_id = $2::uuid, documento_iniciador_id = $3::uuid,
                     numero_documento = $4, numero_controle = $5, processo_sei = $6,
                     numero_rgf = $7, unidade_origem_id = $8::uuid,
                     subunidade_secao_origem_id = $9::uuid,
                     municipio_fato_id = $10::uuid, natureza_fato_id = $11::uuid,
                     data_instauracao = $12, data_recebimento = $13,
                     resumo_fatos = $14,
                     updated_at = now()
                 WHERE id = $1::uuid AND ativo
             RETURNING id::text",
        )
        .bind(id)
        .bind(&request.apuratorio_id)
        .bind(&request.documento_iniciador_id)
        .bind(request.numero_documento.trim())
        .bind(numero_controle)
        .bind(request.processo_sei.as_deref())
        .bind(request.numero_rgf.as_deref())
        .bind(&request.unidade_origem_id)
        .bind(request.subunidade_secao_origem_id.as_deref())
        .bind(&request.municipio_fato_id)
        .bind(request.natureza_fato_id.as_deref())
        .bind(request.data_instauracao)
        .bind(request.data_recebimento)
        .bind(request.resumo_fatos.as_deref())
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("apuratório não encontrado".to_string()))?,
        None => {
            sqlx::query_scalar(
                "INSERT INTO processos_procedimentos
                     (apuratorio_id, documento_iniciador_id, numero_documento, numero_controle,
                      processo_sei, numero_rgf, unidade_origem_id,
                      subunidade_secao_origem_id, municipio_fato_id,
                      natureza_fato_id, data_instauracao, data_recebimento, resumo_fatos)
                 VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::uuid,
                         $9::uuid, $10::uuid, $11, $12, $13)
             RETURNING id::text",
            )
            .bind(&request.apuratorio_id)
            .bind(&request.documento_iniciador_id)
            .bind(request.numero_documento.trim())
            .bind(numero_controle)
            .bind(request.processo_sei.as_deref())
            .bind(request.numero_rgf.as_deref())
            .bind(&request.unidade_origem_id)
            .bind(request.subunidade_secao_origem_id.as_deref())
            .bind(&request.municipio_fato_id)
            .bind(request.natureza_fato_id.as_deref())
            .bind(request.data_instauracao)
            .bind(request.data_recebimento)
            .bind(request.resumo_fatos.as_deref())
            .fetch_one(&mut **tx)
            .await?
        }
    };

    gravar_extensao(tx, &id, request, &config).await?;
    gravar_envolvidos(tx, &id, request).await?;
    gravar_designacoes(tx, &id, request).await?;
    gravar_pessoas(tx, &id, request).await?;
    gravar_vitimas(tx, &id, request, &config).await?;

    match data_recebimento_anterior {
        Some(anterior) => {
            deadlines_repository::sync_initial(
                tx,
                &id,
                anterior,
                request.data_recebimento,
                &request.apuratorio_id,
                &request.documento_iniciador_id,
            )
            .await?;
        }
        None => {
            if let Some(data_recebimento) = request.data_recebimento {
                let (dias, _) = deadlines_repository::dias_base(
                    &mut **tx,
                    &request.apuratorio_id,
                    &request.documento_iniciador_id,
                )
                .await?;
                deadlines_repository::create_initial(tx, &id, data_recebimento, dias).await?;
            }
        }
    }

    Ok(id)
}

async fn gravar_extensao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    config: &ConfigApuratorio,
) -> Result<(), AppError> {
    // Trocar o apuratório de um processo pode deixar uma extensão órfã.
    if config.codigo_extensao.as_deref() != Some(EXTENSAO_CARTA_PRECATORIA) {
        sqlx::query("DELETE FROM carta_precatoria_detalhes WHERE processo_id = $1::uuid")
            .bind(processo_id)
            .execute(&mut **tx)
            .await?;
        return Ok(());
    }

    let Some(cp) = &request.carta_precatoria else {
        return Ok(());
    };
    sqlx::query(
        "INSERT INTO carta_precatoria_detalhes (processo_id, deprecante, unidade_deprecada_id)
         VALUES ($1::uuid, $2, $3::uuid)
         ON CONFLICT (processo_id) DO UPDATE
            SET deprecante = EXCLUDED.deprecante,
                unidade_deprecada_id = EXCLUDED.unidade_deprecada_id,
                updated_at = now()",
    )
    .bind(processo_id)
    .bind(cp.deprecante.trim())
    .bind(&cp.unidade_deprecada_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Substitui a lista de envolvidos. Quem sai leva junto o próprio enquadramento,
/// por `ON DELETE CASCADE` nas quatro associativas — que é o comportamento certo:
/// o vínculo não tem significado sem o envolvido.
async fn gravar_envolvidos(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    let manter_ids: Vec<String> = request
        .envolvidos
        .iter()
        .filter_map(|e| e.id.clone())
        .collect();
    // Compatibilidade com clientes anteriores ao id no request: uma linha sem
    // id ainda encontra o vínculo pelo PM. O frontend atual sempre manda o id
    // ao editar, inclusive para o marcador "À apurar".
    let manter_pms_sem_id: Vec<String> = request
        .envolvidos
        .iter()
        .filter(|e| e.id.is_none())
        .filter_map(|e| e.policial_militar_id.clone())
        .collect();
    let manter_a_apurar_sem_id = request
        .envolvidos
        .iter()
        .any(|e| e.id.is_none() && e.policial_militar_id.is_none());

    sqlx::query(
        "DELETE FROM processo_envolvidos
          WHERE processo_id = $1::uuid
            AND NOT (id::text = ANY($2::text[])
                  OR policial_militar_id::text = ANY($3::text[])
                  OR ($4 AND policial_militar_id IS NULL))",
    )
    .bind(processo_id)
    .bind(&manter_ids)
    .bind(&manter_pms_sem_id)
    .bind(manter_a_apurar_sem_id)
    .execute(&mut **tx)
    .await?;

    // Identificados vêm primeiro. Assim a transição simultânea
    // "À apurar" -> PM e PM -> "À apurar" libera o único NULL antes de criá-lo.
    let ordenados = request
        .envolvidos
        .iter()
        .filter(|e| e.policial_militar_id.is_some())
        .chain(
            request
                .envolvidos
                .iter()
                .filter(|e| e.policial_militar_id.is_none()),
        );

    for envolvido in ordenados {
        let envolvido_id = if let Some(id) = envolvido.id.as_deref() {
            sqlx::query_scalar::<_, String>(
                "UPDATE processo_envolvidos
                    SET policial_militar_id = $3::uuid,
                        status_envolvido_id = $4::uuid,
                        ordem = $5,
                        e_condutor = $6,
                        updated_at = now()
                  WHERE id = $1::uuid AND processo_id = $2::uuid
              RETURNING id::text",
            )
            .bind(id)
            .bind(processo_id)
            .bind(envolvido.policial_militar_id.as_deref())
            .bind(&envolvido.status_envolvido_id)
            .bind(envolvido.ordem)
            .bind(envolvido.e_condutor)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| {
                AppError::Domain(
                    "Um dos envolvidos não pertence mais a este apuratório. Recarregue a página."
                        .to_string(),
                )
            })?
        } else {
            let existente: Option<String> = sqlx::query_scalar(
                "SELECT id::text FROM processo_envolvidos
                  WHERE processo_id = $1::uuid
                    AND policial_militar_id IS NOT DISTINCT FROM $2::uuid",
            )
            .bind(processo_id)
            .bind(envolvido.policial_militar_id.as_deref())
            .fetch_optional(&mut **tx)
            .await?;

            match existente {
                Some(id) => {
                    sqlx::query(
                        "UPDATE processo_envolvidos
                            SET status_envolvido_id = $2::uuid,
                                ordem = $3,
                                e_condutor = $4,
                                updated_at = now()
                          WHERE id = $1::uuid",
                    )
                    .bind(&id)
                    .bind(&envolvido.status_envolvido_id)
                    .bind(envolvido.ordem)
                    .bind(envolvido.e_condutor)
                    .execute(&mut **tx)
                    .await?;
                    id
                }
                None => {
                    sqlx::query_scalar(
                        "INSERT INTO processo_envolvidos
                             (processo_id, policial_militar_id, status_envolvido_id, ordem, e_condutor)
                         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)
                      RETURNING id::text",
                    )
                    .bind(processo_id)
                    .bind(envolvido.policial_militar_id.as_deref())
                    .bind(&envolvido.status_envolvido_id)
                    .bind(envolvido.ordem)
                    .bind(envolvido.e_condutor)
                    .fetch_one(&mut **tx)
                    .await?
                }
            }
        };

        if let Some(acusacoes) = &envolvido.acusacoes {
            evidence_repository::save_acusacoes(tx, &envolvido_id, acusacoes).await?;
        }
    }
    Ok(())
}

/// O que já está gravado para o processo, com o que decide se ainda pode mudar.
#[derive(sqlx::FromRow)]
struct DesignacaoGravada {
    id: String,
    papel_id: String,
    papel: String,
    policial_militar_id: String,
    /// `data_fim` preenchida: o militar já saiu do papel. É histórico puro.
    encerrada: bool,
    /// Nasceu de uma substituição. Vigente, mas fora do alcance do cadastro.
    e_substituicao: bool,
}

impl DesignacaoGravada {
    /// Designação que o formulário do processo não altera nem remove. As duas
    /// razões são diferentes e as duas valem: já terminou, ou já é elo de uma
    /// cadeia. Mexer em qualquer das duas reescreveria fato registrado —
    /// princípio 5. A troca de ocupante existe, mas é pela página de detalhes,
    /// que preserva a cadeia.
    fn imutavel(&self) -> bool {
        self.encerrada || self.e_substituicao
    }
}

/// Um papel previsto para o apuratório, como o cadastro o configurou.
#[derive(sqlx::FromRow)]
struct PapelConfigurado {
    papel_id: String,
    papel: String,
    max_ocupantes: i32,
    ativo: bool,
}

/// As regras de designação que dependem do cadastro do apuratório, verificadas
/// ANTES de qualquer escrita.
///
/// Sem isto, cada uma destas situações chegava ao usuário como a frase genérica
/// do banco: a FK composta recusando um papel que a espécie não prevê, e o
/// `tg_max_ocupantes` — que, por ser `DEFERRABLE`, só falha no `commit`, longe
/// da linha que a causou. A aplicação sabe qual linha está errada; é ela que
/// deve dizer.
async fn validar_designacoes(
    tx: &mut Transaction<'_, Postgres>,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    let configurados = sqlx::query_as::<_, PapelConfigurado>(
        "SELECT ap.papel_id::text AS papel_id,
                pap.nome          AS papel,
                ap.max_ocupantes  AS max_ocupantes,
                ap.ativo          AS ativo
           FROM apuratorio_papeis ap
           JOIN papeis_processo pap ON pap.id = ap.papel_id
          WHERE ap.apuratorio_id = $1::uuid",
    )
    .bind(&request.apuratorio_id)
    .fetch_all(&mut **tx)
    .await?;

    for designacao in &request.designacoes {
        let Some(config) = configurados
            .iter()
            .find(|c| c.papel_id == designacao.papel_id)
        else {
            return Err(AppError::Domain(
                "A função escolhida não está prevista para esta espécie de apuratório. \
                 Cadastre-a em Catálogos → Apuratórios ou escolha outra."
                    .to_string(),
            ));
        };

        // Papel desativado continua valendo para quem já o exercia (princípio
        // 6), mas não recebe designação nova.
        if !config.ativo && designacao.id.is_none() {
            return Err(AppError::Domain(format!(
                "A função {} foi desativada e não aceita novas designações.",
                config.papel
            )));
        }

        let informados = request
            .designacoes
            .iter()
            .filter(|d| d.papel_id == designacao.papel_id)
            .count();
        if informados > config.max_ocupantes as usize {
            return Err(AppError::Domain(format!(
                "A função {} aceita no máximo {} ocupante(s) ao mesmo tempo, e foram informados {}.",
                config.papel, config.max_ocupantes, informados
            )));
        }
    }
    Ok(())
}

/// Sincroniza as designações **iniciais** do processo, pelo id de cada uma.
///
/// Antes disto a função só inseria o que não existisse, e o formulário não
/// tinha como corrigir um encarregado lançado errado: reeditar com outro militar
/// criava uma segunda designação vigente em vez de arrumar a primeira. O `id`
/// que `DesignacaoRequest` passou a carregar é o que dá alvo ao UPDATE.
///
/// Três campos não vêm do formulário porque não são digitados — são derivados do
/// cabeçalho do processo, e rederivados a cada gravação:
///
/// - `data_inicio` = data de instauração. Corrigir a instauração move junto o
///   início de quem ainda não tem histórico, pelo mesmo motivo que
///   `deadlines::sync_initial` move o prazo inicial quando o recebimento muda:
///   uma informação, uma fonte de verdade (princípio 4).
/// - `documento_autorizador_id` e `numero_documento` = o documento que instaurou
///   o processo, que é o que de fato designou o encarregado inicial.
///
/// **O que a função nunca toca**: designação encerrada e designação nascida de
/// substituição. Ver `DesignacaoGravada::imutavel`.
async fn gravar_designacoes(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    validar_designacoes(tx, request).await?;

    // `FOR UPDATE` porque a decisão de cada linha (atualizar, apagar, recusar)
    // depende do estado lido: sem o travamento, uma substituição concorrente
    // poderia transformar uma linha livre em elo de cadeia entre a leitura e a
    // escrita, e o cadastro a apagaria por baixo da substituição.
    let gravadas = sqlx::query_as::<_, DesignacaoGravada>(
        "SELECT d.id::text                        AS id,
                d.papel_id::text                  AS papel_id,
                pap.nome                          AS papel,
                d.policial_militar_id::text       AS policial_militar_id,
                d.data_fim IS NOT NULL            AS encerrada,
                d.designacao_anterior_id IS NOT NULL AS e_substituicao
           FROM processo_designacoes d
           JOIN papeis_processo pap ON pap.id = d.papel_id
          WHERE d.processo_id = $1::uuid
          ORDER BY d.data_inicio
            FOR UPDATE OF d",
    )
    .bind(processo_id)
    .fetch_all(&mut **tx)
    .await?;

    let mut mantidas: Vec<&str> = Vec::new();

    for designacao in &request.designacoes {
        let Some(id) = designacao.id.as_deref() else {
            // Sem `id`, é linha nova — e linha nova não pode repetir alguém que
            // já ocupa a mesma função. O EXCLUDE do schema também recusaria,
            // mas falando de "período que se sobrepõe", que não é o que o
            // usuário fez: ele acrescentou uma designação repetida.
            if let Some(repetida) = gravadas.iter().find(|g| {
                !g.encerrada
                    && g.papel_id == designacao.papel_id
                    && g.policial_militar_id == designacao.policial_militar_id
            }) {
                return Err(AppError::Domain(format!(
                    "Este policial militar já está designado como {} neste apuratório.",
                    repetida.papel
                )));
            }
            inserir_designacao(tx, processo_id, request, designacao).await?;
            continue;
        };

        let Some(gravada) = gravadas.iter().find(|g| g.id == id) else {
            return Err(AppError::Domain(
                "Uma das designações não existe mais neste apuratório. \
                 Recarregue a página antes de salvar."
                    .to_string(),
            ));
        };
        mantidas.push(id);

        if gravada.imutavel() {
            // Chegou até aqui contornando a tela, que a mostra bloqueada. Se
            // nada mudou é ruído inofensivo do formulário reenviando o que leu;
            // se mudou, é a alteração que a cadeia não admite.
            if gravada.papel_id != designacao.papel_id
                || gravada.policial_militar_id != designacao.policial_militar_id
            {
                return Err(AppError::Domain(format!(
                    "A designação de {} já tem histórico de substituição e não pode ser alterada aqui. \
                     Use Substituir, na página de detalhes do apuratório.",
                    gravada.papel
                )));
            }
            continue;
        }

        // Só quem entra agora precisa estar ativo. Reeditar um processo cujo
        // encarregado foi desativado depois não pode virar um erro.
        if gravada.policial_militar_id != designacao.policial_militar_id {
            exigir_militar_ativo(tx, &designacao.policial_militar_id).await?;
        }
        atualizar_designacao(tx, processo_id, request, designacao, id).await?;
    }

    for gravada in &gravadas {
        // Designação encerrada é histórico e nunca viaja no formulário: a tela
        // só manda as vigentes. Ausência dela aqui não significa remoção.
        if gravada.encerrada || mantidas.contains(&gravada.id.as_str()) {
            continue;
        }
        if gravada.imutavel() {
            return Err(AppError::Domain(format!(
                "A designação de {} nasceu de uma substituição e não pode ser removida aqui. \
                 Desfaça a substituição na página de detalhes do apuratório.",
                gravada.papel
            )));
        }
        sqlx::query("DELETE FROM processo_designacoes WHERE id = $1::uuid")
            .bind(&gravada.id)
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

async fn inserir_designacao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    designacao: &DesignacaoRequest,
) -> Result<(), AppError> {
    exigir_militar_ativo(tx, &designacao.policial_militar_id).await?;
    sqlx::query(
        "INSERT INTO processo_designacoes
             (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio,
              documento_autorizador_id, numero_documento, motivo)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
                 CASE WHEN (SELECT usa_documento_designacao
                                   FROM apuratorio_papeis
                                  WHERE apuratorio_id = $2::uuid AND papel_id = $4::uuid)
                      THEN $6::uuid END,
                 CASE WHEN (SELECT usa_documento_designacao
                                   FROM apuratorio_papeis
                                  WHERE apuratorio_id = $2::uuid AND papel_id = $4::uuid)
                      THEN $7 END,
                 $8)",
    )
    .bind(processo_id)
    .bind(&request.apuratorio_id)
    .bind(&designacao.policial_militar_id)
    .bind(&designacao.papel_id)
    .bind(request.data_instauracao)
    .bind(&request.documento_iniciador_id)
    .bind(request.numero_documento.trim())
    .bind(MOTIVO_DESIGNACAO_INICIAL)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn atualizar_designacao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    designacao: &DesignacaoRequest,
    id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE processo_designacoes
            SET policial_militar_id      = $3::uuid,
                papel_id                 = $4::uuid,
                data_inicio              = $5,
                documento_autorizador_id = CASE WHEN (SELECT usa_documento_designacao
                                                         FROM apuratorio_papeis
                                                        WHERE apuratorio_id = $9::uuid
                                                          AND papel_id = $4::uuid)
                                                   THEN $6::uuid END,
                numero_documento         = CASE WHEN (SELECT usa_documento_designacao
                                                         FROM apuratorio_papeis
                                                        WHERE apuratorio_id = $9::uuid
                                                          AND papel_id = $4::uuid)
                                                   THEN $7 END,
                motivo                   = $8,
                updated_at               = now()
          WHERE id = $1::uuid AND processo_id = $2::uuid",
    )
    .bind(id)
    .bind(processo_id)
    .bind(&designacao.policial_militar_id)
    .bind(&designacao.papel_id)
    .bind(request.data_instauracao)
    .bind(&request.documento_iniciador_id)
    .bind(request.numero_documento.trim())
    .bind(MOTIVO_DESIGNACAO_INICIAL)
    .bind(&request.apuratorio_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Militar desativado não recebe designação nova.
///
/// A recíproca **não** vale, e é por isso que a checagem está aqui e não na
/// leitura: quem já exercia um papel continua exibido depois de desativado, e
/// reeditar o processo não pode apagar esse vínculo (princípio 6).
async fn exigir_militar_ativo(
    tx: &mut Transaction<'_, Postgres>,
    policial_militar_id: &str,
) -> Result<(), AppError> {
    let ativo: Option<bool> =
        sqlx::query_scalar("SELECT ativo FROM policiais_militares WHERE id = $1::uuid")
            .bind(policial_militar_id)
            .fetch_optional(&mut **tx)
            .await?;
    match ativo {
        Some(true) => Ok(()),
        Some(false) => Err(AppError::Domain(
            "O policial militar escolhido está desativado e não pode receber designação."
                .to_string(),
        )),
        None => Err(AppError::Domain(
            "O policial militar escolhido não existe mais no cadastro.".to_string(),
        )),
    }
}

async fn gravar_pessoas(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM processo_pessoas WHERE processo_id = $1::uuid")
        .bind(processo_id)
        .execute(&mut **tx)
        .await?;
    for pessoa in &request.pessoas {
        sqlx::query(
            "INSERT INTO processo_pessoas (processo_id, papel_pessoa_id, nome, ordem)
             VALUES ($1::uuid, $2::uuid, $3, $4)",
        )
        .bind(processo_id)
        .bind(&pessoa.papel_pessoa_id)
        .bind(pessoa.nome.trim().to_uppercase())
        .bind(pessoa.ordem)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// Sincroniza os Ofendidos/Vítimas — **somente quando a espécie os registra**.
///
/// Com o atributo desligado a função não toca na tabela, nem para apagar. É o
/// princípio 5 no caso concreto: desligar `permite_cadastro_vitima` de uma
/// espécie que já registrou ofendidos não apaga nenhum. Eles saem do alcance do
/// formulário e continuam existindo, do mesmo jeito que a data de julgamento
/// sobrevive a alguém desligar `permite_julgamento`.
///
/// O silêncio nunca é resposta a um pedido: quem MANDA vítima para um
/// apuratório que não as registra é recusado antes, em
/// `validar_contra_configuracao`. Aqui só chega lista vazia.
async fn gravar_vitimas(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    request: &SaveProceedingRequest,
    config: &ConfigApuratorio,
) -> Result<(), AppError> {
    if !config.permite_cadastro_vitima {
        return Ok(());
    }
    sqlx::query("DELETE FROM processo_vitimas WHERE processo_id = $1::uuid")
        .bind(processo_id)
        .execute(&mut **tx)
        .await?;
    for vitima in &request.vitimas {
        sqlx::query(
            "INSERT INTO processo_vitimas (processo_id, nome, ordem)
             VALUES ($1::uuid, $2, $3)",
        )
        .bind(processo_id)
        .bind(vitima.nome.trim().to_uppercase())
        .bind(vitima.ordem)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

// ── Substituição: criar, corrigir e desfazer ─────────────────────────────────
//
// As três operam sobre a MESMA cadeia e compartilham o mesmo cuidado: travar as
// linhas envolvidas com `FOR UPDATE` e reverificar tudo no banco. Nenhuma delas
// confia no que a tela mandou — o IPC é chamável direto, e duas janelas do app
// podem estar na mesma página.

/// Uma designação com o que as regras da cadeia precisam saber, já travada.
#[derive(sqlx::FromRow)]
struct DesignacaoTravada {
    id: String,
    apuratorio_id: String,
    papel_id: String,
    papel: String,
    usa_documento_designacao: bool,
    policial_militar_id: String,
    ocupante: String,
    data_inicio: chrono::NaiveDate,
    data_fim: Option<chrono::NaiveDate>,
    designacao_anterior_id: Option<String>,
}

/// Ids que a substituição mexeu. Os dois são auditados: a antecessora muda de
/// estado tanto quanto a sucessora, e uma trilha que registrasse só uma das duas
/// não explicaria o que aconteceu com a outra.
pub struct SubstituicaoAplicada {
    pub designacao_id: String,
    pub anterior_id: String,
}

/// Lê e trava uma designação do processo. `None` quando o id não é do processo
/// informado — o que também cobre a tentativa de alcançar designação alheia
/// passando um id qualquer pelo IPC.
async fn travar_designacao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    designacao_id: &str,
) -> Result<Option<DesignacaoTravada>, AppError> {
    sqlx::query_as::<_, DesignacaoTravada>(
        "SELECT d.id::text                    AS id,
                d.apuratorio_id::text         AS apuratorio_id,
                d.papel_id::text              AS papel_id,
                pap.nome                      AS papel,
                ap.usa_documento_designacao   AS usa_documento_designacao,
                d.policial_militar_id::text   AS policial_militar_id,
                pg.sigla || ' ' || pm.matricula || ' ' || pm.nome AS ocupante,
                d.data_inicio                 AS data_inicio,
                d.data_fim                    AS data_fim,
                d.designacao_anterior_id::text AS designacao_anterior_id
           FROM processo_designacoes d
           JOIN papeis_processo pap    ON pap.id = d.papel_id
           JOIN apuratorio_papeis ap   ON ap.apuratorio_id = d.apuratorio_id
                                      AND ap.papel_id = d.papel_id
           JOIN policiais_militares pm ON pm.id = d.policial_militar_id
           JOIN postos_graduacoes pg   ON pg.id = pm.posto_graduacao_id
          WHERE d.id = $1::uuid AND d.processo_id = $2::uuid
            FOR UPDATE OF d",
    )
    .bind(designacao_id)
    .bind(processo_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::from)
}

const DESIGNACAO_AUSENTE: &str = "A designação informada não pertence a este apuratório. \
                                  Recarregue a página e tente de novo.";

/// Regras comuns a criar e a corrigir uma substituição: quem sai, quem entra e
/// quando. `antecessora` é sempre a designação que será encerrada na troca.
async fn validar_troca(
    tx: &mut Transaction<'_, Postgres>,
    antecessora: &DesignacaoTravada,
    sucessor_id: &str,
    data_troca: chrono::NaiveDate,
) -> Result<(), AppError> {
    if data_troca <= antecessora.data_inicio {
        return Err(AppError::Domain(format!(
            "A substituição precisa ser posterior a {}, quando {} assumiu como {}.",
            antecessora.data_inicio.format("%d/%m/%Y"),
            antecessora.ocupante,
            antecessora.papel
        )));
    }
    if antecessora.policial_militar_id == sucessor_id {
        return Err(AppError::Domain(format!(
            "{} já ocupa a função de {}. Escolha outro policial militar como sucessor.",
            antecessora.ocupante, antecessora.papel
        )));
    }
    exigir_militar_ativo(tx, sucessor_id).await
}

/// Encerra uma designação vigente e abre a do sucessor no MESMO dia.
///
/// `data_fim` é exclusiva (decisão 6): os períodos se encostam sem sobrepor e
/// sem lacuna, com uma data só registrada. O vínculo `designacao_anterior_id` é
/// o que torna a troca reversível depois.
pub async fn substituir_designacao(
    tx: &mut Transaction<'_, Postgres>,
    request: &SubstituirDesignacaoRequest,
) -> Result<SubstituicaoAplicada, AppError> {
    crate::db::processo::exigir_em_andamento(
        tx,
        &request.processo_id,
        "registrar uma substituição",
    )
    .await?;
    let antecessora = travar_designacao(tx, &request.processo_id, &request.designacao_id)
        .await?
        .ok_or_else(|| AppError::Domain(DESIGNACAO_AUSENTE.to_string()))?;

    if antecessora.data_fim.is_some() {
        return Err(AppError::Domain(format!(
            "A designação de {} como {} já foi encerrada em {}. \
             Substitua quem está vigente na função.",
            antecessora.ocupante,
            antecessora.papel,
            antecessora
                .data_fim
                .expect("data_fim conferida logo acima")
                .format("%d/%m/%Y")
        )));
    }

    validar_troca(tx, &antecessora, &request.sucessor_id, request.data_troca).await?;

    sqlx::query(
        "UPDATE processo_designacoes SET data_fim = $2, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(&antecessora.id)
    .bind(request.data_troca)
    .execute(&mut **tx)
    .await?;

    let documento = antecessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.documento_autorizador_id.as_deref()))
        .flatten();
    let numero_documento = antecessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.numero_documento.as_deref()))
        .flatten();
    let designacao_id: String = sqlx::query_scalar(
        "INSERT INTO processo_designacoes
             (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio,
              documento_autorizador_id, numero_documento, motivo, designacao_anterior_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid, $7, $8, $9::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(&antecessora.apuratorio_id)
    .bind(&request.sucessor_id)
    .bind(&antecessora.papel_id)
    .bind(request.data_troca)
    .bind(documento)
    .bind(numero_documento)
    .bind(request.motivo.trim())
    .bind(&antecessora.id)
    .fetch_one(&mut **tx)
    .await?;

    Ok(SubstituicaoAplicada {
        designacao_id,
        anterior_id: antecessora.id,
    })
}

/// A substituição que está na ponta da cadeia, travada junto com a antecessora.
///
/// "Última" é por CADEIA, não pelo processo nem pelo papel: uma designação
/// vigente que tem antecessora é a ponta da sua própria cadeia. A diferença
/// aparece quando um papel admite dois ocupantes — a configuração de Escrivão
/// prevê isso —, e aí corrigir a troca de um escrivão não pode depender da troca
/// do outro. Ser vigente (`data_fim IS NULL`) já garante que nada a sucedeu.
async fn travar_ultima_substituicao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    designacao_id: &str,
) -> Result<(DesignacaoTravada, DesignacaoTravada), AppError> {
    let sucessora = travar_designacao(tx, processo_id, designacao_id)
        .await?
        .ok_or_else(|| AppError::Domain(DESIGNACAO_AUSENTE.to_string()))?;

    let Some(anterior_id) = sucessora.designacao_anterior_id.clone() else {
        return Err(AppError::Domain(format!(
            "A designação de {} como {} é a inicial do apuratório, não uma substituição. \
             Corrija-a pelo cadastro do apuratório.",
            sucessora.ocupante, sucessora.papel
        )));
    };

    if sucessora.data_fim.is_some() {
        return Err(AppError::Domain(format!(
            "Esta substituição de {} já foi sucedida por outra. \
             Desfaça primeiro a substituição mais recente da função.",
            sucessora.papel
        )));
    }

    let anterior = travar_designacao(tx, processo_id, &anterior_id)
        .await?
        .ok_or_else(|| AppError::Domain(DESIGNACAO_AUSENTE.to_string()))?;

    Ok((sucessora, anterior))
}

/// Corrige a última substituição da cadeia sem abrir lacuna nem sobreposição.
///
/// A data move as DUAS linhas: é uma data só, o fim da antecessora e o início da
/// sucessora. Alterar apenas uma delas é o que produziria o buraco — e é também
/// o que `tg_cadeia_designacao` recusa no `commit`, caso algum caminho futuro
/// tente.
pub async fn atualizar_substituicao(
    tx: &mut Transaction<'_, Postgres>,
    request: &AtualizarSubstituicaoRequest,
) -> Result<SubstituicaoAplicada, AppError> {
    let (sucessora, anterior) =
        travar_ultima_substituicao(tx, &request.processo_id, &request.designacao_id).await?;

    validar_troca(tx, &anterior, &request.sucessor_id, request.data_troca).await?;

    let documento = sucessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.documento_autorizador_id.as_deref()))
        .flatten();
    let numero_documento = sucessora
        .usa_documento_designacao
        .then(|| texto_opcional(request.numero_documento.as_deref()))
        .flatten();

    sqlx::query(
        "UPDATE processo_designacoes SET data_fim = $2, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(&anterior.id)
    .bind(request.data_troca)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE processo_designacoes
            SET policial_militar_id      = $2::uuid,
                data_inicio              = $3,
                documento_autorizador_id = $4::uuid,
                numero_documento         = $5,
                motivo                   = $6,
                updated_at               = now()
          WHERE id = $1::uuid",
    )
    .bind(&sucessora.id)
    .bind(&request.sucessor_id)
    .bind(request.data_troca)
    .bind(documento)
    .bind(numero_documento)
    .bind(request.motivo.trim())
    .execute(&mut **tx)
    .await?;

    Ok(SubstituicaoAplicada {
        designacao_id: sucessora.id,
        anterior_id: anterior.id,
    })
}

/// Desfaz a última substituição da cadeia: apaga a sucessora e reabre a
/// antecessora.
///
/// Reabrir é limpar `data_fim` — a vigência é derivada dela, não de uma coluna
/// `ativo`. Feito isto, a substituição anterior passa a ser a ponta da cadeia e
/// pode ser desfeita em seguida, uma a uma, de trás para frente. É o mesmo
/// desenho de `deadlines::delete_extension`.
pub async fn remover_substituicao(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    designacao_id: &str,
) -> Result<SubstituicaoAplicada, AppError> {
    let (sucessora, anterior) = travar_ultima_substituicao(tx, processo_id, designacao_id).await?;

    // Nesta ordem: enquanto a sucessora existir, a FK `fk_designacao_anterior`
    // segura a antecessora — que é exatamente o que impede alguém apagar o meio
    // da cadeia por fora.
    sqlx::query("DELETE FROM processo_designacoes WHERE id = $1::uuid")
        .bind(&sucessora.id)
        .execute(&mut **tx)
        .await?;

    sqlx::query(
        "UPDATE processo_designacoes SET data_fim = NULL, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(&anterior.id)
    .execute(&mut **tx)
    .await?;

    Ok(SubstituicaoAplicada {
        designacao_id: sucessora.id,
        anterior_id: anterior.id,
    })
}

/// Campo de texto opcional vindo da tela: em branco é ausência, não string
/// vazia. Sem isto, um `<input>` intocado gravaria `''` e o documento passaria a
/// "existir" vazio no histórico.
fn texto_opcional(valor: Option<&str>) -> Option<String> {
    valor
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

/// Atualiza somente as datas registradas depois do cadastro. Uma conclusão já
/// gravada pode ser corrigida aqui, mas sua remoção continua sendo a operação
/// explícita `reopen`, com autorização e auditoria próprias.
pub async fn update_dates(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateProceedingDatesRequest,
) -> Result<(), AppError> {
    let (
        data_instauracao,
        data_recebimento,
        remessa_comissao_atual,
        julgamento_atual,
        conclusao_atual,
        permite_remessa_comissao,
        permite_julgamento,
    ): (
        chrono::NaiveDate,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
        Option<chrono::NaiveDate>,
        bool,
        bool,
    ) = sqlx::query_as(
        "SELECT p.data_instauracao, p.data_recebimento, p.data_remessa_comissao,
                    p.data_julgamento, p.data_conclusao,
                    a.permite_remessa_comissao, a.permite_julgamento
               FROM processos_procedimentos p
               JOIN apuratorios a ON a.id = p.apuratorio_id
              WHERE p.id = $1::uuid AND p.ativo
              FOR UPDATE",
    )
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("apuratório não encontrado".to_string()))?;

    validar_ordem_datas(
        data_instauracao,
        data_recebimento,
        request.data_remessa_encarregado,
        request.data_remessa_comissao,
        request.data_julgamento,
        request.data_conclusao,
    )
    .map_err(AppError::Domain)?;
    if conclusao_atual.is_some() && request.data_conclusao.is_none() {
        return Err(AppError::Domain(
            "Para remover a conclusão, use a ação Reabrir apuratório.".to_string(),
        ));
    }
    if permite_remessa_comissao && request.data_remessa_encarregado.is_some() {
        return Err(AppError::Domain(
            "Neste apuratório, informe somente a remessa à comissão.".to_string(),
        ));
    }
    // Configuração governa novos fatos. Se um dado histórico já existir depois
    // de a configuração mudar, ele continua corrigível ou removível — não se
    // apaga nem se torna inacessível em silêncio (princípio 5).
    if !permite_remessa_comissao
        && remessa_comissao_atual.is_none()
        && request.data_remessa_comissao.is_some()
    {
        return Err(AppError::Domain(
            "Este apuratório não prevê remessa à comissão.".to_string(),
        ));
    }
    if !permite_julgamento && julgamento_atual.is_none() && request.data_julgamento.is_some() {
        return Err(AppError::Domain(
            "Este apuratório não prevê data de julgamento.".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE processos_procedimentos
            SET data_remessa_encarregado = $2, data_remessa_comissao = $3,
                data_julgamento = $4, data_conclusao = $5, updated_at = now()
          WHERE id = $1::uuid AND ativo",
    )
    .bind(&request.processo_id)
    .bind(request.data_remessa_encarregado)
    .bind(request.data_remessa_comissao)
    .bind(request.data_julgamento)
    .bind(request.data_conclusao)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Atualiza o resultado de um único envolvido sem regravar os demais dados do
/// processo. Os atributos dos catálogos, e não seus nomes, controlam punição e
/// quantidade de dias.
pub async fn update_involved_outcome(
    tx: &mut Transaction<'_, Postgres>,
    request: &UpdateInvolvedOutcomeRequest,
) -> Result<(), AppError> {
    let (permite_punicao, permite_solucao_sugerida, solucao_sugerida_atual): (
        bool,
        bool,
        Option<String>,
    ) = sqlx::query_as(
        "SELECT a.permite_punicao, a.permite_solucao_sugerida,
                e.solucao_sugerida_id::text
           FROM processo_envolvidos e
           JOIN processos_procedimentos p ON p.id = e.processo_id AND p.ativo
           JOIN apuratorios a ON a.id = p.apuratorio_id
          WHERE e.id = $1::uuid AND e.processo_id = $2::uuid
          FOR UPDATE OF e",
    )
    .bind(&request.envolvido_id)
    .bind(&request.processo_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Domain("envolvido não encontrado neste apuratório".to_string()))?;

    if !permite_solucao_sugerida && request.solucao_sugerida_id.is_some() {
        return Err(AppError::Domain(
            "solução sugerida é permitida somente para procedimentos".to_string(),
        ));
    }
    let solucao_sugerida = if permite_solucao_sugerida {
        request.solucao_sugerida_id.as_deref()
    } else {
        solucao_sugerida_atual.as_deref()
    };

    if request.penalidade_tipo_id.is_some() {
        if !permite_punicao {
            return Err(AppError::Domain(
                "este apuratório não permite registrar penalidade".to_string(),
            ));
        }
        let permite_penalidade: bool = match request.solucao_decidida_id.as_deref() {
            Some(id) => sqlx::query_scalar(
                "SELECT permite_penalidade FROM tipos_solucao_decidida WHERE id = $1::uuid",
            )
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?
            .unwrap_or(false),
            None => false,
        };
        if !permite_penalidade {
            return Err(AppError::Domain(
                "a solução decidida selecionada não permite penalidade".to_string(),
            ));
        }
    }

    if let Some(penalidade_id) = request.penalidade_tipo_id.as_deref() {
        let usa_dias: bool = sqlx::query_scalar(
            "SELECT usa_quantidade_dias FROM tipos_penalidade WHERE id = $1::uuid",
        )
        .bind(penalidade_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::Domain("tipo de penalidade não encontrado".to_string()))?;
        if request.penalidade_dias.is_some() && !usa_dias {
            return Err(AppError::Domain(
                "este tipo de penalidade não usa quantidade de dias".to_string(),
            ));
        }
    } else if request.penalidade_dias.is_some() {
        return Err(AppError::Domain(
            "selecione a penalidade antes de informar a quantidade de dias".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE processo_envolvidos
            SET solucao_sugerida_id = $3::uuid, solucao_decidida_id = $4::uuid,
                penalidade_tipo_id = $5::uuid, penalidade_dias = $6, updated_at = now()
          WHERE id = $1::uuid AND processo_id = $2::uuid",
    )
    .bind(&request.envolvido_id)
    .bind(&request.processo_id)
    .bind(solucao_sugerida)
    .bind(request.solucao_decidida_id.as_deref())
    .bind(request.penalidade_tipo_id.as_deref())
    .bind(request.penalidade_dias)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn soft_delete(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE processos_procedimentos SET ativo = false, updated_at = now() WHERE id = $1::uuid",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("apuratório não encontrado".to_string()));
    }
    Ok(())
}

/// Reabrir é limpar a data de conclusão — que é o que define "concluído".
pub async fn reopen(tx: &mut Transaction<'_, Postgres>, id: &str) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE processos_procedimentos SET data_conclusao = NULL, updated_at = now()
          WHERE id = $1::uuid AND ativo",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("apuratório não encontrado".to_string()));
    }
    Ok(())
}

// ── Anexos ───────────────────────────────────────────────────────────────────

/// Um processo pode ter vários anexos — antes eram cinco colunas `pdf_*` dentro
/// de cada tabela de espécie, coexistindo com uma tabela de PDFs nunca usada.
pub async fn upload_anexo(
    tx: &mut Transaction<'_, Postgres>,
    request: &UploadAttachmentRequest,
    autor_id: &str,
) -> Result<String, AppError> {
    let conteudo = base64::engine::general_purpose::STANDARD
        .decode(request.conteudo.as_bytes())
        .map_err(|_| AppError::Domain("conteudo do anexo nao esta em base64".to_string()))?;

    if conteudo.is_empty() {
        return Err(AppError::Domain("o anexo esta vazio".to_string()));
    }
    if conteudo.len() > MAX_ANEXO_BYTES {
        return Err(AppError::Domain(format!(
            "o anexo excede o limite de {} MB",
            MAX_ANEXO_BYTES / 1024 / 1024
        )));
    }

    sqlx::query_scalar(
        "INSERT INTO processo_anexos
             (processo_id, nome_arquivo, mime_type, conteudo, enviado_por_id)
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)
      RETURNING id::text",
    )
    .bind(&request.processo_id)
    .bind(request.nome_arquivo.trim())
    .bind(request.mime_type.trim())
    .bind(conteudo)
    .bind(autor_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::from)
}

pub async fn get_anexo(
    pool: &PgPool,
    anexo_id: &str,
) -> Result<Option<AttachmentContent>, sqlx::Error> {
    let linha: Option<(String, String, Vec<u8>)> = sqlx::query_as(
        "SELECT nome_arquivo, mime_type, conteudo FROM processo_anexos
          WHERE id = $1::uuid AND cancelado_em IS NULL",
    )
    .bind(anexo_id)
    .fetch_optional(pool)
    .await?;

    Ok(
        linha.map(|(nome_arquivo, mime_type, conteudo)| AttachmentContent {
            nome_arquivo,
            mime_type,
            conteudo: base64::engine::general_purpose::STANDARD.encode(conteudo),
        }),
    )
}

pub async fn remove_anexo(
    tx: &mut Transaction<'_, Postgres>,
    anexo_id: &str,
) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE processo_anexos SET cancelado_em = now()
          WHERE id = $1::uuid AND cancelado_em IS NULL",
    )
    .bind(anexo_id)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Domain("anexo nao encontrado".to_string()));
    }
    Ok(())
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/// Panorama geral: os quatro números do painel de entrada.
///
/// As quatro quebras por FK que ficavam aqui saíram na rodada 29 — ver o
/// cabeçalho de `DashboardSummary`. Continuam existindo, em `maps_reports`, e lá
/// aceitam o escopo que aqui nunca houve.
pub async fn dashboard(pool: &PgPool) -> Result<DashboardSummary, sqlx::Error> {
    let (total, em_andamento, concluidos): (i64, i64, i64) = sqlx::query_as(
        "SELECT count(*),
                count(*) FILTER (WHERE data_conclusao IS NULL),
                count(*) FILTER (WHERE data_conclusao IS NOT NULL)
           FROM processos_procedimentos WHERE ativo",
    )
    .fetch_one(pool)
    .await?;

    // Quem já remeteu sai da conta, como sai das listagens de Prazos: o prazo
    // é do encarregado, e ele já entregou. Sem isto, o KPI diria oito e a
    // tabela logo abaixo — servida pelo `deadlines::report` — mostraria seis.
    let prazos_vencidos: i64 = sqlx::query_scalar(
        "SELECT count(*)
           FROM processos_procedimentos p
           JOIN LATERAL (
               SELECT pr.data_vencimento FROM processo_prazos pr
                WHERE pr.processo_id = p.id ORDER BY pr.ordem DESC LIMIT 1
           ) prazo ON true
          WHERE p.ativo AND p.data_conclusao IS NULL
            AND COALESCE(p.data_remessa_comissao,
                         p.data_remessa_encarregado) IS NULL
            AND prazo.data_vencimento < CURRENT_DATE",
    )
    .fetch_one(pool)
    .await?;

    Ok(DashboardSummary {
        total,
        em_andamento,
        concluidos,
        prazos_vencidos,
    })
}
