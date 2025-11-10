# adm-p6

# Comando para gerar executável

```
pyinstaller --noconsole --onefile --add-data="web;web" --add-data="static;static" --add-data="db_config.py;." --add-data="prazos_andamentos_manager.py;." --add-data="migrations;migrations" --icon="C:\Users\diogo\OneDrive\Área de Trabalho\APPS\Gestao P6\adm-p6\web\static\images\SJD-GESTOR.ico" --name="Gestao-P6" main.py

