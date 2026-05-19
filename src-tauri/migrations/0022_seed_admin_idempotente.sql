-- Migration 0022: Seed idempotente — garante dados mínimos sem apagar existentes.
-- Idempotente: seguro para re-executar; não apaga usuários reais.

-- Garantir tipos_usuario mínimos (tipos_usuario tem UNIQUE em nome)
INSERT INTO tipos_usuario (nome, ativo, created_at, updated_at)
VALUES
  ('Praça',   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Oficial', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Outro',   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (nome) DO NOTHING;

-- Garantir posto "Outro" com tipo_usuario_id correto (sem UNIQUE em nome → WHERE NOT EXISTS)
INSERT INTO postos_graduacoes (nome, tipo_usuario_id, ativo, created_at, updated_at)
SELECT 'Outro', tu.id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tipos_usuario tu
WHERE tu.nome = 'Outro'
  AND NOT EXISTS (SELECT 1 FROM postos_graduacoes WHERE nome = 'Outro');

-- Atualizar senha do admin para "123456" (bcrypt cost 12)
UPDATE usuarios
SET senha      = '$2b$12$2twFGqfU2yckDUTC3ttZdOAZhnP/./5v5ED9JD0od2i/DcJZKe/.e',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@sistema.com';

-- Criar admin se não existir
INSERT INTO usuarios (
    tipo_usuario_id, posto_graduacao_id, perfil_id,
    nome, matricula, is_encarregado, is_operador,
    email, senha, ativo, created_at, updated_at
)
SELECT pg.tipo_usuario_id, pg.id, pa.id,
       'ADMINISTRADOR', '100012345', false, true,
       'admin@sistema.com',
       '$2b$12$2twFGqfU2yckDUTC3ttZdOAZhnP/./5v5ED9JD0od2i/DcJZKe/.e',
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM postos_graduacoes pg
CROSS JOIN perfis_acesso pa
WHERE pg.nome = 'Outro'
  AND pa.codigo = 'admin'
  AND NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'admin@sistema.com');
