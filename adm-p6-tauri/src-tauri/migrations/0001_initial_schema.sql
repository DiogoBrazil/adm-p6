-- Migration 0001: Schema inicial do ADM P6
-- Aplicado diretamente no banco em 2026-05-12.
-- Este arquivo é registro histórico do schema criado.

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Catálogos / Tabelas de referência
-- ============================================================

CREATE TABLE IF NOT EXISTS locais_origem (
    id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS postos_graduacoes (
    id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome  TEXT NOT NULL,
    sigla TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS naturezas (
    id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS municipios_distritos (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome         TEXT NOT NULL,
    tipo         TEXT,
    municipio_pai TEXT,
    ativo        BOOLEAN DEFAULT true,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crimes_contravencoes (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tipo             TEXT,
    dispositivo_legal TEXT,
    artigo           TEXT NOT NULL,
    descricao_artigo TEXT,
    paragrafo        TEXT,
    inciso           TEXT,
    alinea           TEXT,
    ativo            BOOLEAN DEFAULT true,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transgressoes (
    id        SERIAL PRIMARY KEY,
    artigo    INTEGER,
    gravidade TEXT,
    inciso    TEXT,
    texto     TEXT NOT NULL,
    ativo     BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS infracoes_estatuto_art29 (
    id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    inciso TEXT NOT NULL,
    texto  TEXT NOT NULL,
    ativo  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Usuários / Autenticação
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome           TEXT NOT NULL,
    matricula      TEXT,
    posto_graduacao TEXT,
    email          TEXT,
    senha_hash     TEXT,
    perfil         TEXT NOT NULL DEFAULT 'usuario',
    ativo          BOOLEAN DEFAULT true,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessoes (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Processos / Procedimentos
-- ============================================================

CREATE TABLE IF NOT EXISTS processos_procedimentos (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    numero                  TEXT NOT NULL,
    tipo_geral              TEXT NOT NULL,
    tipo_detalhe            TEXT NOT NULL,
    documento_iniciador     TEXT NOT NULL,
    processo_sei            TEXT,
    responsavel_id          TEXT REFERENCES usuarios(id),
    responsavel_tipo        TEXT,
    local_origem            TEXT,
    local_fatos             TEXT,
    data_instauracao        DATE,
    data_recebimento        DATE,
    escrivao_id             TEXT REFERENCES usuarios(id),
    status_pm               TEXT,
    nome_pm_id              TEXT REFERENCES usuarios(id),
    nome_vitima             TEXT,
    natureza_processo       TEXT,
    natureza_procedimento   TEXT,
    resumo_fatos            TEXT,
    numero_portaria         TEXT,
    numero_memorando        TEXT,
    numero_feito            TEXT,
    numero_rgf              TEXT,
    numero_controle         TEXT,
    concluido               BOOLEAN DEFAULT false,
    data_conclusao          DATE,
    solucao_final           TEXT,
    solucao_tipo            TEXT,
    penalidade_tipo         TEXT,
    penalidade_dias         INTEGER,
    transgressoes_ids       TEXT,
    ano_instauracao         TEXT,
    data_remessa_encarregado DATE,
    data_julgamento         DATE,
    presidente_id           TEXT REFERENCES usuarios(id),
    presidente_tipo         TEXT,
    interrogante_id         TEXT REFERENCES usuarios(id),
    interrogante_tipo       TEXT,
    escrivao_processo_id    TEXT REFERENCES usuarios(id),
    escrivao_processo_tipo  TEXT,
    motorista_id            TEXT REFERENCES usuarios(id),
    andamentos              JSONB DEFAULT '[]'::jsonb,
    historico_encarregados  JSONB DEFAULT '[]'::jsonb,
    pdf_arquivo             BYTEA,
    pdf_nome                TEXT,
    pdf_content_type        TEXT,
    pdf_tamanho             BIGINT,
    pdf_upload_em           TIMESTAMP,
    dados_mapa              JSONB,
    ativo                   BOOLEAN DEFAULT true,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procedimento_pms_envolvidos (
    id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    procedimento_id  TEXT NOT NULL REFERENCES processos_procedimentos(id),
    pm_id            TEXT NOT NULL REFERENCES usuarios(id),
    pm_tipo          TEXT NOT NULL DEFAULT 'usuario',
    status_pm        TEXT,
    ordem            INTEGER,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Prazos
-- ============================================================

CREATE TABLE IF NOT EXISTS prazos_processo (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    processo_id       TEXT NOT NULL REFERENCES processos_procedimentos(id),
    tipo_prazo        TEXT NOT NULL DEFAULT 'inicial',
    data_inicio       DATE NOT NULL,
    data_vencimento   DATE NOT NULL,
    dias_adicionados  INTEGER,
    motivo            TEXT,
    autorizado_por    TEXT,
    autorizado_tipo   TEXT,
    numero_portaria   TEXT,
    data_portaria     DATE,
    ordem_prorrogacao INTEGER,
    ativo             BOOLEAN DEFAULT true,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indícios (evidências)
-- ============================================================

CREATE TABLE IF NOT EXISTS pm_envolvido_indicios (
    id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pm_envolvido_id   TEXT NOT NULL REFERENCES procedimento_pms_envolvidos(id),
    procedimento_id   TEXT NOT NULL REFERENCES processos_procedimentos(id),
    categorias_indicios JSONB DEFAULT '[]'::jsonb,
    categoria         TEXT DEFAULT '',
    ativo             BOOLEAN DEFAULT true,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_envolvido_crimes (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pm_indicios_id TEXT NOT NULL REFERENCES pm_envolvido_indicios(id),
    crime_id       TEXT NOT NULL REFERENCES crimes_contravencoes(id),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_envolvido_rdpm (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pm_indicios_id TEXT NOT NULL REFERENCES pm_envolvido_indicios(id),
    transgressao_id INTEGER NOT NULL REFERENCES transgressoes(id),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_envolvido_art29 (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    pm_indicios_id TEXT NOT NULL REFERENCES pm_envolvido_indicios(id),
    art29_id       TEXT NOT NULL REFERENCES infracoes_estatuto_art29(id),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Mapas e Relatórios
-- ============================================================

CREATE TABLE IF NOT EXISTS relatorios_salvos (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tipo        TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    dados       JSONB NOT NULL,
    criado_por  TEXT REFERENCES usuarios(id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Auditoria
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tabela       TEXT NOT NULL,
    registro_id  TEXT NOT NULL,
    operacao     TEXT NOT NULL,
    usuario_id   TEXT REFERENCES usuarios(id),
    timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
