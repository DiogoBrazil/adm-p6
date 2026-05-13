---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: handoff
producedBy: orchestrator
hash: "sha256:a92a1c709ee0547aa1d014e80d36463a8e28575821bb2024ba7152b40ff547ad"
---

# Handoff para o Agente de Codificacao

> Porta de entrada para implementar o sistema novo em Rust/Tauri com PostgreSQL/sqlx a partir das specs de migracao.

## Leitura obrigatoria primeiro

1. **`paradigm_decision.md`**: leitura inegociavel. O alvo e Rust/Tauri idiomatico, com tipos fortes, `Result`, comandos Tauri tipados e sqlx.
2. **`topology_decision.md`**: leitura inegociavel. A topologia aprovada e moderna, por vertical slices/capabilities em monolito desktop.
3. **`screen_modernization_decision.md`**: leitura inegociavel. O modo visual aprovado e modernizado.

## Ordem de leitura recomendada

1. `paradigm_decision.md`
2. `topology_decision.md`
3. `screen_modernization_decision.md`
4. `migration_brief.md`
5. `target_business_rules.md`
6. `migration_strategy.md`
7. `target_architecture.md`
8. `target_domain_model.md`
9. `target_data_model.md`
10. `data_migration_plan.md`
11. `target_screens.md`
12. `parity_specs.md` + `parity_tests/`
13. `screen_deviation_log.md`
14. `risk_register.md` + `cutover_plan.md`
15. `discard_log.md`
16. `ambiguity_log.md`

## Lista de artefatos produzidos

| Artefato | Produzido por | Status |
|---|---|---|
| `migration_brief.md` | orchestrator | criado |
| `paradigm_decision.md` | paradigm_advisor | criado |
| `target_business_rules.md` | curator | criado |
| `discard_log.md` | curator | criado |
| `ambiguity_log.md` | curator/orchestrator | consolidado |
| `migration_strategy.md` | strategist | criado |
| `risk_register.md` | strategist | criado |
| `cutover_plan.md` | strategist | criado |
| `topology_decision.md` | designer Fase 1 | criado e aprovado |
| `target_architecture.md` | designer Fase 2 | criado e aprovado |
| `target_domain_model.md` | designer | criado |
| `target_data_model.md` | designer | criado |
| `data_migration_plan.md` | designer | criado |
| `screen_modernization_decision.md` | screen_translator Fase 1 | criado e aprovado |
| `target_screens.md` | screen_translator Fase 2 | criado |
| `screen_deviation_log.md` | screen_translator | criado, 0 pendentes |
| `_reversa_sdd/screens/inventory.json` | screen_translator | criado, 26 telas |
| `_reversa_sdd/design-system/tokens-derived.md` | screen_translator | criado |
| `_reversa_sdd/screens/golden/manifest.yaml` | screen_translator | criado, sem golden files |
| `parity_specs.md` | inspector | criado |
| `parity_tests/*.feature` | inspector | 12 arquivos |

## Bloqueadores para comecar a implementacao

- Nenhum bloqueador humano pendente.

## Itens referidos a codificacao

- Usar MCP Context7 para duvidas de Rust, Tauri, PostgreSQL ou sqlx durante implementacao.
- Normalizar envelope de resposta Tauri (`ok`, `data`, `error`) e substituir `eel.*`.
- Reaproveitar schema PostgreSQL na primeira versao; evitar DDL destrutivo.
- Implementar RBAC aprovado: criacao, edicao e remocao somente para admins; demais perfis somente leitura.
- Desconsiderar IPPM; o tipo correto e IPM com prazo inicial de 40 dias.
- Implementar relatorios, mapas, graficos e estatisticas por paridade semantica, mesmo quando o legado tiver stubs ou duplicacoes.
- Telas de backup/debug/teste ficam fora da navegacao principal, mas permanecem rastreadas.

## Proximos passos para o agente de codificacao

1. Configurar o novo repositório/app Tauri com Rust, sqlx e PostgreSQL.
2. Criar a arvore por capabilities indicada em `target_architecture.md`: `auth`, `users`, `legal_catalogs`, `proceedings`, `deadlines`, `movements`, `evidence`, `maps_reports`, `audit`.
3. Implementar infraestrutura primeiro: config, pool sqlx, erro tipado, `AppState`, guards de sessao/RBAC e auditoria.
4. Implementar dominio e repositorios bottom-up, preservando validacoes do `target_business_rules.md`.
5. Implementar comandos Tauri tipados e o envelope de resposta normalizado.
6. Implementar telas modernizadas a partir de `target_screens.md` e `tokens-derived.md`.
7. Escrever testes a partir de `parity_specs.md` e dos 12 `.feature`.
8. Validar em Parallel Run com base PostgreSQL clonada.
9. Seguir `cutover_plan.md` para go/no-go.

## Itens auto-decididos

- Pipeline executado em modo interativo; nenhum item auto-decidido por `--auto`.

## Notas finais

- A migracao nao deve portar Eel, PyInstaller ou handlers legados sem uso.
- O objetivo e manter 100% das funcionalidades usadas, nao copiar UI pixel-perfect.
- O usuario fara a validacao final, entao a implementacao deve facilitar comparacao funcional com o legado.
