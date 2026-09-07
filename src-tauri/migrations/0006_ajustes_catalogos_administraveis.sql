-- =============================================================================
-- Quatro ajustes nos catálogos administráveis, todos vindos da conferência das
-- telas com o app rodando: campos que o administrador não tem como responder,
-- ou que respondem sempre a mesma coisa.
--
-- O princípio comum às quatro seções é o 2 do §3: nome e texto são
-- apresentação; o que carrega comportamento é atributo semântico. Duas delas
-- trocam texto livre por booleano justamente por isso.
-- =============================================================================


-- ── 1. O dispositivo legal da infração do Estatuto ──────────────────────────
--
-- `infracoes_estatuto.dispositivo_legal_id` é NOT NULL, e as 20 linhas
-- semeadas apontam para o MESMO dispositivo — o Estatuto dos Policiais
-- Militares. Não é coincidência de dado: uma infração do Estatuto é, por
-- definição, do Estatuto. O select no formulário só podia ter uma resposta.
--
-- A coluna fica, porque é ela que monta o rótulo completo ("Art. 29, inciso
-- III - Estatuto dos Policiais Militares - ...") em três consultas de
-- `evidence` e uma de `maps_reports`. O que sai é a PERGUNTA, não o dado.
--
-- Para o backend preencher sozinho sem que "Estatuto" vire literal no código,
-- a linha é marcada por atributo — mesmo recurso de `apuratorio_papeis.
-- e_responsavel` e `apuratorio_documentos_iniciadores.padrao`. O índice único
-- parcial garante que não exista uma segunda marcada; se a Seção um dia
-- renomear o dispositivo, nada quebra, que é o ponto.
ALTER TABLE dispositivos_legais
    ADD COLUMN e_estatuto_militar BOOLEAN NOT NULL DEFAULT false;

-- Pelo id preservado da 0003, nunca por comparação de nome.
UPDATE dispositivos_legais
   SET e_estatuto_militar = true
 WHERE id = 'c3000000-0000-4000-8000-000000000005';

CREATE UNIQUE INDEX uq_dispositivo_estatuto_militar
    ON dispositivos_legais (e_estatuto_militar) WHERE e_estatuto_militar;


-- ── 2. Município × distrito deixa de ser texto livre ────────────────────────
--
-- `tipo` era TEXT NOT NULL sem CHECK — o último lugar do schema onde a
-- natureza de um registro dependia de uma string digitada. E `municipio_pai_id`
-- era opcional para todo mundo, embora só faça sentido para distrito.
--
-- Os dados já dizem a regra: 60 distritos, TODOS com pai; 52 municípios,
-- NENHUM com pai. O que faltava era o banco garanti-la, em vez de confiar em
-- quem preenche o formulário.
ALTER TABLE municipios_distritos ADD COLUMN e_distrito BOOLEAN NOT NULL DEFAULT false;

UPDATE municipios_distritos SET e_distrito = (lower(btrim(tipo)) = 'distrito');

-- O índice único era (lower(nome), tipo): "Bom Futuro" pode existir como
-- distrito e como município, e continua podendo.
DROP INDEX uq_municipios_distritos_nome;
ALTER TABLE municipios_distritos DROP COLUMN tipo;
CREATE UNIQUE INDEX uq_municipios_distritos_nome
    ON municipios_distritos (lower(nome), e_distrito);

ALTER TABLE municipios_distritos ADD CONSTRAINT ck_municipio_distrito_tem_pai
    CHECK ((e_distrito AND municipio_pai_id IS NOT NULL)
        OR (NOT e_distrito AND municipio_pai_id IS NULL));


-- ── 3. A ordem hierárquica dos postos ───────────────────────────────────────
--
-- Decisão do responsável pelo projeto, tomada de olho na consequência: a
-- relação de militares passa a sair em ordem ALFABÉTICA de nome, e não mais
-- de CEL para SD.
--
-- A coluna ordenava em três lugares — `users::list_paginated`,
-- `users::list_encarregados` e a listagem do próprio catálogo —, todos
-- ajustados junto. `circulo_hierarquico_id` fica: agrupa Oficiais e Praças, e
-- isso não é ordenação.
--
-- Reverter exige migration nova e redigitar os 13 valores: o dado se perde
-- aqui, não só a coluna.
ALTER TABLE postos_graduacoes DROP COLUMN ordem_hierarquica;


-- ── 4. As subdivisões de textos normativos ──────────────────────────────────
--
-- Títulos, capítulos e seções de uma norma, para opcionalmente agrupar uma
-- infração penal. Levantado antes de remover: ZERO linhas na tabela, zero no
-- banco legado, as 26 infrações penais com `subdivisao_id` nulo, nenhuma
-- consulta projetando a coluna, nada semeado pela 0003 e nada escrito pela
-- importação. Veio do app anterior, onde também nunca chegou a ser ligada aos
-- artigos.
--
-- O princípio 6 protege catálogo EM USO; este nunca esteve. Um item de menu
-- que não produz efeito visível em lugar nenhum custa mais do que pesa.
ALTER TABLE infracoes_penais DROP COLUMN subdivisao_id;
DROP TABLE subdivisao_textos_normativos;
