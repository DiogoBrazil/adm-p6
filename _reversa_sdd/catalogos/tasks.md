# Catálogos — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabelas `crimes_contravencoes` e `municipios_distritos` disponíveis
- [ ] Guard `guard_admin` implementado (ver `autenticacao/tasks.md`)
- [ ] `registrar_auditoria` disponível via DatabaseManager

## Tarefas

- [ ] T-01 — Implementar `listar_crimes_contravencoes()`
  - Origem: `app/catalogos.py` + `app/routers/catalogos.py:20`
  - Critério de pronto: retorna crimes ativos ordenados por tipo, dispositivo_legal, artigo
  - Confiança: 🟢

- [ ] T-02 — Implementar `obter_crime_por_id(id)`
  - Origem: `app/routers/catalogos.py:27`
  - Critério de pronto: retorna crime ou erro estruturado se não encontrado
  - Confiança: 🟢

- [ ] T-03 — Implementar validação de campos legais
  - Origem: `app/utils.py:validar_campos_crime`
  - Critério de pronto: artigo só aceita dígitos; parágrafo converte puro→ordinal; inciso→uppercase; alínea→lowercase
  - Confiança: 🟢

- [ ] T-04 — Implementar `cadastrar_crime(...)` com validação e auditoria
  - Origem: `app/routers/catalogos.py:34-40`
  - Critério de pronto: valida campos antes de persistir; registra CREATE na auditoria
  - Confiança: 🟢

- [ ] T-05 — Implementar `atualizar_crime(id, ...)` com validação e auditoria
  - Origem: `app/routers/catalogos.py:41-65`
  - Critério de pronto: valida campos; UPDATE no banco; registra UPDATE na auditoria
  - Confiança: 🟢

- [ ] T-06 — Implementar `excluir_crime_contravencao(id)` (soft delete)
  - Origem: `app/routers/catalogos.py:66`
  - Critério de pronto: `ativo=FALSE`; crime some das listagens
  - Confiança: 🟢

- [ ] T-07 — Implementar `buscar_municipios_distritos(termo)`
  - Origem: `app/catalogos.py` — ILIKE + formato composto
  - Critério de pronto: busca case-insensitive; distritos exibem "(Município pai)"
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Listagem retorna apenas ativos, ordenados corretamente
- [ ] TT-02 — Cadastro com campos inválidos rejeita sem persistir
- [ ] TT-03 — Cadastro por usuário comum é bloqueado pelo guard
- [ ] TT-04 — Soft delete: crime excluído não aparece em listagem
- [ ] TT-05 — Busca de município case-insensitive retorna resultados corretos
- [ ] TT-06 — Distrito com municipio_pai exibe nome composto

## Ordem Sugerida

1. T-03 (validação) — usado por T-04 e T-05
2. T-01 e T-07 (leituras) — sem dependências internas
3. T-02 (obter por ID)
4. T-04, T-05, T-06 (escrita com guard_admin)

## Lacunas Pendentes (🔴)

- Definir se o padrão de resposta será uniformizado para `sucesso/dados` na migração ou se mantém `success/crimes`
