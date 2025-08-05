#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Migration 012: Ajustar constraints de unicidade para incluir local de origem
- Remove constraint atual: UNIQUE(numero, documento_iniciador, ano_instauracao)
- Adiciona nova constraint: UNIQUE(numero, documento_iniciador, ano_instauracao, local_origem)
- Adiciona constraint para número de controle: UNIQUE(numero_controle, ano_instauracao, local_origem)
"""

import sqlite3
import os
import shutil
from datetime import datetime

def fazer_backup(db_path):
    """Cria backup do banco antes da migração"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(os.path.dirname(db_path), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f"pre_migration_012_backup_{timestamp}.db")
    shutil.copy2(db_path, backup_path)
    print(f"📁 Backup criado: {backup_path}")
    return backup_path

def executar_migracao(db_path):
    """Executa a migração 012"""
    print("🔄 Iniciando Migração 012: Ajustar constraints de unicidade completas")
    
    # Fazer backup
    backup_path = fazer_backup(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("📊 Verificando estado atual...")
        
        # Verificar se a tabela existe
        cursor.execute("""
            SELECT COUNT(*) FROM sqlite_master 
            WHERE type='table' AND name='processos_procedimentos'
        """)
        if cursor.fetchone()[0] == 0:
            raise Exception("Tabela processos_procedimentos não encontrada!")
        
        # Verificar estrutura atual
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        colunas = {col[1]: col for col in cursor.fetchall()}
        
        campos_necessarios = ['numero', 'documento_iniciador', 'ano_instauracao', 'local_origem', 'numero_controle']
        for campo in campos_necessarios:
            if campo not in colunas:
                raise Exception(f"Campo {campo} não encontrado na tabela!")
        
        print("✅ Verificação de estrutura concluída")
        
        # Contar registros antes
        cursor.execute("SELECT COUNT(*) FROM processos_procedimentos")
        total_antes = cursor.fetchone()[0]
        print(f"📊 Total de registros antes: {total_antes}")
        
        # Verificar se existem conflitos com a nova constraint
        print("🔍 Verificando possíveis conflitos...")
        
        # Conflitos no número principal
        cursor.execute("""
            SELECT numero, documento_iniciador, ano_instauracao, local_origem, COUNT(*) as total
            FROM processos_procedimentos
            WHERE ativo = 1
            GROUP BY numero, documento_iniciador, ano_instauracao, local_origem
            HAVING COUNT(*) > 1
        """)
        conflitos_numero = cursor.fetchall()
        
        if conflitos_numero:
            print("⚠️  CONFLITOS ENCONTRADOS - NÚMERO PRINCIPAL:")
            for conflito in conflitos_numero:
                print(f"   - Número {conflito[0]} ({conflito[1]}) {conflito[2]} {conflito[3]}: {conflito[4]} registros")
            raise Exception("Existem conflitos que impedem a migração. Resolva manualmente primeiro.")
        
        # Conflitos no número de controle
        cursor.execute("""
            SELECT numero_controle, documento_iniciador, ano_instauracao, local_origem, COUNT(*) as total
            FROM processos_procedimentos
            WHERE ativo = 1 AND numero_controle IS NOT NULL AND numero_controle != ''
            GROUP BY numero_controle, documento_iniciador, ano_instauracao, local_origem
            HAVING COUNT(*) > 1
        """)
        conflitos_controle = cursor.fetchall()
        
        if conflitos_controle:
            print("⚠️  CONFLITOS ENCONTRADOS - NÚMERO DE CONTROLE:")
            for conflito in conflitos_controle:
                print(f"   - Controle {conflito[0]} ({conflito[1]}) {conflito[2]} {conflito[3]}: {conflito[4]} registros")
            raise Exception("Existem conflitos no número de controle que impedem a migração.")
        
        print("✅ Nenhum conflito encontrado")
        
        # Iniciar transação para migração
        cursor.execute("BEGIN TRANSACTION")
        
        try:
            # Passo 1: Criar nova tabela com as constraints corretas
            print("🔧 Criando nova tabela com constraints atualizadas...")
            
            cursor.execute("""
                CREATE TABLE processos_procedimentos_new (
                    id TEXT PRIMARY KEY,
                    numero TEXT NOT NULL,
                    tipo_geral TEXT NOT NULL CHECK (tipo_geral IN ('processo', 'procedimento')),
                    tipo_detalhe TEXT NOT NULL,
                    documento_iniciador TEXT NOT NULL CHECK (documento_iniciador IN ('Portaria', 'Memorando Disciplinar', 'Feito Preliminar')),
                    processo_sei TEXT,
                    responsavel_id TEXT NOT NULL,
                    responsavel_tipo TEXT NOT NULL CHECK (responsavel_tipo IN ('encarregado', 'operador')),
                    local_origem TEXT,
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
                    -- Constraint principal: número único por tipo de documento, ano e local
                    UNIQUE(numero, documento_iniciador, ano_instauracao, local_origem),
                    -- Constraint para número de controle: único por tipo de documento, ano e local
                    UNIQUE(numero_controle, documento_iniciador, ano_instauracao, local_origem)
                )
            """)
            
            # Passo 2: Copiar todos os dados
            print("📋 Copiando dados...")
            cursor.execute("""
                INSERT INTO processos_procedimentos_new 
                SELECT * FROM processos_procedimentos
            """)
            
            # Passo 3: Remover triggers e views dependentes
            print("🔧 Removendo dependências...")
            
            # Listar e remover triggers
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='trigger' AND tbl_name='processos_procedimentos'
            """)
            triggers = cursor.fetchall()
            for trigger in triggers:
                cursor.execute(f"DROP TRIGGER IF EXISTS {trigger[0]}")
                print(f"   - Trigger removido: {trigger[0]}")
            
            # Listar e remover views
            cursor.execute("""
                SELECT name, sql FROM sqlite_master 
                WHERE type='view' AND sql LIKE '%processos_procedimentos%'
            """)
            views = cursor.fetchall()
            views_sql = {}
            for view in views:
                views_sql[view[0]] = view[1]
                cursor.execute(f"DROP VIEW IF EXISTS {view[0]}")
                print(f"   - View removida: {view[0]}")
            
            # Passo 4: Substituir tabela
            print("🔄 Substituindo tabela...")
            cursor.execute("DROP TABLE processos_procedimentos")
            cursor.execute("ALTER TABLE processos_procedimentos_new RENAME TO processos_procedimentos")
            
            # Passo 5: Recriar índices
            print("📊 Recriando índices...")
            indices = [
                "CREATE INDEX idx_processos_responsavel ON processos_procedimentos(responsavel_id, responsavel_tipo)",
                "CREATE INDEX idx_processos_created_at ON processos_procedimentos(created_at DESC)",
                "CREATE INDEX idx_processos_tipo ON processos_procedimentos(tipo_geral, tipo_detalhe)",
                "CREATE INDEX idx_processos_ativo ON processos_procedimentos(ativo)",
                "CREATE INDEX idx_processos_data_instauracao ON processos_procedimentos(data_instauracao)",
                "CREATE INDEX idx_processos_documento ON processos_procedimentos(documento_iniciador)",
                "CREATE INDEX idx_processos_nome_pm ON processos_procedimentos(nome_pm_id)",
                "CREATE INDEX idx_processos_escrivao ON processos_procedimentos(escrivao_id)",
                "CREATE INDEX idx_processos_tipo_ativo_data ON processos_procedimentos(tipo_geral, ativo, created_at DESC)",
                "CREATE INDEX idx_processos_concluido ON processos_procedimentos(concluido)",
                "CREATE INDEX idx_processos_conclusao_data ON processos_procedimentos(concluido, data_conclusao)",
                # Novos índices para as constraints
                "CREATE INDEX idx_processos_numero_completo ON processos_procedimentos(numero, documento_iniciador, ano_instauracao, local_origem)",
                "CREATE INDEX idx_processos_controle_completo ON processos_procedimentos(numero_controle, documento_iniciador, ano_instauracao, local_origem)"
            ]
            
            for idx_sql in indices:
                try:
                    cursor.execute(idx_sql)
                except sqlite3.Error as e:
                    print(f"   ⚠️ Aviso ao criar índice: {e}")
            
            # Passo 6: Recriar views
            print("🔧 Recriando views...")
            for view_name, view_sql in views_sql.items():
                try:
                    cursor.execute(view_sql)
                    print(f"   - View recriada: {view_name}")
                except sqlite3.Error as e:
                    print(f"   ⚠️ Erro ao recriar view {view_name}: {e}")
            
            # Passo 7: Recriar trigger de updated_at
            print("🔧 Recriando triggers...")
            cursor.execute("""
                CREATE TRIGGER atualizar_updated_at_processos
                AFTER UPDATE ON processos_procedimentos
                FOR EACH ROW
                BEGIN
                    UPDATE processos_procedimentos 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE id = NEW.id;
                END
            """)
            
            # Verificar integridade final
            cursor.execute("SELECT COUNT(*) FROM processos_procedimentos")
            total_depois = cursor.fetchone()[0]
            
            if total_antes != total_depois:
                raise Exception(f"Perda de dados detectada! Antes: {total_antes}, Depois: {total_depois}")
            
            # Commit da transação
            cursor.execute("COMMIT")
            print("✅ Transação confirmada")
            
        except Exception as e:
            cursor.execute("ROLLBACK")
            raise Exception(f"Erro durante migração: {e}")
        
        print("🧪 Executando testes de validação...")
        
        # Teste 1: Verificar constraints
        print("   - Testando constraint principal...")
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, local_origem,
                    ano_instauracao
                ) VALUES (
                    'teste_constraint_1', '999', 'processo', 'PADS', 'Portaria',
                    '', 'teste', 'encarregado', '7ºBPM', '2025'
                )
            """)
            
            # Tentar inserir duplicata - deve falhar
            cursor.execute("""
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, local_origem,
                    ano_instauracao
                ) VALUES (
                    'teste_constraint_2', '999', 'processo', 'PADS', 'Portaria',
                    '', 'teste', 'encarregado', '7ºBPM', '2025'
                )
            """)
            raise Exception("Constraint principal não está funcionando!")
        except sqlite3.IntegrityError:
            print("     ✅ Constraint principal funcionando")
        
        # Teste 2: Permitir mesmo número em local diferente
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, local_origem,
                    ano_instauracao
                ) VALUES (
                    'teste_local_diferente', '999', 'processo', 'PADS', 'Portaria',
                    '', 'teste', 'encarregado', '8ºBPM', '2025'
                )
            """)
            print("     ✅ Mesmo número em local diferente permitido")
        except sqlite3.IntegrityError as e:
            raise Exception(f"Erro inesperado: {e}")
        
        # Teste 3: Verificar constraint do número de controle
        print("   - Testando constraint de número de controle...")
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, local_origem,
                    ano_instauracao, numero_controle
                ) VALUES (
                    'teste_controle_1', '888', 'processo', 'PADS', 'Portaria',
                    '', 'teste', 'encarregado', '7ºBPM', '2025', '777'
                )
            """)
            
            # Tentar inserir controle duplicado PARA O MESMO TIPO DE DOCUMENTO - deve falhar
            cursor.execute("""
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, local_origem,
                    ano_instauracao, numero_controle
                ) VALUES (
                    'teste_controle_2', '889', 'processo', 'PADS', 'Portaria',
                    '', 'teste', 'encarregado', '7ºBPM', '2025', '777'
                )
            """)
            raise Exception("Constraint de número de controle não está funcionando!")
        except sqlite3.IntegrityError:
            print("     ✅ Constraint de número de controle funcionando")
        
        # Teste 4: Permitir mesmo controle para tipo de documento diferente
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos (
                    id, numero, tipo_geral, tipo_detalhe, documento_iniciador,
                    processo_sei, responsavel_id, responsavel_tipo, local_origem,
                    ano_instauracao, numero_controle
                ) VALUES (
                    'teste_controle_diferente', '890', 'processo', 'PADS', 'Memorando Disciplinar',
                    '', 'teste', 'encarregado', '7ºBPM', '2025', '777'
                )
            """)
            print("     ✅ Mesmo controle para documento diferente permitido")
        except sqlite3.IntegrityError as e:
            raise Exception(f"Erro inesperado no teste de controle: {e}")
        
        # Limpar dados de teste
        cursor.execute("DELETE FROM processos_procedimentos WHERE id LIKE 'teste_%'")
        
        conn.close()
        
        print("🎉 Migração 012 concluída com sucesso!")
        print(f"📊 Registros processados: {total_antes}")
        print("🔒 Novas constraints:")
        print("   - UNIQUE(numero, documento_iniciador, ano_instauracao, local_origem)")
        print("   - UNIQUE(numero_controle, documento_iniciador, ano_instauracao, local_origem)")
        print("📝 Regras implementadas:")
        print("   - Números únicos por tipo de documento + ano + local")
        print("   - Controles únicos por tipo de documento + ano + local")
        print("   - Permite mesmo número/controle para documentos diferentes")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        print(f"🔄 Restaurando backup de {backup_path}")
        
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, db_path)
            print("✅ Backup restaurado com sucesso")
        
        return False

if __name__ == "__main__":
    db_path = "usuarios.db"
    if os.path.exists(db_path):
        executar_migracao(db_path)
    else:
        print(f"❌ Banco de dados não encontrado: {db_path}")
