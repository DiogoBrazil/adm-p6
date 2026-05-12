"""
Módulo de configuração e conexão com PostgreSQL
Substituindo SQLite por PostgreSQL com tratamento robusto de erros
"""
import psycopg2
import psycopg2.extras
from psycopg2 import OperationalError, DatabaseError
import sys
import os

# Configurações do Banco de Dados PostgreSQL (env tem prioridade)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', '0.0.0.0'),
    'port': int(os.getenv('DB_PORT', 5438)),
    'database': os.getenv('DB_NAME', 'adm_p6_db'),
    'user': os.getenv('DB_USER', 'adm_p6_user'),
    'password': os.getenv('DB_PASSWORD', 'adm_p6_password'),
}


class PostgresConnectionManager:
    """Gerenciador de conexão PostgreSQL com tratamento robusto de erros"""
    
    def __init__(self, config=None):
        """
        Inicializa o gerenciador de conexão
        
        Args:
            config (dict): Dicionário com configurações de conexão.
                          Se None, usa DB_CONFIG padrão.
        """
        self.config = config or DB_CONFIG
        self._test_connection()
    
    def _test_connection(self):
        """Testa a conexão ao inicializar e fornece feedback detalhado"""
        try:
            conn = self.get_connection()
            conn.close()
            print(f"✓ Conexão PostgreSQL estabelecida com sucesso!")
            print(f"  Host: {self.config['host']}:{self.config['port']}")
            print(f"  Database: {self.config['database']}")
        except OperationalError as e:
            error_msg = self._format_connection_error(e)
            print(f"✗ ERRO DE CONEXÃO PostgreSQL:\n{error_msg}", file=sys.stderr)
            raise
        except Exception as e:
            print(f"✗ ERRO INESPERADO ao conectar PostgreSQL: {e}", file=sys.stderr)
            raise
    
    def _format_connection_error(self, error):
        """Formata mensagem de erro de conexão de forma amigável"""
        error_str = str(error).lower()
        
        if 'could not connect' in error_str or 'connection refused' in error_str:
            return (
                f"🔴 Não foi possível conectar ao servidor PostgreSQL\n"
                f"   Host: {self.config['host']}:{self.config['port']}\n"
                f"   Verifique:\n"
                f"   - O servidor PostgreSQL está rodando?\n"
                f"   - O IP {self.config['host']} está correto?\n"
                f"   - A porta {self.config['port']} está acessível?\n"
                f"   - Há firewall bloqueando a conexão?\n"
                f"\n   Erro técnico: {error}"
            )
        elif 'password authentication failed' in error_str:
            return (
                f"🔑 Falha na autenticação\n"
                f"   Usuário: {self.config['user']}\n"
                f"   Verifique:\n"
                f"   - A senha está correta?\n"
                f"   - O usuário '{self.config['user']}' existe no PostgreSQL?\n"
                f"   - O usuário tem permissões adequadas?\n"
                f"\n   Erro técnico: {error}"
            )
        elif 'database' in error_str and 'does not exist' in error_str:
            return (
                f"📦 Banco de dados não encontrado\n"
                f"   Database: {self.config['database']}\n"
                f"   Verifique:\n"
                f"   - O banco '{self.config['database']}' foi criado no servidor?\n"
                f"   - O nome está escrito corretamente?\n"
                f"\n   Erro técnico: {error}"
            )
        elif 'timeout' in error_str:
            return (
                f"⏱️ Timeout na conexão\n"
                f"   Host: {self.config['host']}:{self.config['port']}\n"
                f"   Verifique:\n"
                f"   - A rede está funcionando?\n"
                f"   - O servidor está respondendo?\n"
                f"   - Não há problemas de latência?\n"
                f"\n   Erro técnico: {error}"
            )
        else:
            return (
                f"❌ Erro de conexão PostgreSQL\n"
                f"   Host: {self.config['host']}:{self.config['port']}\n"
                f"   Database: {self.config['database']}\n"
                f"   User: {self.config['user']}\n"
                f"\n   Erro técnico: {error}"
            )
    
    def get_connection(self):
        """
        Retorna uma nova conexão PostgreSQL
        
        Returns:
            psycopg2.connection: Conexão ativa ao PostgreSQL
            
        Raises:
            OperationalError: Se não conseguir conectar ao servidor
            DatabaseError: Se houver erro no banco de dados
        """
        try:
            conn = psycopg2.connect(**self.config)
            # Usa DictCursor para resultados como dicionários (similar ao SQLite row_factory)
            return conn
        except OperationalError as e:
            error_msg = self._format_connection_error(e)
            # Em aplicação Eel, você pode usar eel.js para mostrar alerta
            print(f"\n{error_msg}\n", file=sys.stderr)
            raise
        except DatabaseError as e:
            print(f"✗ Erro no banco de dados: {e}", file=sys.stderr)
            raise
        except Exception as e:
            print(f"✗ Erro inesperado: {e}", file=sys.stderr)
            raise
    
    def get_dict_cursor(self, conn):
        """
        Retorna um cursor que retorna resultados como dicionários
        
        Args:
            conn: Conexão PostgreSQL ativa
            
        Returns:
            psycopg2.extras.DictCursor: Cursor configurado
        """
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    def execute_query(self, query, params=None, fetch=True):
        """
        Executa uma query SQL e retorna resultados
        
        Args:
            query (str): Query SQL a executar
            params (tuple): Parâmetros da query (usa %s como placeholder)
            fetch (bool): Se True, retorna resultados (SELECT); se False, apenas executa (INSERT/UPDATE/DELETE)
            
        Returns:
            list: Lista de dicionários com resultados (se fetch=True)
            int: Número de linhas afetadas (se fetch=False)
        """
        conn = None
        try:
            conn = self.get_connection()
            cursor = self.get_dict_cursor(conn)
            
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if fetch:
                results = cursor.fetchall()
                return [dict(row) for row in results]
            else:
                conn.commit()
                return cursor.rowcount
                
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"✗ Erro ao executar query: {e}", file=sys.stderr)
            print(f"   Query: {query[:100]}...", file=sys.stderr)
            raise
        finally:
            if conn:
                conn.close()
    
    def test_connection_silent(self):
        """
        Testa conexão silenciosamente (sem prints)
        
        Returns:
            tuple: (success: bool, error_message: str ou None)
        """
        try:
            conn = self.get_connection()
            conn.close()
            return (True, None)
        except Exception as e:
            return (False, str(e))


