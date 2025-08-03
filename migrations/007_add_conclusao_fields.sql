-- Migração 007: Adicionar campos de conclusão
-- Data: 2025-08-03
-- Descrição: Adiciona colunas 'concluido' (boolean) e 'data_conclusao' (date) à tabela processos_procedimentos

-- Adicionar coluna 'concluido' (boolean, padrão False)
ALTER TABLE processos_procedimentos ADD COLUMN concluido BOOLEAN DEFAULT 0;

-- Adicionar coluna 'data_conclusao' (date, nullable)
ALTER TABLE processos_procedimentos ADD COLUMN data_conclusao DATE;

-- Atualizar todos os registros existentes para definir concluido como False (0)
UPDATE processos_procedimentos SET concluido = 0 WHERE concluido IS NULL;

-- Criar índice para performance nas consultas por status de conclusão
CREATE INDEX idx_processos_concluido ON processos_procedimentos(concluido);

-- Criar índice composto para consultas por conclusão e data
CREATE INDEX idx_processos_conclusao_data ON processos_procedimentos(concluido, data_conclusao);
