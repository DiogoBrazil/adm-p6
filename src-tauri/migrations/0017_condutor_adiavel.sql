-- Trocar o condutor entre dois envolvidos numa única gravação falhava.
--
-- `uq_envolvido_condutor` nasceu na 0001 como índice único parcial, e índice
-- não se adia. O repositório grava envolvido a envolvido, na ordem do
-- formulário: marcar o de cima antes de desmarcar o de baixo colide no meio da
-- transação, mesmo com o estado final tendo um só condutor. Pior, o erro saía
-- traduzido como "Só pode haver um condutor por processo." — a frase certa para
-- a regra errada, porque havia exatamente um.
--
-- Uma constraint `EXCLUDE` faz o mesmo que o índice parcial, com a diferença
-- que importa: pode ser DEFERRABLE. A unicidade passa a ser conferida no
-- `commit`, quando o processo já está no estado que o usuário pediu. A trava
-- continua no banco — quem burlar o formulário esbarra nela do mesmo jeito.
--
-- A 0016 adiou `uq_envolvido_pm` e `uq_envolvido_ordem` pelo mesmo motivo. Ver
-- a armadilha do `ON CONFLICT` na seção 7 do GUIA antes de escrever upsert
-- nesta tabela: constraint adiada não serve de árbitro.
DROP INDEX uq_envolvido_condutor;

ALTER TABLE processo_envolvidos
    ADD CONSTRAINT uq_envolvido_condutor
        EXCLUDE (processo_id WITH =) WHERE (e_condutor)
        DEFERRABLE INITIALLY DEFERRED;
