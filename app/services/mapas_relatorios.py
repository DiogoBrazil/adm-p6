"""
Serviços para geração de mapas mensais e relatórios anuais.

Este módulo contém funcionalidades para:
- Gerar mapas mensais por tipo de processo/procedimento
- Gerar mapas mensais completos (todos os tipos)
- Salvar, listar e excluir mapas gerados
- Gerar relatórios anuais em PDF com estatísticas
"""

import psycopg2
import psycopg2.extras
import json
import uuid
import base64
from datetime import datetime
from io import BytesIO
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT


# ============================================================================
# FUNÇÕES PRINCIPAIS - MAPAS MENSAIS
# ============================================================================

def gerar_mapa_mensal(db_manager, mes, ano, tipo_processo):
    """
    Gera mapa mensal para um tipo específico de processo/procedimento.

    Args:
        db_manager: Gerenciador de conexão com banco de dados
        mes (int): Mês do mapa (1-12)
        ano (int): Ano do mapa
        tipo_processo (str): Tipo de processo/procedimento (IPM, PAD, Sindicância, etc.)

    Returns:
        dict: {
            "sucesso": bool,
            "dados": list - Lista de processos do mapa,
            "meta": dict - Metadados do mapa (totais, período, etc.),
            "mensagem": str - Mensagem de erro (se sucesso=False)
        }

    Regras:
        - Processos EM ANDAMENTO: instaurados até o mês selecionado (inclusive)
        - Processos CONCLUÍDOS: concluídos especificamente no mês selecionado
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Validar parâmetros
        if not mes or not ano or not tipo_processo:
            return {"sucesso": False, "mensagem": "Parâmetros inválidos"}

        # Converter para inteiros
        mes = int(mes)
        ano = int(ano)

        # Definir data de início e fim do mês
        data_inicio = f"{ano}-{mes:02d}-01"
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{mes + 1:02d}-01"

        # Query base para buscar processos/procedimentos do mês
        query_base = """
            SELECT
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador,
                p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf,
                p.data_instauracao, p.data_conclusao, p.data_remessa_encarregado, p.data_julgamento,
                p.resumo_fatos, p.nome_vitima, p.concluido, p.solucao_final, p.solucao_tipo,
                p.penalidade_tipo, p.penalidade_dias,
                -- Dados do responsável/encarregado
                COALESCE(u_resp.nome, 'Não informado') as responsavel_nome,
                COALESCE(u_resp.posto_graduacao, '') as responsavel_posto,
                COALESCE(u_resp.matricula, '') as responsavel_matricula,
                -- Status e ano
                CASE
                    WHEN p.concluido = TRUE THEN 'Concluído'
                    ELSE 'Em andamento'
                END as status_processo,
                p.ano_instauracao,
                -- Dados de PAD/CD/CJ
                p.presidente_id, p.interrogante_id, p.escrivao_processo_id,
                COALESCE(u_pres.nome, '') as presidente_nome,
                COALESCE(u_pres.posto_graduacao, '') as presidente_posto,
                COALESCE(u_pres.matricula, '') as presidente_matricula,
                COALESCE(u_inter.nome, '') as interrogante_nome,
                COALESCE(u_inter.posto_graduacao, '') as interrogante_posto,
                COALESCE(u_inter.matricula, '') as interrogante_matricula,
                COALESCE(u_esc_proc.nome, '') as escrivao_processo_nome,
                COALESCE(u_esc_proc.posto_graduacao, '') as escrivao_processo_posto,
                COALESCE(u_esc_proc.matricula, '') as escrivao_processo_matricula,
                -- Dados de CP (Carta Precatória)
                p.unidade_deprecada,
                p.deprecante
            FROM processos_procedimentos p
            LEFT JOIN usuarios u_resp ON p.responsavel_id = u_resp.id
            LEFT JOIN usuarios u_pres ON p.presidente_id = u_pres.id
            LEFT JOIN usuarios u_inter ON p.interrogante_id = u_inter.id
            LEFT JOIN usuarios u_esc_proc ON p.escrivao_processo_id = u_esc_proc.id
            WHERE p.ativo = TRUE
            AND p.tipo_detalhe = %s
            AND (
                -- Processos EM ANDAMENTO: instaurados até o mês selecionado
                (p.concluido = FALSE AND p.data_instauracao < %s) OR
                -- Processos CONCLUÍDOS: concluídos especificamente no mês selecionado
                (p.concluido = TRUE AND p.data_conclusao >= %s AND p.data_conclusao < %s)
            )
            ORDER BY p.data_instauracao DESC, p.created_at DESC
        """

        cursor.execute(query_base, (
            tipo_processo,
            data_fim,     # Para processos em andamento: instaurados até o fim do mês selecionado
            data_inicio,  # Para processos concluídos: início do mês selecionado
            data_fim      # Para processos concluídos: fim do mês selecionado
        ))

        processos = cursor.fetchall()
        print(f"📊 Mapa Mensal {tipo_processo} - {mes}/{ano}: {len(processos)} processos encontrados")

        dados_mapa = []

        for processo in processos:
            processo_id = processo['id']

            # Log para debug
            print(f"  - Processo #{processo['numero']}: ano_instauracao={processo['ano_instauracao']}, "
                  f"data_instauracao={processo['data_instauracao']}, concluido={processo['concluido']}, "
                  f"solucao_tipo={processo['solucao_tipo']}")

            # Obter dados de PMs envolvidos
            pms_envolvidos = _obter_pms_envolvidos_para_mapa(cursor, processo_id, processo['tipo_geral'])

            # Obter indícios (crimes/transgressões)
            indicios = _obter_indicios_para_mapa(cursor, processo_id)

            # Obter última movimentação se em andamento
            ultima_movimentacao = None
            if not processo['concluido']:
                ultima_movimentacao = _obter_ultima_movimentacao(cursor, processo_id)

            # Converter datas para string ISO (PostgreSQL retorna objetos date)
            data_instauracao_str = processo['data_instauracao'].isoformat() if processo['data_instauracao'] else None
            data_conclusao_str = processo['data_conclusao'].isoformat() if processo['data_conclusao'] else None
            data_remessa_str = processo['data_remessa_encarregado'].isoformat() if processo['data_remessa_encarregado'] else None
            data_julgamento_str = processo['data_julgamento'].isoformat() if processo['data_julgamento'] else None

            # Montar dados do processo para o mapa
            dados_processo = {
                "id": processo['id'],
                "numero": processo['numero'],
                "ano": processo['ano_instauracao'] or (data_instauracao_str.split('-')[0] if data_instauracao_str else ''),
                "numero_portaria": processo['numero_portaria'],
                "numero_memorando": processo['numero_memorando'],
                "numero_feito": processo['numero_feito'],
                "numero_rgf": processo['numero_rgf'],
                "data_instauracao": data_instauracao_str,
                "data_conclusao": data_conclusao_str,
                "resumo_fatos": processo['resumo_fatos'],
                "nome_vitima": processo['nome_vitima'],
                "status": processo['status_processo'],
                "concluido": bool(processo['concluido']),
                "responsavel": {
                    "nome": processo['responsavel_nome'],
                    "posto": processo['responsavel_posto'],
                    "matricula": processo['responsavel_matricula'],
                    "completo": f"{processo['responsavel_posto']} {processo['responsavel_matricula']} {processo['responsavel_nome']}".strip()
                },
                "pms_envolvidos": pms_envolvidos,
                "indicios": indicios,
                "solucao": {
                    "data_remessa": data_remessa_str,
                    "data_julgamento": data_julgamento_str,
                    "solucao_final": processo['solucao_final'],
                    "solucao_tipo": processo['solucao_tipo'],
                    "penalidade_tipo": processo['penalidade_tipo'],
                    "penalidade_dias": processo['penalidade_dias']
                },
                "ultima_movimentacao": ultima_movimentacao
            }

            # Adicionar dados de presidente, interrogante e escrivão para PAD/CD/CJ
            if processo['tipo_detalhe'] in ['PAD', 'CD', 'CJ']:
                dados_processo["presidente_processo"] = {
                    "nome": processo['presidente_nome'],
                    "posto": processo['presidente_posto'],
                    "matricula": processo['presidente_matricula'],
                    "completo": f"{processo['presidente_posto']} {processo['presidente_matricula']} {processo['presidente_nome']}".strip() if processo['presidente_nome'] else ""
                } if processo['presidente_id'] else None

                dados_processo["interrogante_processo"] = {
                    "nome": processo['interrogante_nome'],
                    "posto": processo['interrogante_posto'],
                    "matricula": processo['interrogante_matricula'],
                    "completo": f"{processo['interrogante_posto']} {processo['interrogante_matricula']} {processo['interrogante_nome']}".strip() if processo['interrogante_nome'] else ""
                } if processo['interrogante_id'] else None

                dados_processo["escrivao_processo"] = {
                    "nome": processo['escrivao_processo_nome'],
                    "posto": processo['escrivao_processo_posto'],
                    "matricula": processo['escrivao_processo_matricula'],
                    "completo": f"{processo['escrivao_processo_posto']} {processo['escrivao_processo_matricula']} {processo['escrivao_processo_nome']}".strip() if processo['escrivao_processo_nome'] else ""
                } if processo['escrivao_processo_id'] else None

            # Adicionar dados de CP (Carta Precatória)
            if processo['tipo_detalhe'] == 'CP':
                dados_processo["unidade_deprecada"] = processo['unidade_deprecada']
                dados_processo["deprecante"] = processo['deprecante']

            dados_mapa.append(dados_processo)

        conn.close()

        # Informações do relatório
        mes_nome = [
            "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ][mes]

        return {
            "sucesso": True,
            "dados": dados_mapa,
            "meta": {
                "mes": mes,
                "ano": ano,
                "mes_nome": mes_nome,
                "tipo_processo": tipo_processo,
                "total_processos": len(dados_mapa),
                "total_concluidos": len([p for p in dados_mapa if p["concluido"]]),
                "total_andamento": len([p for p in dados_mapa if not p["concluido"]]),
                "data_geracao": datetime.now().strftime("%d/%m/%Y às %H:%M")
            }
        }

    except Exception as e:
        print(f"❌ Erro ao gerar mapa mensal: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao gerar mapa: {str(e)}"}


def gerar_mapa_completo(db_manager, mes, ano):
    """
    Gera mapa mensal completo com todos os tipos de processo/procedimento.

    Args:
        db_manager: Gerenciador de conexão com banco de dados
        mes (int): Mês do mapa (1-12)
        ano (int): Ano do mapa

    Returns:
        dict: {
            "sucesso": bool,
            "dados": dict - Dicionário com dados por tipo de processo,
            "meta": dict - Metadados do mapa completo,
            "mensagem": str - Mensagem de erro (se sucesso=False)
        }
    """
    try:
        # Converter mes e ano para inteiros
        mes = int(mes)
        ano = int(ano)

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Obter todos os tipos de processo distintos que existem no banco
        cursor.execute("""
            SELECT DISTINCT tipo_detalhe
            FROM processos_procedimentos
            WHERE ativo = TRUE
            ORDER BY tipo_detalhe
        """)
        tipos = cursor.fetchall()

        conn.close()

        # Gerar mapa para cada tipo
        dados_completos = {}
        total_geral = 0
        total_concluidos_geral = 0
        total_andamento_geral = 0

        ultimo_resultado = None
        for tipo in tipos:
            try:
                tipo_detalhe = tipo['tipo_detalhe']
                resultado = gerar_mapa_mensal(db_manager, mes, ano, tipo_detalhe)
                ultimo_resultado = resultado

                if resultado['sucesso'] and len(resultado['dados']) > 0:
                    dados_completos[tipo_detalhe] = {
                        'nome_completo': tipo_detalhe,  # Usar o próprio tipo como nome
                        'dados': resultado['dados'],
                        'meta': resultado['meta']
                    }
                    total_geral += resultado['meta']['total_processos']
                    total_concluidos_geral += resultado['meta']['total_concluidos']
                    total_andamento_geral += resultado['meta']['total_andamento']
            except Exception as e_tipo:
                print(f"❌ Erro ao processar tipo {tipo_detalhe}: {e_tipo}")
                import traceback
                traceback.print_exc()
                raise

        # Nome do mês
        mes_nome = [
            "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ][mes]

        # Se não houver dados em nenhum tipo
        if not dados_completos:
            return {
                "sucesso": True,
                "dados": {},
                "meta": {
                    "mes": mes,
                    "ano": ano,
                    "mes_nome": mes_nome,
                    "tipo_processo": "COMPLETO",
                    "total_processos": 0,
                    "total_concluidos": 0,
                    "total_andamento": 0,
                    "data_geracao": datetime.now().strftime("%d/%m/%Y às %H:%M")
                }
            }

        return {
            "sucesso": True,
            "dados": dados_completos,
            "meta": {
                "mes": mes,
                "ano": ano,
                "mes_nome": mes_nome,
                "tipo_processo": "COMPLETO",
                "total_processos": total_geral,
                "total_concluidos": total_concluidos_geral,
                "total_andamento": total_andamento_geral,
                "data_geracao": datetime.now().strftime("%d/%m/%Y às %H:%M"),
                "tipos_incluidos": list(dados_completos.keys())
            }
        }

    except Exception as e:
        print(f"❌ Erro ao gerar mapa completo: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao gerar mapa completo: {str(e)}"}


def salvar_mapa_mensal(db_manager, dados_mapa, usuario_logado=None):
    """
    Salva um mapa mensal gerado para acesso posterior.

    Args:
        db_manager: Gerenciador de conexão com banco de dados
        dados_mapa (dict): Dados do mapa a serem salvos
        usuario_logado (dict): Dados do usuário logado (id, nome)

    Returns:
        dict: {
            "sucesso": bool,
            "mensagem": str,
            "mapa_id": str - ID do mapa salvo (se sucesso=True)
        }
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Obter informações do usuário logado
        if not usuario_logado or not usuario_logado.get("id"):
            return {"sucesso": False, "mensagem": "Usuário não informado"}

        usuario_id = usuario_logado.get("id")
        usuario_nome = usuario_logado.get("nome", "Desconhecido")

        # Gerar ID único para o mapa
        mapa_id = str(uuid.uuid4())

        # Extrair informações dos dados do mapa
        meta = dados_mapa.get("meta", {})

        # Determinar período
        if "mes" in meta and "ano" in meta:
            # Formato antigo (mês/ano)
            mes = int(meta["mes"])
            ano = int(meta["ano"])
            periodo_inicio = f"{ano}-{mes:02d}-01"
            if mes == 12:
                periodo_fim = f"{ano + 1}-01-01"
            else:
                periodo_fim = f"{ano}-{mes + 1:02d}-01"
            periodo_descricao = f"{meta.get('mes_nome', '')}/{ano}"
        else:
            # Formato novo (data início/fim)
            periodo_inicio = meta.get("data_inicio", "")
            periodo_fim = meta.get("data_fim", "")
            periodo_descricao = meta.get("periodo_descricao", "")

        # Gerar título do mapa
        titulo = f"Mapa {meta.get('tipo_processo', '')} - {periodo_descricao}"

        # Preparar dados para inserção
        dados_json = json.dumps(dados_mapa, ensure_ascii=False)
        nome_arquivo = f"Mapa_{meta.get('tipo_processo', '')}_{periodo_descricao.replace('/', '_').replace(' ', '_')}.pdf"

        # Inserir no banco
        cursor.execute("""
            INSERT INTO mapas_salvos (
                id, titulo, tipo_processo, periodo_inicio, periodo_fim,
                periodo_descricao, total_processos, total_concluidos,
                total_andamento, usuario_id, usuario_nome, dados_mapa, nome_arquivo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            mapa_id, titulo, meta.get("tipo_processo", ""), periodo_inicio, periodo_fim,
            periodo_descricao, meta.get("total_processos", 0), meta.get("total_concluidos", 0),
            meta.get("total_andamento", 0), usuario_id, usuario_nome, dados_json, nome_arquivo
        ))

        conn.commit()
        conn.close()

        return {
            "sucesso": True,
            "mensagem": "Mapa salvo com sucesso",
            "mapa_id": mapa_id
        }

    except Exception as e:
        print(f"❌ Erro ao salvar mapa: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao salvar mapa: {str(e)}"}


def listar_mapas_anteriores(db_manager):
    """
    Lista todos os mapas salvos anteriormente.

    Args:
        db_manager: Gerenciador de conexão com banco de dados

    Returns:
        dict: {
            "sucesso": bool,
            "mapas": list - Lista de mapas salvos,
            "mensagem": str - Mensagem de erro (se sucesso=False)
        }
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT
                id, titulo, tipo_processo, periodo_descricao,
                total_processos, total_concluidos, total_andamento,
                usuario_nome, data_geracao, nome_arquivo
            FROM mapas_salvos
            WHERE ativo = TRUE
            ORDER BY data_geracao DESC
        """)

        mapas = cursor.fetchall()
        conn.close()

        # Formatar dados para o frontend
        mapas_formatados = []
        for mapa in mapas:
            mapas_formatados.append({
                "id": mapa['id'],
                "titulo": mapa['titulo'],
                "tipo_processo": mapa['tipo_processo'],
                "periodo_descricao": mapa['periodo_descricao'],
                "total_processos": mapa['total_processos'],
                "total_concluidos": mapa['total_concluidos'],
                "total_andamento": mapa['total_andamento'],
                "usuario_nome": mapa['usuario_nome'],
                "data_geracao": mapa['data_geracao'].isoformat() if mapa['data_geracao'] else None,
                "nome_arquivo": mapa['nome_arquivo']
            })

        return {"sucesso": True, "mapas": mapas_formatados}

    except Exception as e:
        print(f"❌ Erro ao listar mapas anteriores: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao listar mapas: {str(e)}"}


def obter_dados_mapa_salvo(db_manager, mapa_id):
    """
    Obtém os dados completos de um mapa salvo para regenerar o PDF.

    Args:
        db_manager: Gerenciador de conexão com banco de dados
        mapa_id (str): ID do mapa salvo

    Returns:
        dict: {
            "sucesso": bool,
            "dados_mapa": dict - Dados completos do mapa,
            "titulo": str,
            "nome_arquivo": str,
            "mensagem": str - Mensagem de erro (se sucesso=False)
        }
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT dados_mapa, titulo, nome_arquivo
            FROM mapas_salvos
            WHERE id = %s AND ativo = TRUE
        """, (mapa_id,))

        resultado = cursor.fetchone()
        conn.close()

        if not resultado:
            return {"sucesso": False, "mensagem": "Mapa não encontrado"}

        # Dados podem vir como JSONB (dict) diretamente
        dados_mapa = resultado['dados_mapa']
        if isinstance(dados_mapa, str) and dados_mapa.strip():
            try:
                dados_mapa = json.loads(dados_mapa)
            except Exception:
                dados_mapa = {}

        return {
            "sucesso": True,
            "dados_mapa": dados_mapa,
            "titulo": resultado['titulo'],
            "nome_arquivo": resultado['nome_arquivo']
        }

    except Exception as e:
        print(f"❌ Erro ao obter dados do mapa: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao obter dados: {str(e)}"}


def excluir_mapa_salvo(db_manager, mapa_id, usuario_logado=None):
    """
    Exclui um mapa salvo (soft delete).

    Args:
        db_manager: Gerenciador de conexão com banco de dados
        mapa_id (str): ID do mapa a ser excluído
        usuario_logado (dict): Dados do usuário logado (opcional, para auditoria)

    Returns:
        dict: {
            "sucesso": bool,
            "mensagem": str
        }
    """
    try:
        print(f"🗑️ Excluindo mapa ID: {mapa_id}")

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verificar se o mapa existe
        cursor.execute("""
            SELECT id, titulo FROM mapas_salvos
            WHERE id = %s AND ativo = TRUE
        """, (mapa_id,))

        mapa = cursor.fetchone()
        if not mapa:
            conn.close()
            return {"sucesso": False, "mensagem": "Mapa não encontrado"}

        # Fazer soft delete (marcar como inativo)
        cursor.execute("""
            UPDATE mapas_salvos
            SET ativo = FALSE
            WHERE id = %s
        """, (mapa_id,))

        conn.commit()
        conn.close()

        print(f"✅ Mapa excluído com sucesso: {mapa['titulo']}")
        return {"sucesso": True, "mensagem": "Mapa excluído com sucesso"}

    except Exception as e:
        print(f"❌ Erro ao excluir mapa: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao excluir mapa: {str(e)}"}


# ============================================================================
# FUNÇÕES PRINCIPAIS - RELATÓRIOS ANUAIS
# ============================================================================

def obter_anos_relatorio_anual(db_manager):
    """
    Obtém lista de anos que possuem processos/procedimentos instaurados.

    Args:
        db_manager: Gerenciador de conexão com banco de dados

    Returns:
        dict: {
            "sucesso": bool,
            "anos": list - Lista de anos disponíveis,
            "erro": str - Mensagem de erro (se sucesso=False)
        }
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT DISTINCT TO_CHAR(data_instauracao, 'YYYY') as ano
            FROM processos_procedimentos
            WHERE data_instauracao IS NOT NULL
            AND ativo = TRUE
            ORDER BY ano DESC
        """)

        anos = [row['ano'] for row in cursor.fetchall() if row['ano']]

        return {
            "sucesso": True,
            "anos": anos
        }

    except Exception as e:
        print(f"❌ Erro ao obter anos: {e}")
        return {"sucesso": False, "erro": str(e)}


def gerar_relatorio_anual(db_manager, ano):
    """
    Gera relatório anual completo com estatísticas e gráficos em PDF.

    Args:
        db_manager: Gerenciador de conexão com banco de dados
        ano (int): Ano do relatório

    Returns:
        dict: {
            "sucesso": bool,
            "pdf_base64": str - PDF codificado em base64,
            "estatisticas": dict - Estatísticas do ano,
            "mensagem": str - Mensagem de erro (se sucesso=False)
        }
    """
    try:
        print(f"📊 Gerando relatório anual para {ano}...")

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # ============ ESTATÍSTICAS GERAIS ============

        # Total de processos (tipo_geral = 'processo')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_geral = 'processo'
            AND ativo = TRUE
        """, (str(ano),))
        total_processos = cursor.fetchone()['count']

        # Total de procedimentos (tipo_geral = 'procedimento')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_geral = 'procedimento'
            AND ativo = TRUE
        """, (str(ano),))
        total_procedimentos = cursor.fetchone()['count']

        total_geral = total_processos + total_procedimentos

        # ============ ESTATÍSTICAS POR TIPO ============

        # Processos por tipo_detalhe com status (apenas processos)
        cursor.execute("""
            SELECT
                tipo_detalhe,
                CASE
                    WHEN concluido = TRUE THEN 'Concluído'
                    ELSE 'Em Andamento'
                END as status,
                COUNT(*) as qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_geral = 'processo'
            AND ativo = TRUE
            GROUP BY tipo_detalhe, status
        """, (str(ano),))

        processos_por_tipo = {}
        for row in cursor.fetchall():
            tipo = row['tipo_detalhe']
            if tipo not in processos_por_tipo:
                processos_por_tipo[tipo] = {'total': 0, 'concluido': 0, 'andamento': 0}

            processos_por_tipo[tipo]['total'] += row['qtd']
            if row['status'] == 'Concluído':
                processos_por_tipo[tipo]['concluido'] = row['qtd']
            else:
                processos_por_tipo[tipo]['andamento'] = row['qtd']

        # Procedimentos por tipo_detalhe com status (apenas procedimentos)
        cursor.execute("""
            SELECT
                tipo_detalhe,
                CASE
                    WHEN concluido = TRUE THEN 'Concluído'
                    ELSE 'Em Andamento'
                END as status,
                COUNT(*) as qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_geral = 'procedimento'
            AND ativo = TRUE
            GROUP BY tipo_detalhe, status
        """, (str(ano),))

        procedimentos_por_tipo = {}
        for row in cursor.fetchall():
            tipo = row['tipo_detalhe']
            if tipo not in procedimentos_por_tipo:
                procedimentos_por_tipo[tipo] = {'total': 0, 'concluido': 0, 'andamento': 0}

            procedimentos_por_tipo[tipo]['total'] += row['qtd']
            if row['status'] == 'Concluído':
                procedimentos_por_tipo[tipo]['concluido'] = row['qtd']
            else:
                procedimentos_por_tipo[tipo]['andamento'] = row['qtd']

        # ============ ESTATÍSTICAS POR STATUS ============

        # Status dos processos (usando campo solucao_tipo ou concluido)
        cursor.execute("""
            SELECT
                CASE
                    WHEN concluido = TRUE THEN 'Concluído'
                    ELSE 'Em Andamento'
                END as status,
                COUNT(*) as qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_geral = 'processo'
            AND ativo = TRUE
            GROUP BY status
        """, (str(ano),))
        processos_status = {row['status']: row['qtd'] for row in cursor.fetchall()}

        # Status dos procedimentos
        cursor.execute("""
            SELECT
                CASE
                    WHEN concluido = TRUE THEN 'Concluído'
                    ELSE 'Em Andamento'
                END as status,
                COUNT(*) as qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_geral = 'procedimento'
            AND ativo = TRUE
            GROUP BY status
        """, (str(ano),))
        procedimentos_status = {row['status']: row['qtd'] for row in cursor.fetchall()}

        # ============ ESTATÍSTICAS ESPECÍFICAS - IPM/SINDICÂNCIA ============

        # Indícios (crime vs transgressão) - usando JSONB
        cursor.execute("""
            SELECT COUNT(*) AS qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
              AND tipo_detalhe IN ('IPM', 'Sindicância')
              AND concluido = TRUE
              AND ativo = TRUE
              AND indicios_categorias IS NOT NULL
              AND (
                -- Se for array JSONB, verifica elementos
                (jsonb_typeof(indicios_categorias) = 'array' AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(indicios_categorias) AS e(val)
                    WHERE lower(val) LIKE '%crime%'
                ))
                OR
                -- Se for string JSON (legado), trata como texto
                (jsonb_typeof(indicios_categorias) = 'string' AND lower(indicios_categorias::text) LIKE '%crime%')
              )
        """, (str(ano),))
        indicios_crime = cursor.fetchone()['qtd']

        # Contagem de registros com 'transgressao' ou 'rdpm'
        cursor.execute("""
            SELECT COUNT(*) AS qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
              AND tipo_detalhe IN ('IPM', 'Sindicância')
              AND concluido = TRUE
              AND ativo = TRUE
              AND indicios_categorias IS NOT NULL
              AND (
                (jsonb_typeof(indicios_categorias) = 'array' AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(indicios_categorias) AS e(val)
                    WHERE lower(val) LIKE '%transgressao%' OR lower(val) LIKE '%rdpm%'
                ))
                OR
                (jsonb_typeof(indicios_categorias) = 'string' AND (
                    lower(indicios_categorias::text) LIKE '%transgressao%' OR lower(indicios_categorias::text) LIKE '%rdpm%'
                ))
              )
        """, (str(ano),))
        indicios_transgressao = cursor.fetchone()['qtd']

        # ============ ESTATÍSTICAS ESPECÍFICAS - PAD/PADS ============

        # Punidos vs Absolvidos/Arquivados (usando campo solucao_tipo)
        cursor.execute("""
            SELECT
                solucao_tipo,
                COUNT(*) as qtd
            FROM processos_procedimentos
            WHERE TO_CHAR(data_instauracao, 'YYYY') = %s
            AND tipo_detalhe IN ('PAD', 'PADS')
            AND concluido = TRUE
            AND ativo = TRUE
            AND solucao_tipo IS NOT NULL
            GROUP BY solucao_tipo
        """, (str(ano),))

        punidos = 0
        absolvidos_arquivados = 0
        for row in cursor.fetchall():
            solucao = (row['solucao_tipo'] or '').lower()
            if 'punido' in solucao or 'punicao' in solucao:
                punidos += row['qtd']
            elif 'absolvido' in solucao or 'arquivado' in solucao or 'absolvicao' in solucao:
                absolvidos_arquivados += row['qtd']

        # ============ MONTAR ESTRUTURA DE DADOS ============

        estatisticas = {
            "ano": ano,
            "total_geral": total_geral,
            "total_processos": total_processos,
            "total_procedimentos": total_procedimentos,
            "processos_por_tipo": processos_por_tipo,
            "procedimentos_por_tipo": procedimentos_por_tipo,
            "processos_status": processos_status,
            "procedimentos_status": procedimentos_status,
            "ipm_sindicancia": {
                "indicios_crime": indicios_crime,
                "indicios_transgressao": indicios_transgressao
            },
            "pad_pads": {
                "punidos": punidos,
                "absolvidos_arquivados": absolvidos_arquivados
            }
        }

        conn.close()

        # ============ GERAR PDF ============
        pdf_base64 = _gerar_pdf_relatorio_anual(estatisticas)

        print(f"✅ Relatório anual gerado com sucesso!")

        return {
            "sucesso": True,
            "pdf_base64": pdf_base64,
            "estatisticas": estatisticas
        }

    except Exception as e:
        print(f"❌ Erro ao gerar relatório anual: {e}")
        import traceback
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao gerar relatório: {str(e)}"}


# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

def _gerar_pdf_relatorio_anual(estatisticas):
    """
    Gera o PDF do relatório anual usando ReportLab.

    Args:
        estatisticas (dict): Dicionário com estatísticas do ano

    Returns:
        str: PDF codificado em base64
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    elements = []
    styles = getSampleStyleSheet()

    # Estilos customizados
    titulo_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#0d6efd'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    subtitulo_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#2a5298'),
        spaceAfter=15,
        spaceBefore=20,
        fontName='Helvetica-Bold'
    )

    info_style = ParagraphStyle(
        'InfoStyle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.grey,
        alignment=TA_CENTER,
        spaceAfter=30
    )

    # ============ CABEÇALHO ============
    # Adicionar logo (aumentado em 20%)
    logo_path = 'web/static/images/pm_ro-removebg-preview.png'
    if os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=4.8*cm, height=4.8*cm, kind='proportional')
            logo.hAlign = 'CENTER'
            elements.append(logo)
            elements.append(Spacer(1, 0.5*cm))
        except Exception as e:
            print(f"⚠️ Não foi possível adicionar logo: {e}")

    ano = estatisticas['ano']
    data_geracao = datetime.now().strftime('%d/%m/%Y às %H:%M')

    elements.append(Paragraph(f"RELATÓRIO ANUAL DE PROCESSOS E PROCEDIMENTOS", titulo_style))
    elements.append(Paragraph(f"Ano: {ano}", subtitulo_style))
    elements.append(Paragraph(f"Gerado em: {data_geracao}", info_style))
    elements.append(Spacer(1, 0.5*cm))

    # ============ RESUMO GERAL ============
    elements.append(Paragraph("📊 RESUMO GERAL", subtitulo_style))

    dados_resumo = [
        ['Categoria', 'Quantidade'],
        ['Total Geral', str(estatisticas['total_geral'])],
        ['Processos', str(estatisticas['total_processos'])],
        ['Procedimentos', str(estatisticas['total_procedimentos'])]
    ]

    tabela_resumo = Table(dados_resumo, colWidths=[10*cm, 7*cm])
    tabela_resumo.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d6efd')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 11),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
    ]))

    elements.append(tabela_resumo)
    elements.append(Spacer(1, 0.8*cm))

    # ============ DISTRIBUIÇÃO POR TIPO ============
    if estatisticas['processos_por_tipo'] or estatisticas['procedimentos_por_tipo']:
        elements.append(Paragraph("📈 DISTRIBUIÇÃO POR TIPO", subtitulo_style))

        # Combinar todos os tipos com status
        dados_tipos = [['Tipo', 'Categoria', 'Em Andamento', 'Concluído', 'Quantidade Total']]

        for tipo, info in estatisticas['processos_por_tipo'].items():
            dados_tipos.append([
                tipo,
                'Processo',
                str(info['andamento']),
                str(info['concluido']),
                str(info['total'])
            ])

        for tipo, info in estatisticas['procedimentos_por_tipo'].items():
            dados_tipos.append([
                tipo,
                'Procedimento',
                str(info['andamento']),
                str(info['concluido']),
                str(info['total'])
            ])

        tabela_tipos = Table(dados_tipos, colWidths=[4*cm, 3.5*cm, 3*cm, 3*cm, 3.5*cm])
        tabela_tipos.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2a5298')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))

        elements.append(tabela_tipos)
        elements.append(Spacer(1, 0.8*cm))

    # ============ STATUS ============
    elements.append(Paragraph("📋 STATUS GERAL", subtitulo_style))

    # Combinar status
    dados_status = [['Status', 'Processos', 'Procedimentos', 'Total']]

    status_unicos = set(list(estatisticas['processos_status'].keys()) + list(estatisticas['procedimentos_status'].keys()))

    for status in status_unicos:
        status_label = status or 'Sem Status'
        qtd_processos = estatisticas['processos_status'].get(status, 0)
        qtd_procedimentos = estatisticas['procedimentos_status'].get(status, 0)
        total = qtd_processos + qtd_procedimentos
        dados_status.append([status_label, str(qtd_processos), str(qtd_procedimentos), str(total)])

    tabela_status = Table(dados_status, colWidths=[6*cm, 4*cm, 4*cm, 3*cm])
    tabela_status.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d6efd')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
    ]))

    elements.append(tabela_status)
    elements.append(Spacer(1, 0.8*cm))

    # ============ IPM/SINDICÂNCIA - INDÍCIOS ============
    if estatisticas['ipm_sindicancia']['indicios_crime'] > 0 or estatisticas['ipm_sindicancia']['indicios_transgressao'] > 0:
        elements.append(Paragraph("🔍 IPM/SINDICÂNCIA - ANÁLISE DE INDÍCIOS", subtitulo_style))

        dados_indicios = [
            ['Tipo de Indício', 'Quantidade'],
            ['Indícios de Crime', str(estatisticas['ipm_sindicancia']['indicios_crime'])],
            ['Indícios de Transgressão', str(estatisticas['ipm_sindicancia']['indicios_transgressao'])]
        ]

        tabela_indicios = Table(dados_indicios, colWidths=[10*cm, 7*cm])
        tabela_indicios.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6610f2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))

        elements.append(tabela_indicios)
        elements.append(Spacer(1, 0.8*cm))

    # Gerar PDF
    doc.build(elements)

    # Converter para base64
    pdf_bytes = buffer.getvalue()
    buffer.close()
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

    return pdf_base64


