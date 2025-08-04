#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar a formatação completa de responsáveis e PM envolvidos
"""

import sqlite3
import os
from datetime import datetime

def testar_formatacao_completa():
    """Testa se a formatação completa está funcionando"""
    print("🔍 Testando formatação completa de responsáveis e PM envolvidos...")
    
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usuarios.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Simular a consulta exata da função listar_processos_com_prazos corrigida
        cursor.execute("""
            SELECT 
                p.numero,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.nome END,
                    o_backup.nome,
                    e_backup.nome,
                    'Desconhecido'
                ) as responsavel_nome,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao END,
                    o_backup.posto_graduacao,
                    e_backup.posto_graduacao,
                    ''
                ) as responsavel_posto,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.matricula END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.matricula END,
                    o_backup.matricula,
                    e_backup.matricula,
                    ''
                ) as responsavel_matricula,
                COALESCE(pm_env_e.nome, pm_env_o.nome, 'Não informado') as pm_envolvido_nome,
                COALESCE(pm_env_e.posto_graduacao, pm_env_o.posto_graduacao, '') as pm_envolvido_posto,
                COALESCE(pm_env_e.matricula, pm_env_o.matricula, '') as pm_envolvido_matricula
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_backup ON p.responsavel_id = o_backup.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN encarregados e_backup ON p.responsavel_id = e_backup.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados pm_env_e ON p.nome_pm_id = pm_env_e.id
            LEFT JOIN operadores pm_env_o ON p.nome_pm_id = pm_env_o.id
            WHERE p.ativo = 1
            ORDER BY p.numero
        """)
        
        processos = cursor.fetchall()
        
        print(f"\n✅ Testando formatação para {len(processos)} processos:")
        
        for processo in processos:
            numero, responsavel_nome, responsavel_posto, responsavel_matricula, pm_envolvido_nome, pm_envolvido_posto, pm_envolvido_matricula = processo
            
            # Formatar responsável completo: "posto/grad + matrícula + nome"
            responsavel_completo = f"{responsavel_posto} {responsavel_matricula} {responsavel_nome}".strip()
            if responsavel_completo == "Desconhecido":
                responsavel_completo = "Desconhecido"
            
            # Formatar PM envolvido completo: "posto/grad + matrícula + nome"
            if pm_envolvido_nome != "Não informado":
                pm_envolvido_completo = f"{pm_envolvido_posto} {pm_envolvido_matricula} {pm_envolvido_nome}".strip()
            else:
                pm_envolvido_completo = "Não informado"
            
            print(f"\n📋 Processo {numero}:")
            print(f"   🧑‍💼 Responsável: {responsavel_completo}")
            print(f"   👮 PM Envolvido: {pm_envolvido_completo}")
            
            # Validar formatação
            validacao = []
            if responsavel_completo != "Desconhecido" and len(responsavel_completo.split()) >= 3:
                validacao.append("✅ Responsável bem formatado")
            elif responsavel_completo == "Desconhecido":
                validacao.append("⚠️ Responsável desconhecido")
            else:
                validacao.append("❌ Responsável mal formatado")
                
            if pm_envolvido_completo != "Não informado" and len(pm_envolvido_completo.split()) >= 3:
                validacao.append("✅ PM envolvido bem formatado")
            elif pm_envolvido_completo == "Não informado":
                validacao.append("ℹ️ PM envolvido não informado")
            else:
                validacao.append("❌ PM envolvido mal formatado")
            
            print(f"   📊 Validação: {', '.join(validacao)}")
        
        conn.close()
        
        print(f"\n🎉 Teste de formatação concluído!")
        return True
        
    except Exception as e:
        print(f"\n❌ Erro no teste: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    testar_formatacao_completa()
