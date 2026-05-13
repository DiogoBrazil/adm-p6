# Flowchart — Módulo art29

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/art29.py`, `app/art29.py`

---

## Fluxo: Listar Infrações Art.29

```mermaid
flowchart TD
    A([listar_infracoes_art29]) --> B[_guard_login]
    B --> C[SELECT id, inciso, texto FROM infracoes_estatuto_art29\nWHERE ativo=TRUE\nORDER BY LENGTH inciso, inciso]
    C --> D[Retorna lista ordenada\npor numeral romano]
```

> **Nota ordenação**: `ORDER BY LENGTH(inciso), inciso` funciona para I..X mas falha para XI, XII... pois LENGTH(XI)=2 = LENGTH(IX)=2 mas ordem alfabética os inverte.

---

## Fluxo: Adicionar Infração

```mermaid
flowchart TD
    A([adicionar_infracao_art29\ndados]) --> B[_guard_admin]
    B --> C{inciso e texto\npreenchidos?}
    C -- Não --> D[Retorna erro\n'Campos obrigatórios']
    C -- Sim --> E{inciso é numeral\nromano válido?}
    E -- Não --> F[Retorna erro\n'Inciso inválido']
    E -- Sim --> G{inciso já\nexiste ativo?}
    G -- Sim --> H[Retorna erro\n'Inciso duplicado']
    G -- Não --> I[INSERT INTO infracoes_estatuto_art29\nid=SERIAL auto-incremento]
    I --> J[Registra auditoria CREATE]
    J --> K[Retorna sucesso + id]
```

---

## Fluxo: Editar Infração

```mermaid
flowchart TD
    A([editar_infracao_art29\nid, dados]) --> B[_guard_admin]
    B --> C[Busca infração\nWHERE id=? AND ativo=TRUE]
    C --> D{Encontrada?}
    D -- Não --> E[Retorna erro]
    D -- Sim --> F{inciso diferente\ndo atual?}
    F -- Sim --> G{Novo inciso\njá existe?}
    G -- Sim --> H[Retorna erro\n'Inciso duplicado']
    G -- Não --> I[UPDATE SET inciso, texto]
    F -- Não --> I
    I --> J[Registra auditoria UPDATE]
    J --> K[Retorna sucesso]
```

---

## Fluxo: Excluir/Restaurar Infração

```mermaid
flowchart TD
    A([excluir_infracao_art29 id]) --> B[_guard_admin]
    B --> C[UPDATE SET ativo=FALSE\nWHERE id=?]
    C --> D[Registra auditoria DELETE]
    D --> E[Retorna sucesso]

    F([restaurar_infracao_art29 id]) --> G[_guard_admin]
    G --> H[UPDATE SET ativo=TRUE\nWHERE id=?]
    H --> I[Registra auditoria UPDATE]
    I --> J[Retorna sucesso]
```

---

## Fluxo: Obter por ID (`obter_crime`)

```mermaid
flowchart TD
    A([obter_crime id]) --> B[_guard_login]
    B --> C[SELECT * FROM infracoes_estatuto_art29\nWHERE id=?]
    C --> D{Encontrada?}
    D -- Não --> E[Retorna None]
    D -- Sim --> F[Retorna dict]
```

> 🟢 CONFIRMADO: soft delete (ativo=FALSE) — diferente do RDPM que usa hard delete
> 🟡 INFERIDO: ordenação por romano pode falhar a partir do inciso XI
