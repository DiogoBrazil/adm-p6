#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para listar usuários no banco PostgreSQL
"""

from db_config import init_postgres_manager, get_pg_connection
import psycopg2.extras

if __name__ == "__main__":
    init_postgres_manager()
    conn = get_pg_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("SELECT id, nome, email, tipo_usuario, ativo FROM usuarios ORDER BY id")
    usuarios = cur.fetchall()
    
    print("\n" + "="*70)
    print("USUÁRIOS NO BANCO POSTGRESQL")
    print("="*70)
    print(f"\nTotal: {len(usuarios)} usuários\n")
    
    for u in usuarios:
        ativo_str = "✅ ATIVO" if u['ativo'] else "❌ INATIVO"
        nome = u['nome'] or '(sem nome)'
        email = u['email'] or '(sem email)'
        tipo = u['tipo_usuario'] or '(sem tipo)'
        print(f"{u['id']} | {nome:30s} | {email:35s} | {tipo:20s} | {ativo_str}")
    
    cur.close()
    conn.close()
    print("\n" + "="*70 + "\n")
