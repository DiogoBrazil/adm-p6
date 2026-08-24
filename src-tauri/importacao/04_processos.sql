-- =============================================================================
-- ETAPA 04 — OS 128 PROCESSOS E PROCEDIMENTOS
--
-- Uma tabela só, no lugar das 10 tabelas por espécie mais o hub que as costurava
-- por código Rust sem FK nenhuma. Os ids do legado são PRESERVADOS.
--
-- Três colunas de número do legado viram uma. Verificado no dump:
-- `numero` == `numero_portaria` em 88/89, `numero_memorando` em 32/32 e
-- `numero_feito` em 7/7 — são o mesmo conceito, e viram `numero_documento`.
-- Já `numero_controle` difere de `numero` em 5 linhas: é conceito distinto e
-- fica na coluna própria.
--
-- A coluna `concluido` é descartada: concluído <=> data_conclusao IS NOT NULL,
-- equivalência verificada em 128/128.
--
-- Roda em transação única.
-- =============================================================================
BEGIN;

INSERT INTO processos_procedimentos (
    id, apuratorio_id, documento_iniciador_id, numero_documento, numero_controle,
    processo_sei, numero_rgf, unidade_origem_id, municipio_fato_id, natureza_fato_id,
    data_instauracao, data_recebimento, data_remessa_encarregado, data_julgamento,
    data_conclusao, resumo_fatos, ativo, created_at, updated_at
)
SELECT l.id::uuid,
       a.id,
       td.id,
       l.numero,
       l.numero_controle,
       l.processo_sei,
       l.numero_rgf,
       un.id,
       mu.id,
       nf.id,
       l.data_instauracao,
       l.data_recebimento,
       l.data_remessa_encarregado,
       l.data_julgamento,
       l.data_conclusao,
       l.resumo_fatos,
       COALESCE(l.ativo, true),
       l.created_at,
       l.updated_at
  FROM legado.processos_procedimentos l
  JOIN apuratorios     a  ON lower(a.sigla)  = lower(l.tipo_detalhe)
  JOIN tipos_documento td ON lower(td.nome)  = lower(l.documento_iniciador)
  JOIN unidades_pm     un ON lower(un.nome)  = lower(l.local_origem)
  -- `local_fatos` guarda o NOME do lugar, não o id — os UUIDs preservados na
  -- migration 0003 não ajudam aqui. 117 dos 128 casam direto; os outros 11
  -- vêm no formato "Distrito (Município)" (Bom Futuro ×8, Jaci-Paraná,
  -- Joelândia, Tarilândia). Removido o sufixo entre parênteses, resolvem
  -- 128/128 — e nenhum nome do catálogo contém '(', então a regra é segura.
  JOIN municipios_distritos mu
       ON lower(mu.nome) = lower(regexp_replace(l.local_fatos, '\s*\([^)]*\)\s*$', ''))
  LEFT JOIN naturezas_fato nf ON lower(nf.nome) = lower(l.natureza_procedimento)
ON CONFLICT DO NOTHING;

-- `data_remessa_comissao` fica NULL em todos: a coluna não existe no legado.

-- ------------------------------------------- carta_precatoria_detalhes -------
-- A única espécie com atributos realmente exclusivos. A aplicação descobre que
-- precisa da extensão por `apuratorios.codigo_extensao`, nunca pela sigla —
-- e é por isso que o JOIN abaixo também não menciona 'CP'.
INSERT INTO carta_precatoria_detalhes (processo_id, deprecante, unidade_deprecada_id)
SELECT l.id::uuid, l.deprecante, un.id
  FROM legado.processos_procedimentos l
  JOIN processos_procedimentos p ON p.id = l.id::uuid
  JOIN apuratorios a  ON a.id = p.apuratorio_id AND a.codigo_extensao = 'carta_precatoria'
  JOIN unidades_pm un ON lower(un.nome) = lower(l.unidade_deprecada)
 WHERE l.deprecante IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
