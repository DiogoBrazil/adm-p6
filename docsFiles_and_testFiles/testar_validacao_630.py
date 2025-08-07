#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sqlite3
import sys
import os

# Adicionar o diretório pai ao path para importar as funções
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Simular o teste da função de validação
def testar_validacao_630():
    """Simula a validação de uma portaria 630/2025/7ºBPM"""
    
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("=== TESTE DE VALIDAÇÃO PORTARIA 630 ===")
    print()
    
    # Simular os parâmetros que seriam enviados
    numero = "630"
    documento_iniciador = "Portaria"
    local_origem = "7ºBPM"
    ano_instauracao = "2025"
    
    print(f"Testando: {documento_iniciador} {numero}/{ano_instauracao}/{local_origem}")
    
    # Executar a mesma query que seria usada na validação
    cursor.execute("""
        SELECT id, numero, documento_iniciador, local_origem, ano_instauracao
        FROM processos_procedimentos
        WHERE numero = ? 
          AND documento_iniciador = ? 
          AND local_origem = ? 
          AND ano_instauracao = ?
          AND ativo = 1
    """, (numero, documento_iniciador, local_origem, ano_instauracao))
    
    resultado = cursor.fetchone()
    
    if resultado:
        print(f"❌ CONFLITO ENCONTRADO:")
        print(f"   ID: {resultado[0]}")
        print(f"   Número: {resultado[1]}")
        print(f"   Documento: {resultado[2]}")
        print(f"   Local: {resultado[3]}")
        print(f"   Ano: {resultado[4]}")
        validacao_passou = False
    else:
        print("✅ NENHUM CONFLITO - Número disponível!")
        validacao_passou = True
    
    # Testar também número de controle
    print(f"\nTestando número de controle {numero}:")
    cursor.execute("""
        SELECT id, numero_controle, documento_iniciador, local_origem, ano_instauracao
        FROM processos_procedimentos
        WHERE numero_controle = ? 
          AND documento_iniciador = ? 
          AND local_origem = ? 
          AND ano_instauracao = ?
          AND ativo = 1
    """, (numero, documento_iniciador, local_origem, ano_instauracao))
    
    resultado_controle = cursor.fetchone()
    
    if resultado_controle:
        print(f"❌ CONFLITO NO CONTROLE:")
        print(f"   ID: {resultado_controle[0]}")
        print(f"   Controle: {resultado_controle[1]}")
        print(f"   Documento: {resultado_controle[2]}")
        print(f"   Local: {resultado_controle[3]}")
        print(f"   Ano: {resultado_controle[4]}")
        controle_passou = False
    else:
        print("✅ CONTROLE DISPONÍVEL!")
        controle_passou = True
    
    conn.close()
    
    print(f"\n=== RESULTADO FINAL ===")
    if validacao_passou and controle_passou:
        print("✅ PORTARIA 630/2025/7ºBPM PODE SER CADASTRADA!")
        return True
    else:
        print("❌ PORTARIA 630/2025/7ºBPM TEM CONFLITOS!")
        return False

if __name__ == "__main__":
    testar_validacao_630()
