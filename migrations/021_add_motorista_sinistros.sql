-- ============================================
-- MIGRAÇÃO 021: Adicionar campo motorista para sinistros de trânsito
-- ============================================
-- Objetivo: Permitir registrar o motorista responsável em sinistros de trânsito
-- Ajustes:
--  - Adicionar coluna motorista_id como referência ao PM motorista
--  - Campo opcional (nullable) para manter compatibilidade com registros existentes

BEGIN TRANSACTION;

-- Garantir remoção da view que referencia tabela antiga
DROP VIEW IF EXISTS v_processos_com_prazo;

-- Renomear tabela atual
ALTER TABLE processos_procedimentos RENAME TO processos_procedimentos_old_021;

-- Recriar tabela com nova coluna motorista_id
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
    -- Papéis específicos para processos PAD/CD/CJ
    presidente_id TEXT,
    presidente_tipo TEXT CHECK (presidente_tipo IN ('encarregado', 'operador')),
    interrogante_id TEXT,
    interrogante_tipo TEXT CHECK (interrogante_tipo IN ('encarregado', 'operador')),
    escrivao_processo_id TEXT,
    escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('encarregado', 'operador')),
    historico_encarregados TEXT, -- JSON com histórico de substituições
    -- NOVA COLUNA: Motorista responsável por sinistros de trânsito
    motorista_id TEXT,
    UNIQUE(numero, documento_iniciador, ano_instauracao)
);

-- Copiar dados da tabela antiga
INSERT INTO processos_procedimentos (
    id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
    responsavel_id, responsavel_tipo, local_origem, local_fatos, 
    data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
    nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
    numero_portaria, numero_memorando, numero_feito, numero_rgf,
    created_at, updated_at, ativo, numero_controle, concluido, data_conclusao,
    infracao_id, transgressoes_ids, solucao_final, ano_instauracao, andamentos,
    data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo,
    penalidade_dias, indicios_categorias, presidente_id, presidente_tipo,
    interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
    historico_encarregados
    -- motorista_id será NULL para registros existentes
)
SELECT 
    id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei,
    responsavel_id, responsavel_tipo, local_origem, local_fatos,
    data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
    nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
    numero_portaria, numero_memorando, numero_feito, numero_rgf,
    created_at, updated_at, ativo, numero_controle, concluido, data_conclusao,
    infracao_id, transgressoes_ids, solucao_final, ano_instauracao, andamentos,
    data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo,
    penalidade_dias, indicios_categorias, presidente_id, presidente_tipo,
    interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
    historico_encarregados
FROM processos_procedimentos_old_021;

-- Remover tabela antiga
DROP TABLE processos_procedimentos_old_021;

-- Recriar view se existir
CREATE VIEW IF NOT EXISTS v_processos_com_prazo AS
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

PRAGMA integrity_check;
