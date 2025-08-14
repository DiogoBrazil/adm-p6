-- ============================================
-- MIGRAÇÃO 020: Adicionar campo para histórico de encarregados
-- ============================================
-- Objetivo: Permitir registrar substituições de encarregados em processos/procedimentos
-- Ajustes:
--  - Adicionar coluna historico_encarregados para armazenar lista de encarregados anteriores
--  - Campo do tipo TEXT para armazenar JSON com histórico

BEGIN TRANSACTION;

-- Garantir remoção da view que referencia tabela antiga
DROP VIEW IF EXISTS v_processos_com_prazo;

-- Renomear tabela atual
ALTER TABLE processos_procedimentos RENAME TO processos_procedimentos_old_020;

-- Recriar tabela com nova coluna historico_encarregados
CREATE TABLE processos_procedimentos (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
    tipo_detalhe TEXT NOT NULL,
    documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
    processo_sei TEXT,
    -- Agora opcionais para suportar PAD/CD/CJ
    responsavel_id TEXT,
    responsavel_tipo TEXT CHECK (responsavel_tipo IN ('encarregado', 'operador')),
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
    penalidade_tipo TEXT,
    penalidade_dias INTEGER,
    indicios_categorias TEXT,
    -- Papéis específicos para processos PAD/CD/CJ (Migração 018)
    presidente_id TEXT,
    presidente_tipo TEXT CHECK (presidente_tipo IN ('encarregado', 'operador')),
    interrogante_id TEXT,
    interrogante_tipo TEXT CHECK (interrogante_tipo IN ('encarregado', 'operador')),
    escrivao_processo_id TEXT,
    escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('encarregado', 'operador')),
    -- Campo para histórico de encarregados
    historico_encarregados TEXT,
    UNIQUE(numero, documento_iniciador, ano_instauracao)
);

-- Copiar dados
INSERT INTO processos_procedimentos (
    id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
    responsavel_id, responsavel_tipo, local_origem, local_fatos, data_instauracao,
    data_recebimento, escrivao_id, status_pm, nome_pm_id, nome_vitima,
    natureza_processo, natureza_procedimento, resumo_fatos, numero_portaria,
    numero_memorando, numero_feito, numero_rgf, created_at, updated_at, ativo,
    numero_controle, concluido, data_conclusao, infracao_id, transgressoes_ids,
    solucao_final, ano_instauracao, andamentos, data_remessa_encarregado,
    data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
    presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
    historico_encarregados
)
SELECT 
    id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
    responsavel_id, responsavel_tipo, local_origem, local_fatos, data_instauracao,
    data_recebimento, escrivao_id, status_pm, nome_pm_id, nome_vitima,
    natureza_processo, natureza_procedimento, resumo_fatos, numero_portaria,
    numero_memorando, numero_feito, numero_rgf, created_at, updated_at, ativo,
    numero_controle, concluido, data_conclusao, infracao_id, transgressoes_ids,
    solucao_final, ano_instauracao, andamentos, data_remessa_encarregado,
    data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
    COALESCE(presidente_id, NULL), COALESCE(presidente_tipo, NULL),
    COALESCE(interrogante_id, NULL), COALESCE(interrogante_tipo, NULL),
    COALESCE(escrivao_processo_id, NULL), COALESCE(escrivao_processo_tipo, NULL),
    NULL -- historico_encarregados inicialmente vazio
FROM processos_procedimentos_old_020;

-- Remover tabela antiga
DROP TABLE processos_procedimentos_old_020;

-- Recriar índices principais
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
CREATE INDEX IF NOT EXISTS idx_processos_presidente ON processos_procedimentos(presidente_id);
CREATE INDEX IF NOT EXISTS idx_processos_interrogante ON processos_procedimentos(interrogante_id);
CREATE INDEX IF NOT EXISTS idx_processos_escrivao_processo ON processos_procedimentos(escrivao_processo_id);

-- Recriar a view v_processos_com_prazo apontando para a nova tabela
CREATE VIEW IF NOT EXISTS v_processos_com_prazo AS
SELECT 
    p.id,
    p.numero,
    p.tipo_detalhe,
    p.data_instauracao,
    pr.data_vencimento,
    pr.tipo_prazo,
    pr.dias_adicionados,
    CASE 
        WHEN pr.data_vencimento < DATE('now') THEN 'vencido'
        WHEN pr.data_vencimento <= DATE('now', '+7 days') THEN 'vencendo'
        ELSE 'no_prazo'
    END as situacao_prazo,
    JULIANDAY(pr.data_vencimento) - JULIANDAY(DATE('now')) as dias_restantes
FROM processos_procedimentos p
LEFT JOIN prazos_processo pr ON p.id = pr.processo_id AND pr.ativo = 1
WHERE p.ativo = 1;

-- Registrar migração
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success)
VALUES ('020_add_historico_encarregados.sql', CURRENT_TIMESTAMP, 0, 1);

COMMIT;