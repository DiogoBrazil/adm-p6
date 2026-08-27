-- =============================================================================
-- ETAPA 01 — CATÁLOGOS OPERACIONAIS
--
-- Os catálogos LEGAIS já vieram na migration 0003 (postos, municípios, RDPM,
-- Estatuto, legislação penal). Os OPERACIONAIS nascem vazios de propósito, e é
-- esta etapa que os preenche — derivando tudo de `DISTINCT` sobre o próprio
-- dump. Nenhuma sigla é escrita à mão, com três exceções justificadas:
--
--   1. `apuratorios.codigo_extensao` — é CÓDIGO TÉCNICO, o único do schema
--      (ver §5.3 do REFATORACAO-MODELO-DADOS.md). Acrescentar uma extensão de
--      formulário é mudança de código, então a ligação sigla -> extensão tem
--      de ser afirmada uma vez, aqui.
--   2. `legado.map_papeis` — o dump guarda o papel em NOME DE COLUNA
--      (responsavel_id, escrivao_id...), não em texto. A tradução coluna ->
--      papel é declarada uma vez e reusada pelas etapas 02 e 06. Mora dentro
--      do schema `legado` de propósito: some junto com ele no fim.
--   3. `papeis_pessoa` — o inquirido está numa coluna do legado
--      (`pessoas_inquiridas`), sem rótulo nenhum. A vítima NÃO passa por aqui:
--      desde a 0012 ela é `processo_vitimas`, relação própria do procedimento,
--      sem papel de catálogo.
--
-- Roda em transação única.
-- =============================================================================
BEGIN;

-- --------------------------------------------------------------- exceção 2 ---
-- A tradução "coluna de papel do legado" -> "papel do processo".
--
-- `prioridade_responsavel` resolve QUEM responde pelo apuratório sem que a
-- etapa 02 precise de uma lista de siglas. O legado expressava a chefia da
-- apuração em duas colunas mutuamente exclusivas: `responsavel_id` nos
-- procedimentos e nos PADS/PADE, `presidente_id` no PAD/CD/CJ. A etapa 02
-- marca `e_responsavel` no papel de MENOR prioridade que a espécie usa; os
-- demais papéis ficam NULL e nunca disputam.
DROP VIEW  IF EXISTS legado.v_ocupacoes;
DROP TABLE IF EXISTS legado.map_papeis;
CREATE TABLE legado.map_papeis (
    coluna                 text PRIMARY KEY,
    papel                  text NOT NULL,
    prioridade_responsavel int  NULL
);
INSERT INTO legado.map_papeis VALUES
    ('responsavel_id',       'Encarregado',  1),
    ('presidente_id',        'Presidente',   2),
    ('escrivao_id',          'Escrivão',     NULL),
    ('escrivao_processo_id', 'Escrivão',     NULL),
    ('interrogante_id',      'Interrogante', NULL);

-- Uma linha por (processo, papel ocupado). Base das etapas 02 e 06.
CREATE VIEW legado.v_ocupacoes AS
SELECT l.id AS processo_id, l.tipo_detalhe, l.data_instauracao, o.coluna, m.papel, o.pm_id
  FROM legado.processos_procedimentos l
  CROSS JOIN LATERAL (VALUES
      ('responsavel_id',       l.responsavel_id),
      ('escrivao_id',          l.escrivao_id),
      ('escrivao_processo_id', l.escrivao_processo_id),
      ('presidente_id',        l.presidente_id),
      ('interrogante_id',      l.interrogante_id)
  ) AS o(coluna, pm_id)
  JOIN legado.map_papeis m ON m.coluna = o.coluna
 WHERE o.pm_id IS NOT NULL;

-- Total de processos por espécie — a etapa 02 usa para saber se um papel está
-- preenchido em 100% deles (e portanto é obrigatório).
DROP VIEW IF EXISTS legado.v_total_por_especie;
CREATE VIEW legado.v_total_por_especie AS
SELECT tipo_detalhe, count(*) AS total
  FROM legado.processos_procedimentos GROUP BY tipo_detalhe;

-- -------------------------------------------------------- tipos_apuratorio ---
-- Os dois tipos, direto do que o legado já classificava.
INSERT INTO tipos_apuratorio (nome)
SELECT DISTINCT initcap(tipo_geral) FROM legado.processos_procedimentos
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------- apuratorios --
-- Uma espécie por (tipo_geral, tipo_detalhe). Todos os atributos semânticos
-- saem do dado:
--
--   prazo_base_dias     : o prazo inicial MAIS PRATICADO daquela espécie nos
--                         44 prazos registrados (IPM 40, SR 30, PADS 30,
--                         SV 15 — cada um unânime). As 6 espécies sem prazo
--                         registrado ficam com 30, e o administrador ajusta.
--   max_envolvidos      : vem do TIPO (decisão 13) — procedimento apura um
--                         fato e alcança quantos alcançar; processo
--                         disciplinar é instaurado contra UM militar.
--   exige_natureza_fato : NÃO é "tipo_geral = procedimento". É derivado: a
--                         espécie exige rubrica se TODOS os seus processos a
--                         têm. Dá true em FP/IPM/SR/SV e false em CP e nos 5
--                         disciplinares — a CP realmente não tem rubrica.
INSERT INTO apuratorios (sigla, nome, tipo_apuratorio_id, prazo_base_dias,
                         max_envolvidos, exige_natureza_fato, codigo_extensao,
                         permite_acusacao, permite_acusacao_penal,
                         permite_indicios, permite_solucao_sugerida)
