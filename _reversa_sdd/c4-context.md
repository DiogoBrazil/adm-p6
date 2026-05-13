# C4 — Nível 1: Contexto do Sistema

> Gerado pelo Arquiteto em 2026-05-12

---

## Diagrama

```mermaid
C4Context
    title Sistema Gestão P6 — Contexto

    Person(admin, "Administrador", "Operador com perfil admin.\nGerencia usuários, catálogos e\nacessa trilha de auditoria.")
    Person(operador, "Operador Comum", "PM com is_operador=TRUE.\nRegistra processos, prazos,\nandamentos e relatórios.")

    System(gestaoP6, "Gestão P6 (SJD GESTOR)", "Aplicação desktop para gestão\ndisciplinar da PMRO.\nPython + Eel · PostgreSQL 16")

    System_Ext(docker, "Docker Desktop", "Hospeda o contêiner\nPostgreSQL 16 localmente.\nPorta 5438.")
    System_Ext(chrome, "Google Chrome / Browser", "Janela de UI renderizada\npelo Eel via Chromium.\nLocalhost:8000.")
    System_Ext(pyinstaller, "Gestao-P6.exe", "Bundle distribuído via\nPyInstaller para Windows.\nNão inclui o banco.")

    Rel(admin, gestaoP6, "Usa", "Eel WebSocket / browser")
    Rel(operador, gestaoP6, "Usa", "Eel WebSocket / browser")
    Rel(gestaoP6, docker, "Lê/Escreve", "psycopg2 · TCP/5438")
    Rel(gestaoP6, chrome, "Renderiza UI", "HTTP localhost:8000")
    UpdateRelStyle(gestaoP6, chrome, $offsetY="-10")
```

---

## Notas

- **Single-user por instância:** a sessão é uma variável global em memória (`usuario_logado`). Apenas um usuário pode estar logado por processo Python.
- **Sem internet:** nenhuma chamada externa. Todos os dados ficam no banco local.
- **Dependência de runtime:** o Docker precisa estar rodando antes de abrir o `.exe`. Não há PostgreSQL embarcado.
- **Modo de janela:** tenta Chrome primeiro; cai para o browser padrão do SO se Chrome não for encontrado.
