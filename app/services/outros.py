"""
Serviço de funções auxiliares do sistema.

Este módulo contém funções utilitárias e auxiliares que não se encaixam
em categorias específicas de domínio, incluindo busca de municípios,
listagem de encarregados/operadores, verificação de permissões, histórico
de encarregados, prorrogações, filtros e transgressões.
"""

import psycopg2
import psycopg2.extras
import json
from datetime import datetime
from db_config import get_pg_connection


def buscar_municipios_distritos(db_manager, termo=''):
    """
    Busca municípios e distritos de Rondônia.

    Se um termo for fornecido, retorna apenas os que correspondem ao filtro.
    Caso contrário, retorna todos os municípios e distritos ativos.

    Args:
        db_manager: Instância do DatabaseManager
        termo: Termo de busca (opcional, case-insensitive)

    Returns:
        dict: {
            "sucesso": bool,
            "municipios": list[dict] - Lista com dados dos municípios/distritos
        } ou {"sucesso": False, "erro": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if termo:
            # Busca com filtro por termo (case-insensitive)
            cursor.execute("""
                SELECT id, nome, tipo, municipio_pai
                FROM municipios_distritos
                WHERE nome ILIKE %s AND ativo = TRUE
                ORDER BY
                    CASE tipo
                        WHEN 'municipio' THEN 1
                        WHEN 'distrito' THEN 2
                    END,
                    nome
            """, (f'%{termo}%',))
        else:
            # Busca todos os municípios e distritos
            cursor.execute("""
                SELECT id, nome, tipo, municipio_pai
                FROM municipios_distritos
                WHERE ativo = TRUE
                ORDER BY
                    CASE tipo
                        WHEN 'municipio' THEN 1
                        WHEN 'distrito' THEN 2
                    END,
                    nome
            """)

        municipios_distritos = cursor.fetchall()
        conn.close()

        resultado = []
        for m in municipios_distritos:
            # Formatar nome para exibição (distrito + município pai)
            nome_display = m['nome']
            if m['tipo'] == 'distrito' and m['municipio_pai']:  # se é distrito e tem município pai
                nome_display = f"{m['nome']} ({m['municipio_pai']})"

            resultado.append({
                "id": m['id'],
                "nome": m['nome'],
                "nome_display": nome_display,
                "tipo": m['tipo'],
                "municipio_pai": m['municipio_pai']
            })

        return {"sucesso": True, "municipios": resultado}

    except Exception as e:
        print(f"Erro ao buscar municípios/distritos: {e}")
        return {"sucesso": False, "erro": str(e)}


def listar_encarregados_operadores(db_manager):
    """
    Lista todos os usuários que são encarregados ou operadores.

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        list: Lista de usuários encarregados/operadores ativos
    """
    conn = db_manager.get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, nome, matricula,
                   is_encarregado, is_operador, email, perfil
            FROM usuarios
            WHERE ativo = TRUE AND (is_encarregado = TRUE OR is_operador = TRUE)
            ORDER BY posto_graduacao, nome ASC
        ''')

        usuarios = []
        for user in cursor.fetchall():
            # Determinar tipo para compatibilidade
            if user['is_encarregado'] and user['is_operador']:  # Ambos
                tipo = "encarregado_operador"
            elif user['is_encarregado']:  # Apenas encarregado
                tipo = "encarregado"
            else:  # Apenas operador
                tipo = "operador"

            usuarios.append({
                "id": user['id'],
                "tipo_usuario": user['tipo_usuario'],
                "posto_graduacao": user['posto_graduacao'],
                "nome": user['nome'],
                "matricula": user['matricula'],
                "email": user['email'],
                "perfil": user['perfil'],
                "tipo": tipo,
                "nome_completo": f"{user['posto_graduacao']} {user['matricula']} {user['nome']}".strip() if user['matricula'] else f"{user['posto_graduacao']} {user['nome']}".strip()
            })

        conn.close()
        return usuarios

    except Exception as e:
        print(f"Erro ao listar encarregados/operadores: {e}")
        return []


def verificar_admin(db_manager, usuario_logado):
    """
    Verifica se o usuário logado é administrador.

    Args:
        db_manager: Instância do DatabaseManager
        usuario_logado: Dict com dados do usuário logado

    Returns:
        bool: True se o usuário for operador com perfil admin, False caso contrário
    """
    if usuario_logado and usuario_logado.get('tipo') == 'operador':
        return usuario_logado.get('profile') == 'admin'
    return False


def obter_ultimos_feitos_encarregado(db_manager, encarregado_id):
    """
    Obtém os 3 feitos mais recentes de um encarregado.

    Considera todos os papéis: responsável, escrivão, presidente,
    interrogante, escrivão do processo.

    Args:
        db_manager: Instância do DatabaseManager
        encarregado_id: ID do encarregado

    Returns:
        dict: {
            "sucesso": bool,
            "dados": list[dict] - Lista com os 3 feitos mais recentes
        } ou {"sucesso": False, "erro": str}
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        print(f"Buscando ultimos feitos para encarregado ID: {encarregado_id}")

        # Buscar os 3 feitos mais recentes onde o encarregado tem qualquer papel
        cursor.execute('''
            SELECT
                tipo_detalhe as tipo,
                numero,
                data_instauracao,
                data_recebimento,
                data_remessa_encarregado
            FROM processos_procedimentos
            WHERE (
                responsavel_id = %s OR
                escrivao_id = %s OR
                presidente_id = %s OR
                interrogante_id = %s OR
                escrivao_processo_id = %s
            )
            AND ativo = TRUE
            ORDER BY
                CASE
                    WHEN data_remessa_encarregado IS NOT NULL THEN date(data_remessa_encarregado)
                    WHEN data_instauracao IS NOT NULL THEN date(data_instauracao)
                    ELSE '9999-12-31'
                END DESC
            LIMIT 3
        ''', (encarregado_id, encarregado_id, encarregado_id, encarregado_id, encarregado_id))

        rows = cursor.fetchall()

        print(f"  Encontrou {len(rows)} feitos")

        feitos = []
        for row in rows:
            feito = {
                'tipo': row['tipo'] or 'N/A',
                'numero': row['numero'] or 'N/A',
                'data_instauracao': str(row['data_instauracao']) if row['data_instauracao'] else '',
                'data_recebimento': str(row['data_recebimento']) if row['data_recebimento'] else '',
                'data_remessa': str(row['data_remessa_encarregado']) if row['data_remessa_encarregado'] else ''
            }
            feitos.append(feito)
            print(f"    - {feito['tipo']} no {feito['numero']}")

        conn.close()

        return {
            "sucesso": True,
            "dados": feitos
        }

    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


