-- =============================================================================
-- ETAPA 02 — CONFIGURAÇÃO DO APURATÓRIO
--
-- Sem esta etapa NENHUM processo pode existir: `processos_procedimentos` tem
-- uma FK COMPOSTA (apuratorio_id, documento_iniciador_id) apontando para
-- `apuratorio_documentos_iniciadores`, e `processo_designacoes` tem outra
-- apontando para `apuratorio_papeis`. O banco recusa qualquer par que o
-- administrador não tenha cadastrado — e aqui o "administrador" é o histórico.
--
-- Tudo é derivado do que o legado EFETIVAMENTE praticou. Nenhuma lista de
-- siglas: "escrivão só em IPM" e "PAD/CD/CJ não têm encarregado" deixam de ser
-- literais no código e passam a ser linhas de configuração, como manda o §3.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh, que roda
-- as oito etapas numa transação só. Um `BEGIN;`/`COMMIT;` aqui dentro encerraria
-- a transação externa no meio, e o resto da carga correria em autocommit — sem
-- erro nenhum, e sem o tudo-ou-nada que a migração exige.
-- =============================================================================

-- ------------------------------------ apuratorio_documentos_iniciadores ------
-- Um par por (espécie, documento) observado. Cada espécie do legado usou um
-- documento só, então o único par de cada uma é também o `padrao`.
--
-- `prazo_base_dias` no par é o que substitui o
-- `if documento_iniciador == "Feito Preliminar" { 15 }` do código legado.
-- É a ÚNICA constante desta etapa que não sai do dump: nenhum Feito Preliminar
-- chegou a ter prazo registrado, então o valor vem da regra que o sistema
-- anterior carregava. Fica no par, e não no apuratório, porque é o documento
-- que a impõe. NULL nos demais = herda `apuratorios.prazo_base_dias`.
INSERT INTO apuratorio_documentos_iniciadores
    (apuratorio_id, tipo_documento_id, prazo_base_dias, padrao)
SELECT a.id,
       td.id,
       CASE WHEN par.documento_iniciador = 'Feito Preliminar' THEN 15 END,
       par.usos = max(par.usos) OVER (PARTITION BY a.id)
  FROM (
      SELECT tipo_detalhe, documento_iniciador, count(*) AS usos
        FROM legado.processos_procedimentos
       GROUP BY tipo_detalhe, documento_iniciador
  ) par
  JOIN apuratorios     a  ON lower(a.sigla) = lower(par.tipo_detalhe)
  JOIN tipos_documento td ON lower(td.nome) = lower(par.documento_iniciador)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------- apuratorio_papeis ---
--   obrigatorio   : o papel está preenchido em 100% dos processos da espécie.
--                   Se o legado sempre designou, o sistema novo passa a exigir.
--   max_ocupantes : o máximo de ocupantes simultâneos que a espécie chegou a
--                   ter naquele papel (medido: é 1 em todos).
--   e_responsavel : o papel de menor `prioridade_responsavel` que a espécie
--                   usa — Encarregado onde há `responsavel_id`, Presidente
--                   onde só há `presidente_id`. Substitui a coluna
--                   `responsavel_id` fixa e permite renomear "Encarregado"
--                   sem quebrar dashboard, relatório nem listagem.
INSERT INTO apuratorio_papeis
    (apuratorio_id, papel_id, obrigatorio, max_ocupantes, e_responsavel)
SELECT a.id,
       pp.id,
       uso.processos_com_papel = tot.total,
       uso.max_simultaneos,
       uso.prioridade IS NOT NULL
           AND uso.prioridade = min(uso.prioridade) OVER (PARTITION BY uso.tipo_detalhe)
  FROM (
      SELECT o.tipo_detalhe,
             o.papel,
             count(DISTINCT o.processo_id) AS processos_com_papel,
             max(o.ocupantes)              AS max_simultaneos,
             min(m.prioridade_responsavel) AS prioridade
        FROM (
            SELECT tipo_detalhe, processo_id, papel, count(*) AS ocupantes
              FROM legado.v_ocupacoes GROUP BY tipo_detalhe, processo_id, papel
        ) o
        JOIN legado.map_papeis m ON m.papel = o.papel
       GROUP BY o.tipo_detalhe, o.papel
  ) uso
  JOIN legado.v_total_por_especie tot ON tot.tipo_detalhe = uso.tipo_detalhe
  JOIN apuratorios     a  ON lower(a.sigla) = lower(uso.tipo_detalhe)
  JOIN papeis_processo pp ON lower(pp.nome) = lower(uso.papel)
ON CONFLICT DO NOTHING;

