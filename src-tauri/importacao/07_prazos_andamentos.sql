-- =============================================================================
-- ETAPA 07 — PRAZOS E ANDAMENTOS
--
-- PRAZOS. `ordem = COALESCE(ordem_prorrogacao, 0)`: 0 é o prazo inicial, 1+ são
-- as prorrogações. Isso substitui o catálogo `tipos_prazo`, cujo NOME
-- ('inicial'/'prorrogacao') dirigia o algoritmo — renomear a linha quebrava o
-- cálculo.
--
-- `data_vencimento` NÃO é gravada: é coluna GERADA (`data_inicio + dias`), e
-- reproduz o legado exatamente — verificado em 141/141.
--
-- A coluna `ativo` do legado é descartada: a vigência passa a ser derivada da
-- maior `ordem`, e as duas coincidem em 44/44.
--
-- As 97 prorrogações começam NO DIA do vencimento anterior. É a convenção que a
-- Seção pratica, e é por isso que a migration 0005 compara a ocupação como
-- `[data_inicio, data_inicio + dias)`. Sem ela esta etapa não passaria.
--
-- Roda em transação única.
-- =============================================================================
BEGIN;

INSERT INTO processo_prazos
    (id, processo_id, ordem, data_inicio, dias, motivo,
     numero_documento, data_documento, created_at, updated_at)
SELECT z.id::uuid,
       z.processo_id::uuid,
       COALESCE(z.ordem_prorrogacao, 0),
       z.data_inicio,
       z.dias_adicionados,
       -- `ck_prazo_motivo` exige motivo a partir da ordem 1, e 58 das 97
       -- prorrogações do legado não têm nenhum. O texto abaixo diz exatamente
       -- o que aconteceu, e é único o bastante para achar as 58 com um LIKE.
       CASE WHEN COALESCE(z.ordem_prorrogacao, 0) >= 1
            THEN COALESCE(NULLIF(btrim(z.motivo), ''),
                          'Motivo não registrado no sistema anterior')
            ELSE NULLIF(btrim(z.motivo), '')
       END,
       z.numero_portaria,
       z.data_portaria,
       z.created_at,
       z.updated_at
  FROM legado.prazos_processo z
  JOIN processos_procedimentos p ON p.id = z.processo_id::uuid
ON CONFLICT DO NOTHING;

-- `documento_autorizador_id` e `autoridade_id` ficam NULL: o legado guardava
-- `autorizado_por` em 0 das 141 linhas, e o tipo do documento da prorrogação
-- não era registrado (só o número, em `numero_portaria`).

-- ------------------------------------------------------ processo_andamentos --
-- Do jsonb `andamentos` {id, data, texto, usuario}. O autor era NOME EM TEXTO;
-- são 2 autores distintos em 64 andamentos, e os dois casam com militares
-- cadastrados — então o andamento passa a ter FK de autor, que a tabela
-- normalizada da migration 0031 havia PERDIDO.
--
-- `tipo_andamento_id` fica NULL: o legado nunca teve tipo (ver etapa 01).
INSERT INTO processo_andamentos (processo_id, descricao, ocorrido_em, registrado_por_id)
SELECT l.id::uuid,
       a->>'texto',
       (a->>'data')::timestamptz,
       u.id
  FROM legado.processos_procedimentos l
  CROSS JOIN LATERAL jsonb_array_elements(l.andamentos) a
  LEFT JOIN policiais_militares pm ON pm.nome = a->>'usuario'
  LEFT JOIN usuarios u            ON u.policial_militar_id = pm.id
 WHERE jsonb_typeof(l.andamentos) = 'array'
   AND btrim(COALESCE(a->>'texto', '')) <> '';

COMMIT;
