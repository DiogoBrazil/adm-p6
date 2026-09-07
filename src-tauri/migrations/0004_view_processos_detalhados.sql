-- =============================================================================
-- 0004 — v_processos_detalhados
--
-- POR QUE ESTA VIEW EXISTE
--
-- A composição "processo + apuratório + unidade + natureza + responsável
-- vigente + prazo vigente" estava repetida, em SQL, em cinco lugares:
-- `proceedings::repository` (COLUNAS_LISTA, JOIN_RESPONSAVEL, JOIN_PRAZO),
-- `maps_reports::map_rows`, `deadlines::report`, `deadlines::dashboard` e
-- `users::proceedings_as_*`. Cada cópia podia divergir das outras em silêncio —
-- e duas já divergiam: o mapa montava o rótulo do processo com uma expressão
-- ligeiramente diferente, e `deadlines` derivava a vigência do prazo por
-- `DISTINCT ON` em vez do `LATERAL` usado no resto.
--
-- ESTA NÃO É A ANTIGA `v_processos`
--
-- Aquela existia para esconder dez tabelas quase idênticas, uma por espécie de
-- apuratório — o problema que a remodelagem eliminou. Esta parte de UMA tabela
-- e só resolve as três derivações que o schema não guarda como coluna:
--
--   1. o responsável, que depende de `apuratorio_papeis.e_responsavel`;
--   2. o prazo vigente, que é o de maior `ordem`;
--   3. a contagem de envolvidos.
--
-- REGRA DE LEITURA
--
-- Nenhum JOIN de catálogo filtra `ativo`: esta view lê REGISTRO EXISTENTE, e um
-- processo de 2019 cuja natureza foi desativada em 2026 tem de continuar
-- exibindo aquela natureza. O filtro de ativos existe só nas listas de opções.
-- `p.ativo` é exposto como coluna para quem lista processos filtrar por ele.
-- =============================================================================

CREATE VIEW v_processos_detalhados AS
SELECT
    -- Identidade e chaves, para filtrar sem voltar à tabela base.
    p.id                                             AS id,
    p.ativo                                          AS ativo,
    p.apuratorio_id                                  AS apuratorio_id,
    a.tipo_apuratorio_id                             AS tipo_apuratorio_id,
    p.documento_iniciador_id                         AS documento_iniciador_id,
    p.unidade_origem_id                              AS unidade_origem_id,
    p.municipio_fato_id                              AS municipio_fato_id,
    p.natureza_fato_id                               AS natureza_fato_id,

    -- Rótulos vindos do catálogo.
    a.sigla                                          AS apuratorio_sigla,
    a.nome                                           AS apuratorio_nome,
    ta.nome                                          AS tipo_apuratorio,
    td.nome                                          AS documento_iniciador,
    un.nome                                          AS unidade_origem,
    mun.nome                                         AS municipio_fato,
    nf.nome                                          AS natureza_fato,

    -- Numeração. `numero_controle` e `numero_documento` são conceitos
    -- distintos (diferem em 5 dos 128 registros do dump), mas a Seção
    -- identifica o processo pelo de controle quando ele existe.
    p.numero_documento                               AS numero_documento,
    COALESCE(p.numero_controle, p.numero_documento)  AS numero_controle,
    a.sigla || ' nº ' || COALESCE(p.numero_controle, p.numero_documento)
        || '/' || un.nome || '/'
        || EXTRACT(YEAR FROM p.data_instauracao)::int::text  AS rotulo,

    -- Datas. `concluido` é derivado: a coluna booleana foi eliminada porque
    -- coincidia com `data_conclusao IS NOT NULL` em 128/128 registros.
    p.data_instauracao                               AS data_instauracao,
    p.data_recebimento                               AS data_recebimento,
    p.data_conclusao                                 AS data_conclusao,
    (p.data_conclusao IS NOT NULL)                   AS concluido,

    p.resumo_fatos                                   AS resumo_fatos,
    p.processo_sei                                   AS processo_sei,
    p.numero_rgf                                     AS numero_rgf,

    -- Derivação 1: o responsável vigente. Nenhum nome de papel aparece aqui —
    -- quem decide é `apuratorio_papeis.e_responsavel`, e por isso "Encarregado"
    -- pode ser renomeado e PAD/CD/CJ podem apontar para "Presidente".
    resp.policial_militar_id                         AS responsavel_id,
    resp.nome                                        AS responsavel_nome,
    resp.papel                                       AS responsavel_papel,

    -- Derivação 2: o prazo vigente é o de maior `ordem`. Não há coluna `ativo`
    -- em `processo_prazos`; a vigência é derivada, e o EXCLUDE do schema
    -- garante que os períodos nunca se sobrepõem.
    prazo.data_vencimento                            AS prazo_vencimento,
    (prazo.data_vencimento - CURRENT_DATE)::int      AS prazo_dias_restantes,
    prazo.ordem                                      AS prazo_ordem,

    -- Derivação 3.
    env.total                                        AS total_envolvidos

FROM processos_procedimentos p
JOIN apuratorios a            ON a.id = p.apuratorio_id
JOIN tipos_apuratorio ta      ON ta.id = a.tipo_apuratorio_id
JOIN tipos_documento td       ON td.id = p.documento_iniciador_id
JOIN unidades_pm un           ON un.id = p.unidade_origem_id
JOIN municipios_distritos mun ON mun.id = p.municipio_fato_id
LEFT JOIN naturezas_fato nf   ON nf.id = p.natureza_fato_id

LEFT JOIN LATERAL (
    SELECT d.policial_militar_id::text AS policial_militar_id,
           pmr.nome                    AS nome,
           pap.nome                    AS papel
      FROM processo_designacoes d
      JOIN apuratorio_papeis ap    ON ap.apuratorio_id = d.apuratorio_id
                                  AND ap.papel_id = d.papel_id
      JOIN papeis_processo pap     ON pap.id = d.papel_id
      JOIN policiais_militares pmr ON pmr.id = d.policial_militar_id
     WHERE d.processo_id = p.id AND d.data_fim IS NULL AND ap.e_responsavel
     LIMIT 1
) resp ON true

LEFT JOIN LATERAL (
    SELECT pr.data_vencimento, pr.ordem
      FROM processo_prazos pr
     WHERE pr.processo_id = p.id
     ORDER BY pr.ordem DESC
     LIMIT 1
) prazo ON true

LEFT JOIN LATERAL (
    SELECT count(*) AS total
      FROM processo_envolvidos e
     WHERE e.processo_id = p.id
) env ON true;

COMMENT ON VIEW v_processos_detalhados IS
    'Processo com catálogos resolvidos e as três derivações que o schema não '
    'guarda como coluna: responsável vigente (via apuratorio_papeis.e_responsavel), '
    'prazo vigente (maior ordem) e contagem de envolvidos. Não filtra `ativo` de '
    'catálogo: é leitura de registro existente.';

-- Nenhum índice novo: a 0001 já traz os três que as derivações usam —
-- `ix_designacao_vigente (processo_id, papel_id) WHERE data_fim IS NULL`,
-- `ix_prazo_processo (processo_id)` e `ix_envolvido_processo (processo_id)`.
-- Índice redundante custa em toda escrita e não paga leitura nenhuma.