def _obter_pms_envolvidos_para_mapa(cursor, processo_id, tipo_geral):
    """
    Obtém lista de PMs envolvidos para o mapa mensal.

    Args:
        cursor: Cursor do banco de dados
        processo_id (str): ID do processo/procedimento
        tipo_geral (str): Tipo geral (processo/procedimento)

    Returns:
        list: Lista de PMs envolvidos com seus dados e indícios
    """
    pms = []

    try:
        if tipo_geral == "procedimento":
            # Para procedimentos, buscar múltiplos PMs com seus indícios específicos
            cursor.execute("""
                SELECT
                    u.nome, u.posto_graduacao, u.matricula,
                    pme.status_pm as tipo_envolvimento,
                    pme.id as pm_envolvido_id
                FROM procedimento_pms_envolvidos pme
                JOIN usuarios u ON pme.pm_id = u.id
                WHERE pme.procedimento_id = %s
                ORDER BY pme.ordem
            """, (processo_id,))

            for row in cursor.fetchall():
                pm_envolvido_id = row['pm_envolvido_id']

                # Buscar indícios específicos deste PM
                indicios_pm = _obter_indicios_por_pm(cursor, pm_envolvido_id)

                pms.append({
                    "nome": row['nome'],
                    "posto_graduacao": row['posto_graduacao'],
                    "matricula": row['matricula'],
                    "tipo_envolvimento": row['tipo_envolvimento'] or "Envolvido",
                    "completo": f"{row['posto_graduacao']} {row['matricula']} {row['nome']}".strip(),
                    "indicios": indicios_pm
                })
        else:
            # Para processos, buscar PM único e suas transgressões do campo JSON
            cursor.execute("""
                SELECT
                    p.status_pm,
                    u.nome, u.posto_graduacao, u.matricula,
                    p.transgressoes_ids
                FROM processos_procedimentos p
                LEFT JOIN usuarios u ON p.nome_pm_id = u.id
                WHERE p.id = %s AND u.id IS NOT NULL
            """, (processo_id,))

            row = cursor.fetchone()
            if row:
                # Buscar transgressões do campo JSON
                indicios_processo = {"categorias": [], "crimes": [], "transgressoes": [], "art29": []}

                if row['transgressoes_ids']:  # transgressoes_ids
                    try:
                        transgressoes_json = json.loads(row['transgressoes_ids'])

                        if isinstance(transgressoes_json, list):
                            for trans in transgressoes_json:
                                trans_id = trans.get('id')
                                trans_tipo = trans.get('tipo')

                                if trans_tipo == 'rdpm':
                                    # Buscar transgressão RDPM
                                    cursor.execute("""
                                        SELECT inciso, texto, gravidade
                                        FROM transgressoes
                                        WHERE id = %s
                                    """, (trans_id,))
                                    rdpm_row = cursor.fetchone()
                                    if rdpm_row:
                                        # Determinar artigo baseado na gravidade
                                        gravidade = rdpm_row['gravidade'].lower()
                                        artigo_map = {'leve': '15', 'media': '16', 'grave': '17'}
                                        artigo = artigo_map.get(gravidade, '15')

                                        indicios_processo["transgressoes"].append({
                                            "inciso": rdpm_row['inciso'],
                                            "texto": rdpm_row['texto'],
                                            "gravidade": rdpm_row['gravidade'],
                                            "artigo": artigo,
                                            "tipo": "rdpm",
                                            "texto_completo": f"Inciso {rdpm_row['inciso']}, do RDPM - {rdpm_row['texto']} (art. {artigo} - {rdpm_row['gravidade']})"
                                        })

                                elif trans_tipo == 'estatuto':
                                    # Buscar infração Art. 29
                                    cursor.execute("""
                                        SELECT inciso, texto
                                        FROM infracoes_estatuto_art29
                                        WHERE id = %s
                                    """, (trans_id,))
                                    art29_row = cursor.fetchone()
                                    if art29_row:
                                        art29_obj = {
                                            "inciso": art29_row['inciso'],
                                            "texto": art29_row['texto'],
                                            "texto_completo": f"Art. 29, Inciso {art29_row['inciso']}, do Decreto Lei 09A/1982 - {art29_row['texto']}"
                                        }

                                        # Se houver analogia RDPM, adicionar como complemento
                                        if 'rdmp_analogia' in trans and trans['rdmp_analogia']:
                                            analogia_id = trans['rdmp_analogia'].get('id')
                                            if analogia_id:
                                                cursor.execute("""
                                                    SELECT inciso, texto, gravidade
                                                    FROM transgressoes
                                                    WHERE id = %s
                                                """, (analogia_id,))
                                                rdpm_row = cursor.fetchone()
                                                if rdpm_row:
                                                    # Determinar artigo baseado na gravidade
                                                    gravidade = rdpm_row['gravidade'].lower()
                                                    artigo_map = {'leve': '15', 'media': '16', 'grave': '17'}
                                                    artigo = artigo_map.get(gravidade, '15')

                                                    art29_obj["analogia"] = {
                                                        "inciso": rdpm_row['inciso'],
                                                        "texto": rdpm_row['texto'],
                                                        "gravidade": rdpm_row['gravidade'],
                                                        "artigo": artigo
                                                    }
                                                    # Atualizar texto_completo para incluir a analogia
                                                    art29_obj["texto_completo"] = (
                                                        f"Art. 29, Inciso {art29_row['inciso']}, do Decreto Lei 09A/1982 - {art29_row['texto']}\n"
                                                        f"  Analogia RDPM: Inciso {rdpm_row['inciso']} - {rdpm_row['texto']} (art. {artigo} - {rdpm_row['gravidade']})"
                                                    )

                                        indicios_processo["art29"].append(art29_obj)
                    except Exception as e:
                        print(f"Erro ao processar transgressões JSON: {e}")

                pms.append({
                    "nome": row['nome'],
                    "posto_graduacao": row['posto_graduacao'],
                    "matricula": row['matricula'],
                    "tipo_envolvimento": row['status_pm'] or "Acusado",
                    "completo": f"{row['posto_graduacao']} {row['matricula']} {row['nome']}".strip(),
                    "indicios": indicios_processo
                })

    except Exception as e:
        print(f"Erro ao obter PMs envolvidos: {e}")

    return pms


