-- =============================================================================
-- ETAPA 08 — ENQUADRAMENTO POR ENVOLVIDO E O ÚNICO ANEXO
--
-- As 5 tabelas `pm_envolvido_*` do legado viram 3, todas penduradas em
-- `processo_envolvidos.id`. Assim o PostgreSQL garante que só recebe
-- enquadramento quem realmente é envolvido daquele processo — antes, as 5
-- carregavam o par (processo, envolvido) separadamente, sem nada impedindo a
-- combinação inexistente.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh, que roda
-- as oito etapas numa transação só. Um `BEGIN;`/`COMMIT;` aqui dentro encerraria
-- a transação externa no meio, e o resto da carga correria em autocommit — sem
-- erro nenhum, e sem o tudo-ou-nada que a migração exige.
-- =============================================================================

-- ------------------------------------------- envolvido_categorias_indicio ----
-- `categorias_indicios` é array JSON: 27 registros, alguns com 2 categorias — 35
-- vínculos ao todo.
INSERT INTO envolvido_categorias_indicio (envolvido_id, categoria_indicio_id, created_at)
SELECT i.pm_envolvido_id::uuid, ci.id, i.created_at
  FROM legado.pm_envolvido_indicios i
  JOIN processo_envolvidos e ON e.id = i.pm_envolvido_id::uuid
  CROSS JOIN LATERAL jsonb_array_elements_text(i.categorias_indicios) AS c(nome)
  JOIN categorias_indicio ci ON lower(ci.nome) = lower(c.nome)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------- envolvido_infracoes_penais ---
-- UMA tabela no lugar de pm_envolvido_crimes_militares e _comuns.
--
-- A ESFERA é a única inferência desta importação. Pelo art. 9º do CPM a mesma
-- conduta pode ser crime militar ou comum conforme as circunstâncias do fato,
-- então a esfera é atributo do VÍNCULO (decisão 4) e daqui em diante é
-- escolhida no vínculo. O legado não a registrava: guardava só o artigo. A
-- única pista disponível é o dispositivo em que o artigo está — Código Penal
-- Militar -> Militar; Código Penal e Lei de Contravenções Penais -> Comum.
-- Vale registrar que é inferência, e não dado.
INSERT INTO envolvido_infracoes_penais (envolvido_id, infracao_penal_id, esfera_penal_id, created_at)
SELECT i.pm_envolvido_id::uuid, ip.id, es.id, x.created_at
  FROM legado.pm_envolvido_crimes x
  JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
  JOIN processo_envolvidos e  ON e.id = i.pm_envolvido_id::uuid
  JOIN legado.crimes_contravencoes cc ON cc.id = x.crime_id
  JOIN infracoes_penais ip ON ip.id = x.crime_id::uuid     -- UUID preservado na 0003
  JOIN esferas_penais es
       ON lower(es.nome) = CASE WHEN cc.dispositivo_legal = 'Código Penal Militar'
                                THEN 'militar' ELSE 'comum' END
ON CONFLICT DO NOTHING;

-- ------------------------------------------------- envolvido_transgressoes ---
-- Os ids do RDPM NÃO foram preservados na 0003 (são sintéticos), então o
-- casamento é por (artigo, inciso). No legado `transgressoes.artigo` é o
-- inteiro 15/16/17; no schema novo `artigos_rdpm.artigo` é o texto por extenso
-- que o administrador edita.
INSERT INTO envolvido_transgressoes (envolvido_id, transgressao_id, created_at)
SELECT i.pm_envolvido_id::uuid, t.id, x.created_at
  FROM legado.pm_envolvido_rdpm x
  JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
  JOIN processo_envolvidos e ON e.id = i.pm_envolvido_id::uuid
  JOIN legado.transgressoes lt ON lt.id = x.transgressao_id
  JOIN artigos_rdpm ar ON lower(ar.artigo) = lower('Art. ' || lt.artigo)
  JOIN transgressoes t ON t.artigo_rdpm_id = ar.id AND lower(t.inciso) = lower(lt.inciso)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- O ENQUADRAMENTO DOS PADS — a SEGUNDA fonte, que o legado guardava à parte
--
-- O sistema anterior tinha DOIS mecanismos de enquadramento que nunca se
-- encontraram:
--
--   (a) as tabelas `pm_envolvido_*`, usadas só pelos PROCEDIMENTOS (SR, IPM) —
--       é de onde saem as três importações acima;
--   (b) a coluna jsonb `processos_procedimentos.transgressoes_ids`, usada só
--       pelos 39 PADS.
--
-- A (b) é o enquadramento disciplinar de verdade: 73 vínculos de RDPM e 13 de
-- infração estatutária, em 39 processos. Cada item é
--   {"id": <int>,  "natureza": "grave", "tipo": "rdpm"}
--   {"id": <uuid>, "tipo": "estatuto", "rdmp_analogia": {"id": <int>, ...}}
--
-- Duas coisas importantes:
--   * o campo "natureza" (leve/media/grave) é REDUNDANTE — a gravidade vem do
--     artigo do RDPM, e é por isso que o schema novo não a duplica no vínculo;
--   * os 13 itens de estatuto TRAZEM A ANALOGIA com o RDPM, que é justamente o
--     que `analogia_transgressao_id` exige (decisão 5). Aqui ela existe.
--
-- Os 39 PADS têm exatamente 1 envolvido cada, então não há ambiguidade sobre a
-- quem o enquadramento pertence — diferente do que acontece com a solução.
-- ============================================================================

