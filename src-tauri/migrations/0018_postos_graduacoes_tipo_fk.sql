-- Migration 0018: Converter postos_graduacoes.tipo TEXT
-- para tipo_usuario_id UUID FK → tipos_usuario.

-- Preservar registros existentes de postos_graduacoes (usuarios apontam para eles).
-- Apenas troca a coluna tipo TEXT por tipo_usuario_id UUID (nullable no início;
-- admin preenche o tipo de cada posto via interface depois da migration).
ALTER TABLE postos_graduacoes DROP COLUMN IF EXISTS tipo;
ALTER TABLE postos_graduacoes
    ADD COLUMN IF NOT EXISTS tipo_usuario_id UUID REFERENCES tipos_usuario(id);
