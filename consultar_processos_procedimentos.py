#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para consultar detalhes da tabela processos_procedimentos
"""

import sqlite3
import os

def consultar_processos_procedimentos():
    """Consulta e exibe detalhes da tabela processos_procedimentos"""
    
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🗃️  ESTRUTURA DA TABELA PROCESSOS_PROCEDIMENTOS")
        print("=" * 60)
        
        # 1. Informações gerais da tabela
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos")
        total_registros = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos WHERE ativo = 1")
        registros_ativos = cursor.fetchone()[0]
        
        print(f"📊 Total de registros: {total_registros}")
        print(f"✅ Registros ativos: {registros_ativos}")
        print(f"❌ Registros inativos: {total_registros - registros_ativos}")
        
        # 2. Estrutura das colunas
        print(f"\n📋 ESTRUTURA DAS COLUNAS:")
        print("-" * 60)
        
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        colunas = cursor.fetchall()
        
        print(f"{'#':<3} {'COLUNA':<25} {'TIPO':<15} {'NULL':<6} {'PK':<4} {'PADRÃO':<15}")
        print("-" * 70)
        
        for col in colunas:
            col_id, col_name, col_type, not_null, default_val, pk = col
            pk_str = "✓" if pk else ""
            not_null_str = "NOT NULL" if not_null else "NULL"
            default_str = str(default_val) if default_val else ""
            
            print(f"{col_id+1:<3} {col_name:<25} {col_type:<15} {not_null_str:<6} {pk_str:<4} {default_str:<15}")
        
        # 3. Comando SQL de criação
        print(f"\n🔧 COMANDO SQL DE CRIAÇÃO:")
        print("-" * 60)
        cursor.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'processos_procedimentos'")
        sql_criacao = cursor.fetchone()[0]
        print(sql_criacao)
        
        # 4. Alguns dados de exemplo (se existirem)
        if registros_ativos > 0:
            print(f"\n📄 DADOS DE EXEMPLO (últimos 2 registros):")
            print("-" * 60)
            
            cursor.execute("""
                SELECT numero, tipo_geral, tipo_detalhe, documento_iniciador, 
                       created_at, responsavel_id, ativo
                FROM processos_procedimentos 
                ORDER BY created_at DESC 
                LIMIT 2
            """)
            
            exemplos = cursor.fetchall()
            for i, exemplo in enumerate(exemplos, 1):
                numero, tipo_geral, tipo_detalhe, doc_iniciador, created_at, resp_id, ativo = exemplo
                print(f"\n{i}. Processo: {numero}")
                print(f"   Tipo: {tipo_geral} - {tipo_detalhe}")
                print(f"   Documento: {doc_iniciador}")
                print(f"   Criado em: {created_at}")
                print(f"   Responsável ID: {resp_id}")
                print(f"   Ativo: {'Sim' if ativo else 'Não'}")
        
        # 5. Estatísticas por tipo
        print(f"\n📈 ESTATÍSTICAS POR TIPO:")
        print("-" * 60)
        
        cursor.execute("""
            SELECT tipo_geral, COUNT(*) as total
            FROM processos_procedimentos 
            WHERE ativo = 1
            GROUP BY tipo_geral
            ORDER BY total DESC
        """)
        
        stats_tipo = cursor.fetchall()
        for tipo, total in stats_tipo:
            print(f"   {tipo}: {total}")
        
        cursor.execute("""
            SELECT documento_iniciador, COUNT(*) as total
            FROM processos_procedimentos 
            WHERE ativo = 1
            GROUP BY documento_iniciador
            ORDER BY total DESC
        """)
        
        print(f"\n📋 ESTATÍSTICAS POR DOCUMENTO INICIADOR:")
        stats_doc = cursor.fetchall()
        for doc, total in stats_doc:
            print(f"   {doc}: {total}")
        
        conn.close()
        print(f"\n✅ Consulta realizada com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao consultar banco: {e}")

if __name__ == "__main__":
    consultar_processos_procedimentos()
