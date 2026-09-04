-- =============================================================================
-- PREFLIGHT — as conferências que precedem qualquer mutação
--
-- Roda FORA da transação da migração e não escreve nada. Todo problema que
-- impediria a carga de terminar, ou que a faria terminar errada em silêncio,
-- tem de aparecer aqui — antes do backup, antes da limpeza, antes de tudo.
--
-- Falha com exceção: `psql -v ON_ERROR_STOP=1` devolve código != 0 e o
-- orquestrador para. O que não é bloqueante sai como NOTICE.
--
-- Recebe do orquestrador:
--   -v hash_dump=<sha256 do arquivo de dump>
-- =============================================================================
\set ON_ERROR_STOP on

-- ------------------------------------------------- 1. identidade do destino --
-- Um banco sem `_sqlx_migrations` não é o destino; um com menos de 21
-- migrations é um destino velho, e as etapas contam com colunas que só existem
-- a partir da 0021.
--
-- A igualdade é exata de propósito: um destino ADIANTE do código também é
-- recusado, porque as etapas não sabem o que a migration seguinte mudou. O
-- preço é que **toda migration nova obriga a mexer aqui** — e nenhum teste
-- pega, porque `tests/importacao.rs` roda as 9 etapas e não o preflight.
DO $$
DECLARE n int; falhas text;
BEGIN
    IF to_regclass('public._sqlx_migrations') IS NULL THEN
        RAISE EXCEPTION 'destino não tem _sqlx_migrations: este banco não é o ADM-P6.';
    END IF;
    SELECT count(*) INTO n FROM _sqlx_migrations WHERE success;
    IF n <> 21 THEN
        RAISE EXCEPTION 'destino tem % migrations aplicadas com sucesso, e a migração espera 21 (0001..0021). Rode a aplicação uma vez para migrar antes.', n;
    END IF;
    SELECT string_agg(t, ', ' ORDER BY t) INTO falhas
      FROM unnest(ARRAY['processos_procedimentos','processo_envolvidos','processo_designacoes',
                        'processo_prazos','processo_andamentos','processo_anexos','processo_vitimas',
                        'processo_pessoas','carta_precatoria_detalhes','envolvido_infracoes_estatuto',
                        'envolvido_infracoes_penais','envolvido_transgressoes','envolvido_categorias_indicio',
                        'policiais_militares','usuarios','auditoria']) t
     WHERE to_regclass('public.' || t) IS NULL;
    IF falhas IS NOT NULL THEN
        RAISE EXCEPTION 'destino sem as tabelas %', falhas;
    END IF;
END $$;

-- ---------------------------------------------------- 2. o schema de origem --
-- O `legado` tem de ser o dump NOVO. O caso perigoso é o schema existir com o
-- dump ANTERIOR dentro: as etapas leriam 128 processos em vez de 163, sem erro
-- nenhum. As 24 tabelas e a contagem de processos separam os dois.
DO $$
DECLARE faltando text; n int;
BEGIN
    IF to_regnamespace('legado') IS NULL THEN
        RAISE EXCEPTION 'schema `legado` não existe. Carregue o dump antes — é o que scripts/migrar_dados_legados.sh faz.';
    END IF;
    SELECT string_agg(t, ', ' ORDER BY t) INTO faltando
      FROM unnest(ARRAY['processos_procedimentos','usuarios','procedimento_pms_envolvidos','prazos_processo',
                        'auditoria','mapas_salvos','pm_envolvido_indicios','pm_envolvido_rdpm',
                        'pm_envolvido_crimes','pm_envolvido_art29','crimes_contravencoes',
                        'infracoes_estatuto_art29','transgressoes','locais_origem','naturezas',
                        'municipios_distritos','postos_graduacoes','status_processo','tipos_processo',
                        'alembic_version','schema_migrations','procedimentos_indicios_art29',
                        'procedimentos_indicios_crimes','procedimentos_indicios_rdpm']) t
     WHERE to_regclass('legado.' || t) IS NULL;
    IF faltando IS NOT NULL THEN
        RAISE EXCEPTION 'schema `legado` incompleto, faltam: %', faltando;
    END IF;

    SELECT count(*) INTO n FROM legado.processos_procedimentos;
    IF n < 163 THEN
        RAISE EXCEPTION
            'schema `legado` tem % processos. O dump analisado tem 163 — este parece ser o backup ANTERIOR (128), e migrar a partir dele perderia 35 processos sem erro nenhum.',
            n;
    END IF;
