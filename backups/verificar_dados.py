#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificação completa de dados migrados no PostgreSQL
"""

from db_config import init_postgres_manager, get_pg_connection
import psycopg2.extras

init_postgres_manager()
conn = get_pg_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print('\n' + '='*80)
print('VERIFICAÇÃO COMPLETA DE DADOS NO POSTGRESQL')
print('='*80 + '\n')

tabelas = [
    ('municipios_distritos', 'Municípios e Distritos'),
    ('crimes_contravencoes', 'Crimes e Contravenções (Base Legal)'),
    ('transgressoes', 'Transgressões Disciplinares (RDPM)'),
    ('infracoes_estatuto_art29', 'Infrações Estatuto Art. 29'),
    ('postos_graduacoes', 'Postos e Graduações'),
    ('naturezas', 'Naturezas de Ocorrências'),
    ('locais_origem', 'Locais de Origem'),
    ('tipos_processo', 'Tipos de Processo'),
    ('status_processo', 'Status de Processo')
]

total_geral = 0

for tabela, descricao in tabelas:
    cur.execute(f'SELECT COUNT(*) as total FROM {tabela}')
    total = cur.fetchone()['total']
    status = '✅' if total > 0 else '❌'
    print(f'{status} {descricao:45s}: {total:4d} registros')
    total_geral += total

print(f'\n{"="*80}')
print(f'TOTAL GERAL: {total_geral} registros de dados de referência')
print(f'{"="*80}\n')

# Verificar alguns exemplos de dispositivos legais
print('📚 DISPOSITIVOS LEGAIS CADASTRADOS:\n')
cur.execute('SELECT DISTINCT dispositivo_legal FROM crimes_contravencoes ORDER BY dispositivo_legal')
dispositivos = cur.fetchall()
for d in dispositivos:
    print(f'   • {d["dispositivo_legal"]}')

print(f'\n{"="*80}\n')

cur.close()
conn.close()
