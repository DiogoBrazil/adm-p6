-- =============================================================================
-- ETAPA 03 — POLICIAIS MILITARES E CONTAS DE ACESSO
--
-- O legado misturava os dois conceitos numa tabela `usuarios` só: 246 linhas,
-- das quais apenas 6 tinham e-mail e senha. Aqui são entidades separadas —
-- toda referência de NEGÓCIO aponta para `policiais_militares`; autenticação e
-- auditoria apontam para `usuarios`.
--
-- Os ids do legado são PRESERVADOS: é o que faz as etapas 04 a 08 casarem sem
-- reconsultar nada.
--
-- NÃO abre transação: quem a abre é scripts/migrar_dados_legados.sh, que roda
-- as oito etapas numa transação só. Um `BEGIN;`/`COMMIT;` aqui dentro encerraria
-- a transação externa no meio, e o resto da carga correria em autocommit — sem
-- erro nenhum, e sem o tudo-ou-nada que a migração exige.
-- =============================================================================

-- --------------------------------------------------- policiais_militares -----
-- ADMIN001 fica de fora: é a conta técnica "Administrador" do sistema
-- anterior, um militar que não existe (CEL PM, matrícula ADMIN001) e que está
-- referenciado em ZERO processos, envolvidos, designações e andamentos. A
-- migration 0002 já semeia a conta técnica equivalente, e o princípio que ela
-- declara é justamente "a conta técnica não inventa militar".
--
-- 'À APURAR'/100000000 também fica de fora, e pela mesma razão: não é uma
-- pessoa, é o marcador de "envolvido ainda não identificado". Desde a 0016 o
-- schema novo o representa como `processo_envolvidos.policial_militar_id IS
-- NULL`, e é a etapa 05 que faz essa conversão. Se ele entrasse aqui como
-- militar, a 0016 não o converteria — ela já rodou — e o sistema passaria a
-- ter um policial fictício vivo no catálogo. O par nome/matrícula é o mesmo
-- que a 0016 usa: uma regra só, num lugar só.
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
   AND NOT (upper(btrim(u.nome)) = 'À APURAR' AND u.matricula = '100000000')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------- promoções -----
-- O `ON CONFLICT DO NOTHING` acima protege quem já existe — e é isso que se
-- quer para nome, matrícula e situação. Mas o POSTO envelhece: o catálogo do
-- destino foi semeado do dump ANTERIOR, e no dump novo dois militares já
-- aparecem promovidos.
--
-- A detecção é pelo dado, não por lista: compara o posto do legado (com o mesmo
-- alias de sigla usado acima — sem ele apareceriam 10 diferenças, e 8 seriam só
-- 'ST PM' contra 'SUB TEN PM') com o que está gravado. Dá exatamente 2.
--
-- E é conferida contra o que se espera encontrar, nos DOIS sentidos: promoção
-- não prevista, ou prevista que não apareceu, aborta a transação. Posto é o que
-- decide círculo hierárquico e precedência — mudar um em silêncio é alterar
-- fato funcional de uma pessoa real.
CREATE TEMP TABLE tmp_promocao ON COMMIT DROP AS
SELECT pm.id, pm.matricula, pm.nome,
       pg_atual.sigla AS posto_atual,
       pg_novo.id     AS posto_novo_id,
       pg_novo.sigla  AS posto_novo
  FROM legado.usuarios u
  JOIN policiais_militares pm     ON pm.id = u.id::uuid
  JOIN postos_graduacoes pg_atual ON pg_atual.id = pm.posto_graduacao_id
  JOIN LATERAL (VALUES
      (CASE u.posto_graduacao
           WHEN 'TC PM' THEN 'TEN CEL PM'
           WHEN 'ST PM' THEN 'SUB TEN PM'
           ELSE u.posto_graduacao
       END)
  ) AS alias(sigla) ON true
  JOIN postos_graduacoes pg_novo  ON lower(pg_novo.sigla) = lower(alias.sigla)
 WHERE u.matricula <> 'ADMIN001'
   AND NOT (upper(btrim(u.nome)) = 'À APURAR' AND u.matricula = '100000000')
   AND pg_novo.id <> pm.posto_graduacao_id;

DO $$
DECLARE inesperada text;
BEGIN
    SELECT string_agg(format('%s (%s: %s -> %s)', nome, matricula, posto_atual, posto_novo),
                      '; ' ORDER BY matricula)
      INTO inesperada
      FROM tmp_promocao
     WHERE (matricula, posto_atual, posto_novo) NOT IN (
         ('100062644', '1º SGT PM', 'SUB TEN PM'),   -- CLAUDEMIR ARAUJO DOS SANTOS SALVALAIO
         ('100085466', 'CAP PM',    'MAJ PM')        -- FABIANA CAVALCANTE MIRANDA
     );
    IF inesperada IS NOT NULL THEN
        RAISE EXCEPTION
            'mudança de posto não prevista no dump: %. Confira antes de migrar — posto define círculo hierárquico e precedência.',
            inesperada;
    END IF;
END $$;

UPDATE policiais_militares pm
   SET posto_graduacao_id = t.posto_novo_id,
       updated_at         = now()
  FROM tmp_promocao t
 WHERE pm.id = t.id;

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

