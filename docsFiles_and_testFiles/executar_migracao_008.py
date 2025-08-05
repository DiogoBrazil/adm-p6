import sqlite3
import os

def executar_migracao():
    """Executa a migração para suporte a múltiplas transgressões"""
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print("❌ Banco de dados não encontrado!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🔄 Executando migração 008: Múltiplas transgressões...")
        
        # Ler e executar migração
        with open('migrations/008_multiplas_transgressoes.sql', 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Executar script
        cursor.executescript(sql_script)
        
        print("✅ Migração executada com sucesso!")
        
        # Verificar resultado
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns = cursor.fetchall()
        
        print("\n📋 Colunas da tabela processos_procedimentos:")
        for col in columns:
            if 'transgressoes' in col[1] or 'infracao' in col[1]:
                print(f"  • {col[1]} ({col[2]})")
        
        # Verificar dados migrados
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos WHERE transgressoes_ids IS NOT NULL")
        migrated = cursor.fetchone()[0]
        print(f"\n📊 Registros com transgressões migrados: {migrated}")
        
        if migrated > 0:
            cursor.execute("SELECT numero, infracao_id, transgressoes_ids FROM processos_procedimentos WHERE transgressoes_ids IS NOT NULL LIMIT 3")
            print("\n🔍 Exemplos de dados migrados:")
            for row in cursor.fetchall():
                print(f"  Processo {row[0]}: {row[1]} → {row[2]}")
        
        conn.commit()
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    executar_migracao()
