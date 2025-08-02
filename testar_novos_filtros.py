#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar se os novos filtros PM Envolvido e Vítima estão funcionando
"""

import sqlite3
import os

def testar_novos_filtros():
    """Testa os novos filtros PM Envolvido e Vítima"""
    print("🔍 Testando novos filtros PM Envolvido e Vítima...")
    
    # Caminho do banco
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print("❌ Banco de dados não encontrado!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Testar a nova lógica para buscar PM envolvidos e vítimas
        query = """
            SELECT 
                p.numero,
                p.nome_vitima,
                COALESCE(
                    (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM encarregados WHERE id = p.nome_pm_id),
                    'Não informado'
                ) as pm_envolvido_completo
            FROM processos_procedimentos p
            WHERE p.ativo = 1
            ORDER BY p.numero
        """
        
        cursor.execute(query)
        resultados = cursor.fetchall()
        
        print(f"\n📋 Encontrados {len(resultados)} processos no total:")
        print("-" * 100)
        
        pm_envolvidos = set()
        vitimas = set()
        
        for resultado in resultados:
            numero, nome_vitima, pm_envolvido = resultado
            print(f"Processo: {numero}")
            print(f"   PM Envolvido: {pm_envolvido}")
            print(f"   Vítima: {nome_vitima or 'Não informado'}")
            print("-" * 50)
            
            if pm_envolvido and pm_envolvido != 'Não informado' and pm_envolvido.strip():
                pm_envolvidos.add(pm_envolvido.strip())
            if nome_vitima and nome_vitima.strip():
                vitimas.add(nome_vitima.strip())
        
        print(f"\n📊 Resumo dos valores únicos encontrados:")
        print(f"PM Envolvidos únicos: {len(pm_envolvidos)}")
        for pm in sorted(pm_envolvidos):
            print(f"   - {pm}")
        
        print(f"\nVítimas únicas: {len(vitimas)}")
        for vitima in sorted(vitimas):
            print(f"   - {vitima}")
        
        # Testar a nova query de opções
        print(f"\n🧪 Testando a query da função obter_opcoes_filtros...")
        
        opcoes_query = """
            SELECT DISTINCT 
                p.nome_vitima,
                COALESCE(
                    (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM encarregados WHERE id = p.nome_pm_id),
                    ''
                ) as pm_envolvido_completo
            FROM processos_procedimentos p
            WHERE p.ativo = 1
            AND (p.nome_vitima IS NOT NULL OR p.nome_pm_id IS NOT NULL)
        """
        
        cursor.execute(opcoes_query)
        opcoes_resultados = cursor.fetchall()
        
        print(f"Resultados da query de opções: {len(opcoes_resultados)} registros")
        for res in opcoes_resultados:
            vitima, pm_env = res
            if vitima or (pm_env and pm_env.strip()):
                print(f"   Vítima: '{vitima}' | PM: '{pm_env}'")
        
        conn.close()
        print("\n✅ Teste concluído!")
        
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_novos_filtros()
