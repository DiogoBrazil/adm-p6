#!/usr/bin/env python3
"""
Script para corrigir os números dos procedimentos no banco de dados.
Move o RGF do campo 'numero' para 'numero_rgf' e coloca o número correto do documento no campo 'numero'.
"""

import sqlite3
import sys

def corrigir_numeros_procedimentos():
    """Corrige os números dos procedimentos no banco de dados"""
    
    try:
        # Conectar ao banco
        conn = sqlite3.connect('usuarios.db')
        cursor = conn.cursor()
        
        print("🔍 Analisando procedimentos que precisam de correção...")
        
        # Buscar todos os procedimentos ativos
        cursor.execute("""
            SELECT id, numero, documento_iniciador, numero_portaria, numero_memorando, numero_feito, numero_rgf
            FROM processos_procedimentos 
            WHERE ativo = 1
        """)
        
        procedimentos = cursor.fetchall()
        
        if not procedimentos:
            print("ℹ️  Nenhum procedimento encontrado.")
            return
        
        print(f"📋 Encontrados {len(procedimentos)} procedimento(s) para análise:")
        
        correcoes_realizadas = 0
        
        for proc in procedimentos:
            proc_id, numero_atual, documento_iniciador, numero_portaria, numero_memorando, numero_feito, numero_rgf = proc
            
            print(f"\n📄 Procedimento ID: {proc_id[:8]}...")
            print(f"   📌 Número atual: {numero_atual}")
            print(f"   📌 Documento iniciador: {documento_iniciador}")
            print(f"   📌 RGF atual: {numero_rgf}")
            print(f"   📌 Número portaria: {numero_portaria}")
            print(f"   📌 Número memorando: {numero_memorando}")
            print(f"   📌 Número feito: {numero_feito}")
            
            # Verificar se precisa de correção
            novo_numero = None
            novo_rgf = numero_rgf
            
            # Se o campo numero_rgf está vazio e numero contém um valor, mover para numero_rgf
            if not numero_rgf and numero_atual:
                novo_rgf = numero_atual
                print(f"   ➡️  Movendo '{numero_atual}' de 'numero' para 'numero_rgf'")
            
            # Determinar o número correto baseado no documento iniciador
            if documento_iniciador == 'Portaria' and numero_portaria:
                novo_numero = numero_portaria
                print(f"   ➡️  Usando número da portaria: {numero_portaria}")
            elif documento_iniciador == 'Memorando Disciplinar' and numero_memorando:
                novo_numero = numero_memorando
                print(f"   ➡️  Usando número do memorando: {numero_memorando}")
            elif documento_iniciador == 'Feito Preliminar' and numero_feito:
                novo_numero = numero_feito
                print(f"   ➡️  Usando número do feito: {numero_feito}")
            else:
                print(f"   ⚠️  ATENÇÃO: Não foi possível determinar o número correto!")
                print(f"      Documento: {documento_iniciador}")
                print(f"      Portaria: {numero_portaria}")
                print(f"      Memorando: {numero_memorando}")
                print(f"      Feito: {numero_feito}")
                
                # Se não tem número específico, usar o número atual como fallback
                if not novo_numero:
                    novo_numero = numero_atual
                    print(f"   ➡️  Mantendo número atual como fallback: {numero_atual}")
            
            # Realizar a atualização se necessário
            if novo_numero != numero_atual or novo_rgf != numero_rgf:
                print(f"   🔧 Aplicando correção:")
                print(f"      numero: '{numero_atual}' → '{novo_numero}'")
                print(f"      numero_rgf: '{numero_rgf}' → '{novo_rgf}'")
                
                cursor.execute("""
                    UPDATE processos_procedimentos 
                    SET numero = ?, numero_rgf = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (novo_numero, novo_rgf, proc_id))
                
                correcoes_realizadas += 1
                print(f"   ✅ Correção aplicada com sucesso!")
            else:
                print(f"   ✅ Procedimento já está correto.")
        
        # Confirmar alterações
        if correcoes_realizadas > 0:
            conn.commit()
            print(f"\n🎉 Correção concluída! {correcoes_realizadas} procedimento(s) corrigido(s).")
        else:
            print(f"\n✅ Todos os procedimentos já estavam corretos.")
        
        # Verificar resultado final
        print(f"\n📊 Resultado final:")
        cursor.execute("""
            SELECT id, numero, documento_iniciador, numero_rgf
            FROM processos_procedimentos 
            WHERE ativo = 1
        """)
        
        procedimentos_finais = cursor.fetchall()
        for proc in procedimentos_finais:
            proc_id, numero, documento_iniciador, numero_rgf = proc
            print(f"   📄 {proc_id[:8]}... | Número: {numero} | Documento: {documento_iniciador} | RGF: {numero_rgf}")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Erro no banco de dados: {e}")
        return False
    except Exception as e:
        print(f"❌ Erro geral: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🚀 Iniciando correção dos números dos procedimentos...")
    print("="*60)
    
    sucesso = corrigir_numeros_procedimentos()
    
    print("="*60)
    if sucesso:
        print("✅ Script executado com sucesso!")
    else:
        print("❌ Script executado com erros!")
        sys.exit(1)
