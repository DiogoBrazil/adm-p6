# Flowchart — Módulo andamentos

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/andamentos.py`, `app/services/prazos_andamentos.py`

---

## Arquitetura de Dados

> Andamentos **não são uma tabela separada**. São armazenados como JSONB array na coluna
> `processos_procedimentos.andamentos`. Cada operação faz UPDATE na linha do processo.

---

## Fluxo: Adicionar Andamento (`adicionar_andamento`)

```mermaid
flowchart TD
    A([adicionar_andamento\nprocesso_id, tipo, descricao]) --> B[_guard_login]
    B --> C{tipo e descricao\npreenchidos?}
    C -- Não --> D[Retorna erro\n'Campos obrigatórios']
    C -- Sim --> E[Busca processo\nWHERE id=? AND ativo=TRUE]
    E --> F{Processo\nencontrado?}
    F -- Não --> G[Retorna erro]
    F -- Sim --> H[Cria dict andamento:\nid=uuid4, data=hoje,\ntipo, descricao,\nusuario_id, usuario_nome,\ncreated_at=now]
    H --> I[Normaliza campos:\nverifica se usa 'tipo' ou 'descricao'\nou 'texto' legado]
    I --> J[UPDATE processos_procedimentos\nSET andamentos = andamentos || '[{...}]'::jsonb\nWHERE id=?]
    J --> K[Registra auditoria UPDATE]
    K --> L[Retorna sucesso + andamento]
```

---

## Fluxo: Listar Andamentos (`listar_andamentos`)

```mermaid
flowchart TD
    A([listar_andamentos\nprocesso_id]) --> B[_guard_login]
    B --> C[SELECT andamentos FROM processos_procedimentos\nWHERE id=? AND ativo=TRUE]
    C --> D{andamentos\nis null?}
    D -- Sim --> E[Retorna lista vazia]
    D -- Não --> F[Parse JSONB → Python list]
    F --> G[Normaliza cada andamento:\nmapeia campos legados 'texto'→'descricao']
    G --> H[Retorna lista ordenada\npor created_at ASC]
```

---

## Fluxo: Editar Andamento (`editar_andamento`)

```mermaid
flowchart TD
    A([editar_andamento\nprocesso_id, andamento_id, dados]) --> B[_guard_login]
    B --> C[Busca processo e carrega andamentos]
    C --> D[Encontra andamento pelo id\ndentro do array JSON]
    D --> E{Andamento\nencontrado?}
    E -- Não --> F[Retorna erro\n'Andamento não encontrado']
    E -- Sim --> G{Usuário atual\né dono do andamento?}
    G -- Não (e não é admin) --> H[Retorna erro\n'Sem permissão']
    G -- Sim --> I[Atualiza campos no dict\ndentro do array]
    I --> J[UPDATE processos_procedimentos\nSET andamentos = novo_array_completo]
    J --> K[Registra auditoria UPDATE]
    K --> L[Retorna sucesso]
```

---

## Fluxo: Excluir Andamento (`excluir_andamento`)

```mermaid
flowchart TD
    A([excluir_andamento\nprocesso_id, andamento_id]) --> B[_guard_login]
    B --> C[Carrega andamentos do processo]
    C --> D[Filtra removendo o andamento\ncom o id especificado]
    D --> E{Encontrou para\nremover?}
    E -- Não --> F[Retorna erro]
    E -- Sim --> G[UPDATE processos_procedimentos\nSET andamentos = array_filtrado]
    G --> H[Registra auditoria UPDATE]
    H --> I[Retorna sucesso]
```

---

## Estrutura JSON de um Andamento

```mermaid
classDiagram
    class Andamento {
        +string id (uuid4)
        +string data (YYYY-MM-DD)
        +string tipo
        +string descricao
        +string usuario_id
        +string usuario_nome
        +string created_at (ISO8601)
    }
```

> 🟢 CONFIRMADO: andamentos são JSONB array na coluna `processos_procedimentos.andamentos`
> 🟡 INFERIDO: edição restrita ao autor (ou admin) — verificado na camada Python, não no banco
> 🔴 LACUNA: campo legado 'texto' vs 'descricao' — normalização necessária em dados existentes
