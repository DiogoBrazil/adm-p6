# Visão Geral Arquitetural — Gestão P6 (SJD GESTOR)

> Gerado pelo Arquiteto em 2026-05-12
> Aplicação desktop de gestão disciplinar da Polícia Militar de Rondônia

---

## Resumo Executivo

O **Gestão P6** é uma aplicação desktop **single-user** construída com Python + Eel. A UI é renderizada em um browser (Chrome ou padrão do SO) como janela nativa. A comunicação entre frontend e backend ocorre via **WebSocket** usando o protocolo proprietário do Eel. O banco de dados PostgreSQL 16 roda em Docker localmente.

O sistema não possui integrações externas com APIs de terceiros. É inteiramente autocontido na máquina do operador.

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | HTML5 / CSS3 / JavaScript (vanilla) | — |
| Desktop shell | Eel | 0.18.2 |
| HTTP embedding | Bottle + gevent-websocket | 0.13.4 |
| Backend | Python | 3.12 |
| ORM/Migrations | SQLAlchemy + Alembic | 2.0.44 / 1.17.1 |
| DB driver | psycopg2-binary | 2.9.11 |
| Banco de dados | PostgreSQL | 16 |
| Geração de PDF | ReportLab | 4.0.7 |
| Hashing senhas | bcrypt | 4.0.1 |
| Packaging | PyInstaller | 6.16.0 |
| Infraestrutura | Docker (apenas banco) | — |

---

## Estrutura de Camadas

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND  (web/  → servido pelo Eel em localhost:8000)     │
│                                                              │
│  26 páginas HTML  ·  37 arquivos JS  ·  15 arquivos CSS     │
│  login.html · dashboard.html · procedure_form.html · ...    │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket (eel.expose / eel.js_func)
┌──────────────────────▼──────────────────────────────────────┐
│  ROUTERS  (app/routers/*.py — 12 módulos, 73 funções)       │
│                                                              │
│  auth · catalogos · rdpm · art29 · processos · usuarios     │
│  prazos · andamentos · indicios · mapas · relatorios        │
│  auditorias                                                  │
│                                                              │
│  → Validam sessão via _guard_login / _guard_admin           │
│  → Delegam lógica para Services                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ chamada direta Python
┌──────────────────────▼──────────────────────────────────────┐
│  SERVICES  (app/services/*.py — 8 módulos)                  │
│                                                              │
│  processos_service · usuarios · prazos_andamentos           │
│  indicios · mapas_relatorios · auditorias · db · outros     │
│                                                              │
│  + prazos_andamentos_manager.py (manager com estado)        │
└──────────────────────┬──────────────────────────────────────┘
                       │ psycopg2
┌──────────────────────▼──────────────────────────────────────┐
│  BANCO DE DADOS  (PostgreSQL 16 · Docker · porta 5438)      │
│                                                              │
│  13 tabelas · JSONB inline · UUID e SERIAL como PKs         │
└─────────────────────────────────────────────────────────────┘
```

---

## Módulos e Responsabilidades

| Módulo | Router | Service | Tabelas | Funções |
|--------|--------|---------|---------|---------|
| auth | `routers/auth.py` | inline em `main.py` | usuarios | 3 |
| catalogos | `routers/catalogos.py` | `app/catalogos.py` | crimes_contravencoes, municipios_distritos | 6 |
| rdpm | `routers/rdpm.py` | `app/rdpm.py` | transgressoes | 5 |
| art29 | `routers/art29.py` | `app/art29.py` | infracoes_estatuto_art29 | 5 |
| processos | `routers/processos.py` | `services/processos_service.py` | processos_procedimentos + 4 | 22+ |
| usuarios | `routers/usuarios.py` | `services/usuarios.py` | usuarios | 13 |
| prazos | `routers/prazos.py` | `services/prazos_andamentos.py` | prazos_processo | 8 |
| andamentos | `routers/andamentos.py` | `services/prazos_andamentos.py` | processos_proc. (JSONB) | 6 |
| indicios | `routers/indicios.py` | `services/indicios.py` | pm_envolvido_* (4 tabelas) | 8 |
| mapas | `routers/mapas.py` | `services/mapas_relatorios.py` | mapas_salvos | 7 |
| relatorios | `routers/relatorios.py` | `services/mapas_relatorios.py` | — (leitura cross) | 7 |
| auditorias | `routers/auditorias.py` | `services/auditorias.py` | auditoria | 5 |

---

## Ponto de Entrada e Startup

```
main.py
  ├── eel.init('web')           # serve pasta web/ em localhost:8000
  ├── init_postgres_manager()   # conecta ao PostgreSQL
  ├── DatabaseManager()         # cria tabelas IF NOT EXISTS (fallback)
  ├── PrazosAndamentosManager() # manager com estado para prazos
  ├── registrar_todas_rotas()   # registra os 73 @eel.expose
  └── eel.start('login.html', mode='chrome', size=(1000,700), port=8000)
       └── fallback: mode='default' se Chrome não encontrado
```

---

## Packaging (Windows)

```
PyInstaller → Gestao-P6.exe (bundle único)
  ├── Python runtime
  ├── web/ (HTML/JS/CSS embutidos)
  ├── app/ (código backend)
  └── Eel + dependências
```

O banco PostgreSQL **não é embutido** no .exe — requer Docker separado ou PostgreSQL local na máquina destino.

---

## Dívidas Técnicas Identificadas

| # | Dívida | Severidade | Módulo |
|---|--------|-----------|--------|
| 🔴 TD-01 | `main.py` com 7.283 linhas — monolito com lógica legada não migrada | Alta | main.py |
| 🔴 TD-02 | Zero testes automatizados (`test_file_count = 0`) | Alta | Global |
| 🔴 TD-03 | `atualizar_usuario` usa SHA-256 para senha (inconsistência com bcrypt) | Alta | usuarios |
| 🔴 TD-04 | Validações críticas apenas no frontend (datas futuras, PADS sem transgressão) | Alta | processos |
| 🟡 TD-05 | Múltiplos arquivos JS duplicados (`_backup.js`, `_clean.js`, `_debug.js`, `_old.js`) | Média | web/static/js |
| 🟡 TD-06 | Padrão de resposta duplo (sucesso/mensagem vs success/error) | Média | Global |
| 🟡 TD-07 | Conexão de banco criada e fechada por request (sem pool) | Média | db_config.py |
| 🟡 TD-08 | Debug `print()` em produção (especialmente em `salvar_indicios_pm_envolvido`) | Baixa | indicios |
| 🟡 TD-09 | Tabelas `procedimentos_indicios_*` com uso incerto (possível resquício) | Média | DB |
| 🟡 TD-10 | `main.py` duplica `DatabaseManager` — existe também em `app/services/db.py` | Média | main.py |

---

## Integrações Externas

**Nenhuma.** O sistema é totalmente autocontido. Não há:
- APIs REST externas consumidas
- Webhooks
- Envio de email
- Autenticação OAuth
- Serviços de nuvem

A única dependência "externa" é o Docker para o PostgreSQL, que roda localmente.

---

## Referências de Artefatos

| Artefato | Arquivo |
|----------|---------|
| C4 Contexto | `c4-context.md` |
| C4 Containers | `c4-containers.md` |
| C4 Componentes | `c4-components.md` |
| ERD Completo | `erd-complete.md` |
| Spec Impact Matrix | `traceability/spec-impact-matrix.md` |
| Permissões (RBAC) | `permissions.md` |
| Regras de Domínio | `domain.md` |
| Máquinas de Estado | `state-machines.md` |
| ADRs | `adrs/0001-*.md` … `adrs/0007-*.md` |
