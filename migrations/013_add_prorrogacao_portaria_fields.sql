-- MIGRAÇÃO 013: Campos de prorrogação (portaria e sequência) em prazos_processo

-- Adiciona campos para rastrear informações de prorrogações: número e data da portaria e a ordem da prorrogação

ALTER TABLE prazos_processo ADD COLUMN numero_portaria TEXT;
ALTER TABLE prazos_processo ADD COLUMN data_portaria DATE;
ALTER TABLE prazos_processo ADD COLUMN ordem_prorrogacao INTEGER;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_prazos_ordem_prorrogacao 
ON prazos_processo(processo_id, ordem_prorrogacao);
