"""Bootstrap core tables and columns

Revision ID: 0001_bootstrap
Revises:
Create Date: 2025-11-11

"""
from alembic import op

revision = '0001_bootstrap'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Core tables
    op.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('Oficial','Praça')),
        posto_graduacao TEXT NOT NULL,
        nome TEXT NOT NULL,
        matricula TEXT UNIQUE NOT NULL,
        is_encarregado BOOLEAN DEFAULT FALSE,
        is_operador BOOLEAN DEFAULT FALSE,
        email TEXT UNIQUE,
        senha TEXT,
        perfil TEXT CHECK (perfil IN ('admin','comum') OR perfil IS NULL),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ativo BOOLEAN DEFAULT TRUE
    );
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS processos_procedimentos (
        id TEXT PRIMARY KEY,
        numero TEXT NOT NULL,
        tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo','procedimento')),
        tipo_detalhe TEXT NOT NULL,
        documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria','Memorando Disciplinar','Feito Preliminar')),
        processo_sei TEXT,
        responsavel_id TEXT,
        responsavel_tipo TEXT CHECK (responsavel_tipo IN ('usuario')),
        local_origem TEXT,
        local_fatos TEXT,
        data_instauracao DATE,
        data_recebimento DATE,
        escrivao_id TEXT,
        status_pm TEXT,
        nome_pm_id TEXT,
        nome_vitima TEXT,
        natureza_processo TEXT,
        natureza_procedimento TEXT,
        resumo_fatos TEXT,
        numero_portaria TEXT,
        numero_memorando TEXT,
        numero_feito TEXT,
        numero_rgf TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ativo BOOLEAN DEFAULT TRUE,
        numero_controle TEXT,
        concluido BOOLEAN,
        data_conclusao DATE,
        infracao_id INTEGER,
        transgressoes_ids TEXT,
        solucao_final TEXT,
        ano_instauracao TEXT,
        andamentos TEXT,
        data_remessa_encarregado DATE,
        data_julgamento DATE,
        solucao_tipo TEXT,
        penalidade_tipo TEXT,
        penalidade_dias INTEGER,
        indicios_categorias TEXT,
        presidente_id TEXT,
        presidente_tipo TEXT CHECK (presidente_tipo IN ('usuario')),
        interrogante_id TEXT,
        interrogante_tipo TEXT CHECK (interrogante_tipo IN ('usuario')),
        escrivao_processo_id TEXT,
        escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('usuario')),
        historico_encarregados TEXT,
        motorista_id TEXT,
        CONSTRAINT uq_proc_numero_doc_ano UNIQUE (numero, documento_iniciador, ano_instauracao)
    );
    """)

    # Catalogs
    op.execute("""
    CREATE TABLE IF NOT EXISTS crimes_contravencoes (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        dispositivo_legal TEXT,
        artigo TEXT,
        descricao_artigo TEXT,
        paragrafo TEXT,
        inciso TEXT,
        alinea TEXT,
        ativo BOOLEAN DEFAULT TRUE
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS transgressoes (
        id SERIAL PRIMARY KEY,
        artigo INTEGER,
        gravidade TEXT,
        inciso TEXT,
        texto TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS infracoes_estatuto_art29 (
        id SERIAL PRIMARY KEY,
        inciso TEXT,
        texto TEXT,
        ativo BOOLEAN DEFAULT TRUE
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS municipios_distritos (
        id TEXT PRIMARY KEY,
        nome TEXT,
        tipo TEXT,
        municipio_pai TEXT,
        ativo BOOLEAN DEFAULT TRUE
    );
    """)

    # Audit and maps
    op.execute("""
    CREATE TABLE IF NOT EXISTS auditoria (
        id TEXT PRIMARY KEY,
        tabela TEXT NOT NULL,
        registro_id TEXT NOT NULL,
        operacao TEXT NOT NULL,
        usuario_id TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS mapas_salvos (
        id TEXT PRIMARY KEY,
        titulo TEXT,
        tipo_processo TEXT,
        periodo_inicio DATE,
        periodo_fim DATE,
        periodo_descricao TEXT,
        total_processos INTEGER,
        total_concluidos INTEGER,
        total_andamento INTEGER,
        usuario_id TEXT,
        usuario_nome TEXT,
        dados_mapa TEXT,
        nome_arquivo TEXT,
        data_geracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ativo BOOLEAN DEFAULT TRUE
    );
    """)

    # Deadlines
    op.execute("""
    CREATE TABLE IF NOT EXISTS prazos_processo (
        id TEXT PRIMARY KEY,
        processo_id TEXT NOT NULL,
        tipo_prazo TEXT NOT NULL,
        data_inicio DATE NOT NULL,
        data_vencimento DATE NOT NULL,
        dias_adicionados INTEGER,
        motivo TEXT,
        autorizado_por TEXT,
        autorizado_tipo TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        numero_portaria TEXT,
        data_portaria DATE,
        ordem_prorrogacao INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    );
    """)

    # PMs and hints
    op.execute("""
    CREATE TABLE IF NOT EXISTS procedimento_pms_envolvidos (
        id TEXT PRIMARY KEY,
        procedimento_id TEXT NOT NULL,
        pm_id TEXT NOT NULL,
        pm_tipo TEXT,
        ordem INTEGER,
        status_pm TEXT
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS pm_envolvido_indicios (
        id TEXT PRIMARY KEY,
        pm_envolvido_id TEXT NOT NULL,
        procedimento_id TEXT NOT NULL,
        categorias_indicios TEXT,
        categoria TEXT,
        ativo BOOLEAN DEFAULT TRUE
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS pm_envolvido_crimes (
        id TEXT PRIMARY KEY,
        pm_indicios_id TEXT NOT NULL,
        crime_id TEXT NOT NULL
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS pm_envolvido_rdpm (
        id TEXT PRIMARY KEY,
        pm_indicios_id TEXT NOT NULL,
        transgressao_id INTEGER NOT NULL
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS pm_envolvido_art29 (
        id TEXT PRIMARY KEY,
        pm_indicios_id TEXT NOT NULL,
        art29_id INTEGER NOT NULL
    );
    """)

    # Procedure-level hints
    op.execute("""
    CREATE TABLE IF NOT EXISTS procedimentos_indicios_crimes (
        id TEXT PRIMARY KEY,
        procedimento_id TEXT NOT NULL,
        crime_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS procedimentos_indicios_rdpm (
        id TEXT PRIMARY KEY,
        procedimento_id TEXT NOT NULL,
        transgressao_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS procedimentos_indicios_art29 (
        id TEXT PRIMARY KEY,
        procedimento_id TEXT NOT NULL,
        art29_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Ensure extra columns exist
    op.execute("""
    ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS perfil TEXT,
        ADD COLUMN IF NOT EXISTS is_encarregado BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_operador BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    """)

    op.execute("""
    ALTER TABLE processos_procedimentos
        ADD COLUMN IF NOT EXISTS indicios_categorias TEXT,
        ADD COLUMN IF NOT EXISTS historico_encarregados TEXT,
        ADD COLUMN IF NOT EXISTS motorista_id TEXT;
    """)


def downgrade():
    # Non-destructive downgrade (no drops)
    pass

