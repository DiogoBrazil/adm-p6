-- Migration 0015: Reestruturar tipos_penalidade, tipos_prazo, tipos_detalhe_processo→apuratorios

-- 1. Drop view que referencia as tabelas
DROP VIEW IF EXISTS v_processos;

-- 2. Remover FKs das 11 tabelas → tipos_detalhe_processo
ALTER TABLE sindicancia_regular                     DROP CONSTRAINT fk_sr_tipo_det;
ALTER TABLE inquerito_policial_militar              DROP CONSTRAINT fk_ipm_tipo_det;
ALTER TABLE feito_preliminar                        DROP CONSTRAINT fk_fp_tipo_det;
ALTER TABLE carta_precatoria                        DROP CONSTRAINT fk_cp_tipo_det;
ALTER TABLE sindicancia_verbal                      DROP CONSTRAINT fk_sv_tipo_det;
ALTER TABLE processo_apuratorio_disciplinar_sumario DROP CONSTRAINT fk_pads_tipo_det;
ALTER TABLE processo_apuratorio_dano_herario        DROP CONSTRAINT fk_pade_tipo_det;
ALTER TABLE processo_administrativo_disciplinar     DROP CONSTRAINT fk_pad_tipo_det;
ALTER TABLE conselho_disciplina                     DROP CONSTRAINT fk_cd_tipo_det;
ALTER TABLE conselho_justificacao                   DROP CONSTRAINT fk_cj_tipo_det;
ALTER TABLE processos_procedimentos                 DROP CONSTRAINT fk_proc_tipo_det;

-- 3. Remover FKs das 5 tabelas → tipos_penalidade
ALTER TABLE processo_apuratorio_disciplinar_sumario DROP CONSTRAINT fk_pads_pen_tip;
ALTER TABLE processo_apuratorio_dano_herario        DROP CONSTRAINT fk_pade_pen_tip;
ALTER TABLE processo_administrativo_disciplinar     DROP CONSTRAINT fk_pad_pen_tip;
ALTER TABLE conselho_disciplina                     DROP CONSTRAINT fk_cd_pen_tip;
ALTER TABLE conselho_justificacao                   DROP CONSTRAINT fk_cj_pen_tip;

-- 4. Remover FK prazos_processo → tipos_prazo
ALTER TABLE prazos_processo DROP CONSTRAINT fk_prazo_tipo;

