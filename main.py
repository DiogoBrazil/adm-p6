# main.py - Sistema Login com Cadastro usando SQLite
import eel
import sqlite3
import hashlib
import os
import sys
from datetime import datetime, timedelta
import uuid
import time
import json
from bottle import route, request, response
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
        
        # Criar tabela processos_procedimentos se não existir (schema atualizado)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS processos_procedimentos (
                id TEXT PRIMARY KEY,
                numero TEXT NOT NULL,
                tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
                tipo_detalhe TEXT NOT NULL,
                documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
                processo_sei TEXT,
                -- Agora opcionais para suportar PAD/CD/CJ
                responsavel_id TEXT,
                responsavel_tipo TEXT CHECK (responsavel_tipo IN ('encarregado', 'operador')),
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
                presidente_tipo TEXT CHECK (presidente_tipo IN ('encarregado', 'operador')),
                interrogante_id TEXT,
                interrogante_tipo TEXT CHECK (interrogante_tipo IN ('encarregado', 'operador')),
                escrivao_processo_id TEXT,
                escrivao_processo_tipo TEXT CHECK (escrivao_processo_tipo IN ('encarregado', 'operador')),
                UNIQUE(numero, documento_iniciador, ano_instauracao)
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
            ''', (admin_id, 'CEL PM', '000000', 'ADMINISTRADOR', 'admin', senha_hash, 'admin'))
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
            # Converter nome para maiúsculas
            nome = nome.strip().upper()
            
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
            # Converter nome para maiúsculas
            nome = nome.strip().upper()
            
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
            # Converter nome para maiúsculas
            nome = nome.strip().upper()
            
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

        # Contar total de operadores (incluindo admin, mas excluindo o usuário padrão "ADMINISTRADOR")
        operador_where = where_clause + " AND nome != 'ADMINISTRADOR'"
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
            {where_clause} AND nome != 'ADMINISTRADOR'
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

# Adicionar rota HTTP para buscar transgressões
@route('/buscar_transgressoes')
def api_buscar_transgressoes():
    """Endpoint HTTP para buscar transgressões por gravidade"""
    response.content_type = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = '*'
    
    try:
        gravidade = request.query.get('gravidade', '')
        
        if not gravidade:
            return json.dumps({"erro": "Parâmetro gravidade é obrigatório"})
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, inciso, texto 
            FROM transgressoes 
            WHERE gravidade = ? AND ativo = 1
            ORDER BY 
                CASE 
                    WHEN inciso GLOB '[IVX]*' THEN LENGTH(inciso)
                    ELSE 999
                END,
                inciso
        """, (gravidade,))
        
        transgressoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for t in transgressoes:
            resultado.append({
                "id": t[0],
                "inciso": t[1],
                "texto": t[2]
            })
        
        return json.dumps(resultado)
        
    except Exception as e:
        return json.dumps({"erro": f"Erro ao buscar transgressões: {str(e)}"})

# Adicionar rota HTTP para buscar infrações do Art. 29
@route('/buscar_infracoes_art29')
def api_buscar_infracoes_art29():
    """Endpoint HTTP para buscar infrações do Art. 29 do Decreto Lei 09-A"""
    response.content_type = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = '*'
    
    try:
        termo = request.query.get('termo', '').strip()
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        if termo:
            # Busca com filtro por termo
            cursor.execute("""
                SELECT id, inciso, texto 
                FROM infracoes_estatuto_art29 
                WHERE (inciso LIKE ? OR texto LIKE ?) AND ativo = 1
                ORDER BY 
                    CASE 
                        WHEN inciso GLOB '[IVXLC]*' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
            """, (f'%{termo}%', f'%{termo}%'))
        else:
            # Busca todos os incisos
            cursor.execute("""
                SELECT id, inciso, texto 
                FROM infracoes_estatuto_art29 
                WHERE ativo = 1
                ORDER BY 
                    CASE 
                        WHEN inciso GLOB '[IVXLC]*' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
            """)
        
        infracoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for i in infracoes:
            resultado.append({
                "id": i[0],
                "inciso": i[1],
                "texto": i[2]
            })
        
        return json.dumps(resultado)
        
    except Exception as e:
        return json.dumps({"erro": f"Erro ao buscar infrações do Art. 29: {str(e)}"})

# Adicionar rota HTTP para buscar municípios e distritos
@route('/buscar_municipios_distritos')
def api_buscar_municipios_distritos():
    """Endpoint HTTP para buscar municípios e distritos de Rondônia"""
    response.content_type = 'application/json'
    response.headers['Access-Control-Allow-Origin'] = '*'
    
    try:
        termo = request.query.get('termo', '').strip()
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        if termo:
            # Busca com filtro por termo
            cursor.execute("""
                SELECT id, nome, tipo, municipio_pai 
                FROM municipios_distritos 
                WHERE nome LIKE ? AND ativo = 1
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
                WHERE ativo = 1
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
            nome_display = m[1]  # nome
            if m[2] == 'distrito' and m[3]:  # se é distrito e tem município pai
                nome_display = f"{m[1]} ({m[3]})"
            
            resultado.append({
                "id": m[0],
                "nome": m[1],
                "nome_display": nome_display,
                "tipo": m[2],
                "municipio_pai": m[3]
            })
        
        return json.dumps(resultado)
        
    except Exception as e:
        return json.dumps({"erro": f"Erro ao buscar municípios/distritos: {str(e)}"})

@eel.expose
def buscar_municipios_distritos(termo=''):
    """Função EEL para buscar municípios e distritos de Rondônia"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        if termo:
            # Busca com filtro por termo
            cursor.execute("""
                SELECT id, nome, tipo, municipio_pai 
                FROM municipios_distritos 
                WHERE nome LIKE ? AND ativo = 1
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
                WHERE ativo = 1
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
            nome_display = m[1]  # nome
            if m[2] == 'distrito' and m[3]:  # se é distrito e tem município pai
                nome_display = f"{m[1]} ({m[3]})"
            
            resultado.append({
                "id": m[0],
                "nome": m[1],
                "nome_display": nome_display,
                "tipo": m[2],
                "municipio_pai": m[3]
            })
        
        return {"sucesso": True, "municipios": resultado}
        
    except Exception as e:
        print(f"Erro ao buscar municípios/distritos: {e}")
        return {"sucesso": False, "erro": str(e)}

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
        return db_manager.add_operador(posto_graduacao, matricula.strip(), nome, email.strip().lower(), senha, profile)
    elif tipo_usuario == 'encarregado':
        # Email é opcional para encarregado, mas se preenchido, deve ser válido
        if email:
            if "@" not in email or "." not in email:
                return {"sucesso": False, "mensagem": "Email inválido!"}
            return db_manager.add_encarregado(posto_graduacao, matricula.strip(), nome, email.strip().lower())
        else:
            return db_manager.add_encarregado(posto_graduacao, matricula.strip(), nome, None)
    else:
        return {"sucesso": False, "mensagem": "Tipo de usuário inválido!"}

# ======== FUNÇÕES AUXILIARES ========

def buscar_pms_envolvidos(procedimento_id):
    """Busca todos os PMs envolvidos em um procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Busca primeiro os dados da tabela de relacionamento
        cursor.execute("""
            SELECT id, pm_id, pm_tipo, ordem, status_pm
            FROM procedimento_pms_envolvidos 
            WHERE procedimento_id = ?
            ORDER BY ordem
        """, (procedimento_id,))
        
        pms_relacionamento = cursor.fetchall()
        
        resultado = []
        for pm_rel in pms_relacionamento:
            pm_envolvido_id, pm_id, pm_tipo_tabela, ordem, status_pm_env = pm_rel
            
            # Busca primeiro na tabela operadores
            cursor.execute("""
                SELECT nome, posto_graduacao, matricula 
                FROM operadores 
                WHERE id = ?
            """, (pm_id,))
            
            pm_data = cursor.fetchone()
            
            # Se não encontrou em operadores, busca em encarregados
            if not pm_data:
                cursor.execute("""
                    SELECT nome, posto_graduacao, matricula 
                    FROM encarregados 
                    WHERE id = ?
                """, (pm_id,))
                
                pm_data = cursor.fetchone()
            
            if pm_data:
                nome = pm_data[0] or ""
                posto = pm_data[1] or ""
                matricula = pm_data[2] or ""
                
                # Montar nome completo removendo espaços extras
                nome_completo = f"{posto} {matricula} {nome}".strip()
                # Remover espaços duplos
                nome_completo = " ".join(nome_completo.split())
                
                # Buscar indícios associados a este PM
                indicios = buscar_indicios_por_pm(pm_envolvido_id)
                
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

def buscar_indicios_por_pm(pm_envolvido_id):
    """Busca todos os indícios associados a um PM específico"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Buscar o registro principal de indícios
        cursor.execute("""
            SELECT id, categoria
            FROM pm_envolvido_indicios 
            WHERE pm_envolvido_id = ? AND ativo = 1
        """, (pm_envolvido_id,))
        
        indicios_result = cursor.fetchone()
        if not indicios_result:
            conn.close()
            return None
            
        indicios_id, categoria = indicios_result
        
        # Buscar crimes associados
        crimes = []
        cursor.execute("""
            SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo, 
                   c.paragrafo, c.inciso, c.alinea
            FROM pm_envolvido_crimes pec
            JOIN crimes_contravencoes c ON c.id = pec.crime_id
            WHERE pec.pm_indicios_id = ?
        """, (indicios_id,))
        
        for row in cursor.fetchall():
            crimes.append({
                "id": row[0],
                "tipo": row[1],
                "dispositivo_legal": row[2], 
                "artigo": row[3],
                "descricao_artigo": row[4],
                "paragrafo": row[5] or "",
                "inciso": row[6] or "",
                "alinea": row[7] or ""
            })
        
        # Buscar transgressões RDPM associadas
        rdpm = []
        cursor.execute("""
            SELECT t.id, t.gravidade, t.inciso, t.texto
            FROM pm_envolvido_rdpm per
            JOIN transgressoes t ON t.id = per.transgressao_id
            WHERE per.pm_indicios_id = ?
        """, (indicios_id,))
        
        for row in cursor.fetchall():
            rdpm.append({
                "id": row[0],
                "gravidade": row[1],
                "inciso": row[2],
                "texto": row[3]
            })
        
        # Buscar infrações Art. 29 associadas
        art29 = []
        cursor.execute("""
            SELECT a.id, a.inciso, a.texto
            FROM pm_envolvido_art29 pea
            JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
            WHERE pea.pm_indicios_id = ?
        """, (indicios_id,))
        
        for row in cursor.fetchall():
            art29.append({
                "id": row[0],
                "inciso": row[1],
                "texto": row[2]
            })
        
        conn.close()
        
        return {
            "categoria": categoria,
            "crimes": crimes,
            "rdpm": rdpm,
            "art29": art29
        }
        
    except Exception as e:
        print(f"Erro ao buscar indícios do PM {pm_envolvido_id}: {e}")
        return None

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
def obter_estatisticas_encarregados():
    """Retorna estatísticas detalhadas por encarregado"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Primeiro, obter todos os encarregados
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome
            FROM encarregados 
            WHERE ativo = 1
            ORDER BY posto_graduacao, nome
        ''')
        encarregados = cursor.fetchall()
        
        estatisticas = []
        total_processos = 0
        mais_ativo = {"nome": "N/A", "total": 0}
        
        for encarregado in encarregados:
            enc_id, posto, matricula, nome = encarregado
            nome_completo = f"{posto} {matricula} {nome}"
            
            # Inicializar contadores
            contadores = {
                'sr': 0, 'fp': 0, 'ipm': 0, 'escrivao': 0,
                'pads': 0, 'pad': 0, 'cd': 0, 'cj': 0
            }
            
            # SR e Sindicâncias (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND (tipo_detalhe = 'SR' OR tipo_detalhe = 'SINDICANCIA')
                AND ativo = 1
            ''', (enc_id,))
            contadores['sr'] = cursor.fetchone()[0]
            
            # FP - Feito Preliminar (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND (tipo_detalhe = 'FP' OR tipo_detalhe = 'FEITO_PRELIMINAR')
                AND ativo = 1
            ''', (enc_id,))
            contadores['fp'] = cursor.fetchone()[0]
            
            # IPM (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND (tipo_detalhe = 'IPM' OR tipo_detalhe = 'IPPM')
                AND ativo = 1
            ''', (enc_id,))
            contadores['ipm'] = cursor.fetchone()[0]
            
            # Escrivão (quando foi escrivão em IPM)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE escrivao_id = ?
                AND (tipo_detalhe = 'IPM' OR tipo_detalhe = 'IPPM')
                AND ativo = 1
            ''', (enc_id,))
            contadores['escrivao'] = cursor.fetchone()[0]
            
            # PADS (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND tipo_detalhe = 'PADS'
                AND ativo = 1
            ''', (enc_id,))
            contadores['pads'] = cursor.fetchone()[0]
            
            # PAD (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND tipo_detalhe = 'PAD'
                AND ativo = 1
            ''', (enc_id,))
            contadores['pad'] = cursor.fetchone()[0]
            
            # CD - Conselho de Disciplina (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND tipo_detalhe = 'CD'
                AND ativo = 1
            ''', (enc_id,))
            contadores['cd'] = cursor.fetchone()[0]
            
            # CJ - Conselho de Justificação (como responsável)
            cursor.execute('''
                SELECT COUNT(*) FROM processos_procedimentos 
                WHERE responsavel_id = ? AND responsavel_tipo = 'encarregado'
                AND tipo_detalhe = 'CJ'
                AND ativo = 1
            ''', (enc_id,))
            contadores['cj'] = cursor.fetchone()[0]
            
            # Calcular total para este encarregado
            total_encarregado = sum(contadores.values())
            total_processos += total_encarregado
            
            # Verificar se é o mais ativo
            if total_encarregado > mais_ativo["total"]:
                mais_ativo = {"nome": nome_completo, "total": total_encarregado}
            
            # Adicionar aos resultados
            estatisticas.append({
                'id': enc_id,
                'nome': nome_completo,
                **contadores
            })
        
        # Preparar resumo
        resumo = {
            'totalEncarregados': len(encarregados),
            'totalProcessos': total_processos,
            'maisAtivo': mais_ativo["nome"] if mais_ativo["total"] > 0 else "N/A"
        }
        
        conn.close()
        
        return {
            "sucesso": True,
            "dados": estatisticas,
            "resumo": resumo
        }
        
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatisticas_processos_andamento():
    """Retorna estatísticas dos processos em andamento por tipo"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Query para contar processos em andamento por tipo
        query = '''
            SELECT 
                tipo_detalhe,
                COUNT(*) as total
            FROM processos_procedimentos 
            WHERE ativo = 1 
            AND (data_conclusao IS NULL OR data_conclusao = '')
            AND (concluido = 0 OR concluido IS NULL)
            GROUP BY tipo_detalhe
            ORDER BY total DESC
        '''
        
        cursor.execute(query)
        resultados = cursor.fetchall()
        
        # Converter para dicionário
        estatisticas = {}
        total_geral = 0
        
        for tipo, quantidade in resultados:
            if tipo:  # Ignorar tipos vazios
                estatisticas[tipo] = quantidade
                total_geral += quantidade
        
        # Adicionar total geral
        estatisticas['TOTAL'] = total_geral
        
        # Query para obter alguns dados adicionais úteis
        cursor.execute('''
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE ativo = 1 AND data_conclusao IS NOT NULL AND data_conclusao != ''
        ''')
        concluidos = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT COUNT(*) FROM processos_procedimentos WHERE ativo = 1
        ''')
        total_processos = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "sucesso": True,
            "andamento": estatisticas,
            "concluidos": concluidos,
            "total_processos": total_processos
        }
        
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatisticas():
    """Retorna estatísticas do sistema"""
    return db_manager.get_stats()

