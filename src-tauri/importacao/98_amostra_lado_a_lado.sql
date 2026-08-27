-- =============================================================================
-- AMOSTRA LADO A LADO — legado × novo, campo a campo
--
-- As 24 contagens e as 17 invariantes de `99_conferencia.sql` provam que o
-- CONJUNTO está íntegro. O que elas não provam é que cada processo, olhado de
-- perto, diz a mesma coisa que dizia antes. É o que este arquivo faz: pega os
-- 6 processos escolhidos por cobrirem cada caminho da importação e imprime,
-- para cada campo, o que o legado guardava e o que o schema novo guarda.
--
-- A leitura é a última coluna: `igual = f` é o que interessa. Nenhuma linha
-- com `f` significa que os 6 atravessaram a importação sem perder nada.
--
-- ---------------------------------------------------------------------------
-- POR QUE É UMA INSTRUÇÃO SÓ, SEM \echo E SEM \pset
--
-- O `99_conferencia.sql` usa comandos de barra invertida, que são sintaxe do
-- CLIENTE psql e não SQL — por isso ele só roda por psql. Este arquivo evita
-- meta-comando de propósito, e assim serve aos dois usos com o mesmo texto:
--
--   psql < 98_amostra_lado_a_lado.sql      → você lê a tabela
--   tests/importacao.rs                    → o `cargo test` afirma 0 divergências
--
-- Sem isso, o relatório envelheceria sozinho: uma etapa alterada deixaria de
-- bater e ninguém saberia até a próxima conferência manual.
-- ---------------------------------------------------------------------------
--
-- COMPARAÇÕES QUE NÃO SÃO IGUALDADE LITERAL, e por quê:
--
--   município       o legado guarda o NOME do lugar, e 11 processos o guardam
--                   como "Distrito (Município)". A comparação tira o sufixo,
--                   que é exatamente a tradução que a etapa 04 faz. O valor
--                   bruto aparece no rótulo da linha, para você conferir.
--   designações     o legado registrava 25 entradas de substituição, 5 delas
--                   correções de digitação no mesmo dia (decisão 19). O que se
--                   compara é o número de DIAS distintos, que é o número de
--                   substituições que de fato houve.
--   art. 29         os 3 vínculos sem analogia RDPM ficam de fora por decisão
--                   22. A linha confere que continuam fora: entrar sem analogia
--                   violaria a decisão 5.
--   solução         era do processo no legado e é do envolvido aqui, replicada
--                   a todos (decisão 20) — daí a comparação ser por envolvido
--                   contra a coluna do processo.
--
-- Só leitura. Exige o schema `legado` no banco; depois do passo 8 do roteiro
-- (§8.5) ele deixa de rodar, e é esperado.
-- =============================================================================
WITH amostra(ord, id, apelido) AS (VALUES
    -- Os 6 da tabela em §8.5. Cada um está aqui por um motivo diferente;
    -- trocar um por outro processo qualquer perde a cobertura.
    (1, '10b39de3-fad8-4e93-9cea-7b2027118253', 'IPM 8/2024'),      -- 9 envolvidos (o máximo) + troca colapsada
    (2, 'ec07f120-e4c5-4337-b628-592c5859339c', 'IPM 1/2024'),      -- 8 prorrogações: a cadeia mais longa
    (3, 'b0294d82-4d35-46d4-a10f-2bd2b555d462', 'IPM 1/P6/2024'),   -- o anexo de 20 MB
    (4, '22ce21be-aa00-42b5-98cd-65e1d328ba4e', 'PADS 1/2025'),     -- penalidade + envolvido criado + jsonb
    (5, '6b1f19a8-4ab8-4ecc-b596-27480bf9e017', 'CP 1/2025'),       -- extensão de carta precatória
    (6, '980f1a82-3771-4193-b43b-37a09eadf0c5', 'SR 20/2025')       -- três trocas no mesmo dia, colapsadas
),

-- Os envolvidos do legado vêm das duas fontes que a etapa 05 uniu: as linhas
-- de `procedimento_pms_envolvidos` e os 37 processos que guardavam o acusado
-- em coluna própria (decisão 14). A união repete a da etapa 05 de propósito —
-- se ela mudar sem esta mudar, a divergência aparece aqui.
leg_envolvidos AS (
    SELECT e.id, e.procedimento_id AS processo_id, e.pm_id, e.ordem, e.status_pm
      FROM legado.procedimento_pms_envolvidos e
    UNION ALL
    SELECT p.id, p.id, p.nome_pm_id, 1, p.status_pm
      FROM legado.processos_procedimentos p
     WHERE p.nome_pm_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM legado.procedimento_pms_envolvidos e
                        WHERE e.procedimento_id = p.id)
),

