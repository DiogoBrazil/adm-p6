#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar se a correção do filtro de ano está funcionando corretamente
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import listar_processos_com_prazos

def testar_filtro_ano():
    """Testa o filtro de ano com diferentes valores"""
    print("🔍 Testando correção do filtro de ano...")
    
    try:
        # Teste 1: Filtrar por 2024
        print("\n📅 Teste 1: Filtros ano=2024 + encarregado específico")
        filtros_2024 = {
            'ano': '2024',
            'encarregado': 'CAP PM 100085321 JOSE CARLOS RODRIGUES FELICIO'
        }
        resultado_2024 = listar_processos_com_prazos(search_term=None, page=1, per_page=50, filtros=filtros_2024)
        
        if resultado_2024['sucesso']:
            print(f"✅ Encontrados {len(resultado_2024['processos'])} processos para 2024")
            for proc in resultado_2024['processos']:
                print(f"   - {proc['numero']} | Instauração: {proc['data_instauracao']} | Recebimento: {proc['data_recebimento']}")
        else:
            print(f"❌ Erro: {resultado_2024['mensagem']}")
        
        # Teste 2: Filtrar por 2025
        print("\n📅 Teste 2: Filtros ano=2025 + mesmo encarregado")
        filtros_2025 = {
            'ano': '2025',
            'encarregado': 'CAP PM 100085321 JOSE CARLOS RODRIGUES FELICIO'
        }
        resultado_2025 = listar_processos_com_prazos(search_term=None, page=1, per_page=50, filtros=filtros_2025)
        
        if resultado_2025['sucesso']:
            print(f"✅ Encontrados {len(resultado_2025['processos'])} processos para 2025")
            for proc in resultado_2025['processos']:
                print(f"   - {proc['numero']} | Instauração: {proc['data_instauracao']} | Recebimento: {proc['data_recebimento']}")
        else:
            print(f"❌ Erro: {resultado_2025['mensagem']}")
        
        # Teste 3: Apenas filtro de encarregado (sem ano)
        print("\n👤 Teste 3: Apenas filtro de encarregado (todos os anos)")
        filtros_encarregado = {
            'encarregado': 'CAP PM 100085321 JOSE CARLOS RODRIGUES FELICIO'
        }
        resultado_todos = listar_processos_com_prazos(search_term=None, page=1, per_page=50, filtros=filtros_encarregado)
        
        if resultado_todos['sucesso']:
            print(f"✅ Encontrados {len(resultado_todos['processos'])} processos totais para este encarregado")
            for proc in resultado_todos['processos']:
                print(f"   - {proc['numero']} | Instauração: {proc['data_instauracao']} | Recebimento: {proc['data_recebimento']}")
        else:
            print(f"❌ Erro: {resultado_todos['mensagem']}")
        
        # Comparar resultados
        print("\n📊 Análise dos resultados:")
        total_2024 = len(resultado_2024['processos']) if resultado_2024['sucesso'] else 0
        total_2025 = len(resultado_2025['processos']) if resultado_2025['sucesso'] else 0
        total_geral = len(resultado_todos['processos']) if resultado_todos['sucesso'] else 0
        
        print(f"   - Processos 2024: {total_2024}")
        print(f"   - Processos 2025: {total_2025}")
        print(f"   - Total geral: {total_geral}")
        
        if total_2024 + total_2025 == total_geral:
            print("✅ Correção bem-sucedida! Os filtros por ano estão funcionando corretamente.")
        else:
            print("⚠️  Ainda há inconsistência nos filtros.")
            
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_filtro_ano()
