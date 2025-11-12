"""
Serviço de gerenciamento de usuários.

Este módulo contém todas as funções relacionadas ao CRUD de usuários,
estatísticas e listagem de processos vinculados a usuários.
"""

import psycopg2
import psycopg2.extras
import uuid
import hashlib
from db_config import get_pg_connection


def obter_usuario_por_id(db_manager, user_id, user_type):
    """
    Retorna os dados atuais de um usuário para edição/visualização.

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário
        user_type: Tipo do usuário (mantido para compatibilidade)

    Returns:
        dict: Dados do usuário ou None se não encontrado
    """
    conn = db_manager.get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Buscar na tabela unificada usuarios
        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, matricula, nome,
                   is_encarregado, is_operador, email, perfil,
                   created_at, updated_at, ativo
            FROM usuarios
            WHERE id = %s
        ''', (user_id,))

        row = cursor.fetchone()
        if row:
            # Determinar vínculos
            vinculos = []
            if row['is_encarregado']:
                vinculos.append("Encarregado")
            if row['is_operador']:
                perfil_texto = f"Operador ({row['perfil']})" if row['perfil'] else "Operador"
                vinculos.append(perfil_texto)

            vinculo_texto = " / ".join(vinculos) if vinculos else "Sem vínculo"

            user = {
                "id": row['id'],
                "tipo_usuario": row['tipo_usuario'],
                "posto_graduacao": row['posto_graduacao'],
                "matricula": row['matricula'],
                "nome": row['nome'],
                "is_encarregado": bool(row['is_encarregado']),
                "is_operador": bool(row['is_operador']),
                "email": row['email'],
                "profile": row['perfil'],  # Mantém 'profile' para compatibilidade
                "perfil": row['perfil'],
                "created_at": row['created_at'],
                "updated_at": row['updated_at'],
                "ativo": bool(row['ativo']),
                "tipo": user_type,  # Mantém o tipo passado para compatibilidade
                "vinculo_texto": vinculo_texto
            }

            conn.close()
            return user

        conn.close()
        return None

    except Exception as e:
        print(f"Erro ao obter usuário por ID: {e}")
        conn.close()
        return None


def cadastrar_usuario(db_manager, usuario_logado, tipo_usuario, posto_graduacao, nome, matricula,
                      is_encarregado=False, is_operador=False, email=None, senha=None, perfil=None):
    """
    Cadastra novo usuário na estrutura unificada.

    Args:
        db_manager: Instância do DatabaseManager
        usuario_logado: Dict com dados do usuário logado (para auditoria)
        tipo_usuario: Tipo do usuário ('Oficial' ou 'Praça')
        posto_graduacao: Posto ou graduação
        nome: Nome do usuário
        matricula: Matrícula
        is_encarregado: Se é encarregado (default False)
        is_operador: Se é operador (default False)
        email: Email (obrigatório para operadores)
        senha: Senha (obrigatória para operadores)
        perfil: Perfil de acesso ('admin' ou 'comum', obrigatório para operadores)

    Returns:
        dict: {"sucesso": bool, "mensagem": str, "user_id": str}
    """
    # Validações básicas
    if not tipo_usuario or not posto_graduacao or not nome or not matricula:
        return {"sucesso": False, "mensagem": "Todos os campos obrigatórios devem ser preenchidos!"}

    if len(nome.strip()) < 2:
        return {"sucesso": False, "mensagem": "Nome deve ter pelo menos 2 caracteres!"}

    if tipo_usuario not in ['Oficial', 'Praça']:
        return {"sucesso": False, "mensagem": "Tipo de usuário deve ser 'Oficial' ou 'Praça'!"}

    # Validações específicas para operador
    if is_operador:
        if not email:
            return {"sucesso": False, "mensagem": "Email é obrigatório para operadores!"}
        if "@" not in email or "." not in email:
            return {"sucesso": False, "mensagem": "Email inválido!"}
        if not senha:
            return {"sucesso": False, "mensagem": "Senha é obrigatória para operadores!"}
        if len(senha) < 4:
            return {"sucesso": False, "mensagem": "Senha deve ter pelo menos 4 caracteres!"}
        if not perfil or perfil not in ['admin', 'comum']:
            return {"sucesso": False, "mensagem": "Perfil inválido para operador!"}

    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verificar se matrícula já existe
        cursor.execute("SELECT id FROM usuarios WHERE matricula = %s", (matricula.strip(),))
        if cursor.fetchone():
            return {"sucesso": False, "mensagem": "Matrícula já cadastrada!"}

        # Verificar se email já existe (apenas se preenchido)
        if email:
            cursor.execute("SELECT id FROM usuarios WHERE email = %s", (email.strip().lower(),))
            if cursor.fetchone():
                return {"sucesso": False, "mensagem": "Email já cadastrado!"}

        # Gerar ID e preparar dados
        user_id = str(uuid.uuid4())
        nome_upper = nome.strip().upper()
        email_clean = email.strip().lower() if email else None
        senha_hash = db_manager.hash_password(senha) if senha else None

        # Inserir usuário
        cursor.execute('''
            INSERT INTO usuarios (
                id, tipo_usuario, posto_graduacao, nome, matricula,
                is_encarregado, is_operador, email, senha, perfil
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            user_id, tipo_usuario, posto_graduacao, nome_upper, matricula.strip(),
            is_encarregado,  # PostgreSQL aceita booleano Python diretamente
            is_operador,     # PostgreSQL aceita booleano Python diretamente
            email_clean, senha_hash, perfil
        ))

        conn.commit()
        conn.close()

        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('usuarios', user_id, 'CREATE', usuario_id_logado)

        # Mensagem de sucesso padronizada
        return {
            "sucesso": True,
            "mensagem": "Usuário cadastrado com sucesso!",
            "user_id": user_id
        }

    except Exception as e:
        print(f"Erro ao cadastrar usuário: {e}")
        return {"sucesso": False, "mensagem": "Erro interno do servidor!"}


