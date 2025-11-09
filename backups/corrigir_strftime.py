#!/usr/bin/env python3
"""
Script para substituir strftime (SQLite) por TO_CHAR/EXTRACT (PostgreSQL)
"""

import re

def corrigir_strftime(arquivo):
    with open(arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    # Backup
    with open(arquivo + '.before_strftime_fix', 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    # Substituir strftime('%Y', campo) por EXTRACT(YEAR FROM campo)::text
    # Isso mantém compatibilidade pois retorna string
    conteudo = re.sub(
        r"strftime\('%Y',\s*([a-zA-Z_\.]+)\)",
        r"TO_CHAR(\1, 'YYYY')",
        conteudo
    )
    
    # Salvar
    with open(arquivo, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    print(f"✅ strftime substituído por TO_CHAR em {arquivo}")

if __name__ == '__main__':
    print("🔧 Corrigindo funções de data para PostgreSQL...\n")
    corrigir_strftime('main.py')
    print("\n✅ Correção concluída!")
