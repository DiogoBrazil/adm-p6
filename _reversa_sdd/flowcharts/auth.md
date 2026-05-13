# Flowchart — Módulo auth

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/auth.py`, `main.py`

---

## Fluxo principal: Login (`fazer_login`)

```mermaid
flowchart TD
    A([Usuário: fazer_login\nemail, senha]) --> B{email e senha\npreenchidos?}
    B -- Não --> C[Retorna erro\n'Campos obrigatórios']
    B -- Sim --> D[Busca usuário\nWHERE email=? AND ativo=TRUE AND is_operador=TRUE]
    D --> E{Usuário\nencontrado?}
    E -- Não --> F[Retorna erro\n'Credenciais inválidas']
    E -- Sim --> G{Senha começa\ncom '$2b$'?}
    G -- Sim (bcrypt) --> H[bcrypt.checkpw\nsenha, hash]
    G -- Não (SHA-256 legado) --> I[SHA-256 hex digest\nda senha]
    I --> J{hash SHA-256\n== senha armazenada?}
    H --> K{bcrypt válido?}
    J -- Não --> F
    K -- Não --> F
    J -- Sim --> L[Migrar para bcrypt:\nAtualiza hash no banco]
    K -- Sim --> M
    L --> M[Salva sessão global:\nsessao_atual = usuario_dict]
    M --> N[Registra auditoria\noperacao='LOGIN']
    N --> O[Retorna sucesso\n+ dados do usuário]
```

---

## Fluxo: Logout (`fazer_logout`)

```mermaid
flowchart TD
    A([fazer_logout]) --> B{sessao_atual\nexiste?}
    B -- Não --> C[Retorna erro\n'Não autenticado']
    B -- Sim --> D[Copia usuario_id da sessão]
    D --> E[sessao_atual = None]
    E --> F[Registra auditoria\noperacao='LOGOUT']
    F --> G[Retorna sucesso]
```

---

## Fluxo: Verificar Sessão (`verificar_sessao`)

```mermaid
flowchart TD
    A([verificar_sessao]) --> B{sessao_atual\nIsNone?}
    B -- Sim --> C[Retorna False]
    B -- Não --> D[Retorna dict com\nusuario_id, nome, perfil]
```

---

## Guards de Autorização

```mermaid
flowchart TD
    subgraph "_guard_login (toda rota autenticada)"
        G1([rota chamada]) --> G2{sessao_atual\nexiste?}
        G2 -- Não --> G3[Raise Exception\n'Sessão expirada']
        G2 -- Sim --> G4[Retorna usuario]
    end

    subgraph "_guard_admin (rotas admin)"
        A1([rota chamada]) --> A2[Chama _guard_login]
        A2 --> A3{usuario.perfil\n== 'admin'?}
        A3 -- Não --> A4[Raise Exception\n'Acesso negado']
        A3 -- Sim --> A5[Retorna usuario]
    end
```

---

## Mecanismo de Sessão

```mermaid
flowchart LR
    A[main.py\nsessao_atual = None] --> B[fazer_login]
    B --> C[sessao_atual = usuario_dict]
    C --> D[todas as rotas\n_guard_login verifica]
    D --> E[fazer_logout]
    E --> F[sessao_atual = None]
```

> 🟡 INFERIDO: sessão é variável global em memória. Não persiste entre reinicializações do app.
> 🔴 LACUNA: sem timeout de sessão implementado.
