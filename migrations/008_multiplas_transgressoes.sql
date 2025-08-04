-- ============================================
-- MIGRAÇÃO 008: Suporte a múltiplas transgressões
-- ============================================

BEGIN TRANSACTION;

-- Renomear coluna infracao_id para transgressoes_ids e alterar tipo para TEXT
-- SQLite não suporta ALTER COLUMN, então precisamos recriar a tabela

-- 1. Criar nova coluna
ALTER TABLE processos_procedimentos ADD COLUMN transgressoes_ids TEXT;

-- 2. Migrar dados existentes (converter ID único para JSON array)
UPDATE processos_procedimentos 
SET transgressoes_ids = CASE 
    WHEN infracao_id IS NOT NULL THEN '[' || infracao_id || ']'
    ELSE NULL
END;

-- 3. Remover a coluna antiga (não é possível no SQLite, então vamos deixar)
-- A coluna infracao_id ficará deprecated mas não será removida para manter compatibilidade

-- 4. Comentar a constraint da FK antiga para evitar conflitos futuros
-- (A FK constraint será ignorada, mas o campo permanece)

COMMIT;

-- Registrar migração
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success) 
VALUES ('008_multiplas_transgressoes.sql', CURRENT_TIMESTAMP, 0, 1);
