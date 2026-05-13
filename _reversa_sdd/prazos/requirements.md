# Prazos — Requisitos

## Visão Geral

Módulo de controle de prazos processuais. Gerencia o ciclo de vida temporal dos processos/procedimentos: criação automática do prazo inicial ao registrar um processo, prorrogações com portaria, conclusão e alertas de vencimento. Implementado na classe `PrazosAndamentosManager` em `prazos_andamentos_manager.py`.

## Responsabilidades

- Criação automática do prazo inicial ao registrar um processo
- Prorrogação de prazo com registro de portaria e ordem de prorrogação
- Conclusão de prazo ativo
- Listagem de prazos por processo
- Alertas de prazos vencendo (por antecedência configurável)
- Alertas de prazos vencidos
- Dashboard com estatísticas de prazos
- Relatório de prazos com filtros

## Regras de Negócio

- 🟢 **RN-01** — Prazo inicial criado automaticamente após `registrar_processo()` via `prazos_andamentos_manager` (`processos_service.py` → `prazos_andamentos_manager.adicionar_prazo_inicial`)
- 🟢 **RN-02** — Prorrogação: dias somados a partir do primeiro dia após o vencimento atual (`prazos_andamentos_manager.py:57`)
- 🟢 **RN-03** — Prorrogação registra `numero_portaria`, `data_portaria` e `ordem_prorrogacao`
- 🟢 **RN-04** — `tipo_prazo IN ('inicial', 'prorrogacao')` na tabela `prazos_processo`
- 🟢 **RN-05** — Prazo ativo identificado por `ativo=1` (INTEGER, não BOOLEAN)
- 🟢 **RN-06** — `prazo_base` confirmado pelo usuário (`questions.md#2`): SR/SV=30 dias; IPM=40 dias; PADS=30 dias; PAD/PADE=30 dias; CP/FP=15 dias; CD/CJ=30 dias. IPPM não foi mencionado na resposta e deve seguir a regra padrão do legado se não houver decisão posterior.
- 🟢 **RN-07** — Dashboard agrupa prazos por: vencidos, vencendo em 7 dias, em andamento, concluídos
- 🟡 **RN-08** — Apenas o prazo mais recente é "ativo" por processo (`ativo=1`)

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Listar prazos de um processo | Must | Retorna histórico completo: prazo inicial + prorrogações |
| RF-02 | Adicionar prorrogação ao prazo ativo | Must | Registra portaria; calcula nova data de vencimento |
| RF-03 | Concluir prazo ativo | Must | Marca prazo como concluído |
| RF-04 | Obter prazos vencendo em N dias | Should | Padrão: 7 dias; configurável |
| RF-05 | Obter prazos vencidos | Should | Filtra prazos com data_vencimento < NOW() |
| RF-06 | Dashboard de prazos | Should | Contagens por categoria de status |
| RF-07 | Relatório de prazos com filtros | Could | Filtros por data, tipo, status |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|-------------------|-----------|-----------|
| Segurança | Apenas usuários logados acessam prazos | `guard_login()` em todos os handlers | 🟢 |
| Consistência | Prazo criado na mesma transação do registro do processo | Chamada em `registrar_processo` | 🟡 |

## Critérios de Aceitação

```gherkin
Cenário: Prazo criado automaticamente ao registrar SR
  Dado usuário logado
  Quando registrar_processo(tipo_detalhe="SR", data_instauracao="2025-01-01")
  Então prazos_processo contém 1 registro com tipo_prazo='inicial', dias=30,
        data_vencimento='2025-01-31'

Cenário: Prorrogar prazo
  Dado processo com prazo ativo vencendo em 2025-01-31
  Quando adicionar_prorrogacao(processo_id=id, dias=30, numero_portaria="Port.001/2025")
  Então novo prazo com tipo_prazo='prorrogacao', data_vencimento='2025-03-02'
        (30 dias a partir de 2025-02-01 = dia seguinte ao vencimento)

Cenário: Prazos vencendo em 7 dias
  Dado prazos com vencimento entre hoje e hoje+7
  Quando obter_prazos_vencendo(dias_antecedencia=7)
  Então retornar lista com esses processos

Cenário: Dashboard
  Quando obter_dashboard_prazos()
  Então retornar {vencidos: int, vencendo_em_7_dias: int, em_andamento: int, concluidos: int}
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Listar prazos + prorrogar + concluir | Must | Gestão temporal obrigatória de processos |
| Alertas de vencimento | Should | Visibilidade operacional |
| Dashboard | Should | Tela inicial do sistema |
| Relatório | Could | Gestão gerencial |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `app/routers/prazos.py` | 7 handlers @eel.expose | 🟢 |
| `prazos_andamentos_manager.py` | `PrazosAndamentosManager` — 15+ métodos | 🟢 |
| `app/services/prazos_andamentos.py` | Wrappers de serviço | 🟢 |
