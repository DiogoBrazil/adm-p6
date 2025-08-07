#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sqlite3

conn = sqlite3.connect('usuarios.db')
cursor = conn.cursor()

print('=== TESTANDO AS NOVAS CONSTRAINTS ===')
print()

# Teste 1: Tentar criar duas portarias com mesmo número, mesmo ano, mesmo local
print('1. Teste: Duas portarias mesmo numero/ano/local (deve falhar)')
try:
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao
        ) VALUES (
            'teste1', '999', 'processo', 'PADS', 'Portaria',
            '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025'
        )
    ''')
    
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao
        ) VALUES (
            'teste2', '999', 'processo', 'PADS', 'Portaria',
            '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025'
        )
    ''')
    print('   FALHOU: Constraint nao impediu duplicata!')
except sqlite3.IntegrityError as e:
    print(f'   OK: Constraint funcionou - {e}')

# Teste 2: Portaria e Memorando com mesmo número (deve permitir)
print('\n2. Teste: Portaria e Memorando mesmo numero/ano/local (deve permitir)')
try:
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao
        ) VALUES (
            'teste3', '998', 'processo', 'PADS', 'Memorando Disciplinar',
            '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025'
        )
    ''')
    print('   OK: Documentos diferentes permitidos')
except sqlite3.IntegrityError as e:
    print(f'   FALHOU: Constraint muito restritiva - {e}')

# Teste 3: Mesmo número em locais diferentes (deve permitir)
print('\n3. Teste: Mesmo numero/ano/documento em locais diferentes (deve permitir)')
try:
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao
        ) VALUES (
            'teste4', '999', 'processo', 'PADS', 'Portaria',
            '', 'teste', 'encarregado', '8ºBPM', '2025-08-05', '2025'
        )
    ''')
    print('   OK: Locais diferentes permitidos')
except sqlite3.IntegrityError as e:
    print(f'   FALHOU: Constraint muito restritiva - {e}')

# Teste 4: Número de controle duplicado para mesmo documento (deve falhar)
print('\n4. Teste: Numero controle duplicado mesmo documento/ano/local (deve falhar)')
try:
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao, numero_controle
        ) VALUES (
            'teste5', '997', 'processo', 'PADS', 'Portaria',
            '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '555'
        )
    ''')
    
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao, numero_controle
        ) VALUES (
            'teste6', '996', 'processo', 'PADS', 'Portaria',
            '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '555'
        )
    ''')
    print('   FALHOU: Constraint de controle nao impediu duplicata!')
except sqlite3.IntegrityError as e:
    print(f'   OK: Constraint de controle funcionou - {e}')

# Teste 5: Mesmo controle para documentos diferentes (deve permitir)
print('\n5. Teste: Mesmo controle para documentos diferentes (deve permitir)')
try:
    cursor.execute('''
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
            processo_sei, responsavel_id, responsavel_tipo, 
            local_origem, data_instauracao, ano_instauracao, numero_controle
        ) VALUES (
            'teste7', '995', 'processo', 'PADS', 'Memorando Disciplinar',
            '', 'teste', 'encarregado', '7ºBPM', '2025-08-05', '2025', '555'
        )
    ''')
    print('   OK: Mesmo controle para documentos diferentes permitido')
except sqlite3.IntegrityError as e:
    print(f'   FALHOU: Constraint muito restritiva - {e}')

# Limpeza dos testes
cursor.execute('DELETE FROM processos_procedimentos WHERE id LIKE "teste%"')
conn.commit()
conn.close()

print('\n=== TESTE CONCLUIDO ===')
