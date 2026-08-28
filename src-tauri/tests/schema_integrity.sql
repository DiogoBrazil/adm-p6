-- =============================================================================
-- Testes negativos de integridade do schema.
--
-- Cada caso tenta gravar um estado que o domínio considera impossível. O banco
-- DEVE recusar. Um caso marcado FALHOU significa que a regra passou a depender do
-- código da aplicação em vez do PostgreSQL.
--
-- Roda contra um banco DESCARTÁVEL e deixa resíduo de propósito (sem transação
-- externa, para que as constraint triggers DEFERRABLE possam ser verificadas caso
-- a caso). Quem cria e destrói o banco é o teste de integração:
--
--     cargo test --test schema_integrity
--
-- O resultado fica em pg_temp.resultado_integridade; a última consulta do arquivo
-- imprime tudo, o que também torna o script utilizável direto no psql.
-- =============================================================================

CREATE FUNCTION pg_temp.deve_rejeitar(descricao text, sql text) RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
    SET CONSTRAINTS ALL IMMEDIATE;
    EXECUTE sql;
    RETURN format('FALHOU  %s  -> o banco ACEITOU', rpad(descricao, 58));
EXCEPTION WHEN others THEN
    RETURN format('ok      %s  -> %s', rpad(descricao, 58), split_part(replace(SQLERRM, E'\n', ' '), '  ', 1));
END;
$fn$;

CREATE FUNCTION pg_temp.deve_aceitar(descricao text, sql text) RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
    SET CONSTRAINTS ALL IMMEDIATE;
    EXECUTE sql;
    RETURN format('ok      %s  -> aceito, como deve ser', rpad(descricao, 58));
EXCEPTION WHEN others THEN
    RETURN format('FALHOU  %s  -> RECUSOU: %s', rpad(descricao, 58), replace(SQLERRM, E'\n', ' '));
END;
$fn$;

-- ---------------------------------------------------------------- fixtures ---
-- Os nomes carregam "Teste" de proposito: a migration 0003 semeia os catalogos
-- LEGAIS (postos, RDPM, dispositivos, especies, esferas...) e as fixtures nao
-- podem colidir com eles nos indices unicos case-insensitive.
INSERT INTO circulos_hierarquicos (id, nome) VALUES
    ('11111111-0000-0000-0000-000000000001', 'Circulo Teste');
INSERT INTO postos_graduacoes (id, sigla, nome, circulo_hierarquico_id) VALUES
    ('11111111-0000-0000-0000-000000000002', 'TST PM', 'Soldado Teste PM', '11111111-0000-0000-0000-000000000001');
INSERT INTO policiais_militares (id, matricula, nome, posto_graduacao_id) VALUES
    ('22222222-0000-0000-0000-000000000001', '100000001', 'PM UM',   '11111111-0000-0000-0000-000000000002'),
    ('22222222-0000-0000-0000-000000000002', '100000002', 'PM DOIS', '11111111-0000-0000-0000-000000000002'),
    ('22222222-0000-0000-0000-000000000003', '100000003', 'PM TRES', '11111111-0000-0000-0000-000000000002');

INSERT INTO municipios_distritos (id, nome, e_distrito) VALUES
    ('33333333-0000-0000-0000-000000000001', 'Cidade Teste', false);
INSERT INTO unidades_pm (id, nome, municipio_id) VALUES
    ('33333333-0000-0000-0000-000000000002', 'Unidade Teste', '33333333-0000-0000-0000-000000000001');

INSERT INTO tipos_apuratorio (id, nome) VALUES
    ('44444444-0000-0000-0000-000000000001', 'procedimento');
-- Apuratório A: 1 envolvido no máximo (como os "processos" hoje)
INSERT INTO apuratorios (id, sigla, nome, tipo_apuratorio_id, prazo_base_dias, max_envolvidos) VALUES
    ('44444444-0000-0000-0000-000000000002', 'AP-A', 'Apuratorio A', '44444444-0000-0000-0000-000000000001', 30, 1),
    ('44444444-0000-0000-0000-000000000003', 'AP-B', 'Apuratorio B', '44444444-0000-0000-0000-000000000001', 30, NULL);
