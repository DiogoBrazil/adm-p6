-- =============================================================================
-- CONFERÊNCIA DA IMPORTAÇÃO
--
-- Contagens primeiro, invariantes depois. As invariantes valem mais: uma
-- contagem certa com o vínculo errado passaria despercebida.
--
-- Só leitura. Roda depois das oito etapas, com o schema `legado` ainda no
-- banco — é ele que serve de gabarito.
-- =============================================================================
\pset footer off

\echo
\echo '== CONTAGENS =================================================='
SELECT k AS item, v AS obtido, esperado,
       CASE WHEN v = esperado THEN 'ok' ELSE '*** DIVERGE ***' END AS situacao
  FROM (VALUES
    ('processos',                (SELECT count(*) FROM processos_procedimentos),      128::bigint),
    ('  cartas precatorias',     (SELECT count(*) FROM carta_precatoria_detalhes),      3::bigint),
    ('envolvidos',               (SELECT count(*) FROM processo_envolvidos),          193::bigint),
    ('  condutores',             (SELECT count(*) FROM processo_envolvidos WHERE e_condutor), 15::bigint),
    ('  com penalidade',         (SELECT count(*) FROM processo_envolvidos WHERE penalidade_tipo_id IS NOT NULL), 7::bigint),
    ('designacoes',              (SELECT count(*) FROM processo_designacoes),          178::bigint),
    ('  substituicoes',          (SELECT count(*) FROM processo_designacoes WHERE data_fim IS NOT NULL), 19::bigint),
    ('prazos',                   (SELECT count(*) FROM processo_prazos),               141::bigint),
    ('  prorrogacoes',           (SELECT count(*) FROM processo_prazos WHERE ordem >= 1), 97::bigint),
    ('andamentos',               (SELECT count(*) FROM processo_andamentos),            64::bigint),
    ('policiais militares',      (SELECT count(*) FROM policiais_militares),           235::bigint),
    ('contas de acesso',         (SELECT count(*) FROM usuarios),                        7::bigint),
    ('pessoas citadas',          (SELECT count(*) FROM processo_pessoas),              105::bigint),
    ('categorias de indicio',    (SELECT count(*) FROM envolvido_categorias_indicio),   27::bigint),
    ('infracoes penais',         (SELECT count(*) FROM envolvido_infracoes_penais),     12::bigint),
    ('transgressoes RDPM',       (SELECT count(*) FROM envolvido_transgressoes),        73::bigint),
    ('  dos procedimentos',      (SELECT count(*) FROM legado.pm_envolvido_rdpm),        11::bigint),
    ('  dos PADS',               (SELECT count(*) FROM envolvido_transgressoes) - 11,    62::bigint),
    ('infracoes estatuto',       (SELECT count(*) FROM envolvido_infracoes_estatuto),    11::bigint),
    ('unidades do catalogo morto',(SELECT count(*) FROM unidades_pm) - 6,                 5::bigint),
    ('anexos',                   (SELECT count(*) FROM processo_anexos),                 1::bigint),
    ('apuratorios',              (SELECT count(*) FROM apuratorios),                    10::bigint),
    ('unidades_pm',              (SELECT count(*) FROM unidades_pm),                    11::bigint),
    ('naturezas_fato',           (SELECT count(*) FROM naturezas_fato),                 16::bigint)
  ) AS t(k, v, esperado);

