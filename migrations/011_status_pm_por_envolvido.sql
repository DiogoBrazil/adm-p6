-- ============================================
-- MIGRAÇÃO 011: Status por PM Envolvido
-- ============================================
-- Objetivo: adicionar coluna status_pm na tabela de relacionamento
-- procedimento_pms_envolvidos e replicar o status atual do
-- processo/procedimento (processos_procedimentos.status_pm) para
-- cada PM já vinculado, evitando incompatibilidades.

BEGIN TRANSACTION;

-- Adicionar coluna status_pm para cada PM envolvido
ALTER TABLE procedimento_pms_envolvidos 
ADD COLUMN status_pm TEXT; -- opcionalmente manter NULL quando não definido

-- Replicar status do processo/procedimento existente para os PMs já vinculados
UPDATE procedimento_pms_envolvidos AS pme
SET status_pm = (
    SELECT p.status_pm 
    FROM processos_procedimentos AS p 
    WHERE p.id = pme.procedimento_id
);

-- Índice auxiliar para futuras consultas/filtragens
CREATE INDEX IF NOT EXISTS idx_pme_procedimento_status 
ON procedimento_pms_envolvidos(procedimento_id, status_pm);

COMMIT;
