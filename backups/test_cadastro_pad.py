#!/usr/bin/env python3
# Teste de cadastro de PAD após migração

import sqlite3
import uuid
from datetime import datetime

db_path = 'usuarios.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Buscar usuários disponíveis para serem presidente, interrogante e escrivão
cursor.execute("SELECT id, nome, posto_graduacao FROM usuarios WHERE ativo=1 AND is_operador=1 LIMIT 3")
usuarios = cursor.fetchall()

if len(usuarios) < 3:
    print("❌ Não há usuários suficientes. Criando usuários de teste...")
    conn.close()
    exit(1)

presidente_id = usuarios[0][0]
interrogante_id = usuarios[1][0]
escrivao_processo_id = usuarios[2][0]

print(f"✅ Usando usuários:")
print(f"   Presidente: {usuarios[0][2]} {usuarios[0][1]} (ID: {presidente_id})")
print(f"   Interrogante: {usuarios[1][2]} {usuarios[1][1]} (ID: {interrogante_id})")
print(f"   Escrivão: {usuarios[2][2]} {usuarios[2][1]} (ID: {escrivao_processo_id})")

# Buscar PM envolvido
cursor.execute("SELECT id, nome FROM usuarios WHERE ativo=1 LIMIT 1")
pm = cursor.fetchone()
pm_id = pm[0]

print(f"   PM Envolvido: {pm[1]} (ID: {pm_id})")

# Tentar inserir um PAD
processo_id = str(uuid.uuid4())
ano_atual = datetime.now().year

dados_pad = {
    'id': processo_id,
    'numero': '999',
    'tipo_geral': 'processo',
    'tipo_detalhe': 'PAD',
    'documento_iniciador': 'Portaria',
    'processo_sei': 'SEI-12345-TESTE',
    'responsavel_id': None,  # PAD não tem responsável
    'responsavel_tipo': None,
    'local_origem': 'Porto Velho',
    'local_fatos': 'Teste Local',
    'data_instauracao': '2025-10-23',
    'data_recebimento': '2025-10-23',
    'escrivao_id': None,
    'status_pm': 'Investigado',
    'nome_pm_id': pm_id,
    'nome_vitima': None,
    'natureza_processo': 'Transgressão Disciplinar',
    'natureza_procedimento': None,
    'resumo_fatos': 'Teste de cadastro de PAD após migração',
    'numero_portaria': '001/2025',
    'numero_memorando': None,
    'numero_feito': None,
    'numero_rgf': None,
    'numero_controle': '001',
    'concluido': 0,
    'data_conclusao': None,
    'solucao_final': None,
    'transgressoes_ids': None,
    'ano_instauracao': str(ano_atual),
    'data_remessa_encarregado': None,
    'data_julgamento': None,
    'solucao_tipo': None,
    'penalidade_tipo': None,
    'penalidade_dias': None,
    'indicios_categorias': None,
    'presidente_id': presidente_id,
    'presidente_tipo': 'usuario',  # VALOR CORRETO APÓS MIGRAÇÃO
    'interrogante_id': interrogante_id,
    'interrogante_tipo': 'usuario',  # VALOR CORRETO APÓS MIGRAÇÃO
    'escrivao_processo_id': escrivao_processo_id,
    'escrivao_processo_tipo': 'usuario',  # VALOR CORRETO APÓS MIGRAÇÃO
    'historico_encarregados': None,
    'motorista_id': None
}

print(f"\n🔍 Testando INSERT do PAD...")
print(f"   presidente_tipo: {dados_pad['presidente_tipo']}")
print(f"   interrogante_tipo: {dados_pad['interrogante_tipo']}")
print(f"   escrivao_processo_tipo: {dados_pad['escrivao_processo_tipo']}")

try:
    cursor.execute("""
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, 
            responsavel_id, responsavel_tipo, local_origem, local_fatos, data_instauracao, 
            data_recebimento, escrivao_id, status_pm, nome_pm_id, nome_vitima, 
            natureza_processo, natureza_procedimento, resumo_fatos, numero_portaria, 
            numero_memorando, numero_feito, numero_rgf, numero_controle, concluido, 
            data_conclusao, solucao_final, transgressoes_ids, ano_instauracao,
            data_remessa_encarregado, data_julgamento, solucao_tipo, penalidade_tipo, 
            penalidade_dias, indicios_categorias, presidente_id, presidente_tipo, 
            interrogante_id, interrogante_tipo, escrivao_processo_id, escrivao_processo_tipo,
            historico_encarregados, motorista_id
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    """, (
        dados_pad['id'], dados_pad['numero'], dados_pad['tipo_geral'], dados_pad['tipo_detalhe'],
        dados_pad['documento_iniciador'], dados_pad['processo_sei'], dados_pad['responsavel_id'],
        dados_pad['responsavel_tipo'], dados_pad['local_origem'], dados_pad['local_fatos'],
        dados_pad['data_instauracao'], dados_pad['data_recebimento'], dados_pad['escrivao_id'],
        dados_pad['status_pm'], dados_pad['nome_pm_id'], dados_pad['nome_vitima'],
        dados_pad['natureza_processo'], dados_pad['natureza_procedimento'], dados_pad['resumo_fatos'],
        dados_pad['numero_portaria'], dados_pad['numero_memorando'], dados_pad['numero_feito'],
        dados_pad['numero_rgf'], dados_pad['numero_controle'], dados_pad['concluido'],
        dados_pad['data_conclusao'], dados_pad['solucao_final'], dados_pad['transgressoes_ids'],
        dados_pad['ano_instauracao'], dados_pad['data_remessa_encarregado'], dados_pad['data_julgamento'],
        dados_pad['solucao_tipo'], dados_pad['penalidade_tipo'], dados_pad['penalidade_dias'],
        dados_pad['indicios_categorias'], dados_pad['presidente_id'], dados_pad['presidente_tipo'],
        dados_pad['interrogante_id'], dados_pad['interrogante_tipo'], dados_pad['escrivao_processo_id'],
        dados_pad['escrivao_processo_tipo'], dados_pad['historico_encarregados'], dados_pad['motorista_id']
    ))
    
    conn.commit()
    print("\n✅ PAD cadastrado com sucesso!")
    print(f"   ID: {processo_id}")
    
    # Verificar se foi inserido
    cursor.execute("SELECT numero, tipo_detalhe, presidente_tipo, interrogante_tipo, escrivao_processo_tipo FROM processos_procedimentos WHERE id=?", (processo_id,))
    resultado = cursor.fetchone()
    print(f"   Verificação: {resultado}")
    
except Exception as e:
    print(f"\n❌ Erro ao cadastrar PAD: {e}")
    conn.rollback()
finally:
    conn.close()
