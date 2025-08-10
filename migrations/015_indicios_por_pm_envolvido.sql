-- ============================================
-- MIGRAÇÃO 015: Indícios por PM Envolvido
-- ============================================
-- Objetivo: Permitir vincular categorias de indícios e crimes/transgressões
-- específicos para cada PM envolvido em um procedimento

BEGIN TRANSACTION;

-- ============================================
-- NOVA TABELA: INDICIOS POR PM ENVOLVIDO
-- ============================================

-- Tabela principal que agrupa indícios por PM envolvido
CREATE TABLE IF NOT EXISTS pm_envolvido_indicios (
    id TEXT PRIMARY KEY,
    procedimento_id TEXT NOT NULL,
    pm_envolvido_id TEXT NOT NULL, -- ID do registro em procedimento_pms_envolvidos
    categorias_indicios TEXT NOT NULL, -- JSON array: ["crime_comum", "transgressao_disciplinar", etc]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    FOREIGN KEY (pm_envolvido_id) REFERENCES procedimento_pms_envolvidos(id) ON DELETE CASCADE,
    UNIQUE(pm_envolvido_id) -- Cada PM envolvido tem apenas um registro de indícios
);

-- ============================================
-- TABELAS DE RELACIONAMENTO ESPECÍFICAS POR PM
-- ============================================

-- Crimes/contravenções específicos para um PM envolvido
CREATE TABLE IF NOT EXISTS pm_envolvido_crimes (
    id TEXT PRIMARY KEY,
    pm_indicios_id TEXT NOT NULL, -- FK para pm_envolvido_indicios
    crime_id TEXT NOT NULL,        -- FK para crimes_contravencoes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id) ON DELETE CASCADE,
    FOREIGN KEY (crime_id) REFERENCES crimes_contravencoes(id),
    UNIQUE(pm_indicios_id, crime_id) -- Evitar duplicatas
);

-- Transgressões RDPM específicas para um PM envolvido
CREATE TABLE IF NOT EXISTS pm_envolvido_rdpm (
    id TEXT PRIMARY KEY,
    pm_indicios_id TEXT NOT NULL, -- FK para pm_envolvido_indicios
    transgressao_id INTEGER NOT NULL, -- FK para transgressoes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id) ON DELETE CASCADE,
    FOREIGN KEY (transgressao_id) REFERENCES transgressoes(id),
    UNIQUE(pm_indicios_id, transgressao_id) -- Evitar duplicatas
);

-- Infrações Art. 29 específicas para um PM envolvido
CREATE TABLE IF NOT EXISTS pm_envolvido_art29 (
    id TEXT PRIMARY KEY,
    pm_indicios_id TEXT NOT NULL, -- FK para pm_envolvido_indicios
    art29_id INTEGER NOT NULL,     -- FK para infracoes_estatuto_art29
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id) ON DELETE CASCADE,
    FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id),
    UNIQUE(pm_indicios_id, art29_id) -- Evitar duplicatas
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pm_indicios_procedimento ON pm_envolvido_indicios(procedimento_id);
CREATE INDEX IF NOT EXISTS idx_pm_indicios_pm_envolvido ON pm_envolvido_indicios(pm_envolvido_id);
CREATE INDEX IF NOT EXISTS idx_pm_indicios_ativo ON pm_envolvido_indicios(ativo);

CREATE INDEX IF NOT EXISTS idx_pm_crimes_indicios ON pm_envolvido_crimes(pm_indicios_id);
CREATE INDEX IF NOT EXISTS idx_pm_crimes_crime ON pm_envolvido_crimes(crime_id);

CREATE INDEX IF NOT EXISTS idx_pm_rdpm_indicios ON pm_envolvido_rdpm(pm_indicios_id);
CREATE INDEX IF NOT EXISTS idx_pm_rdpm_transgressao ON pm_envolvido_rdpm(transgressao_id);

CREATE INDEX IF NOT EXISTS idx_pm_art29_indicios ON pm_envolvido_art29(pm_indicios_id);
CREATE INDEX IF NOT EXISTS idx_pm_art29_art29 ON pm_envolvido_art29(art29_id);

-- ============================================
-- VIEWS PARA FACILITAR CONSULTAS
-- ============================================

-- View que mostra todos os indícios por PM envolvido
CREATE VIEW IF NOT EXISTS v_pm_envolvido_indicios_completo AS
SELECT 
    pei.id as indicios_id,
    pei.procedimento_id,
    pei.pm_envolvido_id,
    pei.categorias_indicios,
    pme.pm_id,
    pme.status_pm,
    pme.ordem,
    COALESCE(o.nome, e.nome) as pm_nome,
    COALESCE(o.posto_graduacao, e.posto_graduacao) as pm_posto,
    COALESCE(o.matricula, e.matricula) as pm_matricula,
    -- Contadores
    (SELECT COUNT(*) FROM pm_envolvido_crimes pec WHERE pec.pm_indicios_id = pei.id) as total_crimes,
    (SELECT COUNT(*) FROM pm_envolvido_rdpm per WHERE per.pm_indicios_id = pei.id) as total_rdpm,
    (SELECT COUNT(*) FROM pm_envolvido_art29 pea WHERE pea.pm_indicios_id = pei.id) as total_art29
FROM pm_envolvido_indicios pei
JOIN procedimento_pms_envolvidos pme ON pei.pm_envolvido_id = pme.id
LEFT JOIN operadores o ON pme.pm_id = o.id AND pme.pm_tipo = 'operador'
LEFT JOIN encarregados e ON pme.pm_id = e.id AND pme.pm_tipo = 'encarregado'
WHERE pei.ativo = 1;

-- ============================================
-- REGISTRAR MIGRAÇÃO
-- ============================================

INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success)
VALUES ('015_indicios_por_pm_envolvido.sql', CURRENT_TIMESTAMP, 0, 1);

COMMIT;