-- `transgressoes_ids` é TEXT no legado. O CASE evita o cast em linha inválida:
-- o PostgreSQL não garante que o WHERE seja avaliado antes da projeção (§10).
leg_jsonb AS (
    SELECT l.id,
           CASE WHEN btrim(coalesce(l.transgressoes_ids, '')) LIKE '[%'
                THEN l.transgressoes_ids::jsonb ELSE '[]'::jsonb END AS itens
      FROM legado.processos_procedimentos l
),

comparacoes(ord, apelido, aspecto, chave, leg, nov) AS (

-- ── 1. Cabeçalho ────────────────────────────────────────────────────────────
    SELECT a.ord, a.apelido, '1 cabecalho', c.campo, c.leg, c.nov
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      JOIN v_processos_detalhados         v ON v.id = a.id::uuid
      JOIN processos_procedimentos        p ON p.id = a.id::uuid
      CROSS JOIN LATERAL (VALUES
          ('numero_documento',        l.numero::text,                  v.numero_documento::text),
          ('numero_controle',         l.numero_controle::text,         v.numero_controle::text),
          ('apuratorio',              l.tipo_detalhe::text,            v.apuratorio_sigla::text),
          ('documento_iniciador',     l.documento_iniciador::text,     v.documento_iniciador::text),
          ('unidade_origem',          l.local_origem::text,            v.unidade_origem::text),
          ('municipio_fato  <- ' || coalesce(l.local_fatos, '(nulo)'),
                                      regexp_replace(coalesce(l.local_fatos,''), '\s*\([^)]*\)\s*$', '')::text,
                                                                       v.municipio_fato::text),
          ('natureza_fato',           l.natureza_procedimento::text,   v.natureza_fato::text),
          ('processo_sei',            l.processo_sei::text,            v.processo_sei::text),
          ('numero_rgf',              l.numero_rgf::text,              v.numero_rgf::text),
          ('data_instauracao',        l.data_instauracao::text,        p.data_instauracao::text),
          ('data_recebimento',        l.data_recebimento::text,        p.data_recebimento::text),
          ('data_remessa',l.data_remessa_encarregado::text,
             COALESCE(p.data_remessa_comissao,p.data_remessa_encarregado)::text),
          ('data_julgamento',         l.data_julgamento::text,         p.data_julgamento::text),
          ('data_conclusao',          l.data_conclusao::text,          p.data_conclusao::text),
          ('resumo_fatos',            l.resumo_fatos::text,            p.resumo_fatos::text)
      ) AS c(campo, leg, nov)

-- ── 2. Responsável vigente e o histórico de substituição ────────────────────
    UNION ALL
    SELECT a.ord, a.apelido, '2 responsavel',
           'vigente (' || coalesce(v.responsavel_papel, 'sem papel') || ')',
           u.nome::text, v.responsavel_nome::text
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      JOIN v_processos_detalhados         v ON v.id = a.id::uuid
      LEFT JOIN legado.usuarios u ON u.id = coalesce(l.responsavel_id, l.presidente_id)

    UNION ALL
    -- O escrivão do legado, quando havia: é o papel que só existe em IPM, e
    -- que o schema novo garante por FK composta em vez de por sigla no código.
    SELECT a.ord, a.apelido, '2 responsavel', 'escrivao vigente',
           u.nome::text,
           (SELECT pm.nome FROM processo_designacoes d
              JOIN papeis_processo pp ON pp.id = d.papel_id
              JOIN policiais_militares pm ON pm.id = d.policial_militar_id
             WHERE d.processo_id = a.id::uuid AND d.data_fim IS NULL
               AND lower(pp.nome) = 'escrivão')::text
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      LEFT JOIN legado.usuarios u ON u.id = coalesce(l.escrivao_id, l.escrivao_processo_id)
     WHERE coalesce(l.escrivao_id, l.escrivao_processo_id) IS NOT NULL

    UNION ALL
    -- Decisão 19: o que se compara é o número de DIAS de substituição, não o
    -- de entradas. Três trocas no mesmo dia foram uma troca só.
    SELECT a.ord, a.apelido, '2 responsavel',
           'substituicoes (dias distintos; decisao 19)',
           (SELECT count(DISTINCT (item->>'data_substituicao')::date)
              FROM jsonb_array_elements(l.historico_encarregados) item)::text,
           (SELECT count(*) FROM processo_designacoes d
             WHERE d.processo_id = a.id::uuid AND d.data_fim IS NOT NULL)::text
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id

-- ── 3. Cadeia de prazos ─────────────────────────────────────────────────────
    UNION ALL
    SELECT a.ord, a.apelido, '3 prazos', 'quantidade',
           (SELECT count(*) FROM legado.prazos_processo x WHERE x.processo_id = a.id)::text,
           (SELECT count(*) FROM processo_prazos z WHERE z.processo_id = a.id::uuid)::text
      FROM amostra a

    UNION ALL
    -- `inicio +dias = vencimento` numa string só: é a aritmética inteira do
    -- prazo, e no schema novo `data_vencimento` é coluna gerada.
    SELECT a.ord, a.apelido, '3 prazos',
           'ordem ' || lpad(z.ordem::text, 2, '0'),
           (l.data_inicio::text || ' +' || l.dias_adicionados || ' = ' || l.data_vencimento::text),
           (z.data_inicio::text || ' +' || z.dias             || ' = ' || z.data_vencimento::text)
      FROM amostra a
      JOIN processo_prazos z ON z.processo_id = a.id::uuid
      LEFT JOIN legado.prazos_processo l ON l.id = z.id::text

    UNION ALL
    -- Decisão 18: as 58 prorrogações sem motivo receberam texto reconhecível.
    SELECT a.ord, a.apelido, '3 prazos',
           'ordem ' || lpad(z.ordem::text, 2, '0') || ' motivo suprido (decisao 18)',
           CASE WHEN btrim(coalesce(l.motivo, '')) = '' THEN 'sim' ELSE 'nao' END,
           CASE WHEN z.motivo = 'Motivo não registrado no sistema anterior' THEN 'sim' ELSE 'nao' END
      FROM amostra a
      JOIN processo_prazos z ON z.processo_id = a.id::uuid
      LEFT JOIN legado.prazos_processo l ON l.id = z.id::text
     WHERE z.ordem >= 1

-- ── 4. Envolvidos ───────────────────────────────────────────────────────────
    UNION ALL
    SELECT a.ord, a.apelido, '4 envolvidos', 'quantidade',
           (SELECT count(*) FROM leg_envolvidos e WHERE e.processo_id = a.id)::text,
           (SELECT count(*) FROM processo_envolvidos x WHERE x.processo_id = a.id::uuid)::text
      FROM amostra a

    UNION ALL
    SELECT a.ord, a.apelido, '4 envolvidos', c.campo, c.leg, c.nov
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      JOIN processo_envolvidos x ON x.processo_id = a.id::uuid
      LEFT JOIN leg_envolvidos e ON e.id = x.id::text
      LEFT JOIN legado.usuarios u ON u.id = e.pm_id
      LEFT JOIN policiais_militares pm ON pm.id = x.policial_militar_id
      LEFT JOIN status_envolvido se ON se.id = x.status_envolvido_id
      LEFT JOIN tipos_solucao_sugerida ss ON ss.id = x.solucao_sugerida_id
      LEFT JOIN tipos_solucao_decidida sd ON sd.id = x.solucao_decidida_id
      LEFT JOIN tipos_penalidade tp ON tp.id = x.penalidade_tipo_id
      CROSS JOIN LATERAL (VALUES
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' militar',  u.nome::text, pm.nome::text),
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' status',   e.status_pm::text, se.nome::text),
          -- Decisão 8: o motorista do processo virou flag do envolvido.
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' condutor',
             CASE WHEN l.motorista_id IS NOT DISTINCT FROM e.pm_id THEN 'sim' ELSE 'nao' END,
             CASE WHEN x.e_condutor THEN 'sim' ELSE 'nao' END),
          -- Decisão 3: o prefixo `Sugerido_` separa os dois catálogos.
          -- Decisão 20: a solução do processo foi replicada a todo envolvido.
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' solucao sugerida (decisao 20)',
             CASE WHEN l.solucao_tipo LIKE 'Sugerido\_%'
                  THEN replace(substr(l.solucao_tipo, 10), '_', ' ') END::text,
             ss.nome::text),
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' solucao decidida (decisao 20)',
             CASE WHEN l.solucao_tipo NOT LIKE 'Sugerido\_%'
                  THEN l.solucao_tipo END::text,
             sd.nome::text),
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' penalidade',
             replace(coalesce(l.penalidade_tipo,''), '_', ' ')::text,
             coalesce(tp.nome,'')::text),
          ('ordem ' || lpad(x.ordem::text,2,'0') || ' penalidade dias',
             l.penalidade_dias::text, x.penalidade_dias::text)
      ) AS c(campo, leg, nov)

