-- Migration 0030: PDFs anexados a processos/procedimentos (armazenamento em bytea).
CREATE TABLE pdf_processo_procedimentos (
    id                       UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id UUID   NOT NULL,
    pdf_nome                 TEXT   NOT NULL,
    pdf_tamanho              BIGINT NOT NULL,
    pdf_arquivo              BYTEA  NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pdf_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id)
);
