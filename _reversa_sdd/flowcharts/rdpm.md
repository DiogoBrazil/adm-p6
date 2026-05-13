# Flowchart — Módulo rdpm

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/rdpm.py`, `app/rdpm.py`

---

## Fluxo: Listar Transgressões

```mermaid
flowchart TD
    A([listar_transgressoes]) --> B[_guard_login]
    B --> C[SELECT id, artigo, gravidade, inciso, texto\nFROM transgressoes WHERE ativo=TRUE\nORDER BY artigo, inciso]
    C --> D[Retorna lista]
```

---

## Fluxo: Adicionar Transgressão

```mermaid
flowchart TD
    A([adicionar_transgressao\ndados]) --> B[_guard_admin]
    B --> C{artigo, gravidade,\ntexto preenchidos?}
    C -- Não --> D[Retorna erro\n'Campos obrigatórios']
    C -- Sim --> E{gravidade IN\n'Leve','Média','Grave'?}
    E -- Não --> F[Retorna erro\n'Gravidade inválida']
    E -- Sim --> G[gravidade.title()]
    G --> H[INSERT INTO transgressoes\nid=SERIAL auto-incremento]
    H --> I[Registra auditoria CREATE]
    I --> J[Retorna sucesso + id]
```

---

## Fluxo: Editar Transgressão

```mermaid
flowchart TD
    A([editar_transgressao\nid, dados]) --> B[_guard_admin]
    B --> C[Busca transgressao\nWHERE id=? AND ativo=TRUE]
    C --> D{Encontrada?}
    D -- Não --> E[Retorna erro 'Não encontrada']
    D -- Sim --> F{Campos\nválidos?}
    F -- Não --> G[Retorna erro]
    F -- Sim --> H[UPDATE transgressoes\nSET artigo,gravidade,inciso,texto\nWHERE id=?]
    H --> I[Registra auditoria UPDATE]
    I --> J[Retorna sucesso]
```

---

## Fluxo: Excluir Transgressão ⚠️ HARD DELETE

```mermaid
flowchart TD
    A([excluir_transgressao\nid]) --> B[_guard_admin]
    B --> C[Busca transgressao\nWHERE id=?]
    C --> D{Encontrada?}
    D -- Não --> E[Retorna erro]
    D -- Sim --> F[⚠️ DELETE FROM transgressoes\nWHERE id=?]
    F --> G[Registra auditoria DELETE]
    G --> H[Retorna sucesso]
```

> ⚠️ **CRÍTICO para migração**: único módulo com HARD DELETE.
> Risco: se transgressão estiver referenciada em `pm_envolvido_rdpm` ou `procedimentos_indicios_rdpm`, a FK protegerá em produção mas o código não valida isso antes de deletar.

---

## Fluxo: Listar por Gravidade (`listar_transgressoes_por_gravidade`)

```mermaid
flowchart TD
    A([listar_transgressoes_por_gravidade]) --> B[_guard_login]
    B --> C[SELECT * FROM transgressoes WHERE ativo=TRUE\nORDER BY gravidade, artigo, inciso]
    C --> D[Agrupa por gravidade\nnuma estrutura: dict de listas]
    D --> E[Retorna: Leve=[...], Média=[...], Grave=[...]]
```

> 🟢 CONFIRMADO: id SERIAL INTEGER (não UUID) — diferente de todas outras tabelas
> 🟢 CONFIRMADO: hard delete exclusivo neste módulo
