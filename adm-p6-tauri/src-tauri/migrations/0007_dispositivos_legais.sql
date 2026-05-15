-- Migration 0007: Cria tabela dispositivos_legais e normaliza crimes_contravencoes
-- Apaga dados de teste e substitui coluna TEXT livre por FK UUID.

CREATE TABLE dispositivos_legais (
    id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT      NOT NULL,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dispositivos_legais_nome_unique UNIQUE (nome)
);

INSERT INTO dispositivos_legais (nome) VALUES
    ('Código Penal'),
    ('Lei de Contravenções Penais'),
    ('Estatuto da Criança e do Adolescente'),
    ('Lei de Drogas (11.343/2006)'),
    ('Código de Trânsito Brasileiro'),
    ('Código Penal Militar')
ON CONFLICT (nome) DO NOTHING;

-- Apaga dados de teste para permitir DROP + ADD column sem conflito
DELETE FROM crimes_contravencoes;

-- Normalização: substitui coluna TEXT livre por FK
ALTER TABLE crimes_contravencoes
    DROP COLUMN dispositivo_legal,
    ADD COLUMN dispositivo_legal_id UUID REFERENCES dispositivos_legais(id);
