# main.py - Sistema Login com Cadastro usando SQLite
import eel
import sqlite3
import hashlib
import os
import sys
from datetime import datetime, timedelta
import uuid
import time
from prazos_andamentos_manager import PrazosAndamentosManager

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
                local_origem TEXT,
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

# Inicializar gerenciador de prazos e andamentos
prazos_manager = PrazosAndamentosManager(db_manager.db_path)

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
def registrar_processo(
    numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
    local_origem=None, data_instauracao=None, data_recebimento=None, escrivao_id=None, status_pm=None, nome_pm_id=None,
    nome_vitima=None, natureza_processo=None, natureza_procedimento=None, resumo_fatos=None,
    numero_portaria=None, numero_memorando=None, numero_feito=None, numero_rgf=None, numero_controle=None
):
    """Registra um novo processo/procedimento"""
    print(f"📝 Tentando registrar processo: {numero}, {tipo_geral}, {tipo_detalhe}")
    print(f"Parâmetros recebidos:")
    params = {
        "numero": numero, "tipo_geral": tipo_geral, "tipo_detalhe": tipo_detalhe,
        "documento_iniciador": documento_iniciador, "processo_sei": processo_sei,
        "responsavel_id": responsavel_id, "responsavel_tipo": responsavel_tipo,
        "local_origem": local_origem, "data_instauracao": data_instauracao,
        "data_recebimento": data_recebimento, "escrivao_id": escrivao_id,
        "status_pm": status_pm, "nome_pm_id": nome_pm_id,
        "nome_vitima": nome_vitima, "natureza_processo": natureza_processo,
        "natureza_procedimento": natureza_procedimento, "resumo_fatos": resumo_fatos,
        "numero_portaria": numero_portaria, "numero_memorando": numero_memorando,
        "numero_feito": numero_feito, "numero_rgf": numero_rgf, "numero_controle": numero_controle
    }
    for key, value in params.items():
        print(f"  - {key}: {value}")
    
    # Validação do documento_iniciador
    documentos_validos = ['Portaria', 'Memorando Disciplinar', 'Feito Preliminar']
    if documento_iniciador not in documentos_validos:
        print(f"❌ Documento iniciador inválido: {documento_iniciador}")
        return {"sucesso": False, "mensagem": f"Documento iniciador inválido. Valores permitidos: {', '.join(documentos_validos)}"}
    
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO processos_procedimentos (
                id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
                local_origem, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
                nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
                numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()), numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
            local_origem, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle
        ))

        conn.commit()
        conn.close()
        print(f"✅ Processo registrado com sucesso: {numero}")
        return {"sucesso": True, "mensagem": "Processo/Procedimento registrado com sucesso!"}

    except sqlite3.IntegrityError as e:
        print(f"❌ Erro de integridade no banco de dados: {str(e)}")
        return {"sucesso": False, "mensagem": "Número de processo já existe."}
    except Exception as e:
        print(f"❌ Erro ao registrar processo: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao registrar processo/procedimento: {str(e)}"}

