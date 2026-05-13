# Prazos — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `prazos_processo` com todos os campos (ver `erd-complete.md`)
- [ ] Guard `guard_login` implementado
- [ ] Módulo de processos implementado (`registrar_processo` chama criação de prazo)

## Tarefas

- [ ] T-01 — Implementar `adicionar_prazo_inicial(processo_id, data_inicio, dias_prazo, ...)`
  - Origem: `prazos_andamentos_manager.py:26`
  - Critério: INSERT com tipo_prazo='inicial', ativo=1; data_vencimento = data_inicio + dias
  - Confiança: 🟢

- [ ] T-02 — Implementar `prorrogar_prazo(processo_id, dias, motivo, autorizado_por, portaria, data_portaria)`
  - Origem: `prazos_andamentos_manager.py:57`
  - Critério: busca prazo ativo; UPDATE ativo=0; INSERT prorrogacao com novo vencimento = vencimento_atual + 1 + dias; registra ordem_prorrogacao
  - Confiança: 🟢

- [ ] T-03 — Implementar `listar_prazos_processo(processo_id)`
  - Origem: `prazos_andamentos_manager.py:192`
  - Critério: retorna todos os prazos (inicial + prorrogações) do processo ordenados por data
  - Confiança: 🟢

- [ ] T-04 — Implementar `concluir_prazo(processo_id, responsavel_id?)`
  - Origem: `prazos_andamentos_manager.py:406`
  - Critério: encontra prazo ativo; UPDATE ativo=0 (ou status=concluido conforme schema)
  - Confiança: 🟢

- [ ] T-05 — Implementar `obter_prazos_vencendo(dias_antecedencia=7)`
  - Origem: `prazos_andamentos_manager.py:237`
  - Critério: SELECT prazos com data_vencimento BETWEEN TODAY() AND TODAY()+N e ativo=1
  - Confiança: 🟢

- [ ] T-06 — Implementar `obter_prazos_vencidos()`
  - Origem: `prazos_andamentos_manager.py` (inferido)
  - Critério: SELECT prazos com data_vencimento < TODAY() e ativo=1
  - Confiança: 🟡

- [ ] T-07 — Implementar `obter_dashboard_prazos()`
  - Origem: `prazos_andamentos_manager.py:512`
  - Critério: retorna contagens: vencidos, vencendo_em_7_dias, em_andamento, concluidos
  - Confiança: 🟢

- [ ] T-08 — Implementar `gerar_relatorio_prazos(filtros?)`
  - Origem: `prazos_andamentos_manager.py:601`
  - Critério: filtros opcionais por data, tipo, status; retorna lista de processos com seus prazos
  - Confiança: 🟡

- [ ] T-09 — Confirmar tabela de `prazo_base` por tipo de processo
  - Origem: resposta do usuário em `questions.md#2`
  - Critério: documentar e implementar mapeamento tipo_detalhe → dias_prazo padrão
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Prazo inicial calculado corretamente (data_inicio + dias = data_vencimento)
- [ ] TT-02 — Prorrogação: nova data = vencimento_atual + 1 + dias_prorrogados
- [ ] TT-03 — Após prorrogação, prazo anterior tem ativo=0
- [ ] TT-04 — Dashboard retorna zero para processo sem prazos vencidos

## Ordem Sugerida

1. T-09 (implementar tabela de prazo_base confirmada — bloqueia T-01)
2. T-01 (prazo inicial — base do módulo)
3. T-02, T-03, T-04 (prorrogação, listagem, conclusão)
4. T-05, T-06 (alertas de vencimento)
5. T-07, T-08 (dashboard e relatório)
