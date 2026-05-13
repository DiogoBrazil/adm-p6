# Flowchart — Módulo processos

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/processos.py`, `app/processos.py`, `app/services/processos_service.py`

---

## Taxonomia de Tipos

```mermaid
flowchart LR
    A[tipo_geral] --> B[processo]
    A --> C[procedimento]
    B --> D[PAD\nPADE\nCD\nCJ]
    C --> E[SR\nSV\nIPM\nIPPM\nFP\nCP\nPADS]
```

---

## Fluxo: Criar Processo (`criar_processo`)

```mermaid
flowchart TD
    A([criar_processo\ndados]) --> B[_guard_login]
    B --> C{Campos obrigatórios:\ntipo_geral, tipo_detalhe,\ndocumento_iniciador, numero?}
    C -- Não --> D[Retorna erro\n'Campos obrigatórios']
    C -- Sim --> E{tipo_detalhe\nválido para tipo_geral?}
    E -- Não --> F[Retorna erro\n'Tipo inválido']
    E -- Sim --> G{numero+doc_iniciador+ano\njá existe?}
    G -- Sim --> H[Retorna erro\n'Número duplicado']
    G -- Não --> I[Calcula natureza_processo\nou natureza_procedimento]
    I --> J[Extrai ano_instauracao\nde data_instauracao]
    J --> K[INSERT processos_procedimentos\nid=uuid4, andamentos='[]']
    K --> L[Cria prazo inicial\n_criar_prazo_inicial]
    L --> M[Registra auditoria CREATE]
    M --> N[Retorna sucesso + id]
```

---

## Fluxo: Algoritmo natureza (`_calcular_natureza`)

```mermaid
flowchart TD
    A([_calcular_natureza\ntipo_geral, tipo_detalhe]) --> B{tipo_geral?}
    B -- processo --> C{tipo_detalhe?}
    C -- PAD --> D["natureza = 'Processo Administrativo Disciplinar'"]
    C -- PADE --> E["natureza = 'Processo Administrativo Disciplinar Especial'"]
    C -- CD --> F["natureza = 'Conselho de Disciplina'"]
    C -- CJ --> G["natureza = 'Conselho de Justificação'"]
    B -- procedimento --> H{tipo_detalhe?}
    H -- SR --> I["'Sindicância Regulamentar'"]
    H -- SV --> J["'Sindicância Verificatória'"]
    H -- IPM --> K["'Inquérito Policial Militar'"]
    H -- IPPM --> L["'Inquérito Policial Penal Militar'"]
    H -- FP --> M["'Feito Preliminar'"]
    H -- CP --> N["'Comissão Permanente'"]
    H -- PADS --> O["'PAD Sumário'"]
```

---

## Fluxo: Listar Processos (`listar_processos`)

```mermaid
flowchart TD
    A([listar_processos\nfiltros]) --> B[_guard_login]
    B --> C[Monta WHERE dinâmico:\ntipo_geral?, tipo_detalhe?,\nano?, concluido?, responsavel_id?]
    C --> D[SELECT com paginação\nORDER BY data_instauracao DESC]
    D --> E[Para cada processo:\ncarregar responsavel_nome]
    E --> F[Retorna lista + total]
```

---

## Fluxo: Atualizar Processo (`atualizar_processo`)

```mermaid
flowchart TD
    A([atualizar_processo\nid, dados]) --> B[_guard_login]
    B --> C[Busca processo\nWHERE id=? AND ativo=TRUE]
    C --> D{Encontrado?}
    D -- Não --> E[Retorna erro]
    D -- Sim --> F{Número mudou?}
    F -- Sim --> G{Novo número\njá existe?}
    G -- Sim --> H[Retorna erro\n'Número duplicado']
    G -- Não --> I[UPDATE campos permitidos]
    F -- Não --> I
    I --> J{responsavel_id\nmudou?}
    J -- Sim --> K[Adiciona ao historico_encarregados\nJSONB append]
    K --> L[Registra auditoria UPDATE]
    J -- Não --> L
    L --> M[Retorna sucesso]
```

---

## Fluxo: Upload/Remoção de PDF

```mermaid
flowchart TD
    A([upload_pdf_processo\nid, pdf_base64]) --> B[_guard_login]
    B --> C[Decodifica base64]
    C --> D{Tamanho ≤ 100MB?}
    D -- Não --> E[Retorna erro\n'Arquivo muito grande']
    D -- Sim --> F[UPDATE processos_procedimentos\nSET pdf_arquivo, pdf_nome,\npdf_content_type, pdf_tamanho,\npdf_upload_em\nWHERE id=?]
    F --> G[Registra auditoria UPDATE]
    G --> H[Retorna sucesso]

    I([remover_pdf_processo id]) --> J[_guard_login]
    J --> K[UPDATE SET pdf_arquivo=NULL\npdf_nome=NULL etc. WHERE id=?]
    K --> L[Registra auditoria UPDATE]
    L --> M[Retorna sucesso]
```

---

## Fluxo: Concluir Processo (`concluir_processo`)

```mermaid
flowchart TD
    A([concluir_processo\nid, solucao, penalidade]) --> B[_guard_login]
    B --> C[Busca processo]
    C --> D{Já concluído?}
    D -- Sim --> E[Retorna erro\n'Já concluído']
    D -- Não --> F[UPDATE SET concluido=TRUE,\ndata_conclusao=hoje,\nsolucao_final, solucao_tipo,\npenalidade_tipo, penalidade_dias]
    F --> G[Registra auditoria UPDATE]
    G --> H[Retorna sucesso]
```

> 🟢 CONFIRMADO: processos usam soft delete (ativo=FALSE)
> 🟢 CONFIRMADO: PDF armazenado como BYTEA no banco (até 100MB)
> 🟢 CONFIRMADO: andamentos como JSONB array
> 🟡 INFERIDO: histórico_encarregados como JSONB append (sem tamanho máximo)
