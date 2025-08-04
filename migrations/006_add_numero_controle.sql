-- ============================================
-- MIGRAÇÃO 006: Adicionar coluna numero_controle
-- ============================================
-- Adiciona campo numero_controle separado do numero do documento iniciador
-- Popula dados existentes copiando os números dos documentos

-- Adicionar coluna numero_controle
ALTER TABLE processos_procedimentos 
ADD COLUMN numero_controle TEXT;

-- Popular dados existentes baseado no documento iniciador
-- Para Portaria: copia numero_portaria
UPDATE processos_procedimentos 
SET numero_controle = numero_portaria 
WHERE documento_iniciador = 'Portaria' AND numero_portaria IS NOT NULL;

-- Para Memorando Disciplinar: copia numero_memorando  
UPDATE processos_procedimentos 
SET numero_controle = numero_memorando 
WHERE documento_iniciador = 'Memorando Disciplinar' AND numero_memorando IS NOT NULL;

-- Para Feito Preliminar: copia numero_feito
UPDATE processos_procedimentos 
SET numero_controle = numero_feito 
WHERE documento_iniciador = 'Feito Preliminar' AND numero_feito IS NOT NULL;

-- Tornar campo obrigatório após popular dados existentes
-- Nota: SQLite não suporta ALTER COLUMN, então criamos constraint via trigger

-- Criar trigger para garantir que numero_controle seja obrigatório
CREATE TRIGGER IF NOT EXISTS check_numero_controle_not_null
BEFORE INSERT ON processos_procedimentos
FOR EACH ROW
WHEN NEW.numero_controle IS NULL OR TRIM(NEW.numero_controle) = ''
BEGIN
    SELECT RAISE(ABORT, 'numero_controle não pode ser nulo ou vazio');
END;

-- Criar trigger para updates
CREATE TRIGGER IF NOT EXISTS check_numero_controle_not_null_update
BEFORE UPDATE ON processos_procedimentos
FOR EACH ROW
WHEN NEW.numero_controle IS NULL OR TRIM(NEW.numero_controle) = ''
BEGIN
    SELECT RAISE(ABORT, 'numero_controle não pode ser nulo ou vazio');
END;

-- Atualizar timestamp da migração (gerenciado automaticamente pelo migration_runner)
-- UPDATE schema_migrations SET executed_at = CURRENT_TIMESTAMP WHERE migration_name = '006_add_numero_controle.sql';
-- INSERT OR IGNORE INTO schema_migrations (migration_name, executed_at) VALUES ('006_add_numero_controle.sql', CURRENT_TIMESTAMP);