def obter_anos_disponiveis(db_manager):
    """
    Retorna lista de anos com processos/procedimentos cadastrados.

    Extrai anos distintos da data de instauração dos processos/procedimentos ativos.

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        dict: {
            "sucesso": bool,
            "anos": list[str] - Lista de anos em ordem decrescente
        } ou {"sucesso": False, "erro": str}
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute('''
            SELECT DISTINCT TO_CHAR(data_instauracao, 'YYYY') as ano
            FROM processos_procedimentos
            WHERE data_instauracao IS NOT NULL AND ativo = TRUE
            ORDER BY ano DESC
        ''')

        anos = [row['ano'] for row in cursor.fetchall()]
        conn.close()

        return {
            "sucesso": True,
            "anos": anos
        }

    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


def substituir_encarregado(db_manager, usuario_logado, processo_id, novo_encarregado_id, justificativa=None):
    """
    Substitui o encarregado de um processo/procedimento e registra no histórico.

    Atualiza o responsável do processo e mantém um histórico JSON de todas
    as substituições realizadas.

    Args:
        db_manager: Instância do DatabaseManager
        usuario_logado: Dict com dados do usuário logado (para auditoria)
        processo_id: ID do processo/procedimento
        novo_encarregado_id: ID do novo encarregado
        justificativa: Motivo da substituição (opcional)

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Obter dados atuais do processo de forma mais robusta
        cursor.execute("""
            SELECT
                p.responsavel_id,
                p.responsavel_tipo,
                COALESCE(u.nome, '') as responsavel_atual_nome,
                COALESCE(u.posto_graduacao, '') as responsavel_atual_posto,
                COALESCE(u.matricula, '') as responsavel_atual_matricula
            FROM processos_procedimentos p
            LEFT JOIN usuarios u ON p.responsavel_id = u.id AND u.ativo = TRUE
            WHERE p.id = %s AND p.ativo = TRUE
        """, (processo_id,))

        processo_atual = cursor.fetchone()
        if not processo_atual:
            conn.close()
            return {"sucesso": False, "mensagem": "Processo não encontrado!"}

        responsavel_atual_id = processo_atual['responsavel_id']
        responsavel_atual_nome = processo_atual['responsavel_atual_nome']
        responsavel_atual_posto = processo_atual['responsavel_atual_posto']
        responsavel_atual_matricula = processo_atual['responsavel_atual_matricula']

        # Verificar se o novo encarregado é válido na tabela usuarios
        cursor.execute("SELECT id, nome, posto_graduacao, matricula FROM usuarios WHERE id = %s AND ativo = TRUE", (novo_encarregado_id,))
        novo_encarregado = cursor.fetchone()
        novo_encarregado_tipo = 'usuario'  # Tipo padrão para estrutura unificada

        if not novo_encarregado:
            conn.close()
            return {"sucesso": False, "mensagem": "Novo encarregado não encontrado ou inativo!"}

        novo_encarregado_id = novo_encarregado['id']
        novo_encarregado_nome = novo_encarregado['nome']
        novo_encarregado_posto = novo_encarregado['posto_graduacao']
        novo_encarregado_matricula = novo_encarregado['matricula']

        # Verificar se é o mesmo encarregado
        if responsavel_atual_id == novo_encarregado_id:
            conn.close()
            return {"sucesso": False, "mensagem": "O novo encarregado é o mesmo que o atual!"}

        # Obter histórico atual
        cursor.execute("SELECT historico_encarregados FROM processos_procedimentos WHERE id = %s", (processo_id,))
        historico_result = cursor.fetchone()
        historico_atual = historico_result['historico_encarregados'] if historico_result else None

        # Criar registro de substituição
        registro_substituicao = {
            "data_substituicao": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "encarregado_anterior": {
                "id": responsavel_atual_id,
                "nome": responsavel_atual_nome,
                "posto_graduacao": responsavel_atual_posto,
                "matricula": responsavel_atual_matricula
            },
            "novo_encarregado": {
                "id": novo_encarregado_id,
                "nome": novo_encarregado_nome,
                "posto_graduacao": novo_encarregado_posto,
                "matricula": novo_encarregado_matricula
            },
            "justificativa": justificativa
        }

        # Atualizar histórico
        historico_atualizado = []
        if historico_atual:
            if isinstance(historico_atual, list):
                historico_atualizado = historico_atual
            elif isinstance(historico_atual, str):
                try:
                    historico_atualizado = json.loads(historico_atual)
                except Exception:
                    historico_atualizado = []

        historico_atualizado.append(registro_substituicao)
        historico_json = json.dumps(historico_atualizado, ensure_ascii=False)

        # Atualizar processo com novo encarregado, tipo correto e histórico
        cursor.execute("""
            UPDATE processos_procedimentos
            SET responsavel_id = %s, responsavel_tipo = %s, historico_encarregados = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (novo_encarregado_id, novo_encarregado_tipo, historico_json, processo_id))

        conn.commit()
        conn.close()

        return {"sucesso": True, "mensagem": "Encarregado substituído com sucesso!"}

    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao substituir encarregado: {str(e)}"}


def obter_historico_encarregados(db_manager, processo_id):
    """
    Obtém o histórico de encarregados de um processo, garantindo que o primeiro seja incluído.

    Retorna a lista completa de substituições de encarregados, incluindo o encarregado
    inicial do processo.

    Args:
        db_manager: Instância do DatabaseManager
        processo_id: ID do processo/procedimento

    Returns:
        dict: {
            "sucesso": bool,
            "historico": list[dict] - Lista cronológica de substituições
        } ou {"sucesso": False, "mensagem": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar o histórico de substituições e os dados do responsável atual
        cursor.execute("""
            SELECT
                p.historico_encarregados,
                p.responsavel_id,
                p.data_instauracao,
                p.created_at
            FROM processos_procedimentos p
            WHERE p.id = %s AND p.ativo = TRUE
        """, (processo_id,))

        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"sucesso": False, "mensagem": "Processo não encontrado!"}

        historico_json = row['historico_encarregados']
        responsavel_id = row['responsavel_id']
        data_instauracao = row['data_instauracao']
        data_criacao = row['created_at']

        historico = []
        if historico_json:
            if isinstance(historico_json, list):
                historico = historico_json
            elif isinstance(historico_json, str):
                try:
                    historico = json.loads(historico_json)
                except Exception:
                    historico = []

        # O primeiro encarregado é o 'encarregado_anterior' do primeiro registro do histórico.
        # Se não houver histórico, o responsável atual é o primeiro.
        primeiro_encarregado_historico = None
        if historico:
            primeiro_encarregado_historico = historico[0]['encarregado_anterior']

        # Se não há um "primeiro encarregado" no histórico, busca o responsável inicial do processo
        if not primeiro_encarregado_historico or not primeiro_encarregado_historico.get('id'):
            cursor.execute("""
                SELECT id, nome, posto_graduacao, matricula
                FROM usuarios
                WHERE id = %s AND ativo = TRUE
            """, (responsavel_id,))

            encarregado_info = cursor.fetchone()

            if encarregado_info:
                primeiro_encarregado_dados = {
                    "id": encarregado_info['id'],
                    "nome": encarregado_info['nome'],
                    "posto_graduacao": encarregado_info['posto_graduacao'],
                    "matricula": encarregado_info['matricula']
                }

                # Se não há histórico, cria um registro para o encarregado inicial
                if not historico:
                    historico.append({
                        "data_substituicao": data_instauracao or data_criacao,
                        "encarregado_anterior": None,
                        "novo_encarregado": primeiro_encarregado_dados,
                        "justificativa": "Designação Inicial"
                    })
                # Se há histórico mas o primeiro anterior está faltando, preenche
                elif historico[0]['encarregado_anterior'] is None:
                    historico[0]['encarregado_anterior'] = primeiro_encarregado_dados

        conn.close()
        return {"sucesso": True, "historico": historico}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao obter histórico de encarregados: {str(e)}"}


def adicionar_prorrogacao(db_manager, prazos_manager, processo_id, dias_prorrogacao, numero_portaria=None, data_portaria=None, motivo=None, autorizado_por=None, autorizado_tipo=None):
    """
    Cria uma prorrogação para o prazo ativo do processo.

    Segue a regra do dia seguinte ao vencimento para calcular a nova data.

    Args:
        db_manager: Instância do DatabaseManager
        prazos_manager: Instância do PrazosAndamentosManager
        processo_id: ID do processo/procedimento
        dias_prorrogacao: Quantidade de dias a prorrogar
        numero_portaria: Número da portaria de prorrogação (opcional)
        data_portaria: Data da portaria (opcional)
        motivo: Motivo da prorrogação (opcional)
        autorizado_por: ID do autorizador (opcional)
        autorizado_tipo: Tipo do autorizador (opcional)

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        resultado = prazos_manager.prorrogar_prazo(
            processo_id=processo_id,
            dias_prorrogacao=int(dias_prorrogacao),
            motivo=motivo,
            autorizado_por=autorizado_por,
            autorizado_tipo=autorizado_tipo,
            numero_portaria=numero_portaria,
            data_portaria=data_portaria
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao adicionar prorrogação: {str(e)}"}


def obter_opcoes_filtros(db_manager):
    """
    Retorna todas as opções disponíveis para os filtros.

    Extrai valores únicos de todos os campos filtráveis baseado em todos os
    processos do banco de dados.

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        dict: {
            "sucesso": bool,
            "opcoes": dict - Dicionário com listas de opções para cada filtro
        } ou {"sucesso": False, "mensagem": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar todos os valores únicos para cada campo de filtro
        cursor.execute("""
            SELECT DISTINCT
                p.tipo_detalhe,
                p.local_origem,
                p.local_fatos,
                p.documento_iniciador,
                p.status_pm,
                p.nome_vitima,
                COALESCE(u_resp.nome, 'Desconhecido') as responsavel_nome,
                COALESCE(u_resp.posto_graduacao, '') as responsavel_posto,
                COALESCE(u_resp.matricula, '') as responsavel_matricula,
                COALESCE(
                    u_pm.posto_graduacao || ' ' || u_pm.matricula || ' ' || u_pm.nome,
                    ''
                ) as pm_envolvido_completo,
                TO_CHAR(p.data_instauracao, 'YYYY') as ano_instauracao,
                TO_CHAR(p.data_recebimento, 'YYYY') as ano_recebimento
            FROM processos_procedimentos p
            LEFT JOIN usuarios u_resp ON p.responsavel_id = u_resp.id
            LEFT JOIN usuarios u_pm ON p.nome_pm_id = u_pm.id
            WHERE p.ativo = TRUE
        """)

        resultados = cursor.fetchall()
        conn.close()

        # Processar resultados
        tipos = set()
        origens = set()
        locais_fatos = set()
        documentos = set()
        status = set()
        encarregados = set()
        pm_envolvidos = set()
        vitimas = set()
        anos = set()

        for row in resultados:
            # RealDictCursor retorna dicionários
            tipo_detalhe = row['tipo_detalhe']
            local_origem = row['local_origem']
            local_fatos = row['local_fatos']
            documento_iniciador = row['documento_iniciador']
            status_pm = row['status_pm']
            nome_vitima = row['nome_vitima']
            responsavel_nome = row['responsavel_nome']
            responsavel_posto = row['responsavel_posto']
            responsavel_matricula = row['responsavel_matricula']
            pm_envolvido_completo = row['pm_envolvido_completo']
            ano_instauracao = row['ano_instauracao']
            ano_recebimento = row['ano_recebimento']

            if tipo_detalhe:
                tipos.add(tipo_detalhe)
            if local_origem:
                origens.add(local_origem)
            if local_fatos:
                locais_fatos.add(local_fatos)
            if documento_iniciador:
                documentos.add(documento_iniciador)
            if status_pm:
                status.add(status_pm)
            if nome_vitima:
                vitimas.add(nome_vitima)
            if pm_envolvido_completo and pm_envolvido_completo.strip():
                pm_envolvidos.add(pm_envolvido_completo.strip())

            # Formatar responsável completo
            if responsavel_nome and responsavel_nome != 'Desconhecido':
                responsavel_completo = f"{responsavel_posto} {responsavel_matricula} {responsavel_nome}".strip()
                encarregados.add(responsavel_completo)

            # Adicionar anos
            if ano_instauracao:
                anos.add(ano_instauracao)
            if ano_recebimento:
                anos.add(ano_recebimento)

        return {
            "sucesso": True,
            "opcoes": {
                "tipos": sorted(list(tipos)),
                "origens": sorted(list(origens)),
                "locais_fatos": sorted(list(locais_fatos)),
                "documentos": sorted(list(documentos)),
                "status": sorted(list(status)),
                "encarregados": sorted(list(encarregados)),
                "pm_envolvidos": sorted(list(pm_envolvidos)),
                "vitimas": sorted(list(vitimas)),
                "anos": sorted(list(anos), reverse=True)  # Anos mais recentes primeiro
            }
        }

    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter opções de filtros: {str(e)}"}


def listar_transgressoes(db_manager, gravidade=None):
    """
    Lista transgressões por gravidade.

    Se gravidade for fornecida, retorna apenas transgressões dessa gravidade.
    Caso contrário, retorna todas as transgressões ativas.

    Args:
        db_manager: Instância do DatabaseManager
        gravidade: Filtro de gravidade (opcional)

    Returns:
        dict: {
            "sucesso": bool,
            "transgressoes": list[dict] - Lista de transgressões
        } ou {"sucesso": False, "mensagem": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if gravidade:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM transgressoes
                WHERE gravidade = %s AND ativo = TRUE
                ORDER BY inciso
            """, (gravidade,))
        else:
            cursor.execute("""
                SELECT id, gravidade, inciso, texto
                FROM transgressoes
                WHERE ativo = TRUE
                ORDER BY gravidade, inciso
            """)

        transgressoes = cursor.fetchall()
        conn.close()

        resultado = []
        for t in transgressoes:
            if gravidade:
                resultado.append({
                    "id": t['id'],
                    "inciso": t['inciso'],
                    "texto": t['texto'],
                    "display": f"{t['inciso']} - {t['texto']}"
                })
            else:
                resultado.append({
                    "id": t['id'],
                    "gravidade": t['gravidade'],
                    "inciso": t['inciso'],
                    "texto": t['texto'],
                    "display": f"{t['inciso']} - {t['texto']}"
                })

        return {"sucesso": True, "transgressoes": resultado}

    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao listar transgressões: {str(e)}"}


def buscar_transgressoes(db_manager, termo, gravidade=None):
    """
    Busca transgressões por termo.

    Realiza busca case-insensitive no inciso e texto das transgressões.
    Opcionalmente filtra por gravidade.

    Args:
        db_manager: Instância do DatabaseManager
        termo: Termo de busca (obrigatório)
        gravidade: Filtro de gravidade (opcional)

    Returns:
        dict: {
            "sucesso": bool,
            "transgressoes": list[dict] - Lista de transgressões encontradas
        } ou {"sucesso": False, "mensagem": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        termo_like = f"%{termo}%"

        if gravidade:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM transgressoes
                WHERE gravidade = %s AND ativo = TRUE
                AND (inciso ILIKE %s OR texto ILIKE %s)
                ORDER BY inciso
            """, (gravidade, termo_like, termo_like))
        else:
            cursor.execute("""
                SELECT id, gravidade, inciso, texto
                FROM transgressoes
                WHERE ativo = TRUE
                AND (inciso ILIKE %s OR texto ILIKE %s)
                ORDER BY gravidade, inciso
            """, (termo_like, termo_like))

        transgressoes = cursor.fetchall()
        conn.close()

        resultado = []
        for t in transgressoes:
            if gravidade:
                resultado.append({
                    "id": t['id'],
                    "inciso": t['inciso'],
                    "texto": t['texto'],
                    "display": f"{t['inciso']} - {t['texto']}"
                })
            else:
                resultado.append({
                    "id": t['id'],
                    "gravidade": t['gravidade'],
                    "inciso": t['inciso'],
                    "texto": t['texto'],
                    "display": f"{t['inciso']} - {t['texto']}"
                })

        return {"sucesso": True, "transgressoes": resultado}

    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao buscar transgressões: {str(e)}"}
