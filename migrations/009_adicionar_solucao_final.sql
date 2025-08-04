-- Migração 009: Adicionar campo solução final
-- Data: 2025-08-04
-- Descrição: Adiciona campo para armazenar a solução final quando processo/procedimento é concluído

-- Adicionar coluna solucao_final à tabela processos_procedimentos
ALTER TABLE processos_procedimentos ADD COLUMN solucao_final TEXT;

-- Criar índice para facilitar consultas por status de conclusão
CREATE INDEX IF NOT EXISTS idx_processos_concluido ON processos_procedimentos(concluido);

-- Comentário sobre a coluna
-- solucao_final: Campo de texto livre para descrever a solução final do processo/procedimento
-- Obrigatório quando concluido = 1, pode ser NULL caso contrário
