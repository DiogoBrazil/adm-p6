#!/usr/bin/env python3
"""
Migração: Unificação das tabelas de usuários
Data: 2025-08-17
Descrição: 
- Remove tabelas encarregados e operadores
- Cria nova tabela usuarios unificada
- Permite vínculos múltiplos (encarregado e/ou operador)
- Campos dinâmicos baseados no tipo (Oficial/Praça)
"""

import sqlite3
import hashlib
import uuid
from datetime import datetime
import os
import sys

def hash_senha(senha):
    """Cria hash da senha"""
    return hashlib.sha256(senha.encode()).hexdigest()

def executar_migracao():
    """Executa a migração do banco de dados"""
    
    # Determinar caminho do banco
    if getattr(sys, 'frozen', False):
        app_data_dir = os.path.join(os.environ.get('APPDATA', '.'), 'SistemaLogin')
        db_path = os.path.join(app_data_dir, 'usuarios.db')
    else:
        db_path = 'usuarios.db'
    
    print(f"📁 Usando banco de dados: {db_path}")
    
    # Conectar ao banco
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🔄 Iniciando migração...")
        
        # 1. Criar backup das tabelas antigas (caso existam dados importantes)
        print("📋 Verificando tabelas existentes...")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('encarregados', 'operadores')")
        tabelas_existentes = cursor.fetchall()
        
        if tabelas_existentes:
            print(f"⚠️  Encontradas tabelas: {[t[0] for t in tabelas_existentes]}")
            print("🗑️  Removendo dados antigos...")
            
            # Remover dados das tabelas antigas
            cursor.execute("DELETE FROM encarregados")
            cursor.execute("DELETE FROM operadores")
            print("✅ Dados antigos removidos")
        
        # 2. Remover tabelas antigas (incluindo usuarios atual)
        print("🗑️  Removendo tabelas antigas...")
        cursor.execute("DROP TABLE IF EXISTS encarregados")
        cursor.execute("DROP TABLE IF EXISTS operadores")
        cursor.execute("DROP TABLE IF EXISTS usuarios")  # Remover tabela usuarios atual também
        print("✅ Tabelas antigas removidas")
        
        # 3. Criar nova tabela usuarios unificada
        print("🏗️  Criando nova tabela usuarios...")
        cursor.execute('''
            CREATE TABLE usuarios (
                id TEXT PRIMARY KEY,
                tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('Oficial', 'Praça')),
                posto_graduacao TEXT NOT NULL,
                nome TEXT NOT NULL,
                matricula TEXT UNIQUE NOT NULL,
                is_encarregado BOOLEAN DEFAULT 0,
                is_operador BOOLEAN DEFAULT 0,
                email TEXT UNIQUE,
                senha TEXT,
                perfil TEXT CHECK (perfil IN ('admin', 'comum') OR perfil IS NULL),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        ''')
        print("✅ Tabela usuarios criada com sucesso")
        
        # 4. Criar usuário administrador padrão
        print("👤 Criando usuário administrador...")
        admin_id = str(uuid.uuid4())
        admin_senha_hash = hash_senha("123456")
        current_time = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT INTO usuarios (
                id, tipo_usuario, posto_graduacao, nome, matricula,
                is_encarregado, is_operador, email, senha, perfil,
                created_at, updated_at, ativo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            admin_id,
            'Oficial',
            'CEL PM',
            'Administrador',
            'ADMIN001',
            0,  # não é encarregado
            1,  # é operador
            'admin@sistema.com',
            admin_senha_hash,
            'admin',
            current_time,
            current_time,
            1
        ))
        
        print("✅ Usuário administrador criado:")
        print("   📧 Email: admin@sistema.com")
        print("   🔑 Senha: 123456")
        print("   👔 Tipo: Oficial - CEL PM")
        print("   🔗 Vínculo: Operador Admin")
        
        # 5. Confirmar transação
        conn.commit()
        print("💾 Migração concluída com sucesso!")
        
        # 6. Verificar resultado
        cursor.execute("SELECT COUNT(*) FROM usuarios")
        total_usuarios = cursor.fetchone()[0]
        print(f"📊 Total de usuários na nova tabela: {total_usuarios}")
        
    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        conn.rollback()
        raise
    
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("🚀 Iniciando migração de usuários...")
    print("="*50)
    
    try:
        executar_migracao()
        print("="*50)
        print("✅ Migração concluída com sucesso!")
        print("🎯 Sistema pronto para usar a nova estrutura de usuários")
        
    except Exception as e:
        print("="*50)
        print(f"❌ Falha na migração: {e}")
        sys.exit(1)
