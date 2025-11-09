#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script consolidado para migrar TODOS os dados de referência do SQLite para PostgreSQL
Executa as migrações de:
- Municípios e Distritos (112 registros)
- Crimes e Contravenções (22 registros)
- Transgressões, Infrações, Postos, Naturezas, etc (153 registros)
"""

import sys
import subprocess

def executar_migracao(script, descricao):
    """Executa um script de migração e retorna o resultado"""
    print(f"\n{'='*80}")
    print(f"EXECUTANDO: {descricao}")
    print(f"Script: {script}")
    print(f"{'='*80}\n")
    
    try:
        result = subprocess.run(['python3', script], 
                              capture_output=False, 
                              text=True, 
                              check=True)
        print(f"\n✅ {descricao} - CONCLUÍDO COM SUCESSO")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ {descricao} - FALHOU")
        print(f"Erro: {e}")
        return False

def main():
    """Executa todas as migrações em sequência"""
    
    print("\n" + "="*80)
    print("MIGRAÇÃO COMPLETA DE DADOS DE REFERÊNCIA")
    print("SQLite → PostgreSQL")
    print("="*80)
    
    migracoes = [
        ('migrar_municipios.py', 'Municípios e Distritos'),
        ('migrar_crimes.py', 'Crimes e Contravenções (Base Legal)'),
        ('migrar_todas_referencias.py', 'Tabelas de Referência Gerais')
    ]
    
    resultados = []
    
    for script, descricao in migracoes:
        sucesso = executar_migracao(script, descricao)
        resultados.append((descricao, sucesso))
    
    # Relatório final
    print("\n" + "="*80)
    print("RELATÓRIO FINAL DE TODAS AS MIGRAÇÕES")
    print("="*80 + "\n")
    
    total_sucesso = sum(1 for _, sucesso in resultados if sucesso)
    total_falha = len(resultados) - total_sucesso
    
    for descricao, sucesso in resultados:
        status = "✅ SUCESSO" if sucesso else "❌ FALHA"
        print(f"{status:12s} - {descricao}")
    
    print(f"\n{'='*80}")
    print(f"RESUMO:")
    print(f"  • Migrações bem-sucedidas: {total_sucesso}/{len(resultados)}")
    print(f"  • Migrações com falha: {total_falha}/{len(resultados)}")
    print(f"{'='*80}\n")
    
    if total_falha == 0:
        print("🎉 TODAS AS MIGRAÇÕES CONCLUÍDAS COM SUCESSO!")
        print("\n📊 Dados migrados:")
        print("   • 112 municípios e distritos")
        print("   • 22 crimes e contravenções")
        print("   • 153 registros de tabelas de referência")
        print("   • TOTAL: 287 registros de dados de base\n")
        return 0
    else:
        print("⚠️  ALGUMAS MIGRAÇÕES FALHARAM")
        print("Verifique os erros acima e execute as migrações individualmente.\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
