-- Query para listar todas as tabelas existentes no banco de dados SQLite
-- Esta query consulta a tabela sqlite_master que contém metadados sobre o banco

SELECT 
    name AS nome_tabela,
    type AS tipo,
    sql AS comando_criacao
FROM sqlite_master 
WHERE type = 'table' 
  AND name NOT LIKE 'sqlite_%'  -- Exclui tabelas internas do SQLite
ORDER BY name;

-- Query alternativa mais simples (apenas nomes das tabelas)
-- SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';

-- Query para ver detalhes de uma tabela específica (substitua 'nome_da_tabela')
-- PRAGMA table_info(nome_da_tabela);

-- Query para ver todas as tabelas com informações mais detalhadas
SELECT 
    m.name AS tabela,
    m.type AS tipo,
    COUNT(p.name) AS total_colunas
FROM sqlite_master m
LEFT JOIN pragma_table_info(m.name) p ON 1=1
WHERE m.type = 'table' 
  AND m.name NOT LIKE 'sqlite_%'
GROUP BY m.name, m.type
ORDER BY m.name;

-- ======================================================
-- QUERY ESPECÍFICA PARA TABELA PROCESSOS_PROCEDIMENTOS
-- ======================================================

-- Consultar estrutura completa da tabela processos_procedimentos
PRAGMA table_info(processos_procedimentos);

-- Query mais detalhada das colunas da tabela processos_procedimentos
SELECT 
    cid AS ordem,
    name AS nome_coluna,
    type AS tipo_dados,
    "notnull" AS nao_nulo,
    dflt_value AS valor_padrao,
    pk AS chave_primaria
FROM pragma_table_info('processos_procedimentos')
ORDER BY cid;

-- Query para ver o comando SQL que criou a tabela
SELECT sql 
FROM sqlite_master 
WHERE type = 'table' 
  AND name = 'processos_procedimentos';

-- Query para contar registros na tabela
SELECT COUNT(*) AS total_registros 
FROM processos_procedimentos;

-- Query para ver alguns dados de exemplo (primeiros 3 registros)
SELECT * 
FROM processos_procedimentos 
WHERE ativo = 1
ORDER BY created_at DESC 
LIMIT 3;
