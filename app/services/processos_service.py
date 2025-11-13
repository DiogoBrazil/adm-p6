"""
Serviço de Processos e Procedimentos
Contém todas as funções relacionadas a processos/procedimentos extraídas do main.py
"""

import base64
import json
import uuid
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
import traceback


# ======== FUNÇÕES AUXILIARES ========

def _determinar_natureza_processo(natureza_original, transgressoes_selecionadas):
    """Determina a natureza do processo baseado nas transgressões selecionadas"""
    if not transgressoes_selecionadas:
        return natureza_original

    # Coletar todas as naturezas das transgressões
    naturezas_unicas = set()
    for trans in transgressoes_selecionadas:
        natureza = trans.get('natureza', 'leve')
        # Normalizar mapeamento
        if natureza == 'media':
            natureza = 'Média'
        elif natureza == 'leve':
            natureza = 'Leve'
        elif natureza == 'grave':
            natureza = 'Grave'
        naturezas_unicas.add(natureza)

    # Se há mais de uma natureza, retornar "Múltiplas"
    if len(naturezas_unicas) > 1:
        return "Múltiplas"

    # Se há apenas uma natureza, retornar ela
    if len(naturezas_unicas) == 1:
        return list(naturezas_unicas)[0]

    # Fallback para valor original
    return natureza_original


def buscar_pms_envolvidos(db_manager, procedimento_id):
    """Busca todos os PMs envolvidos em um procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Busca primeiro os dados da tabela de relacionamento
        cursor.execute("""
            SELECT id, pm_id, pm_tipo, ordem, status_pm
            FROM procedimento_pms_envolvidos
            WHERE procedimento_id = %s
            ORDER BY ordem
        """, (procedimento_id,))

        pms_relacionamento = cursor.fetchall()

        resultado = []
        for pm_rel in pms_relacionamento:
            pm_envolvido_id = pm_rel['id']
            pm_id = pm_rel['pm_id']
            pm_tipo_tabela = pm_rel['pm_tipo']
            ordem = pm_rel['ordem']
            status_pm_env = pm_rel['status_pm']

            # Busca na tabela usuarios unificada
            cursor.execute("""
                SELECT nome, posto_graduacao, matricula
                FROM usuarios
                WHERE id = %s AND ativo = TRUE
            """, (pm_id,))

            pm_data = cursor.fetchone()

            if pm_data:
                nome = pm_data['nome'] or ""
                posto = pm_data['posto_graduacao'] or ""
                matricula = pm_data['matricula'] or ""

                # Montar nome completo removendo espaços extras
                # Se for "A APURAR", mostrar apenas o nome
                if nome == "A APURAR":
                    nome_completo = "A APURAR"
                else:
                    nome_completo = f"{posto} {matricula} {nome}".strip()
                    # Remover espaços duplos
                    nome_completo = " ".join(nome_completo.split())

                # Buscar indícios associados a este PM
                indicios = buscar_indicios_por_pm(db_manager, pm_envolvido_id)

                resultado.append({
                    'id': pm_id,
                    'pm_envolvido_id': pm_envolvido_id,  # Adicionar o ID da tabela de relacionamento
                    'tipo': pm_tipo_tabela,
                    'ordem': ordem,
                    'status_pm': status_pm_env,
                    'nome': nome,
                    'posto_graduacao': posto,
                    'matricula': matricula,
                    'nome_completo': nome_completo,
                    'indicios': indicios
                })

        conn.close()
        print(f"🔍 Buscar PMs para procedimento {procedimento_id}: encontrou {len(resultado)} PMs")
        for pm in resultado:
            print(f"  - PM: {pm['nome_completo']}")

        return resultado
    except Exception as e:
        print(f"Erro ao buscar PMs envolvidos: {e}")
        return []


def buscar_indicios_por_pm(db_manager, pm_envolvido_id):
    """Busca todos os indícios associados a um PM específico"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar o registro principal de indícios
        cursor.execute("""
            SELECT id, categorias_indicios, categoria
            FROM pm_envolvido_indicios
            WHERE pm_envolvido_id = %s AND ativo = TRUE
        """, (pm_envolvido_id,))

        indicios_result = cursor.fetchone()
        if not indicios_result:
            conn.close()
            return None

        indicios_id = indicios_result['id']
        categorias_json = indicios_result['categorias_indicios']
        categoria_texto = indicios_result['categoria']

        # Parse das categorias (JSONB vira list/dict via psycopg2)
        categorias = []
        if categorias_json is not None:
            if isinstance(categorias_json, list):
                categorias = categorias_json
            elif isinstance(categorias_json, dict):
                categorias = list(categorias_json.values())
            elif isinstance(categorias_json, str) and categorias_json.strip():
                try:
                    categorias = json.loads(categorias_json)
                except Exception:
                    categorias = [categorias_json]
        if not categorias and categoria_texto:
            categorias = [categoria_texto]

        # Buscar crimes associados
        crimes = []
        cursor.execute("""
            SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo,
                   c.paragrafo, c.inciso, c.alinea
            FROM pm_envolvido_crimes pec
            JOIN crimes_contravencoes c ON c.id = pec.crime_id
            WHERE pec.pm_indicios_id = %s
        """, (indicios_id,))

        for row in cursor.fetchall():
            codigo = f"{row['dispositivo_legal']} Art. {row['artigo']}"
            if row['paragrafo']:
                codigo += f" §{row['paragrafo']}"
            if row['inciso']:
                codigo += f" {row['inciso']}"
            if row['alinea']:
                codigo += f" {row['alinea']}"

            crimes.append({
                "id": row['id'],
                "tipo": row['tipo'],
                "codigo": codigo,
                "descricao": row['descricao_artigo'] or ""
            })

        # Buscar transgressões RDPM associadas
        rdpm = []
        cursor.execute("""
            SELECT t.id, t.gravidade, t.inciso, t.texto
            FROM pm_envolvido_rdpm per
            JOIN transgressoes t ON t.id = per.transgressao_id
            WHERE per.pm_indicios_id = %s
        """, (indicios_id,))

        for row in cursor.fetchall():
            rdpm.append({
                "id": row['id'],
                "natureza": row['gravidade'],
                "inciso": row['inciso'],
                "texto": row['texto']
            })

        # Buscar infrações Art. 29 associadas
        art29 = []
        cursor.execute("""
            SELECT a.id, a.inciso, a.texto
            FROM pm_envolvido_art29 pea
            JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
            WHERE pea.pm_indicios_id = %s
        """, (indicios_id,))

        for row in cursor.fetchall():
            art29.append({
                "id": row['id'],
                "inciso": row['inciso'],
                "texto": row['texto']
            })

        conn.close()

        return {
            "categorias": categorias,
            "crimes": crimes,
            "rdpm": rdpm,
            "art29": art29
        }

    except Exception as e:
        print(f"Erro ao buscar indícios do PM {pm_envolvido_id}: {e}")
        traceback.print_exc()
        return None