# Instância global do gerenciador (será usada em todo o app)
# Você pode inicializar isso no main.py após importar
pg_manager = None

def init_postgres_manager(config=None):
    """
    Inicializa o gerenciador PostgreSQL global
    
    Args:
        config (dict): Configuração customizada (opcional)
    
    Returns:
        PostgresConnectionManager: Instância do gerenciador
    """
    global pg_manager
    pg_manager = PostgresConnectionManager(config)
    return pg_manager


def get_pg_connection():
    """
    Retorna uma conexão PostgreSQL usando o gerenciador global
    
    Returns:
        psycopg2.connection: Conexão ativa
    """
    if pg_manager is None:
        raise RuntimeError("PostgreSQL manager não inicializado! Chame init_postgres_manager() primeiro.")
    return pg_manager.get_connection()


# Exemplo de uso:
if __name__ == '__main__':
    # Teste de conexão
    print("Testando conexão PostgreSQL...")
    try:
        manager = PostgresConnectionManager()
        print("\n✓ Teste bem-sucedido!")
        
        # Exemplo de query
        result = manager.execute_query("SELECT version();")
        print(f"\nVersão PostgreSQL: {result[0]['version']}")
        
    except Exception as e:
        print(f"\n✗ Teste falhou!")
        sys.exit(1)
