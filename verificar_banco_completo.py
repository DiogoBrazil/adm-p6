#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar todos os processos no banco e suas datas
"""

import sqlite3
import os

def verificar_todos_processos():
    """Verifica todos os processos no banco para entender a distribuição por anos"""
    print("🔍 Verificando todos os processos no banco...")
    
    # Caminho do banco
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print("❌ Banco de dados não encontrado!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Buscar todos os processos ativos com seus anos
        query = """
            SELECT 
                p.numero,
                p.data_instauracao,
                p.data_recebimento,
                p.created_at,
                CASE 
                    WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
                    WHEN p.data_recebimento IS NOT NULL THEN strftime('%Y', p.data_recebimento)
                    ELSE strftime('%Y', p.created_at)
                END as ano_extraido,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.matricula || ' ' || o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.matricula || ' ' || e.nome END,
                    ''
                ) as responsavel_completo
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            WHERE p.ativo = 1
            ORDER BY ano_extraido DESC, p.numero
        """
        
        cursor.execute(query)
        todos_processos = cursor.fetchall()
        
        print(f"\n📋 Total de processos ativos: {len(todos_processos)}")
        print("=" * 120)
        
        # Agrupar por ano
        processos_por_ano = {}
        for processo in todos_processos:
            numero, data_inst, data_receb, created_at, ano, responsavel = processo
            if ano not in processos_por_ano:
                processos_por_ano[ano] = []
            processos_por_ano[ano].append({
                'numero': numero,
                'data_inst': data_inst,
                'data_receb': data_receb,
                'created_at': created_at,
                'responsavel': responsavel
            })
        
        # Mostrar estatísticas por ano
        print("\n📊 Distribuição por ano:")
        for ano in sorted(processos_por_ano.keys(), reverse=True):
            print(f"\n📅 Ano {ano}: {len(processos_por_ano[ano])} processos")
            
            # Contar por responsável neste ano
            responsaveis_ano = {}
            for proc in processos_por_ano[ano]:
                resp = proc['responsavel']
                if resp not in responsaveis_ano:
                    responsaveis_ano[resp] = 0
                responsaveis_ano[resp] += 1
            
            print("   Responsáveis:")
            for resp, qtd in sorted(responsaveis_ano.items()):
                if resp and 'JOSE CARLOS' in resp:
                    print(f"   >>> {resp}: {qtd} processos <<<")
                else:
                    print(f"       {resp}: {qtd} processos")
        
        # Mostrar detalhes dos processos do JOSE CARLOS
        print(f"\n🔍 Detalhes dos processos de JOSE CARLOS RODRIGUES FELICIO:")
        print("-" * 120)
        
        for processo in todos_processos:
            numero, data_inst, data_receb, created_at, ano, responsavel = processo
            if responsavel and 'JOSE CARLOS RODRIGUES FELICIO' in responsavel:
                print(f"Processo: {numero} | Ano: {ano}")
                print(f"   Data instauração: {data_inst}")
                print(f"   Data recebimento: {data_receb}")  
                print(f"   Data criação: {created_at}")
                print(f"   Responsável: {responsavel}")
                print("-" * 60)
        
        conn.close()
        print("\n✅ Verificação concluída!")
        
    except Exception as e:
        print(f"❌ Erro na verificação: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verificar_todos_processos()
