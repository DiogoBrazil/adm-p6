#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migração: Alterar constraint UNIQUE da coluna numero para permitir 
mesmo número desde que seja documento diferente ou ano diferente
"""
import sqlite3
import os
from datetime import datetime

def fazer_backup():
    """Faz backup do banco antes da migração"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"backups/pre_numero_constraint_migration_{timestamp}.db"
    
    # Criar diretório backups se não existir
    os.makedirs('backups', exist_ok=True)
    
    # Copiar banco atual
    import shutil
    shutil.copy2('usuarios.db', backup_name)
    print(f"✅ Backup criado: {backup_name}")
    return backup_name

def migrar_constraint_numero():
    """
    Remove constraint UNIQUE da coluna numero e cria constraint composta:
    UNIQUE(numero, documento_iniciador, ano_instauracao)
    """
    
    db_path = 'usuarios.db'
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return False
    
    # Fazer backup primeiro
    backup_file = fazer_backup()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Iniciando migração da constraint da coluna numero...")
        
        # Verificar estrutura atual
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        columns_info = cursor.fetchall()
        print(f"📊 Tabela possui {len(columns_info)} colunas")
        
        # Verificar views e outros objetos dependentes
        cursor.execute("""
            SELECT name, sql FROM sqlite_master 
            WHERE type IN ('view', 'trigger', 'index') 
            AND sql LIKE '%processos_procedimentos%'
        """)
        dependent_objects = cursor.fetchall()
        print(f"🔗 Encontrados {len(dependent_objects)} objetos dependentes")
        
        # Salvar objetos dependentes para recriar depois
        dependent_objects_sql = []
        for obj_name, obj_sql in dependent_objects:
            if obj_sql:  # Alguns objetos podem ter SQL None
                dependent_objects_sql.append((obj_name, obj_sql))
                print(f"  - {obj_name}")
        
        # Remover objetos dependentes primeiro
        print("🗑️ Removendo objetos dependentes temporariamente...")
        for obj_name, _ in dependent_objects_sql:
            try:
                cursor.execute(f"DROP VIEW IF EXISTS {obj_name}")
                cursor.execute(f"DROP TRIGGER IF EXISTS {obj_name}")
                cursor.execute(f"DROP INDEX IF EXISTS {obj_name}")
                print(f"  ✅ Removido: {obj_name}")
            except Exception as e:
                print(f"  ⚠️ Erro ao remover {obj_name}: {e}")
        
        # Obter todos os dados existentes
        cursor.execute("SELECT * FROM processos_procedimentos")
        dados_existentes = cursor.fetchall()
        print(f"📋 Encontrados {len(dados_existentes)} registros para migrar")
        
        # Obter nomes das colunas
        column_names = [col[1] for col in columns_info]
        print(f"📝 Colunas: {', '.join(column_names)}")
        
        # Criar nova tabela com constraint corrigida
        print("🏗️ Criando nova tabela com constraint corrigida...")
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
                -- Constraint composta: mesmo número só pode existir se for documento diferente ou ano diferente
                UNIQUE(numero, documento_iniciador, ano_instauracao)
            )
        """)
        
        # Migrar dados existentes
        if dados_existentes:
            print("📦 Migrando dados existentes...")
            
            # Preparar dados com a nova coluna ano_instauracao
            dados_migrados = []
            for row in dados_existentes:
                row_dict = dict(zip(column_names, row))
                
                # Extrair ano da data de instauração se existir
                ano_instauracao = None
                if row_dict.get('data_instauracao'):
                    try:
                        # Tentar extrair ano da data (formato YYYY-MM-DD)
                        data_str = str(row_dict['data_instauracao'])
                        if len(data_str) >= 4:
                            ano_instauracao = data_str[:4]
                    except:
                        ano_instauracao = None
                
                # Adicionar nova coluna aos dados
                nova_row = list(row) + [ano_instauracao]
                dados_migrados.append(nova_row)
            
            # Inserir dados na nova tabela
            new_column_names = column_names + ['ano_instauracao']
            placeholders = ', '.join(['?' for _ in range(len(new_column_names))])
            cursor.executemany(
                f"INSERT INTO processos_procedimentos_new ({', '.join(new_column_names)}) VALUES ({placeholders})",
                dados_migrados
            )
            print(f"✅ {len(dados_migrados)} registros migrados")
        
        # Remover tabela antiga e renomear nova
        print("🔄 Substituindo tabela...")
        cursor.execute("DROP TABLE processos_procedimentos")
        cursor.execute("ALTER TABLE processos_procedimentos_new RENAME TO processos_procedimentos")
        
        # Recriar objetos dependentes
        print("🔄 Recriando objetos dependentes...")
        for obj_name, obj_sql in dependent_objects_sql:
            try:
                cursor.execute(obj_sql)
                print(f"  ✅ Recriado: {obj_name}")
            except Exception as e:
                print(f"  ⚠️ Erro ao recriar {obj_name}: {e}")
                # Não falhar a migração por causa de objetos dependentes
        
        # Commit das alterações
        conn.commit()
        print("✅ Migração concluída com sucesso!")
        
        # Verificar nova estrutura
        print("\n🔍 Verificando nova estrutura...")
        cursor.execute("PRAGMA table_info(processos_procedimentos)")
        new_columns = cursor.fetchall()
        
        cursor.execute("PRAGMA index_list(processos_procedimentos)")
        indexes = cursor.fetchall()
        
        unique_constraints = []
        for idx in indexes:
            seq, name, unique, origin, partial = idx
            if unique:
                cursor.execute(f"PRAGMA index_info({name})")
                index_info = cursor.fetchall()
                columns_in_index = [info[2] for info in index_info]
                unique_constraints.append(columns_in_index)
        
        print(f"📊 Nova tabela possui {len(new_columns)} colunas")
        print(f"🔒 Constraints UNIQUE encontrados: {unique_constraints}")
        
        # Testar a nova constraint
        print("\n🧪 Testando nova constraint...")
        test_success = testar_nova_constraint(cursor)
        
        if test_success:
            conn.commit()
            print("✅ Teste da constraint passou! Migração finalizada.")
        else:
            conn.rollback()
            print("❌ Teste da constraint falhou! Rollback realizado.")
            return False
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro durante migração: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Restaurar backup em caso de erro
        print(f"🔄 Restaurando backup: {backup_file}")
        try:
            import shutil
            shutil.copy2(backup_file, db_path)
            print("✅ Backup restaurado")
        except Exception as restore_error:
            print(f"❌ Erro ao restaurar backup: {restore_error}")
        
        return False

def testar_nova_constraint(cursor):
    """Testa se a nova constraint está funcionando corretamente"""
    try:
        # Teste 1: Tentar inserir mesmo número, mesmo documento, mesmo ano (deve falhar)
        print("  🧪 Teste 1: Mesmo número, documento e ano (deve falhar)...")
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos 
                (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, responsavel_id, responsavel_tipo, 
                 data_instauracao, ano_instauracao, numero_controle) 
                VALUES ('test1', '999', 'processo', 'PAD', 'Portaria', 'test-resp', 'operador', '2024-01-01', '2024', 'T999/2024')
            """)
            cursor.execute("""
                INSERT INTO processos_procedimentos 
                (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, responsavel_id, responsavel_tipo, 
                 data_instauracao, ano_instauracao, numero_controle) 
                VALUES ('test2', '999', 'processo', 'PAD', 'Portaria', 'test-resp', 'operador', '2024-06-01', '2024', 'T999B/2024')
            """)
            print("    ❌ ERRO: Permitiu inserir duplicata!")
            return False
        except sqlite3.IntegrityError:
            print("    ✅ OK: Bloqueou duplicata corretamente")
        
        # Teste 2: Inserir mesmo número, documento diferente (deve passar)
        print("  🧪 Teste 2: Mesmo número, documento diferente (deve passar)...")
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos 
                (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, responsavel_id, responsavel_tipo, 
                 data_instauracao, ano_instauracao, numero_controle) 
                VALUES ('test3', '999', 'processo', 'PAD', 'Memorando Disciplinar', 'test-resp', 'operador', '2024-01-01', '2024', 'T999M/2024')
            """)
            print("    ✅ OK: Permitiu mesmo número com documento diferente")
        except sqlite3.IntegrityError as e:
            print(f"    ❌ ERRO: Bloqueou indevidamente - {e}")
            return False
        
        # Teste 3: Inserir mesmo número, mesmo documento, ano diferente (deve passar)
        print("  🧪 Teste 3: Mesmo número e documento, ano diferente (deve passar)...")
        try:
            cursor.execute("""
                INSERT INTO processos_procedimentos 
                (id, numero, tipo_geral, tipo_detalhe, documento_iniciador, responsavel_id, responsavel_tipo, 
                 data_instauracao, ano_instauracao, numero_controle) 
                VALUES ('test4', '999', 'processo', 'PAD', 'Portaria', 'test-resp', 'operador', '2025-01-01', '2025', 'T999/2025')
            """)
            print("    ✅ OK: Permitiu mesmo número e documento em ano diferente")
        except sqlite3.IntegrityError as e:
            print(f"    ❌ ERRO: Bloqueou indevidamente - {e}")
            return False
        
        # Limpar dados de teste
        cursor.execute("DELETE FROM processos_procedimentos WHERE id LIKE 'test%'")
        print("  🧹 Dados de teste removidos")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Erro no teste: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Iniciando migração da constraint da coluna numero...")
    sucesso = migrar_constraint_numero()
    
    if sucesso:
        print("\n🎉 Migração concluída com sucesso!")
        print("📋 Agora é possível:")
        print("  ✅ Portaria 1/2024 e Portaria 1/2025")
        print("  ✅ Portaria 1/2024 e Memorando 1/2024")
        print("  ❌ Duas Portarias 1/2024 (ainda bloqueado)")
    else:
        print("\n❌ Migração falhou! Verifique os logs acima.")