CREATE TEMP TABLE tmp_enq_pads ON COMMIT DROP AS
SELECT e.id AS envolvido_id,
       item->>'tipo'                        AS tipo,
       item->>'id'                          AS referencia,
       (item->'rdmp_analogia'->>'id')::int  AS analogia_legado
  FROM legado.processos_procedimentos l
  CROSS JOIN LATERAL jsonb_array_elements(l.transgressoes_ids::jsonb) AS item
  JOIN processo_envolvidos e ON e.processo_id = l.id::uuid
 WHERE btrim(COALESCE(l.transgressoes_ids, '')) NOT IN ('', '[]');

-- Transgressões do RDPM. Mesmo casamento por (artigo, inciso) usado acima.
INSERT INTO envolvido_transgressoes (envolvido_id, transgressao_id)
SELECT q.envolvido_id, t.id
  FROM tmp_enq_pads q
  JOIN legado.transgressoes lt ON lt.id = q.referencia::int
  JOIN artigos_rdpm ar ON lower(ar.artigo) = lower('Art. ' || lt.artigo)
  JOIN transgressoes t ON t.artigo_rdpm_id = ar.id AND lower(t.inciso) = lower(lt.inciso)
 WHERE q.tipo = 'rdpm'
ON CONFLICT DO NOTHING;

-- ---------------------------------------- envolvido_infracoes_estatuto -------
-- Entram os 13 que trazem a analogia. O id da infração é o UUID preservado na
-- 0003; a analogia casa por (artigo, inciso), como as demais transgressões.
INSERT INTO envolvido_infracoes_estatuto
    (envolvido_id, infracao_estatuto_id, analogia_transgressao_id)
SELECT q.envolvido_id, ie.id, t.id
  FROM tmp_enq_pads q
  JOIN infracoes_estatuto ie ON ie.id = q.referencia::uuid
  JOIN legado.transgressoes lt ON lt.id = q.analogia_legado
  JOIN artigos_rdpm ar ON lower(ar.artigo) = lower('Art. ' || lt.artigo)
  JOIN transgressoes t ON t.artigo_rdpm_id = ar.id AND lower(t.inciso) = lower(lt.inciso)
 WHERE q.tipo = 'estatuto' AND q.analogia_legado IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------- infrações do Estatuto SEM analogia: a analogia provisória ------
-- A segunda fonte de infração estatutária é `pm_envolvido_art29`, usada pelos
-- IPM e SR — 10 vínculos no dump novo (eram 3 no anterior). Ao contrário dos 13
-- acima, ela NUNCA guardou a analogia com o RDPM, e os envolvidos também não
-- têm transgressão de onde reaproveitá-la.
--
-- As duas fontes não se cruzam: `pm_envolvido_*` só aparece em IPM/SR e
-- `transgressoes_ids` só em PADS. Então não existe caso em que a analogia real
-- exista e esta etapa a substitua por uma provisória — e, ainda assim, este
-- INSERT vem DEPOIS do de cima, para que a ordem de carga nunca possa inverter
-- isso se um dump futuro passar a ter as duas.
--
-- `analogia_transgressao_id` é NOT NULL (decisão 5, regra universal), então ou
-- os 10 vínculos entram com um valor, ou não entram — e não entrar significaria
-- perder 10 acusações estatutárias reais. Entra uma analogia PROVISÓRIA, fixa e
-- declarada: RDPM Art. 15, inciso I.
--
-- Ela NÃO TEM VALIDADE JURÍDICA. É preenchimento técnico para satisfazer a
-- restrição, e a escolha é fixa justamente para ser identificável: uma consulta
-- por esse id devolve exatamente os 10 casos a rever, hoje e daqui a um ano.
-- 99_conferencia.sql os lista nominalmente, e a tela de indícios obriga a
-- escolher a analogia de verdade ao reabrir o envolvido. Escolher o inciso
-- análogo é classificação jurídica — é da Seção, não de um script.
--
-- O preflight confere que essa transgressão existe e está ativa antes de
-- qualquer carga: se alguém a desativar pela tela de catálogos, a migração para
-- em vez de escolher outra sozinha.
INSERT INTO envolvido_infracoes_estatuto
    (envolvido_id, infracao_estatuto_id, analogia_transgressao_id, created_at)
SELECT i.pm_envolvido_id::uuid, ie.id,
       'c8000000-0000-4000-8000-000000000001'::uuid,
       x.created_at
  FROM legado.pm_envolvido_art29 x
  JOIN legado.pm_envolvido_indicios i ON i.id = x.pm_indicios_id
  JOIN processo_envolvidos e  ON e.id = i.pm_envolvido_id::uuid
  JOIN infracoes_estatuto ie  ON ie.id = x.art29_id::uuid   -- UUID preservado na 0003
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------- processo_anexos ----
-- Substitui as 5 colunas pdf_* inline. `enviado_por_id` fica NULL: o legado
-- não registrava quem enviou. O tamanho não é coluna — octet_length(conteudo)
-- devolve o valor e nunca pode divergir do arquivo.
INSERT INTO processo_anexos (id, processo_id, nome_arquivo, mime_type, conteudo, created_at)
SELECT md5('processo_anexos|' || l.id || '|pdf')::uuid,
       l.id::uuid,
       l.pdf_nome,
       COALESCE(l.pdf_content_type, 'application/pdf'),
       l.pdf_arquivo,
       COALESCE(l.pdf_upload_em, now())
  FROM legado.processos_procedimentos l
  JOIN processos_procedimentos p ON p.id = l.id::uuid
 WHERE l.pdf_arquivo IS NOT NULL AND l.pdf_nome IS NOT NULL
-- O anexo não tem id próprio no legado (eram 5 colunas `pdf_*` na linha do
-- processo), então o id é derivado, como em 06 e 07 — é o que torna a etapa
-- reexecutável sem duplicar 20 MB.
ON CONFLICT (id) DO NOTHING;

