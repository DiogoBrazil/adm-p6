# Indícios — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabelas `pm_envolvido_indicios`, `pm_envolvido_crimes`, `pm_envolvido_rdpm`, `pm_envolvido_art29`
- [ ] Tabelas de catálogo: `catalogos_crimes`, `catalogos_rdpm`, `infracoes_estatuto_art29`
- [ ] Tabela `procedimento_pms_envolvidos` disponível
- [ ] Guard `guard_login` implementado

## Tarefas

- [ ] T-01 — Implementar `salvar_indicios_pm_envolvido(pm_id, indicios_data)`
  - Origem: `app/services/indicios.py:15`
  - Critério: upsert — verifica existência, DELETE vínculos, recria crimes/RDPM/art29; atualiza `categorias_indicios` JSONB
  - Confiança: 🟢

- [ ] T-02 — Implementar `carregar_indicios_pm_envolvido(pm_id)`
  - Origem: `app/services/indicios.py` (inferido — não lido completamente)
  - Critério: retorna `{categorias, crimes:[{id, descricao}], rdpm:[{id, descricao}], art29:[{id, inciso, texto}]}`
  - Confiança: 🟡

- [ ] T-03 — Implementar `listar_pms_envolvidos_com_indicios(procedimento_id)`
  - Origem: `app/services/indicios.py` (inferido)
  - Critério: JOIN `procedimento_pms_envolvidos` → `pm_envolvido_indicios` → 3 tabelas de vínculo; retorna PMs com indícios consolidados
  - Confiança: 🟡

- [ ] T-04 — Implementar `remover_indicios_pm_envolvido(pm_id)`
  - Origem: `app/routers/indicios.py:49`
  - Critério: DELETE vínculos + UPDATE `pm_envolvido_indicios` SET ativo=FALSE (ou DELETE)
  - Confiança: 🟡

- [ ] T-05 — Implementar `buscar_crimes_para_indicios(termo)`
  - Origem: `app/services/indicios.py` (inferido)
  - Critério: SELECT de `catalogos_crimes` com ILIKE por `termo`; retorna `[{id, descricao, ...}]`
  - Confiança: 🟡

- [ ] T-06 — Implementar `buscar_rdpm_para_indicios(termo, gravidade?)`
  - Origem: `app/services/indicios.py`
  - Critério: SELECT de `catalogos_rdpm` filtrando por `termo` e opcionalmente `gravidade`
  - Confiança: 🟡

- [ ] T-07 — Implementar `buscar_art29_para_indicios(termo)`
  - Origem: `app/services/indicios.py`
  - Critério: SELECT de `infracoes_estatuto_art29 WHERE ativo=TRUE` filtrando por `termo`
  - Confiança: 🟡

- [ ] T-08 — Implementar `obter_categorias_indicios()`
  - Origem: `app/routers/indicios.py:85`
  - Critério: retorna categorias extensíveis a partir dos catálogos administráveis `transgressoes`, `infracoes_estatuto_art29` e `crimes_contravencoes`
  - Confiança: 🟢 (confirmado pelo usuário em `questions.md#11`)

## Tarefas de Teste

- [ ] TT-01 — Salvar com 2 crimes → regsitro criado com 2 vínculos em pm_envolvido_crimes
- [ ] TT-02 — Segundo salvar substitui (não duplica) os vínculos
- [ ] TT-03 — Carregar retorna crimes com descrição (JOIN com catalogos_crimes)
- [ ] TT-04 — Buscar crimes filtra por termo (ILIKE)

## Ordem Sugerida

1. T-05, T-06, T-07 (buscas de catálogo — sem dependências)
2. T-01 (salvar — depende das buscas para ter dados válidos)
3. T-02, T-03, T-04, T-08 (carregar, listar, remover, categorias)