@eel.expose
def registrar_processo(
    numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
    local_origem=None, local_fatos=None, data_instauracao=None, data_recebimento=None, escrivao_id=None, status_pm=None, nome_pm_id=None,
    nome_vitima=None, natureza_processo=None, natureza_procedimento=None, resumo_fatos=None,
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
    escrivao_processo_id=None, escrivao_processo_tipo=None
):
    """Registra um novo processo/procedimento"""
    print(f"📝 Tentando registrar processo: {numero}, {tipo_geral}, {tipo_detalhe}")
    
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
    
    # Validação do documento_iniciador
    documentos_validos = ['Portaria', 'Memorando Disciplinar', 'Feito Preliminar']
    if documento_iniciador not in documentos_validos:
        print(f"❌ Documento iniciador inválido: {documento_iniciador}")
        return {"sucesso": False, "mensagem": f"Documento iniciador inválido. Valores permitidos: {', '.join(documentos_validos)}"}
    
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        # Garantir existência das novas colunas/tabelas (idempotente)
        try:
            cursor.execute("ALTER TABLE processos_procedimentos ADD COLUMN data_remessa_encarregado DATE")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE processos_procedimentos ADD COLUMN data_julgamento DATE")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE processos_procedimentos ADD COLUMN solucao_tipo TEXT")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE processos_procedimentos ADD COLUMN penalidade_tipo TEXT")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE processos_procedimentos ADD COLUMN penalidade_dias INTEGER")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE processos_procedimentos ADD COLUMN indicios_categorias TEXT")
        except Exception:
            pass
        # Tabelas de associação para indícios
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
            WHERE numero = ? AND documento_iniciador = ? AND tipo_detalhe = ? AND local_origem = ? AND ano_instauracao = ? AND ativo = 1
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
                WHERE numero_controle = ? AND documento_iniciador = ? AND tipo_detalhe = ? AND local_origem = ? AND ano_instauracao = ? AND ativo = 1
            """, (numero_controle, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao))
            conflito_controle = cursor.fetchone()
            
            print(f"🔍 Verificação controle - conflito encontrado: {conflito_controle is not None}")
            if conflito_controle:
                print(f"   Controle {numero_controle} já usado no {tipo_detalhe} {conflito_controle[1]}")
            
            if conflito_controle:
                local_msg = f" no {local_origem}" if local_origem else ""
                tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
                return {"sucesso": False, "mensagem": f"Já existe um {documento_iniciador} com número de controle {numero_controle}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}. (Usado no {conflito_controle[3] or tipo_detalhe} {conflito_controle[1]})"}

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
                _cursor.execute("SELECT 1 FROM operadores WHERE id = ?", (_id,))
                if _cursor.fetchone():
                    return 'operador'
                _cursor.execute("SELECT 1 FROM encarregados WHERE id = ?", (_id,))
                if _cursor.fetchone():
                    return 'encarregado'
            except Exception:
                pass
            return None

        presidente_tipo = _resolve_user_tipo(cursor, presidente_id) if presidente_id else None
        interrogante_tipo = _resolve_user_tipo(cursor, interrogante_id) if interrogante_id else None
        escrivao_processo_tipo = _resolve_user_tipo(cursor, escrivao_processo_id) if escrivao_processo_id else None

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
                presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
            )
        """, (
            processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
            local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
            concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
            data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
            presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo
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
                        VALUES (?, ?, ?, ?, ?, ?)
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
                    f"INSERT INTO {table_name} (id, procedimento_id, {col_name}) VALUES (?, ?, ?)",
                    (str(uuid.uuid4()), processo_id, val)
                )

        _insert_indicios(indicios_crimes, 'procedimentos_indicios_crimes', 'crime_id')
        _insert_indicios(indicios_rdpm, 'procedimentos_indicios_rdpm', 'transgressao_id')
        # Detectar nome correto da coluna (migrações antigas podem ter infracao_id)
        try:
            cursor.execute("PRAGMA table_info(procedimentos_indicios_art29)")
            cols_art29 = [r[1] for r in cursor.fetchall()]
            col_art29 = 'art29_id' if 'art29_id' in cols_art29 else ('infracao_id' if 'infracao_id' in cols_art29 else 'art29_id')
        except Exception:
            col_art29 = 'art29_id'
        _insert_indicios(indicios_art29, 'procedimentos_indicios_art29', col_art29)

        # ======== PROCESSAR INDÍCIOS POR PM (MIGRAÇÃO 015) ========
        try:
            print(f"🔍 Verificando indícios por PM recebidos: {indicios_por_pm}")
            print(f"🔍 Tipo dos indícios por PM: {type(indicios_por_pm)}")
            
            if indicios_por_pm and isinstance(indicios_por_pm, dict):
                print(f"🔧 Processando indícios por PM: {len(indicios_por_pm)} PMs")
                
                for pm_id, dados_indicios in indicios_por_pm.items():
                    print(f"🔍 Processando PM {pm_id}: {dados_indicios}")
                    
                    if not dados_indicios:
                        print(f"⚠️ PM {pm_id} sem dados de indícios")
                        continue
                        
                    # Buscar pm_envolvido_id para este PM
                    cursor.execute("""
                        SELECT id FROM procedimento_pms_envolvidos 
                        WHERE procedimento_id = ? AND pm_id = ?
                    """, (processo_id, pm_id))
                    
                    pm_envolvido_result = cursor.fetchone()
                    if not pm_envolvido_result:
                        print(f"⚠️ PM {pm_id} não encontrado na tabela procedimento_pms_envolvidos")
                        continue
                        
                    pm_envolvido_id = pm_envolvido_result[0]
                    
                    # Chamar função para salvar indícios deste PM
                    try:
                        from uuid import uuid4
                        
                        categoria = dados_indicios.get('categoria', '')
                        if categoria:
                            # Inserir registro principal
                            indicios_main_id = str(uuid4())
                            # Converter categoria em array JSON para categorias_indicios
                            import json
                            categorias_array = [cat.strip() for cat in categoria.split(',') if cat.strip()]
                            categorias_json = json.dumps(categorias_array)
                            
                            cursor.execute("""
                                INSERT INTO pm_envolvido_indicios (id, pm_envolvido_id, procedimento_id, categoria, categorias_indicios)
                                VALUES (?, ?, ?, ?, ?)
                            """, (indicios_main_id, pm_envolvido_id, processo_id, categoria, categorias_json))
                            
                            # Inserir crimes
                            crimes = dados_indicios.get('crimes', [])
                            for crime in crimes:
                                crime_id = crime.get('id') if isinstance(crime, dict) else crime
                                cursor.execute("""
                                    INSERT INTO pm_envolvido_crimes (id, pm_indicios_id, crime_id)
                                    VALUES (?, ?, ?)
                                """, (str(uuid4()), indicios_main_id, crime_id))
                            
                            # Inserir transgressões RDPM
                            rdpm = dados_indicios.get('rdpm', [])
                            for trans in rdpm:
                                trans_id = trans.get('id') if isinstance(trans, dict) else trans
                                cursor.execute("""
                                    INSERT INTO pm_envolvido_rdpm (id, pm_indicios_id, transgressao_id)
                                    VALUES (?, ?, ?)
                                """, (str(uuid4()), indicios_main_id, trans_id))
                            
                            # Inserir infrações Art. 29
                            art29 = dados_indicios.get('art29', [])
                            for infracao in art29:
                                infracao_id = infracao.get('id') if isinstance(infracao, dict) else infracao
                                cursor.execute("""
                                    INSERT INTO pm_envolvido_art29 (id, pm_indicios_id, art29_id)
                                    VALUES (?, ?, ?)
                                """, (str(uuid4()), indicios_main_id, infracao_id))
                            
                            print(f"✅ Indícios salvos para PM {pm_id}: {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")
                            
                    except Exception as e:
                        print(f"❌ Erro ao salvar indícios do PM {pm_id}: {e}")
                        
        except Exception as _e:
            print(f"Aviso: falha ao processar indícios por PM: {_e}")

        conn.commit()
        conn.close()
        print(f"✅ Processo registrado com sucesso: {numero}")
        return {"sucesso": True, "mensagem": "Processo/Procedimento registrado com sucesso!"}

    except sqlite3.IntegrityError as e:
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
            CASE 
                WHEN p.tipo_geral = 'processo' AND p.tipo_detalhe IN ('PAD','CD','CJ') AND p.responsavel_id IS NULL THEN 'Não se aplica'
                ELSE COALESCE(o.nome, e.nome, 'Desconhecido')
            END as responsavel,
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
            p.numero_controle,
            p.concluido,
            p.data_conclusao
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
        numero_controle = processo[22]  # numero_controle é o índice 22
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

    def formatar_pms_envolvidos(processo):
        """Formata a exibição dos PMs envolvidos considerando múltiplos PMs para procedimentos"""
        tipo_geral = processo[2]  # tipo_geral
        processo_id = processo[0]  # id
        
        # Se for procedimento, buscar múltiplos PMs
        if tipo_geral == 'procedimento':
            pms_envolvidos = buscar_pms_envolvidos(processo_id)
            
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
                pm_nome = processo[11]  # nome_pm
                pm_posto = processo[19] or ""  # nome_pm_pg
                pm_matricula = processo[20] or ""  # nome_pm_matricula
                
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
            pm_nome = processo[11]  # nome_pm
            pm_posto = processo[19] or ""  # nome_pm_pg
            pm_matricula = processo[20] or ""  # nome_pm_matricula
            
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
            "concluido": bool(processo[23]) if processo[23] is not None else False,  # Campo concluído (índice 23)
            "data_conclusao": processo[24] if len(processo) > 24 else None,  # Data de conclusão (índice 24)
            "responsavel_completo": f"{processo[17] or ''} {processo[18] or ''} {processo[6]}".strip(),  # Posto/graduação + matrícula + nome
            "nome_pm_completo": f"{processo[19] or ''} {processo[20] or ''} {processo[11] or ''}".strip() if processo[11] else None,  # Posto/graduação + matrícula + nome PM
            "pm_envolvido_nome": pms_info['display'],  # Campo para exibição na tabela
            "pm_envolvido_tooltip": pms_info['tooltip']  # Campo para tooltip
        })
    
    return resultado

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
    import json
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 
                p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
                p.responsavel_id, p.responsavel_tipo,
                COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel_nome,
                p.local_origem, p.local_fatos, p.data_instauracao, p.data_recebimento, p.escrivao_id, p.status_pm, p.nome_pm_id,
                p.nome_vitima, p.natureza_processo, p.natureza_procedimento, p.resumo_fatos,
                p.numero_portaria, p.numero_memorando, p.numero_feito, p.numero_rgf, p.numero_controle,
                p.concluido, p.data_conclusao, p.solucao_final, p.transgressoes_ids,
                p.data_remessa_encarregado, p.data_julgamento, p.solucao_tipo, p.penalidade_tipo, p.penalidade_dias, p.indicios_categorias,
                -- Dados completos do responsável
                COALESCE(o.posto_graduacao, e.posto_graduacao, '') as responsavel_posto,
                COALESCE(o.matricula, e.matricula, '') as responsavel_matricula,
                -- Dados completos do escrivão (procedimentos)
                COALESCE(esc_o.nome, esc_e.nome, '') as escrivao_nome,
                COALESCE(esc_o.posto_graduacao, esc_e.posto_graduacao, '') as escrivao_posto,
                COALESCE(esc_o.matricula, esc_e.matricula, '') as escrivao_matricula,
                -- Dados completos do PM envolvido
                COALESCE(pm_o.nome, pm_e.nome, '') as pm_nome,
                COALESCE(pm_o.posto_graduacao, pm_e.posto_graduacao, '') as pm_posto,
                COALESCE(pm_o.matricula, pm_e.matricula, '') as pm_matricula,
                -- IDs e tipos das funções de processo (PAD/CD/CJ)
                p.presidente_id, p.presidente_tipo,
                p.interrogante_id, p.interrogante_tipo,
                p.escrivao_processo_id, p.escrivao_processo_tipo,
                -- Dados completos das funções do processo
                COALESCE(pres_o.nome, pres_e.nome, '') as presidente_nome,
                COALESCE(pres_o.posto_graduacao, pres_e.posto_graduacao, '') as presidente_posto,
                COALESCE(pres_o.matricula, pres_e.matricula, '') as presidente_matricula,
                COALESCE(int_o.nome, int_e.nome, '') as interrogante_nome,
                COALESCE(int_o.posto_graduacao, int_e.posto_graduacao, '') as interrogante_posto,
                COALESCE(int_o.matricula, int_e.matricula, '') as interrogante_matricula,
                COALESCE(escrp_o.nome, escrp_e.nome, '') as escrivao_processo_nome,
                COALESCE(escrp_o.posto_graduacao, escrp_e.posto_graduacao, '') as escrivao_processo_posto,
                COALESCE(escrp_o.matricula, escrp_e.matricula, '') as escrivao_processo_matricula
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
            -- JOINs para escrivão (procedimentos)
            LEFT JOIN operadores esc_o ON p.escrivao_id = esc_o.id
            LEFT JOIN encarregados esc_e ON p.escrivao_id = esc_e.id AND esc_o.id IS NULL
            -- JOINs para PM envolvido
            LEFT JOIN operadores pm_o ON p.nome_pm_id = pm_o.id
            LEFT JOIN encarregados pm_e ON p.nome_pm_id = pm_e.id AND pm_o.id IS NULL
            -- JOINs para funções específicas de processo (PAD/CD/CJ)
            LEFT JOIN operadores pres_o ON p.presidente_id = pres_o.id AND p.presidente_tipo = 'operador'
            LEFT JOIN encarregados pres_e ON p.presidente_id = pres_e.id AND p.presidente_tipo = 'encarregado'
            LEFT JOIN operadores int_o ON p.interrogante_id = int_o.id AND p.interrogante_tipo = 'operador'
            LEFT JOIN encarregados int_e ON p.interrogante_id = int_e.id AND p.interrogante_tipo = 'encarregado'
            LEFT JOIN operadores escrp_o ON p.escrivao_processo_id = escrp_o.id AND p.escrivao_processo_tipo = 'operador'
            LEFT JOIN encarregados escrp_e ON p.escrivao_processo_id = escrp_e.id AND p.escrivao_processo_tipo = 'encarregado'
            WHERE p.id = ? AND p.ativo = 1
            """,
            (processo_id,)
        )

        processo = cursor.fetchone()
        conn.close()

        if not processo:
            return None

        # Formatar dados completos dos usuários
        responsavel_completo = ""
        # indices: 35=resp_posto, 36=resp_matricula, 8=resp_nome
        if processo[35] and processo[36] and processo[8]:
            responsavel_completo = f"{processo[35]} {processo[36]} {processo[8]}".strip()
        elif processo[8]:
            responsavel_completo = processo[8]

        escrivao_completo = ""
        # indices: 38=esc_posto, 39=esc_matricula, 37=esc_nome
        if processo[38] and processo[39] and processo[37]:
            escrivao_completo = f"{processo[38]} {processo[39]} {processo[37]}".strip()

        pm_completo = ""
        # indices: 41=pm_posto, 42=pm_matricula, 40=pm_nome
        if processo[41] and processo[42] and processo[40]:
            pm_completo = f"{processo[41]} {processo[42]} {processo[40]}".strip()

        # Para procedimentos, buscar múltiplos PMs envolvidos
        pms_envolvidos = []
        if processo[2] == 'procedimento':  # tipo_geral
            pms_envolvidos = buscar_pms_envolvidos(processo_id)

        # Processar transgressões (campo JSON) - suporta formato antigo e novo
        transgressoes_selecionadas = []
        if processo[28]:  # transgressoes_ids
            try:
                transgressoes_data = json.loads(processo[28])

                if isinstance(transgressoes_data, list) and len(transgressoes_data) > 0:
                    conn2 = db_manager.get_connection()
                    cursor2 = conn2.cursor()

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
                                cursor2.execute("SELECT id, inciso, texto FROM infracoes_estatuto_art29 WHERE id = ? AND ativo = 1", (art29_id,))
                                art29_trans = cursor2.fetchone()

                                if art29_trans:
                                    # Buscar dados completos da analogia RDPM
                                    analogia_completa = analogia_data.copy()
                                    if analogia_data.get('id'):
                                        cursor2.execute("SELECT id, inciso, texto FROM transgressoes WHERE id = ? AND ativo = 1", (analogia_data.get('id'),))
                                        rdpm_trans = cursor2.fetchone()
                                        if rdpm_trans:
                                            analogia_completa.update({
                                                'inciso': rdpm_trans[1],
                                                'texto': rdpm_trans[2]
                                            })

                                    transgressoes_selecionadas.append({
                                        'id': art29_trans[0],
                                        'inciso': art29_trans[1],
                                        'texto': art29_trans[2],
                                        'tipo': 'estatuto',
                                        'rdmp_analogia': analogia_completa
                                    })
                            else:
                                # Infração do RDPM (formato novo)
                                trans_id = trans_data.get('id')
                                natureza = trans_data.get('natureza', 'leve')

                                cursor2.execute("SELECT id, inciso, texto FROM transgressoes WHERE id = ? AND ativo = 1", (trans_id,))
                                trans = cursor2.fetchone()
                                if trans:
                                    transgressoes_selecionadas.append({
                                        'id': trans[0],
                                        'inciso': trans[1],
                                        'texto': trans[2],
                                        'natureza': natureza,
                                        'tipo': 'rdpm'
                                    })
                    else:
                        # Formato antigo: ["8", "21", "31"] - buscar natureza na tabela (só RDPM)
                        for trans_id in transgressoes_data:
                            cursor2.execute("SELECT id, inciso, texto, gravidade FROM transgressoes WHERE id = ? AND ativo = 1", (trans_id,))
                            trans = cursor2.fetchone()
                            if trans:
                                transgressoes_selecionadas.append({
                                    'id': trans[0],
                                    'inciso': trans[1],
                                    'texto': trans[2],
                                    'natureza': trans[3],  # gravidade da tabela
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
            cur_i = conn_i.cursor()
            # crimes_contravencoes
            try:
                cur_i.execute(
                    """
                    SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo, c.paragrafo, c.inciso, c.alinea
                    FROM procedimentos_indicios_crimes pic
                    JOIN crimes_contravencoes c ON c.id = pic.crime_id
                    WHERE pic.procedimento_id = ?
                    """,
                    (pid,)
                )
                for row in cur_i.fetchall():
                    ind["crimes"].append({
                        "id": row[0],
                        "tipo": row[1],
                        "dispositivo_legal": row[2],
                        "artigo": row[3],
                        "descricao_artigo": row[4],
                        "paragrafo": row[5] or "",
                        "inciso": row[6] or "",
                        "alinea": row[7] or ""
                    })
            except Exception:
                pass
            # rdpm
            try:
                cur_i.execute(
                    """
                    SELECT t.id, t.gravidade, t.inciso, t.texto
                    FROM procedimentos_indicios_rdpm pir
                    JOIN transgressoes t ON t.id = pir.transgressao_id
                    WHERE pir.procedimento_id = ?
                    """,
                    (pid,)
                )
                for row in cur_i.fetchall():
                    ind["rdpm"].append({
                        "id": row[0],
                        "gravidade": row[1],
                        "inciso": row[2],
                        "texto": row[3]
                    })
            except Exception:
                pass
            # art29
            try:
                # Detectar coluna (art29_id ou infracao_id)
                cur_i.execute("PRAGMA table_info(procedimentos_indicios_art29)")
                ccols = [r[1] for r in cur_i.fetchall()]
                col_fk = 'art29_id' if 'art29_id' in ccols else ('infracao_id' if 'infracao_id' in ccols else 'art29_id')
                cur_i.execute(
                    f"""
                    SELECT a.id, a.inciso, a.texto
                    FROM procedimentos_indicios_art29 pia
                    JOIN infracoes_estatuto_art29 a ON a.id = pia.{col_fk}
                    WHERE pia.procedimento_id = ?
                    """,
                    (pid,)
                )
                for row in cur_i.fetchall():
                    ind["art29"].append({
                        "id": row[0],
                        "inciso": row[1],
                        "texto": row[2]
                    })
            except Exception:
                pass
            conn_i.close()
            return ind

        indicios = _carregar_indicios(processo_id)

        # Carregar indícios por PM para procedimentos
        indicios_por_pm = {}
        if processo[2] == 'procedimento' and pms_envolvidos:  # tipo_geral
            print(f"🔍 Carregando indícios por PM para procedimento {processo_id}")
            for pm_envolvido in pms_envolvidos:
                pm_envolvido_id = pm_envolvido.get('pm_envolvido_id')
                if pm_envolvido_id:
                    indicios_pm = buscar_indicios_por_pm(pm_envolvido_id)
                    if indicios_pm:
                        indicios_por_pm[pm_envolvido['id']] = indicios_pm
                        print(f"✅ Indícios carregados para PM {pm_envolvido['nome_completo']}: {indicios_pm}")
            print(f"📋 Total de PMs com indícios carregados: {len(indicios_por_pm)}")

        # Montar nomes completos das funções de processo (campos adicionados ao final)
        presidente_completo = ""
        if processo[50] and processo[51] and processo[49]:
            presidente_completo = f"{processo[50]} {processo[51]} {processo[49]}".strip()

        interrogante_completo = ""
        if processo[53] and processo[54] and processo[52]:
            interrogante_completo = f"{processo[53]} {processo[54]} {processo[52]}".strip()

        escrivao_processo_completo = ""
        if processo[56] and processo[57] and processo[55]:
            escrivao_processo_completo = f"{processo[56]} {processo[57]} {processo[55]}".strip()

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
            "responsavel_completo": responsavel_completo,
            "local_origem": processo[9],
            "local_fatos": processo[10],
            "data_instauracao": processo[11],
            "data_recebimento": processo[12],
            "escrivao_id": processo[13],
            "escrivao_completo": escrivao_completo,
            "status_pm": processo[14],
            "nome_pm_id": processo[15],
            "pm_completo": pm_completo,
            "pms_envolvidos": pms_envolvidos,
            "nome_vitima": processo[16],
            "natureza_processo": _determinar_natureza_processo(processo[17], transgressoes_selecionadas),
            "natureza_procedimento": processo[18],
            "resumo_fatos": processo[19],
            "numero_portaria": processo[20],
            "numero_memorando": processo[21],
            "numero_feito": processo[22],
            "numero_rgf": processo[23],
            "numero_controle": processo[24],
            "concluido": processo[25],
            "data_conclusao": processo[26],
            "solucao_final": processo[27],
            "transgressoes_ids": processo[28],
            "transgressoes_selecionadas": transgressoes_selecionadas,
            # Novos campos
            "data_remessa_encarregado": processo[29],
            "data_julgamento": processo[30],
            "solucao_tipo": processo[31],
            "penalidade_tipo": processo[32],
            "penalidade_dias": processo[33],
            "indicios_categorias": processo[34],
            "indicios": indicios,
            "indicios_por_pm": indicios_por_pm,
            # Funções específicas do processo (PAD/CD/CJ)
            "presidente_id": processo[43],
            "presidente_tipo": processo[44],
            "interrogante_id": processo[45],
            "interrogante_tipo": processo[46],
            "escrivao_processo_id": processo[47],
            "escrivao_processo_tipo": processo[48],
            "presidente_nome": processo[49],
            "presidente_completo": presidente_completo,
            "interrogante_nome": processo[52],
            "interrogante_completo": interrogante_completo,
            "escrivao_processo_nome": processo[55],
            "escrivao_processo_completo": escrivao_processo_completo,
        }
    except Exception as e:
        print(f"Erro ao obter processo: {e}")
        return None

@eel.expose
def obter_procedimento_completo(procedimento_id):
    """Obtém dados consolidados para a página de visualização"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

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
                p.data_remessa_encarregado, p.data_julgamento, p.solucao_tipo, p.penalidade_tipo, p.penalidade_dias, p.indicios_categorias
            FROM processos_procedimentos p
            WHERE p.id = ? AND p.ativo = 1
            """,
            (procedimento_id,)
        )

        row = cursor.fetchone()
        conn.close()

        if not row:
            return {"sucesso": False, "mensagem": "Procedimento não encontrado."}

        # Mapear campos para o formato esperado pelo front
        concluido_flag = bool(row[11]) if row[11] is not None else False
        situacao = "Concluído" if concluido_flag else "Em Andamento"

        # Tentar obter transgressões detalhadas reutilizando a função existente
        trans_info = obter_processo(procedimento_id)
        trans_sel = []
        if isinstance(trans_info, dict) and trans_info.get('transgressoes_selecionadas') is not None:
            trans_sel = trans_info.get('transgressoes_selecionadas')

        # Carregar indícios já usando a função obter_processo para consolidar
        proc_edicao = obter_processo(procedimento_id) or {}
        indicios = proc_edicao.get('indicios') if isinstance(proc_edicao, dict) else None

        procedimento = {
            "id": row[0],
            "numero": row[1],
            "tipo_geral": row[2],
            "tipo_procedimento": row[3],
            "documento_iniciador": row[4],
            "processo_sei": row[5],
            "local_origem": row[6],
            "local_fatos": row[7],
            "data_abertura": row[8],
            "data_recebimento": row[9],
            "data_conclusao": row[10],
            "situacao": situacao,
            "status_pm": row[12],
            "nome_pm_id": row[13],
            "responsavel_id": row[14],
            "escrivao_id": row[15],
            "observacoes": row[16],
            "numero_controle": row[17],
            "numero_portaria": row[18],
            "numero_memorando": row[19],
            "numero_feito": row[20],
            "numero_rgf": row[21],
            "natureza_processo": row[22],
            "natureza_procedimento": row[23],
            "solucao_final": row[24],
            "created_at": row[25],
            "updated_at": row[26],
            "ano_instauracao": row[27],
            "transgressoes_ids": row[28],
            "transgressoes_selecionadas": trans_sel,
            # Novos campos (Migração 014)
            "data_remessa_encarregado": row[29],
            "data_julgamento": row[30],
            "solucao_tipo": row[31],
            "penalidade_tipo": row[32],
            "penalidade_dias": row[33],
            "indicios_categorias": row[34],
            "indicios": indicios
        }

        return {"sucesso": True, "procedimento": procedimento}
    except Exception as e:
        print(f"Erro em obter_procedimento_completo: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao obter procedimento: {str(e)}"}

@eel.expose
def obter_encarregados_procedimento(procedimento_id):
    """Retorna responsável e escrivão (se houver) para o procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT responsavel_id, escrivao_id
            FROM processos_procedimentos
            WHERE id = ? AND ativo = 1
            """,
            (procedimento_id,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"sucesso": True, "encarregados": []}

        responsavel_id, escrivao_id = row[0], row[1]

        def _buscar_usuario(user_id):
            if not user_id:
                return None
            # Tenta operadores
            cursor.execute(
                "SELECT nome, posto_graduacao, matricula FROM operadores WHERE id = ?",
                (user_id,)
            )
            u = cursor.fetchone()
            if u:
                return {"nome": u[0], "posto_graduacao": u[1], "matricula": u[2]}
            # Tenta encarregados
            cursor.execute(
                "SELECT nome, posto_graduacao, matricula FROM encarregados WHERE id = ?",
                (user_id,)
            )
            u = cursor.fetchone()
            if u:
                return {"nome": u[0], "posto_graduacao": u[1], "matricula": u[2]}
            return None

        encarregados = []
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
        return {"sucesso": False, "mensagem": f"Erro ao obter encarregados: {str(e)}"}

@eel.expose
def obter_envolvidos_procedimento(procedimento_id):
    """Retorna os envolvidos do procedimento (múltiplos para procedimentos ou único para processos)"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        # Buscar tipo_geral e possível vítima/ofendido
        cursor.execute(
            "SELECT tipo_geral, nome_vitima FROM processos_procedimentos WHERE id = ? AND ativo = 1",
            (procedimento_id,)
        )
        row_head = cursor.fetchone()
        tipo_geral_val = row_head[0] if row_head else None
        nome_vitima_val = row_head[1] if row_head else None

        # Verificar se há registros na tabela de múltiplos PMs (procedimentos)
        cursor.execute(
            "SELECT COUNT(*) FROM procedimento_pms_envolvidos WHERE procedimento_id = ?",
            (procedimento_id,)
        )
        count = cursor.fetchone()[0]

        envolvidos = []

        if count and count > 0:
            # Usar função auxiliar já existente para montar dados do PM
            pms = buscar_pms_envolvidos(procedimento_id)
            for pm in pms:
                envolvidos.append({
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
                       COALESCE(o.nome, e.nome, '') as nome,
                       COALESCE(o.posto_graduacao, e.posto_graduacao, '') as posto,
                       COALESCE(o.matricula, e.matricula, '') as matricula
                FROM processos_procedimentos p
                LEFT JOIN operadores o ON p.nome_pm_id = o.id
                LEFT JOIN encarregados e ON p.nome_pm_id = e.id AND o.id IS NULL
                WHERE p.id = ? AND p.ativo = 1
                """,
                (procedimento_id,)
            )
            row = cursor.fetchone()
            if row and (row[2] or row[3] or row[4]):
                envolvidos.append({
                    "nome": row[2],
                    "posto_graduacao": row[3],
                    "matricula": row[4],
                    "tipo_envolvimento": row[0] or "Envolvido"
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
        return {"sucesso": False, "mensagem": f"Erro ao obter envolvidos: {str(e)}"}

@eel.expose
def atualizar_processo(
    processo_id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
    local_origem=None, local_fatos=None, data_instauracao=None, data_recebimento=None, escrivao_id=None, status_pm=None, nome_pm_id=None,
    nome_vitima=None, natureza_processo=None, natureza_procedimento=None, resumo_fatos=None,
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
    escrivao_processo_id=None, escrivao_processo_tipo=None
):
    """Atualiza um processo/procedimento existente"""
    try:
        # Validação do local_fatos (obrigatório)
        if not local_fatos:
            return {"sucesso": False, "mensagem": "O campo 'Local onde ocorreram os fatos' é obrigatório."}
        
        # Converter nome_vitima para maiúsculas se fornecido
        if nome_vitima:
            nome_vitima = nome_vitima.strip().upper()
        
        # Extrair ano da data de instauração se fornecida
        ano_instauracao = None
        if data_instauracao:
            try:
                # data_instauracao está no formato YYYY-MM-DD
                ano_instauracao = str(data_instauracao)[:4]
            except:
                ano_instauracao = None
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificações específicas antes da atualização para mensagens de erro mais precisas
        print(f"🔍 Verificando conflitos na atualização: número={numero}, tipo={tipo_detalhe}, doc={documento_iniciador}, local={local_origem}, ano={ano_instauracao}")
        
        # Verificar conflito no número principal (excluindo o próprio registro, agora incluindo tipo_detalhe)
        cursor.execute("""
            SELECT id, numero, tipo_detalhe FROM processos_procedimentos
            WHERE numero = ? AND documento_iniciador = ? AND tipo_detalhe = ? AND local_origem = ? AND ano_instauracao = ? AND ativo = 1 AND id != ?
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
                WHERE numero_controle = ? AND documento_iniciador = ? AND tipo_detalhe = ? AND local_origem = ? AND ano_instauracao = ? AND ativo = 1 AND id != ?
            """, (numero_controle, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao, processo_id))
            conflito_controle = cursor.fetchone()
            
            if conflito_controle:
                local_msg = f" no {local_origem}" if local_origem else ""
                tipo_msg = f"/{tipo_detalhe}" if tipo_detalhe else ""
                return {"sucesso": False, "mensagem": f"Já existe um(a) {documento_iniciador} com número de controle {numero_controle}{tipo_msg} para o ano {ano_instauracao or 'informado'}{local_msg}. (Usado no(a) {conflito_controle[3] or tipo_detalhe} {conflito_controle[1]})"}
        
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
                _cursor.execute("SELECT 1 FROM operadores WHERE id = ?", (_id,))
                if _cursor.fetchone():
                    return 'operador'
                _cursor.execute("SELECT 1 FROM encarregados WHERE id = ?", (_id,))
                if _cursor.fetchone():
                    return 'encarregado'
            except Exception:
                pass
            return None

        presidente_tipo = _resolve_user_tipo(cursor, presidente_id) if presidente_id else None
        interrogante_tipo = _resolve_user_tipo(cursor, interrogante_id) if interrogante_id else None
        escrivao_processo_tipo = _resolve_user_tipo(cursor, escrivao_processo_id) if escrivao_processo_id else None

        cursor.execute(
            """
            UPDATE processos_procedimentos 
            SET numero = ?, tipo_geral = ?, tipo_detalhe = ?, documento_iniciador = ?, 
                processo_sei = ?, responsavel_id = ?, responsavel_tipo = ?,
                local_origem = ?, local_fatos = ?, data_instauracao = ?, data_recebimento = ?, escrivao_id = ?, status_pm = ?, nome_pm_id = ?,
                nome_vitima = ?, natureza_processo = ?, natureza_procedimento = ?, resumo_fatos = ?,
                numero_portaria = ?, numero_memorando = ?, numero_feito = ?, numero_rgf = ?, numero_controle = ?,
                concluido = ?, data_conclusao = ?, solucao_final = ?, transgressoes_ids = ?, ano_instauracao = ?,
                data_remessa_encarregado = ?, data_julgamento = ?, solucao_tipo = ?, penalidade_tipo = ?, penalidade_dias = ?, indicios_categorias = ?,
                presidente_id = ?, presidente_tipo = ?, interrogante_id = ?, interrogante_tipo = ?, escrivao_processo_id = ?, escrivao_processo_tipo = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
                local_origem, local_fatos, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
                nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
                numero_portaria, numero_memorando, numero_feito, numero_rgf, numero_controle,
                concluido, data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
                data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, penalidade_dias, indicios_categorias,
                presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
                processo_id
            )
        )

        # Se for procedimento e tiver múltiplos PMs envolvidos, atualizar na nova tabela
        if tipo_geral == 'procedimento' and pms_envolvidos is not None:
            print(f"📝 Atualizando PMs envolvidos para procedimento: {pms_envolvidos}")

            # Remover PMs antigos
            cursor.execute("DELETE FROM procedimento_pms_envolvidos WHERE procedimento_id = ?", (processo_id,))

            # Inserir novos PMs
            for i, pm in enumerate(pms_envolvidos):
                if pm.get('id'):  # Verifica se o PM tem ID válido
                    pm_tipo = 'operador' if pm.get('tipo') == 'operador' else 'encarregado'
                    status_pm_env = pm.get('status_pm', status_pm)
                    cursor.execute("""
                        INSERT INTO procedimento_pms_envolvidos (id, procedimento_id, pm_id, pm_tipo, ordem, status_pm)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (str(uuid.uuid4()), processo_id, pm['id'], pm_tipo, i + 1, status_pm_env))

        # Substituir indícios (se fornecidos)
        def _parse_ids(lista_ids):
            if not lista_ids:
                return []
            ids = lista_ids
            if isinstance(lista_ids, str):
                try:
                    import json as _json
                    ids = _json.loads(lista_ids)
                except Exception:
                    ids = []
            if isinstance(ids, dict):
                ids = list(ids.values())
            return [str(x) for x in ids if x is not None]

        try:
            # Limpar associações existentes
            cursor.execute("DELETE FROM procedimentos_indicios_crimes WHERE procedimento_id = ?", (processo_id,))
            cursor.execute("DELETE FROM procedimentos_indicios_rdpm WHERE procedimento_id = ?", (processo_id,))
            cursor.execute("DELETE FROM procedimentos_indicios_art29 WHERE procedimento_id = ?", (processo_id,))

            crimes_ids = _parse_ids(indicios_crimes)
            rdpm_ids = _parse_ids(indicios_rdpm)
            art29_ids = _parse_ids(indicios_art29)

            for cid in crimes_ids:
                cursor.execute(
                    "INSERT INTO procedimentos_indicios_crimes (id, procedimento_id, crime_id) VALUES (?, ?, ?)",
                    (str(uuid.uuid4()), processo_id, cid)
                )
            for tid in rdpm_ids:
                cursor.execute(
                    "INSERT INTO procedimentos_indicios_rdpm (id, procedimento_id, transgressao_id) VALUES (?, ?, ?)",
                    (str(uuid.uuid4()), processo_id, tid)
                )
            # detectar nome da coluna FK de art29
            try:
                cursor.execute("PRAGMA table_info(procedimentos_indicios_art29)")
                cols_art29 = [r[1] for r in cursor.fetchall()]
                col_art29 = 'art29_id' if 'art29_id' in cols_art29 else ('infracao_id' if 'infracao_id' in cols_art29 else 'art29_id')
            except Exception:
                col_art29 = 'art29_id'
            for aid in art29_ids:
                cursor.execute(
                    f"INSERT INTO procedimentos_indicios_art29 (id, procedimento_id, {col_art29}) VALUES (?, ?, ?)",
                    (str(uuid.uuid4()), processo_id, aid)
                )
        except Exception as _e:
            # Não bloquear a atualização toda por falha de indícios; apenas logar
            print(f"Aviso: falha ao atualizar indícios do procedimento {processo_id}: {_e}")

        # ======== PROCESSAR INDÍCIOS POR PM (MIGRAÇÃO 015) ========
        try:
            if indicios_por_pm and isinstance(indicios_por_pm, dict):
                print(f"🔧 Processando indícios por PM: {len(indicios_por_pm)} PMs")
                
                for pm_id, dados_indicios in indicios_por_pm.items():
                    if not dados_indicios:
                        continue
                        
                    # Buscar pm_envolvido_id para este PM
                    cursor.execute("""
                        SELECT id FROM procedimento_pms_envolvidos 
                        WHERE procedimento_id = ? AND pm_id = ?
                    """, (processo_id, pm_id))
                    
                    pm_envolvido_result = cursor.fetchone()
                    if not pm_envolvido_result:
                        print(f"⚠️ PM {pm_id} não encontrado na tabela procedimento_pms_envolvidos")
                        continue
                        
                    pm_envolvido_id = pm_envolvido_result[0]
                    
                    # Chamar função para salvar indícios deste PM
                    try:
                        from uuid import uuid4
                        
                        # Limpar indícios existentes deste PM primeiro
                        # Buscar o ID do registro principal de indícios
                        cursor.execute("SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
                        indicios_existentes = cursor.fetchone()
                        if indicios_existentes:
                            indicios_main_id = indicios_existentes[0]
                            # Limpar registros dependentes usando pm_indicios_id
                            cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_indicios_id = ?", (indicios_main_id,))
                            cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_indicios_id = ?", (indicios_main_id,))
                            cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_indicios_id = ?", (indicios_main_id,))
                        
                        # Limpar registro principal
                        cursor.execute("DELETE FROM pm_envolvido_indicios WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
                        
                        categoria = dados_indicios.get('categoria', '')
                        if categoria:
                            # Inserir registro principal
                            indicios_main_id = str(uuid4())
                            # Converter categoria em array JSON para categorias_indicios
                            import json
                            categorias_array = [cat.strip() for cat in categoria.split(',') if cat.strip()]
                            categorias_json = json.dumps(categorias_array)
                            
                            cursor.execute("""
                                INSERT INTO pm_envolvido_indicios (id, pm_envolvido_id, procedimento_id, categoria, categorias_indicios)
                                VALUES (?, ?, ?, ?, ?)
                            """, (indicios_main_id, pm_envolvido_id, processo_id, categoria, categorias_json))
                            
                            # Inserir crimes
                            crimes = dados_indicios.get('crimes', [])
                            for crime in crimes:
                                crime_id = crime.get('id') if isinstance(crime, dict) else crime
                                cursor.execute("""
                                    INSERT INTO pm_envolvido_crimes (id, pm_indicios_id, crime_id)
                                    VALUES (?, ?, ?)
                                """, (str(uuid4()), indicios_main_id, crime_id))
                            
                            # Inserir transgressões RDPM
                            rdpm = dados_indicios.get('rdpm', [])
                            for trans in rdpm:
                                trans_id = trans.get('id') if isinstance(trans, dict) else trans
                                cursor.execute("""
                                    INSERT INTO pm_envolvido_rdpm (id, pm_indicios_id, transgressao_id)
                                    VALUES (?, ?, ?)
                                """, (str(uuid4()), indicios_main_id, trans_id))
                            
                            # Inserir infrações Art. 29
                            art29 = dados_indicios.get('art29', [])
                            for infracao in art29:
                                infracao_id = infracao.get('id') if isinstance(infracao, dict) else infracao
                                cursor.execute("""
                                    INSERT INTO pm_envolvido_art29 (id, pm_indicios_id, art29_id)
                                    VALUES (?, ?, ?)
                                """, (str(uuid4()), indicios_main_id, infracao_id))
                            
                            print(f"✅ Indícios salvos para PM {pm_id}: {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")
                            
                    except Exception as e:
                        print(f"❌ Erro ao salvar indícios do PM {pm_id}: {e}")
                        
        except Exception as _e:
            print(f"Aviso: falha ao processar indícios por PM: {_e}")

        conn.commit()
        conn.close()

        return {"sucesso": True, "mensagem": "Processo/Procedimento atualizado com sucesso!"}
    except sqlite3.IntegrityError as e:
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
def adicionar_prorrogacao(processo_id, dias_prorrogacao, numero_portaria=None, data_portaria=None, motivo=None, autorizado_por=None, autorizado_tipo=None):
    """Cria uma prorrogação para o prazo ativo do processo, seguindo a regra do dia seguinte ao vencimento."""
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
def backfill_tipos_funcoes_processo():
    """Backfill presidente_tipo/interrogante_tipo/escrivao_processo_tipo onde ID existe e tipo está NULL/errado."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        def resolve_tipo(_id):
            if not _id:
                return None
            cursor.execute("SELECT 1 FROM operadores WHERE id = ?", (_id,))
            if cursor.fetchone():
                return 'operador'
            cursor.execute("SELECT 1 FROM encarregados WHERE id = ?", (_id,))
            if cursor.fetchone():
                return 'encarregado'
            return None

        cursor.execute("SELECT id, presidente_id, presidente_tipo, interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo FROM processos_procedimentos WHERE ativo = 1")
        rows = cursor.fetchall()
        upd = 0
        for (pid, pres_id, pres_tp, int_id, int_tp, escp_id, escp_tp) in rows:
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
                    SET presidente_tipo = ?, interrogante_tipo = ?, escrivao_processo_tipo = ?
                    WHERE id = ?
                    """,
                    (new_pres, new_int, new_escp, pid)
                )
                upd += 1

        conn.commit()
        conn.close()
        return {"sucesso": True, "atualizados": upd}
    except Exception as e:
        return {"sucesso": False, "mensagem": str(e)}

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
def adicionar_andamento(processo_id, texto, usuario_nome=None):
    """Adiciona um novo andamento (progresso) ao processo/procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Buscar andamentos atuais
        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = ? AND ativo = 1
        """, (processo_id,))
        
        result = cursor.fetchone()
        if not result:
            conn.close()
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado"}
        
        # Parse andamentos existentes ou criar lista vazia
        andamentos_json = result[0] if result[0] else '[]'
        try:
            andamentos = json.loads(andamentos_json)
        except:
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
            SET andamentos = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
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

@eel.expose
def listar_andamentos(processo_id):
    """Lista todos os andamentos de um processo/procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = ? AND ativo = 1
        """, (processo_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado"}
        
        # Parse andamentos
        andamentos_json = result[0] if result[0] else '[]'
        try:
            andamentos = json.loads(andamentos_json)
        except:
            andamentos = []
        
        return {
            "sucesso": True,
            "andamentos": andamentos
        }
        
    except Exception as e:
        print(f"Erro ao listar andamentos: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao listar andamentos: {str(e)}"}

@eel.expose
def remover_andamento(processo_id, andamento_id):
    """Remove um andamento específico do processo/procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Buscar andamentos atuais
        cursor.execute("""
            SELECT andamentos FROM processos_procedimentos WHERE id = ? AND ativo = 1
        """, (processo_id,))
        
        result = cursor.fetchone()
        if not result:
            conn.close()
            return {"sucesso": False, "mensagem": "Processo/Procedimento não encontrado"}
        
        # Parse andamentos existentes
        andamentos_json = result[0] if result[0] else '[]'
        try:
            andamentos = json.loads(andamentos_json)
        except:
            andamentos = []
        
        # Remover andamento específico
        andamentos = [a for a in andamentos if a.get('id') != andamento_id]
        
        # Salvar de volta no banco
        cursor.execute("""
            UPDATE processos_procedimentos 
            SET andamentos = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
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

            if filtros.get('situacao'):
                if filtros['situacao'] == 'concluido':
                    where_clause += " AND p.concluido = 1"
                elif filtros['situacao'] == 'em_andamento':
                    where_clause += " AND (p.concluido = 0 OR p.concluido IS NULL)"
                elif filtros['situacao'] == 'em_andamento_no_prazo':
                    # Em andamento e com prazo não vencido
                    where_clause += """ AND (p.concluido = 0 OR p.concluido IS NULL) 
                                      AND p.data_recebimento IS NOT NULL 
                                      AND (
                                          CASE 
                                              WHEN p.documento_iniciador = 'Feito Preliminar' THEN
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) < 15
                                              WHEN p.tipo_detalhe = 'IPM' OR p.tipo_detalhe LIKE '%IPM%' THEN
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) < 40
                                              WHEN p.tipo_detalhe = 'SR' OR p.tipo_detalhe LIKE '%SR%' THEN
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) < 30
                                              ELSE
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) < 30
                                          END
                                      )"""
                elif filtros['situacao'] == 'em_andamento_vencido':
                    # Em andamento e com prazo vencido
                    where_clause += """ AND (p.concluido = 0 OR p.concluido IS NULL) 
                                      AND p.data_recebimento IS NOT NULL 
                                      AND (
                                          CASE 
                                              WHEN p.documento_iniciador = 'Feito Preliminar' THEN
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) >= 15
                                              WHEN p.tipo_detalhe = 'IPM' OR p.tipo_detalhe LIKE '%IPM%' THEN
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) >= 40
                                              WHEN p.tipo_detalhe = 'SR' OR p.tipo_detalhe LIKE '%SR%' THEN
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) >= 30
                                              ELSE
                                                  CAST((julianday('now') - julianday(p.data_recebimento)) AS INTEGER) >= 30
                                          END
                                      )"""

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
                -- Dados de funções (PAD/CD/CJ)
                COALESCE(pres_o.nome, pres_e.nome, '') as presidente_nome,
                COALESCE(pres_o.posto_graduacao, pres_e.posto_graduacao, '') as presidente_posto,
                COALESCE(pres_o.matricula, pres_e.matricula, '') as presidente_matricula,
                COALESCE(int_o.nome, int_e.nome, '') as interrogante_nome,
                COALESCE(int_o.posto_graduacao, int_e.posto_graduacao, '') as interrogante_posto,
                COALESCE(int_o.matricula, int_e.matricula, '') as interrogante_matricula,
                COALESCE(escr_o.nome, escr_e.nome, '') as escrivao_nome,
                COALESCE(escr_o.posto_graduacao, escr_e.posto_graduacao, '') as escrivao_posto,
                COALESCE(escr_o.matricula, escr_e.matricula, '') as escrivao_matricula,
                p.local_origem, p.processo_sei, p.nome_pm_id, p.status_pm,
                COALESCE(pm_env_e.nome, pm_env_o.nome, 'Não informado') as pm_envolvido_nome,
                COALESCE(pm_env_e.posto_graduacao, pm_env_o.posto_graduacao, '') as pm_envolvido_posto,
                COALESCE(pm_env_e.matricula, pm_env_o.matricula, '') as pm_envolvido_matricula,
                p.numero_controle,
                p.concluido,
                p.data_conclusao
            FROM processos_procedimentos p
            LEFT JOIN operadores o ON p.responsavel_id = o.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados e ON p.responsavel_id = e.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN operadores o_backup ON p.responsavel_id = o_backup.id AND p.responsavel_tipo = 'encarregado'
            LEFT JOIN encarregados e_backup ON p.responsavel_id = e_backup.id AND p.responsavel_tipo = 'operador'
            LEFT JOIN encarregados pm_env_e ON p.nome_pm_id = pm_env_e.id
            LEFT JOIN operadores pm_env_o ON p.nome_pm_id = pm_env_o.id
            -- Junções para funções específicas em processos (PAD/CD/CJ)
            LEFT JOIN operadores pres_o ON p.presidente_id = pres_o.id AND p.presidente_tipo = 'operador'
            LEFT JOIN encarregados pres_e ON p.presidente_id = pres_e.id AND p.presidente_tipo = 'encarregado'
            LEFT JOIN operadores int_o ON p.interrogante_id = int_o.id AND p.interrogante_tipo = 'operador'
            LEFT JOIN encarregados int_e ON p.interrogante_id = int_e.id AND p.interrogante_tipo = 'encarregado'
            LEFT JOIN operadores escr_o ON p.escrivao_processo_id = escr_o.id AND p.escrivao_processo_tipo = 'operador'
            LEFT JOIN encarregados escr_e ON p.escrivao_processo_id = escr_e.id AND p.escrivao_processo_tipo = 'encarregado'
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
             presidente_nome, presidente_posto, presidente_matricula,
             interrogante_nome, interrogante_posto, interrogante_matricula,
             escrivao_nome, escrivao_posto, escrivao_matricula,
             local_origem, processo_sei, nome_pm_id, status_pm, 
             pm_envolvido_nome, pm_envolvido_posto, pm_envolvido_matricula, numero_controle, 
             concluido, data_conclusao) = processo

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
                pms_envolvidos = buscar_pms_envolvidos(processo_id)
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
                           MAX(CASE WHEN ativo=1 THEN data_vencimento END) as data_venc_ativa
                    FROM prazos_processo
                    WHERE processo_id = ?
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
                    data_limite_dt = datetime.strptime(data_limite_ativo, "%Y-%m-%d")
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

# ======== FUNÇÕES DE TRANSGRESSÕES ========

@eel.expose
def listar_transgressoes(gravidade=None):
    """Lista transgressões por gravidade"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        if gravidade:
            cursor.execute("""
                SELECT id, inciso, texto 
                FROM transgressoes 
                WHERE gravidade = ? AND ativo = 1
                ORDER BY inciso
            """, (gravidade,))
        else:
            cursor.execute("""
                SELECT id, gravidade, inciso, texto 
                FROM transgressoes 
                WHERE ativo = 1
                ORDER BY gravidade, inciso
            """)
        
        transgressoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for t in transgressoes:
            if gravidade:
                resultado.append({
                    "id": t[0],
                    "inciso": t[1],
                    "texto": t[2],
                    "display": f"{t[1]} - {t[2]}"
                })
            else:
                resultado.append({
                    "id": t[0],
                    "gravidade": t[1],
                    "inciso": t[2],
                    "texto": t[3],
                    "display": f"{t[2]} - {t[3]}"
                })
        
        return {"sucesso": True, "transgressoes": resultado}
        
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao listar transgressões: {str(e)}"}