SELECT e.tipo_detalhe,
       e.tipo_detalhe,                       -- nome por extenso: revisar na tela
       ta.id,
       COALESCE(pz.dias_praticados, 30),
       CASE WHEN e.tipo_geral = 'processo' THEN 1 ELSE NULL END,
       e.todos_tem_natureza,
       -- exceção 1: código técnico, não sigla de apresentação
       CASE WHEN e.tipo_detalhe = 'CP' THEN 'carta_precatoria' END,
       upper(e.tipo_detalhe) IN ('PADS', 'CD', 'CJ', 'PAD'),
       upper(e.tipo_detalhe) IN ('CD', 'CJ', 'PAD'),
       e.tipo_geral = 'procedimento',
       e.tipo_geral = 'procedimento'
  FROM (
      SELECT tipo_geral,
             tipo_detalhe,
             bool_and(natureza_procedimento IS NOT NULL) AS todos_tem_natureza
        FROM legado.processos_procedimentos
       GROUP BY tipo_geral, tipo_detalhe
  ) e
  JOIN tipos_apuratorio ta ON lower(ta.nome) = lower(e.tipo_geral)
  LEFT JOIN (
      SELECT l.tipo_detalhe,
             mode() WITHIN GROUP (ORDER BY z.dias_adicionados) AS dias_praticados
        FROM legado.prazos_processo z
        JOIN legado.processos_procedimentos l ON l.id = z.processo_id
       WHERE COALESCE(z.ordem_prorrogacao, 0) = 0
       GROUP BY l.tipo_detalhe
  ) pz ON pz.tipo_detalhe = e.tipo_detalhe
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------- tipos_documento --
INSERT INTO tipos_documento (nome)
SELECT DISTINCT documento_iniciador FROM legado.processos_procedimentos
 WHERE documento_iniciador IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------- unidades_pm ---
-- Decisão 15: CORREGEPOM, 9ºBPM e 11ºBPM são unidades de verdade, porque a
-- numeração é única POR UNIDADE. E não basta `local_origem`: as 3 cartas
-- precatórias deprecam 8ºBPM e 10ºBPM, e `unidade_deprecada_id` é NOT NULL.
-- Por isso a união das duas colunas — são 6, não 4.
--
-- `municipio_id` é o município mais frequente entre os fatos apurados por
-- aquela unidade. Fica NULL nas duas que só aparecem como deprecadas: não há
-- dado, e inventar sede seria pior que deixar o administrador preencher.
INSERT INTO unidades_pm (nome, municipio_id)
SELECT u.nome, mu.id
  FROM (
      SELECT DISTINCT local_origem AS nome FROM legado.processos_procedimentos
       WHERE local_origem IS NOT NULL
      UNION
      SELECT DISTINCT unidade_deprecada FROM legado.processos_procedimentos
       WHERE unidade_deprecada IS NOT NULL
      UNION
      -- O catálogo `locais_origem` do legado nunca foi usado por processo
      -- nenhum (0 de 128, em 8 anos): é seed de demonstração do app antigo.
      -- Mas são unidades reais da PMRO, e entram como OPÇÃO disponível para
      -- que o usuário não precise digitá-las quando aparecerem.
      -- CORREGEDORIA fica de fora: é a mesma unidade que CORREGEPOM, que já
      -- entrou pelos 16 processos reais dela.
      -- O espaço de '1º BPM' é removido para casar com a grafia das que estão
      -- em uso ('7ºBPM'); é rótulo de exibição, editável na tela de catálogos.
      SELECT DISTINCT replace(codigo, 'º ', 'º') FROM legado.locais_origem
       WHERE codigo <> 'CORREGEDORIA'
  ) u
  LEFT JOIN LATERAL (
      SELECT mode() WITHIN GROUP (
                 ORDER BY regexp_replace(l.local_fatos, '\s*\([^)]*\)\s*$', '')
             ) AS nome
        FROM legado.processos_procedimentos l
       WHERE l.local_origem = u.nome AND l.local_fatos IS NOT NULL
  ) sede ON true
  LEFT JOIN municipios_distritos mu ON lower(mu.nome) = lower(sede.nome)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------- naturezas_fato --
