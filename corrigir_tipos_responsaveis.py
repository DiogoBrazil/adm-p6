#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para corrigir inconsistências de tipo de responsável
"""

import sqlite3
import os

def corrigir_tipos_responsaveis():
    """Corrige os tipos de responsáveis inconsistentes"""
    print("🔧 Corrigindo tipos de responsáveis inconsistentes...")
    
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usuarios.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Encontrar processos com tipo 'encarregado' mas ID de operador
        print("\n1. Encontrando processos marcados como 'encarregado' mas com ID de operador:")
        cursor.execute("""
            SELECT p.id, p.numero, p.responsavel_id, o.nome, o.posto_graduacao
            FROM processos_procedimentos p
            INNER JOIN operadores o ON p.responsavel_id = o.id
            WHERE p.responsavel_tipo = 'encarregado' AND p.ativo = 1
        """)
        
        operadores_marcados_como_encarregados = cursor.fetchall()
        
        if operadores_marcados_como_encarregados:
            print(f"   ⚠️  Encontrados {len(operadores_marcados_como_encarregados)} processos com problema:")
            for proc in operadores_marcados_como_encarregados:
                proc_id, numero, resp_id, nome, posto = proc
                print(f"      - Processo {numero}: {posto} {nome} (ID: {resp_id})")
                
                # Corrigir o tipo para 'operador'
                cursor.execute("""
                    UPDATE processos_procedimentos 
                    SET responsavel_tipo = 'operador'
                    WHERE id = ?
                """, (proc_id,))
                print(f"        ✅ Corrigido para responsavel_tipo = 'operador'")
        else:
            print("   ✅ Nenhum problema encontrado")
        
        # 2. Encontrar processos com tipo 'operador' mas ID de encarregado
        print("\n2. Encontrando processos marcados como 'operador' mas com ID de encarregado:")
        cursor.execute("""
            SELECT p.id, p.numero, p.responsavel_id, e.nome, e.posto_graduacao
            FROM processos_procedimentos p
            INNER JOIN encarregados e ON p.responsavel_id = e.id
            WHERE p.responsavel_tipo = 'operador' AND p.ativo = 1
        """)
        
        encarregados_marcados_como_operadores = cursor.fetchall()
        
        if encarregados_marcados_como_operadores:
            print(f"   ⚠️  Encontrados {len(encarregados_marcados_como_operadores)} processos com problema:")
            for proc in encarregados_marcados_como_operadores:
                proc_id, numero, resp_id, nome, posto = proc
                print(f"      - Processo {numero}: {posto} {nome} (ID: {resp_id})")
                
                # Corrigir o tipo para 'encarregado'
                cursor.execute("""
                    UPDATE processos_procedimentos 
                    SET responsavel_tipo = 'encarregado'
                    WHERE id = ?
                """, (proc_id,))
                print(f"        ✅ Corrigido para responsavel_tipo = 'encarregado'")
        else:
            print("   ✅ Nenhum problema encontrado")
        
        # Confirmar as alterações
        conn.commit()
        
        # 3. Verificar se as correções funcionaram
        print("\n3. Verificando correções:")
        cursor.execute("""
            SELECT 
                p.numero, p.responsavel_id, p.responsavel_tipo,
                COALESCE(o.nome, e.nome, 'NÃO ENCONTRADO') as responsavel_nome,
                COALESCE(o.posto_graduacao, e.posto_graduacao, '') as responsavel_posto
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            WHERE p.ativo = 1
            ORDER BY p.numero
        """)
        
        processos = cursor.fetchall()
        print("   Processos após correção:")
        for proc in processos:
            numero, resp_id, resp_tipo, nome, posto = proc
            status = "✅" if nome != "NÃO ENCONTRADO" else "❌"
            print(f"      {status} Processo {numero}: {resp_tipo} -> {posto} {nome}")
        
        conn.close()
        
        print("\n✅ Correção concluída com sucesso!")
        return True
        
    except Exception as e:
        print(f"\n❌ Erro na correção: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    corrigir_tipos_responsaveis()
