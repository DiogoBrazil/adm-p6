"""Fix transgressoes id serial sequence

Revision ID: 0005_fix_transgressoes_id_serial
Revises: 0004_add_indexes
Create Date: 2025-11-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0005_fix_transgressoes_id_serial'
down_revision = '0004_add_indexes'
branch_labels = None
depends_on = None


def upgrade():
    """
    Corrige a coluna ID da tabela transgressoes para usar SERIAL corretamente,
    criando a sequence e definindo como default.
    """
    # Criar a sequence se não existir
    op.execute("""
        CREATE SEQUENCE IF NOT EXISTS transgressoes_id_seq;
    """)
    
    # Atualizar o owner da sequence para a coluna id
    op.execute("""
        ALTER SEQUENCE transgressoes_id_seq OWNED BY transgressoes.id;
    """)
    
    # Definir o default da coluna id para usar a sequence
    op.execute("""
        ALTER TABLE transgressoes 
        ALTER COLUMN id SET DEFAULT nextval('transgressoes_id_seq');
    """)
    
    # Atualizar o valor atual da sequence para ser maior que o maior ID existente
    op.execute("""
        SELECT setval('transgressoes_id_seq', COALESCE((SELECT MAX(id) FROM transgressoes), 0) + 1, false);
    """)


def downgrade():
    """
    Reverte as alterações (remove o default e a sequence).
    """
    op.execute("""
        ALTER TABLE transgressoes 
        ALTER COLUMN id DROP DEFAULT;
    """)
    
    op.execute("""
        DROP SEQUENCE IF EXISTS transgressoes_id_seq CASCADE;
    """)