@eel.expose
def buscar_transgressoes(termo, gravidade=None):
    """Busca transgressões por termo"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        termo_like = f"%{termo}%"
        
        if gravidade:
            cursor.execute("""
                SELECT id, inciso, texto 
                FROM transgressoes 
                WHERE gravidade = ? AND ativo = 1 
                AND (inciso LIKE ? OR texto LIKE ?)
                ORDER BY inciso
            """, (gravidade, termo_like, termo_like))
        else:
            cursor.execute("""
                SELECT id, gravidade, inciso, texto 
                FROM transgressoes 
                WHERE ativo = 1 
                AND (inciso LIKE ? OR texto LIKE ?)
                ORDER BY gravidade, inciso
            """, (termo_like, termo_like))
        
        transgressoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for t in transgressoes:
            if gravidade:
                resultado.append({
                    "id": t[0],
                    "inciso": t[1],
                    "texto": t[2],
                    "display": f"{t[1]} - {t[2]}"
                })
            else:
                resultado.append({
                    "id": t[0],
                    "gravidade": t[1],
                    "inciso": t[2],
                    "texto": t[3],
                    "display": f"{t[2]} - {t[3]}"
                })
        
        return {"sucesso": True, "transgressoes": resultado}
        
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao buscar transgressões: {str(e)}"}

@eel.expose
def obter_estatisticas_usuario(user_id, user_type):
    """Obtém estatísticas detalhadas de um usuário específico"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        estatisticas = {
            "encarregado_sindicancia": 0,  # SR e SV
            "encarregado_pads": 0,
            "encarregado_ipm": 0,
            "encarregado_atestado_origem": 0,  # AO
            "encarregado_feito_preliminar": 0,  # FP
            "escrivao": 0,
            "envolvido_sindicado": 0,
            "envolvido_acusado": 0,
            "envolvido_indiciado": 0,
            "envolvido_investigado": 0
        }
        
        # 1. Encarregado de Sindicância (SR e SV)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE responsavel_id = ? AND ativo = 1 
            AND tipo_detalhe IN ('SR', 'SV')
        """, (user_id,))
        estatisticas["encarregado_sindicancia"] = cursor.fetchone()[0]
        
        # 2. Encarregado de PADS
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE responsavel_id = ? AND ativo = 1 
            AND tipo_detalhe = 'PADS'
        """, (user_id,))
        estatisticas["encarregado_pads"] = cursor.fetchone()[0]
        
        # 3. Encarregado de IPM
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE responsavel_id = ? AND ativo = 1 
            AND tipo_detalhe = 'IPM'
        """, (user_id,))
        estatisticas["encarregado_ipm"] = cursor.fetchone()[0]
        
        # 4. Encarregado de Feito Preliminar (FP)
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE responsavel_id = ? AND ativo = 1 
            AND tipo_detalhe = 'FP'
        """, (user_id,))
        estatisticas["encarregado_feito_preliminar"] = cursor.fetchone()[0]
        
        # 6. Escrivão
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE escrivao_id = ? AND ativo = 1
        """, (user_id,))
        estatisticas["escrivao"] = cursor.fetchone()[0]
        
        # 7. Envolvido como sindicado (status_pm = 'Sindicado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE nome_pm_id = ? AND ativo = 1 
            AND LOWER(status_pm) = 'sindicado'
        """, (user_id,))
        estatisticas["envolvido_sindicado"] = cursor.fetchone()[0]
        
        # 8. Envolvido como acusado (status_pm = 'Acusado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE nome_pm_id = ? AND ativo = 1 
            AND LOWER(status_pm) = 'acusado'
        """, (user_id,))
        estatisticas["envolvido_acusado"] = cursor.fetchone()[0]
        
        # 9. Envolvido como indiciado (status_pm = 'Indiciado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE nome_pm_id = ? AND ativo = 1 
            AND LOWER(status_pm) = 'indiciado'
        """, (user_id,))
        estatisticas["envolvido_indiciado"] = cursor.fetchone()[0]
        
        # 10. Envolvido como investigado (status_pm = 'Investigado')
        cursor.execute("""
            SELECT COUNT(*) FROM processos_procedimentos 
            WHERE nome_pm_id = ? AND ativo = 1 
            AND LOWER(status_pm) = 'investigado'
        """, (user_id,))
        estatisticas["envolvido_investigado"] = cursor.fetchone()[0]
        
        # 11. Também verificar na tabela de múltiplos PMs envolvidos (para procedimentos)
        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = ? AND p.ativo = 1 
            AND LOWER(p.status_pm) = 'sindicado'
        """, (user_id,))
        estatisticas["envolvido_sindicado"] += cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = ? AND p.ativo = 1 
            AND LOWER(p.status_pm) = 'acusado'
        """, (user_id,))
        estatisticas["envolvido_acusado"] += cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = ? AND p.ativo = 1 
            AND LOWER(p.status_pm) = 'indiciado'
        """, (user_id,))
        estatisticas["envolvido_indiciado"] += cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM procedimento_pms_envolvidos pme
            JOIN processos_procedimentos p ON pme.procedimento_id = p.id
            WHERE pme.pm_id = ? AND p.ativo = 1 
            AND LOWER(p.status_pm) = 'investigado'
        """, (user_id,))
        estatisticas["envolvido_investigado"] += cursor.fetchone()[0]
        
        conn.close()
        
        return {"sucesso": True, "estatisticas": estatisticas}
        
    except Exception as e:
        print(f"Erro ao obter estatísticas do usuário: {e}")
        return {"sucesso": False, "erro": str(e)}

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

