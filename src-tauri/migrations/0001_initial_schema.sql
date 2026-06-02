-- Migration 0001: Schema normalizado inicial do ADM P6
-- Cria o schema completo e normalizado para adm_p6_db_normalized.
-- Inclui todas as tabelas lookup com seed data e tabelas core normalizadas.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Tabelas lookup
-- ============================================================

CREATE TABLE tipos_usuario (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO tipos_usuario (codigo, descricao) VALUES
    ('Oficial', 'Oficial'),
    ('Praça',   'Praça'),
    ('Outro',   'Outro');

CREATE TABLE perfis_acesso (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO perfis_acesso (codigo, descricao) VALUES
    ('admin', 'Administrador'),
    ('comum',  'Usuário Comum');

CREATE TABLE tipos_detalhe_processo (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          TEXT    NOT NULL UNIQUE,
    descricao       TEXT    NOT NULL,
    tipo_geral      TEXT    NOT NULL,
    prazo_base_dias INTEGER NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO tipos_detalhe_processo (codigo, descricao, tipo_geral, prazo_base_dias) VALUES
    ('PAD',  'Processo Administrativo Disciplinar',   'processo',     30),
    ('PADE', 'Processo Apuratório de Dano ao Erário', 'processo',     30),
    ('CD',   'Conselho de Disciplina',                'processo',     30),
    ('CJ',   'Conselho de Justificação',              'processo',     30),
    ('SR',   'Sindicância de Responsabilidade',       'procedimento', 30),
    ('SV',   'Sindicância Verbal',                    'procedimento', 15),
    ('IPM',  'Inquérito Policial Militar',            'processo',     40),
    ('FP',   'Feito Preliminar',                      'procedimento', 30),
    ('CP',   'Carta Precatória',                      'procedimento', 30),
    ('PADS', 'PAD Simplificado',                      'processo',     30);

CREATE TABLE documentos_iniciadores (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO documentos_iniciadores (codigo, descricao) VALUES
    ('Portaria',              'Portaria'),
    ('Memorando Disciplinar', 'Memorando Disciplinar'),
    ('Feito Preliminar',      'Feito Preliminar'),
    ('Ofício',                'Ofício'),
    ('Despacho',              'Despacho'),
    ('Outro',                 'Outro');

CREATE TABLE solucoes_tipo (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO solucoes_tipo (codigo, descricao) VALUES
    ('Punido',     'Punido'),
    ('Absolvido',  'Absolvido'),
    ('Arquivado',  'Arquivado'),
    ('Homologado', 'Homologado'),
    ('Avocado',    'Avocado');

CREATE TABLE tipos_penalidade (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO tipos_penalidade (codigo, descricao) VALUES
    ('Prisão',                         'Prisão'),
    ('Detenção',                       'Detenção'),
    ('Advertência',                    'Advertência'),
    ('Repreensão',                     'Repreensão'),
    ('Licenciado a bem da disciplina', 'Licenciado a bem da disciplina'),
    ('Excluído a bem da disciplina',   'Excluído a bem da disciplina'),
    ('Demitido ex-ofício',             'Demitido ex-ofício');

CREATE TABLE natureza_transgressao (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO natureza_transgressao (codigo, descricao) VALUES
    ('leve',  'Leve'),
    ('media', 'Média'),
    ('grave', 'Grave');

CREATE TABLE status_envolvido (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO status_envolvido (codigo, descricao) VALUES
    ('Sindicado',   'Sindicado'),
    ('Acusado',     'Acusado'),
    ('Indiciado',   'Indiciado'),
    ('Investigado', 'Investigado');

CREATE TABLE tipo_doc_autorizacao_prazo (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO tipo_doc_autorizacao_prazo (codigo, descricao) VALUES
    ('Portaria',  'Portaria'),
    ('Memorando', 'Memorando'),
    ('Despacho',  'Despacho'),
    ('Ofício',    'Ofício'),
    ('Outro',     'Outro');

CREATE TABLE tipos_prazo (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO tipos_prazo (codigo, descricao) VALUES
    ('inicial',     'Prazo Inicial'),
    ('prorrogacao', 'Prorrogação');

CREATE TABLE tipos_infracao_penal (
    id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo    TEXT    NOT NULL UNIQUE,
    descricao TEXT    NOT NULL,
    ativo     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO tipos_infracao_penal (codigo, descricao) VALUES
    ('Crime',              'Crime'),
    ('Contravenção Penal', 'Contravenção Penal');

-- ============================================================
-- Catálogos de dados (populados via aplicação ou importação)
-- ============================================================

CREATE TABLE locais_origem (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo     TEXT    NOT NULL,
    descricao  TEXT    NOT NULL,
    tipo       TEXT,
    ativo      BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE postos_graduacoes (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            TEXT    NOT NULL,
    descricao         TEXT    NOT NULL,
    tipo              TEXT    NOT NULL,
    ordem_hierarquica INTEGER NOT NULL,
    ativo             BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE municipios_distritos (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT    NOT NULL,
    tipo          TEXT    NOT NULL,
    municipio_pai TEXT,
    ativo         BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crimes_contravencoes (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_id           UUID,
    dispositivo_legal TEXT    NOT NULL,
    artigo            TEXT    NOT NULL,
    descricao_artigo  TEXT    NOT NULL,
    paragrafo         TEXT,
    inciso            TEXT,
    alinea            TEXT,
    ativo             BOOLEAN NOT NULL DEFAULT true,
    data_criacao      DATE    NOT NULL DEFAULT CURRENT_DATE,
    data_atualizacao  DATE    NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT fk_crime_tipo FOREIGN KEY (tipo_id) REFERENCES tipos_infracao_penal(id)
);
CREATE INDEX ix_crimes_ativo ON crimes_contravencoes (ativo);

CREATE TABLE transgressoes (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo       INTEGER,
    gravidade_id UUID    NOT NULL,
    inciso       TEXT    NOT NULL,
    texto        TEXT    NOT NULL,
    ativo        BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trans_grav FOREIGN KEY (gravidade_id) REFERENCES natureza_transgressao(id)
);
CREATE INDEX ix_trans_ativo ON transgressoes (ativo);

CREATE TABLE infracoes_estatuto_art29 (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    inciso     TEXT    NOT NULL,
    texto      TEXT    NOT NULL,
    ativo      BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_art29_ativo  ON infracoes_estatuto_art29 (ativo);
CREATE INDEX ix_art29_inciso ON infracoes_estatuto_art29 (inciso);

-- ============================================================
-- Usuários
-- ============================================================

CREATE TABLE usuarios (
    id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nome               TEXT    NOT NULL,
    matricula          TEXT    NOT NULL,
    tipo_usuario_id    UUID    NOT NULL,
    posto_graduacao_id UUID    NOT NULL,
    perfil_id          UUID,
    is_encarregado     BOOLEAN NOT NULL DEFAULT false,
    is_operador        BOOLEAN NOT NULL DEFAULT false,
    email              TEXT,
    senha              TEXT,
    ativo              BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usr_tipo   FOREIGN KEY (tipo_usuario_id)    REFERENCES tipos_usuario(id),
    CONSTRAINT fk_usr_posto  FOREIGN KEY (posto_graduacao_id) REFERENCES postos_graduacoes(id),
    CONSTRAINT fk_usr_perfil FOREIGN KEY (perfil_id)          REFERENCES perfis_acesso(id)
);
CREATE INDEX ix_user_nome        ON usuarios (nome);
CREATE INDEX ix_user_encarregado ON usuarios (is_encarregado) WHERE ativo = true;
CREATE INDEX ix_user_operador    ON usuarios (is_operador)    WHERE ativo = true;

-- ============================================================
-- Processos / Procedimentos (tabela de roteamento)
-- Cada processo/procedimento tem uma entrada aqui + uma entrada
-- na tabela tipo-específica que compartilha o mesmo id.
-- ============================================================

CREATE TABLE processos_procedimentos (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    tipo_detalhe_id UUID NOT NULL,
    CONSTRAINT pk_processos_procedimentos PRIMARY KEY (id),
    CONSTRAINT fk_proc_tipo_det FOREIGN KEY (tipo_detalhe_id) REFERENCES tipos_detalhe_processo(id)
);

-- ============================================================
-- Prazos
-- ============================================================

CREATE TABLE prazos_processo (
    id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id        UUID    NOT NULL,
    data_inicio        DATE    NOT NULL,
    data_vencimento    DATE    NOT NULL,
    dias_adicionados   INTEGER NOT NULL DEFAULT 0,
    motivo             TEXT,
    autorizado_por     TEXT,
    numero_portaria    TEXT,
    data_portaria      DATE,
    ordem_prorrogacao  INTEGER,
    tipo_prazo_id      UUID    NOT NULL,
    autorizado_tipo_id UUID,
    ativo              BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prazo_proc     FOREIGN KEY (processo_id)        REFERENCES processos_procedimentos(id),
    CONSTRAINT fk_prazo_tipo     FOREIGN KEY (tipo_prazo_id)      REFERENCES tipos_prazo(id),
    CONSTRAINT fk_prazo_aut_tipo FOREIGN KEY (autorizado_tipo_id) REFERENCES tipo_doc_autorizacao_prazo(id)
);
CREATE INDEX ix_prazo_proc ON prazos_processo (processo_id);
CREATE INDEX ix_prazo_venc ON prazos_processo (data_vencimento) WHERE ativo = true;

-- ============================================================
-- PMs envolvidos e indícios
-- ============================================================

CREATE TABLE procedimento_pms_envolvidos (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    procedimento_id  UUID    NOT NULL,
    pm_id            UUID    NOT NULL,
    ordem            INTEGER NOT NULL DEFAULT 1,
    status_pm_id     UUID,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pme_proc    FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id),
    CONSTRAINT fk_pme_pm_user FOREIGN KEY (pm_id)           REFERENCES usuarios(id),
    CONSTRAINT fk_pme_status  FOREIGN KEY (status_pm_id)    REFERENCES status_envolvido(id)
);

CREATE TABLE pm_envolvido_indicios (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    procedimento_id     UUID    NOT NULL,
    pm_envolvido_id     UUID    NOT NULL,
    categorias_indicios JSONB   NOT NULL DEFAULT '[]'::jsonb,
    categoria           TEXT,
    ativo               BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pei_proc FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id),
    CONSTRAINT fk_pei_pme  FOREIGN KEY (pm_envolvido_id) REFERENCES procedimento_pms_envolvidos(id)
);
CREATE INDEX ix_pei_categ_gin ON pm_envolvido_indicios USING GIN (categorias_indicios);

CREATE TABLE pm_envolvido_crimes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_indicios_id UUID NOT NULL,
    crime_id       UUID NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pec_pei   FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id),
    CONSTRAINT fk_pec_crime FOREIGN KEY (crime_id)        REFERENCES crimes_contravencoes(id)
);

CREATE TABLE pm_envolvido_rdpm (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_indicios_id  UUID NOT NULL,
    transgressao_id UUID NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_per_pei   FOREIGN KEY (pm_indicios_id)  REFERENCES pm_envolvido_indicios(id),
    CONSTRAINT fk_per_trans FOREIGN KEY (transgressao_id) REFERENCES transgressoes(id)
);

CREATE TABLE pm_envolvido_art29 (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_indicios_id UUID NOT NULL,
    art29_id       UUID NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pea_pei   FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id),
    CONSTRAINT fk_pea_art29 FOREIGN KEY (art29_id)       REFERENCES infracoes_estatuto_art29(id)
);

-- ============================================================
-- Mapas e Relatórios
-- ============================================================

CREATE TABLE mapas_salvos (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo            TEXT    NOT NULL,
    tipo_processo     TEXT    NOT NULL,
    periodo_inicio    DATE    NOT NULL,
    periodo_fim       DATE    NOT NULL,
    periodo_descricao TEXT    NOT NULL,
    total_processos   INTEGER NOT NULL DEFAULT 0,
    total_concluidos  INTEGER NOT NULL DEFAULT 0,
    total_andamento   INTEGER NOT NULL DEFAULT 0,
    usuario_id        UUID    NOT NULL,
    usuario_nome      TEXT    NOT NULL,
    dados_mapa        JSONB   NOT NULL DEFAULT '{}'::jsonb,
    arquivo_pdf       BYTEA,
    nome_arquivo      TEXT,
    data_geracao      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ativo             BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mapa_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE INDEX ix_mapas_dados_gin ON mapas_salvos USING GIN (dados_mapa);

-- ============================================================
-- Auditoria
-- ============================================================

CREATE TABLE auditoria (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela      TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacao    TEXT NOT NULL,
    usuario_id  UUID,
    timestamp   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_auditoria_tabela      ON auditoria (tabela);
CREATE INDEX idx_auditoria_registro_id ON auditoria (registro_id);
CREATE INDEX idx_auditoria_operacao    ON auditoria (operacao);
CREATE INDEX idx_auditoria_timestamp   ON auditoria ("timestamp" DESC);
CREATE INDEX idx_auditoria_usuario_id  ON auditoria (usuario_id);
