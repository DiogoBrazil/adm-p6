# main.py - Sistema Login com Cadastro usando SQLite
import eel
import sqlite3
import hashlib
import os
import sys
from datetime import datetime
import uuid
import time

class DatabaseManager:
    """Gerenciador do banco de dados SQLite"""
    
    def __init__(self):
        # Define o caminho do banco de dados
        if getattr(sys, 'frozen', False):
            # Executável PyInstaller - salva no AppData do usuário
            app_data_dir = os.path.join(os.environ.get('APPDATA', '.'), 'SistemaLogin')
            if not os.path.exists(app_data_dir):
                os.makedirs(app_data_dir)
            self.db_path = os.path.join(app_data_dir, 'usuarios.db')
        else:
            # Desenvolvimento - salva no diretório atual
            self.db_path = 'usuarios.db'
        
        self.init_database()
    
    def get_connection(self):
        """Retorna conexão com o banco"""
        return sqlite3.connect(self.db_path)
    
    def init_database(self):
        """Inicializa o banco de dados e cria tabelas"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Não apagar tabelas existentes para evitar perda de dados

        # Criar tabela encarregados se não existir
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS encarregados (
                id TEXT PRIMARY KEY,
                posto_graduacao TEXT NOT NULL,
                matricula TEXT UNIQUE NOT NULL,
                nome TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        ''')
        
        # Criar tabela operadores se não existir
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS operadores (
                id TEXT PRIMARY KEY,
                posto_graduacao TEXT NOT NULL,
                matricula TEXT UNIQUE NOT NULL,
                nome TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                profile TEXT NOT NULL CHECK (profile IN ('admin', 'comum')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        ''')
        
        # Criar tabela processos_procedimentos se não existir
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS processos_procedimentos (
                id TEXT PRIMARY KEY,
                numero TEXT UNIQUE NOT NULL,
                tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
                tipo_detalhe TEXT NOT NULL,
                documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
                processo_sei TEXT,
                responsavel_id TEXT NOT NULL,
                responsavel_tipo TEXT NOT NULL CHECK (responsavel_tipo IN ('encarregado', 'operador')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        ''')
        
        # Criar usuário admin padrão se não existir
        self.create_admin_user(cursor)
        
        conn.commit()
        conn.close()
        print(f"✅ Banco de dados inicializado: {self.db_path}")
    
    def create_admin_user(self, cursor):
        """Cria usuário admin padrão"""
        # Verifica se admin já existe na tabela operadores
        cursor.execute("SELECT id FROM operadores WHERE email = 'admin' AND profile = 'admin'")
        if not cursor.fetchone():
            admin_id = str(uuid.uuid4())
            senha_hash = self.hash_password('123456')
            cursor.execute('''
                INSERT INTO operadores (id, posto_graduacao, matricula, nome, email, senha, profile) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (admin_id, 'CEL PM', '000000', 'Administrador', 'admin', senha_hash, 'admin'))
            print("👤 Usuário admin criado: admin / 123456\n   ID: " + admin_id)
    
    def hash_password(self, password):
        """Gera hash da senha usando SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_login(self, email, senha):
        """Verifica credenciais de login"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        senha_hash = self.hash_password(senha)
        
        # Tenta logar como operador
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome, email, profile, created_at, updated_at
            FROM operadores
            WHERE email = ? AND senha = ? AND ativo = 1
        ''', (email, senha_hash))
        user = cursor.fetchone()
        
        if user:
            conn.close()
            return {
                "id": user[0],
                "posto_graduacao": user[1],
                "matricula": user[2],
                "nome": user[3],
                "email": user[4],
                "profile": user[5],
                "is_admin": (user[5] == 'admin'),
                "tipo": "operador",
                "created_at": user[6],
                "updated_at": user[7]
            }
        
        # Se não for operador, tenta logar como encarregado (sem senha)
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at
            FROM encarregados
            WHERE email = ? AND ativo = 1 AND email IS NOT NULL
        ''', (email,))
        user = cursor.fetchone()
        
        if user:
            conn.close()
            return {
                "id": user[0],
                "posto_graduacao": user[1],
                "matricula": user[2],
                "nome": user[3],
                "email": user[4],
                "profile": "encarregado", # Encarregados não têm perfil específico, mas para consistência
                "is_admin": False,
                "tipo": "encarregado",
                "created_at": user[5],
                "updated_at": user[6]
            }
            
        conn.close()
        return None
    
    def add_operador(self, posto_graduacao, matricula, nome, email, senha, profile):
        """Adiciona novo operador"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Verifica se email já existe em operadores
            cursor.execute("SELECT id FROM operadores WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                return {"sucesso": False, "mensagem": "Email já está em uso como operador!"}
            
            # Verifica se matrícula já existe em operadores
            cursor.execute("SELECT id FROM operadores WHERE matricula = ?", (matricula,))
            if cursor.fetchone():
                conn.close()
                return {"sucesso": False, "mensagem": "Matrícula já está em uso como operador!"}

            # Adiciona operador
            user_id = str(uuid.uuid4())
            senha_hash = self.hash_password(senha)
            cursor.execute('''
                INSERT INTO operadores (id, posto_graduacao, matricula, nome, email, senha, profile) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, posto_graduacao, matricula, nome, email, senha_hash, profile))
            
            conn.commit()
            conn.close()
            
            return {"sucesso": True, "mensagem": "Operador cadastrado com sucesso!"}
            
        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao cadastrar operador: {str(e)}"}

    def add_encarregado(self, posto_graduacao, matricula, nome, email):
        """Adiciona novo encarregado"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Converter email vazio para None (NULL no banco)
            email = email.strip() if email and email.strip() else None
            
            # Verifica se email já existe em encarregados (apenas se email não for None)
            if email:
                cursor.execute("SELECT id FROM encarregados WHERE email = ?", (email,))
                if cursor.fetchone():
                    conn.close()
                    return {"sucesso": False, "mensagem": "Email já está em uso como encarregado!"}
            
            # Verifica se matrícula já existe em encarregados
            cursor.execute("SELECT id FROM encarregados WHERE matricula = ?", (matricula,))
            if cursor.fetchone():
                conn.close()
                return {"sucesso": False, "mensagem": "Matrícula já está em uso como encarregado!"}

            # Adiciona encarregado
            user_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO encarregados (id, posto_graduacao, matricula, nome, email) 
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, posto_graduacao, matricula, nome, email))
            
            conn.commit()
            conn.close()
            
            return {"sucesso": True, "mensagem": "Encarregado cadastrado com sucesso!"}
            
        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao cadastrar encarregado: {str(e)}"}

    def update_user(self, user_id, user_type, posto_graduacao, matricula, nome, email, senha=None, profile=None):
        """Atualiza um usuário existente (encarregado ou operador)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if user_type == 'operador':
                # Verifica se email já existe para outro operador
                cursor.execute("SELECT id FROM operadores WHERE email = ? AND id != ?", (email, user_id))
                if cursor.fetchone():
                    conn.close()
                    return {"sucesso": False, "mensagem": "Email já está em uso por outro operador!"}
                
                # Verifica se matrícula já existe para outro operador
                cursor.execute("SELECT id FROM operadores WHERE matricula = ? AND id != ?", (matricula, user_id))
                if cursor.fetchone():
                    conn.close()
                    return {"sucesso": False, "mensagem": "Matrícula já está em uso por outro operador!"}

                update_query = """
                    UPDATE operadores SET
                        posto_graduacao = ?, matricula = ?, nome = ?, email = ?, updated_at = CURRENT_TIMESTAMP
                """
                params = [posto_graduacao, matricula, nome, email]
                # Só atualiza a senha se ela foi fornecida e não está vazia
                if senha and senha.strip():
                    senha_hash = self.hash_password(senha)
                    update_query += ", senha = ?"
                    params.append(senha_hash)
                if profile:
                    update_query += ", profile = ?"
                    params.append(profile)
                
                update_query += " WHERE id = ?"
                params.append(user_id)
                
                cursor.execute(update_query, tuple(params))
                
            elif user_type == 'encarregado':
                # Converter email vazio para None (NULL no banco)
                email = email.strip() if email and email.strip() else None
                
                # Só verifica email duplicado se email for preenchido
                if email:
                    cursor.execute("SELECT id FROM encarregados WHERE email = ? AND id != ?", (email, user_id))
                    if cursor.fetchone():
                        conn.close()
                        return {"sucesso": False, "mensagem": "Email já está em uso por outro encarregado!"}
                
                # Verifica se matrícula já existe para outro encarregado
                cursor.execute("SELECT id FROM encarregados WHERE matricula = ? AND id != ?", (matricula, user_id))
                if cursor.fetchone():
                    conn.close()
                    return {"sucesso": False, "mensagem": "Matrícula já está em uso por outro encarregado!"}
                
                cursor.execute("""
                    UPDATE encarregados SET
                        posto_graduacao = ?, matricula = ?, nome = ?, email = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (posto_graduacao, matricula, nome, email, user_id))
            
            conn.commit()
            conn.close()
            
            if cursor.rowcount == 0:
                return {"sucesso": False, "mensagem": "Usuário não encontrado ou nenhum dado alterado."}
            return {"sucesso": True, "mensagem": "Usuário atualizado com sucesso!"}
            
        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao atualizar usuário: {str(e)}"}

    def delete_user(self, user_id, user_type):
        """Desativa um usuário (encarregado ou operador)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if user_type == 'operador':
                cursor.execute('''
                    UPDATE operadores SET ativo = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (user_id,))
            elif user_type == 'encarregado':
                cursor.execute('''
                    UPDATE encarregados SET ativo = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (user_id,))
            else:
                conn.close()
                return {"sucesso": False, "mensagem": "Tipo de usuário inválido para exclusão!"}
            
            conn.commit()
            conn.close()
            
            if cursor.rowcount == 0:
                return {"sucesso": False, "mensagem": "Usuário não encontrado ou já inativo."}
            return {"sucesso": True, "mensagem": "Usuário desativado com sucesso!"}
            
        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao desativar usuário: {str(e)}"}
    
    def get_paginated_users(self, search_term=None, page=1, per_page=10):
        """Retorna usuários paginados e filtrados (encarregados e operadores)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        users = []

        # Construir a cláusula WHERE para pesquisa
        where_clause = "WHERE ativo = 1"
        search_params = []
        if search_term:
            where_clause += " AND (nome LIKE ? OR matricula LIKE ?)"
            search_term_like = f"%{search_term}%"
            search_params = [search_term_like, search_term_like]

        # Contar total de encarregados
        cursor.execute(f"SELECT COUNT(*) FROM encarregados {where_clause}", search_params)
        total_encarregados = cursor.fetchone()[0]

        # Contar total de operadores (incluindo admin, mas excluindo o usuário padrão "Administrador")
        operador_where = where_clause + " AND nome != 'Administrador'"
        cursor.execute(f"SELECT COUNT(*) FROM operadores {operador_where}", search_params)
        total_operadores = cursor.fetchone()[0]

        total_users = total_encarregados + total_operadores

        # Calcular offset para paginação
        offset = (page - 1) * per_page

        # Buscar todos os usuários em uma única consulta usando UNION
        union_query = f'''
            SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at, ativo, 'encarregado' as tipo, NULL as profile
            FROM encarregados 
            {where_clause}
            UNION ALL
            SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at, ativo, 'operador' as tipo, profile
            FROM operadores 
            {where_clause} AND nome != 'Administrador'
            ORDER BY nome ASC
            LIMIT ? OFFSET ?
        '''
        
        # Combinar parâmetros para ambas as partes do UNION
        all_params = search_params + search_params + [per_page, offset]
        cursor.execute(union_query, all_params)
        
        all_users = cursor.fetchall()
        for user in all_users:
            users.append({
                "id": user[0],
                "posto_graduacao": user[1],
                "matricula": user[2],
                "nome": user[3],
                "email": user[4],
                "created_at": user[5],
                "updated_at": user[6],
                "ativo": bool(user[7]),
                "tipo": user[8],
                "profile": user[9] if user[8] == 'operador' else None
            })
        
        conn.close()
        
        return {"users": users, "total": total_users}
    
    def get_stats(self):
        """Retorna estatísticas do sistema"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Total de usuários (encarregados + operadores, exceto admin)
        cursor.execute("SELECT COUNT(*) FROM encarregados WHERE ativo = 1")
        total_encarregados = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM operadores WHERE profile != 'admin' AND ativo = 1")
        total_operadores = cursor.fetchone()[0]
        total_usuarios = total_encarregados + total_operadores
        
        # Total geral incluindo admin
        cursor.execute("SELECT COUNT(*) FROM operadores WHERE ativo = 1")
        total_geral = cursor.fetchone()[0] + total_encarregados
        
        # Usuários criados hoje
        cursor.execute('''
            SELECT COUNT(*) FROM encarregados 
            WHERE DATE(created_at) = DATE('now') AND ativo = 1
        ''')
        novos_encarregados_hoje = cursor.fetchone()[0]
        cursor.execute('''
            SELECT COUNT(*) FROM operadores 
            WHERE DATE(created_at) = DATE('now') AND profile != 'admin' AND ativo = 1
        ''')
        novos_operadores_hoje = cursor.fetchone()[0]
        novos_hoje = novos_encarregados_hoje + novos_operadores_hoje
        
        conn.close()
        
        return {
            "total_usuarios": total_usuarios,
            "total_geral": total_geral,
            "novos_hoje": novos_hoje,
            "banco_path": self.db_path
        }

# Inicializar gerenciador de banco
db_manager = DatabaseManager()

# Inicializar Eel
eel.init('web')

# Variável para usuário logado
usuario_logado = None

@eel.expose
def obter_usuario_por_id(user_id, user_type):
    """Retorna os dados atuais de um usuário para edição"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    user = None
    if user_type == 'operador':
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome, email, profile, created_at, updated_at, ativo
            FROM operadores WHERE id = ?
        ''', (user_id,))
        row = cursor.fetchone()
        if row:
            user = {
                "id": row[0],
                "posto_graduacao": row[1],
                "matricula": row[2],
                "nome": row[3],
                "email": row[4],
                "profile": row[5],
                "created_at": row[6],
                "updated_at": row[7],
                "ativo": bool(row[8]),
                "tipo": "operador"
            }
    elif user_type == 'encarregado':
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at, ativo
            FROM encarregados WHERE id = ?
        ''', (user_id,))
        row = cursor.fetchone()
        if row:
            user = {
                "id": row[0],
                "posto_graduacao": row[1],
                "matricula": row[2],
                "nome": row[3],
                "email": row[4],
                "created_at": row[5],
                "updated_at": row[6],
                "ativo": bool(row[7]),
                "tipo": "encarregado"
            }
    conn.close()
    return user

@eel.expose
def fazer_login(email, senha):
    """Realiza login do usuário"""
    global usuario_logado
    
    if not email or not senha:
        return {"sucesso": False, "mensagem": "Email e senha são obrigatórios!"}
    
    user = db_manager.verify_login(email, senha)
    
    if user:
        usuario_logado = user
        return {
            "sucesso": True,
            "mensagem": f"Bem-vindo, {user['nome']}!",
            "usuario": user
        }
    else:
        return {
            "sucesso": False,
            "mensagem": "Email ou senha incorretos!"
        }

@eel.expose
def obter_usuario_logado():
    """Retorna dados do usuário logado"""
    if usuario_logado:
        return {"logado": True, "usuario": usuario_logado}
    return {"logado": False}

@eel.expose
def fazer_logout():
    """Realiza logout do usuário"""
    global usuario_logado
    usuario_logado = None
    return {"sucesso": True, "mensagem": "Logout realizado com sucesso!"}

@eel.expose
def cadastrar_usuario(tipo_usuario, posto_graduacao, matricula, nome, email, senha=None, profile=None):
    """Cadastra novo usuário (operador ou encarregado)"""
    # Validações básicas comuns
    if not tipo_usuario or not posto_graduacao or not matricula or not nome:
        return {"sucesso": False, "mensagem": "Todos os campos obrigatórios devem ser preenchidos!"}

    if len(nome.strip()) < 2:
        return {"sucesso": False, "mensagem": "Nome deve ter pelo menos 2 caracteres!"}

    if tipo_usuario == 'operador':
        if not email:
            return {"sucesso": False, "mensagem": "Email é obrigatório para operadores!"}
        if "@" not in email or "." not in email:
            return {"sucesso": False, "mensagem": "Email inválido!"}
        if not senha:
            return {"sucesso": False, "mensagem": "Senha é obrigatória para operadores!"}
        if len(senha) < 4:
            return {"sucesso": False, "mensagem": "Senha deve ter pelo menos 4 caracteres!"}
        if not profile or profile not in ['admin', 'comum']:
            return {"sucesso": False, "mensagem": "Perfil inválido para operador!"}
        return db_manager.add_operador(posto_graduacao, matricula.strip(), nome.strip(), email.strip().lower(), senha, profile)
    elif tipo_usuario == 'encarregado':
        # Email é opcional para encarregado, mas se preenchido, deve ser válido
        if email:
            if "@" not in email or "." not in email:
                return {"sucesso": False, "mensagem": "Email inválido!"}
            return db_manager.add_encarregado(posto_graduacao, matricula.strip(), nome.strip(), email.strip().lower())
        else:
            return db_manager.add_encarregado(posto_graduacao, matricula.strip(), nome.strip(), None)
    else:
        return {"sucesso": False, "mensagem": "Tipo de usuário inválido!"}

@eel.expose
def listar_usuarios(search_term=None, page=1, per_page=10):
    """Lista todos os usuários cadastrados com paginação e pesquisa"""
    return db_manager.get_paginated_users(search_term, page, per_page)

@eel.expose
def listar_todos_usuarios():
    """Lista todos os usuários incluindo admin (para processos)"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    
    all_users = []

    # Buscar encarregados
    cursor.execute('''
        SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at, ativo 
        FROM encarregados 
        WHERE ativo = 1
        ORDER BY nome ASC
    ''')
    encarregados = cursor.fetchall()
    for user in encarregados:
        all_users.append({
            "id": user[0],
            "posto_graduacao": user[1],
            "matricula": user[2],
            "nome": user[3],
            "email": user[4],
            "created_at": user[5],
            "updated_at": user[6],
            "ativo": bool(user[7]),
            "tipo": "encarregado"
        })

    # Buscar operadores
    cursor.execute('''
        SELECT id, posto_graduacao, matricula, nome, email, created_at, updated_at, ativo 
        FROM operadores 
        WHERE ativo = 1
        ORDER BY nome ASC
    ''')
    operadores = cursor.fetchall()
    for user in operadores:
        all_users.append({
            "id": user[0],
            "posto_graduacao": user[1],
            "matricula": user[2],
            "nome": user[3],
            "email": user[4],
            "created_at": user[5],
            "updated_at": user[6],
            "ativo": bool(user[7]),
            "tipo": "operador"
        })
    
    conn.close()
    
    # Opcional: ordenar a lista combinada se necessário
    all_users.sort(key=lambda x: x['nome'])

    return all_users

@eel.expose
def atualizar_usuario(user_id, user_type, posto_graduacao, matricula, nome, email, senha=None, profile=None):
    """Atualiza um usuário existente"""
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

@eel.expose
def delete_user(user_id, user_type):
    """Desativa um usuário"""
    return db_manager.delete_user(user_id, user_type)

@eel.expose
def verificar_admin():
    """Verifica se usuário logado é admin"""
    if usuario_logado and usuario_logado.get('tipo') == 'operador':
        return usuario_logado.get('profile') == 'admin'
    return False

@eel.expose
def obter_estatisticas():
    """Retorna estatísticas do sistema"""
    return db_manager.get_stats()

@eel.expose
def registrar_processo(numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo):
    """Registra um novo processo/procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO processos_procedimentos (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo))

        conn.commit()
        conn.close()

        return {"sucesso": True, "mensagem": "Processo/Procedimento registrado com sucesso!"}

    except sqlite3.IntegrityError as e:
        return {"sucesso": False, "mensagem": "Número de processo já existe."}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao registrar processo/procedimento: {str(e)}"}

@eel.expose
def listar_processos():
    """Lista todos os processos cadastrados"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
            CASE 
                WHEN p.responsavel_tipo = 'encarregado' THEN e.nome
                WHEN p.responsavel_tipo = 'operador' THEN o.nome
                ELSE 'Desconhecido'
            END as responsavel,
            p.created_at 
        FROM processos_procedimentos p
        LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
        LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
        WHERE p.ativo = 1
        ORDER BY p.created_at DESC
    """)

    processos = cursor.fetchall()
    conn.close()

    return [{
        "id": processo[0],
        "numero": processo[1],
        "tipo_geral": processo[2],
        "tipo_detalhe": processo[3],
        "documento_iniciador": processo[4],
        "processo_sei": processo[5],
        "responsavel": processo[6],
        "data_criacao": processo[7]
    } for processo in processos]

@eel.expose
def excluir_processo(processo_id):
    """Exclui um processo/procedimento (soft delete)"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE processos_procedimentos 
            SET ativo = 0 
            WHERE id = ?
        """, (processo_id,))
        
        conn.commit()
        conn.close()
        
        return {"sucesso": True, "mensagem": "Processo/Procedimento excluído com sucesso!"}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao excluir processo/procedimento: {str(e)}"}

@eel.expose
def obter_processo(processo_id):
    """Obtém dados de um processo específico para edição"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
                p.responsavel_id, p.responsavel_tipo,
                CASE 
                    WHEN p.responsavel_tipo = 'encarregado' THEN e.nome
                    WHEN p.responsavel_tipo = 'operador' THEN o.nome
                    ELSE 'Desconhecido'
                END as responsavel_nome
            FROM processos_procedimentos p
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            WHERE p.id = ? AND p.ativo = 1
        """, (processo_id,))
        
        processo = cursor.fetchone()
        conn.close()
        
        if processo:
            return {
                "id": processo[0],
                "numero": processo[1],
                "tipo_geral": processo[2],
                "tipo_detalhe": processo[3],
                "documento_iniciador": processo[4],
                "processo_sei": processo[5],
                "responsavel_id": processo[6],
                "responsavel_tipo": processo[7],
                "responsavel_nome": processo[8]
            }
        else:
            return None
    except Exception as e:
        print(f"Erro ao obter processo: {e}")
        return None

@eel.expose
def atualizar_processo(processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo):
    """Atualiza um processo/procedimento existente"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE processos_procedimentos 
            SET numero = ?, tipo_geral = ?, tipo_detalhe = ?, documento_iniciador = ?, 
                processo_sei = ?, responsavel_id = ?, responsavel_tipo = ?
            WHERE id = ?
        """, (numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo, processo_id))
        
        conn.commit()
        conn.close()
        
        return {"sucesso": True, "mensagem": "Processo/Procedimento atualizado com sucesso!"}
    except sqlite3.IntegrityError as e:
        return {"sucesso": False, "mensagem": "Número de processo já existe."}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao atualizar processo/procedimento: {str(e)}"}

def main():
    """Função principal"""
    print("🚀 Iniciando Sistema de Login com Cadastro...")
    print(f"📁 Banco de dados: {db_manager.db_path}")
    print("👤 Login admin: admin / 123456")
    print("\n🌐 Abrindo aplicação...")
    
    try:
        # Tenta Chrome primeiro
        eel.start('login.html',
                  mode='chrome',
                  size=(1000, 700),
                  port=8000,
                  close_callback=lambda *args: print("👋 Aplicação fechada"))
    except Exception as e:
        print(f"❌ Erro com Chrome: {e}")
        print("💡 Tentando navegador padrão...")
        try:
            eel.start('login.html',
                      mode='default', 
                      size=(1000, 700),
                      port=8000)
        except Exception as e2:
            print(f"❌ Erro crítico: {e2}")
            input("Pressione Enter para sair...")

if __name__ == "__main__":
    main()