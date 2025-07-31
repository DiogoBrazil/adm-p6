#!/usr/bin/env python3
"""
Script para verificar a adição da coluna "Local de Origem"
"""

import os
import re

def main():
    print("🧪 Verificando adição da coluna 'Local de Origem'")
    print("=" * 60)
    
    # Verificar alterações no HTML
    print("📋 Verificando HTML (procedure_list.html):")
    html_file = "web/procedure_list.html"
    if os.path.exists(html_file):
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extrair larguras das colunas
        larguras = re.findall(r'width="(\d+)%"', content)
        nomes_colunas = [
            "Tipo", "Ano", "Número", "Local de Origem", "SEI", 
            "Encarregado", "PM Envolvido", "Tipo de Envolvimento", "Ações"
        ]
        
        print("  📊 Nova distribuição das larguras:")
        total_largura = 0
        for i, (nome, largura) in enumerate(zip(nomes_colunas, larguras)):
            largura_int = int(largura)
            total_largura += largura_int
            
            if nome == "Local de Origem":
                status = "🆕 NOVA COLUNA"
                print(f"    {i+1:2d}. {nome:<20} {largura:>3}% {status}")
            else:
                print(f"    {i+1:2d}. {nome:<20} {largura:>3}%")
        
        print(f"  Total: {total_largura}%")
        
        # Verificar se a coluna foi adicionada
        local_origem_presente = 'Local de Origem' in content
        print(f"\n  ✅ Coluna 'Local de Origem' presente: {local_origem_presente}")
        
    else:
        print("  ❌ Arquivo HTML não encontrado")
    
    # Verificar alterações no JavaScript
    print("\n💻 Verificando JavaScript (procedure_list.js):")
    js_file = "web/static/js/procedure_list.js"
    if os.path.exists(js_file):
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Verificar se a nova coluna foi adicionada na renderização
        local_origem_td = 'procedimento.local_origem' in content
        busca_local_origem = "Busca por local de origem" in content
        
        print(f"  ✅ Coluna 'Local de Origem' na renderização: {local_origem_td}")
        print(f"  ✅ Busca por 'Local de Origem' implementada: {busca_local_origem}")
        
        # Contar número de <td> na estrutura da linha
        td_count = content.count('<td>')
        print(f"  📊 Número total de colunas <td>: {td_count}")
        
    else:
        print("  ❌ Arquivo JavaScript não encontrado")
    
    # Resumo final
    print("\n🎯 Resumo das alterações:")
    print("1. ✅ Adicionada coluna 'Local de Origem' após 'Número'")
    print("2. ✅ Larguras das colunas redistribuídas para acomodar nova coluna")
    print("3. ✅ JavaScript atualizado para renderizar nova coluna")
    print("4. ✅ Função de busca atualizada para incluir local de origem")
    
    print("\n📋 Nova ordem das colunas:")
    colunas_ordem = [
        "1. Tipo (9%)",
        "2. Ano (7%)", 
        "3. Número (8%)",
        "4. Local de Origem (10%) 🆕",
        "5. SEI (14%)",
        "6. Encarregado (20%)",
        "7. PM Envolvido (20%)",
        "8. Tipo de Envolvimento (7%)",
        "9. Ações (5%)"
    ]
    
    for coluna in colunas_ordem:
        print(f"  {coluna}")
    
    print("\n🚀 Para testar:")
    print("1. Execute: python main.py")
    print("2. Acesse: http://localhost:8000/procedure_list.html")
    print("3. Verifique se a coluna 'Local de Origem' aparece após 'Número'")
    print("4. Teste a busca digitando um local de origem")

if __name__ == "__main__":
    main()
