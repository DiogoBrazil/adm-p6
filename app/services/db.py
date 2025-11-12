import psycopg2
import psycopg2.extras
import uuid
import bcrypt
import hashlib

from db_config import get_pg_connection, init_postgres_manager


class DatabaseManager:
    """Gerenciador do banco de dados PostgreSQL"""

    def __init__(self):
        # PostgreSQL não precisa de caminho de arquivo - usa conexão de rede
        # Configuração está em db_config.py
        self.init_database()

    def registrar_auditoria(self, tabela, registro_id, operacao, usuario_id=None):
        """
        Registra operação de auditoria no banco de dados

        Args:
            tabela (str): Nome da tabela afetada
            registro_id (str): ID do registro afetado
            operacao (str): Tipo de operação: 'CREATE', 'UPDATE', 'DELETE'
            usuario_id (str): ID do usuário que realizou a operação (opcional)
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            auditoria_id = str(uuid.uuid4())

            cursor.execute(
                '''
                INSERT INTO auditoria (id, tabela, registro_id, operacao, usuario_id, timestamp)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ''',
                (auditoria_id, tabela, registro_id, operacao, usuario_id),
            )

            conn.commit()
            conn.close()

            print(
                f"✓ Auditoria registrada: {operacao} na tabela {tabela} (registro: {registro_id})"
            )

        except Exception as e:
            print(f"⚠️ Erro ao registrar auditoria: {e}")
            # Não levanta exceção para não interromper operação principal

    def get_connection(self):
        """Retorna conexão com o banco PostgreSQL"""
        return get_pg_connection()

    def init_database(self):
        """Inicializa o banco de dados e cria tabelas"""
        # Inicializa gerenciador PostgreSQL
        init_postgres_manager()

        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Não apagar tabelas existentes para evitar perda de dados

        # Criar tabela usuarios unificada se não existir
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS usuarios (
                id TEXT PRIMARY KEY,
                tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('Oficial', 'Praça')),
                posto_graduacao TEXT NOT NULL,
                nome TEXT NOT NULL,
                matricula TEXT UNIQUE NOT NULL,
                is_encarregado BOOLEAN DEFAULT FALSE,
                is_operador BOOLEAN DEFAULT FALSE,
                email TEXT UNIQUE,
                senha TEXT,
                perfil TEXT CHECK (perfil IN ('admin', 'comum') OR perfil IS NULL),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT TRUE
            )
            '''
        )

        # Criar tabela processos_procedimentos se não existir (schema atualizado)
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS processos_procedimentos (
                id TEXT PRIMARY KEY,
                numero TEXT NOT NULL,
                tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
                tipo_detalhe TEXT NOT NULL,
                documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
                processo_sei TEXT,
                -- Agora opcionais para suportar PAD/CD/CJ
                responsavel_id TEXT,
                responsavel_tipo TEXT CHECK (responsavel_tipo IN ('usuario')),
                local_origem TEXT,
                local_fatos TEXT,
                data_instauracao DATE,
                data_recebimento DATE,
                escrivao_id TEXT,
                status_pm TEXT,
                nome_pm_id TEXT,
                nome_vitima TEXT,
                natureza_processo TEXT,
                natureza_procedimento TEXT,
                resumo_fatos TEXT,
                numero_portaria TEXT,
                numero_memorando TEXT,
                numero_feito TEXT,
                numero_rgf TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1,
                numero_controle TEXT,
                concluido BOOLEAN,
                data_conclusao DATE,
                infracao_id INTEGER,
                transgressoes_ids TEXT,
                solucao_final TEXT,
                ano_instauracao TEXT,
                andamentos TEXT,
                data_remessa_encarregado DATE,
                data_julgamento DATE,
                solucao_tipo TEXT,
                penalidade_tipo TEXT,
                penalidade_dias INTEGER,
                indicios_categorias TEXT,
                -- Papéis específicos para processos PAD/CD/CJ
                presidente_id TEXT,
                presidente_tipo TEXT CHECK (presidente_tipo IN ('usuario')),
                interrogante_id TEXT,
                interrogante_tipo TEXT CHECK (interrogante_tipo IN ('usuario')),
                escrivao_processo_id TEXT,
                escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('usuario')),
                historico_encarregados TEXT, -- JSON com histórico de substituições
                motorista_id TEXT, -- Motorista responsável em sinistros de trânsito
                UNIQUE(numero, documento_iniciador, ano_instauracao)
            )
            '''
        )

        # Criar usuário admin padrão se não existir
        self.create_admin_user(cursor)

        conn.commit()
        conn.close()
        print(f"✅ Banco de dados PostgreSQL inicializado com sucesso!")

    def create_admin_user(self, cursor):
        """Cria usuário admin padrão"""
        # Verifica se admin já existe na tabela usuarios
        cursor.execute(
            "SELECT id FROM usuarios WHERE email = 'admin@sistema.com' AND perfil = 'admin'"
        )
        if not cursor.fetchone():
            admin_id = str(uuid.uuid4())
            senha_hash = self.hash_password('123456')
            cursor.execute(
                '''
                INSERT INTO usuarios (
                    id, tipo_usuario, posto_graduacao, nome, matricula,
                    is_encarregado, is_operador, email, senha, perfil
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''',
                (
                    admin_id,
                    'Oficial',
                    'CEL PM',
                    'ADMINISTRADOR',
                    '000000',
                    0,
                    1,
                    'admin@sistema.com',
                    senha_hash,
                    'admin',
                ),
            )
            print("👤 Usuário admin criado: admin@sistema.com / 123456\n   ID: " + admin_id)

    def hash_password(self, password):
        """Gera hash seguro com bcrypt (substitui SHA-256 legado)"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def _is_bcrypt_hash(self, hashed):
        return isinstance(hashed, str) and hashed.startswith('$2')

    def verify_login(self, email, senha):
        """Verifica credenciais de login na nova estrutura unificada"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Buscar por email e verificar senha com suporte a bcrypt e SHA-256 legado
        cursor.execute(
            '''
            SELECT id, tipo_usuario, posto_graduacao, nome, matricula, email,
                   is_encarregado, is_operador, perfil, created_at, updated_at, senha
            FROM usuarios
            WHERE email = %s AND ativo = TRUE AND is_operador = TRUE
            ''',
            (email,),
        )
        user = cursor.fetchone()

        if not user:
            conn.close()
            return None

        stored = user.get('senha')
        ok = False
        upgraded = False
        if stored and self._is_bcrypt_hash(stored):
            try:
                ok = bcrypt.checkpw(senha.encode('utf-8'), stored.encode('utf-8'))
            except Exception:
                ok = False
        else:
            # legado sha256
            ok = (hashlib.sha256(senha.encode()).hexdigest() == (stored or ''))
            if ok:
                try:
                    novo = self.hash_password(senha)
                    cursor.execute(
                        "UPDATE usuarios SET senha = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                        (novo, user['id']),
                    )
                    upgraded = True
                except Exception:
                    pass

        if ok:
            if upgraded:
                conn.commit()
            conn.close()
            return {
                "id": user['id'],
                "tipo_usuario": user['tipo_usuario'],
                "posto_graduacao": user['posto_graduacao'],
                "nome": user['nome'],
                "matricula": user['matricula'],
                "email": user['email'],
                "is_encarregado": bool(user['is_encarregado']),
                "is_operador": bool(user['is_operador']),
                "perfil": user['perfil'],
                "is_admin": (user['perfil'] == 'admin'),
                "created_at": str(user['created_at']),
                "updated_at": str(user['updated_at']),
                "nome_completo": f"{user['posto_graduacao']} {user['nome']}",
            }

        conn.close()
        return None

    # FUNÇÕES LEGADAS REMOVIDAS - Sistema migrado para tabela unificada "usuarios"
    # Use cadastrar_usuario(), atualizar_usuario() e desativar_usuario() em vez das antigas

    def update_user(self, user_id, user_type, posto_graduacao, matricula, nome, email, senha=None, profile=None):
        """Atualiza um usuário na tabela unificada"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            nome = nome.strip().upper()
            email = email.strip().lower() if email and email.strip() else None

            # Verificar email duplicado
            if email:
                cursor.execute(
                    "SELECT id FROM usuarios WHERE email = %s AND id != %s AND ativo = TRUE",
                    (email, user_id),
                )
                if cursor.fetchone():
                    conn.close()
                    return {"sucesso": False, "mensagem": "Email já está em uso por outro usuário!"}

            # Verificar matrícula duplicada
            cursor.execute(
                "SELECT id FROM usuarios WHERE matricula = %s AND id != %s AND ativo = TRUE",
                (matricula.strip(), user_id),
            )
            if cursor.fetchone():
                conn.close()
                return {"sucesso": False, "mensagem": "Matrícula já está em uso por outro usuário!"}

            # Preparar query de atualização
            update_query = """
                UPDATE usuarios SET
                    posto_graduacao = %s, matricula = %s, nome = %s, email = %s, updated_at = CURRENT_TIMESTAMP
            """
            params = [posto_graduacao, matricula.strip(), nome, email]

            # Atualizar senha se fornecida
            if senha and senha.strip():
                senha_hash = self.hash_password(senha)
                update_query += ", senha = %s"
                params.append(senha_hash)

            # Atualizar perfil se fornecido
            if profile:
                update_query += ", perfil = %s"
                params.append(profile)

            update_query += " WHERE id = %s"
            params.append(user_id)

            cursor.execute(update_query, tuple(params))
            conn.commit()

            if cursor.rowcount == 0:
                conn.close()
                return {"sucesso": False, "mensagem": "Usuário não encontrado ou nenhum dado alterado."}

            conn.close()
            return {"sucesso": True, "mensagem": "Usuário atualizado com sucesso!"}

        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao atualizar usuário: {str(e)}"}

    def delete_user(self, user_id, user_type):
        """Desativa um usuário na tabela unificada"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            cursor.execute(
                '''
                UPDATE usuarios SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                ''',
                (user_id,),
            )

            conn.commit()

            if cursor.rowcount == 0:
                conn.close()
                return {"sucesso": False, "mensagem": "Usuário não encontrado ou já inativo."}

            conn.close()

            # Registrar auditoria
            global usuario_logado
            usuario_id_logado = usuario_logado['id'] if usuario_logado else None
            self.registrar_auditoria('usuarios', user_id, 'DELETE', usuario_id_logado)

            return {"sucesso": True, "mensagem": "Usuário desativado com sucesso!"}

        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao desativar usuário: {str(e)}"}

    def list_users(self, apenas_ativos=True):
        """Lista usuários com filtros básicos"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            query = "SELECT * FROM usuarios"
            if apenas_ativos:
                query += " WHERE ativo = TRUE"
            cursor.execute(query)
            rows = cursor.fetchall()
            users = []
            for user in rows:
                # coletar vínculos do usuário
                vinculos = []
                if user.get('is_encarregado'):
                    vinculos.append('encarregado')
                if user.get('is_operador'):
                    vinculos.append('operador')
                users.append(
                    {
                        "id": user['id'],
                        "tipo_usuario": user['tipo_usuario'],
                        "posto_graduacao": user['posto_graduacao'],
                        "matricula": user['matricula'],
                        "nome": user['nome'],
                        "email": user['email'],
                        "created_at": user['created_at'],
                        "updated_at": user['updated_at'],
                        "ativo": bool(user['ativo']),
                        "is_encarregado": bool(user['is_encarregado']),
                        "is_operador": bool(user['is_operador']),
                        "perfil": user['perfil'],
                        "vinculos": vinculos,
                    }
                )

            conn.close()
            return {"users": users, "total": len(users)}
        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": str(e)}

    def get_stats(self):
        """Retorna estatísticas do sistema baseadas na nova estrutura unificada"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Total de usuários ativos (excluindo admin)
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE ativo = TRUE AND nome != 'ADMINISTRADOR'")
        total_usuarios = cursor.fetchone()['count']

        # Total geral incluindo admin
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE ativo = TRUE")
        total_geral = cursor.fetchone()['count']

        # Usuários criados hoje (excluindo admin)
        cursor.execute(
            '''
            SELECT COUNT(*) FROM usuarios 
            WHERE DATE(created_at) = DATE('now') AND ativo = TRUE AND nome != 'ADMINISTRADOR'
            '''
        )
        novos_hoje = cursor.fetchone()['count']

        # Estatísticas por vínculo
        cursor.execute(
            "SELECT COUNT(*) FROM usuarios WHERE is_encarregado = TRUE AND ativo = TRUE AND nome != 'ADMINISTRADOR'"
        )
        total_encarregados = cursor.fetchone()['count']

        cursor.execute(
            "SELECT COUNT(*) FROM usuarios WHERE is_operador = TRUE AND ativo = TRUE AND nome != 'ADMINISTRADOR'"
        )
        total_operadores = cursor.fetchone()['count']

        conn.close()

        return {
            "total_usuarios": total_usuarios,
            "total_geral": total_geral,
            "novos_hoje": novos_hoje,
            "total_encarregados": total_encarregados,
            "total_operadores": total_operadores,
            "banco_path": "PostgreSQL: 192.168.0.137:5432/app_db",
        }

    def get_paginated_users(self, search_term=None, page=1, per_page=10):
        """Busca usuários da nova estrutura unificada com paginação e pesquisa, excluindo o admin"""
        conn = self.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        users = []

        # Construir a cláusula WHERE para pesquisa (excluindo admin)
        where_clause = "WHERE ativo = TRUE AND nome != 'ADMINISTRADOR'"
        search_params = []
        if search_term:
            where_clause += " AND (nome ILIKE %s OR matricula ILIKE %s)"
            search_term_like = f"%{search_term}%"
            search_params = [search_term_like, search_term_like]

        # Contar total de usuários
        cursor.execute(f"SELECT COUNT(*) FROM usuarios {where_clause}", search_params)
        total_users = cursor.fetchone()['count']

        # Calcular offset para paginação
        offset = (page - 1) * per_page

        # Buscar usuários ordenados por nome
        query = f'''
            SELECT id, tipo_usuario, posto_graduacao, matricula, nome, email, 
                   created_at, updated_at, ativo, is_encarregado, is_operador, perfil
            FROM usuarios 
            {where_clause}
            ORDER BY nome ASC
            LIMIT %s OFFSET %s
        '''
        
        all_params = search_params + [per_page, offset]
        cursor.execute(query, all_params)
        
        all_users = cursor.fetchall()
        for user in all_users:
            # Determinar o tipo baseado nos vínculos
            vinculos = []
            if user['is_encarregado']:
                vinculos.append('encarregado')
            if user['is_operador']:
                vinculos.append('operador')
            
            users.append({
                "id": user['id'],
                "tipo_usuario": user['tipo_usuario'],
                "posto_graduacao": user['posto_graduacao'],
                "matricula": user['matricula'],
                "nome": user['nome'],
                "email": user['email'],
                "created_at": user['created_at'],
                "updated_at": user['updated_at'],
                "ativo": bool(user['ativo']),
                "is_encarregado": bool(user['is_encarregado']),
                "is_operador": bool(user['is_operador']),
                "perfil": user['perfil'],
                "vinculos": vinculos
            })
        
        conn.close()
        
        return {"users": users, "total": total_users}

