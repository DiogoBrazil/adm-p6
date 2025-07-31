#!/usr/bin/env python3
"""
Script para testar a nova organização da tabela com a coluna Tipo em primeiro lugar
"""

import subprocess
import time
import sys
import os

def main():
    print("🧪 Testando nova organização da tabela de procedimentos")
    print("=" * 60)
    
    # Verificar se os arquivos foram modificados corretamente
    print("\n📋 Verificando modificações nos arquivos:")
    
    # Verificar HTML
    html_file = "web/procedure_list.html"
    if os.path.exists(html_file):
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'width="10%">Tipo</th>' in content and content.find('Tipo') < content.find('Ano'):
                print("✅ HTML: Coluna 'Tipo' está na primeira posição")
            else:
                print("❌ HTML: Coluna 'Tipo' não está na primeira posição")
    else:
        print("❌ HTML: Arquivo não encontrado")
    
    # Verificar JavaScript
    js_file = "web/static/js/procedure_list.js"
    if os.path.exists(js_file):
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if '<td><strong>${procedimento.tipo_detalhe || \'N/A\'}</strong></td>' in content:
                print("✅ JavaScript: Primeira célula da linha agora é o tipo_detalhe")
            else:
                print("❌ JavaScript: Primeira célula da linha não é o tipo_detalhe")
    else:
        print("❌ JavaScript: Arquivo não encontrado")
    
    print("\n🚀 Iniciando aplicação para teste visual...")
    print("💡 Acesse: http://localhost:8000/procedure_list.html")
    print("📋 Verifique se a coluna 'Tipo' aparece como primeira coluna")
    print("🔍 Teste também a funcionalidade de busca por tipo")
    print("\n⚠️  Pressione Ctrl+C para parar o servidor")
    
    try:
        # Tentar iniciar a aplicação
        result = subprocess.run([
            sys.executable, "main.py"
        ], cwd=os.getcwd())
    except KeyboardInterrupt:
        print("\n\n✅ Teste finalizado pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro ao iniciar aplicação: {e}")
        print("💡 Tente executar: python main.py")

if __name__ == "__main__":
    main()
