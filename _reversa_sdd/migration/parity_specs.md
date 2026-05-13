---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: parity_specs
producedBy: inspector
hash: "sha256:dbbc5b896cd9783da500906739a8f9b621b4198a09a77bfdd702b7361ca1a48c"
---

# Parity Specs

> Especificacao de como provar que o sistema Rust/Tauri + PostgreSQL/sqlx preserva o comportamento relevante do legado Python/Eel. Estes artefatos sao contratos de teste para implementacao posterior.

## Estrategia de paridade

| Modo | Aplicacao | Obrigatorio? |
|---|---|---|
| Characterization tests | Reproduzir entradas/saidas observaveis do legado para fluxos criticos | sim |
| Parallel Run | Comparar legado e alvo em base clonada antes do cutover | sim |
| Data parity | Snapshots SQL e checksums por tabela/agregado | sim |
| Contract tests | Comandos Tauri, envelope de resposta, permissao e erros tipados | sim |
| Contract test de tela | Telas modernizadas, eventos, textos de negocio e 4 estados | sim |
| Golden file visual | Pixel/byte comparison | nao, modo modernizado aprovado |

## Criterio de paridade aceita

- **Metrica primaria**: divergencia funcional bloqueante igual a 0 nos fluxos criticos cobertos.
- **Metrica secundaria**: divergencias nao bloqueantes documentadas em `screen_deviation_log.md` ou no `risk_register.md`.
- **Janela de observacao**: ciclo de validacao manual do usuario em Parallel Run antes do cutover.
- **Bloqueio de cutover**: qualquer divergencia em autenticacao, RBAC, CRUD de processos, prazos, indicios, geracao de mapa mensal, relatorios, auditoria ou integridade de dados bloqueia o cutover.
- **Aceite final**: usuario valida funcionalmente o sistema novo, conforme `migration_brief.md`.

## Cobertura adaptada ao paradigma

- **Transicao**: procedural/camadas Python + Eel para Rust idiomatico + Tauri + sqlx.
- **Dimensoes adicionais obrigatorias**:
  - Invariantes em structs/enums de dominio: tipos de procedimento, solucoes, penalidades, perfis e estados.
  - Validacoes backend centralizadas, sem depender de JS.
  - Erros via `Result` e envelope Tauri normalizado.
  - Guards de autorizacao em todos os comandos de escrita.
  - Transacoes sqlx para operacoes compostas: processo com envolvidos/indicios, substituicao de encarregado, salvar indicios e auditoria.
  - Compatibilidade de leitura com dados legados: SHA-256 de senha, JSONB de andamentos/indicios e PDF BYTEA/base64.

## Paridade de telas

O Screen Translator aprovou `mode: modernized`. Portanto:

- Nao ha comparacao visual byte-a-byte.
- Cada tela de `target_screens.md` deve cumprir:
  - rota declarada;
  - componente/funcao de tela equivalente;
  - comandos Tauri declarados;
  - acoes de escrita restritas a admin;
  - estados `idle`, `loading`, `error`, `success`;
  - textos de negocio preservados salvo aprovacao explicita.
- O arquivo `_reversa_sdd/migration/parity_tests/screens/12-screen-contracts.feature` cobre as 26 telas por tabela de exemplos.

## Excecoes aprovadas

| ID | Origem | Excecao |
|---|---|---|
| DEV-001 | `screen_deviation_log.md` | Layout e componentes podem divergir do HTML/Eel legado. |
| DEV-002 | `screen_deviation_log.md` | `eel.*` sera substituido por comandos Tauri tipados. |
| DEV-003 | `screen_deviation_log.md` | Tokens foram derivados porque nao ha design-system formal. |
| DEV-004 | `screen_deviation_log.md` | Telas de backup/debug/teste nao entram na navegacao principal. |

## Fluxos criticos cobertos

| ID | Arquivo | Origem | Componente alvo |
|---|---|---|---|
| PT-001 | `01-auth.feature` | `_reversa_sdd/autenticacao`, BR-MIGRAR-001/002 | `auth` |
| PT-002 | `02-rbac.feature` | `_reversa_sdd/permissions`, BR-MIGRAR-003 | guards Tauri |
| PT-003 | `03-users.feature` | `_reversa_sdd/usuarios`, BR-MIGRAR-009 | `users` |
| PT-004 | `04-catalogs.feature` | `_reversa_sdd/catalogos`, `_reversa_sdd/rdpm`, `_reversa_sdd/art29` | `legal_catalogs` |
| PT-005 | `05-proceedings.feature` | `_reversa_sdd/processos`, BR-MIGRAR-007/008/016 | `proceedings` |
| PT-006 | `06-deadlines.feature` | `_reversa_sdd/prazos`, BR-MIGRAR-010 | `deadlines` |
| PT-007 | `07-movements.feature` | `_reversa_sdd/andamentos`, BR-MIGRAR-011 | `movements` |
| PT-008 | `08-evidence.feature` | `_reversa_sdd/indicios`, BR-MIGRAR-012 | `evidence` |
| PT-009 | `09-maps-reports.feature` | `_reversa_sdd/mapas`, `_reversa_sdd/relatorios` | `maps_reports` |
| PT-010 | `10-audit.feature` | `_reversa_sdd/auditorias`, BR-MIGRAR-015 | `audit` |
| PT-011 | `11-data-parity.feature` | `target_data_model.md`, `data_migration_plan.md` | PostgreSQL/sqlx |
| PT-012 | `screens/12-screen-contracts.feature` | `target_screens.md` | UI Tauri |

## Data parity

- Usar banco legado clonado para Parallel Run.
- Comparar contagens e checksums por tabelas de usuarios, processos/procedimentos, prazos, auditorias, mapas salvos, catalogos e vinculos de indicios.
- Comparar agregados gerados por relatorios e estatisticas, nao apenas linhas brutas.
- PDF e relatorios binarios devem ser comparados por metadados, existencia, tamanho aceitavel e conteudo textual/estrutura quando a biblioteca alvo divergir do ReportLab.

## Fora de escopo nesta fase

- Mensageria e observabilidade, por decisao do brief.
- Rate limiting, timeout por inatividade e log de login falho, por decisao do Curator.
- IPPM: nao existe; referencias sao descartadas.
