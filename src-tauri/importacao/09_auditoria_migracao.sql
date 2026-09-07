-- =============================================================================
-- ETAPA 09 — A LINHA DE AUDITORIA DA PRÓPRIA MIGRAÇÃO
--
-- Última etapa dentro da transação. Grava UMA linha em `auditoria` dizendo que
-- esta base recebeu os dados do sistema anterior, de qual arquivo e com que
-- resultado.
--
-- Ela é o MARCADOR DE IDEMPOTÊNCIA: `registro_id` é o SHA-256 do dump, então o
-- preflight sabe, antes de qualquer mutação, se aquele arquivo já entrou aqui.
-- Por isso o hash vem de fora, do orquestrador (`-v hash_dump=...`), e não é
-- calculado aqui: o banco não lê o arquivo.
--
-- NENHUMA das 574 linhas de auditoria do legado é importada — elas descrevem
-- operações de um sistema que não existe mais, com ids que não são os daqui. As
-- 79 linhas atuais também não são tocadas.
--
-- `operacao` é 'CREATE' porque `ck_auditoria_operacao` só aceita
-- CREATE/UPDATE/DELETE, e o INSERT da trilha corre na mesma transação da
-- operação auditada: um verbo novo derrubaria as duas juntas. O que a linha
-- realmente é fica em `acao` e `assunto`, que a 0018 criou justamente para o
-- texto legível.
--
-- `usuario_id` fica NULL: quem executou foi um operador de linha de comando com
-- credencial de banco, não um usuário do sistema. Inventar um seria atribuir a
-- alguém um ato que não foi dele.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh.
-- =============================================================================

INSERT INTO auditoria (entidade, registro_id, operacao, usuario_id, acao, assunto, alteracoes)
SELECT 'migracao_legado',
       :'hash_dump',
       'CREATE',
       NULL,
       'Migração de dados legados',
       format('Importação do sistema Python/Eel: %s processos, %s envolvidos, %s designações, %s prazos.',
              (SELECT count(*) FROM processos_procedimentos),
              (SELECT count(*) FROM processo_envolvidos),
              (SELECT count(*) FROM processo_designacoes),
              (SELECT count(*) FROM processo_prazos)),
       jsonb_build_object(
           'hash_dump',            :'hash_dump',
           'processos',            (SELECT count(*) FROM processos_procedimentos),
           'envolvidos',           (SELECT count(*) FROM processo_envolvidos),
           'envolvidos_a_apurar',  (SELECT count(*) FROM processo_envolvidos WHERE policial_militar_id IS NULL),
           'designacoes',          (SELECT count(*) FROM processo_designacoes),
           'cadeias',              (SELECT count(*) FROM processo_designacoes WHERE designacao_anterior_id IS NOT NULL),
           'prazos',               (SELECT count(*) FROM processo_prazos),
           'prazos_reconstruidos', (SELECT count(*) FROM processo_prazos z
                                     WHERE z.ordem = 0
                                       AND NOT EXISTS (SELECT 1 FROM legado.prazos_processo lz WHERE lz.id::uuid = z.id)),
           'vitimas',              (SELECT count(*) FROM processo_vitimas),
           'andamentos',           (SELECT count(*) FROM processo_andamentos),
           'anexos',               (SELECT count(*) FROM processo_anexos),
           'policiais',            (SELECT count(*) FROM policiais_militares),
           'analogias_provisorias',(SELECT count(*) FROM envolvido_infracoes_estatuto
                                     WHERE analogia_transgressao_id = 'c8000000-0000-4000-8000-000000000001'),
           'prorrogacoes_sem_motivo', (SELECT count(*) FROM processo_prazos
                                        WHERE motivo = 'Motivo não registrado no sistema anterior')
       )
 WHERE NOT EXISTS (
     SELECT 1 FROM auditoria
      WHERE entidade = 'migracao_legado' AND registro_id = :'hash_dump'
 );
