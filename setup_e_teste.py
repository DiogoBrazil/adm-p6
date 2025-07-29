# setup_e_teste.py - Script para configurar e testar o sistema
import os
import sqlite3
import sys
from pathlib import Path

def criar_estrutura_projeto():
    """Cria a estrutura de pastas do projeto"""
    print("📁 Criando estrutura do projeto...")
    
    # Criar pasta web se não existir
    web_dir = Path("web")
    if not web_dir.exists():
        web_dir.mkdir()
        print("   ✅ Pasta 'web' criada")
    else:
        print("   ℹ️  Pasta 'web' já existe")
    
    # Verificar arquivos necessários
    arquivos_necessarios = {
        "main.py": "Arquivo principal Python",
        "web/login.html": "Tela de login",
        "web/dashboard.html": "Dashboard admin"
    }
    
    print("\n📋 Verificando arquivos necessários...")
    for arquivo, descricao in arquivos_necessarios.items():
        if Path(arquivo).exists():
            print(f"   ✅ {arquivo} - {descricao}")
        else:
            print(f"   ❌ {arquivo} - {descricao} (FALTANDO)")
    
    return True

def verificar_dependencias():
    """Verifica se as dependências estão instaladas"""
    print("\n🔧 Verificando dependências...")
    
    dependencias = ['eel', 'sqlite3', 'hashlib']
    missing = []
    
    for dep in dependencias:
        try:
            if dep == 'sqlite3':
                import sqlite3
                print(f"   ✅ {dep} - OK (versão {sqlite3.sqlite_version})")
            elif dep == 'eel':
                import eel
                print(f"   ✅ {dep} - OK")
            elif dep == 'hashlib':
                import hashlib
                print(f"   ✅ {dep} - OK")
        except ImportError:
            missing.append(dep)
            print(f"   ❌ {dep} - FALTANDO")
    
    if missing:
        print(f"\n⚠️  Para instalar dependências faltantes:")
        for dep in missing:
            if dep != 'sqlite3' and dep != 'hashlib':  # Estes vêm com Python
                print(f"   pip install {dep}")
        return False
    
    return True

def testar_banco_dados():
    """Testa a criação e operações básicas do banco"""
    print("\n🗄️  Testando banco de dados SQLite...")
    
    try:
        # Criar banco de teste
        test_db = "test_usuarios.db"
        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()
        
        # Criar tabela
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_usuarios (
                id INTEGER PRIMARY KEY,
                nome TEXT,
                email TEXT,
                senha TEXT
            )
        ''')
        
        # Inserir dados de teste
        cursor.execute('''
            INSERT INTO test_usuarios (nome, email, senha) 
            VALUES (?, ?, ?)
        ''', ("Teste", "teste@teste.com", "123456"))
        
        # Consultar dados
        cursor.execute("SELECT * FROM test_usuarios")
        result = cursor.fetchone()
        
        conn.commit()
        conn.close()
        
        # Remover arquivo de teste
        os.remove(test_db)
        
        if result:
            print("   ✅ SQLite funcionando corretamente")
            print(f"   ℹ️  Dados de teste: {result}")
            return True
        else:
            print("   ❌ Erro ao inserir/consultar dados")
            return False
            
    except Exception as e:
        print(f"   ❌ Erro no banco de dados: {e}")
        return False

def criar_banco_inicial():
    """Cria o banco inicial com usuário admin"""
    print("\n👤 Configurando banco inicial...")
    
    try:
        import hashlib
        
        # Conecta ao banco
        conn = sqlite3.connect('usuarios.db')
        cursor = conn.cursor()
        
        # Criar tabela usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ativo BOOLEAN DEFAULT 1
            )
        ''')
        
        # Criar usuário admin se não existir
        cursor.execute("SELECT id FROM usuarios WHERE email = 'admin' AND is_admin = 1")
        if not cursor.fetchone():
            senha_hash = hashlib.sha256('123456'.encode()).hexdigest()
            cursor.execute('''
                INSERT INTO usuarios (nome, email, senha, is_admin) 
                VALUES (?, ?, ?, ?)
            ''', ('Administrador', 'admin', senha_hash, 1))
            print("   ✅ Usuário admin criado")
        else:
            print("   ℹ️  Usuário admin já existe")
        
        conn.commit()
        conn.close()
        
        print(f"   ✅ Banco configurado: usuarios.db")
        return True
        
    except Exception as e:
        print(f"   ❌ Erro ao configurar banco: {e}")
        return False