-- ── 5. Vítimas e pessoas inquiridas ─────────────────────────────────────────
-- Duas tabelas desde a 0012: o ofendido é `processo_vitimas`, relação própria
-- do procedimento; o inquirido continua em `processo_pessoas`, com papel.
    UNION ALL
    -- No legado, array JSON dentro de coluna TEXT (e texto simples em 16).
    SELECT a.ord, a.apelido, '5 pessoas', 'vitimas',
           ((SELECT count(*) FROM jsonb_array_elements_text(
                CASE WHEN btrim(coalesce(l.nome_vitima,'')) LIKE '[%'
                     THEN l.nome_vitima::jsonb ELSE '[]'::jsonb END) t(v)
             WHERE btrim(v) <> '')
           + CASE WHEN btrim(coalesce(l.nome_vitima,'')) <> ''
                   AND btrim(l.nome_vitima) NOT LIKE '[%' THEN 1 ELSE 0 END)::text,
           (SELECT count(*) FROM processo_vitimas pv
             WHERE pv.processo_id = a.id::uuid)::text
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id

    UNION ALL
    SELECT a.ord, a.apelido, '5 pessoas', 'vitima: ' || pv.nome, pv.nome::text,
           CASE WHEN position(upper(btrim(pv.nome)) in upper(coalesce(l.nome_vitima,''))) > 0
                THEN pv.nome::text ELSE '(nao encontrada no legado)' END
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      JOIN processo_vitimas pv ON pv.processo_id = a.id::uuid

    UNION ALL
    SELECT a.ord, a.apelido, '5 pessoas', 'pessoas inquiridas',
           (SELECT count(*) FROM jsonb_array_elements_text(
                CASE WHEN btrim(coalesce(l.pessoas_inquiridas,'')) LIKE '[%'
                     THEN l.pessoas_inquiridas::jsonb ELSE '[]'::jsonb END) t(v)
             WHERE btrim(v) <> '')::text,
           (SELECT count(*) FROM processo_pessoas pe
              JOIN papeis_pessoa pp ON pp.id = pe.papel_pessoa_id
             WHERE pe.processo_id = a.id::uuid AND lower(pp.nome) = 'pessoa inquirida')::text
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id

