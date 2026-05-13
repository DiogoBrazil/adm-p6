# Inventário do Projeto — adm-p6

> Gerado pelo Scout em 2026-05-12
> Aplicação desktop policial militar de gestão disciplinar. Plataforma atual: Python + Eel. Alvo de migração: Rust + Tauri.

---

## Resumo Executivo

| Item | Detalhe |
|------|---------|
| **Nome do projeto** | adm-p6 (Gestão P6 — SJD GESTOR) |
| **Domínio** | Gestão disciplinar da Polícia Militar de Rondônia |
| **Tipo de app** | Desktop (Eel + PyInstaller → Gestao-P6.exe) |
| **Linguagem principal** | Python 3.12 |
| **Frontend** | HTML/JS/CSS embarcado via Eel |
| **Banco de dados** | PostgreSQL 16 (psycopg2, SQLAlchemy, Alembic) |
| **Total de arquivos** | ~133 (excl. .venv, .git, __pycache__) |
| **Funções expostas ao frontend** | 73 (`@eel.expose`) |

---

## Estrutura de Pastas

```
adm-p6/
├── main.py                         ← Entry point: inicializa Eel, DB, registra rotas
├── db_config.py                    ← Gerenciador de conexão PostgreSQL
├── prazos_andamentos_manager.py    ← Manager de prazos e andamentos
├── requirements.txt                ← Dependências Python
├── alembic.ini                     ← Config de migrações
├── docker-compose.yml              ← PostgreSQL 16 em container
├── .env.example                    ← Template de variáveis de ambiente
├── README.md
│
├── app/                            ← Lógica de negócio principal
│   ├── __init__.py
│   ├── art29.py                    ← Módulo Art. 29 (catálogo de infrações)
│   ├── catalogos.py                ← Catálogos (municípios, distritos)
│   ├── processos.py                ← Processos/procedimentos disciplinares
│   ├── rdpm.py                     ← RDPM (Regulamento Disciplinar PM)
│   ├── utils.py                    ← Utilitários compartilhados
│   │
│   ├── routers/                    ← Handlers @eel.expose (interface JS→Python)
│   │   ├── __init__.py             ← registrar_todas_rotas()
│   │   ├── auth.py                 ← Login, logout, sessão
│   │   ├── catalogos.py            ← Municípios e distritos
│   │   ├── rdpm.py                 ← Transgressões RDPM
│   │   ├── art29.py                ← Infrações Art. 29
│   │   ├── processos.py            ← Processos/procedimentos disciplinares
│   │   ├── usuarios.py             ← Gestão de policiais
│   │   ├── prazos.py               ← Prazos processuais
│   │   ├── andamentos.py           ← Andamentos/movimentações
│   │   ├── indicios.py             ← Indícios por PM envolvido
│   │   ├── mapas.py                ← Mapas mensais
│   │   ├── relatorios.py           ← Geração de PDFs/relatórios
│   │   └── auditorias.py           ← Trilha de auditoria
│   │
│   └── services/                   ← Camada de serviços (acesso a dados)
│       ├── db.py                   ← DatabaseManager
│       ├── auditorias.py
│       ├── estatisticas.py
│       ├── indicios.py
│       ├── mapas_relatorios.py
│       ├── outros.py
│       ├── prazos_andamentos.py
│       ├── processos_service.py
│       └── usuarios.py
│
├── alembic/                        ← Migrações de banco de dados
│   ├── env.py
│   └── versions/
│       ├── 0001_bootstrap_core_tables.py
│       ├── 0002_add_foreign_keys.py
│       ├── 0003_alter_columns_to_jsonb.py
│       ├── 0004_add_indexes.py
│       ├── 0005_fix_transgressoes_id_serial.py
│       └── 0006_add_pdf_processos.py
│
├── web/                            ← Frontend HTML/JS/CSS
│   ├── login.html
│   ├── dashboard.html
│   ├── procedure_list.html         ← Lista de processos/procedimentos
│   ├── procedure_form.html         ← Formulário de cadastro/edição
│   ├── procedure_view.html         ← Visualização detalhada
│   ├── procedures_hub.html         ← Hub de procedimentos
│   ├── transgressao_list.html      ← Catálogo RDPM
│   ├── transgressao_form.html      ← Formulário de transgressão
│   ├── crime_list.html             ← Catálogo de crimes
│   ├── crime_form.html             ← Formulário de crime
│   ├── user_list.html              ← Lista de policiais
│   ├── user_form.html              ← Formulário de policial
│   ├── user_view.html              ← Visualização de policial
│   ├── users_hub.html              ← Hub de usuários
│   ├── auditoria_list.html         ← Log de auditoria
│   ├── estatisticas_encarregados.html
│   ├── estatisticas_processos.html
│   ├── mapa_mensal.html
│   ├── mapas_anteriores.html
│   ├── estatuto_art29.html
│   ├── estatuto_art29_form.html
│   └── static/
│       ├── css/  (15 arquivos)
│       ├── js/   (33 arquivos)
│       └── images/
│
└── static/                         ← Assets complementares
    └── js/ (4 arquivos utilitários)
```

---

## Módulos de Negócio (12)

