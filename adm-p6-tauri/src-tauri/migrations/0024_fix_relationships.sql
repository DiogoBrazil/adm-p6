-- 1. transgressoes: (inciso, artigo_id) deve ser único
--    Impede duas transgressoes com mesmo inciso no mesmo artigo RDPM
CREATE UNIQUE INDEX transgressoes_inciso_artigo_uq
  ON transgressoes (inciso, artigo_id);

-- 2. crimes_contravencoes: combinação (artigo, paragrafo, inciso, alinea) deve ser única
--    NULLS NOT DISTINCT: dois NULLs na mesma coluna são considerados iguais (PostgreSQL 15+)
CREATE UNIQUE INDEX crimes_combinacao_uq
  ON crimes_contravencoes (artigo, paragrafo, inciso, alinea)
  NULLS NOT DISTINCT;

-- 3. crimes_contravencoes: dispositivo_legal_id passa a ser obrigatório
ALTER TABLE crimes_contravencoes
  ALTER COLUMN dispositivo_legal_id SET NOT NULL;

-- 4. municipios_distritos.municipio_pai: TEXT → UUID + FK self-referencial
--    Os dados existentes já armazenam UUIDs válidos como texto
ALTER TABLE municipios_distritos
  ALTER COLUMN municipio_pai TYPE UUID USING municipio_pai::uuid;

ALTER TABLE municipios_distritos
  ADD CONSTRAINT municipios_distritos_municipio_pai_fkey
  FOREIGN KEY (municipio_pai) REFERENCES municipios_distritos(id);
