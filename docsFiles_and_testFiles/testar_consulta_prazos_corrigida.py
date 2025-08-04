#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar se a consulta de prazos está buscando corretamente
operadores que atuam como PM envolvidos
"""

import sqlite3
import os

def testar_consulta_prazos_corrigida():
    """Testa se a consulta está funcionando corretamente"""
    print("🔍 Testando consulta de prazos corrigida...")
    
    try:
        # Conectar ao banco
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usuarios.db')
        if not os.path.exists(db_path):
            print(f"❌ Banco de dados não encontrado em: {db_path}")
            return False
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Verificar se existem operadores que são PM envolvidos
        print("\n1. Verificando operadores que são PM envolvidos:")
        cursor.execute("""
            SELECT p.numero, p.nome_pm_id, o.nome, o.posto_graduacao 
            FROM processos_procedimentos p
            INNER JOIN operadores o ON p.nome_pm_id = o.id
            WHERE p.ativo = 1
        """)
        operadores_pm = cursor.fetchall()
        
        if operadores_pm:
            print(f"   ✅ Encontrados {len(operadores_pm)} processos com operadores como PM envolvido:")
            for proc in operadores_pm:
                print(f"      - Processo {proc[0]}: {proc[2]} ({proc[3]})")
        else:
            print("   ⚠️  Nenhum processo com operador como PM envolvido encontrado")
        
        # 2. Verificar se existem encarregados que são PM envolvidos
        print("\n2. Verificando encarregados que são PM envolvidos:")
        cursor.execute("""
            SELECT p.numero, p.nome_pm_id, e.nome, e.posto_graduacao 
            FROM processos_procedimentos p
            INNER JOIN encarregados e ON p.nome_pm_id = e.id
            WHERE p.ativo = 1
        """)
        encarregados_pm = cursor.fetchall()
        
        if encarregados_pm:
            print(f"   ✅ Encontrados {len(encarregados_pm)} processos com encarregados como PM envolvido:")
            for proc in encarregados_pm:
                print(f"      - Processo {proc[0]}: {proc[2]} ({proc[3]})")
        else:
            print("   ⚠️  Nenhum processo com encarregado como PM envolvido encontrado")
        
        # 3. Testar a consulta corrigida completa
        print("\n3. Testando consulta corrigida completa:")
        cursor.execute("""
            SELECT 
                p.numero, p.nome_pm_id,
                COALESCE(pm_env_e.nome, pm_env_o.nome, 'Não informado') as pm_envolvido_nome,
                COALESCE(pm_env_e.posto_graduacao, pm_env_o.posto_graduacao, '') as pm_envolvido_posto
            FROM processos_procedimentos p
            LEFT JOIN encarregados pm_env_e ON p.nome_pm_id = pm_env_e.id
            LEFT JOIN operadores pm_env_o ON p.nome_pm_id = pm_env_o.id
            WHERE p.ativo = 1 AND p.nome_pm_id IS NOT NULL
            ORDER BY p.created_at DESC
        """)
        
        resultados = cursor.fetchall()
        
        if resultados:
            print(f"   ✅ Consulta retornou {len(resultados)} processos com PM envolvido:")
            for resultado in resultados:
                numero, pm_id, nome, posto = resultado
                print(f"      - Processo {numero}: {posto} {nome} (ID: {pm_id})")
        else:
            print("   ⚠️  Nenhum processo com PM envolvido encontrado na consulta")
        
        # 4. Verificar se há processos com operadores como responsáveis
        print("\n4. Verificando operadores que são responsáveis:")
        cursor.execute("""
            SELECT p.numero, p.responsavel_id, p.responsavel_tipo, o.nome, o.posto_graduacao
            FROM processos_procedimentos p
            INNER JOIN operadores o ON p.responsavel_id = o.id
            WHERE p.ativo = 1 AND p.responsavel_tipo = 'operador'
        """)
        responsaveis_operadores = cursor.fetchall()
        
        if responsaveis_operadores:
            print(f"   ✅ Encontrados {len(responsaveis_operadores)} processos com operadores como responsáveis:")
            for proc in responsaveis_operadores:
                print(f"      - Processo {proc[0]}: {proc[3]} ({proc[4]})")
        else:
            print("   ⚠️  Nenhum processo com operador como responsável encontrado")
        
        conn.close()
        
        print("\n✅ Teste concluído com sucesso!")
        return True
        
    except Exception as e:
        print(f"\n❌ Erro no teste: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    testar_consulta_prazos_corrigida()
