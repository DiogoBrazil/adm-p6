-- Reestrutura locais_origem: remove schema antigo e cria com FK para municipios_distritos
DROP TABLE IF EXISTS locais_origem CASCADE;

CREATE TABLE locais_origem (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_pm TEXT    NOT NULL,
    cidade_id  UUID    NOT NULL REFERENCES municipios_distritos(id),
    ativo      BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