def mostrar_informacoes_sistema():
    """Mostra informações do sistema configurado"""
    print("\n" + "="*60)
    print("📊 INFORMAÇÕES DO SISTEMA")
    print("="*60)
    
    # Informações do banco
    if os.path.exists('usuarios.db'):
        conn = sqlite3.connect('usuarios.db')
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT COUNT(*) FROM usuarios")
            total_users = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM usuarios WHERE is_admin = 1")
            total_admins = cursor.fetchone()[0]
            
            print(f"🗄️  Banco: usuarios.db")
            print(f"👥 Total de usuários: {total_users}")
            print(f"👑 Administradores: {total_admins}")
        except:
            print("🗄️  Banco: usuarios.db (vazio ou erro)")
        
        conn.close()
    else:
        print("🗄️  Banco: não encontrado")
    
    # Credenciais
    print(f"\n🔑 CREDENCIAIS DE ACESSO:")
    print(f"   👤 Usuário: admin")
    print(f"   🔒 Senha: 123456")
    
    # Arquivos
    print(f"\n📁 ARQUIVOS DO PROJETO:")
    arquivos = [
        ("main.py", "Backend Python"),
        ("usuarios.db", "Banco SQLite"),
        ("web/login.html", "Tela de login"),
        ("web/dashboard.html", "Dashboard admin")
    ]
    
    for arquivo, descricao in arquivos:
        status = "✅" if os.path.exists(arquivo) else "❌"
        print(f"   {status} {arquivo} - {descricao}")

def executar_testes():
    """Executa todos os testes"""
    print("="*60)
    print("🧪 EXECUTANDO TESTES DO SISTEMA")
    print("="*60)
    
    testes = [
        ("Estrutura do projeto", criar_estrutura_projeto),
        ("Dependências", verificar_dependencias),
        ("Banco de dados", testar_banco_dados),
        ("Configuração inicial", criar_banco_inicial)
    ]
    
    resultados = []
    
    for nome, funcao in testes:
        print(f"\n🔍 Testando: {nome}")
        resultado = funcao()
        resultados.append((nome, resultado))
    
    # Resumo dos testes
    print("\n" + "="*60)
    print("📋 RESUMO DOS TESTES")
    print("="*60)
    
    todos_ok = True
    for nome, resultado in resultados:
        status = "✅ PASSOU" if resultado else "❌ FALHOU"
        print(f"   {status} - {nome}")
        if not resultado:
            todos_ok = False
    
    if todos_ok:
        print(f"\n🎉 TODOS OS TESTES PASSARAM!")
        print(f"✅ Sistema pronto para uso!")
        mostrar_informacoes_sistema()
        
        print(f"\n🚀 COMO EXECUTAR:")
        print(f"   python main.py")
        
    else:
        print(f"\n⚠️  ALGUNS TESTES FALHARAM!")
        print(f"❌ Verifique os erros acima antes de continuar")
    
    return todos_ok

def criar_usuario_admin_manual():
    """Permite criar usuário admin manualmente"""
    print("\n👤 CRIAR USUÁRIO ADMINISTRADOR")
    print("-" * 40)
    
    try:
        nome = input("📝 Nome do administrador: ").strip()
        email = input("📧 Email/usuário: ").strip()
        senha = input("🔒 Senha: ").strip()
        
        if not nome or not email or not senha:
            print("❌ Todos os campos são obrigatórios!")
            return
        
        import hashlib
        
        conn = sqlite3.connect('usuarios.db')
        cursor = conn.cursor()
        
        # Verifica se email já existe
        cursor.execute("SELECT id FROM usuarios WHERE email = ?", (email,))
        if cursor.fetchone():
            print("❌ Email já está em uso!")
            conn.close()
            return
        
        # Cria usuário admin
        senha_hash = hashlib.sha256(senha.encode()).hexdigest()
        cursor.execute('''
            INSERT INTO usuarios (nome, email, senha, is_admin) 
            VALUES (?, ?, ?, 1)
        ''', (nome, email, senha_hash))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Usuário admin criado com sucesso!")
        print(f"   👤 Nome: {nome}")
        print(f"   📧 Email: {email}")
        print(f"   🔒 Senha: {senha}")
        
    except Exception as e:
        print(f"❌ Erro ao criar usuário: {e}")

def executar_aplicacao():
    """Executa a aplicação principal"""
    print("\n🚀 EXECUTANDO APLICAÇÃO...")
    print("-" * 40)
    
    # Verifica se main.py existe
    if not os.path.exists('main.py'):
        print("❌ Arquivo main.py não encontrado!")
        return
    
    # Verifica se pasta web existe
    if not os.path.exists('web'):
        print("❌ Pasta web não encontrada!")
        return
    
    print("✅ Iniciando aplicação...")
    print("📌 Para parar a aplicação, pressione Ctrl+C")
    print("🌐 A aplicação abrirá no navegador automaticamente")
    
    try:
        # Executa main.py
        os.system("python main.py")
    except KeyboardInterrupt:
        print("\n👋 Aplicação interrompida pelo usuário")
    except Exception as e:
        print(f"❌ Erro ao executar aplicação: {e}")

