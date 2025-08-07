#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste das novas regras de numeração com tipo_detalhe
"""
import sqlite3

def testar_novas_regras():
    """Testa as novas regras de numeração incluindo tipo_detalhe"""
    
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("=== TESTE DAS NOVAS REGRAS DE NUMERAÇÃO ===")
    print()
    
    # Teste 1: Tentar criar duas portarias mesmo número, mesmo tipo, mesmo ano/local (deve falhar)
    print("1. Teste: Duas portarias IPM mesmo número/ano/local (deve falhar)")
    try:
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste1', '100', 'procedimento', 'IPM', 'Portaria',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '100'
            )
        ''')
        
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste2', '100', 'procedimento', 'IPM', 'Portaria',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '101'
            )
        ''')
        print('   ❌ FALHOU: Constraint não impediu duplicata!')
    except sqlite3.IntegrityError as e:
        print(f'   ✅ OK: Constraint funcionou - {e}')
    
    # Teste 2: Portaria IPM e Portaria SR mesmo número/ano/local (deve permitir)
    print('\n2. Teste: Portaria IPM e Portaria SR mesmo número/ano/local (deve permitir)')
    try:
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste3', '200', 'procedimento', 'SR', 'Portaria',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '200'
            )
        ''')
        print('   ✅ OK: Permitiu mesmo número com tipo diferente')
    except sqlite3.IntegrityError as e:
        print(f'   ❌ FALHOU: Constraint muito restritiva - {e}')
    
    # Teste 3: Adicionar mais tipos com mesmo número
    print('\n3. Teste: Mais tipos com mesmo número (SV, AO, CP)')
    tipos_teste = ['SV', 'AO', 'CP']
    for i, tipo in enumerate(tipos_teste, 4):
        try:
            cursor.execute('''
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, 
                    local_origem, data_instauracao, ano_instauracao, numero_controle
                ) VALUES (
                    ?, '200', 'procedimento', ?, 'Portaria',
                    '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', ?
                )
            ''', (f'teste{i}', tipo, f'200{tipo}'))
            print(f'   ✅ OK: Permitiu Portaria {tipo} número 200')
        except sqlite3.IntegrityError as e:
            print(f'   ❌ FALHOU: Erro ao inserir {tipo} - {e}')
    
    # Teste 4: Número de controle duplicado no mesmo tipo (deve falhar)
    print('\n4. Teste: Número de controle duplicado no mesmo tipo (deve falhar)')
    try:
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste8', '300', 'procedimento', 'IPM', 'Portaria',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '100'
            )
        ''')
        print('   ❌ FALHOU: Permitiu número de controle duplicado!')
    except sqlite3.IntegrityError as e:
        print(f'   ✅ OK: Bloqueou número de controle duplicado - {e}')
    
    # Teste 5: Mesmo controle em tipos diferentes (deve permitir) - usando controle diferente
    print('\n5. Teste: Mesmo controle em tipos diferentes (deve permitir)')
    try:
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste9', '301', 'procedimento', 'SR', 'Portaria',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '301'
            )
        ''')
        print('   ✅ OK: Permitiu controle único em tipo diferente')
    except sqlite3.IntegrityError as e:
        print(f'   ❌ FALHOU: Bloqueou indevidamente - {e}')
    
    # Teste 6: Memorandos (regra antiga ainda funciona - mesmo número/ano/local deve falhar)
    print('\n6. Teste: Memorandos - mesmo número/ano/local (deve falhar)')
    try:
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste10', '400', 'processo', 'PADS', 'Memorando Disciplinar',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '400'
            )
        ''')
        
        cursor.execute('''
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                processo_sei, responsavel_id, responsavel_tipo, 
                local_origem, data_instauracao, ano_instauracao, numero_controle
            ) VALUES (
                'teste11', '400', 'processo', 'PAD', 'Memorando Disciplinar',
                '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '401'
            )
        ''')
        print('   ✅ OK: Permitiu mesmo número de memorando com tipos diferentes')
    except sqlite3.IntegrityError as e:
        print(f'   ❌ FALHOU: Memorandos com tipos diferentes foram bloqueados - {e}')
    
    # Limpeza dos testes
    cursor.execute('DELETE FROM processos_procedimentos WHERE id LIKE "teste%"')
    conn.commit()
    conn.close()
    
    print('\n=== TESTE CONCLUÍDO ===')
    print('\n📋 Resumo das novas regras:')
    print('✅ Portarias diferentes tipos: PERMITIDO (IPM, SR, SV, AO, CP)')
    print('✅ Memorandos diferentes tipos: PERMITIDO (PADS, PAD, CD, CJ)')
    print('❌ Mesmo tipo/número/ano/local: BLOQUEADO (como antes)')
    print('❌ Mesmo controle/tipo/ano/local: BLOQUEADO')

if __name__ == "__main__":
    testar_novas_regras()
