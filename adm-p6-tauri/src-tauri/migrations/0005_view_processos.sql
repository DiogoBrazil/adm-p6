-- Migration 0005: View v_processos
-- UNION ALL de todas as 10 tabelas tipo-específicas.
-- Resolve FKs de lookup para seus códigos/nomes.
-- Expõe colunas tipo-específicas como NULL quando não se aplicam.

CREATE VIEW v_processos AS

-- 1. sindicancia_regular (SR)
SELECT
    t.id,
    tdp.codigo                               AS tipo_detalhe,
    t.tipo_geral,
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
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
    di.codigo                                AS documento_iniciador,
    lo.codigo                                AS local_origem,
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
JOIN documentos_iniciadores di  ON di.id  = t.documento_iniciador_id
LEFT JOIN locais_origem lo      ON lo.id  = t.local_origem_id
LEFT JOIN municipios_distritos md ON md.id = t.local_fatos_id
LEFT JOIN solucoes_tipo st      ON st.id  = t.solucao_tipo_id
LEFT JOIN natureza_transgressao nt ON nt.id = t.natureza_processo_id
LEFT JOIN tipos_penalidade tp   ON tp.id  = t.penalidade_tipo_id
;
