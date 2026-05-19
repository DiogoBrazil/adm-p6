-- Migration 0031: Andamentos (registros descritivos) de processos/procedimentos.
CREATE TABLE andamentos_processo_procedimentos (
    id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID NOT NULL,
    descricao_andamento      TEXT NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_andam_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id)
);
