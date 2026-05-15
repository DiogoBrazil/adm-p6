-- Migration 0006: Seed completo dos postos e graduações da PMRO
-- Dados extraídos do banco legado adm_p6_db.postos_graduacoes (13 registros).
-- Adiciona constraint UNIQUE em codigo (ausente na 0001) e insere todos os postos.

ALTER TABLE postos_graduacoes
    ADD CONSTRAINT postos_graduacoes_codigo_unique UNIQUE (codigo);

INSERT INTO postos_graduacoes (codigo, descricao, tipo, ordem_hierarquica)
VALUES
    ('SD PM',      'Soldado PM',             'praca',   -1),
    ('CB PM',      'Cabo PM',                'praca',    0),
    ('3º SGT PM',  'Terceiro-Sargento PM',   'praca',    1),
    ('2º SGT PM',  'Segundo-Sargento PM',    'praca',    2),
    ('1º SGT PM',  'Primeiro-Sargento PM',   'praca',    3),
    ('SUB TEN PM', 'Subtenente PM',          'praca',    4),
    ('ASP OF PM',  'Aspirante a Oficial PM', 'oficial',  4),
    ('2º TEN PM',  'Segundo-Tenente PM',     'oficial',  5),
    ('1º TEN PM',  'Primeiro-Tenente PM',    'oficial',  6),
    ('CAP PM',     'Capitão PM',             'oficial',  7),
    ('MAJ PM',     'Major PM',               'oficial',  8),
    ('TEN CEL PM', 'Tenente-Coronel PM',     'oficial',  9),
    ('CEL PM',     'Coronel PM',             'oficial', 10)
ON CONFLICT (codigo) DO UPDATE
    SET descricao          = EXCLUDED.descricao,
        tipo               = EXCLUDED.tipo,
        ordem_hierarquica  = EXCLUDED.ordem_hierarquica;
