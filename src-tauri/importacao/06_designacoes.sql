-- =============================================================================
-- ETAPA 06 — DESIGNAÇÕES E O HISTÓRICO DE SUBSTITUIÇÃO
--
-- Substitui de uma vez as 5 colunas de papel espalhadas pelas 10 tabelas
-- (responsavel_id, escrivao_id, presidente_id, interrogante_id,
-- escrivao_processo_id), a coluna jsonb `historico_encarregados` e a tabela
-- `historico_encarregados` criada na 0028 e nunca usada.
--
-- SEMÂNTICA DE data_fim (decisão 6): é EXCLUSIVA — o dia em que o sucessor
-- assume. Intervalo semiaberto [inicio, fim). Assim a substituição registra UMA
-- data, como no legado, e não há sobreposição nem buraco entre designações.
--
-- COLAPSO DAS TROCAS DO MESMO DIA: 5 processos têm 2 ou 3 substituições no
-- mesmo dia, com minutos de diferença (a SR 20 tem três, às 11:23, 11:32 e
-- 11:33 de 2026-01-13). São correções de digitação, não substituições reais —
-- o encarregado do meio nunca exerceu, e `ck_designacao_periodo` exige
-- data_fim > data_inicio. Por dia fica o ANTERIOR da primeira troca e o NOVO
-- da última. As 25 entradas do jsonb viram 19 substituições efetivas.
--
-- Roda em transação única.
-- =============================================================================
BEGIN;

-- O papel que responde por cada processo, resolvido pelo ATRIBUTO
-- `e_responsavel` — nunca por nome de papel nem por sigla de apuratório.
CREATE TEMP TABLE tmp_responsavel ON COMMIT DROP AS
SELECT p.id AS processo_id, p.apuratorio_id, ap.papel_id
  FROM processos_procedimentos p
  JOIN apuratorio_papeis ap ON ap.apuratorio_id = p.apuratorio_id AND ap.e_responsavel;

-- Uma troca por (processo, dia): o anterior da primeira, o novo da última.
CREATE TEMP TABLE tmp_troca ON COMMIT DROP AS
SELECT h.processo_id,
       h.quando::date                                          AS dia,
       (array_agg(h.anterior     ORDER BY h.quando ASC ))[1]    AS pm_anterior,
       (array_agg(h.novo         ORDER BY h.quando DESC))[1]    AS pm_novo,
       (array_agg(h.justificativa ORDER BY h.quando DESC))[1]   AS justificativa
  FROM (
      SELECT l.id AS processo_id,
             (e->>'data_substituicao')::timestamp        AS quando,
             e->'encarregado_anterior'->>'id'            AS anterior,
             e->'novo_encarregado'->>'id'                AS novo,
             e->>'justificativa'                         AS justificativa
        FROM legado.processos_procedimentos l
        CROSS JOIN LATERAL jsonb_array_elements(l.historico_encarregados) e
       WHERE jsonb_typeof(l.historico_encarregados) = 'array'
  ) h
 GROUP BY h.processo_id, h.quando::date;

-- Os trechos que o histórico define, para o papel responsável:
--   trecho 0 : o encarregado ORIGINAL, da instauração até a 1ª troca
--   trecho k : quem assumiu na troca k, até a troca seguinte (ou vigente)
CREATE TEMP TABLE tmp_trecho ON COMMIT DROP AS
WITH ordenado AS (
    SELECT t.*,
           row_number() OVER (PARTITION BY t.processo_id ORDER BY t.dia) AS n,
           lead(t.dia)  OVER (PARTITION BY t.processo_id ORDER BY t.dia) AS proxima
      FROM tmp_troca t
)
SELECT o.processo_id, o.pm_anterior AS pm_id, l.data_instauracao AS inicio,
       o.dia AS fim, NULL::text AS motivo
  FROM ordenado o
  JOIN legado.processos_procedimentos l ON l.id = o.processo_id
 WHERE o.n = 1
UNION ALL
SELECT o.processo_id, o.pm_novo, o.dia, o.proxima, o.justificativa
  FROM ordenado o;

-- ------------------------------------------------- designações com história --
INSERT INTO processo_designacoes
    (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio, data_fim, motivo)
SELECT t.processo_id::uuid, r.apuratorio_id, t.pm_id::uuid, r.papel_id,
       t.inicio, t.fim, t.motivo
  FROM tmp_trecho t
  JOIN tmp_responsavel r ON r.processo_id = t.processo_id::uuid;

-- --------------------------------------------- designações sem substituição --
-- Todos os demais papéis ocupados: uma linha, da instauração, ainda vigente.
-- O papel responsável dos 19 processos com histórico já entrou acima — o
-- `NOT EXISTS` evita duplicar a designação vigente deles.
INSERT INTO processo_designacoes
    (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
SELECT DISTINCT o.processo_id::uuid, p.apuratorio_id, o.pm_id::uuid, pp.id, o.data_instauracao
  FROM legado.v_ocupacoes o
  JOIN processos_procedimentos p ON p.id = o.processo_id::uuid
  JOIN papeis_processo pp ON lower(pp.nome) = lower(o.papel)
 WHERE NOT EXISTS (SELECT 1 FROM tmp_troca t WHERE t.processo_id = o.processo_id)
    OR pp.id <> (SELECT r.papel_id FROM tmp_responsavel r WHERE r.processo_id = p.id);

COMMIT;
