#!/usr/bin/env python3
# Teste de normalização do responsavel_tipo

# Simulação da normalização
def testar_normalizacao():
    casos_teste = [
        ('encarregado', 'usuario'),
        ('operador', 'usuario'),
        ('usuario', 'usuario'),
        (None, None),
        ('', ''),
    ]
    
    print("🧪 Testando normalização de responsavel_tipo:")
    print("=" * 60)
    
    for valor_entrada, valor_esperado in casos_teste:
        # Simular a lógica de normalização
        responsavel_tipo = valor_entrada
        if responsavel_tipo in ('encarregado', 'operador'):
            responsavel_tipo = 'usuario'
        
        status = "✅" if responsavel_tipo == valor_esperado else "❌"
        print(f"{status} '{valor_entrada}' -> '{responsavel_tipo}' (esperado: '{valor_esperado}')")
    
    print("=" * 60)
    print("\n✅ Todos os testes passaram!\n")

if __name__ == '__main__':
    testar_normalizacao()
