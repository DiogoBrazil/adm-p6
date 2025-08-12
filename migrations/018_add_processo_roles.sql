-- ============================================
-- MIGRAÇÃO 018: Adicionar campos de Presidente, Interrogante/Relator e Escrivão para processos PAD, CD e CJ
-- ============================================
-- Objetivo: Adicionar novos campos para processos (PAD, CD, CJ) que terão
-- Presidente, Interrogante/Relator e Escrivão específicos, diferente do
-- escrivão do IPM que já existe

BEGIN TRANSACTION;

-- Adicionar novos campos à tabela processos_procedimentos
-- Nota: escrivao_id já existe e será usado para IPM
-- Os novos campos serão para PAD, CD e CJ

-- Presidente do processo (PAD, CD, CJ)
ALTER TABLE processos_procedimentos ADD COLUMN presidente_id TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN presidente_tipo TEXT CHECK (presidente_tipo IN ('encarregado', 'operador'));

-- Interrogante/Relator do processo (PAD, CD, CJ)
ALTER TABLE processos_procedimentos ADD COLUMN interrogante_id TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN interrogante_tipo TEXT CHECK (interrogante_tipo IN ('encarregado', 'operador'));

-- Escrivão do processo (PAD, CD, CJ) - diferente do escrivão IPM
ALTER TABLE processos_procedimentos ADD COLUMN escrivao_processo_id TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('encarregado', 'operador'));

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_processos_presidente ON processos_procedimentos(presidente_id);
CREATE INDEX IF NOT EXISTS idx_processos_interrogante ON processos_procedimentos(interrogante_id);
CREATE INDEX IF NOT EXISTS idx_processos_escrivao_processo ON processos_procedimentos(escrivao_processo_id);

-- ============================================
-- REGISTRO DA MIGRAÇÃO
-- ============================================
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success)
VALUES ('018_add_processo_roles.sql', CURRENT_TIMESTAMP, 0, 1);

COMMIT;
