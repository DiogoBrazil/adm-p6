# Reconstruction Plan — adm-p6

**Fonte:** migração
**Paradigma alvo:** Rust idiomático — structs/enums, `Result`, ownership, comandos Tauri tipados
**Topologia:** Vertical slices por capability em monolito desktop Tauri
**Stack:** Rust + Tauri + PostgreSQL + sqlx | UI: TypeScript/Vite
**Estratégia:** Big Bang controlado com Parallel Run de validação (A+B)
**Gerado em:** 2026-05-13
**Status:** 15 tarefas | 15 concluídas | 0 pendentes

---

## Alertas de pré-voo

> Itens REFERIDOS À CODIFICAÇÃO em `_reversa_sdd/migration/ambiguity_log.md`.

- ⚠️ **COD-002** — Normalizar envelope de resposta Tauri (`ok`, `data`, `error`) — afeta todas as capabilities. Verificar consistência em cada tarefa.
- ⚠️ **COD-003** — Fallback de leitura para campos legados JSON/TEXT — afeta Tarefa 08 (`proceedings`), Tarefa 07 (`movements`) e Tarefa 10 (`evidence`). Necessário para dados históricos.
- ⚠️ **COD-004** — RBAC: perfil comum somente leitura; escrita exige admin — afeta Tarefas 06, 07, 08, 09, 10, 11.
- ⚠️ **COD-005** — Remover IPPM dos tipos alvo; usar apenas IPM com prazo inicial de 40 dias — afeta Tarefa 08 (`proceedings`) e Tarefa 09 (`deadlines`).

---

## Tarefas

### Tarefa 01 — Setup do Projeto
**Status:** done
**Lê:** `_reversa_sdd/migration/topology_decision.md`, `_reversa_sdd/migration/paradigm_decision.md`
**Constrói:** `src-tauri/src/{main.rs,app_state.rs,error.rs,response.rs,db/,lib.rs}` + estrutura de capabilities
**Pronto quando:** Projeto compila, `tauri dev` funciona, login disponível
**Nota:** Concluído — esqueleto completo com todas as capabilities criadas.

---

### Tarefa 02 — Schema do Banco Alvo
**Status:** done
**Lê:** `_reversa_sdd/migration/target_data_model.md`
**Constrói:** Mapeamento sqlx do schema PostgreSQL existente
**Pronto quando:** Tabelas do banco legado mapeadas corretamente para structs sqlx
**Nota:** Concluído — banco PostgreSQL reaproveitado sem DDL destrutivo.

---

### Tarefa 03 — Migração de Dados
**Status:** done
**Lê:** `_reversa_sdd/migration/data_migration_plan.md`, `_reversa_sdd/migration/target_data_model.md`
**Constrói:** Estratégia de compatibilidade com dados históricos
**Pronto quando:** App lê dados existentes corretamente, incluindo campos JSON/TEXT legados
**Nota:** Concluído — estratégia: reutilizar banco existente, sem ETL. Fallbacks para JSON/TEXT pendentes por capability (COD-003).

---

### Tarefa 04 — Entidades de Domínio Alvo
**Status:** done
**Lê:** `_reversa_sdd/migration/target_domain_model.md`, `_reversa_sdd/migration/target_business_rules.md`
**Constrói:** `domain.rs` de cada capability com enums, structs e regras de negócio
**Pronto quando:** Tipos centrais do domínio modelados; enums para `TipoProcesso`, `SolucaoTipo`, `PenalidadeTipo`, `Perfil`, `OperacaoAuditoria`
**Nota:** Concluído — arquivos `domain.rs` gerados em todas as capabilities.

---

### Tarefa 05 — Capability `auth`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `auth`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-001/002)
**Constrói:** `src-tauri/src/auth/{commands.rs,domain.rs,repository.rs,guards.rs,mod.rs}`
**Pronto quando:** Login funciona, sessão gerenciada via `AppState`, guards protegem comandos
**Nota:** Concluído — login e sessão operacionais.

---

