BEGIN;
DROP SCHEMA IF EXISTS amostra CASCADE;
CREATE SCHEMA amostra;

CREATE TEMP TABLE escolhidos(id text);
INSERT INTO escolhidos VALUES
  ('ec07f120-e4c5-4337-b628-592c5859339c'),  -- IPM 1    : 8 prorrogações
  ('f2857757-ad85-40e3-8bc1-a3a27e2b9cc3'),  -- IPM 3    : prazos + troca no mesmo dia
  ('10b39de3-fad8-4e93-9cea-7b2027118253'),  -- IPM 8    : 9 envolvidos + troca no mesmo dia
  ('b0294d82-4d35-46d4-a10f-2bd2b555d462'),  -- IPM 1/P6 : o anexo
  ('980f1a82-3771-4193-b43b-37a09eadf0c5'),  -- SR 20    : 3 trocas no mesmo dia
  ('b5d79aa8-faca-4d2f-9cca-987cd453f80b'),  -- SR 2     : condutor + art. 29
  ('ef7a9b08-5f4a-4a43-96dc-0d4666f00914'),  -- SR 5     : art. 29 (2) + prazos
  ('22ce21be-aa00-42b5-98cd-65e1d328ba4e'),  -- PADS 1   : penalidade, sem envolvido
  ('6b1f19a8-4ab8-4ecc-b596-27480bf9e017'),  -- CP 1     : carta precatória
  ('06d1dd69-ad23-490a-9492-80670ba3bae8'),  -- IPM 9    : 4 transgressões RDPM + 4 crimes
  ('5e060c66-74be-407e-b176-7a8376e23653'),  -- SR 1     : RDPM + crimes das duas esferas
  ('cb22e21b-72d3-43db-a379-24fb1261bc01');  -- PADS 7   : 8 vínculos em transgressoes_ids,
                                             --            RDPM e Estatuto com analogia

-- As espécies raras entram INTEIRAS (CD 2, CJ 1, PAD 1, PADE 1, SV 3, FP 7):
-- são poucas linhas e sem elas a etapa 02 não derivaria Presidente,
-- Interrogante nem o prazo do Feito Preliminar.
INSERT INTO escolhidos
SELECT id FROM legado.processos_procedimentos
 WHERE tipo_detalhe IN ('CD','CJ','PAD','PADE','SV','FP')
   AND id NOT IN (SELECT id FROM escolhidos);

-- catálogos e pessoas: pequenos, entram inteiros
CREATE TABLE amostra.usuarios              AS SELECT * FROM legado.usuarios;
CREATE TABLE amostra.postos_graduacoes     AS SELECT * FROM legado.postos_graduacoes;
CREATE TABLE amostra.municipios_distritos  AS SELECT * FROM legado.municipios_distritos;
CREATE TABLE amostra.crimes_contravencoes  AS SELECT * FROM legado.crimes_contravencoes;
CREATE TABLE amostra.infracoes_estatuto_art29 AS SELECT * FROM legado.infracoes_estatuto_art29;
CREATE TABLE amostra.transgressoes         AS SELECT * FROM legado.transgressoes;
-- catálogo órfão do legado (0 usos), do qual a etapa 01 semeia 5 unidades
CREATE TABLE amostra.locais_origem         AS SELECT * FROM legado.locais_origem;

-- o recorte
CREATE TABLE amostra.processos_procedimentos AS
SELECT * FROM legado.processos_procedimentos WHERE id IN (SELECT id FROM escolhidos);

-- O anexo real tem 20 MB. A fixture guarda só o começo do arquivo: o teste
-- afirma que o anexo EXISTE com nome e mime corretos, não os bytes.
UPDATE amostra.processos_procedimentos
   SET pdf_arquivo = substring(pdf_arquivo FROM 1 FOR 512)
 WHERE pdf_arquivo IS NOT NULL;

CREATE TABLE amostra.procedimento_pms_envolvidos AS
SELECT * FROM legado.procedimento_pms_envolvidos WHERE procedimento_id IN (SELECT id FROM escolhidos);
CREATE TABLE amostra.prazos_processo AS
SELECT * FROM legado.prazos_processo WHERE processo_id IN (SELECT id FROM escolhidos);
CREATE TABLE amostra.pm_envolvido_indicios AS
SELECT * FROM legado.pm_envolvido_indicios WHERE procedimento_id IN (SELECT id FROM escolhidos);
CREATE TABLE amostra.pm_envolvido_crimes AS
SELECT * FROM legado.pm_envolvido_crimes WHERE pm_indicios_id IN (SELECT id FROM amostra.pm_envolvido_indicios);
CREATE TABLE amostra.pm_envolvido_rdpm AS
SELECT * FROM legado.pm_envolvido_rdpm  WHERE pm_indicios_id IN (SELECT id FROM amostra.pm_envolvido_indicios);
CREATE TABLE amostra.pm_envolvido_art29 AS
SELECT * FROM legado.pm_envolvido_art29 WHERE pm_indicios_id IN (SELECT id FROM amostra.pm_envolvido_indicios);

COMMIT;
