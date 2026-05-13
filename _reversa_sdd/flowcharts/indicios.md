# Flowchart — Módulo indicios

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/indicios.py`, `app/services/indicios.py`

---

## Hierarquia de Dados

```mermaid
flowchart TD
    A[processos_procedimentos] --> B[procedimento_pms_envolvidos\n1 registro por PM no procedimento]
    B --> C[pm_envolvido_indicios\n1 registro por PM+procedimento]
    C --> D[pm_envolvido_crimes\nN crimes por PM]
    C --> E[pm_envolvido_rdpm\nN transgressões por PM]
    C --> F[pm_envolvido_art29\nN infrações Art.29 por PM]
    A --> G[procedimentos_indicios_crimes\nnível de procedimento]
    A --> H[procedimentos_indicios_rdpm\nnível de procedimento]
    A --> I[procedimentos_indicios_art29\nnível de procedimento]
```

---

## Fluxo: Adicionar PM ao Procedimento (`adicionar_pm_envolvido`)

```mermaid
flowchart TD
    A([adicionar_pm_envolvido\nprocedimento_id, pm_id]) --> B[_guard_login]
    B --> C[Busca procedimento]
    C --> D{PM já está no\nprocedimento?}
    D -- Sim --> E[Retorna erro\n'PM já envolvido']
    D -- Não --> F[INSERT procedimento_pms_envolvidos\nid=uuid4, ordem=max+1]
    F --> G[INSERT pm_envolvido_indicios\nid=uuid4, categorias_indicios='[]']
    G --> H[Registra auditoria CREATE]
    H --> I[Retorna sucesso + ids]
```

---

## Fluxo: Adicionar Indício ao PM (`adicionar_indicio_pm`)

```mermaid
flowchart TD
    A([adicionar_indicio_pm\npm_envolvido_id, tipo_indicio, item_id]) --> B[_guard_login]
    B --> C[Busca pm_envolvido_indicios\npor pm_envolvido_id]
    C --> D{tipo_indicio?}
    D -- crime --> E[INSERT pm_envolvido_crimes\npm_indicios_id, crime_id]
    D -- rdpm --> F[INSERT pm_envolvido_rdpm\npm_indicios_id, transgressao_id]
    D -- art29 --> G[INSERT pm_envolvido_art29\npm_indicios_id, art29_id]
    E --> H[Atualiza categorias_indicios JSONB\nno pm_envolvido_indicios]
    F --> H
    G --> H
    H --> I[Atualiza indicios_categorias JSONB\nno processos_procedimentos]
    I --> J[Registra auditoria CREATE]
    J --> K[Retorna sucesso]
```

---

## Fluxo: Listar Indícios do Procedimento (`listar_indicios_procedimento`)

```mermaid
flowchart TD
    A([listar_indicios_procedimento\nprocedimento_id]) --> B[_guard_login]
    B --> C[SELECT pms_envolvidos\ndo procedimento]
    C --> D[Para cada PM:]
    D --> E[SELECT pm_envolvido_indicios]
    E --> F[JOIN crimes via pm_envolvido_crimes]
    F --> G[JOIN transgressoes via pm_envolvido_rdpm]
    G --> H[JOIN art29 via pm_envolvido_art29]
    H --> I[Monta estrutura aninhada:\npm: {indicios: {crimes: [], rdpm: [], art29: []}}]
    I --> J[Retorna lista de PMs\ncom indícios]
```

---

## Fluxo: Remover Indício (`remover_indicio_pm`)

```mermaid
flowchart TD
    A([remover_indicio_pm\npm_indicios_id, tipo, item_id]) --> B[_guard_login]
    B --> C{tipo?}
    C -- crime --> D[DELETE FROM pm_envolvido_crimes\nWHERE pm_indicios_id=? AND crime_id=?]
    C -- rdpm --> E[DELETE FROM pm_envolvido_rdpm\nWHERE pm_indicios_id=? AND transgressao_id=?]
    C -- art29 --> F[DELETE FROM pm_envolvido_art29\nWHERE pm_indicios_id=? AND art29_id=?]
    D --> G[Recalcula categorias_indicios\nno pm_envolvido_indicios]
    E --> G
    F --> G
    G --> H[Recalcula indicios_categorias\nno processo]
    H --> I[Registra auditoria DELETE]
    I --> J[Retorna sucesso]
```

---

## Fluxo: Associar Indício ao Nível de Procedimento

```mermaid
flowchart TD
    A([adicionar_indicio_procedimento\nprocedimento_id, tipo, item_id]) --> B[_guard_login]
    B --> C{tipo?}
    C -- crime --> D[INSERT procedimentos_indicios_crimes]
    C -- rdpm --> E[INSERT procedimentos_indicios_rdpm]
    C -- art29 --> F[INSERT procedimentos_indicios_art29]
    D --> G[Registra auditoria]
    E --> G
    F --> G
    G --> H[Retorna sucesso]
```

> 🟢 CONFIRMADO: estrutura hierárquica de 3 níveis (procedimento → pm_envolvido → indicios)
> 🟡 INFERIDO: nível de procedimento (procedimentos_indicios_*) é alternativo ao nível de PM
> 🔴 LACUNA: não há validação de duplicata ao adicionar o mesmo indício duas vezes ao mesmo PM
