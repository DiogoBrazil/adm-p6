-- =============================================================================
-- ETAPA 07 — PRAZOS E ANDAMENTOS
--
-- PRAZOS. `ordem = COALESCE(ordem_prorrogacao, 0)`: 0 é o prazo inicial, 1+ são
-- as prorrogações. Isso substitui o catálogo `tipos_prazo`, cujo NOME
-- ('inicial'/'prorrogacao') dirigia o algoritmo — renomear a linha quebrava o
-- cálculo.
--
-- `data_vencimento` NÃO é gravada: é coluna GERADA (`data_inicio + dias`), e
-- reproduz o legado exatamente — verificado em 179/179.
--
-- A coluna `ativo` do legado é descartada: a vigência passa a ser derivada da
-- maior `ordem`, e as duas coincidem em 44/44.
--
-- As 126 prorrogações começam NO DIA do vencimento anterior. É a convenção que
-- a Seção pratica, e é por isso que a migration 0005 compara a ocupação como
-- `[data_inicio, data_inicio + dias)`. Sem ela esta etapa não passaria.
--
-- PRAZOS RECONSTRUÍDOS: 110 dos 163 processos não têm prazo NENHUM no legado,
-- embora todos os 163 tenham data de recebimento. No modelo novo isso não é
-- "no prazo" nem "vencido": é o quarto balde da decisão 57, e um apuratório
-- recebido sem prazo cai fora dos três primeiros. O plano decidiu reconstruir
-- o prazo inicial desses 110 a partir do recebimento e do prazo-base vigente
-- da espécie. É preenchimento TÉCNICO, não fato registrado — e é por isso que
-- a conferência os separa: são exatamente os de ordem 0 sem contraparte em
-- `legado.prazos_processo`, e essa consulta continua valendo depois da
-- migração, porque o schema `legado` não é descartado.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh, que roda
-- as oito etapas numa transação só. Um `BEGIN;`/`COMMIT;` aqui dentro encerraria
-- a transação externa no meio, e o resto da carga correria em autocommit — sem
-- erro nenhum, e sem o tudo-ou-nada que a migração exige.
-- =============================================================================

INSERT INTO processo_prazos
    (id, processo_id, ordem, data_inicio, dias, motivo,
     numero_documento, data_documento, created_at, updated_at)
SELECT z.id::uuid,
       z.processo_id::uuid,
       COALESCE(z.ordem_prorrogacao, 0),
       z.data_inicio,
       z.dias_adicionados,
       -- `ck_prazo_motivo` exige motivo a partir da ordem 1, e 77 das 126
       -- prorrogações do legado não têm nenhum. O texto abaixo diz exatamente
       -- o que aconteceu, e é único o bastante para achar as 77 com um LIKE.
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
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------- prazo inicial ausente ----
-- Os 110 sem prazo nenhum. `data_inicio` é o recebimento — o dado que o legado
-- tem — e `dias` é o prazo-base VIGENTE da espécie, preferindo o do documento
-- iniciador quando a configuração o define (um IPM por Portaria pode ter prazo
-- diferente de um por Memorando).
--
-- Não há risco de bater na EXCLUDE `ex_prazo_sobreposicao`: entram só processos
-- que hoje não têm linha alguma de prazo, então não há intervalo com que
-- sobrepor. O id é derivado, como em 06, para que reexecutar não duplique.
INSERT INTO processo_prazos (id, processo_id, ordem, data_inicio, dias)
SELECT md5('processo_prazos|' || l.id || '|0')::uuid,
       p.id, 0, l.data_recebimento,
       COALESCE(apdoc.prazo_base_dias, a.prazo_base_dias)
  FROM legado.processos_procedimentos l
  JOIN processos_procedimentos p ON p.id = l.id::uuid
  JOIN apuratorios a ON a.id = p.apuratorio_id
  LEFT JOIN apuratorio_documentos_iniciadores apdoc
         ON apdoc.apuratorio_id = p.apuratorio_id
        AND apdoc.tipo_documento_id = p.documento_iniciador_id
 WHERE l.data_recebimento IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM processo_prazos z
                    WHERE z.processo_id = p.id AND z.ordem = 0)
