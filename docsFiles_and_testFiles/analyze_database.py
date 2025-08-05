import sqlite3
import os

def analyze_database():
    """Analisa a estrutura do banco de dados SQLite"""
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=" * 80)
    print("ANÁLISE DA ESTRUTURA DO BANCO DE DADOS")
    print("=" * 80)
    
    # Listar todas as tabelas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print(f"\n📊 TABELAS ENCONTRADAS ({len(tables)}):")
    print("-" * 40)
    for table in tables:
        print(f"• {table[0]}")
    
    # Analisar cada tabela
    for table in tables:
        table_name = table[0]
        print(f"\n" + "=" * 60)
        print(f"TABELA: {table_name.upper()}")
        print("=" * 60)
        
        # Obter esquema da tabela
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        
        print(f"\n📋 COLUNAS ({len(columns)}):")
        print("-" * 40)
        for col in columns:
            cid, name, type_, notnull, default_value, pk = col
            pk_text = " (PRIMARY KEY)" if pk else ""
            notnull_text = " NOT NULL" if notnull else ""
            default_text = f" DEFAULT {default_value}" if default_value else ""
            print(f"  {name:<20} {type_:<15}{notnull_text}{default_text}{pk_text}")
        
        # Contar registros
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"\n📈 TOTAL DE REGISTROS: {count}")
        
        # Mostrar alguns registros de exemplo (se houver)
        if count > 0 and count <= 5:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
            rows = cursor.fetchall()
            if rows:
                print(f"\n📝 DADOS DE EXEMPLO:")
                print("-" * 40)
                for i, row in enumerate(rows, 1):
                    print(f"  Registro {i}: {row}")
        elif count > 5:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 2;")
            rows = cursor.fetchall()
            if rows:
                print(f"\n📝 PRIMEIROS REGISTROS (mostrando 2 de {count}):")
                print("-" * 40)
                for i, row in enumerate(rows, 1):
                    print(f"  Registro {i}: {row}")
    
    # Verificar chaves estrangeiras
    print(f"\n" + "=" * 60)
    print("RELACIONAMENTOS (FOREIGN KEYS)")
    print("=" * 60)
    
    for table in tables:
        table_name = table[0]
        cursor.execute(f"PRAGMA foreign_key_list({table_name});")
        fks = cursor.fetchall()
        
        if fks:
            print(f"\n🔗 TABELA {table_name.upper()}:")
            for fk in fks:
                id_, seq, table_ref, from_col, to_col, on_update, on_delete, match = fk
                print(f"  {from_col} → {table_ref}.{to_col}")
    
    # Verificar índices
    print(f"\n" + "=" * 60)
    print("ÍNDICES")
    print("=" * 60)
    
    cursor.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL;")
    indexes = cursor.fetchall()
    
    if indexes:
        for idx in indexes:
            name, table, sql = idx
            print(f"\n📌 {name} (tabela: {table}):")
            print(f"   {sql}")
    else:
        print("\nNenhum índice personalizado encontrado.")
    
    conn.close()
    print(f"\n" + "=" * 80)
    print("ANÁLISE CONCLUÍDA")
    print("=" * 80)

if __name__ == "__main__":
    analyze_database()