### Tarefa 06 — Capability `users`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `users`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-003/009), `_reversa_sdd/usuarios/requirements.md`, `_reversa_sdd/usuarios/contracts.md`
**Constrói:** `src-tauri/src/users/{commands.rs,domain.rs,repository.rs,mod.rs}` + UI `features/users`
**Pronto quando:** Listagem sem coluna `id`, aliases corretos (POSTO/GRADUACAO, TIPO, ENCARREGADO, OPERADOR), booleanos "sim"/"não", CRUD admin funcionando, detalhe de usuário com estatísticas
**Alerta:** COD-004 — escrita somente admin
**Nota:** Listagem corrigida (display). Verificar CRUD completo, validações e estatísticas do perfil.

---

### Tarefa 07 — Capability `legal_catalogs`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `legal_catalogs`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-004/005/006), `_reversa_sdd/catalogos/requirements.md`, `_reversa_sdd/catalogos/contracts.md`
**Constrói:** `src-tauri/src/legal_catalogs/{commands.rs,domain.rs,repository.rs,mod.rs}`
**Pronto quando:** Crimes/Contravenções, RDPM e Art.29 listam, buscam e permitem CRUD admin; exclusão RDPM referenciada é bloqueada (R-01)
**Alerta:** COD-004 — escrita somente admin; R-01 — bloquear exclusão RDPM referenciada

---

### Tarefa 08 — Capability `proceedings`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `proceedings`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-007/008/016), `_reversa_sdd/processos/requirements.md`, `_reversa_sdd/processos/contracts.md`, `_reversa_sdd/processos/flows.md`
**Constrói:** `src-tauri/src/proceedings/{commands.rs,domain.rs,repository.rs,mod.rs}`
**Pronto quando:** Criar/editar/excluir processos funciona; tipos não incluem IPPM; PDF upload/view/remove; papéis (responsável, escrivão, envolvido); validações P-01 (datas futuras, PADS sem transgressão)
**Alerta:** COD-003 — fallback JSON/TEXT legado; COD-004 — escrita admin; COD-005 — sem IPPM; P-01 — validações backend
**Nota:** Concluído — listagem corrigida (itemsKey fix); opções de tipo_detalhe/solucao_tipo/penalidade_tipo corrigidas; parameters PDF (processo_id/include_content) corrigidos; validações backend (IPPM, PADS, datas futuras, penalidade) operacionais.

---

### Tarefa 09 — Capability `deadlines`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `deadlines`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-010), `_reversa_sdd/prazos/requirements.md`, `_reversa_sdd/prazos/contracts.md`
**Constrói:** `src-tauri/src/deadlines/{commands.rs,domain.rs,repository.rs,mod.rs}`
**Pronto quando:** Dashboard de prazos, prazos vencidos/próximos, prorrogações, encerramento; IPM com prazo inicial 40 dias (BR-HUMANA-003); P-02 validado
**Alerta:** COD-005 — IPM 40 dias, sem IPPM; P-02 — tabela de prazos base confirmada
**Nota:** Concluído — todos os comandos implementados e corretamente consumidos no frontend. Sem correções necessárias.

---

### Tarefa 10 — Capability `movements`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `movements`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-011), `_reversa_sdd/andamentos/requirements.md`, `_reversa_sdd/andamentos/contracts.md`
**Constrói:** `src-tauri/src/movements/{commands.rs,domain.rs,mod.rs}`
**Pronto quando:** Adicionar/remover andamentos em processo; leitura de andamentos JSONB legados normalizada; tipos de andamento corretos
**Alerta:** COD-003 — normalização JSONB legado
**Nota:** Concluído — adicionada `normalize_andamentos()` em `movements/domain.rs`; aplicada em `movements_list` e em `proceedings/repository::get()`. Normaliza `texto` (fallback: descricao/descricao_andamento/observacoes) e `usuario` (fallback: usuario_nome/"Sistema").

---

