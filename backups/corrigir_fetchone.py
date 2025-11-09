#!/usr/bin/env python3
"""
Script para corrigir fetchone()[0] para usar nomes de colunas do RealDictCursor
"""

import re

def corrigir_fetchone(arquivo):
    with open(arquivo, 'r', encoding='utf-8') as f:
        linhas = f.readlines()
    
    # Backup
    with open(arquivo + '.before_fetchone_fix', 'w', encoding='utf-8') as f:
        f.writelines(linhas)
    
    novas_linhas = []
    count_substituicoes = 0
    
    for i, linha in enumerate(linhas):
        # Procurar por fetchone()[0] ou fetchone()[número]
        if 'fetchone()[' in linha and 'cursor.fetchone()' in linha:
            # Olhar para trás para ver se tem COUNT(*) ou SELECT algo
            contexto_anterior = ''.join(linhas[max(0, i-10):i])
            
            if 'COUNT(*)' in contexto_anterior or 'count(*)' in contexto_anterior:
                # Substituir fetchone()[0] por fetchone()['count']
                nova_linha = re.sub(r'fetchone\(\)\[0\]', "fetchone()['count']", linha)
                if nova_linha != linha:
                    count_substituicoes += 1
                    novas_linhas.append(nova_linha)
                else:
                    novas_linhas.append(linha)
            else:
                # Mantém como está por enquanto (precisará correção manual)
                novas_linhas.append(linha)
        else:
            novas_linhas.append(linha)
    
    # Salvar
    with open(arquivo, 'w', encoding='utf-8') as f:
        f.writelines(novas_linhas)
    
    print(f"✅ {count_substituicoes} ocorrências de fetchone()[0] → fetchone()['count']")

if __name__ == '__main__':
    print("🔧 Corrigindo fetchone()[0] para RealDictCursor...\n")
    corrigir_fetchone('main.py')
    print("\n✅ Correção concluída!")
