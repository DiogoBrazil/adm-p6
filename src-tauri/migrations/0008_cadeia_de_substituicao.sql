-- =============================================================================
-- A cadeia de substituição de designações, explícita no dado.
--
-- O QUE FALTAVA
--
-- Desde a 0001 o histórico de quem exerceu cada papel existe: uma designação
-- encerrada é uma linha com `data_fim` preenchida, e `data_fim` é EXCLUSIVA — o
-- dia em que o sucessor assume (decisão 6). Isso basta para LER o histórico.
--
-- Não basta para DESFAZER. Para saber que a designação de PM DOIS sucedeu a de
-- PM UM, o código precisava adivinhar pelo par `data_fim = data_inicio` dentro
-- do mesmo `(processo, papel)` — e a adivinhação erra exatamente onde mais
-- importa: um papel com `max_ocupantes = 2` (a configuração de Escrivão prevê
-- isso) tem duas cadeias correndo em paralelo, e duas trocas no mesmo dia
-- tornam o par ambíguo. Sem o vínculo, "editar a última substituição" e
-- "remover a última substituição" não têm alvo definido.
--
-- O vínculo passa a ser coluna: cada designação aponta para aquela que ela
-- sucedeu. É o mesmo movimento que a 0001 fez com `historico_encarregados`
-- (jsonb → tabela com FK, princípio 3): relação conhecida do domínio é chave
-- estrangeira, não inferência.
--
-- O QUE A CADEIA GARANTE, E ONDE
--
--   FK + UNIQUE   uma antecessora tem no máximo UMA sucessora — sem bifurcação
--   ON DELETE RESTRICT   quem já foi sucedido não pode sumir por baixo da cadeia
--   trigger       contiguidade: a sucessora começa no dia em que a antecessora
--                 termina, no mesmo processo e no mesmo papel
--
-- E é a contiguidade que fecha o buraco dos ciclos: como `ck_designacao_periodo`
-- já exige `data_fim > data_inicio`, a data de início cresce a cada elo. Uma
-- cadeia que voltasse a si mesma precisaria de um elo com início menor que o
-- anterior, e o trigger o recusa. Não há ciclo possível — nem o de dois elos que
-- o `CHECK (id <> anterior)` sozinho deixaria passar.
-- =============================================================================


-- ── 1. A coluna e suas restrições estruturais ───────────────────────────────

ALTER TABLE processo_designacoes
    ADD COLUMN designacao_anterior_id UUID NULL;

COMMENT ON COLUMN processo_designacoes.designacao_anterior_id IS
    'A designação que esta sucedeu numa substituição. NULL = designação inicial, '
    'lançada no cadastro do processo e ainda sem histórico — só ela é editável e '
    'removível pelo formulário. Preenchida = a linha é uma substituição, e o '
    'cadastro não a alcança mais.';

ALTER TABLE processo_designacoes
    ADD CONSTRAINT fk_designacao_anterior
        FOREIGN KEY (designacao_anterior_id)
        REFERENCES processo_designacoes (id) ON DELETE RESTRICT,
    -- Uma antecessora, uma sucessora. Vários NULL convivem (é como o PostgreSQL
    -- trata UNIQUE), então toda designação inicial continua cabendo aqui.
    ADD CONSTRAINT uq_designacao_anterior UNIQUE (designacao_anterior_id),
    ADD CONSTRAINT ck_designacao_anterior_nao_e_si
        CHECK (designacao_anterior_id IS DISTINCT FROM id);

-- A leitura que a tela de detalhes faz o tempo todo: "esta designação já foi
-- sucedida?". Sem índice seria varredura para desenhar cada linha da tabela.
CREATE INDEX ix_designacao_anterior ON processo_designacoes (designacao_anterior_id)
    WHERE designacao_anterior_id IS NOT NULL;


-- ── 2. Retroalimentação do histórico que já existe ──────────────────────────
--
-- Vale para os dois casos que produzem histórico sem vínculo: as 19 cadeias que
-- a `06_designacoes.sql` importou do jsonb do legado e qualquer substituição
-- feita pelo comando antigo, que encerrava a designação vigente e abria a
-- sucessora sem registrar que uma vinha da outra.
--
-- O par é reconhecido por `antecessora.data_fim = sucessora.data_inicio` dentro
-- do mesmo `(processo, papel)` — que é exatamente a inferência que esta coluna
-- vem substituir. A diferença é que aqui ela roda UMA vez, com o banco parado, e
-- **se recusa a chutar**: as duas contagens de janela exigem que o par seja
-- mútuo e único. Onde houver ambiguidade (duas cadeias do mesmo papel trocando
-- de ocupante no mesmo dia), o vínculo fica NULL — a designação segue legível
-- como histórico, apenas sem oferecer "desfazer". Preferir o NULL ao palpite é o
-- que impede a migration de ligar a sucessora de uma cadeia à antecessora da
-- outra, que seria pior do que não ligar nada.
CREATE OR REPLACE FUNCTION fn_vincular_cadeias_existentes() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    vinculadas integer;
BEGIN
    WITH candidata AS (
        SELECT sucessora.id                                 AS sucessora_id,
               antecessora.id                               AS antecessora_id,
               count(*) OVER (PARTITION BY sucessora.id)     AS antecessoras_possiveis,
               count(*) OVER (PARTITION BY antecessora.id)   AS sucessoras_possiveis
          FROM processo_designacoes sucessora
          JOIN processo_designacoes antecessora
            ON antecessora.processo_id = sucessora.processo_id
           AND antecessora.papel_id    = sucessora.papel_id
           AND antecessora.data_fim    = sucessora.data_inicio
           AND antecessora.id         <> sucessora.id
         WHERE sucessora.designacao_anterior_id IS NULL
    )
    UPDATE processo_designacoes d
       SET designacao_anterior_id = c.antecessora_id,
           updated_at             = now()
      FROM candidata c
     WHERE d.id = c.sucessora_id
       AND c.antecessoras_possiveis = 1
       AND c.sucessoras_possiveis   = 1;

    GET DIAGNOSTICS vinculadas = ROW_COUNT;
    RETURN vinculadas;
