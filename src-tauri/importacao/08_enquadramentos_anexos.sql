-- =============================================================================
-- ETAPA 08 — ENQUADRAMENTO POR ENVOLVIDO E O ÚNICO ANEXO
--
-- As 5 tabelas `pm_envolvido_*` do legado viram 3, todas penduradas em
-- `processo_envolvidos.id`. Assim o PostgreSQL garante que só recebe
-- enquadramento quem realmente é envolvido daquele processo — antes, as 5
-- carregavam o par (processo, envolvido) separadamente, sem nada impedindo a
-- combinação inexistente.
--
-- Roda em transação única.
-- =============================================================================
BEGIN;

-- ------------------------------------------- envolvido_categorias_indicio ----
-- `categorias_indicios` é array JSON: 22 registros, alguns com 2 categorias.
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
--       pelos 32 PADS.
--
-- A (b) é o enquadramento disciplinar de verdade: 62 vínculos de RDPM em 30
-- processos e 11 de infração estatutária em 5. Cada item é
--   {"id": <int>,  "natureza": "grave", "tipo": "rdpm"}
--   {"id": <uuid>, "tipo": "estatuto", "rdmp_analogia": {"id": <int>, ...}}
--
-- Duas coisas importantes:
--   * o campo "natureza" (leve/media/grave) é REDUNDANTE — a gravidade vem do
--     artigo do RDPM, e é por isso que o schema novo não a duplica no vínculo;
--   * os 11 itens de estatuto TRAZEM A ANALOGIA com o RDPM, que é justamente o
--     que `analogia_transgressao_id` exige (decisão 5). Aqui ela existe.
--
-- Os 32 PADS têm exatamente 1 envolvido cada, então não há ambiguidade sobre a
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
-- Entram os 11 que trazem a analogia. O id da infração é o UUID preservado na
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

-- O QUE FICA DE FORA, e por quê: os 3 vínculos de art. 29 de SR 2 e SR 5, que
-- vêm da fonte (a) — `pm_envolvido_art29`. Aquela tabela nunca guardou
-- analogia, e os 2 envolvidos também não têm transgressão do RDPM de onde
-- reaproveitá-la. `analogia_transgressao_id` é NOT NULL (decisão 5, regra
-- universal) e escolher o inciso análogo é classificação jurídica — é da
-- Seção, não de um script. A categoria "Indícios de transgressão disciplinar"
-- desses envolvidos entra normalmente acima, e 99_conferencia.sql os lista
-- como pendência: a tela de indícios obriga a escolher a analogia ao reabrir.

-- -------------------------------------------------------- processo_anexos ----
-- Substitui as 5 colunas pdf_* inline. `enviado_por_id` fica NULL: o legado
-- não registrava quem enviou. O tamanho não é coluna — octet_length(conteudo)
-- devolve o valor e nunca pode divergir do arquivo.
INSERT INTO processo_anexos (processo_id, nome_arquivo, mime_type, conteudo, created_at)
SELECT l.id::uuid,
       l.pdf_nome,
       COALESCE(l.pdf_content_type, 'application/pdf'),
       l.pdf_arquivo,
       COALESCE(l.pdf_upload_em, now())
  FROM legado.processos_procedimentos l
  JOIN processos_procedimentos p ON p.id = l.id::uuid
 WHERE l.pdf_arquivo IS NOT NULL AND l.pdf_nome IS NOT NULL;

COMMIT;
