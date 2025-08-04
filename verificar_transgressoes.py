import sqlite3

def verificar_transgressoes():
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("=== VERIFICAÇÃO DA TABELA TRANSGRESSÕES ===\n")
    
    # Total de registros
    cursor.execute('SELECT COUNT(*) FROM transgressoes WHERE ativo = 1')
    total = cursor.fetchone()[0]
    print(f"📊 Total de transgressões ativas: {total}")
    
    # Por gravidade
    cursor.execute('''
        SELECT gravidade, COUNT(*) 
        FROM transgressoes 
        WHERE ativo = 1 
        GROUP BY gravidade 
        ORDER BY CASE gravidade 
            WHEN 'leve' THEN 1 
            WHEN 'media' THEN 2 
            WHEN 'grave' THEN 3 
        END
    ''')
    
    print("\n📈 Distribuição por gravidade:")
    for row in cursor.fetchall():
        print(f"  • {row[0].upper()}: {row[1]} transgressões")
    
    # Exemplos de cada gravidade
    for gravidade in ['leve', 'media', 'grave']:
        print(f"\n🔹 EXEMPLOS DE TRANSGRESSÕES {gravidade.upper()}:")
        cursor.execute('''
            SELECT inciso, texto 
            FROM transgressoes 
            WHERE gravidade = ? AND ativo = 1 
            ORDER BY id
            LIMIT 3
        ''', (gravidade,))
        
        for row in cursor.fetchall():
            texto = row[1][:80] + '...' if len(row[1]) > 80 else row[1]
            print(f"  {row[0]:4s} - {texto}")
    
    # Verificar se há transgressões inativas
    cursor.execute('SELECT COUNT(*) FROM transgressoes WHERE ativo = 0')
    inativos = cursor.fetchone()[0]
    if inativos > 0:
        print(f"\n⚠️  Há {inativos} transgressões inativas no banco")
    
    # Últimas transgressões adicionadas
    print(f"\n📅 Últimas 5 transgressões adicionadas:")
    cursor.execute('''
        SELECT id, gravidade, inciso, texto, created_at
        FROM transgressoes 
        ORDER BY created_at DESC 
        LIMIT 5
    ''')
    
    for row in cursor.fetchall():
        texto = row[3][:60] + '...' if len(row[3]) > 60 else row[3]
        print(f"  ID {row[0]:2d} | {row[1]:5s} | {row[2]:4s} | {texto}")
    
    conn.close()

if __name__ == "__main__":
    verificar_transgressoes()