def calcular_prazo_processo(tipo_detalhe, documento_iniciador, data_recebimento, prorrogacoes_dias=0):
    """
    Calcula o prazo de conclusão de um processo/procedimento baseado nas regras definidas

    Args:
        tipo_detalhe (str): Tipo específico do processo (SR, PADS, IPM, etc.)
        documento_iniciador (str): Tipo do documento iniciador
        data_recebimento (str): Data de recebimento no formato YYYY-MM-DD
        prorrogacoes_dias (int): Dias de prorrogação adicionais

    Returns:
        dict: Informações sobre o prazo calculado
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


# ======== FUNÇÕES PRINCIPAIS DE PROCESSOS ========

def registrar_processo(
    db_manager, usuario_logado, salvar_indicios_pm_envolvido,
    numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
    local_origem=None, local_fatos=None, data_instauracao=None, data_recebimento=None, escrivao_id=None, status_pm=None, nome_pm_id=None,
    nome_vitima=None, natureza_processo=None, natureza_procedimento=None, motorista_id=None, resumo_fatos=None,
    numero_portaria=None, numero_memorando=None, numero_feito=None, numero_rgf=None, numero_controle=None,
    concluido=False, data_conclusao=None, solucao_final=None, pms_envolvidos=None, transgressoes_ids=None,
    # Novos campos (Migração 014)
    data_remessa_encarregado=None, data_julgamento=None, solucao_tipo=None,
    penalidade_tipo=None, penalidade_dias=None, indicios_categorias=None,
    indicios_crimes=None, indicios_rdpm=None, indicios_art29=None,
    # Novos indícios por PM (Migração 015)
    indicios_por_pm=None,
    # Novos campos para PAD, CD, CJ (Migração 018)
    presidente_id=None, presidente_tipo=None,
    interrogante_id=None, interrogante_tipo=None,
    escrivao_processo_id=None, escrivao_processo_tipo=None,
    # Novos campos para Carta Precatória (Migração 025)
    unidade_deprecada=None, deprecante=None, pessoas_inquiridas=None
):
    """
    Registra um novo processo/procedimento

    Args:
        db_manager: Gerenciador de banco de dados
        usuario_logado: Dicionário com dados do usuário logado
        salvar_indicios_pm_envolvido: Função para salvar indícios por PM
        ... demais parâmetros do processo

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    print(f"📝 Tentando registrar processo: {numero}, {tipo_geral}, {tipo_detalhe}")

    # Converter concluido para boolean (caso venha como int do frontend)
    if isinstance(concluido, int):
        concluido = bool(concluido)
    elif isinstance(concluido, str):
        concluido = concluido.lower() in ('true', '1', 'yes', 'sim')

    # Converter nome_vitima para maiúsculas se fornecido
    if nome_vitima:
        nome_vitima = nome_vitima.strip().upper()

    # Validação do local_fatos (obrigatório)
    if not local_fatos:
        return {"sucesso": False, "mensagem": "Local onde ocorreram os fatos é obrigatório!"}

    # Extrair ano da data de instauração se fornecida
    ano_instauracao = None
    if data_instauracao:
        try:
            # data_instauracao está no formato YYYY-MM-DD
            ano_instauracao = str(data_instauracao)[:4]
        except:
            ano_instauracao = None

    print(f"Parâmetros recebidos:")
    params = {
        "numero": numero, "tipo_geral": tipo_geral, "tipo_detalhe": tipo_detalhe,
        "documento_iniciador": documento_iniciador, "processo_sei": processo_sei,
        "responsavel_id": responsavel_id, "responsavel_tipo": responsavel_tipo,
        "local_origem": local_origem, "local_fatos": local_fatos, "data_instauracao": data_instauracao,
        "data_recebimento": data_recebimento, "escrivao_id": escrivao_id,
        "status_pm": status_pm, "nome_pm_id": nome_pm_id,
        "nome_vitima": nome_vitima, "natureza_processo": natureza_processo,
        "natureza_procedimento": natureza_procedimento, "resumo_fatos": resumo_fatos,
        "numero_portaria": numero_portaria, "numero_memorando": numero_memorando,
        "numero_feito": numero_feito, "numero_rgf": numero_rgf, "numero_controle": numero_controle,
        "concluido": concluido, "data_conclusao": data_conclusao, "pms_envolvidos": pms_envolvidos
    }
    for key, value in params.items():
        print(f"  - {key}: {value}")

    # NORMALIZAÇÃO: Converter valores antigos de responsavel_tipo para 'usuario'
    if responsavel_tipo in ('encarregado', 'operador'):
        print(f"⚠️ Convertendo responsavel_tipo de '{responsavel_tipo}' para 'usuario'")
        responsavel_tipo = 'usuario'

    # Validação do documento_iniciador
    documentos_validos = ['Portaria', 'Memorando Disciplinar', 'Feito Preliminar']
    if documento_iniciador not in documentos_validos:
        print(f"❌ Documento iniciador inválido: {documento_iniciador}")
        return {"sucesso": False, "mensagem": f"Documento iniciador inválido. Valores permitidos: {', '.join(documentos_validos)}"}

    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Tabelas de associação para indícios (idempotente)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS procedimentos_indicios_crimes (
                id TEXT PRIMARY KEY,
                procedimento_id TEXT NOT NULL,
                crime_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS procedimentos_indicios_rdpm (
                id TEXT PRIMARY KEY,
                procedimento_id TEXT NOT NULL,
                transgressao_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS procedimentos_indicios_art29 (
                id TEXT PRIMARY KEY,
                procedimento_id TEXT NOT NULL,
                art29_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Verificações específicas antes da inserção para mensagens de erro mais precisas
        print(f"🔍 Verificando conflitos para: número={numero}, tipo={tipo_detalhe}, doc={documento_iniciador}, local={local_origem}, ano={ano_instauracao}")
        print(f"📅 Data instauração recebida: {data_instauracao}")

        # Verificar conflito no número principal (agora incluindo tipo_detalhe)
        cursor.execute("""
            SELECT id, numero, tipo_detalhe FROM processos_procedimentos
            WHERE numero = %s AND documento_iniciador = %s AND tipo_detalhe = %s AND local_origem = %s AND ano_instauracao = %s AND ativo = TRUE
        """, (numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao))
        conflito_numero = cursor.fetchone()

        print(f"🔍 Verificação número principal - conflito encontrado: {conflito_numero is not None}")

        if conflito_numero:
            local_msg = f" no {local_origem}" if local_origem else ""
            tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
            return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} número {numero}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}."}

        # Verificar conflito no número de controle (se fornecido, agora incluindo tipo_detalhe)
        if numero_controle:
            cursor.execute("""
                SELECT id, numero, numero_controle, tipo_detalhe FROM processos_procedimentos
                WHERE numero_controle = %s AND documento_iniciador = %s AND tipo_detalhe = %s AND local_origem = %s AND ano_instauracao = %s AND ativo = TRUE
            """, (numero_controle, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao))
            conflito_controle = cursor.fetchone()

            print(f"🔍 Verificação controle - conflito encontrado: {conflito_controle is not None}")
            if conflito_controle:
                print(f"   Controle {numero_controle} já usado no {tipo_detalhe} {conflito_controle['numero']}")

            if conflito_controle:
                local_msg = f" no {local_origem}" if local_origem else ""
                tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
                return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} com número de controle {numero_controle}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}. (Usado no {conflito_controle['tipo_detalhe'] or tipo_detalhe} {conflito_controle['numero']})"}

        print("✅ Nenhum conflito detectado, prosseguindo com inserção...")

        # Para PAD/CD/CJ, não existe 'Encarregado' do processo: deixar responsavel_id/tipo como NULL
        if (tipo_geral == 'processo') and (tipo_detalhe in ('PAD', 'CD', 'CJ')):
            print("ℹ️ Processo do tipo PAD/CD/CJ: definindo responsavel_id/responsavel_tipo como NULL")
            responsavel_id = None
            responsavel_tipo = None

        # Resolver tipos para presidente, interrogante e escrivão do processo com base no ID
        # Corrigir tipos incorretos (listas/dicts vazios para None)
        if isinstance(presidente_id, (list, dict)):
            presidente_id = None if not presidente_id else None
        if isinstance(interrogante_id, (list, dict)):
            interrogante_id = None if not interrogante_id else None
        if isinstance(escrivao_processo_id, (list, dict)):
            escrivao_processo_id = None if not escrivao_processo_id else None

        def _resolve_user_tipo(_cursor, _id):
            if not _id:
                return None
            try:
                _cursor.execute("SELECT 1 FROM usuarios WHERE id = %s AND ativo = TRUE", (_id,))
                if _cursor.fetchone():
                    return 'usuario'
            except Exception:
                pass
            return None

        presidente_tipo = _resolve_user_tipo(cursor, presidente_id) if presidente_id else None
        interrogante_tipo = _resolve_user_tipo(cursor, interrogante_id) if interrogante_id else None
        escrivao_processo_tipo = _resolve_user_tipo(cursor, escrivao_processo_id) if escrivao_processo_id else None

        # DEBUG: Log dos valores resolvidos
        print(f"🔍 DEBUG - Resolução de tipos:")
        print(f"   presidente_id: {presidente_id} -> presidente_tipo: {presidente_tipo}")
        print(f"   interrogante_id: {interrogante_id} -> interrogante_tipo: {interrogante_tipo}")
        print(f"   escrivao_processo_id: {escrivao_processo_id} -> escrivao_processo_tipo: {escrivao_processo_tipo}")

        # Normalização defensiva de penalidade_tipo para atender o CHECK do banco
        if penalidade_tipo:
            mapping = {
                'Prisão': 'Prisao', 'Prisao': 'Prisao',
                'Detenção': 'Detencao', 'Detencao': 'Detencao',
                'Repreensão': 'Repreensao', 'Repreensao': 'Repreensao',
                # Novas penalidades específicas por tipo de processo
                'Licenciado_Disciplina': 'Licenciado_Disciplina',
                'Excluido_Disciplina': 'Excluido_Disciplina',
                'Demitido_Exoficio': 'Demitido_Exoficio'
            }
            penalidade_tipo = mapping.get(penalidade_tipo, penalidade_tipo)
        # Se a solução não for Punido, limpar campos de penalidade
        if (solucao_tipo or '').strip() != 'Punido':
            penalidade_tipo = None
            penalidade_dias = None
        else:
            # Se penalidade não exigir dias, garante None
            if penalidade_tipo not in ('Prisao', 'Detencao'):
                penalidade_dias = None

        # Gerar ID único para o processo/procedimento
        processo_id = str(uuid.uuid4())

        # Converter pessoas_inquiridas para JSON string se for array/lista
        if pessoas_inquiridas is not None and isinstance(pessoas_inquiridas, (list, tuple)):
            pessoas_inquiridas = json.dumps(pessoas_inquiridas, ensure_ascii=False)
        
        # Converter nome_vitima para JSON string se for array/lista
        # Se já for string JSON, deixar como está
        if nome_vitima is not None:
            if isinstance(nome_vitima, (list, tuple)):
                nome_vitima = json.dumps(nome_vitima, ensure_ascii=False)
            elif isinstance(nome_vitima, str):
                # Se for string, tentar fazer parse para verificar se é JSON
                try:
                    json.loads(nome_vitima)
                    # Já é JSON válido, manter como está
                except (json.JSONDecodeError, ValueError):
                    # Não é JSON, é um nome simples - converter para array JSON
                    nome_vitima = json.dumps([nome_vitima], ensure_ascii=False)

        # Debug: verificar TODOS os parâmetros da query SQL
        print(f"\n========== DEBUG SQL PARAMETERS ===========")
        print(f"Tipo: {tipo_geral} / {tipo_detalhe}")

        # Criar tupla de parâmetros para debug
        params = (
            processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
            local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
            concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
            data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
            presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo
        )

        # Imprimir cada parâmetro com seu índice, valor e tipo
        param_names = [
            "processo_id", "numero", "tipo_geral", "tipo_detalhe", "documento_iniciador",
            "processo_sei", "responsavel_id", "responsavel_tipo", "local_origem", "local_fatos",
            "data_instauracao", "data_recebimento", "escrivao_id", "status_pm", "nome_pm_id",
            "nome_vitima", "natureza_processo", "natureza_procedimento", "resumo_fatos",
            "numero_portaria", "numero_memorando", "numero_feito", "numero_rgf", "numero_controle",
            "concluido", "data_conclusao", "solucao_final", "transgressoes_ids", "ano_instauracao",
            "data_remessa_encarregado", "data_julgamento", "solucao_tipo", "penalidade_tipo", "penalidade_dias",
            "indicios_categorias", "presidente_id", "presidente_tipo", "interrogante_id", "interrogante_tipo",
            "escrivao_processo_id", "escrivao_processo_tipo"
        ]

        for i, (name, value) in enumerate(zip(param_names, params)):
            print(f"Param {i:2d} ({name:25s}): {repr(value):50s} | tipo: {type(value).__name__}")

        print(f"==========================================\n")

        cursor.execute("""
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
                local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
                nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
                numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
                concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
                data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
                presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
                motorista_id, unidade_deprecada, deprecante, pessoas_inquiridas
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
        """, (
            processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
            local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
            concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
            data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
            presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
            motorista_id, unidade_deprecada, deprecante, pessoas_inquiridas
        ))

        # Se for procedimento e tiver múltiplos PMs envolvidos, salvar na nova tabela
        if tipo_geral == 'procedimento' and pms_envolvidos:
            print(f"📝 Salvando PMs envolvidos para procedimento: {pms_envolvidos}")
            for i, pm in enumerate(pms_envolvidos):
                if pm.get('id'):  # Verifica se o PM tem ID válido
                    pm_tipo = 'operador' if pm.get('tipo') == 'operador' else 'encarregado'
                    status_pm_env = pm.get('status_pm', status_pm)
                    cursor.execute("""
                        INSERT INTO procedimento_pms_envolvidos (id, procedimento_id, pm_id, pm_tipo, ordem, status_pm)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (str(uuid.uuid4()), processo_id, pm['id'], pm_tipo, i + 1, status_pm_env))

        # Persistir indícios (se fornecidos)
        def _insert_indicios(lista_ids, table_name, col_name):
            if not lista_ids:
                return
            # aceitar string JSON também
            ids = lista_ids
            if isinstance(lista_ids, str):
                try:
                    ids = json.loads(lista_ids)
                except Exception:
                    ids = []
            # normalizar para lista simples
            if isinstance(ids, dict):
                ids = list(ids.values())
            for raw_id in ids:
                if raw_id is None:
                    continue
                val = str(raw_id)
                cursor.execute(
                    f"INSERT INTO {table_name} (id, procedimento_id, {col_name}) VALUES (%s, %s, %s)",
                    (str(uuid.uuid4()), processo_id, val)
                )

        _insert_indicios(indicios_crimes, 'procedimentos_indicios_crimes', 'crime_id')
        _insert_indicios(indicios_rdpm, 'procedimentos_indicios_rdpm', 'transgressao_id')
        # PostgreSQL: sempre usar 'art29_id' (nome correto da coluna)
        _insert_indicios(indicios_art29, 'procedimentos_indicios_art29', 'art29_id')

        # ======== PROCESSAR INDÍCIOS POR PM (MIGRAÇÃO 015) ========
        try:
            print(f"🔍 Verificando indícios por PM recebidos: {indicios_por_pm}")
            print(f"🔍 Tipo dos indícios por PM: {type(indicios_por_pm)}")

            # FALLBACK: Se não houver indicios_por_pm mas houver indícios globais E PM único,
            # converter indícios globais para o formato por PM
            if not indicios_por_pm and nome_pm_id and (indicios_crimes or indicios_rdpm or indicios_art29):
                print(f"🔄 FALLBACK: Convertendo indícios globais para formato por PM (PM único: {nome_pm_id})")
                indicios_por_pm = {
                    nome_pm_id: {
                        'categorias': [cat.strip() for cat in (indicios_categorias or '').split(',') if cat.strip()],
                        'crimes': [{'id': cid} for cid in (indicios_crimes or [])],
                        'rdpm': [{'id': rid} for rid in (indicios_rdpm or [])],
                        'art29': [{'id': aid} for aid in (indicios_art29 or [])]
                    }
                }
                print(f"✅ Indícios convertidos para PM {nome_pm_id}: {indicios_por_pm[nome_pm_id]}")

            if indicios_por_pm and isinstance(indicios_por_pm, dict):
                print(f"🔧 Processando indícios por PM via formulário: {len(indicios_por_pm)} PMs com dados")

                for pm_id, dados_indicios in indicios_por_pm.items():
                    print(f"💾 Salvando indícios para PM {pm_id}")

                    if not dados_indicios:
                        print(f"⚠️ PM {pm_id} sem dados de indícios")
                        continue

                    # Buscar pm_envolvido_id para este PM
                    cursor.execute("""
                        SELECT id FROM procedimento_pms_envolvidos
                        WHERE procedimento_id = %s AND pm_id = %s
                    """, (processo_id, pm_id))

                    pm_envolvido_result = cursor.fetchone()
                    if not pm_envolvido_result:
                        print(f"⚠️ PM {pm_id} não encontrado na tabela procedimento_pms_envolvidos")
                        continue

                    pm_envolvido_id = pm_envolvido_result['id']

                    # Usar a função dedicada para salvar indícios (passando conexão e cursor)
                    resultado = salvar_indicios_pm_envolvido(pm_envolvido_id, dados_indicios, conn, cursor)

                    if resultado.get('sucesso'):
                        # Extrair contagens para log
                        categorias = dados_indicios.get('categorias', [])
                        crimes = dados_indicios.get('crimes', [])
                        rdpm = dados_indicios.get('rdpm', [])
                        art29 = dados_indicios.get('art29', [])
                        print(f"✅ Indícios salvos para PM {pm_id}: {len(categorias)} categorias, {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")
                    else:
                        print(f"❌ Falha ao salvar indícios do PM {pm_id}: {resultado.get('mensagem', 'Erro desconhecido')}")

                print(f"🎯 Processamento de indícios por PM concluído: {len(indicios_por_pm)} PMs processados")

        except Exception as _e:
            print(f"Aviso: falha ao processar indícios por PM: {_e}")

        conn.commit()
        conn.close()

        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('processos_procedimentos', processo_id, 'CREATE', usuario_id_logado)

        print(f"✅ Processo registrado com sucesso: {numero}")
        return {"sucesso": True, "mensagem": "Processo/Procedimento registrado com sucesso!"}

    except psycopg2.IntegrityError as e:
        print(f"❌ Erro de integridade no banco de dados: {str(e)}")
        if "numero, documento_iniciador, tipo_detalhe, ano_instauracao, local_origem" in str(e).lower() or "unique" in str(e).lower():
            local_msg = f" no {local_origem}" if local_origem else ""
            tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
            return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} número {numero}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}."}
        elif "numero_controle, documento_iniciador, tipo_detalhe, ano_instauracao, local_origem" in str(e).lower():
            local_msg = f" no {local_origem}" if local_origem else ""
            tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
            return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} com número de controle {numero_controle}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}."}
        else:
            return {"sucesso": False, "mensagem": "Erro de integridade no banco de dados."}
    except Exception as e:
        print(f"❌ Erro ao registrar processo: {str(e)}")
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao registrar processo/procedimento: {str(e)}"}


def listar_processos(db_manager):
    """
    Lista todos os processos cadastrados

    Args:
        db_manager: Gerenciador de banco de dados

    Returns:
        list: Lista de processos com seus dados formatados
    """
    conn = db_manager.get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cursor.execute("""
        SELECT
            p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
            CASE
                WHEN p.tipo_geral = 'processo' AND p.tipo_detalhe IN ('PAD','CD','CJ') AND p.responsavel_id IS NULL THEN 'Não se aplica'
                ELSE COALESCE(u1.nome, 'Desconhecido')
            END as responsavel,
            p.created_at,
            p.local_origem,
            p.data_instauracao,
            p.status_pm,
            CASE
                WHEN p.nome_pm_id IS NOT NULL THEN COALESCE(u2.nome, 'Desconhecido')
                ELSE NULL
            END as nome_pm,
            p.numero_portaria,
            p.numero_memorando,
            p.numero_feito,
            p.responsavel_id,
            p.responsavel_tipo,
            COALESCE(u1.posto_graduacao, '') as responsavel_pg,
            COALESCE(u1.matricula, '') as responsavel_matricula,
            COALESCE(u2.posto_graduacao, '') as nome_pm_pg,
            COALESCE(u2.matricula, '') as nome_pm_matricula,
            p.numero_rgf,
            p.numero_controle,
            p.concluido,
            p.data_conclusao
    FROM processos_procedimentos p
    LEFT JOIN usuarios u1 ON p.responsavel_id = u1.id
    LEFT JOIN usuarios u2 ON p.nome_pm_id = u2.id
        WHERE p.ativo = TRUE
        ORDER BY p.created_at DESC
    """)

    processos = cursor.fetchall()
    conn.close()

    # Formatar o número do procedimento baseado no numero_controle
    def formatar_numero_processo(processo):
        numero_controle = processo['numero_controle']
        tipo_detalhe = processo['tipo_detalhe']
        documento = processo['documento_iniciador']
        local_origem = processo['local_origem'] or ""
        data_instauracao = processo['data_instauracao'] or ""
        ano_instauracao = ""

        # Extrair o ano da data de instauração, se disponível
        if data_instauracao:
            try:
                ano_instauracao = str(datetime.strptime(str(data_instauracao), "%Y-%m-%d").year)
            except:
                ano_instauracao = ""

        # Usar numero_controle para formatação
        if numero_controle:
            return f"{tipo_detalhe} nº {numero_controle}/{local_origem}/{ano_instauracao}"
        else:
            # Fallback para o número do documento se numero_controle estiver vazio
            numero_documento = processo['numero']
            if numero_documento:
                return f"{tipo_detalhe} nº {numero_documento}/{local_origem}/{ano_instauracao}"

        return "S/N"

    def formatar_pms_envolvidos(processo):
        """Formata a exibição dos PMs envolvidos considerando múltiplos PMs para procedimentos"""
        tipo_geral = processo['tipo_geral']
        processo_id = processo['id']

        # Se for procedimento, buscar múltiplos PMs
        if tipo_geral == 'procedimento':
            pms_envolvidos = buscar_pms_envolvidos(db_manager, processo_id)

            if pms_envolvidos:
                # Se há múltiplos PMs, mostrar primeiro + "e outros"
                primeiro_pm = pms_envolvidos[0]['nome_completo']

                if len(pms_envolvidos) > 1:
                    pm_display = f"{primeiro_pm} e outros"
                    # Criar tooltip com todos os nomes
                    todos_nomes = [pm['nome_completo'] for pm in pms_envolvidos]
                    tooltip = ", ".join(todos_nomes)
                else:
                    pm_display = primeiro_pm
                    tooltip = primeiro_pm

                return {
                    'display': pm_display,
                    'tooltip': tooltip
                }
            else:
                # Fallback para PM único se não há múltiplos
                pm_nome = processo['nome_pm']
                pm_posto = processo['nome_pm_pg'] or ""
                pm_matricula = processo['nome_pm_matricula'] or ""

                if pm_nome:
                    pm_completo = f"{pm_posto} {pm_matricula} {pm_nome}".strip()
                    return {
                        'display': pm_completo,
                        'tooltip': pm_completo
                    }
                else:
                    return {
                        'display': 'Não informado',
                        'tooltip': 'Não informado'
                    }
        else:
            # Para processos, usar PM único
            pm_nome = processo['nome_pm']
            pm_posto = processo['nome_pm_pg'] or ""
            pm_matricula = processo['nome_pm_matricula'] or ""

            if pm_nome:
                pm_completo = f"{pm_posto} {pm_matricula} {pm_nome}".strip()
                return {
                    'display': pm_completo,
                    'tooltip': pm_completo
                }
            else:
                return {
                    'display': 'Não informado',
                    'tooltip': 'Não informado'
                }

    resultado = []
    for processo in processos:
        pms_info = formatar_pms_envolvidos(processo)

        resultado.append({
            "id": processo['id'],
            "numero": processo['numero'],
            "numero_controle": processo['numero_controle'],
            "numero_formatado": formatar_numero_processo(processo),
            "tipo_geral": processo['tipo_geral'],
            "tipo_detalhe": processo['tipo_detalhe'],
            "documento_iniciador": processo['documento_iniciador'],
            "processo_sei": processo['processo_sei'],
            "responsavel": processo['responsavel'],
            "responsavel_posto_grad": processo['responsavel_pg'] or "",
            "responsavel_matricula": processo['responsavel_matricula'] or "",
            "data_criacao": processo['created_at'],
            "local_origem": processo['local_origem'],
            "data_instauracao": processo['data_instauracao'],
            "status_pm": processo['status_pm'],
            "nome_pm": processo['nome_pm'],
            "nome_pm_posto_grad": processo['nome_pm_pg'] or "",
            "nome_pm_matricula": processo['nome_pm_matricula'] or "",
            "numero_rgf": processo['numero_rgf'] or "",
            "concluido": bool(processo['concluido']) if processo.get('concluido') is not None else False,
            "data_conclusao": processo.get('data_conclusao'),
            "responsavel_completo": f"{processo['responsavel_pg'] or ''} {processo['responsavel_matricula'] or ''} {processo['responsavel']}".strip(),
            "nome_pm_completo": f"{processo['nome_pm_pg'] or ''} {processo['nome_pm_matricula'] or ''} {processo['nome_pm'] or ''}".strip() if processo['nome_pm'] else None,
            "pm_envolvido_nome": pms_info['display'],
            "pm_envolvido_tooltip": pms_info['tooltip']
        })

    return resultado


def obter_processo(db_manager, processo_id):
    """
    Obtém dados de um processo específico para edição

    Args:
        db_manager: Gerenciador de banco de dados
        processo_id: ID do processo

    Returns:
        dict ou None: Dados completos do processo ou None se não encontrado
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute(
            """
            SELECT
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
                p.responsavel_id, p.responsavel_tipo,
                COALESCE(u_resp.nome, 'Desconhecido') as responsavel_nome,
                p.local_origem, p.local_fatos, p.data_instauracao, p.data_recebimento, p.escrivao_id, p.status_pm, p.nome_pm_id,
                p.nome_vitima, p.natureza_processo, p.natureza_procedimento, p.resumo_fatos,
                p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf, p.numero_controle,
                p.concluido, p.data_conclusao, p.solucao_final, p.transgressoes_ids,
                p.data_remessa_encarregado, p.data_julgamento, p.solucao_tipo, p.penalidade_tipo, p.penalidade_dias, p.indicios_categorias,
                -- Dados completos do responsável
                COALESCE(u_resp.posto_graduacao, '') as responsavel_posto,
                COALESCE(u_resp.matricula, '') as responsavel_matricula,
                -- Dados completos do escrivão (procedimentos)
                COALESCE(u_esc.nome, '') as escrivao_nome,
                COALESCE(u_esc.posto_graduacao, '') as escrivao_posto,
                COALESCE(u_esc.matricula, '') as escrivao_matricula,
                -- Dados completos do PM envolvido
                COALESCE(u_pm.nome, '') as pm_nome,
                COALESCE(u_pm.posto_graduacao, '') as pm_posto,
                COALESCE(u_pm.matricula, '') as pm_matricula,
                -- IDs e tipos das funções de processo (PAD/CD/CJ)
                p.presidente_id, p.presidente_tipo,
                p.interrogante_id, p.interrogante_tipo,
                p.escrivao_processo_id, p.escrivao_processo_tipo,
                -- Dados completos das funções do processo
                COALESCE(u_pres.nome, '') as presidente_nome,
                COALESCE(u_pres.posto_graduacao, '') as presidente_posto,
                COALESCE(u_pres.matricula, '') as presidente_matricula,
                COALESCE(u_int.nome, '') as interrogante_nome,
                COALESCE(u_int.posto_graduacao, '') as interrogante_posto,
                COALESCE(u_int.matricula, '') as interrogante_matricula,
                COALESCE(u_escrp.nome, '') as escrivao_processo_nome,
                COALESCE(u_escrp.posto_graduacao, '') as escrivao_processo_posto,
                COALESCE(u_escrp.matricula, '') as escrivao_processo_matricula,
                -- Dados do motorista para sinistros de trânsito
                p.motorista_id,
                COALESCE(u_mot.nome, '') as motorista_nome,
                COALESCE(u_mot.posto_graduacao, '') as motorista_posto,
                COALESCE(u_mot.matricula, '') as motorista_matricula,
                -- Dados específicos de Carta Precatória (CP)
                p.unidade_deprecada,
                p.deprecante,
                p.pessoas_inquiridas
            FROM processos_procedimentos p
            LEFT JOIN usuarios u_resp ON p.responsavel_id = u_resp.id
            LEFT JOIN usuarios u_esc ON p.escrivao_id = u_esc.id
            LEFT JOIN usuarios u_pm ON p.nome_pm_id = u_pm.id
            LEFT JOIN usuarios u_pres ON p.presidente_id = u_pres.id
            LEFT JOIN usuarios u_int ON p.interrogante_id = u_int.id
            LEFT JOIN usuarios u_escrp ON p.escrivao_processo_id = u_escrp.id
            LEFT JOIN usuarios u_mot ON p.motorista_id = u_mot.id
            WHERE p.id = %s AND p.ativo = TRUE
            """,
            (processo_id,)
        )

        processo = cursor.fetchone()
        conn.close()

        if not processo:
            return None

        # Formatar dados completos dos usuários
        responsavel_completo = ""
        if processo['responsavel_posto'] and processo['responsavel_matricula'] and processo['responsavel_nome']:
            responsavel_completo = f"{processo['responsavel_posto']} {processo['responsavel_matricula']} {processo['responsavel_nome']}".strip()
        elif processo['responsavel_nome']:
            responsavel_completo = processo['responsavel_nome']

        escrivao_completo = ""
        if processo['escrivao_posto'] and processo['escrivao_matricula'] and processo['escrivao_nome']:
            escrivao_completo = f"{processo['escrivao_posto']} {processo['escrivao_matricula']} {processo['escrivao_nome']}".strip()

        pm_completo = ""
        if processo['pm_posto'] and processo['pm_matricula'] and processo['pm_nome']:
            pm_completo = f"{processo['pm_posto']} {processo['pm_matricula']} {processo['pm_nome']}".strip()

        # Para procedimentos, buscar múltiplos PMs envolvidos
        pms_envolvidos = []
        if processo['tipo_geral'] == 'procedimento':
            pms_envolvidos = buscar_pms_envolvidos(db_manager, processo_id)

        # Processar transgressões (campo JSON) - suporta formato antigo e novo
        transgressoes_selecionadas = []
        if processo['transgressoes_ids']:
            try:
                transgressoes_data = json.loads(processo['transgressoes_ids'])

                if isinstance(transgressoes_data, list) and len(transgressoes_data) > 0:
                    conn2 = db_manager.get_connection()
                    cursor2 = conn2.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

                    # Verificar se é formato novo (com natureza) ou antigo (só IDs)
                    primeiro_item = transgressoes_data[0]

                    if isinstance(primeiro_item, dict):
                        # Formato novo: pode ser RDPM ou Art. 29
                        for trans_data in transgressoes_data:
                            tipo = trans_data.get('tipo', 'rdpm')  # padrão RDPM para compatibilidade

                            if tipo == 'estatuto':
                                # Infração do Art. 29 com analogia RDPM
                                art29_id = trans_data.get('id')
                                analogia_data = trans_data.get('rdmp_analogia', {})

                                # Buscar dados do Art. 29
                                cursor2.execute("SELECT id, inciso, texto FROM infracoes_estatuto_art29 WHERE id = %s AND ativo = TRUE", (art29_id,))
                                art29_trans = cursor2.fetchone()

                                if art29_trans:
                                    # Buscar dados completos da analogia RDPM
                                    analogia_completa = analogia_data.copy()
                                    if analogia_data.get('id'):
                                        cursor2.execute("SELECT id, inciso, texto FROM transgressoes WHERE id = %s AND ativo = TRUE", (analogia_data.get('id'),))
                                        rdpm_trans = cursor2.fetchone()
                                        if rdpm_trans:
                                            analogia_completa.update({
                                                'inciso': rdpm_trans['inciso'],
                                                'texto': rdpm_trans['texto']
                                            })

                                    transgressoes_selecionadas.append({
                                        'id': art29_trans['id'],
                                        'inciso': art29_trans['inciso'],
                                        'texto': art29_trans['texto'],
                                        'tipo': 'estatuto',
                                        'rdmp_analogia': analogia_completa
                                    })
                            else:
                                # Infração do RDPM (formato novo)
                                trans_id = trans_data.get('id')
                                natureza = trans_data.get('natureza', 'leve')

                                cursor2.execute("SELECT id, inciso, texto FROM transgressoes WHERE id = %s AND ativo = TRUE", (trans_id,))
                                trans = cursor2.fetchone()
                                if trans:
                                    transgressoes_selecionadas.append({
                                        'id': trans['id'],
                                        'inciso': trans['inciso'],
                                        'texto': trans['texto'],
                                        'natureza': natureza,
                                        'tipo': 'rdpm'
                                    })
                    else:
                        # Formato antigo: ["8", "21", "31"] - buscar natureza na tabela (só RDPM)
                        for trans_id in transgressoes_data:
                            cursor2.execute("SELECT id, inciso, texto, gravidade FROM transgressoes WHERE id = %s AND ativo = TRUE", (trans_id,))
                            trans = cursor2.fetchone()
                            if trans:
                                transgressoes_selecionadas.append({
                                    'id': trans['id'],
                                    'inciso': trans['inciso'],
                                    'texto': trans['texto'],
                                    'natureza': trans['gravidade'],  # gravidade da tabela
                                    'tipo': 'rdpm'
                                })

                    conn2.close()
            except (json.JSONDecodeError, TypeError) as e:
                print(f"Erro ao processar transgressões do processo {processo_id}: {e}")
                transgressoes_selecionadas = []

        # Carregar indícios associados
        def _carregar_indicios(pid):
            ind = {"crimes": [], "rdpm": [], "art29": []}
            conn_i = db_manager.get_connection()
            cur_i = conn_i.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            # crimes_contravencoes
            try:
                cur_i.execute(
                    """
                    SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo, c.paragrafo, c.inciso, c.alinea
                    FROM procedimentos_indicios_crimes pic
                    JOIN crimes_contravencoes c ON c.id = pic.crime_id
                    WHERE pic.procedimento_id = %s
                    """,
                    (pid,)
                )
                for row in cur_i.fetchall():
                    ind["crimes"].append({
                        "id": row['id'],
                        "tipo": row['tipo'],
                        "dispositivo_legal": row['dispositivo_legal'],
                        "artigo": row['artigo'],
                        "descricao_artigo": row['descricao_artigo'],
                        "paragrafo": row['paragrafo'] or "",
                        "inciso": row['inciso'] or "",
                        "alinea": row['alinea'] or ""
                    })
            except Exception:
                pass
            # rdpm
            try:
                cur_i.execute(
                    """
                    SELECT t.id, t.artigo, t.gravidade, t.inciso, t.texto
                    FROM procedimentos_indicios_rdpm pir
                    JOIN transgressoes t ON t.id = pir.transgressao_id
                    WHERE pir.procedimento_id = %s
                    """,
                    (pid,)
                )
                for row in cur_i.fetchall():
                    ind["rdpm"].append({
                        "id": row['id'],
                        "artigo": row['artigo'],
                        "gravidade": row['gravidade'],
                        "inciso": row['inciso'],
                        "texto": row['texto']
                    })
            except Exception:
                pass
            # art29 - PostgreSQL: sempre usar 'art29_id'
            try:
                cur_i.execute(
                    """
                    SELECT a.id, a.inciso, a.texto
                    FROM procedimentos_indicios_art29 pia
                    JOIN infracoes_estatuto_art29 a ON a.id = pia.art29_id
                    WHERE pia.procedimento_id = %s
                    """,
                    (pid,)
                )
                for row in cur_i.fetchall():
                    ind["art29"].append({
                        "id": row['id'],
                        "inciso": row['inciso'],
                        "texto": row['texto']
                    })
            except Exception:
                pass
            conn_i.close()
            return ind

        indicios = _carregar_indicios(processo_id)

        # Carregar indícios por PM para procedimentos
        indicios_por_pm = {}
        if processo['tipo_geral'] == 'procedimento':
            print(f"🔍 Carregando indícios por PM para procedimento {processo_id}")

            # Caso 1: Procedimentos com múltiplos PMs (IPM, ITM, etc.)
            if pms_envolvidos:
                for pm_envolvido in pms_envolvidos:
                    pm_envolvido_id = pm_envolvido.get('pm_envolvido_id')
                    if pm_envolvido_id:
                        indicios_pm = buscar_indicios_por_pm(db_manager, pm_envolvido_id)
                        if indicios_pm:
                            indicios_por_pm[pm_envolvido['id']] = indicios_pm
                            print(f"✅ Indícios carregados para PM {pm_envolvido['nome_completo']}: {indicios_pm}")

            # Caso 2: Procedimentos com único PM (SR, outros)
            # Para compatibilidade, buscar também indícios do PM principal (nome_pm_id)
            elif processo['nome_pm_id']:
                print(f"🔍 Procedimento com PM único, buscando indícios do PM principal ID {processo['nome_pm_id']}")
                # Buscar pm_envolvido_id na tabela de relacionamento
                conn_temp = db_manager.get_connection()
                cursor_temp = conn_temp.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cursor_temp.execute("""
                    SELECT id FROM procedimento_pms_envolvidos
                    WHERE procedimento_id = %s AND pm_id = %s
                """, (processo_id, processo['nome_pm_id']))
                pm_envolvido_result = cursor_temp.fetchone()
                conn_temp.close()

                if pm_envolvido_result:
                    pm_envolvido_id = pm_envolvido_result['id']
                    indicios_pm = buscar_indicios_por_pm(db_manager, pm_envolvido_id)
                    if indicios_pm:
                        # Usar o nome_pm_id como chave para manter compatibilidade com frontend
                        indicios_por_pm[processo['nome_pm_id']] = indicios_pm
                        print(f"✅ Indícios carregados para PM único (ID {processo['nome_pm_id']}): {indicios_pm}")

            print(f"📋 Total de PMs com indícios carregados: {len(indicios_por_pm)}")

        # Montar nomes completos das funções de processo (campos adicionados ao final)
        presidente_completo = ""
        if processo['presidente_posto'] and processo['presidente_matricula'] and processo['presidente_nome']:
            presidente_completo = f"{processo['presidente_posto']} {processo['presidente_matricula']} {processo['presidente_nome']}".strip()

        interrogante_completo = ""
        if processo['interrogante_posto'] and processo['interrogante_matricula'] and processo['interrogante_nome']:
            interrogante_completo = f"{processo['interrogante_posto']} {processo['interrogante_matricula']} {processo['interrogante_nome']}".strip()

        escrivao_processo_completo = ""
        if processo['escrivao_processo_posto'] and processo['escrivao_processo_matricula'] and processo['escrivao_processo_nome']:
            escrivao_processo_completo = f"{processo['escrivao_processo_posto']} {processo['escrivao_processo_matricula']} {processo['escrivao_processo_nome']}".strip()

        motorista_completo = ""
        if processo['motorista_posto'] and processo['motorista_matricula'] and processo['motorista_nome']:
            motorista_completo = f"{processo['motorista_posto']} {processo['motorista_matricula']} {processo['motorista_nome']}".strip()
        elif processo['motorista_nome']:
            motorista_completo = processo['motorista_nome']

        return {
            "id": processo['id'],
            "numero": processo['numero'],
            "tipo_geral": processo['tipo_geral'],
            "tipo_detalhe": processo['tipo_detalhe'],
            "documento_iniciador": processo['documento_iniciador'],
            "processo_sei": processo['processo_sei'],
            "responsavel_id": processo['responsavel_id'],
            "responsavel_tipo": processo['responsavel_tipo'],
            "responsavel_nome": processo['responsavel_nome'],
            "responsavel_completo": responsavel_completo,
            "local_origem": processo['local_origem'],
            "local_fatos": processo['local_fatos'],
            "data_instauracao": str(processo['data_instauracao']) if processo['data_instauracao'] else None,
            "data_recebimento": str(processo['data_recebimento']) if processo['data_recebimento'] else None,
            "escrivao_id": processo['escrivao_id'],
            "escrivao_completo": escrivao_completo,
            "status_pm": processo['status_pm'],
            "nome_pm_id": processo['nome_pm_id'],
            "pm_completo": pm_completo,
            "pms_envolvidos": pms_envolvidos,
            "nome_vitima": processo['nome_vitima'],
            "natureza_processo": _determinar_natureza_processo(processo['natureza_processo'], transgressoes_selecionadas),
            "natureza_procedimento": processo['natureza_procedimento'],
            "resumo_fatos": processo['resumo_fatos'],
            "numero_portaria": processo['numero_portaria'],
            "numero_memorando": processo['numero_memorando'],
            "numero_feito": processo['numero_feito'],
            "numero_rgf": processo['numero_rgf'],
            "numero_controle": processo['numero_controle'],
            "concluido": processo['concluido'],
            "data_conclusao": str(processo['data_conclusao']) if processo['data_conclusao'] else None,
            "solucao_final": processo['solucao_final'],
            "transgressoes_ids": processo['transgressoes_ids'],
            "transgressoes_selecionadas": transgressoes_selecionadas,
            # Novos campos
            "data_remessa_encarregado": str(processo['data_remessa_encarregado']) if processo['data_remessa_encarregado'] else None,
            "data_julgamento": str(processo['data_julgamento']) if processo['data_julgamento'] else None,
            "solucao_tipo": processo['solucao_tipo'],
            "penalidade_tipo": processo['penalidade_tipo'],
            "penalidade_dias": processo['penalidade_dias'],
            "indicios_categorias": processo['indicios_categorias'],
            "indicios": indicios,
            "indicios_por_pm": indicios_por_pm,
            # Funções específicas do processo (PAD/CD/CJ)
            "presidente_id": processo['presidente_id'],
            "presidente_tipo": processo['presidente_tipo'],
            "interrogante_id": processo['interrogante_id'],
            "interrogante_tipo": processo['interrogante_tipo'],
            "escrivao_processo_id": processo['escrivao_processo_id'],
            "escrivao_processo_tipo": processo['escrivao_processo_tipo'],
            "presidente_nome": processo['presidente_nome'],
            "presidente_completo": presidente_completo,
            "interrogante_nome": processo['interrogante_nome'],
            "interrogante_completo": interrogante_completo,
            "escrivao_processo_nome": processo['escrivao_processo_nome'],
            "escrivao_processo_completo": escrivao_processo_completo,
            # Motorista (sinistros de trânsito)
            "motorista_id": processo['motorista_id'],
            "motorista_nome": processo['motorista_nome'],
            "motorista_completo": motorista_completo,
            # Campos específicos de Carta Precatória (CP)
            "unidade_deprecada": processo['unidade_deprecada'],
            "deprecante": processo['deprecante'],
            "pessoas_inquiridas": processo['pessoas_inquiridas'],
        }
    except Exception as e:
        print(f"Erro ao obter processo: {e}")
        return None


def obter_procedimento_completo(db_manager, procedimento_id):
    """
    Obtém dados consolidados para a página de visualização

    Args:
        db_manager: Gerenciador de banco de dados
        procedimento_id: ID do procedimento

    Returns:
        dict: {"sucesso": bool, "procedimento": dict ou None, "mensagem": str (se erro)}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute(
            """
            SELECT
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador,
                p.processo_sei, p.local_origem, p.local_fatos,
                p.data_instauracao, p.data_recebimento, p.data_conclusao,
                p.concluido, p.status_pm, p.nome_pm_id,
                p.responsavel_id, p.escrivao_id, p.resumo_fatos,
                p.numero_controle, p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf,
                p.natureza_processo, p.natureza_procedimento, p.solucao_final,
                p.created_at, p.updated_at, p.ano_instauracao, p.transgressoes_ids,
                p.data_remessa_encarregado, p.data_julgamento, p.solucao_tipo, p.penalidade_tipo, p.penalidade_dias, p.indicios_categorias,
                p.presidente_id, p.interrogante_id, p.escrivao_processo_id
            FROM processos_procedimentos p
            WHERE p.id = %s AND p.ativo = TRUE
            """,
            (procedimento_id,)
        )

        row = cursor.fetchone()
        conn.close()

        if not row:
            return {"sucesso": False, "mensagem": "Procedimento não encontrado."}

        # Mapear campos para o formato esperado pelo front
        concluido_flag = bool(row['concluido']) if row['concluido'] is not None else False
        situacao = "Concluído" if concluido_flag else "Em Andamento"

        # Tentar obter transgressões detalhadas reutilizando a função existente
        trans_info = obter_processo(db_manager, procedimento_id)
        trans_sel = []
        indicios_por_pm = {}
        if isinstance(trans_info, dict) and trans_info.get('transgressoes_selecionadas') is not None:
            trans_sel = trans_info.get('transgressoes_selecionadas')
            indicios_por_pm = trans_info.get('indicios_por_pm', {})

        # Carregar indícios já usando a função obter_processo para consolidar
        proc_edicao = obter_processo(db_manager, procedimento_id) or {}
        indicios = proc_edicao.get('indicios') if isinstance(proc_edicao, dict) else None

        # Função auxiliar para converter datas
        def format_date(d):
            if d is None:
                return None
            if hasattr(d, 'strftime'):
                return d.strftime("%Y-%m-%d")
            return str(d)

        procedimento = {
            "id": row['id'],
            "numero": row['numero'],
            "tipo_geral": row['tipo_geral'],
            "tipo_procedimento": row['tipo_detalhe'],
            "documento_iniciador": row['documento_iniciador'],
            "processo_sei": row['processo_sei'],
            "local_origem": row['local_origem'],
            "local_fatos": row['local_fatos'],
            "data_abertura": format_date(row['data_instauracao']),
            "data_recebimento": format_date(row['data_recebimento']),
            "data_conclusao": format_date(row['data_conclusao']),
            "situacao": situacao,
            "status_pm": row['status_pm'],
            "nome_pm_id": row['nome_pm_id'],
            "responsavel_id": row['responsavel_id'],
            "escrivao_id": row['escrivao_id'],
            "resumo_fatos": row['resumo_fatos'],
            "numero_controle": row['numero_controle'],
            "numero_portaria": row['numero_portaria'],
            "numero_memorando": row['numero_memorando'],
            "numero_feito": row['numero_feito'],
            "numero_rgf": row['numero_rgf'],
            "natureza_processo": row['natureza_processo'],
            "natureza_procedimento": row['natureza_procedimento'],
            "solucao_final": row['solucao_final'],
            "created_at": row['created_at'],
            "updated_at": row['updated_at'],
            "ano_instauracao": row['ano_instauracao'],
            "transgressoes_ids": row['transgressoes_ids'],
            "transgressoes_selecionadas": trans_sel,
            # Novos campos (Migração 014)
            "data_remessa_encarregado": format_date(row['data_remessa_encarregado']),
            "data_julgamento": format_date(row['data_julgamento']),
            "solucao_tipo": row['solucao_tipo'],
            "penalidade_tipo": row['penalidade_tipo'],
            "penalidade_dias": row['penalidade_dias'],
            "indicios_categorias": row['indicios_categorias'],
            "indicios": indicios,
            "indicios_por_pm": indicios_por_pm,
            # Campos para CJ, CD e PAD
            "presidente_id": row['presidente_id'],
            "interrogante_id": row['interrogante_id'],
            "escrivao_processo_id": row['escrivao_processo_id']
        }

        return {"sucesso": True, "procedimento": procedimento}
    except Exception as e:
        print(f"Erro em obter_procedimento_completo: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao obter procedimento: {str(e)}"}


def obter_encarregados_procedimento(db_manager, procedimento_id):
    """
    Retorna responsável e escrivão (se houver) para o procedimento.
    Para CJ, CD e PAD retorna presidente, interrogante e escrivão do processo.

    Args:
        db_manager: Gerenciador de banco de dados
        procedimento_id: ID do procedimento

    Returns:
        dict: {"sucesso": bool, "encarregados": list, "mensagem": str (se erro)}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar tipo_detalhe para verificar se é CJ, CD ou PAD
        cursor.execute(
            """
            SELECT responsavel_id, escrivao_id, tipo_detalhe, presidente_id, interrogante_id, escrivao_processo_id
            FROM processos_procedimentos
            WHERE id = %s AND ativo = TRUE
            """,
            (procedimento_id,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"sucesso": True, "encarregados": []}

        responsavel_id = row['responsavel_id']
        escrivao_id = row['escrivao_id']
        tipo_detalhe = row['tipo_detalhe']
        presidente_id = row['presidente_id']
        interrogante_id = row['interrogante_id']
        escrivao_processo_id = row['escrivao_processo_id']

        def _buscar_usuario(user_id):
            if not user_id:
                return None
            # Busca na tabela usuarios unificada
            cursor.execute(
                "SELECT nome, posto_graduacao, matricula FROM usuarios WHERE id = %s AND ativo = TRUE",
                (user_id,)
            )
            u = cursor.fetchone()
            if u:
                return {"nome": u['nome'], "posto_graduacao": u['posto_graduacao'], "matricula": u['matricula']}
            return None

        encarregados = []

        # Se for CJ, CD ou PAD, mostrar Presidente, Interrogante e Escrivão do Processo
        if tipo_detalhe in ['CJ', 'CD', 'PAD']:
            pres = _buscar_usuario(presidente_id)
            if pres:
                encarregados.append({
                    "tipo_encarregado": "Presidente",
                    **pres
                })

            interrog = _buscar_usuario(interrogante_id)
            if interrog:
                encarregados.append({
                    "tipo_encarregado": "Interrogante",
                    **interrog
                })

            esc_proc = _buscar_usuario(escrivao_processo_id)
            if esc_proc:
                encarregados.append({
                    "tipo_encarregado": "Escrivão do Processo",
                    **esc_proc
                })
        else:
            # Para outros tipos, mostrar Responsável e Escrivão normalmente
            resp = _buscar_usuario(responsavel_id)
            if resp:
                encarregados.append({
                    "tipo_encarregado": "Responsável",
                    **resp
                })

            esc = _buscar_usuario(escrivao_id)
            if esc:
                encarregados.append({
                    "tipo_encarregado": "Escrivão",
                    **esc
                })

        conn.close()
        return {"sucesso": True, "encarregados": encarregados}
    except Exception as e:
        print(f"Erro em obter_encarregados_procedimento: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return {"sucesso": False, "mensagem": f"Erro ao obter encarregados: {str(e)}"}


def obter_envolvidos_procedimento(db_manager, procedimento_id):
    """
    Retorna os envolvidos do procedimento (múltiplos para procedimentos ou único para processos)

    Args:
        db_manager: Gerenciador de banco de dados
        procedimento_id: ID do procedimento

    Returns:
        dict: {"sucesso": bool, "envolvidos": list, "mensagem": str (se erro)}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar tipo_geral e possível vítima/ofendido
        cursor.execute(
            "SELECT tipo_geral, nome_vitima FROM processos_procedimentos WHERE id = %s AND ativo = TRUE",
            (procedimento_id,)
        )
        row_head = cursor.fetchone()
        tipo_geral_val = row_head['tipo_geral'] if row_head else None
        nome_vitima_val = row_head['nome_vitima'] if row_head else None

        # Verificar se há registros na tabela de múltiplos PMs (procedimentos)
        cursor.execute(
            "SELECT COUNT(*) FROM procedimento_pms_envolvidos WHERE procedimento_id = %s",
            (procedimento_id,)
        )
        count = cursor.fetchone()['count']

        envolvidos = []

        if count and count > 0:
            # Usar função auxiliar já existente para montar dados do PM
            pms = buscar_pms_envolvidos(db_manager, procedimento_id)
            for pm in pms:
                envolvidos.append({
                    "usuario_id": pm.get("id"),  # ID do usuário para vincular com indícios
                    "nome": pm.get("nome"),
                    "posto_graduacao": pm.get("posto_graduacao"),
                    "matricula": pm.get("matricula"),
                    "tipo_envolvimento": pm.get("status_pm") or "Envolvido"
                })
        else:
            # Tentar carregar envolvido único do próprio processo
            cursor.execute(
                """
                SELECT p.status_pm, p.nome_pm_id,
                       COALESCE(u.nome, '') as nome,
                       COALESCE(u.posto_graduacao, '') as posto,
                       COALESCE(u.matricula, '') as matricula
                FROM processos_procedimentos p
                LEFT JOIN usuarios u ON p.nome_pm_id = u.id
                WHERE p.id = %s AND p.ativo = TRUE
                """,
                (procedimento_id,)
            )
            row = cursor.fetchone()
            if row and (row['nome'] or row['posto'] or row['matricula']):
                envolvidos.append({
                    "usuario_id": row['nome_pm_id'],  # Incluir usuario_id para consistência
                    "nome": row['nome'],
                    "posto_graduacao": row['posto'],
                    "matricula": row['matricula'],
                    "tipo_envolvimento": row['status_pm'] or "Envolvido"
                })

        # Para procedimentos, também listar a vítima/ofendido se existir
        if tipo_geral_val == 'procedimento' and nome_vitima_val and str(nome_vitima_val).strip():
            envolvidos.append({
                "nome": str(nome_vitima_val).strip(),
                "tipo_envolvimento": "Vítima/Ofendido",
                "posto_graduacao": "",
                "matricula": ""
            })

        conn.close()
        return {"sucesso": True, "envolvidos": envolvidos}
    except Exception as e:
        print(f"Erro em obter_envolvidos_procedimento: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return {"sucesso": False, "mensagem": f"Erro ao obter envolvidos: {str(e)}"}


def atualizar_processo(
    db_manager, usuario_logado, salvar_indicios_pm_envolvido,
    processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
    local_origem=None, local_fatos=None, data_instauracao=None, data_recebimento=None, escrivao_id=None, status_pm=None, nome_pm_id=None,
    nome_vitima=None, natureza_processo=None, natureza_procedimento=None, motorista_id=None, resumo_fatos=None,
    numero_portaria=None, numero_memorando=None, numero_feito=None, numero_rgf=None, numero_controle=None,
    concluido=False, data_conclusao=None, solucao_final=None, pms_envolvidos=None, transgressoes_ids=None,
    # Novos campos (Migração 014)
    data_remessa_encarregado=None, data_julgamento=None, solucao_tipo=None,
    penalidade_tipo=None, penalidade_dias=None, indicios_categorias=None,
    indicios_crimes=None, indicios_rdpm=None, indicios_art29=None,
    # Novos indícios por PM (Migração 015)
    indicios_por_pm=None,
    # Novos campos para PAD, CD, CJ (Migração 018)
    presidente_id=None, presidente_tipo=None,
    interrogante_id=None, interrogante_tipo=None,
    escrivao_processo_id=None, escrivao_processo_tipo=None,
    # Novos campos para Carta Precatória (Migração 025)
    unidade_deprecada=None, deprecante=None, pessoas_inquiridas=None
):
    """
    Atualiza um processo/procedimento existente

    Args:
        db_manager: Gerenciador de banco de dados
        usuario_logado: Dicionário com dados do usuário logado
        salvar_indicios_pm_envolvido: Função para salvar indícios por PM
        processo_id: ID do processo a ser atualizado
        ... demais parâmetros do processo

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        # Converter concluido para boolean (caso venha como int do frontend)
        if isinstance(concluido, int):
            concluido = bool(concluido)
        elif isinstance(concluido, str):
            concluido = concluido.lower() in ('true', '1', 'yes', 'sim')

        # NORMALIZAÇÃO: Converter valores antigos de responsavel_tipo para 'usuario'
        if responsavel_tipo in ('encarregado', 'operador'):
            print(f"⚠️ [ATUALIZAÇÃO] Convertendo responsavel_tipo de '{responsavel_tipo}' para 'usuario'")
            responsavel_tipo = 'usuario'

        # Converter pessoas_inquiridas para JSON string se for array/lista
        if pessoas_inquiridas is not None and isinstance(pessoas_inquiridas, (list, tuple)):
            pessoas_inquiridas = json.dumps(pessoas_inquiridas, ensure_ascii=False)

        # Validação do local_fatos (obrigatório)
        if not local_fatos:
            return {"sucesso": False, "mensagem": "O campo 'Local onde ocorreram os fatos' é obrigatório."}

        # Converter nome_vitima para JSON string se for array/lista
        # Se já for string JSON, deixar como está
        if nome_vitima is not None:
            if isinstance(nome_vitima, (list, tuple)):
                nome_vitima = json.dumps(nome_vitima, ensure_ascii=False)
            elif isinstance(nome_vitima, str):
                # Se for string, tentar fazer parse para verificar se é JSON
                try:
                    json.loads(nome_vitima)
                    # Já é JSON válido, manter como está
                except (json.JSONDecodeError, ValueError):
                    # Não é JSON, é um nome simples - converter para array JSON
                    nome_vitima = json.dumps([nome_vitima], ensure_ascii=False)

        # Extrair ano da data de instauração se fornecida
        ano_instauracao = None
        if data_instauracao:
            try:
                # data_instauracao está no formato YYYY-MM-DD
                ano_instauracao = str(data_instauracao)[:4]
            except:
                ano_instauracao = None

        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verificações específicas antes da atualização para mensagens de erro mais precisas
        print(f"🔍 Verificando conflitos na atualização: número={numero}, tipo={tipo_detalhe}, doc={documento_iniciador}, local={local_origem}, ano={ano_instauracao}")

        # Verificar conflito no número principal (excluindo o próprio registro, agora incluindo tipo_detalhe)
        cursor.execute("""
            SELECT id, numero, tipo_detalhe FROM processos_procedimentos
            WHERE numero = %s AND documento_iniciador = %s AND tipo_detalhe = %s AND local_origem = %s AND ano_instauracao = %s AND ativo = TRUE AND id != %s
        """, (numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao, processo_id))
        conflito_numero = cursor.fetchone()

        if conflito_numero:
            local_msg = f" no {local_origem}" if local_origem else ""
            tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
            return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} número {numero}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}."}

        # Verificar conflito no número de controle (se fornecido, excluindo o próprio registro, agora incluindo tipo_detalhe)
        if numero_controle:
            cursor.execute("""
                SELECT id, numero, numero_controle, tipo_detalhe FROM processos_procedimentos
                WHERE numero_controle = %s AND documento_iniciador = %s AND tipo_detalhe = %s AND local_origem = %s AND ano_instauracao = %s AND ativo = TRUE AND id != %s
            """, (numero_controle, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao, processo_id))
            conflito_controle = cursor.fetchone()

            if conflito_controle:
                local_msg = f" no {local_origem}" if local_origem else ""
                tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
                return {"sucesso": False, "mensagem": f"Já existe um(a) {documento_iniciador} com número de controle {numero_controle}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}. (Usado no(a) {conflito_controle['tipo_detalhe'] or tipo_detalhe} {conflito_controle['numero']})"}

        # Normalização defensiva antes do UPDATE
        if penalidade_tipo:
            mapping = {
                'Prisão': 'Prisao', 'Prisao': 'Prisao',
                'Detenção': 'Detencao', 'Detencao': 'Detencao',
                'Repreensão': 'Repreensao', 'Repreensao': 'Repreensao',
                # Novas penalidades específicas por tipo de processo
                'Licenciado_Disciplina': 'Licenciado_Disciplina',
                'Excluido_Disciplina': 'Excluido_Disciplina',
                'Demitido_Exoficio': 'Demitido_Exoficio'
            }
            penalidade_tipo = mapping.get(penalidade_tipo, penalidade_tipo)
        if (solucao_tipo or '').strip() != 'Punido':
            penalidade_tipo = None
            penalidade_dias = None
        else:
            if penalidade_tipo not in ('Prisao', 'Detencao'):
                penalidade_dias = None

        # Para PAD/CD/CJ, não existe 'Encarregado' do processo: deixar responsavel_id/tipo como NULL
        if (tipo_geral == 'processo') and (tipo_detalhe in ('PAD', 'CD', 'CJ')):
            print("ℹ️ Atualização de PAD/CD/CJ: definindo responsavel_id/responsavel_tipo como NULL")
            responsavel_id = None
            responsavel_tipo = None

        # Normalizar IDs vazios/estranhos e definir tipos das funções do processo
        # Isso garante que os JOINs funcionem nas listagens e no obter_processo
        # Corrigir casos em que o frontend envia listas/dicts vazios
        if isinstance(presidente_id, (list, dict)):
            presidente_id = None if not presidente_id else None
        if isinstance(interrogante_id, (list, dict)):
            interrogante_id = None if not interrogante_id else None
        if isinstance(escrivao_processo_id, (list, dict)):
            escrivao_processo_id = None if not escrivao_processo_id else None

        # Resolver tipo real com base em qual tabela contém o ID (operadores ou encarregados)
        def _resolve_user_tipo(_cursor, _id):
            if not _id:
                return None
            try:
                _cursor.execute("SELECT 1 FROM usuarios WHERE id = %s AND ativo = TRUE", (_id,))
                if _cursor.fetchone():
                    return 'usuario'
            except Exception:
                pass
            return None

        presidente_tipo = _resolve_user_tipo(cursor, presidente_id) if presidente_id else None
        interrogante_tipo = _resolve_user_tipo(cursor, interrogante_id) if interrogante_id else None
        escrivao_processo_tipo = _resolve_user_tipo(cursor, escrivao_processo_id) if escrivao_processo_id else None

        cursor.execute(
            """
            UPDATE processos_procedimentos
            SET numero = %s, tipo_geral = %s, tipo_detalhe = %s, documento_iniciador = %s,
                processo_sei = %s, responsavel_id = %s, responsavel_tipo = %s,
                local_origem = %s, local_fatos = %s, data_instauracao = %s, data_recebimento = %s, escrivao_id = %s, status_pm = %s, nome_pm_id = %s,
                nome_vitima = %s, natureza_processo = %s, natureza_procedimento = %s, resumo_fatos = %s,
                numero_portaria = %s, numero_memorando = %s, numero_feito = %s, numero_rgf = %s, numero_controle = %s,
                concluido = %s, data_conclusao = %s, solucao_final = %s, transgressoes_ids = %s, ano_instauracao = %s,
                data_remessa_encarregado = %s, data_julgamento = %s, solucao_tipo = %s, penalidade_tipo = %s, penalidade_dias = %s, indicios_categorias = %s,
                presidente_id = %s, presidente_tipo = %s, interrogante_id = %s, interrogante_tipo = %s, escrivao_processo_id = %s, escrivao_processo_tipo = %s,
                motorista_id = %s, unidade_deprecada = %s, deprecante = %s, pessoas_inquiridas = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
                local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
                nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
                numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
                concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
                data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
                presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
                motorista_id, unidade_deprecada, deprecante, pessoas_inquiridas,
                processo_id
            )
        )

        # Se for procedimento e tiver múltiplos PMs envolvidos, atualizar na nova tabela
        if tipo_geral == 'procedimento' and pms_envolvidos is not None:
            print(f"📝 Atualizando PMs envolvidos para procedimento: {pms_envolvidos}")

            # Buscar PMs existentes
            cursor.execute("SELECT id, pm_id FROM procedimento_pms_envolvidos WHERE procedimento_id = %s", (processo_id,))
            pms_existentes = {row['pm_id']: row['id'] for row in cursor.fetchall()}  # {pm_id: pm_envolvido_id}

            print(f"📋 PMs existentes no banco: {list(pms_existentes.keys())}")

            # IDs dos PMs que estão sendo enviados
            pms_novos_ids = set()

            # Atualizar ou inserir PMs
            for i, pm in enumerate(pms_envolvidos):
                if pm.get('id'):  # Verifica se o PM tem ID válido
                    pm_id = pm['id']
                    pms_novos_ids.add(pm_id)
                    pm_tipo = 'operador' if pm.get('tipo') == 'operador' else 'encarregado'
                    status_pm_env = pm.get('status_pm', status_pm)

                    if pm_id in pms_existentes:
                        # PM já existe, fazer UPDATE mantendo o ID
                        pm_envolvido_id = pms_existentes[pm_id]
                        cursor.execute("""
                            UPDATE procedimento_pms_envolvidos
                            SET pm_tipo = %s, ordem = %s, status_pm = %s
                            WHERE id = %s
                        """, (pm_tipo, i + 1, status_pm_env, pm_envolvido_id))
                        print(f"✅ PM {pm_id} atualizado (mantido ID {pm_envolvido_id})")
                    else:
                        # PM novo, fazer INSERT
                        novo_id = str(uuid.uuid4())
                        cursor.execute("""
                            INSERT INTO procedimento_pms_envolvidos (id, procedimento_id, pm_id, pm_tipo, ordem, status_pm)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (novo_id, processo_id, pm_id, pm_tipo, i + 1, status_pm_env))
                        print(f"➕ PM {pm_id} adicionado (novo ID {novo_id})")

            # Remover PMs que não estão mais na lista (mas manter os indícios vinculados)
            pms_para_remover = set(pms_existentes.keys()) - pms_novos_ids
            if pms_para_remover:
                print(f"🗑️ Removendo PMs que não estão mais na lista: {pms_para_remover}")
                for pm_id in pms_para_remover:
                    pm_envolvido_id = pms_existentes[pm_id]
                    # Marcar indícios como inativos em vez de deletar
                    cursor.execute("""
                        UPDATE pm_envolvido_indicios
                        SET ativo = FALSE
                        WHERE pm_envolvido_id = %s
                    """, (pm_envolvido_id,))
                    # Deletar o PM
                    cursor.execute("DELETE FROM procedimento_pms_envolvidos WHERE id = %s", (pm_envolvido_id,))


        # Substituir indícios (se fornecidos)
        def _parse_ids(lista_ids):
            if not lista_ids:
                return []
            ids = lista_ids
            if isinstance(lista_ids, str):
                try:
                    ids = json.loads(lista_ids)
                except Exception:
                    ids = []
            if isinstance(ids, dict):
                ids = list(ids.values())
            return [str(x) for x in ids if x is not None]

        try:
            # ⚠️ IMPORTANTE: Apenas processar indícios globais se NÃO houver indícios por PM
            # Isso evita duplicação quando o sistema novo (com múltiplos PMs) está sendo usado
            tem_indicios_por_pm = indicios_por_pm and isinstance(indicios_por_pm, dict) and len(indicios_por_pm) > 0

            if not tem_indicios_por_pm:
                print("📝 Processando indícios globais (sistema antigo)")

                # Limpar associações existentes
                cursor.execute("DELETE FROM procedimentos_indicios_crimes WHERE procedimento_id = %s", (processo_id,))
                cursor.execute("DELETE FROM procedimentos_indicios_rdpm WHERE procedimento_id = %s", (processo_id,))
                cursor.execute("DELETE FROM procedimentos_indicios_art29 WHERE procedimento_id = %s", (processo_id,))

                crimes_ids = _parse_ids(indicios_crimes)
                rdpm_ids = _parse_ids(indicios_rdpm)
                art29_ids = _parse_ids(indicios_art29)

                for cid in crimes_ids:
                    cursor.execute(
                        "INSERT INTO procedimentos_indicios_crimes (id, procedimento_id, crime_id) VALUES (%s, %s, %s)",
                        (str(uuid.uuid4()), processo_id, cid)
                    )
                for tid in rdpm_ids:
                    cursor.execute(
                        "INSERT INTO procedimentos_indicios_rdpm (id, procedimento_id, transgressao_id) VALUES (%s, %s, %s)",
                        (str(uuid.uuid4()), processo_id, tid)
                    )
                # PostgreSQL: sempre usar 'art29_id'
                for aid in art29_ids:
                    cursor.execute(
                        "INSERT INTO procedimentos_indicios_art29 (id, procedimento_id, art29_id) VALUES (%s, %s, %s)",
                        (str(uuid.uuid4()), processo_id, aid)
                    )
            else:
                print(f"⏭️ Ignorando indícios globais - usando indícios por PM ({len(indicios_por_pm)} PMs)")

        except Exception as _e:
            # Não bloquear a atualização toda por falha de indícios; apenas logar
            print(f"Aviso: falha ao atualizar indícios do procedimento {processo_id}: {_e}")

        # ======== PROCESSAR INDÍCIOS POR PM (MIGRAÇÃO 015) ========
        # Processar inline para evitar "database locked" (reusar cursor existente)
        try:
            # Verificar se há PMs cadastrados neste procedimento
            cursor.execute("""
                SELECT pm_id FROM procedimento_pms_envolvidos
                WHERE procedimento_id = %s
            """, (processo_id,))
            pms_cadastrados = [row['pm_id'] for row in cursor.fetchall()]

            # Se há PMs cadastrados, sempre processar indícios por PM (mesmo que vazio = limpar)
            if pms_cadastrados and isinstance(indicios_por_pm, dict):
                print(f"🔧 Processando indícios por PM via formulário: {len(indicios_por_pm)} PMs com dados, {len(pms_cadastrados)} PMs cadastrados")

                # Limpar indícios de TODOS os PMs cadastrados
                for pm_id in pms_cadastrados:
                    # Buscar pm_envolvido_id
                    cursor.execute("""
                        SELECT id FROM procedimento_pms_envolvidos
                        WHERE procedimento_id = %s AND pm_id = %s
                    """, (processo_id, pm_id))

                    pm_envolvido_result = cursor.fetchone()
                    if not pm_envolvido_result:
                        print(f"⚠️ PM {pm_id} não encontrado na tabela procedimento_pms_envolvidos")
                        continue

                    pm_envolvido_id = pm_envolvido_result['id']

                    # Verificar se este PM tem dados em indicios_por_pm
                    dados_indicios = indicios_por_pm.get(pm_id)

                    if not dados_indicios or not any([
                        dados_indicios.get('categorias'),
                        dados_indicios.get('crimes'),
                        dados_indicios.get('rdpm'),
                        dados_indicios.get('art29')
                    ]):
                        # PM sem indícios - LIMPAR registros existentes
                        print(f"🧹 Limpando indícios do PM {pm_id} (sem dados fornecidos)")

                        # Buscar registro de indícios existente
                        cursor.execute("SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s AND ativo = TRUE", (pm_envolvido_id,))
                        indicios_registro = cursor.fetchone()

                        if indicios_registro:
                            pm_indicios_id = indicios_registro['id']

                            # Deletar vínculos
                            cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_indicios_id = %s", (pm_indicios_id,))
                            cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_indicios_id = %s", (pm_indicios_id,))
                            cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_indicios_id = %s", (pm_indicios_id,))

                            # Limpar categorias
                            cursor.execute("""
                                UPDATE pm_envolvido_indicios
                                SET categorias_indicios = '[]', categoria = ''
                                WHERE id = %s
                            """, (pm_indicios_id,))

                            print(f"✅ Indícios do PM {pm_id} limpos")
                        continue

                    # PM COM indícios - salvar
                    print(f"📝 Salvando indícios para PM {pm_id}")

                    # Buscar ID do registro de indícios existente (se houver)
                    cursor.execute("SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s AND ativo = TRUE", (pm_envolvido_id,))
                    indicios_registro = cursor.fetchone()

                    if indicios_registro:
                        # Atualizar registro existente
                        pm_indicios_id = indicios_registro['id']
                        print(f"🔄 Atualizando registro de indícios existente: {pm_indicios_id}")

                        # Limpar apenas os vínculos de crimes/rdpm/art29
                        cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_indicios_id = %s", (pm_indicios_id,))
                        cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_indicios_id = %s", (pm_indicios_id,))
                        cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_indicios_id = %s", (pm_indicios_id,))
                    else:
                        # Criar novo registro de indícios
                        pm_indicios_id = str(uuid.uuid4())
                        print(f"➕ Criando novo registro de indícios: {pm_indicios_id}")

                        cursor.execute("""
                            INSERT INTO pm_envolvido_indicios (id, pm_envolvido_id, procedimento_id, categorias_indicios, categoria, ativo)
                            VALUES (%s, %s, %s, '[]', '', TRUE)
                        """, (pm_indicios_id, pm_envolvido_id, processo_id))

                    # Atualizar categorias no registro principal
                    categorias = dados_indicios.get('categorias', [])
                    categorias_json = json.dumps(categorias, ensure_ascii=False)
                    primeira_categoria = categorias[0] if categorias else ''

                    cursor.execute("""
                        UPDATE pm_envolvido_indicios
                        SET categorias_indicios = %s, categoria = %s
                        WHERE id = %s
                    """, (categorias_json, primeira_categoria, pm_indicios_id))

                    # Salvar crimes/contravenções
                    crimes = dados_indicios.get('crimes', [])
                    for crime in crimes:
                        crime_id = crime.get('id') if isinstance(crime, dict) else crime
                        cursor.execute("""
                            INSERT INTO pm_envolvido_crimes (id, pm_indicios_id, crime_id)
                            VALUES (%s, %s, %s)
                        """, (str(uuid.uuid4()), pm_indicios_id, crime_id))

                    # Salvar transgressões RDPM
                    rdpm = dados_indicios.get('rdpm', [])
                    for trans in rdpm:
                        trans_id = trans.get('id') if isinstance(trans, dict) else trans
                        cursor.execute("""
                            INSERT INTO pm_envolvido_rdpm (id, pm_indicios_id, transgressao_id)
                            VALUES (%s, %s, %s)
                        """, (str(uuid.uuid4()), pm_indicios_id, trans_id))

                    # Salvar infrações Art. 29
                    art29 = dados_indicios.get('art29', [])
                    for infracao in art29:
                        art29_id = infracao.get('id') if isinstance(infracao, dict) else infracao
                        cursor.execute("""
                            INSERT INTO pm_envolvido_art29 (id, pm_indicios_id, art29_id)
                            VALUES (%s, %s, %s)
                        """, (str(uuid.uuid4()), pm_indicios_id, art29_id))

                    print(f"✅ Indícios salvos para PM {pm_id}: {len(categorias)} categorias, {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")

                print(f"🎯 Processamento de indícios por PM concluído: {len(pms_cadastrados)} PMs processados")

        except Exception as _e:
            print(f"Aviso: falha ao processar indícios por PM: {_e}")
            traceback.print_exc()

        conn.commit()
        conn.close()

        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('processos_procedimentos', processo_id, 'UPDATE', usuario_id_logado)

        return {"sucesso": True, "mensagem": "Processo/Procedimento atualizado com sucesso!"}
    except psycopg2.IntegrityError as e:
        if "numero, documento_iniciador, tipo_detalhe, ano_instauracao, local_origem" in str(e).lower() or "unique" in str(e).lower():
            local_msg = f" no {local_origem}" if local_origem else ""
            tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
            return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} número {numero}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}."}
        elif "numero_controle, documento_iniciador, tipo_detalhe, ano_instauracao, local_origem" in str(e).lower():
            local_msg = f" no {local_origem}" if local_origem else ""
            tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
            return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} com número de controle {numero_controle}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}."}
        else:
            return {"sucesso": False, "mensagem": "Erro de integridade no banco de dados."}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao atualizar processo/procedimento: {str(e)}"}


