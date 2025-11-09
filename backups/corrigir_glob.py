#!/usr/bin/env python3
"""
Script para substituir GLOB (SQLite) por SIMILAR TO (PostgreSQL)
"""

import re

def substituir_glob(arquivo):
    with open(arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    # Backup
    with open(arquivo + '.before_glob_fix', 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    # GLOB '[IVX]*' -> verifica se começa com I, V ou X (números romanos)
    # PostgreSQL: usar ~ (regex) ou SIMILAR TO
    
    # Substituir: inciso GLOB '[IVX]*' por inciso ~ '^[IVX]'
    conteudo = re.sub(
        r"inciso GLOB '\[IVX\]\*'",
        "inciso ~ '^[IVX]'",
        conteudo
    )
    
    # Substituir: inciso GLOB '[IVXLC]*' por inciso ~ '^[IVXLC]'
    conteudo = re.sub(
        r"inciso GLOB '\[IVXLC\]\*'",
        "inciso ~ '^[IVXLC]'",
        conteudo
    )
    
    with open(arquivo, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    print(f"✅ GLOB substituído por regex PostgreSQL (~)")

if __name__ == '__main__':
    print("🔧 Substituindo GLOB por regex PostgreSQL...\n")
    substituir_glob('main.py')
    print("\n✅ Correção concluída!")
