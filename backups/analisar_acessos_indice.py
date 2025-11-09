#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para identificar todos os acessos por índice em loops que usam RealDictCursor
Analisa o main.py e gera um relatório dos locais que precisam ser corrigidos
"""

import re

def analisar_acessos_indice(arquivo='main.py'):
    """Analisa o arquivo e identifica acessos por índice em loops"""
    
    with open(arquivo, 'r', encoding='utf-8') as f:
        linhas = f.readlines()
    
    # Padrões a procurar
    padrao_loop = re.compile(r'for (\w+) in .+\.fetchall\(\):')
    padrao_acesso_indice = re.compile(r'(\w+)\[(\d+)\]')
    
    resultados = []
    em_loop = False
    var_loop = None
    inicio_loop = 0
    nivel_indentacao = 0
    
    for i, linha in enumerate(linhas, 1):
        # Detectar início de loop
        match_loop = padrao_loop.search(linha)
        if match_loop:
            em_loop = True
            var_loop = match_loop.group(1)
            inicio_loop = i
            # Calcular indentação do loop
            nivel_indentacao = len(linha) - len(linha.lstrip())
            continue
        
        # Se estamos em um loop, procurar acessos por índice
        if em_loop and var_loop:
            indentacao_atual = len(linha) - len(linha.lstrip())
            
            # Se a indentação voltou ao nível do loop ou menos, saímos do loop
            if linha.strip() and indentacao_atual <= nivel_indentacao:
                em_loop = False
                var_loop = None
                continue
            
            # Procurar acessos por índice da variável do loop
            matches = padrao_acesso_indice.findall(linha)
            for var, indice in matches:
                if var == var_loop:
                    resultados.append({
                        'linha': i,
                        'variavel': var,
                        'indice': indice,
                        'codigo': linha.strip(),
                        'loop_inicio': inicio_loop
                    })
    
    return resultados

def gerar_relatorio():
    """Gera relatório dos acessos por índice encontrados"""
    
    print("\n" + "="*80)
    print("ANÁLISE DE ACESSOS POR ÍNDICE EM LOOPS COM fetchall()")
    print("="*80 + "\n")
    
    resultados = analisar_acessos_indice()
    
    if not resultados:
        print("✅ Nenhum acesso por índice encontrado em loops!")
        return
    
    # Agrupar por loop
    loops = {}
    for r in resultados:
        loop_key = r['loop_inicio']
        if loop_key not in loops:
            loops[loop_key] = []
        loops[loop_key].append(r)
    
    print(f"⚠️  Encontrados {len(resultados)} acessos por índice em {len(loops)} loops\n")
    
    for loop_inicio in sorted(loops.keys()):
        acessos = loops[loop_inicio]
        print(f"\n{'─'*80}")
        print(f"📍 Loop iniciando na linha {loop_inicio}")
        print(f"   Variável: {acessos[0]['variavel']}")
        print(f"   Acessos encontrados: {len(acessos)}")
        print(f"{'─'*80}")
        
        # Mostrar até 5 exemplos de cada loop
        for acesso in acessos[:5]:
            print(f"   Linha {acesso['linha']:5d}: {acesso['codigo'][:70]}")
        
        if len(acessos) > 5:
            print(f"   ... e mais {len(acessos) - 5} acessos")
    
    print(f"\n{'='*80}")
    print(f"RESUMO:")
    print(f"  • Total de loops com acesso por índice: {len(loops)}")
    print(f"  • Total de acessos por índice: {len(resultados)}")
    print(f"{'='*80}\n")
    
    # Sugerir ação
    print("💡 AÇÃO RECOMENDADA:")
    print("   Estes acessos devem ser convertidos de acesso por índice para acesso por chave.")
    print("   Exemplo:")
    print("     De: row[0], row[1], row[2]")
    print("     Para: row['id'], row['nome'], row['email']")
    print("\n   Para corrigir, é necessário:")
    print("   1. Identificar os nomes das colunas no SELECT")
    print("   2. Substituir cada row[N] pelo row['nome_coluna'] correspondente\n")

if __name__ == "__main__":
    gerar_relatorio()
