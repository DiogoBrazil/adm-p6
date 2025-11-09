#!/usr/bin/env python3
"""
Script para resetar banco PostgreSQL mantendo apenas usuário admin
"""

import psycopg2
import psycopg2.extras
from db_config import get_pg_connection, init_postgres_manager

def reset_database():
    """Limpa todos os dados exceto usuário admin"""
    
    # Inicializar gerenciador PostgreSQL
    init_postgres_manager()
    
    conn = get_pg_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        print("🗑️ Iniciando reset do banco de dados PostgreSQL...")
        print("⚠️  Mantendo apenas usuário admin\n")
        
        # Listar todas as tabelas
        cursor.execute("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename NOT IN ('usuarios')
            ORDER BY tablename
        """)
        
        tables = [row['tablename'] for row in cursor.fetchall()]
        
        print(f"📋 Encontradas {len(tables)} tabelas para limpar:")
        for table in tables:
            print(f"   - {table}")
        print()
        
        # Deletar dados de todas as tabelas exceto usuarios
        for table in tables:
            try:
                print(f"  🗑️  Limpando tabela: {table}...", end=" ")
                cursor.execute(f'DELETE FROM "{table}"')
                print(f"✅ {cursor.rowcount} registros deletados")
            except Exception as e:
                print(f"⚠️  Erro (pode ser normal se tabela não existir): {e}")
        
        # Deletar usuários exceto admin
        print(f"\n  🗑️  Limpando usuários (mantendo admin)...", end=" ")
        cursor.execute("DELETE FROM usuarios WHERE email IS NULL OR email != 'admin@sistema.com'")
        print(f"✅ {cursor.rowcount} usuários deletados")
        
        conn.commit()
        print("\n✅ Reset concluído com sucesso!\n")
        
        # Mostrar contagens finais
        print("📊 ESTADO FINAL DO BANCO:")
        cursor.execute("SELECT COUNT(*) as count FROM usuarios")
        usuarios_count = cursor.fetchone()['count']
        print(f"   - Usuários: {usuarios_count}")
        
        # Contar processos/procedimentos
        try:
            cursor.execute("SELECT COUNT(*) as count FROM processos_procedimentos")
            processos_count = cursor.fetchone()['count']
            print(f"   - Processos/Procedimentos: {processos_count}")
        except:
            print(f"   - Processos/Procedimentos: tabela não existe")
        
        print("\n✨ Banco resetado! Pronto para testes com dados novos.")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Erro ao resetar banco: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    import sys
    
    # Confirmação de segurança
    print("="*60)
    print("⚠️  ATENÇÃO: RESET DO BANCO DE DADOS")
    print("="*60)
    print("\nEste script vai DELETAR TODOS OS DADOS do banco PostgreSQL,")
    print("mantendo apenas o usuário admin.")
    print("\nVocê tem certeza que deseja continuar?")
    print("\nDigite 'SIM' (em maiúsculas) para confirmar: ", end="")
    
    confirmacao = input().strip()
    
    if confirmacao == "SIM":
        print("\n✅ Confirmação recebida. Iniciando reset...\n")
        reset_database()
    else:
        print("\n❌ Reset cancelado. Nenhuma alteração foi feita.")
        sys.exit(0)
