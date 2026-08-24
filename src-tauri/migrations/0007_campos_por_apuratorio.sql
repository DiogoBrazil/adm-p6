-- =============================================================================
-- Quais campos do formulário de processo cada apuratório usa — e a separação
-- dos dois escrivães que a importação havia fundido.
--
-- Vem do primeiro uso de verdade do cadastro: o formulário mostrava os MESMOS
-- campos para os dez apuratórios. Data de julgamento num IPM, remessa à
-- comissão numa sindicância, penalidade onde nunca se pune. O dado confirma
-- que não era só ruído visual: `data_julgamento` está preenchida em CD (1),
-- PAD (1) e PADS (11), e em ZERO procedimento; `data_remessa_comissao`, em
-- nenhum dos 128.
--
-- Como sempre neste schema, o que decide não é a sigla — é atributo semântico
-- na linha do apuratório, que o administrador vê e edita (§3.1 e §3.2).
-- =============================================================================


-- ── 1. Três atributos de comportamento em `apuratorios` ─────────────────────
--
-- Seguem o molde de `exige_natureza_fato`, `permite_penalidade` e
-- `e_responsavel`: uma coluna booleana por comportamento, consultada pelo
-- formulário, nunca um `match` sobre `sigla`.
--
-- `permite_punicao` NÃO substitui `tipos_solucao_decidida.permite_penalidade`:
-- são dois gates em níveis diferentes, e os dois valem. O apuratório diz se a
-- espécie pune; a solução decidida diz se AQUELE desfecho pune. Um IPM não
-- pune nunca; um PADS pune quando a solução é "Punido".
ALTER TABLE apuratorios
    ADD COLUMN permite_julgamento       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN permite_punicao          BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN permite_remessa_comissao BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN apuratorios.permite_julgamento IS
    'A espécie é julgada: revela a data de julgamento no cadastro.';
COMMENT ON COLUMN apuratorios.permite_punicao IS
    'Do apuratório pode resultar punição: revela penalidade e dias no envolvido. '
    'Vale junto com tipos_solucao_decidida.permite_penalidade, não no lugar dele.';
COMMENT ON COLUMN apuratorios.permite_remessa_comissao IS
    'A espécie tramita por comissão: revela a data de remessa à comissão.';

-- A CARGA INICIAL é por sigla, e isso é deliberado — não é o comportamento
-- decidido por nome que o princípio 2 proíbe.
--
-- A diferença importa: o princípio veta o CÓDIGO perguntar "a sigla é IPM?" em
-- tempo de execução, porque o administrador pode renomear a linha e quebrar
-- tudo em silêncio. Aqui é uma carga ÚNICA de um valor que a partir de agora
-- mora no dado e se edita em Catálogos → Apuratórios. É o mesmo molde de
-- `prazo_base_dias` (decisão 23) e de `max_envolvidos` (decisão 13), ambos
-- derivados uma vez e administráveis depois.
--
-- Num banco novo `apuratorios` nasce vazio (é catálogo operacional, §7.1), os
-- UPDATEs alcançam 0 linhas e vale o DEFAULT false — o administrador liga o
-- que a unidade dele usar.
UPDATE apuratorios SET permite_julgamento = true, permite_punicao = true
 WHERE sigla IN ('CD', 'CJ', 'PAD', 'PADE', 'PADS');

UPDATE apuratorios SET permite_remessa_comissao = true
 WHERE sigla IN ('CD', 'CJ', 'PAD');