def _obter_indicios_por_pm(cursor, pm_envolvido_id):
    """
    Obtém indícios específicos de um PM envolvido.

    Args:
        cursor: Cursor do banco de dados
        pm_envolvido_id (str): ID do registro de PM envolvido

    Returns:
        dict: Dicionário com indícios (crimes, transgressões, art29)
    """
    indicios = {"categorias": [], "crimes": [], "transgressoes": [], "art29": []}

    try:
        # Buscar o registro de indícios do PM
        cursor.execute("""
            SELECT id, categorias_indicios
            FROM pm_envolvido_indicios
            WHERE pm_envolvido_id = %s AND ativo = TRUE
        """, (pm_envolvido_id,))

        pm_indicios = cursor.fetchone()
        if not pm_indicios:
            return indicios

        pm_indicios_id = pm_indicios['id']
        categorias_json = pm_indicios['categorias_indicios']

        # Processar categorias de indícios (JSONB nativo com fallback string)
        if categorias_json:
            if isinstance(categorias_json, list):
                indicios["categorias"] = categorias_json
            elif isinstance(categorias_json, str) and categorias_json.strip():
                try:
                    categorias = json.loads(categorias_json)
                    if isinstance(categorias, list):
                        indicios["categorias"] = categorias
                except Exception:
                    pass

        # Buscar crimes específicos do PM
        cursor.execute("""
            SELECT c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo,
                   c.paragrafo, c.inciso, c.alinea
            FROM pm_envolvido_crimes pec
            JOIN crimes_contravencoes c ON c.id = pec.crime_id
            WHERE pec.pm_indicios_id = %s
        """, (pm_indicios_id,))

        for row in cursor.fetchall():
            indicios["crimes"].append({
                "tipo": row['tipo'],
                "dispositivo": row['dispositivo_legal'],
                "artigo": row['artigo'],
                "descricao": row['descricao_artigo'],
                "paragrafo": row['paragrafo'],
                "inciso": row['inciso'],
                "alinea": row['alinea'],
                "texto_completo": f"{row['dispositivo_legal']} - Art. {row['artigo']}, {row['descricao_artigo'] or ''}"
            })

        # Buscar transgressões RDPM específicas do PM
        cursor.execute("""
            SELECT t.inciso, t.texto, t.gravidade
            FROM pm_envolvido_rdpm per
            JOIN transgressoes t ON t.id = per.transgressao_id
            WHERE per.pm_indicios_id = %s
        """, (pm_indicios_id,))

        for row in cursor.fetchall():
            # Determinar artigo baseado na gravidade
            gravidade = row['gravidade'].lower()
            artigo_map = {'leve': '15', 'media': '16', 'grave': '17'}
            artigo = artigo_map.get(gravidade, '15')

            indicios["transgressoes"].append({
                "inciso": row['inciso'],
                "texto": row['texto'],
                "gravidade": row['gravidade'],
                "artigo": artigo,
                "tipo": "rdpm",
                "texto_completo": f"Inciso {row['inciso']}, do RDPM - {row['texto']} (art. {artigo} - {row['gravidade']})"
            })

        # Buscar infrações Art. 29 específicas do PM
        cursor.execute("""
            SELECT a.inciso, a.texto
            FROM pm_envolvido_art29 pea
            JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
            WHERE pea.pm_indicios_id = %s
        """, (pm_indicios_id,))

        for row in cursor.fetchall():
            indicios["art29"].append({
                "inciso": row['inciso'],
                "texto": row['texto'],
                "texto_completo": f"Art. 29, Inciso {row['inciso']}, do Decreto Lei 09A/1982 - {row['texto']}"
            })

    except Exception as e:
        print(f"Erro ao obter indícios por PM: {e}")

    return indicios


