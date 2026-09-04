-- =============================================================================
-- A remessa entra no contrato da view.
--
-- A situação do processo é derivada das datas registradas (decisão 25), e a
-- remessa era a única etapa do fluxo que a view não expunha: o detalhe do
-- processo precisava de uma consulta extra à tabela base só para lê-la, e a
-- coluna "Status prazo" da listagem não tinha como saber que o apuratório já
-- havia saído das mãos do encarregado.
--
-- As duas colunas de remessa são ALTERNATIVAS da mesma etapa — a espécie
-- decide qual vale, por `apuratorios.permite_remessa_comissao` (decisão 31), e
-- a 0010 já garantiu que nenhum processo tenha as duas. Por isso o `COALESCE`
-- é a remessa efetiva, e não uma escolha entre dois fatos concorrentes.
--
-- `entregue` acompanha `data_remessa` no mesmo padrão de
-- `concluido`/`data_conclusao`: o booleano é derivação da data, nunca uma
-- segunda fonte de verdade (princípio 4). Nenhum dado é reescrito.
-- =============================================================================

DROP VIEW v_processos_detalhados;

CREATE VIEW v_processos_detalhados AS
SELECT
    p.id                                             AS id,
    p.ativo                                          AS ativo,
    p.apuratorio_id                                  AS apuratorio_id,
    a.tipo_apuratorio_id                             AS tipo_apuratorio_id,
    p.documento_iniciador_id                         AS documento_iniciador_id,
    p.unidade_origem_id                              AS unidade_origem_id,
    p.subunidade_secao_origem_id                     AS subunidade_secao_origem_id,
    p.municipio_fato_id                              AS municipio_fato_id,
    p.natureza_fato_id                               AS natureza_fato_id,

    a.sigla                                          AS apuratorio_sigla,
    a.nome                                           AS apuratorio_nome,
    ta.nome                                          AS tipo_apuratorio,
    td.nome                                          AS documento_iniciador,
    un.nome                                          AS unidade_origem,
    sub.nome                                         AS subunidade_secao_origem,
    mun.nome                                         AS municipio_fato,
    nf.nome                                          AS natureza_fato,

    p.numero_documento                               AS numero_documento,
    COALESCE(p.numero_controle, p.numero_documento)  AS numero_controle,
    a.sigla || ' nº ' || COALESCE(p.numero_controle, p.numero_documento)
        || '/' || EXTRACT(YEAR FROM p.data_instauracao)::int::text
        || '/' || un.nome
        || CASE WHEN sub.id IS NULL THEN '' ELSE '/' || sub.nome END AS rotulo,

    p.data_instauracao                               AS data_instauracao,
    p.data_recebimento                               AS data_recebimento,
    COALESCE(p.data_remessa_comissao,
             p.data_remessa_encarregado)             AS data_remessa,
    (COALESCE(p.data_remessa_comissao,
              p.data_remessa_encarregado)
        IS NOT NULL)                                 AS entregue,
    p.data_conclusao                                 AS data_conclusao,
    (p.data_conclusao IS NOT NULL)                   AS concluido,

    p.resumo_fatos                                   AS resumo_fatos,
    p.processo_sei                                   AS processo_sei,
    p.numero_rgf                                     AS numero_rgf,

    resp.policial_militar_id                         AS responsavel_id,
    resp.nome                                        AS responsavel_nome,
    resp.papel                                       AS responsavel_papel,

    prazo.data_vencimento                            AS prazo_vencimento,
    (prazo.data_vencimento - CURRENT_DATE)::int      AS prazo_dias_restantes,
    prazo.ordem                                      AS prazo_ordem,

    env.total                                        AS total_envolvidos

FROM processos_procedimentos p
JOIN apuratorios a            ON a.id = p.apuratorio_id
JOIN tipos_apuratorio ta      ON ta.id = a.tipo_apuratorio_id
JOIN tipos_documento td       ON td.id = p.documento_iniciador_id
JOIN unidades_pm un           ON un.id = p.unidade_origem_id
LEFT JOIN subunidades_secoes sub ON sub.id = p.subunidade_secao_origem_id
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
    'Processo com catálogos resolvidos, incluindo subunidade/seção opcional, e '
    'responsável vigente, remessa efetiva, prazo vigente e contagem de '
    'envolvidos. Não filtra `ativo` de catálogo: é leitura de registro '
    'existente.';