END $$;

-- --------------------------------------- 3. já migrado? (marcador do dump) ---
-- Não é falha: é a resposta "não há o que fazer". O orquestrador lê esta linha.
SELECT CASE WHEN EXISTS (
           SELECT 1 FROM auditoria
            WHERE entidade = 'migracao_legado' AND registro_id = :'hash_dump'
       ) THEN 'JA_MIGRADO' ELSE 'PENDENTE' END AS situacao_migracao;

-- ------------------------------------- 4. a analogia provisória do art. 29 ---
-- Os 10 vínculos estatutários sem analogia recuperável entram com ela. Se
-- alguém a desativar pela tela de catálogos, a migração para — não escolhe
-- outra sozinha, porque a escolha precisa ser sempre a mesma para ser
-- identificável depois.
DO $$
DECLARE r record;
BEGIN
    SELECT t.ativo, ar.artigo, t.inciso INTO r
      FROM transgressoes t JOIN artigos_rdpm ar ON ar.id = t.artigo_rdpm_id
     WHERE t.id = 'c8000000-0000-4000-8000-000000000001';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'a transgressão da analogia provisória (c8000000-...-0001) não existe no catálogo.';
    END IF;
    IF NOT r.ativo THEN
        RAISE EXCEPTION 'a transgressão da analogia provisória (% %) está DESATIVADA. Reative-a ou decida outra antes de migrar.', r.artigo, r.inciso;
    END IF;
END $$;

-- ------------------------------- 5. o catálogo penal que a etapa 01 completa --
-- A 01 insere os artigos usados que faltam, mas só resolve dispositivo e
-- espécie por nome. Um nome que não casa faria o artigo ficar de fora, e a 08
-- derrubaria a carga lá adiante com uma FK — longe da causa.
DO $$
DECLARE orfaos text;
BEGIN
    SELECT string_agg(DISTINCT format('%s art. %s (%s)', cc.dispositivo_legal, cc.artigo, cc.tipo), '; ')
      INTO orfaos
      FROM legado.crimes_contravencoes cc
     WHERE EXISTS (SELECT 1 FROM legado.pm_envolvido_crimes x WHERE x.crime_id = cc.id)
       AND NOT EXISTS (SELECT 1 FROM infracoes_penais ip WHERE ip.id = cc.id::uuid)
       AND (NOT EXISTS (SELECT 1 FROM dispositivos_legais dl     WHERE lower(dl.nome) = lower(cc.dispositivo_legal))
         OR NOT EXISTS (SELECT 1 FROM especies_infracao_penal ei WHERE lower(ei.nome) = lower(cc.tipo)));
    IF orfaos IS NOT NULL THEN
        RAISE EXCEPTION 'artigo penal usado pelo legado sem dispositivo ou espécie correspondente no destino: %', orfaos;
    END IF;
END $$;

