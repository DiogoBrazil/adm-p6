#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para mostrar todos os dados dos procedimentos cadastrados
"""

import sqlite3
import json
from datetime import datetime

def mostrar_dados_procedimentos():
    """Mostra todos os dados dos procedimentos cadastrados"""
    
    db_path = 'usuarios.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📋 DADOS COMPLETOS DOS PROCEDIMENTOS CADASTRADOS")
        print("=" * 80)
        
        # Query completa com todos os dados
        cursor.execute("""
            SELECT 
                p.id,
                p.numero,
                p.tipo_geral,
                p.tipo_detalhe,
                p.documento_iniciador,
                p.processo_sei,
                p.responsavel_id,
                p.responsavel_tipo,
                p.local_origem,
                p.data_instauracao,
                p.data_recebimento,
                p.escrivao_id,
                p.status_pm,
                p.nome_pm_id,
                p.nome_vitima,
                p.natureza_processo,
                p.natureza_procedimento,
                p.resumo_fatos,
                p.numero_portaria,
                p.numero_memorando,
                p.numero_feito,
                p.numero_rgf,
                p.created_at,
                p.updated_at,
                p.ativo,
                -- Dados do responsável
                COALESCE(o_resp.nome, e_resp.nome, 'Desconhecido') as responsavel_nome,
                COALESCE(o_resp.posto_graduacao, e_resp.posto_graduacao, '') as responsavel_pg,
                COALESCE(o_resp.matricula, e_resp.matricula, '') as responsavel_matricula,
                COALESCE(o_resp.email, e_resp.email, '') as responsavel_email,
                -- Dados do PM envolvido
                COALESCE(o_pm.nome, e_pm.nome, NULL) as pm_nome,
                COALESCE(o_pm.posto_graduacao, e_pm.posto_graduacao, '') as pm_pg,
                COALESCE(o_pm.matricula, e_pm.matricula, '') as pm_matricula,
                COALESCE(o_pm.email, e_pm.email, '') as pm_email,
                -- Dados do escrivão
                COALESCE(o_esc.nome, e_esc.nome, NULL) as escrivao_nome,
                COALESCE(o_esc.posto_graduacao, e_esc.posto_graduacao, '') as escrivao_pg,
                COALESCE(o_esc.matricula, e_esc.matricula, '') as escrivao_matricula
            FROM processos_procedimentos p
            -- JOIN para responsável
            LEFT JOIN operadores o_resp ON p.responsavel_id = o_resp.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e_resp ON p.responsavel_id = e_resp.id AND p.responsavel_tipo = 'encarregado'
            -- JOIN para PM envolvido
            LEFT JOIN operadores o_pm ON p.nome_pm_id = o_pm.id
            LEFT JOIN encarregados e_pm ON p.nome_pm_id = e_pm.id
            -- JOIN para escrivão
            LEFT JOIN operadores o_esc ON p.escrivao_id = o_esc.id
            LEFT JOIN encarregados e_esc ON p.escrivao_id = e_esc.id
            ORDER BY p.created_at DESC
        """)
        
        procedimentos = cursor.fetchall()
        
        print(f"📊 Total de procedimentos encontrados: {len(procedimentos)}")
        print("-" * 80)
        
        for i, proc in enumerate(procedimentos, 1):
            print(f"\n🗂️  PROCEDIMENTO {i}")
            print("=" * 50)
            
            # Informações básicas
            print(f"📌 ID: {proc[0]}")
            print(f"📋 Número: {proc[1]}")
            print(f"📁 Tipo Geral: {proc[2]}")
            print(f"📄 Tipo Detalhe: {proc[3]}")
            print(f"📜 Documento Iniciador: {proc[4]}")
            print(f"🏛️  Processo SEI: {proc[5] or 'Não informado'}")
            print(f"🏢 Local Origem: {proc[8] or 'Não informado'}")
            
            # Datas
            print(f"📅 Data Instauração: {proc[9] or 'Não informada'}")
            print(f"📅 Data Recebimento: {proc[10] or 'Não informada'}")
            print(f"📅 Criado em: {proc[22]}")
            print(f"📅 Atualizado em: {proc[23]}")
            print(f"✅ Status: {'Ativo' if proc[24] else 'Inativo'}")
            
            # Responsável
            print(f"\n👤 RESPONSÁVEL:")
            responsavel_completo = f"{proc[26]} {proc[27]} {proc[25]}".strip()
            print(f"   Nome Completo: {responsavel_completo}")
            print(f"   ID: {proc[6]}")
            print(f"   Tipo: {proc[7]}")
            print(f"   Email: {proc[28] or 'Não informado'}")
            
            # PM Envolvido
            if proc[13]:  # nome_pm_id
                print(f"\n👮 PM ENVOLVIDO:")
                pm_completo = f"{proc[30]} {proc[31]} {proc[29]}".strip()
                print(f"   Nome Completo: {pm_completo}")
                print(f"   ID: {proc[13]}")
                print(f"   Status: {proc[12] or 'Não informado'}")
                print(f"   Email: {proc[32] or 'Não informado'}")
            else:
                print(f"\n👮 PM ENVOLVIDO: Não informado")
            
            # Escrivão
            if proc[11]:  # escrivao_id
                print(f"\n✍️  ESCRIVÃO:")
                escrivao_completo = f"{proc[34]} {proc[35]} {proc[33]}".strip()
                print(f"   Nome Completo: {escrivao_completo}")
                print(f"   ID: {proc[11]}")
            else:
                print(f"\n✍️  ESCRIVÃO: Não informado")
            
            # Números específicos dos documentos
            print(f"\n📑 NÚMEROS DOS DOCUMENTOS:")
            print(f"   Portaria: {proc[18] or 'Não informado'}")
            print(f"   Memorando: {proc[19] or 'Não informado'}")
            print(f"   Feito: {proc[20] or 'Não informado'}")
            print(f"   RGF: {proc[21] or 'Não informado'}")
            
            # Informações adicionais
            print(f"\n📝 INFORMAÇÕES ADICIONAIS:")
            print(f"   Vítima: {proc[14] or 'Não informada'}")
            print(f"   Natureza Processo: {proc[15] or 'Não informada'}")
            print(f"   Natureza Procedimento: {proc[16] or 'Não informada'}")
            
            # Resumo dos fatos
            if proc[17]:
                print(f"\n📖 RESUMO DOS FATOS:")
                print(f"   {proc[17]}")
            else:
                print(f"\n📖 RESUMO DOS FATOS: Não informado")
            
            if i < len(procedimentos):
                print("\n" + "-" * 80)
        
        conn.close()
        
        print(f"\n✅ Consulta realizada com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao consultar procedimentos: {e}")
        import traceback
        traceback.print_exc()

def mostrar_dados_resumidos():
    """Mostra dados resumidos dos procedimentos para verificação"""
    
    db_path = 'usuarios.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("\n" + "=" * 80)
        print("📋 RESUMO DOS PROCEDIMENTOS (para verificação)")
        print("=" * 80)
        
        cursor.execute("""
            SELECT 
                p.numero,
                p.tipo_detalhe,
                p.data_instauracao,
                COALESCE(o_resp.posto_graduacao, e_resp.posto_graduacao, '') || ' ' ||
                COALESCE(o_resp.matricula, e_resp.matricula, '') || ' ' ||
                COALESCE(o_resp.nome, e_resp.nome, 'Desconhecido') as responsavel_completo,
                CASE 
                    WHEN p.nome_pm_id IS NOT NULL THEN 
                        COALESCE(o_pm.posto_graduacao, e_pm.posto_graduacao, '') || ' ' ||
                        COALESCE(o_pm.matricula, e_pm.matricula, '') || ' ' ||
                        COALESCE(o_pm.nome, e_pm.nome, 'Desconhecido')
                    ELSE 'Não informado'
                END as pm_completo,
                p.status_pm,
                p.ativo
            FROM processos_procedimentos p
            LEFT JOIN operadores o_resp ON p.responsavel_id = o_resp.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e_resp ON p.responsavel_id = e_resp.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_pm ON p.nome_pm_id = o_pm.id
            LEFT JOIN encarregados e_pm ON p.nome_pm_id = e_pm.id
            ORDER BY p.created_at DESC
        """)
        
        procedimentos = cursor.fetchall()
        
        print(f"{'ANO':<6} {'NÚMERO':<20} {'TIPO':<10} {'ENCARREGADO':<30} {'PM ENVOLVIDO':<30} {'STATUS':<15}")
        print("-" * 120)
        
        for proc in procedimentos:
            # Extrair ano da data_instauracao
            ano = ""
            if proc[2]:  # data_instauracao
                try:
                    ano = str(datetime.strptime(proc[2], "%Y-%m-%d").year)
                except:
                    ano = "N/A"
            else:
                ano = "N/A"
            
            numero = proc[0] or "N/A"
            tipo = proc[1] or "N/A"
            responsavel = proc[3].strip() or "N/A"
            pm = proc[4].strip() or "N/A"
            status = proc[5] or "N/A"
            ativo = "✅" if proc[6] else "❌"
            
            print(f"{ano:<6} {numero:<20} {tipo:<10} {responsavel:<30} {pm:<30} {status:<15} {ativo}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao gerar resumo: {e}")

if __name__ == "__main__":
    mostrar_dados_procedimentos()
    mostrar_dados_resumidos()
