#!/usr/bin/env python3
"""
Teste das funcionalidades de múltiplos PMs
"""

import sys
import os
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import obter_processo, obter_pms_formatados, db_manager

def testar_multiplos_pms():
    print("🧪 Testando funcionalidades de múltiplos PMs...\n")
    
    try:
        # Testar função obter_processo com procedimento
        print("1. Testando obter_processo com procedimento...")
        resultado = obter_processo('979199d5-1b4e-42b9-9b66-64aa0865fd69')
        
        if resultado:
            print("✅ Processo obtido com sucesso!")
            print(f"📋 Tipo: {resultado['tipo_geral']}")
            print(f"🆔 ID do PM: {resultado['nome_pm_id']}")
            print(f"📊 Status PM: {resultado['status_pm']}")
            
            if 'pms_envolvidos' in resultado:
                print(f"👥 PMs Envolvidos: {resultado['pms_envolvidos']}")
            else:
                print(f"👤 PM Completo: {resultado['pm_completo']}")
                
        else:
            print("❌ Nenhum processo encontrado")
            
        print("\n" + "="*50 + "\n")
        
        # Testar função auxiliar diretamente
        print("2. Testando função obter_pms_formatados...")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Testar com JSON (procedimento)
        json_pms = '[{"pm_id":"1572d3b8-e84d-48b9-9f5b-0dc28fb70029","status":"Indiciado"}]'
        pms_formatados = obter_pms_formatados('procedimento', json_pms, cursor)
        
        print(f"📋 PMs formatados (procedimento): {pms_formatados}")
        
        # Testar com ID único (processo)
        pm_unico = obter_pms_formatados('processo', '9b753023-09f5-4fb5-bae2-c49433215f80', cursor)
        print(f"👤 PM formatado (processo): {pm_unico}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_multiplos_pms()
