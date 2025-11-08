-- ============================================================================
-- COMANDOS SQL PARA CONFIGURAR POSTGRESQL
-- Execute estes comandos no servidor Windows (192.168.0.137)
-- usando pgAdmin ou psql como superusuário (postgres)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASSO 1: Conectar ao banco app_db
-- ----------------------------------------------------------------------------
\c app_db;


-- ----------------------------------------------------------------------------
-- PASSO 2: Conceder Permissões ao app_user
-- ----------------------------------------------------------------------------

-- Permissão no schema public
GRANT ALL PRIVILEGES ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;

-- Permissões em tabelas existentes (se houver)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;

-- Permissões em sequences (para auto-increment)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Permissões padrão para futuras tabelas
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON TABLES TO app_user;

-- Permissões padrão para futuras sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON SEQUENCES TO app_user;


-- ----------------------------------------------------------------------------
-- PASSO 3: Verificar Permissões (Consultas de Verificação)
-- ----------------------------------------------------------------------------

-- Listar permissões do app_user
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'app_user';

-- Verificar proprietário do schema
SELECT nspname AS schema_name, nspowner::regrole AS owner
FROM pg_namespace 
WHERE nspname = 'public';

-- Verificar permissões no schema
\dn+ public


-- ----------------------------------------------------------------------------
-- PASSO 4: (OPCIONAL) Testar Criação de Tabela
-- ----------------------------------------------------------------------------

-- Teste se app_user pode criar tabelas
CREATE TABLE teste_permissoes (
    id SERIAL PRIMARY KEY,
    nome TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Se funcionou, inserir dado de teste
INSERT INTO teste_permissoes (nome) VALUES ('Teste OK');

-- Consultar
SELECT * FROM teste_permissoes;

-- Deletar tabela de teste
DROP TABLE teste_permissoes;


-- ============================================================================
-- ALTERNATIVA: Recriar Usuário com Todas as Permissões
-- (Use isto SOMENTE se a opção acima não funcionar)
-- ============================================================================

-- ATENÇÃO: Isto vai deletar e recriar o usuário app_user
-- Execute SOMENTE se necessário!

-- Conectar ao banco postgres (não app_db)
-- \c postgres;

-- Remover conexões ativas (se houver)
-- SELECT pg_terminate_backend(pid) 
-- FROM pg_stat_activity 
-- WHERE datname = 'app_db' AND pid <> pg_backend_pid();

-- Deletar banco e usuário
-- DROP DATABASE IF EXISTS app_db;
-- DROP USER IF EXISTS app_user;

-- Recriar usuário com mais privilégios
-- CREATE USER app_user WITH PASSWORD 'p67bpm' CREATEDB;

-- Recriar banco com app_user como owner
-- CREATE DATABASE app_db OWNER app_user;

-- Conectar ao novo banco
-- \c app_db;

-- Garantir permissões completas
-- GRANT ALL ON SCHEMA public TO app_user;
-- ALTER SCHEMA public OWNER TO app_user;


-- ============================================================================
-- CONSULTAS ÚTEIS DE DIAGNÓSTICO
-- ============================================================================

-- Ver todos os bancos de dados
SELECT datname FROM pg_database ORDER BY datname;

-- Ver todos os usuários/roles
SELECT rolname FROM pg_roles ORDER BY rolname;

-- Ver conexões ativas
SELECT 
    pid,
    usename,
    datname,
    client_addr,
    state
FROM pg_stat_activity
WHERE datname = 'app_db';

-- Ver tamanho do banco
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'app_db';

-- Listar tabelas existentes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Contar registros em tabelas (após migração)
SELECT 
    table_name,
    (xpath('/row/c/text()', 
           query_to_xml(format('SELECT COUNT(*) AS c FROM %I.%I', 
                              table_schema, table_name), 
                       false, true, '')))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- ============================================================================
-- FIM DOS COMANDOS
-- ============================================================================

-- Após executar os comandos acima, volte para o Linux e execute:
-- python teste_rapido_pg.py
-- python migrar_dados.py
