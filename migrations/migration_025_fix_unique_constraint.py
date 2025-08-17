#!/usr/bin/env python3
"""
Migration 025: Correção da constraint UNIQUE para permitir mesmo número em tipos/locais diferentes
Data: 2025-01-XX
Autor: Sistema

Esta migração corrige a constraint UNIQUE da tabela processos_procedimentos para incluir
tipo_detalhe e local_origem, permitindo que o mesmo número seja usado para tipos diferentes
de procedimentos ou em locais diferentes (ex: IPM nº 1 e SR nº 1 no mesmo ano).
"""

import sqlite3
import os
import shutil
from datetime import datetime

def migration_025():
    db_path = "usuarios.db"
    
    # Criar backup antes da migração
    backup_path = f"backups/pre_unique_constraint_fix_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    os.makedirs("backups", exist_ok=True)
    shutil.copy2(db_path, backup_path)
    print(f"Backup criado em: {backup_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Iniciando migração 025...")
        
        # 0. Remover views que dependem da tabela processos_procedimentos
        print("0. Removendo views dependentes...")
        cursor.execute("DROP VIEW IF EXISTS v_processos_com_prazo")
        
        # 1. Criar nova tabela com a constraint corrigida
        print("1. Criando nova tabela com constraint corrigida...")
        cursor.execute("""
            CREATE TABLE processos_procedimentos_new (
                id TEXT PRIMARY KEY,
                numero TEXT NOT NULL,
                tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
                tipo_detalhe TEXT NOT NULL,
                documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
                processo_sei TEXT,
                -- Agora opcionais para suportar PAD/CD/CJ
                responsavel_id TEXT,
                responsavel_tipo TEXT CHECK (responsavel_tipo IN ('encarregado', 'operador')),
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
                ativo BOOLEAN DEFAULT 1,
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
                -- Papéis específicos para processos PAD/CD/CJ
                presidente_id TEXT,
                presidente_tipo TEXT CHECK (presidente_tipo IN ('encarregado', 'operador')),
                interrogante_id TEXT,
                interrogante_tipo TEXT CHECK (interrogante_tipo IN ('encarregado', 'operador')),
                escrivao_processo_id TEXT,
                escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('encarregado', 'operador')),
                historico_encarregados TEXT, -- JSON com histórico de substituições
                -- NOVA COLUNA: Motorista responsável por sinistros de trânsito
                motorista_id TEXT,
                -- Nova constraint UNIQUE incluindo tipo_detalhe e local_origem
                UNIQUE(numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)
            )
        """)
        
        # 2. Copiar todos os dados da tabela antiga para a nova
        print("2. Copiando dados para a nova tabela...")
        cursor.execute("""
            INSERT INTO processos_procedimentos_new SELECT * FROM processos_procedimentos
        """)
        
        # 3. Remover a tabela antiga
        print("3. Removendo tabela antiga...")
        cursor.execute("DROP TABLE processos_procedimentos")
        
        # 4. Renomear a nova tabela
        print("4. Renomeando nova tabela...")
        cursor.execute("ALTER TABLE processos_procedimentos_new RENAME TO processos_procedimentos")
        
        # 5. Recriar índices se necessário
        print("5. Criando índices...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos_procedimentos(numero)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_processos_tipo ON processos_procedimentos(tipo_geral, tipo_detalhe)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_processos_data ON processos_procedimentos(data_instauracao)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_processos_ativo ON processos_procedimentos(ativo)")
        
        # 6. Recriar a view removida
        print("6. Recriando view v_processos_com_prazo...")
        cursor.execute("""
            CREATE VIEW v_processos_com_prazo AS
            SELECT 
                pp.*,
                CASE 
                    WHEN pp.data_remessa_encarregado IS NOT NULL THEN
                        CASE 
                            WHEN DATE(pp.data_remessa_encarregado, '+20 days') >= DATE('now') THEN 'Em dia'
                            ELSE 'Vencido'
                        END
                    ELSE 'Pendente'
                END as status_prazo,
                CASE 
                    WHEN pp.data_remessa_encarregado IS NOT NULL THEN
                        JULIANDAY(DATE(pp.data_remessa_encarregado, '+20 days')) - JULIANDAY(DATE('now'))
                    ELSE NULL
                END as dias_restantes
            FROM processos_procedimentos pp
            WHERE pp.ativo = 1
        """)
        
        conn.commit()
        print("Migração 025 concluída com sucesso!")
        print("Nova constraint UNIQUE: (numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)")
        
    except Exception as e:
        print(f"Erro durante a migração: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migration_025()
