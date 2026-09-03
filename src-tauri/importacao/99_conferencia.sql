-- =============================================================================
-- CONFERÊNCIA PÓS-CARGA
--
-- Roda DEPOIS do commit, com o schema `legado` ainda no banco — é dele que
-- saem as comparações. Não escreve nada.
--
-- Três blocos, com propósitos diferentes:
--
--   CONTAGENS   — números afirmados, conferidos contra o esperado. Pega perda
--                 em massa, e é o que muda quando o dump muda.
--   INVARIANTES — comparações SEMÂNTICAS contra o próprio `legado`, sem número
--                 mágico. Pegam o que a contagem não pega: a linha certa com o
--                 conteúdo errado. Todas devem dar 0.
--   PENDÊNCIAS  — o que a migração NÃO resolveu e uma pessoa precisa resolver.
--                 Não são erros; são a lista de trabalho que sobra.
--
-- Usa meta-comando de psql (\echo, \pset), então roda por psql — nunca por
-- sqlx::raw_sql. Quem afere a importação no teste é tests/importacao.rs.
-- =============================================================================
\pset footer off
\echo
\echo '== CONTAGENS =================================================='
SELECT k AS item, v AS obtido, e AS esperado,
       CASE WHEN v = e THEN 'ok' ELSE '*** DIVERGE ***' END AS situacao
  FROM (VALUES
    ('processos',                        (SELECT count(*) FROM processos_procedimentos), 163),
    ('processos ativos',                 (SELECT count(*) FROM processos_procedimentos WHERE ativo), 134),
    ('processos concluidos',             (SELECT count(*) FROM processos_procedimentos WHERE data_conclusao IS NOT NULL), 102),
    ('cartas precatorias',               (SELECT count(*) FROM carta_precatoria_detalhes), 3),
    ('envolvidos',                       (SELECT count(*) FROM processo_envolvidos), 265),
    ('envolvidos "A apurar"',            (SELECT count(*) FROM processo_envolvidos WHERE policial_militar_id IS NULL), 2),
    ('condutores',                       (SELECT count(*) FROM processo_envolvidos WHERE e_condutor), 17),
    ('envolvidos com solucao sugerida',  (SELECT count(*) FROM processo_envolvidos WHERE solucao_sugerida_id IS NOT NULL), 16),
    ('envolvidos com solucao decidida',  (SELECT count(*) FROM processo_envolvidos WHERE solucao_decidida_id IS NOT NULL), 160),
    ('envolvidos com penalidade',        (SELECT count(*) FROM processo_envolvidos WHERE penalidade_tipo_id IS NOT NULL), 10),
    ('penalidades com dias',             (SELECT count(*) FROM processo_envolvidos WHERE penalidade_dias IS NOT NULL), 7),
    ('designacoes',                      (SELECT count(*) FROM processo_designacoes), 225),
    ('designacoes vigentes',             (SELECT count(*) FROM processo_designacoes WHERE data_fim IS NULL), 200),
    ('substituicoes com cadeia ligada',  (SELECT count(*) FROM processo_designacoes WHERE designacao_anterior_id IS NOT NULL), 25),
    ('prazos',                           (SELECT count(*) FROM processo_prazos), 289),
    ('prazos iniciais',                  (SELECT count(*) FROM processo_prazos WHERE ordem = 0), 163),
    ('prorrogacoes',                     (SELECT count(*) FROM processo_prazos WHERE ordem > 0), 126),
    ('vitimas',                          (SELECT count(*) FROM processo_vitimas), 133),
    ('pessoas inquiridas',               (SELECT count(*) FROM processo_pessoas), 3),
    ('andamentos',                       (SELECT count(*) FROM processo_andamentos), 73),
    ('anexos',                           (SELECT count(*) FROM processo_anexos), 1),
    ('categorias de indicio',            (SELECT count(*) FROM envolvido_categorias_indicio), 35),
    ('infracoes penais',                 (SELECT count(*) FROM envolvido_infracoes_penais), 18),
    ('transgressoes RDPM',               (SELECT count(*) FROM envolvido_transgressoes), 88),
    ('  ... das tabelas pm_envolvido',   (SELECT count(*) FROM envolvido_transgressoes et
                                           JOIN processo_envolvidos e ON e.id = et.envolvido_id
                                           JOIN processos_procedimentos p ON p.id = e.processo_id
                                           JOIN apuratorios a ON a.id = p.apuratorio_id
                                          WHERE a.sigla <> 'PADS'), 15),
    ('  ... do jsonb dos PADS',          (SELECT count(*) FROM envolvido_transgressoes et
                                           JOIN processo_envolvidos e ON e.id = et.envolvido_id
                                           JOIN processos_procedimentos p ON p.id = e.processo_id
                                           JOIN apuratorios a ON a.id = p.apuratorio_id
                                          WHERE a.sigla = 'PADS'), 73),
    ('infracoes do Estatuto',            (SELECT count(*) FROM envolvido_infracoes_estatuto), 23),
    ('  ... com analogia REAL',          (SELECT count(*) FROM envolvido_infracoes_estatuto
                                          WHERE analogia_transgressao_id <> 'c8000000-0000-4000-8000-000000000001'), 13),
    ('  ... com analogia PROVISORIA',    (SELECT count(*) FROM envolvido_infracoes_estatuto
                                          WHERE analogia_transgressao_id  = 'c8000000-0000-4000-8000-000000000001'), 10),
    ('policiais militares',              (SELECT count(*) FROM policiais_militares), 246),
    ('contas de acesso',                 (SELECT count(*) FROM usuarios), 7),
    ('apuratorios',                      (SELECT count(*) FROM apuratorios), 10),
    ('unidades',                         (SELECT count(*) FROM unidades_pm), 11),
    ('naturezas do fato',                (SELECT count(*) FROM naturezas_fato), 17),
    ('infracoes penais no catalogo',     (SELECT count(*) FROM infracoes_penais), 31),
    ('auditoria (preservada, nao migrada)', (SELECT count(*) FROM auditoria WHERE entidade <> 'migracao_legado'), 79),
    ('mapas salvos (preservados)',       (SELECT count(*) FROM mapas_salvos), 3)
  ) AS t(k, v, e);

