# Andamentos — Tarefas de Implementação

## Pré-requisitos

- [ ] Campo `andamentos JSONB` em `processos_procedimentos` disponível
- [ ] Guard `guard_login` implementado

## Tarefas

- [ ] T-01 — Implementar `adicionar_andamento(processo_id, texto, usuario_nome?)`
  - Origem: `app/services/prazos_andamentos.py:94`
  - Critério: SELECT → parse JSONB → insert(0, novo) → UPDATE; retorna `{sucesso, andamento}`; padrão usuario="Sistema"
  - Confiança: 🟢

- [ ] T-02 — Implementar `listar_andamentos(processo_id)` com normalização de campos
  - Origem: `app/services/prazos_andamentos.py:165`
  - Critério: parse com fallback de campos legados (texto/descricao/descricao_andamento); retorna lista com `texto` e `usuario` normalizados
  - Confiança: 🟢

- [ ] T-03 — Implementar `remover_andamento(processo_id, andamento_id)`
  - Origem: `app/services/prazos_andamentos.py:252`
  - Critério: filtra por id na lista JSONB; reescreve campo; retorna `{sucesso, mensagem}`
  - Confiança: 🟢

- [ ] T-04 — Implementar `obter_tipos_andamento()`
  - Origem: `app/services/prazos_andamentos.py:393`
  - Critério: retorna lista de tipos válidos de andamento
  - Confiança: 🟡

- [ ] T-05 — Implementar `calcular_prazo_processo(tipo, data_inicio, dias?)`
  - Origem: `app/services/prazos_andamentos.py:420`
  - Critério: retorna data_vencimento calculada
  - Confiança: 🟡

## Tarefas de Teste

- [ ] TT-01 — Novo andamento aparece no índice 0 da lista (mais recente primeiro)
- [ ] TT-02 — Campos legados `descricao_andamento` normalizados para `texto` na listagem
- [ ] TT-03 — Remoção por ID não afeta os outros andamentos da lista

## Ordem Sugerida

1. T-01, T-02, T-03 (CRUD principal)
2. T-04, T-05 (auxiliares)

## Lacunas

- 🟢 Confirmado pelo usuário (`questions.md#12`): `PrazosAndamentosManager.registrar_andamento` escreve na mesma lista JSONB em `processos_procedimentos.andamentos`.