-- 5. Criar nova tabela tipo_apuratorios
CREATE TABLE tipo_apuratorios (
    id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo       TEXT      NOT NULL UNIQUE,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tipo_apuratorios (tipo) VALUES ('processo'), ('procedimento');

-- 6. Criar nova tabela apuratorios com dados migrados de tipos_detalhe_processo
CREATE TABLE apuratorios (
    id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_apuratorio     TEXT      NOT NULL UNIQUE,
    tipo_apuratorio_id  UUID      NOT NULL REFERENCES tipo_apuratorios(id),
    prazo_base_dias     INTEGER   NOT NULL DEFAULT 30,
    ativo               BOOLEAN   NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO apuratorios (id, nome_apuratorio, tipo_apuratorio_id, prazo_base_dias, ativo)
SELECT
    tdp.id,
    tdp.codigo,
    ta.id,
    tdp.prazo_base_dias,
    COALESCE(tdp.ativo, true)
FROM tipos_detalhe_processo tdp
JOIN tipo_apuratorios ta ON ta.tipo = tdp.tipo_geral;

-- 7. Alterar tipos_penalidade: renomear codigo→nome_penalidade, drop descricao
ALTER TABLE tipos_penalidade RENAME COLUMN codigo TO nome_penalidade;
ALTER TABLE tipos_penalidade DROP COLUMN IF EXISTS descricao;
ALTER TABLE tipos_penalidade ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tipos_penalidade ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 8. Alterar tipos_prazo: renomear codigo→nome_prazo, drop descricao
ALTER TABLE tipos_prazo RENAME COLUMN codigo TO nome_prazo;
ALTER TABLE tipos_prazo DROP COLUMN IF EXISTS descricao;
ALTER TABLE tipos_prazo ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tipos_prazo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 9. Re-adicionar FKs das 11 tabelas → apuratorios
ALTER TABLE sindicancia_regular                     ADD CONSTRAINT fk_sr_tipo_det   FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE inquerito_policial_militar              ADD CONSTRAINT fk_ipm_tipo_det  FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE feito_preliminar                        ADD CONSTRAINT fk_fp_tipo_det   FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE carta_precatoria                        ADD CONSTRAINT fk_cp_tipo_det   FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE sindicancia_verbal                      ADD CONSTRAINT fk_sv_tipo_det   FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE processo_apuratorio_disciplinar_sumario ADD CONSTRAINT fk_pads_tipo_det FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE processo_apuratorio_dano_herario        ADD CONSTRAINT fk_pade_tipo_det FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE processo_administrativo_disciplinar     ADD CONSTRAINT fk_pad_tipo_det  FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE conselho_disciplina                     ADD CONSTRAINT fk_cd_tipo_det   FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE conselho_justificacao                   ADD CONSTRAINT fk_cj_tipo_det   FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);
ALTER TABLE processos_procedimentos                 ADD CONSTRAINT fk_proc_tipo_det FOREIGN KEY (tipo_detalhe_id) REFERENCES apuratorios(id);

-- 10. Re-adicionar FKs das 5 tabelas → tipos_penalidade
ALTER TABLE processo_apuratorio_disciplinar_sumario ADD CONSTRAINT fk_pads_pen_tip FOREIGN KEY (penalidade_tipo_id) REFERENCES tipos_penalidade(id);
ALTER TABLE processo_apuratorio_dano_herario        ADD CONSTRAINT fk_pade_pen_tip FOREIGN KEY (penalidade_tipo_id) REFERENCES tipos_penalidade(id);
ALTER TABLE processo_administrativo_disciplinar     ADD CONSTRAINT fk_pad_pen_tip  FOREIGN KEY (penalidade_tipo_id) REFERENCES tipos_penalidade(id);
ALTER TABLE conselho_disciplina                     ADD CONSTRAINT fk_cd_pen_tip   FOREIGN KEY (penalidade_tipo_id) REFERENCES tipos_penalidade(id);
ALTER TABLE conselho_justificacao                   ADD CONSTRAINT fk_cj_pen_tip   FOREIGN KEY (penalidade_tipo_id) REFERENCES tipos_penalidade(id);

-- 11. Re-adicionar FK prazos_processo → tipos_prazo
ALTER TABLE prazos_processo ADD CONSTRAINT fk_prazo_tipo FOREIGN KEY (tipo_prazo_id) REFERENCES tipos_prazo(id);

-- 12. Drop tabela antiga (dados já migrados)
DROP TABLE IF EXISTS tipos_detalhe_processo;

-- 13. Recriar v_processos com apuratorios e novos nomes de colunas
CREATE VIEW v_processos AS

-- 1. sindicancia_regular (SR)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    t.nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    t.indicios_categorias,
    t.data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    NULL::date    AS data_julgamento,
    NULL::integer AS penalidade_dias,
    NULL::text    AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM sindicancia_regular t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 2. inquerito_policial_militar (IPM)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    t.escrivao_id,
    t.nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    t.indicios_categorias,
    t.data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    NULL::date    AS data_julgamento,
    NULL::integer AS penalidade_dias,
    NULL::text    AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM inquerito_policial_militar t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 3. feito_preliminar (FP)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    t.nome_vitima,
    NULL::text    AS numero_portaria,
    t.data_conclusao,
    NULL::jsonb   AS indicios_categorias,
    t.data_remessa_encarregado,
    t.numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    NULL::date    AS data_julgamento,
    NULL::integer AS penalidade_dias,
    NULL::text    AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM feito_preliminar t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 4. carta_precatoria (CP)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    t.nome_vitima,
    t.numero_portaria,
    NULL::date    AS data_conclusao,
    NULL::jsonb   AS indicios_categorias,
    t.data_remessa_encarregado,
    NULL::text    AS numero_feito,
    t.unidade_deprecada,
    t.deprecante,
    NULL::text    AS numero_memorando,
    NULL::date    AS data_julgamento,
    NULL::integer AS penalidade_dias,
    NULL::text    AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM carta_precatoria t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 5. sindicancia_verbal (SV)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    t.nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    t.indicios_categorias,
    t.data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    NULL::date    AS data_julgamento,
    NULL::integer AS penalidade_dias,
    NULL::text    AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM sindicancia_verbal t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 6. processo_apuratorio_disciplinar_sumario (PADS)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    NULL::text    AS nome_vitima,
    NULL::text    AS numero_portaria,
    t.data_conclusao,
    t.indicios_categorias,
    t.data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    t.numero_memorando,
    t.data_julgamento,
    t.penalidade_dias,
    tp.nome_penalidade AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM processo_apuratorio_disciplinar_sumario t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id

UNION ALL

-- 7. processo_apuratorio_dano_herario (PADE)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    NULL::text    AS nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    NULL::jsonb   AS indicios_categorias,
    t.data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    t.data_julgamento,
    NULL::integer AS penalidade_dias,
    tp.nome_penalidade AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM processo_apuratorio_dano_herario t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id

UNION ALL

-- 8. processo_administrativo_disciplinar (PAD)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    NULL::text    AS nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    NULL::jsonb   AS indicios_categorias,
    NULL::date    AS data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    t.data_julgamento,
    t.penalidade_dias,
    tp.nome_penalidade AS penalidade_tipo,
    t.data_remessa_comissao,
    t.presidente_id,
    t.interrogante_id,
    t.escrivao_processo_id
FROM processo_administrativo_disciplinar t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id

UNION ALL

-- 9. conselho_disciplina (CD)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    NULL::text    AS nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    NULL::jsonb   AS indicios_categorias,
    NULL::date    AS data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    t.data_julgamento,
    t.penalidade_dias,
    tp.nome_penalidade AS penalidade_tipo,
    t.data_remessa_comissao,
    t.presidente_id,
    t.interrogante_id,
    t.escrivao_processo_id
FROM conselho_disciplina t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id

UNION ALL

-- 10. conselho_justificacao (CJ)
SELECT
    t.id,
    tdp.nome_apuratorio                          AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                      AS documento_iniciador,
    lo.unidade_pm                                AS local_origem,
    md.nome                                      AS local_fatos,
    st.codigo                                    AS solucao_tipo,
    nt.codigo                                    AS natureza_processo,
    t.numero,
    t.processo_sei,
    t.responsavel_id,
    t.data_instauracao,
    t.data_recebimento,
    t.numero_rgf,
    t.resumo_fatos,
    t.solucao_final,
    t.andamentos,
    t.historico_encarregados,
    t.pdf_nome,
    t.pdf_content_type,
    t.pdf_tamanho,
    t.pdf_upload_em,
    t.pdf_arquivo,
    t.ativo,
    t.concluido,
    t.created_at,
    t.updated_at,
    EXTRACT(YEAR FROM t.data_instauracao)::text AS ano_instauracao,
    NULL::uuid    AS escrivao_id,
    NULL::text    AS nome_vitima,
    t.numero_portaria,
    t.data_conclusao,
    NULL::jsonb   AS indicios_categorias,
    NULL::date    AS data_remessa_encarregado,
    NULL::text    AS numero_feito,
    NULL::text    AS unidade_deprecada,
    NULL::text    AS deprecante,
    NULL::text    AS numero_memorando,
    t.data_julgamento,
    t.penalidade_dias,
    tp.nome_penalidade AS penalidade_tipo,
    t.data_remessa_comissao,
    t.presidente_id,
    t.interrogante_id,
    t.escrivao_processo_id
FROM conselho_justificacao t
JOIN apuratorios tdp            ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id
;
