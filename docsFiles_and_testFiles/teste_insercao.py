import sqlite3
import uuid
from datetime import datetime

# Dados de teste para simular o que estaria vindo do frontend
dados_teste = {
    "numero": "TESTE-001",
    "tipo_geral": "processo",
    "tipo_detalhe": "sindicância",
    "documento_iniciador": "Portaria",  # Valor válido conforme CHECK constraint
    "processo_sei": "SEI-001",
    "responsavel_id": "1234",  # um ID qualquer
    "responsavel_tipo": "operador",
    "local_origem": "Local de teste",
    "data_instauracao": "2023-05-15",
    "data_recebimento": "2023-05-16",
    "escrivao_id": None,
    "status_pm": "Em andamento",
    "nome_pm_id": None,
    "nome_vitima": "Nome da vítima teste",
    "natureza_processo": "Natureza teste",
    "natureza_procedimento": None,
    "resumo_fatos": "Resumo dos fatos teste",
    "numero_portaria": "PORT-001",
    "numero_memorando": "MEM-001",
    "numero_feito": "FEITO-001",
    "numero_rgf": "RGF-001"
}

# Conectar ao banco de dados
conn = sqlite3.connect('usuarios.db')
cursor = conn.cursor()

try:
    # Gerar um ID único
    registro_id = str(uuid.uuid4())
    
    # Preparar os dados para inserção
    dados_insercao = (
        registro_id,
        dados_teste["numero"],
        dados_teste["tipo_geral"],
        dados_teste["tipo_detalhe"],
        dados_teste["documento_iniciador"],
        dados_teste["processo_sei"],
        dados_teste["responsavel_id"],
        dados_teste["responsavel_tipo"],
        dados_teste["local_origem"],
        dados_teste["data_instauracao"],
        dados_teste["data_recebimento"],
        dados_teste["escrivao_id"],
        dados_teste["status_pm"],
        dados_teste["nome_pm_id"],
        dados_teste["nome_vitima"],
        dados_teste["natureza_processo"],
        dados_teste["natureza_procedimento"],
        dados_teste["resumo_fatos"],
        dados_teste["numero_portaria"],
        dados_teste["numero_memorando"],
        dados_teste["numero_feito"],
        dados_teste["numero_rgf"]
    )
    
    # Executar a inserção
    cursor.execute("""
        INSERT INTO processos_procedimentos (
            id, numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo,
            local_origem, data_instauracao, data_recebimento, escrivao_id, status_pm, nome_pm_id,
            nome_vitima, natureza_processo, natureza_procedimento, resumo_fatos,
            numero_portaria, numero_memorando, numero_feito, numero_rgf
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, dados_insercao)
    
    # Commit da transação
    conn.commit()
    
    print("✅ Procedimento de teste inserido com sucesso!")
    print(f"ID: {registro_id}")
    print(f"Número: {dados_teste['numero']}")
    
except sqlite3.IntegrityError as e:
    print(f"❌ Erro de integridade no banco de dados: {e}")
    conn.rollback()
    
except Exception as e:
    print(f"❌ Erro ao inserir procedimento de teste: {e}")
    import traceback
    traceback.print_exc()
    conn.rollback()
    
finally:
    # Fechar conexão
    conn.close()
