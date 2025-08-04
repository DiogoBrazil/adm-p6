import sqlite3

def verificar_uso_transgressoes():
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("=== VERIFICAÇÃO DO USO DAS TRANSGRESSÕES ===\n")
    
    # Verificar quantos processos têm infração associada
    cursor.execute('SELECT COUNT(*) FROM processos_procedimentos WHERE infracao_id IS NOT NULL')
    processos_com_infracao = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM processos_procedimentos')
    total_processos = cursor.fetchone()[0]
    
    print(f"📋 Total de processos: {total_processos}")
    print(f"🔗 Processos com infração associada: {processos_com_infracao}")
    print(f"📊 Percentual: {(processos_com_infracao/total_processos*100):.1f}%" if total_processos > 0 else "N/A")
    
    if processos_com_infracao > 0:
        print(f"\n🔍 Processos vinculados a transgressões:")
        cursor.execute('''
            SELECT p.numero, p.tipo_geral, t.gravidade, t.inciso, t.texto 
            FROM processos_procedimentos p 
            JOIN transgressoes t ON p.infracao_id = t.id 
            WHERE p.infracao_id IS NOT NULL
            ORDER BY p.numero
        ''')
        
        for row in cursor.fetchall():
            texto = row[4][:60] + '...' if len(row[4]) > 60 else row[4]
            print(f"  {row[1].upper()} {row[0]} → {row[2].upper()} {row[3]} - {texto}")
    else:
        print(f"\n❌ Nenhum processo está vinculado a transgressões ainda")
    
    # Verificar integridade da FK
    cursor.execute('''
        SELECT COUNT(*) 
        FROM processos_procedimentos 
        WHERE infracao_id IS NOT NULL 
        AND infracao_id NOT IN (SELECT id FROM transgressoes)
    ''')
    
    fk_invalidas = cursor.fetchone()[0]
    if fk_invalidas > 0:
        print(f"\n⚠️  Atenção: {fk_invalidas} processos com infracao_id inválido!")
    
    conn.close()

if __name__ == "__main__":
    verificar_uso_transgressoes()