INSERT INTO tipos_documento (id, nome) VALUES
    ('55555555-0000-0000-0000-000000000001', 'Portaria'),
    ('55555555-0000-0000-0000-000000000002', 'Memorando');
-- Portaria só está habilitada para AP-A. Memorando não está habilitado para ninguém.
INSERT INTO apuratorio_documentos_iniciadores (apuratorio_id, tipo_documento_id, padrao) VALUES
    ('44444444-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', true),
    ('44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000001', true);

INSERT INTO papeis_processo (id, nome) VALUES
    ('66666666-0000-0000-0000-000000000001', 'Encarregado'),
    ('66666666-0000-0000-0000-000000000002', 'Escrivao');
-- AP-A usa só Encarregado (1 ocupante). Escrivão NÃO é previsto para AP-A.
INSERT INTO apuratorio_papeis (apuratorio_id, papel_id, obrigatorio, max_ocupantes, e_responsavel) VALUES
    ('44444444-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', true, 1, true);

INSERT INTO status_envolvido (id, nome) VALUES
    ('77777777-0000-0000-0000-000000000001', 'Sindicado');
INSERT INTO tipos_solucao_decidida (id, nome, permite_penalidade) VALUES
    ('77777777-0000-0000-0000-000000000002', 'Punido', true);
INSERT INTO tipos_penalidade (id, nome, usa_quantidade_dias) VALUES
    ('77777777-0000-0000-0000-000000000003', 'Prisao', true);

INSERT INTO naturezas_transgressao (id, nome) VALUES
    ('88888888-0000-0000-0000-000000000001', 'Natureza Teste');
INSERT INTO artigos_rdpm (id, artigo, natureza_transgressao_id) VALUES
    ('88888888-0000-0000-0000-000000000002', '15', '88888888-0000-0000-0000-000000000001');
INSERT INTO transgressoes (id, artigo_rdpm_id, inciso, texto) VALUES
    ('88888888-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000002', 'I', 'texto');
INSERT INTO dispositivos_legais (id, nome) VALUES
    ('99999999-0000-0000-0000-000000000001', 'Dispositivo Teste');
INSERT INTO especies_infracao_penal (id, nome) VALUES
    ('99999999-0000-0000-0000-000000000002', 'Especie Teste');
INSERT INTO esferas_penais (id, nome) VALUES
    ('99999999-0000-0000-0000-000000000003', 'Esfera Teste');
INSERT INTO infracoes_penais (id, dispositivo_legal_id, especie_id, artigo, descricao) VALUES
    ('99999999-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000001',
     '99999999-0000-0000-0000-000000000002', '157', 'roubo');
INSERT INTO categorias_indicio (id, nome, indica_ausencia) VALUES
    ('99999999-0000-0000-0000-000000000005', 'Nao houve indicios', true);

-- Processo base (AP-A + Portaria, par cadastrado)
INSERT INTO processos_procedimentos
    (id, apuratorio_id, documento_iniciador_id, numero_documento, unidade_origem_id,
     municipio_fato_id, data_instauracao)
VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002',
     '55555555-0000-0000-0000-000000000001', '1', '33333333-0000-0000-0000-000000000002',
     '33333333-0000-0000-0000-000000000001', DATE '2026-01-10');

INSERT INTO processo_envolvidos (id, processo_id, policial_militar_id, status_envolvido_id, ordem, e_condutor)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 1, true);

INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 0, DATE '2026-01-10', 30);

INSERT INTO processo_designacoes (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002',
        '22222222-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', DATE '2026-01-10');

-- Processo dedicado a UMA asserção: a prorrogação que começa no próprio dia do
-- vencimento anterior (migration 0005). Precisa ser um processo à parte porque
-- `deve_aceitar` PERSISTE o que grava, e o caso "no dia seguinte" abaixo já
-- ocupa a ordem 1 do processo base.
INSERT INTO processos_procedimentos
    (id, apuratorio_id, documento_iniciador_id, numero_documento, unidade_origem_id,
     municipio_fato_id, data_instauracao)
