import os
import sys
import logging

# Configura logging para visualizar erros
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Importa o arquivo principal
try:
    print("Iniciando aplicação...")
    import main
    
    # Inicia a aplicação
    if __name__ == '__main__':
        print("Executando aplicação...")
        
        # Verifica se o sistema está executando em desenvolvimento ou como app
        if getattr(sys, 'frozen', False):
            # Executável PyInstaller
            main.start_app(sys.argv[0])
        else:
            # Ambiente de desenvolvimento
            main.start_app(os.path.dirname(os.path.abspath(__file__)))
            
except Exception as e:
    print(f"Erro ao iniciar aplicação: {e}")
    import traceback
    traceback.print_exc()
    input("Pressione ENTER para sair...")
