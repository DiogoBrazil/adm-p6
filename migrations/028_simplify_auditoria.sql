-- ============================================
-- MIGRAÇÃO 028: Simplificar Tabela Auditoria
-- ============================================
-- Objetivo: Remover campos desnecessários da tabela auditoria
-- Mantém apenas: id, tabela, registro_id, operacao, usuario_id, timestamp

BEGIN TRANSACTION;

-- Criar nova tabela auditoria simplificada
CREATE TABLE auditoria_new (
    id TEXT PRIMARY KEY,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacao TEXT NOT NULL CHECK (operacao IN ('CREATE', 'UPDATE', 'DELETE')),
    usuario_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Como a tabela está vazia, não precisamos copiar dados
-- DROP da tabela antiga
DROP TABLE IF EXISTS auditoria;

-- Renomear nova tabela
ALTER TABLE auditoria_new RENAME TO auditoria;

-- Criar índices para performance
CREATE INDEX idx_auditoria_tabela ON auditoria(tabela);
CREATE INDEX idx_auditoria_registro_id ON auditoria(registro_id);
CREATE INDEX idx_auditoria_operacao ON auditoria(operacao);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_timestamp ON auditoria(timestamp DESC);

-- Registrar migração (se tabela schema_migrations existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
        INSERT INTO schema_migrations (id, migration_name, executed_at, execution_time_ms, success)
        VALUES (28, '028_simplify_auditoria.sql', CURRENT_TIMESTAMP, 0, TRUE);
    END IF;
END $$;

COMMIT;

-- Verificar estrutura
\d auditoria;
