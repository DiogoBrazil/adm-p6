#!/usr/bin/env python3

import sqlite3

def testar_query_direta():
    print("🔍 Testando query SQL diretamente...")
    
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
                COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel,
                p.created_at,
                p.local_origem, 
                p.data_instauracao,
                p.status_pm,
                CASE 
                    WHEN p.nome_pm_id IS NOT NULL THEN COALESCE(
                        (SELECT nome FROM operadores WHERE id = p.nome_pm_id),
                        (SELECT nome FROM encarregados WHERE id = p.nome_pm_id),
                        'Desconhecido'
                    )
                    ELSE NULL
                END as nome_pm,
                p.numero_portaria,
                p.numero_memorando,
                p.numero_feito,
                p.responsavel_id, 
                p.responsavel_tipo,
                COALESCE(o.posto_graduacao, e.posto_graduacao, '') as responsavel_pg,
                COALESCE(o.matricula, e.matricula, '') as responsavel_matricula,
                COALESCE(
                    (SELECT posto_graduacao FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT posto_graduacao FROM encarregados WHERE id = p.nome_pm_id),
                    ''
                ) as nome_pm_pg,
                COALESCE(
                    (SELECT matricula FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT matricula FROM encarregados WHERE id = p.nome_pm_id),
                    ''
                ) as nome_pm_matricula,
                p.numero_rgf,
                p.numero_controle,
                p.concluido,
                p.data_conclusao
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
            WHERE p.ativo = 1
            ORDER BY p.created_at DESC
            LIMIT 5
        """)
        
        processos = cursor.fetchall()
        
        print(f"✅ Query executada com sucesso! {len(processos)} registros encontrados")
        
        for i, processo in enumerate(processos):
            print(f"Processo {i+1}: {len(processo)} colunas")
            print(f"  ID: {processo[0]}")
            print(f"  Número: {processo[1]}")
            print(f"  numero_rgf (índice 21): {processo[21] if len(processo) > 21 else 'N/A'}")
            print(f"  Numero_controle (índice 22): {processo[22] if len(processo) > 22 else 'N/A'}")
            print(f"  Concluído (índice 23): {processo[23] if len(processo) > 23 else 'N/A'}")
            print(f"  Data_conclusao (índice 24): {processo[24] if len(processo) > 24 else 'N/A'}")
            
            if len(processo) > 23 and processo[23]:  # Se concluído
                print(f"  ✅ PROCESSO CONCLUÍDO!")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na query: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    testar_query_direta()
