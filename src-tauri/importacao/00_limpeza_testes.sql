-- =============================================================================
-- ETAPA 00 — LIMPEZA DOS PROCESSOS DE TESTE
--
-- Primeira etapa DENTRO da transação da migração (o `00_preflight.sql` roda
-- antes dela, e fora). Precisa vir antes da 04: os processos de teste ocupam
-- numeração que os processos reais também usam, e `uq_processo_numero_documento`
-- é parcial `WHERE ativo`. Se sobrarem, o `ON CONFLICT DO NOTHING` da 04
-- descarta o processo REAL em silêncio, e a 05 quebra depois com FK órfã de
-- envolvido — que foi exatamente como este arquivo nasceu.
--
-- O alvo são os 13 processos cadastrados à mão durante o desenvolvimento. A
-- identificação é SEMÂNTICA — processo cujo id não existe no dump legado —, e
-- não uma lista de UUID decorada: a migração preserva o UUID de origem, então
-- "sem contraparte no legado" é a definição de "não veio do sistema anterior".
--
-- Mas semântica sozinha apagaria também um processo real que alguém tivesse
-- cadastrado pela tela nova antes da migração. Por isso a lista dos 13 é
-- conferida contra o que a consulta encontrou: qualquer divergência, para os
-- dois lados, aborta a transação inteira. Acrescentar um processo de teste
-- novo exige acrescentá-lo aqui, de propósito.
--
-- Catálogos NÃO são tocados: o militar de teste 'FULANDO DE TAL' e as naturezas
-- criadas no desenvolvimento continuam onde estão (decisão do plano). E a
-- `auditoria` também não: as 79 linhas atuais são history do app novo, inclusive
-- as 45 que falam dos testes que estão sendo apagados aqui.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh, que roda
-- as etapas numa transação só.
-- =============================================================================

-- O legado guarda `timestamp` SEM fuso, digitado em Ariquemes/RO. Oito colunas
-- do destino são `timestamptz`, e o cast implícito usa o fuso da SESSÃO — que no
-- container é Etc/UTC. Sem isto tudo entraria 4h adiantado, sem erro nenhum.
--
-- Quem define é o orquestrador (`SET LOCAL TimeZone`), num ponto só, e vale para
-- toda a transação. Aqui só se confere: rodar uma etapa solta com a sessão
-- errada tem de falhar, não deslocar o histórico em silêncio.
DO $$
BEGIN
    IF current_setting('TimeZone') <> 'America/Porto_Velho' THEN
        RAISE EXCEPTION
            'fuso da sessão é %, e precisa ser America/Porto_Velho: os timestamps ingênuos do legado seriam convertidos errado. Rode por scripts/migrar_dados_legados.sh.',
            current_setting('TimeZone');
    END IF;
END $$;

CREATE TEMP TABLE tmp_testes ON COMMIT DROP AS
SELECT p.id
  FROM processos_procedimentos p
 WHERE NOT EXISTS (
     SELECT 1 FROM legado.processos_procedimentos l WHERE l.id::uuid = p.id
 );