\echo
\echo '== INVARIANTES (todas devem dar 0) ============================'
SELECT k AS invariante, v AS violacoes,
       CASE WHEN v = 0 THEN 'ok' ELSE '*** FALHOU ***' END AS situacao
  FROM (VALUES

    -- ---------------------------------------------------------- o processo --
    ('processo do legado que nao chegou',
     (SELECT count(*) FROM legado.processos_procedimentos l
       WHERE NOT EXISTS (SELECT 1 FROM processos_procedimentos p WHERE p.id = l.id::uuid))),

    ('processo no destino sem origem no legado',
     (SELECT count(*) FROM processos_procedimentos p
       WHERE NOT EXISTS (SELECT 1 FROM legado.processos_procedimentos l WHERE l.id::uuid = p.id))),

    ('processo perdeu especie, unidade ou municipio na traducao',
     (SELECT count(*) FROM processos_procedimentos p
        JOIN legado.processos_procedimentos l ON l.id = p.id::text
        JOIN apuratorios a ON a.id = p.apuratorio_id
        JOIN unidades_pm u ON u.id = p.unidade_origem_id
        JOIN municipios_distritos m ON m.id = p.municipio_fato_id
       WHERE a.sigla <> l.tipo_detalhe
          OR u.nome  <> l.local_origem
          OR m.nome  <> regexp_replace(l.local_fatos, '\s*\([^)]*\)\s*$', ''))),

    ('distrito composto ligado ao municipio-pai errado',
     (SELECT count(*) FROM processos_procedimentos p
        JOIN legado.processos_procedimentos l ON l.id = p.id::text
        JOIN municipios_distritos m ON m.id = p.municipio_fato_id
        LEFT JOIN municipios_distritos pai ON pai.id = m.municipio_pai_id
       WHERE l.local_fatos LIKE '%(%)'
         AND lower(COALESCE(pai.nome, '')) <> lower(btrim(regexp_replace(l.local_fatos, '^.*\((.*)\)$', '\1'))))),

    ('data do processo divergente do legado',
     (SELECT count(*) FROM processos_procedimentos p
        JOIN legado.processos_procedimentos l ON l.id = p.id::text
       WHERE p.data_instauracao IS DISTINCT FROM l.data_instauracao
          OR p.data_recebimento IS DISTINCT FROM l.data_recebimento
          OR p.data_julgamento  IS DISTINCT FROM l.data_julgamento
          OR p.data_conclusao   IS DISTINCT FROM l.data_conclusao
          OR COALESCE(p.data_remessa_encarregado, p.data_remessa_comissao)
             IS DISTINCT FROM l.data_remessa_encarregado)),

    ('situacao ativo/concluido divergente do legado',
     (SELECT count(*) FROM processos_procedimentos p
        JOIN legado.processos_procedimentos l ON l.id = p.id::text
       WHERE p.ativo IS DISTINCT FROM COALESCE(l.ativo, true)
          OR (p.data_conclusao IS NOT NULL) IS DISTINCT FROM COALESCE(l.concluido, false))),

    -- -------------------------------------------------------- o envolvido --
    ('envolvido do legado sem contrapartida',
     (SELECT count(*) FROM legado.procedimento_pms_envolvidos e
       WHERE NOT EXISTS (SELECT 1 FROM processo_envolvidos x WHERE x.id = e.id::uuid))),

    ('militar principal do processo que nao virou envolvido',
     (SELECT count(*) FROM legado.processos_procedimentos l
       WHERE l.nome_pm_id IS NOT NULL
         AND NOT EXISTS (
             SELECT 1 FROM processo_envolvidos x
              WHERE x.processo_id = l.id::uuid
                AND (x.policial_militar_id::text = l.nome_pm_id
                     OR (x.policial_militar_id IS NULL
                         AND EXISTS (SELECT 1 FROM legado.usuarios au
                                      WHERE au.id = l.nome_pm_id
                                        AND upper(btrim(au.nome)) = 'À APURAR'))) ))),

    ('mesmo militar duas vezes no mesmo processo',
     (SELECT count(*) FROM (SELECT processo_id, policial_militar_id FROM processo_envolvidos
                             WHERE policial_militar_id IS NOT NULL
                             GROUP BY 1,2 HAVING count(*) > 1) x)),

    ('mais de um "A apurar" no mesmo processo',
     (SELECT count(*) FROM (SELECT processo_id FROM processo_envolvidos
                             WHERE policial_militar_id IS NULL
                             GROUP BY 1 HAVING count(*) > 1) x)),

    ('"A apurar" que virou policial de verdade',
     (SELECT count(*) FROM processo_envolvidos x
        JOIN policiais_militares pm ON pm.id = x.policial_militar_id
       WHERE upper(btrim(pm.nome)) = 'À APURAR' AND pm.matricula = '100000000')),

    ('condutor que nao era o motorista do legado',
     (SELECT count(*) FROM processo_envolvidos x
        JOIN legado.processos_procedimentos l ON l.id = x.processo_id::text
       WHERE x.e_condutor AND l.motorista_id IS DISTINCT FROM x.policial_militar_id::text)),

    ('motorista do legado que nao virou condutor',
     (SELECT count(*) FROM legado.processos_procedimentos l
       WHERE l.motorista_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM processo_envolvidos x
                          WHERE x.processo_id = l.id::uuid
                            AND x.policial_militar_id::text = l.motorista_id
                            AND x.e_condutor))),

    ('status do envolvido divergente do legado',
     (SELECT count(*) FROM processo_envolvidos x
        JOIN legado.procedimento_pms_envolvidos e ON e.id = x.id::text
        JOIN status_envolvido s ON s.id = x.status_envolvido_id
       WHERE lower(s.nome) <> lower(e.status_pm))),

    ('penalidade sem solucao decidida',
     (SELECT count(*) FROM processo_envolvidos
       WHERE penalidade_tipo_id IS NOT NULL AND solucao_decidida_id IS NULL)),

    ('processo com solucao no legado e envolvido sem ela no destino',
     (SELECT count(*) FROM legado.processos_procedimentos l
        JOIN processo_envolvidos x ON x.processo_id = l.id::uuid
       WHERE COALESCE(btrim(l.solucao_tipo), '') <> ''
         AND x.solucao_sugerida_id IS NULL AND x.solucao_decidida_id IS NULL)),

    -- ------------------------------------------------------- a designacao --
    ('processo sem responsavel vigente',
     (SELECT count(*) FROM v_processos_detalhados WHERE responsavel_nome IS NULL)),

    ('responsavel vigente diferente do legado',
     (SELECT count(*) FROM processo_designacoes d
        JOIN apuratorio_papeis ap ON ap.apuratorio_id = d.apuratorio_id
                                 AND ap.papel_id = d.papel_id AND ap.e_responsavel
        JOIN legado.processos_procedimentos l ON l.id = d.processo_id::text
       WHERE d.data_fim IS NULL
         AND d.policial_militar_id::text
             IS DISTINCT FROM COALESCE(l.responsavel_id, l.presidente_id))),

    ('papel com 2 ocupantes vigentes no mesmo processo',
     (SELECT count(*) FROM (SELECT processo_id, papel_id FROM processo_designacoes
                             WHERE data_fim IS NULL GROUP BY 1,2 HAVING count(*) > 1) x)),

    ('buraco ou sobreposicao entre designacoes do mesmo papel',
     (SELECT count(*) FROM (SELECT data_fim,
             lead(data_inicio) OVER (PARTITION BY processo_id, papel_id ORDER BY data_inicio) prox
        FROM processo_designacoes) x
       WHERE data_fim IS NOT NULL AND prox IS DISTINCT FROM data_fim)),

    ('designacao que sucede outra sem o elo gravado',
     (SELECT count(*) FROM processo_designacoes d
       WHERE d.designacao_anterior_id IS NULL
         AND EXISTS (SELECT 1 FROM processo_designacoes a
                      WHERE a.processo_id = d.processo_id AND a.papel_id = d.papel_id
                        AND a.data_fim = d.data_inicio))),

    ('elo da cadeia apontando para trecho nao contiguo',
     (SELECT count(*) FROM processo_designacoes d
        JOIN processo_designacoes a ON a.id = d.designacao_anterior_id
       WHERE a.processo_id <> d.processo_id
          OR a.papel_id    <> d.papel_id
          OR a.data_fim    IS DISTINCT FROM d.data_inicio
          OR a.policial_militar_id = d.policial_militar_id)),

    ('escrivao de CD/CJ/PAD gravado no papel do IPM',
     (SELECT count(*) FROM processo_designacoes d
        JOIN papeis_processo pp ON pp.id = d.papel_id
        JOIN apuratorios a ON a.id = d.apuratorio_id
        JOIN legado.processos_procedimentos l ON l.id = d.processo_id::text
       WHERE a.sigla IN ('CD','CJ','PAD')
         AND pp.nome = 'Escrivão'
         AND l.escrivao_processo_id = d.policial_militar_id::text)),

    -- ------------------------------------------------------------ o prazo --
    ('vencimento ou dias do prazo divergente do legado',
     (SELECT count(*) FROM processo_prazos z JOIN legado.prazos_processo l ON l.id = z.id::text
       WHERE z.data_vencimento <> l.data_vencimento OR z.dias <> l.dias_adicionados)),

    ('prazo do legado que nao chegou',
     (SELECT count(*) FROM legado.prazos_processo l
       WHERE NOT EXISTS (SELECT 1 FROM processo_prazos z WHERE z.id = l.id::uuid))),

    ('processo sem prazo inicial',
     (SELECT count(*) FROM processos_procedimentos p
       WHERE NOT EXISTS (SELECT 1 FROM processo_prazos z WHERE z.processo_id = p.id AND z.ordem = 0))),

    ('buraco na ordem das prorrogacoes',
     (SELECT count(*) FROM (SELECT processo_id, max(ordem) mx, count(*) n
                              FROM processo_prazos GROUP BY 1) x WHERE mx + 1 <> n)),

    ('prorrogacao sem motivo (o CHECK do schema)',
     (SELECT count(*) FROM processo_prazos WHERE ordem > 0 AND COALESCE(btrim(motivo), '') = '')),

    ('prazo reconstruido que nao comeca no recebimento',
     (SELECT count(*) FROM processo_prazos z
        JOIN legado.processos_procedimentos l ON l.id = z.processo_id::text
       WHERE z.ordem = 0
         AND NOT EXISTS (SELECT 1 FROM legado.prazos_processo lz WHERE lz.id::uuid = z.id)
         AND z.data_inicio IS DISTINCT FROM l.data_recebimento)),

    -- ------------------------------------------- filhos e enquadramentos --
    ('vitima do legado sem contrapartida',
     (SELECT count(*) FROM (
        SELECT l.id, btrim(v.nome) nome FROM legado.processos_procedimentos l
          CROSS JOIN LATERAL (
              SELECT elem AS nome FROM jsonb_array_elements_text(
                       CASE WHEN btrim(l.nome_vitima) LIKE '[%' THEN l.nome_vitima::jsonb ELSE '[]'::jsonb END) t(elem)
              UNION ALL SELECT l.nome_vitima WHERE btrim(l.nome_vitima) NOT LIKE '[%') v
         WHERE l.nome_vitima IS NOT NULL AND btrim(v.nome) <> '') q
       WHERE NOT EXISTS (SELECT 1 FROM processo_vitimas pv
                          WHERE pv.processo_id = q.id::uuid AND pv.nome = q.nome))),

    ('andamento do legado sem contrapartida',
     (SELECT count(*) FROM legado.processos_procedimentos l
        CROSS JOIN LATERAL jsonb_array_elements(l.andamentos) a
       WHERE jsonb_typeof(l.andamentos) = 'array'
         AND btrim(COALESCE(a->>'texto','')) <> ''
         AND NOT EXISTS (SELECT 1 FROM processo_andamentos an WHERE an.id = (a->>'id')::uuid))),

    ('andamento sem autor',
     (SELECT count(*) FROM processo_andamentos WHERE registrado_por_id IS NULL)),

    ('andamento com horario deslocado do legado',
     (SELECT count(*) FROM legado.processos_procedimentos l
        CROSS JOIN LATERAL jsonb_array_elements(l.andamentos) a
        JOIN processo_andamentos an ON an.id = (a->>'id')::uuid
       WHERE jsonb_typeof(l.andamentos) = 'array'
         AND an.ocorrido_em <> ((a->>'data')::timestamp AT TIME ZONE 'America/Porto_Velho'))),

    ('anexo com tamanho ou conteudo divergente',
     (SELECT count(*) FROM legado.processos_procedimentos l
        JOIN processo_anexos ax ON ax.processo_id = l.id::uuid
       WHERE l.pdf_arquivo IS NOT NULL
         AND (octet_length(ax.conteudo) <> l.pdf_tamanho
              OR sha256(ax.conteudo) <> sha256(l.pdf_arquivo)
              OR ax.nome_arquivo <> l.pdf_nome))),

    ('enquadramento apontando para envolvido de outro processo',
     (SELECT count(*) FROM legado.pm_envolvido_indicios i
        JOIN processo_envolvidos e ON e.id = i.pm_envolvido_id::uuid
       WHERE e.processo_id::text <> i.procedimento_id)),

    ('categoria de indicio do legado sem contrapartida',
     (SELECT count(*) FROM (
        SELECT i.pm_envolvido_id, c.nome FROM legado.pm_envolvido_indicios i
          CROSS JOIN LATERAL jsonb_array_elements_text(i.categorias_indicios) c(nome)) q
       WHERE NOT EXISTS (SELECT 1 FROM envolvido_categorias_indicio eci
                           JOIN categorias_indicio ci ON ci.id = eci.categoria_indicio_id
                          WHERE eci.envolvido_id = q.pm_envolvido_id::uuid
                            AND lower(ci.nome) = lower(q.nome)))),

    ('infracao penal do legado sem contrapartida',
     (SELECT count(*) FROM legado.pm_envolvido_crimes x
        JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
       WHERE NOT EXISTS (SELECT 1 FROM envolvido_infracoes_penais eip
                          WHERE eip.envolvido_id = i.pm_envolvido_id::uuid
                            AND eip.infracao_penal_id = x.crime_id::uuid))),

    ('esfera penal incoerente com o dispositivo do artigo',
     (SELECT count(*) FROM envolvido_infracoes_penais eip
        JOIN infracoes_penais ip ON ip.id = eip.infracao_penal_id
        JOIN dispositivos_legais dl ON dl.id = ip.dispositivo_legal_id
        JOIN esferas_penais es ON es.id = eip.esfera_penal_id
       WHERE lower(es.nome) <> CASE WHEN dl.nome = 'Código Penal Militar' THEN 'militar' ELSE 'comum' END)),

    ('transgressao RDPM do legado sem contrapartida',
     (SELECT count(*) FROM legado.pm_envolvido_rdpm x
        JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
        JOIN legado.transgressoes lt ON lt.id = x.transgressao_id
       WHERE NOT EXISTS (
             SELECT 1 FROM envolvido_transgressoes et
               JOIN transgressoes t ON t.id = et.transgressao_id
               JOIN artigos_rdpm ar ON ar.id = t.artigo_rdpm_id
              WHERE et.envolvido_id = i.pm_envolvido_id::uuid
                AND lower(ar.artigo) = lower('Art. ' || lt.artigo)
                AND lower(t.inciso)  = lower(lt.inciso)))),

    ('transgressao RDPM do jsonb dos PADS sem contrapartida',
     (SELECT count(*) FROM (
        SELECT e.id AS envolvido_id, (item->>'id')::int AS ref
          FROM legado.processos_procedimentos l
          CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) AS item
          JOIN processo_envolvidos e ON e.processo_id = l.id::uuid
         WHERE btrim(COALESCE(l.transgressoes_ids,'')) NOT IN ('','[]')
           AND item->>'tipo' = 'rdpm') q
       WHERE NOT EXISTS (
             SELECT 1 FROM envolvido_transgressoes et
               JOIN transgressoes t  ON t.id = et.transgressao_id
               JOIN artigos_rdpm ar  ON ar.id = t.artigo_rdpm_id
               JOIN legado.transgressoes lt ON lt.id = q.ref
              WHERE et.envolvido_id = q.envolvido_id
                AND lower(ar.artigo) = lower('Art. ' || lt.artigo)
                AND lower(t.inciso)  = lower(lt.inciso)))),

    ('infracao estatutaria do jsonb dos PADS sem contrapartida',
     (SELECT count(*) FROM (
        SELECT e.id AS envolvido_id, (item->>'id')::uuid AS ref
          FROM legado.processos_procedimentos l
          CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) AS item
          JOIN processo_envolvidos e ON e.processo_id = l.id::uuid
         WHERE btrim(COALESCE(l.transgressoes_ids,'')) NOT IN ('','[]')
           AND item->>'tipo' = 'estatuto') q
       WHERE NOT EXISTS (SELECT 1 FROM envolvido_infracoes_estatuto eie
                          WHERE eie.envolvido_id = q.envolvido_id
                            AND eie.infracao_estatuto_id = q.ref))),

    ('infracao estatutaria do art. 29 sem contrapartida',
     (SELECT count(*) FROM legado.pm_envolvido_art29 x
        JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
       WHERE NOT EXISTS (SELECT 1 FROM envolvido_infracoes_estatuto eie
                          WHERE eie.envolvido_id = i.pm_envolvido_id::uuid
                            AND eie.infracao_estatuto_id = x.art29_id::uuid))),

    ('analogia provisoria usada onde havia analogia real',
     (SELECT count(*) FROM (
        SELECT e.id AS envolvido_id, (item->>'id')::uuid AS ref
          FROM legado.processos_procedimentos l
          CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) AS item
          JOIN processo_envolvidos e ON e.processo_id = l.id::uuid
         WHERE btrim(COALESCE(l.transgressoes_ids,'')) NOT IN ('','[]')
           AND item->>'tipo' = 'estatuto'
           AND item->'rdmp_analogia'->>'id' IS NOT NULL) q
        JOIN envolvido_infracoes_estatuto eie
          ON eie.envolvido_id = q.envolvido_id AND eie.infracao_estatuto_id = q.ref
       WHERE eie.analogia_transgressao_id = 'c8000000-0000-4000-8000-000000000001')),

    ('infracao estatutaria sem analogia RDPM (o NOT NULL do schema)',
     (SELECT count(*) FROM envolvido_infracoes_estatuto WHERE analogia_transgressao_id IS NULL)),

    -- ------------------------------------------------- pessoas e catalogo --
    ('militar do legado que nao entrou (fora ADMIN001 e "A apurar")',
     (SELECT count(*) FROM legado.usuarios u
       WHERE u.matricula <> 'ADMIN001'
         AND NOT (upper(btrim(u.nome)) = 'À APURAR' AND u.matricula = '100000000')
         AND NOT EXISTS (SELECT 1 FROM policiais_militares p WHERE p.id = u.id::uuid))),

    ('militar com posto divergente do dump',
     (SELECT count(*) FROM legado.usuarios u
        JOIN policiais_militares pm ON pm.id = u.id::uuid
        JOIN postos_graduacoes pg ON pg.id = pm.posto_graduacao_id
       WHERE u.matricula <> 'ADMIN001'
         AND lower(pg.sigla) <> lower(CASE u.posto_graduacao
                                          WHEN 'TC PM' THEN 'TEN CEL PM'
                                          WHEN 'ST PM' THEN 'SUB TEN PM'
                                          ELSE u.posto_graduacao END))),

    ('conta de acesso criada alem das que ja existiam',
     (SELECT GREATEST(count(*) - 7, 0)::int FROM usuarios)),

    -- ------------------------------------------------- o que NAO se migra --
    ('mapa mensal do legado que vazou para o destino',
     (SELECT count(*) FROM mapas_salvos m
       WHERE EXISTS (SELECT 1 FROM legado.mapas_salvos lm WHERE lm.id::text = m.id::text))),

    ('linha de auditoria do legado que vazou para o destino',
     (SELECT count(*) FROM auditoria a
       WHERE EXISTS (SELECT 1 FROM legado.auditoria la WHERE la.id::text = a.id::text))),

    ('tabela tecnica do legado que vazou para o destino',
     ((SELECT count(*) FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('alembic_version','schema_migrations'))::int))

  ) AS t(k, v);

