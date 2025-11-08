#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para migrar TODAS as tabelas de referência do SQLite para PostgreSQL
"""

import sqlite3
from db_config import init_postgres_manager, get_pg_connection
import psycopg2.extras

def migrar_tabela_simples(sqlite_cur, pg_cur, tabela, descricao):
    """Migra uma tabela simples do SQLite para PostgreSQL"""
    print(f"\n{'='*80}")
    print(f"MIGRANDO: {descricao}")
    print(f"{'='*80}")
    
    # Buscar dados do SQLite
    print(f"📋 Buscando dados de {tabela}...")
    sqlite_cur.execute(f"PRAGMA table_info({tabela})")
    colunas_info = sqlite_cur.fetchall()
    colunas = [col[1] for col in colunas_info]
    
    sqlite_cur.execute(f"SELECT * FROM {tabela}")
    registros = sqlite_cur.fetchall()
    
    print(f"✅ Encontrados {len(registros)} registros")
    
    if len(registros) == 0:
        print("⚠️  Nenhum registro para migrar")
        return 0
    
    # Limpar tabela no PostgreSQL
    print(f"🗑️  Limpando tabela {tabela}...")
    pg_cur.execute(f"DELETE FROM {tabela}")
    deletados = pg_cur.rowcount
    if deletados > 0:
        print(f"✅ {deletados} registros deletados")
    
    # Preparar query de insert
    placeholders = ', '.join(['%s'] * len(colunas))
    colunas_str = ', '.join(colunas)
    query = f"INSERT INTO {tabela} ({colunas_str}) VALUES ({placeholders})"
    
    # Inserir registros
    print(f"📥 Inserindo {len(registros)} registros...")
    inseridos = 0
    erros = 0
    
    for reg in registros:
        try:
            # Converter valores booleanos
            valores = []
            for i, val in enumerate(reg):
                # Verificar se a coluna é booleana pelo nome ou tipo
                col_name = colunas[i].lower()
                if col_name in ['ativo', 'is_encarregado', 'is_operador', 'concluido'] or \
                   (isinstance(val, int) and val in [0, 1] and col_name.startswith('is_')):
                    valores.append(bool(val))
                else:
                    valores.append(val)
            
            pg_cur.execute(query, valores)
            inseridos += 1
            
            if inseridos % 10 == 0:
                print(f"  ✓ {inseridos} registros inseridos...")
                
        except Exception as e:
            erros += 1
            print(f"  ❌ Erro ao inserir registro: {e}")
    
    print(f"✅ Total inserido: {inseridos}")
    if erros > 0:
        print(f"❌ Erros: {erros}")
    
    return inseridos


def migrar_todas_referencias():
    """Migra todas as tabelas de referência"""
    
    print("\n" + "="*80)
    print("MIGRAÇÃO COMPLETA DE TABELAS DE REFERÊNCIA")
    print("="*80)
    
    # Conectar aos bancos
    print("\n📂 Conectando ao SQLite (usuarios.db)...")
    sqlite_conn = sqlite3.connect('usuarios.db')
    sqlite_cur = sqlite_conn.cursor()
    
    print("🔗 Conectando ao PostgreSQL...")
    init_postgres_manager()
    pg_conn = get_pg_connection()
    pg_cur = pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Dicionário de tabelas para migrar
    tabelas = {
        'transgressoes': 'Transgressões Disciplinares (RDPM)',
        'infracoes_estatuto_art29': 'Infrações ao Estatuto Art. 29',
        'postos_graduacoes': 'Postos e Graduações',
        'naturezas': 'Naturezas de Ocorrências',
        'locais_origem': 'Locais de Origem',
        'tipos_processo': 'Tipos de Processo',
        'status_processo': 'Status de Processo'
    }
    
    resultados = {}
    
    try:
        for tabela, descricao in tabelas.items():
            try:
                total = migrar_tabela_simples(sqlite_cur, pg_cur, tabela, descricao)
                resultados[tabela] = {'sucesso': True, 'total': total}
            except Exception as e:
                print(f"❌ ERRO ao migrar {tabela}: {e}")
                resultados[tabela] = {'sucesso': False, 'erro': str(e)}
        
        # Commit
        pg_conn.commit()
        
        # Relatório final
        print(f"\n{'='*80}")
        print("RELATÓRIO FINAL DA MIGRAÇÃO")
        print(f"{'='*80}\n")
        
        total_sucesso = 0
        total_falha = 0
        total_registros = 0
        
        for tabela, resultado in resultados.items():
            if resultado['sucesso']:
                total_sucesso += 1
                total_registros += resultado['total']
                print(f"✅ {tabela:30s}: {resultado['total']:3d} registros")
            else:
                total_falha += 1
                print(f"❌ {tabela:30s}: FALHOU")
        
        print(f"\n{'='*80}")
        print(f"RESUMO:")
        print(f"  • Tabelas migradas com sucesso: {total_sucesso}")
        print(f"  • Tabelas com falha: {total_falha}")
        print(f"  • Total de registros migrados: {total_registros}")
        print(f"{'='*80}\n")
        
        if total_falha == 0:
            print("✨ MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n")
        else:
            print("⚠️  MIGRAÇÃO CONCLUÍDA COM ALGUMAS FALHAS\n")
        
    except Exception as e:
        pg_conn.rollback()
        print(f"\n❌ ERRO CRÍTICO DURANTE A MIGRAÇÃO: {e}")
        raise
        
    finally:
        sqlite_cur.close()
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()


if __name__ == "__main__":
    migrar_todas_referencias()