@eel.expose
def listar_processos():
    """Lista todos os processos cadastrados"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
            COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel,
            p.created_at,
            p.local_origem, 
            p.data_instauracao,
            p.status_pm,
            CASE 
                WHEN p.nome_pm_id IS NOT NULL THEN COALESCE(
                    (SELECT nome FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT nome FROM encarregados WHERE id = p.nome_pm_id),
                    'Desconhecido'
                )
                ELSE NULL
            END as nome_pm,
            p.numero_portaria,
            p.numero_memorando,
            p.numero_feito,
            p.responsavel_id, 
            p.responsavel_tipo,
            COALESCE(o.posto_graduacao, e.posto_graduacao, '') as responsavel_pg,
            COALESCE(o.matricula, e.matricula, '') as responsavel_matricula,
            COALESCE(
                (SELECT posto_graduacao FROM operadores WHERE id = p.nome_pm_id),
                (SELECT posto_graduacao FROM encarregados WHERE id = p.nome_pm_id),
                ''
            ) as nome_pm_pg,
            COALESCE(
                (SELECT matricula FROM operadores WHERE id = p.nome_pm_id),
                (SELECT matricula FROM encarregados WHERE id = p.nome_pm_id),
                ''
            ) as nome_pm_matricula,
            p.numero_rgf,
            p.numero_controle
        FROM processos_procedimentos p
        LEFT JOIN operadores o ON p.responsavel_id = o.id
        LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
        WHERE p.ativo = 1
        ORDER BY p.created_at DESC
    """)

    processos = cursor.fetchall()
    conn.close()
    
    # Formatar o número do procedimento baseado no numero_controle
    def formatar_numero_processo(processo):
        numero_controle = processo[22]  # numero_controle é o índice 22 agora
        tipo_detalhe = processo[3]
        documento = processo[4]
        local_origem = processo[8] or ""
        data_instauracao = processo[9] or ""
        ano_instauracao = ""
        
        # Extrair o ano da data de instauração, se disponível
        if data_instauracao:
            try:
                ano_instauracao = str(datetime.strptime(data_instauracao, "%Y-%m-%d").year)
            except:
                ano_instauracao = ""
        
        # Usar numero_controle para formatação
        if numero_controle:
            return f"{tipo_detalhe} nº {numero_controle}/{local_origem}/{ano_instauracao}"
        else:
            # Fallback para o número do documento se numero_controle estiver vazio
            numero_documento = processo[1]
            if numero_documento:
                return f"{tipo_detalhe} nº {numero_documento}/{local_origem}/{ano_instauracao}"
        
        return "S/N"

    return [{
        "id": processo[0],
        "numero": processo[1],
        "numero_controle": processo[22],  # Incluir numero_controle
        "numero_formatado": formatar_numero_processo(processo),
        "tipo_geral": processo[2],
        "tipo_detalhe": processo[3],
        "documento_iniciador": processo[4],
        "processo_sei": processo[5],
        "responsavel": processo[6],
        "responsavel_posto_grad": processo[17] or "",  # Posto/graduação do responsável (índice 17)
        "responsavel_matricula": processo[18] or "",  # Matrícula do responsável (índice 18)
        "data_criacao": processo[7],
        "local_origem": processo[8],
        "data_instauracao": processo[9],
        "status_pm": processo[10],
        "nome_pm": processo[11],
        "nome_pm_posto_grad": processo[19] or "",  # Posto/graduação do PM envolvido (índice 19)
        "nome_pm_matricula": processo[20] or "",  # Matrícula do PM envolvido (índice 20)
        "numero_rgf": processo[21] or "",  # Número do RGF (índice 21)
        "responsavel_completo": f"{processo[17] or ''} {processo[18] or ''} {processo[6]}".strip(),  # Posto/graduação + matrícula + nome
        "nome_pm_completo": f"{processo[19] or ''} {processo[20] or ''} {processo[11] or ''}".strip() if processo[11] else None  # Posto/graduação + matrícula + nome PM
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
                COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel_nome,
                p.local_origem, p.data_instauracao, p.data_recebimento, p.escrivao_id, p.status_pm, p.nome_pm_id,
                p.nome_vitima, p.natureza_processo, p.natureza_procedimento, p.resumo_fatos,
                p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf, p.numero_controle
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
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
                "responsavel_nome": processo[8],
                "local_origem": processo[9],
                "data_instauracao": processo[10],
                "data_recebimento": processo[11],
                "escrivao_id": processo[12],
                "status_pm": processo[13],
                "nome_pm_id": processo[14],
                "nome_vitima": processo[15],
                "natureza_processo": processo[16],
                "natureza_procedimento": processo[17],
                "resumo_fatos": processo[18],
                "numero_portaria": processo[19],
                "numero_memorando": processo[20],
                "numero_feito": processo[21],
                "numero_rgf": processo[22],
                "numero_controle": processo[23]
            }
        else:
            return None
    except Exception as e:
        print(f"Erro ao obter processo: {e}")
        return None

@eel.expose
def atualizar_processo(
    processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
    local_origem=None, data_instauracao=None, data_recebimento=None, escrivao_id=None, status_pm=None, nome_pm_id=None,
    nome_vitima=None, natureza_processo=None, natureza_procedimento=None, resumo_fatos=None,
    numero_portaria=None, numero_memorando=None, numero_feito=None, numero_rgf=None, numero_controle=None
):
    """Atualiza um processo/procedimento existente"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE processos_procedimentos 
            SET numero = ?, tipo_geral = ?, tipo_detalhe = ?, documento_iniciador = ?, 
                processo_sei = ?, responsavel_id = ?, responsavel_tipo = ?,
                local_origem = ?, data_instauracao = ?, data_recebimento = ?, escrivao_id = ?, status_pm = ?, nome_pm_id = ?,
                nome_vitima = ?, natureza_processo = ?, natureza_procedimento = ?, resumo_fatos = ?,
                numero_portaria = ?, numero_memorando = ?, numero_feito = ?, numero_rgf = ?, numero_controle = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
            local_origem, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
            processo_id
        ))
        
        conn.commit()
        conn.close()
        
        return {"sucesso": True, "mensagem": "Processo/Procedimento atualizado com sucesso!"}
    except sqlite3.IntegrityError as e:
        return {"sucesso": False, "mensagem": "Número de processo já existe."}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao atualizar processo/procedimento: {str(e)}"}

# ======== FUNÇÕES DE PRAZOS E ANDAMENTOS ========

@eel.expose
def definir_prazo_processo(processo_id, tipo_prazo, data_limite, descricao=None, responsavel_id=None):
    """Define um prazo para um processo"""
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

@eel.expose
def prorrogar_prazo_processo(prazo_id, nova_data_limite, motivo_prorrogacao, responsavel_id=None):
    """Prorroga um prazo existente"""
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

@eel.expose
def concluir_prazo_processo(prazo_id, observacoes=None, responsavel_id=None):
    """Marca um prazo como concluído"""
    try:
        resultado = prazos_manager.concluir_prazo(
            prazo_id=prazo_id,
            observacoes=observacoes,
            responsavel_id=responsavel_id
        )
        return resultado
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao concluir prazo: {str(e)}"}

@eel.expose
def listar_prazos_processo(processo_id):
    """Lista todos os prazos de um processo"""
    try:
        prazos = prazos_manager.listar_prazos_processo(processo_id)
        return {"sucesso": True, "prazos": prazos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao listar prazos: {str(e)}"}

@eel.expose
def obter_prazos_vencendo(dias_antecedencia=7):
    """Obtém prazos que estão vencendo nos próximos dias"""
    try:
        prazos = prazos_manager.obter_prazos_vencendo(dias_antecedencia)
        return {"sucesso": True, "prazos": prazos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter prazos vencendo: {str(e)}"}

@eel.expose
def obter_prazos_vencidos():
    """Obtém prazos que já venceram"""
    try:
        prazos = prazos_manager.obter_prazos_vencidos()
        return {"sucesso": True, "prazos": prazos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter prazos vencidos: {str(e)}"}

@eel.expose
def registrar_andamento_processo(processo_id, tipo_andamento, descricao, data_andamento=None, responsavel_id=None, observacoes=None):
    """Registra um novo andamento para um processo"""
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

@eel.expose
def listar_andamentos_processo(processo_id):
    """Lista todos os andamentos de um processo"""
    try:
        andamentos = prazos_manager.listar_andamentos_processo(processo_id)
        return {"sucesso": True, "andamentos": andamentos}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao listar andamentos: {str(e)}"}

@eel.expose
def atualizar_status_detalhado_processo(processo_id, novo_status, observacoes=None, responsavel_id=None):
    """Atualiza o status detalhado de um processo"""
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

@eel.expose
def obter_status_detalhado_processo(processo_id):
    """Obtém o histórico de status detalhado de um processo"""
    try:
        status = prazos_manager.obter_status_detalhado(processo_id)
        return {"sucesso": True, "status": status}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter status: {str(e)}"}

@eel.expose
def obter_dashboard_prazos():
    """Obtém dados para dashboard de prazos"""
    try:
        dashboard = prazos_manager.obter_dashboard_prazos()
        return {"sucesso": True, "dashboard": dashboard}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao obter dashboard: {str(e)}"}

@eel.expose
def gerar_relatorio_processo(processo_id):
    """Gera relatório completo de um processo"""
    try:
        relatorio = prazos_manager.gerar_relatorio_processo(processo_id)
        return {"sucesso": True, "relatorio": relatorio}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao gerar relatório: {str(e)}"}

@eel.expose
def gerar_relatorio_prazos(filtros=None):
    """Gera relatório de prazos com filtros opcionais"""
    try:
        relatorio = prazos_manager.gerar_relatorio_prazos(filtros)
        return {"sucesso": True, "relatorio": relatorio}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao gerar relatório de prazos: {str(e)}"}

# ======== FUNÇÕES AUXILIARES PARA PRAZOS ========

# ======== FUNÇÕES AUXILIARES PARA PRAZOS ========

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
    from datetime import datetime, timedelta
    
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

@eel.expose
def calcular_prazo_por_processo(processo_id):
    """Calcula o prazo de um processo específico"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Buscar dados do processo
        cursor.execute("""
            SELECT 
                tipo_detalhe, documento_iniciador, data_recebimento,
                numero, tipo_geral
            FROM processos_procedimentos 
            WHERE id = ? AND ativo = 1
        """, (processo_id,))
        
        processo = cursor.fetchone()
        conn.close()
        
        if not processo:
            return {"sucesso": False, "mensagem": "Processo não encontrado"}
        
        tipo_detalhe, documento_iniciador, data_recebimento, numero, tipo_geral = processo
        
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
            data_recebimento=data_recebimento,
            prorrogacoes_dias=prorrogacoes_dias
        )
        
        return {
            "sucesso": True,
            "processo": {
                "numero": numero,
                "tipo_geral": tipo_geral,
                "tipo_detalhe": tipo_detalhe,
                "documento_iniciador": documento_iniciador,
                "data_recebimento": data_recebimento
            },
            "prazo": calculo_prazo
        }
        
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao calcular prazo: {str(e)}"}

