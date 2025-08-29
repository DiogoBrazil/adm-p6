-- Migration 022: Adicionar tabela para mapas salvos
-- Data: 2025-08-28
-- Descrição: Tabela para armazenar mapas mensais gerados para acesso posterior

CREATE TABLE IF NOT EXISTS mapas_salvos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    tipo_processo TEXT NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    periodo_descricao TEXT NOT NULL,
    total_processos INTEGER NOT NULL DEFAULT 0,
    total_concluidos INTEGER NOT NULL DEFAULT 0,
    total_andamento INTEGER NOT NULL DEFAULT 0,
    usuario_id TEXT NOT NULL,
    usuario_nome TEXT NOT NULL,
    dados_mapa TEXT NOT NULL, -- JSON com todos os dados do mapa
    arquivo_pdf BLOB, -- Opcional: armazenar o PDF gerado
    nome_arquivo TEXT, -- Nome do arquivo PDF
    data_geracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para otimização
CREATE INDEX idx_mapas_salvos_tipo ON mapas_salvos(tipo_processo);
CREATE INDEX idx_mapas_salvos_periodo ON mapas_salvos(periodo_inicio, periodo_fim);
CREATE INDEX idx_mapas_salvos_usuario ON mapas_salvos(usuario_id);
CREATE INDEX idx_mapas_salvos_data ON mapas_salvos(data_geracao);
CREATE INDEX idx_mapas_salvos_ativo ON mapas_salvos(ativo);

-- Inserir na tabela de migrações
INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success) 
VALUES ('022_add_mapas_salvos', CURRENT_TIMESTAMP, 0, 1);
