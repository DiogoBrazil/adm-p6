#!/usr/bin/env python3
"""
Script para verificar a centralização dos cabeçalhos da tabela
"""

import os

def main():
    print("🧪 Verificando centralização dos cabeçalhos da tabela")
    print("=" * 60)
    
    # Verificar se o arquivo HTML foi modificado corretamente
    html_file = "web/procedure_list.html"
    if os.path.exists(html_file):
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Verificar se todas as colunas têm text-align:center
        colunas_centralizadas = [
            'style="text-align:center;">Tipo',
            'style="text-align:center;">Ano',
            'style="text-align:center;">Número',
            'style="text-align:center;">SEI',
            'style="text-align:center;">Encarregado',
            'style="text-align:center;">PM Envolvido',
            'style="text-align:center;">Tipo de Envolvimento',
            'style="text-align:center;">Ações'
        ]
        
        print("📋 Verificando centralização das colunas:")
        todas_centralizadas = True
        
        for i, coluna in enumerate(colunas_centralizadas, 1):
            if coluna in content:
                print(f"✅ Coluna {i}: {coluna.split('>')[1]} - Centralizada")
            else:
                print(f"❌ Coluna {i}: {coluna.split('>')[1]} - NÃO centralizada")
                todas_centralizadas = False
        
        if todas_centralizadas:
            print("\n🎯 Status: TODAS as colunas estão centralizadas!")
            print("💡 Os nomes das colunas agora aparecerão centralizados no cabeçalho da tabela")
        else:
            print("\n❌ Status: Algumas colunas não estão centralizadas")
            
        print("\n📄 Trecho do cabeçalho encontrado:")
        # Extrair e mostrar o trecho do cabeçalho
        inicio = content.find('<thead>')
        fim = content.find('</thead>') + len('</thead>')
        if inicio != -1 and fim != -1:
            thead_content = content[inicio:fim]
            print("-" * 40)
            for linha in thead_content.split('\n'):
                if linha.strip():
                    print(linha)
            print("-" * 40)
    else:
        print("❌ Arquivo HTML não encontrado")
    
    print("\n🚀 Para testar visualmente:")
    print("1. Execute: python main.py")
    print("2. Acesse: http://localhost:8000/procedure_list.html")
    print("3. Verifique se os nomes das colunas estão centralizados")

if __name__ == "__main__":
    main()
