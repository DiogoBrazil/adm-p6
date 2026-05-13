# Flowchart — Módulo prazos

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `app/routers/prazos.py`, `app/services/prazos_andamentos.py`, `prazos_andamentos_manager.py`

---

## Fluxo: Criar Prazo Inicial (`criar_prazo_processo`)

```mermaid
flowchart TD
    A([criar_prazo_processo\nprocesso_id, data_inicio]) --> B[_guard_login]
    B --> C[Busca processo\npara obter tipo_detalhe]
    C --> D[Obtém dias_base\npela tabela de tipos]
    D --> E[data_vencimento =\ndata_inicio + dias_base]
    E --> F{Já existe prazo ORIGINAL\npara este processo?}
    F -- Sim --> G[Retorna erro\n'Prazo já criado']
    F -- Não --> H[INSERT prazos_processo\ntipo_prazo='ORIGINAL'\nordem_prorrogacao=0]
    H --> I[Registra auditoria CREATE]
    I --> J[Retorna sucesso + datas]
```

---

## Tabela de Dias por Tipo (embutida no código)

```mermaid
flowchart LR
    A[tipo_detalhe] --> B{dias originais}
    SV --> D15[15 dias]
    SR --> D30[30 dias]
    IPM --> D40[40 dias]
    IPPM --> D40b[40 dias]
    FP --> D30b[30 dias]
    CP --> D60[60 dias]
    PAD --> D60b[60 dias]
    PADE --> D60c[60 dias]
    CD --> D60d[60 dias]
    CJ --> D60e[60 dias]
```

---

## Fluxo: Prorrogar Prazo (`prorrogar_prazo`)

```mermaid
flowchart TD
    A([prorrogar_prazo\nprocesso_id, dias_adicionados,\nmotivo, autorizado_por,\nnumero_portaria, data_portaria]) --> B[_guard_login]
    B --> C[Busca prazo mais recente\nativo do processo]
    C --> D{Prazo encontrado?}
    D -- Não --> E[Retorna erro\n'Nenhum prazo ativo']
    D -- Sim --> F[Obtém limite_max\npara o tipo do processo]
    F --> G[Calcula total_dias_prorrogados\nsomando todos os prazos anteriores]
    G --> H{total + dias_adicionados\n> limite_prorrogacao?}
    H -- Sim --> I[Retorna erro\n'Excede limite de prorrogação']
    H -- Não --> J[nova_ordem =\nordem_prorrogacao_atual + 1]
    J --> K[nova_data_inicio =\nvencimento_prazo_atual + 1dia]
    K --> L[nova_data_vencimento =\nnova_data_inicio + dias_adicionados]
    L --> M[INSERT prazos_processo\ntipo_prazo='PRORROGACAO_N'\nordem=nova_ordem]
    M --> N[Registra auditoria CREATE]
    N --> O[Retorna sucesso + novas datas]
```

---

## Tabela de Limites de Prorrogação

```mermaid
flowchart LR
    B[Tipo] --> C[Max prorrogação]
    SV2[SV] --> P15[15 dias]
    SR2[SR] --> P30[30 dias]
    IPM2[IPM] --> P20[20 dias]
    IPPM2[IPPM] --> P20b[20 dias]
    FP2[FP] --> P30b[30 dias]
    CP2[CP] --> P60[60 dias]
    PAD2[PAD] --> P60b[60 dias]
    PADE2[PADE] --> P60c[60 dias]
    CD2[CD] --> P60d[60 dias]
    CJ2[CJ] --> P60e[60 dias]
```

---

## Fluxo: Listar Prazos do Processo (`listar_prazos_processo`)

```mermaid
flowchart TD
    A([listar_prazos_processo\nprocesso_id]) --> B[_guard_login]
    B --> C[SELECT * FROM prazos_processo\nWHERE processo_id=? AND ativo=TRUE\nORDER BY ordem_prorrogacao]
    C --> D[Para cada prazo:\ncalcular dias_restantes = vencimento - hoje]
    D --> E[Marcar como vencido se\ndias_restantes < 0]
    E --> F[Retorna lista com status]
```

---

## Fluxo: Verificação Periódica de Prazos

```mermaid
flowchart TD
    A([schedule — PrazosAndamentosManager\ncada X minutos]) --> B[SELECT processos\ncom prazos vencendo em 5 dias]
    B --> C[Para cada processo próximo\ndo vencimento:]
    C --> D[Log/notificação interna]
    D --> E[🔴 LACUNA: sem notificação\nde UI — apenas log console]
```

> 🟢 CONFIRMADO: cálculo de prorrogação com limite por tipo
> 🟡 INFERIDO: verificação de prazos via `schedule` em thread separada (main.py)
> 🔴 LACUNA: notificação de prazo vencendo não é visível ao usuário na UI
