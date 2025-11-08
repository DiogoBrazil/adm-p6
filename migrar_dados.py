#!/usr/bin/env python3
"""
Script de Migração de Dados: SQLite → PostgreSQL
Migra todas as tabelas e dados do banco usuarios.db para o PostgreSQL na rede

Uso:
    python migrar_dados.py [--dry-run] [--tabela NOME_TABELA]
    
Opções:
    --dry-run: Apenas mostra o que seria migrado, sem executar
    --tabela: Migra apenas uma tabela específica
"""

import sqlite3
import psycopg2
import psycopg2.extras
import sys
import argparse
from datetime import datetime
from db_config import PostgresConnectionManager, DB_CONFIG


class DataMigrator:
    """Migrador de dados SQLite para PostgreSQL"""
    
    def __init__(self, sqlite_path='usuarios.db', pg_config=None):
        """
        Inicializa o migrador
        
        Args:
            sqlite_path (str): Caminho do arquivo SQLite
            pg_config (dict): Configuração do PostgreSQL (None = usar padrão)
        """
        self.sqlite_path = sqlite_path
        self.pg_manager = PostgresConnectionManager(pg_config or DB_CONFIG)
        self.stats = {
            'tabelas_migradas': 0,
            'registros_migrados': 0,
            'erros': []
        }
    
    def get_sqlite_tables(self):
        """
        Lista todas as tabelas do SQLite
        
        Returns:
            list: Lista de nomes de tabelas
        """
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return tables
    
    def get_table_info(self, table_name):
        """
        Obtém informações sobre colunas de uma tabela SQLite
        
        Args:
            table_name (str): Nome da tabela
            
        Returns:
            list: Lista de tuplas (col_name, col_type, ...)
        """
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        info = cursor.fetchall()
        conn.close()
        return info
    
    def get_table_count(self, table_name):
        """
        Conta registros em uma tabela SQLite
        
        Args:
            table_name (str): Nome da tabela
            
        Returns:
            int: Número de registros
        """
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    
    def create_postgres_table(self, table_name, columns_info, dry_run=False):
        """
        Cria tabela no PostgreSQL baseada na estrutura SQLite
        
        Args:
            table_name (str): Nome da tabela
            columns_info (list): Info das colunas do PRAGMA table_info
            dry_run (bool): Se True, apenas mostra o SQL
            
        Returns:
            bool: True se criou/existe, False se erro
        """
        # Mapeamento de tipos SQLite → PostgreSQL
        type_mapping = {
            'INTEGER': 'INTEGER',
            'TEXT': 'TEXT',
            'REAL': 'REAL',
            'BLOB': 'BYTEA',
            'BOOLEAN': 'BOOLEAN',
            'DATE': 'DATE',
            'TIMESTAMP': 'TIMESTAMP',
            'DATETIME': 'TIMESTAMP'
        }
        
        columns = []
        for col in columns_info:
            col_name = col[1]
            col_type = col[2].upper()
            
            # Mapeia tipo
            pg_type = 'TEXT'  # Padrão
            for sqlite_type, postgres_type in type_mapping.items():
                if sqlite_type in col_type:
                    pg_type = postgres_type
                    break
            
            # Constrói definição da coluna
            col_def = f"{col_name} {pg_type}"
            
            # NOT NULL
            if col[3] == 1:  # notnull
                col_def += " NOT NULL"
            
            # DEFAULT
            if col[4] is not None:
                default_val = col[4]
                if default_val == 'CURRENT_TIMESTAMP':
                    col_def += " DEFAULT CURRENT_TIMESTAMP"
                elif isinstance(default_val, str):
                    col_def += f" DEFAULT '{default_val}'"
                else:
                    col_def += f" DEFAULT {default_val}"
            
            # PRIMARY KEY
            if col[5] == 1:  # pk
                col_def += " PRIMARY KEY"
            
            columns.append(col_def)
        
        create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} (\n    " + ",\n    ".join(columns) + "\n);"
        
        if dry_run:
            print(f"\n-- SQL para criar tabela {table_name}:")
            print(create_sql)
            return True
        
        try:
            conn = self.pg_manager.get_connection()
            cursor = conn.cursor()
            cursor.execute(create_sql)
            conn.commit()
            conn.close()
            print(f"  ✓ Tabela '{table_name}' criada/verificada no PostgreSQL")
            return True
        except Exception as e:
            print(f"  ✗ Erro ao criar tabela '{table_name}': {e}")
            self.stats['erros'].append(f"CREATE {table_name}: {e}")
            return False
    
    def migrate_table_data(self, table_name, dry_run=False):
        """
        Migra dados de uma tabela do SQLite para PostgreSQL
        
        Args:
            table_name (str): Nome da tabela
            dry_run (bool): Se True, apenas simula
            
        Returns:
            int: Número de registros migrados
        """
        # Lê dados do SQLite
        sqlite_conn = sqlite3.connect(self.sqlite_path)
        sqlite_conn.row_factory = sqlite3.Row
        sqlite_cursor = sqlite_conn.cursor()
        
        try:
            sqlite_cursor.execute(f"SELECT * FROM {table_name}")
            rows = sqlite_cursor.fetchall()
        except Exception as e:
            print(f"  ✗ Erro ao ler SQLite tabela '{table_name}': {e}")
            sqlite_conn.close()
            return 0
        
        if not rows:
            print(f"  ⚠ Tabela '{table_name}' vazia no SQLite")
            sqlite_conn.close()
            return 0
        
        # Obtém nomes das colunas
        columns = list(rows[0].keys())
        
        if dry_run:
            print(f"\n  Tabela: {table_name}")
            print(f"  Registros: {len(rows)}")
            print(f"  Colunas: {', '.join(columns)}")
            print(f"  Exemplo (primeiro registro):")
            for col in columns:
                print(f"    {col}: {rows[0][col]}")
            sqlite_conn.close()
            return len(rows)
        
        # Insere no PostgreSQL
        try:
            pg_conn = self.pg_manager.get_connection()
            pg_cursor = pg_conn.cursor()
            
            # Obtém tipos das colunas do PostgreSQL para conversão
            pg_cursor.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = %s AND table_schema = 'public'
            """, (table_name,))
            pg_columns_types = {row[0]: row[1] for row in pg_cursor.fetchall()}
            
            # Limpa tabela antes de inserir (opcional - remova se não quiser)
            # pg_cursor.execute(f"TRUNCATE TABLE {table_name} CASCADE")
            
            # Prepara INSERT
            placeholders = ', '.join(['%s'] * len(columns))
            insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
            
            # Insere em lote
            migrated = 0
            for row in rows:
                # Converte valores conforme necessário
                values = []
                for col in columns:
                    value = row[col]
                    col_type = pg_columns_types.get(col, '')
                    
                    # Converte inteiros para booleanos
                    if col_type == 'boolean' and isinstance(value, int):
                        value = bool(value)
                    
                    values.append(value)
                
                try:
                    pg_cursor.execute(insert_sql, tuple(values))
                    migrated += 1
                except Exception as e:
                    print(f"    ⚠ Erro ao inserir registro: {e}")
                    # Continua com próximo registro
            
            pg_conn.commit()
            pg_conn.close()
            sqlite_conn.close()
            
            print(f"  ✓ Migrados {migrated}/{len(rows)} registros da tabela '{table_name}'")
            return migrated
            
        except Exception as e:
            print(f"  ✗ Erro ao migrar dados da tabela '{table_name}': {e}")
            self.stats['erros'].append(f"DATA {table_name}: {e}")
            if 'pg_conn' in locals():
                pg_conn.rollback()
                pg_conn.close()
            sqlite_conn.close()
            return 0
    
    def migrate_all(self, dry_run=False, specific_table=None):
        """
        Migra todas as tabelas (ou uma específica)
        
        Args:
            dry_run (bool): Se True, apenas simula
            specific_table (str): Se fornecido, migra apenas essa tabela
        """
        print("=" * 70)
        print("MIGRAÇÃO DE DADOS: SQLite → PostgreSQL")
        print("=" * 70)
        print(f"SQLite: {self.sqlite_path}")
        print(f"PostgreSQL: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        
        if dry_run:
            print("\n⚠ MODO DRY-RUN (Simulação - não fará alterações reais)")
        
        print("\n" + "-" * 70)
        
        # Lista tabelas
        if specific_table:
            tables = [specific_table]
            print(f"Migrando tabela específica: {specific_table}\n")
        else:
            tables = self.get_sqlite_tables()
            print(f"Tabelas encontradas no SQLite: {len(tables)}\n")
        
        # Migra cada tabela
        for table_name in tables:
            print(f"\n📋 Tabela: {table_name}")
            
            # Conta registros
            try:
                count = self.get_table_count(table_name)
                print(f"  Registros no SQLite: {count}")
            except Exception as e:
                print(f"  ✗ Erro ao acessar tabela: {e}")
                continue
            
            if count == 0 and not dry_run:
                print(f"  ⚠ Tabela vazia - pulando")
                continue
            
            # Obtém estrutura
            try:
                columns_info = self.get_table_info(table_name)
            except Exception as e:
                print(f"  ✗ Erro ao obter estrutura: {e}")
                continue
            
            # Cria tabela no PostgreSQL
            if not self.create_postgres_table(table_name, columns_info, dry_run):
                continue
            
            # Migra dados
            if count > 0:
                migrated = self.migrate_table_data(table_name, dry_run)
                self.stats['registros_migrados'] += migrated
            
            self.stats['tabelas_migradas'] += 1
        
        # Relatório final
        print("\n" + "=" * 70)
        print("RELATÓRIO DE MIGRAÇÃO")
        print("=" * 70)
        print(f"Tabelas processadas: {self.stats['tabelas_migradas']}")
        print(f"Registros migrados: {self.stats['registros_migrados']}")
        
        if self.stats['erros']:
            print(f"\n⚠ Erros encontrados: {len(self.stats['erros'])}")
            for erro in self.stats['erros']:
                print(f"  - {erro}")
        else:
            print("\n✓ Migração concluída sem erros!")
        
        if dry_run:
            print("\n⚠ Lembre-se: Foi apenas uma simulação (--dry-run)")
        
        print("=" * 70)


def main():
    """Função principal do script"""
    parser = argparse.ArgumentParser(
        description='Migra dados do SQLite para PostgreSQL',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simula a migração sem fazer alterações reais'
    )
    parser.add_argument(
        '--tabela',
        type=str,
        help='Migra apenas uma tabela específica'
    )
    parser.add_argument(
        '--sqlite',
        type=str,
        default='usuarios.db',
        help='Caminho do arquivo SQLite (padrão: usuarios.db)'
    )
    
    args = parser.parse_args()
    
    # Verifica se arquivo SQLite existe
    import os
    if not os.path.exists(args.sqlite):
        print(f"✗ Arquivo SQLite não encontrado: {args.sqlite}")
        sys.exit(1)
    
    # Cria migrador e executa
    try:
        migrator = DataMigrator(sqlite_path=args.sqlite)
        migrator.migrate_all(dry_run=args.dry_run, specific_table=args.tabela)
    except KeyboardInterrupt:
        print("\n\n⚠ Migração interrompida pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Erro fatal durante migração: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
