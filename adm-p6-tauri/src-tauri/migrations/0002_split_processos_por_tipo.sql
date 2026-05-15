-- Migration 0002: Desmembramento de processos_procedimentos por tipo
--
-- Padrão class-table inheritance:
--   processos_procedimentos = tabela de roteamento (id + tipo_detalhe_id)
--   Cada tabela tipo-específica usa o MESMO id como PK e FK para a base.
--
-- Tabelas criadas: 10 (SR, IPM, FP, CP, SV, PADS, PADE, PAD, CD, CJ)
-- Colunas comuns: numero, tipo_geral, processo_sei, responsavel_id,
--   data_instauracao, data_recebimento, numero_rgf, resumo_fatos,
--   solucao_final, andamentos, historico_encarregados, pdf_*, tipo_detalhe_id,
--   documento_iniciador_id, local_origem_id, local_fatos_id, solucao_tipo_id,
--   natureza_processo_id, ativo, concluido, created_at, updated_at

-- ─────────────────────────────────────────────────────────────────
-- 1. sindicancia_regular (SR)
-- Específico: nome_vitima, numero_portaria, data_conclusao,
--             indicios_categorias, data_remessa_encarregado
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE sindicancia_regular (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    nome_vitima              TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    indicios_categorias      JSONB         NOT NULL DEFAULT '[]'::jsonb,
    data_remessa_encarregado DATE,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_sr          PRIMARY KEY (id),
    CONSTRAINT fk_sr_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_sr_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_sr_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_sr_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_sr_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_sr_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_sr_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_sr_numero_doc_ano ON sindicancia_regular
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_sr_ativo            ON sindicancia_regular (ativo);
CREATE INDEX ix_sr_concluido        ON sindicancia_regular (concluido);
CREATE INDEX ix_sr_data_instauracao ON sindicancia_regular (data_instauracao);
CREATE INDEX ix_sr_andamentos       ON sindicancia_regular USING GIN (andamentos);
CREATE INDEX ix_sr_hist_enc         ON sindicancia_regular USING GIN (historico_encarregados);
CREATE INDEX ix_sr_indicios         ON sindicancia_regular USING GIN (indicios_categorias);

-- ─────────────────────────────────────────────────────────────────
-- 2. inquerito_policial_militar (IPM)
-- Específico: escrivao_id, nome_vitima, numero_portaria,
--             data_conclusao, indicios_categorias, data_remessa_encarregado
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE inquerito_policial_militar (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    escrivao_id              UUID,
    nome_vitima              TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    indicios_categorias      JSONB         NOT NULL DEFAULT '[]'::jsonb,
    data_remessa_encarregado DATE,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_ipm          PRIMARY KEY (id),
    CONSTRAINT fk_ipm_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_ipm_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_ipm_escrivao FOREIGN KEY (escrivao_id)            REFERENCES usuarios(id),
    CONSTRAINT fk_ipm_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_ipm_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_ipm_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_ipm_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_ipm_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_ipm_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_ipm_numero_doc_ano ON inquerito_policial_militar
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_ipm_ativo            ON inquerito_policial_militar (ativo);
CREATE INDEX ix_ipm_concluido        ON inquerito_policial_militar (concluido);
CREATE INDEX ix_ipm_data_instauracao ON inquerito_policial_militar (data_instauracao);
CREATE INDEX ix_ipm_andamentos       ON inquerito_policial_militar USING GIN (andamentos);
CREATE INDEX ix_ipm_hist_enc         ON inquerito_policial_militar USING GIN (historico_encarregados);
CREATE INDEX ix_ipm_indicios         ON inquerito_policial_militar USING GIN (indicios_categorias);

-- ─────────────────────────────────────────────────────────────────
-- 3. feito_preliminar (FP)
-- Específico: nome_vitima, numero_feito, data_conclusao, data_remessa_encarregado
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE feito_preliminar (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    nome_vitima              TEXT,
    numero_feito             TEXT,
    data_conclusao           DATE,
    data_remessa_encarregado DATE,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_fp          PRIMARY KEY (id),
    CONSTRAINT fk_fp_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_fp_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_fp_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_fp_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_fp_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_fp_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_fp_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_fp_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_fp_numero_doc_ano ON feito_preliminar
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_fp_ativo            ON feito_preliminar (ativo);
CREATE INDEX ix_fp_concluido        ON feito_preliminar (concluido);
CREATE INDEX ix_fp_data_instauracao ON feito_preliminar (data_instauracao);
CREATE INDEX ix_fp_andamentos       ON feito_preliminar USING GIN (andamentos);
CREATE INDEX ix_fp_hist_enc         ON feito_preliminar USING GIN (historico_encarregados);

-- ─────────────────────────────────────────────────────────────────
-- 4. carta_precatoria (CP)
-- Específico: nome_vitima, numero_portaria, data_remessa_encarregado,
--             unidade_deprecada, deprecante
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE carta_precatoria (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    nome_vitima              TEXT,
    numero_portaria          TEXT,
    data_remessa_encarregado DATE,
    unidade_deprecada        TEXT,
    deprecante               TEXT,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_cp          PRIMARY KEY (id),
    CONSTRAINT fk_cp_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_cp_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_cp_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_cp_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_cp_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_cp_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_cp_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_cp_numero_doc_ano ON carta_precatoria
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_cp_ativo            ON carta_precatoria (ativo);
CREATE INDEX ix_cp_concluido        ON carta_precatoria (concluido);
CREATE INDEX ix_cp_data_instauracao ON carta_precatoria (data_instauracao);
CREATE INDEX ix_cp_andamentos       ON carta_precatoria USING GIN (andamentos);
CREATE INDEX ix_cp_hist_enc         ON carta_precatoria USING GIN (historico_encarregados);

-- ─────────────────────────────────────────────────────────────────
-- 5. sindicancia_verbal (SV)
-- Específico: nome_vitima, numero_portaria, data_conclusao,
--             indicios_categorias, data_remessa_encarregado
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE sindicancia_verbal (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    nome_vitima              TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    indicios_categorias      JSONB         NOT NULL DEFAULT '[]'::jsonb,
    data_remessa_encarregado DATE,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_sv          PRIMARY KEY (id),
    CONSTRAINT fk_sv_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_sv_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_sv_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_sv_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_sv_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_sv_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_sv_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_sv_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_sv_numero_doc_ano ON sindicancia_verbal
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_sv_ativo            ON sindicancia_verbal (ativo);
CREATE INDEX ix_sv_concluido        ON sindicancia_verbal (concluido);
CREATE INDEX ix_sv_data_instauracao ON sindicancia_verbal (data_instauracao);
CREATE INDEX ix_sv_andamentos       ON sindicancia_verbal USING GIN (andamentos);
CREATE INDEX ix_sv_hist_enc         ON sindicancia_verbal USING GIN (historico_encarregados);
CREATE INDEX ix_sv_indicios         ON sindicancia_verbal USING GIN (indicios_categorias);

-- ─────────────────────────────────────────────────────────────────
-- 6. processo_apuratorio_disciplinar_sumario (PADS)
-- Específico: numero_memorando, data_conclusao, indicios_categorias,
--             data_remessa_encarregado, data_julgamento,
--             penalidade_dias, penalidade_tipo_id
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE processo_apuratorio_disciplinar_sumario (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    numero_memorando         TEXT,
    data_conclusao           DATE,
    indicios_categorias      JSONB         NOT NULL DEFAULT '[]'::jsonb,
    data_remessa_encarregado DATE,
    data_julgamento          DATE,
    penalidade_dias          INTEGER,
    penalidade_tipo_id       UUID,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pads          PRIMARY KEY (id),
    CONSTRAINT fk_pads_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_pads_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_pads_pen_tip  FOREIGN KEY (penalidade_tipo_id)     REFERENCES tipos_penalidade(id),
    CONSTRAINT fk_pads_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_pads_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_pads_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_pads_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_pads_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_pads_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_pads_numero_doc_ano ON processo_apuratorio_disciplinar_sumario
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_pads_ativo            ON processo_apuratorio_disciplinar_sumario (ativo);
CREATE INDEX ix_pads_concluido        ON processo_apuratorio_disciplinar_sumario (concluido);
CREATE INDEX ix_pads_data_instauracao ON processo_apuratorio_disciplinar_sumario (data_instauracao);
CREATE INDEX ix_pads_andamentos       ON processo_apuratorio_disciplinar_sumario USING GIN (andamentos);
CREATE INDEX ix_pads_hist_enc         ON processo_apuratorio_disciplinar_sumario USING GIN (historico_encarregados);
CREATE INDEX ix_pads_indicios         ON processo_apuratorio_disciplinar_sumario USING GIN (indicios_categorias);

-- ─────────────────────────────────────────────────────────────────
-- 7. processo_apuratorio_dano_herario (PADE)
-- Específico: numero_portaria, data_conclusao, data_remessa_encarregado,
--             data_julgamento, penalidade_tipo_id
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE processo_apuratorio_dano_herario (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    data_remessa_encarregado DATE,
    data_julgamento          DATE,
    penalidade_tipo_id       UUID,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pade          PRIMARY KEY (id),
    CONSTRAINT fk_pade_base     FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_pade_resp     FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_pade_pen_tip  FOREIGN KEY (penalidade_tipo_id)     REFERENCES tipos_penalidade(id),
    CONSTRAINT fk_pade_tipo_det FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_pade_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_pade_loc_ori  FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_pade_loc_fat  FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_pade_sol_tip  FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_pade_nat_pro  FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_pade_numero_doc_ano ON processo_apuratorio_dano_herario
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_pade_ativo            ON processo_apuratorio_dano_herario (ativo);
CREATE INDEX ix_pade_concluido        ON processo_apuratorio_dano_herario (concluido);
CREATE INDEX ix_pade_data_instauracao ON processo_apuratorio_dano_herario (data_instauracao);
CREATE INDEX ix_pade_andamentos       ON processo_apuratorio_dano_herario USING GIN (andamentos);
CREATE INDEX ix_pade_hist_enc         ON processo_apuratorio_dano_herario USING GIN (historico_encarregados);

-- ─────────────────────────────────────────────────────────────────
-- 8. processo_administrativo_disciplinar (PAD)
-- Específico: numero_portaria, data_conclusao, data_remessa_comissao,
--             data_julgamento, penalidade_dias, penalidade_tipo_id,
--             presidente_id, interrogante_id, escrivao_processo_id
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE processo_administrativo_disciplinar (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    data_remessa_comissao    DATE,
    data_julgamento          DATE,
    penalidade_dias          INTEGER,
    penalidade_tipo_id       UUID,
    presidente_id            UUID,
    interrogante_id          UUID,
    escrivao_processo_id     UUID,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pad             PRIMARY KEY (id),
    CONSTRAINT fk_pad_base        FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_pad_resp        FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_pad_pen_tip     FOREIGN KEY (penalidade_tipo_id)     REFERENCES tipos_penalidade(id),
    CONSTRAINT fk_pad_presidente  FOREIGN KEY (presidente_id)          REFERENCES usuarios(id),
    CONSTRAINT fk_pad_inter       FOREIGN KEY (interrogante_id)        REFERENCES usuarios(id),
    CONSTRAINT fk_pad_escr_proc   FOREIGN KEY (escrivao_processo_id)   REFERENCES usuarios(id),
    CONSTRAINT fk_pad_tipo_det    FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_pad_doc_ini     FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_pad_loc_ori     FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_pad_loc_fat     FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_pad_sol_tip     FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_pad_nat_pro     FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_pad_numero_doc_ano ON processo_administrativo_disciplinar
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_pad_ativo            ON processo_administrativo_disciplinar (ativo);
CREATE INDEX ix_pad_concluido        ON processo_administrativo_disciplinar (concluido);
CREATE INDEX ix_pad_data_instauracao ON processo_administrativo_disciplinar (data_instauracao);
CREATE INDEX ix_pad_andamentos       ON processo_administrativo_disciplinar USING GIN (andamentos);
CREATE INDEX ix_pad_hist_enc         ON processo_administrativo_disciplinar USING GIN (historico_encarregados);

-- ─────────────────────────────────────────────────────────────────
-- 9. conselho_disciplina (CD)
-- Específico: numero_portaria, data_conclusao, data_remessa_comissao,
--             data_julgamento, penalidade_dias, penalidade_tipo_id,
--             presidente_id, interrogante_id, escrivao_processo_id
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE conselho_disciplina (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    data_remessa_comissao    DATE,
    data_julgamento          DATE,
    penalidade_dias          INTEGER,
    penalidade_tipo_id       UUID,
    presidente_id            UUID,
    interrogante_id          UUID,
    escrivao_processo_id     UUID,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_cd             PRIMARY KEY (id),
    CONSTRAINT fk_cd_base        FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_cd_resp        FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_cd_pen_tip     FOREIGN KEY (penalidade_tipo_id)     REFERENCES tipos_penalidade(id),
    CONSTRAINT fk_cd_presidente  FOREIGN KEY (presidente_id)          REFERENCES usuarios(id),
    CONSTRAINT fk_cd_inter       FOREIGN KEY (interrogante_id)        REFERENCES usuarios(id),
    CONSTRAINT fk_cd_escr_proc   FOREIGN KEY (escrivao_processo_id)   REFERENCES usuarios(id),
    CONSTRAINT fk_cd_tipo_det    FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_cd_doc_ini     FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_cd_loc_ori     FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_cd_loc_fat     FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_cd_sol_tip     FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_cd_nat_pro     FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_cd_numero_doc_ano ON conselho_disciplina
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_cd_ativo            ON conselho_disciplina (ativo);
CREATE INDEX ix_cd_concluido        ON conselho_disciplina (concluido);
CREATE INDEX ix_cd_data_instauracao ON conselho_disciplina (data_instauracao);
CREATE INDEX ix_cd_andamentos       ON conselho_disciplina USING GIN (andamentos);
CREATE INDEX ix_cd_hist_enc         ON conselho_disciplina USING GIN (historico_encarregados);

-- ─────────────────────────────────────────────────────────────────
-- 10. conselho_justificacao (CJ)
-- Específico: numero_portaria, data_conclusao, data_remessa_comissao,
--             data_julgamento, penalidade_dias, penalidade_tipo_id,
--             presidente_id, interrogante_id, escrivao_processo_id
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE conselho_justificacao (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    numero                   TEXT          NOT NULL,
    tipo_geral               TEXT          NOT NULL,
    processo_sei             TEXT,
    responsavel_id           UUID,
    data_instauracao         DATE,
    data_recebimento         DATE,
    numero_rgf               TEXT,
    resumo_fatos             TEXT,
    numero_portaria          TEXT,
    data_conclusao           DATE,
    data_remessa_comissao    DATE,
    data_julgamento          DATE,
    penalidade_dias          INTEGER,
    penalidade_tipo_id       UUID,
    presidente_id            UUID,
    interrogante_id          UUID,
    escrivao_processo_id     UUID,
    solucao_final            TEXT,
    andamentos               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    historico_encarregados   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    pdf_nome                 VARCHAR(255),
    pdf_content_type         VARCHAR(100),
    pdf_tamanho              BIGINT,
    pdf_upload_em            TIMESTAMPTZ,
    pdf_arquivo              BYTEA,
    tipo_detalhe_id          UUID          NOT NULL,
    documento_iniciador_id   UUID          NOT NULL,
    local_origem_id          UUID,
    local_fatos_id           UUID,
    solucao_tipo_id          UUID,
    natureza_processo_id     UUID,
    ativo                    BOOLEAN       NOT NULL DEFAULT true,
    concluido                BOOLEAN       NOT NULL DEFAULT false,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_cj             PRIMARY KEY (id),
    CONSTRAINT fk_cj_base        FOREIGN KEY (id)                     REFERENCES processos_procedimentos(id) ON DELETE CASCADE,
    CONSTRAINT fk_cj_resp        FOREIGN KEY (responsavel_id)         REFERENCES usuarios(id),
    CONSTRAINT fk_cj_pen_tip     FOREIGN KEY (penalidade_tipo_id)     REFERENCES tipos_penalidade(id),
    CONSTRAINT fk_cj_presidente  FOREIGN KEY (presidente_id)          REFERENCES usuarios(id),
    CONSTRAINT fk_cj_inter       FOREIGN KEY (interrogante_id)        REFERENCES usuarios(id),
    CONSTRAINT fk_cj_escr_proc   FOREIGN KEY (escrivao_processo_id)   REFERENCES usuarios(id),
    CONSTRAINT fk_cj_tipo_det    FOREIGN KEY (tipo_detalhe_id)        REFERENCES tipos_detalhe_processo(id),
    CONSTRAINT fk_cj_doc_ini     FOREIGN KEY (documento_iniciador_id) REFERENCES documentos_iniciadores(id),
    CONSTRAINT fk_cj_loc_ori     FOREIGN KEY (local_origem_id)        REFERENCES locais_origem(id),
    CONSTRAINT fk_cj_loc_fat     FOREIGN KEY (local_fatos_id)         REFERENCES municipios_distritos(id),
    CONSTRAINT fk_cj_sol_tip     FOREIGN KEY (solucao_tipo_id)        REFERENCES solucoes_tipo(id),
    CONSTRAINT fk_cj_nat_pro     FOREIGN KEY (natureza_processo_id)   REFERENCES natureza_transgressao(id)
);
CREATE UNIQUE INDEX uq_cj_numero_doc_ano ON conselho_justificacao
    (numero, documento_iniciador_id, (EXTRACT(YEAR FROM data_instauracao)::INTEGER))
    WHERE data_instauracao IS NOT NULL;
CREATE INDEX ix_cj_ativo            ON conselho_justificacao (ativo);
CREATE INDEX ix_cj_concluido        ON conselho_justificacao (concluido);
CREATE INDEX ix_cj_data_instauracao ON conselho_justificacao (data_instauracao);
CREATE INDEX ix_cj_andamentos       ON conselho_justificacao USING GIN (andamentos);
CREATE INDEX ix_cj_hist_enc         ON conselho_justificacao USING GIN (historico_encarregados);
