-- ============================================
-- QUERIES PARA CONSULTAR TABELA DE PROCEDIMENTOS
-- ============================================

-- 1. QUERY COMPLETA - Todos os campos com relacionamentos
SELECT 
    -- Informações básicas do procedimento
    p.id,
    p.numero,
    p.tipo_geral,
    p.tipo_detalhe,
    p.documento_iniciador,
    p.processo_sei,
    p.numero_portaria,
    p.numero_memorando,
    p.numero_feito,
    p.numero_rgf,
    
    -- Informações do responsável (encarregado)
    p.responsavel_id,
    p.responsavel_tipo,
    CASE 
        WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.nome
        WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.nome
        ELSE 'Desconhecido'
    END as responsavel_completo,
    
    -- Informações do PM envolvido
    p.nome_pm_id,
    p.status_pm,
    CASE 
        WHEN p.nome_pm_id IS NOT NULL THEN (
            SELECT 
                CASE 
                    WHEN u_tipo.tipo = 'encarregado' THEN enc.posto_graduacao || ' ' || enc.nome
                    WHEN u_tipo.tipo = 'operador' THEN op.posto_graduacao || ' ' || op.nome
                    ELSE 'Desconhecido'
                END
            FROM (
                SELECT 'encarregado' as tipo FROM encarregados WHERE id = p.nome_pm_id
                UNION ALL
                SELECT 'operador' as tipo FROM operadores WHERE id = p.nome_pm_id
            ) u_tipo
            LEFT JOIN encarregados enc ON enc.id = p.nome_pm_id AND u_tipo.tipo = 'encarregado'
            LEFT JOIN operadores op ON op.id = p.nome_pm_id AND u_tipo.tipo = 'operador'
            LIMIT 1
        )
        ELSE 'Não informado'
    END as nome_pm_completo,
    
    -- Informações complementares
    p.local_origem,
    p.data_instauracao,
    p.data_recebimento,
    p.escrivao_id,
    p.nome_vitima,
    p.natureza_processo,
    p.natureza_procedimento,
    p.resumo_fatos,
    
    -- Informações de controle
    p.created_at,
    p.updated_at,
    p.ativo,
    
    -- Ano extraído (para a nova estrutura da tabela)
    CASE 
        WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
        WHEN p.numero LIKE '%20%' THEN substr(p.numero, -4)
        ELSE strftime('%Y', p.created_at)
    END as ano_procedimento

FROM processos_procedimentos p
LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
WHERE p.ativo = 1
ORDER BY p.created_at DESC;

-- ============================================
-- 2. QUERY SIMPLIFICADA - Para verificação rápida
-- ============================================
SELECT 
    p.numero,
    p.tipo_detalhe,
    p.documento_iniciador,
    CASE 
        WHEN p.responsavel_tipo = 'encarregado' THEN e.nome
        WHEN p.responsavel_tipo = 'operador' THEN o.nome
        ELSE 'Desconhecido'
    END as responsavel,
    p.status_pm,
    p.created_at
FROM processos_procedimentos p
LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
WHERE p.ativo = 1
ORDER BY p.created_at DESC;

-- ============================================
-- 3. QUERY FORMATADA PARA A NOVA ESTRUTURA DA TABELA
-- (Baseada nas colunas: Ano, Número, Tipo, Encarregado, PM Envolvido, Tipo de Envolvimento, Ações)
-- ============================================
SELECT 
    -- Ano
    CASE 
        WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
        WHEN p.numero LIKE '%20%' THEN substr(p.numero, -4)
        ELSE strftime('%Y', p.created_at)
    END as ano,
    
    -- Número
    p.numero,
    
    -- Tipo
    p.tipo_detalhe || ' - ' || p.documento_iniciador as tipo_completo,
    
    -- Encarregado
    CASE 
        WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.nome
        WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.nome
        ELSE 'Não informado'
    END as encarregado,
    
    -- PM Envolvido
    CASE 
        WHEN p.nome_pm_id IS NOT NULL THEN (
            SELECT 
                CASE 
                    WHEN u_tipo.tipo = 'encarregado' THEN enc.nome
                    WHEN u_tipo.tipo = 'operador' THEN op.nome
                    ELSE 'Desconhecido'
                END
            FROM (
                SELECT 'encarregado' as tipo FROM encarregados WHERE id = p.nome_pm_id
                UNION ALL
                SELECT 'operador' as tipo FROM operadores WHERE id = p.nome_pm_id
            ) u_tipo
            LEFT JOIN encarregados enc ON enc.id = p.nome_pm_id AND u_tipo.tipo = 'encarregado'
            LEFT JOIN operadores op ON op.id = p.nome_pm_id AND u_tipo.tipo = 'operador'
            LIMIT 1
        )
        ELSE 'Não informado'
    END as pm_envolvido,
    
    -- Tipo de Envolvimento
    COALESCE(p.status_pm, 'Não informado') as tipo_envolvimento,
    
    -- ID para as ações (editar/excluir)
    p.id

FROM processos_procedimentos p
LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
WHERE p.ativo = 1
ORDER BY p.created_at DESC;

-- ============================================
-- 4. QUERY PARA ESTATÍSTICAS - Contar registros por tipo
-- ============================================
SELECT 
    p.tipo_detalhe,
    p.documento_iniciador,
    COUNT(*) as total_registros
FROM processos_procedimentos p
WHERE p.ativo = 1
GROUP BY p.tipo_detalhe, p.documento_iniciador
ORDER BY total_registros DESC;

-- ============================================
-- 5. QUERY PARA VERIFICAR REGISTROS RECENTES
-- ============================================
SELECT 
    p.numero,
    p.tipo_detalhe,
    p.created_at,
    datetime(p.created_at, 'localtime') as data_criacao_local
FROM processos_procedimentos p
WHERE p.ativo = 1
ORDER BY p.created_at DESC
LIMIT 10;
