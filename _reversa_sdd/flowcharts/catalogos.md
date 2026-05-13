# Flowchart — Módulo catalogos

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/catalogos.py`, `app/catalogos.py`, `app/utils.py`

---

## Fluxo: Listar Municípios e Distritos (`listar_municipios_distritos`)

```mermaid
flowchart TD
    A([listar_municipios_distritos]) --> B[_guard_login]
    B --> C[SELECT * FROM municipios_distritos\nWHERE ativo=TRUE ORDER BY nome]
    C --> D[Retorna lista de dicts]
```

---

## Fluxo: Gerenciar Crime (`adicionar_crime`, `editar_crime`)

```mermaid
flowchart TD
    A([adicionar_crime / editar_crime\ndados]) --> B[_guard_login]
    B --> C[validar_campos_crime\ndados]
    C --> D{Validação\npassou?}
    D -- Não --> E[Retorna erro\ncom campo inválido]
    D -- Sim --> F{Operação?}
    F -- adicionar --> G[INSERT INTO crimes_contravencoes\nuuid4 como id]
    F -- editar --> H[UPDATE crimes_contravencoes\nWHERE id=?]
    G --> I[Registra auditoria\nCREATE/UPDATE]
    H --> I
    I --> J[Retorna sucesso]
```

---

## Algoritmo: validar_campos_crime

```mermaid
flowchart TD
    A([validar_campos_crime\ndados]) --> B{artigo\npreenchido?}
    B -- Não --> C[Retorna erro\n'artigo obrigatório']
    B -- Sim --> D{artigo match\n'^\d+minus-A $'?}
    D -- Não --> E[Retorna erro\n'artigo inválido']
    D -- Sim --> F{parágrafo\npreenchido?}
    F -- Não --> G[OK - segue]
    F -- Sim --> H{paragrafo match\n'^§\d+|caput|\d+º $'?}
    H -- Não --> I[Retorna erro\n'parágrafo inválido']
    H -- Sim --> G
    G --> J{inciso\npreenchido?}
    J -- Não --> K[OK - segue]
    J -- Sim --> L{inciso match\nnumeral romano?}
    L -- Não --> M[Retorna erro\n'inciso inválido']
    L -- Sim --> K
    K --> N{alínea\npreenchida?}
    N -- Não --> O[Retorna None - válido]
    N -- Sim --> P{alínea match\n'^a-z $'?}
    P -- Não --> Q[Retorna erro\n'alínea inválida']
    P -- Sim --> O
```

---

## Fluxo: Listar/Excluir Crime

```mermaid
flowchart TD
    A([listar_crimes]) --> B[_guard_login]
    B --> C[SELECT * FROM crimes_contravencoes\nWHERE ativo=TRUE ORDER BY artigo, tipo]
    C --> D[Retorna lista]

    E([excluir_crime id]) --> F[_guard_admin]
    F --> G[UPDATE crimes_contravencoes\nSET ativo=FALSE WHERE id=?]
    G --> H[Registra auditoria DELETE]
    H --> I[Retorna sucesso]
```

> 🟢 CONFIRMADO: crimes/contravenções usam soft delete (ativo=FALSE)
> 🟢 CONFIRMADO: validação de campos via regex em app/utils.py
