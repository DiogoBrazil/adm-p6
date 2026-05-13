# Dependências — adm-p6

> Gerado pelo Scout em 2026-05-12
> Fonte: `requirements.txt` + `docker-compose.yml`

---

## Dependências Python (requirements.txt)

### Críticas — Core do Sistema

| Pacote | Versão | Papel |
|--------|--------|-------|
| `Eel` | 0.18.2 | Framework desktop Python/JS — **substituído por Tauri na migração** |
| `psycopg2-binary` | 2.9.11 | Driver PostgreSQL — comunicação direta com banco |
| `SQLAlchemy` | 2.0.44 | ORM — usado pelo Alembic para migrações |
| `alembic` | 1.17.1 | Gerenciador de migrações de banco |
| `bcrypt` | 4.0.1 | Hash seguro de senhas |
| `reportlab` | 4.0.7 | Geração de PDFs (relatórios e mapas) |

### Servidor Web Embarcado (Eel)

| Pacote | Versão | Papel |
|--------|--------|-------|
| `bottle` | 0.13.4 | Micro-framework HTTP usado internamente pelo Eel |
| `bottle-websocket` | 0.2.9 | WebSocket para comunicação Python↔JS no Eel |
| `gevent` | 25.5.1 | Servidor WSGI assíncrono (base do Eel) |
| `gevent-websocket` | 0.10.1 | WebSocket suporte para gevent |
| `greenlet` | 3.2.3 | Coroutines para gevent |

### Utilitários

| Pacote | Versão | Papel |
|--------|--------|-------|
| `pillow` | 12.0.0 | Processamento de imagens (logos em PDFs) |
| `schedule` | 1.2.0 | Agendamento de tarefas (verificação de prazos) |
| `colorama` | 0.4.6 | Cores no terminal |

### Testes

| Pacote | Versão | Papel |
|--------|--------|-------|
| `pytest` | 7.4.3 | Framework de testes |
| `pytest-cov` | 4.1.0 | Cobertura de código |
| `coverage` | 7.11.3 | Medição de cobertura |

### Empacotamento

| Pacote | Versão | Papel |
|--------|--------|-------|
| `pyinstaller` | 6.16.0 | Gera executável Windows (Gestao-P6.exe) |
| `pyinstaller-hooks-contrib` | 2025.9 | Hooks de empacotamento |
| `pefile` | 2023.2.7 | Análise de executáveis PE (Windows) |
| `pywin32-ctypes` | 0.2.3 | Bindings Windows (empacotamento) |

### Dependências Transitivas (selecionadas)

| Pacote | Versão | Transitiva de |
|--------|--------|--------------|
| `Mako` | 1.3.10 | Alembic (templates de migração) |
| `MarkupSafe` | 3.0.3 | Mako |
| `future` | 1.0.0 | Eel |
| `importlib_resources` | 6.5.2 | Eel |
| `typing_extensions` | 4.14.1 | SQLAlchemy |
| `pyparsing` | 3.2.3 | Geral |
| `packaging` | 25.0 | Geral |

---

## Infraestrutura (docker-compose.yml)

| Serviço | Imagem | Porta | Volume |
|---------|--------|-------|--------|
| `adm-p6-postgres` | `postgres:16` | `5438:5432` | `adm_p6_pgdata` |

---

## Runtime

| Componente | Versão |
|-----------|--------|
| Python | 3.12 (inferido do .venv) |
| PostgreSQL | 16 |
| Node.js | N/A (não usado — Eel usa o Chrome/Edge do sistema) |

---

## Notas para Migração Rust/Tauri

| Componente Python | Equivalente Rust/Tauri |
|-------------------|----------------------|
| `Eel` (framework desktop) | `Tauri` |
| `psycopg2-binary` (driver PG) | `sqlx` ou `tokio-postgres` |
| `SQLAlchemy` (ORM) | `sqlx` (query builder) ou `diesel` (ORM) |
| `Alembic` (migrações) | `sqlx migrate` ou `refinery` |
| `reportlab` (PDF) | `printpdf` ou integração com wkhtmltopdf/headless |
| `bcrypt` (hash) | `bcrypt` crate ou `argon2` |
| `bottle/gevent` (HTTP) | Tauri IPC (substitui totalmente) |
| `schedule` (agendamento) | `tokio` + timer tasks |
| `PyInstaller` (empacotamento) | `tauri build` (nativo) |
