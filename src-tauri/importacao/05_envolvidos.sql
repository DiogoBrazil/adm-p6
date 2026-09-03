-- =============================================================================
-- ETAPA 05 — ENVOLVIDOS, SOLUÇÕES, PENALIDADES E PESSOAS CITADAS
--
-- Os envolvidos vêm de DUAS fontes que o legado mantinha separadas:
--   (a) as 221 linhas de `procedimento_pms_envolvidos` — só procedimentos;
--   (b) os 44 "processos" (PADS/PAD/CD/CJ/PADE), que guardavam o acusado em
--       COLUNA da própria tabela (`nome_pm_id` + `status_pm`).
--
-- Criar os 44 é decisão 14, e não é inventar fato: os 44 têm `nome_pm_id` e
-- `status_pm` preenchidos, e vários têm solução e penalidade — e como essas
-- três informações só existem em `processo_envolvidos` no schema novo, não
-- criá-los significaria PERDÊ-LAS.
--
-- "À APURAR" não é envolvido de mentira nem policial de verdade: o legado o
-- representava com um usuário artificial (nome 'À APURAR', matrícula
-- 100000000) posto na coluna do PM. Desde a 0016 o schema novo diz a mesma
-- coisa com `policial_militar_id IS NULL` — a linha continua existindo, conta
-- no limite de envolvidos e recebe enquadramento e resultado. São 2 casos, e
-- o índice parcial `uq_envolvido_a_apurar` garante no máximo um por processo.
--
-- Solução e penalidade são do ENVOLVIDO (decisão 2). No legado eram do
-- processo, e 36 processos com solução têm 2+ envolvidos: nesses, a solução é
-- REPLICADA a todos. É o que o fato legado afirma ("este procedimento foi
-- Homologado" valia para todos os apurados); atribuí-la só ao primeiro
-- afirmaria algo que o dump não diz.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh, que roda
-- as oito etapas numa transação só. Um `BEGIN;`/`COMMIT;` aqui dentro encerraria
-- a transação externa no meio, e o resto da carga correria em autocommit — sem
-- erro nenhum, e sem o tudo-ou-nada que a migração exige. E as duas constraint
-- triggers são DEFERRABLE, então `max_envolvidos` só é conferido no COMMIT —
-- que agora é o commit da migração inteira.
-- =============================================================================

INSERT INTO processo_envolvidos (
    id, processo_id, policial_militar_id, status_envolvido_id, ordem, e_condutor,
    solucao_sugerida_id, solucao_decidida_id, penalidade_tipo_id, penalidade_dias,
    created_at
)
SELECT fonte.id::uuid,
       fonte.processo_id::uuid,
       CASE WHEN apurar.e_apurar THEN NULL ELSE fonte.pm_id::uuid END,
       se.id,
       fonte.ordem,
       -- `e_condutor` substitui o `motorista_id` do processo: no legado o
       -- motorista era sempre um dos envolvidos (17/17), então é papel do
       -- envolvido, não outra pessoa. A EXCLUDE `uq_envolvido_condutor`
       -- garante no máximo um. A comparação usa o pm_id de ORIGEM, não o
       -- convertido: fosse o convertido, um "À apurar" num processo sem
       -- motorista casaria NULL com NULL e viraria condutor — que é
       -- justamente o que `ck_envolvido_condutor_identificado` proíbe.
       NOT apurar.e_apurar AND fonte.pm_id IS NOT DISTINCT FROM l.motorista_id,
       ss.id,
       sd.id,
       tp.id,
       l.penalidade_dias::int,
       fonte.created_at::timestamptz
  FROM (
      -- (a) os 221 já registrados como envolvidos
      SELECT e.id, e.procedimento_id AS processo_id, e.pm_id,
             e.status_pm, e.ordem, e.created_at
        FROM legado.procedimento_pms_envolvidos e
      UNION ALL
      -- (b) os 44 que o legado guardava em coluna do processo
      SELECT p.id, p.id, p.nome_pm_id, p.status_pm, 1, p.created_at
        FROM legado.processos_procedimentos p
       WHERE p.nome_pm_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM legado.procedimento_pms_envolvidos e
                          WHERE e.procedimento_id = p.id)
  ) fonte
  JOIN legado.processos_procedimentos l ON l.id = fonte.processo_id
  JOIN status_envolvido se ON lower(se.nome) = lower(fonte.status_pm)
  -- Mesmo par nome/matrícula que a 0016 e a etapa 03 usam.
  CROSS JOIN LATERAL (
      SELECT EXISTS (
          SELECT 1 FROM legado.usuarios au
           WHERE au.id = fonte.pm_id
             AND upper(btrim(au.nome)) = 'À APURAR'
             AND au.matricula = '100000000'
      ) AS e_apurar
  ) apurar
  -- O prefixo `Sugerido_` decide para qual dos dois catálogos a solução vai
  -- (decisão 3): o encarregado sugere, a autoridade decide.
  LEFT JOIN tipos_solucao_sugerida ss
       ON l.solucao_tipo LIKE 'Sugerido\_%'
      AND lower(ss.nome) = lower(replace(substr(l.solucao_tipo, 10), '_', ' '))
  LEFT JOIN tipos_solucao_decidida sd
       ON l.solucao_tipo NOT LIKE 'Sugerido\_%'
      AND lower(sd.nome) = lower(l.solucao_tipo)
  LEFT JOIN tipos_penalidade tp
       ON lower(tp.nome) = lower(replace(l.penalidade_tipo, '_', ' '))
