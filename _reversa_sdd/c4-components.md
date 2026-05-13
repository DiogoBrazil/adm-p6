# C4 — Nível 3: Componentes

> Gerado pelo Arquiteto em 2026-05-12

---

## Container: Python App — Componentes

```mermaid
C4Component
    title Python App — Componentes Internos

    Container_Boundary(python_app, "Python App (main.py + app/)") {

        Component(session, "Session Manager", "variável global usuario_logado",
            "Armazena dict do usuário logado.\nNone = não autenticado.")

        Component(guards, "Guards (RBAC)", "_guard_login / _guard_admin",
            "Verificam sessão e perfil antes\nde cada operação.")

        Component(router_auth, "Router Auth", "app/routers/auth.py",
            "fazer_login · fazer_logout\nobter_usuario_logado")

        Component(router_processos, "Router Processos", "app/routers/processos.py",
            "CRUD de processos/procedimentos.\nPDF · Estatísticas.")

        Component(router_usuarios, "Router Usuários", "app/routers/usuarios.py",
            "Cadastro · Listagem · Desativação.\nAdmin-only: create/update/delete.")

        Component(router_catalogs, "Routers Catálogos", "rdpm · art29 · catalogos",
            "CRUD de catálogos legais.\nAdmin: escrita · Todos: leitura.")

        Component(router_workflow, "Routers Workflow", "prazos · andamentos",
            "Prazos processuais e prorrogações.\nAndamentos (eventos do processo).")

        Component(router_indicios, "Router Indícios", "app/routers/indicios.py",
            "Indícios por PM: crimes CPM,\ntransgressões RDPM, infrações Art.29.")

        Component(router_outputs, "Routers Saída", "mapas · relatorios · auditorias",
            "Mapas mensais · PDFs ReportLab\nCSV/Excel · Trilha de auditoria.")

        Component(svc_processos, "Service Processos", "app/services/processos_service.py",
            "Lógica de negócio para processos.\nValidação de unicidade · Natureza.\nPDF BYTEA · Histórico encarregados.")

        Component(svc_prazos, "Service Prazos+Andamentos", "app/services/prazos_andamentos.py",
            "Cálculo de prazos.\nMáquina de estado de prazo.\nAndamentos em JSONB.")

        Component(svc_users, "Service Usuários", "app/services/usuarios.py",
            "bcrypt hash · Validações.\n14 contadores de estatística.")

        Component(svc_indicios, "Service Indícios", "app/services/indicios.py",
            "Upsert destrutivo de indícios.\nCarrega crimes/RDPM/Art.29.")

        Component(svc_reports, "Service Relatórios+Mapas", "app/services/mapas_relatorios.py",
            "Geração de PDFs (ReportLab).\nMapas mensais · Relatórios anuais.")

        Component(svc_audit, "Service Auditoria", "app/services/auditorias.py",
            "Paginação e busca na trilha.\nEstatísticas por período.")

        Component(db_manager, "DatabaseManager", "app/services/db.py",
            "Gerencia conexões psycopg2.\nregistrar_auditoria().\nhash_password() bcrypt.")

        Component(prazos_mgr_comp, "PrazosAndamentosManager", "prazos_andamentos_manager.py",
            "Stateful: cria prazo inicial,\nprorroga, conclui.")
    }

    ComponentDb(pg, "PostgreSQL 16", "Docker", "13 tabelas")

    Rel(router_auth, session, "Define/lê")
    Rel(router_processos, guards, "Verifica")
    Rel(router_processos, svc_processos, "Delega")
    Rel(router_usuarios, guards, "Verifica")
    Rel(router_usuarios, svc_users, "Delega")
    Rel(router_catalogs, guards, "Verifica")
    Rel(router_workflow, guards, "Verifica")
    Rel(router_workflow, svc_prazos, "Delega")
    Rel(router_workflow, prazos_mgr_comp, "Delega")
    Rel(router_indicios, svc_indicios, "Delega")
    Rel(router_outputs, svc_reports, "Delega")
    Rel(router_outputs, svc_audit, "Delega")
    Rel(svc_processos, db_manager, "Usa")
    Rel(svc_prazos, db_manager, "Usa")
    Rel(svc_users, db_manager, "Usa")
    Rel(svc_indicios, db_manager, "Usa")
    Rel(svc_reports, db_manager, "Usa")
    Rel(svc_audit, db_manager, "Usa")
    Rel(db_manager, pg, "psycopg2")
    Rel(prazos_mgr_comp, pg, "psycopg2")
```

---

## Container: Browser — Componentes de UI

```mermaid
C4Component
    title Browser — Páginas e Módulos JS

    Container_Boundary(browser, "Browser Window") {

        Component(ui_auth, "Login", "login.html + login.js",
            "Tela de login.\nChama fazer_login().")

        Component(ui_dashboard, "Dashboard", "dashboard.html + dashboard.js",
            "Visão geral: processos, prazos,\nestatísticas rápidas.")

        Component(ui_processos, "Gestão de Processos", "procedure_form · procedure_list\nprocedure_view · procedures_hub",
            "CRUD completo de processos/procedimentos.\nFormulário com 40+ campos.\nVisualizador com andamentos e prazos.")

        Component(ui_usuarios, "Gestão de Usuários", "user_form · user_list\nusers_hub · user_view",
            "CRUD de policiais.\nControle de acesso (admin-only escrita).")

        Component(ui_catalogos, "Catálogos", "crime_form · crime_list\ntransgressao_form · transgressao_list\nestatuto_art29 · estatuto_art29_form",
            "CRUD de crimes, RDPM, Art.29.")

        Component(ui_indicios, "Indícios", "modal-indicios-solucao.js\nindicios-pm-modal.js",
            "Modal de seleção de crimes/RDPM/Art.29\npor PM envolvido.")

        Component(ui_mapas, "Mapas Mensais", "mapa_mensal.html + mapa_mensal.js\nmapas_anteriores.html",
            "Geração e visualização de mapas\nmensais de processos.")

        Component(ui_relatorios, "Relatórios e Estatísticas", "estatisticas_processos.html\nestatisticas_encarregados.html",
            "PDFs anuais, por tipo, por encarregado.\nCSV/Excel export.")

        Component(ui_auditoria, "Auditoria", "auditoria_list.html + auditoria_list.js",
            "Trilha de auditoria. Admin-only.")

        Component(ui_perm, "Controle de Permissões", "web/static/js/permissions.js",
            "Oculta elementos da UI\nconforme perfil do usuário logado.")

        Component(eel_bridge, "Eel Bridge", "/eel.js (injetado pelo Eel)",
            "Proxy JS para chamar funções Python.\nWebSocket bidirecional.")
    }

    Rel(ui_auth, eel_bridge, "fazer_login()")
    Rel(ui_processos, eel_bridge, "CRUD processos")
    Rel(ui_usuarios, eel_bridge, "CRUD usuários")
    Rel(ui_catalogos, eel_bridge, "CRUD catálogos")
    Rel(ui_indicios, eel_bridge, "salvar/carregar indícios")
    Rel(ui_mapas, eel_bridge, "gerar/salvar mapas")
    Rel(ui_relatorios, eel_bridge, "gerar relatórios")
    Rel(ui_auditoria, eel_bridge, "listar auditorias")
    Rel(ui_perm, ui_processos, "Oculta/mostra elementos")
    Rel(ui_perm, ui_usuarios, "Oculta/mostra elementos")
```
