# testar_prazos.py - Script de teste para funcionalidades de prazo
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import calcular_prazo_processo, db_manager
from datetime import datetime, timedelta
import sqlite3

def testar_calculo_prazos():
    """Testa o cálculo de prazos com diferentes cenários"""
    print("🧪 TESTANDO SISTEMA DE CÁLCULO DE PRAZOS")
    print("=" * 50)
    
    # Data de hoje como referência
    hoje = datetime.now()
    
    # Cenários de teste
    cenarios = [
        {
            "nome": "SR - Recebido há 10 dias",
            "tipo_detalhe": "SR",
            "documento_iniciador": "Portaria",
            "data_recebimento": (hoje - timedelta(days=10)).strftime("%Y-%m-%d"),
            "prorrogacoes": 0
        },
        {
            "nome": "PADS - Recebido há 25 dias (Vencendo)",
            "tipo_detalhe": "PADS",
            "documento_iniciador": "Memorando Disciplinar",
            "data_recebimento": (hoje - timedelta(days=25)).strftime("%Y-%m-%d"),
            "prorrogacoes": 0
        },
        {
            "nome": "IPM - Recebido há 45 dias (Vencido)",
            "tipo_detalhe": "IPM",
            "documento_iniciador": "Portaria",
            "data_recebimento": (hoje - timedelta(days=45)).strftime("%Y-%m-%d"),
            "prorrogacoes": 0
        },
        {
            "nome": "Feito Preliminar - Recebido há 12 dias",
            "tipo_detalhe": "Averiguação Preliminar",
            "documento_iniciador": "Feito Preliminar",
            "data_recebimento": (hoje - timedelta(days=12)).strftime("%Y-%m-%d"),
            "prorrogacoes": 0
        },
        {
            "nome": "SR com Prorrogação - Recebido há 35 dias + 10 prorrogação",
            "tipo_detalhe": "SR",
            "documento_iniciador": "Portaria",
            "data_recebimento": (hoje - timedelta(days=35)).strftime("%Y-%m-%d"),
            "prorrogacoes": 10
        }
    ]
    
    for i, cenario in enumerate(cenarios, 1):
        print(f"\n📋 CENÁRIO {i}: {cenario['nome']}")
        print(f"   Tipo: {cenario['tipo_detalhe']}")
        print(f"   Documento: {cenario['documento_iniciador']}")
        print(f"   Data Recebimento: {cenario['data_recebimento']}")
        print(f"   Prorrogações: {cenario['prorrogacoes']} dias")
        
        resultado = calcular_prazo_processo(
            tipo_detalhe=cenario['tipo_detalhe'],
            documento_iniciador=cenario['documento_iniciador'],
            data_recebimento=cenario['data_recebimento'],
            prorrogacoes_dias=cenario['prorrogacoes']
        )
        
        print(f"   ➤ Prazo Base: {resultado['prazo_base_dias']} dias")
        print(f"   ➤ Prazo Total: {resultado['prazo_total_dias']} dias")
        print(f"   ➤ Data Limite: {resultado.get('data_limite_formatada', 'N/A')}")
        print(f"   ➤ Dias Restantes: {resultado.get('dias_restantes', 'N/A')}")
        print(f"   ➤ Status: {resultado['status_prazo']}")
        print(f"   ➤ Vencido: {'❌ SIM' if resultado['vencido'] else '✅ NÃO'}")

def verificar_processos_existentes():
    """Verifica se há processos no banco para testar"""
    print("\n🔍 VERIFICANDO PROCESSOS EXISTENTES")
    print("=" * 50)
    
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos WHERE ativo = 1
        """)
        total = cursor.fetchone()[0]
        
        print(f"📊 Total de processos ativos: {total}")
        
        if total > 0:
            cursor.execute("""
                SELECT 
                    numero, tipo_detalhe, documento_iniciador, 
                    data_recebimento, local_origem
                FROM processos_procedimentos 
                WHERE ativo = 1 
                LIMIT 3
            """)
            
            processos = cursor.fetchall()
            print("\n📋 Exemplos de processos:")
            
            for i, processo in enumerate(processos, 1):
                numero, tipo_detalhe, documento_iniciador, data_recebimento, local_origem = processo
                print(f"   {i}. {numero} - {tipo_detalhe}")
                print(f"      Documento: {documento_iniciador}")
                print(f"      Recebimento: {data_recebimento or 'Não informado'}")
                print(f"      Local: {local_origem or 'Não informado'}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao verificar processos: {e}")

def testar_integracao_banco():
    """Testa a integração com o banco de dados"""
    print("\n🔗 TESTANDO INTEGRAÇÃO COM BANCO DE DADOS")
    print("=" * 50)
    
    try:
        # Importar as funções do main
        from main import listar_processos_com_prazos, obter_dashboard_prazos_simples
        
        # Testar listagem de processos com prazos
        print("📋 Testando listagem de processos com prazos...")
        resultado = listar_processos_com_prazos()
        
        if resultado["sucesso"]:
            total = len(resultado["processos"])
            print(f"   ✅ Sucesso! {total} processos carregados com cálculo de prazo")
            
            if total > 0:
                # Mostrar primeiro processo como exemplo
                primeiro = resultado["processos"][0]
                print(f"   📄 Exemplo: {primeiro['numero_formatado']}")
                print(f"      Status Prazo: {primeiro['prazo']['status_prazo']}")
                print(f"      Data Limite: {primeiro['prazo'].get('data_limite_formatada', 'N/A')}")
        else:
            print(f"   ❌ Erro: {resultado['mensagem']}")
        
        # Testar dashboard
        print("\n📊 Testando dashboard de prazos...")
        dashboard = obter_dashboard_prazos_simples()
        
        if dashboard["sucesso"]:
            stats = dashboard["dashboard"]
            print("   ✅ Dashboard carregado com sucesso!")
            print(f"      Total: {stats['total_processos']}")
            print(f"      Vencidos: {stats['vencidos']}")
            print(f"      Vencendo (5 dias): {stats['vencendo_5_dias']}")
            print(f"      Em dia: {stats['em_dia']}")
            print(f"      Sem data recebimento: {stats['sem_data_recebimento']}")
        else:
            print(f"   ❌ Erro no dashboard: {dashboard['mensagem']}")
            
    except Exception as e:
        print(f"❌ Erro na integração: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚀 INICIANDO TESTES DO SISTEMA DE PRAZOS")
    print("Data/Hora:", datetime.now().strftime("%d/%m/%Y %H:%M:%S"))
    print("=" * 60)
    
    # Executar todos os testes
    testar_calculo_prazos()
    verificar_processos_existentes()
    testar_integracao_banco()
    
    print("\n" + "=" * 60)
    print("✅ TESTES CONCLUÍDOS!")
    print("\n💡 Para testar na aplicação:")
    print("   1. Execute: python main.py")
    print("   2. Acesse a interface web")
    print("   3. Veja os processos com cálculo automático de prazo")
