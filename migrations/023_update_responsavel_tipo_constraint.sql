-- Migração 023: Atualizar constraint responsavel_tipo para aceitar 'usuario'
-- Data: 2025-10-20
-- Descrição: Atualiza a constraint CHECK de responsavel_tipo para refletir a nova estrutura unificada

-- SQLite não suporta ALTER COLUMN diretamente, então precisamos:
-- 1. Criar nova tabela com a constraint correta
-- 2. Copiar dados
-- 3. Dropar tabela antiga
-- 4. Renomear nova tabela

BEGIN TRANSACTION;

-- 1. Atualizar todos os valores 'encarregado' e 'operador' para 'usuario'
UPDATE processos_procedimentos 
SET responsavel_tipo = 'usuario' 
WHERE responsavel_tipo IN ('encarregado', 'operador');

UPDATE processos_procedimentos 
SET presidente_tipo = 'usuario' 
WHERE presidente_tipo IN ('encarregado', 'operador');

UPDATE processos_procedimentos 
SET interrogante_tipo = 'usuario' 
WHERE interrogante_tipo IN ('encarregado', 'operador');

UPDATE processos_procedimentos 
SET escrivao_processo_tipo = 'usuario' 
WHERE escrivao_processo_tipo IN ('encarregado', 'operador');

-- 2. Criar tabela temporária com a constraint correta
CREATE TABLE processos_procedimentos_new (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    tipo_geral TEXT NOT NULL,
    tipo_detalhe TEXT,
    documento_iniciador TEXT,
    processo_sei TEXT,
    responsavel_id TEXT,
    responsavel_tipo TEXT CHECK (responsavel_tipo = 'usuario'),
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
    numero_controle TEXT,
    concluido INTEGER DEFAULT 0,
    data_conclusao DATE,
    solucao_final TEXT,
    transgressoes_ids TEXT,
    ano_instauracao INTEGER,
    data_remessa_encarregado DATE,
    data_julgamento DATE,
    solucao_tipo TEXT,
    penalidade_tipo TEXT,
    penalidade_dias INTEGER,
    indicios_categorias TEXT,
    presidente_id TEXT,
    presidente_tipo TEXT,
    interrogante_id TEXT,
    interrogante_tipo TEXT,
    escrivao_processo_id TEXT,
    escrivao_processo_tipo TEXT,
    data_prorrogacao_portaria DATE,
    numero_prorrogacao_portaria TEXT,
    andamentos TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsavel_id) REFERENCES usuarios (id)
);

-- 3. Copiar todos os dados
INSERT INTO processos_procedimentos_new SELECT * FROM processos_procedimentos;

-- 4. Dropar tabela antiga
DROP TABLE processos_procedimentos;

-- 5. Renomear nova tabela
ALTER TABLE processos_procedimentos_new RENAME TO processos_procedimentos;

-- 6. Recriar índices
CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos_procedimentos(numero);
CREATE INDEX IF NOT EXISTS idx_processos_tipo ON processos_procedimentos(tipo_geral, tipo_detalhe);
CREATE INDEX IF NOT EXISTS idx_processos_responsavel ON processos_procedimentos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processos_data_instauracao ON processos_procedimentos(data_instauracao);
CREATE INDEX IF NOT EXISTS idx_processos_ativo ON processos_procedimentos(ativo);

-- 7. Registrar migração
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('023_update_responsavel_tipo_constraint', CURRENT_TIMESTAMP);

COMMIT;