def listar_usuarios(db_manager, search_term=None, page=1, per_page=10):
    """
    Lista todos os usuários cadastrados com paginação e pesquisa.

    Args:
        db_manager: Instância do DatabaseManager
        search_term: Termo de busca (opcional)
        page: Página atual (default 1)
        per_page: Registros por página (default 10)

    Returns:
        dict: Resultado paginado com usuários
    """
    return db_manager.get_paginated_users(search_term, page, per_page)


def listar_todos_usuarios(db_manager):
    """
    Lista todos os usuários da nova estrutura unificada.

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        list: Lista de usuários ativos
    """
    conn = db_manager.get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, nome, matricula,
                   is_encarregado, is_operador, email, perfil, created_at, updated_at, ativo
            FROM usuarios
            WHERE ativo = TRUE
            ORDER BY nome ASC
        ''')

        usuarios = []
        for user in cursor.fetchall():
            # Determinar vínculos
            vinculos = []
            if user['is_encarregado']:
                vinculos.append("Encarregado")
            if user['is_operador']:
                perfil_texto = f"Operador ({user['perfil']})" if user['perfil'] else "Operador"
                vinculos.append(perfil_texto)

            vinculo_texto = " / ".join(vinculos) if vinculos else "Sem vínculo"

            usuarios.append({
                "id": user['id'],
                "tipo_usuario": user['tipo_usuario'],
                "posto_graduacao": user['posto_graduacao'],
                "nome": user['nome'],
                "matricula": user['matricula'],
                "is_encarregado": bool(user['is_encarregado']),
                "is_operador": bool(user['is_operador']),
                "email": user['email'],
                "perfil": user['perfil'],
                "created_at": user['created_at'],
                "updated_at": user['updated_at'],
                "ativo": bool(user['ativo']),
                "vinculo_texto": vinculo_texto,
                "nome_completo": f"{user['posto_graduacao']} {user['nome']}"  # posto/graduação + nome
            })

        conn.close()
        return usuarios

    except Exception as e:
        print(f"Erro ao listar usuários: {e}")
        return []


def obter_usuario_detalhado(db_manager, user_id, user_type):
    """
    Obtém detalhes completos de um usuário para edição.

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário
        user_type: Tipo do usuário (mantido para compatibilidade)

    Returns:
        dict: {"sucesso": bool, "usuario": dict} ou {"sucesso": False, "mensagem": str}
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, nome, matricula,
                   is_encarregado, is_operador, email, perfil
            FROM usuarios
            WHERE id = %s AND ativo = TRUE
        ''', (user_id,))

        user = cursor.fetchone()
        conn.close()

        if user:
            return {
                "sucesso": True,
                "usuario": {
                    "id": user['id'],
                    "tipo_usuario": user['tipo_usuario'],
                    "posto_graduacao": user['posto_graduacao'],
                    "nome": user['nome'],
                    "matricula": user['matricula'],
                    "is_encarregado": bool(user['is_encarregado']),
                    "is_operador": bool(user['is_operador']),
                    "email": user['email'],
                    "perfil": user['perfil']
                }
            }
        else:
            return {"sucesso": False, "mensagem": "Usuário não encontrado"}

    except Exception as e:
        print(f"Erro ao obter usuário detalhado: {e}")
        return {"sucesso": False, "mensagem": str(e)}