# ========== CRIMES E CONTRAVENÇÕES - EEL FUNCTIONS ==========

def validar_campos_crime(dados_crime):
    """Valida os campos do crime/contravenção conforme regras de formato"""
    import re
    
    errors = []
    
    # Validar Artigo - apenas números
    artigo = dados_crime.get('artigo', '').strip()
    if artigo and not re.match(r'^[0-9]+$', artigo):
        errors.append("Campo 'Artigo' deve conter apenas números")
    
    # Validar Parágrafo - formato ordinal (1º, 2º, 3º, único)
    paragrafo = dados_crime.get('paragrafo', '').strip()
    if paragrafo:
        if paragrafo.lower() == 'único':
            # Mantém "único" como está
            dados_crime['paragrafo'] = 'único'
        elif re.match(r'^[0-9]+$', paragrafo):
            # Se são apenas números, adiciona º
            dados_crime['paragrafo'] = paragrafo + 'º'
        elif re.match(r'^[0-9]+º$', paragrafo):
            # Se já tem º, mantém como está
            dados_crime['paragrafo'] = paragrafo
        else:
            errors.append("Campo 'Parágrafo' deve estar no formato ordinal (1º, 2º, 3º) ou 'único'")
    
    # Validar Inciso - números romanos maiúsculos
    inciso = dados_crime.get('inciso', '').strip()
    if inciso:
        if not re.match(r'^[IVXLCDM]+$', inciso):
            errors.append("Campo 'Inciso' deve conter apenas números romanos maiúsculos (I, II, III, IV...)")
        # Forçar maiúscula
        dados_crime['inciso'] = inciso.upper()
    
    # Validar Alínea - apenas uma letra minúscula
    alinea = dados_crime.get('alinea', '').strip()
    if alinea:
        if not re.match(r'^[a-z]$', alinea):
            errors.append("Campo 'Alínea' deve conter apenas uma letra minúscula (a, b, c...)")
        # Forçar minúscula
        dados_crime['alinea'] = alinea.lower()
    
    return errors