# ======== FUNÇÕES DE PRAZOS E ANDAMENTOS ========

def definir_prazo_processo(prazos_manager, processo_id, tipo_prazo, data_limite, descricao=None, responsavel_id=None):
    """
    Define um prazo para um processo

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo
        tipo_prazo: Tipo do prazo
        data_limite: Data limite do prazo
        descricao: Descrição opcional do prazo
        responsavel_id: ID do responsável pelo prazo

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        resultado = prazos_manager.definir_prazo(
            processo_id=processo_id,
            tipo_prazo=tipo_prazo,
            data_limite=data_limite,
            descricao=descricao,
            responsavel_id=responsavel_id
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao definir prazo: {str(e)}"}


def prorrogar_prazo_processo(prazos_manager, prazo_id, nova_data_limite, motivo_prorrogacao, responsavel_id=None):
    """
    Prorroga um prazo existente

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        prazo_id: ID do prazo a ser prorrogado
        nova_data_limite: Nova data limite após prorrogação
        motivo_prorrogacao: Motivo da prorrogação
        responsavel_id: ID do responsável pela prorrogação

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        resultado = prazos_manager.prorrogar_prazo(
            prazo_id=prazo_id,
            nova_data_limite=nova_data_limite,
            motivo_prorrogacao=motivo_prorrogacao,
            responsavel_id=responsavel_id
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao prorrogar prazo: {str(e)}"}


def concluir_prazo_processo(prazos_manager, prazo_id, observacoes=None, responsavel_id=None):
    """
    Marca um prazo como concluído

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        prazo_id: ID do prazo a ser concluído
        observacoes: Observações sobre a conclusão
        responsavel_id: ID do responsável pela conclusão

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        resultado = prazos_manager.concluir_prazo(
            prazo_id=prazo_id,
            observacoes=observacoes,
            responsavel_id=responsavel_id
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao concluir prazo: {str(e)}"}


def listar_prazos_processo(prazos_manager, processo_id):
    """
    Lista todos os prazos de um processo

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo

    Returns:
        dict: {"sucesso": bool, "prazos": list, "mensagem": str (se erro)}
    """
    try:
        prazos = prazos_manager.listar_prazos_processo(processo_id)
        return {"sucesso": True, "prazos": prazos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao listar prazos: {str(e)}"}


def backfill_tipos_funcoes_processo(db_manager):
    """
    Backfill presidente_tipo/interrogante_tipo/escrivao_processo_tipo onde ID existe e tipo está NULL/errado

    Args:
        db_manager: Gerenciador de banco de dados

    Returns:
        dict: {"sucesso": bool, "atualizados": int, "mensagem": str (se erro)}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        def resolve_tipo(_id):
            if not _id:
                return None
            cursor.execute("SELECT 1 FROM usuarios WHERE id = %s AND ativo = TRUE", (_id,))
            if cursor.fetchone():
                return 'usuario'
            return None

        cursor.execute("SELECT id, presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo FROM processos_procedimentos WHERE ativo = TRUE")
        rows = cursor.fetchall()
        upd = 0
        for row in rows:
            pid = row['id']
            pres_id = row['presidente_id']
            pres_tp = row['presidente_tipo']
            int_id = row['interrogante_id']
            int_tp = row['interrogante_tipo']
            escp_id = row['escrivao_processo_id']
            escp_tp = row['escrivao_processo_tipo']

            # Sempre resolver o tipo atual baseado na origem real do ID
            resolved_pres = resolve_tipo(pres_id) if pres_id else None
            resolved_int = resolve_tipo(int_id) if int_id else None
            resolved_escp = resolve_tipo(escp_id) if escp_id else None
            new_pres = resolved_pres if resolved_pres != pres_tp else pres_tp
            new_int = resolved_int if resolved_int != int_tp else int_tp
            new_escp = resolved_escp if resolved_escp != escp_tp else escp_tp
            if new_pres != pres_tp or new_int != int_tp or new_escp != escp_tp:
                cursor.execute(
                    """
                    UPDATE processos_procedimentos
                    SET presidente_tipo = %s, interrogante_tipo = %s, escrivao_processo_tipo = %s
                    WHERE id = %s
                    """,
                    (new_pres, new_int, new_escp, pid)
                )
                upd += 1

        conn.commit()
        conn.close()
        return {"sucesso": True, "atualizados": upd}
    except Exception as e:
        return {"sucesso": False, "mensagem": str(e)}


def registrar_andamento_processo(prazos_manager, processo_id, tipo_andamento, descricao, data_andamento=None, responsavel_id=None, observacoes=None):
    """
    Registra um novo andamento para um processo

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo
        tipo_andamento: Tipo do andamento
        descricao: Descrição do andamento
        data_andamento: Data do andamento (opcional)
        responsavel_id: ID do responsável (opcional)
        observacoes: Observações adicionais (opcional)

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        resultado = prazos_manager.registrar_andamento(
            processo_id=processo_id,
            tipo_andamento=tipo_andamento,
            descricao=descricao,
            data_andamento=data_andamento,
            responsavel_id=responsavel_id,
            observacoes=observacoes
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao registrar andamento: {str(e)}"}


def listar_andamentos_processo(db_manager, processo_id):
    """
    Lista todos os andamentos de um processo

    Args:
        db_manager: Gerenciador de banco de dados
        processo_id: ID do processo

    Returns:
        dict: {"sucesso": bool, "andamentos": list, "mensagem": str (se erro)}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar andamentos do campo JSON da tabela processos_procedimentos
        cursor.execute('''
            SELECT andamentos
            FROM processos_procedimentos
            WHERE id = %s AND ativo = TRUE
        ''', (processo_id,))

        result = cursor.fetchone()
        conn.close()

        if result and result['andamentos']:
            raw = result['andamentos']
            # Tratar JSONB nativo (lista) ou string JSON
            if isinstance(raw, list):
                andamentos = raw
            else:
                try:
                    andamentos = json.loads(raw) if isinstance(raw, str) and raw.strip() else []
                except Exception:
                    andamentos = []

            # Ordenar por data (crescente: mais antigo primeiro)
            andamentos_ordenados = sorted(
                andamentos,
                key=lambda x: x.get('data', ''),
                reverse=False
            )

            # Formatar andamentos
            andamentos_formatados = []
            for and_ in andamentos_ordenados:
                if not isinstance(and_, dict):
                    continue

                texto_val = (
                    and_.get('texto')
                    or and_.get('descricao')
                    or and_.get('descricao_andamento')
                    or and_.get('observacoes')
                )
                if texto_val is None:
                    texto = 'Sem descrição'
                else:
                    texto = str(texto_val).strip() or 'Sem descrição'

                usuario_val = (
                    and_.get('usuario')
                    or and_.get('usuario_nome')
                    or and_.get('responsavel_nome')
                    or and_.get('responsavel')
                )
                usuario = str(usuario_val).strip() if usuario_val else 'Sistema'

                andamento_formatado = and_.copy()
                andamento_formatado.update({
                    'id': and_.get('id'),
                    'data': and_.get('data'),
                    'texto': texto,
                    'descricao': texto,
                    'usuario': usuario,
                    'usuario_nome': usuario
                })

                andamentos_formatados.append(andamento_formatado)

            return {"sucesso": True, "andamentos": andamentos_formatados}

        return {"sucesso": True, "andamentos": []}

    except Exception as e:
        print(f"Erro ao listar andamentos: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao listar andamentos: {str(e)}"}


def obter_pdf_processo(db_manager, processo_id, incluir_conteudo=False):
    """Recupera metadados (e opcionalmente o conteúdo) do PDF associado ao processo."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute(
            """
            SELECT pdf_nome, pdf_content_type, pdf_tamanho, pdf_upload_em, pdf_arquivo
            FROM processos_procedimentos
            WHERE id = %s AND ativo = TRUE
            """,
            (processo_id,)
        )

        row = cursor.fetchone()
        conn.close()

        if not row or not row.get('pdf_arquivo'):
            return {"sucesso": True, "pdf": None}

        pdf_bytes = row['pdf_arquivo']
        if isinstance(pdf_bytes, memoryview):
            pdf_bytes = pdf_bytes.tobytes()

        pdf_info = {
            "nome_arquivo": row.get('pdf_nome'),
            "content_type": row.get('pdf_content_type') or 'application/pdf',
            "tamanho": row.get('pdf_tamanho') or len(pdf_bytes),
            "upload_em": row.get('pdf_upload_em').isoformat() if row.get('pdf_upload_em') else None,
        }

        if incluir_conteudo:
            pdf_info["conteudo_base64"] = base64.b64encode(pdf_bytes).decode('utf-8')

        return {"sucesso": True, "pdf": pdf_info}

    except Exception as e:
        print(f"Erro ao obter PDF do processo: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao obter PDF: {str(e)}"}


def salvar_pdf_processo(db_manager, processo_id, nome_arquivo, conteudo_base64, content_type=None):
    """Salva ou substitui o PDF do processo/procedimento."""
    if not conteudo_base64:
        return {"sucesso": False, "mensagem": "Conteúdo do PDF não informado."}

    try:
        pdf_bytes = base64.b64decode(conteudo_base64, validate=True)
    except Exception:
        return {"sucesso": False, "mensagem": "Arquivo PDF inválido ou corrompido."}

    tamanho_bytes = len(pdf_bytes)
    if tamanho_bytes == 0:
        return {"sucesso": False, "mensagem": "O arquivo PDF está vazio."}

    limite_bytes = 25 * 1024 * 1024  # 25 MB
    if tamanho_bytes > limite_bytes:
        return {"sucesso": False, "mensagem": "O PDF excede o limite de 25 MB."}

    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute(
            """
            UPDATE processos_procedimentos
            SET pdf_nome = %s,
                pdf_content_type = %s,
                pdf_tamanho = %s,
                pdf_upload_em = CURRENT_TIMESTAMP,
                pdf_arquivo = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND ativo = TRUE
            RETURNING id
            """,
            (
                nome_arquivo,
                content_type or 'application/pdf',
                tamanho_bytes,
                psycopg2.Binary(pdf_bytes),
                processo_id,
            ),
        )

        updated = cursor.fetchone()
        if not updated:
            conn.rollback()
            conn.close()
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado ou inativo."}

        conn.commit()
        conn.close()

        return {"sucesso": True, "mensagem": "PDF salvo com sucesso."}

    except Exception as e:
        print(f"Erro ao salvar PDF do processo: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao salvar PDF: {str(e)}"}


def remover_pdf_processo(db_manager, processo_id):
    """Remove o PDF associado ao processo/procedimento."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute(
            """
            UPDATE processos_procedimentos
            SET pdf_nome = NULL,
                pdf_content_type = NULL,
                pdf_tamanho = NULL,
                pdf_upload_em = NULL,
                pdf_arquivo = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND ativo = TRUE
            RETURNING id
            """,
            (processo_id,),
        )

        updated = cursor.fetchone()
        if not updated:
            conn.rollback()
            conn.close()
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado ou inativo."}

        conn.commit()
        conn.close()

        return {"sucesso": True, "mensagem": "PDF removido com sucesso."}

    except Exception as e:
        print(f"Erro ao remover PDF do processo: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao remover PDF: {str(e)}"}