-- ── 6. Andamentos ───────────────────────────────────────────────────────────
    UNION ALL
    -- A etapa 07 descarta o andamento de texto vazio; a contagem repete o
    -- filtro, senão acusaria divergência onde houve descarte deliberado.
    SELECT a.ord, a.apelido, '6 andamentos', 'quantidade',
           (SELECT count(*) FROM jsonb_array_elements(coalesce(l.andamentos,'[]'::jsonb)) t
             WHERE btrim(coalesce(t.value->>'texto','')) <> '')::text,
           (SELECT count(*) FROM processo_andamentos m WHERE m.processo_id = a.id::uuid)::text
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id

    UNION ALL
    -- O par (processo, momento) é a chave: a etapa 07 NÃO preserva o id do
    -- jsonb, então casar por id não acharia nada. O autor era nome em TEXTO e
    -- virou FK — e a FK aponta para a conta, não direto para o militar.
    SELECT a.ord, a.apelido, '6 andamentos', c.campo, c.leg, c.nov
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(l.andamentos,'[]'::jsonb)) item
      LEFT JOIN processo_andamentos m
             ON m.processo_id = a.id::uuid
            AND m.ocorrido_em = (item->>'data')::timestamptz
      LEFT JOIN usuarios co ON co.id = m.registrado_por_id
      LEFT JOIN policiais_militares pm ON pm.id = co.policial_militar_id
      CROSS JOIN LATERAL (VALUES
          ('de ' || (item->>'data') || ' — autor', (item->>'usuario')::text, pm.nome::text),
          ('de ' || (item->>'data') || ' — texto', (item->>'texto')::text,  m.descricao::text)
      ) AS c(campo, leg, nov)
     WHERE btrim(coalesce(item->>'texto','')) <> ''

