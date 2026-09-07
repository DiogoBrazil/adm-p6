-- A trilha de auditoria falava a língua do banco, não a de quem opera a Seção.
--
-- Uma linha dizia `processos_procedimentos`, `UPDATE` e
-- `bbea1b92-6cc1-4d0b-be65-92cfad452a63`: nome de tabela, verbo de SQL e um
-- UUID. Três problemas, e só o primeiro é de redação:
--
-- 1. `UPDATE` não diz QUAL atualização foi. Reabrir um apuratório, registrar a
--    conclusão, corrigir as datas do fluxo e editar o cadastro gravavam todos o
--    mesmo `UPDATE` em `processos_procedimentos`. A informação não existia no
--    banco — nenhuma tela conseguiria recuperá-la depois.
--
-- 2. O que é apagado de verdade fica órfão. `processo_prazos` e
--    `processo_designacoes` são `DELETE FROM`, e aí o `registro_id` aponta para
--    nada. Eram 7 dos 8 prazos e 2 das 6 designações já sem identificação —
--    justamente a exclusão, que é o que mais importa numa trilha.
--
-- 3. Quem lê não conhece o schema. "Sobre o quê" tem de ser `IPM nº
--    1/2026/7ºBPM`, não a chave primária da linha.
--
-- Daí as duas colunas. Elas nascem preenchidas pelo comando que executou a
-- ação, no momento em que ela aconteceu — que é o único instante em que as duas
-- informações existem ao mesmo tempo: o comando sabe que aquele `UPDATE` foi um
-- *reabrir*, e a linha referida ainda está lá para ser nomeada.
--
-- Guardar `assunto` duplica um rótulo que também vive na tabela de origem, e
-- isso contraria o princípio 4 à primeira vista. É a mesma justificativa de
-- `mapas_salvos.dados_mapa`, declarada na 0001: SNAPSHOT IMUTÁVEL de um fato já
-- ocorrido. Recalcular por junção devolveria outra coisa — o número corrigido
-- em 2027 reescreveria o que a trilha registrou em 2026 — ou coisa nenhuma,
-- quando a linha foi apagada. Auditoria é fato registrado, e fato registrado
-- não se recalcula (princípio 5).
ALTER TABLE auditoria ADD COLUMN acao    TEXT NULL;
ALTER TABLE auditoria ADD COLUMN assunto TEXT NULL;

COMMENT ON COLUMN auditoria.acao IS
    'O que foi feito, em frase curta no passado: "Reabriu o apuratório". '
    'Escrita pelo comando, porque só ele distingue duas ações que gravam a '
    'mesma operacao.';
COMMENT ON COLUMN auditoria.assunto IS
    'Sobre o quê, como o registro se chamava NO MOMENTO da ação. Snapshot: não '
    'se recalcula por junção, e sobrevive à exclusão da linha referida.';

