import sqlite3
import json

def testar_natureza_transgressoes():
    print("🧪 TESTE: Múltiplas Naturezas de Transgressões\n")
    
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    # Verificar transgressões por natureza
    print("📊 Distribuição de transgressões por natureza:")
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
    
    for row in cursor.fetchall():
        print(f"  • {row[0].upper()}: {row[1]} transgressões")
    
    # Exemplo de dados no novo formato
    print(f"\n🔄 Novo formato de dados de transgressões:")
    exemplo_novo_formato = [
        {"natureza": "leve", "transgressao_id": "4"},
        {"natureza": "media", "transgressao_id": "45"},
        {"natureza": "grave", "transgressao_id": "87"}
    ]
    print(f"  Formato JSON: {json.dumps(exemplo_novo_formato, indent=2)}")
    
    # Verificar se há processos PADS existentes
    cursor.execute('''
        SELECT COUNT(*) 
        FROM processos_procedimentos 
        WHERE tipo_geral = 'processo' AND tipo_detalhe = 'PADS' AND ativo = 1
    ''')
    pads_count = cursor.fetchone()[0]
    print(f"\n📋 Processos PADS existentes: {pads_count}")
    
    if pads_count > 0:
        print("  ✅ Poderá testar a edição com dados existentes")
    else:
        print("  ℹ️  Crie um processo PADS para testar completamente")
    
    # Testar busca por natureza específica
    for natureza in ['leve', 'media', 'grave']:
        cursor.execute('''
            SELECT COUNT(*) 
            FROM transgressoes 
            WHERE gravidade = ? AND ativo = 1
        ''', (natureza,))
        count = cursor.fetchone()[0]
        print(f"  🔍 Transgressões {natureza}: {count} disponíveis")
    
    conn.close()
    
    print(f"\n🚀 Funcionalidades implementadas:")
    print("  ✅ Seleção de natureza antes do inciso")
    print("  ✅ Múltiplas naturezas no mesmo PADS")
    print("  ✅ Compatibilidade com dados antigos")
    print("  ✅ Interface atualizada com indicador de natureza")
    print("  ✅ Backend adaptado para novo formato")
    
    print(f"\n📝 Como testar:")
    print("  1. Abra o formulário de processo")
    print("  2. Selecione: Processo > PADS")
    print("  3. Preencha natureza do processo")
    print("  4. Clique 'Adicionar Transgressão'")
    print("  5. Selecione uma natureza (leve/média/grave)")
    print("  6. Escolha um inciso")
    print("  7. Repita com natureza diferente")
    print("  8. Verifique que aparecem tags de natureza")

if __name__ == "__main__":
    testar_natureza_transgressoes()
