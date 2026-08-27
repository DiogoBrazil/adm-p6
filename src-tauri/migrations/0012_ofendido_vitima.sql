-- =============================================================================
-- Ofendido/Vítima deixa de ser "uma pessoa com papel" e vira relação própria do
-- procedimento, ao lado de `processo_envolvidos`.
--
-- POR QUE MUDAR DE LUGAR
--
-- `processo_pessoas` casa um nome com uma linha de `papeis_pessoa`, que é
-- catálogo OPERACIONAL: nasce vazio num banco novo, e quem o preenche é o
-- administrador (§7.1, e `tests/migrations.rs` cobra que continue assim). Isso
-- serve para "Pessoa inquirida", "Testemunha" — conceitos que cada unidade
-- rotula como quiser. Não serve para o ofendido: ele é informação que o
-- formulário PRECISA oferecer, e uma seção que só aparece se alguém tiver
-- cadastrado a linha certa é uma seção que morre em silêncio. Foi exatamente
-- assim que o formulário de carta precatória ficou impossível de preencher
-- (§8.10.2).
--
-- Sem catálogo no caminho, não há o que cadastrar nem o que renomear, e a seção
-- não pode desaparecer por configuração ausente.
-- =============================================================================

-- ── 1. O atributo que decide quem registra ofendido ─────────────────────────
ALTER TABLE apuratorios
    ADD COLUMN permite_cadastro_vitima BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN apuratorios.permite_cadastro_vitima IS
    'O cadastro registra Ofendido/Vitima: opcional, e em qualquer quantidade.';

-- Carga inicial de migracao, nao regra de runtime — mesmo molde de
-- `permite_indicios` na 0011. Depois de gravada, somente a coluna dirige o
-- comportamento; num banco novo `apuratorios` esta vazia, o UPDATE alcanca 0
-- linhas e vale o DEFAULT false.
--
-- Todo PROCEDIMENTO apura um fato, e fato tem ofendido: CP, FP, IPM, SR e SV
-- entram. Os cinco PROCESSOS disciplinares (CD, CJ, PAD, PADE, PADS) sao
-- instaurados CONTRA um militar, e ficam de fora.
UPDATE apuratorios a
   SET permite_cadastro_vitima = true
  FROM tipos_apuratorio ta
 WHERE ta.id = a.tipo_apuratorio_id
   AND lower(ta.nome) = 'procedimento';

-- ⚠ A coluna NAO entra em `legal_catalogs/domain.rs::CATALOGOS`, e o desvio da
-- §7.7 e deliberado: por decisao do responsavel, registrar ofendido e
-- capacidade do procedimento, nao escolha de administrador. Fica no mesmo caso
-- de `codigo_extensao` — mora no banco, dirige a tela, e nao aparece no
-- cadastro do apuratorio. O UPDATE generico de catalogos so escreve coluna
-- declarada, entao editar um apuratorio pela tela nunca a apaga.

-- ── 2. A tabela ─────────────────────────────────────────────────────────────
-- Espelha `processo_pessoas` (0001) menos o `papel_pessoa_id`: sem `updated_at`
-- e sem `ativo`, porque nao e catalogo, e sem referencia a policial, porque o
-- ofendido pode ser pessoa juridica ("ADMINISTRACAO PUBLICA") — a mesma razao
-- que fez `processo_pessoas` guardar nome em vez de FK.
CREATE TABLE processo_vitimas (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID        NOT NULL,
    nome        TEXT        NOT NULL,
    ordem       INTEGER     NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_vitima_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE RESTRICT,
    CONSTRAINT uq_vitima_ordem UNIQUE (processo_id, ordem),
    CONSTRAINT ck_vitima_ordem CHECK (ordem > 0),
    CONSTRAINT ck_vitima_nome  CHECK (btrim(nome) <> '')
);
CREATE INDEX ix_vitima_processo ON processo_vitimas (processo_id);

COMMENT ON TABLE processo_vitimas IS
    'Ofendidos/Vitimas do procedimento. Guarda nome livre: pode ser pessoa juridica.';

-- ── 3. As vitimas ja gravadas mudam de tabela ───────────────────────────────
-- Bloco CONDICIONADO, no molde da 0007: num banco novo nao existe papel nenhum
-- e ele retorna sem tocar em nada — e a asserção de `tests/migrations.rs` que
-- exige `papeis_pessoa` vazia continua valendo.
--
-- A comparacao por NOME aqui nao viola o principio 2. O principio veta o CODIGO
-- perguntar "o nome e 'Vitima'?" em tempo de execucao, porque o administrador
-- pode renomear a linha. Isto e migracao de DADO, uma vez, sobre o que a
-- importacao do legado escreveu (`importacao/01_catalogos.sql`, que semeava
-- exatamente 'Vítima') — mesmo caso do bloco do Escrivao na 0007.
DO $$
DECLARE
    papel_vitima uuid;
BEGIN
    SELECT id INTO papel_vitima
      FROM papeis_pessoa
     WHERE lower(nome) IN ('vítima', 'vitima', 'ofendido/vítima', 'ofendido/vitima')
     LIMIT 1;

    IF papel_vitima IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO processo_vitimas (processo_id, nome, ordem)
    SELECT pp.processo_id, pp.nome, pp.ordem
      FROM processo_pessoas pp
     WHERE pp.papel_pessoa_id = papel_vitima;

    DELETE FROM processo_pessoas WHERE papel_pessoa_id = papel_vitima;

    -- Catalogo em uso se DESATIVA, nao se apaga (principio 6). Desativado, ele
    -- some do seletor de "Pessoas inquiridas" sozinho: a lista de OPCOES filtra
    -- `ativo`, enquanto a leitura de registro existente nao filtra.
    UPDATE papeis_pessoa SET ativo = false, updated_at = now()
     WHERE id = papel_vitima;
END
$$;
