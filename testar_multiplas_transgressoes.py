import sqlite3
import json

def testar_multiplas_transgressoes():
    """Testa o sistema de múltiplas transgressões"""
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("=== TESTE DE MÚLTIPLAS TRANSGRESSÕES ===\n")
    
    # 1. Verificar estrutura da tabela
    print("1. 📋 Verificando estrutura da tabela:")
    cursor.execute("PRAGMA table_info(processos_procedimentos)")
    columns = cursor.fetchall()
    
    transgressao_fields = [col for col in columns if 'transgressoes' in col[1] or 'infracao' in col[1]]
    for col in transgressao_fields:
        print(f"   • {col[1]} ({col[2]})")
    
    # 2. Verificar dados existentes
    print(f"\n2. 🔍 Verificando dados existentes:")
    cursor.execute("""
        SELECT numero, infracao_id, transgressoes_ids 
        FROM processos_procedimentos 
        WHERE infracao_id IS NOT NULL OR transgressoes_ids IS NOT NULL
    """)
    
    rows = cursor.fetchall()
    if rows:
        print(f"   Encontrados {len(rows)} processos com transgressões:")
        for row in rows:
            print(f"   • Processo {row[0]}: infracao_id={row[1]}, transgressoes_ids={row[2]}")
    else:
        print("   Nenhum processo com transgressões encontrado")
    
    # 3. Testar inserção de múltiplas transgressões
    print(f"\n3. 🧪 Testando inserção de múltiplas transgressões:")
    
    # Buscar algumas transgressões para teste
    cursor.execute("SELECT id, gravidade, inciso, texto FROM transgressoes WHERE ativo = 1 LIMIT 3")
    transgressoes_teste = cursor.fetchall()
    
    if len(transgressoes_teste) >= 2:
        # Criar lista JSON com IDs das transgressões
        ids_teste = [str(t[0]) for t in transgressoes_teste[:2]]
        json_teste = json.dumps(ids_teste)
        
        print(f"   Transgressões selecionadas para teste:")
        for t in transgressoes_teste[:2]:
            print(f"   • ID {t[0]}: {t[2]} - {t[3][:50]}...")
        
        print(f"   JSON resultante: {json_teste}")
        
        # Simular inserção (não vamos realmente inserir para não afetar dados)
        print(f"   ✅ JSON válido criado com {len(ids_teste)} transgressões")
    else:
        print("   ❌ Não há transgressões suficientes para teste")
    
    # 4. Testar parsing de JSON
    print(f"\n4. 🔧 Testando parsing de JSON:")
    
    cursor.execute("""
        SELECT numero, transgressoes_ids 
        FROM processos_procedimentos 
        WHERE transgressoes_ids IS NOT NULL
        LIMIT 1
    """)
    
    row = cursor.fetchone()
    if row:
        processo_numero, transgressoes_json = row
        print(f"   Processo {processo_numero}: {transgressoes_json}")
        
        try:
            ids = json.loads(transgressoes_json)
            print(f"   IDs parsed: {ids} (tipo: {type(ids)})")
            
            if ids:
                # Buscar detalhes das transgressões
                placeholders = ','.join(['?'] * len(ids))
                cursor.execute(f"""
                    SELECT id, inciso, texto 
                    FROM transgressoes 
                    WHERE id IN ({placeholders})
                """, ids)
                
                transgressoes_detalhes = cursor.fetchall()
                print(f"   Detalhes das transgressões:")
                for t in transgressoes_detalhes:
                    print(f"   • {t[1]} - {t[2][:50]}...")
                    
        except json.JSONDecodeError as e:
            print(f"   ❌ Erro ao fazer parse do JSON: {e}")
    else:
        print("   Nenhum processo com transgressoes_ids encontrado")
    
    conn.close()
    print(f"\n✅ Teste concluído!")

if __name__ == "__main__":
    testar_multiplas_transgressoes()
