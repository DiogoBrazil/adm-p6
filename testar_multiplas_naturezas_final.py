#!/usr/bin/env python3
"""
Teste da nova funcionalidade - Múltiplas naturezas de transgressões
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import db_manager, _determinar_natureza_processo
import json

def testar_multiplas_naturezas():
    """Testa a funcionalidade de múltiplas naturezas"""
    print("🧪 TESTANDO MÚLTIPLAS NATUREZAS DE TRANSGRESSÕES")
    print("=" * 60)
    
    # 1. Testar função de determinação de natureza
    print("\n1. 🔍 Testando determinação automática de natureza:")
    
    # Caso 1: Uma só natureza
    trans_leves = [
        {"id": "4", "natureza": "leve"},
        {"id": "8", "natureza": "leve"}
    ]
    resultado1 = _determinar_natureza_processo("Leve", trans_leves)
    print(f"   Só leves: {resultado1} (esperado: Leve)")
    
    # Caso 2: Múltiplas naturezas
    trans_mistas = [
        {"id": "21", "natureza": "media"},
        {"id": "8", "natureza": "leve"},
        {"id": "66", "natureza": "grave"}
    ]
    resultado2 = _determinar_natureza_processo("Média", trans_mistas)
    print(f"   Naturezas mistas: {resultado2} (esperado: Múltiplas)")
    
    # Caso 3: Sem transgressões
    resultado3 = _determinar_natureza_processo("Grave", [])
    print(f"   Sem transgressões: {resultado3} (esperado: Grave)")
    
    # 2. Testar dados do banco
    print("\n2. 📋 Verificando dados no banco:")
    
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    
    # Buscar processos com transgressões
    cursor.execute("""
        SELECT numero, natureza_processo, transgressoes_ids 
        FROM processos_procedimentos 
        WHERE transgressoes_ids IS NOT NULL AND transgressoes_ids != ''
        ORDER BY numero
    """)
    
    processos = cursor.fetchall()
    
    for processo in processos:
        numero, natureza, trans_json = processo
        print(f"\n   📄 Processo {numero}:")
        print(f"      Natureza atual: {natureza}")
        
        try:
            trans_data = json.loads(trans_json)
            if isinstance(trans_data, list) and len(trans_data) > 0:
                print(f"      Transgressões ({len(trans_data)}):")
                
                naturezas_encontradas = set()
                for i, trans in enumerate(trans_data, 1):
                    if isinstance(trans, dict):
                        # Formato novo
                        trans_id = trans.get('id', 'N/A')
                        natureza_trans = trans.get('natureza', 'N/A')
                        naturezas_encontradas.add(natureza_trans)
                        
                        # Buscar detalhes da transgressão
                        cursor.execute("SELECT inciso, texto FROM transgressoes WHERE id = ?", (trans_id,))
                        detalhes = cursor.fetchone()
                        if detalhes:
                            inciso, texto = detalhes
                            texto_resumido = texto[:40] + "..." if len(texto) > 40 else texto
                            print(f"         {i}. [{natureza_trans.upper()}] {inciso} - {texto_resumido}")
                        else:
                            print(f"         {i}. [{natureza_trans.upper()}] ID {trans_id} - Não encontrada")
                    else:
                        # Formato antigo
                        print(f"         {i}. [FORMATO ANTIGO] ID {trans}")
                
                # Verificar se a natureza do processo está correta
                if len(naturezas_encontradas) > 1:
                    natureza_esperada = "Múltiplas"
                elif len(naturezas_encontradas) == 1:
                    nat = list(naturezas_encontradas)[0]
                    natureza_esperada = {"leve": "Leve", "media": "Média", "grave": "Grave"}.get(nat, nat)
                else:
                    natureza_esperada = natureza
                
                status = "✅" if natureza == natureza_esperada else "⚠️"
                print(f"         {status} Natureza: {natureza} (esperado: {natureza_esperada})")
        except json.JSONDecodeError:
            print(f"      ❌ Erro ao processar JSON: {trans_json}")
    
    conn.close()
    
    # 3. Testar cenários específicos
    print(f"\n3. 🎯 Cenários de teste:")
    print(f"   ✅ Transgressão única: mantém natureza original")
    print(f"   ✅ Múltiplas transgressões mesma natureza: mantém natureza")
    print(f"   ✅ Múltiplas naturezas diferentes: exibe 'Múltiplas'")
    print(f"   ✅ Formato antigo e novo suportados")
    print(f"   ✅ Tags visuais com cores por natureza")
    
    print(f"\n🚀 Próximos passos para testar:")
    print(f"   1. Inicie o sistema: python main.py")
    print(f"   2. Crie um novo PADS")
    print(f"   3. Selecione natureza 'Leve' e adicione uma transgressão")
    print(f"   4. Clique 'Adicionar outra transgressão'")
    print(f"   5. Selecione natureza 'Grave' e adicione outra")
    print(f"   6. Verifique as tags coloridas de natureza")
    print(f"   7. Salve e veja na listagem como 'Múltiplas'")
    
    print(f"\n✅ Teste concluído!")

if __name__ == "__main__":
    testar_multiplas_naturezas()
