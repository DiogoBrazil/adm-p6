"""Add foreign keys for integrity

Revision ID: 0002_add_fks
Revises: 0001_bootstrap
Create Date: 2025-11-11
"""
from alembic import op

revision = '0002_add_fks'
down_revision = '0001_bootstrap'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_proc_resp_user') THEN
            ALTER TABLE processos_procedimentos ADD CONSTRAINT fk_proc_resp_user FOREIGN KEY (responsavel_id) REFERENCES usuarios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_proc_pres_user') THEN
            ALTER TABLE processos_procedimentos ADD CONSTRAINT fk_proc_pres_user FOREIGN KEY (presidente_id) REFERENCES usuarios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_proc_inter_user') THEN
            ALTER TABLE processos_procedimentos ADD CONSTRAINT fk_proc_inter_user FOREIGN KEY (interrogante_id) REFERENCES usuarios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_proc_escr_user') THEN
            ALTER TABLE processos_procedimentos ADD CONSTRAINT fk_proc_escr_user FOREIGN KEY (escrivao_processo_id) REFERENCES usuarios(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_prazo_proc') THEN
            ALTER TABLE prazos_processo ADD CONSTRAINT fk_prazo_proc FOREIGN KEY (processo_id) REFERENCES processos_procedimentos(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pme_proc') THEN
            ALTER TABLE procedimento_pms_envolvidos ADD CONSTRAINT fk_pme_proc FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pei_pme') THEN
            ALTER TABLE pm_envolvido_indicios ADD CONSTRAINT fk_pei_pme FOREIGN KEY (pm_envolvido_id) REFERENCES procedimento_pms_envolvidos(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pei_proc') THEN
            ALTER TABLE pm_envolvido_indicios ADD CONSTRAINT fk_pei_proc FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pec_pei') THEN
            ALTER TABLE pm_envolvido_crimes ADD CONSTRAINT fk_pec_pei FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pec_crime') THEN
            ALTER TABLE pm_envolvido_crimes ADD CONSTRAINT fk_pec_crime FOREIGN KEY (crime_id) REFERENCES crimes_contravencoes(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_per_pei') THEN
            ALTER TABLE pm_envolvido_rdpm ADD CONSTRAINT fk_per_pei FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_per_trans') THEN
            ALTER TABLE pm_envolvido_rdpm ADD CONSTRAINT fk_per_trans FOREIGN KEY (transgressao_id) REFERENCES transgressoes(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pea_pei') THEN
            ALTER TABLE pm_envolvido_art29 ADD CONSTRAINT fk_pea_pei FOREIGN KEY (pm_indicios_id) REFERENCES pm_envolvido_indicios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pea_art29') THEN
            ALTER TABLE pm_envolvido_art29 ADD CONSTRAINT fk_pea_art29 FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pic_proc') THEN
            ALTER TABLE procedimentos_indicios_crimes ADD CONSTRAINT fk_pic_proc FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pic_crime') THEN
            ALTER TABLE procedimentos_indicios_crimes ADD CONSTRAINT fk_pic_crime FOREIGN KEY (crime_id) REFERENCES crimes_contravencoes(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pir_proc') THEN
            ALTER TABLE procedimentos_indicios_rdpm ADD CONSTRAINT fk_pir_proc FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pir_trans') THEN
            ALTER TABLE procedimentos_indicios_rdpm ADD CONSTRAINT fk_pir_trans FOREIGN KEY (transgressao_id) REFERENCES transgressoes(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pia_proc') THEN
            ALTER TABLE procedimentos_indicios_art29 ADD CONSTRAINT fk_pia_proc FOREIGN KEY (procedimento_id) REFERENCES processos_procedimentos(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pia_art29') THEN
            ALTER TABLE procedimentos_indicios_art29 ADD CONSTRAINT fk_pia_art29 FOREIGN KEY (art29_id) REFERENCES infracoes_estatuto_art29(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_user') THEN
            ALTER TABLE auditoria ADD CONSTRAINT fk_audit_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mapa_user') THEN
            ALTER TABLE mapas_salvos ADD CONSTRAINT fk_mapa_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
        END IF;
    END $$;
    """)


def downgrade():
    # Do not drop constraints in downgrade for safety
    pass

