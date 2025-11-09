#!/usr/bin/env python3
"""
Script de Teste Rápido - Validação da Refatoração PostgreSQL
Testa funcionalidades básicas do sistema após a migração

Uso: python teste_rapido_pg.py
"""

import sys
import psycopg2
from db_config import PostgresConnectionManager, DB_CONFIG


def teste_1_conexao():
    """Teste 1: Conectividade básica"""
    print("\n" + "="*60)
    print("TESTE 1: Conexão PostgreSQL")
    print("="*60)
    try:
        manager = PostgresConnectionManager()
        conn = manager.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        conn.close()
        print("✅ PASSOU - Conexão estabelecida")
        print(f"   Versão: {version[:50]}...")
        return True
    except Exception as e:
        print(f"❌ FALHOU - {e}")
        return False


def teste_2_tabelas():
    """Teste 2: Verificar se tabelas existem"""
    print("\n" + "="*60)
    print("TESTE 2: Estrutura do Banco (Tabelas)")
    print("="*60)
    try:
        manager = PostgresConnectionManager()
        conn = manager.get_connection()
        cursor = conn.cursor()
        
        # Listar tabelas
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tabelas = cursor.fetchall()
        conn.close()
        
        if tabelas:
            print(f"✅ PASSOU - {len(tabelas)} tabelas encontradas:")
            for i, (tabela,) in enumerate(tabelas[:10], 1):  # Mostrar primeiras 10
                print(f"   {i}. {tabela}")
            if len(tabelas) > 10:
                print(f"   ... e mais {len(tabelas) - 10} tabelas")
            return True
        else:
            print("⚠️  AVISO - Nenhuma tabela encontrada")
            print("   Execute o app uma vez para criar as tabelas")
            return False
            
    except Exception as e:
        print(f"❌ FALHOU - {e}")
        return False


def teste_3_usuarios():
    """Teste 3: Consultar tabela usuarios"""
    print("\n" + "="*60)
    print("TESTE 3: Dados - Tabela 'usuarios'")
    print("="*60)
    try:
        manager = PostgresConnectionManager()
        conn = manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se tabela existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'usuarios'
            );
        """)
        existe = cursor.fetchone()[0]
        
        if not existe:
            print("⚠️  AVISO - Tabela 'usuarios' não existe ainda")
            print("   Execute o app uma vez ou rode a migração")
            conn.close()
            return False
        
        # Contar usuários
        cursor.execute("SELECT COUNT(*) FROM usuarios;")
        total = cursor.fetchone()[0]
        
        if total > 0:
            # Buscar alguns usuários
            cursor.execute("""
                SELECT nome, email, perfil, ativo 
                FROM usuarios 
                LIMIT 5;
            """)
            usuarios = cursor.fetchall()
            
            print(f"✅ PASSOU - {total} usuário(s) encontrado(s)")
            print("   Exemplos:")
            for nome, email, perfil, ativo in usuarios:
                status = "🟢 Ativo" if ativo else "🔴 Inativo"
                print(f"   - {nome} ({email}) - {perfil} - {status}")
        else:
            print("⚠️  AVISO - Tabela 'usuarios' vazia")
            print("   Execute: python migrar_dados.py")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ FALHOU - {e}")
        return False


def teste_4_query_complexa():
    """Teste 4: Query com placeholder %s"""
    print("\n" + "="*60)
    print("TESTE 4: Queries com Placeholders (%s)")
    print("="*60)
    try:
        manager = PostgresConnectionManager()
        conn = manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se tabela existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'usuarios'
            );
        """)
        existe = cursor.fetchone()[0]
        
        if not existe:
            print("⚠️  AVISO - Tabela 'usuarios' não existe")
            conn.close()
            return False
        
        # Query com placeholder (sintaxe PostgreSQL)
        cursor.execute("""
            SELECT COUNT(*) 
            FROM usuarios 
            WHERE ativo = %s;
        """, (True,))
        
        ativos = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM usuarios 
            WHERE perfil = %s AND ativo = %s;
        """, ('admin', True))
        
        admins = cursor.fetchone()[0]
        
        conn.close()
        
        print("✅ PASSOU - Placeholders %s funcionando corretamente")
        print(f"   Usuários ativos: {ativos}")
        print(f"   Admins ativos: {admins}")
        return True
        
    except Exception as e:
        print(f"❌ FALHOU - {e}")
        return False


def teste_5_dict_cursor():
    """Teste 5: RealDictCursor (resultados como dicionários)"""
    print("\n" + "="*60)
    print("TESTE 5: RealDictCursor (Retorno como Dict)")
    print("="*60)
    try:
        manager = PostgresConnectionManager()
        conn = manager.get_connection()
        cursor = manager.get_dict_cursor(conn)
        
        # Verificar se tabela existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'usuarios'
            );
        """)
        existe = cursor.fetchone()['exists']
        
        if not existe:
            print("⚠️  AVISO - Tabela 'usuarios' não existe")
            conn.close()
            return False
        
        cursor.execute("""
            SELECT nome, email, perfil 
            FROM usuarios 
            WHERE ativo = %s 
            LIMIT 1;
        """, (True,))
        
        usuario = cursor.fetchone()
        conn.close()
        
        if usuario:
            print("✅ PASSOU - RealDictCursor funcionando")
            print(f"   Tipo de retorno: {type(usuario).__name__}")
            print(f"   Dados: {dict(usuario)}")
            return True
        else:
            print("⚠️  AVISO - Nenhum usuário ativo encontrado")
            return False
        
    except Exception as e:
        print(f"❌ FALHOU - {e}")
        return False


