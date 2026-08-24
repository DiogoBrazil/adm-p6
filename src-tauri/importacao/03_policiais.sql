-- =============================================================================
-- ETAPA 03 — POLICIAIS MILITARES E CONTAS DE ACESSO
--
-- O legado misturava os dois conceitos numa tabela `usuarios` só: 236 linhas,
-- das quais apenas 7 tinham e-mail e senha. Aqui são entidades separadas —
-- toda referência de NEGÓCIO aponta para `policiais_militares`; autenticação e
-- auditoria apontam para `usuarios`.
--
-- Os ids do legado são PRESERVADOS: é o que faz as etapas 04 a 08 casarem sem
-- reconsultar nada.
--
-- Roda em transação única.
-- =============================================================================
BEGIN;

-- --------------------------------------------------- policiais_militares -----
-- ADMIN001 fica de fora: é a conta técnica "Administrador" do sistema
-- anterior, um militar que não existe (CEL PM, matrícula ADMIN001) e que está
-- referenciado em ZERO processos, envolvidos, designações e andamentos. A
-- migration 0002 já semeia a conta técnica equivalente, e o princípio que ela
-- declara é justamente "a conta técnica não inventa militar".
--
-- O alias de posto existe porque `usuarios.posto_graduacao` era TEXTO LIVRE no
-- legado e não validava contra o próprio catálogo dele: 1 militar está como
-- 'TC PM' e 7 como 'ST PM', siglas que o catálogo (legado e novo) grafa
-- 'TEN CEL PM' e 'SUB TEN PM'. Sem o alias esses 8 não entrariam.
INSERT INTO policiais_militares (id, matricula, nome, posto_graduacao_id, is_encarregado, ativo)
SELECT u.id::uuid,
       u.matricula,
       u.nome,
       pg.id,
       COALESCE(u.is_encarregado, false),
       COALESCE(u.ativo, true)
  FROM legado.usuarios u
  JOIN LATERAL (VALUES
      (CASE u.posto_graduacao
           WHEN 'TC PM' THEN 'TEN CEL PM'
           WHEN 'ST PM' THEN 'SUB TEN PM'
           ELSE u.posto_graduacao
       END)
  ) AS alias(sigla) ON true
  JOIN postos_graduacoes pg ON lower(pg.sigla) = lower(alias.sigla)
 WHERE u.matricula <> 'ADMIN001'
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------- usuarios -----
-- As 6 contas reais. `senha_hash` recebe o SHA-256 do legado COMO ESTÁ:
-- auth::login reconhece hash de 64 caracteres, valida por ele e o substitui
-- por bcrypt no primeiro acesso (src/auth/commands.rs). Ninguém precisa de
-- senha nova, e ninguém fica com SHA-256 depois de entrar uma vez.
--
-- `perfil_id` é resolvido pelo ATRIBUTO `pode_administrar`, não pelo nome do
-- perfil — renomear "Administrador" não pode mudar quem administra.
--
-- `nome_exibicao` fica NULL: o nome vem do militar vinculado, e o CHECK
-- `ck_usuario_tem_nome` exige exatamente UMA origem para ele.
INSERT INTO usuarios (policial_militar_id, nome_exibicao, email, senha_hash, perfil_id, ativo)
SELECT u.id::uuid,
       NULL,
       u.email,
       u.senha,
       pa.id,
       COALESCE(u.ativo, true)
  FROM legado.usuarios u
  JOIN perfis_acesso pa ON pa.pode_administrar = (u.perfil = 'admin')
 WHERE u.matricula <> 'ADMIN001'
   AND u.email IS NOT NULL
   AND u.senha IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
