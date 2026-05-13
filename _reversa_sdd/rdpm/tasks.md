# RDPM — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `transgressoes` com id SERIAL disponível
- [ ] Guard `guard_admin` implementado
- [ ] `registrar_auditoria` disponível

## Tarefas

- [ ] T-01 — Implementar `listar_todas_transgressoes()` com title-case na gravidade
  - Origem: `app/rdpm.py` + `app/routers/rdpm.py:9`
  - Critério de pronto: lista ordenada por artigo+inciso; gravidade em title-case
  - Confiança: 🟢

- [ ] T-02 — Implementar `obter_transgressao_por_id(id)`
  - Origem: `app/routers/rdpm.py:32`
  - Critério de pronto: retorna transgressão ou erro estruturado
  - Confiança: 🟢

- [ ] T-03 — Implementar `cadastrar_transgressao(...)` com auditoria
  - Origem: `app/routers/rdpm.py:39`
  - Critério de pronto: INSERT + auditoria CREATE
  - Confiança: 🟢

- [ ] T-04 — Implementar `atualizar_transgressao(id, ...)` com check de unicidade
  - Origem: `app/rdpm.py` — check case-insensitive em `(gravidade, inciso)`
  - Critério de pronto: rejeita duplicata; auditoria UPDATE
  - Confiança: 🟢

- [ ] T-05 — Implementar `excluir_transgressao(id)` (hard delete)
  - Origem: `app/routers/rdpm.py:54`
  - Critério de pronto: DELETE + auditoria DELETE; tratar FK violation graciosamente
  - Confiança: 🟢

- [ ] T-06 — Adicionar verificação de referências antes do hard delete
  - Origem: lacuna identificada — sem verificação no legado; política confirmada pelo usuário em `questions.md#13`
  - Critério de pronto: checar `pm_envolvido_rdpm` antes de deletar; retornar erro descritivo se houver referências
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Listagem retorna gravidade em title-case, ordem correta
- [ ] TT-02 — Atualização com duplicata (gravidade, inciso) retorna erro
- [ ] TT-03 — Atualização do próprio registro não gera erro de duplicata
- [ ] TT-04 — Hard delete com referências em pm_envolvido_rdpm retorna erro (após T-06)
- [ ] TT-05 — Auditoria DELETE registrada após excluir

## Ordem Sugerida

1. T-01, T-02 (leituras)
2. T-03 (cadastro)
3. T-04 (atualização com unicidade)
4. T-05 + T-06 (exclusão + proteção FK)

## Lacunas Pendentes (🔴)

- Nenhuma lacuna bloqueante após validação do usuário.
- Política confirmada: manter hard delete, mas bloquear exclusão quando houver referências em `pm_envolvido_rdpm`.
