-- ============================================
-- MIGRAÇÃO 003: Tabelas de Referência
-- ============================================

-- ============================================
-- TABELA DE POSTOS E GRADUAÇÕES
-- ============================================

CREATE TABLE IF NOT EXISTS postos_graduacoes (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('oficial', 'praca')),
    ordem_hierarquica INTEGER NOT NULL,
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir postos e graduações padrão da PM
INSERT OR IGNORE INTO postos_graduacoes (id, codigo, descricao, tipo, ordem_hierarquica) VALUES
('pg001', 'CEL PM', 'Coronel PM', 'oficial', 10),
('pg002', 'TEN CEL PM', 'Tenente-Coronel PM', 'oficial', 9),
('pg003', 'MAJ PM', 'Major PM', 'oficial', 8),
('pg004', 'CAP PM', 'Capitão PM', 'oficial', 7),
('pg005', '1º TEN PM', 'Primeiro-Tenente PM', 'oficial', 6),
('pg006', '2º TEN PM', 'Segundo-Tenente PM', 'oficial', 5),
('pg007', 'SUB TEN PM', 'Subtenente PM', 'praca', 4),
('pg008', '1º SGT PM', 'Primeiro-Sargento PM', 'praca', 3),
('pg009', '2º SGT PM', 'Segundo-Sargento PM', 'praca', 2),
('pg010', '3º SGT PM', 'Terceiro-Sargento PM', 'praca', 1),
('pg011', 'CB PM', 'Cabo PM', 'praca', 0),
('pg012', 'SD PM', 'Soldado PM', 'praca', -1);

-- ============================================
-- TABELA DE TIPOS DE PROCESSO/PROCEDIMENTO
-- ============================================

CREATE TABLE IF NOT EXISTS tipos_processo (
    id TEXT PRIMARY KEY,
    tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir tipos padrão
INSERT OR IGNORE INTO tipos_processo (id, tipo_geral, codigo, descricao) VALUES
-- Processos
('tp001', 'processo', 'PAD', 'Processo Administrativo Disciplinar'),
('tp002', 'processo', 'PCD', 'Processo Criminal Disciplinar'),
('tp003', 'processo', 'SINDICANCIA', 'Sindicância'),
-- Procedimentos
('tp004', 'procedimento', 'APURACAO_PRELIMINAR', 'Apuração Preliminar'),
('tp005', 'procedimento', 'TERMO_CIRCUNSTANCIADO', 'Termo Circunstanciado'),
('tp006', 'procedimento', 'PROCEDIMENTO_INVESTIGATIVO', 'Procedimento Investigativo');

-- ============================================
-- TABELA DE STATUS
-- ============================================

CREATE TABLE IF NOT EXISTS status_processo (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    cor TEXT, -- Para interface (hex color)
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir status padrão
INSERT OR IGNORE INTO status_processo (id, codigo, descricao, cor) VALUES
('st001', 'INICIADO', 'Processo Iniciado', '#007bff'),
('st002', 'EM_ANDAMENTO', 'Em Andamento', '#ffc107'),
('st003', 'AGUARDANDO_DEFESA', 'Aguardando Defesa', '#fd7e14'),
('st004', 'EM_JULGAMENTO', 'Em Julgamento', '#6f42c1'),
('st005', 'CONCLUIDO', 'Concluído', '#28a745'),
('st006', 'ARQUIVADO', 'Arquivado', '#6c757d'),
('st007', 'SUSPENSO', 'Suspenso', '#dc3545');

-- ============================================
-- TABELA DE NATUREZAS
-- ============================================

CREATE TABLE IF NOT EXISTS naturezas (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('processo', 'procedimento')),
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir naturezas padrão
INSERT OR IGNORE INTO naturezas (id, tipo, codigo, descricao) VALUES
-- Naturezas de Processo
('nat001', 'processo', 'ABUSO_AUTORIDADE', 'Abuso de Autoridade'),
('nat002', 'processo', 'VIOLACAO_DIREITOS', 'Violação de Direitos'),
('nat003', 'processo', 'EMBRIAGUEZ_SERVICO', 'Embriaguez em Serviço'),
('nat004', 'processo', 'ABANDONO_SERVICO', 'Abandono de Serviço'),
('nat005', 'processo', 'DESACATO_SUPERIOR', 'Desacato a Superior'),
-- Naturezas de Procedimento
('nat006', 'procedimento', 'VERIFICACAO_DENUNCIA', 'Verificação de Denúncia'),
('nat007', 'procedimento', 'APURACAO_FATOS', 'Apuração de Fatos'),
('nat008', 'procedimento', 'INVESTIGACAO_PRELIMINAR', 'Investigação Preliminar');

-- ============================================
-- TABELA DE LOCAIS DE ORIGEM
-- ============================================

CREATE TABLE IF NOT EXISTS locais_origem (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('BPM', 'BOPE', 'ROTAM', 'COMANDO', 'OUTRO')),
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir locais padrão (exemplo genérico)
INSERT OR IGNORE INTO locais_origem (id, codigo, descricao, tipo) VALUES
('loc001', '1º BPM', '1º Batalhão de Polícia Militar', 'BPM'),
('loc002', '2º BPM', '2º Batalhão de Polícia Militar', 'BPM'),
('loc003', 'BOPE', 'Batalhão de Operações Especiais', 'BOPE'),
('loc004', 'ROTAM', 'Rondas Ostensivas Táticas Metropolitanas', 'ROTAM'),
('loc005', 'CG', 'Comando Geral', 'COMANDO'),
('loc006', 'CORREGEDORIA', 'Corregedoria da PM', 'COMANDO');

-- ============================================
-- VERIFICAÇÃO DAS TABELAS CRIADAS
-- ============================================

-- Verificar tabelas de referência criadas
SELECT name, sql 
FROM sqlite_master 
WHERE type = 'table' 
  AND name IN ('postos_graduacoes', 'tipos_processo', 'status_processo', 'naturezas', 'locais_origem')
ORDER BY name;

-- Contar registros inseridos
SELECT 
    'postos_graduacoes' as tabela, COUNT(*) as total FROM postos_graduacoes
UNION ALL
SELECT 
    'tipos_processo' as tabela, COUNT(*) as total FROM tipos_processo
UNION ALL
SELECT 
    'status_processo' as tabela, COUNT(*) as total FROM status_processo
UNION ALL
SELECT 
    'naturezas' as tabela, COUNT(*) as total FROM naturezas
UNION ALL
SELECT 
    'locais_origem' as tabela, COUNT(*) as total FROM locais_origem;