@eel.expose
def listar_processos_com_prazos(search_term=None, page=1, per_page=6, filtros=None):
    """Lista processos com cálculo de prazo automático, paginação e filtros avançados"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Construir a cláusula WHERE para pesquisa
        where_clause = "WHERE p.ativo = 1"
        search_params = []
        
        # Adicionar busca por texto se fornecida
        if search_term:
            where_clause += """ AND (
                p.numero LIKE ? OR p.tipo_detalhe LIKE ? OR p.local_origem LIKE ? OR
                p.processo_sei LIKE ? OR p.numero_portaria LIKE ? OR p.numero_memorando LIKE ? OR
                p.numero_feito LIKE ? OR 
                COALESCE(o.nome, e.nome, o_backup.nome, e_backup.nome, '') LIKE ? OR
                COALESCE(pm_env_e.nome, pm_env_o.nome, '') LIKE ?
            )"""
            search_term_like = f"%{search_term}%"
            search_params = [search_term_like] * 9
        
        # Adicionar filtros avançados se fornecidos
        if filtros:
            if filtros.get('tipo'):
                where_clause += " AND p.tipo_detalhe = ?"
                search_params.append(filtros['tipo'])
            
            if filtros.get('origem'):
                where_clause += " AND p.local_origem = ?"
                search_params.append(filtros['origem'])
            
            if filtros.get('documento'):
                where_clause += " AND p.documento_iniciador = ?"
                search_params.append(filtros['documento'])
            
            if filtros.get('status'):
                where_clause += " AND p.status_pm = ?"
                search_params.append(filtros['status'])
            
            if filtros.get('encarregado'):
                where_clause += """ AND (
                    TRIM(COALESCE(
                        CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao || ' ' || o.matricula || ' ' || o.nome END,
                        CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao || ' ' || e.matricula || ' ' || e.nome END,
                        o_backup.posto_graduacao || ' ' || o_backup.matricula || ' ' || o_backup.nome,
                        e_backup.posto_graduacao || ' ' || e_backup.matricula || ' ' || e_backup.nome,
                        ''
                    )) = ?
                )"""
                search_params.append(filtros['encarregado'])
            
            if filtros.get('ano'):
                # Priorizar data_instauracao, depois data_recebimento, depois created_at
                where_clause += """ AND (
                    CASE 
                        WHEN p.data_instauracao IS NOT NULL THEN strftime('%Y', p.data_instauracao)
                        WHEN p.data_recebimento IS NOT NULL THEN strftime('%Y', p.data_recebimento)
                        ELSE strftime('%Y', p.created_at)
                    END = ?
                )"""
                search_params.append(filtros['ano'])
            
            if filtros.get('pm_envolvido'):
                where_clause += """ AND (
                    TRIM(COALESCE(
                        (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM operadores WHERE id = p.nome_pm_id),
                        (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM encarregados WHERE id = p.nome_pm_id),
                        ''
                    )) = ?
                )"""
                search_params.append(filtros['pm_envolvido'])
            
            if filtros.get('vitima'):
                where_clause += " AND p.nome_vitima = ?"
                search_params.append(filtros['vitima'])
        
        # Contar total de registros
        count_query = f"""
            SELECT COUNT(*)
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_backup ON p.responsavel_id = o_backup.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN encarregados e_backup ON p.responsavel_id = e_backup.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados pm_env_e ON p.nome_pm_id = pm_env_e.id
            LEFT JOIN operadores pm_env_o ON p.nome_pm_id = pm_env_o.id
            {where_clause}
        """
        cursor.execute(count_query, search_params)
        total_processos = cursor.fetchone()[0]
        
        # Calcular offset para paginação
        offset = (page - 1) * per_page
        
        # Query principal com paginação - ordenado por data_instauracao DESC (mais recente primeiro)
        main_query = f"""
            SELECT 
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, 
                p.data_recebimento, p.created_at, p.data_instauracao,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.nome END,
                    o_backup.nome,
                    e_backup.nome,
                    'Desconhecido'
                ) as responsavel_nome,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao END,
                    o_backup.posto_graduacao,
                    e_backup.posto_graduacao,
                    ''
                ) as responsavel_posto,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.matricula END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.matricula END,
                    o_backup.matricula,
                    e_backup.matricula,
                    ''
                ) as responsavel_matricula,
                p.local_origem, p.processo_sei, p.nome_pm_id, p.status_pm,
                COALESCE(pm_env_e.nome, pm_env_o.nome, 'Não informado') as pm_envolvido_nome,
                COALESCE(pm_env_e.posto_graduacao, pm_env_o.posto_graduacao, '') as pm_envolvido_posto,
                COALESCE(pm_env_e.matricula, pm_env_o.matricula, '') as pm_envolvido_matricula,
                p.numero_controle
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_backup ON p.responsavel_id = o_backup.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN encarregados e_backup ON p.responsavel_id = e_backup.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados pm_env_e ON p.nome_pm_id = pm_env_e.id
            LEFT JOIN operadores pm_env_o ON p.nome_pm_id = pm_env_o.id
            {where_clause}
            ORDER BY 
                CASE WHEN p.data_instauracao IS NOT NULL THEN p.data_instauracao ELSE p.created_at END DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(main_query, search_params + [per_page, offset])
        
        processos = cursor.fetchall()
        conn.close()
        
        processos_com_prazos = []
        
        for processo in processos:
            (processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, 
             data_recebimento, created_at, data_instauracao, responsavel_nome, responsavel_posto, responsavel_matricula,
             local_origem, processo_sei, nome_pm_id, status_pm, 
             pm_envolvido_nome, pm_envolvido_posto, pm_envolvido_matricula, numero_controle) = processo
            
            # Formatar responsável completo: "posto/grad + matrícula + nome"
            responsavel_completo = f"{responsavel_posto} {responsavel_matricula} {responsavel_nome}".strip()
            if responsavel_completo == "Desconhecido":
                responsavel_completo = "Desconhecido"
            
            # Formatar PM envolvido completo: "posto/grad + matrícula + nome"
            if pm_envolvido_nome != "Não informado":
                pm_envolvido_completo = f"{pm_envolvido_posto} {pm_envolvido_matricula} {pm_envolvido_nome}".strip()
            else:
                pm_envolvido_completo = "Não informado"
            
            # Calcular prazo para cada processo
            calculo_prazo = calcular_prazo_processo(
                tipo_detalhe=tipo_detalhe,
                documento_iniciador=documento_iniciador,
                data_recebimento=data_recebimento,
                prorrogacoes_dias=0  # Por enquanto sem prorrogações, será implementado depois
            )
            
            # Formatar numero do processo usando numero_controle
            def formatar_numero_processo():
                ano_instauracao = ""
                
                # Usar data_instauracao primeiro, se não existir usar data_recebimento
                data_para_ano = data_instauracao or data_recebimento
                if data_para_ano:
                    try:
                        ano_instauracao = str(datetime.strptime(data_para_ano, "%Y-%m-%d").year)
                    except:
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
                "responsavel_posto": responsavel_posto,
                "responsavel_matricula": responsavel_matricula,
                "responsavel_nome": responsavel_nome,
                "local_origem": local_origem,
                "processo_sei": processo_sei,
                "nome_pm_id": nome_pm_id,
                "pm_envolvido_nome": pm_envolvido_completo,
                "pm_envolvido_posto": pm_envolvido_posto,
                "pm_envolvido_matricula": pm_envolvido_matricula,
                "status_pm": status_pm,
                "data_criacao": created_at,
                "prazo": calculo_prazo
            }
            
            processos_com_prazos.append(processo_formatado)
        
        return {
            "sucesso": True, 
            "processos": processos_com_prazos,
            "total": total_processos,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_processos + per_page - 1) // per_page
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao listar processos com prazos: {str(e)}"}

