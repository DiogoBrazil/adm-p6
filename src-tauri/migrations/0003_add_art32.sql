-- Migration 0003: Adiciona tabelas para infrações do Estatuto Art. 32

CREATE TABLE infracoes_estatuto_art32 (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    inciso     TEXT    NOT NULL,
    texto      TEXT    NOT NULL,
    ativo      BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_art32_ativo  ON infracoes_estatuto_art32 (ativo);
CREATE INDEX ix_art32_inciso ON infracoes_estatuto_art32 (inciso);

CREATE TABLE pm_envolvido_art32 (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_indicios_id UUID NOT NULL,
    art32_id       UUID NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pe32_pei   FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id),
    CONSTRAINT fk_pe32_art32 FOREIGN KEY (art32_id)       REFERENCES infracoes_estatuto_art32(id)
);
