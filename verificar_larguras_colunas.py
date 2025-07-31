#!/usr/bin/env python3
"""
Script para verificar o ajuste das larguras das colunas Número e SEI
"""

import os
import re

def main():
    print("🧪 Verificando ajuste das larguras das colunas")
    print("=" * 60)
    
    # Verificar se o arquivo HTML foi modificado corretamente
    html_file = "web/procedure_list.html"
    if os.path.exists(html_file):
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extrair larguras das colunas
        larguras = re.findall(r'width="(\d+)%"', content)
        nomes_colunas = [
            "Tipo", "Ano", "Número", "SEI", "Encarregado", 
            "PM Envolvido", "Tipo de Envolvimento", "Ações"
        ]
        
        print("📊 Distribuição atual das larguras das colunas:")
        print("-" * 50)
        
        total_largura = 0
        for i, (nome, largura) in enumerate(zip(nomes_colunas, larguras)):
            largura_int = int(largura)
            total_largura += largura_int
            
            # Destacar as colunas que foram alteradas
            if nome == "Número":
                status = "📉 REDUZIDA (10% → 8%)" if largura == "8" else "❌ NÃO ALTERADA"
                print(f"{i+1:2d}. {nome:<20} {largura:>3}% {status}")
            elif nome == "SEI":
                status = "📈 AUMENTADA (14% → 16%)" if largura == "16" else "❌ NÃO ALTERADA"
                print(f"{i+1:2d}. {nome:<20} {largura:>3}% {status}")
            else:
                print(f"{i+1:2d}. {nome:<20} {largura:>3}%")
        
        print("-" * 50)
        print(f"Total: {total_largura}%")
        
        # Verificar se as alterações específicas foram feitas
        print("\n🎯 Verificação das alterações:")
        numero_ok = 'width="8%" style="text-align:center;">Número' in content
        sei_ok = 'width="16%" style="text-align:center;">SEI' in content
        
        print(f"✅ Coluna Número: {numero_ok} (8%)")
        print(f"✅ Coluna SEI: {sei_ok} (16%)")
        
        if numero_ok and sei_ok:
            print("\n🎉 Status: ALTERAÇÕES APLICADAS COM SUCESSO!")
            print("💡 A coluna 'Número' foi ainda mais reduzida e a coluna 'SEI' foi ainda mais aumentada")
        else:
            print("\n❌ Status: Algumas alterações não foram aplicadas")
            
        # Mostrar comparação antes/depois
        print("\n📋 Histórico das alterações:")
        print("INICIAL:")
        print("  - Número: 12%")
        print("  - SEI:    12%")
        print("PRIMEIRA ALTERAÇÃO:")
        print("  - Número: 10% (-2%)")
        print("  - SEI:    14% (+2%)")
        print("ALTERAÇÃO ATUAL:")
        print("  - Número: 8%  (-2%)")
        print("  - SEI:    16% (+2%)")
        print("TOTAL DE MUDANÇAS:")
        print("  - Número: -4% (12% → 8%)")
        print("  - SEI:    +4% (12% → 16%)")
        
    else:
        print("❌ Arquivo HTML não encontrado")
    
    print("\n🚀 Para testar visualmente:")
    print("1. Execute: python main.py")
    print("2. Acesse: http://localhost:8000/procedure_list.html")
    print("3. Observe as larguras ajustadas das colunas Número e SEI")

if __name__ == "__main__":
    main()
