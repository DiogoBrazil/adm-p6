# main.py - Sistema Login com Cadastro usando SQLite
import eel
import sqlite3
import hashlib
import os
import sys
from datetime import datetime

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
        
        # Criar tabela usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        ''')
        
        # Criar tabela processos_procedimentos
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS processos_procedimentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero TEXT UNIQUE NOT NULL,
                tipo TEXT NOT NULL CHECK (tipo IN ('inquiry', 'IPM', 'PADS')),
                responsavel_id INTEGER NOT NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1,
                FOREIGN KEY (responsavel_id) REFERENCES usuarios (id)
            )
        ''')
        
        # Criar usuário admin padrão se não existir
        self.create_admin_user(cursor)
        
        conn.commit()
        conn.close()
        print(f"✅ Banco de dados inicializado: {self.db_path}")
    
    def create_admin_user(self, cursor):
        """Cria usuário admin padrão"""
        # Verifica se admin já existe
        cursor.execute("SELECT id FROM usuarios WHERE email = 'admin' AND is_admin = 1")
        if not cursor.fetchone():
            senha_hash = self.hash_password('123456')
            cursor.execute('''
                INSERT INTO usuarios (nome, email, senha, is_admin) 
                VALUES (?, ?, ?, ?)
            ''', ('Administrador', 'admin', senha_hash, 1))
            print("👤 Usuário admin criado: admin / 123456")
    
    def hash_password(self, password):
        """Gera hash da senha usando SHA-256"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def verify_login(self, email, senha):
        """Verifica credenciais de login"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        senha_hash = self.hash_password(senha)
        cursor.execute('''
            SELECT id, nome, email, is_admin 
            FROM usuarios 
            WHERE email = ? AND senha = ? AND ativo = 1
        ''', (email, senha_hash))
        
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return {
                "id": user[0],
                "nome": user[1],
                "email": user[2],
                "is_admin": bool(user[3])
            }
        return None
    
    def add_user(self, nome, email, senha):
        """Adiciona novo usuário"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Verifica se email já existe
            cursor.execute("SELECT id FROM usuarios WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                return {"sucesso": False, "mensagem": "Email já está em uso!"}
            
            # Adiciona usuário
            senha_hash = self.hash_password(senha)
            cursor.execute('''
                INSERT INTO usuarios (nome, email, senha, is_admin) 
                VALUES (?, ?, ?, 0)
            ''', (nome, email, senha_hash))
            
            conn.commit()
            conn.close()
            
            return {"sucesso": True, "mensagem": "Usuário cadastrado com sucesso!"}
            
        except Exception as e:
            conn.close()
            return {"sucesso": False, "mensagem": f"Erro ao cadastrar usuário: {str(e)}"}
    
    def get_all_users(self):
        """Retorna todos os usuários (exceto admin)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, nome, email, data_criacao, ativo 
            FROM usuarios 
            WHERE is_admin = 0
            ORDER BY data_criacao DESC
        ''')
        
        users = cursor.fetchall()
        conn.close()
        
        return [{
            "id": user[0],
            "nome": user[1],
            "email": user[2],
            "data_criacao": user[3],
            "ativo": bool(user[4])
        } for user in users]
    
    def get_stats(self):
        """Retorna estatísticas do sistema"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Total de usuários (exceto admin)
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE is_admin = 0 AND ativo = 1")
        total_usuarios = cursor.fetchone()[0]
        
        # Total geral (incluindo admin)
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE ativo = 1")
        total_geral = cursor.fetchone()[0]
        
        # Usuários criados hoje
        cursor.execute('''
            SELECT COUNT(*) FROM usuarios 
            WHERE DATE(data_criacao) = DATE('now') AND is_admin = 0
        ''')
        novos_hoje = cursor.fetchone()[0]
        
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
def cadastrar_usuario(nome, email, senha):
    """Cadastra novo usuário"""
    # Validações básicas
    if not nome or not email or not senha:
        return {"sucesso": False, "mensagem": "Todos os campos são obrigatórios!"}
    
    if len(nome.strip()) < 2:
        return {"sucesso": False, "mensagem": "Nome deve ter pelo menos 2 caracteres!"}
    
    if len(senha) < 4:
        return {"sucesso": False, "mensagem": "Senha deve ter pelo menos 4 caracteres!"}
    
    if "@" not in email or "." not in email:
        return {"sucesso": False, "mensagem": "Email inválido!"}
    
    # Adiciona usuário no banco
    return db_manager.add_user(nome.strip(), email.strip().lower(), senha)

@eel.expose
def listar_usuarios():
    """Lista todos os usuários cadastrados"""
    return db_manager.get_all_users()

@eel.expose
def listar_todos_usuarios():
    """Lista todos os usuários incluindo admin (para processos)"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, nome, email, data_criacao, ativo 
        FROM usuarios 
        WHERE ativo = 1
        ORDER BY nome ASC
    ''')
    
    users = cursor.fetchall()
    conn.close()
    
    return [{
        "id": user[0],
        "nome": user[1],
        "email": user[2],
        "data_criacao": user[3],
        "ativo": bool(user[4])
    } for user in users]

@eel.expose
def obter_estatisticas():
    """Retorna estatísticas do sistema"""
    return db_manager.get_stats()

@eel.expose
def verificar_admin():
    """Verifica se usuário logado é admin"""
    if usuario_logado:
        return usuario_logado.get('is_admin', False)
    return False
    

@eel.expose
def registrar_processo(numero, tipo, responsavel_id):
    """Registra um novo processo/procedimento"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO processos_procedimentos (numero, tipo, responsavel_id)
            VALUES (?, ?, ?)
        """, (numero, tipo, responsavel_id))

        conn.commit()
        conn.close()

        return {"sucesso": True, "mensagem": "Processo registrado com sucesso!"}

    except sqlite3.IntegrityError as e:
        return {"sucesso": False, "mensagem": "Número de processo já existe."}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao registrar processo: {str(e)}"}


@eel.expose
def listar_processos():
    """Lista todos os processos cadastrados"""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT p.id, p.numero, p.tipo, u.nome as responsavel, p.data_criacao 
        FROM processos_procedimentos p
        JOIN usuarios u ON p.responsavel_id = u.id
        WHERE p.ativo = 1
        ORDER BY p.data_criacao DESC
    """)

    processos = cursor.fetchall()
    conn.close()

    return [{
        "id": processo[0],
        "numero": processo[1],
        "tipo": processo[2],
        "responsavel": processo[3],
        "data_criacao": processo[4]
    } for processo in processos]

    
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