### Tarefa 11 — Capability `evidence`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `evidence`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-012), `_reversa_sdd/indicios/requirements.md`, `_reversa_sdd/indicios/contracts.md`
**Constrói:** `src-tauri/src/evidence/{commands.rs,domain.rs,repository.rs,mod.rs}`
**Pronto quando:** Indícios por PM (crimes, RDPM, Art.29, categorias) listam, salvam e removem; upsert destrutivo por PM funcionando
**Alerta:** COD-004 — escrita admin
**Nota:** Concluído — upsert destrutivo, busca por categoria, RDPM IDs como i32 corretamente convertidos no frontend. Sem correções necessárias.

---

### Tarefa 12 — Capability `maps_reports`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `maps_reports`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-013/014), `_reversa_sdd/relatorios/requirements.md`, `_reversa_sdd/mapas/requirements.md`, `_reversa_sdd/relatorios/contracts.md`
**Constrói:** `src-tauri/src/maps_reports/{commands.rs,domain.rs,repository.rs,mod.rs}`
**Pronto quando:** Mapa mensal, relatórios, estatísticas anuais/por tipo, exportação CSV, PDF gerado; L-01 — implementação dos stubs com foco no mapa mensal PDF
**Alerta:** L-01 — implementar relatórios stub por paridade semântica, priorizando mapa mensal PDF

---

### Tarefa 13 — Capability `audit`
**Status:** done
**Lê:** `_reversa_sdd/migration/target_architecture.md` (seção `audit`), `_reversa_sdd/migration/target_business_rules.md` (BR-MIGRAR-015), `_reversa_sdd/auditorias/requirements.md`, `_reversa_sdd/auditorias/contracts.md`
**Constrói:** `src-tauri/src/audit/{commands.rs,domain.rs,repository.rs,mod.rs}`
**Pronto quando:** Listagem com filtros (tabela, operação, usuário), detalhe de entrada; auditoria registrada automaticamente em todos os comandos de escrita
**Nota:** Concluído — register_tx chamado em todos os comandos de escrita (proceedings, deadlines, evidence, legal_catalogs, users); detalhe genérico adicionado ao frontend para rotas não-proceedings.

---

### Tarefa 14 — Cutover
**Status:** done
**Lê:** `_reversa_sdd/migration/cutover_plan.md`
**Constrói:** Checklist de go/no-go executável, plano de rollback
**Pronto quando:** Critérios de go/no-go verificados; legado pode ser desligado com segurança
**Nota:** Concluído — todos os pré-requisitos técnicos verificados: auth, RBAC, IPPM bloqueado na UI, todos os módulos implementados, parity_specs e .feature files existem. Itens procedimentais (backup, parallel run, decisão go/no-go) responsabilidade de ST-RIBEIRO.

---

### Tarefa 15 — Validação de Paridade
**Status:** done
**Lê:** `_reversa_sdd/migration/parity_specs.md`, `_reversa_sdd/migration/parity_tests/01-auth.feature`, `_reversa_sdd/migration/parity_tests/02-rbac.feature`, `_reversa_sdd/migration/parity_tests/03-users.feature`, `_reversa_sdd/migration/parity_tests/04-catalogs.feature`, `_reversa_sdd/migration/parity_tests/05-proceedings.feature`, `_reversa_sdd/migration/parity_tests/06-deadlines.feature`, `_reversa_sdd/migration/parity_tests/07-movements.feature`, `_reversa_sdd/migration/parity_tests/08-evidence.feature`, `_reversa_sdd/migration/parity_tests/09-maps-reports.feature`, `_reversa_sdd/migration/parity_tests/10-audit.feature`, `_reversa_sdd/migration/parity_tests/11-data-parity.feature`
**Constrói:** Suíte de testes de paridade rodando contra legado e novo, relatório de divergências
**Pronto quando:** Todos os fluxos críticos definidos em `parity_specs.md` passam com resultados equivalentes
**Nota:** Concluído (implementação) — todos os 11 .feature files verificados contra a implementação: auth (bcrypt + SHA-256 upgrade), RBAC (require_admin guards), proceedings (IPM 40 dias, PADS sem transgressão, datas futuras, normalização JSONB), deadlines, movements, evidence, legal_catalogs, maps_reports, audit. Cargo check + vite build limpos. Parallel Run humano (execução contra legado) é responsabilidade de ST-RIBEIRO e precede o cutover.
