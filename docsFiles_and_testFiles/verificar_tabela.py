import sqlite3

# Conectar ao banco de dados
conn = sqlite3.connect('usuarios.db')
cursor = conn.cursor()

# Verificar a estrutura da tabela processos_procedimentos
cursor.execute("PRAGMA table_info(processos_procedimentos)")
colunas = cursor.fetchall()

print("Estrutura da tabela processos_procedimentos:")
for coluna in colunas:
    print(f"{coluna[0]}: {coluna[1]} ({coluna[2]})")

# Contar o número de registros na tabela
cursor.execute("SELECT COUNT(*) FROM processos_procedimentos")
count = cursor.fetchone()[0]
print(f"\nQuantidade de registros: {count}")

# Fechar a conexão
conn.close()
