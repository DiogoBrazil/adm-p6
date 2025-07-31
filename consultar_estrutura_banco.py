#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para consultar as tabelas existentes no banco de dados
"""

import sqlite3
import os

def consultar_tabelas():
    """Consulta e exibe as tabelas existentes no banco"""
    
    # Caminho do banco (mesmo usado no main.py)
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🗃️  TABELAS EXISTENTES NO BANCO DE DADOS")
        print("=" * 50)
        
        # Query para listar todas as tabelas
        cursor.execute("""
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='table' 
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)
        
        tabelas = cursor.fetchall()
        
        if not tabelas:
            print("📭 Nenhuma tabela encontrada")
            return
        
        for i, (nome, sql_criacao) in enumerate(tabelas, 1):
            print(f"\n{i}. Tabela: {nome}")
            print("-" * 30)
            
            # Contar registros na tabela
            cursor.execute(f"SELECT COUNT(*) FROM {nome}")
            total_registros = cursor.fetchone()[0]
            print(f"   📊 Total de registros: {total_registros}")
            
            # Mostrar estrutura da tabela
            cursor.execute(f"PRAGMA table_info({nome})")
            colunas = cursor.fetchall()
            print(f"   📋 Colunas ({len(colunas)}):")
            
            for col in colunas:
                col_id, col_name, col_type, not_null, default_val, pk = col
                pk_info = " (PK)" if pk else ""
                not_null_info = " NOT NULL" if not_null else ""
                default_info = f" DEFAULT {default_val}" if default_val else ""
                print(f"      • {col_name}: {col_type}{pk_info}{not_null_info}{default_info}")
        
        conn.close()
        print(f"\n✅ Consulta realizada com sucesso!")
        print(f"📁 Banco: {os.path.abspath(db_path)}")
        
    except Exception as e:
        print(f"❌ Erro ao consultar banco: {e}")

if __name__ == "__main__":
    consultar_tabelas()