def _obter_indicios_para_mapa(cursor, processo_id):
    """
    Obtém indícios de crimes e transgressões para o mapa mensal.

    Args:
        cursor: Cursor do banco de dados
        processo_id (str): ID do processo/procedimento

    Returns:
        dict: Dicionário com indícios (crimes, transgressões, art29)
    """
    indicios = {"crimes": [], "transgressoes": [], "art29": []}

    try:
        # ============================================================
        # BUSCAR INDÍCIOS DO SISTEMA NOVO (por PM envolvido)
        # ============================================================

        # Buscar todos os PMs envolvidos no procedimento
        cursor.execute("""
            SELECT id FROM procedimento_pms_envolvidos
            WHERE procedimento_id = %s
        """, (processo_id,))

        pms_envolvidos = cursor.fetchall()

        for pm_row in pms_envolvidos:
            pm_envolvido_id = pm_row['id']

            # Buscar registro de indícios deste PM
            cursor.execute("""
                SELECT id FROM pm_envolvido_indicios
                WHERE pm_envolvido_id = %s AND ativo = TRUE
            """, (pm_envolvido_id,))

            indicios_registro = cursor.fetchone()

            if indicios_registro:
                pm_indicios_id = indicios_registro['id']

                # CRIMES deste PM
                cursor.execute("""
                    SELECT c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo,
                           c.paragrafo, c.inciso, c.alinea
                    FROM pm_envolvido_crimes pec
                    JOIN crimes_contravencoes c ON c.id = pec.crime_id
                    WHERE pec.pm_indicios_id = %s AND c.ativo = TRUE
                """, (pm_indicios_id,))

                for row in cursor.fetchall():
                    indicios["crimes"].append({
                        "tipo": row['tipo'],
                        "dispositivo": row['dispositivo_legal'],
                        "artigo": row['artigo'],
                        "descricao": row['descricao_artigo'],
                        "paragrafo": row['paragrafo'],
                        "inciso": row['inciso'],
                        "alinea": row['alinea'],
                        "texto_completo": f"{row['dispositivo_legal']} - Art. {row['artigo']}, {row['descricao_artigo'] or ''}"
                    })

                # RDPM deste PM
                cursor.execute("""
                    SELECT t.inciso, t.texto, t.gravidade
                    FROM pm_envolvido_rdpm per
                    JOIN transgressoes t ON t.id = per.transgressao_id
                    WHERE per.pm_indicios_id = %s AND t.ativo = TRUE
                """, (pm_indicios_id,))

                for row in cursor.fetchall():
                    # Determinar artigo baseado na gravidade
                    gravidade = row['gravidade'].lower()
                    artigo_map = {'leve': '15', 'media': '16', 'grave': '17'}
                    artigo = artigo_map.get(gravidade, '15')

                    indicios["transgressoes"].append({
                        "inciso": row['inciso'],
                        "texto": row['texto'],
                        "gravidade": row['gravidade'],
                        "artigo": artigo,
                        "tipo": "rdpm",
                        "texto_completo": f"Inciso {row['inciso']}, do RDPM - {row['texto']} (art. {artigo} - {row['gravidade']})"
                    })

                # ART. 29 deste PM
                cursor.execute("""
                    SELECT a.inciso, a.texto
                    FROM pm_envolvido_art29 pea
                    JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
                    WHERE pea.pm_indicios_id = %s AND a.ativo = TRUE
                """, (pm_indicios_id,))

                for row in cursor.fetchall():
                    indicios["art29"].append({
                        "inciso": row['inciso'],
                        "texto": row['texto'],
                        "texto_completo": f"Art. 29, Inciso {row['inciso']}, do Decreto Lei 09A/1982 - {row['texto']}"
                    })

        # ============================================================
        # FALLBACK: Buscar indícios do sistema antigo (se não houver do novo)
        # ============================================================

        # Se não encontrou crimes no sistema novo, buscar no antigo
        if not indicios["crimes"]:
            cursor.execute("""
                SELECT c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo,
                       c.paragrafo, c.inciso, c.alinea
                FROM procedimentos_indicios_crimes pic
                JOIN crimes_contravencoes c ON c.id = pic.crime_id
                WHERE pic.procedimento_id = %s AND c.ativo = TRUE
            """, (processo_id,))

            for row in cursor.fetchall():
                indicios["crimes"].append({
                    "tipo": row['tipo'],
                    "dispositivo": row['dispositivo_legal'],
                    "artigo": row['artigo'],
                    "descricao": row['descricao_artigo'],
                    "paragrafo": row['paragrafo'],
                    "inciso": row['inciso'],
                    "alinea": row['alinea'],
                    "texto_completo": f"{row['dispositivo_legal']} - Art. {row['artigo']}, {row['descricao_artigo'] or ''}"
                })

        # Se não encontrou RDPM no sistema novo, buscar no antigo
        if not indicios["transgressoes"]:
            cursor.execute("""
                SELECT t.inciso, t.texto, t.gravidade
                FROM procedimentos_indicios_rdpm pir
                JOIN transgressoes t ON t.id = pir.transgressao_id
                WHERE pir.procedimento_id = %s AND t.ativo = TRUE
            """, (processo_id,))

            for row in cursor.fetchall():
                # Determinar artigo baseado na gravidade
                gravidade = row['gravidade'].lower()
                artigo_map = {'leve': '15', 'media': '16', 'grave': '17'}
                artigo = artigo_map.get(gravidade, '15')

                indicios["transgressoes"].append({
                    "inciso": row['inciso'],
                    "texto": row['texto'],
                    "gravidade": row['gravidade'],
                    "artigo": artigo,
                    "tipo": "rdpm",
                    "texto_completo": f"Inciso {row['inciso']}, do RDPM - {row['texto']} (art. {artigo} - {row['gravidade']})"
                })

        # Se não encontrou Art. 29 no sistema novo, buscar no antigo
        if not indicios["art29"]:
            cursor.execute("""
                SELECT a.inciso, a.texto
                FROM procedimentos_indicios_art29 pia
                JOIN infracoes_estatuto_art29 a ON a.id = pia.art29_id
                WHERE pia.procedimento_id = %s AND a.ativo = TRUE
            """, (processo_id,))

            for row in cursor.fetchall():
                indicios["art29"].append({
                    "inciso": row['inciso'],
                    "texto": row['texto'],
                    "texto_completo": f"Art. 29, Inciso {row['inciso']}, do Decreto Lei 09A/1982 - {row['texto']}"
                })

    except Exception as e:
        print(f"Erro ao obter indícios: {e}")

    return indicios