def atualizar_status_detalhado_processo(prazos_manager, processo_id, novo_status, observacoes=None, responsavel_id=None):
    """
    Atualiza o status detalhado de um processo

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo
        novo_status: Novo status do processo
        observacoes: Observações sobre a mudança de status
        responsavel_id: ID do responsável pela mudança

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        resultado = prazos_manager.atualizar_status_detalhado(
            processo_id=processo_id,
            novo_status=novo_status,
            observacoes=observacoes,
            responsavel_id=responsavel_id
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao atualizar status: {str(e)}"}


def obter_status_detalhado_processo(prazos_manager, processo_id):
    """
    Obtém o histórico de status detalhado de um processo

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo

    Returns:
        dict: {"sucesso": bool, "status": list, "mensagem": str (se erro)}
    """
    try:
        status = prazos_manager.obter_status_detalhado(processo_id)
        return {"sucesso": True, "status": status}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter status: {str(e)}"}


def gerar_relatorio_processo(prazos_manager, processo_id):
    """
    Gera relatório completo de um processo

    Args:
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo

    Returns:
        dict: {"sucesso": bool, "relatorio": dict, "mensagem": str (se erro)}
    """
    try:
        relatorio = prazos_manager.gerar_relatorio_processo(processo_id)
        return {"sucesso": True, "relatorio": relatorio}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao gerar relatório: {str(e)}"}


def calcular_prazo_por_processo(db_manager, prazos_manager, processo_id):
    """
    Calcula o prazo de um processo específico

    Args:
        db_manager: Gerenciador de banco de dados
        prazos_manager: Gerenciador de prazos e andamentos
        processo_id: ID do processo

    Returns:
        dict: {"sucesso": bool, "processo": dict, "prazo": dict, "mensagem": str (se erro)}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar dados do processo
        cursor.execute("""
            SELECT
                tipo_detalhe, documento_iniciador, data_recebimento,
                numero, tipo_geral
            FROM processos_procedimentos
            WHERE id = %s AND ativo = TRUE
        """, (processo_id,))

        processo = cursor.fetchone()
        conn.close()

        if not processo:
            return {"sucesso": False, "mensagem": "Processo não encontrado"}

        tipo_detalhe = processo['tipo_detalhe']
        documento_iniciador = processo['documento_iniciador']
        data_recebimento = processo['data_recebimento']
        numero = processo['numero']
        tipo_geral = processo['tipo_geral']

        # Buscar prorrogações existentes na tabela de prazos
        prorrogacoes_dias = 0
        try:
            prazos_existentes = prazos_manager.listar_prazos_processo(processo_id)
            for prazo in prazos_existentes:
                if prazo.get('prorrogacoes_dias'):
                    prorrogacoes_dias += prazo['prorrogacoes_dias']
        except:
            pass  # Se ainda não há prazos cadastrados, continua sem prorrogações

        # Calcular prazo
        calculo_prazo = calcular_prazo_processo(
            tipo_detalhe=tipo_detalhe,
            documento_iniciador=documento_iniciador,
            data_recebimento=str(data_recebimento) if data_recebimento else None,
            prorrogacoes_dias=prorrogacoes_dias
        )

        return {
            "sucesso": True,
            "processo": {
                "numero": numero,
                "tipo_geral": tipo_geral,
                "tipo_detalhe": tipo_detalhe,
                "documento_iniciador": documento_iniciador,
                "data_recebimento": str(data_recebimento) if data_recebimento else None
            },
            "prazo": calculo_prazo
        }

    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao calcular prazo: {str(e)}"}


