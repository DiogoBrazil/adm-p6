-- Migration 0020: Reestruturar status_envolvido.
-- Renomeia codigo→nome_status, remove descricao, adiciona timestamps.

ALTER TABLE status_envolvido RENAME COLUMN codigo TO nome_status;
ALTER TABLE status_envolvido DROP COLUMN IF EXISTS descricao;
ALTER TABLE status_envolvido ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE status_envolvido ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Re-seed com valores padrão (dados anteriores eram de teste)
DELETE FROM status_envolvido;
INSERT INTO status_envolvido (nome_status) VALUES ('Sindicado'), ('Acusado'), ('Indiciado'), ('Investigado');