def limpar_banco():
    """Limpa o banco de dados"""
    print("\n🧹 LIMPAR BANCO DE DADOS")
    print("-" * 40)
    
    if not os.path.exists('usuarios.db'):
        print("ℹ️  Banco de dados não existe")
        return
    
    confirmacao = input("⚠️  Tem certeza que deseja apagar TODOS os dados? (digite 'CONFIRMAR'): ")
    
    if confirmacao != 'CONFIRMAR':
        print("❌ Operação cancelada")
        return
    
    try:
        os.remove('usuarios.db')
        print("✅ Banco de dados removido com sucesso!")
        print("ℹ️  Execute a opção 2 para recriar o banco")
    except Exception as e:
        print(f"❌ Erro ao remover banco: {e}")

def verificar_porta_disponivel(porta=8000):
    """Verifica se a porta está disponível"""
    import socket
    
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('localhost', porta))
            return True
    except OSError:
        return False

def mostrar_ajuda():
    """Mostra ajuda sobre o sistema"""
    print("\n" + "="*60)
    print("📚 AJUDA - Sistema Login com SQLite")
    print("="*60)
    
    print("\n🎯 SOBRE O SISTEMA:")
    print("   • Sistema de login com interface web")
    print("   • Backend em Python com Eel")
    print("   • Banco de dados SQLite local")
    print("   • Interface admin para cadastrar usuários")
    
    print("\n📁 ARQUIVOS PRINCIPAIS:")
    print("   • main.py - Backend Python")
    print("   • web/login.html - Tela de login")
    print("   • web/dashboard.html - Dashboard admin")
    print("   • usuarios.db - Banco SQLite (criado automaticamente)")
    
    print("\n🔑 CREDENCIAIS PADRÃO:")
    print("   • Usuário: admin")
    print("   • Senha: 123456")
    
    print("\n🚀 COMO USAR:")
    print("   1. Execute este script para configurar")
    print("   2. Use 'python main.py' para iniciar")
    print("   3. Acesse no navegador que abrir")
    print("   4. Faça login como admin")
    print("   5. Cadastre outros usuários no dashboard")
    
    print("\n🔧 SOLUÇÃO DE PROBLEMAS:")
    print("   • Porta ocupada: O sistema tentará outra porta")
    print("   • Banco corrompido: Use opção 6 para limpar")
    print("   • Erro de dependências: pip install eel")
    
    print("\n📞 FUNCIONALIDADES:")
    print("   ✅ Login seguro com hash SHA-256")
    print("   ✅ Cadastro de usuários")
    print("   ✅ Dashboard com estatísticas")
    print("   ✅ Interface responsiva")
    print("   ✅ Banco SQLite local")

def menu_interativo():
    """Menu interativo para o usuário"""
    while True:
        print("\n" + "="*60)
        print("🎛️  MENU DE CONFIGURAÇÃO - Sistema Login SQLite")
        print("="*60)
        print("1. 🧪 Executar todos os testes")
        print("2. 🗄️  Configurar banco de dados")
        print("3. 👤 Criar usuário admin")
        print("4. 📊 Mostrar informações do sistema")
        print("5. 🚀 Executar aplicação")
        print("6. 🧹 Limpar banco de dados")
        print("7. ❌ Sair")
        print("="*60)
        
        try:
            opcao = input("👉 Escolha uma opção (1-7): ").strip()
            
            if opcao == "1":
                executar_testes()
            
            elif opcao == "2":
                print("\n🗄️  Configurando banco de dados...")
                if criar_banco_inicial():
                    print("✅ Banco configurado com sucesso!")
                else:
                    print("❌ Erro ao configurar banco!")
            
            elif opcao == "3":
                criar_usuario_admin_manual()
            
            elif opcao == "4":
                mostrar_informacoes_sistema()
            
            elif opcao == "5":
                executar_aplicacao()
            
            elif opcao == "6":
                limpar_banco()
            
            elif opcao == "7":
                print("👋 Saindo do sistema...")
                break
            
            else:
                print("❌ Opção inválida! Escolha entre 1-7.")
                
        except KeyboardInterrupt:
            print("\n\n👋 Saindo do sistema...")
            break
        except Exception as e:
            print(f"❌ Erro: {e}")

def main():
    """Função principal"""
    print("🎯 CONFIGURADOR DO SISTEMA LOGIN - SQLite + Eel")
    print("Versão 1.0 - Sistema de Gestão de Usuários")
    
    # Mostra ajuda inicial
    mostrar_ajuda()
    
    # Verifica se deve executar testes automaticamente
    if len(sys.argv) > 1:
        if sys.argv[1] == "--test":
            print("\n🧪 Executando testes automaticamente...")
            executar_testes()
            return
        elif sys.argv[1] == "--run":
            print("\n🚀 Executando aplicação diretamente...")
            executar_aplicacao()
            return
        elif sys.argv[1] == "--setup":
            print("\n⚙️  Configurando sistema automaticamente...")
            if executar_testes():
                print("\n✅ Sistema configurado! Execute 'python main.py' para usar.")
            return
    
    # Menu interativo
    menu_interativo()

if __name__ == "__main__":
    main()