-- A lista afirmada. Conferida nos dois sentidos logo abaixo.
CREATE TEMP TABLE tmp_testes_esperados (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO tmp_testes_esperados VALUES
    ('5702ee7b-37f5-4eed-9679-af9aa68cb30e'),  -- SR 1, 29/07/2026
    ('7d3e47b4-e471-4f21-8d45-a60a01043c6f'),  -- SR 1, 25/07/2026
    ('a3b0ce0c-c93b-48fc-8eeb-a55410349f07'),  -- PADS 1, 11/08/2026
    ('03ba8b7a-71e8-4e37-874d-bf88e114ef31'),  -- SR 2, 25/08/2026
    ('facb83c1-32c3-4441-b2e2-8f0020f34f5b'),  -- IPM 2, 17/08/2026
    ('fd0f3238-7c20-43f1-b497-581903c5e6d4'),  -- CD 1, 24/08/2026
    ('b614c21c-fcf1-4c13-969e-b19e63cae01c'),  -- PAD 1, 27/08/2026
    ('5ff92162-6c17-44cb-a72d-7d756c2a6b89'),  -- PADS 3, 18/08/2026
    ('61d8fbcb-3e23-46f7-aa7a-b86cce550f43'),  -- IPM 4, 27/08/2026
    ('bbea1b92-6cc1-4d0b-be65-92cfad452a63'),  -- FP 1, 27/08/2026
    ('59b474f8-d592-49ee-b1a8-e2ca55cab72c'),  -- SR 6, 02/08/2026
    ('80e8d926-5f0a-4217-ad72-9d4b9e1f41bf'),  -- SR 1, 20/08/2026
    ('14a1c861-7cef-40d6-8ff9-0366bbfa504b');  -- FP 1, 18/08/2026

DO $$
DECLARE
    sobrando text;
    faltando text;
BEGIN
    SELECT string_agg(id::text, ', ' ORDER BY id::text) INTO sobrando
      FROM (SELECT id FROM tmp_testes EXCEPT SELECT id FROM tmp_testes_esperados) x;
    SELECT string_agg(id::text, ', ' ORDER BY id::text) INTO faltando
      FROM (SELECT id FROM tmp_testes_esperados EXCEPT SELECT id FROM tmp_testes) x;

    IF sobrando IS NOT NULL THEN
        RAISE EXCEPTION
            'limpeza abortada: há processo sem contraparte no legado que NÃO está na lista de teste (%). Cadastrado pela tela nova? Decida antes de migrar.',
            sobrando;
    END IF;
    -- Nenhum dos 13 encontrado: a limpeza já rodou numa execução anterior. Não é
    -- erro — as etapas seguintes são idempotentes e vão apenas reconferir. Só
    -- assusta o estado PARCIAL, em que parte foi apagada e parte não: aí alguém
    -- interrompeu uma migração no meio, e continuar por cima é adivinhação.
    IF faltando IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tmp_testes) THEN
        RAISE NOTICE 'limpeza: os 13 processos de teste já haviam sido removidos; nada a fazer.';
    ELSIF faltando IS NOT NULL THEN
        RAISE EXCEPTION
            'limpeza abortada: estado parcial — processos de teste faltando (%), mas outros ainda presentes. Uma migração anterior foi interrompida; restaure o backup antes de tentar de novo.',
            faltando;
    END IF;
END $$;

-- Ordem das FKs. Todas são ON DELETE RESTRICT, exceto `carta_precatoria_detalhes`
-- (CASCADE, extensão 1:1) e as quatro filhas de `processo_envolvidos` (CASCADE).
-- Por isso basta apagar os envolvidos para levar junto indícios e enquadramentos.
DELETE FROM processo_envolvidos  WHERE processo_id IN (SELECT id FROM tmp_testes);
DELETE FROM processo_prazos      WHERE processo_id IN (SELECT id FROM tmp_testes);
DELETE FROM processo_andamentos  WHERE processo_id IN (SELECT id FROM tmp_testes);
DELETE FROM processo_anexos      WHERE processo_id IN (SELECT id FROM tmp_testes);
DELETE FROM processo_vitimas     WHERE processo_id IN (SELECT id FROM tmp_testes);
DELETE FROM processo_pessoas     WHERE processo_id IN (SELECT id FROM tmp_testes);

-- `processo_designacoes` referencia a si mesma (`designacao_anterior_id`,
-- ON DELETE RESTRICT). Desfazer o elo antes evita depender da ordem em que o
-- Postgres visita as linhas — a cadeia inteira vai embora logo abaixo.
UPDATE processo_designacoes SET designacao_anterior_id = NULL
 WHERE processo_id IN (SELECT id FROM tmp_testes)
   AND designacao_anterior_id IS NOT NULL;
DELETE FROM processo_designacoes WHERE processo_id IN (SELECT id FROM tmp_testes);

DELETE FROM processos_procedimentos WHERE id IN (SELECT id FROM tmp_testes);

-- Nada pode ter sobrado apontando para eles.
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM processos_procedimentos p
     WHERE NOT EXISTS (SELECT 1 FROM legado.processos_procedimentos l WHERE l.id::uuid = p.id);
    IF n <> 0 THEN
        RAISE EXCEPTION 'limpeza incompleta: % processo(s) de teste ainda no destino', n;
    END IF;
END $$;
