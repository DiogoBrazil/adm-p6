#!/usr/bin/env python3
"""
Migração 027: Converter IDs de transgressões do Art. 29 de INTEGER para UUID
"""

import psycopg2
import psycopg2.extras
import json
import sys

# Configuração do banco
DB_CONFIG = {
    'host': '192.168.0.137',
    'port': 5432,
    'database': 'app_db',
    'user': 'app_user',
    'password': 'p67bpm'
}

def converter_transgressoes():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. Criar mapeamento de IDs antigos para novos UUIDs baseado no inciso
        print("📋 Criando mapeamento de IDs antigos para UUIDs...")
        cursor.execute("""
            SELECT id, inciso FROM infracoes_estatuto_art29 
            WHERE ativo = TRUE 
            ORDER BY inciso
        """)
        
        infracoes = cursor.fetchall()
        id_mapping = {}
        
        # Mapear incisos romanos para números
        inciso_to_num = {
            'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
            'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
            'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
            'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20,
            'XXI': 21
        }
        
        for infracao in infracoes:
            inciso = infracao['inciso']
            if inciso in inciso_to_num:
                old_id = inciso_to_num[inciso]
                id_mapping[old_id] = infracao['id']
                print(f"  {old_id} → {infracao['id']} (Inciso {inciso})")
        
        # 2. Buscar processos com transgressões
        print("\n📋 Buscando processos com transgressões do Art. 29...")
        cursor.execute("""
            SELECT id, numero, tipo_detalhe, transgressoes_ids 
            FROM processos_procedimentos 
            WHERE transgressoes_ids IS NOT NULL 
            AND transgressoes_ids != '' 
            AND transgressoes_ids != '[]'
            AND transgressoes_ids LIKE '%estatuto%'
        """)
        
        processos = cursor.fetchall()
        print(f"✅ Encontrados {len(processos)} processos com transgressões do Art. 29")
        
        # 3. Converter IDs
        count_converted = 0
        for processo in processos:
            try:
                transgressoes = json.loads(processo['transgressoes_ids'])
                converted = False
                
                for transgressao in transgressoes:
                    if transgressao.get('tipo') == 'estatuto':
                        old_id = transgressao.get('id')
                        if isinstance(old_id, int) and old_id in id_mapping:
                            new_id = id_mapping[old_id]
                            transgressao['id'] = new_id
                            converted = True
                            print(f"  ✓ Processo {processo['tipo_detalhe']} {processo['numero']}: ID {old_id} → {new_id}")
                
                if converted:
                    # Atualizar registro
                    new_json = json.dumps(transgressoes)
                    cursor.execute("""
                        UPDATE processos_procedimentos 
                        SET transgressoes_ids = %s 
                        WHERE id = %s
                    """, (new_json, processo['id']))
                    count_converted += 1
                    
            except Exception as e:
                print(f"  ❌ Erro no processo {processo['id']}: {e}")
        
        conn.commit()
        print(f"\n✅ Migração concluída! {count_converted} processos atualizados")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        sys.exit(1)

if __name__ == '__main__':
    print("🚀 Iniciando migração 027...")
    converter_transgressoes()
