# Flowchart — Módulo usuarios

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/usuarios.py`, `app/services/usuarios.py`

---

## Fluxo: Criar Usuário (`criar_usuario`)

```mermaid
flowchart TD
    A([criar_usuario\ndados]) --> B[_guard_admin]
    B --> C{Campos obrigatórios:\ntipo_usuario, posto_graduacao,\nnome, matricula?}
    C -- Não --> D[Retorna erro\n'Campos obrigatórios']
    C -- Sim --> E{matricula já\nexiste ativo?}
    E -- Sim --> F[Retorna erro\n'Matrícula duplicada']
    E -- Não --> G{is_operador\n== True?}
    G -- Sim --> H{email e senha\npreenchidos?}
    H -- Não --> I[Retorna erro\n'Operador precisa de email e senha']
    H -- Sim --> J{email já\nexiste?}
    J -- Sim --> K[Retorna erro\n'Email duplicado']
    J -- Não --> L[Gera hash bcrypt\nda senha]
    L --> M[INSERT usuarios\nid=uuid4]
    G -- Não --> N[INSERT usuarios\nsem email/senha]
    M --> O[Registra auditoria CREATE]
    N --> O
    O --> P[Retorna sucesso + id]
```

---

## Fluxo: Atualizar Usuário (`atualizar_usuario`)

```mermaid
flowchart TD
    A([atualizar_usuario\nid, dados]) --> B[_guard_admin]
    B --> C[Busca usuario\nWHERE id=? AND ativo=TRUE]
    C --> D{Encontrado?}
    D -- Não --> E[Retorna erro]
    D -- Sim --> F{matricula mudou?}
    F -- Sim --> G{Nova matrícula\njá existe?}
    G -- Sim --> H[Retorna erro]
    G -- Não --> I[UPDATE campos]
    F -- Não --> I
    I --> J{senha nova\nfornecida?}
    J -- Sim --> K[Re-hash bcrypt\nAtualiza senha]
    K --> L[Registra auditoria UPDATE]
    J -- Não --> L
    L --> M[Retorna sucesso]
```

---

## Fluxo: Inativar/Reativar Usuário

```mermaid
flowchart TD
    A([inativar_usuario id]) --> B[_guard_admin]
    B --> C[UPDATE SET ativo=FALSE\nupdated_at=now\nWHERE id=?]
    C --> D[Registra auditoria DELETE]
    D --> E[Retorna sucesso]

    F([reativar_usuario id]) --> G[_guard_admin]
    G --> H[UPDATE SET ativo=TRUE\nupdated_at=now\nWHERE id=?]
    H --> I[Registra auditoria UPDATE]
    I --> J[Retorna sucesso]
```

---

## Fluxo: Estatísticas (`obter_estatisticas_usuarios`)

```mermaid
flowchart TD
    A([obter_estatisticas_usuarios]) --> B[_guard_login]
    B --> C[14 queries SQL individuais\npara contadores]
    C --> D[total_usuarios\ntotal_ativos\ntotal_inativos]
    D --> E[total_oficiais\ntotal_pracas]
    E --> F[total_encarregados\ntotal_operadores\ntotal_admins]
    F --> G[por_posto: dict de contagens\npor tipo: Oficial/Praça]
    G --> H[Retorna dict consolidado\ncom todos os 14 campos]
```

---

## Fluxo: Listar Encarregados (`listar_encarregados`)

```mermaid
flowchart TD
    A([listar_encarregados]) --> B[_guard_login]
    B --> C[SELECT id, nome, posto_graduacao,\nmatriculaFROM usuarios\nWHERE is_encarregado=TRUE AND ativo=TRUE\nORDER BY nome]
    C --> D[Retorna lista]
```

---

## Fluxo: Trocar Senha Própria (`trocar_senha`)

```mermaid
flowchart TD
    A([trocar_senha\nsenha_atual, nova_senha]) --> B[_guard_login]
    B --> C[Obtém usuario da sessão]
    C --> D[Verifica senha_atual\nbcrypt.checkpw]
    D --> E{Senha atual\ncorreta?}
    E -- Não --> F[Retorna erro\n'Senha atual incorreta']
    E -- Sim --> G[Gera hash bcrypt\nda nova_senha]
    G --> H[UPDATE usuarios\nSET senha=hash WHERE id=sessao.id]
    H --> I[Registra auditoria UPDATE]
    I --> J[Retorna sucesso]
```

> 🟢 CONFIRMADO: inconsistência no hash do legado — criar_usuario usa bcrypt,
> atualizar_usuario usa SHA-256 e pode haver senhas SHA-256 no banco. Na migração,
> atualizar_usuario deve salvar bcrypt e o login deve manter detecção por prefixo/comprimento.
> 🟢 CONFIRMADO: soft delete via ativo=FALSE
