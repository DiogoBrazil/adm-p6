-- Ordem cronológica dos fatos do processo/procedimento.
--
-- As etapas são opcionais: uma data ausente é simplesmente ignorada. Quando
-- duas etapas estão preenchidas, porém, a anterior nunca pode ocorrer depois
-- da posterior. As duas remessas ocupam a mesma posição porque a configuração
-- do apuratório decide qual delas representa o fato (migration 0010).
--
-- Os nomes das constraints são preservados. `error.rs` os traduz para texto de
-- domínio e nenhuma violação técnica deve chegar à tela (decisão 38).

ALTER TABLE processos_procedimentos
    DROP CONSTRAINT ck_processo_recebimento,
    DROP CONSTRAINT ck_processo_remessa_enc,
    DROP CONSTRAINT ck_processo_remessa_com,
    DROP CONSTRAINT ck_processo_julgamento,
    DROP CONSTRAINT ck_processo_conclusao;

ALTER TABLE processos_procedimentos
    ADD CONSTRAINT ck_processo_recebimento CHECK (
        data_recebimento IS NULL
        OR data_instauracao <= data_recebimento
    ),
    ADD CONSTRAINT ck_processo_remessa_enc CHECK (
        data_remessa_encarregado IS NULL
        OR (
            data_instauracao <= data_remessa_encarregado
            AND (data_recebimento IS NULL
                 OR data_recebimento <= data_remessa_encarregado)
        )
    ),
    ADD CONSTRAINT ck_processo_remessa_com CHECK (
        data_remessa_comissao IS NULL
        OR (
            data_instauracao <= data_remessa_comissao
            AND (data_recebimento IS NULL
                 OR data_recebimento <= data_remessa_comissao)
        )
    ),
    ADD CONSTRAINT ck_processo_julgamento CHECK (
        data_julgamento IS NULL
        OR (
            data_instauracao <= data_julgamento
            AND (data_recebimento IS NULL OR data_recebimento <= data_julgamento)
            AND (data_remessa_encarregado IS NULL
                 OR data_remessa_encarregado <= data_julgamento)
            AND (data_remessa_comissao IS NULL
                 OR data_remessa_comissao <= data_julgamento)
        )
    ),
    ADD CONSTRAINT ck_processo_conclusao CHECK (
        data_conclusao IS NULL
        OR (
            data_instauracao <= data_conclusao
            AND (data_recebimento IS NULL OR data_recebimento <= data_conclusao)
            AND (data_remessa_encarregado IS NULL
                 OR data_remessa_encarregado <= data_conclusao)
            AND (data_remessa_comissao IS NULL
                 OR data_remessa_comissao <= data_conclusao)
            AND (data_julgamento IS NULL OR data_julgamento <= data_conclusao)
        )
    );
