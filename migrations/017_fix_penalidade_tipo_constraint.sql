-- ============================================
-- MIGRAÇÃO 017: Corrigir constraint de penalidade_tipo
-- ============================================
-- Objetivo: Remover a constraint CHECK restritiva de penalidade_tipo
-- para permitir novos tipos de penalidade (Licenciado_Disciplina, 
-- Excluido_Disciplina, Demitido_Exoficio)

BEGIN TRANSACTION;

-- SQLite não permite alterar constraints diretamente, então precisamos:
-- 1. Renomear a tabela atual
-- 2. Criar nova tabela sem a constraint restritiva
-- 3. Copiar os dados
-- 4. Deletar a tabela antiga
-- 5. Recriar índices

-- 1. Renomear tabela atual
ALTER TABLE processos_procedimentos RENAME TO processos_procedimentos_old;

-- 2. Criar nova tabela sem CHECK constraint restritiva em penalidade_tipo
CREATE TABLE processos_procedimentos (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
    tipo_detalhe TEXT NOT NULL,
    documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
    processo_sei TEXT,
    responsavel_id TEXT NOT NULL,
    responsavel_tipo TEXT NOT NULL CHECK (responsavel_tipo IN ('encarregado', 'operador')),
    local_origem TEXT,
    local_fatos TEXT,
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
    numero_controle TEXT,
    concluido BOOLEAN,
    data_conclusao DATE,
    infracao_id INTEGER,
    transgressoes_ids TEXT,
    solucao_final TEXT,
    ano_instauracao TEXT,
    andamentos TEXT,
    data_remessa_encarregado DATE,
    data_julgamento DATE,
    solucao_tipo TEXT,
    -- Removendo CHECK constraint restritiva - agora aceita qualquer valor
    penalidade_tipo TEXT,
    penalidade_dias INTEGER,
    indicios_categorias TEXT,
    UNIQUE(numero, documento_iniciador, ano_instauracao)
);

-- 3. Copiar dados da tabela antiga para a nova
INSERT INTO processos_procedimentos 
SELECT 
    id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
    responsavel_id, responsavel_tipo, local_origem, local_fatos, data_instauracao,
    data_recebimento, escrivao_id, status_pm, nome_pm_id, nome_vitima,
    natureza_processo, natureza_procedimento, resumo_fatos, numero_portaria,
    numero_memorando, numero_feito, numero_rgf, created_at, updated_at, ativo,
    numero_controle, concluido, data_conclusao, infracao_id, transgressoes_ids,
    solucao_final, ano_instauracao, andamentos, data_remessa_encarregado,
    data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias
FROM processos_procedimentos_old;

-- 4. Deletar tabela antiga
DROP TABLE processos_procedimentos_old;

-- 5. Recriar índices importantes
CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos_procedimentos(numero);
CREATE INDEX IF NOT EXISTS idx_processos_tipo_geral ON processos_procedimentos(tipo_geral);
CREATE INDEX IF NOT EXISTS idx_processos_tipo_detalhe ON processos_procedimentos(tipo_detalhe);
CREATE INDEX IF NOT EXISTS idx_processos_responsavel ON processos_procedimentos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processos_ativo ON processos_procedimentos(ativo);
CREATE INDEX IF NOT EXISTS idx_processos_data_instauracao ON processos_procedimentos(data_instauracao);
CREATE INDEX IF NOT EXISTS idx_processos_data_recebimento ON processos_procedimentos(data_recebimento);
CREATE INDEX IF NOT EXISTS idx_processos_concluido ON processos_procedimentos(concluido);
CREATE INDEX IF NOT EXISTS idx_processos_data_remessa ON processos_procedimentos(data_remessa_encarregado);
CREATE INDEX IF NOT EXISTS idx_processos_data_julgamento ON processos_procedimentos(data_julgamento);
CREATE INDEX IF NOT EXISTS idx_processos_solucao_tipo ON processos_procedimentos(solucao_tipo);
CREATE INDEX IF NOT EXISTS idx_processos_penalidade_tipo ON processos_procedimentos(penalidade_tipo);
CREATE INDEX IF NOT EXISTS idx_processos_numero_controle ON processos_procedimentos(numero_controle);
CREATE INDEX IF NOT EXISTS idx_processos_local_origem ON processos_procedimentos(local_origem);
CREATE INDEX IF NOT EXISTS idx_processos_ano_instauracao ON processos_procedimentos(ano_instauracao);

-- ============================================
-- REGISTRO DA MIGRAÇÃO
-- ============================================
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success)
VALUES ('017_fix_penalidade_tipo_constraint.sql', CURRENT_TIMESTAMP, 0, 1);

COMMIT;
