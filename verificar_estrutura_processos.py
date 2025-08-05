#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar a estrutura da tabela processos_procedimentos
"""
import sqlite3
import os

def verificar_estrutura_tabela():
    """Verifica a estrutura da tabela processos_procedimentos"""
    
    # Caminho do banco de dados
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se a tabela existe
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='processos_procedimentos'
        """)
        
        if not cursor.fetchone():
            print("❌ Tabela 'processos_procedimentos' não encontrada")
            return
        
        print("✅ Tabela 'processos_procedimentos' encontrada")
        print("\n📋 Estrutura da tabela:")
        print("-" * 50)
        
        # Obter informações da tabela
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns = cursor.fetchall()
        
        for col in columns:
            cid, name, type_, notnull, default_value, pk = col
            constraints = []
            if pk:
                constraints.append("PRIMARY KEY")
            if notnull:
                constraints.append("NOT NULL")
            
            constraint_str = f" ({', '.join(constraints)})" if constraints else ""
            print(f"  {name}: {type_}{constraint_str}")
        
        print("\n🔍 Verificando constraints UNIQUE:")
        print("-" * 50)
        
        # Verificar índices únicos
        cursor.execute("PRAGMA index_list(processos_procedimentos)")
        indexes = cursor.fetchall()
        
        unique_constraints = []
        for idx in indexes:
            seq, name, unique, origin, partial = idx
            if unique:
                cursor.execute(f"PRAGMA index_info({name})")
                index_info = cursor.fetchall()
                columns_in_index = [info[2] for info in index_info]
                unique_constraints.append({
                    'index_name': name,
                    'columns': columns_in_index
                })
        
        if unique_constraints:
            for constraint in unique_constraints:
                print(f"  ✅ UNIQUE constraint: {', '.join(constraint['columns'])}")
        else:
            print("  ℹ️ Nenhum constraint UNIQUE encontrado via índices")
        
        # Verificar especificamente a coluna 'numero'
        print(f"\n🎯 Verificação específica da coluna 'numero':")
        print("-" * 50)
        
        numero_column = next((col for col in columns if col[1] == 'numero'), None)
        if numero_column:
            cid, name, type_, notnull, default_value, pk = numero_column
            print(f"  Coluna: {name}")
            print(f"  Tipo: {type_}")
            print(f"  NOT NULL: {'Sim' if notnull else 'Não'}")
            print(f"  PRIMARY KEY: {'Sim' if pk else 'Não'}")
            
            # Verificar se há constraint UNIQUE na coluna numero
            numero_unique = any('numero' in constraint['columns'] for constraint in unique_constraints)
            print(f"  UNIQUE: {'Sim' if numero_unique else 'Não'}")
        else:
            print("  ❌ Coluna 'numero' não encontrada")
        
        # Testar tentativa de inserir números duplicados
        print(f"\n🧪 Testando constraint UNIQUE na coluna 'numero':")
        print("-" * 50)
        
        try:
            # Verificar se já existe algum processo
            cursor.execute("SELECT COUNT(*) FROM processos_procedimentos")
            count = cursor.fetchone()[0]
            print(f"  Registros existentes: {count}")
            
            if count > 0:
                cursor.execute("SELECT numero FROM processos_procedimentos LIMIT 1")
                numero_existente = cursor.fetchone()[0]
                print(f"  Tentando inserir número duplicado: {numero_existente}")
                
                try:
                    cursor.execute("""
                        INSERT INTO processos_procedimentos 
                        (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, responsavel_id, responsavel_tipo) 
                        VALUES ('test-id', ?, 'processo', 'PAD', 'Portaria', 'test-resp', 'operador')
                    """, (numero_existente,))
                    conn.commit()
                    print("  ❌ ERRO: Conseguiu inserir número duplicado!")
                except sqlite3.IntegrityError as e:
                    print(f"  ✅ SUCESSO: Constraint funcionando - {str(e)}")
                    conn.rollback()
            else:
                print("  ℹ️ Sem registros para testar duplicação")
                
        except Exception as e:
            print(f"  ⚠️ Erro no teste: {str(e)}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao verificar estrutura: {str(e)}")

if __name__ == "__main__":
    verificar_estrutura_tabela()