@eel.expose
def listar_crimes_contravencoes():
    """Lista todos os crimes e contravenções cadastrados"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                id,
                tipo,
                dispositivo_legal,
                artigo,
                descricao_artigo,
                paragrafo,
                inciso,
                alinea,
                ativo
            FROM crimes_contravencoes
            ORDER BY tipo, dispositivo_legal, artigo
        ''')
        crimes = cursor.fetchall()
        conn.close()
        
        # Converte em lista de dicionários
        result = []
        for crime in crimes:
            result.append({
                'id': crime[0],
                'tipo': crime[1],
                'dispositivo_legal': crime[2],
                'artigo': crime[3],
                'descricao_artigo': crime[4],
                'paragrafo': crime[5] if crime[5] else '',
                'inciso': crime[6] if crime[6] else '',
                'alinea': crime[7] if crime[7] else '',
                'ativo': bool(crime[8])
            })
        
        return {'success': True, 'data': result}
    except Exception as e:
        print(f"Erro ao listar crimes: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def excluir_crime_contravencao(crime_id):
    """Exclui (desativa) um crime/contravenção pelo ID"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Ao invés de excluir fisicamente, apenas desativa
        cursor.execute('''
            UPDATE crimes_contravencoes 
            SET ativo = 0 
            WHERE id = ?
        ''', (crime_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'error': 'Crime não encontrado'}
        
        conn.commit()
        conn.close()
        
        return {'success': True, 'message': 'Crime/contravenção desativado com sucesso'}
    except Exception as e:
        print(f"Erro ao excluir crime: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def cadastrar_crime(dados_crime):
    """Cadastra um novo crime/contravenção"""
    try:
        # Validar campos antes de cadastrar
        validation_errors = validar_campos_crime(dados_crime)
        if validation_errors:
            return {
                'success': False, 
                'error': 'Erro de validação: ' + '; '.join(validation_errors)
            }
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Gerar ID único
        crime_id = str(uuid.uuid4())
        
        # Inserir novo crime
        cursor.execute('''
            INSERT INTO crimes_contravencoes 
            (id, tipo, dispositivo_legal, artigo, descricao_artigo, 
             paragrafo, inciso, alinea, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            crime_id,
            dados_crime['tipo'],
            dados_crime['dispositivo_legal'],
            dados_crime['artigo'],
            dados_crime['descricao_artigo'],
            dados_crime.get('paragrafo', ''),
            dados_crime.get('inciso', ''),
            dados_crime.get('alinea', ''),
            dados_crime.get('ativo', True)
        ))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Crime cadastrado: {dados_crime['tipo']} - Art. {dados_crime['artigo']}")
        return {'success': True, 'message': 'Crime/contravenção cadastrado com sucesso', 'id': crime_id}
    except Exception as e:
        print(f"Erro ao cadastrar crime: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def obter_crime_por_id(crime_id):
    """Obtém um crime/contravenção específico pelo ID"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                id,
                tipo,
                dispositivo_legal,
                artigo,
                descricao_artigo,
                paragrafo,
                inciso,
                alinea,
                ativo
            FROM crimes_contravencoes
            WHERE id = ?
        ''', (crime_id,))
        crime = cursor.fetchone()
        conn.close()
        
        if not crime:
            return {'success': False, 'error': 'Crime não encontrado'}
        
        result = {
            'id': crime[0],
            'tipo': crime[1],
            'dispositivo_legal': crime[2],
            'artigo': crime[3],
            'descricao_artigo': crime[4],
            'paragrafo': crime[5] if crime[5] else '',
            'inciso': crime[6] if crime[6] else '',
            'alinea': crime[7] if crime[7] else '',
            'ativo': bool(crime[8])
        }
        
        return {'success': True, 'data': result}
    except Exception as e:
        print(f"Erro ao obter crime: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def atualizar_crime(dados_crime):
    """Atualiza um crime/contravenção existente"""
    try:
        # Validar campos antes de atualizar
        validation_errors = validar_campos_crime(dados_crime)
        if validation_errors:
            return {
                'success': False, 
                'error': 'Erro de validação: ' + '; '.join(validation_errors)
            }
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Atualizar crime
        cursor.execute('''
            UPDATE crimes_contravencoes 
            SET tipo = ?, dispositivo_legal = ?, artigo = ?, descricao_artigo = ?,
                paragrafo = ?, inciso = ?, alinea = ?, ativo = ?
            WHERE id = ?
        ''', (
            dados_crime['tipo'],
            dados_crime['dispositivo_legal'],
            dados_crime['artigo'],
            dados_crime['descricao_artigo'],
            dados_crime.get('paragrafo', ''),
            dados_crime.get('inciso', ''),
            dados_crime.get('alinea', ''),
            dados_crime.get('ativo', True),
            dados_crime['id']
        ))
        
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'error': 'Crime não encontrado'}
        
        conn.commit()
        conn.close()
        
        print(f"✅ Crime atualizado: {dados_crime['tipo']} - Art. {dados_crime['artigo']}")
        return {'success': True, 'message': 'Crime/contravenção atualizado com sucesso'}
    except Exception as e:
        print(f"Erro ao atualizar crime: {e}")
        return {'success': False, 'error': str(e)}

# ====================================================================
# FUNÇÕES DE TRANSGRESSÕES DISCIPLINARES - CRUD COMPLETO
# ====================================================================

@eel.expose
def listar_todas_transgressoes():
    """Lista todas as transgressões disciplinares com paginação e busca"""
    try:
        print("📄 Listando transgressões disciplinares...")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, gravidade, inciso, texto, ativo, created_at
            FROM transgressoes 
            ORDER BY gravidade, inciso
        ''')
        
        transgressoes = []
        for row in cursor.fetchall():
            transgressoes.append({
                'id': row[0],
                'gravidade': row[1].title() if row[1] else '',  # Capitalizar primeira letra
                'inciso': row[2],
                'texto': row[3],
                'ativo': bool(row[4]),
                'created_at': row[5]
            })
        
        conn.close()
        
        print(f"✅ {len(transgressoes)} transgressões encontradas")
        return {'success': True, 'data': transgressoes}
        
    except Exception as e:
        print(f"Erro ao listar transgressões: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def cadastrar_transgressao(dados_transgressao):
    """Cadastra uma nova transgressão disciplinar"""
    try:
        print(f"📝 Cadastrando transgressão: {dados_transgressao['gravidade']} - {dados_transgressao['inciso']}")
        
        # Validação básica
        if not dados_transgressao.get('gravidade') or not dados_transgressao.get('inciso') or not dados_transgressao.get('texto'):
            return {'success': False, 'error': 'Gravidade, inciso e texto são obrigatórios'}
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se já existe uma transgressão com a mesma gravidade e inciso
        cursor.execute('''
            SELECT id, gravidade, inciso FROM transgressoes 
            WHERE LOWER(gravidade) = LOWER(?) AND UPPER(inciso) = UPPER(?)
        ''', (dados_transgressao['gravidade'], dados_transgressao['inciso']))
        
        duplicata = cursor.fetchone()
        if duplicata:
            conn.close()
            return {'success': False, 'error': f'Já existe uma transgressão {duplicata[1]} com inciso {duplicata[2]}. Verifique os dados informados.'}
        
        # Inserir nova transgressão
        cursor.execute('''
            INSERT INTO transgressoes (gravidade, inciso, texto, ativo, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            dados_transgressao['gravidade'],
            dados_transgressao['inciso'],
            dados_transgressao['texto'],
            dados_transgressao.get('ativo', True),
            datetime.now().isoformat()
        ))
        
        transgressao_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        print(f"✅ Transgressão cadastrada: ID {transgressao_id}")
        return {'success': True, 'message': 'Transgressão cadastrada com sucesso', 'id': transgressao_id}
        
    except Exception as e:
        print(f"Erro ao cadastrar transgressão: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def obter_transgressao_por_id(transgressao_id):
    """Obtém uma transgressão específica pelo ID"""
    try:
        print(f"🔍 Buscando transgressão ID: {transgressao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, gravidade, inciso, texto, ativo, created_at
            FROM transgressoes 
            WHERE id = ?
        ''', (transgressao_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            transgressao = {
                'id': row[0],
                'gravidade': row[1],
                'inciso': row[2],
                'texto': row[3],
                'ativo': bool(row[4]),
                'created_at': row[5]
            }
            print(f"✅ Transgressão encontrada: {transgressao['gravidade']} - {transgressao['inciso']}")
            return {'success': True, 'data': transgressao}
        else:
            print(f"❌ Transgressão não encontrada: ID {transgressao_id}")
            return {'success': False, 'error': 'Transgressão não encontrada'}
            
    except Exception as e:
        print(f"Erro ao buscar transgressão: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def atualizar_transgressao(dados_transgressao):
    """Atualiza uma transgressão existente"""
    try:
        print(f"📝 Atualizando transgressão ID: {dados_transgressao['id']}")
        
        # Validação básica
        if not dados_transgressao.get('id'):
            return {'success': False, 'error': 'ID da transgressão é obrigatório'}
        
        if not dados_transgressao.get('gravidade') or not dados_transgressao.get('inciso') or not dados_transgressao.get('texto'):
            return {'success': False, 'error': 'Gravidade, inciso e texto são obrigatórios'}
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se existe outra transgressão com a mesma gravidade e inciso
        cursor.execute('''
            SELECT id, gravidade, inciso FROM transgressoes 
            WHERE LOWER(gravidade) = LOWER(?) AND UPPER(inciso) = UPPER(?) AND id != ?
        ''', (dados_transgressao['gravidade'], dados_transgressao['inciso'], dados_transgressao['id']))
        
        duplicata = cursor.fetchone()
        if duplicata:
            conn.close()
            return {'success': False, 'error': f'Já existe outra transgressão {duplicata[1]} com inciso {duplicata[2]}. Verifique os dados informados.'}
        
        # Atualizar transgressão
        cursor.execute('''
            UPDATE transgressoes 
            SET gravidade = ?, inciso = ?, texto = ?, ativo = ?
            WHERE id = ?
        ''', (
            dados_transgressao['gravidade'],
            dados_transgressao['inciso'],
            dados_transgressao['texto'],
            dados_transgressao.get('ativo', True),
            dados_transgressao['id']
        ))
        
        if cursor.rowcount == 0:
            conn.close()
            return {'success': False, 'error': 'Transgressão não encontrada'}
        
        conn.commit()
        conn.close()
        
        print(f"✅ Transgressão atualizada: {dados_transgressao['gravidade']} - {dados_transgressao['inciso']}")
        return {'success': True, 'message': 'Transgressão atualizada com sucesso'}
        
    except Exception as e:
        print(f"Erro ao atualizar transgressão: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def excluir_transgressao(transgressao_id):
    """Exclui uma transgressão pelo ID"""
    try:
        print(f"🗑️ Excluindo transgressão ID: {transgressao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se a transgressão existe antes de excluir
        cursor.execute('SELECT gravidade, inciso FROM transgressoes WHERE id = ?', (transgressao_id,))
        transgressao = cursor.fetchone()
        
        if not transgressao:
            conn.close()
            return {'success': False, 'error': 'Transgressão não encontrada'}
        
        # Excluir transgressão
        cursor.execute('DELETE FROM transgressoes WHERE id = ?', (transgressao_id,))
        conn.commit()
        conn.close()
        
        print(f"✅ Transgressão excluída: {transgressao[0]} - {transgressao[1]}")
        return {'success': True, 'message': 'Transgressão excluída com sucesso'}
        
    except Exception as e:
        print(f"Erro ao excluir transgressão: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def listar_infracoes_estatuto_art29():
    """Lista todas as infrações do Art. 29 do Estatuto"""
    try:
        print("📋 Listando infrações do Art. 29 do Estatuto...")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29 
            WHERE ativo = 1
            ORDER BY 
                CASE 
                    WHEN inciso GLOB '[IVXLC]*' THEN LENGTH(inciso)
                    ELSE 999
                END,
                inciso
        """)
        
        infracoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for infracao in infracoes:
            resultado.append({
                'id': infracao[0],
                'inciso': infracao[1],
                'texto': infracao[2],
                'ativo': bool(infracao[3])
            })
        
        print(f"✅ {len(resultado)} infrações do Art. 29 encontradas")
        return {'success': True, 'data': resultado}
        
    except Exception as e:
        print(f"Erro ao listar infrações do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def obter_infracao_estatuto_art29(infracao_id):
    """Obtém uma infração específica do Art. 29 por ID"""
    try:
        print(f"📋 Obtendo infração do Art. 29 com ID: {infracao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29 
            WHERE id = ?
        """, (infracao_id,))
        
        infracao = cursor.fetchone()
        conn.close()
        
        if infracao:
            resultado = {
                'id': infracao[0],
                'inciso': infracao[1],
                'texto': infracao[2],
                'ativo': bool(infracao[3])
            }
            print(f"✅ Infração encontrada: {resultado['inciso']}")
            return {'success': True, 'data': resultado}
        else:
            print("❌ Infração não encontrada")
            return {'success': False, 'error': 'Infração não encontrada'}
        
    except Exception as e:
        print(f"❌ Erro ao obter infração do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def criar_infracao_estatuto_art29(inciso, texto):
    """Cria uma nova infração do Art. 29"""
    try:
        print(f"➕ Criando nova infração do Art. 29: {inciso}")
        
        # Validações
        if not inciso or not inciso.strip():
            return {'success': False, 'error': 'Inciso é obrigatório'}
        
        if not texto or not texto.strip():
            return {'success': False, 'error': 'Texto da infração é obrigatório'}
        
        inciso = inciso.strip()
        texto = texto.strip()
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se o inciso já existe
        cursor.execute("""
            SELECT id FROM infracoes_estatuto_art29 
            WHERE UPPER(inciso) = UPPER(?) AND ativo = 1
        """, (inciso,))
        
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': f'Já existe uma infração com o inciso "{inciso}"'}
        
        # Inserir nova infração
        cursor.execute("""
            INSERT INTO infracoes_estatuto_art29 (inciso, texto, ativo)
            VALUES (?, ?, 1)
        """, (inciso, texto))
        
        infracao_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        print(f"✅ Infração criada com sucesso - ID: {infracao_id}")
        return {'success': True, 'data': {'id': infracao_id, 'inciso': inciso, 'texto': texto}}
        
    except Exception as e:
        print(f"❌ Erro ao criar infração do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def editar_infracao_estatuto_art29(infracao_id, inciso, texto):
    """Edita uma infração do Art. 29 existente"""
    try:
        print(f"✏️ Editando infração do Art. 29 - ID: {infracao_id}")
        
        # Validações
        if not inciso or not inciso.strip():
            return {'success': False, 'error': 'Inciso é obrigatório'}
        
        if not texto or not texto.strip():
            return {'success': False, 'error': 'Texto da infração é obrigatório'}
        
        inciso = inciso.strip()
        texto = texto.strip()
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se a infração existe
        cursor.execute("""
            SELECT id FROM infracoes_estatuto_art29 
            WHERE id = ?
        """, (infracao_id,))
        
        if not cursor.fetchone():
            conn.close()
            return {'success': False, 'error': 'Infração não encontrada'}
        
        # Verificar se o inciso já existe em outra infração
        cursor.execute("""
            SELECT id FROM infracoes_estatuto_art29 
            WHERE UPPER(inciso) = UPPER(?) AND id != ? AND ativo = 1
        """, (inciso, infracao_id))
        
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': f'Já existe outra infração com o inciso "{inciso}"'}
        
        # Atualizar infração
        cursor.execute("""
            UPDATE infracoes_estatuto_art29 
            SET inciso = ?, texto = ?
            WHERE id = ?
        """, (inciso, texto, infracao_id))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Infração editada com sucesso")
        return {'success': True, 'data': {'id': infracao_id, 'inciso': inciso, 'texto': texto}}
        
    except Exception as e:
        print(f"❌ Erro ao editar infração do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def excluir_infracao_estatuto_art29(infracao_id):
    """Exclui (desativa) uma infração do Art. 29"""
    try:
        print(f"🗑️ Excluindo infração do Art. 29 - ID: {infracao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se a infração existe
        cursor.execute("""
            SELECT inciso FROM infracoes_estatuto_art29 
            WHERE id = ? AND ativo = 1
        """, (infracao_id,))
        
        infracao = cursor.fetchone()
        if not infracao:
            conn.close()
            return {'success': False, 'error': 'Infração não encontrada'}
        
        # Desativar infração (exclusão lógica)
        cursor.execute("""
            UPDATE infracoes_estatuto_art29 
            SET ativo = 0
            WHERE id = ?
        """, (infracao_id,))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Infração {infracao[0]} excluída com sucesso")
        return {'success': True, 'message': f'Infração {infracao[0]} excluída com sucesso'}
        
    except Exception as e:
        print(f"❌ Erro ao excluir infração do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

# ====================================================================
# FUNÇÕES PARA INDÍCIOS POR PM ENVOLVIDO (MIGRAÇÃO 015)
# ====================================================================

@eel.expose
def salvar_indicios_pm_envolvido(pm_envolvido_id, indicios_data):
    """
    Salva os indícios específicos de um PM envolvido
    
    Args:
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos
        indicios_data (dict): Dados dos indícios com estrutura:
        {
            'categorias': ['categoria1', 'categoria2'],
            'crimes': [{'id': 'crime_id1'}, {'id': 'crime_id2'}],
            'rdpm': [{'id': 'trans_id1', 'natureza': 'grave'}, {'id': 'trans_id2', 'natureza': 'leve'}],
            'art29': [{'id': 'art29_id1'}, {'id': 'art29_id2'}]
        }
    """
    try:
        print(f"💾 Salvando indícios para PM envolvido: {pm_envolvido_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Verificar se o PM envolvido existe
        cursor.execute("SELECT procedimento_id FROM procedimento_pms_envolvidos WHERE id = ?", (pm_envolvido_id,))
        pm_data = cursor.fetchone()
        if not pm_data:
            conn.close()
            return {"sucesso": False, "mensagem": "PM envolvido não encontrado"}
        
        procedimento_id = pm_data[0]
        
        # Limpar indícios existentes para este PM
        cursor.execute("DELETE FROM pm_envolvido_indicios WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        
        # Salvar categorias de indícios
        categorias = indicios_data.get('categorias', [])
        if categorias:
            for categoria in categorias:
                # Converter categoria em array JSON para categorias_indicios
                import json
                categorias_array = [categoria] if isinstance(categoria, str) else categoria
                categorias_json = json.dumps(categorias_array)
                
                cursor.execute("""
                    INSERT INTO pm_envolvido_indicios (id, pm_envolvido_id, procedimento_id, categoria, categorias_indicios)
                    VALUES (?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), pm_envolvido_id, procedimento_id, categoria, categorias_json))
        
        # Salvar crimes/contravenções
        crimes = indicios_data.get('crimes', [])
        if crimes:
            for crime in crimes:
                cursor.execute("""
                    INSERT INTO pm_envolvido_crimes (id, pm_envolvido_id, procedimento_id, crime_id)
                    VALUES (?, ?, ?, ?)
                """, (str(uuid.uuid4()), pm_envolvido_id, procedimento_id, crime['id']))
        
        # Salvar transgressões RDPM
        rdpm = indicios_data.get('rdpm', [])
        if rdpm:
            for trans in rdpm:
                cursor.execute("""
                    INSERT INTO pm_envolvido_rdpm (id, pm_envolvido_id, procedimento_id, transgressao_id, natureza)
                    VALUES (?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), pm_envolvido_id, procedimento_id, trans['id'], trans.get('natureza', 'leve')))
        
        # Salvar infrações Art. 29
        art29 = indicios_data.get('art29', [])
        if art29:
            for infracao in art29:
                cursor.execute("""
                    INSERT INTO pm_envolvido_art29 (id, pm_envolvido_id, procedimento_id, art29_id)
                    VALUES (?, ?, ?, ?)
                """, (str(uuid.uuid4()), pm_envolvido_id, procedimento_id, infracao['id']))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Indícios salvos para PM envolvido: {len(categorias)} categorias, {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")
        return {"sucesso": True, "mensagem": "Indícios salvos com sucesso"}
        
    except Exception as e:
        print(f"❌ Erro ao salvar indícios do PM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao salvar indícios: {str(e)}"}

@eel.expose
def carregar_indicios_pm_envolvido(pm_envolvido_id):
    """
    Carrega os indícios específicos de um PM envolvido
    
    Args:
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos
    
    Returns:
        dict: Indícios estruturados por categoria
    """
    try:
        print(f"📋 Carregando indícios para PM envolvido: {pm_envolvido_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        indicios = {
            'categorias': [],
            'crimes': [],
            'rdpm': [],
            'art29': []
        }
        
        # Carregar categorias
        cursor.execute("SELECT categoria FROM pm_envolvido_indicios WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        indicios['categorias'] = [row[0] for row in cursor.fetchall()]
        
        # Carregar crimes/contravenções com detalhes
        cursor.execute("""
            SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo, 
                   c.paragrafo, c.inciso, c.alinea
            FROM pm_envolvido_crimes pec
            JOIN crimes_contravencoes c ON c.id = pec.crime_id
            WHERE pec.pm_envolvido_id = ?
        """, (pm_envolvido_id,))
        
        for row in cursor.fetchall():
            indicios['crimes'].append({
                'id': row[0],
                'tipo': row[1],
                'dispositivo_legal': row[2],
                'artigo': row[3],
                'descricao_artigo': row[4],
                'paragrafo': row[5] or '',
                'inciso': row[6] or '',
                'alinea': row[7] or ''
            })
        
        # Carregar transgressões RDPM com detalhes
        cursor.execute("""
            SELECT t.id, t.gravidade, t.inciso, t.texto, per.natureza
            FROM pm_envolvido_rdpm per
            JOIN transgressoes t ON t.id = per.transgressao_id
            WHERE per.pm_envolvido_id = ?
        """, (pm_envolvido_id,))
        
        for row in cursor.fetchall():
            indicios['rdpm'].append({
                'id': row[0],
                'gravidade': row[1],
                'inciso': row[2],
                'texto': row[3],
                'natureza': row[4]
            })
        
        # Carregar infrações Art. 29 com detalhes
        cursor.execute("""
            SELECT a.id, a.inciso, a.texto
            FROM pm_envolvido_art29 pea
            JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
            WHERE pea.pm_envolvido_id = ?
        """, (pm_envolvido_id,))
        
        for row in cursor.fetchall():
            indicios['art29'].append({
                'id': row[0],
                'inciso': row[1],
                'texto': row[2]
            })
        
        conn.close()
        
        print(f"✅ Indícios carregados: {len(indicios['categorias'])} categorias, {len(indicios['crimes'])} crimes, {len(indicios['rdpm'])} RDPM, {len(indicios['art29'])} Art.29")
        return {"sucesso": True, "indicios": indicios}
        
    except Exception as e:
        print(f"❌ Erro ao carregar indícios do PM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao carregar indícios: {str(e)}"}

@eel.expose
def listar_pms_envolvidos_com_indicios(procedimento_id):
    """
    Lista todos os PMs envolvidos em um procedimento com seus indícios
    
    Args:
        procedimento_id (str): ID do procedimento
    
    Returns:
        dict: Lista de PMs com seus indícios
    """
    try:
        print(f"📋 Listando PMs envolvidos com indícios para procedimento: {procedimento_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Buscar PMs envolvidos
        cursor.execute("""
            SELECT pme.id, pme.pm_id, pme.pm_tipo, pme.ordem, pme.status_pm,
                   COALESCE(o.nome, e.nome, '') as nome,
                   COALESCE(o.posto_graduacao, e.posto_graduacao, '') as posto,
                   COALESCE(o.matricula, e.matricula, '') as matricula
            FROM procedimento_pms_envolvidos pme
            LEFT JOIN operadores o ON pme.pm_id = o.id AND pme.pm_tipo = 'operador'
            LEFT JOIN encarregados e ON pme.pm_id = e.id AND pme.pm_tipo = 'encarregado'
            WHERE pme.procedimento_id = ?
            ORDER BY pme.ordem
        """, (procedimento_id,))
        
        pms_envolvidos = []
        for row in cursor.fetchall():
            pm_envolvido_id, pm_id, pm_tipo, ordem, status_pm, nome, posto, matricula = row
            
            # Montar nome completo
            nome_completo = f"{posto} {matricula} {nome}".strip()
            
            # Carregar resumo dos indícios
            cursor.execute("SELECT COUNT(*) FROM pm_envolvido_indicios WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
            total_categorias = cursor.fetchone()[0]
            
            # Para crimes, rdpm e art29, precisamos buscar via pm_indicios_id
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_crimes pec 
                JOIN pm_envolvido_indicios pei ON pec.pm_indicios_id = pei.id 
                WHERE pei.pm_envolvido_id = ?
            """, (pm_envolvido_id,))
            total_crimes = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_rdpm per 
                JOIN pm_envolvido_indicios pei ON per.pm_indicios_id = pei.id 
                WHERE pei.pm_envolvido_id = ?
            """, (pm_envolvido_id,))
            total_rdpm = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_art29 pea 
                JOIN pm_envolvido_indicios pei ON pea.pm_indicios_id = pei.id 
                WHERE pei.pm_envolvido_id = ?
            """, (pm_envolvido_id,))
            total_art29 = cursor.fetchone()[0]
            
            pms_envolvidos.append({
                'pm_envolvido_id': pm_envolvido_id,
                'pm_id': pm_id,
                'pm_tipo': pm_tipo,
                'ordem': ordem,
                'status_pm': status_pm,
                'nome': nome,
                'posto_graduacao': posto,
                'matricula': matricula,
                'nome_completo': nome_completo,
                'resumo_indicios': {
                    'categorias': total_categorias,
                    'crimes': total_crimes,
                    'rdpm': total_rdpm,
                    'art29': total_art29,
                    'total': total_categorias + total_crimes + total_rdpm + total_art29
                }
            })
        
        conn.close()
        
        print(f"✅ {len(pms_envolvidos)} PMs envolvidos encontrados")
        return {"sucesso": True, "pms_envolvidos": pms_envolvidos}
        
    except Exception as e:
        print(f"❌ Erro ao listar PMs envolvidos: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao listar PMs envolvidos: {str(e)}"}

@eel.expose
def remover_indicios_pm_envolvido(pm_envolvido_id):
    """
    Remove todos os indícios de um PM envolvido
    
    Args:
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos
    """
    try:
        print(f"🗑️ Removendo indícios do PM envolvido: {pm_envolvido_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        # Remover todos os indícios
        cursor.execute("DELETE FROM pm_envolvido_indicios WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_envolvido_id = ?", (pm_envolvido_id,))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Indícios removidos para PM envolvido: {pm_envolvido_id}")
        return {"sucesso": True, "mensagem": "Indícios removidos com sucesso"}
        
    except Exception as e:
        print(f"❌ Erro ao remover indícios do PM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao remover indícios: {str(e)}"}

@eel.expose
def buscar_crimes_para_indicios(termo=''):
    """
    Busca crimes/contravenções para seleção de indícios
    
    Args:
        termo (str): Termo de busca
    
    Returns:
        dict: Lista de crimes encontrados
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        if termo:
            cursor.execute("""
                SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo, 
                       paragrafo, inciso, alinea
                FROM crimes_contravencoes 
                WHERE ativo = 1 
                AND (artigo LIKE ? OR descricao_artigo LIKE ? OR dispositivo_legal LIKE ?)
                ORDER BY tipo, dispositivo_legal, artigo
                LIMIT 50
            """, (f'%{termo}%', f'%{termo}%', f'%{termo}%'))
        else:
            cursor.execute("""
                SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo, 
                       paragrafo, inciso, alinea
                FROM crimes_contravencoes 
                WHERE ativo = 1
                ORDER BY tipo, dispositivo_legal, artigo
                LIMIT 50
            """)
        
        crimes = []
        for row in cursor.fetchall():
            # Formatar texto para exibição
            texto_completo = f"Art. {row[3]}"
            if row[5]:  # parágrafo
                texto_completo += f", {row[5]}"
            if row[6]:  # inciso
                texto_completo += f", inciso {row[6]}"
            if row[7]:  # alínea
                texto_completo += f", alínea {row[7]}"
            texto_completo += f" - {row[2]} - {row[4]}"
            
            crimes.append({
                'id': row[0],
                'tipo': row[1],
                'dispositivo_legal': row[2],
                'artigo': row[3],
                'descricao_artigo': row[4],
                'paragrafo': row[5] or '',
                'inciso': row[6] or '',
                'alinea': row[7] or '',
                'texto_completo': texto_completo
            })
        
        conn.close()
        
        return {"sucesso": True, "crimes": crimes}
        
    except Exception as e:
        print(f"❌ Erro ao buscar crimes: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar crimes: {str(e)}"}

@eel.expose
def buscar_rdpm_para_indicios(termo='', gravidade=None):
    """
    Busca transgressões RDPM para seleção de indícios
    
    Args:
        termo (str): Termo de busca
        gravidade (str): Filtro por gravidade
    
    Returns:
        dict: Lista de transgressões encontradas
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        params = []
        where_clause = "WHERE ativo = 1"
        
        if termo:
            where_clause += " AND (inciso LIKE ? OR texto LIKE ?)"
            params.extend([f'%{termo}%', f'%{termo}%'])
        
        if gravidade:
            where_clause += " AND gravidade = ?"
            params.append(gravidade)
        
        cursor.execute(f"""
            SELECT id, gravidade, inciso, texto
            FROM transgressoes 
            {where_clause}
            ORDER BY gravidade, inciso
            LIMIT 50
        """, params)
        
        transgressoes = []
        for row in cursor.fetchall():
            transgressoes.append({
                'id': row[0],
                'gravidade': row[1],
                'inciso': row[2],
                'texto': row[3],
                'texto_completo': f"Inciso {row[2]} ({row[1]}) - {row[3]}"
            })
        
        conn.close()
        
        return {"sucesso": True, "transgressoes": transgressoes}
        
    except Exception as e:
        print(f"❌ Erro ao buscar transgressões RDPM: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar transgressões: {str(e)}"}

@eel.expose
def buscar_art29_para_indicios(termo=''):
    """
    Busca infrações do Art. 29 para seleção de indícios
    
    Args:
        termo (str): Termo de busca
    
    Returns:
        dict: Lista de infrações encontradas
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        if termo:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM infracoes_estatuto_art29 
                WHERE ativo = 1 
                AND (inciso LIKE ? OR texto LIKE ?)
                ORDER BY 
                    CASE 
                        WHEN inciso GLOB '[IVXLC]*' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
                LIMIT 50
            """, (f'%{termo}%', f'%{termo}%'))
        else:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM infracoes_estatuto_art29 
                WHERE ativo = 1
                ORDER BY 
                    CASE 
                        WHEN inciso GLOB '[IVXLC]*' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
                LIMIT 50
            """)
        
        infracoes = []
        for row in cursor.fetchall():
            infracoes.append({
                'id': row[0],
                'inciso': row[1],
                'texto': row[2],
                'texto_completo': f"Inciso {row[1]} - {row[2]}"
            })
        
        conn.close()
        
        return {"sucesso": True, "infracoes": infracoes}
        
    except Exception as e:
        print(f"❌ Erro ao buscar infrações Art. 29: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar infrações: {str(e)}"}

if __name__ == "__main__":
    main()