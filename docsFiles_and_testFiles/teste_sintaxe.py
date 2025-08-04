#!/usr/bin/env python3
"""
Teste de sintaxe e funcionalidade do JavaScript
"""

import subprocess
import os

def testar_sintaxe_js():
    print("🔍 Testando sintaxe do JavaScript...")
    
    js_path = "/home/diogo/DEV/aulas/test-eel/web/static/js/procedure_list.js"
    
    try:
        # Usar node.js para verificar a sintaxe (se disponível)
        result = subprocess.run(['node', '-c', js_path], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print("✅ Sintaxe do JavaScript está correta")
        else:
            print(f"❌ Erro de sintaxe no JavaScript:")
            print(result.stderr)
            
    except FileNotFoundError:
        print("⚠️ Node.js não encontrado, verificação manual necessária")
        
        # Verificação manual básica
        with open(js_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verificar balanceamento de chaves
        open_braces = content.count('{')
        close_braces = content.count('}')
        open_parens = content.count('(')
        close_parens = content.count(')')
        
        print(f"📊 Análise manual:")
        print(f"   Chaves abertas: {open_braces}")
        print(f"   Chaves fechadas: {close_braces}")
        print(f"   Parênteses abertos: {open_parens}")
        print(f"   Parênteses fechados: {close_parens}")
        
        if open_braces != close_braces:
            print("❌ Desbalanceamento de chaves detectado!")
        elif open_parens != close_parens:
            print("❌ Desbalanceamento de parênteses detectado!")
        else:
            print("✅ Balanceamento básico correto")
            
        # Verificar funções sem fechamento
        lines = content.split('\n')
        in_function = False
        function_level = 0
        
        for i, line in enumerate(lines, 1):
            if 'function ' in line and '{' in line:
                in_function = True
                function_level = 1
            elif in_function:
                function_level += line.count('{') - line.count('}')
                if function_level == 0:
                    in_function = False
        
        if in_function:
            print("❌ Função não fechada detectada!")
        else:
            print("✅ Todas as funções estão fechadas")

def verificar_elementos_html():
    print("\n🔍 Verificando elementos HTML necessários...")
    
    html_path = "/home/diogo/DEV/aulas/test-eel/web/procedure_list.html"
    
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    elementos_necessarios = [
        'id="searchInput"',
        'id="filterToggle"',
        'id="filtrosAvancados"',
        'id="procedureTableBody"',
        'id="emptyState"',
        'class="table-responsive"'
    ]
    
    for elemento in elementos_necessarios:
        if elemento in html_content:
            print(f"   ✅ {elemento}")
        else:
            print(f"   ❌ {elemento} - FALTANDO!")

def verificar_funcoes_js():
    print("\n🔍 Verificando funções JavaScript essenciais...")
    
    js_path = "/home/diogo/DEV/aulas/test-eel/web/static/js/procedure_list.js"
    
    with open(js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()
    
    funcoes_essenciais = [
        'function carregarProcedimentos(',
        'function exibirProcedimentos(',
        'function buscarProcedimentos(',
        'function toggleFiltrosAvancados(',
        'function aplicarFiltros(',
        'function limparFiltros('
    ]
    
    for funcao in funcoes_essenciais:
        if funcao in js_content:
            print(f"   ✅ {funcao}")
        else:
            print(f"   ❌ {funcao} - FALTANDO!")

if __name__ == "__main__":
    testar_sintaxe_js()
    verificar_elementos_html()
    verificar_funcoes_js()
    print("\n" + "="*50)
    print("✅ Verificação concluída!")
