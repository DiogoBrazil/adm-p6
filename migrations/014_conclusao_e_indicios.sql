-- ============================================
-- MIGRAÇÃO 014: Conclusão, Remessa, Julgamento e Indícios
-- ============================================
-- Objetivo: preparar o banco para armazenar informações de conclusão
-- (remessa pelo encarregado, julgamento, solução e indícios selecionados)
-- para processos e procedimentos, mantendo relacionamentos adequados.

BEGIN TRANSACTION;

-- ============================================
-- GARANTIR TABELA DE CRIMES/CONTRAVENÇÕES
-- (Caso ainda não tenha sido criada por scripts auxiliares)
-- ============================================
CREATE TABLE IF NOT EXISTS crimes_contravencoes (
    id TEXT PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Crime', 'Contravenção Penal')),
    dispositivo_legal VARCHAR(100) NOT NULL,
    artigo VARCHAR(10) NOT NULL,
    descricao_artigo TEXT NOT NULL,
    paragrafo VARCHAR(10),
    inciso VARCHAR(10),
    alinea VARCHAR(10),
    ativo BOOLEAN NOT NULL DEFAULT 1,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crimes_tipo ON crimes_contravencoes(tipo);
CREATE INDEX IF NOT EXISTS idx_crimes_dispositivo ON crimes_contravencoes(dispositivo_legal);
CREATE INDEX IF NOT EXISTS idx_crimes_artigo ON crimes_contravencoes(artigo);
CREATE INDEX IF NOT EXISTS idx_crimes_ativo ON crimes_contravencoes(ativo);

-- ============================================
-- CAMPOS EM PROCESSOS/PROCEDIMENTOS
-- ============================================
-- Observação: SQLite não suporta IF NOT EXISTS em ADD COLUMN. Caso os campos já existam
-- por execução parcial anterior, esta migração pode falhar ao adicionar novamente.
-- Em ambientes já migrados, remova manualmente as linhas abaixo que conflitam.

ALTER TABLE processos_procedimentos ADD COLUMN data_remessa_encarregado DATE;  -- Data em que o encarregado entregou o processo/procedimento
ALTER TABLE processos_procedimentos ADD COLUMN data_julgamento DATE;           -- Apenas aplicável a processos

-- Solução selecionada via UI (procedimento: Homologado/Avocado/Arquivado | processo: Punido/Absolvido/Arquivado)
ALTER TABLE processos_procedimentos ADD COLUMN solucao_tipo TEXT;              -- Valor do select de solução

-- Para processos: penalidade quando solucao_tipo = 'Punido'
ALTER TABLE processos_procedimentos ADD COLUMN penalidade_tipo TEXT CHECK (penalidade_tipo IN ('Prisao','Detencao','Repreensao'));
ALTER TABLE processos_procedimentos ADD COLUMN penalidade_dias INTEGER;        -- Dias para Prisão/Detenção

-- Para procedimentos homologados/avocados: categorias de indícios selecionadas
-- Ex.: JSON '["crime_comum","crime_militar","transgressao_disciplinar"]' ou '["sem_indicios"]'
ALTER TABLE processos_procedimentos ADD COLUMN indicios_categorias TEXT;       -- JSON array

-- Índices auxiliares para consultas futuras
CREATE INDEX IF NOT EXISTS idx_processos_data_remessa ON processos_procedimentos(data_remessa_encarregado);
CREATE INDEX IF NOT EXISTS idx_processos_data_julgamento ON processos_procedimentos(data_julgamento);
CREATE INDEX IF NOT EXISTS idx_processos_solucao_tipo ON processos_procedimentos(solucao_tipo);
CREATE INDEX IF NOT EXISTS idx_processos_penalidade_tipo ON processos_procedimentos(penalidade_tipo);

-- ============================================
-- TABELAS DE RELACIONAMENTO PARA INDÍCIOS (Procedimentos)
-- ============================================

-- Indícios de crimes/contravenções
CREATE TABLE IF NOT EXISTS procedimentos_indicios_crimes (
    id TEXT PRIMARY KEY,
    procedimento_id TEXT NOT NULL,
    crime_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id),
    FOREIGN KEY (crime_id) REFERENCES crimes_contravencoes(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_u_proc_ind_crime ON procedimentos_indicios_crimes(procedimento_id, crime_id);
CREATE INDEX IF NOT EXISTS idx_proc_ind_crimes_proc ON procedimentos_indicios_crimes(procedimento_id);

-- Indícios de transgressões do RDPM
CREATE TABLE IF NOT EXISTS procedimentos_indicios_rdpm (
    id TEXT PRIMARY KEY,
    procedimento_id TEXT NOT NULL,
    transgressao_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id),
    FOREIGN KEY (transgressao_id) REFERENCES transgressoes(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_u_proc_ind_rdpm ON procedimentos_indicios_rdpm(procedimento_id, transgressao_id);
CREATE INDEX IF NOT EXISTS idx_proc_ind_rdpm_proc ON procedimentos_indicios_rdpm(procedimento_id);

-- Indícios do Estatuto (Art. 29 do Decreto Lei 09-A)
CREATE TABLE IF NOT EXISTS procedimentos_indicios_art29 (
    id TEXT PRIMARY KEY,
    procedimento_id TEXT NOT NULL,
    art29_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id),
    FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_u_proc_ind_art29 ON procedimentos_indicios_art29(procedimento_id, art29_id);
CREATE INDEX IF NOT EXISTS idx_proc_ind_art29_proc ON procedimentos_indicios_art29(procedimento_id);

-- ============================================
-- REGISTRO DA MIGRAÇÃO
-- ============================================
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success)
VALUES ('014_conclusao_e_indicios.sql', CURRENT_TIMESTAMP, 0, 1);

COMMIT;