-- ── Os registros que já existem ───────────────────────────────────────────────
--
-- Anuláveis porque o que foi gravado antes desta migration não tem como ganhar
-- a frase exata. O que dá para reconstruir, reconstrói-se aqui; o resto fica
-- NULL e a tela escreve que o registro já foi removido.
--
-- `acao` sai de um mapa de (entidade, operacao) — a frase genérica, sem a
-- precisão que só o comando teria.
UPDATE auditoria SET acao = CASE
    WHEN entidade = 'processos_procedimentos' AND operacao = 'CREATE' THEN 'Cadastrou o apuratório'
    WHEN entidade = 'processos_procedimentos' AND operacao = 'UPDATE' THEN 'Alterou o apuratório'
    WHEN entidade = 'processos_procedimentos' AND operacao = 'DELETE' THEN 'Excluiu o apuratório'
    WHEN entidade = 'processo_envolvidos'     THEN 'Alterou um envolvido'
    WHEN entidade = 'processo_designacoes'    AND operacao = 'CREATE' THEN 'Substituiu uma designação'
    WHEN entidade = 'processo_designacoes'    AND operacao = 'UPDATE' THEN 'Alterou uma designação'
    WHEN entidade = 'processo_designacoes'    AND operacao = 'DELETE' THEN 'Removeu uma substituição de designação'
    WHEN entidade = 'processo_prazos'         AND operacao = 'CREATE' THEN 'Registrou uma prorrogação de prazo'
    WHEN entidade = 'processo_prazos'         AND operacao = 'UPDATE' THEN 'Alterou uma prorrogação de prazo'
    WHEN entidade = 'processo_prazos'         AND operacao = 'DELETE' THEN 'Removeu uma prorrogação de prazo'
    WHEN entidade = 'processo_andamentos'     AND operacao = 'CREATE' THEN 'Registrou um andamento'
    WHEN entidade = 'processo_andamentos'     AND operacao = 'UPDATE' THEN 'Alterou um andamento'
    WHEN entidade = 'processo_andamentos'     AND operacao = 'DELETE' THEN 'Cancelou um andamento'
    WHEN entidade = 'processo_anexos'         AND operacao = 'CREATE' THEN 'Anexou um arquivo'
    WHEN entidade = 'processo_anexos'         AND operacao = 'DELETE' THEN 'Removeu um anexo'
    WHEN entidade = 'policiais_militares'     AND operacao = 'CREATE' THEN 'Cadastrou o militar'
    WHEN entidade = 'policiais_militares'     AND operacao = 'UPDATE' THEN 'Alterou o militar'
    WHEN entidade = 'policiais_militares'     AND operacao = 'DELETE' THEN 'Desativou o militar'
    WHEN entidade = 'mapas_salvos'            AND operacao = 'CREATE' THEN 'Salvou um mapa'
    WHEN entidade = 'mapas_salvos'            AND operacao = 'DELETE' THEN 'Excluiu um mapa salvo'
    WHEN operacao = 'CREATE' THEN 'Cadastrou um item de catálogo'
    WHEN operacao = 'UPDATE' THEN 'Alterou um item de catálogo'
    ELSE 'Excluiu um item de catálogo'
END
WHERE acao IS NULL;

-- `assunto` sai da junção com a tabela de origem, e por isso só alcança o que
-- ainda existe. Os apagados de verdade ficam NULL — não há de onde tirá-los, e
-- é essa perda que as colunas passam a evitar daqui para frente.
--
-- Os cinco filhos de apuratório são nomeados pelo PAI: "removeu uma prorrogação
-- de prazo — IPM nº 1/2026" é o que se quer ler, e o UUID do prazo não diz nada
-- a ninguém. Vale também para os que já estão soft-deleted: a leitura de
-- registro existente não filtra `ativo` (princípio 6).
UPDATE auditoria a SET assunto = v.rotulo
  FROM v_processos_detalhados v
 WHERE a.assunto IS NULL AND a.entidade = 'processos_procedimentos'
   AND v.id::text = a.registro_id;

UPDATE auditoria a SET assunto = v.rotulo
  FROM processo_envolvidos e JOIN v_processos_detalhados v ON v.id = e.processo_id
 WHERE a.assunto IS NULL AND a.entidade = 'processo_envolvidos'
   AND e.id::text = a.registro_id;

UPDATE auditoria a SET assunto = v.rotulo
  FROM processo_designacoes d JOIN v_processos_detalhados v ON v.id = d.processo_id
 WHERE a.assunto IS NULL AND a.entidade = 'processo_designacoes'
   AND d.id::text = a.registro_id;

UPDATE auditoria a SET assunto = v.rotulo
  FROM processo_prazos p JOIN v_processos_detalhados v ON v.id = p.processo_id
 WHERE a.assunto IS NULL AND a.entidade = 'processo_prazos'
   AND p.id::text = a.registro_id;

UPDATE auditoria a SET assunto = v.rotulo
  FROM processo_andamentos m JOIN v_processos_detalhados v ON v.id = m.processo_id
 WHERE a.assunto IS NULL AND a.entidade = 'processo_andamentos'
   AND m.id::text = a.registro_id;

UPDATE auditoria a SET assunto = v.rotulo
  FROM processo_anexos x JOIN v_processos_detalhados v ON v.id = x.processo_id
 WHERE a.assunto IS NULL AND a.entidade = 'processo_anexos'
   AND x.id::text = a.registro_id;

