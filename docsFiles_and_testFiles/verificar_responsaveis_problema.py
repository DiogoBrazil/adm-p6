#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar problemas com responsáveis operadores
"""

import sqlite3
import os

def verificar_responsaveis_problema():
    """Verifica problemas com operadores como responsáveis"""
    print("🔍 Verificando problema com responsáveis operadores...")
    
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usuarios.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Listar todos os operadores disponíveis
        print("\n1. Operadores disponíveis:")
        cursor.execute("SELECT id, nome, posto_graduacao FROM operadores WHERE ativo = 1")
        operadores = cursor.fetchall()
        
        for op in operadores:
            print(f"   - {op[1]} ({op[2]}) - ID: {op[0]}")
        
        # 2. Listar todos os encarregados disponíveis
        print("\n2. Encarregados disponíveis:")
        cursor.execute("SELECT id, nome, posto_graduacao FROM encarregados WHERE ativo = 1")
        encarregados = cursor.fetchall()
        
        for enc in encarregados:
            print(f"   - {enc[1]} ({enc[2]}) - ID: {enc[0]}")
        
        # 3. Verificar todos os processos e seus responsáveis
        print("\n3. Processos e seus responsáveis:")
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
        for proc in processos:
            numero, resp_id, resp_tipo, nome, posto = proc
            print(f"   - Processo {numero}: {resp_tipo} -> {posto} {nome} (ID: {resp_id})")
        
        # 4. Verificar se algum responsável_id está em ambas as tabelas
        print("\n4. Verificando IDs que existem em ambas as tabelas:")
        cursor.execute("""
            SELECT o.id, o.nome as op_nome, e.nome as enc_nome
            FROM operadores o
            INNER JOIN encarregados e ON o.id = e.id
            WHERE o.ativo = 1 AND e.ativo = 1
        """)
        
        duplicados = cursor.fetchall()
        if duplicados:
            print("   ⚠️  IDs duplicados encontrados:")
            for dup in duplicados:
                print(f"      - ID {dup[0]}: Operador='{dup[1]}' | Encarregado='{dup[2]}'")
        else:
            print("   ✅ Nenhum ID duplicado encontrado")
        
        # 5. Verificar se há inconsistências nos tipos
        print("\n5. Verificando inconsistências de tipo vs tabela:")
        cursor.execute("""
            SELECT p.numero, p.responsavel_id, p.responsavel_tipo
            FROM processos_procedimentos p
            WHERE p.ativo = 1
              AND (
                  (p.responsavel_tipo = 'operador' AND p.responsavel_id NOT IN (SELECT id FROM operadores WHERE ativo = 1))
                  OR
                  (p.responsavel_tipo = 'encarregado' AND p.responsavel_id NOT IN (SELECT id FROM encarregados WHERE ativo = 1))
              )
        """)
        
        inconsistencias = cursor.fetchall()
        if inconsistencias:
            print("   ❌ Inconsistências encontradas:")
            for inc in inconsistencias:
                print(f"      - Processo {inc[0]}: tipo='{inc[2]}' mas ID {inc[1]} não existe na tabela correspondente")
        else:
            print("   ✅ Nenhuma inconsistência encontrada")
        
        conn.close()
        
        print("\n✅ Verificação concluída!")
        return True
        
    except Exception as e:
        print(f"\n❌ Erro na verificação: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    verificar_responsaveis_problema()