-- ── 7. Enquadramento ────────────────────────────────────────────────────────
    UNION ALL
    SELECT a.ord, a.apelido, '7 enquadramento', c.campo, c.leg, c.nov
      FROM amostra a
      JOIN processo_envolvidos x ON x.processo_id = a.id::uuid
      JOIN policiais_militares pm ON pm.id = x.policial_militar_id
      JOIN leg_jsonb lj ON lj.id = a.id
      LEFT JOIN legado.pm_envolvido_indicios i ON i.pm_envolvido_id = x.id::text
      CROSS JOIN LATERAL (VALUES
          ('categorias de indicio — ' || pm.nome,
             coalesce(jsonb_array_length(i.categorias_indicios), 0)::text,
             (SELECT count(*) FROM envolvido_categorias_indicio q WHERE q.envolvido_id = x.id)::text),
          ('infracoes penais — ' || pm.nome,
             (SELECT count(*) FROM legado.pm_envolvido_crimes q WHERE q.pm_indicios_id = i.id)::text,
             (SELECT count(*) FROM envolvido_infracoes_penais q WHERE q.envolvido_id = x.id)::text),
          -- As DUAS fontes do legado somadas: `pm_envolvido_rdpm` (procedimentos)
          -- e o jsonb `transgressoes_ids` (os 32 PADS), que quase ficou de fora.
          ('transgressoes RDPM (as 2 fontes) — ' || pm.nome,
             ((SELECT count(*) FROM legado.pm_envolvido_rdpm q WHERE q.pm_indicios_id = i.id)
            + (SELECT count(*) FROM jsonb_array_elements(lj.itens) t
                WHERE t.value->>'tipo' = 'rdpm'))::text,
             (SELECT count(*) FROM envolvido_transgressoes q WHERE q.envolvido_id = x.id)::text),
          -- Só o jsonb traz analogia; o art. 29 da outra fonte nunca teve.
          ('infracoes do estatuto (com analogia) — ' || pm.nome,
             (SELECT count(*) FROM jsonb_array_elements(lj.itens) t
               WHERE t.value->>'tipo' = 'estatuto')::text,
             (SELECT count(*) FROM envolvido_infracoes_estatuto q WHERE q.envolvido_id = x.id)::text),
          -- Decisão 22: entrar sem analogia violaria o NOT NULL da decisão 5.
          ('art. 29 sem analogia que entrou indevidamente (decisao 22)', '0',
             (SELECT count(*) FROM legado.pm_envolvido_art29 z
                JOIN envolvido_infracoes_estatuto q
                  ON q.envolvido_id = x.id AND q.infracao_estatuto_id = z.art29_id::uuid
               WHERE z.pm_indicios_id = i.id)::text)
      ) AS c(campo, leg, nov)

-- ── 8. Anexo ────────────────────────────────────────────────────────────────
    UNION ALL
    SELECT a.ord, a.apelido, '8 anexo', c.campo, c.leg, c.nov
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      LEFT JOIN processo_anexos an ON an.processo_id = a.id::uuid
      CROSS JOIN LATERAL (VALUES
          ('nome do arquivo', l.pdf_nome::text,         an.nome_arquivo::text),
          ('mime',            l.pdf_content_type::text, an.mime_type::text),
          ('bytes',           length(l.pdf_arquivo)::text, length(an.conteudo)::text)
      ) AS c(campo, leg, nov)
     WHERE l.pdf_nome IS NOT NULL

-- ── 9. Extensão de carta precatória ─────────────────────────────────────────
    UNION ALL
    SELECT a.ord, a.apelido, '9 carta precatoria', c.campo, c.leg, c.nov
      FROM amostra a
      JOIN legado.processos_procedimentos l ON l.id = a.id
      LEFT JOIN carta_precatoria_detalhes cp ON cp.processo_id = a.id::uuid
      LEFT JOIN unidades_pm un ON un.id = cp.unidade_deprecada_id
      CROSS JOIN LATERAL (VALUES
          ('deprecante',       l.deprecante::text,        cp.deprecante::text),
          ('unidade deprecada',l.unidade_deprecada::text, un.nome::text)
      ) AS c(campo, leg, nov)
     WHERE l.unidade_deprecada IS NOT NULL OR l.deprecante IS NOT NULL
)

SELECT apelido                                   AS processo,
       aspecto,
       left(chave, 64)                           AS campo,
       left(coalesce(leg, '(vazio)'), 58)        AS legado,
       left(coalesce(nov, '(vazio)'), 58)        AS novo,
       -- `NULL` e `''` são a mesma ausência: o legado gravava um, o schema
       -- novo grava o outro, e isso nunca foi diferença de conteúdo.
       coalesce(btrim(leg), '') = coalesce(btrim(nov), '') AS igual
  FROM comparacoes
 ORDER BY ord, aspecto, chave;
