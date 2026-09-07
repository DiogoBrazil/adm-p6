-- =============================================================================
-- Seed técnico mínimo — SOMENTE o indispensável para autenticar.
--
-- Nenhum catálogo de negócio é semeado: nem apuratórios, nem tipos de documento,
-- nem naturezas, legislações, transgressões, crimes, soluções, penalidades,
-- categorias, municípios, unidades, postos ou círculos hierárquicos. Todos devem
-- ser cadastrados pelo próprio administrador, pela aplicação. Se algum comando
-- quebrar por pressupor que um deles já existe, é o comando que está errado —
-- expor isso é um objetivo desta etapa.
--
-- Também não é criado nenhum policial militar fictício: usuarios.policial_militar_id
-- é opcional justamente para que a conta técnica não precise inventar um militar,
-- um posto e um círculo hierárquico só para satisfazer FKs.
-- =============================================================================

INSERT INTO perfis_acesso (nome, pode_administrar)
VALUES ('Administrador', true);

-- Senha de DESENVOLVIMENTO: "123456" (bcrypt, custo 12).
-- DEVE ser alterada no primeiro acesso de qualquer instalação real.
INSERT INTO usuarios (policial_militar_id, nome_exibicao, email, senha_hash, perfil_id)
SELECT
    NULL,
    'ADMINISTRADOR DO SISTEMA',
    'admin@sistema.com',
    '$2b$12$xzvhgJNwcna/trr03Irp5OjzA8jzNVuzW6bAm0AoXbK5Nky9OnuLG',
    p.id
FROM perfis_acesso p
WHERE p.nome = 'Administrador';
