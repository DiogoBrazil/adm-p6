-- Limpar registros existentes (tabelas de processo dependentes estão vazias)
DELETE FROM apuratorios;

-- Adicionar coluna FK obrigatória
ALTER TABLE apuratorios
  ADD COLUMN documento_iniciador_id UUID NOT NULL
  REFERENCES tipos_documentos(id);
