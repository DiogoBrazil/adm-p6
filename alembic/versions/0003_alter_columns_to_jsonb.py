"""Alter TEXT JSON fields to JSONB in place

Revision ID: 0003_alter_to_jsonb
Revises: 0002_add_fks
Create Date: 2025-11-11
"""
from alembic import op

revision = '0003_alter_to_jsonb'
down_revision = '0002_add_fks'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE processos_procedimentos
        ALTER COLUMN andamentos TYPE JSONB USING CASE WHEN andamentos IS NULL OR trim(andamentos) = '' THEN '[]'::jsonb ELSE andamentos::jsonb END;
        """
    )
    op.execute(
        """
        ALTER TABLE processos_procedimentos
        ALTER COLUMN historico_encarregados TYPE JSONB USING CASE WHEN historico_encarregados IS NULL OR trim(historico_encarregados) = '' THEN '[]'::jsonb ELSE historico_encarregados::jsonb END;
        """
    )
    op.execute(
        """
        ALTER TABLE processos_procedimentos
        ALTER COLUMN indicios_categorias TYPE JSONB USING CASE WHEN indicios_categorias IS NULL OR trim(indicios_categorias) = '' THEN '[]'::jsonb ELSE indicios_categorias::jsonb END;
        """
    )

    op.execute(
        """
        ALTER TABLE mapas_salvos
        ALTER COLUMN dados_mapa TYPE JSONB USING CASE WHEN dados_mapa IS NULL OR trim(dados_mapa) = '' THEN '{}'::jsonb ELSE dados_mapa::jsonb END;
        """
    )

    op.execute(
        """
        ALTER TABLE pm_envolvido_indicios
        ALTER COLUMN categorias_indicios TYPE JSONB USING CASE WHEN categorias_indicios IS NULL OR trim(categorias_indicios) = '' THEN '[]'::jsonb ELSE categorias_indicios::jsonb END;
        """
    )

    # GIN indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_andamentos_gin ON processos_procedimentos USING GIN (andamentos);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_hist_enc_gin ON processos_procedimentos USING GIN (historico_encarregados);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_indic_cat_gin ON processos_procedimentos USING GIN (indicios_categorias);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_mapas_dados_gin ON mapas_salvos USING GIN (dados_mapa);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pei_categ_gin ON pm_envolvido_indicios USING GIN (categorias_indicios);")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_proc_andamentos_gin;")
    op.execute("DROP INDEX IF EXISTS ix_proc_hist_enc_gin;")
    op.execute("DROP INDEX IF EXISTS ix_proc_indic_cat_gin;")
    op.execute("DROP INDEX IF EXISTS ix_mapas_dados_gin;")
    op.execute("DROP INDEX IF EXISTS ix_pei_categ_gin;")

    # Convert back to TEXT (not recommended)
    op.execute("ALTER TABLE processos_procedimentos ALTER COLUMN andamentos TYPE TEXT USING to_jsonb(andamentos)::text;")
    op.execute("ALTER TABLE processos_procedimentos ALTER COLUMN historico_encarregados TYPE TEXT USING to_jsonb(historico_encarregados)::text;")
    op.execute("ALTER TABLE processos_procedimentos ALTER COLUMN indicios_categorias TYPE TEXT USING to_jsonb(indicios_categorias)::text;")
    op.execute("ALTER TABLE mapas_salvos ALTER COLUMN dados_mapa TYPE TEXT USING to_jsonb(dados_mapa)::text;")
    op.execute("ALTER TABLE pm_envolvido_indicios ALTER COLUMN categorias_indicios TYPE TEXT USING to_jsonb(categorias_indicios)::text;")

