# Flowchart — Módulo relatorios

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/relatorios.py`

---

## Tipos de Relatórios Disponíveis

```mermaid
flowchart LR
    A[Relatórios] --> B[PDF via ReportLab]
    A --> C[CSV/Excel]
    B --> D[Relatório de Processos]
    B --> E[Relatório de Andamentos]
    B --> F[Relatório de Prazos]
    C --> G[Exportação tabular\nde processos]
```

---

## Fluxo: Gerar Relatório de Processos (`gerar_relatorio_processos`)

```mermaid
flowchart TD
    A([gerar_relatorio_processos\nfiltros]) --> B[_guard_login]
    B --> C[Monta query dinâmica:\nWHERE tipo?, ano?, status?,\nconcluido?, responsavel_id?]
    C --> D[SELECT processos com JOIN usuarios\npara nomes dos responsáveis]
    D --> E[ReportLab: cria documento PDF]
    E --> F[Cabeçalho com logo + título + data]
    F --> G[Para cada processo:\nAdicionatinha à tabela]
    G --> H[Rodapé com total e paginação]
    H --> I[PDF em buffer de memória]
    I --> J[Retorna base64 encoded]
```

---

## Fluxo: Gerar Relatório de Prazos Vencidos/Próximos

```mermaid
flowchart TD
    A([gerar_relatorio_prazos\ntipo: vencidos ou proximos]) --> B[_guard_login]
    B --> C{tipo?}
    C -- vencidos --> D[SELECT processos\nwhere data_vencimento < hoje\nAND concluido=FALSE]
    C -- proximos --> E[SELECT processos\nwhere data_vencimento BETWEEN\nhoje e hoje+30dias\nAND concluido=FALSE]
    D --> F[Ordena por data_vencimento ASC]
    E --> F
    F --> G[Calcula dias_atraso\nou dias_restantes para cada]
    G --> H[Monta PDF com destaque\npara prazos críticos]
    H --> I[Retorna base64]
```

---

## Fluxo: Exportar CSV (`exportar_processos_csv`)

```mermaid
flowchart TD
    A([exportar_processos_csv\nfiltros]) --> B[_guard_login]
    B --> C[Query processos com filtros]
    C --> D[Cria CSV em memória\nvia csv.writer]
    D --> E[Header: numero, tipo, data_instauracao,\nresponsavel, status, concluido, data_conclusao]
    E --> F[Para cada processo: escreve linha]
    F --> G[Retorna CSV como\nstring base64 ou bytes]
```

---

## Fluxo: Relatório de Andamentos por Processo

```mermaid
flowchart TD
    A([gerar_relatorio_andamentos\nprocesso_id]) --> B[_guard_login]
    B --> C[Busca processo completo\ncom andamentos JSONB]
    C --> D{Processo\nencontrado?}
    D -- Não --> E[Retorna erro]
    D -- Sim --> F[Parse andamentos JSON]
    F --> G[ReportLab: cria documento]
    G --> H[Cabeçalho: dados do processo]
    H --> I[Para cada andamento:\ndata, tipo, descricao, usuario]
    I --> J[Retorna PDF base64]
```

---

## Componentes ReportLab Utilizados

```mermaid
flowchart LR
    A[ReportLab] --> B[SimpleDocTemplate]
    A --> C[Table + TableStyle]
    A --> D[Paragraph + styles]
    A --> E[Image para logo]
    A --> F[PageBreak]
    B --> G[PDF em BytesIO]
    G --> H[base64.b64encode]
```

> 🟢 CONFIRMADO: todos os PDFs gerados em memória (BytesIO), retornados como base64
> 🟡 INFERIDO: logo carregada de `web/static/images/SJD-GESTOR.ico` ou equivalente PNG
> 🔴 LACUNA: sem paginação no relatório de andamentos para processos com muitos andamentos
