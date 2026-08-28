-- Subunidade/Seção de origem.
--
-- O catálogo pertence obrigatoriamente a uma Unidade PM, mas o vínculo no
-- processo é opcional. A FK composta impede escolher uma subunidade de outra
-- unidade. Os índices usam NULLS NOT DISTINCT para que dois processos sem
-- subunidade continuem sujeitos à mesma regra de unicidade que existia antes.

CREATE TABLE subunidades_secoes (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_pm_id UUID        NOT NULL,
    nome          TEXT        NOT NULL,
    ativo         BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_subunidade_unidade FOREIGN KEY (unidade_pm_id)
        REFERENCES unidades_pm (id) ON DELETE RESTRICT,
    -- Alvo da FK composta do processo. Também impede trocar a unidade de uma
    -- subunidade já usada, preservando o fato histórico.
    CONSTRAINT uq_subunidade_id_unidade UNIQUE (id, unidade_pm_id)
);

CREATE UNIQUE INDEX uq_subunidades_secoes_unidade_nome
    ON subunidades_secoes (unidade_pm_id, lower(nome));
CREATE INDEX ix_subunidades_secoes_unidade
    ON subunidades_secoes (unidade_pm_id);

ALTER TABLE processos_procedimentos
    ADD COLUMN subunidade_secao_origem_id UUID NULL,
    ADD CONSTRAINT fk_processo_subunidade_unidade
        FOREIGN KEY (subunidade_secao_origem_id, unidade_origem_id)
        REFERENCES subunidades_secoes (id, unidade_pm_id)
        MATCH SIMPLE ON DELETE RESTRICT;

CREATE INDEX ix_processo_subunidade_secao
    ON processos_procedimentos (subunidade_secao_origem_id);

DROP INDEX uq_processo_numero_documento;
DROP INDEX uq_processo_numero_controle;

CREATE UNIQUE INDEX uq_processo_numero_documento ON processos_procedimentos (
    unidade_origem_id,
    subunidade_secao_origem_id,
    (EXTRACT(YEAR FROM data_instauracao)::INTEGER),
    apuratorio_id,
    documento_iniciador_id,
    lower(numero_documento)
) NULLS NOT DISTINCT WHERE ativo;

CREATE UNIQUE INDEX uq_processo_numero_controle ON processos_procedimentos (
    unidade_origem_id,
    subunidade_secao_origem_id,
    (EXTRACT(YEAR FROM data_instauracao)::INTEGER),
    apuratorio_id,
    lower(COALESCE(numero_controle, numero_documento))
) NULLS NOT DISTINCT WHERE ativo;

-- A view é contrato compartilhado por processos, mapas, prazos e usuários.
-- As colunas novas são separadas; cada saída decide se mostra a origem composta.
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
    'responsável vigente, prazo vigente e contagem de envolvidos. Não filtra '
    '`ativo` de catálogo: é leitura de registro existente.';
