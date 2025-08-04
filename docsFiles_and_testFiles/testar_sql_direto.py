#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste simples para verificar a lógica SQL do filtro de ano
"""

import sqlite3
import os

def testar_logica_sql():
    """Testa a nova lógica SQL diretamente no banco"""
    print("🔍 Testando nova lógica SQL do filtro de ano...")
    
    # Caminho do banco
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print("❌ Banco de dados não encontrado!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Testar a nova lógica - buscar todos os processos e mostrar como o ano seria extraído
        query = """
            SELECT 
                p.numero,
                p.data_instauracao,
                p.data_recebimento,
                p.created_at,
                CASE 
                    WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
                    WHEN p.data_recebimento IS NOT NULL THEN strftime('%Y', p.data_recebimento)
                    ELSE strftime('%Y', p.created_at)
                END as ano_extraido,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.matricula || ' ' || o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.matricula || ' ' || e.nome END,
                    ''
                ) as responsavel_completo
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            WHERE p.ativo = 1
            AND TRIM(COALESCE(
                CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.matricula || ' ' || o.nome END,
                CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.matricula || ' ' || e.nome END,
                ''
            )) LIKE '%JOSE CARLOS RODRIGUES FELICIO%'
            ORDER BY ano_extraido DESC, p.numero
        """
        
        cursor.execute(query)
        resultados = cursor.fetchall()
        
        print(f"\n📋 Encontrados {len(resultados)} processos para JOSE CARLOS RODRIGUES FELICIO:")
        print("-" * 100)
        
        for resultado in resultados:
            numero, data_inst, data_receb, created_at, ano_extraido, responsavel = resultado
            print(f"Processo: {numero}")
            print(f"   Ano extraído: {ano_extraido}")
            print(f"   Data instauração: {data_inst}")
            print(f"   Data recebimento: {data_receb}")
            print(f"   Data criação: {created_at}")
            print(f"   Responsável: {responsavel}")
            print("-" * 50)
        
        # Agora testar filtro por ano específico
        anos_teste = ['2024', '2025']
        
        for ano in anos_teste:
            print(f"\n🔍 Testando filtro para ano {ano}:")
            
            query_filtrada = """
                SELECT 
                    p.numero,
                    CASE 
                        WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
                        WHEN p.data_recebimento IS NOT NULL THEN strftime('%Y', p.data_recebimento)
                        ELSE strftime('%Y', p.created_at)
                    END as ano_extraido
                FROM processos_procedimentos p
                LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
                LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
                WHERE p.ativo = 1
                AND TRIM(COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.matricula || ' ' || o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.matricula || ' ' || e.nome END,
                    ''
                )) LIKE '%JOSE CARLOS RODRIGUES FELICIO%'
                AND (
                    CASE 
                        WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
                        WHEN p.data_recebimento IS NOT NULL THEN strftime('%Y', p.data_recebimento)
                        ELSE strftime('%Y', p.created_at)
                    END = ?
                )
                ORDER BY p.numero
            """
            
            cursor.execute(query_filtrada, (ano,))
            resultados_filtrados = cursor.fetchall()
            
            print(f"   ✅ Encontrados {len(resultados_filtrados)} processos para {ano}:")
            for res in resultados_filtrados:
                print(f"      - {res[0]} (ano: {res[1]})")
        
        conn.close()
        print("\n✅ Teste concluído!")
        
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_logica_sql()
