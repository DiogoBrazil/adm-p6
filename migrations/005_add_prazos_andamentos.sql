-- ============================================
-- MIGRAÇÃO 005: Controle de Prazos e Andamentos
-- ============================================
-- Implementa requisitos identificados na análise:
-- - Controle de prazos (inicial + prorrogações)
-- - Histórico de andamentos/movimentações

-- ============================================
-- TABELA DE PRAZOS DOS PROCESSOS
-- ============================================

CREATE TABLE IF NOT EXISTS prazos_processo (
    id TEXT PRIMARY KEY,
    processo_id TEXT NOT NULL,
    tipo_prazo TEXT NOT NULL CHECK (tipo_prazo IN ('inicial', 'prorrogacao')),
    data_inicio DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    dias_adicionados INTEGER DEFAULT 0,
    motivo TEXT,
    autorizado_por TEXT, -- ID do usuário que autorizou
    autorizado_tipo TEXT CHECK (autorizado_tipo IN ('encarregado', 'operador')),
    ativo BOOLEAN DEFAULT 1, -- Para marcar prazo atual
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (processo_id) REFERENCES processos_procedimentos(id)
    
    -- Nota: UNIQUE constraint com WHERE será criado como índice separado
);

-- ============================================
-- TABELA DE ANDAMENTOS DOS PROCESSOS
-- ============================================

CREATE TABLE IF NOT EXISTS andamentos_processo (
    id TEXT PRIMARY KEY,
    processo_id TEXT NOT NULL,
    data_movimentacao DATE NOT NULL,
    tipo_andamento TEXT NOT NULL CHECK (tipo_andamento IN (
        'abertura', 'recebimento', 'encaminhamento', 'retorno', 
        'conclusao', 'arquivamento', 'prorrogacao', 'outro'
    )),
    descricao TEXT NOT NULL,
    destino_origem TEXT, -- Para onde foi ou de onde veio
    usuario_responsavel_id TEXT,
    usuario_responsavel_tipo TEXT CHECK (usuario_responsavel_tipo IN ('encarregado', 'operador')),
    observacoes TEXT,
    documento_anexo TEXT, -- Nome do arquivo ou referência
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (processo_id) REFERENCES processos_procedimentos(id)
);

-- ============================================
-- TABELA DE STATUS PERSONALIZADOS
-- ============================================
-- Para complementar os status básicos com mais granularidade

CREATE TABLE IF NOT EXISTS status_detalhado_processo (
    id TEXT PRIMARY KEY,
    processo_id TEXT NOT NULL,
    status_codigo TEXT NOT NULL,
    data_alteracao DATE NOT NULL,
    usuario_id TEXT,
    usuario_tipo TEXT CHECK (usuario_tipo IN ('encarregado', 'operador')),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (processo_id) REFERENCES processos_procedimentos(id),
    FOREIGN KEY (status_codigo) REFERENCES status_processo(codigo)
    
    -- Nota: UNIQUE constraint com WHERE será criado como índice separado
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índices para prazos_processo
CREATE INDEX IF NOT EXISTS idx_prazos_processo_id 
ON prazos_processo(processo_id);

CREATE INDEX IF NOT EXISTS idx_prazos_vencimento 
ON prazos_processo(data_vencimento);

CREATE INDEX IF NOT EXISTS idx_prazos_ativo 
ON prazos_processo(ativo, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_prazos_tipo 
ON prazos_processo(tipo_prazo, ativo);

-- Índices para andamentos_processo
CREATE INDEX IF NOT EXISTS idx_andamentos_processo_id 
ON andamentos_processo(processo_id);

CREATE INDEX IF NOT EXISTS idx_andamentos_data 
ON andamentos_processo(data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_andamentos_tipo 
ON andamentos_processo(tipo_andamento);

CREATE INDEX IF NOT EXISTS idx_andamentos_usuario 
ON andamentos_processo(usuario_responsavel_id, usuario_responsavel_tipo);

-- Índices para status_detalhado_processo
CREATE INDEX IF NOT EXISTS idx_status_detalhado_processo 
ON status_detalhado_processo(processo_id);

CREATE INDEX IF NOT EXISTS idx_status_detalhado_codigo 
ON status_detalhado_processo(status_codigo);

CREATE INDEX IF NOT EXISTS idx_status_detalhado_ativo 
ON status_detalhado_processo(ativo, data_alteracao DESC);

-- Índices únicos para garantir um registro ativo por processo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_prazo_ativo 
ON prazos_processo(processo_id) WHERE ativo = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_status_ativo 
ON status_detalhado_processo(processo_id) WHERE ativo = 1;

-- ============================================
-- TRIGGERS PARA AUDITORIA
-- ============================================

-- Trigger para INSERT em prazos_processo
CREATE TRIGGER IF NOT EXISTS trg_audit_prazos_insert
AFTER INSERT ON prazos_processo
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'prazos_processo',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'processo_id', NEW.processo_id,
            'tipo_prazo', NEW.tipo_prazo,
            'data_inicio', NEW.data_inicio,
            'data_vencimento', NEW.data_vencimento,
            'dias_adicionados', NEW.dias_adicionados,
            'motivo', NEW.motivo
        )
    );
END;

-- Trigger para INSERT em andamentos_processo
CREATE TRIGGER IF NOT EXISTS trg_audit_andamentos_insert
AFTER INSERT ON andamentos_processo
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'andamentos_processo',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'processo_id', NEW.processo_id,
            'data_movimentacao', NEW.data_movimentacao,
            'tipo_andamento', NEW.tipo_andamento,
            'descricao', NEW.descricao,
            'destino_origem', NEW.destino_origem
        )
    );
