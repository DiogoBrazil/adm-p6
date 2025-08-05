#!/usr/bin/env python3
"""
Script para executar a migração 010 - Infrações do Art. 29
"""

import sqlite3
import os
from datetime import datetime

def executar_migracao_010():
    db_path = 'usuarios.db'
    migration_file = 'migrations/010_infracoes_estatuto_art29.sql'
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return False
    
    if not os.path.exists(migration_file):
        print(f"❌ Arquivo de migração não encontrado: {migration_file}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se a migração já foi executada
        cursor.execute("SELECT COUNT(*) FROM schema_migrations WHERE migration_name = ?", (os.path.basename(migration_file),))
        if cursor.fetchone()[0] > 0:
            print("⚠️ Migração 010 já foi executada anteriormente")
            return True
        
        print("🔄 Executando migração 010: Infrações do Art. 29...")
        
        # Ler e executar o arquivo de migração
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        # Executar a migração
        cursor.executescript(migration_sql)
        
        # Registrar a migração na tabela de controle
        cursor.execute("""
            INSERT INTO schema_migrations (migration_name, executed_at, success) 
            VALUES (?, ?, ?)
        """, (os.path.basename(migration_file), datetime.now().isoformat(), 1))
        
        conn.commit()
        print("✅ Migração 010 executada com sucesso!")
        
        # Verificar os dados inseridos
        cursor.execute("SELECT COUNT(*) FROM infracoes_estatuto_art29")
        count_art29 = cursor.fetchone()[0]
        print(f"📋 {count_art29} incisos do Art. 29 inseridos")
        
        cursor.execute("SELECT COUNT(*) FROM analogias_estatuto_rdpm")
        count_analogias = cursor.fetchone()[0]
        print(f"🔗 {count_analogias} analogias cadastradas")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    sucesso = executar_migracao_010()
    exit(0 if sucesso else 1)