-- `exige_condutor` é o atributo semântico que substituiu o
-- `natureza.includes('sinistro de trânsito')` do JavaScript legado.
INSERT INTO naturezas_fato (nome, exige_condutor)
SELECT DISTINCT natureza_procedimento,
       natureza_procedimento ILIKE '%sinistro de tr_nsito%'
  FROM legado.processos_procedimentos
 WHERE natureza_procedimento IS NOT NULL
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------- status_envolvido --
-- Das duas fontes: a tabela de envolvidos e a coluna do processo (os 37 que o
-- legado guardava assim — decisão 14).
INSERT INTO status_envolvido (nome)
SELECT DISTINCT status_pm FROM legado.procedimento_pms_envolvidos WHERE status_pm IS NOT NULL
UNION
SELECT DISTINCT status_pm FROM legado.processos_procedimentos     WHERE status_pm IS NOT NULL
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------- soluções --
-- Decisão 3: o encarregado SUGERE, a autoridade DECIDE. O prefixo
-- `Sugerido_` do legado é o que separa os dois catálogos.
INSERT INTO tipos_solucao_sugerida (nome)
SELECT DISTINCT replace(substr(solucao_tipo, 10), '_', ' ')
  FROM legado.processos_procedimentos WHERE solucao_tipo LIKE 'Sugerido\_%'
ON CONFLICT DO NOTHING;

-- `permite_penalidade` sai do dado: é a decisão sob a qual o legado
-- efetivamente registrou penalidade. Substitui o `solucao_tipo == "Punido"`.
INSERT INTO tipos_solucao_decidida (nome, permite_penalidade)
SELECT solucao_tipo, bool_or(penalidade_tipo IS NOT NULL)
  FROM legado.processos_procedimentos
 WHERE solucao_tipo IS NOT NULL AND solucao_tipo NOT LIKE 'Sugerido\_%'
 GROUP BY solucao_tipo
ON CONFLICT DO NOTHING;

-- `usa_quantidade_dias` só onde o legado registrou dias (Prisão e Detenção).
INSERT INTO tipos_penalidade (nome, usa_quantidade_dias)
SELECT replace(penalidade_tipo, '_', ' '),
       bool_or(penalidade_dias IS NOT NULL)
  FROM legado.processos_procedimentos
 WHERE penalidade_tipo IS NOT NULL
 GROUP BY penalidade_tipo
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------- papeis_processo --
INSERT INTO papeis_processo (nome)
SELECT DISTINCT papel FROM legado.v_ocupacoes
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------ papeis_pessoa --
-- Exceção 3: o legado não rotula. O inquirido vem de `pessoas_inquiridas` — e
-- só entra se houver dado. A vítima não aparece mais aqui: a etapa 05 a grava
-- em `processo_vitimas`, que não tem papel (migration 0012).
INSERT INTO papeis_pessoa (nome)
SELECT 'Pessoa Inquirida'
 WHERE EXISTS (SELECT 1 FROM legado.processos_procedimentos WHERE pessoas_inquiridas IS NOT NULL)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------- categorias_indicio --
-- `indica_ausencia` é derivado da ESTRUTURA, não do nome: é a categoria sob a
-- qual nunca há crime, transgressão ou infração estatutária pendurada. Assim
-- a regra não depende de alguém ter escrito "Não houve" no rótulo.
INSERT INTO categorias_indicio (nome, indica_ausencia)
SELECT c.nome,
       NOT EXISTS (
           SELECT 1 FROM legado.pm_envolvido_indicios i
            WHERE i.categorias_indicios ? c.nome
              AND (EXISTS (SELECT 1 FROM legado.pm_envolvido_crimes x WHERE x.pm_indicios_id = i.id)
                OR EXISTS (SELECT 1 FROM legado.pm_envolvido_rdpm   x WHERE x.pm_indicios_id = i.id)
                OR EXISTS (SELECT 1 FROM legado.pm_envolvido_art29  x WHERE x.pm_indicios_id = i.id))
       )
  FROM (SELECT DISTINCT jsonb_array_elements_text(categorias_indicios) AS nome
          FROM legado.pm_envolvido_indicios) c
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------ perfis_acesso --
-- O seed 0002 já criou o perfil que ADMINISTRA. Falta o que não administra —
-- o legado tem contas com perfil 'comum'. A resolução na etapa 03 é pelo
-- atributo `pode_administrar`, nunca pelo nome.
INSERT INTO perfis_acesso (nome, pode_administrar)
SELECT DISTINCT initcap(perfil), false
  FROM legado.usuarios
 WHERE perfil IS NOT NULL AND perfil <> 'admin'
ON CONFLICT DO NOTHING;

-- `tipos_andamento` fica VAZIO de propósito: o jsonb `andamentos` do legado
-- guarda {id, data, texto, usuario} e nunca teve tipo. Inventar um seria
-- afirmar o que o dado não diz. `tipo_andamento_id` é anulável exatamente
-- para isso.

COMMIT;
