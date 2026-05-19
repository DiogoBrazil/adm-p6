-- Migration 0027: Desacoplar o modelo de identidade dos processos/procedimentos.
-- Antes: processos_procedimentos era a tabela-base/roteadora, e seu id era
--        compartilhado (herança) como PK das tabelas específicas (SR, IPM, ...).
-- Depois: cada tabela específica tem id próprio independente. A base vira um
--        registro/histórico (historico_processo_procedimentos) com id surrogate
--        próprio + processo_procedimento_id (UNIQUE) = o id gerado na específica.
--        Todas as FKs de processo/procedimento passam a apontar para esse id único.

-- 1. Soltar a herança de id: remover FKs id->processos_procedimentos das específicas.
ALTER TABLE conselho_disciplina                      DROP CONSTRAINT fk_cd_base;
ALTER TABLE conselho_justificacao                    DROP CONSTRAINT fk_cj_base;
ALTER TABLE carta_precatoria                         DROP CONSTRAINT fk_cp_base;
ALTER TABLE feito_preliminar                         DROP CONSTRAINT fk_fp_base;
ALTER TABLE inquerito_policial_militar               DROP CONSTRAINT fk_ipm_base;
ALTER TABLE processo_administrativo_disciplinar      DROP CONSTRAINT fk_pad_base;
ALTER TABLE processo_apuratorio_dano_herario         DROP CONSTRAINT fk_pade_base;
ALTER TABLE processo_apuratorio_disciplinar_sumario  DROP CONSTRAINT fk_pads_base;
ALTER TABLE sindicancia_regular                      DROP CONSTRAINT fk_sr_base;
ALTER TABLE sindicancia_verbal                       DROP CONSTRAINT fk_sv_base;
-- (id de cada específica já tem DEFAULT gen_random_uuid(); viram PK independentes.)

-- 2. Soltar FKs das demais tabelas que apontam para processos_procedimentos(id).
ALTER TABLE procedimento_pms_envolvidos DROP CONSTRAINT fk_pme_proc;
ALTER TABLE pm_envolvido_indicios       DROP CONSTRAINT fk_pei_proc;
ALTER TABLE prazos_processo             DROP CONSTRAINT fk_prazo_proc;

-- 3. Renomear + reestruturar a base como registro/histórico.
ALTER TABLE processos_procedimentos RENAME TO historico_processo_procedimentos;
ALTER TABLE historico_processo_procedimentos RENAME COLUMN tipo_detalhe_id TO apuratorio_id;
ALTER TABLE historico_processo_procedimentos
  ADD COLUMN processo_procedimento_id UUID NOT NULL,
  ADD COLUMN ativo      BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE historico_processo_procedimentos
  ADD CONSTRAINT historico_pp_processo_uq UNIQUE (processo_procedimento_id);
-- apuratorio_id já é FK->apuratorios (constraint fk_proc_tipo_det); renomear p/ clareza.
ALTER TABLE historico_processo_procedimentos RENAME CONSTRAINT fk_proc_tipo_det TO fk_hpp_apuratorio;

-- 4. Repontar FKs das demais tabelas para o novo alvo UNIQUE.
ALTER TABLE procedimento_pms_envolvidos
  ADD CONSTRAINT fk_pme_proc FOREIGN KEY (procedimento_id)
  REFERENCES historico_processo_procedimentos(processo_procedimento_id);
ALTER TABLE pm_envolvido_indicios
  ADD CONSTRAINT fk_pei_proc FOREIGN KEY (procedimento_id)
  REFERENCES historico_processo_procedimentos(processo_procedimento_id);
ALTER TABLE prazos_processo
  ADD CONSTRAINT fk_prazo_proc FOREIGN KEY (processo_id)
  REFERENCES historico_processo_procedimentos(processo_procedimento_id);
