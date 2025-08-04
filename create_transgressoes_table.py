#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para criar tabela de transgressões e popular com dados do RDPM
"""

import sqlite3
import re
import os

def parse_infracoes_markdown():
    """Processa o arquivo markdown e extrai as infrações organizadas por gravidade"""
    
    # Verificar se o arquivo existe
    if not os.path.exists('infracoes_rdpm.md'):
        print("❌ Arquivo infracoes_rdpm.md não encontrado!")
        return None
    
    with open('infracoes_rdpm.md', 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # Dicionário para armazenar as infrações por gravidade
    infracoes = {
        'leve': [],
        'media': [],
        'grave': []
    }
    
    current_section = None
    current_inciso = None
    current_text = ""
    
    for line in lines:
        line = line.strip()
        
        # Identificar início de seções
        if "Art. 15." in line and "leve" in line:
            current_section = 'leve'
            continue
        elif "Art. 16." in line and "média" in line:
            current_section = 'media'
            continue
        elif "Art. 17." in line and "grave" in line:
            current_section = 'grave'
            continue
        
        if current_section and line:
            # Verificar se é um novo inciso (começa com algarismo romano)
            inciso_match = re.match(r'^([IVX]+)\s*–\s*(.+)', line)
            
            if inciso_match:
                # Se já tinha um inciso anterior, salvar
                if current_inciso and current_text.strip():
                    infracoes[current_section].append({
                        'inciso': current_inciso,
                        'texto': current_text.strip().rstrip(';').strip()
                    })
                
                # Começar novo inciso
                current_inciso = inciso_match.group(1)
                current_text = inciso_match.group(2)
            else:
                # Continuar texto do inciso atual
                if current_inciso and line and not line.startswith('#'):
                    current_text += " " + line
    
    # Salvar último inciso se existir
    if current_inciso and current_text.strip() and current_section:
        infracoes[current_section].append({
            'inciso': current_inciso,
            'texto': current_text.strip().rstrip(';').strip()
        })
    
    # Limpar textos
    for gravidade in infracoes:
        for infracao in infracoes[gravidade]:
            # Normalizar espaços
            infracao['texto'] = re.sub(r'\s+', ' ', infracao['texto'])
            # Remover possíveis caracteres especiais no final
            infracao['texto'] = infracao['texto'].rstrip(';').rstrip(',').strip()
    
    print(f"🔍 Infrações processadas:")
    print(f"   - Leves: {len(infracoes['leve'])}")
    print(f"   - Médias: {len(infracoes['media'])}")
    print(f"   - Graves: {len(infracoes['grave'])}")
    
    return infracoes

def create_transgressoes_table(db_path='usuarios.db'):
    """Cria a tabela de transgressões no banco de dados"""
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Criar tabela de transgressões
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transgressoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gravidade TEXT NOT NULL CHECK(gravidade IN ('leve', 'media', 'grave')),
                inciso TEXT NOT NULL,
                texto TEXT NOT NULL,
                ativo BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(gravidade, inciso)
            )
        ''')
        
        print("✅ Tabela 'transgressoes' criada com sucesso!")
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        return False

def populate_transgressoes_table(infracoes, db_path='usuarios.db'):
    """Popula a tabela de transgressões com os dados do RDPM"""
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Limpar dados existentes (caso queira recriar)
        cursor.execute('DELETE FROM transgressoes')
        
        total_inseridas = 0
        
        for gravidade, lista_infracoes in infracoes.items():
            for infracao in lista_infracoes:
                try:
                    cursor.execute('''
                        INSERT INTO transgressoes (gravidade, inciso, texto)
                        VALUES (?, ?, ?)
                    ''', (gravidade, infracao['inciso'], infracao['texto']))
                    total_inseridas += 1
                    print(f"✅ {gravidade.title()} - {infracao['inciso']}: {infracao['texto'][:50]}...")
                except sqlite3.IntegrityError:
                    print(f"⚠️  Duplicata ignorada: {gravidade} - {infracao['inciso']}")
        
        conn.commit()
        conn.close()
        
        print(f"\n🎉 Total de {total_inseridas} transgressões inseridas com sucesso!")
        return True
        
    except Exception as e:
        print(f"❌ Erro ao popular tabela: {e}")
        return False

def add_infracao_field_to_processos():
    """Adiciona campo para ID da infração na tabela de processos"""
    
    try:
        conn = sqlite3.connect('usuarios.db')
        cursor = conn.cursor()
        
        # Verificar se a coluna já existe
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'infracao_id' not in columns:
            cursor.execute('''
                ALTER TABLE processos_procedimentos 
                ADD COLUMN infracao_id INTEGER REFERENCES transgressoes(id)
            ''')
            print("✅ Campo 'infracao_id' adicionado à tabela processos_procedimentos!")
        else:
            print("ℹ️  Campo 'infracao_id' já existe na tabela!")
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao adicionar campo: {e}")
        return False

def main():
    """Função principal"""
    print("🚀 Iniciando criação da tabela de transgressões...")
    
    # 1. Processar arquivo markdown
    print("\n📖 Processando arquivo infracoes_rdpm.md...")
    infracoes = parse_infracoes_markdown()
    
    if not infracoes:
        print("❌ Falha ao processar arquivo markdown!")
        return False
    
    # Mostrar estatísticas
    print(f"\n📊 Infrações encontradas:")
    print(f"   - Leves: {len(infracoes['leve'])}")
    print(f"   - Médias: {len(infracoes['media'])}")
    print(f"   - Graves: {len(infracoes['grave'])}")
    
    # 2. Criar tabela no banco
    print("\n🗄️  Criando tabela no banco de dados...")
    if not create_transgressoes_table():
        return False
    
    # 3. Popular tabela
    print("\n📝 Populando tabela com dados...")
    if not populate_transgressoes_table(infracoes):
        return False
    
    # 4. Adicionar campo na tabela de processos
    print("\n🔗 Adicionando campo de referência na tabela de processos...")
    if not add_infracao_field_to_processos():
        return False
    
    print("\n🎉 Script executado com sucesso!")
    print("\n📋 Próximos passos:")
    print("   1. Atualizar o formulário HTML para incluir select de infrações")
    print("   2. Atualizar o JavaScript para filtrar infrações por gravidade")
    print("   3. Atualizar as funções Python para salvar/listar infrações")
    
    return True

if __name__ == "__main__":
    main()