VALUES
    ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000003',
     '55555555-0000-0000-0000-000000000001', '900', '33333333-0000-0000-0000-000000000002',
     '33333333-0000-0000-0000-000000000001', DATE '2026-01-10');

INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 0, DATE '2026-01-10', 30);

-- Processo dedicado a UMA asserção: o DELETE barrado pela vítima. Precisa ser
-- um processo SEM envolvido, prazo ou designação — senão a recusa vem da
-- primeira FK que o PostgreSQL alcançar, e o caso passaria provando outra
-- coisa. Foi o que aconteceu na primeira escrita deste bloco.
INSERT INTO processos_procedimentos
    (id, apuratorio_id, documento_iniciador_id, numero_documento, unidade_origem_id,
     municipio_fato_id, data_instauracao)
VALUES
    ('aaaaaaaa-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003',
     '55555555-0000-0000-0000-000000000001', '901', '33333333-0000-0000-0000-000000000002',
     '33333333-0000-0000-0000-000000000001', DATE '2026-01-10');

INSERT INTO processo_vitimas (processo_id, nome, ordem)
VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'OFENDIDO UNICO', 1);

-- ------------------------------------------------------------------ casos ---
CREATE TEMP TABLE resultado_integridade (ordem serial, linha text);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('envolvido com policial inexistente', $$
  INSERT INTO processo_envolvidos (processo_id, policial_militar_id, status_envolvido_id, ordem)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','00000000-dead-0000-0000-000000000000',
          '77777777-0000-0000-0000-000000000001', 9)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('enquadramento para envolvido inexistente', $$
  INSERT INTO envolvido_transgressoes (envolvido_id, transgressao_id)
  VALUES ('00000000-dead-0000-0000-000000000000','88888888-0000-0000-0000-000000000003')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('processo com apuratorio inexistente', $$
  INSERT INTO processos_procedimentos (apuratorio_id, documento_iniciador_id, numero_documento,
    unidade_origem_id, municipio_fato_id, data_instauracao)
  VALUES ('00000000-dead-0000-0000-000000000000','55555555-0000-0000-0000-000000000001','X',
          '33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001', DATE '2026-01-10')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('par apuratorio x documento NAO cadastrado', $$
  INSERT INTO processos_procedimentos (apuratorio_id, documento_iniciador_id, numero_documento,
    unidade_origem_id, municipio_fato_id, data_instauracao)
  VALUES ('44444444-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000002','X',
          '33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001', DATE '2026-01-10')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('mesmo PM duas vezes no mesmo processo', $$
  INSERT INTO processo_envolvidos (processo_id, policial_militar_id, status_envolvido_id, ordem)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001',
          '77777777-0000-0000-0000-000000000001', 2)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('envolvido acima de max_envolvidos (=1)', $$
  INSERT INTO processo_envolvidos (processo_id, policial_militar_id, status_envolvido_id, ordem)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000003',
          '77777777-0000-0000-0000-000000000001', 2)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('dois condutores no mesmo processo', $$
  INSERT INTO processo_envolvidos (processo_id, policial_militar_id, status_envolvido_id, ordem, e_condutor)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
          '77777777-0000-0000-0000-000000000001', 3, true)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('penalidade sem solucao decidida', $$
  UPDATE processo_envolvidos SET penalidade_tipo_id='77777777-0000-0000-0000-000000000003'
   WHERE id='bbbbbbbb-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('matricula duplicada (caixa diferente)', $$
  INSERT INTO policiais_militares (matricula, nome, posto_graduacao_id)
  VALUES ('100000001','OUTRO','11111111-0000-0000-0000-000000000002')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('email duplicado com caixa diferente', $$
  INSERT INTO usuarios (nome_exibicao, email, senha_hash, perfil_id)
  SELECT 'X','ADMIN@SISTEMA.COM','h', id FROM perfis_acesso LIMIT 1$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('conta sem PM e sem nome_exibicao', $$
  INSERT INTO usuarios (email, senha_hash, perfil_id)
  SELECT 'x@y.z','h', id FROM perfis_acesso LIMIT 1$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('duas contas para o mesmo policial', $$
  INSERT INTO usuarios (policial_militar_id, email, senha_hash, perfil_id)
  SELECT '22222222-0000-0000-0000-000000000001','a@b.c','h', id FROM perfis_acesso LIMIT 1;
  INSERT INTO usuarios (policial_militar_id, email, senha_hash, perfil_id)
  SELECT '22222222-0000-0000-0000-000000000001','d@e.f','h', id FROM perfis_acesso LIMIT 1$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('duas extensoes CP para o mesmo processo', $$
  INSERT INTO carta_precatoria_detalhes (processo_id, deprecante, unidade_deprecada_id)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','X','33333333-0000-0000-0000-000000000002');
  INSERT INTO carta_precatoria_detalhes (processo_id, deprecante, unidade_deprecada_id)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Y','33333333-0000-0000-0000-000000000002')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('prazos com periodo sobreposto', $$
  INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias, motivo)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 1, DATE '2026-02-01', 30, 'motivo')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('prorrogacao sem motivo', $$
  INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 1, DATE '2026-02-10', 30)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('gravar data_vencimento manualmente (coluna gerada)', $$
  INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias, data_vencimento, motivo)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 5, DATE '2027-01-01', 30, DATE '2027-12-31','m')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('designacoes sobrepostas do mesmo papel/pessoa', $$
  INSERT INTO processo_designacoes (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002',
          '22222222-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000001', DATE '2026-03-01')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('designacao acima de max_ocupantes (=1)', $$
  INSERT INTO processo_designacoes (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002',
          '22222222-0000-0000-0000-000000000003','66666666-0000-0000-0000-000000000001', DATE '2026-03-01')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('designacao com papel nao previsto p/ o apuratorio', $$
  INSERT INTO processo_designacoes (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002',
          '22222222-0000-0000-0000-000000000003','66666666-0000-0000-0000-000000000002', DATE '2026-03-01')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('designacao com apuratorio divergente do processo', $$
  INSERT INTO processo_designacoes (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000003',
          '22222222-0000-0000-0000-000000000003','66666666-0000-0000-0000-000000000001', DATE '2026-03-01')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('dois documentos padrao no mesmo apuratorio', $$
  INSERT INTO apuratorio_documentos_iniciadores (apuratorio_id, tipo_documento_id, padrao)
  VALUES ('44444444-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000002', true)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('dois papeis responsaveis no mesmo apuratorio', $$
  INSERT INTO apuratorio_papeis (apuratorio_id, papel_id, e_responsavel)
  VALUES ('44444444-0000-0000-0000-000000000002','66666666-0000-0000-0000-000000000002', true)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('numero_documento duplicado no mesmo escopo', $$
  INSERT INTO processos_procedimentos (apuratorio_id, documento_iniciador_id, numero_documento,
    unidade_origem_id, municipio_fato_id, data_instauracao)
  VALUES ('44444444-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000001','1',
          '33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001', DATE '2026-05-05')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('numero_controle efetivo duplicado (NULL = numero_documento)', $$
  INSERT INTO processos_procedimentos (apuratorio_id, documento_iniciador_id, numero_documento,
    numero_controle, unidade_origem_id, municipio_fato_id, data_instauracao)
  VALUES ('44444444-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000001','99',
          '1','33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001', DATE '2026-05-05')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('data_conclusao anterior a instauracao', $$
  UPDATE processos_procedimentos SET data_conclusao = DATE '2025-01-01'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('remessa do encarregado anterior ao recebimento', $$
  UPDATE processos_procedimentos
     SET data_recebimento = DATE '2026-01-12', data_remessa_encarregado = DATE '2026-01-11'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('remessa a comissao anterior ao recebimento', $$
  UPDATE processos_procedimentos
     SET data_recebimento = DATE '2026-01-12', data_remessa_comissao = DATE '2026-01-11'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('julgamento anterior a remessa', $$
  UPDATE processos_procedimentos
     SET data_recebimento = DATE '2026-01-11', data_remessa_encarregado = DATE '2026-01-13',
         data_julgamento = DATE '2026-01-12'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('conclusao anterior ao recebimento', $$
  UPDATE processos_procedimentos
     SET data_recebimento = DATE '2026-01-13', data_conclusao = DATE '2026-01-12'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('conclusao anterior a remessa', $$
  UPDATE processos_procedimentos
     SET data_remessa_comissao = DATE '2026-01-13', data_conclusao = DATE '2026-01-12'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('conclusao anterior ao julgamento', $$
  UPDATE processos_procedimentos
     SET data_julgamento = DATE '2026-01-13', data_conclusao = DATE '2026-01-12'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('etapas opcionais e datas iguais', $$
  UPDATE processos_procedimentos
     SET data_recebimento = NULL, data_remessa_encarregado = DATE '2026-01-10',
         data_remessa_comissao = NULL, data_julgamento = DATE '2026-01-10',
         data_conclusao = DATE '2026-01-10'
   WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('DELETE de catalogo em uso (status_envolvido)', $$
  DELETE FROM status_envolvido WHERE id='77777777-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('DELETE de transgressao usada como analogia', $$
  INSERT INTO infracoes_estatuto (id, dispositivo_legal_id, artigo, inciso, texto)
  VALUES ('cccccccc-0000-0000-0000-000000000001','99999999-0000-0000-0000-000000000001','29','I','t');
  INSERT INTO envolvido_infracoes_estatuto (envolvido_id, infracao_estatuto_id, analogia_transgressao_id)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
          '88888888-0000-0000-0000-000000000003');
  DELETE FROM transgressoes WHERE id='88888888-0000-0000-0000-000000000003'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('infracao estatutaria sem analogia RDPM', $$
  INSERT INTO infracoes_estatuto (id, dispositivo_legal_id, artigo, inciso, texto)
  VALUES ('cccccccc-0000-0000-0000-000000000002','99999999-0000-0000-0000-000000000001','32','I','t');
  INSERT INTO envolvido_infracoes_estatuto (envolvido_id, infracao_estatuto_id)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('infracao penal sem esfera', $$
  INSERT INTO envolvido_infracoes_penais (envolvido_id, infracao_penal_id)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000001','99999999-0000-0000-0000-000000000004')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('DELETE de processo com filhas', $$
  DELETE FROM processos_procedimentos WHERE id='aaaaaaaa-0000-0000-0000-000000000001'$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('municipio como pai de si mesmo', $$
  UPDATE municipios_distritos SET municipio_pai_id = id
   WHERE id='33333333-0000-0000-0000-000000000001'$$);

-- A coerência distrito ↔ município pai, que antes vivia só na cabeça de quem
-- preenchia o formulário: `tipo` era texto livre e o pai era opcional para
-- todo mundo. Desde a 0006 é CHECK, e vale para qualquer caminho de escrita.
INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('distrito sem municipio pai', $$
  INSERT INTO municipios_distritos (nome, e_distrito, municipio_pai_id)
  VALUES ('Distrito Orfao Teste', true, NULL)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('municipio com municipio pai', $$
  INSERT INTO municipios_distritos (nome, e_distrito, municipio_pai_id)
  VALUES ('Cidade Com Pai Teste', false, '33333333-0000-0000-0000-000000000001')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('distrito com o municipio a que pertence', $$
  INSERT INTO municipios_distritos (nome, e_distrito, municipio_pai_id)
  VALUES ('Distrito Teste', true, '33333333-0000-0000-0000-000000000001')$$);

-- Só um dispositivo legal pode ser O Estatuto: é dele que a infração do
-- Estatuto tira o dispositivo, sem perguntar a ninguém.
INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('segundo dispositivo marcado como Estatuto', $$
  UPDATE dispositivos_legais SET e_estatuto_militar = true
   WHERE NOT e_estatuto_militar$$);


INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('mesmo numero em ano diferente', $$
  INSERT INTO processos_procedimentos (apuratorio_id, documento_iniciador_id, numero_documento,
    unidade_origem_id, municipio_fato_id, data_instauracao)
  VALUES ('44444444-0000-0000-0000-000000000002','55555555-0000-0000-0000-000000000001','1',
          '33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001', DATE '2025-01-10')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('mesmo numero em apuratorio diferente', $$
  INSERT INTO processos_procedimentos (apuratorio_id, documento_iniciador_id, numero_documento,
    unidade_origem_id, municipio_fato_id, data_instauracao)
  VALUES ('44444444-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000001','1',
          '33333333-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001', DATE '2026-01-10')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('prorrogacao imediatamente apos o vencimento', $$
  INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias, motivo)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 1, DATE '2026-02-10', 30, 'prorrogado')$$);

-- A convenção que a Seção pratica, e que a migration 0005 passou a admitir: a
-- prorrogação começa NO DIA do vencimento anterior (10/01 + 30 = 09/02). Sob o
-- `[]` original o dia era disputado pelos dois prazos e o banco recusava.
INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('prorrogacao no proprio dia do vencimento anterior', $$
  INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias, motivo)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 1, DATE '2026-02-09', 30, 'prorrogado')$$);

-- Um dia ANTES do vencimento continua sendo sobreposição de verdade.
INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('prorrogacao um dia antes do vencimento anterior', $$
  INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias, motivo)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 2, DATE '2026-02-08', 30, 'prorrogado')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('substituicao de encarregado na data da troca', $$
  UPDATE processo_designacoes SET data_fim = DATE '2026-03-01'
   WHERE processo_id='aaaaaaaa-0000-0000-0000-000000000001'
     AND policial_militar_id='22222222-0000-0000-0000-000000000002';
  INSERT INTO processo_designacoes (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio, motivo)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002',
          '22222222-0000-0000-0000-000000000003','66666666-0000-0000-0000-000000000001',
          DATE '2026-03-01','ferias')$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('catalogo desativado continua referenciado', $$
  UPDATE status_envolvido SET ativo=false WHERE id='77777777-0000-0000-0000-000000000001'$$);


-- ---------------------------------------------------- ofendido/vitima (0012) ---
-- O ofendido nao passa por catalogo nenhum: e a tabela que garante o formato.
INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('vitima com nome em branco', $$
  INSERT INTO processo_vitimas (processo_id, nome, ordem)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','   ',9)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('vitima com ordem zero', $$
  INSERT INTO processo_vitimas (processo_id, nome, ordem)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','FULANO',0)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_aceitar('duas vitimas no mesmo processo', $$
  INSERT INTO processo_vitimas (processo_id, nome, ordem) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001','FULANO DE TAL',1),
    ('aaaaaaaa-0000-0000-0000-000000000001','ADMINISTRACAO PUBLICA',2)$$);

INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('duas vitimas na mesma ordem', $$
  INSERT INTO processo_vitimas (processo_id, nome, ordem)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001','BELTRANA',1)$$);

-- Processo com vitima nao se apaga: o fato registrado tem de ser tirado antes.
INSERT INTO resultado_integridade (linha) SELECT pg_temp.deve_rejeitar('DELETE de processo que tem vitima', $$
  DELETE FROM processos_procedimentos WHERE id='aaaaaaaa-0000-0000-0000-000000000003'$$);


-- data_inicio 2026-01-10 + 30 dias = 2026-02-09. Regra unica, no schema.
INSERT INTO resultado_integridade (linha)
SELECT CASE WHEN data_vencimento = DATE '2026-02-09'
            THEN 'ok      vencimento = data_inicio + dias                        -> ' || data_vencimento
            ELSE 'FALHOU  vencimento calculado errado                            -> ' || data_vencimento
       END
FROM processo_prazos
WHERE processo_id='aaaaaaaa-0000-0000-0000-000000000001' AND ordem=0;

-- Prorrogacao comeca no dia seguinte ao vencimento anterior: 2026-02-10 + 30 = 2026-03-12.
INSERT INTO resultado_integridade (linha)
SELECT CASE WHEN data_vencimento = DATE '2026-03-12'
            THEN 'ok      prorrogacao encadeada sem lacuna nem sobreposicao      -> ' || data_vencimento
            ELSE 'FALHOU  prorrogacao calculada errado                           -> ' || data_vencimento
       END
FROM processo_prazos
WHERE processo_id='aaaaaaaa-0000-0000-0000-000000000001' AND ordem=1;

SELECT linha FROM resultado_integridade ORDER BY ordem;
