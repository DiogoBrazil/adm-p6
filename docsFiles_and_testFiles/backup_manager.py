#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de Backup Automático para o Banco de Dados ADM-P6
Executa backups periódicos e mantém histórico de versões
"""

import sqlite3
import os
import shutil
import datetime
import zipfile
import schedule
import time
import logging
from pathlib import Path

class BackupManager:
    """Gerenciador de backup do banco de dados"""
    
    def __init__(self):
        # Configurações
        self.db_path = 'usuarios.db'
        self.backup_dir = Path('backups')
        self.max_backups = 30  # Manter últimos 30 backups
        self.setup_logging()
        self.ensure_backup_directory()
    
    def setup_logging(self):
        """Configura sistema de log"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('backup.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def ensure_backup_directory(self):
        """Garante que o diretório de backup existe"""
        self.backup_dir.mkdir(exist_ok=True)
        self.logger.info(f"Diretório de backup: {self.backup_dir.absolute()}")
    
    def create_backup(self):
        """Cria backup do banco de dados"""
        try:
            if not os.path.exists(self.db_path):
                self.logger.error(f"Banco de dados não encontrado: {self.db_path}")
                return False
            
            # Nome do arquivo de backup com timestamp
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"usuarios_backup_{timestamp}.db"
            backup_path = self.backup_dir / backup_filename
            
            # Fazer backup usando VACUUM INTO (SQLite 3.27+)
            conn = sqlite3.connect(self.db_path)
            conn.execute(f"VACUUM INTO '{backup_path}'")
            conn.close()
            
            # Criar arquivo ZIP comprimido
            zip_filename = f"usuarios_backup_{timestamp}.zip"
            zip_path = self.backup_dir / zip_filename
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(backup_path, backup_filename)
                
                # Adicionar informações do backup
                backup_info = self.get_backup_info()
                zipf.writestr('backup_info.txt', backup_info)
            
            # Remover arquivo .db não comprimido
            backup_path.unlink()
            
            self.logger.info(f"Backup criado: {zip_path}")
            
            # Limpar backups antigos
            self.cleanup_old_backups()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Erro ao criar backup: {e}")
            return False
    
    def get_backup_info(self):
        """Obtém informações do banco para incluir no backup"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Informações das tabelas
            cursor.execute("""
                SELECT name, 
                       (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as count
                FROM sqlite_master m 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """)
            tables = cursor.fetchall()
            
            info = []
            info.append(f"Backup criado em: {datetime.datetime.now()}")
            info.append(f"Versão SQLite: {sqlite3.sqlite_version}")
            info.append(f"Tamanho do arquivo: {os.path.getsize(self.db_path)} bytes")
            info.append("\nTabelas no banco:")
            
            for table_name, _ in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                info.append(f"  - {table_name}: {count} registros")
            
            # Informações de auditoria se existir
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='auditoria'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) FROM auditoria")
                audit_count = cursor.fetchone()[0]
                info.append(f"\nRegistros de auditoria: {audit_count}")
            
            conn.close()
            return '\n'.join(info)
            
        except Exception as e:
            return f"Erro ao obter informações: {e}"
    
    def cleanup_old_backups(self):
        """Remove backups antigos mantendo apenas os mais recentes"""
        try:
            # Listar todos os arquivos de backup
            backup_files = list(self.backup_dir.glob("usuarios_backup_*.zip"))
            backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            # Remover backups excedentes
            if len(backup_files) > self.max_backups:
                for old_backup in backup_files[self.max_backups:]:
                    old_backup.unlink()
                    self.logger.info(f"Backup antigo removido: {old_backup.name}")
                    
        except Exception as e:
            self.logger.error(f"Erro ao limpar backups antigos: {e}")
    
    def restore_backup(self, backup_file):
        """Restaura um backup específico"""
        try:
            backup_path = self.backup_dir / backup_file
            
            if not backup_path.exists():
                self.logger.error(f"Arquivo de backup não encontrado: {backup_file}")
                return False
            
            # Fazer backup do banco atual antes de restaurar
            current_backup = f"current_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            shutil.copy2(self.db_path, self.backup_dir / current_backup)
            
            # Extrair e restaurar
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                db_files = [f for f in zipf.namelist() if f.endswith('.db')]
                if db_files:
                    zipf.extract(db_files[0], self.backup_dir)
                    extracted_path = self.backup_dir / db_files[0]
                    shutil.move(extracted_path, self.db_path)
                    
                    self.logger.info(f"Backup restaurado: {backup_file}")
                    return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Erro ao restaurar backup: {e}")
            return False
    
    def list_backups(self):
        """Lista todos os backups disponíveis"""
        try:
            backup_files = list(self.backup_dir.glob("usuarios_backup_*.zip"))
            backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            print(f"\n📁 Backups disponíveis ({len(backup_files)}):")
            print("-" * 60)
            
            for backup_file in backup_files:
                stat = backup_file.stat()
                size = stat.st_size
                date = datetime.datetime.fromtimestamp(stat.st_mtime)
                
                print(f"📄 {backup_file.name}")
                print(f"   Data: {date.strftime('%d/%m/%Y %H:%M:%S')}")
                print(f"   Tamanho: {size:,} bytes")
                print()
                
        except Exception as e:
            self.logger.error(f"Erro ao listar backups: {e}")
    
    def start_scheduler(self):
        """Inicia o agendador de backups automáticos"""
        # Backup diário às 02:00
        schedule.every().day.at("02:00").do(self.create_backup)
        
        # Backup a cada 6 horas durante horário comercial
        schedule.every(6).hours.do(self.create_backup)
        
        self.logger.info("Agendador de backup iniciado")
        self.logger.info("- Backup diário às 02:00")
        self.logger.info("- Backup a cada 6 horas")
        
        while True:
            schedule.run_pending()
            time.sleep(60)  # Verificar a cada minuto

def main():
    """Função principal para execução standalone"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Sistema de Backup ADM-P6')
    parser.add_argument('--backup', action='store_true', help='Criar backup imediato')
    parser.add_argument('--list', action='store_true', help='Listar backups disponíveis')
    parser.add_argument('--restore', type=str, help='Restaurar backup específico')
    parser.add_argument('--schedule', action='store_true', help='Iniciar agendador automático')
    
    args = parser.parse_args()
    
    backup_manager = BackupManager()
    
    if args.backup:
        print("🔄 Criando backup...")
        success = backup_manager.create_backup()
        print("✅ Backup criado com sucesso!" if success else "❌ Erro ao criar backup")
        
    elif args.list:
        backup_manager.list_backups()
        
    elif args.restore:
        print(f"🔄 Restaurando backup: {args.restore}")
        success = backup_manager.restore_backup(args.restore)
        print("✅ Backup restaurado com sucesso!" if success else "❌ Erro ao restaurar backup")
        
    elif args.schedule:
        print("⏰ Iniciando agendador de backup...")
        backup_manager.start_scheduler()
        
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
