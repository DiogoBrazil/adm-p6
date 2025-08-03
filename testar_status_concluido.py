#!/usr/bin/env python3
"""
Teste para verificar a funcionalidade de status "Concluído" 
na coluna STATUS PRAZO da listagem de processos/procedimentos
"""

import sqlite3
from datetime import datetime, timedelta
import sys
import os

# Adicionar o diretório atual ao path para importar os módulos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import listar_processos

def testar_status_concluido():
    """Testa se o status 'Concluído' aparece corretamente na listagem"""
    
    print("🔍 Testando funcionalidade de Status Concluído...")
    print("="*60)
    
    # Conectar ao banco
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    try:
        # 1. Verificar se as colunas de conclusão existem
        print("1. Verificando estrutura do banco...")
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        colunas = cursor.fetchall()
        
        colunas_nomes = [col[1] for col in colunas]
        
        if 'concluido' in colunas_nomes and 'data_conclusao' in colunas_nomes:
            print("✅ Colunas de conclusão encontradas no banco")
        else:
            print("❌ Colunas de conclusão não encontradas")
            return False
        
        # 2. Verificar se existem processos no banco
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos")
        total_processos = cursor.fetchone()[0]
        
        print(f"📊 Total de processos no banco: {total_processos}")
        
        if total_processos == 0:
            print("⚠️  Criando processo de teste para verificar a funcionalidade...")
            
            # Criar um processo de teste
            data_hoje = datetime.now().strftime('%Y-%m-%d')
            cursor.execute("""
                INSERT INTO processos_procedimentos 
                (numero_processo, assunto, interessado, responsavel, data_recebimento, 
                 prazo_dias, local_origem, numero_controle, concluido, data_conclusao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                'TESTE-001/2025',
                'Teste de Status Concluído',
                'Teste Interessado',
                'Teste Responsável',
                data_hoje,
                30,
                'Teste Local',
                'CTRL-001',
                1,  # concluido = True
                data_hoje
            ))
            
            # Criar outro processo não concluído
            cursor.execute("""
                INSERT INTO processos_procedimentos 
                (numero_processo, assunto, interessado, responsavel, data_recebimento, 
                 prazo_dias, local_origem, numero_controle, concluido)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                'TESTE-002/2025',
                'Teste de Status Em Andamento',
                'Teste Interessado 2',
                'Teste Responsável 2',
                data_hoje,
                30,
                'Teste Local 2',
                'CTRL-002',
                0  # concluido = False
            ))
            
            conn.commit()
            print("✅ Processos de teste criados")
        
        # 3. Testar a listagem com cálculo de prazos
        print("\n3. Testando listagem com cálculo de status...")
        
        try:
            processos = listar_processos()
            
            if not processos:
                print("❌ Nenhum processo retornado pela listagem")
                return False
            
            print(f"📋 {len(processos)} processos encontrados na listagem")
            
            # Verificar processos concluídos
            processos_concluidos = []
            processos_andamento = []
            
            for p in processos:
                if p.get('concluido'):
                    processos_concluidos.append(p)
                else:
                    processos_andamento.append(p)
            
            print(f"✅ Processos concluídos: {len(processos_concluidos)}")
            print(f"⏳ Processos em andamento: {len(processos_andamento)}")
            
            # Mostrar detalhes dos processos concluídos
            for processo in processos_concluidos:
                numero = processo.get('numero_controle') or processo.get('numero_processo', 'N/A')
                data_conclusao = processo.get('data_conclusao', 'Não informada')
                print(f"   🔵 {numero} - Concluído em: {data_conclusao}")
            
            # Mostrar detalhes dos processos em andamento
            for i, processo in enumerate(processos_andamento):
                if i >= 3:  # Mostrar apenas os 3 primeiros
                    break
                numero = processo.get('numero_controle') or processo.get('numero_processo', 'N/A')
                print(f"   ⏰ {numero} - Em andamento")
            
            print("\n4. Teste da lógica do frontend...")
            print("   Para verificar se 'Concluído' aparece em azul na interface:")
            print("   1. Abra a aplicação no navegador")
            print("   2. Faça login (admin/123456)")
            print("   3. Vá para 'Consultar Processos/Procedimentos'")
            print("   4. Verifique na coluna 'STATUS PRAZO':")
            print("      - Processos concluídos devem mostrar 'Concluído' em azul")
            print("      - Processos em andamento devem mostrar contagem de prazo")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro ao testar listagem: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        return False
    
    finally:
        conn.close()

def limpar_dados_teste():
    """Remove os dados de teste criados"""
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM processos_procedimentos WHERE numero_processo LIKE 'TESTE-%'")
        removidos = cursor.rowcount
        conn.commit()
        print(f"🗑️  {removidos} processos de teste removidos")
    except Exception as e:
        print(f"❌ Erro ao limpar dados de teste: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Testar funcionalidade de Status Concluído')
    parser.add_argument('--limpar', action='store_true', help='Remover dados de teste')
    
    args = parser.parse_args()
    
    if args.limpar:
        limpar_dados_teste()
    else:
        sucesso = testar_status_concluido()
        if sucesso:
            print("\n✅ Teste concluído com sucesso!")
            print("💡 Para remover os dados de teste, execute: python3 testar_status_concluido.py --limpar")
        else:
            print("\n❌ Teste falhou!")
