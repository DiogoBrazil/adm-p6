#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para testar a função listar_processos() atualizada
"""

import sqlite3
import json
from datetime import datetime

def testar_listar_processos():
    """Testa a função listar_processos() com as novas alterações"""
    
    db_path = 'usuarios.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 TESTANDO A QUERY ATUALIZADA DA FUNÇÃO listar_processos()")
        print("=" * 70)
        
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
        """)
        
        processos = cursor.fetchall()
        
        print(f"📊 Total de processos ativos encontrados: {len(processos)}")
        print("-" * 70)
        
        for i, processo in enumerate(processos, 1):
            print(f"\n{i}. PROCESSO ID: {processo[0]}")
            print(f"   Número: {processo[1]}")
            print(f"   Tipo: {processo[2]} - {processo[3]}")
            print(f"   Documento: {processo[4]}")
            print(f"   Data Instauração: {processo[9]}")
            print(f"   Responsável: {processo[6]} (ID: {processo[15]})")
            print(f"   Responsável P/G: {processo[17]}")
            print(f"   Responsável Matrícula: {processo[18]}")
            print(f"   PM Envolvido: {processo[11]}")
            print(f"   PM P/G: {processo[19]}")
            print(f"   PM Matrícula: {processo[20]}")
            print(f"   Status PM: {processo[10]}")
            
            # Testar a formatação que será usada
            responsavel_completo = f"{processo[17] or ''} {processo[18] or ''} {processo[6]}".strip()
            nome_pm_completo = f"{processo[19] or ''} {processo[20] or ''} {processo[11] or ''}".strip() if processo[11] else None
            
            print(f"   📋 Responsável Completo: {responsavel_completo}")
            print(f"   📋 PM Completo: {nome_pm_completo}")
            
            # Extrair ano da data_instauracao
            ano = ""
            if processo[9]:  # data_instauracao
                try:
                    ano = str(datetime.strptime(processo[9], "%Y-%m-%d").year)
                except:
                    ano = "Erro ao extrair ano"
            else:
                ano = "Data não informada"
            
            print(f"   📅 Ano extraído: {ano}")
        
        conn.close()
        
        print(f"\n✅ Teste concluído com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao testar: {e}")

if __name__ == "__main__":
    testar_listar_processos()
