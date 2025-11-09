-- Migração 026: Converter id de infracoes_estatuto_art29 de INTEGER para UUID (TEXT)

-- 1. Criar tabela temporária para mapear IDs antigos para novos UUIDs
CREATE TABLE IF NOT EXISTS temp_art29_id_mapping (
    old_id INTEGER PRIMARY KEY,
    new_id TEXT NOT NULL UNIQUE
);

-- 2. Gerar UUIDs para todos os registros existentes
INSERT INTO temp_art29_id_mapping (old_id, new_id)
SELECT id, gen_random_uuid()::text
FROM infracoes_estatuto_art29;

-- 3. Remover constraints de FK temporariamente
ALTER TABLE pm_envolvido_art29 DROP CONSTRAINT IF EXISTS pm_envolvido_art29_art29_id_fkey;

-- 4. Adicionar colunas temporárias com novos UUIDs nas tabelas relacionadas
ALTER TABLE pm_envolvido_art29 ADD COLUMN art29_id_new TEXT;
ALTER TABLE procedimentos_indicios_art29 ADD COLUMN art29_id_new TEXT;

-- 5. Atualizar as colunas temporárias com os novos UUIDs
UPDATE pm_envolvido_art29 pea
SET art29_id_new = t.new_id
FROM temp_art29_id_mapping t
WHERE pea.art29_id = t.old_id;

UPDATE procedimentos_indicios_art29 pia
SET art29_id_new = t.new_id
FROM temp_art29_id_mapping t
WHERE pia.art29_id = t.old_id;

-- 6. Adicionar coluna temporária na tabela principal
ALTER TABLE infracoes_estatuto_art29 ADD COLUMN id_new TEXT;

-- 7. Atualizar com os novos UUIDs
UPDATE infracoes_estatuto_art29 i
SET id_new = t.new_id
FROM temp_art29_id_mapping t
WHERE i.id = t.old_id;

-- 8. Remover constraints da coluna id antiga
ALTER TABLE infracoes_estatuto_art29 DROP CONSTRAINT IF EXISTS infracoes_estatuto_art29_pkey;

-- 9. Remover colunas antigas
ALTER TABLE pm_envolvido_art29 DROP COLUMN art29_id;
ALTER TABLE procedimentos_indicios_art29 DROP COLUMN art29_id;
ALTER TABLE infracoes_estatuto_art29 DROP COLUMN id;

-- 10. Renomear colunas novas para os nomes originais
ALTER TABLE pm_envolvido_art29 RENAME COLUMN art29_id_new TO art29_id;
ALTER TABLE procedimentos_indicios_art29 RENAME COLUMN art29_id_new TO art29_id;
ALTER TABLE infracoes_estatuto_art29 RENAME COLUMN id_new TO id;

-- 11. Adicionar NOT NULL constraints
ALTER TABLE infracoes_estatuto_art29 ALTER COLUMN id SET NOT NULL;
ALTER TABLE pm_envolvido_art29 ALTER COLUMN art29_id SET NOT NULL;
ALTER TABLE procedimentos_indicios_art29 ALTER COLUMN art29_id SET NOT NULL;

-- 12. Recriar PRIMARY KEY
ALTER TABLE infracoes_estatuto_art29 ADD PRIMARY KEY (id);

-- 13. Recriar FOREIGN KEYS
ALTER TABLE pm_envolvido_art29 
    ADD CONSTRAINT pm_envolvido_art29_art29_id_fkey 
    FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id);

ALTER TABLE procedimentos_indicios_art29 
    ADD CONSTRAINT procedimentos_indicios_art29_art29_id_fkey 
    FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id);

-- 14. Limpar tabela temporária
DROP TABLE temp_art29_id_mapping;

-- Verificação final
SELECT 'Migração concluída!' as status,
       (SELECT COUNT(*) FROM infracoes_estatuto_art29) as total_infracoes,
       (SELECT COUNT(*) FROM pm_envolvido_art29) as total_pm_envolvido,
       (SELECT COUNT(*) FROM procedimentos_indicios_art29) as total_procedimentos_indicios;