\echo
\echo '== INVARIANTES (todas devem dar 0) ============================'
SELECT k AS invariante, v AS violacoes,
       CASE WHEN v = 0 THEN 'ok' ELSE '*** FALHOU ***' END AS situacao
  FROM (VALUES

    ('processo perdeu especie, unidade ou municipio na traducao',
     (SELECT count(*) FROM processos_procedimentos p
        JOIN legado.processos_procedimentos l ON l.id = p.id::text
        JOIN apuratorios a ON a.id = p.apuratorio_id
        JOIN unidades_pm u ON u.id = p.unidade_origem_id
        JOIN municipios_distritos m ON m.id = p.municipio_fato_id
       WHERE a.sigla <> l.tipo_detalhe
          OR u.nome  <> l.local_origem
          OR m.nome  <> regexp_replace(l.local_fatos, '\s*\([^)]*\)\s*$', ''))),

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

    ('envolvido do legado sem contrapartida',
     (SELECT count(*) FROM legado.procedimento_pms_envolvidos e
       WHERE NOT EXISTS (SELECT 1 FROM processo_envolvidos x WHERE x.id = e.id::uuid))),

    ('envolvido novo sem origem no legado',
     (SELECT count(*) FROM processo_envolvidos x
       WHERE NOT EXISTS (SELECT 1 FROM legado.procedimento_pms_envolvidos e WHERE e.id::uuid = x.id)
         AND NOT EXISTS (SELECT 1 FROM legado.processos_procedimentos l
                          WHERE l.id::uuid = x.id AND l.nome_pm_id::uuid = x.policial_militar_id))),

    ('vencimento ou dias do prazo divergente do legado',
     (SELECT count(*) FROM processo_prazos z JOIN legado.prazos_processo l ON l.id = z.id::text
       WHERE z.data_vencimento <> l.data_vencimento OR z.dias <> l.dias_adicionados)),

    ('prazo vigente diferente do que o legado marcava ativo',
     (SELECT count(*) FROM (
        SELECT DISTINCT ON (processo_id) processo_id, id FROM processo_prazos
         ORDER BY processo_id, ordem DESC) v
        JOIN legado.prazos_processo l ON l.id = v.id::text
       WHERE l.ativo IS DISTINCT FROM true)),

    ('andamento sem autor',
     (SELECT count(*) FROM processo_andamentos WHERE registrado_por_id IS NULL)),

    ('penalidade sem solucao decidida',
     (SELECT count(*) FROM processo_envolvidos
       WHERE penalidade_tipo_id IS NOT NULL AND solucao_decidida_id IS NULL)),

    ('condutor que nao era o motorista do legado',
     (SELECT count(*) FROM processo_envolvidos x
        JOIN legado.processos_procedimentos l ON l.id = x.processo_id::text
       WHERE x.e_condutor AND l.motorista_id IS DISTINCT FROM x.policial_militar_id::text)),

    ('enquadramento apontando para envolvido de outro processo',
     (SELECT count(*) FROM legado.pm_envolvido_indicios i
        JOIN processo_envolvidos e ON e.id = i.pm_envolvido_id::uuid
       WHERE e.processo_id::text <> i.procedimento_id)),

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
       WHERE NOT EXISTS (
             SELECT 1 FROM envolvido_infracoes_estatuto eie
              WHERE eie.envolvido_id = q.envolvido_id
                AND eie.infracao_estatuto_id = q.ref))),

    ('infracao estatutaria sem analogia RDPM (o NOT NULL do schema)',
     (SELECT count(*) FROM envolvido_infracoes_estatuto WHERE analogia_transgressao_id IS NULL)),

    ('militar do legado que nao entrou (fora o ADMIN001)',
     (SELECT count(*) FROM legado.usuarios u
       WHERE u.matricula <> 'ADMIN001'
         AND NOT EXISTS (SELECT 1 FROM policiais_militares p WHERE p.id = u.id::uuid)))

  ) AS t(k, v);

\echo
\echo '== SOLUCAO: 27 processos com 2+ envolvidos tiveram a solucao replicada =='
SELECT count(*) AS processos_multi_envolvido_com_solucao,
       sum(envolvidos) AS envolvidos_alcancados
  FROM (SELECT e.processo_id, count(*) AS envolvidos
          FROM processo_envolvidos e
         WHERE e.solucao_decidida_id IS NOT NULL OR e.solucao_sugerida_id IS NOT NULL
         GROUP BY e.processo_id HAVING count(*) > 1) x;

\echo
\echo '== PENDENCIA DE REENQUADRAMENTO ==============================='
\echo 'Art. 29 sem analogia RDPM no legado: a Secao precisa escolher o inciso'
\echo 'analogo na tela de indicios (decisao 5 exige analogia).'
SELECT a.sigla, p.numero_documento AS processo, pm.nome AS militar,
       'Art. 29, ' || l29.inciso AS infracao
  FROM legado.pm_envolvido_art29 x
  JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
  JOIN legado.infracoes_estatuto_art29 l29 ON l29.id = x.art29_id
  JOIN processo_envolvidos e ON e.id = i.pm_envolvido_id::uuid
  JOIN processos_procedimentos p ON p.id = e.processo_id
  JOIN apuratorios a ON a.id = p.apuratorio_id
  JOIN policiais_militares pm ON pm.id = e.policial_militar_id
 ORDER BY 1, 2, 4;
\echo
