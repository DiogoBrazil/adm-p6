-- =================================================================
-- QUERIES PARA CONSULTAR DADOS DOS PROCEDIMENTOS CADASTRADOS
-- =================================================================

-- 1. QUERY BÁSICA - Todos os procedimentos
SELECT * FROM processos_procedimentos ORDER BY created_at DESC;

-- 2. QUERY COMPLETA - Com dados dos responsáveis e PMs
SELECT 
    p.id,
    p.numero,
    p.tipo_geral,
    p.tipo_detalhe,
    p.documento_iniciador,
    p.processo_sei,
    p.local_origem,
    p.data_instauracao,
    p.data_recebimento,
    p.status_pm,
    p.ativo,
    p.created_at,
    -- Responsável
    COALESCE(o_resp.posto_graduacao, e_resp.posto_graduacao, '') || ' ' ||
    COALESCE(o_resp.matricula, e_resp.matricula, '') || ' ' ||
    COALESCE(o_resp.nome, e_resp.nome, 'Desconhecido') as responsavel_completo,
    -- PM Envolvido
    CASE 
        WHEN p.nome_pm_id IS NOT NULL THEN 
            COALESCE(o_pm.posto_graduacao, e_pm.posto_graduacao, '') || ' ' ||
            COALESCE(o_pm.matricula, e_pm.matricula, '') || ' ' ||
            COALESCE(o_pm.nome, e_pm.nome, 'Desconhecido')
        ELSE 'Não informado'
    END as pm_completo
FROM processos_procedimentos p
LEFT JOIN operadores o_resp ON p.responsavel_id = o_resp.id AND p.responsavel_tipo = 'operador'
LEFT JOIN encarregados e_resp ON p.responsavel_id = e_resp.id AND p.responsavel_tipo = 'encarregado'
LEFT JOIN operadores o_pm ON p.nome_pm_id = o_pm.id
LEFT JOIN encarregados e_pm ON p.nome_pm_id = e_pm.id
ORDER BY p.created_at DESC;

-- 3. QUERY RESUMIDA - Formato da tabela de exibição
SELECT 
    CASE 
        WHEN p.data_instauracao IS NOT NULL THEN 
            strftime('%Y', p.data_instauracao)
        ELSE 'N/A'
    END as ano,
    p.numero,
    p.tipo_detalhe as tipo,
    COALESCE(o_resp.posto_graduacao, e_resp.posto_graduacao, '') || ' ' ||
    COALESCE(o_resp.matricula, e_resp.matricula, '') || ' ' ||
    COALESCE(o_resp.nome, e_resp.nome, 'Desconhecido') as encarregado,
    CASE 
        WHEN p.nome_pm_id IS NOT NULL THEN 
            COALESCE(o_pm.posto_graduacao, e_pm.posto_graduacao, '') || ' ' ||
            COALESCE(o_pm.matricula, e_pm.matricula, '') || ' ' ||
            COALESCE(o_pm.nome, e_pm.nome, 'Desconhecido')
        ELSE 'Não informado'
    END as pm_envolvido,
    p.status_pm as tipo_envolvimento,
    CASE WHEN p.ativo = 1 THEN 'Ativo' ELSE 'Inativo' END as status
FROM processos_procedimentos p
LEFT JOIN operadores o_resp ON p.responsavel_id = o_resp.id AND p.responsavel_tipo = 'operador'
LEFT JOIN encarregados e_resp ON p.responsavel_id = e_resp.id AND p.responsavel_tipo = 'encarregado'
LEFT JOIN operadores o_pm ON p.nome_pm_id = o_pm.id
LEFT JOIN encarregados e_pm ON p.nome_pm_id = e_pm.id
ORDER BY p.created_at DESC;

-- 4. QUERY APENAS ATIVOS
SELECT 
    p.numero,
    p.tipo_detalhe,
    p.data_instauracao,
    p.status_pm,
    COALESCE(o_resp.nome, e_resp.nome, 'Desconhecido') as responsavel_nome,
    COALESCE(o_pm.nome, e_pm.nome, 'Não informado') as pm_nome
FROM processos_procedimentos p
LEFT JOIN operadores o_resp ON p.responsavel_id = o_resp.id
LEFT JOIN encarregados e_resp ON p.responsavel_id = e_resp.id
LEFT JOIN operadores o_pm ON p.nome_pm_id = o_pm.id
LEFT JOIN encarregados e_pm ON p.nome_pm_id = e_pm.id
WHERE p.ativo = 1
ORDER BY p.created_at DESC;

-- 5. QUERY PARA CONTAR PROCEDIMENTOS POR STATUS
SELECT 
    CASE WHEN ativo = 1 THEN 'Ativo' ELSE 'Inativo' END as status,
    COUNT(*) as total
FROM processos_procedimentos 
GROUP BY ativo;

-- 6. QUERY PARA CONTAR POR TIPO
SELECT 
    tipo_detalhe,
    COUNT(*) as total
FROM processos_procedimentos 
WHERE ativo = 1
GROUP BY tipo_detalhe
ORDER BY total DESC;

-- 7. QUERY PARA VERIFICAR RESPONSÁVEIS FALTANDO
SELECT 
    p.numero,
    p.responsavel_id,
    p.responsavel_tipo,
    COALESCE(o.nome, e.nome, 'RESPONSÁVEL NÃO ENCONTRADO') as responsavel_nome
FROM processos_procedimentos p
LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
WHERE COALESCE(o.nome, e.nome) IS NULL
ORDER BY p.created_at DESC;