END;
$$;

COMMENT ON FUNCTION fn_vincular_cadeias_existentes() IS
    'Liga as designações que já formam cadeia mas nasceram sem o vínculo explícito. '
    'Idempotente: só preenche o que está NULL, e só quando o par é único nos dois '
    'sentidos. Chamada pela migration 0008 e disponível para quem reimportar o legado.';

-- Num banco novo não há o que ligar e a função devolve zero; num banco que já
-- rodou a importação, liga as cadeias existentes. `PERFORM` em vez de `SELECT`
-- porque migration não devolve resultado — é o formato da 0007.
DO $$ BEGIN PERFORM fn_vincular_cadeias_existentes(); END $$;


-- ── 3. A contiguidade da cadeia, cobrada pelo banco ─────────────────────────
--
-- O repositório valida tudo isto antes de escrever, com as linhas travadas por
-- `FOR UPDATE`, e é de lá que sai a mensagem que o usuário lê. Este trigger é a
-- rede por baixo: protege contra escrita direta no banco e contra um caminho
-- novo no Rust que esqueça a regra.
--
-- Um elo: a sucessora assume no dia em que a antecessora sai, no mesmo processo
-- e no mesmo papel, e com outro ocupante — substituir alguém por ele mesmo não
-- é substituição.
CREATE OR REPLACE FUNCTION fn_exige_elo_contiguo(
    anterior  processo_designacoes,
    sucessora processo_designacoes
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF anterior.processo_id <> sucessora.processo_id
       OR anterior.papel_id <> sucessora.papel_id THEN
        RAISE EXCEPTION
            'a designacao sucessora tem de ser do mesmo processo e do mesmo papel'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'ck_designacao_cadeia';
    END IF;

    IF anterior.data_fim IS DISTINCT FROM sucessora.data_inicio THEN
        RAISE EXCEPTION
            'a designacao sucessora tem de comecar no dia em que a anterior termina'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'ck_designacao_cadeia';
    END IF;

    IF anterior.policial_militar_id = sucessora.policial_militar_id THEN
        RAISE EXCEPTION 'a substituicao exige um ocupante diferente do anterior'
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'ck_designacao_cadeia';
    END IF;
END;
$$;

-- Valida os DOIS lados a partir da linha alterada, porque uma substituição mexe
-- em duas: a antecessora ganha `data_fim`, a sucessora nasce (ou muda de data).
-- Olhar só para `NEW.designacao_anterior_id` deixaria passar quem alterasse
-- apenas a antecessora.
CREATE OR REPLACE FUNCTION fn_valida_cadeia_designacao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    anterior  processo_designacoes%ROWTYPE;
    sucessora processo_designacoes%ROWTYPE;
BEGIN
    IF NEW.designacao_anterior_id IS NOT NULL THEN
        SELECT * INTO anterior FROM processo_designacoes
         WHERE id = NEW.designacao_anterior_id;
        PERFORM fn_exige_elo_contiguo(anterior, NEW);
    END IF;

    SELECT * INTO sucessora FROM processo_designacoes
     WHERE designacao_anterior_id = NEW.id;
    IF FOUND THEN
        PERFORM fn_exige_elo_contiguo(NEW, sucessora);
    END IF;

    RETURN NULL;
END;
$$;

-- DEFERRABLE pelo mesmo motivo de `tg_max_ocupantes`: uma substituição altera
-- duas linhas e QUALQUER ordem passa por um estado intermediário inválido —
-- encerrar a antecessora antes de a sucessora existir, ou mover a data de uma
-- antes da outra. Só o estado no `commit` precisa fechar. (Cuidado conhecido do
-- §10: o erro aparece no commit, não no insert.)
CREATE CONSTRAINT TRIGGER tg_cadeia_designacao
    AFTER INSERT OR UPDATE OF processo_id, papel_id, policial_militar_id,
                              data_inicio, data_fim, designacao_anterior_id
    ON processo_designacoes
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_valida_cadeia_designacao();
