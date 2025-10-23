-- ============================================
-- MIGRAÇÃO 024: Corrigir constraint dos campos *_tipo para aceitar 'usuario'
-- ============================================
-- Problema: Campos presidente_tipo, interrogante_tipo e escrivao_processo_tipo
-- têm constraint CHECK com valores antigos ('encarregado', 'operador')
-- mas o código está tentando inserir 'usuario' (tabela unificada)
-- Solução: Recriar tabela sem constraints CHECK, migrar dados e recriar com novas constraints
-- Data: 2025-10-23

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- PASSO 0: Dropar views que dependem da tabela
DROP VIEW IF EXISTS v_processos_com_prazo;
DROP VIEW IF EXISTS v_ultimo_andamento;
DROP VIEW IF EXISTS v_auditoria_detalhada;
DROP VIEW IF EXISTS v_pm_envolvido_indicios_completo;

-- PASSO 1: Criar tabela temporária com a nova estrutura
CREATE TABLE processos_procedimentos_new (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
    tipo_detalhe TEXT NOT NULL,
    documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
    processo_sei TEXT,
    -- Agora opcionais para suportar PAD/CD/CJ
    responsavel_id TEXT,
    responsavel_tipo TEXT CHECK (responsavel_tipo IN ('usuario')),
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
    -- Papéis específicos para processos PAD/CD/CJ - CORRIGIDO
    presidente_id TEXT,
    presidente_tipo TEXT CHECK (presidente_tipo IN ('usuario')),
    interrogante_id TEXT,
    interrogante_tipo TEXT CHECK (interrogante_tipo IN ('usuario')),
    escrivao_processo_id TEXT,
    escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('usuario')),
    historico_encarregados TEXT,
    motorista_id TEXT,
    UNIQUE(numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)
);

-- PASSO 2: Copiar dados convertendo valores antigos para 'usuario'
INSERT INTO processos_procedimentos_new 
SELECT 
    id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
    responsavel_id,
    CASE WHEN responsavel_tipo IN ('encarregado', 'operador') THEN 'usuario' ELSE responsavel_tipo END,
    local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
    nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
    numero_portaria, numero_memorando, numero_feito, numero_rgf,
    created_at, updated_at, ativo, numero_controle, concluido, data_conclusao,
    infracao_id, transgressoes_ids, solucao_final, ano_instauracao, andamentos,
    data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
    presidente_id,
    CASE WHEN presidente_tipo IN ('encarregado', 'operador') THEN 'usuario' ELSE presidente_tipo END,
    interrogante_id,
    CASE WHEN interrogante_tipo IN ('encarregado', 'operador') THEN 'usuario' ELSE interrogante_tipo END,
    escrivao_processo_id,
    CASE WHEN escrivao_processo_tipo IN ('encarregado', 'operador') THEN 'usuario' ELSE escrivao_processo_tipo END,
    historico_encarregados, motorista_id
FROM processos_procedimentos;

-- PASSO 3: Remover tabela antiga
DROP TABLE processos_procedimentos;

-- PASSO 4: Renomear nova tabela
ALTER TABLE processos_procedimentos_new RENAME TO processos_procedimentos;

-- PASSO 5: Recriar índices
CREATE INDEX idx_processos_numero ON processos_procedimentos(numero);
CREATE INDEX idx_processos_tipo ON processos_procedimentos(tipo_geral, tipo_detalhe);
CREATE INDEX idx_processos_responsavel ON processos_procedimentos(responsavel_id);
CREATE INDEX idx_processos_data_instauracao ON processos_procedimentos(data_instauracao);
CREATE INDEX idx_processos_ativo ON processos_procedimentos(ativo);

-- PASSO 6: Recriar views
CREATE VIEW v_processos_com_prazo AS
SELECT 
    pp.*,
    CASE 
        WHEN pp.data_remessa_encarregado IS NOT NULL THEN
            CASE 
                WHEN DATE(pp.data_remessa_encarregado, '+20 days') >= DATE('now') THEN 'Em dia'
                ELSE 'Vencido'
            END
        ELSE 'Pendente'
    END as status_prazo,
    CASE 
        WHEN pp.data_remessa_encarregado IS NOT NULL THEN
            JULIANDAY(DATE(pp.data_remessa_encarregado, '+20 days')) - JULIANDAY(DATE('now'))
        ELSE NULL
    END as dias_restantes
FROM processos_procedimentos pp
WHERE pp.ativo = 1;

COMMIT;

PRAGMA foreign_keys = ON;

-- Registrar migração
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success) 
VALUES ('024_fix_presidente_tipo_constraint.sql', CURRENT_TIMESTAMP, 0, 1);
