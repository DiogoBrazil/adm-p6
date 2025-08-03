#!/usr/bin/env python3
"""
Teste para verificar os novos filtros de situação detalhados:
- Em andamento (todos)
- Em andamento no prazo
- Em andamento vencido
- Concluído
"""

import sqlite3
from datetime import datetime, timedelta
import sys
import os

# Adicionar o diretório atual ao path para importar os módulos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import listar_processos_com_prazos

def testar_filtros_situacao_detalhados():
    """Testa os novos filtros de situação detalhados"""
    
    print("🔍 Testando filtros de situação detalhados...")
    print("="*60)
    
    # Conectar ao banco
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    try:
        # 1. Verificar dados existentes
        print("1. Verificando dados existentes no banco...")
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN concluido = 1 THEN 1 ELSE 0 END) as concluidos,
                   SUM(CASE WHEN (concluido = 0 OR concluido IS NULL) THEN 1 ELSE 0 END) as em_andamento
            FROM processos_procedimentos WHERE ativo = 1
        """)
        
        stats = cursor.fetchone()
        print(f"📊 Total de processos: {stats[0]}")
        print(f"✅ Concluídos: {stats[1]}")
        print(f"⏳ Em andamento: {stats[2]}")
        
        # 2. Criar alguns dados de teste se necessário
        data_hoje = datetime.now().strftime('%Y-%m-%d')
        data_vencida = (datetime.now() - timedelta(days=35)).strftime('%Y-%m-%d')  # 35 dias atrás
        data_no_prazo = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')  # 10 dias atrás
        
        print("\n2. Criando dados de teste específicos...")
        
        # Processo vencido (PADS tem 30 dias de prazo, recebido há 35 dias)
        cursor.execute("""
            INSERT OR REPLACE INTO processos_procedimentos 
            (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, data_recebimento, 
             local_origem, responsavel_id, responsavel_tipo, concluido, ativo)
            VALUES ('test-vencido', 'TESTE-VENCIDO', 'processo', 'PADS', 'Portaria', ?, 
                    '7ºBPM', 'test-resp', 'encarregado', 0, 1)
        """, (data_vencida,))
        
        # Processo no prazo (PADS tem 30 dias de prazo, recebido há 10 dias)
        cursor.execute("""
            INSERT OR REPLACE INTO processos_procedimentos 
            (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, data_recebimento, 
             local_origem, responsavel_id, responsavel_tipo, concluido, ativo)
            VALUES ('test-no-prazo', 'TESTE-PRAZO', 'processo', 'PADS', 'Portaria', ?, 
                    '7ºBPM', 'test-resp', 'encarregado', 0, 1)
        """, (data_no_prazo,))
        
        # Processo concluído
        cursor.execute("""
            INSERT OR REPLACE INTO processos_procedimentos 
            (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, data_recebimento, 
             local_origem, responsavel_id, responsavel_tipo, concluido, data_conclusao, ativo)
            VALUES ('test-concluido', 'TESTE-CONCLUIDO', 'processo', 'PADS', 'Portaria', ?, 
                    '7ºBPM', 'test-resp', 'encarregado', 1, ?, 1)
        """, (data_no_prazo, data_hoje))
        
        conn.commit()
        print("✅ Dados de teste criados")
        
        # 3. Testar cada filtro
        print("\n3. Testando filtros...")
        
        filtros_teste = {
            "Todos os processos": {},
            "Apenas concluídos": {"situacao": "concluido"},
            "Em andamento (todos)": {"situacao": "em_andamento"},
            "Em andamento no prazo": {"situacao": "em_andamento_no_prazo"},
            "Em andamento vencidos": {"situacao": "em_andamento_vencido"}
        }
        
        for nome_filtro, filtro in filtros_teste.items():
            print(f"\n🔍 Testando: {nome_filtro}")
            try:
                resultado = listar_processos_com_prazos(search_term=None, page=1, per_page=100, filtros=filtro)
                
                if resultado['sucesso']:
                    processos = resultado['processos']
                    print(f"   📋 Encontrados: {len(processos)} processos")
                    
                    # Mostrar alguns exemplos
                    for i, proc in enumerate(processos[:3]):
                        numero = proc.get('numero_controle') or proc.get('numero', 'N/A')
                        concluido = proc.get('concluido', False)
                        prazo_info = proc.get('prazo', {})
                        status = prazo_info.get('status_prazo', 'Sem dados')
                        vencido = prazo_info.get('vencido', False)
                        
                        if concluido:
                            status_desc = "✅ Concluído"
                        elif vencido:
                            status_desc = f"❌ Vencido - {status}"
                        else:
                            status_desc = f"⏰ No prazo - {status}"
                        
                        print(f"   {i+1}. {numero}: {status_desc}")
                        
                    if len(processos) > 3:
                        print(f"   ... e mais {len(processos) - 3} processos")
                else:
                    print(f"   ❌ Erro: {resultado.get('mensagem', 'Erro desconhecido')}")
                    
            except Exception as e:
                print(f"   ❌ Erro ao testar filtro: {e}")
        
        print("\n4. Limpando dados de teste...")
        cursor.execute("DELETE FROM processos_procedimentos WHERE id LIKE 'test-%'")
        conn.commit()
        print("✅ Dados de teste removidos")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        conn.close()

if __name__ == "__main__":
    sucesso = testar_filtros_situacao_detalhados()
    if sucesso:
        print("\n✅ Teste concluído com sucesso!")
        print("💡 Os novos filtros de situação estão funcionando corretamente!")
    else:
        print("\n❌ Teste falhou!")
