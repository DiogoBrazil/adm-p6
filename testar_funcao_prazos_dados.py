#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Teste da função listar_processos_com_prazos com verificação dos dados completos
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Importar função do main.py
from main import listar_processos_com_prazos

def testar_dados_completos():
    """Testa se todos os dados estão sendo retornados corretamente"""
    print("=== TESTE FUNÇÃO listar_processos_com_prazos ===\n")
    
    try:
        resultado = listar_processos_com_prazos()
        
        if not resultado["sucesso"]:
            print(f"❌ Erro: {resultado['mensagem']}")
            return
        
        processos = resultado["processos"]
        if not processos:
            print("❌ Nenhum processo encontrado")
            return
        
        print(f"✅ Total de processos: {len(processos)}")
        print("\n=== PRIMEIRO PROCESSO ===")
        
        processo = processos[0]
        campos_verificar = [
            "numero", "processo_sei", "responsavel", "responsavel_posto",
            "pm_envolvido_nome", "status_pm", "local_origem", "prazo"
        ]
        
        for campo in campos_verificar:
            valor = processo.get(campo, "CAMPO_NAO_ENCONTRADO")
            status = "✅" if valor and valor != "CAMPO_NAO_ENCONTRADO" else "❌"
            print(f"{status} {campo}: {valor}")
        
        print(f"\n=== DADOS COMPLETOS DO PRIMEIRO PROCESSO ===")
        for key, value in processo.items():
            print(f"{key}: {value}")
            
    except Exception as e:
        print(f"❌ Erro ao executar teste: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_dados_completos()
