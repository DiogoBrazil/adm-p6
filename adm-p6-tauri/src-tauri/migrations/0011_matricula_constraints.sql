-- Corrigir admin seed para matricula valida
UPDATE usuarios SET matricula = '100000001' WHERE matricula = 'ADMIN';

-- Adicionar constraint de formato
ALTER TABLE usuarios
    ADD CONSTRAINT chk_matricula_formato
    CHECK (length(matricula) = 9 AND (matricula LIKE '1000%' OR matricula LIKE '3000%'));

-- Adicionar constraint de unicidade (case-insensitive via expressao)
CREATE UNIQUE INDEX uix_matricula ON usuarios (lower(matricula));
