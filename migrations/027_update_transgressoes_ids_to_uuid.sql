-- Migração 027: Atualizar IDs de transgressões do Art. 29 no campo transgressoes_ids (de INTEGER para UUID)

-- Primeiro, vamos mapear os IDs antigos (1-21) para os novos UUIDs baseados no inciso
-- Como a ordem dos incisos é sequencial (I, II, III...), podemos fazer o mapeamento direto

-- Criar função temporária para converter os IDs
CREATE OR REPLACE FUNCTION converter_transgressoes_ids() RETURNS void AS $$
DECLARE
    processo RECORD;
    transgressoes_json jsonb;
    transgressoes_array jsonb;
    transgressao jsonb;
    novo_array jsonb := '[]'::jsonb;
    old_id INTEGER;
    new_id TEXT;
BEGIN
    -- Iterar sobre todos os processos que têm transgressoes_ids
    FOR processo IN 
        SELECT id, transgressoes_ids 
        FROM processos_procedimentos 
        WHERE transgressoes_ids IS NOT NULL 
        AND transgressoes_ids != '' 
        AND transgressoes_ids != '[]'
    LOOP
        -- Parse do JSON
        BEGIN
            transgressoes_json := processo.transgressoes_ids::jsonb;
            novo_array := '[]'::jsonb;
            
            -- Processar cada transgressão
            FOR transgressao IN SELECT * FROM jsonb_array_elements(transgressoes_json)
            LOOP
                -- Se for tipo estatuto, precisa converter o ID
                IF transgressao->>'tipo' = 'estatuto' THEN
                    old_id := (transgressao->>'id')::INTEGER;
                    
                    -- Buscar o novo UUID do mapeamento (da migração 026)
                    SELECT i.id INTO new_id 
                    FROM infracoes_estatuto_art29 i
                    WHERE i.id::text IN (
                        SELECT new_id FROM (
                            VALUES 
                            (1, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'I' LIMIT 1)),
                            (2, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'II' LIMIT 1)),
                            (3, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'III' LIMIT 1)),
                            (4, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'IV' LIMIT 1)),
                            (5, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'V' LIMIT 1)),
                            (6, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'VI' LIMIT 1)),
                            (7, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'VII' LIMIT 1)),
                            (8, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'VIII' LIMIT 1)),
                            (9, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'IX' LIMIT 1)),
                            (10, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'X' LIMIT 1)),
                            (11, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XI' LIMIT 1)),
                            (12, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XII' LIMIT 1)),
                            (13, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XIII' LIMIT 1)),
                            (14, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XIV' LIMIT 1)),
                            (15, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XV' LIMIT 1)),
                            (16, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XVI' LIMIT 1)),
                            (17, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XVII' LIMIT 1)),
                            (18, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XVIII' LIMIT 1)),
                            (19, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XIX' LIMIT 1)),
                            (20, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XX' LIMIT 1)),
                            (21, (SELECT id FROM infracoes_estatuto_art29 WHERE inciso = 'XXI' LIMIT 1))
                        ) AS mapping(old_id, new_id)
                        WHERE mapping.old_id = old_id
                    );
                    
                    -- Substituir o ID antigo pelo novo UUID
                    IF new_id IS NOT NULL THEN
                        transgressao := jsonb_set(transgressao, '{id}', to_jsonb(new_id));
                        RAISE NOTICE 'Convertendo ID % para % no processo %', old_id, new_id, processo.id;
                    END IF;
                END IF;
                
                -- Adicionar ao novo array
                novo_array := novo_array || transgressao;
            END LOOP;
            
            -- Atualizar o registro com o novo array
            UPDATE processos_procedimentos 
            SET transgressoes_ids = novo_array::text 
            WHERE id = processo.id;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao processar processo %: %', processo.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar a conversão
SELECT converter_transgressoes_ids();

-- Remover a função temporária
DROP FUNCTION converter_transgressoes_ids();

-- Verificação
SELECT 'Migração concluída!' as status,
       (SELECT COUNT(*) FROM processos_procedimentos WHERE transgressoes_ids LIKE '%estatuto%') as processos_com_estatuto;
