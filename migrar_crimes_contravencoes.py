#!/usr/bin/env python3
"""
Migração para criar tabela de crimes e contravenções
Data: 05/08/2025
"""

import sqlite3
import os
from datetime import datetime
import shutil

def criar_backup():
    """Criar backup do banco antes da migração"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"pre_crimes_migration_backup_{timestamp}.db"
    backup_path = os.path.join("backups", backup_filename)
    
    # Criar diretório de backup se não existir
    os.makedirs("backups", exist_ok=True)
    
    # Copiar o banco atual
    shutil.copy2("usuarios.db", backup_path)
    print(f"✅ Backup criado: {backup_path}")
    return backup_path

def executar_migracao():
    """Executar a migração para criar a tabela crimes_contravencoes"""
    try:
        # Criar backup
        backup_path = criar_backup()
        
        # Conectar ao banco
        conn = sqlite3.connect('usuarios.db')
        cursor = conn.cursor()
        
        print("📋 Iniciando migração da tabela crimes_contravencoes...")
        
        # Criar tabela crimes_contravencoes
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crimes_contravencoes (
                id TEXT PRIMARY KEY,
                tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Crime', 'Contravenção Penal')),
                dispositivo_legal VARCHAR(100) NOT NULL,
                artigo VARCHAR(10) NOT NULL,
                descricao_artigo TEXT NOT NULL,
                paragrafo VARCHAR(10),
                inciso VARCHAR(10),
                alinea VARCHAR(10),
                ativo BOOLEAN NOT NULL DEFAULT 1,
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        print("✅ Tabela crimes_contravencoes criada com sucesso")
        
        # Criar índices para melhor performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_crimes_tipo ON crimes_contravencoes(tipo)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_crimes_dispositivo ON crimes_contravencoes(dispositivo_legal)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_crimes_artigo ON crimes_contravencoes(artigo)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_crimes_ativo ON crimes_contravencoes(ativo)
        """)
        
        print("✅ Índices criados com sucesso")
        
        # Verificar se a tabela foi criada corretamente
        cursor.execute("PRAGMA table_info(crimes_contravencoes)")
        colunas = cursor.fetchall()
        
        print("\\n📊 Estrutura da tabela crimes_contravencoes:")
        for coluna in colunas:
            print(f"  - {coluna[1]} {coluna[2]} {'(PK)' if coluna[5] else ''}")
        
        # Inserir alguns dados de exemplo
        print("\\n📝 Inserindo dados de exemplo...")
        
        import uuid
        dados_exemplo = [
            # Crimes do Código Penal
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '121', 'Homicídio simples - Matar alguém', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '129', 'Lesão corporal - Ofender a integridade corporal ou a saúde de outrem', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '155', 'Furto - Subtrair, para si ou para outrem, coisa alheia móvel', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '157', 'Roubo - Subtrair coisa móvel alheia, para si ou para outrem, mediante grave ameaça ou violência à pessoa, ou depois de havê-la, por qualquer meio, reduzido à impossibilidade de resistência', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '213', 'Estupro - Constranger alguém, mediante violência ou grave ameaça, a ter conjunção carnal ou a praticar ou permitir que com ele se pratique outro ato libidinoso', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '312', 'Peculato - Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '317', 'Corrupção passiva - Solicitar ou receber, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida, ou aceitar promessa de tal vantagem', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '331', 'Desacato - Desacatar funcionário público no exercício da função ou em razão dela', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código Penal', '329', 'Resistência - Opor-se à execução de ato legal, mediante violência ou ameaça a funcionário competente para executá-lo ou a quem lhe esteja prestando auxílio', None, None, None, 1),
            
            # Crimes do Código de Trânsito Brasileiro
            (str(uuid.uuid4()), 'Crime', 'Código de Trânsito Brasileiro', '302', 'Praticar homicídio culposo na direção de veículo automotor', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código de Trânsito Brasileiro', '303', 'Praticar lesão corporal culposa na direção de veículo automotor', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código de Trânsito Brasileiro', '306', 'Conduzir veículo automotor com capacidade psicomotora alterada em razão da influência de álcool ou de outra substância psicoativa que determine dependência', None, None, None, 1),
            (str(uuid.uuid4()), 'Crime', 'Código de Trânsito Brasileiro', '309', 'Dirigir veículo automotor, em via pública, sem a devida Permissão para Dirigir ou Carteira de Habilitação', None, None, None, 1),
            
            # Contravenções Penais
            (str(uuid.uuid4()), 'Contravenção Penal', 'Lei de Contravenções Penais', '21', 'Vias de fato - Praticar vias de fato contra alguém', None, None, None, 1),
            (str(uuid.uuid4()), 'Contravenção Penal', 'Lei de Contravenções Penais', '47', 'Exercício ilegal de profissão ou atividade - Exercer profissão ou atividade econômica ou anunciar que a exerce, sem preencher as condições a que por lei está subordinado o seu exercício', None, None, None, 1),
            (str(uuid.uuid4()), 'Contravenção Penal', 'Lei de Contravenções Penais', '65', 'Perturbação do trabalho ou do sossego alheios - Molestar alguém ou perturbar-lhe a tranquilidade, por acinte ou por motivo reprovável', None, None, None, 1),
        ]
        
        cursor.executemany("""
            INSERT INTO crimes_contravencoes 
            (id, tipo, dispositivo_legal, artigo, descricao_artigo, paragrafo, inciso, alinea, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, dados_exemplo)
        
        # Confirmar as alterações
        conn.commit()
        
        # Verificar quantos registros foram inseridos
        cursor.execute("SELECT COUNT(*) FROM crimes_contravencoes WHERE ativo = 1")
        total = cursor.fetchone()[0]
        print(f"✅ {total} registros de exemplo inseridos")
        
        # Mostrar alguns registros inseridos
        cursor.execute("""
            SELECT tipo, dispositivo_legal, artigo, descricao_artigo 
            FROM crimes_contravencoes 
            WHERE ativo = 1 
            ORDER BY tipo, dispositivo_legal, artigo 
            LIMIT 5
        """)
        
        registros = cursor.fetchall()
        print("\\n📋 Primeiros registros inseridos:")
        for reg in registros:
            print(f"  - {reg[0]} | {reg[1]} | Art. {reg[2]} | {reg[3][:80]}...")
        
        conn.close()
        
        print("\\n✅ Migração concluída com sucesso!")
        print(f"💾 Backup salvo em: {backup_path}")
        print("\\n🔗 A tabela crimes_contravencoes está pronta para ser utilizada nos processos/procedimentos.")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Iniciando migração para tabela de crimes e contravenções...")
    sucesso = executar_migracao()
    
    if sucesso:
        print("\\n✅ Migração executada com sucesso!")
    else:
        print("\\n❌ Migração falhou. Verifique os logs de erro acima.")
