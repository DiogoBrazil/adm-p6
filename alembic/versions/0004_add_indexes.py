"""Add helpful B-Tree indexes

Revision ID: 0004_add_indexes
Revises: 0003_alter_to_jsonb
Create Date: 2025-11-11
"""
from alembic import op

revision = '0004_add_indexes'
down_revision = '0003_alter_to_jsonb'
branch_labels = None
depends_on = None


def upgrade():
    # processos_procedimentos
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_ativo ON processos_procedimentos (ativo);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_tipo ON processos_procedimentos (tipo_geral, tipo_detalhe);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_concluido ON processos_procedimentos (concluido);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_data_instauracao ON processos_procedimentos (data_instauracao);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_data_recebimento ON processos_procedimentos (data_recebimento);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proc_ano ON processos_procedimentos (ano_instauracao);")

    # usuarios
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_nome ON usuarios (nome);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_operador ON usuarios (is_operador) WHERE ativo = TRUE;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_encarregado ON usuarios (is_encarregado) WHERE ativo = TRUE;")

    # transgressoes / art29
    op.execute("CREATE INDEX IF NOT EXISTS ix_trans_ativo ON transgressoes (ativo);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_trans_grav_inc ON transgressoes (gravidade, inciso);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_art29_ativo ON infracoes_estatuto_art29 (ativo);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_art29_inciso ON infracoes_estatuto_art29 (inciso);")

    # crimes
    op.execute("CREATE INDEX IF NOT EXISTS ix_crimes_tipo_art ON crimes_contravencoes (tipo, dispositivo_legal, artigo);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_crimes_ativo ON crimes_contravencoes (ativo);")

    # prazos_processo
    op.execute("CREATE INDEX IF NOT EXISTS ix_prazo_proc ON prazos_processo (processo_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_prazo_venc ON prazos_processo (data_vencimento) WHERE ativo = TRUE;")


def downgrade():
    for idx in [
        'ix_proc_ativo','ix_proc_tipo','ix_proc_concluido','ix_proc_data_instauracao',
        'ix_proc_data_recebimento','ix_proc_ano','ix_user_nome','ix_user_operador',
        'ix_user_encarregado','ix_trans_ativo','ix_trans_grav_inc','ix_art29_ativo',
        'ix_art29_inciso','ix_crimes_tipo_art','ix_crimes_ativo','ix_prazo_proc','ix_prazo_venc'
    ]:
        op.execute(f"DROP INDEX IF EXISTS {idx};")