\echo
\echo '== PENDENCIAS: precisam de decisao humana ====================='
\echo
\echo '-- 1. Art. 29 com ANALOGIA PROVISORIA (sem validade juridica).'
\echo '   A Secao precisa escolher o inciso analogo na tela de indicios.'
SELECT a.sigla, p.numero_documento AS processo,
       to_char(p.data_instauracao, 'DD/MM/YYYY') AS instaurado,
       COALESCE(pm.nome, '(A apurar)') AS militar,
       'Art. 29, ' || ie.inciso AS infracao
  FROM envolvido_infracoes_estatuto eie
  JOIN infracoes_estatuto ie ON ie.id = eie.infracao_estatuto_id
  JOIN processo_envolvidos e ON e.id = eie.envolvido_id
  JOIN processos_procedimentos p ON p.id = e.processo_id
  JOIN apuratorios a ON a.id = p.apuratorio_id
  LEFT JOIN policiais_militares pm ON pm.id = e.policial_militar_id
 WHERE eie.analogia_transgressao_id = 'c8000000-0000-4000-8000-000000000001'
 ORDER BY 1, 2, 5;

\echo
\echo '-- 2. Elos de substituicao PERDIDOS no colapso do mesmo dia.'
\echo '   O encarregado intermediario nunca exerceu um dia: o schema nao o'
\echo '   representa (ck_designacao_periodo exige data_fim > data_inicio).'
SELECT a.sigla, p.numero_documento AS processo,
       to_char(h.dia, 'DD/MM/YYYY') AS dia,
       h.nome_intermediario AS encarregado_nao_registrado
  FROM (
      SELECT l.id AS processo_id,
             (e->>'data_substituicao')::date AS dia,
             e->'novo_encarregado'->>'nome'  AS nome_intermediario,
             row_number() OVER (PARTITION BY l.id, (e->>'data_substituicao')::date
                                ORDER BY (e->>'data_substituicao')::timestamp) AS n,
             count(*)    OVER (PARTITION BY l.id, (e->>'data_substituicao')::date) AS total
        FROM legado.processos_procedimentos l
        CROSS JOIN LATERAL jsonb_array_elements(l.historico_encarregados) e
       WHERE jsonb_typeof(l.historico_encarregados) = 'array'
  ) h
  JOIN processos_procedimentos p ON p.id = h.processo_id::uuid
  JOIN apuratorios a ON a.id = p.apuratorio_id
 WHERE h.n < h.total
 ORDER BY 1, 2, 3;

