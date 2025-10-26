-- ============================================
-- MIGRAÇÃO 025: Adicionar campos específicos para Carta Precatória (CP)
-- ============================================
-- Data: 2025-10-23
-- Descrição: Adiciona campos específicos necessários para o cadastro de CP

BEGIN TRANSACTION;

-- Adicionar novos campos para Carta Precatória
ALTER TABLE processos_procedimentos ADD COLUMN unidade_deprecada TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN deprecante TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN pessoas_inquiridas TEXT; -- JSON array com lista de pessoas

-- Criar índice para facilitar buscas por unidade deprecada
CREATE INDEX IF NOT EXISTS idx_processos_unidade_deprecada 
ON processos_procedimentos(unidade_deprecada) 
WHERE tipo_detalhe = 'CP';

COMMIT;

-- Registrar migração
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success) 
VALUES ('025_add_carta_precatoria_fields.sql', CURRENT_TIMESTAMP, 0, 1);

-- Verificação
SELECT 
    'Colunas adicionadas com sucesso!' as status,
    COUNT(*) as total_processos_cp
FROM processos_procedimentos 
WHERE tipo_detalhe = 'CP';
