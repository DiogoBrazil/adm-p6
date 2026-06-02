-- Migration 0016: Recriar natureza_transgressao com schema normalizado.
-- A tabela foi removida em 0009. Recriamos agora com campo nome_natureza
-- (em vez de codigo) e timestamps completos.

-- Drop and recreate with normalized schema (CASCADE removes stale FK/view deps)
DROP TABLE IF EXISTS natureza_transgressao CASCADE;

CREATE TABLE natureza_transgressao (
    id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_natureza TEXT      NOT NULL UNIQUE,
    ativo         BOOLEAN   NOT NULL DEFAULT true,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO natureza_transgressao (nome_natureza) VALUES ('Leve'), ('Média'), ('Grave');
