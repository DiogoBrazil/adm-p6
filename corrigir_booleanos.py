#!/usr/bin/env python3
"""
Script para corrigir comparações booleanas no main.py para PostgreSQL
Substitui: = 1 por = TRUE e = 0 por = FALSE
"""

import re

def corrigir_booleanos(arquivo):
    """Corrige comparações booleanas em um arquivo"""
    
    with open(arquivo, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    # Backup
    with open(arquivo + '.before_boolean_fix', 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    # Padrões para substituir (campos booleanos conhecidos)
    campos_booleanos = [
        'ativo',
        'is_operador',
        'is_encarregado', 
        'concluido'
    ]
    
    total_substituicoes = 0
    
    for campo in campos_booleanos:
        # Substituir = 1 por = TRUE
        pattern_1 = rf'\b{campo}\s*=\s*1\b'
        count_1 = len(re.findall(pattern_1, conteudo))
        conteudo = re.sub(pattern_1, f'{campo} = TRUE', conteudo)
        total_substituicoes += count_1
        
        # Substituir = 0 por = FALSE
        pattern_0 = rf'\b{campo}\s*=\s*0\b'
        count_0 = len(re.findall(pattern_0, conteudo))
        conteudo = re.sub(pattern_0, f'{campo} = FALSE', conteudo)
        total_substituicoes += count_0
        
        if count_1 > 0:
            print(f"✓ {campo} = 1 → {campo} = TRUE ({count_1} ocorrências)")
        if count_0 > 0:
            print(f"✓ {campo} = 0 → {campo} = FALSE ({count_0} ocorrências)")
    
    # Salvar arquivo corrigido
    with open(arquivo, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    print(f"\n✅ Total de substituições: {total_substituicoes}")
    print(f"📁 Backup salvo em: {arquivo}.before_boolean_fix")

if __name__ == '__main__':
    print("🔧 Corrigindo comparações booleanas para PostgreSQL...\n")
    corrigir_booleanos('main.py')
    print("\n✅ Correção concluída!")
