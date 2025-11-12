"""
Serviço de gerenciamento de prazos e andamentos de processos/procedimentos.

Este módulo contém funções para:
- Obter prazos vencendo e vencidos
- Gerar dashboards e relatórios de prazos
- Adicionar, listar e remover andamentos
- Obter tipos de prazo e andamento
- Calcular prazos de processos
"""

import json
import uuid
import traceback
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import psycopg2.extras


def obter_prazos_vencendo(db_manager, prazos_manager, dias_antecedencia: int = 7) -> Dict[str, Any]:
    """
    Obtém prazos que estão vencendo nos próximos dias.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        prazos_manager: Instância do gerenciador de prazos e andamentos
        dias_antecedencia: Número de dias de antecedência para considerar (padrão: 7)

    Returns:
        Dict contendo sucesso e lista de prazos vencendo ou mensagem de erro
    """
    try:
        prazos = prazos_manager.obter_prazos_vencendo(dias_antecedencia)
        return {"sucesso": True, "prazos": prazos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter prazos vencendo: {str(e)}"}


def obter_prazos_vencidos(db_manager, prazos_manager) -> Dict[str, Any]:
    """
    Obtém prazos que já venceram.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        prazos_manager: Instância do gerenciador de prazos e andamentos

    Returns:
        Dict contendo sucesso e lista de prazos vencidos ou mensagem de erro
    """
    try:
        prazos = prazos_manager.obter_prazos_vencidos()
        return {"sucesso": True, "prazos": prazos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter prazos vencidos: {str(e)}"}


def obter_dashboard_prazos(db_manager, prazos_manager) -> Dict[str, Any]:
    """
    Obtém dados para dashboard de prazos.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        prazos_manager: Instância do gerenciador de prazos e andamentos

    Returns:
        Dict contendo sucesso e dados do dashboard ou mensagem de erro
    """
    try:
        dashboard = prazos_manager.obter_dashboard_prazos()
        return {"sucesso": True, "dashboard": dashboard}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter dashboard: {str(e)}"}


def gerar_relatorio_prazos(db_manager, prazos_manager, filtros: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Gera relatório de prazos com filtros opcionais.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        prazos_manager: Instância do gerenciador de prazos e andamentos
        filtros: Filtros opcionais para o relatório

    Returns:
        Dict contendo sucesso e relatório de prazos ou mensagem de erro
    """
    try:
        relatorio = prazos_manager.gerar_relatorio_prazos(filtros)
        return {"sucesso": True, "relatorio": relatorio}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao gerar relatório de prazos: {str(e)}"}


def adicionar_andamento(db_manager, processo_id: str, texto: str, usuario_nome: Optional[str] = None) -> Dict[str, Any]:
    """
    Adiciona um novo andamento (progresso) ao processo/procedimento.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        processo_id: ID do processo/procedimento
        texto: Texto do andamento
        usuario_nome: Nome do usuário responsável (opcional, padrão: "Sistema")

    Returns:
        Dict contendo sucesso, mensagem e dados do andamento criado ou mensagem de erro
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar andamentos atuais
        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = %s AND ativo = TRUE
        """, (processo_id,))

        result = cursor.fetchone()
        if not result:
            conn.close()
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado"}

        # Parse andamentos existentes ou criar lista vazia
        raw_andamentos = result['andamentos'] if result['andamentos'] else []
        if isinstance(raw_andamentos, list):
            andamentos = raw_andamentos
        elif isinstance(raw_andamentos, str) and raw_andamentos.strip():
            try:
                andamentos = json.loads(raw_andamentos)
            except Exception:
                andamentos = []
        else:
            andamentos = []

        # Criar novo andamento
        novo_andamento = {
            "id": str(uuid.uuid4()),
            "texto": texto,
            "data": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "usuario": usuario_nome or "Sistema"
        }

        # Adicionar ao início da lista (mais recente primeiro)
        andamentos.insert(0, novo_andamento)

        # Salvar de volta no banco
        cursor.execute("""
            UPDATE processos_procedimentos
            SET andamentos = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (json.dumps(andamentos), processo_id))

        conn.commit()
        conn.close()

        return {
            "sucesso": True,
            "mensagem": "Andamento adicionado com sucesso",
            "andamento": novo_andamento
        }

    except Exception as e:
        print(f"Erro ao adicionar andamento: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao adicionar andamento: {str(e)}"}


def listar_andamentos(db_manager, processo_id: str) -> Dict[str, Any]:
    """
    Lista todos os andamentos de um processo/procedimento.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        processo_id: ID do processo/procedimento

    Returns:
        Dict contendo sucesso e lista de andamentos ou mensagem de erro
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = %s AND ativo = TRUE
        """, (processo_id,))

        result = cursor.fetchone()
        conn.close()

        if not result:
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado"}

        # Parse andamentos
        raw_andamentos = result['andamentos'] if result['andamentos'] else []
        print(f"DEBUG listar_andamentos: andamentos_json type={type(raw_andamentos)}, value={raw_andamentos}")
        if isinstance(raw_andamentos, list):
            andamentos = raw_andamentos
        elif isinstance(raw_andamentos, str) and raw_andamentos.strip():
            try:
                andamentos = json.loads(raw_andamentos)
            except Exception as parse_error:
                print(f"Erro ao fazer parse de andamentos: {parse_error}")
                andamentos = []
        else:
            andamentos = []

        return {
            "sucesso": True,
            "andamentos": andamentos
        }

    except Exception as e:
        print(f"Erro ao listar andamentos: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return {"sucesso": False, "mensagem": f"Erro ao listar andamentos: {str(e)}"}


def remover_andamento(db_manager, processo_id: str, andamento_id: str) -> Dict[str, Any]:
    """
    Remove um andamento específico do processo/procedimento.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        processo_id: ID do processo/procedimento
        andamento_id: ID do andamento a ser removido

    Returns:
        Dict contendo sucesso e mensagem ou mensagem de erro
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar andamentos atuais
        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = %s AND ativo = TRUE
        """, (processo_id,))

        result = cursor.fetchone()
        if not result:
            conn.close()
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado"}

        # Parse andamentos existentes
        raw_andamentos = result['andamentos'] if result['andamentos'] else []
        if isinstance(raw_andamentos, list):
            andamentos = raw_andamentos
        elif isinstance(raw_andamentos, str) and raw_andamentos.strip():
            try:
                andamentos = json.loads(raw_andamentos)
            except Exception:
                andamentos = []
        else:
            andamentos = []

        # Remover andamento específico
        andamentos = [a for a in andamentos if a.get('id') != andamento_id]

        # Salvar de volta no banco
        cursor.execute("""
            UPDATE processos_procedimentos
            SET andamentos = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (json.dumps(andamentos), processo_id))

        conn.commit()
        conn.close()

        return {
            "sucesso": True,
            "mensagem": "Andamento removido com sucesso"
        }

    except Exception as e:
        print(f"Erro ao remover andamento: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao remover andamento: {str(e)}"}


def obter_dashboard_prazos_simples(db_manager, listar_todos_processos_com_prazos_func) -> Dict[str, Any]:
    """
    Obtém estatísticas simples de prazos para dashboard.

    Args:
        db_manager: Instância do gerenciador de banco de dados
        listar_todos_processos_com_prazos_func: Função para listar todos os processos com prazos

    Returns:
        Dict contendo sucesso e estatísticas do dashboard ou mensagem de erro
    """
    try:
        # Buscar todos os processos ativos
        resultado = listar_todos_processos_com_prazos_func()

        if not resultado["sucesso"]:
            return resultado

        processos = resultado["processos"]

        # Calcular estatísticas
        total_processos = len(processos)
        vencidos = 0
        vencendo_5_dias = 0
        vencendo_10_dias = 0
        em_dia = 0
        sem_data_recebimento = 0

        for processo in processos:
            prazo = processo["prazo"]

            if not processo["data_recebimento"]:
                sem_data_recebimento += 1
            elif prazo["vencido"]:
                vencidos += 1
            elif prazo["dias_restantes"] is not None:
                if prazo["dias_restantes"] <= 5:
                    vencendo_5_dias += 1
                elif prazo["dias_restantes"] <= 10:
                    vencendo_10_dias += 1
                else:
                    em_dia += 1

        return {
            "sucesso": True,
            "dashboard": {
                "total_processos": total_processos,
                "vencidos": vencidos,
                "vencendo_5_dias": vencendo_5_dias,
                "vencendo_10_dias": vencendo_10_dias,
                "em_dia": em_dia,
                "sem_data_recebimento": sem_data_recebimento
            }
        }

    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter dashboard: {str(e)}"}


def obter_tipos_prazo() -> Dict[str, Any]:
    """
    Retorna lista de tipos de prazo disponíveis.

    Returns:
        Dict contendo sucesso e lista de tipos de prazo
    """
    tipos = [
        "Conclusão de IPM",
        "Relatório Final",
        "Manifestação da Defesa",
        "Decisão da Autoridade",
        "Cumprimento de Diligência",
        "Prazo Processual",
        "Audiência",
        "Perícia",
        "Outros"
    ]
    return {"sucesso": True, "tipos": tipos}


def obter_tipos_andamento() -> Dict[str, Any]:
    """
    Retorna lista de tipos de andamento disponíveis.

    Returns:
        Dict contendo sucesso e lista de tipos de andamento
    """
    tipos = [
        "Instauração",
        "Distribuição",
        "Citação",
        "Interrogatório",
        "Oitiva de Testemunha",
        "Juntada de Documento",
        "Diligência",
        "Perícia",
        "Manifestação da Defesa",
        "Relatório",
        "Decisão",
        "Recurso",
        "Cumprimento",
        "Arquivamento",
        "Outros"
    ]
    return {"sucesso": True, "tipos": tipos}


def calcular_prazo_processo(tipo_detalhe: str, documento_iniciador: str,
                            data_recebimento: str, prorrogacoes_dias: int = 0) -> Dict[str, Any]:
    """
    Calcula o prazo de conclusão de um processo/procedimento baseado nas regras definidas.

    Args:
        tipo_detalhe: Tipo específico do processo (SR, PADS, IPM, etc.)
        documento_iniciador: Tipo do documento iniciador
        data_recebimento: Data de recebimento no formato YYYY-MM-DD
        prorrogacoes_dias: Dias de prorrogação adicionais (padrão: 0)

    Returns:
        Dict contendo informações sobre o prazo calculado:
        - prazo_base_dias: Prazo base em dias
        - prorrogacoes_dias: Dias de prorrogação
        - prazo_total_dias: Prazo total (base + prorrogações)
        - data_limite: Data limite no formato YYYY-MM-DD
        - data_limite_formatada: Data limite no formato DD/MM/YYYY
        - dias_restantes: Dias restantes até o vencimento
        - status_prazo: Status descritivo do prazo
        - vencido: Booleano indicando se o prazo venceu
    """
    # Definir prazos base conforme regras
    prazos_base = {
        # Procedimentos com 15 dias
        'SV': 15,
        # Procedimentos com 30 dias (mantidos)
        'SR': 30,
        'IPM': 40,  # Mantido conforme regra específica
        'FP': 30,
        'CP': 30,
        # Processos com 30 dias
        'PAD': 30,
        'PADE': 30,
        'CD': 30,
        'CJ': 30,
        'PADS': 30,
        # Baseado no documento iniciador
        'Feito Preliminar': 15
    }

    # Determinar prazo base
    prazo_dias = 30  # Padrão

    # Primeiro verificar documento iniciador
    if documento_iniciador == 'Feito Preliminar':
        prazo_dias = prazos_base['Feito Preliminar']
    # Depois verificar tipo específico
    elif tipo_detalhe in prazos_base:
        prazo_dias = prazos_base[tipo_detalhe]
    # Se não encontrar, manter padrão de 30 dias

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
