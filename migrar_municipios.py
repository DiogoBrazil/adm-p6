#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para migrar municípios e distritos do SQLite para PostgreSQL
"""

import sqlite3
from db_config import init_postgres_manager, get_pg_connection
import psycopg2.extras

def migrar_municipios():
    """Migra municípios e distritos do SQLite para PostgreSQL"""
    
    print("\n" + "="*80)
    print("MIGRAÇÃO DE MUNICÍPIOS E DISTRITOS")
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
        # Buscar municípios do SQLite
        print("\n📋 Buscando municípios/distritos do SQLite...")
        sqlite_cur.execute('''
            SELECT id, nome, tipo, municipio_pai, created_at, ativo
            FROM municipios_distritos
            ORDER BY nome
        ''')
        municipios = sqlite_cur.fetchall()
        
        print(f"✅ Encontrados {len(municipios)} municípios/distritos")
        
        if len(municipios) == 0:
            print("⚠️  Nenhum município encontrado no SQLite!")
            return
        
        # Limpar tabela no PostgreSQL
        print("\n🗑️  Limpando tabela municipios_distritos no PostgreSQL...")
        pg_cur.execute("DELETE FROM municipios_distritos")
        print(f"✅ {pg_cur.rowcount} registros deletados")
        
        # Inserir municípios no PostgreSQL
        print("\n📥 Inserindo municípios/distritos no PostgreSQL...")
        
        inseridos = 0
        erros = 0
        
        for m in municipios:
            try:
                pg_cur.execute('''
                    INSERT INTO municipios_distritos 
                    (id, nome, tipo, municipio_pai, created_at, ativo)
                    VALUES (%s, %s, %s, %s, %s, %s)
                ''', (m[0], m[1], m[2], m[3], m[4], bool(m[5])))
                inseridos += 1
                
                # Mostrar progresso a cada 10
                if inseridos % 10 == 0:
                    print(f"  ✓ {inseridos} registros inseridos...")
                    
            except Exception as e:
                erros += 1
                print(f"  ❌ Erro ao inserir '{m[1]}': {e}")
        
        # Commit
        pg_conn.commit()
        
        print(f"\n{'='*80}")
        print("RESULTADO DA MIGRAÇÃO")
        print(f"{'='*80}")
        print(f"✅ Inseridos com sucesso: {inseridos}")
        if erros > 0:
            print(f"❌ Erros: {erros}")
        
        # Verificar resultado
        pg_cur.execute("SELECT COUNT(*) as total FROM municipios_distritos")
        total = pg_cur.fetchone()['total']
        
        pg_cur.execute("SELECT COUNT(*) as total FROM municipios_distritos WHERE tipo = 'municipio'")
        total_municipios = pg_cur.fetchone()['total']
        
        pg_cur.execute("SELECT COUNT(*) as total FROM municipios_distritos WHERE tipo = 'distrito'")
        total_distritos = pg_cur.fetchone()['total']
        
        print(f"\n📊 ESTATÍSTICAS:")
        print(f"   • Total: {total}")
        print(f"   • Municípios: {total_municipios}")
        print(f"   • Distritos: {total_distritos}")
        
        # Mostrar alguns exemplos
        print(f"\n📋 EXEMPLOS (primeiros 10):")
        pg_cur.execute('''
            SELECT nome, tipo, municipio_pai 
            FROM municipios_distritos 
            ORDER BY nome 
            LIMIT 10
        ''')
        exemplos = pg_cur.fetchall()
        
        for ex in exemplos:
            tipo_icone = '🏙️' if ex['tipo'] == 'municipio' else '📍'
            pai = f" (distrito de {ex['municipio_pai']})" if ex['municipio_pai'] else ''
            print(f"   {tipo_icone} {ex['nome']}{pai}")
        
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
    migrar_municipios()