def listar_processos_com_prazos(db_manager, search_term=None, page=1, per_page=6, filtros=None):
    """
    Lista processos com cálculo de prazo automático, paginação e filtros avançados

    Args:
        db_manager: Gerenciador de banco de dados
        search_term: Termo de busca (opcional)
        page: Número da página
        per_page: Registros por página
        filtros: Dicionário com filtros avançados (opcional)

    Returns:
        dict: {"sucesso": bool, "processos": list, "total": int, "page": int, "per_page": int, "total_pages": int}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Construir a cláusula WHERE para pesquisa
        where_clause = "WHERE p.ativo = TRUE"
        search_params = []

        # Adicionar busca por texto se fornecida (case-insensitive)
        if search_term:
            where_clause += """ AND (
                p.numero ILIKE %s OR p.tipo_detalhe ILIKE %s OR p.local_origem ILIKE %s OR
                p.processo_sei ILIKE %s OR p.numero_portaria ILIKE %s OR p.numero_memorando ILIKE %s OR
                p.numero_feito ILIKE %s OR
                COALESCE(u_resp.nome, '') ILIKE %s OR
                COALESCE(u_pres.nome, '') ILIKE %s OR
                COALESCE(u_int.nome, '') ILIKE %s OR
                COALESCE(u_escr.nome, '') ILIKE %s OR
                COALESCE(u_pm.nome, '') ILIKE %s OR
                COALESCE(p.resumo_fatos, '') ILIKE %s
            )"""
            search_term_like = f"%{search_term}%"
            search_params = [search_term_like] * 13

        # Adicionar filtros avançados se fornecidos
        if filtros:
            if filtros.get('tipo'):
                where_clause += " AND p.tipo_detalhe = %s"
                search_params.append(filtros['tipo'])

            if filtros.get('origem'):
                where_clause += " AND p.local_origem = %s"
                search_params.append(filtros['origem'])

            if filtros.get('local_fatos'):
                where_clause += " AND p.local_fatos = %s"
                search_params.append(filtros['local_fatos'])

            if filtros.get('documento'):
                where_clause += " AND p.documento_iniciador = %s"
                search_params.append(filtros['documento'])

            if filtros.get('status'):
                where_clause += " AND p.status_pm = %s"
                search_params.append(filtros['status'])

            if filtros.get('encarregado'):
                # Buscar por responsável OU presidente OU interrogante OU escrivão do processo
                where_clause += """ AND (
                    TRIM(COALESCE(
                        u_resp.posto_graduacao || ' ' || u_resp.matricula || ' ' || u_resp.nome,
                        ''
                    )) = %s OR
                    TRIM(COALESCE(
                        u_pres.posto_graduacao || ' ' || u_pres.matricula || ' ' || u_pres.nome,
                        ''
                    )) = %s OR
                    TRIM(COALESCE(
                        u_int.posto_graduacao || ' ' || u_int.matricula || ' ' || u_int.nome,
                        ''
                    )) = %s OR
                    TRIM(COALESCE(
                        u_escr.posto_graduacao || ' ' || u_escr.matricula || ' ' || u_escr.nome,
                        ''
                    )) = %s
                )"""
                search_params.extend([filtros['encarregado']] * 4)

            if filtros.get('ano'):
                # Priorizar data_instauracao, depois data_recebimento, depois created_at
                where_clause += """ AND (
                    CASE
                        WHEN p.data_instauracao IS NOT NULL THEN TO_CHAR(p.data_instauracao, 'YYYY')
                        WHEN p.data_recebimento IS NOT NULL THEN TO_CHAR(p.data_recebimento, 'YYYY')
                        ELSE TO_CHAR(p.created_at, 'YYYY')
                    END = %s
                )"""
                search_params.append(filtros['ano'])

            if filtros.get('pm_envolvido'):
                where_clause += """ AND (
                    TRIM(COALESCE(
                        u_pm.posto_graduacao || ' ' || u_pm.matricula || ' ' || u_pm.nome,
                        ''
                    )) = %s
                )"""
                search_params.append(filtros['pm_envolvido'])

            if filtros.get('vitima'):
                where_clause += " AND p.nome_vitima = %s"
                search_params.append(filtros['vitima'])

            # Filtro por período de instauração
            if filtros.get('data_inicio') and filtros.get('data_fim'):
                # Ambas as datas fornecidas - filtrar pelo intervalo (inclusive)
                where_clause += " AND p.data_instauracao BETWEEN %s AND %s"
                search_params.append(filtros['data_inicio'])
                search_params.append(filtros['data_fim'])
            elif filtros.get('data_inicio'):
                # Apenas data inicial - filtrar a partir dessa data
                where_clause += " AND p.data_instauracao >= %s"
                search_params.append(filtros['data_inicio'])
            elif filtros.get('data_fim'):
                # Apenas data final - filtrar até essa data
                where_clause += " AND p.data_instauracao <= %s"
                search_params.append(filtros['data_fim'])

            if filtros.get('situacao'):
                if filtros['situacao'] == 'concluido':
                    where_clause += " AND p.concluido = TRUE"
                elif filtros['situacao'] == 'em_andamento':
                    where_clause += " AND (p.concluido = FALSE OR p.concluido IS NULL)"
                elif filtros['situacao'] == 'em_andamento_no_prazo':
                    # Em andamento e com prazo não vencido
                    where_clause += """ AND (p.concluido = FALSE OR p.concluido IS NULL)
                                      AND p.data_recebimento IS NOT NULL
                                      AND (
                                          CASE
                                              WHEN p.documento_iniciador = 'Feito Preliminar' THEN
                                                  (CURRENT_DATE - p.data_recebimento) < 15
                                              WHEN p.tipo_detalhe = 'IPM' OR p.tipo_detalhe LIKE '%%IPM%%' THEN
                                                  (CURRENT_DATE - p.data_recebimento) < 40
                                              WHEN p.tipo_detalhe = 'SR' OR p.tipo_detalhe LIKE '%%SR%%' THEN
                                                  (CURRENT_DATE - p.data_recebimento) < 30
                                              ELSE
                                                  (CURRENT_DATE - p.data_recebimento) < 30
                                          END
                                      )"""
                elif filtros['situacao'] == 'em_andamento_vencido':
                    # Em andamento e com prazo vencido
                    where_clause += """ AND (p.concluido = FALSE OR p.concluido IS NULL)
                                      AND p.data_recebimento IS NOT NULL
                                      AND (
                                          CASE
                                              WHEN p.documento_iniciador = 'Feito Preliminar' THEN
                                                  (CURRENT_DATE - p.data_recebimento) >= 15
                                              WHEN p.tipo_detalhe = 'IPM' OR p.tipo_detalhe LIKE '%%IPM%%' THEN
                                                  (CURRENT_DATE - p.data_recebimento) >= 40
                                              WHEN p.tipo_detalhe = 'SR' OR p.tipo_detalhe LIKE '%%SR%%' THEN
                                                  (CURRENT_DATE - p.data_recebimento) >= 30
                                              ELSE
                                                  (CURRENT_DATE - p.data_recebimento) >= 30
                                          END
                                      )"""

        # Contar total de registros
        count_query = f"""
            SELECT COUNT(*) as count
            FROM processos_procedimentos p
            LEFT JOIN usuarios u_resp ON p.responsavel_id = u_resp.id
            LEFT JOIN usuarios u_pm ON p.nome_pm_id = u_pm.id
            LEFT JOIN usuarios u_pres ON p.presidente_id = u_pres.id
            LEFT JOIN usuarios u_int ON p.interrogante_id = u_int.id
            LEFT JOIN usuarios u_escr ON p.escrivao_processo_id = u_escr.id
            {where_clause}
        """

        try:
            cursor.execute(count_query, search_params)
            result = cursor.fetchone()
            total_processos = result['count'] if result else 0
        except Exception as e:
            # Debug detalhado do erro
            print(f"\n{'='*80}")
            print(f"❌ ERRO AO EXECUTAR COUNT QUERY")
            print(f"{'='*80}")
            print(f"Erro: {type(e).__name__}: {e}")
            print(f"\nNúmero de placeholders (%s) na query: {count_query.count('%s')}")
            print(f"Número de parâmetros fornecidos: {len(search_params)}")
            print(f"\nParâmetros: {search_params}")
            print(f"\nFiltros recebidos: {filtros}")
            print(f"\nWHERE clause:\n{where_clause}")
            print(f"{'='*80}\n")
            raise

        # Calcular offset para paginação
        offset = (page - 1) * per_page

        # Query principal com paginação - ordenado por data_instauracao DESC (mais recente primeiro)
        main_query = f"""
            SELECT
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador,
                p.data_recebimento, p.created_at, p.data_instauracao,
                COALESCE(u_resp.nome, 'Desconhecido') as responsavel_nome,
                COALESCE(u_resp.posto_graduacao, '') as responsavel_posto,
                COALESCE(u_resp.matricula, '') as responsavel_matricula,
                -- Dados de funções (PAD/CD/CJ)
                COALESCE(u_pres.nome, '') as presidente_nome,
                COALESCE(u_pres.posto_graduacao, '') as presidente_posto,
                COALESCE(u_pres.matricula, '') as presidente_matricula,
                COALESCE(u_int.nome, '') as interrogante_nome,
                COALESCE(u_int.posto_graduacao, '') as interrogante_posto,
                COALESCE(u_int.matricula, '') as interrogante_matricula,
                COALESCE(u_escr.nome, '') as escrivao_nome,
                COALESCE(u_escr.posto_graduacao, '') as escrivao_posto,
                COALESCE(u_escr.matricula, '') as escrivao_matricula,
                p.local_origem, p.processo_sei, p.nome_pm_id, p.status_pm,
                COALESCE(u_pm.nome, 'Não informado') as pm_envolvido_nome,
                COALESCE(u_pm.posto_graduacao, '') as pm_envolvido_posto,
                COALESCE(u_pm.matricula, '') as pm_envolvido_matricula,
                p.numero_controle,
                p.concluido,
                p.data_conclusao
            FROM processos_procedimentos p
            LEFT JOIN usuarios u_resp ON p.responsavel_id = u_resp.id
            LEFT JOIN usuarios u_pm ON p.nome_pm_id = u_pm.id
            -- Junções para funções específicas em processos (PAD/CD/CJ)
            LEFT JOIN usuarios u_pres ON p.presidente_id = u_pres.id
            LEFT JOIN usuarios u_int ON p.interrogante_id = u_int.id
            LEFT JOIN usuarios u_escr ON p.escrivao_processo_id = u_escr.id
            {where_clause}
            ORDER BY
                CASE WHEN p.data_instauracao IS NOT NULL THEN p.data_instauracao ELSE p.created_at END DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(main_query, search_params + [per_page, offset])

        processos = cursor.fetchall()
        conn.close()

        processos_com_prazos = []

        for processo in processos:
            # RealDictCursor retorna dicionários, não tuplas
            processo_id = processo['id']
            numero = processo['numero']
            tipo_geral = processo['tipo_geral']
            tipo_detalhe = processo['tipo_detalhe']
            documento_iniciador = processo['documento_iniciador']
            data_recebimento = processo['data_recebimento']
            created_at = processo['created_at']
            data_instauracao = processo['data_instauracao']
            responsavel_nome = processo['responsavel_nome']
            responsavel_posto = processo['responsavel_posto']
            responsavel_matricula = processo['responsavel_matricula']
            presidente_nome = processo['presidente_nome']
            presidente_posto = processo['presidente_posto']
            presidente_matricula = processo['presidente_matricula']
            interrogante_nome = processo['interrogante_nome']
            interrogante_posto = processo['interrogante_posto']
            interrogante_matricula = processo['interrogante_matricula']
            escrivao_nome = processo['escrivao_nome']
            escrivao_posto = processo['escrivao_posto']
            escrivao_matricula = processo['escrivao_matricula']
            local_origem = processo['local_origem']
            processo_sei = processo['processo_sei']
            nome_pm_id = processo['nome_pm_id']
            status_pm = processo['status_pm']
            pm_envolvido_nome = processo['pm_envolvido_nome']
            pm_envolvido_posto = processo['pm_envolvido_posto']
            pm_envolvido_matricula = processo['pm_envolvido_matricula']
            numero_controle = processo['numero_controle']
            concluido = processo['concluido']
            data_conclusao = processo['data_conclusao']

            # Converter dates para strings se necessário
            if data_recebimento and not isinstance(data_recebimento, str):
                data_recebimento = str(data_recebimento)
            if data_instauracao and not isinstance(data_instauracao, str):
                data_instauracao = str(data_instauracao)
            if data_conclusao and not isinstance(data_conclusao, str):
                data_conclusao = str(data_conclusao)

            # Formatar responsável completo: "posto/grad + matrícula + nome"
            responsavel_completo = f"{responsavel_posto} {responsavel_matricula} {responsavel_nome}".strip()
            if responsavel_completo == "Desconhecido":
                responsavel_completo = "Desconhecido"

            # Formatar nomes completos das funções (quando houver)
            def monta_nome_completo(posto, matricula, nome):
                if not nome:
                    return None
                return f"{posto} {matricula} {nome}".strip()

            presidente_completo = monta_nome_completo(presidente_posto, presidente_matricula, presidente_nome)
            interrogante_completo = monta_nome_completo(interrogante_posto, interrogante_matricula, interrogante_nome)
            escrivao_completo = monta_nome_completo(escrivao_posto, escrivao_matricula, escrivao_nome)

            # Formatar PM envolvido - para procedimentos, buscar múltiplos PMs
            if tipo_geral == 'procedimento':
                pms_envolvidos = buscar_pms_envolvidos(db_manager, processo_id)
                if pms_envolvidos:
                    primeiro_pm = pms_envolvidos[0]['nome_completo']
                    if len(pms_envolvidos) > 1:
                        pm_envolvido_completo = f"{primeiro_pm} e outros"
                        # Criar lista de todos os PMs para tooltip
                        todos_pms = [pm['nome_completo'] for pm in pms_envolvidos]
                        pm_envolvido_tooltip = '; '.join(todos_pms)
                    else:
                        pm_envolvido_completo = primeiro_pm
                        pm_envolvido_tooltip = primeiro_pm
                else:
                    pm_envolvido_completo = "Não informado"
                    pm_envolvido_tooltip = "Não informado"
            else:
                # Para processos, usar o sistema antigo (um único PM)
                if pm_envolvido_nome != "Não informado":
                    # Se for "A APURAR", mostrar apenas o nome
                    if pm_envolvido_nome == "A APURAR":
                        pm_envolvido_completo = "A APURAR"
                    else:
                        pm_envolvido_completo = f"{pm_envolvido_posto} {pm_envolvido_matricula} {pm_envolvido_nome}".strip()
                else:
                    pm_envolvido_completo = "Não informado"
                pm_envolvido_tooltip = pm_envolvido_completo

            # Montar exibição do "Encarregado" para PAD/CD/CJ
            encarregado_display = responsavel_completo
            encarregado_tooltip = responsavel_completo
            if tipo_geral == 'processo' and (tipo_detalhe in ('PAD', 'CD', 'CJ')):
                if presidente_completo:
                    encarregado_display = f"{presidente_completo} e outros"
                else:
                    encarregado_display = "Não se aplica"
                # Tooltip com todas as funções disponíveis
                partes = []
                if presidente_completo:
                    partes.append(f"Presidente: {presidente_completo}")
                if interrogante_completo:
                    partes.append(f"Interrogante: {interrogante_completo}")
                if escrivao_completo:
                    partes.append(f"Escrivão do Processo: {escrivao_completo}")
                encarregado_tooltip = '; '.join(partes) if partes else encarregado_display

            # Buscar prorrogações e prazo ativo
            prorrogacoes_dias = 0
            data_limite_ativo = None
            try:
                conn2 = db_manager.get_connection()
                c2 = conn2.cursor()
                c2.execute(
                    """
                    SELECT SUM(CASE WHEN tipo_prazo='prorrogacao' THEN COALESCE(dias_adicionados,0) ELSE 0 END) as soma_prorrog,
                           MAX(CASE WHEN ativo = TRUE THEN data_vencimento END) as data_venc_ativa
                    FROM prazos_processo
                    WHERE processo_id = %s
                    """,
                    (processo_id,),
                )
                rowp = c2.fetchone()
                if rowp:
                    prorrogacoes_dias = int(rowp[0] or 0)
                    data_limite_ativo = rowp[1]
                conn2.close()
            except Exception:
                pass

            # Calcular prazo para cada processo
            calculo_prazo = calcular_prazo_processo(
                tipo_detalhe=tipo_detalhe,
                documento_iniciador=documento_iniciador,
                data_recebimento=data_recebimento,
                prorrogacoes_dias=prorrogacoes_dias,
            )
            # Ajustar com data ativa, se existir
            if data_limite_ativo:
                try:
                    calculo_prazo["data_limite"] = data_limite_ativo
                    data_limite_dt = datetime.strptime(str(data_limite_ativo), "%Y-%m-%d")
                    calculo_prazo["data_limite_formatada"] = data_limite_dt.strftime("%d/%m/%Y")
                    hoje = datetime.now()
                    dias_rest = (data_limite_dt - hoje).days
                    calculo_prazo["dias_restantes"] = dias_rest
                    if dias_rest < 0:
                        calculo_prazo["status_prazo"] = f"Vencido há {abs(dias_rest)} dias"
                        calculo_prazo["vencido"] = True
                    elif dias_rest == 0:
                        calculo_prazo["status_prazo"] = "Vence hoje"
                        calculo_prazo["vencido"] = False
                    elif dias_rest <= 5:
                        calculo_prazo["status_prazo"] = f"Vence em {dias_rest} dias (URGENTE)"
                        calculo_prazo["vencido"] = False
                    elif dias_rest <= 10:
                        calculo_prazo["status_prazo"] = f"Vence em {dias_rest} dias (ATENÇÃO)"
                        calculo_prazo["vencido"] = False
                    else:
                        calculo_prazo["status_prazo"] = f"Vence em {dias_rest} dias"
                        calculo_prazo["vencido"] = False
                except Exception:
                    pass

            # Formatar numero do processo usando numero_controle
            def formatar_numero_processo():
                ano_instauracao = ""

                # Usar data_instauracao primeiro, se não existir usar data_recebimento
                data_para_ano = data_instauracao or data_recebimento
                if data_para_ano:
                    try:
                        ano_instauracao = str(datetime.strptime(data_para_ano, "%Y-%m-%d").year)
                    except Exception:
                        ano_instauracao = ""

                # Usar numero_controle primeiro, depois fallback para numero
                numero_para_formatacao = numero_controle or numero
                if numero_para_formatacao:
                    return f"{tipo_detalhe} nº {numero_para_formatacao}/{local_origem or ''}/{ano_instauracao}"
                return "S/N"

            processo_formatado = {
                "id": processo_id,
                "numero": numero,
                "numero_controle": numero_controle,
                "numero_formatado": formatar_numero_processo(),
                "tipo_geral": tipo_geral,
                "tipo_detalhe": tipo_detalhe,
                "documento_iniciador": documento_iniciador,
                "data_recebimento": data_recebimento,
                "data_recebimento_formatada": datetime.strptime(data_recebimento, "%Y-%m-%d").strftime("%d/%m/%Y") if data_recebimento else None,
                "data_instauracao": data_instauracao,
                "data_instauracao_formatada": datetime.strptime(data_instauracao, "%Y-%m-%d").strftime("%d/%m/%Y") if data_instauracao else None,
                "responsavel": responsavel_completo,
                "encarregado_display": encarregado_display,
                "encarregado_tooltip": encarregado_tooltip,
                "responsavel_posto": responsavel_posto,
                "responsavel_matricula": responsavel_matricula,
                "responsavel_nome": responsavel_nome,
                "presidente_nome_completo": presidente_completo,
                "interrogante_nome_completo": interrogante_completo,
                "escrivao_nome_completo": escrivao_completo,
                "local_origem": local_origem,
                "processo_sei": processo_sei,
                "nome_pm_id": nome_pm_id,
                "pm_envolvido_nome": pm_envolvido_completo,
                "pm_envolvido_tooltip": pm_envolvido_tooltip,
                "pm_envolvido_posto": pm_envolvido_posto,
                "pm_envolvido_matricula": pm_envolvido_matricula,
                "status_pm": status_pm,
                "data_criacao": created_at,
                "concluido": bool(concluido) if concluido is not None else False,
                "data_conclusao": data_conclusao,
                "prazo": calculo_prazo,
            }

            processos_com_prazos.append(processo_formatado)

        return {
            "sucesso": True,
            "processos": processos_com_prazos,
            "total": total_processos,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_processos + per_page - 1) // per_page,
        }

    except Exception as e:
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao listar processos com prazos: {str(e)}"}


