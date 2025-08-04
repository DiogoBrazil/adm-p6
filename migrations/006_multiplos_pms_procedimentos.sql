-- Migração para suportar múltiplos PMs em procedimentos
-- Arquivo: migrations/006_multiplos_pms_procedimentos.sql

-- Backup dos dados existentes
CREATE TEMPORARY TABLE backup_pms_envolvidos AS
SELECT id, nome_pm_id, status_pm, tipo_geral 
FROM processos_procedimentos 
WHERE nome_pm_id IS NOT NULL;

-- Para procedimentos existentes com PM único, converter para formato JSON array
UPDATE processos_procedimentos 
SET nome_pm_id = json_array(json_object('pm_id', nome_pm_id, 'status', status_pm))
WHERE tipo_geral = 'procedimento' 
  AND nome_pm_id IS NOT NULL 
  AND nome_pm_id NOT LIKE '[%';

-- Para processos, manter como está (somente um PM)
-- Não fazemos nada para processos pois eles continuam com apenas um PM

-- Adicionar nova coluna para armazenar múltiplos status (JSON)
-- Como SQLite não suporta ADD COLUMN com CHECK, vamos usar a coluna status_pm existente para armazenar JSON quando necessário

-- Atualizar comentário da estrutura
-- nome_pm_id: Para processos = ID único do PM | Para procedimentos = JSON array de objetos {pm_id, status}
-- status_pm: Para processos = status único | Para procedimentos = 'MULTIPLOS' (indicador)
