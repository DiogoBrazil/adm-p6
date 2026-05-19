-- Migration 0014: Consolidar documentos_iniciadores + tipo_doc_autorizacao_prazo → tipos_documentos
-- Também corrige lo.codigo → lo.unidade_pm na view v_processos (quebrado desde migration 0013).

-- 1. Remover view que referencia as tabelas antigas
DROP VIEW IF EXISTS v_processos;

-- 2. Remover FKs das 10 tabelas de processo → documentos_iniciadores
ALTER TABLE sindicancia_regular                     DROP CONSTRAINT fk_sr_doc_ini;
ALTER TABLE inquerito_policial_militar              DROP CONSTRAINT fk_ipm_doc_ini;
ALTER TABLE feito_preliminar                        DROP CONSTRAINT fk_fp_doc_ini;
ALTER TABLE carta_precatoria                        DROP CONSTRAINT fk_cp_doc_ini;
ALTER TABLE sindicancia_verbal                      DROP CONSTRAINT fk_sv_doc_ini;
ALTER TABLE processo_apuratorio_disciplinar_sumario DROP CONSTRAINT fk_pads_doc_ini;
ALTER TABLE processo_apuratorio_dano_herario        DROP CONSTRAINT fk_pade_doc_ini;
ALTER TABLE processo_administrativo_disciplinar     DROP CONSTRAINT fk_pad_doc_ini;
ALTER TABLE conselho_disciplina                     DROP CONSTRAINT fk_cd_doc_ini;
ALTER TABLE conselho_justificacao                   DROP CONSTRAINT fk_cj_doc_ini;

-- 3. Remover FK prazos_processo → tipo_doc_autorizacao_prazo
ALTER TABLE prazos_processo DROP CONSTRAINT fk_prazo_aut_tipo;

-- 4. Dropar as duas tabelas redundantes
DROP TABLE IF EXISTS documentos_iniciadores;
DROP TABLE IF EXISTS tipo_doc_autorizacao_prazo;

-- 5. Criar nova tabela unificada
CREATE TABLE tipos_documentos (
    id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo       TEXT      NOT NULL UNIQUE,
    ativo      BOOLEAN   NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Re-adicionar FKs das 10 tabelas → tipos_documentos
ALTER TABLE sindicancia_regular                     ADD CONSTRAINT fk_sr_doc_ini   FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE inquerito_policial_militar              ADD CONSTRAINT fk_ipm_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE feito_preliminar                        ADD CONSTRAINT fk_fp_doc_ini   FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE carta_precatoria                        ADD CONSTRAINT fk_cp_doc_ini   FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE sindicancia_verbal                      ADD CONSTRAINT fk_sv_doc_ini   FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE processo_apuratorio_disciplinar_sumario ADD CONSTRAINT fk_pads_doc_ini FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE processo_apuratorio_dano_herario        ADD CONSTRAINT fk_pade_doc_ini FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE processo_administrativo_disciplinar     ADD CONSTRAINT fk_pad_doc_ini  FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE conselho_disciplina                     ADD CONSTRAINT fk_cd_doc_ini   FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);
ALTER TABLE conselho_justificacao                   ADD CONSTRAINT fk_cj_doc_ini   FOREIGN KEY (documento_iniciador_id) REFERENCES tipos_documentos(id);

-- 7. Re-adicionar FK prazos_processo → tipos_documentos
ALTER TABLE prazos_processo ADD CONSTRAINT fk_prazo_aut_tipo FOREIGN KEY (autorizado_tipo_id) REFERENCES tipos_documentos(id);

-- 8. Recriar view v_processos com tipos_documentos e lo.unidade_pm
CREATE VIEW v_processos AS

-- 1. sindicancia_regular (SR)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 2. inquerito_policial_militar (IPM)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 3. feito_preliminar (FP)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 4. carta_precatoria (CP)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 5. sindicancia_verbal (SV)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id

UNION ALL

-- 6. processo_apuratorio_disciplinar_sumario (PADS)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
    tp.codigo     AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM processo_apuratorio_disciplinar_sumario t
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
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
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
    tp.codigo     AS penalidade_tipo,
    NULL::date    AS data_remessa_comissao,
    NULL::uuid    AS presidente_id,
    NULL::uuid    AS interrogante_id,
    NULL::uuid    AS escrivao_processo_id
FROM processo_apuratorio_dano_herario t
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
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
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
    tp.codigo     AS penalidade_tipo,
    t.data_remessa_comissao,
    t.presidente_id,
    t.interrogante_id,
    t.escrivao_processo_id
FROM processo_administrativo_disciplinar t
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
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
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
    tp.codigo     AS penalidade_tipo,
    t.data_remessa_comissao,
    t.presidente_id,
    t.interrogante_id,
    t.escrivao_processo_id
FROM conselho_disciplina t
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
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
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.tipo                                  AS documento_iniciador,
    lo.unidade_pm                            AS local_origem,
    md.nome                                  AS local_fatos,
    st.codigo                                AS solucao_tipo,
    nt.codigo                                AS natureza_processo,
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
    tp.codigo     AS penalidade_tipo,
    t.data_remessa_comissao,
    t.presidente_id,
    t.interrogante_id,
    t.escrivao_processo_id
FROM conselho_justificacao t
JOIN tipos_detalhe_processo tdp ON tdp.id = t.tipo_detalhe_id
JOIN tipos_documentos di        ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id
;
