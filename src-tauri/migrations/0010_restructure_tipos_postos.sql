-- Apaga dados dependentes (CASCADE para FK em auditoria e procedimentos)
TRUNCATE auditoria CASCADE;
TRUNCATE usuarios CASCADE;
TRUNCATE postos_graduacoes CASCADE;
TRUNCATE tipos_usuario CASCADE;

-- tipos_usuario: renomear codigo->nome, remover descricao, adicionar timestamps
ALTER TABLE tipos_usuario RENAME COLUMN codigo TO nome;
ALTER TABLE tipos_usuario DROP COLUMN descricao;
ALTER TABLE tipos_usuario ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tipos_usuario ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- postos_graduacoes: remover codigo, descricao, ordem_hierarquica; adicionar nome e updated_at
ALTER TABLE postos_graduacoes
    DROP COLUMN codigo,
    DROP COLUMN descricao,
    DROP COLUMN ordem_hierarquica;
ALTER TABLE postos_graduacoes ADD COLUMN nome TEXT NOT NULL DEFAULT 'temp';
ALTER TABLE postos_graduacoes ALTER COLUMN nome DROP DEFAULT;
ALTER TABLE postos_graduacoes ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Seed: tipo e posto para o admin
INSERT INTO tipos_usuario (nome, ativo, created_at, updated_at)
VALUES ('Administrador', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO postos_graduacoes (nome, tipo, ativo, created_at, updated_at)
VALUES ('Administrador', 'Administrador', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed: usuario admin (senha: admin123, bcrypt cost 12)
INSERT INTO usuarios (
    tipo_usuario_id, posto_graduacao_id, perfil_id,
    nome, matricula, is_encarregado, is_operador,
    email, senha, ativo, created_at, updated_at
)
SELECT tu.id, pg.id, pa.id,
       'ADMINISTRADOR', 'ADMIN', false, true,
       'admin@sistema.com',
       '$2b$12$W4Eq14PEWBKwx4y5jUzV/.fCYfKPZE0/RbyAefp70vy028oPCofWO',
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tipos_usuario tu
CROSS JOIN postos_graduacoes pg
LEFT JOIN perfis_acesso pa ON pa.codigo = 'admin'
WHERE tu.nome = 'Administrador'
  AND pg.nome = 'Administrador';