@eel.expose
def listar_todos_processos_com_prazos():
    """Lista todos os processos com cálculo de prazo (sem paginação) - para compatibilidade"""
    try:
        resultado = listar_processos_com_prazos(search_term=None, page=1, per_page=999999)
        if resultado["sucesso"]:
            return {"sucesso": True, "processos": resultado["processos"]}
        return resultado
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao listar todos os processos: {str(e)}"}

@eel.expose
def obter_dashboard_prazos_simples():
    """Obtém estatísticas simples de prazos para dashboard"""
    try:
        # Buscar todos os processos ativos
        resultado = listar_todos_processos_com_prazos()
        
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

@eel.expose
def obter_tipos_prazo():
    """Retorna lista de tipos de prazo disponíveis"""
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

@eel.expose
def obter_tipos_andamento():
    """Retorna lista de tipos de andamento disponíveis"""
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

@eel.expose
def obter_status_processo():
    """Retorna lista de status disponíveis para processos"""
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

@eel.expose
def obter_opcoes_filtros():
    """Retorna todas as opções disponíveis para os filtros (baseado em todos os processos do banco)"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Buscar todos os valores únicos para cada campo de filtro
        cursor.execute("""
            SELECT DISTINCT 
                p.tipo_detalhe,
                p.local_origem,
                p.documento_iniciador,
                p.status_pm,
                p.nome_vitima,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.nome END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.nome END,
                    o_backup.nome,
                    e_backup.nome,
                    'Desconhecido'
                ) as responsavel_nome,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.posto_graduacao END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.posto_graduacao END,
                    o_backup.posto_graduacao,
                    e_backup.posto_graduacao,
                    ''
                ) as responsavel_posto,
                COALESCE(
                    CASE WHEN p.responsavel_tipo = 'operador' THEN o.matricula END,
                    CASE WHEN p.responsavel_tipo = 'encarregado' THEN e.matricula END,
                    o_backup.matricula,
                    e_backup.matricula,
                    ''
                ) as responsavel_matricula,
                COALESCE(
                    (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT posto_graduacao || ' ' || matricula || ' ' || nome FROM encarregados WHERE id = p.nome_pm_id),
                    ''
                ) as pm_envolvido_completo,
                strftime('%Y', p.data_instauracao) as ano_instauracao,
                strftime('%Y', p.data_recebimento) as ano_recebimento
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_backup ON p.responsavel_id = o_backup.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN encarregados e_backup ON p.responsavel_id = e_backup.id AND p.responsavel_tipo = 'operador'
            WHERE p.ativo = 1
        """)
        
        resultados = cursor.fetchall()
        conn.close()
        
        # Processar resultados
        tipos = set()
        origens = set()
        documentos = set()
        status = set()
        encarregados = set()
        pm_envolvidos = set()
        vitimas = set()
        anos = set()
        
        for row in resultados:
            (tipo_detalhe, local_origem, documento_iniciador, status_pm, nome_vitima,
             responsavel_nome, responsavel_posto, responsavel_matricula, pm_envolvido_completo,
             ano_instauracao, ano_recebimento) = row
            
            if tipo_detalhe:
                tipos.add(tipo_detalhe)
            if local_origem:
                origens.add(local_origem)
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