#!/usr/bin/env python3
"""
Script para executar a migração 009 - Múltiplas naturezas de transgressões
"""

import sqlite3
import json
from datetime import datetime

def executar_migracao_009():
    """Executa a migração 009"""
    db_path = 'usuarios.db'
    
    try:
        print("🚀 Iniciando migração 009 - Múltiplas naturezas de transgressões")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se já foi executada
        cursor.execute("""
            SELECT COUNT(*) FROM schema_migrations 
            WHERE migration_name = '009_multiplas_naturezas_transgressoes.sql'
        """)
        
        if cursor.fetchone()[0] > 0:
            print("✅ Migração 009 já foi executada anteriormente")
            conn.close()
            return True
        
        print("📋 Listando processos com transgressões no formato antigo...")
        
        # Buscar processos que precisam ser convertidos
        cursor.execute("""
            SELECT id, numero, transgressoes_ids, natureza_processo
            FROM processos_procedimentos 
            WHERE transgressoes_ids IS NOT NULL 
            AND transgressoes_ids != '' 
            AND transgressoes_ids != '[]'
            AND transgressoes_ids NOT LIKE '%"natureza"%'
        """)
        
        processos_para_converter = cursor.fetchall()
        
        print(f"📊 Encontrados {len(processos_para_converter)} processos para converter")
        
        conversoes_realizadas = 0
        
        for processo in processos_para_converter:
            processo_id, numero, transgressoes_json, natureza_atual = processo
            
            try:
                # Parse do JSON atual
                transgressoes_ids = json.loads(transgressoes_json)
                
                if not isinstance(transgressoes_ids, list):
                    print(f"⚠️  Processo {numero}: formato JSON inválido, pulando...")
                    continue
                
                # Buscar natureza de cada transgressão
                novo_formato = []
                naturezas_encontradas = set()
                
                for trans_id in transgressoes_ids:
                    cursor.execute("""
                        SELECT gravidade FROM transgressoes WHERE id = ?
                    """, (int(trans_id),))
                    
                    result = cursor.fetchone()
                    if result:
                        natureza = result[0]
                        naturezas_encontradas.add(natureza)
                        novo_formato.append({
                            "id": str(trans_id),
                            "natureza": natureza
                        })
                    else:
                        print(f"⚠️  Transgressão ID {trans_id} não encontrada")
                
                if novo_formato:
                    # Atualizar com novo formato
                    novo_json = json.dumps(novo_formato)
                    
                    # Determinar natureza do processo
                    if len(naturezas_encontradas) > 1:
                        nova_natureza_processo = "Múltiplas"
                    else:
                        # Mapear para o formato usado no front-end
                        mapeamento = {
                            'leve': 'Leve',
                            'media': 'Média', 
                            'grave': 'Grave'
                        }
                        nova_natureza_processo = mapeamento.get(list(naturezas_encontradas)[0], natureza_atual)
                    
                    cursor.execute("""
                        UPDATE processos_procedimentos 
                        SET transgressoes_ids = ?, natureza_processo = ?
                        WHERE id = ?
                    """, (novo_json, nova_natureza_processo, processo_id))
                    
                    conversoes_realizadas += 1
                    
                    print(f"✅ Processo {numero}: {len(novo_formato)} transgressões convertidas")
                    print(f"   Naturezas: {', '.join(naturezas_encontradas)} → {nova_natureza_processo}")
                    
            except json.JSONDecodeError as e:
                print(f"❌ Erro ao processar JSON do processo {numero}: {e}")
            except Exception as e:
                print(f"❌ Erro ao converter processo {numero}: {e}")
        
        # Registrar migração como executada
        cursor.execute("""
            INSERT INTO schema_migrations (migration_name, executed_at, execution_time_ms, success)
            VALUES (?, ?, ?, ?)
        """, ('009_multiplas_naturezas_transgressoes.sql', datetime.now().isoformat(), 0, 1))
        
        conn.commit()
        conn.close()
        
        print(f"\n🎉 Migração 009 executada com sucesso!")
        print(f"📊 Estatísticas:")
        print(f"   • Processos convertidos: {conversoes_realizadas}")
        print(f"   • Novo formato JSON implementado")
        print(f"   • Suporte a múltiplas naturezas ativado")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na migração 009: {e}")
        return False

if __name__ == "__main__":
    executar_migracao_009()
