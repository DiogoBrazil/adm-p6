-- A ordem em que os apuratórios aparecem no mapa mensal.
--
-- Pedido do responsável: no documento emitido, SR, IPM e PADS vêm nessa ordem
-- quando estão no escopo; o resto, tanto faz. A ordem do documento é a mesma
-- da tabela da tela, porque as duas saem do `ORDER BY` de `map_rows` — e
-- `renderDocumentoMapa` monta as capas preservando a primeira ocorrência de
-- cada apuratório.
--
-- Por que coluna, e não uma lista de siglas no código: `sigla` é apresentação,
-- e o administrador pode renomeá-la a qualquer momento. Se o código decidisse
-- por ela, a ordem quebraria em silêncio no dia da renomeação, e ninguém
-- ligaria uma coisa à outra. A ordem pedida também não deriva de nada que já
-- exista — não é alfabética nem por tipo: PADS é Processo e vem no meio dos
-- Procedimentos.
--
-- A carga abaixo é **por sigla**, e é única: é o mesmo caminho de
-- `prazo_base_dias` (decisão 23) e dos atributos da 0007 (decisão 31). O que o
-- princípio 2 proíbe é o código decidir por nome **em tempo de execução**.
--
-- O `DEFAULT 100` deixa quem não foi nomeado depois dos três, e o desempate por
-- sigla no `ORDER BY` mantém esse resto em ordem alfabética, como hoje.
ALTER TABLE apuratorios ADD COLUMN ordem INTEGER NOT NULL DEFAULT 100;

UPDATE apuratorios SET ordem = 1 WHERE lower(sigla) = 'sr';
UPDATE apuratorios SET ordem = 2 WHERE lower(sigla) = 'ipm';
UPDATE apuratorios SET ordem = 3 WHERE lower(sigla) = 'pads';
