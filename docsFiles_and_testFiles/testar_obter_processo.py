#!/usr/bin/env python3
"""
Teste para verificar se há erro na função obter_processo
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import main

def testar_obter_processo():
    """Testa a função obter_processo"""
    print("🔍 Testando função obter_processo...")
    
    try:
        # Usar um ID que sabemos que existe
        resultado = main.obter_processo('3789cb84-4e45-4d8d-a5c4-d6194b9c5195')  # ID do processo 601
        
        if resultado:
            print("✅ Função obter_processo retornou dados")
            print(f"📋 ID: {resultado.get('id')}")
            print(f"📋 Número: {resultado.get('numero')}")
            print(f"👤 Responsável completo: '{resultado.get('responsavel_completo')}'")
            print(f"✍️  Escrivão completo: '{resultado.get('escrivao_completo')}'")
            print(f"👮 PM completo: '{resultado.get('pm_completo')}'")
            
            # Verificar se há algum problema com campos None
            campos_com_problema = []
            for key, value in resultado.items():
                if value is None and key not in ['data_conclusao', 'nome_vitima', 'natureza_processo', 'natureza_procedimento', 'resumo_fatos']:
                    campos_com_problema.append(key)
            
            if campos_com_problema:
                print(f"⚠️  Campos com valor None: {campos_com_problema}")
            else:
                print("✅ Todos os campos essenciais têm valores")
                
        else:
            print("❌ Função obter_processo retornou None")
    
    except Exception as e:
        print(f"❌ Erro na função obter_processo: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_obter_processo()