-- Arbitro explícito pela chave primária. Desde a 0016 `uq_envolvido_pm` e
-- `uq_envolvido_ordem` são DEFERRABLE, e o PostgreSQL recusa constraint adiada
-- como árbitro de `ON CONFLICT` — a forma sem alvo, que considera todos os
-- índices, passaria a falhar. O `id` vem do legado, então reexecutar a etapa
-- continua sendo inofensivo.
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------ processo_vitimas ----
-- Vítimas. `nome_vitima` é array JSON em 71 dos 87 preenchidos e texto simples
-- nos outros 16 — daí a ramificação. Não referencia policiais de propósito:
-- vítima pode ser "ADMINISTRAÇÃO PÚBLICA".
--
-- Sem JOIN em `papeis_pessoa`: desde a 0012 o ofendido é relação própria do
-- procedimento, e não uma pessoa citada com papel de catálogo.
INSERT INTO processo_vitimas (processo_id, nome, ordem)
SELECT l.id::uuid, btrim(v.nome), v.ordem
  FROM legado.processos_procedimentos l
  CROSS JOIN LATERAL (
      SELECT nome, ordem FROM (
          SELECT elem AS nome, ord AS ordem
            FROM jsonb_array_elements_text(
                     CASE WHEN btrim(l.nome_vitima) LIKE '[%'
                          THEN l.nome_vitima::jsonb ELSE '[]'::jsonb END
                 ) WITH ORDINALITY AS t(elem, ord)
          UNION ALL
          SELECT l.nome_vitima, 1
           WHERE btrim(l.nome_vitima) NOT LIKE '[%'
      ) x
  ) v
 WHERE l.nome_vitima IS NOT NULL AND btrim(v.nome) <> ''
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------- processo_pessoas ----
-- Pessoas a inquirir: 3 registros, JSON dentro de coluna TEXT.
INSERT INTO processo_pessoas (processo_id, papel_pessoa_id, nome, ordem)
SELECT l.id::uuid, pp.id, btrim(q.elem), q.ord
  FROM legado.processos_procedimentos l
  JOIN papeis_pessoa pp ON lower(pp.nome) = 'pessoa inquirida'
  CROSS JOIN LATERAL jsonb_array_elements_text(l.pessoas_inquiridas::jsonb)
       WITH ORDINALITY AS q(elem, ord)
 WHERE l.pessoas_inquiridas IS NOT NULL
   AND btrim(l.pessoas_inquiridas) LIKE '[%'
   AND btrim(q.elem) <> ''
ON CONFLICT DO NOTHING;

