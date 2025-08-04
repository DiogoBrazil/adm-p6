#!/usr/bin/env python3
"""
Verificar alteração do texto da coluna para 'Origem'
"""

def verificar_alteracao():
    print("🔍 Verificando alteração do texto da coluna...")
    
    # Verificar arquivo HTML
    html_path = "/home/diogo/DEV/aulas/test-eel/web/procedure_list.html"
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Procurar pela nova coluna "Origem"
    if 'Local de Origem' in html_content:
        print("❌ Ainda encontrado 'Local de Origem' no HTML")
        # Mostrar onde está
        lines = html_content.split('\n')
        for i, line in enumerate(lines, 1):
            if 'Local de Origem' in line:
                print(f"   Linha {i}: {line.strip()}")
    
    if '>Origem<' in html_content:
        print("✅ Texto 'Origem' encontrado no HTML")
        # Mostrar onde está
        lines = html_content.split('\n')
        for i, line in enumerate(lines, 1):
            if '>Origem<' in line:
                print(f"   Linha {i}: {line.strip()}")
    else:
        print("❌ Texto 'Origem' NÃO encontrado no HTML")
    
    print("\n" + "="*50)
    print("✅ Verificação concluída!")

if __name__ == "__main__":
    verificar_alteracao()
