# Plano de Exploração — adm-p6

> Criado pelo Reversa em 2026-05-12
> **Objetivo:** Documentar completamente a aplicação desktop Python/Eel e reescrever em Rust/Tauri com as mesmas funcionalidades, fluxos, regras de negócio e validações. Banco de dados mantido sem alterações.
> Marque cada tarefa com ✅ quando concluída.

---

## Fase 1: Reconhecimento 🔍

- ✅ **Scout** — Mapeamento de estrutura de pastas e tecnologias (Python/Eel, frontend embarcado)
- ✅ **Scout** — Análise de dependências e gerenciadores de pacotes
- ✅ **Scout** — Identificação de entry points, CI/CD e configurações

## Decisão de organização das specs 🗂️

> Entre o Scout e o Arqueólogo, o Reversa pergunta como você quer organizar as specs (por módulo, caso de uso, endpoint, híbrida, por features ou customizada). A escolha fica persistida em `.reversa/config.toml` na seção `[specs]` e não será reperguntada em execuções futuras. Para reapresentar o menu, remova manualmente a seção.

## Fase 2: Escavação 🏗️

> Módulos identificados pelo Scout. Nível: **completo** (diagramas C4, ERD, ADRs, OpenAPI, matrizes).

- ✅ **Arqueólogo** — Análise do módulo `auth` (login, sessão, guards)
- ✅ **Arqueólogo** — Análise do módulo `catalogos` (municípios, distritos)
- ✅ **Arqueólogo** — Análise do módulo `rdpm` (Regulamento Disciplinar PM)
- ✅ **Arqueólogo** — Análise do módulo `art29` (infrações Art. 29 do Estatuto)
- ✅ **Arqueólogo** — Análise do módulo `processos` (PAD, PADE, CD, CJ, SR, SV, IPM, IPPM, FP, CP, PADS)
- ✅ **Arqueólogo** — Análise do módulo `usuarios` (gestão de policiais)
- ✅ **Arqueólogo** — Análise do módulo `prazos` (prazos processuais)
- ✅ **Arqueólogo** — Análise do módulo `andamentos` (movimentações)
- ✅ **Arqueólogo** — Análise do módulo `indicios` (indícios por PM envolvido)
- ✅ **Arqueólogo** — Análise do módulo `mapas` (mapas mensais)
- ✅ **Arqueólogo** — Análise do módulo `relatorios` (geração de PDFs)
- ✅ **Arqueólogo** — Análise do módulo `auditorias` (trilha de auditoria)

## Fase 3: Interpretação 🧠

- ✅ **Detetive** — Arqueologia Git e ADRs retroativos
- ✅ **Detetive** — Regras de negócio implícitas e máquinas de estado
- ✅ **Detetive** — Matriz de permissões (RBAC/ACL)
- ✅ **Arquiteto** — Diagramas C4 (Contexto, Containers, Componentes)
- ✅ **Arquiteto** — ERD completo e integrações externas
- ✅ **Arquiteto** — Spec Impact Matrix

## Fase 4: Geração 📝

- ✅ **Redator** — Specs SDD por componente (regras de negócio, validações, fluxos)
- ✅ **Redator** — Mapeamento de equivalência Python/Eel → Rust/Tauri por módulo
- ✅ **Redator** — User Stories e casos de uso
- ✅ **Redator** — Code/Spec Matrix

## Fase 5: Revisão ✅

- [x] **Revisor** — Revisão cruzada de specs
- [x] **Revisor** — Geração de `questions.md`, `gaps.md` e `confidence-report.md`
- ✅ **Revisor** — Resolução de lacunas com o usuário
- ✅ **Revisor** — Relatório de confiança final (atualizar após respostas)

---

## Agentes Independentes

> Execute estes agentes quando os recursos estiverem disponíveis — podem rodar em qualquer fase.

- [ ] **Visor** — Análise de interface via screenshots (mapear todas as telas para redesign em Tauri)
- [ ] **Data Master** — Análise completa do banco de dados (crítico: banco será reaproveitado sem alterações)
- [ ] **Design System** — Extração de tokens de design

---

## Próximo passo (após extração completa)

Com o `_reversa_sdd/` populado:

- `/reversa-migrate`: orquestrador do **Time de Migração** → gera specs do sistema Rust/Tauri.
  Sequência: Paradigm Advisor → Curator → Strategist → Designer → Screen Translator → Inspector
- `/reversa-reconstructor`: reimplementação bottom-up a partir das specs (uma tarefa por sessão).
