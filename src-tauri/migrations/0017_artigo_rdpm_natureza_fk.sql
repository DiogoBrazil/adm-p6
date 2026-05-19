-- Migration 0017: Converter artigo_rdpm_natureza_transgressao.natureza TEXT
-- para natureza_id UUID FK → natureza_transgressao.

-- Remover referências em transgressoes para liberar a tabela
UPDATE transgressoes SET artigo_id = NULL WHERE artigo_id IS NOT NULL;

-- Limpar dados de teste (DELETE respeita FKs existentes, TRUNCATE não)
DELETE FROM artigo_rdpm_natureza_transgressao;

-- Trocar coluna natureza TEXT (com CHECK constraint) por natureza_id UUID FK
ALTER TABLE artigo_rdpm_natureza_transgressao DROP COLUMN IF EXISTS natureza;
ALTER TABLE artigo_rdpm_natureza_transgressao
    ADD COLUMN IF NOT EXISTS natureza_id UUID NOT NULL REFERENCES natureza_transgressao(id);
