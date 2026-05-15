-- Migration 0008: Remove tipo_id de crimes_contravencoes e dropa tipos_infracao_penal.
-- A tabela tinha apenas 2 registros fixos ('Crime', 'Contravenção Penal') sem valor de catálogo.
-- DROP COLUMN remove automaticamente a FK constraint em PostgreSQL.

ALTER TABLE crimes_contravencoes DROP COLUMN tipo_id;

DROP TABLE tipos_infracao_penal;
