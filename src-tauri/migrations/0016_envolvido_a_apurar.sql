-- Um envolvido pode existir antes de o policial militar ser identificado.
-- Nesse estado, `policial_militar_id = NULL` significa "À apurar". O vínculo
-- continua sendo uma linha real, com id próprio, para que enquadramentos,
-- indícios e resultados sobrevivam quando o PM for identificado depois.

ALTER TABLE processo_envolvidos
    DROP CONSTRAINT uq_envolvido_pm,
    DROP CONSTRAINT uq_envolvido_ordem;

ALTER TABLE processo_envolvidos
    ALTER COLUMN policial_militar_id DROP NOT NULL;

-- As duas restrições são adiadas até o COMMIT. Isso permite reordenar linhas e
-- corrigir/trocar dois militares na mesma transação sem conflito intermediário.
ALTER TABLE processo_envolvidos
    ADD CONSTRAINT uq_envolvido_pm
        UNIQUE (processo_id, policial_militar_id)
        DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT uq_envolvido_ordem
        UNIQUE (processo_id, ordem)
        DEFERRABLE INITIALLY DEFERRED;

-- NULLs não participam de uma UNIQUE comum. Este índice limita o marcador
-- coletivo "À apurar" a uma linha por processo.
CREATE UNIQUE INDEX uq_envolvido_a_apurar
    ON processo_envolvidos (processo_id)
    WHERE policial_militar_id IS NULL;

ALTER TABLE processo_envolvidos
    ADD CONSTRAINT ck_envolvido_condutor_identificado
        CHECK (NOT e_condutor OR policial_militar_id IS NOT NULL);

-- Converte apenas o cadastro artificial conhecido, identificado pelo par
-- nome/matrícula. O id do envolvido não muda, portanto seus dados filhos e o
-- histórico permanecem intactos.
UPDATE processo_envolvidos e
   SET policial_militar_id = NULL,
       e_condutor = false,
       updated_at = now()
  FROM policiais_militares pm
 WHERE pm.id = e.policial_militar_id
   AND upper(trim(pm.nome)) = 'À APURAR'
   AND pm.matricula = '100000000';

UPDATE policiais_militares
   SET ativo = false,
       updated_at = now()
 WHERE upper(trim(nome)) = 'À APURAR'
   AND matricula = '100000000';

COMMENT ON COLUMN processo_envolvidos.policial_militar_id IS
    'NULL indica envolvido ainda não identificado (À apurar).';
