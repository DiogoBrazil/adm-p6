#!/usr/bin/env python3
"""
Teste completo da edição de procedimento
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import obter_processo

def testar_edicao_completa():
    print("🧪 Testando edição completa de procedimento...\n")
    
    try:
        # Testar com um ID válido
        resultado = obter_processo('b7dc5de2-f522-40b7-8611-a7cb727f530f')
        
        if resultado:
            print("✅ Dados obtidos com sucesso!")
            print(f"📋 Tipo: {type(resultado)}")
            print(f"📊 Número de campos: {len(resultado) if isinstance(resultado, (list, tuple)) else 'N/A'}")
            
            if isinstance(resultado, dict):
                print("\n📝 Campos disponíveis:")
                for key, value in resultado.items():
                    print(f"  - {key}: {value}")
            elif isinstance(resultado, (list, tuple)):
                print("\n📝 Dados por índice:")
                for i, value in enumerate(resultado):
                    print(f"  [{i}]: {value}")
                    
                print("\n🔍 Campos específicos de interesse:")
                try:
                    if len(resultado) > 26:
                        print(f"  responsavel_completo [26]: {resultado[26]}")
                    if len(resultado) > 27:
                        print(f"  escrivao_completo [27]: {resultado[27]}")
                    if len(resultado) > 33:
                        print(f"  pm_completo [33]: {resultado[33]}")
                except IndexError as e:
                    print(f"  ❌ Erro de índice: {e}")
                    
            return resultado
        else:
            print("❌ Nenhum dado retornado")
            return None
            
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    testar_edicao_completa()
