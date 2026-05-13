# C4 — Nível 2: Containers

> Gerado pelo Arquiteto em 2026-05-12

---

## Diagrama

```mermaid
C4Container
    title Gestão P6 — Containers

    Person(usuario, "Operador / Admin", "Usuário da PMRO")

    System_Boundary(app, "Gestão P6 Desktop") {

        Container(browser, "Browser Window", "Chrome / WebView",
            "Renderiza as 26 páginas HTML.\nServe assets estáticos via Eel.\nEnvia/recebe mensagens via WebSocket.")

        Container(python_app, "Python App", "Python 3.12 + Eel 0.18.2 + Bottle 0.13.4",
            "Processo principal.\nExpõe 73 funções via @eel.expose.\n12 routers · 8 services.\nGerencia sessão em memória.\nGera PDFs com ReportLab.")

        Container(prazos_mgr, "PrazosAndamentosManager", "Python (stateful)",
            "Manager com estado para\ncálculo e prorrogação de prazos.\nInstanciado uma vez no startup.")
    }

    ContainerDb(postgres, "PostgreSQL 16", "Docker · porta 5438",
        "Banco de dados relacional.\n13 tabelas · JSONB inline.\nVolume persistente em Docker.")

    Rel(usuario, browser, "Interage via", "Mouse / Teclado")
    Rel(browser, python_app, "Chamadas de função", "WebSocket (eel.expose)\nlocalhost:8000")
    Rel(python_app, browser, "Callbacks JS", "eel.js_function()\nWebSocket")
    Rel(python_app, postgres, "CRUD", "psycopg2 · TCP/5438\nSQL direto (sem ORM runtime)")
    Rel(python_app, prazos_mgr, "Delega", "Chamada direta Python")
    Rel(prazos_mgr, postgres, "Lê/Escreve prazos", "psycopg2 · TCP/5438")
```

---

## Detalhamento dos Containers

### Browser Window
- Servido por Eel em `http://localhost:8000`
- 26 páginas HTML com JS vanilla (sem framework)
- Comunicação bidirecional com o Python via WebSocket
- Biblioteca Eel injetada automaticamente: `<script src="/eel.js">`
- Cada página carrega seu JS específico (ex: `procedure_form.js`)

### Python App (processo principal)
- Ponto de entrada: `main.py`
- Startup: conecta ao PostgreSQL → cria tabelas (IF NOT EXISTS) → registra 73 rotas → abre browser
- Sessão: variável global `usuario_logado` (dict ou None)
- Guards: `_guard_login()` e `_guard_admin()` verificados em cada handler
- PDF generation: ReportLab inline nos services

### PrazosAndamentosManager
- Instância única criada no startup (`prazos_andamentos_manager.py`)
- Responsável por: criar prazo inicial, calcular vencimento, prorrogar, concluir
- Repassado como dependência para o router de prazos

### PostgreSQL 16 (Docker)
- Porta mapeada: host `5438` → container `5432`
- Volume nomeado: `adm_p6_pgdata`
- Banco: `adm_p6_db` / Usuário: `adm_p6_user`
- Configuração via `.env` (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS)
- **Não embutido no .exe** — pré-requisito de instalação

---

## Fluxo de uma Requisição Típica

```
Usuário clica botão → JS chama eel.salvar_processo({...})
    → WebSocket → Python router (processos.py)
        → _guard_login() — verifica usuario_logado
        → processos_service.registrar_processo(db_manager, ...)
            → psycopg2 INSERT INTO processos_procedimentos
            → psycopg2 INSERT INTO procedimento_pms_envolvidos
            → db_manager.registrar_auditoria('processos_procedimentos', id, 'CREATE', user_id)
        → return {"sucesso": True, "mensagem": "...", "dados": processo_id}
    → WebSocket → JS callback → atualiza UI
```
