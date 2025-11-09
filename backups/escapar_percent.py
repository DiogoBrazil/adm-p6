#!/usr/bin/env python3
"""
Script para escapar % literal em queries SQL para PostgreSQL
"""

import re

def escapar_percent_literal(arquivo):
    with open(arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    # Backup
    with open(arquivo + '.before_percent_escape', 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    # Padrão: LIKE seguido de string com %
    # Mas NÃO substituir %s (que é placeholder)
    # Substituir '%algo%' por '%%algo%%'
    
    # Encontrar todos LIKE 'alguma coisa com %'
    def substituir_like(match):
        string_completa = match.group(0)
        # Se já tem %%, não mexer
        if '%%' in string_completa:
            return string_completa
        # Substituir % por %% dentro da string
        # LIKE 'valor' -> manter
        # LIKE '%valor%' -> LIKE '%%valor%%'
        return string_completa.replace("'%", "'%%").replace("%'", "%%'")
    
    # Pattern para capturar LIKE 'string com %'
    pattern = r"LIKE\s+'[^']*%[^']*'"
    conteudo = re.sub(pattern, substituir_like, conteudo, flags=re.IGNORECASE)
    
    with open(arquivo, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    print(f"✅ % escapados em queries LIKE")

if __name__ == '__main__':
    print("🔧 Escapando % literal em queries SQL...\n")
    escapar_percent_literal('main.py')
    print("\n✅ Correção concluída!")
