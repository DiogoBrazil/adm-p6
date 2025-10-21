#!/usr/bin/env python3
"""
Migração 023: Atualizar constraint responsavel_tipo para aceitar 'usuario'
Data: 2025-10-20
Descrição: Remove a constraint CHECK antiga e atualiza todos os tipos para 'usuario'
"""

import sqlite3
import sys
from datetime import datetime

def migrate():
    # Conectar ao banco
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    try:
        print("🔄 Iniciando migração 023...")
        
        # Fazer backup
        backup_file = f'backups/pre_responsavel_tipo_fix_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
        cursor.execute(f"VACUUM INTO '{backup_file}'")
        print(f"✅ Backup criado: {backup_file}")
        
        # 1. Obter estrutura da tabela atual
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns = cursor.fetchall()
        print(f"📋 Tabela tem {len(columns)} colunas")
        
        # 2. Obter o SQL de criação da tabela
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='processos_procedimentos'")
        create_sql_result = cursor.fetchone()
        if not create_sql_result:
            raise Exception("Tabela processos_procedimentos não encontrada!")
        create_sql = create_sql_result[0]
        
        # 3. Modificar o SQL para remover a constraint e permitir 'usuario'
        # Substituir a constraint CHECK antiga
        create_sql_new = create_sql.replace(
            "responsavel_tipo TEXT CHECK (responsavel_tipo IN ('encarregado', 'operador'))",
            "responsavel_tipo TEXT"
        )
        # Renomear para _new
        create_sql_new = create_sql_new.replace(
            'CREATE TABLE "processos_procedimentos"',
            'CREATE TABLE "processos_procedimentos_new"'
        )
        create_sql_new = create_sql_new.replace(
            "CREATE TABLE processos_procedimentos",
            "CREATE TABLE processos_procedimentos_new"
        )
        
        print("📝 Criando nova tabela sem constraint...")
        cursor.execute(create_sql_new)
        
        # 4. Copiar dados, convertendo tipos
        print("📦 Copiando dados e convertendo tipos...")
        
        # Primeiro, obter nomes de todas as colunas
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns_info = cursor.fetchall()
        column_names = [col[1] for col in columns_info]
        
        # Criar lista de colunas com CASE para os campos *_tipo
        select_cols = []
        for col in column_names:
            if col in ['responsavel_tipo', 'presidente_tipo', 'interrogante_tipo', 'escrivao_processo_tipo']:
                select_cols.append(f"""
                    CASE 
                        WHEN {col} IN ('encarregado', 'operador') THEN 'usuario'
                        ELSE {col} 
                    END as {col}
                """)
            else:
                select_cols.append(col)
        
        select_clause = ',\n                '.join(select_cols)
        
        insert_sql = f"""
            INSERT INTO processos_procedimentos_new 
            SELECT {select_clause}
            FROM processos_procedimentos
        """
        
        cursor.execute(insert_sql)
        
        rows_copied = cursor.rowcount
        print(f"✅ {rows_copied} registros copiados")
        
        # 5. Salvar views que dependem da tabela
        print("💾 Salvando views dependentes...")
        cursor.execute("""
            SELECT name, sql FROM sqlite_master 
            WHERE type='view' AND sql LIKE '%processos_procedimentos%'
        """)
        views = cursor.fetchall()
        print(f"   Encontradas {len(views)} views dependentes")
        
        # Dropar views
        for view_name, _ in views:
            cursor.execute(f"DROP VIEW IF EXISTS {view_name}")
            print(f"   🗑️ View {view_name} removida temporariamente")
        
        # 6. Dropar tabela antiga
        print("🗑️ Removendo tabela antiga...")
        cursor.execute("DROP TABLE processos_procedimentos")
        
        # 7. Renomear nova tabela
        print("🔄 Renomeando nova tabela...")
        cursor.execute("ALTER TABLE processos_procedimentos_new RENAME TO processos_procedimentos")
        
        # 8. Recriar views
        print("🔄 Recriando views...")
        for view_name, view_sql in views:
            try:
                cursor.execute(view_sql)
                print(f"   ✅ View {view_name} recriada")
            except Exception as e:
                print(f"   ⚠️ Aviso: Não foi possível recriar view {view_name}: {e}")
        
        # 9. Recriar índices
        print("📇 Recriando índices...")
        indices = [
            "CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos_procedimentos(numero)",
            "CREATE INDEX IF NOT EXISTS idx_processos_tipo ON processos_procedimentos(tipo_geral, tipo_detalhe)",
            "CREATE INDEX IF NOT EXISTS idx_processos_responsavel ON processos_procedimentos(responsavel_id)",
            "CREATE INDEX IF NOT EXISTS idx_processos_data_instauracao ON processos_procedimentos(data_instauracao)",
            "CREATE INDEX IF NOT EXISTS idx_processos_ativo ON processos_procedimentos(ativo)"
        ]
        
        for idx_sql in indices:
            cursor.execute(idx_sql)
        
        # 10. Registrar migração
        cursor.execute("""
            INSERT INTO schema_migrations (migration_name, success) 
            VALUES ('023_update_responsavel_tipo_constraint', 1)
        """)
        
        conn.commit()
        print("✅ Migração 023 concluída com sucesso!")
        
        # Verificar resultado
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos WHERE responsavel_tipo = 'usuario'")
        count = cursor.fetchone()[0]
        print(f"📊 {count} registros agora usam tipo 'usuario'")
        
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
