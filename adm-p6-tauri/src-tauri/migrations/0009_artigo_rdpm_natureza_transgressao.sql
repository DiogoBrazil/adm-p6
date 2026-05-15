-- Migration 0009: Cria artigo_rdpm_natureza_transgressao e normaliza transgressoes.
-- Apaga dados de teste, remove colunas antigas e cria nova estrutura com FK.

DELETE FROM transgressoes;

-- DROP COLUMN remove FK automaticamente no PostgreSQL
ALTER TABLE transgressoes
    DROP COLUMN artigo,
    DROP COLUMN gravidade_id;

DROP TABLE natureza_transgressao;

CREATE TABLE artigo_rdpm_natureza_transgressao (
    id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo     TEXT      NOT NULL,
    natureza   TEXT      NOT NULL CHECK (natureza IN ('Leve', 'Média', 'Grave')),
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT artigo_rdpm_artigo_unique UNIQUE (artigo)
);

ALTER TABLE transgressoes
    ADD COLUMN artigo_id UUID REFERENCES artigo_rdpm_natureza_transgressao(id);
