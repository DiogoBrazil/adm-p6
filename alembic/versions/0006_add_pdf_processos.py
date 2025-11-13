"""Add PDF storage columns to processos_procedimentos

Revision ID: 0006_add_pdf_processos
Revises: 0005_fix_transgressoes_id_serial
Create Date: 2025-11-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0006_add_pdf_processos'
down_revision = '0005_fix_transgressoes_id_serial'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('processos_procedimentos', sa.Column('pdf_nome', sa.String(length=255), nullable=True))
    op.add_column('processos_procedimentos', sa.Column('pdf_content_type', sa.String(length=100), nullable=True))
    op.add_column('processos_procedimentos', sa.Column('pdf_tamanho', sa.BigInteger(), nullable=True))
    op.add_column('processos_procedimentos', sa.Column('pdf_upload_em', sa.DateTime(timezone=True), nullable=True))
    op.add_column('processos_procedimentos', sa.Column('pdf_arquivo', sa.LargeBinary(), nullable=True))


def downgrade():
    op.drop_column('processos_procedimentos', 'pdf_arquivo')
    op.drop_column('processos_procedimentos', 'pdf_upload_em')
    op.drop_column('processos_procedimentos', 'pdf_tamanho')
    op.drop_column('processos_procedimentos', 'pdf_content_type')
    op.drop_column('processos_procedimentos', 'pdf_nome')