END;

-- ============================================
-- VIEWS PARA CONSULTAS FACILITADAS
-- ============================================

-- View para processos com prazo atual
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

-- View para último andamento por processo
CREATE VIEW IF NOT EXISTS v_ultimo_andamento AS
SELECT 
    a.processo_id,
    a.data_movimentacao,
    a.tipo_andamento,
    a.descricao,
    a.destino_origem,
    COALESCE(o.nome, e.nome, 'Sistema') as usuario_nome
FROM andamentos_processo a
LEFT JOIN operadores o ON a.usuario_responsavel_id = o.id AND a.usuario_responsavel_tipo = 'operador'
LEFT JOIN encarregados e ON a.usuario_responsavel_id = e.id AND a.usuario_responsavel_tipo = 'encarregado'
WHERE a.id IN (
    SELECT id FROM andamentos_processo a2 
    WHERE a2.processo_id = a.processo_id 
    ORDER BY a2.data_movimentacao DESC, a2.created_at DESC 
    LIMIT 1
);

-- ============================================
-- DADOS INICIAIS PARA TIPOS DE ANDAMENTO
-- ============================================

-- Inserir tipos de andamento na tabela de referência (se existir)
INSERT OR IGNORE INTO tipos_processo (id, tipo_geral, codigo, descricao) VALUES
('tp007', 'andamento', 'ABERTURA', 'Abertura do Processo'),
('tp008', 'andamento', 'RECEBIMENTO', 'Recebimento para Análise'),
('tp009', 'andamento', 'ENCAMINHAMENTO', 'Encaminhamento para Órgão'),
('tp010', 'andamento', 'RETORNO', 'Retorno de Órgão'),
('tp011', 'andamento', 'CONCLUSAO', 'Conclusão do Processo'),
('tp012', 'andamento', 'ARQUIVAMENTO', 'Arquivamento'),
('tp013', 'andamento', 'PRORROGACAO', 'Prorrogação de Prazo');

-- ============================================
-- VERIFICAÇÃO E ESTATÍSTICAS
-- ============================================

-- Verificar se as tabelas foram criadas
SELECT name, sql 
FROM sqlite_master 
WHERE type = 'table' 
  AND name IN ('prazos_processo', 'andamentos_processo', 'status_detalhado_processo')
ORDER BY name;

-- Verificar índices criados
SELECT name, tbl_name 
FROM sqlite_master 
WHERE type = 'index' 
  AND (name LIKE 'idx_prazos_%' OR name LIKE 'idx_andamentos_%' OR name LIKE 'idx_status_detalhado_%')
ORDER BY tbl_name, name;

-- Verificar views criadas
SELECT name, sql 
FROM sqlite_master 
WHERE type = 'view' 
  AND name LIKE 'v_%prazo%' OR name LIKE 'v_%andamento%'
ORDER BY name;
