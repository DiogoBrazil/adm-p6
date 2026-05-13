# Mapas — Requisitos

## Visão Geral

Módulo de geração de Mapas Mensais de processos e procedimentos da SJD. Um "mapa mensal" é um relatório tabular que agrupa os processos ativos e concluídos de um determinado mês/ano por tipo. Pode ser gerado para um tipo específico ou de forma completa (todos os tipos). Os mapas podem ser salvos no banco para consulta histórica.

## Responsabilidades

- Gerar mapa mensal por tipo de processo (IPM, PAD, Sindicância, etc.)
- Gerar mapa mensal completo (todos os tipos em um único relatório)
- Salvar mapa gerado com metadados (totais, período, usuário)
- Listar mapas salvos anteriormente
- Obter mapa salvo específico
- Excluir mapa salvo
- Listar tipos de processo disponíveis para mapa

## Regras de Negócio

- 🟢 **RN-01** — Processos "Em Andamento" no mapa: instaurados até o mês selecionado (inclusive) e não concluídos (`mapas_relatorios.py:51`)
- 🟢 **RN-02** — Processos "Concluídos" no mapa: concluídos especificamente no mês selecionado (`mapas_relatorios.py:52`)
- 🟢 **RN-03** — Mapa individual: filtro por `tipo_detalhe` específico
- 🟢 **RN-04** — Mapa completo (`tipo_processo='COMPLETO'`): retorna dict `{tipo: {dados, totais}}`
- 🟢 **RN-05** — Mapa individual: retorna lista direta de processos
- 🟢 **RN-06** — Salvar mapa inclui metadados: `{mes, ano, mes_nome, tipo_processo, total_processos, total_concluidos, total_andamento}`
- 🟢 **RN-07** — Apenas processos com `ativo=TRUE` entram no mapa

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Gerar mapa mensal por tipo | Must | Retorna processos em andamento + concluídos no mês |
| RF-02 | Gerar mapa mensal completo | Should | Agrupa por tipo; retorna estrutura por tipo |
| RF-03 | Salvar mapa gerado | Should | Persiste no banco com metadados e dados JSON |
| RF-04 | Listar mapas salvos | Should | Retorna histórico de mapas com metadados |
| RF-05 | Obter mapa salvo específico | Should | Retorna dados completos do mapa |
| RF-06 | Excluir mapa salvo | Could | Remove permanentemente |
| RF-07 | Listar tipos de processo para mapa | Must | Retorna tipos disponíveis para seleção |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Somente usuários logados | `guard_login()` em todos os handlers | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Gerar mapa mensal de IPM
  Dado processos IPM em andamento e um concluído no mês 01/2025
  Quando gerar_mapa_mensal(mes=1, ano=2025, tipo_processo="IPM")
  Então retornar lista com processos; em_andamento correto; concluidos do mês

Cenário: Salvar mapa completo
  Dado mapa completo gerado para 01/2025
  Quando salvar_mapa_mensal(mes=1, ano=2025, tipo_processo="COMPLETO", dados)
  Então mapa salvo com total_processos somado de todos os tipos

Cenário: Listar mapas anteriores
  Dado 3 mapas salvos no banco
  Quando listar_mapas_salvos()
  Então retornar lista com metadados dos 3 mapas
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Gerar mapa individual + tipos | Must | Funcionalidade principal da tela |
| Gerar mapa completo | Should | Visão consolidada |
| Salvar + listar + obter | Should | Histórico de mapas |
| Excluir | Could | Gestão de dados |

## Rastreabilidade de Código

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `app/routers/mapas.py` | 7 handlers @eel.expose | 🟢 |
| `app/services/mapas_relatorios.py` | `gerar_mapa_mensal`, `gerar_mapa_completo`, `salvar_mapa_mensal`, `listar_mapas_anteriores` | 🟢 |