def atualizar_usuario(db_manager, usuario_logado, user_id, user_type, tipo_usuario, posto_graduacao,
                      nome, matricula, is_encarregado, is_operador, email, senha, perfil):
    """
    Atualiza um usuário existente com todos os campos.

    Args:
        db_manager: Instância do DatabaseManager
        usuario_logado: Dict com dados do usuário logado (para auditoria)
        user_id: ID do usuário a atualizar
        user_type: Tipo do usuário (mantido para compatibilidade)
        tipo_usuario: Tipo do usuário ('Oficial' ou 'Praça')
        posto_graduacao: Posto ou graduação
        nome: Nome do usuário
        matricula: Matrícula
        is_encarregado: Se é encarregado
        is_operador: Se é operador
        email: Email
        senha: Nova senha (opcional, mantém a atual se vazio)
        perfil: Perfil de acesso ('admin' ou 'comum')

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        # Validações básicas
        if not user_id or not tipo_usuario or not posto_graduacao or not nome or not matricula:
            return {"sucesso": False, "mensagem": "Todos os campos obrigatórios devem ser preenchidos!"}

        if len(nome.strip()) < 2:
            return {"sucesso": False, "mensagem": "Nome deve ter pelo menos 2 caracteres!"}

        if is_operador:
            if not email or not email.strip():
                return {"sucesso": False, "mensagem": "Email é obrigatório para operadores!"}
            if "@" not in email or "." not in email:
                return {"sucesso": False, "mensagem": "Email inválido!"}
            if not perfil:
                return {"sucesso": False, "mensagem": "Perfil é obrigatório para operadores!"}

        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Atualizar usuário
        if senha and senha.strip():
            # Se senha foi fornecida, atualizar com nova senha (hash)
            senha_hash = hashlib.sha256(senha.encode()).hexdigest()
            cursor.execute('''
                UPDATE usuarios
                SET tipo_usuario = %s, posto_graduacao = %s, nome = %s, matricula = %s,
                    is_encarregado = %s, is_operador = %s, email = %s, senha = %s, perfil = %s
                WHERE id = %s
            ''', (tipo_usuario, posto_graduacao, nome, matricula,
                  is_encarregado, is_operador, email, senha_hash, perfil, user_id))
        else:
            # Manter senha atual
            cursor.execute('''
                UPDATE usuarios
                SET tipo_usuario = %s, posto_graduacao = %s, nome = %s, matricula = %s,
                    is_encarregado = %s, is_operador = %s, email = %s, perfil = %s
                WHERE id = %s
            ''', (tipo_usuario, posto_graduacao, nome, matricula,
                  is_encarregado, is_operador, email, perfil, user_id))

        conn.commit()
        conn.close()

        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('usuarios', user_id, 'UPDATE', usuario_id_logado)

        return {"sucesso": True, "mensagem": "Usuário atualizado com sucesso!"}

    except Exception as e:
        print(f"Erro ao atualizar usuário: {e}")
        return {"sucesso": False, "mensagem": str(e)}


def atualizar_usuario_old(db_manager, user_id, user_type, posto_graduacao, matricula, nome,
                          email, senha=None, profile=None):
    """
    Atualiza um usuário existente (versão antiga - manter por compatibilidade).

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário a atualizar
        user_type: Tipo do usuário ('operador' ou 'encarregado')
        posto_graduacao: Posto ou graduação
        matricula: Matrícula
        nome: Nome do usuário
        email: Email
        senha: Nova senha (opcional)
        profile: Perfil de acesso (opcional)

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    # Validações básicas
    if not user_id or not user_type or not posto_graduacao or not matricula or not nome:
        return {"sucesso": False, "mensagem": "Todos os campos obrigatórios devem ser preenchidos!"}

    if len(nome.strip()) < 2:
        return {"sucesso": False, "mensagem": "Nome deve ter pelo menos 2 caracteres!"}

    if user_type == 'operador':
        if not email or not email.strip():
            return {"sucesso": False, "mensagem": "Email é obrigatório para operadores!"}
        if "@" not in email or "." not in email:
            return {"sucesso": False, "mensagem": "Email inválido!"}
        # Senha é opcional na atualização - se fornecida, deve ter pelo menos 4 caracteres
        if senha and senha.strip() and len(senha.strip()) < 4:
            return {"sucesso": False, "mensagem": "Senha deve ter pelo menos 4 caracteres!"}
    elif user_type == 'encarregado':
        # Email é opcional para encarregado, mas se preenchido, deve ser válido
        if email and email.strip():
            if "@" not in email or "." not in email:
                return {"sucesso": False, "mensagem": "Email inválido!"}

    return db_manager.update_user(user_id, user_type, posto_graduacao, matricula, nome, email, senha, profile)


