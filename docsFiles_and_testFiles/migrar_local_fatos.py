#!/usr/bin/env python3
"""
Migration: Adicionar campo "Local dos Fatos" aos processos/procedimentos
Autor: Sistema
Data: 2025-08-05

Descrição:
- Cria tabela 'municipios_distritos' com todos os municípios e distritos de RO
- Adiciona coluna 'local_fatos' na tabela 'processos_procedimentos'
- Define valor padrão 'Ariquemes' para registros existentes
- Popula a tabela com dados do arquivo municipios_e_distritos_rondonia.md
"""

import sqlite3
import os
import sys
from datetime import datetime
import uuid

def criar_backup(db_path):
    """Cria backup do banco antes da migração"""
    backup_dir = 'backups'
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(backup_dir, f'pre_local_fatos_migration_{timestamp}.db')
    
    import shutil
    shutil.copy2(db_path, backup_path)
    print(f"✅ Backup criado: {backup_path}")
    return backup_path

def executar_migracao():
    """Executa a migração completa"""
    db_path = 'usuarios.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return False
    
    # Criar backup
    backup_path = criar_backup(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Iniciando migração...")
        
        # 1. Criar tabela municipios_distritos
        print("📝 Criando tabela municipios_distritos...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS municipios_distritos (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                tipo TEXT NOT NULL CHECK (tipo IN ('municipio', 'distrito')),
                municipio_pai TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        """)
        
        # 2. Popular tabela com dados dos municípios e distritos
        print("📍 Populando tabela com municípios e distritos de RO...")
        
        municipios_distritos = [
            # Municípios e seus distritos (ajustados para evitar duplicações)
            ('Alta Floresta D\'Oeste', 'municipio', None),
            ('Filadélfia D\'Oeste', 'distrito', 'Alta Floresta D\'Oeste'),
            ('Izidolândia', 'distrito', 'Alta Floresta D\'Oeste'),
            ('Nova Gease D\'Oeste', 'distrito', 'Alta Floresta D\'Oeste'),
            ('Rolim de Moura do Guaporé', 'distrito', 'Alta Floresta D\'Oeste'),
            ('Santo Antônio D\'Oeste', 'distrito', 'Alta Floresta D\'Oeste'),
            ('Alto Alegre dos Parecis', 'municipio', None),
            ('Alto Paraíso', 'municipio', None),
            ('Alvorada D\'Oeste', 'municipio', None),
            ('Tancredópolis', 'distrito', 'Alvorada D\'Oeste'),
            ('Terra Boa', 'distrito', 'Alvorada D\'Oeste'),
            ('Ariquemes', 'municipio', None),
            ('Bom Futuro', 'distrito', 'Ariquemes'),
            ('Joelândia', 'distrito', 'Ariquemes'),
            ('Buritis', 'municipio', None),
            ('Cabixi', 'municipio', None),
            ('Cacaulândia', 'municipio', None),
            ('Cacoal', 'municipio', None),
            ('Riozinho', 'distrito', 'Cacoal'),
            ('Divinópolis', 'distrito', 'Cacoal'),
            ('Campo Novo de Rondônia', 'municipio', None),
            ('Rio Branco', 'distrito', 'Campo Novo de Rondônia'),
            ('Três Coqueiros', 'distrito', 'Campo Novo de Rondônia'),
            ('Candeias do Jamari', 'municipio', None),
            ('Rio Preto do Candeias', 'distrito', 'Candeias do Jamari'),
            ('Castanheiras', 'municipio', None),
            ('Jardinópolis', 'distrito', 'Castanheiras'),
            ('Cerejeiras', 'municipio', None),
            ('Chupinguaia', 'municipio', None),
            ('Boa Esperança', 'distrito', 'Chupinguaia'),
            ('Novo Plano', 'distrito', 'Chupinguaia'),
            ('Colorado do Oeste', 'municipio', None),
            ('Corumbiara', 'municipio', None),
            ('Costa Marques', 'municipio', None),
            ('Príncipe da Beira', 'distrito', 'Costa Marques'),
            ('Cujubim', 'municipio', None),
            ('Espigão D\'Oeste', 'municipio', None),
            ('Boa Vista do Pacarana', 'distrito', 'Espigão D\'Oeste'),
            ('Flor da Serra', 'distrito', 'Espigão D\'Oeste'),
            ('Nova Esperança - Espigão', 'distrito', 'Espigão D\'Oeste'),
            ('Novo Paraíso - Espigão', 'distrito', 'Espigão D\'Oeste'),
            ('Governador Jorge Teixeira', 'municipio', None),
            ('Colina Verde', 'distrito', 'Governador Jorge Teixeira'),
            ('Guajará-Mirim', 'municipio', None),
            ('Iata', 'distrito', 'Guajará-Mirim'),
            ('Surpresa', 'distrito', 'Guajará-Mirim'),
            ('Itapuã do Oeste', 'municipio', None),
            ('Jaru', 'municipio', None),
            ('Bom Jesus', 'distrito', 'Jaru'),
            ('Santa Cruz da Serra', 'distrito', 'Jaru'),
            ('Tarilândia', 'distrito', 'Jaru'),
            ('Ji-Paraná', 'municipio', None),
            ('Nova Colina', 'distrito', 'Ji-Paraná'),
            ('Nova Londrina', 'distrito', 'Ji-Paraná'),
            ('Machadinho D\'Oeste', 'municipio', None),
            ('Oriente Novo', 'distrito', 'Machadinho D\'Oeste'),
            ('Quinto Bec', 'distrito', 'Machadinho D\'Oeste'),
            ('Tabajara', 'distrito', 'Machadinho D\'Oeste'),
            ('Ministro Andreazza', 'municipio', None),
            ('Mirante da Serra', 'municipio', None),
            ('Monte Negro', 'municipio', None),
            ('Nova Brasilândia D\'Oeste', 'municipio', None),
            ('Nova Mamoré', 'municipio', None),
            ('Araras', 'distrito', 'Nova Mamoré'),
            ('Jacynópolis', 'distrito', 'Nova Mamoré'),
            ('Nova Dimensão', 'distrito', 'Nova Mamoré'),
            ('Palmeiras', 'distrito', 'Nova Mamoré'),
            ('Nova União', 'municipio', None),
            ('Novo Horizonte do Oeste', 'municipio', None),
            ('Migrantinópolis', 'distrito', 'Novo Horizonte do Oeste'),
            ('Ouro Preto do Oeste', 'municipio', None),
            ('Rondominas', 'distrito', 'Ouro Preto do Oeste'),
            ('Parecis', 'municipio', None),
            ('Pimenta Bueno', 'municipio', None),
            ('Marco Rondon', 'distrito', 'Pimenta Bueno'),
            ('Pimenteiras do Oeste', 'municipio', None),
            ('Porto Velho', 'municipio', None),
            ('Abunã', 'distrito', 'Porto Velho'),
            ('Calama', 'distrito', 'Porto Velho'),
            ('Demarcação', 'distrito', 'Porto Velho'),
            ('Extrema', 'distrito', 'Porto Velho'),
            ('Fortaleza do Abunã', 'distrito', 'Porto Velho'),
            ('Jaci-Paraná', 'distrito', 'Porto Velho'),
            ('Mutum-Paraná', 'distrito', 'Porto Velho'),
            ('Nazaré', 'distrito', 'Porto Velho'),
            ('Nova Califórnia', 'distrito', 'Porto Velho'),
            ('São Carlos', 'distrito', 'Porto Velho'),
            ('Vista Alegre do Abunã', 'distrito', 'Porto Velho'),
            ('Presidente Médici', 'municipio', None),
            ('Estrela de Rondônia', 'distrito', 'Presidente Médici'),
            ('Novo Riachuelo', 'distrito', 'Presidente Médici'),
            ('Vila Bandeira Branca', 'distrito', 'Presidente Médici'),
            ('Vila Camargo', 'distrito', 'Presidente Médici'),
            ('Primavera de Rondônia', 'municipio', None),
            ('Rio Crespo', 'municipio', None),
            ('Rolim de Moura', 'municipio', None),
            ('Nova Estrela de Rondônia', 'distrito', 'Rolim de Moura'),
            ('Santa Luzia D\'Oeste', 'municipio', None),
            ('Barra de Camaratuba', 'distrito', 'Santa Luzia D\'Oeste'),
            ('São Felipe D\'Oeste', 'municipio', None),
            ('Novo Paraíso - São Felipe', 'distrito', 'São Felipe D\'Oeste'),
            ('São Francisco do Guaporé', 'municipio', None),
            ('São Miguel do Guaporé', 'municipio', None),
            ('Santana do Guaporé', 'distrito', 'São Miguel do Guaporé'),
            ('Seringueiras', 'municipio', None),
            ('Teixeirópolis', 'municipio', None),
            ('Theobroma', 'municipio', None),
            ('Urupá', 'municipio', None),
            ('Vale do Anari', 'municipio', None),
            ('Vale do Paraíso', 'municipio', None),
            ('Vilhena', 'municipio', None),
            ('Nova Conquista', 'distrito', 'Vilhena')
        ]
        
        # Verificar se já existem dados na tabela
        cursor.execute("SELECT COUNT(*) FROM municipios_distritos")
        count = cursor.fetchone()[0]
        
        if count == 0:
            for nome, tipo, municipio_pai in municipios_distritos:
                municipio_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT OR IGNORE INTO municipios_distritos (id, nome, tipo, municipio_pai)
                    VALUES (?, ?, ?, ?)
                """, (municipio_id, nome, tipo, municipio_pai))
            
            print(f"   ✅ Inseridos {len(municipios_distritos)} municípios/distritos")
        else:
            print(f"   ⚠️ Tabela já contém {count} registros - pulando inserção")
        
        # 3. Verificar se coluna local_fatos já existe
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'local_fatos' not in columns:
            print("📝 Adicionando coluna local_fatos...")
            cursor.execute("""
                ALTER TABLE processos_procedimentos 
                ADD COLUMN local_fatos TEXT DEFAULT 'Ariquemes'
            """)
            
            # 4. Atualizar registros existentes com valor padrão
            cursor.execute("""
                UPDATE processos_procedimentos 
                SET local_fatos = 'Ariquemes' 
                WHERE local_fatos IS NULL
            """)
            
            affected_rows = cursor.rowcount
            print(f"   ✅ Atualizados {affected_rows} registros com valor padrão 'Ariquemes'")
        else:
            print("   ⚠️ Coluna local_fatos já existe - pulando criação")
        
        # 5. Verificar dados finais
        cursor.execute("SELECT COUNT(*) FROM municipios_distritos")
        total_municipios = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos WHERE ativo = 1")
        total_processos = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        print("\n🎉 Migração concluída com sucesso!")
        print(f"   📍 Total de municípios/distritos: {total_municipios}")
        print(f"   📋 Total de processos ativos: {total_processos}")
        print(f"   💾 Backup salvo em: {backup_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        print(f"   Restaure o backup se necessário: {backup_path}")
        return False

if __name__ == "__main__":
    print("🔄 Migração: Adicionar campo Local dos Fatos")
    print("=" * 50)
    
    sucesso = executar_migracao()
    
    if sucesso:
        print("\n✅ Migração executada com sucesso!")
        sys.exit(0)
    else:
        print("\n❌ Falha na migração!")
        sys.exit(1)
