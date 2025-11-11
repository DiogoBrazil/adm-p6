# adm-p6

## Setup Rápido

- Python 3.10+ e virtualenv
- PostgreSQL acessível conforme seu `.env`

```
python -m venv .venv
source .venv/bin/activate  # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
```

Crie um arquivo `.env` (ou copie do `.env.example`) na raiz com:

```
DB_HOST=192.168.0.137
DB_PORT=5432
DB_NAME=app_db
DB_USER=app_user
DB_PASSWORD=p67bpm

# Alembic (opcional; o env.py lê este valor se presente)
DATABASE_URL=postgresql+psycopg2://app_user:p67bpm@192.168.0.137:5432/app_db
```

## Migrações (Alembic)

```
source .venv/bin/activate
alembic upgrade head
```

O Alembic lê automaticamente o `.env` (ou a variável de ambiente `DATABASE_URL`).

## Executar o App

```
source .venv/bin/activate
python main.py
```

Credenciais iniciais: `admin@sistema.com` / `123456`

## Empacotar (PyInstaller)

```
pyinstaller --noconsole --onefile   --add-data="web;web"   --add-data="static;static"   --add-data="db_config.py;."   --add-data="prazos_andamentos_manager.py;."   --icon="web/static/images/SJD-GESTOR.ico"   --name="Gestao-P6" main.py
```

Observação: garanta que o banco está migrado (alembic upgrade head) antes de rodar o executável.
