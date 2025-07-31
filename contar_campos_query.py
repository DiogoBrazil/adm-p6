#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para contar campos da query listar_processos
"""

import sqlite3

def contar_campos_query():
    """Conta quantos campos a query retorna"""
    
    db_path = 'usuarios.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
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
                ) as nome_pm_matricula
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
            WHERE p.ativo = 1
            ORDER BY p.created_at DESC
            LIMIT 1
        """)
        
        processos = cursor.fetchall()
        
        if processos:
            processo = processos[0]
            print(f"📊 Total de campos retornados: {len(processo)}")
            print("\n📋 ÍNDICES E VALORES:")
            print("-" * 50)
            
            for i, valor in enumerate(processo):
                print(f"   [{i:2d}]: {valor}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    contar_campos_query()
