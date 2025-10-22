-- Migration 023: Adicionar campo 'artigo' à tabela transgressoes
-- Objetivo: Substituir o conceito de gravidade por artigo (15, 16 ou 17)
-- Lógica: Art. 17 = Grave, Art. 16 = Média, Art. 15 = Leve

-- Adicionar nova coluna 'artigo'
ALTER TABLE transgressoes ADD COLUMN artigo INTEGER CHECK(artigo IN (15, 16, 17));

-- Preencher artigo baseado na gravidade existente
UPDATE transgressoes SET artigo = 15 WHERE gravidade = 'leve';
UPDATE transgressoes SET artigo = 16 WHERE gravidade = 'media';
UPDATE transgressoes SET artigo = 17 WHERE gravidade = 'grave';

-- Verificação: Contar registros atualizados por artigo
-- SELECT artigo, COUNT(*) as total FROM transgressoes GROUP BY artigo;
