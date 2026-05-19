-- Migration 0019: Reestruturar solucoes_tipo.
-- Renomeia codigo→nome_solucao, remove descricao, adiciona timestamps.

ALTER TABLE solucoes_tipo RENAME COLUMN codigo TO nome_solucao;
ALTER TABLE solucoes_tipo DROP COLUMN IF EXISTS descricao;
ALTER TABLE solucoes_tipo ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE solucoes_tipo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Re-seed com valores padrão (dados anteriores eram de teste)
DELETE FROM solucoes_tipo;
INSERT INTO solucoes_tipo (nome_solucao) VALUES ('Punido'), ('Absolvido'), ('Arquivado'), ('Homologado'), ('Avocado');
