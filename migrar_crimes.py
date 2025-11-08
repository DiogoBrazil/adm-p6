#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para migrar crimes e contravenções do SQLite para PostgreSQL
"""

import sqlite3
from db_config import init_postgres_manager, get_pg_connection
import psycopg2.extras

def migrar_crimes():
    """Migra crimes e contravenções do SQLite para PostgreSQL"""
    
    print("\n" + "="*80)
    print("MIGRAÇÃO DE CRIMES E CONTRAVENÇÕES (BASE LEGAL)")
    print("="*80)
    
    # Conectar ao SQLite
    print("\n📂 Conectando ao SQLite (usuarios.db)...")
    sqlite_conn = sqlite3.connect('usuarios.db')
    sqlite_cur = sqlite_conn.cursor()
    
    # Conectar ao PostgreSQL
    print("🔗 Conectando ao PostgreSQL...")
    init_postgres_manager()
    pg_conn = get_pg_connection()
    pg_cur = pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        # Buscar crimes do SQLite
        print("\n📋 Buscando crimes e contravenções do SQLite...")
        sqlite_cur.execute('''
            SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo,
                   paragrafo, inciso, alinea, ativo, data_criacao, data_atualizacao
            FROM crimes_contravencoes
            ORDER BY dispositivo_legal, artigo
        ''')
        crimes = sqlite_cur.fetchall()
        
        print(f"✅ Encontrados {len(crimes)} crimes/contravenções")
        
        if len(crimes) == 0:
            print("⚠️  Nenhum crime encontrado no SQLite!")
            return
        
        # Limpar tabela no PostgreSQL
        print("\n🗑️  Limpando tabela crimes_contravencoes no PostgreSQL...")
        pg_cur.execute("DELETE FROM crimes_contravencoes")
        print(f"✅ {pg_cur.rowcount} registros deletados")
        
        # Inserir crimes no PostgreSQL
        print("\n📥 Inserindo crimes/contravenções no PostgreSQL...")
        
        inseridos = 0
        erros = 0
        
        for c in crimes:
            try:
                pg_cur.execute('''
                    INSERT INTO crimes_contravencoes 
                    (id, tipo, dispositivo_legal, artigo, descricao_artigo,
                     paragrafo, inciso, alinea, ativo, data_criacao, data_atualizacao)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], 
                      bool(c[8]), c[9], c[10]))
                inseridos += 1
                
                # Mostrar progresso a cada 5
                if inseridos % 5 == 0:
                    print(f"  ✓ {inseridos} registros inseridos...")
                    
            except Exception as e:
                erros += 1
                print(f"  ❌ Erro ao inserir Art. {c[3]}: {e}")
        
        # Commit
        pg_conn.commit()
        
        print(f"\n{'='*80}")
        print("RESULTADO DA MIGRAÇÃO")
        print(f"{'='*80}")
        print(f"✅ Inseridos com sucesso: {inseridos}")
        if erros > 0:
            print(f"❌ Erros: {erros}")
        
        # Verificar resultado
        pg_cur.execute("SELECT COUNT(*) as total FROM crimes_contravencoes")
        total = pg_cur.fetchone()['total']
        
        pg_cur.execute("SELECT COUNT(*) as total FROM crimes_contravencoes WHERE tipo = 'Crime'")
        total_crimes = pg_cur.fetchone()['total']
        
        pg_cur.execute("SELECT COUNT(*) as total FROM crimes_contravencoes WHERE tipo = 'Contravenção Penal'")
        total_contravencoes = pg_cur.fetchone()['total']
        
        print(f"\n📊 ESTATÍSTICAS:")
        print(f"   • Total: {total}")
        print(f"   • Crimes: {total_crimes}")
        print(f"   • Contravenções: {total_contravencoes}")
        
        # Estatísticas por dispositivo legal
        print(f"\n📚 POR DISPOSITIVO LEGAL:")
        pg_cur.execute('''
            SELECT dispositivo_legal, COUNT(*) as total
            FROM crimes_contravencoes
            GROUP BY dispositivo_legal
            ORDER BY dispositivo_legal
        ''')
        dispositivos = pg_cur.fetchall()
        
        for d in dispositivos:
            print(f"   • {d['dispositivo_legal']}: {d['total']} registros")
        
        # Mostrar alguns exemplos
        print(f"\n📋 EXEMPLOS (primeiros 5):")
        pg_cur.execute('''
            SELECT tipo, dispositivo_legal, artigo, descricao_artigo
            FROM crimes_contravencoes 
            ORDER BY dispositivo_legal, artigo
            LIMIT 5
        ''')
        exemplos = pg_cur.fetchall()
        
        for ex in exemplos:
            tipo_icone = '⚖️' if ex['tipo'] == 'Crime' else '📋'
            descricao = ex['descricao_artigo'][:50] + '...' if len(ex['descricao_artigo']) > 50 else ex['descricao_artigo']
            print(f"   {tipo_icone} {ex['dispositivo_legal']} Art. {ex['artigo']}")
            print(f"      {descricao}")
        
        print(f"\n{'='*80}")
        print("✨ MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
        print(f"{'='*80}\n")
        
    except Exception as e:
        pg_conn.rollback()
        print(f"\n❌ ERRO DURANTE A MIGRAÇÃO: {e}")
        raise
        
    finally:
        # Fechar conexões
        sqlite_cur.close()
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()


if __name__ == "__main__":
    migrar_crimes()
