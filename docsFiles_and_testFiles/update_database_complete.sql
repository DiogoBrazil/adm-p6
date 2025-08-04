-- Script para adicionar todas as colunas faltantes à tabela processos_procedimentos
-- Execute este script para adicionar as colunas restantes que estão faltando no banco de dados

-- Verificar as colunas atuais
PRAGMA table_info(processos_procedimentos);

-- Adicionar colunas que podem estar faltando
ALTER TABLE processos_procedimentos ADD COLUMN data_instauracao DATE;
ALTER TABLE processos_procedimentos ADD COLUMN data_recebimento DATE;
ALTER TABLE processos_procedimentos ADD COLUMN escrivao_id TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN status_pm TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN nome_pm_id TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN nome_vitima TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN natureza_processo TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN natureza_procedimento TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN resumo_fatos TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN numero_portaria TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN numero_memorando TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN numero_feito TEXT;
ALTER TABLE processos_procedimentos ADD COLUMN numero_rgf TEXT;

-- Verificar novamente a estrutura da tabela após as alterações
PRAGMA table_info(processos_procedimentos);