UPDATE auditoria a SET assunto = pg.sigla || ' ' || pm.matricula || ' ' || pm.nome
  FROM policiais_militares pm JOIN postos_graduacoes pg ON pg.id = pm.posto_graduacao_id
 WHERE a.assunto IS NULL AND a.entidade = 'policiais_militares'
   AND pm.id::text = a.registro_id;

UPDATE auditoria a SET assunto = m.titulo
  FROM mapas_salvos m
 WHERE a.assunto IS NULL AND a.entidade = 'mapas_salvos'
   AND m.id::text = a.registro_id;

-- Os catálogos administráveis. `nome` cobre a maioria; `apuratorios` e
-- `postos_graduacoes` são reconhecidos pela sigla, e os catálogos jurídicos
-- ficam de fora deste retrocesso — o rótulo deles se compõe com junções, e daqui
-- para frente quem o monta é `Catalogo::assunto_sql`.
UPDATE auditoria a SET assunto = c.sigla || ' - ' || c.nome
  FROM apuratorios c
 WHERE a.assunto IS NULL AND a.entidade = 'apuratorios' AND c.id::text = a.registro_id;

UPDATE auditoria a SET assunto = c.sigla || ' - ' || c.nome
  FROM postos_graduacoes c
 WHERE a.assunto IS NULL AND a.entidade = 'postos_graduacoes' AND c.id::text = a.registro_id;

UPDATE auditoria a SET assunto = c.nome FROM tipos_apuratorio c
 WHERE a.assunto IS NULL AND a.entidade = 'tipos_apuratorio' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM tipos_documento c
 WHERE a.assunto IS NULL AND a.entidade = 'tipos_documento' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM papeis_processo c
 WHERE a.assunto IS NULL AND a.entidade = 'papeis_processo' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM naturezas_transgressao c
 WHERE a.assunto IS NULL AND a.entidade = 'naturezas_transgressao' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM naturezas_fato c
 WHERE a.assunto IS NULL AND a.entidade = 'naturezas_fato' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM status_envolvido c
 WHERE a.assunto IS NULL AND a.entidade = 'status_envolvido' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM tipos_solucao_sugerida c
 WHERE a.assunto IS NULL AND a.entidade = 'tipos_solucao_sugerida' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM tipos_solucao_decidida c
 WHERE a.assunto IS NULL AND a.entidade = 'tipos_solucao_decidida' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM tipos_penalidade c
 WHERE a.assunto IS NULL AND a.entidade = 'tipos_penalidade' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM categorias_indicio c
 WHERE a.assunto IS NULL AND a.entidade = 'categorias_indicio' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM esferas_penais c
 WHERE a.assunto IS NULL AND a.entidade = 'esferas_penais' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM especies_infracao_penal c
 WHERE a.assunto IS NULL AND a.entidade = 'especies_infracao_penal' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM dispositivos_legais c
 WHERE a.assunto IS NULL AND a.entidade = 'dispositivos_legais' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM tipos_andamento c
 WHERE a.assunto IS NULL AND a.entidade = 'tipos_andamento' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM papeis_pessoa c
 WHERE a.assunto IS NULL AND a.entidade = 'papeis_pessoa' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM municipios_distritos c
 WHERE a.assunto IS NULL AND a.entidade = 'municipios_distritos' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM unidades_pm c
 WHERE a.assunto IS NULL AND a.entidade = 'unidades_pm' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM circulos_hierarquicos c
 WHERE a.assunto IS NULL AND a.entidade = 'circulos_hierarquicos' AND c.id::text = a.registro_id;
UPDATE auditoria a SET assunto = c.nome FROM perfis_acesso c
 WHERE a.assunto IS NULL AND a.entidade = 'perfis_acesso' AND c.id::text = a.registro_id;

-- Subunidade só se identifica com a unidade à frente, como em `formatarOrigem`.
UPDATE auditoria a SET assunto = u.nome || ' / ' || s.nome
  FROM subunidades_secoes s JOIN unidades_pm u ON u.id = s.unidade_pm_id
 WHERE a.assunto IS NULL AND a.entidade = 'subunidades_secoes' AND s.id::text = a.registro_id;
