-- Script para adicionar a coluna local_origem à tabela processos_procedimentos
-- Execute este script para corrigir o erro "table processos_procedimentos has no column named local_origem"

-- Verificar se a coluna já existe (prevenção)
PRAGMA table_info(processos_procedimentos);

-- Adicionar a coluna se ela não existir
ALTER TABLE processos_procedimentos ADD COLUMN local_origem TEXT;

-- Verificar a estrutura da tabela após a alteração
PRAGMA table_info(processos_procedimentos);