def delete_user(db_manager, user_id, user_type):
    """
    Desativa um usuário.

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário a desativar
        user_type: Tipo do usuário (mantido para compatibilidade)

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    return db_manager.delete_user(user_id, user_type)


def obter_estatisticas_usuario(db_manager, user_id, user_type):
    """
    Obtém estatísticas detalhadas de um usuário específico.

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário
        user_type: Tipo do usuário (mantido para compatibilidade)

    Returns:
        dict: {"sucesso": bool, "estatisticas": dict} ou {"sucesso": False, "erro": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        estatisticas = {
            "encarregado_sindicancia": 0,  # SR e SV
            "encarregado_pads": 0,
            "encarregado_ipm": 0,
            "encarregado_pad": 0,  # PAD
            "encarregado_pade": 0,  # PADE
            "encarregado_feito_preliminar": 0,  # FP
            "encarregado_cp": 0,  # CP
            "encarregado_cd": 0,  # CD
            "encarregado_cj": 0,  # CJ
            "escrivao": 0,
            "envolvido_sindicado": 0,
            "envolvido_acusado": 0,
            "envolvido_indiciado": 0,
            "envolvido_investigado": 0
        }

        # 1. Encarregado de Sindicância (SR e SV)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE responsavel_id = %s AND ativo = TRUE
            AND tipo_detalhe IN ('SR', 'SV')
        """, (user_id,))
        estatisticas["encarregado_sindicancia"] = cursor.fetchone()['count']

        # 2. Encarregado de PADS
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE responsavel_id = %s AND ativo = TRUE
            AND tipo_detalhe = 'PADS'
        """, (user_id,))
        estatisticas["encarregado_pads"] = cursor.fetchone()['count']

        # 3. Encarregado de IPM
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE responsavel_id = %s AND ativo = TRUE
            AND tipo_detalhe = 'IPM'
        """, (user_id,))
        estatisticas["encarregado_ipm"] = cursor.fetchone()['count']

        # 4. Encarregado de Feito Preliminar (FP)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE responsavel_id = %s AND ativo = TRUE
            AND tipo_detalhe = 'FP'
        """, (user_id,))
        estatisticas["encarregado_feito_preliminar"] = cursor.fetchone()['count']

        # 5. PAD (como responsável, presidente, interrogante ou escrivão do processo)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
            AND ativo = TRUE
            AND tipo_detalhe = 'PAD'
        """, (user_id, user_id, user_id, user_id))
        estatisticas["encarregado_pad"] = cursor.fetchone()['count']

        # 6. PADE (como responsável, presidente, interrogante ou escrivão do processo)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
            AND ativo = TRUE
            AND tipo_detalhe = 'PADE'
        """, (user_id, user_id, user_id, user_id))
        estatisticas["encarregado_pade"] = cursor.fetchone()['count']

        # 7. Encarregado de CP
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE responsavel_id = %s AND ativo = TRUE
            AND tipo_detalhe = 'CP'
        """, (user_id,))
        estatisticas["encarregado_cp"] = cursor.fetchone()['count']

        # 8. CD (como responsável, presidente, interrogante ou escrivão do processo)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
            AND ativo = TRUE
            AND tipo_detalhe = 'CD'
        """, (user_id, user_id, user_id, user_id))
        estatisticas["encarregado_cd"] = cursor.fetchone()['count']

        # 9. CJ (como responsável, presidente, interrogante ou escrivão do processo)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
            AND ativo = TRUE
            AND tipo_detalhe = 'CJ'
        """, (user_id, user_id, user_id, user_id))
        estatisticas["encarregado_cj"] = cursor.fetchone()['count']

        # 10. Escrivão
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE escrivao_id = %s AND ativo = TRUE
        """, (user_id,))
        estatisticas["escrivao"] = cursor.fetchone()['count']

        # 11. Envolvido como sindicado (status_pm = 'Sindicado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE nome_pm_id = %s AND ativo = TRUE
            AND LOWER(status_pm) = 'sindicado'
        """, (user_id,))
        estatisticas["envolvido_sindicado"] = cursor.fetchone()['count']

        # 12. Envolvido como acusado (status_pm = 'Acusado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE nome_pm_id = %s AND ativo = TRUE
            AND LOWER(status_pm) = 'acusado'
        """, (user_id,))
        estatisticas["envolvido_acusado"] = cursor.fetchone()['count']

        # 13. Envolvido como indiciado (status_pm = 'Indiciado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE nome_pm_id = %s AND ativo = TRUE
            AND LOWER(status_pm) = 'indiciado'
        """, (user_id,))
        estatisticas["envolvido_indiciado"] = cursor.fetchone()['count']

        # 14. Envolvido como investigado (status_pm = 'Investigado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos
            WHERE nome_pm_id = %s AND ativo = TRUE
            AND LOWER(status_pm) = 'investigado'
        """, (user_id,))
        estatisticas["envolvido_investigado"] = cursor.fetchone()['count']

        # 15. Também verificar na tabela de múltiplos PMs envolvidos (para procedimentos)
        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = %s AND p.ativo = TRUE
            AND LOWER(p.status_pm) = 'sindicado'
        """, (user_id,))
        estatisticas["envolvido_sindicado"] += cursor.fetchone()['count']

        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = %s AND p.ativo = TRUE
            AND LOWER(p.status_pm) = 'acusado'
        """, (user_id,))
        estatisticas["envolvido_acusado"] += cursor.fetchone()['count']

        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = %s AND p.ativo = TRUE
            AND LOWER(p.status_pm) = 'indiciado'
        """, (user_id,))
        estatisticas["envolvido_indiciado"] += cursor.fetchone()['count']

        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = %s AND p.ativo = TRUE
            AND LOWER(p.status_pm) = 'investigado'
        """, (user_id,))
        estatisticas["envolvido_investigado"] += cursor.fetchone()['count']

        conn.close()

        return {"sucesso": True, "estatisticas": estatisticas}

    except Exception as e:
        print(f"Erro ao obter estatísticas do usuário: {e}")
        return {"sucesso": False, "erro": str(e)}


