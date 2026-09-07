-- Duas funções que ordenam artigo e inciso pelo que eles significam, e não pelo
-- alfabeto.
--
-- O problema é do tipo da coluna. `artigo` e `inciso` são TEXT nos quatro
-- catálogos jurídicos, e guardam 'Art. 15' e 'XIV'. Ordenar isso como texto
-- produz duas mentiras:
--
--   * 'Art. 5' vai para DEPOIS de 'Art. 32', porque '5' > '3'. Hoje o Estatuto
--     só tem os artigos 29 e 32 e a ordem sai certa por coincidência — o
--     defeito nasce no dia em que alguém cadastrar um artigo de um dígito.
--   * o inciso romano sai I, II, III, IV, IX, V, VI, VII, VIII, X: o IX antes
--     do V. São 95 transgressões e 20 infrações do Estatuto nessa ordem.
--
-- POR QUE FUNÇÃO, E NÃO UMA COLUNA `ordem`
--
-- Porque aqui a ordem é DERIVADA do próprio dado: o número do artigo e o valor
-- do romano já estão escritos na linha, e não há escolha a fazer. Uma coluna
-- administrável obrigaria alguém a digitar e manter 95 + 20 + 26 posições que o
-- banco sabe calcular — e a primeira transgressão cadastrada depois disso
-- nasceria sem posição. É o contrário de `apuratorios.ordem` (decisão 64), que
-- É coluna justamente porque lá a ordem é uma ESCOLHA do responsável: não
-- deriva de nada, não é alfabética nem por tipo.
--
-- As duas são IMMUTABLE porque só olham o argumento — é o que permite usá-las
-- no ORDER BY sem custo de reavaliação, e um dia num índice. E STRICT: entrada
-- nula devolve nulo, sem escrever o caso no corpo.

-- O número do artigo, para ordenar. 'Art. 15' -> 15, '121' -> 121.
--
-- Devolve NULL quando não há dígito nenhum, e quem chama põe esses no fim
-- (`NULLS LAST`) com desempate pelo texto: artigo sem número é dado torto, e o
-- lugar dele é o fim da lista, não o começo.
--
-- O limite de 9 dígitos não é estética: sem ele, um artigo digitado com 12
-- algarismos estoura o cast para `integer` e derruba a LISTAGEM INTEIRA do
-- catálogo — a tela não abriria mais, por causa de uma linha. Com o limite, a
-- linha torta apenas ordena por um número truncado.
CREATE FUNCTION numero_do_artigo(texto TEXT) RETURNS INTEGER
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT NULLIF(substring(btrim(texto) FROM '[0-9]{1,9}'), '')::integer;
$$;

COMMENT ON FUNCTION numero_do_artigo(TEXT) IS
    'Primeira sequência de dígitos de um artigo, para ordenação. NULL se não houver.';

-- O valor de um algarismo romano. 'IV' -> 4, 'IX' -> 9, 'XIV' -> 14.
--
-- Soma posicional com subtração: cada letra vale negativo quando a seguinte
-- vale mais que ela (o I de IV), e positivo no resto. O `lead()` é quem olha a
-- seguinte; a última letra não tem seguinte, e o COALESCE a trata como 0.
--
-- São dois níveis de subconsulta, e o de fora não é enfeite: o PostgreSQL
-- calcula agregação ANTES de janela, então `sum(... lead() ...)` é recusado na
-- análise. A janela tem de terminar num nível abaixo do `sum()`.
--
-- O que não é romano devolve NULL, e quem guarda isso é o `~ '^[IVXLCDM]+$'`
-- de fora — não a soma. Confiar na soma seria um erro silencioso: `sum()`
-- IGNORA nulos, então 'C ú' viraria 100, e o inciso torto receberia uma posição
-- inventada em vez de cair no `NULLS LAST` de quem chama. Texto vazio também
-- não passa pela regex, que exige ao menos uma letra.
CREATE FUNCTION valor_do_romano(texto TEXT) RETURNS INTEGER
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT CASE WHEN upper(btrim(texto)) ~ '^[IVXLCDM]+$' THEN (
        SELECT sum(com_sinal.parcela)::integer
          FROM (
            SELECT CASE
                       WHEN v.valor < COALESCE(lead(v.valor) OVER (ORDER BY v.posicao), 0)
                       THEN -v.valor ELSE v.valor
                   END AS parcela
              FROM (
                SELECT ordinalidade AS posicao,
                       CASE letra
                           WHEN 'I' THEN 1    WHEN 'V' THEN 5    WHEN 'X' THEN 10
                           WHEN 'L' THEN 50   WHEN 'C' THEN 100  WHEN 'D' THEN 500
                           WHEN 'M' THEN 1000
                       END AS valor
                  FROM regexp_split_to_table(upper(btrim(texto)), '')
                       WITH ORDINALITY AS t(letra, ordinalidade)
              ) v
          ) com_sinal
    ) END;
$$;

COMMENT ON FUNCTION valor_do_romano(TEXT) IS
    'Valor de um algarismo romano, para ordenação. NULL se o texto não for romano.';
