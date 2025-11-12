# main.py - Sistema Login com Cadastro usando PostgreSQL
import eel
import logging
import psycopg2
import psycopg2.extras
from db_config import get_pg_connection, init_postgres_manager
import hashlib
import bcrypt
import os
import sys
from datetime import datetime, timedelta
import uuid
import time
import json
import traceback
from bottle import route, request, response
from app import catalogos as catalogos_mod
from app import rdpm as rdpm_mod
from app import art29 as art29_mod
from prazos_andamentos_manager import PrazosAndamentosManager

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
            
            cursor.execute('''
                INSERT INTO auditoria (id, tabela, registro_id, operacao, usuario_id, timestamp)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ''', (auditoria_id, tabela, registro_id, operacao, usuario_id))
            
            conn.commit()
            conn.close()
            
            print(f"✓ Auditoria registrada: {operacao} na tabela {tabela} (registro: {registro_id})")
            
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
        cursor.execute('''
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
        ''')
        
        # Criar usuário admin padrão se não existir
        self.create_admin_user(cursor)
        
        conn.commit()
        conn.close()
        print(f"✅ Banco de dados PostgreSQL inicializado com sucesso!")
    
    def create_admin_user(self, cursor):
        """Cria usuário admin padrão"""
        # Verifica se admin já existe na tabela usuarios
        cursor.execute("SELECT id FROM usuarios WHERE email = 'admin@sistema.com' AND perfil = 'admin'")
        if not cursor.fetchone():
            admin_id = str(uuid.uuid4())
            senha_hash = self.hash_password('123456')
            cursor.execute('''
                INSERT INTO usuarios (
                    id, tipo_usuario, posto_graduacao, nome, matricula,
                    is_encarregado, is_operador, email, senha, perfil
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (admin_id, 'Oficial', 'CEL PM', 'ADMINISTRADOR', '000000', 0, 1, 'admin@sistema.com', senha_hash, 'admin'))
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
        cursor.execute('''
            SELECT id, tipo_usuario, posto_graduacao, nome, matricula, email,
                   is_encarregado, is_operador, perfil, created_at, updated_at, senha
            FROM usuarios
            WHERE email = %s AND ativo = TRUE AND is_operador = TRUE
        ''', (email,))
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
                    cursor.execute("UPDATE usuarios SET senha = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (novo, user['id']))
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
                "nome_completo": f"{user['posto_graduacao']} {user['nome']}"
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
                cursor.execute("SELECT id FROM usuarios WHERE email = %s AND id != %s AND ativo = TRUE", (email, user_id))
                if cursor.fetchone():
                    conn.close()
                    return {"sucesso": False, "mensagem": "Email já está em uso por outro usuário!"}
            
            # Verificar matrícula duplicada
            cursor.execute("SELECT id FROM usuarios WHERE matricula = %s AND id != %s AND ativo = TRUE", (matricula.strip(), user_id))
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
            cursor.execute('''
                UPDATE usuarios SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (user_id,))
            
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
        cursor.execute('''
            SELECT COUNT(*) FROM usuarios 
            WHERE DATE(created_at) = DATE('now') AND ativo = TRUE AND nome != 'ADMINISTRADOR'
        ''')
        novos_hoje = cursor.fetchone()['count']
        
        # Estatísticas por vínculo
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE is_encarregado = TRUE AND ativo = TRUE AND nome != 'ADMINISTRADOR'")
        total_encarregados = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE is_operador = TRUE AND ativo = TRUE AND nome != 'ADMINISTRADOR'")
        total_operadores = cursor.fetchone()['count']
        
        conn.close()
        
        return {
            "total_usuarios": total_usuarios,
            "total_geral": total_geral,
            "novos_hoje": novos_hoje,
            "total_encarregados": total_encarregados,
            "total_operadores": total_operadores,
            "banco_path": "PostgreSQL: 192.168.0.137:5432/app_db"
        }

# Inicializar gerenciador de banco
db_manager = DatabaseManager()

# Inicializar gerenciador de prazos e andamentos
# PostgreSQL não usa db_path - conexão gerenciada pelo db_config
prazos_manager = PrazosAndamentosManager()

