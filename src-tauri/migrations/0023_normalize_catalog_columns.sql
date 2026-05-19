-- Migration 0023: Normalizar nomes de colunas em 8 tabelas de catálogo.
-- Torna os nomes descritivos e únicos, sem nome/tipo/codigo genéricos.

-- 1. postos_graduacoes: nome → nome_posto_graduacao + unique index
ALTER TABLE postos_graduacoes RENAME COLUMN nome TO nome_posto_graduacao;
CREATE UNIQUE INDEX postos_graduacoes_nome_key ON postos_graduacoes (nome_posto_graduacao);

-- 2. perfis_acesso: codigo → nome_perfil, drop descricao, add timestamps
ALTER TABLE perfis_acesso RENAME COLUMN codigo TO nome_perfil;
ALTER TABLE perfis_acesso DROP COLUMN IF EXISTS descricao;
ALTER TABLE perfis_acesso ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE perfis_acesso ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. tipos_usuario: nome → nome_tipo_usuario
ALTER TABLE tipos_usuario RENAME COLUMN nome TO nome_tipo_usuario;

-- 4. tipos_documentos: tipo → nome_tipo_documento
ALTER TABLE tipos_documentos RENAME COLUMN tipo TO nome_tipo_documento;

-- 5. municipios_distritos: nome → nome_municipio_distrito + unique index
ALTER TABLE municipios_distritos RENAME COLUMN nome TO nome_municipio_distrito;
CREATE UNIQUE INDEX municipios_distritos_nome_key ON municipios_distritos (nome_municipio_distrito);

-- 6. locais_origem: unidade_pm → nome_unidade_pm + unique index
ALTER TABLE locais_origem RENAME COLUMN unidade_pm TO nome_unidade_pm;
CREATE UNIQUE INDEX locais_origem_nome_key ON locais_origem (nome_unidade_pm);

-- 7. dispositivos_legais: nome → nome_dispositivo_legal
ALTER TABLE dispositivos_legais RENAME COLUMN nome TO nome_dispositivo_legal;

-- 8. tipo_apuratorios: tipo → nome_tipo_apuratorio
ALTER TABLE tipo_apuratorios RENAME COLUMN tipo TO nome_tipo_apuratorio;

-- v_processos: removida (queries migradas para tabelas individuais)
DROP VIEW IF EXISTS v_processos;
