#!/usr/bin/env python3
"""
Teste para verificar se o preenchimento na edição está correto
"""
import sqlite3
import os

def testar_preenchimento_edicao():
    """Testa se os dados para edição estão sendo retornados corretamente"""
    print("🔍 Testando preenchimento para edição...")
    
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usuarios.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Simular a nova consulta da função obter_processo
        print("\n1. Testando consulta atualizada da função obter_processo:")
        cursor.execute("""
            SELECT 
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
                p.responsavel_id, p.responsavel_tipo,
                COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel_nome,
                p.local_origem, p.data_instauracao, p.data_recebimento, p.escrivao_id, p.status_pm, p.nome_pm_id,
                p.nome_vitima, p.natureza_processo, p.natureza_procedimento, p.resumo_fatos,
                p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf, p.numero_controle,
                p.concluido, p.data_conclusao,
                -- Dados completos do responsável
                COALESCE(o.posto_graduacao, e.posto_graduacao, '') as responsavel_posto,
                COALESCE(o.matricula, e.matricula, '') as responsavel_matricula,
                -- Dados completos do escrivão
                COALESCE(esc_o.nome, esc_e.nome, '') as escrivao_nome,
                COALESCE(esc_o.posto_graduacao, esc_e.posto_graduacao, '') as escrivao_posto,
                COALESCE(esc_o.matricula, esc_e.matricula, '') as escrivao_matricula,
                -- Dados completos do PM envolvido
                COALESCE(pm_o.nome, pm_e.nome, '') as pm_nome,
                COALESCE(pm_o.posto_graduacao, pm_e.posto_graduacao, '') as pm_posto,
                COALESCE(pm_o.matricula, pm_e.matricula, '') as pm_matricula
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
            -- JOINs para escrivão
            LEFT JOIN operadores esc_o ON p.escrivao_id = esc_o.id
            LEFT JOIN encarregados esc_e ON p.escrivao_id = esc_e.id AND esc_o.id IS NULL
            -- JOINs para PM envolvido
            LEFT JOIN operadores pm_o ON p.nome_pm_id = pm_o.id
            LEFT JOIN encarregados pm_e ON p.nome_pm_id = pm_e.id AND pm_o.id IS NULL
            WHERE p.ativo = 1
            ORDER BY p.created_at DESC
            LIMIT 5
        """)
        
        processos = cursor.fetchall()
        
        if processos:
            print(f"✅ Encontrados {len(processos)} processos para teste")
            print(f"✅ Campos retornados por processo: {len(processos[0])}")
            
            for i, processo in enumerate(processos, 1):
                print(f"\n📋 PROCESSO {i}: {processo[1]}")
                
                # Verificar se temos todos os campos necessários
                if len(processo) < 34:
                    print(f"❌ Processo tem apenas {len(processo)} campos, esperados pelo menos 34")
                    continue
                
                # Dados do responsável (campos 8, 26, 27)
                responsavel_nome = processo[8]
                responsavel_posto = processo[26] if len(processo) > 26 else ""
                responsavel_matricula = processo[27] if len(processo) > 27 else ""
                
                responsavel_completo = ""
                if responsavel_posto and responsavel_matricula and responsavel_nome:
                    responsavel_completo = f"{responsavel_posto} {responsavel_matricula} {responsavel_nome}".strip()
                elif responsavel_nome:
                    responsavel_completo = responsavel_nome
                
                print(f"   👤 Responsável: {responsavel_completo}")
                
                # Dados do escrivão (campos 28, 29, 30)
                escrivao_nome = processo[28] if len(processo) > 28 else ""
                escrivao_posto = processo[29] if len(processo) > 29 else ""
                escrivao_matricula = processo[30] if len(processo) > 30 else ""
                
                if escrivao_nome:
                    escrivao_completo = ""
                    if escrivao_posto and escrivao_matricula and escrivao_nome:
                        escrivao_completo = f"{escrivao_posto} {escrivao_matricula} {escrivao_nome}".strip()
                    print(f"   ✍️  Escrivão: {escrivao_completo or 'Dados incompletos'}")
                else:
                    print(f"   ✍️  Escrivão: Não informado")
                
                # Dados do PM envolvido (campos 31, 32, 33)
                pm_nome = processo[31] if len(processo) > 31 else ""
                pm_posto = processo[32] if len(processo) > 32 else ""
                pm_matricula = processo[33] if len(processo) > 33 else ""
                
                if pm_nome:
                    pm_completo = ""
                    if pm_posto and pm_matricula and pm_nome:
                        pm_completo = f"{pm_posto} {pm_matricula} {pm_nome}".strip()
                    print(f"   👮 PM Envolvido: {pm_completo or 'Dados incompletos'}")
                else:
                    print(f"   👮 PM Envolvido: Não informado")
                
                # Status geral
                status_campos = []
                if responsavel_completo:
                    status_campos.append("✅ Responsável OK")
                else:
                    status_campos.append("❌ Responsável incompleto")
                
                if processo[12]:  # escrivao_id
                    if escrivao_nome and escrivao_posto and escrivao_matricula:
                        status_campos.append("✅ Escrivão OK")
                    else:
                        status_campos.append("❌ Escrivão incompleto")
                
                if processo[14]:  # nome_pm_id
                    if pm_nome and pm_posto and pm_matricula:
                        status_campos.append("✅ PM Envolvido OK")
                    else:
                        status_campos.append("❌ PM Envolvido incompleto")
                
                print(f"   📊 Status: {' | '.join(status_campos)}")
        
        # Verificar se há processos com escrivão e PM envolvido para teste específico
        print("\n2. Verificando casos específicos:")
        
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE ativo = 1 AND escrivao_id IS NOT NULL
        """)
        total_com_escrivao = cursor.fetchone()[0]
        print(f"   📄 Processos com escrivão: {total_com_escrivao}")
        
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE ativo = 1 AND nome_pm_id IS NOT NULL
        """)
        total_com_pm = cursor.fetchone()[0]
        print(f"   👮 Processos com PM envolvido: {total_com_pm}")
        
        conn.close()
        print(f"\n✅ Teste concluído!")
        
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    testar_preenchimento_edicao()