| Módulo | Router | Funções | Responsabilidade |
|--------|--------|---------|-----------------|
| **auth** | `routers/auth.py` | 3 | Login, logout, sessão do usuário |
| **catalogos** | `routers/catalogos.py` | ~2 | Municípios e distritos de Rondônia |
| **rdpm** | `routers/rdpm.py` | ~5 | Catálogo de transgressões RDPM |
| **art29** | `routers/art29.py` | ~5 | Catálogo de infrações Art. 29 do Estatuto |
| **processos** | `routers/processos.py` | 22 | Processos/procedimentos disciplinares (PAD, CD, CJ, IPM, TA, AIT, RI) |
| **usuarios** | `routers/usuarios.py` | 10 | Gestão de policiais (Oficiais e Praças) |
| **prazos** | `routers/prazos.py` | 8 | Prazos processuais, prorrogações |
| **andamentos** | `routers/andamentos.py` | 6 | Andamentos/movimentações dos processos |
| **indicios** | `routers/indicios.py` | 7 | Indícios por PM envolvido em procedimento |
| **mapas** | `routers/mapas.py` | 6 | Mapas mensais de ocorrências |
| **relatorios** | `routers/relatorios.py` | 7 | Geração de PDFs e relatórios (ReportLab) |
| **auditorias** | `routers/auditorias.py` | 5 | Trilha de auditoria (CREATE/UPDATE/DELETE) |

**Total de funções `@eel.expose`:** 73 (fonte: `ANALISE_FUNCOES_EEL.md`)

---

## Contagem de Arquivos por Extensão

| Extensão | Quantidade | Descrição |
|----------|-----------|-----------|
| `.py` | 39 | Python (backend + migrações) |
| `.js` | 37 | JavaScript (frontend Eel) |
| `.html` | 26 | Templates HTML (Eel serve como local) |
| `.css` | 15 | Estilos |
| `.md` | 5 | Documentação |
| `.png/.ico` | 3 | Imagens/ícone |
| Outros | 8 | .yml, .txt, .json, .ini, .env, .gitignore... |
| **Total** | **~133** | |

---

## Pontos de Entrada

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `main.py` | `app_entry` | Inicializa Eel, abre browser, conecta PostgreSQL, registra todas as rotas |
| `web/login.html` | `ui_entry` | Primeira tela carregada pelo Eel |
| `app/routers/__init__.py` | `router_registry` | Centraliza registro de todas as 73 rotas |

### Fluxo de inicialização
```
main.py
  → init_postgres_manager()    # conecta PostgreSQL
  → DatabaseManager()          # inicializa schema se necessário
  → PrazosAndamentosManager()  # manager de prazos
  → registrar_todas_rotas()    # registra 73 @eel.expose
  → eel.start('login.html')    # abre janela desktop
```

---

## Banco de Dados

| Item | Detalhe |
|------|---------|
| **SGBD** | PostgreSQL 16 |
| **Porta** | 5438 (Docker) / 5432 (produção) |
| **Database** | `adm_p6_db` |
| **ORM** | SQLAlchemy 2.0.44 (Alembic) + psycopg2-binary direto |
| **Migrações** | 6 arquivos Alembic |
| **Infra** | Docker Compose (`adm-p6-postgres`) |

**Tabelas identificadas em main.py (superficial):**
- `usuarios` — policiais militares (Oficiais e Praças)
- `processos_procedimentos` — processos disciplinares (PAD, CD, CJ, etc.)
- `auditoria` — trilha de operações
- *(demais tabelas detectadas via Alembic — análise completa pelo Data Master)*

**Política de migração:** banco **reutilizado sem alterações** na versão Rust/Tauri.

---

## Configuração e CI/CD

| Arquivo | Conteúdo |
|---------|---------|
| `.env.example` | DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DATABASE_URL |
| `alembic.ini` | sqlalchemy.url = postgresql+psycopg2://placeholder (override via .env) |
| `docker-compose.yml` | PostgreSQL 16, porta 5438, volume persistente |
| `requirements.txt` | Todas as dependências Python |

**CI/CD:** nenhum pipeline detectado (.github/, Jenkinsfile, .gitlab-ci.yml ausentes).

---

## Empacotamento

```bash
pyinstaller --noconsole --onefile \
  --add-data="web;web" \
  --add-data="static;static" \
  --add-data="db_config.py;." \
  --add-data="prazos_andamentos_manager.py;." \
  --icon="web/static/images/SJD-GESTOR.ico" \
  --name="Gestao-P6" main.py
```

Gera executável `Gestao-P6.exe` para Windows.

---

## Autenticação e Controle de Acesso

| Mecanismo | Detalhe |
|-----------|---------|
| **Hash de senha** | bcrypt (migração automática de SHA-256 legado) |
| **Sessão** | Variável global `usuario_logado` em memória (processo Eel) |
| **Guard login** | `_guard_login()` — retorna erro se não logado |
| **Guard admin** | `_guard_admin()` — retorna erro se perfil ≠ 'admin' |
| **Perfis** | `admin` e `comum` |
| **Tipos de policial** | `Oficial` e `Praça` |
| **Flags** | `is_encarregado`, `is_operador`, `ativo` |

---

## Testes

| Item | Detalhe |
|------|---------|
| **Framework** | pytest 7.4.3 + pytest-cov 4.1.0 (presente em requirements.txt) |
| **Arquivos de teste** | 0 (nenhum arquivo test_*.py encontrado no projeto) |
| **Cobertura** | Não mensurável (sem testes) |

---

## Contexto de Negócio

O sistema **Gestão P6 (SJD GESTOR)** é uma aplicação de gestão disciplinar policial militar:

- Gerencia processos e procedimentos disciplinares (PAD — Processo Administrativo Disciplinar, CD — Conselho de Disciplina, CJ — Conselho de Justificação, IPM, TA, AIT, RI)
- Controla policiais envolvidos como indiciados, responsáveis, escrivães, presidentes
- Registra transgressões com base no RDPM (Regulamento Disciplinar) e infrações do Art. 29 do Estatuto
- Acompanha prazos processuais com alertas de vencimento
- Documenta andamentos e movimentações
- Gera mapas mensais e relatórios em PDF
- Mantém trilha de auditoria completa
- Suporta substituição de encarregados com histórico
- Produz estatísticas por encarregado e por tipo de processo
