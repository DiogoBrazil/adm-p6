-- ============================================
-- MIGRAÇÃO 002: Implementar Índices para Performance
-- ============================================

-- ============================================
-- ÍNDICES PARA TABELA processos_procedimentos
-- ============================================

-- Índice para consultas por responsável (mais usado)
CREATE INDEX IF NOT EXISTS idx_processos_responsavel 
ON processos_procedimentos(responsavel_id, responsavel_tipo);

-- Índice para ordenação por data de criação
CREATE INDEX IF NOT EXISTS idx_processos_created_at 
ON processos_procedimentos(created_at DESC);

-- Índice para filtros por tipo
CREATE INDEX IF NOT EXISTS idx_processos_tipo 
ON processos_procedimentos(tipo_geral, tipo_detalhe);

-- Índice para registros ativos (soft delete)
CREATE INDEX IF NOT EXISTS idx_processos_ativo 
ON processos_procedimentos(ativo);

-- Índice para data de instauração (relatórios)
CREATE INDEX IF NOT EXISTS idx_processos_data_instauracao 
ON processos_procedimentos(data_instauracao);

-- Índice para documento iniciador
CREATE INDEX IF NOT EXISTS idx_processos_documento 
ON processos_procedimentos(documento_iniciador);

-- Índice para PM envolvido
CREATE INDEX IF NOT EXISTS idx_processos_nome_pm 
ON processos_procedimentos(nome_pm_id);

-- Índice para escrivão
CREATE INDEX IF NOT EXISTS idx_processos_escrivao 
ON processos_procedimentos(escrivao_id);

-- Índice composto para consultas complexas (tipo + ativo + data)
CREATE INDEX IF NOT EXISTS idx_processos_tipo_ativo_data 
ON processos_procedimentos(tipo_geral, ativo, created_at DESC);

-- ============================================
-- ÍNDICES PARA TABELA encarregados
-- ============================================

-- Índice para registros ativos
CREATE INDEX IF NOT EXISTS idx_encarregados_ativo 
ON encarregados(ativo);

-- Índice para busca por nome (relatórios)
CREATE INDEX IF NOT EXISTS idx_encarregados_nome 
ON encarregados(nome);

-- Índice para email (login de encarregados)
CREATE INDEX IF NOT EXISTS idx_encarregados_email 
ON encarregados(email) WHERE email IS NOT NULL;

-- Índice para matrícula (busca)
CREATE INDEX IF NOT EXISTS idx_encarregados_matricula 
ON encarregados(matricula);

-- ============================================
-- ÍNDICES PARA TABELA operadores
-- ============================================

-- Índice para registros ativos
CREATE INDEX IF NOT EXISTS idx_operadores_ativo 
ON operadores(ativo);

-- Índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_operadores_nome 
ON operadores(nome);

-- Índice para login (email + senha)
CREATE INDEX IF NOT EXISTS idx_operadores_login 
ON operadores(email, senha);

-- Índice para perfil
CREATE INDEX IF NOT EXISTS idx_operadores_profile 
ON operadores(profile);

-- Índice para matrícula
CREATE INDEX IF NOT EXISTS idx_operadores_matricula 
ON operadores(matricula);

-- ============================================
-- VERIFICAÇÃO DOS ÍNDICES CRIADOS
-- ============================================

-- Listar todos os índices criados
SELECT name, tbl_name, sql 
FROM sqlite_master 
WHERE type = 'index' 
  AND name LIKE 'idx_%'
ORDER BY tbl_name, name;

-- Estatísticas das tabelas após criação dos índices
SELECT 
    name as tabela,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=name) as total_indices
FROM sqlite_master 
WHERE type='table' 
  AND name IN ('encarregados', 'operadores', 'processos_procedimentos');