-- --------------------------- 6. tudo que a carga resolve por chave natural ---
-- Cada uma destas resoluções é um JOIN nas etapas 01 a 08. Falhar aqui é achar
-- o problema com o nome dele; falhar lá é achá-lo como violação de NOT NULL a
-- três arquivos de distância.
DO $$
DECLARE n int; det text;
BEGIN
    SELECT count(*), string_agg(DISTINCT local_fatos, '; ') INTO n, det
      FROM legado.processos_procedimentos l
     WHERE NOT EXISTS (
         SELECT 1 FROM municipios_distritos m
          WHERE lower(m.nome) = lower(btrim(regexp_replace(l.local_fatos, '\s*\([^)]*\)\s*$', '')))
     );
    IF n > 0 THEN RAISE EXCEPTION 'município do fato sem correspondência (%): %', n, det; END IF;

    SELECT count(*), string_agg(DISTINCT posto_graduacao, '; ') INTO n, det
      FROM legado.usuarios u
     WHERE u.matricula <> 'ADMIN001'
       AND NOT EXISTS (
           SELECT 1 FROM postos_graduacoes pg
            WHERE lower(pg.sigla) = lower(CASE u.posto_graduacao
                                              WHEN 'TC PM' THEN 'TEN CEL PM'
                                              WHEN 'ST PM' THEN 'SUB TEN PM'
                                              ELSE u.posto_graduacao END));
    IF n > 0 THEN RAISE EXCEPTION 'posto/graduação sem correspondência (%): %', n, det; END IF;

    SELECT count(*), string_agg(DISTINCT x.autor, '; ') INTO n, det
      FROM (SELECT a->>'usuario' AS autor
              FROM legado.processos_procedimentos l
              CROSS JOIN LATERAL jsonb_array_elements(l.andamentos) a
             WHERE jsonb_typeof(l.andamentos) = 'array'
               AND COALESCE(btrim(a->>'usuario'), '') <> '') x
     WHERE NOT EXISTS (SELECT 1 FROM legado.usuarios u WHERE u.nome = x.autor);
    IF n > 0 THEN RAISE EXCEPTION 'autor de andamento que não é militar do legado (%): %', n, det; END IF;
END $$;

-- ---------------------------------- 7. os processos de teste que serão ditos --
-- Só CONFERE. Quem apaga é 00_limpeza_testes.sql, dentro da transação.
DO $$
DECLARE sobrando text; achados int; ja int;
BEGIN
    SELECT count(*) INTO achados FROM processos_procedimentos p
     WHERE NOT EXISTS (SELECT 1 FROM legado.processos_procedimentos l WHERE l.id::uuid = p.id);
    SELECT count(*) INTO ja FROM processos_procedimentos p
     WHERE EXISTS (SELECT 1 FROM legado.processos_procedimentos l WHERE l.id::uuid = p.id);

    IF achados = 0 THEN
        RAISE NOTICE 'preflight: nenhum processo de teste a remover (% processo(s) do legado já no destino).', ja;
    ELSIF achados <> 13 THEN
        RAISE EXCEPTION
            'preflight: % processo(s) sem contraparte no legado, e a migração conhece 13. Alguém cadastrou processo pela tela nova? Decida antes de migrar — a limpeza os apagaria.',
            achados;
    ELSE
        RAISE NOTICE 'preflight: 13 processos de teste serão removidos.';
    END IF;
END $$;

-- --------------------------------------------- 8. o que já está no destino ---
-- Não bloqueia: informa. Migrar sobre um destino que já tem dado real é
-- decisão de quem opera, e o relatório precisa dizer o que havia antes.
SELECT 'destino_antes' AS bloco, 'processos'  AS item, count(*)::text AS valor FROM processos_procedimentos
UNION ALL SELECT 'destino_antes', 'policiais',  count(*)::text FROM policiais_militares
UNION ALL SELECT 'destino_antes', 'usuarios',   count(*)::text FROM usuarios
UNION ALL SELECT 'destino_antes', 'auditoria',  count(*)::text FROM auditoria
UNION ALL SELECT 'destino_antes', 'mapas',      count(*)::text FROM mapas_salvos
UNION ALL SELECT 'origem', 'processos',  count(*)::text FROM legado.processos_procedimentos
UNION ALL SELECT 'origem', 'usuarios',   count(*)::text FROM legado.usuarios
UNION ALL SELECT 'origem', 'envolvidos', count(*)::text FROM legado.procedimento_pms_envolvidos
UNION ALL SELECT 'origem', 'prazos',     count(*)::text FROM legado.prazos_processo
UNION ALL SELECT 'origem', 'mapas_NAO_migrados', count(*)::text FROM legado.mapas_salvos
UNION ALL SELECT 'origem', 'auditoria_NAO_migrada', count(*)::text FROM legado.auditoria;
