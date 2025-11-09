#!/usr/bin/env python3
"""
Script para refatorar main.py de SQLite para PostgreSQL
- Substitui import sqlite3 por psycopg2
- Substitui placeholders ? por %s
- Atualiza get_connection() para usar PostgreSQL
- Adiciona import do db_config
"""

import re
import sys


def refatorar_main_py(arquivo_entrada='main.py', arquivo_saida='main_postgres.py'):
    """
    Refatora o arquivo main.py para usar PostgreSQL
    
    Args:
        arquivo_entrada (str): Caminho do arquivo original
        arquivo_saida (str): Caminho do arquivo refatorado
    """
    print(f"Lendo {arquivo_entrada}...")
    
    with open(arquivo_entrada, 'r', encoding='utf-8') as f:
        conteudo = f.read()
    
    print("Aplicando transformações...")
    
    # 1. Substitui import sqlite3 por psycopg2
    conteudo_original = conteudo
    conteudo = re.sub(
        r'^import sqlite3$',
        'import psycopg2\nimport psycopg2.extras\nfrom db_config import get_pg_connection, init_postgres_manager',
        conteudo,
        flags=re.MULTILINE
    )
    if conteudo != conteudo_original:
        print("  ✓ Substituído 'import sqlite3' por imports PostgreSQL")
    
    # 2. Substitui sqlite3.connect por get_pg_connection
    conteudo_original = conteudo
    conteudo = re.sub(
        r'sqlite3\.connect\(self\.db_path\)',
        'get_pg_connection()',
        conteudo
    )
    conteudo = re.sub(
        r'sqlite3\.connect\([\'"]usuarios\.db[\'"]\)',
        'get_pg_connection()',
        conteudo
    )
    if conteudo != conteudo_original:
        print("  ✓ Substituído sqlite3.connect() por get_pg_connection()")
    
    # 3. Adiciona inicialização do PostgreSQL no init_database
    # Procura pelo método init_database e adiciona init no início
    padrao_init_db = r'(def init_database\(self\):\s+"""[^"]*""")'
    substituicao_init = r'\1\n        # Inicializa gerenciador PostgreSQL\n        init_postgres_manager()'
    conteudo_original = conteudo
    conteudo = re.sub(padrao_init_db, substituicao_init, conteudo)
    if conteudo != conteudo_original:
        print("  ✓ Adicionado init_postgres_manager() em init_database()")
    
    # 4. Substitui cursor.execute com placeholders ? por %s
    # Esta é a parte mais delicada - precisa preservar ? em strings de comentários/descrições
    
    # Estratégia: substituir ? por %s em strings SQL dentro de execute()
    # Padrões possíveis:
    # - execute("...", ...)
    # - execute('...', ...)
    # - execute("""...""", ...)
    # - execute('''...''', ...)
    # - execute(f"...", ...) - não substituir f-strings
    
    def substituir_em_execute(match):
        """Substitui ? por %s em chamadas execute()"""
        prefix = match.group(1)  # Tudo antes da string
        quote = match.group(2)   # Tipo de aspas
        sql = match.group(3)     # Conteúdo SQL
        
        # Não substituir em f-strings
        if prefix.endswith('f'):
            return match.group(0)
        
        # Substitui ? por %s
        sql_novo = sql.replace('?', '%s')
        return f'{prefix}{quote}{sql_novo}{quote}'
    
    # Padrão mais robusto que captura:
    # - execute( seguido de aspas (simples, duplas, triplas)
    # - O conteúdo dentro das aspas
    # - As aspas de fechamento
    padrao_execute = r'(\.execute\([\s]*)(["\'])((?:(?!\2).)*)\2'
    
    conteudo_original = conteudo
    
    # Substitui múltiplas vezes até não haver mais mudanças
    # (para capturar execute com strings multilinha)
    max_iterations = 10
    for i in range(max_iterations):
        conteudo_antes = conteudo
        conteudo = re.sub(padrao_execute, substituir_em_execute, conteudo, flags=re.DOTALL)
        if conteudo == conteudo_antes:
            break
    
    # Conta quantos ? foram substituídos (aproximado)
    original_count = conteudo_original.count('?')
    novo_count = conteudo.count('?')
    substituidos = original_count - novo_count
    
    if substituidos > 0:
        print(f"  ✓ Substituídos ~{substituidos} placeholders '?' por '%s'")
    
    # 5. Corrige row_factory para usar RealDictCursor
    # SQLite usa: conn.row_factory = sqlite3.Row
    # PostgreSQL usa: cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Primeiro, remove row_factory assignments
    conteudo = re.sub(
        r'\s*conn\.row_factory\s*=\s*sqlite3\.Row\s*\n',
        '\n',
        conteudo
    )
    print("  ✓ Removido row_factory (substituído por RealDictCursor)")
    
    # Substitui cursor() por cursor com RealDictCursor onde necessário
    # Isso precisa ser feito manualmente em alguns casos, mas vamos marcar
    conteudo = re.sub(
        r'cursor\s*=\s*conn\.cursor\(\)',
        'cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)',
        conteudo
    )
    print("  ✓ Atualizado conn.cursor() para usar RealDictCursor")
    
    # 6. Salva arquivo refatorado
    print(f"\nSalvando {arquivo_saida}...")
    with open(arquivo_saida, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    print(f"\n✓ Refatoração concluída!")
    print(f"  Arquivo original: {arquivo_entrada}")
    print(f"  Arquivo refatorado: {arquivo_saida}")
    print(f"\nPróximos passos:")
    print("  1. Revise o arquivo refatorado")
    print("  2. Teste a aplicação")
    print("  3. Se tudo funcionar, renomeie:")
    print(f"     mv {arquivo_entrada} {arquivo_entrada}.sqlite_backup")
    print(f"     mv {arquivo_saida} {arquivo_entrada}")


if __name__ == '__main__':
    if len(sys.argv) > 1:
        arquivo_entrada = sys.argv[1]
    else:
        arquivo_entrada = 'main.py'
    
    if len(sys.argv) > 2:
        arquivo_saida = sys.argv[2]
    else:
        arquivo_saida = 'main_postgres.py'
    
    try:
        refatorar_main_py(arquivo_entrada, arquivo_saida)
    except FileNotFoundError:
        print(f"✗ Arquivo não encontrado: {arquivo_entrada}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Erro durante refatoração: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
