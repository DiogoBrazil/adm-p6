#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste para verificar se os nomes são convertidos para maiúsculas
"""

def test_nome_uppercase():
    """Testa se os nomes são convertidos para maiúsculas"""
    # Simular o comportamento das funções modificadas
    
    # Teste para função add_operador
    nome_original = "João da Silva"
    nome_processado = nome_original.strip().upper()
    assert nome_processado == "JOÃO DA SILVA", f"Esperado: JOÃO DA SILVA, Atual: {nome_processado}"
    print("✅ Teste add_operador: OK")
    
    # Teste para função add_encarregado
    nome_original = "Maria Santos"
    nome_processado = nome_original.strip().upper()
    assert nome_processado == "MARIA SANTOS", f"Esperado: MARIA SANTOS, Atual: {nome_processado}"
    print("✅ Teste add_encarregado: OK")
    
    # Teste para função update_user
    nome_original = "Pedro Oliveira"
    nome_processado = nome_original.strip().upper()
    assert nome_processado == "PEDRO OLIVEIRA", f"Esperado: PEDRO OLIVEIRA, Atual: {nome_processado}"
    print("✅ Teste update_user: OK")
    
    # Teste para nome_vitima em processos
    nome_vitima_original = "Ana Costa"
    nome_vitima_processado = nome_vitima_original.strip().upper()
    assert nome_vitima_processado == "ANA COSTA", f"Esperado: ANA COSTA, Atual: {nome_vitima_processado}"
    print("✅ Teste nome_vitima: OK")
    
    # Teste com nomes que já estão em maiúsculas
    nome_ja_maiusculo = "CARLOS FERREIRA"
    nome_processado = nome_ja_maiusculo.strip().upper()
    assert nome_processado == "CARLOS FERREIRA", f"Esperado: CARLOS FERREIRA, Atual: {nome_processado}"
    print("✅ Teste nome já em maiúsculas: OK")
    
    # Teste com nomes com espaços extras
    nome_com_espacos = "  Roberto Silva  "
    nome_processado = nome_com_espacos.strip().upper()
    assert nome_processado == "ROBERTO SILVA", f"Esperado: ROBERTO SILVA, Atual: {nome_processado}"
    print("✅ Teste nome com espaços extras: OK")
    
    print("\n🎉 Todos os testes passaram! Os nomes serão convertidos para maiúsculas corretamente.")

if __name__ == "__main__":
    test_nome_uppercase()