def _obter_ultima_movimentacao(cursor, processo_id):
    """
    Obtém a última movimentação de um processo em andamento.

    Args:
        cursor: Cursor do banco de dados
        processo_id (str): ID do processo/procedimento

    Returns:
        dict: Dados da última movimentação ou None
    """
    try:
        # Buscar no campo JSON andamentos (coluna andamentos da tabela processos_procedimentos)
        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = %s AND ativo = TRUE
        """, (processo_id,))

        result = cursor.fetchone()
        if result and result['andamentos']:
            raw = result['andamentos']
            andamentos = []
            if isinstance(raw, list):
                andamentos = raw
            elif isinstance(raw, str) and raw.strip():
                try:
                    andamentos = json.loads(raw)
                except Exception as e:
                    print(f"Erro ao processar andamentos JSON: {e}")
                    andamentos = []
            if andamentos:
                ultimo_andamento = andamentos[0]
                return {
                    "data": ultimo_andamento.get("data", "").split()[0] if ultimo_andamento.get("data") else None,
                    "tipo": "outro",
                    "descricao": ultimo_andamento.get("texto", ""),
                    "destino": None
                }

    except Exception as e:
        print(f"Erro ao obter última movimentação: {e}")

    return None


def obter_tipos_processo_para_mapa(db_manager):
    """
    Obtém lista de tipos de processo/procedimento disponíveis para o mapa mensal.

    Args:
        db_manager: Gerenciador de conexão com banco de dados

    Returns:
        dict: {
            "sucesso": bool,
            "tipos": list - Lista de tipos disponíveis,
            "mensagem": str - Mensagem de erro (se sucesso=False)
        }
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT DISTINCT tipo_detalhe, COUNT(*) as total
            FROM processos_procedimentos
            WHERE ativo = TRUE
            GROUP BY tipo_detalhe
            ORDER BY tipo_detalhe
        """)

        tipos = []
        for row in cursor.fetchall():
            tipos.append({
                "codigo": row['tipo_detalhe'],
                "nome": row['tipo_detalhe'],
                "total": row['total']
            })

        conn.close()
        return {"sucesso": True, "tipos": tipos}

    except Exception as e:
        print(f"❌ Erro ao obter tipos de processo: {e}")
        return {"sucesso": False, "mensagem": f"Erro: {str(e)}"}
