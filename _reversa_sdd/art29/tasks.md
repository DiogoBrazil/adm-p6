# Art. 29 — Tarefas de Implementação

## Pré-requisitos
- [ ] Tabela `infracoes_estatuto_art29` com UUID disponível
- [ ] Guard `guard_admin` implementado

## Tarefas

- [ ] T-01 — Implementar `listar_infracoes_estatuto_art29()` com ordenação romana
  - Origem: `app/art29.py:14` — SQL com CASE WHEN LENGTH(inciso)
  - Critério de pronto: incisos romanos (I, V, X, L, C) ordenados por comprimento; demais ao final
  - Confiança: 🟢

- [ ] T-02 — Implementar `obter_infracao_estatuto_art29(id)`
  - Origem: `app/routers/art29.py:16`
  - Critério de pronto: retorna infração ou erro estruturado
  - Confiança: 🟢

- [ ] T-03 — Implementar `criar_infracao_estatuto_art29(inciso, texto)` com unicidade
  - Origem: `app/routers/art29.py:23`
  - Critério de pronto: rejeita inciso duplicado entre ativos; insere com UUID
  - Confiança: 🟢

- [ ] T-04 — Implementar `editar_infracao_estatuto_art29(id, inciso, texto)` com unicidade
  - Origem: `app/routers/art29.py:39`
  - Critério de pronto: check unicidade excluindo próprio registro; UPDATE
  - Confiança: 🟢

- [ ] T-05 — Implementar `excluir_infracao_estatuto_art29(id)` (soft delete)
  - Origem: `app/routers/art29.py:55`
  - Critério de pronto: `ativo=FALSE`; não aparece em listagens
  - Confiança: 🟢

## Tarefas de Teste
- [ ] TT-01 — Ordenação: I < II < III < IV < V < X; "ABC" vai ao final
- [ ] TT-02 — Criar com inciso de inativo não levanta erro
- [ ] TT-03 — Criar com inciso de ativo levanta erro

## Ordem Sugerida
1. T-01 (listagem com ordenação especial — algoritmo crítico)
2. T-02 a T-05 (CRUD padrão)
