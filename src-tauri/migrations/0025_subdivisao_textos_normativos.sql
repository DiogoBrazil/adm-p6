CREATE TABLE subdivisao_textos_normativos (
    id                   UUID      NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_subdivisao      TEXT      NOT NULL,
    dispositivo_legal_id UUID      NOT NULL,
    ativo                BOOLEAN   NOT NULL DEFAULT true,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subdivisao_textos_normativos_dispositivo_fkey
        FOREIGN KEY (dispositivo_legal_id) REFERENCES dispositivos_legais(id),
    CONSTRAINT subdivisao_textos_normativos_nome_disp_uq
        UNIQUE (nome_subdivisao, dispositivo_legal_id)
);
