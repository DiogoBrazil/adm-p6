# teste_prazos_simples.py - Teste simples sem dependências do eel
from datetime import datetime, timedelta

def calcular_prazo_processo_teste(tipo_detalhe, documento_iniciador, data_recebimento, prorrogacoes_dias=0):
    """
    Versão de teste da função de cálculo de prazos
    """
    # Definir prazos base conforme regras
    prazos_base = {
        'SR': 30,
        'PADS': 30, 
        'IPM': 40,
        'Feito Preliminar': 15  # Baseado no documento iniciador
    }
    
    # Determinar prazo base
    prazo_dias = 30  # Padrão
    
    if documento_iniciador == 'Feito Preliminar':
        prazo_dias = prazos_base['Feito Preliminar']
    elif tipo_detalhe in prazos_base:
        prazo_dias = prazos_base[tipo_detalhe]
    elif 'SR' in tipo_detalhe.upper():
        prazo_dias = prazos_base['SR']
    elif 'PADS' in tipo_detalhe.upper():
        prazo_dias = prazos_base['PADS']
    elif 'IPM' in tipo_detalhe.upper():
        prazo_dias = prazos_base['IPM']
    
    # Calcular prazo total com prorrogações
    prazo_total_dias = prazo_dias + prorrogacoes_dias
    
    if not data_recebimento:
        return {
            "prazo_base_dias": prazo_dias,
            "prorrogacoes_dias": prorrogacoes_dias,
            "prazo_total_dias": prazo_total_dias,
            "data_limite": None,
            "dias_restantes": None,
            "status_prazo": "Sem data de recebimento",
            "vencido": False
        }
    
    try:
        # Converter data de recebimento
        data_inicio = datetime.strptime(data_recebimento, "%Y-%m-%d")
        data_limite = data_inicio + timedelta(days=prazo_total_dias)
        
        # Calcular dias restantes
        hoje = datetime.now()
        dias_restantes = (data_limite - hoje).days
        
        # Determinar status do prazo
        if dias_restantes < 0:
            status_prazo = f"Vencido há {abs(dias_restantes)} dias"
            vencido = True
        elif dias_restantes == 0:
            status_prazo = "Vence hoje"
            vencido = False
        elif dias_restantes <= 5:
            status_prazo = f"Vence em {dias_restantes} dias (URGENTE)"
            vencido = False
        elif dias_restantes <= 10:
            status_prazo = f"Vence em {dias_restantes} dias (ATENÇÃO)"
            vencido = False
        else:
            status_prazo = f"Vence em {dias_restantes} dias"
            vencido = False
        
        return {
            "prazo_base_dias": prazo_dias,
            "prorrogacoes_dias": prorrogacoes_dias,
            "prazo_total_dias": prazo_total_dias,
            "data_limite": data_limite.strftime("%Y-%m-%d"),
            "data_limite_formatada": data_limite.strftime("%d/%m/%Y"),
            "dias_restantes": dias_restantes,
            "status_prazo": status_prazo,
            "vencido": vencido
        }
        
    except ValueError:
        return {
            "prazo_base_dias": prazo_dias,
            "prorrogacoes_dias": prorrogacoes_dias,
            "prazo_total_dias": prazo_total_dias,
            "data_limite": None,
            "dias_restantes": None,
            "status_prazo": "Data de recebimento inválida",
            "vencido": False
        }

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
        },
        {
            "nome": "Processo sem data de recebimento",
            "tipo_detalhe": "IPM",
            "documento_iniciador": "Portaria",
            "data_recebimento": None,
            "prorrogacoes": 0
        }
    ]
    
    for i, cenario in enumerate(cenarios, 1):
        print(f"\n📋 CENÁRIO {i}: {cenario['nome']}")
        print(f"   Tipo: {cenario['tipo_detalhe']}")
        print(f"   Documento: {cenario['documento_iniciador']}")
        print(f"   Data Recebimento: {cenario['data_recebimento']}")
        print(f"   Prorrogações: {cenario['prorrogacoes']} dias")
        
        resultado = calcular_prazo_processo_teste(
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

def testar_regras_especificas():
    """Testa regras específicas de prazo"""
    print("\n🔍 TESTANDO REGRAS ESPECÍFICAS")
    print("=" * 50)
    
    hoje = datetime.now()
    data_teste = (hoje - timedelta(days=20)).strftime("%Y-%m-%d")
    
    regras = [
        ("SR", "Portaria", 30),
        ("PADS", "Memorando Disciplinar", 30),
        ("IPM", "Portaria", 40),
        ("Averiguação", "Feito Preliminar", 15),
        ("Sindicância Investigativa SR", "Portaria", 30),  # Teste com SR no nome
        ("Processo Administrativo PADS", "Memorando Disciplinar", 30),  # Teste com PADS no nome
        ("Inquérito IPM", "Portaria", 40),  # Teste com IPM no nome
    ]
    
    for tipo, documento, prazo_esperado in regras:
        resultado = calcular_prazo_processo_teste(tipo, documento, data_teste)
        prazo_obtido = resultado['prazo_base_dias']
        
        status = "✅ CORRETO" if prazo_obtido == prazo_esperado else "❌ ERRO"
        print(f"   {tipo} + {documento}: {prazo_obtido} dias (esperado: {prazo_esperado}) {status}")

if __name__ == "__main__":
    print("🚀 INICIANDO TESTES DO SISTEMA DE PRAZOS")
    print("Data/Hora:", datetime.now().strftime("%d/%m/%Y %H:%M:%S"))
    print("=" * 60)
    
    # Executar todos os testes
    testar_calculo_prazos()
    testar_regras_especificas()
    
    print("\n" + "=" * 60)
    print("✅ TESTES CONCLUÍDOS!")
    print("\n📋 RESUMO DAS REGRAS IMPLEMENTADAS:")
    print("   • SR: 30 dias")
    print("   • PADS: 30 dias")
    print("   • IPM: 40 dias")
    print("   • Feito Preliminar: 15 dias")
    print("   • Contagem a partir da data de recebimento")
    print("   • Suporte a prorrogações manuais")
    print("   • Status automático: vencido, urgente, atenção, em dia")
    print("\n💡 Para testar na aplicação:")
    print("   1. Execute: python main.py")
    print("   2. Acesse a interface web")
    print("   3. Cadastre um processo com data de recebimento")
    print("   4. Observe o cálculo automático de prazo")