\echo
\echo '-- 3. Prazos iniciais RECONSTRUIDOS (recebimento + prazo-base da especie).'
\echo '   O legado nao registrou prazo para estes; o numero de dias e o vigente'
\echo '   do catalogo, nao o que a autoridade concedeu na epoca.'
SELECT a.sigla, count(*) AS processos, min(z.dias) AS dias_min, max(z.dias) AS dias_max
  FROM processo_prazos z
  JOIN processos_procedimentos p ON p.id = z.processo_id
  JOIN apuratorios a ON a.id = p.apuratorio_id
 WHERE z.ordem = 0
   AND NOT EXISTS (SELECT 1 FROM legado.prazos_processo lz WHERE lz.id::uuid = z.id)
 GROUP BY 1 ORDER BY 2 DESC;

\echo
\echo '-- 4. Prorrogacoes com MOTIVO TECNICO (o legado nao registrou motivo).'
SELECT a.sigla, count(*) AS prorrogacoes
  FROM processo_prazos z
  JOIN processos_procedimentos p ON p.id = z.processo_id
  JOIN apuratorios a ON a.id = p.apuratorio_id
 WHERE z.motivo = 'Motivo não registrado no sistema anterior'
 GROUP BY 1 ORDER BY 2 DESC;

\echo
\echo '-- 5. Papel OBRIGATORIO sem ocupante (registro legado incompleto).'
SELECT a.sigla, p.numero_documento AS processo, pp.nome AS papel_vago
  FROM processos_procedimentos p
  JOIN apuratorios a ON a.id = p.apuratorio_id
  JOIN apuratorio_papeis ap ON ap.apuratorio_id = p.apuratorio_id AND ap.obrigatorio
  JOIN papeis_processo pp ON pp.id = ap.papel_id
 WHERE NOT EXISTS (SELECT 1 FROM processo_designacoes d
                    WHERE d.processo_id = p.id AND d.papel_id = ap.papel_id AND d.data_fim IS NULL)
 ORDER BY 1, 2, 3;

\echo
\echo '-- 6. Processo que admite acusacao e ficou SEM enquadramento nenhum.'
SELECT a.sigla, p.numero_documento AS processo,
       to_char(p.data_instauracao, 'DD/MM/YYYY') AS instaurado
  FROM processos_procedimentos p
  JOIN apuratorios a ON a.id = p.apuratorio_id
 WHERE a.permite_acusacao
   AND NOT EXISTS (
       SELECT 1 FROM processo_envolvidos e
        WHERE e.processo_id = p.id
          AND (EXISTS (SELECT 1 FROM envolvido_transgressoes         t WHERE t.envolvido_id = e.id)
            OR EXISTS (SELECT 1 FROM envolvido_infracoes_estatuto    t WHERE t.envolvido_id = e.id)
            OR EXISTS (SELECT 1 FROM envolvido_infracoes_penais      t WHERE t.envolvido_id = e.id)
            OR EXISTS (SELECT 1 FROM envolvido_categorias_indicio    t WHERE t.envolvido_id = e.id)))
 ORDER BY 1, 2;
\echo
