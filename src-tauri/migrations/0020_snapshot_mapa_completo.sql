-- O mapa salvo passa a guardar também o documento completo, não só o resumo.
--
-- Até aqui `dados_mapa` era o array cru de `MapRow` — a tabela do mapa. Quem
-- quisesse o documento A4 (capas e fichas) tinha de voltar à tela do período e
-- gerá-lo ao vivo, o que recalcula e portanto já não é o mapa que foi emitido.
--
-- Por que dentro do mesmo JSONB, e não numa coluna nova: `tests/migrations.rs`
-- afirma a lista **exata** das colunas JSONB do schema — `auditoria.alteracoes`
-- e `mapas_salvos.dados_mapa` — e uma terceira reprova o teste. É decisão
-- registrada (princípio 3), não acidente, então o jeito de guardar duas saídas
-- é um envelope com as duas dentro:
--
--     { "versao": 2, "resumo": [ ...MapRow ], "completo": [ ...MapPrintItem ] }
--
-- O período NÃO entra no envelope. `renderDocumentoMapa` precisa de mês, ano e
-- das duas pontas, e os quatro saem de `periodo_inicio`/`periodo_fim`, que já
-- são colunas desta tabela: repeti-los criaria uma segunda fonte de verdade
-- para o mesmo fato (princípio 4).
--
-- O UPDATE abaixo não reescreve fato registrado: ele **embrulha** o resumo tal
-- como foi publicado, byte a byte, e declara `completo` como nulo — porque
-- naquele mapa o documento completo nunca chegou a ser tirado, e inventá-lo com
-- os dados de hoje seria publicar outra coisa com a data de ontem. A tela
-- desabilita o botão nesse caso, e diz por quê.
--
-- O `WHERE jsonb_typeof(...) = 'array'` torna a migration idempotente e a
-- limita à forma antiga. Nesta instalação ela não encontrará linha nenhuma: os
-- dois mapas que existiam eram de teste e foram removidos. Ela existe para o
-- banco restaurado de um backup anterior a esta rodada, que é o caminho
-- descrito na seção 6.1 do guia.

UPDATE mapas_salvos
   SET dados_mapa = jsonb_build_object(
         'versao',   2,
         'resumo',   dados_mapa,
         'completo', NULL
       ),
       updated_at = now()
 WHERE jsonb_typeof(dados_mapa) = 'array';