def main():
    """Executa todos os testes"""
    print("\n" + "█"*60)
    print("█" + " "*58 + "█")
    print("█" + "  TESTE DE VALIDAÇÃO - REFATORAÇÃO POSTGRESQL  ".center(58) + "█")
    print("█" + " "*58 + "█")
    print("█"*60)
    
    print(f"\nConectando em: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"Banco de dados: {DB_CONFIG['database']}")
    print(f"Usuário: {DB_CONFIG['user']}")
    
    resultados = []
    
    # Executar testes
    resultados.append(("Conexão", teste_1_conexao()))
    resultados.append(("Tabelas", teste_2_tabelas()))
    resultados.append(("Dados Usuarios", teste_3_usuarios()))
    resultados.append(("Placeholders", teste_4_query_complexa()))
    resultados.append(("DictCursor", teste_5_dict_cursor()))
    
    # Relatório final
    print("\n" + "="*60)
    print("RELATÓRIO FINAL")
    print("="*60)
    
    passou = sum(1 for _, result in resultados if result)
    total = len(resultados)
    
    for nome, resultado in resultados:
        status = "✅ PASSOU" if resultado else "❌ FALHOU"
        print(f"{status} - {nome}")
    
    print("\n" + "-"*60)
    print(f"Resultado: {passou}/{total} testes passaram")
    
    if passou == total:
        print("\n🎉 SUCESSO! Refatoração funcionando perfeitamente!")
        print("\nPróximos passos:")
        print("1. Se ainda não fez, migre os dados: python migrar_dados.py")
        print("2. Execute o aplicativo: python main.py")
        print("3. Teste login e funcionalidades principais")
    elif passou >= 2:
        print("\n⚠️  PARCIAL - Sistema básico funcionando")
        print("\nAções recomendadas:")
        print("1. Revise os testes que falharam")
        print("2. Certifique-se de ter criado as tabelas (execute o app uma vez)")
        print("3. Migre os dados: python migrar_dados.py")
    else:
        print("\n❌ ERRO - Problemas críticos detectados")
        print("\nVerifique:")
        print("1. Servidor PostgreSQL está rodando?")
        print("2. Credenciais corretas em db_config.py?")
        print("3. Firewall não está bloqueando?")
        print("4. Banco 'app_db' foi criado no servidor?")
    
    print("\n" + "█"*60 + "\n")
    
    return 0 if passou == total else 1


if __name__ == '__main__':
    sys.exit(main())
