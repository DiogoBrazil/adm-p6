#!/usr/bin/env python3
"""
Script de teste para o sistema de auditoria
Testa se os registros estão sendo salvos corretamente
"""

import sys
sys.path.insert(0, '/home/diogo/DEV/aulas/test-eel')

from db_config import get_pg_connection, init_postgres_manager
import psycopg2.extras

def testar_auditoria():
    """Verifica registros de auditoria no banco"""
    print("\n🔍 TESTE DO SISTEMA DE AUDITORIA\n")
    print("=" * 60)
    
    try:
        # Inicializar gerenciador PostgreSQL
        init_postgres_manager()
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Total de registros
        cursor.execute("SELECT COUNT(*) as total FROM auditoria")
        total = cursor.fetchone()['total']
        print(f"\n📊 Total de registros de auditoria: {total}")
        
        if total == 0:
            print("\n⚠️  Nenhum registro encontrado ainda.")
            print("   Execute algumas operações na aplicação para gerar auditorias.")
            conn.close()
            return
        
        # Distribuição por operação
        print("\n📈 Distribuição por tipo de operação:")
        cursor.execute("""
            SELECT operacao, COUNT(*) as quantidade
            FROM auditoria
            GROUP BY operacao
            ORDER BY quantidade DESC
        """)
        for row in cursor.fetchall():
            print(f"   • {row['operacao']}: {row['quantidade']} registros")
        
        # Distribuição por tabela
        print("\n📋 Distribuição por tabela:")
        cursor.execute("""
            SELECT tabela, COUNT(*) as quantidade
            FROM auditoria
            GROUP BY tabela
            ORDER BY quantidade DESC
        """)
        for row in cursor.fetchall():
            print(f"   • {row['tabela']}: {row['quantidade']} registros")
        
        # Últimos 10 registros
        print("\n🕒 Últimos 10 registros de auditoria:")
        cursor.execute("""
            SELECT 
                a.operacao,
                a.tabela,
                a.registro_id,
                COALESCE(u.nome, 'Sistema') as usuario,
                TO_CHAR(a.timestamp, 'DD/MM/YYYY HH24:MI:SS') as data_hora
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            ORDER BY a.timestamp DESC
            LIMIT 10
        """)
        
        print(f"\n{'OPERAÇÃO':<10} {'TABELA':<25} {'REGISTRO ID':<36} {'USUÁRIO':<20} {'DATA/HORA'}")
        print("-" * 120)
        
        for row in cursor.fetchall():
            print(f"{row['operacao']:<10} {row['tabela']:<25} {row['registro_id']:<36} {row['usuario']:<20} {row['data_hora']}")
        
        conn.close()
        print("\n" + "=" * 60)
        print("✅ Teste concluído com sucesso!\n")
        
    except Exception as e:
        print(f"\n❌ Erro ao testar auditoria: {e}\n")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    testar_auditoria()
