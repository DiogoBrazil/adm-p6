#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste final para verificar se a função listar_processos_com_prazos está funcionando
"""

import sqlite3
import os
from datetime import datetime

def testar_funcao_prazos_final():
    """Simula a função listar_processos_com_prazos corrigida"""
    print("🔍 Testando função listar_processos_com_prazos corrigida...")
    
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usuarios.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Simular a consulta exata da função corrigida
        cursor.execute("""
            SELECT 
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, 
                p.data_recebimento, p.created_at,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.nome END,
                    o_backup.nome,
                    e_backup.nome,
                    'Desconhecido'
                ) as responsavel,
                p.local_origem, p.processo_sei, p.nome_pm_id, p.status_pm,
                COALESCE(pm_env_e.nome, pm_env_o.nome, 'Não informado') as pm_envolvido_nome,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao END,
                    o_backup.posto_graduacao,
                    e_backup.posto_graduacao,
                    ''
                ) as responsavel_posto
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_backup ON p.responsavel_id = o_backup.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN encarregados e_backup ON p.responsavel_id = e_backup.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados pm_env_e ON p.nome_pm_id = pm_env_e.id
            LEFT JOIN operadores pm_env_o ON p.nome_pm_id = pm_env_o.id
            WHERE p.ativo = 1
            ORDER BY p.created_at DESC
        """)
        
        processos = cursor.fetchall()
        
        print(f"\n✅ Consulta retornou {len(processos)} processos:")
        
        for processo in processos:
            (processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, 
             data_recebimento, created_at, responsavel, local_origem, processo_sei, 
             nome_pm_id, status_pm, pm_envolvido_nome, responsavel_posto) = processo
            
            print(f"\n📋 Processo {numero}:")
            print(f"   🧑‍💼 Responsável: {responsavel_posto} {responsavel}")
            print(f"   🏢 Origem: {local_origem or 'Não informado'}")
            print(f"   📄 SEI: {processo_sei or 'Não informado'}")
            print(f"   👮 PM Envolvido: {pm_envolvido_nome}")
            print(f"   📊 Status PM: {status_pm or 'Não informado'}")
            
            # Verificar se não há valores "Desconhecido" ou "Não informado" desnecessários
            problemas = []
            if responsavel == "Desconhecido":
                problemas.append("❌ Responsável não encontrado")
            if pm_envolvido_nome == "Não informado" and nome_pm_id:
                problemas.append("⚠️ PM Envolvido não encontrado mas ID existe")
            if not processo_sei and processo_sei != "":
                problemas.append("⚠️ SEI não preenchido")
            
            if problemas:
                print(f"   🚨 Problemas: {', '.join(problemas)}")
            else:
                print(f"   ✅ Todos os dados OK")
        
        conn.close()
        
        print(f"\n🎉 Teste concluído! {len(processos)} processos verificados.")
        return True
        
    except Exception as e:
        print(f"\n❌ Erro no teste: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    testar_funcao_prazos_final()