def listar_todos_processos_com_prazos(db_manager):
    """
    Lista todos os processos com cálculo de prazo (sem paginação) - para compatibilidade

    Args:
        db_manager: Gerenciador de banco de dados

    Returns:
        dict: {"sucesso": bool, "processos": list, "mensagem": str (se erro)}
    """
    try:
        resultado = listar_processos_com_prazos(db_manager, search_term=None, page=1, per_page=999999)
        if resultado["sucesso"]:
            return {"sucesso": True, "processos": resultado["processos"]}
        return resultado
    except Exception as e:
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao listar todos os processos: {str(e)}"}


def obter_status_processo():
    """
    Retorna lista de status disponíveis para processos

    Returns:
        dict: {"sucesso": bool, "status": list}
    """
    status = [
        "Em Andamento",
        "Aguardando Diligência",
        "Aguardando Manifestação",
        "Aguardando Decisão",
        "Suspenso",
        "Concluso",
        "Arquivado",
        "Remetido"
    ]
    return {"sucesso": True, "status": status}


def obter_tipos_processo_para_mapa(db_manager):
    """
    Obtém lista de tipos de processo/procedimento disponíveis para o mapa mensal

    Args:
        db_manager: Gerenciador de banco de dados

    Returns:
        dict: {"sucesso": bool, "tipos": list, "mensagem": str (se erro)}
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
