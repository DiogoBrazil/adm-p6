-- ============================================
-- MIGRAÇÃO 004: Sistema de Auditoria
-- ============================================

-- ============================================
-- TABELA DE AUDITORIA
-- ============================================

CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacao TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario_id TEXT,
    usuario_tipo TEXT CHECK (usuario_tipo IN ('encarregado', 'operador')),
    dados_antes TEXT, -- JSON com dados antes da alteração
    dados_depois TEXT, -- JSON com dados após a alteração
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacoes TEXT
);

-- Índices para a tabela de auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_registro 
ON auditoria(tabela, registro_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp 
ON auditoria(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario 
ON auditoria(usuario_id, usuario_tipo);

CREATE INDEX IF NOT EXISTS idx_auditoria_operacao 
ON auditoria(operacao);

-- ============================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================

-- Trigger para INSERT em encarregados
CREATE TRIGGER IF NOT EXISTS trg_audit_encarregados_insert
AFTER INSERT ON encarregados
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'encarregados',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'posto_graduacao', NEW.posto_graduacao,
            'matricula', NEW.matricula,
            'nome', NEW.nome,
            'email', NEW.email,
            'ativo', NEW.ativo
        )
    );
END;

-- Trigger para UPDATE em encarregados
CREATE TRIGGER IF NOT EXISTS trg_audit_encarregados_update
AFTER UPDATE ON encarregados
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_antes, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'encarregados',
        NEW.id,
        'UPDATE',
        json_object(
            'id', OLD.id,
            'posto_graduacao', OLD.posto_graduacao,
            'matricula', OLD.matricula,
            'nome', OLD.nome,
            'email', OLD.email,
            'ativo', OLD.ativo
        ),
        json_object(
            'id', NEW.id,
            'posto_graduacao', NEW.posto_graduacao,
            'matricula', NEW.matricula,
            'nome', NEW.nome,
            'email', NEW.email,
            'ativo', NEW.ativo
        )
    );
END;

-- Trigger para INSERT em operadores
CREATE TRIGGER IF NOT EXISTS trg_audit_operadores_insert
AFTER INSERT ON operadores
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'operadores',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'posto_graduacao', NEW.posto_graduacao,
            'matricula', NEW.matricula,
            'nome', NEW.nome,
            'email', NEW.email,
            'profile', NEW.profile,
            'ativo', NEW.ativo
        )
    );
END;

-- Trigger para UPDATE em operadores
CREATE TRIGGER IF NOT EXISTS trg_audit_operadores_update
AFTER UPDATE ON operadores
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_antes, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'operadores',
        NEW.id,
        'UPDATE',
        json_object(
            'id', OLD.id,
            'posto_graduacao', OLD.posto_graduacao,
            'matricula', OLD.matricula,
            'nome', OLD.nome,
            'email', OLD.email,
            'profile', OLD.profile,
            'ativo', OLD.ativo
        ),
        json_object(
            'id', NEW.id,
            'posto_graduacao', NEW.posto_graduacao,
            'matricula', NEW.matricula,
            'nome', NEW.nome,
            'email', NEW.email,
            'profile', NEW.profile,
            'ativo', NEW.ativo
        )
    );
END;

-- Trigger para INSERT em processos_procedimentos
CREATE TRIGGER IF NOT EXISTS trg_audit_processos_insert
AFTER INSERT ON processos_procedimentos
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'processos_procedimentos',
        NEW.id,
        'INSERT',
        json_object(
            'id', NEW.id,
            'numero', NEW.numero,
            'tipo_geral', NEW.tipo_geral,
            'tipo_detalhe', NEW.tipo_detalhe,
            'responsavel_id', NEW.responsavel_id,
            'responsavel_tipo', NEW.responsavel_tipo,
            'ativo', NEW.ativo
        )
    );
END;

-- Trigger para UPDATE em processos_procedimentos
CREATE TRIGGER IF NOT EXISTS trg_audit_processos_update
AFTER UPDATE ON processos_procedimentos
BEGIN
    INSERT INTO auditoria (
        id, tabela, registro_id, operacao, dados_antes, dados_depois
    ) VALUES (
        hex(randomblob(16)),
        'processos_procedimentos',
        NEW.id,
        'UPDATE',
        json_object(
            'id', OLD.id,
            'numero', OLD.numero,
            'tipo_geral', OLD.tipo_geral,
            'tipo_detalhe', OLD.tipo_detalhe,
            'responsavel_id', OLD.responsavel_id,
            'responsavel_tipo', OLD.responsavel_tipo,
            'ativo', OLD.ativo
        ),
        json_object(
            'id', NEW.id,
            'numero', NEW.numero,
            'tipo_geral', NEW.tipo_geral,
            'tipo_detalhe', NEW.tipo_detalhe,
            'responsavel_id', NEW.responsavel_id,
            'responsavel_tipo', NEW.responsavel_tipo,
            'ativo', NEW.ativo
        )
    );
END;

-- ============================================
-- VIEWS PARA CONSULTA DE AUDITORIA
-- ============================================

-- View para auditoria com nomes dos usuários
CREATE VIEW IF NOT EXISTS v_auditoria_detalhada AS
SELECT 
    a.id,
    a.tabela,
    a.registro_id,
    a.operacao,
    CASE 
        WHEN a.usuario_tipo = 'encarregado' THEN e.nome
        WHEN a.usuario_tipo = 'operador' THEN o.nome
        ELSE 'Sistema'
    END as usuario_nome,
    a.usuario_id,
    a.usuario_tipo,
    a.dados_antes,
    a.dados_depois,
    a.timestamp,
    a.observacoes
FROM auditoria a
LEFT JOIN encarregados e ON a.usuario_id = e.id AND a.usuario_tipo = 'encarregado'
LEFT JOIN operadores o ON a.usuario_id = o.id AND a.usuario_tipo = 'operador'
ORDER BY a.timestamp DESC;

-- ============================================
-- FUNÇÃO PARA LIMPEZA DE AUDITORIA ANTIGA
-- ============================================

-- Query para limpar registros de auditoria mais antigos que X dias
-- (deve ser executada periodicamente via script de manutenção)
-- DELETE FROM auditoria WHERE timestamp < datetime('now', '-90 days');

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se a tabela e triggers foram criados
SELECT name, type 
FROM sqlite_master 
WHERE (name = 'auditoria' AND type = 'table') 
   OR (name LIKE 'trg_audit_%' AND type = 'trigger')
   OR (name = 'v_auditoria_detalhada' AND type = 'view')
ORDER BY type, name;