def obter_processos_usuario_responsavel(db_manager, user_id):
    """
    Obtém lista de processos/procedimentos onde o usuário é responsável (encarregado).

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário

    Returns:
        dict: {"sucesso": bool, "processos": list} ou {"sucesso": False, "erro": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT id, tipo_geral, tipo_detalhe, numero, resumo_fatos,
                   data_instauracao, status_pm, data_conclusao
            FROM processos_procedimentos
            WHERE responsavel_id = %s AND ativo = TRUE
            ORDER BY data_instauracao DESC
        """, (user_id,))

        processos = []
        for row in cursor.fetchall():
            processos.append({
                "id": row['id'],
                "tipo": row['tipo_geral'],
                "tipo_detalhe": row['tipo_detalhe'],
                "numero_processo": row['numero'],
                "objeto": row['resumo_fatos'],
                "data_instauracao": row['data_instauracao'],
                "status": row['status_pm'],
                "conclusao_data": row['data_conclusao']
            })

        conn.close()
        return {"sucesso": True, "processos": processos}

    except Exception as e:
        print(f"Erro ao obter processos como responsável: {e}")
        return {"sucesso": False, "erro": str(e)}


def obter_processos_usuario_escrivao(db_manager, user_id):
    """
    Obtém lista de processos/procedimentos onde o usuário é escrivão.

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário

    Returns:
        dict: {"sucesso": bool, "processos": list} ou {"sucesso": False, "erro": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cursor.execute("""
            SELECT id, tipo_geral, tipo_detalhe, numero, resumo_fatos,
                   data_instauracao, status_pm, data_conclusao
            FROM processos_procedimentos
            WHERE escrivao_id = %s AND ativo = TRUE
            ORDER BY data_instauracao DESC
        """, (user_id,))

        processos = []
        for row in cursor.fetchall():
            processos.append({
                "id": row['id'],
                "tipo": row['tipo_geral'],
                "tipo_detalhe": row['tipo_detalhe'],
                "numero_processo": row['numero'],
                "objeto": row['resumo_fatos'],
                "data_instauracao": row['data_instauracao'],
                "status": row['status_pm'],
                "conclusao_data": row['data_conclusao']
            })

        conn.close()
        return {"sucesso": True, "processos": processos}

    except Exception as e:
        print(f"Erro ao obter processos como escrivão: {e}")
        return {"sucesso": False, "erro": str(e)}


def obter_processos_usuario_envolvido(db_manager, user_id):
    """
    Obtém lista de processos/procedimentos onde o usuário é envolvido
    (sindicado, acusado, indiciado, investigado).

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário

    Returns:
        dict: {"sucesso": bool, "processos": list} ou {"sucesso": False, "erro": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar processos onde é PM envolvido direto
        cursor.execute("""
            SELECT DISTINCT p.id, p.tipo_geral, p.tipo_detalhe, p.numero, p.resumo_fatos,
                   p.data_instauracao, p.status_pm, p.data_conclusao,
                   COALESCE(ppe.status_pm, p.status_pm) as status_envolvido
            FROM processos_procedimentos p
            LEFT JOIN procedimento_pms_envolvidos ppe ON p.id = ppe.procedimento_id AND ppe.pm_id = %s
            WHERE p.ativo = TRUE
            AND (p.nome_pm_id = %s OR ppe.pm_id = %s)
            AND (
                LOWER(COALESCE(ppe.status_pm, p.status_pm)) IN ('sindicado', 'acusado', 'indiciado', 'investigado')
            )
            ORDER BY p.data_instauracao DESC
        """, (user_id, user_id, user_id))

        processos = []
        for row in cursor.fetchall():
            processos.append({
                "id": row['id'],
                "tipo": row['tipo_geral'],
                "tipo_detalhe": row['tipo_detalhe'],
                "numero_processo": row['numero'],
                "objeto": row['resumo_fatos'],
                "data_instauracao": row['data_instauracao'],
                "status": row['status_pm'],
                "conclusao_data": row['data_conclusao'],
                "status_envolvido": row['status_envolvido']
            })

        conn.close()
        return {"sucesso": True, "processos": processos}

    except Exception as e:
        print(f"Erro ao obter processos como envolvido: {e}")
        return {"sucesso": False, "erro": str(e)}


def listar_encarregados_operadores(db_manager):
    """
    Lista todos os usuários que são encarregados ou operadores.

    Args:
        db_manager: Instância do DatabaseManager

    Returns:
        list: Lista de usuários encarregados/operadores
    """
    conn = db_manager.get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, nome, matricula,
                   is_encarregado, is_operador, email, perfil
            FROM usuarios
            WHERE ativo = TRUE AND (is_encarregado = TRUE OR is_operador = TRUE)
            ORDER BY nome ASC
        ''')

        usuarios = []
        for user in cursor.fetchall():
            usuarios.append({
                "id": user['id'],
                "tipo_usuario": user['tipo_usuario'],
                "posto_graduacao": user['posto_graduacao'],
                "nome": user['nome'],
                "matricula": user['matricula'],
                "is_encarregado": bool(user['is_encarregado']),
                "is_operador": bool(user['is_operador']),
                "email": user['email'],
                "perfil": user['perfil'],
                "nome_completo": f"{user['posto_graduacao']} {user['nome']}"
            })

        conn.close()
        return usuarios

    except Exception as e:
        print(f"Erro ao listar encarregados/operadores: {e}")
        return []


def deletar_usuario(db_manager, user_id, usuario_logado_id):
    """
    Desativa (soft delete) um usuário.

    Args:
        db_manager: Instância do DatabaseManager
        user_id: ID do usuário a ser desativado
        usuario_logado_id: ID do usuário que está fazendo a operação

    Returns:
        dict: {"sucesso": bool, "mensagem": str}
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE usuarios
            SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (user_id,))

        conn.commit()
        conn.close()

        # Registrar auditoria
        db_manager.registrar_auditoria('usuarios', user_id, 'DELETE', usuario_logado_id)

        return {"sucesso": True, "mensagem": "Usuário desativado com sucesso!"}

    except Exception as e:
        print(f"Erro ao desativar usuário: {e}")
        return {"sucesso": False, "mensagem": str(e)}


def verificar_admin(usuario_logado):
    """
    Verifica se o usuário logado é administrador.

    Args:
        usuario_logado: Dict com dados do usuário logado

    Returns:
        bool: True se for admin, False caso contrário
    """
    if not usuario_logado:
        return False
    
    return usuario_logado.get('perfil') == 'admin'
