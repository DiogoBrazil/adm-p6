-- ============================================
-- MIGRAÇÃO 001: Implementar Foreign Keys
-- ============================================
-- Nota: SQLite requer recriar tabelas para adicionar FK constraints

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- ============================================
-- 1. BACKUP DAS TABELAS EXISTENTES
-- ============================================

-- Backup da tabela processos_procedimentos
CREATE TABLE processos_procedimentos_backup AS 
SELECT * FROM processos_procedimentos;

-- ============================================
-- 2. RECRIAR TABELA COM FOREIGN KEYS
-- ============================================

-- Recriar tabela processos_procedimentos com Foreign Keys
DROP TABLE processos_procedimentos;

CREATE TABLE processos_procedimentos (
    id TEXT PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
    tipo_detalhe TEXT NOT NULL,
    documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
    processo_sei TEXT,
    responsavel_id TEXT NOT NULL,
    responsavel_tipo TEXT NOT NULL CHECK (responsavel_tipo IN ('encarregado', 'operador')),
    local_origem TEXT,
    data_instauracao DATE,
    data_recebimento DATE,
    escrivao_id TEXT,
    status_pm TEXT,
    nome_pm_id TEXT,
    nome_vitima TEXT,
    natureza_processo TEXT,
    natureza_procedimento TEXT,
    resumo_fatos TEXT,
    numero_portaria TEXT,
    numero_memorando TEXT,
    numero_feito TEXT,
    numero_rgf TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT 1,
    
    -- Foreign Key Constraints (removido CHECK com subquery)
    FOREIGN KEY (escrivao_id) REFERENCES operadores(id)
);

-- ============================================
-- 3. RESTAURAR DADOS
-- ============================================

-- Restaurar dados válidos (apenas processos com responsáveis existentes)
INSERT INTO processos_procedimentos 
SELECT * FROM processos_procedimentos_backup
WHERE 
    (responsavel_tipo = 'encarregado' AND responsavel_id IN (SELECT id FROM encarregados WHERE ativo = 1)) OR
    (responsavel_tipo = 'operador' AND responsavel_id IN (SELECT id FROM operadores WHERE ativo = 1));

-- ============================================
-- 4. LIMPEZA
-- ============================================

-- Remover tabela de backup
DROP TABLE processos_procedimentos_backup;

COMMIT;

PRAGMA foreign_keys = ON;

-- ============================================
-- 5. VERIFICAÇÃO
-- ============================================

-- Verificar se as foreign keys estão ativas
PRAGMA foreign_key_check;

-- Contar registros restaurados
SELECT COUNT(*) as total_processos_restaurados FROM processos_procedimentos;

PRAGMA table_info(processos_procedimentos);
