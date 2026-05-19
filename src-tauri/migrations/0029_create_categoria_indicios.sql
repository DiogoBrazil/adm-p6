-- Migration 0029: Catálogo de categorias de indícios.
CREATE TABLE categoria_indicios (
    id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome_indicio TEXT NOT NULL,
    ativo        BOOLEAN   NOT NULL DEFAULT true,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
