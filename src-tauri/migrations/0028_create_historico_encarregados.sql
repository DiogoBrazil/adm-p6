-- Migration 0028: Histórico de substituição de encarregados de processo/procedimento.
CREATE TABLE historico_encarregados (
    id                         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_procedimento_id   UUID NOT NULL,
    encarregado_substituido_id UUID NOT NULL,
    encarregado_substituto_id  UUID NOT NULL,
    documento_autorizador_id   UUID NOT NULL,
    data_substituicao          DATE NOT NULL,
    motivo_substituicao        TEXT NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_he_proc FOREIGN KEY (processo_procedimento_id)
        REFERENCES historico_processo_procedimentos(processo_procedimento_id),
    CONSTRAINT fk_he_substituido FOREIGN KEY (encarregado_substituido_id) REFERENCES usuarios(id),
    CONSTRAINT fk_he_substituto  FOREIGN KEY (encarregado_substituto_id)  REFERENCES usuarios(id),
    CONSTRAINT fk_he_doc FOREIGN KEY (documento_autorizador_id) REFERENCES tipos_documentos(id)
);
