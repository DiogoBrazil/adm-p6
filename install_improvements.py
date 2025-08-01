#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Instalação das Melhorias do Sistema ADM-P6
Instala dependências e executa migrações automaticamente
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Executa comando e trata erros"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} - Concluído")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - Erro: {e}")
        if e.stdout:
            print(f"Output: {e.stdout}")
        if e.stderr:
            print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Verifica se a versão do Python é compatível"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8+ é necessário")
        return False
    
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} detectado")
    return True

def install_dependencies():
    """Instala dependências do requirements.txt"""
    if not os.path.exists('requirements.txt'):
        print("❌ Arquivo requirements.txt não encontrado")
        return False
    
    # Atualizar pip primeiro
    if not run_command(f"{sys.executable} -m pip install --upgrade pip", 
                      "Atualizando pip"):
        return False
    
    # Instalar dependências
    if not run_command(f"{sys.executable} -m pip install -r requirements.txt", 
                      "Instalando dependências"):
        return False
    
    return True

def create_directories():
    """Cria diretórios necessários"""
    directories = ['backups', 'logs', 'migrations']
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"📁 Diretório criado: {directory}")
    
    return True

def run_migrations():
    """Executa migrações do banco de dados"""
    if not os.path.exists('migration_runner.py'):
        print("⚠️  migration_runner.py não encontrado - pulando migrações")
        return True
    
    print("🔄 Executando migrações do banco de dados...")
    
    # Mostrar status primeiro
    run_command(f"{sys.executable} migration_runner.py --status", 
               "Verificando status das migrações")
    
    # Executar migrações automaticamente
    try:
        import sqlite3
        
        # Verificar se há migrações pendentes
        from migration_runner import MigrationRunner
        runner = MigrationRunner()
        pending = runner.get_pending_migrations()
        
        if pending:
            print(f"📋 {len(pending)} migrações pendentes encontradas")
            
            # Em modo automático, criar backup e executar
            runner.create_backup_before_migration()
            
            success_count = 0
            for migration in pending:
                if runner.execute_migration(migration):
                    success_count += 1
                else:
                    print(f"❌ Falha na migração: {migration.name}")
                    break
            
            if success_count == len(pending):
                print("✅ Todas as migrações executadas com sucesso")
                return True
            else:
                print("⚠️  Algumas migrações falharam")
                return False
        else:
            print("✅ Nenhuma migração pendente")
            return True
            
    except Exception as e:
        print(f"❌ Erro ao executar migrações: {e}")
        return False

def verify_installation():
    """Verifica se a instalação foi bem-sucedida"""
    print("\n🔍 Verificando instalação...")
    
    # Verificar dependências críticas
    try:
        import bcrypt
        print("✅ bcrypt instalado")
    except ImportError:
        print("❌ bcrypt não encontrado")
        return False
    
    try:
        import schedule
        print("✅ schedule instalado")
    except ImportError:
        print("❌ schedule não encontrado")
        return False
    
    # Verificar banco de dados
    try:
        import sqlite3
        if os.path.exists('usuarios.db'):
            conn = sqlite3.connect('usuarios.db')
            cursor = conn.cursor()
            
            # Verificar tabelas principais
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('encarregados', 'operadores', 'processos_procedimentos')
            """)
            
            tables = cursor.fetchall()
            if len(tables) == 3:
                print("✅ Banco de dados verificado")
            else:
                print(f"⚠️  Apenas {len(tables)}/3 tabelas principais encontradas")
            
            conn.close()
        else:
            print("⚠️  Banco de dados será criado na primeira execução")
            
    except Exception as e:
        print(f"❌ Erro ao verificar banco: {e}")
        return False
    
    return True

def main():
    """Função principal de instalação"""
    print("🚀 INSTALAÇÃO DAS MELHORIAS DO SISTEMA ADM-P6")
    print("=" * 50)
    
    steps = [
        ("Verificando versão do Python", check_python_version),
        ("Criando diretórios necessários", create_directories),
        ("Instalando dependências", install_dependencies),
        ("Executando migrações do banco", run_migrations),
        ("Verificando instalação", verify_installation)
    ]
    
    success_count = 0
    for description, function in steps:
        print(f"\n📋 {description}")
        print("-" * 30)
        
        if function():
            success_count += 1
        else:
            print(f"\n💥 Falha na etapa: {description}")
            break
    
    print(f"\n📊 RESULTADO DA INSTALAÇÃO")
    print("=" * 30)
    print(f"Etapas concluídas: {success_count}/{len(steps)}")
    
    if success_count == len(steps):
        print("\n🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!")
        print("\n📝 Próximos passos:")
        print("   1. Execute 'python main.py' para iniciar o sistema")
        print("   2. Configure backup automático com 'python backup_manager.py --schedule'")
        print("   3. Teste as novas funcionalidades de segurança")
        
        # Mostrar informações importantes
        print("\n🔐 MELHORIAS IMPLEMENTADAS:")
        print("   ✅ Hashing bcrypt para senhas")
        print("   ✅ Foreign Keys para integridade")
        print("   ✅ Índices para performance")
        print("   ✅ Tabelas de referência")
        print("   ✅ Sistema de auditoria")
        print("   ✅ Backup automático")
        
    else:
        print("\n❌ INSTALAÇÃO INCOMPLETA")
        print("   Verifique os erros acima e execute novamente")
        print("   Para instalação manual:")
        print("   1. pip install -r requirements.txt")
        print("   2. python migration_runner.py --run")
        
        return False
    
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏸️  Instalação cancelada pelo usuário")
    except Exception as e:
        print(f"\n💥 Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
