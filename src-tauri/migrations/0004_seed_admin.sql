-- Migration 0004: Seed do usuário administrador
-- Senha padrão: admin123 (bcrypt cost 12)
-- Trocar a senha no primeiro acesso.

INSERT INTO postos_graduacoes (codigo, descricao, tipo, ordem_hierarquica)
SELECT 'CEL PM', 'Coronel PM', 'oficial', 1
WHERE NOT EXISTS (SELECT 1 FROM postos_graduacoes WHERE codigo = 'CEL PM');

INSERT INTO usuarios
    (nome, matricula, tipo_usuario_id, posto_graduacao_id, perfil_id,
     is_encarregado, is_operador, email, senha, ativo)
SELECT
    'Administrador',
    '000000',
    tu.id,
    pg.id,
    pa.id,
    false,
    true,
    'admin@admp6.local',
    '$2b$12$W4Eq14PEWBKwx4y5jUzV/.fCYfKPZE0/RbyAefp70vy028oPCofWO',
    true
FROM tipos_usuario     tu
JOIN postos_graduacoes pg ON pg.codigo = 'CEL PM'
JOIN perfis_acesso     pa ON pa.codigo = 'admin'
WHERE tu.codigo = 'Oficial'
  AND NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@admp6.local');