# Inicializar Eel
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s'
)
logger = logging.getLogger("app")
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute("""
            SELECT id, inciso, texto 
            FROM transgressoes 
            WHERE gravidade = %s AND ativo = TRUE
            ORDER BY 
                CASE 
                    WHEN inciso ~ '^[IVX]' THEN LENGTH(inciso)
                    ELSE 999
                END,
                inciso
        """, (gravidade,))
        
        transgressoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for t in transgressoes:
            resultado.append({
                "id": t['id'],
                "inciso": t['inciso'],
                "texto": t['texto']
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if termo:
            # Busca com filtro por termo (case-insensitive)
            cursor.execute("""
                SELECT id, inciso, texto 
                FROM infracoes_estatuto_art29 
                WHERE (inciso ILIKE %s OR texto ILIKE %s) AND ativo = TRUE
                ORDER BY 
                    CASE 
                        WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
            """, (f'%{termo}%', f'%{termo}%'))
        else:
            # Busca todos os incisos
            cursor.execute("""
                SELECT id, inciso, texto 
                FROM infracoes_estatuto_art29 
                WHERE ativo = TRUE
                ORDER BY 
                    CASE 
                        WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
            """)
        
        infracoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for i in infracoes:
            resultado.append({
                "id": i['id'],
                "inciso": i['inciso'],
                "texto": i['texto']
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
        
        return json.dumps(resultado)
        
    except Exception as e:
        return json.dumps({"erro": f"Erro ao buscar municípios/distritos: {str(e)}"})

@eel.expose
def buscar_municipios_distritos(termo=''):
    """Função EEL para buscar municípios e distritos de Rondônia"""
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

# Variável para usuário logado
usuario_logado = None

def _guard_login():
    """Retorna erro padrão se não houver usuário logado."""
    global usuario_logado
    if not usuario_logado:
        return {"sucesso": False, "mensagem": "Sessão expirada. Faça login novamente."}
    return None

def _guard_admin():
    """Retorna erro se usuário não for admin."""
    global usuario_logado
    if not usuario_logado or not usuario_logado.get('is_admin'):
        return {"sucesso": False, "mensagem": "Acesso negado: apenas administradores."}
    return None

@eel.expose
def obter_usuario_por_id(user_id, user_type):
    """Retorna os dados atuais de um usuário para edição/visualização"""
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
def cadastrar_usuario(tipo_usuario, posto_graduacao, nome, matricula, is_encarregado=False, is_operador=False, email=None, senha=None, perfil=None):
    """Cadastra novo usuário na estrutura unificada"""
    
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

# ======== FUNÇÕES AUXILIARES ========

def buscar_pms_envolvidos(procedimento_id):
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
                    import json
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
        import traceback
        traceback.print_exc()
        return None

@eel.expose
def listar_usuarios(search_term=None, page=1, per_page=10):
    """Lista todos os usuários cadastrados com paginação e pesquisa"""
    return db_manager.get_paginated_users(search_term, page, per_page)

@eel.expose
def listar_todos_usuarios():
    """Lista todos os usuários da nova estrutura unificada"""
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

@eel.expose
def listar_encarregados_operadores():
    """Lista todos os usuários que são encarregados ou operadores"""
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

@eel.expose
def obter_usuario_detalhado(user_id, user_type):
    """Obtém detalhes completos de um usuário para edição"""
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

@eel.expose
def atualizar_usuario(user_id, user_type, tipo_usuario, posto_graduacao, nome, matricula, 
                      is_encarregado, is_operador, email, senha, perfil):
    """Atualiza um usuário existente com todos os campos"""
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

@eel.expose
def atualizar_usuario_old(user_id, user_type, posto_graduacao, matricula, nome, email, senha=None, profile=None):
    """Atualiza um usuário existente (versão antiga - manter por compatibilidade)"""
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Primeiro, obter todos os encarregados
        cursor.execute('''
            SELECT id, posto_graduacao, matricula, nome
            FROM usuarios 
            WHERE ativo = TRUE AND is_encarregado = TRUE
            ORDER BY posto_graduacao, nome
        ''')
        encarregados = cursor.fetchall()
        
        estatisticas = []
        total_processos = 0
        mais_ativo = {"nome": "N/A", "total": 0}
        
        for encarregado in encarregados:
            enc_id = encarregado['id']
            posto = encarregado['posto_graduacao']
            matricula = encarregado['matricula']
            nome = encarregado['nome']
            nome_completo = f"{posto} {matricula} {nome}"
            
            # Inicializar contadores
            contadores = {
                'sr': 0, 'sv': 0, 'fp': 0, 'ipm': 0, 'escrivao': 0,
                'pads': 0, 'pad': 0, 'cd': 0, 'cj': 0
            }
            
            # SR e Sindicâncias (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE responsavel_id = %s 
                AND (tipo_detalhe = 'SR' OR tipo_detalhe = 'SINDICANCIA')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['sr'] = result['count'] if result else 0
            
            # SV - Sindicância de Veículo (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE responsavel_id = %s 
                AND tipo_detalhe = 'SV'
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['sv'] = result['count'] if result else 0
            
            # FP - Feito Preliminar (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE responsavel_id = %s 
                AND (tipo_detalhe = 'FP' OR tipo_detalhe = 'FEITO_PRELIMINAR')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['fp'] = result['count'] if result else 0
            
            # IPM (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE responsavel_id = %s 
                AND (tipo_detalhe = 'IPM' OR tipo_detalhe = 'IPPM')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['ipm'] = result['count'] if result else 0
            
            # Escrivão (quando foi escrivão em IPM)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE escrivao_id = %s
                AND (tipo_detalhe = 'IPM' OR tipo_detalhe = 'IPPM')
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['escrivao'] = result['count'] if result else 0
            
            # PADS (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE responsavel_id = %s 
                AND tipo_detalhe = 'PADS'
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['pads'] = result['count'] if result else 0
            
            # PAD (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'PAD'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['pad'] = result['count'] if result else 0
            
            # CD - Conselho de Disciplina (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'CD'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['cd'] = result['count'] if result else 0
            
            # CJ - Conselho de Justificação (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'CJ'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['cj'] = result['count'] if result else 0
            
            # PADE - Processo Administrativo Disciplinar Especial (como responsável, presidente, interrogante ou escrivão do processo)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE (responsavel_id = %s OR presidente_id = %s OR interrogante_id = %s OR escrivao_processo_id = %s)
                AND tipo_detalhe = 'PADE'
                AND ativo = TRUE
            ''', (enc_id, enc_id, enc_id, enc_id))
            result = cursor.fetchone()
            contadores['pade'] = result['count'] if result else 0
            
            # CP - Conselho Permanente (como responsável)
            cursor.execute('''
                SELECT COUNT(*) as count FROM processos_procedimentos 
                WHERE responsavel_id = %s
                AND tipo_detalhe = 'CP'
                AND ativo = TRUE
            ''', (enc_id,))
            result = cursor.fetchone()
            contadores['cp'] = result['count'] if result else 0
            
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
def obter_ultimos_feitos_encarregado(encarregado_id):
    """
    Obtém os 3 feitos mais recentes de um encarregado.
    Considera todos os papéis: responsável, escrivão, presidente, interrogante, escrivão do processo.
    
    Args:
        encarregado_id: ID do encarregado
        
    Returns:
        dict: {"sucesso": bool, "dados": [{"tipo", "numero", "data_instauracao", 
               "data_recebimento", "data_remessa"}] ou "erro": str}
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        print(f"🔍 Buscando últimos feitos para encarregado ID: {encarregado_id}")
        
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
        
        print(f"  ✅ Encontrou {len(rows)} feitos")
        
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
            print(f"    - {feito['tipo']} nº {feito['numero']}")
        
        conn.close()
        
        return {
            "sucesso": True,
            "dados": feitos
        }
        
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}

# ======== FUNÇÕES DE ESTATÍSTICAS POR TIPO DE PROCESSO ========

@eel.expose
def obter_anos_disponiveis():
    """Retorna lista de anos com processos/procedimentos cadastrados"""
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

@eel.expose
def obter_estatistica_pads_solucoes(ano=None):
    """
    Estatística 1: Quantidade de PADS concluídos por tipo de solução
    (punido, absolvido, arquivado)
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = "WHERE tipo_detalhe = 'PADS' AND concluido = TRUE AND ativo = TRUE"
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        cursor.execute(f'''
            SELECT 
                CASE 
                    WHEN solucao_tipo IS NOT NULL THEN solucao_tipo
                    WHEN penalidade_tipo IS NOT NULL THEN 'Punido'
                    ELSE 'Não Informado'
                END as solucao,
                COUNT(*) as quantidade
            FROM processos_procedimentos
            {where_clause}
            GROUP BY solucao
            ORDER BY quantidade DESC
        ''', params)
        
        resultados = cursor.fetchall()
        conn.close()
        
        dados = [{'solucao': row['solucao'], 'quantidade': row['quantidade']} for row in resultados]
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_estatistica_pads_solucoes: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatistica_ipm_indicios(ano=None):
    """
    Estatística 2: Quantidade de IPM concluídos por tipo de indício
    (crime militar, transgressões disciplinares, sem indícios)
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = "WHERE p.tipo_detalhe IN ('IPM', 'IPPM') AND p.concluido = TRUE AND p.ativo = TRUE"
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        # Crime Militar (conta total de crimes militares cadastrados em IPMs/IPPMs concluídos)
        cursor.execute(f'''
            SELECT COUNT(DISTINCT pec.id) as count
            FROM pm_envolvido_crimes pec
            INNER JOIN pm_envolvido_indicios i ON pec.pm_indicios_id = i.id
            INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
            INNER JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
            {where_clause}
            AND cc.tipo = 'Crime'
            AND (i.categorias_indicios LIKE '%%crime militar%%' OR i.categoria LIKE '%%crime militar%%')
        ''', params)
        crime_militar = cursor.fetchone()['count']
        
        # Transgressões (verifica nas tabelas pm_envolvido_rdpm e pm_envolvido_art29)
        cursor.execute(f'''
            SELECT COUNT(DISTINCT p.id) as count
            FROM processos_procedimentos p
            WHERE p.id IN (
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_rdpm r ON i.id = r.pm_indicios_id
                UNION
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_art29 a ON i.id = a.pm_indicios_id
            )
            {where_clause.replace('WHERE', 'AND')}
        ''', params)
        transgressoes = cursor.fetchone()['count']
        
        # Sem indícios (não tem crime militar, nem transgressões)
        cursor.execute(f'''
            SELECT COUNT(DISTINCT p.id) as count
            FROM processos_procedimentos p
            {where_clause}
            AND p.id NOT IN (
                SELECT procedimento_id FROM pm_envolvido_indicios 
                WHERE categorias_indicios LIKE '%%crime militar%%' OR categoria LIKE '%%crime militar%%'
            )
            AND p.id NOT IN (
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_rdpm r ON i.id = r.pm_indicios_id
                UNION
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_art29 a ON i.id = a.pm_indicios_id
            )
        ''', params)
        sem_indicios = cursor.fetchone()['count']
        
        conn.close()
        
        dados = [
            {'tipo_indicio': 'Crime Militar', 'quantidade': crime_militar},
            {'tipo_indicio': 'Transgressões Disciplinares', 'quantidade': transgressoes},
            {'tipo_indicio': 'Sem Indícios', 'quantidade': sem_indicios}
        ]
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_estatistica_ipm_indicios: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatistica_sr_indicios(ano=None):
    """
    Estatística 3: Quantidade de SR concluídos por tipo de indício
    (crime comum, transgressões disciplinares, sem indícios)
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = "WHERE p.tipo_detalhe = 'SR' AND p.concluido = TRUE AND p.ativo = TRUE"
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        # Crime Comum (conta total de crimes E contravenções cadastrados em SRs concluídos)
        cursor.execute(f'''
            SELECT COUNT(DISTINCT pec.id) as count
            FROM pm_envolvido_crimes pec
            INNER JOIN pm_envolvido_indicios i ON pec.pm_indicios_id = i.id
            INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
            INNER JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
            {where_clause}
            AND cc.tipo IN ('Crime', 'Contravenção Penal')
        ''', params)
        crime_comum = cursor.fetchone()['count']
        
        # Transgressões (verifica nas tabelas pm_envolvido_rdpm e pm_envolvido_art29)
        cursor.execute(f'''
            SELECT COUNT(DISTINCT p.id) as count
            FROM processos_procedimentos p
            WHERE p.id IN (
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_rdpm r ON i.id = r.pm_indicios_id
                UNION
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_art29 a ON i.id = a.pm_indicios_id
            )
            {where_clause.replace('WHERE', 'AND')}
        ''', params)
        transgressoes = cursor.fetchone()['count']
        
        # Sem indícios
        cursor.execute(f'''
            SELECT COUNT(DISTINCT p.id) as count
            FROM processos_procedimentos p
            {where_clause}
            AND p.id NOT IN (
                SELECT procedimento_id FROM pm_envolvido_indicios 
                WHERE categorias_indicios LIKE '%%crime comum%%' OR categoria LIKE '%%crime comum%%'
            )
            AND p.id NOT IN (
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_rdpm r ON i.id = r.pm_indicios_id
                UNION
                SELECT i.procedimento_id 
                FROM pm_envolvido_indicios i
                INNER JOIN pm_envolvido_art29 a ON i.id = a.pm_indicios_id
            )
        ''', params)
        sem_indicios = cursor.fetchone()['count']
        
        conn.close()
        
        dados = [
            {'tipo_indicio': 'Crime Comum', 'quantidade': crime_comum},
            {'tipo_indicio': 'Transgressões Disciplinares', 'quantidade': transgressoes},
            {'tipo_indicio': 'Sem Indícios', 'quantidade': sem_indicios}
        ]
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_estatistica_sr_indicios: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_top10_transgressoes(ano=None):
    """
    Estatística 4: Top 10 transgressões mais recorrentes como indícios em IPM/SR concluídos
    Retorna artigo formatado (Art. 17, Inciso I) e descrição
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause_ipm = "WHERE p.tipo_detalhe IN ('IPM', 'IPPM') AND p.concluido = TRUE AND p.ativo = TRUE"
        where_clause_sr = "WHERE p.tipo_detalhe = 'SR' AND p.concluido = TRUE AND p.ativo = TRUE"
        params = []
        
        if ano:
            where_clause_ipm += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            where_clause_sr += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params = [ano, ano]
        
        # UNION de transgressões RDPM de IPM e SR
        cursor.execute(f'''
            SELECT 
                t.id,
                t.inciso,
                t.gravidade,
                t.texto,
                COUNT(*) as ocorrencias
            FROM (
                SELECT r.transgressao_id, i.procedimento_id
                FROM pm_envolvido_rdpm r
                INNER JOIN pm_envolvido_indicios i ON r.pm_indicios_id = i.id
                INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                {where_clause_ipm}
                
                UNION ALL
                
                SELECT r.transgressao_id, i.procedimento_id
                FROM pm_envolvido_rdpm r
                INNER JOIN pm_envolvido_indicios i ON r.pm_indicios_id = i.id
                INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                {where_clause_sr}
            ) as trans
            INNER JOIN transgressoes t ON trans.transgressao_id = t.id
            GROUP BY t.id, t.inciso, t.gravidade, t.texto
            ORDER BY ocorrencias DESC
            LIMIT 10
        ''', params)
        
        resultados = cursor.fetchall()
        
        # Mapear gravidade para artigo
        gravidade_map = {'leve': '15', 'media': '16', 'grave': '17'}
        
        dados = []
        for row in resultados:
            artigo = gravidade_map.get(row['gravidade'].lower(), '%s')
            
            dados.append({
                'transgressao_id': row['id'],
                'artigo_label': f"Art. {artigo}, Inciso {row['inciso']}",
                'descricao_curta': row['texto'][:50] + '...' if len(row['texto']) > 50 else row['texto'],
                'quantidade': row['ocorrencias']
            })
        
        # Adicionar Art. 29 se houver
        cursor.execute(f'''
            SELECT 
                t.id,
                t.inciso,
                t.texto,
                COUNT(*) as ocorrencias
            FROM (
                SELECT a.art29_id as transgressao_id, i.procedimento_id
                FROM pm_envolvido_art29 a
                INNER JOIN pm_envolvido_indicios i ON a.pm_indicios_id = i.id
                INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                {where_clause_ipm}
                
                UNION ALL
                
                SELECT a.art29_id as transgressao_id, i.procedimento_id
                FROM pm_envolvido_art29 a
                INNER JOIN pm_envolvido_indicios i ON a.pm_indicios_id = i.id
                INNER JOIN processos_procedimentos p ON i.procedimento_id = p.id
                {where_clause_sr}
            ) as trans
            INNER JOIN infracoes_estatuto_art29 t ON trans.transgressao_id = t.id
            GROUP BY t.id, t.inciso, t.texto
            ORDER BY ocorrencias DESC
            LIMIT 10
        ''', params)
        
        art29_resultados = cursor.fetchall()
        
        for row in art29_resultados:
            dados.append({
                'transgressao_id': row['id'],
                'artigo_label': f"Art. 29, Inciso {row['inciso']}",
                'descricao_curta': row['texto'][:50] + '...' if len(row['texto']) > 50 else row['texto'],
                'quantidade': row['ocorrencias']
            })
        
        # Ordenar todos por ocorrências e pegar top 10
        dados = sorted(dados, key=lambda x: x['quantidade'], reverse=True)[:10]
        
        conn.close()
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_top10_transgressoes: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_ranking_motoristas_sinistros(ano=None):
    """
    Estatística 5: Ranking de PMs motoristas em sinistros de trânsito
    Inclui TODOS os procedimentos (em andamento e concluídos)
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = "WHERE p.motorista_id IS NOT NULL AND p.ativo = TRUE"
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        cursor.execute(f'''
            SELECT 
                u.posto_graduacao,
                u.matricula,
                u.nome,
                COUNT(*) as total_sinistros
            FROM processos_procedimentos p
            INNER JOIN usuarios u ON p.motorista_id = u.id
            {where_clause}
            GROUP BY u.id, u.posto_graduacao, u.matricula, u.nome
            ORDER BY total_sinistros DESC
        ''', params)
        
        resultados = cursor.fetchall()
        conn.close()
        
        dados = []
        for row in resultados:
            dados.append({
                'pm_completo': f"{row['posto_graduacao']} {row['matricula']} {row['nome']}",
                'total_sinistros': row['total_sinistros']
            })
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_ranking_motoristas_sinistros: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatistica_naturezas_apuradas(ano=None):
    """
    Estatística 6: Principais naturezas apuradas em procedimentos
    Conta todos os procedimentos (em andamento e concluídos) que possuem natureza_procedimento
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = "WHERE p.natureza_procedimento IS NOT NULL AND p.natureza_procedimento != '' AND p.ativo = TRUE"
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        cursor.execute(f'''
            SELECT 
                p.natureza_procedimento,
                COUNT(*) as total
            FROM processos_procedimentos p
            {where_clause}
            GROUP BY p.natureza_procedimento
            ORDER BY total DESC
        ''', params)
        
        resultados = cursor.fetchall()
        conn.close()
        
        dados = []
        for row in resultados:
            dados.append({
                'natureza': row['natureza_procedimento'],
                'quantidade': row['total']
            })
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_estatistica_naturezas_apuradas: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatistica_crimes_militares_ipm(ano=None):
    """
    Estatística 7: Crimes militares apontados em IPM
    Lista todos os crimes militares vinculados a IPMs
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = """WHERE p.tipo_detalhe = 'IPM' 
                         AND p.ativo = TRUE 
                         AND cc.tipo = 'Crime'
                         AND pei.categorias_indicios LIKE '%%Indícios de crime militar%%'"""
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        cursor.execute(f'''
            SELECT 
                cc.artigo,
                cc.descricao_artigo,
                COUNT(DISTINCT pei.procedimento_id) as total
            FROM pm_envolvido_indicios pei
            JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
            JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
            JOIN processos_procedimentos p ON pei.procedimento_id = p.id
            {where_clause}
            GROUP BY cc.artigo, cc.descricao_artigo
            ORDER BY total DESC, cc.artigo
        ''', params)
        
        resultados = cursor.fetchall()
        conn.close()
        
        dados = []
        for row in resultados:
            dados.append({
                'artigo': row['artigo'],
                'descricao': row['descricao_artigo'],
                'quantidade': row['total']
            })
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_estatistica_crimes_militares_ipm: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatistica_crimes_comuns(ano=None):
    """
    Estatística 8: Contravenções penais e crimes comuns apontados em SR e IPM
    Lista todos os crimes comuns e contravenções penais vinculados a IPMs e SRs
    """
    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        where_clause = """WHERE p.tipo_detalhe IN ('IPM', 'SR') 
                         AND p.ativo = TRUE 
                         AND cc.tipo IN ('Crime', 'Contravenção Penal')
                         AND pei.categorias_indicios LIKE '%%Indícios de crime comum%%'"""
        params = []
        
        if ano:
            where_clause += " AND TO_CHAR(p.data_instauracao, 'YYYY') = %s"
            params.append(ano)
        
        cursor.execute(f'''
            SELECT 
                cc.artigo,
                cc.descricao_artigo,
                cc.tipo,
                COUNT(DISTINCT pei.procedimento_id) as total
            FROM pm_envolvido_indicios pei
            JOIN pm_envolvido_crimes pec ON pei.id = pec.pm_indicios_id
            JOIN crimes_contravencoes cc ON pec.crime_id = cc.id
            JOIN processos_procedimentos p ON pei.procedimento_id = p.id
            {where_clause}
            GROUP BY cc.artigo, cc.descricao_artigo, cc.tipo
            ORDER BY total DESC, cc.artigo
        ''', params)
        
        resultados = cursor.fetchall()
        conn.close()
        
        dados = []
        for row in resultados:
            dados.append({
                'artigo': row['artigo'],
                'descricao': row['descricao_artigo'],
                'classificacao': 'Crime Comum' if row['tipo'] == 'Crime' else 'Contravenção Penal',
                'quantidade': row['total']
            })
        
        return {
            "sucesso": True,
            "dados": dados
        }
        
    except Exception as e:
        print(f"❌ Erro em obter_estatistica_crimes_comuns: {e}")
        return {"sucesso": False, "erro": str(e)}

@eel.expose
def obter_estatisticas_processos_andamento():
    """Retorna estatísticas dos processos em andamento por tipo"""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Query para contar processos em andamento por tipo
        query = '''
            SELECT 
                tipo_detalhe,
                COUNT(*) as total
            FROM processos_procedimentos 
            WHERE ativo = TRUE 
            AND data_conclusao IS NULL
            AND (concluido = FALSE OR concluido IS NULL)
            GROUP BY tipo_detalhe
            ORDER BY total DESC
        '''
        
        cursor.execute(query)
        resultados = cursor.fetchall()
        
        # Converter para dicionário
        estatisticas = {}
        total_geral = 0
        
        for row in resultados:
            tipo = row['tipo_detalhe']
            quantidade = row['total']
            if tipo:  # Ignorar tipos vazios
                estatisticas[tipo] = quantidade
                total_geral += quantidade
        
        # Adicionar total geral
        estatisticas['TOTAL'] = total_geral
        
        # Query para obter alguns dados adicionais úteis
        cursor.execute('''
            SELECT COUNT(*) as count FROM processos_procedimentos 
            WHERE ativo = TRUE AND data_conclusao IS NOT NULL
        ''')
        concluidos = cursor.fetchone()['count']
        
        cursor.execute('''
            SELECT COUNT(*) FROM processos_procedimentos WHERE ativo = TRUE
        ''')
        total_processos = cursor.fetchone()['count']
        
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
    """Registra um novo processo/procedimento"""
    import json
    
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
    
    g = _guard_login()
    if g: return g
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
        import traceback
        traceback.print_exc()
        return {"sucesso": False, "mensagem": f"Erro ao registrar processo/procedimento: {str(e)}"}

@eel.expose
def listar_processos():
    """Lista todos os processos cadastrados"""
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
    g = _guard_login()
    if g: return g
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute("""
            UPDATE processos_procedimentos 
            SET ativo = FALSE 
            WHERE id = %s
        """, (processo_id,))
        
        conn.commit()
        conn.close()
        
        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('processos_procedimentos', processo_id, 'DELETE', usuario_id_logado)
        
        return {"sucesso": True, "mensagem": "Processo/Procedimento excluído com sucesso!"}
    except Exception as e:
        return {"sucesso": False, "mensagem": f"Erro ao excluir processo/procedimento: {str(e)}"}

@eel.expose
def substituir_encarregado(processo_id, novo_encarregado_id, justificativa=None):
    """Substitui o encarregado de um processo/procedimento e registra no histórico"""
    g = _guard_login()
    if g: return g
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
        import json
        from datetime import datetime
        
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

@eel.expose
def obter_historico_encarregados(processo_id):
    """Obtém o histórico de encarregados de um processo, garantindo que o primeiro seja incluído."""
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

@eel.expose
def obter_processo(processo_id):
    """Obtém dados de um processo específico para edição"""
    import json
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
            pms_envolvidos = buscar_pms_envolvidos(processo_id)

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
                        indicios_pm = buscar_indicios_por_pm(pm_envolvido_id)
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
                    indicios_pm = buscar_indicios_por_pm(pm_envolvido_id)
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

@eel.expose
def obter_procedimento_completo(procedimento_id):
    """Obtém dados consolidados para a página de visualização"""
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
        trans_info = obter_processo(procedimento_id)
        trans_sel = []
        indicios_por_pm = {}
        if isinstance(trans_info, dict) and trans_info.get('transgressoes_selecionadas') is not None:
            trans_sel = trans_info.get('transgressoes_selecionadas')
            indicios_por_pm = trans_info.get('indicios_por_pm', {})

        # Carregar indícios já usando a função obter_processo para consolidar
        proc_edicao = obter_processo(procedimento_id) or {}
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

@eel.expose
def obter_encarregados_procedimento(procedimento_id):
    """Retorna responsável e escrivão (se houver) para o procedimento.
    Para CJ, CD e PAD retorna presidente, interrogante e escrivão do processo."""
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

@eel.expose
def obter_envolvidos_procedimento(procedimento_id):
    """Retorna os envolvidos do procedimento (múltiplos para procedimentos ou único para processos)"""
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
            pms = buscar_pms_envolvidos(procedimento_id)
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

@eel.expose
def atualizar_processo(
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
    """Atualiza um processo/procedimento existente"""
    import json
    
    g = _guard_login()
    if g: return g
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
                    import json as _json
                    ids = _json.loads(lista_ids)
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
                import json
                
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
            import traceback
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
                    import json
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
                andamentos_formatados.append({
                    "id": and_.get('id', ''),
                    "data": and_.get('data', ''),
                    "descricao": and_.get('texto', '') or and_.get('descricao', ''),
                    "usuario_nome": and_.get('usuario', 'Sistema')
                })

            return {"sucesso": True, "andamentos": andamentos_formatados}
        
        return {"sucesso": True, "andamentos": []}
        
    except Exception as e:
        print(f"Erro ao listar andamentos: {e}")
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

@eel.expose
def listar_andamentos(processo_id):
    """Lista todos os andamentos de um processo/procedimento"""
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

@eel.expose
def remover_andamento(processo_id, andamento_id):
    """Remove um andamento específico do processo/procedimento"""
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

@eel.expose
def listar_processos_com_prazos(search_term=None, page=1, per_page=6, filtros=None):
    """Lista processos com cálculo de prazo automático, paginação e filtros avançados"""
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

# ======== FUNÇÕES DE TRANSGRESSÕES ========

@eel.expose
def listar_transgressoes(gravidade=None):
    """Lista transgressões por gravidade"""
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

@eel.expose
def buscar_transgressoes(termo, gravidade=None):
    """Busca transgressões por termo"""
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

@eel.expose
def obter_estatisticas_usuario(user_id, user_type):
    """Obtém estatísticas detalhadas de um usuário específico"""
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

@eel.expose
def obter_processos_usuario_responsavel(user_id):
    """Obtém lista de processos/procedimentos onde o usuário é responsável (encarregado)"""
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

@eel.expose
def obter_processos_usuario_escrivao(user_id):
    """Obtém lista de processos/procedimentos onde o usuário é escrivão"""
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

@eel.expose
def obter_processos_usuario_envolvido(user_id):
    """Obtém lista de processos/procedimentos onde o usuário é envolvido (sindicado, acusado, indiciado, investigado)"""
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

@eel.expose
def listar_auditorias(search_term=None, page=1, per_page=10, filtros=None):
    """
    Lista auditorias com paginação e filtros
    
    Args:
        search_term: Termo de busca (usuário, tabela, registro)
        page: Página atual
        per_page: Registros por página
        filtros: Dict com filtros (operacao, tabela)
    """
    g = _guard_admin()
    if g: return g
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Construir WHERE clause
        where_conditions = []
        params = []
        
        # Filtro de busca por texto
        if search_term and search_term.strip():
            where_conditions.append("""(
                LOWER(u.nome) LIKE LOWER(%s) OR
                LOWER(a.tabela) LIKE LOWER(%s) OR
                LOWER(a.registro_id) LIKE LOWER(%s)
            )""")
            search_pattern = f"%{search_term.strip()}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        # Filtros específicos
        if filtros:
            if filtros.get('operacao'):
                where_conditions.append("a.operacao = %s")
                params.append(filtros['operacao'])
            
            if filtros.get('tabela'):
                where_conditions.append("a.tabela = %s")
                params.append(filtros['tabela'])
        
        where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        
        # Contar total de registros
        count_query = f"""
            SELECT COUNT(*) as total
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            {where_clause}
        """
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total']
        total_pages = (total + per_page - 1) // per_page
        
        # Buscar registros da página
        offset = (page - 1) * per_page
        query = f"""
            SELECT 
                a.tabela,
                a.registro_id,
                a.operacao,
                a.timestamp,
                COALESCE(u.nome, 'Sistema') as usuario_nome,
                COALESCE(u.posto_graduacao, '') as usuario_posto
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            {where_clause}
            ORDER BY a.timestamp DESC
            LIMIT %s OFFSET %s
        """
        cursor.execute(query, params + [per_page, offset])
        auditorias = cursor.fetchall()
        
        conn.close()
        
        # Formatar resultados
        resultado = []
        for aud in auditorias:
            resultado.append({
                'tabela': aud['tabela'],
                'registro_id': aud['registro_id'],
                'operacao': aud['operacao'],
                'timestamp': aud['timestamp'].isoformat() if aud['timestamp'] else None,
                'usuario_nome': f"{aud['usuario_posto']} {aud['usuario_nome']}".strip() if aud['usuario_posto'] else aud['usuario_nome']
            })
        
        return {
            'sucesso': True,
            'auditorias': resultado,
            'total': total,
            'total_pages': total_pages,
            'current_page': page,
            'per_page': per_page
        }
        
    except Exception as e:
        print(f"Erro ao listar auditorias: {e}")
        import traceback
        traceback.print_exc()
        return {
            'sucesso': False,
            'mensagem': f'Erro ao listar auditorias: {str(e)}',
            'auditorias': [],
            'total': 0,
            'total_pages': 0
        }

def main():
    """Função principal"""
    print("🚀 Iniciando Sistema de Login com Cadastro...")
    print(f"📁 Banco de dados: PostgreSQL (192.168.0.137:5432/app_db)")
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
    g = _guard_login()
    if g: return g
    from app import catalogos as catalogos_mod
    return catalogos_mod.listar_crimes_contravencoes(db_manager)

@eel.expose
def excluir_crime_contravencao(crime_id):
    """Exclui (desativa) um crime/contravenção pelo ID"""
    g = _guard_admin()
    if g: return g
    from app import catalogos as catalogos_mod
    return catalogos_mod.excluir_crime_contravencao(db_manager, crime_id)

@eel.expose
def cadastrar_crime(dados_crime):
    """Cadastra um novo crime/contravenção"""
    g = _guard_admin()
    if g: return g
    try:
        # Validar campos antes de cadastrar
        validation_errors = validar_campos_crime(dados_crime)
        if validation_errors:
            return {
                'success': False, 
                'error': 'Erro de validação: ' + '; '.join(validation_errors)
            }
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Gerar ID único
        crime_id = str(uuid.uuid4())
        
        # Inserir novo crime
        cursor.execute('''
            INSERT INTO crimes_contravencoes 
            (id, tipo, dispositivo_legal, artigo, descricao_artigo, 
             paragrafo, inciso, alinea, ativo)
    # Validação
    validation_errors = validar_campos_crime(dados_crime)
    if validation_errors:
        return {'success': False, 'error': 'Erro de validação: ' + '; '.join(validation_errors)}
    from app import catalogos as catalogos_mod
    r = catalogos_mod.cadastrar_crime(db_manager, dados_crime)
    if r.get('success'):
        print(f"✅ Crime cadastrado: {dados_crime['tipo']} - Art. {dados_crime['artigo']}")
    return r
            FROM crimes_contravencoes
            WHERE id = %s
        ''', (crime_id,))
        crime = cursor.fetchone()
        conn.close()
        
        if not crime:
            return {'success': False, 'error': 'Crime não encontrado'}
        
        result = {
            'id': crime['id'],
            'tipo': crime['tipo'],
            'dispositivo_legal': crime['dispositivo_legal'],
            'artigo': crime['artigo'],
            'descricao_artigo': crime['descricao_artigo'],
            'paragrafo': crime['paragrafo'] if crime['paragrafo'] else '',
            'inciso': crime['inciso'] if crime['inciso'] else '',
            'alinea': crime['alinea'] if crime['alinea'] else '',
            'ativo': bool(crime['ativo'])
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
        
    from app import catalogos as catalogos_mod
    return catalogos_mod.obter_crime_por_id(db_manager, crime_id)
def listar_todas_transgressoes():
    """Lista todas as transgressões disciplinares com paginação e busca"""
    g = _guard_login()
    if g: return g
    try:
        print("📄 Listando transgressões disciplinares...")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT id, artigo, gravidade, inciso, texto, ativo, created_at
            FROM transgressoes 
            ORDER BY artigo, inciso
        ''')
        
        transgressoes = []
        for row in cursor.fetchall():
            transgressoes.append({
                'id': row['id'],
                'artigo': row['artigo'],
                'gravidade': row['gravidade'].title() if row['gravidade'] else '',  # Capitalizar primeira letra
                'inciso': row['inciso'],
                'texto': row['texto'],
                'ativo': bool(row['ativo']),
                'created_at': row['created_at']
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
    g = _guard_admin()
    # Validar campos antes de atualizar
    validation_errors = validar_campos_crime(dados_crime)
    if validation_errors:
        return {'success': False, 'error': 'Erro de validação: ' + '; '.join(validation_errors)}
    from app import catalogos as catalogos_mod
    r = catalogos_mod.atualizar_crime(db_manager, dados_crime)
    if r.get('success'):
        print(f"✅ Crime atualizado: {dados_crime['tipo']} - Art. {dados_crime['artigo']}")
    return r
        # PostgreSQL não tem lastrowid, precisa usar RETURNING
        cursor.execute('SELECT lastval()')
        transgressao_id = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('transgressoes', str(transgressao_id), 'CREATE', usuario_id_logado)
        
        print(f"✅ Transgressão cadastrada: ID {transgressao_id}")
        return {'success': True, 'message': 'Transgressão cadastrada com sucesso', 'id': transgressao_id}
        
    except Exception as e:
        print(f"Erro ao cadastrar transgressão: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def obter_transgressao_por_id(transgressao_id):
    """Obtém uma transgressão específica pelo ID"""
    g = _guard_login()
    if g: return g
    try:
        print(f"🔍 Buscando transgressão ID: {transgressao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT id, artigo, gravidade, inciso, texto, ativo, created_at
            FROM transgressoes 
            WHERE id = %s
        ''', (transgressao_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            transgressao = {
                'id': row['id'],
                'artigo': row['artigo'],
                'gravidade': row['gravidade'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'ativo': bool(row['ativo']),
                'created_at': row['created_at']
            }
            print(f"✅ Transgressão encontrada: Artigo {transgressao['artigo']} - {transgressao['inciso']}")
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
    g = _guard_admin()
    if g: return g
    try:
        artigo = dados_transgressao.get('artigo')
        gravidade = dados_transgressao.get('gravidade')
        
        print(f"📝 Atualizando transgressão ID: {dados_transgressao['id']}")
        
        # Validação básica
        if not dados_transgressao.get('id'):
            return {'success': False, 'error': 'ID da transgressão é obrigatório'}
        
        if not artigo or not dados_transgressao.get('inciso') or not dados_transgressao.get('texto'):
            return {'success': False, 'error': 'Artigo, inciso e texto são obrigatórios'}
        
        # Validar artigo (deve ser 15, 16 ou 17)
        if artigo not in [15, 16, 17]:
            return {'success': False, 'error': 'Artigo deve ser 15, 16 ou 17'}
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar se existe outra transgressão com a mesma gravidade e inciso
        cursor.execute('''
            SELECT id, gravidade, inciso FROM transgressoes 
            WHERE LOWER(gravidade) = LOWER(%s) AND UPPER(inciso) = UPPER(%s) AND id != %s
        ''', (gravidade, dados_transgressao['inciso'], dados_transgressao['id']))
        
        duplicata = cursor.fetchone()
        if duplicata:
            conn.close()
            return {'success': False, 'error': f'Já existe outra transgressão {duplicata[1]} com inciso {duplicata[2]}. Verifique os dados informados.'}
        
        # Atualizar transgressão (agora com artigo)
        cursor.execute('''
            UPDATE transgressoes 
            SET artigo = %s, gravidade = %s, inciso = %s, texto = %s, ativo = %s
            WHERE id = %s
        ''', (
            artigo,
            gravidade,
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
        
        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('transgressoes', str(dados_transgressao['id']), 'UPDATE', usuario_id_logado)
        
        print(f"✅ Transgressão atualizada: Artigo {artigo} - {dados_transgressao['inciso']}")
        return {'success': True, 'message': 'Transgressão atualizada com sucesso'}
        
    except Exception as e:
        print(f"Erro ao atualizar transgressão: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def excluir_transgressao(transgressao_id):
    """Exclui uma transgressão pelo ID"""
    g = _guard_admin()
    if g: return g
    try:
        print(f"🗑️ Excluindo transgressão ID: {transgressao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar se a transgressão existe antes de excluir
        cursor.execute('SELECT gravidade, inciso FROM transgressoes WHERE id = %s', (transgressao_id,))
        transgressao = cursor.fetchone()
        
        if not transgressao:
            conn.close()
            return {'success': False, 'error': 'Transgressão não encontrada'}
        
        # Excluir transgressão
        cursor.execute('DELETE FROM transgressoes WHERE id = %s', (transgressao_id,))
        conn.commit()
        conn.close()
        
        # Registrar auditoria
        usuario_id_logado = usuario_logado['id'] if usuario_logado else None
        db_manager.registrar_auditoria('transgressoes', str(transgressao_id), 'DELETE', usuario_id_logado)
        
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute("""
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29 
            WHERE ativo = TRUE
            ORDER BY 
                CASE 
                    WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                    ELSE 999
                END,
                inciso
        """)
        
        infracoes = cursor.fetchall()
        conn.close()
        
        resultado = []
        for infracao in infracoes:
            resultado.append({
                'id': infracao['id'],
                'inciso': infracao['inciso'],
                'texto': infracao['texto'],
                'ativo': bool(infracao['ativo'])
            })
        
        print(f"✅ {len(resultado)} infrações do Art. 29 encontradas")
        return {'success': True, 'data': resultado}
        
    except Exception as e:
        print(f"Erro ao listar infrações do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def obter_infracao_estatuto_art29(infracao_id):
    """Obtém uma infração específica do Art. 29 por ID"""
    g = _guard_login()
    if g: return g
    try:
        print(f"📋 Obtendo infração do Art. 29 com ID: {infracao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute("""
            SELECT id, inciso, texto, ativo
            FROM infracoes_estatuto_art29 
            WHERE id = %s
        """, (infracao_id,))
        
        infracao = cursor.fetchone()
        conn.close()
        
        if infracao:
            resultado = {
                'id': infracao['id'],
                'inciso': infracao['inciso'],
                'texto': infracao['texto'],
                'ativo': bool(infracao['ativo'])
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar se o inciso já existe
        cursor.execute("""
            SELECT id FROM infracoes_estatuto_art29 
            WHERE UPPER(inciso) = UPPER(%s) AND ativo = TRUE
        """, (inciso,))
        
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': f'Já existe uma infração com o inciso "{inciso}"'}
        
        # Gerar novo UUID
        novo_id = str(uuid.uuid4())
        
        # Inserir nova infração
        cursor.execute("""
            INSERT INTO infracoes_estatuto_art29 (id, inciso, texto, ativo)
            VALUES (%s, %s, %s, TRUE)
        """, (novo_id, inciso, texto))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Infração criada com sucesso - ID: {novo_id}")
        return {'success': True, 'data': {'id': novo_id, 'inciso': inciso, 'texto': texto}}
        
    except Exception as e:
        print(f"❌ Erro ao criar infração do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

@eel.expose
def editar_infracao_estatuto_art29(infracao_id, inciso, texto):
    """Edita uma infração do Art. 29 existente"""
    g = _guard_admin()
    if g: return g
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar se a infração existe
        cursor.execute("""
            SELECT id FROM infracoes_estatuto_art29 
            WHERE id = %s
        """, (infracao_id,))
        
        if not cursor.fetchone():
            conn.close()
            return {'success': False, 'error': 'Infração não encontrada'}
        
        # Verificar se o inciso já existe em outra infração
        cursor.execute("""
            SELECT id FROM infracoes_estatuto_art29 
            WHERE UPPER(inciso) = UPPER(%s) AND id != %s AND ativo = TRUE
        """, (inciso, infracao_id))
        
        if cursor.fetchone():
            conn.close()
            return {'success': False, 'error': f'Já existe outra infração com o inciso "{inciso}"'}
        
        # Atualizar infração
        cursor.execute("""
            UPDATE infracoes_estatuto_art29 
            SET inciso = %s, texto = %s
            WHERE id = %s
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
    g = _guard_admin()
    if g: return g
    try:
        print(f"🗑️ Excluindo infração do Art. 29 - ID: {infracao_id}")
        
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar se a infração existe
        cursor.execute("""
            SELECT inciso FROM infracoes_estatuto_art29 
            WHERE id = %s AND ativo = TRUE
        """, (infracao_id,))
        
        infracao = cursor.fetchone()
        if not infracao:
            conn.close()
            return {'success': False, 'error': 'Infração não encontrada'}
        
        # Desativar infração (exclusão lógica)
        cursor.execute("""
            UPDATE infracoes_estatuto_art29 
            SET ativo = FALSE
            WHERE id = %s
        """, (infracao_id,))
        
        conn.commit()
        conn.close()
        
        inciso = infracao['inciso']
        print(f"✅ Infração {inciso} excluída com sucesso")
        return {'success': True, 'message': f'Infração {inciso} excluída com sucesso'}
        
    except Exception as e:
        print(f"❌ Erro ao excluir infração do Art. 29: {e}")
        return {'success': False, 'error': str(e)}

# ====================================================================
# FUNÇÕES PARA INDÍCIOS POR PM ENVOLVIDO (MIGRAÇÃO 015)
# ====================================================================

@eel.expose
def salvar_indicios_pm_envolvido(pm_envolvido_id, indicios_data, conn=None, cursor=None):
    """
    Salva os indícios específicos de um PM envolvido
    
    Args:
        pm_envolvido_id (str): ID do PM na tabela procedimento_pms_envolvidos
        indicios_data (dict): Dados dos indícios com estrutura:
        {
            'categorias': ['categoria1', 'categoria2'],
            'crimes': [{'id': 'crime_id1'}, {'id': 'crime_id2'}],
            'rdpm': [{'id': 'trans_id1'}, {'id': 'trans_id2'}],
            'art29': [{'id': 'art29_id1'}, {'id': 'art29_id2'}]
        }
        conn: Conexão com o banco (opcional, cria uma nova se não fornecida)
        cursor: Cursor do banco (opcional, cria um novo se não fornecido)
    """
    import json
    try:
        print("="*80)
        print("� FUNÇÃO salvar_indicios_pm_envolvido CHAMADA!")
        print("="*80)
        print(f"💾 PM Envolvido ID: {pm_envolvido_id}")
        print(f"📋 Tipo dos dados recebidos: {type(indicios_data)}")
        print(f"📋 Dados recebidos completos:")
        print(json.dumps(indicios_data, indent=2, ensure_ascii=False))
        
        # Usar conexão fornecida ou criar nova
        fechar_conexao = False
        if conn is None:
            conn = db_manager.get_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            fechar_conexao = True
        elif cursor is None:
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar se o PM envolvido existe
        cursor.execute("SELECT procedimento_id FROM procedimento_pms_envolvidos WHERE id = %s", (pm_envolvido_id,))
        pm_data = cursor.fetchone()
        if not pm_data:
            conn.close()
            return {"sucesso": False, "mensagem": "PM envolvido não encontrado"}
        
        procedimento_id = pm_data['procedimento_id']
        print(f"📋 Procedimento ID: {procedimento_id}")
        
        # Buscar ID do registro de indícios existente (se houver)
        cursor.execute("SELECT id FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s AND ativo = TRUE", (pm_envolvido_id,))
        indicios_registro = cursor.fetchone()
        
        if indicios_registro:
            # Atualizar registro existente
            pm_indicios_id = indicios_registro['id']
            print(f"🔄 Atualizando registro de indícios existente: {pm_indicios_id}")
            print(f"🗑️ Removendo vínculos antigos...")
            
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
            """, (pm_indicios_id, pm_envolvido_id, procedimento_id))
        
        # Atualizar categorias no registro principal
        import json
        categorias = indicios_data.get('categorias', [])
        categorias_json = json.dumps(categorias, ensure_ascii=False)
        primeira_categoria = categorias[0] if categorias else ''
        
        cursor.execute("""
            UPDATE pm_envolvido_indicios 
            SET categorias_indicios = %s, categoria = %s
            WHERE id = %s
        """, (categorias_json, primeira_categoria, pm_indicios_id))
        
        # Salvar crimes/contravenções
        crimes = indicios_data.get('crimes', [])
        print(f"📋 Crimes recebidos ({len(crimes)}): {crimes}")
        for crime in crimes:
            crime_id = crime.get('id') if isinstance(crime, dict) else crime
            print(f"  - Inserindo crime ID: {crime_id}")
            cursor.execute("""
                INSERT INTO pm_envolvido_crimes (id, pm_indicios_id, crime_id)
                VALUES (%s, %s, %s)
            """, (str(uuid.uuid4()), pm_indicios_id, crime_id))
        
        # Salvar transgressões RDPM
        rdpm = indicios_data.get('rdpm', [])
        print(f"📋 RDPM recebidas ({len(rdpm)}): {rdpm}")
        for trans in rdpm:
            trans_id = trans.get('id') if isinstance(trans, dict) else trans
            print(f"  - Inserindo RDPM ID: {trans_id}")
            cursor.execute("""
                INSERT INTO pm_envolvido_rdpm (id, pm_indicios_id, transgressao_id)
                VALUES (%s, %s, %s)
            """, (str(uuid.uuid4()), pm_indicios_id, trans_id))
        
        # Salvar infrações Art. 29
        art29 = indicios_data.get('art29', [])
        print(f"📋 Art.29 recebidas ({len(art29)}): {art29}")
        for infracao in art29:
            art29_id = infracao.get('id') if isinstance(infracao, dict) else infracao
            print(f"  - Inserindo Art.29 ID: {art29_id}")
            cursor.execute("""
                INSERT INTO pm_envolvido_art29 (id, pm_indicios_id, art29_id)
                VALUES (%s, %s, %s)
            """, (str(uuid.uuid4()), pm_indicios_id, art29_id))
        
        # Só fazer commit e fechar se criamos a conexão localmente
        if fechar_conexao:
            conn.commit()
            conn.close()
        
        print(f"✅ Indícios salvos: {len(categorias)} categorias, {len(crimes)} crimes, {len(rdpm)} RDPM, {len(art29)} Art.29")
        return {"sucesso": True, "mensagem": "Indícios salvos com sucesso"}
        
    except Exception as e:
        print(f"❌ Erro ao salvar indícios do PM: {e}")
        import traceback
        traceback.print_exc()
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        indicios = {
            'categorias': [],
            'crimes': [],
            'rdpm': [],
            'art29': []
        }
        
        # Carregar categorias
        cursor.execute("SELECT categoria FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        indicios['categorias'] = [row['categoria'] for row in cursor.fetchall() if row['categoria']]
        
        # Carregar crimes/contravenções com detalhes
        cursor.execute("""
            SELECT c.id, c.tipo, c.dispositivo_legal, c.artigo, c.descricao_artigo, 
                   c.paragrafo, c.inciso, c.alinea
            FROM pm_envolvido_crimes pec
            JOIN crimes_contravencoes c ON c.id = pec.crime_id
            WHERE pec.pm_envolvido_id = %s
        """, (pm_envolvido_id,))
        
        for row in cursor.fetchall():
            indicios['crimes'].append({
                'id': row['id'],
                'tipo': row['tipo'],
                'dispositivo_legal': row['dispositivo_legal'],
                'artigo': row['artigo'],
                'descricao_artigo': row['descricao_artigo'],
                'paragrafo': row['paragrafo'] or '',
                'inciso': row['inciso'] or '',
                'alinea': row['alinea'] or ''
            })
        
        # Carregar transgressões RDPM com detalhes
        cursor.execute("""
            SELECT t.id, t.artigo, t.gravidade, t.inciso, t.texto, per.natureza
            FROM pm_envolvido_rdpm per
            JOIN transgressoes t ON t.id = per.transgressao_id
            WHERE per.pm_envolvido_id = %s
        """, (pm_envolvido_id,))
        
        for row in cursor.fetchall():
            indicios['rdpm'].append({
                'id': row['id'],
                'artigo': row['artigo'],
                'gravidade': row['gravidade'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'natureza': row.get('natureza', row['gravidade'])
            })
        
        # Carregar infrações Art. 29 com detalhes
        cursor.execute("""
            SELECT a.id, a.inciso, a.texto
            FROM pm_envolvido_art29 pea
            JOIN infracoes_estatuto_art29 a ON a.id = pea.art29_id
            WHERE pea.pm_envolvido_id = %s
        """, (pm_envolvido_id,))
        
        for row in cursor.fetchall():
            indicios['art29'].append({
                'id': row['id'],
                'inciso': row['inciso'],
                'texto': row['texto']
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Buscar PMs envolvidos
        cursor.execute("""
            SELECT pme.id, pme.pm_id, pme.pm_tipo, pme.ordem, pme.status_pm,
                   COALESCE(u.nome, '') as nome,
                   COALESCE(u.posto_graduacao, '') as posto,
                   COALESCE(u.matricula, '') as matricula
            FROM procedimento_pms_envolvidos pme
            LEFT JOIN usuarios u ON pme.pm_id = u.id
            WHERE pme.procedimento_id = %s
            ORDER BY pme.ordem
        """, (procedimento_id,))
        
        pms_envolvidos = []
        for row in cursor.fetchall():
            pm_envolvido_id, pm_id, pm_tipo, ordem, status_pm, nome, posto, matricula = row
            
            # Montar nome completo
            nome_completo = f"{posto} {matricula} {nome}".strip()
            
            # Carregar resumo dos indícios
            cursor.execute("SELECT COUNT(*) FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
            total_categorias = cursor.fetchone()['count']
            
            # Para crimes, rdpm e art29, precisamos buscar via pm_indicios_id
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_crimes pec 
                JOIN pm_envolvido_indicios pei ON pec.pm_indicios_id = pei.id 
                WHERE pei.pm_envolvido_id = %s
            """, (pm_envolvido_id,))
            total_crimes = cursor.fetchone()['count']
            
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_rdpm per 
                JOIN pm_envolvido_indicios pei ON per.pm_indicios_id = pei.id 
                WHERE pei.pm_envolvido_id = %s
            """, (pm_envolvido_id,))
            total_rdpm = cursor.fetchone()['count']
            
            cursor.execute("""
                SELECT COUNT(*) FROM pm_envolvido_art29 pea 
                JOIN pm_envolvido_indicios pei ON pea.pm_indicios_id = pei.id 
                WHERE pei.pm_envolvido_id = %s
            """, (pm_envolvido_id,))
            total_art29 = cursor.fetchone()['count']
            
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Remover todos os indícios
        cursor.execute("DELETE FROM pm_envolvido_indicios WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_crimes WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_rdpm WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        cursor.execute("DELETE FROM pm_envolvido_art29 WHERE pm_envolvido_id = %s", (pm_envolvido_id,))
        
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if termo:
            cursor.execute("""
                SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo, 
                       paragrafo, inciso, alinea
                FROM crimes_contravencoes 
                WHERE ativo = TRUE 
                AND (artigo ILIKE %s OR descricao_artigo ILIKE %s OR dispositivo_legal ILIKE %s)
                ORDER BY tipo, dispositivo_legal, artigo
                LIMIT 50
            """, (f'%{termo}%', f'%{termo}%', f'%{termo}%'))
        else:
            cursor.execute("""
                SELECT id, tipo, dispositivo_legal, artigo, descricao_artigo, 
                       paragrafo, inciso, alinea
                FROM crimes_contravencoes 
                WHERE ativo = TRUE
                ORDER BY tipo, dispositivo_legal, artigo
                LIMIT 50
            """)
        
        crimes = []
        for row in cursor.fetchall():
            # Formatar texto para exibição
            texto_completo = f"Art. {row['artigo']}"
            if row['paragrafo']:
                texto_completo += f", {row['paragrafo']}"
            if row['inciso']:
                texto_completo += f", inciso {row['inciso']}"
            if row['alinea']:
                texto_completo += f", alínea {row['alinea']}"
            texto_completo += f" - {row['dispositivo_legal']} - {row['descricao_artigo']}"
            
            crimes.append({
                'id': row['id'],
                'tipo': row['tipo'],
                'dispositivo_legal': row['dispositivo_legal'],
                'artigo': row['artigo'],
                'descricao_artigo': row['descricao_artigo'],
                'paragrafo': row['paragrafo'] or '',
                'inciso': row['inciso'] or '',
                'alinea': row['alinea'] or '',
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        params = []
        where_clause = "WHERE ativo = TRUE"
        
        if termo:
            where_clause += " AND (inciso ILIKE %s OR texto ILIKE %s)"
            params.extend([f'%{termo}%', f'%{termo}%'])
        
        if gravidade:
            where_clause += " AND gravidade = %s"
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
                'id': row['id'],
                'gravidade': row['gravidade'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'texto_completo': f"Inciso {row['inciso']} ({row['gravidade']}) - {row['texto']}"
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
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if termo:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM infracoes_estatuto_art29 
                WHERE ativo = TRUE 
                AND (inciso ILIKE %s OR texto ILIKE %s)
                ORDER BY 
                    CASE 
                        WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
                LIMIT 50
            """, (f'%{termo}%', f'%{termo}%'))
        else:
            cursor.execute("""
                SELECT id, inciso, texto
                FROM infracoes_estatuto_art29 
                WHERE ativo = TRUE
                ORDER BY 
                    CASE 
                        WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso)
                        ELSE 999
                    END,
                    inciso
                LIMIT 50
            """)
        
        infracoes = []
        for row in cursor.fetchall():
            infracoes.append({
                'id': row['id'],
                'inciso': row['inciso'],
                'texto': row['texto'],
                'texto_completo': f"Inciso {row['inciso']} - {row['texto']}"
            })
        
        conn.close()
        
        return {"sucesso": True, "infracoes": infracoes}
        
    except Exception as e:
        print(f"❌ Erro ao buscar infrações Art. 29: {e}")
        return {"sucesso": False, "mensagem": f"Erro ao buscar infrações: {str(e)}"}

# ===============================
# GERAÇÃO DE MAPA MENSAL
# ===============================

@eel.expose
def gerar_mapa_mensal(mes, ano, tipo_processo):
    """Gera o mapa mensal para um tipo específico de processo/procedimento"""
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
        # Regra: 
        # - Processos EM ANDAMENTO: instaurados até o mês selecionado (inclusive)
        # - Processos CONCLUÍDOS: concluídos especificamente no mês selecionado
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

@eel.expose
def gerar_mapa_completo(mes, ano):
    """Gera mapa mensal completo com todos os tipos de processo/procedimento"""
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
                resultado = gerar_mapa_mensal(mes, ano, tipo_detalhe)
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

@eel.expose
def salvar_mapa_mensal(dados_mapa, usuario_id=None):
    """Salva um mapa mensal gerado para acesso posterior"""
    g = _guard_login()
    if g: return g
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Obter informações do usuário logado se não fornecido
        if not usuario_id:
            resultado_usuario = obter_usuario_logado()
            if not resultado_usuario or not resultado_usuario.get("logado"):
                return {"sucesso": False, "mensagem": "Usuário não logado"}
            
            usuario_dados = resultado_usuario.get("usuario", {})
            usuario_id = usuario_dados.get("id")
            usuario_nome = usuario_dados.get("nome")
            
            if not usuario_id:
                return {"sucesso": False, "mensagem": "ID do usuário não encontrado"}
        else:
            # Buscar nome do usuário
            cursor.execute("SELECT nome FROM usuarios WHERE id = %s", (usuario_id,))
            resultado = cursor.fetchone()
            if not resultado:
                return {"sucesso": False, "mensagem": "Usuário não encontrado"}
            usuario_nome = resultado['nome']
        
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

@eel.expose
def listar_mapas_anteriores():
    """Lista todos os mapas salvos anteriormente"""
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

@eel.expose
def obter_dados_mapa_salvo(mapa_id):
    """Obtém os dados completos de um mapa salvo para regenerar o PDF"""
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
                import json
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

@eel.expose
def excluir_mapa_salvo(mapa_id):
    """Exclui um mapa salvo (soft delete)"""
    g = _guard_login()
    if g: return g
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

@eel.expose
def obter_anos_relatorio_anual():
    """Obtém lista de anos que possuem processos/procedimentos instaurados"""
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

@eel.expose
def gerar_relatorio_anual(ano):
    """Gera relatório anual completo com estatísticas e gráficos em PDF"""
    import base64
    from datetime import datetime
    from io import BytesIO
    
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
        
        # Indícios (crime vs transgressão) - agora usando JSONB (sem cast) via funções JSONB
        # Contagem de registros com 'crime' em indicios_categorias (array JSONB)
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

def _gerar_pdf_relatorio_anual(estatisticas):
    """Gera o PDF do relatório anual usando ReportLab"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    import base64
    from io import BytesIO
    from datetime import datetime
    import os
    
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
    """Obtém lista de PMs envolvidos para o mapa mensal"""
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
                        import json
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
    """Obtém indícios específicos de um PM envolvido"""
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
                    import json
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
    """Obtém indícios de crimes e transgressões para o mapa mensal"""
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
            # PostgreSQL não tem PRAGMA, então vamos assumir que a coluna é art29_id
            # Se houver erro, será capturado no except
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
    """Obtém a última movimentação de um processo em andamento"""
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
                    import json
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

@eel.expose
def obter_tipos_processo_para_mapa():
    """Obtém lista de tipos de processo/procedimento disponíveis para o mapa mensal"""
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

if __name__ == "__main__":
    main()
