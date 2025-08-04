#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para testar a função listar_processos() corrigida
"""

import sqlite3
import json
from datetime import datetime
import uuid

def testar_listar_processos_corrigida():
    """Testa a função listar_processos() com os índices corrigidos"""
    
    db_path = 'usuarios.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 TESTANDO A FUNÇÃO listar_processos() CORRIGIDA")
        print("=" * 60)
        
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
        
        # Simular a função formatadora
        def formatar_numero_processo(processo):
            numero_formatado = processo[1]  # Número original como fallback
            tipo_detalhe = processo[3]
            documento = processo[4]
            local_origem = processo[8] or ""
            data_instauracao = processo[9] or ""
            ano_instauracao = ""
            
            # Extrair o ano da data de instauração, se disponível
            if data_instauracao:
                try:
                    ano_instauracao = str(datetime.strptime(data_instauracao, "%Y-%m-%d").year)
                except:
                    ano_instauracao = ""
            
            # Criar um número formatado baseado no tipo de documento
            if documento == 'Portaria' and processo[12]:  # numero_portaria
                numero_formatado = f"{tipo_detalhe} nº {processo[12]}/{local_origem}/{ano_instauracao}"
            elif documento == 'Memorando Disciplinar' and processo[13]:  # numero_memorando
                numero_formatado = f"{tipo_detalhe} nº {processo[13]}/{local_origem}/{ano_instauracao}"
            elif documento == 'Feito Preliminar' and processo[14]:  # numero_feito
                numero_formatado = f"{tipo_detalhe} nº {processo[14]}/{local_origem}/{ano_instauracao}"
            
            return numero_formatado

        # Simular o retorno da função
        resultado = []
        for processo in processos:
            item = {
                "id": processo[0],
                "numero": processo[1],
                "numero_formatado": formatar_numero_processo(processo),
                "tipo_geral": processo[2],
                "tipo_detalhe": processo[3],
                "documento_iniciador": processo[4],
                "processo_sei": processo[5],
                "responsavel": processo[6],
                "responsavel_posto_grad": processo[17] or "",  # Posto/graduação do responsável (índice 17)
                "responsavel_matricula": processo[18] or "",  # Matrícula do responsável (índice 18)
                "data_criacao": processo[7],
                "local_origem": processo[8],
                "data_instauracao": processo[9],
                "status_pm": processo[10],
                "nome_pm": processo[11],
                "nome_pm_posto_grad": processo[19] or "",  # Posto/graduação do PM envolvido (índice 19)
                "nome_pm_matricula": processo[20] or "",  # Matrícula do PM envolvido (índice 20)
                "responsavel_completo": f"{processo[17] or ''} {processo[18] or ''} {processo[6]}".strip(),  # Posto/graduação + matrícula + nome
                "nome_pm_completo": f"{processo[19] or ''} {processo[20] or ''} {processo[11] or ''}".strip() if processo[11] else None  # Posto/graduação + matrícula + nome PM
            }
            resultado.append(item)
        
        print(f"📊 Total de processos processados: {len(resultado)}")
        
        for i, item in enumerate(resultado, 1):
            print(f"\n{i}. PROCESSO PROCESSADO:")
            print(f"   ID: {item['id']}")
            print(f"   Número: {item['numero']}")
            print(f"   Responsável Completo: {item['responsavel_completo']}")
            print(f"   PM Completo: {item['nome_pm_completo']}")
            print(f"   Data Instauração: {item['data_instauracao']}")
        
        conn.close()
        
        print(f"\n✅ Teste concluído com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao testar: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_listar_processos_corrigida()