ON CONFLICT (id) DO NOTHING;

-- `documento_autorizador_id` e `autoridade_id` ficam NULL: o legado guardava
-- `autorizado_por` em 0 das 179 linhas, e o tipo do documento da prorrogação
-- não era registrado (só o número, em `numero_portaria`).

-- ------------------------------------------------------ processo_andamentos --
-- Do jsonb `andamentos` {id, data, texto, usuario}. O autor era NOME EM TEXTO;
-- são 2 autores distintos em 64 andamentos, e os dois casam com militares
-- cadastrados — então o andamento passa a ter FK de autor, que a tabela
-- normalizada da migration 0031 havia PERDIDO.
--
-- `tipo_andamento_id` fica NULL: o legado nunca teve tipo (ver etapa 01).
-- O autor do andamento é NOME EM TEXTO no legado ({id, data, texto, usuario}),
-- não id. Resolver por nome é o que devolve a autoria que a tabela normalizada
-- tinha perdido — mas um `LEFT JOIN` sozinho devolveria NULL em silêncio se o
-- nome parasse de casar, e a autoria sumiria sem ninguém notar.
--
-- Dois casos, tratados diferente de propósito:
--   * nome que não existe no efetivo -> ABORTA. O dump está referenciando
--     alguém que não é militar cadastrado; isso é problema de dado, não de
--     migração, e seguir em frente esconderia o problema.
--   * militar sem conta de acesso -> `registrado_por_id` fica NULL e a
--     conferência lista o caso. Nem todo militar tem login, e isso é normal.
DO $$
DECLARE desconhecidos text;
BEGIN
    SELECT string_agg(DISTINCT autor, '; ' ORDER BY autor) INTO desconhecidos
      FROM (
          SELECT a->>'usuario' AS autor
            FROM legado.processos_procedimentos l
            CROSS JOIN LATERAL jsonb_array_elements(l.andamentos) a
           WHERE jsonb_typeof(l.andamentos) = 'array'
             AND btrim(COALESCE(a->>'texto', '')) <> ''
             AND COALESCE(btrim(a->>'usuario'), '') <> ''
      ) x
     WHERE NOT EXISTS (SELECT 1 FROM policiais_militares pm WHERE pm.nome = x.autor);
    IF desconhecidos IS NOT NULL THEN
        RAISE EXCEPTION
            'andamento com autor que não está no efetivo: %. Sem isso a autoria do andamento se perde em silêncio.',
            desconhecidos;
    END IF;
END $$;
INSERT INTO processo_andamentos (id, processo_id, descricao, ocorrido_em, registrado_por_id)
SELECT (a->>'id')::uuid,
       l.id::uuid,
       a->>'texto',
       -- O horário do legado é INGÊNUO e foi digitado em Ariquemes. Sem o
       -- `AT TIME ZONE` explícito, o cast usa o fuso da SESSÃO — que no
       -- container é Etc/UTC — e todo andamento entraria 4h adiantado; um
       -- deles, gravado depois das 20h, mudaria até de dia.
       (a->>'data')::timestamp AT TIME ZONE 'America/Porto_Velho',
       u.id
  FROM legado.processos_procedimentos l
  CROSS JOIN LATERAL jsonb_array_elements(l.andamentos) a
  LEFT JOIN policiais_militares pm ON pm.nome = a->>'usuario'
  LEFT JOIN usuarios u            ON u.policial_militar_id = pm.id
 WHERE jsonb_typeof(l.andamentos) = 'array'
   AND btrim(COALESCE(a->>'texto', '')) <> ''
-- Os 73 andamentos TÊM id no jsonb, e todos são UUID distintos: é chave de
-- origem de verdade, então é preservada, e o `ON CONFLICT (id)` vale.
ON CONFLICT (id) DO NOTHING;