-- ── 2. O escrivão do IPM e o escrivão do processo, outra vez separados ──────
--
-- O sistema legado guardava DOIS escrivães em colunas distintas — `escrivao_id`
-- e `escrivao_processo_id` — e a importação mapeou as duas para o mesmo papel
-- 'Escrivão' (`importacao/01_catalogos.sql`, legado.map_papeis). Foi
-- simplificação da importação, não decisão de domínio: são funções diferentes,
-- em ritos diferentes.
--
-- O corte no dump é limpo, o que torna a separação segura: `escrivao_id` só
-- aparece em IPM (23) e `escrivao_processo_id` só em CD (2), CJ (1) e PAD (1).
-- Nenhum processo usou as duas. Por isso dá para separar pelo apuratório, sem
-- depender do schema `legado`, que sai do banco quando a conferência fechar.
--
-- ORDEM OBRIGATÓRIA: a FK composta `(apuratorio_id, papel_id)` de
-- `processo_designacoes` recusa designação cujo papel não esteja cadastrado
-- para aquele apuratório. Então o papel e as associações entram ANTES de as
-- designações migrarem, e as associações antigas só se desativam no fim.
--
-- Roda condicionado a haver o que separar. É o que preserva a fronteira do
-- seed: `papeis_processo` é catálogo OPERACIONAL e tem de nascer VAZIO num
-- banco novo — há teste cobrando isso (`tests/migrations.rs`). Numa instalação
-- nova não existe 'Escrivão' nenhum, o bloco inteiro é pulado, e quem cadastra
-- os papéis é o administrador.
DO $$
DECLARE
    v_escrivao          uuid;
    v_escrivao_processo uuid;
    v_colegiados        uuid[];
BEGIN
    SELECT id INTO v_escrivao FROM papeis_processo WHERE lower(nome) = 'escrivão';
    IF v_escrivao IS NULL THEN
        RETURN;   -- instalação nova: não há o que separar
    END IF;

    -- Quais apuratórios usavam o escrivão do PROCESSO, sem nomear sigla: são os
    -- de rito colegiado, isto é, os que preveem o escrivão E um terceiro papel
    -- não responsável (o Interrogante). O IPM prevê só Encarregado, que é o
    -- responsável, e o Escrivão — nunca um terceiro.
    SELECT array_agg(ap.apuratorio_id) INTO v_colegiados
      FROM apuratorio_papeis ap
     WHERE ap.papel_id = v_escrivao
       AND EXISTS (SELECT 1
                     FROM apuratorio_papeis x
                    WHERE x.apuratorio_id = ap.apuratorio_id
                      AND x.papel_id <> v_escrivao
                      AND NOT x.e_responsavel);

    -- `array_agg` devolve NULL quando não agrega nada, e é o que se quer aqui:
    -- sem colegiado, não há segundo escrivão a criar. (Cuidado conhecido do
    -- §10: `= ANY('{}')` seria falso para toda linha, e o teste abaixo é o que
    -- impede chegar lá.)
    IF v_colegiados IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO papeis_processo (nome) VALUES ('Escrivão de Processo')
    RETURNING id INTO v_escrivao_processo;

    -- 1) As associações novas, ANTES de qualquer designação apontar para elas.
    --    `obrigatorio` e `max_ocupantes` são copiados da associação antiga: a
    --    regra do papel não muda, só o papel se desdobra em dois.
    INSERT INTO apuratorio_papeis
        (apuratorio_id, papel_id, obrigatorio, max_ocupantes, e_responsavel)
    SELECT ap.apuratorio_id, v_escrivao_processo, ap.obrigatorio, ap.max_ocupantes, false
      FROM apuratorio_papeis ap
     WHERE ap.papel_id = v_escrivao
       AND ap.apuratorio_id = ANY(v_colegiados);

    -- 2) As designações históricas passam para o papel novo. Nenhuma se perde:
    --    é troca de papel, não exclusão — designação é registro histórico e
    --    nunca se apaga.
    UPDATE processo_designacoes d
       SET papel_id = v_escrivao_processo
      FROM processos_procedimentos p
     WHERE d.processo_id = p.id
       AND d.papel_id = v_escrivao
       AND p.apuratorio_id = ANY(v_colegiados);

    -- 3) Só agora a associação antiga sai de circulação. DESATIVA, não apaga
    --    (princípio 6); e a FK das designações segue satisfeita de todo jeito,
    --    porque chave estrangeira não olha `ativo`.
    UPDATE apuratorio_papeis
       SET ativo = false
     WHERE papel_id = v_escrivao
       AND apuratorio_id = ANY(v_colegiados);
END $$;
