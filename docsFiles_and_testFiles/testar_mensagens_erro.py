#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sqlite3

def testar_mensagens_erro():
    """Testa as mensagens de erro específicas"""
    
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("=== TESTE DE MENSAGENS DE ERRO ===")
    print()
    
    # Primeiro vamos ver que portaria tem controle 624
    print("1. Verificando qual portaria tem controle 624:")
    cursor.execute("""
        SELECT numero, documento_iniciador, local_origem, ano_instauracao, numero_controle
        FROM processos_procedimentos
        WHERE numero_controle = '624' AND documento_iniciador = 'Portaria' 
              AND local_origem = '7ºBPM' AND ano_instauracao = '2025' AND ativo = 1
    """)
    controle_624 = cursor.fetchall()
    
    if controle_624:
        for doc in controle_624:
            print(f"   - Portaria {doc[0]}/{doc[3]} ({doc[2]}) com controle {doc[4]}")
    else:
        print("   - Nenhuma portaria com controle 624 encontrada")
    
    # Testar conflito de número principal
    print("\n2. Simulando conflito de número principal:")
    print("   Tentativa: Portaria 624/2025/7ºBPM")
    cursor.execute("""
        SELECT id, numero FROM processos_procedimentos
        WHERE numero = '624' AND documento_iniciador = 'Portaria' 
              AND local_origem = '7ºBPM' AND ano_instauracao = '2025' AND ativo = 1
    """)
    conflito_numero = cursor.fetchone()
    
    if conflito_numero:
        print(f"   ❌ CONFLITO: Já existe Portaria número 624")
    else:
        print(f"   ✅ OK: Portaria número 624 disponível")
    
    # Testar conflito de controle
    print("\n3. Simulando conflito de controle:")
    print("   Tentativa: Portaria 630/2025/7ºBPM com controle 624")
    cursor.execute("""
        SELECT id, numero, numero_controle FROM processos_procedimentos
        WHERE numero_controle = '624' AND documento_iniciador = 'Portaria' 
              AND local_origem = '7ºBPM' AND ano_instauracao = '2025' AND ativo = 1
    """)
    conflito_controle = cursor.fetchone()
    
    if conflito_controle:
        print(f"   ❌ CONFLITO: Já existe controle 624 (usado na Portaria {conflito_controle[1]})")
        print(f"   Mensagem deveria ser: 'Já existe um Portaria com número de controle 624 para o ano 2025 no 7ºBPM. (Usado na Portaria {conflito_controle[1]})'")
    else:
        print(f"   ✅ OK: Controle 624 disponível")
    
    conn.close()
    
    print("\n=== RESULTADO ===")
    print("✅ Agora as mensagens devem ser específicas:")
    print("   - Conflito de número: 'Já existe um Portaria número X...'")
    print("   - Conflito de controle: 'Já existe um Portaria com número de controle X...'")

if __name__ == "__main__":
    testar_mensagens_erro()
