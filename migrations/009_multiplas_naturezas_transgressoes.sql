-- Migração 009: Suporte a múltiplas naturezas de transgressões
-- Permite que um PADS tenha transgressões de naturezas diferentes

-- Não precisamos alterar a estrutura da tabela, apenas o formato dos dados
-- O campo transgressoes_ids continuará sendo TEXT, mas com formato JSON expandido

-- Exemplo do formato antigo: ["4", "5", "10"]
-- Exemplo do formato novo: [{"id": "4", "natureza": "leve"}, {"id": "5", "natureza": "media"}, {"id": "10", "natureza": "grave"}]

-- Script para converter dados existentes do formato antigo para o novo
UPDATE processos_procedimentos 
SET transgressoes_ids = (
    SELECT JSON_GROUP_ARRAY(
        JSON_OBJECT(
            'id', t_ids.value,
            'natureza', tr.gravidade
        )
    )
    FROM JSON_EACH(processos_procedimentos.transgressoes_ids) as t_ids
    LEFT JOIN transgressoes tr ON tr.id = CAST(t_ids.value AS INTEGER)
    WHERE tr.id IS NOT NULL
)
WHERE transgressoes_ids IS NOT NULL 
AND transgressoes_ids != '' 
AND transgressoes_ids != '[]'
AND JSON_VALID(transgressoes_ids) = 1
AND transgressoes_ids NOT LIKE '%"natureza"%'; -- Só converte se ainda não foi convertido

-- Atualizar campo natureza_processo para "Múltiplas" quando houver mais de uma natureza
UPDATE processos_procedimentos 
SET natureza_processo = 'Múltiplas'
WHERE transgressoes_ids IS NOT NULL 
AND transgressoes_ids != '' 
AND transgressoes_ids != '[]'
AND JSON_VALID(transgressoes_ids) = 1
AND transgressoes_ids LIKE '%"natureza"%'
AND (
    SELECT COUNT(DISTINCT JSON_EXTRACT(trans.value, '$.natureza'))
    FROM JSON_EACH(transgressoes_ids) as trans
) > 1;
