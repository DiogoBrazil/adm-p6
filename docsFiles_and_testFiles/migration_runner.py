#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Executor de Migrações para o Sistema ADM-P6
Executa scripts de migração de forma sequencial e segura
"""

import os
import sqlite3
import sys
from pathlib import Path
import datetime

class MigrationRunner:
    """Executor de migrações do banco de dados"""
    
    def __init__(self, db_path='usuarios.db'):
        self.db_path = db_path
        self.migrations_dir = Path('migrations')
        self.init_migration_table()
    
    def init_migration_table(self):
        """Inicializa tabela de controle de migrações"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name TEXT UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                execution_time_ms INTEGER,
                success BOOLEAN DEFAULT 1
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def get_executed_migrations(self):
        """Retorna lista de migrações já executadas"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT migration_name FROM schema_migrations 
            WHERE success = 1 
            ORDER BY id
        ''')
        
        executed = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return executed
    
    def get_pending_migrations(self):
        """Retorna lista de migrações pendentes"""
        if not self.migrations_dir.exists():
            print(f"❌ Diretório de migrações não encontrado: {self.migrations_dir}")
            return []
        
        # Listar arquivos SQL no diretório de migrações
        migration_files = list(self.migrations_dir.glob("*.sql"))
        migration_files.sort()
        
        executed = self.get_executed_migrations()
        
        pending = []
        for migration_file in migration_files:
            if migration_file.name not in executed:
                pending.append(migration_file)
        
        return pending
    
    def execute_migration(self, migration_file):
        """Executa uma migração específica"""
        start_time = datetime.datetime.now()
        
        try:
            print(f"🔄 Executando migração: {migration_file.name}")
            
            # Ler conteúdo do arquivo
            with open(migration_file, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # Conectar ao banco
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Habilitar foreign keys se necessário
            cursor.execute("PRAGMA foreign_keys = ON")
            
            # Executar SQL (pode conter múltiplos comandos)
            cursor.executescript(sql_content)
            
            # Calcular tempo de execução
            end_time = datetime.datetime.now()
            execution_time = int((end_time - start_time).total_seconds() * 1000)
            
            # Registrar migração como executada
            cursor.execute('''
                INSERT INTO schema_migrations (migration_name, execution_time_ms) 
                VALUES (?, ?)
            ''', (migration_file.name, execution_time))
            
            conn.commit()
            conn.close()
            
            print(f"✅ Migração executada com sucesso: {migration_file.name} ({execution_time}ms)")
            return True
            
        except Exception as e:
            # Registrar falha na migração
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                end_time = datetime.datetime.now()
                execution_time = int((end_time - start_time).total_seconds() * 1000)
                
                cursor.execute('''
                    INSERT INTO schema_migrations (migration_name, execution_time_ms, success) 
                    VALUES (?, ?, 0)
                ''', (migration_file.name, execution_time))
                
                conn.commit()
                conn.close()
            except:
                pass
            
            print(f"❌ Erro ao executar migração {migration_file.name}: {e}")
            return False
    
    def run_migrations(self):
        """Executa todas as migrações pendentes"""
        print("🚀 Verificando migrações pendentes...")
        
        pending = self.get_pending_migrations()
        
        if not pending:
            print("✅ Nenhuma migração pendente encontrada")
            return True
        
        print(f"📋 Encontradas {len(pending)} migrações pendentes:")
        for migration in pending:
            print(f"   - {migration.name}")
        
        # Confirmar execução
        response = input("\n❓ Deseja executar as migrações? (s/N): ")
        if response.lower() not in ['s', 'sim', 'y', 'yes']:
            print("⏸️  Execução cancelada pelo usuário")
            return False
        
        # Backup antes das migrações
        self.create_backup_before_migration()
        
        # Executar migrações
        success_count = 0
        for migration in pending:
            if self.execute_migration(migration):
                success_count += 1
            else:
                print(f"\n💥 Migração falhou: {migration.name}")
                print("⚠️  Execução interrompida para evitar problemas")
                break
        
        print(f"\n📊 Resultado: {success_count}/{len(pending)} migrações executadas com sucesso")
        
        if success_count == len(pending):
            print("🎉 Todas as migrações foram executadas com sucesso!")
            return True
        else:
            print("⚠️  Algumas migrações falharam. Verifique os logs.")
            return False
    
    def create_backup_before_migration(self):
        """Cria backup antes de executar migrações"""
        try:
            backup_dir = Path('backups')
            backup_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = backup_dir / f"pre_migration_backup_{timestamp}.db"
            
            # Usar VACUUM INTO para criar backup limpo
            conn = sqlite3.connect(self.db_path)
            conn.execute(f"VACUUM INTO '{backup_file}'")
            conn.close()
            
            print(f"💾 Backup criado: {backup_file}")
            
        except Exception as e:
            print(f"⚠️  Erro ao criar backup: {e}")
            response = input("❓ Continuar sem backup? (s/N): ")
            if response.lower() not in ['s', 'sim', 'y', 'yes']:
                sys.exit(1)
    
    def show_migration_status(self):
        """Mostra status das migrações"""
        print("📋 STATUS DAS MIGRAÇÕES")
        print("=" * 50)
        
        executed = self.get_executed_migrations()
        pending = self.get_pending_migrations()
        
        print(f"✅ Executadas: {len(executed)}")
        print(f"⏳ Pendentes: {len(pending)}")
        
        if executed:
            print("\n📦 Migrações Executadas:")
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT migration_name, executed_at, execution_time_ms 
                FROM schema_migrations 
                WHERE success = 1 
                ORDER BY id
            ''')
            
            for name, executed_at, exec_time in cursor.fetchall():
                print(f"   ✅ {name} - {executed_at} ({exec_time}ms)")
            
            conn.close()
        
        if pending:
            print("\n⏳ Migrações Pendentes:")
            for migration in pending:
                print(f"   ⏳ {migration.name}")
    
    def rollback_migration(self, migration_name):
        """Marca uma migração como não executada (rollback manual)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM schema_migrations 
            WHERE migration_name = ?
        ''', (migration_name,))
        
        if cursor.rowcount > 0:
            conn.commit()
            print(f"🔄 Migração marcada para re-execução: {migration_name}")
        else:
            print(f"❌ Migração não encontrada: {migration_name}")
        
        conn.close()

def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Executor de Migrações ADM-P6')
    parser.add_argument('--run', action='store_true', help='Executar migrações pendentes')
    parser.add_argument('--status', action='store_true', help='Mostrar status das migrações')
    parser.add_argument('--rollback', type=str, help='Marcar migração para re-execução')
    parser.add_argument('--db', type=str, default='usuarios.db', help='Caminho do banco de dados')
    
    args = parser.parse_args()
    
    runner = MigrationRunner(args.db)
    
    if args.run:
        runner.run_migrations()
    elif args.status:
        runner.show_migration_status()
    elif args.rollback:
        runner.rollback_migration(args.rollback)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
