---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: discard_log
producedBy: curator
hash: "sha256:fe236c97e6f9d193afa6279d0b7743b1b27be0d8e716737cc6b172c78f711bee"
---

# Discard Log

> Registro completo do que foi descartado da migracao e por que. Cada item tem rastreabilidade para a origem no legado.

## Itens descartados

### BR-DESCARTAR-001 — Eel/WebSocket proprietario
- **Origem**: `_reversa_sdd/architecture.md` Stack Tecnologica / Estrutura de Camadas
- **Descricao**: comunicacao frontend-backend via Eel, `eel.expose`, `eel.js_func` e WebSocket proprietario.
- **Justificativa**: detalhe tecnico da plataforma antiga; Tauri usa comandos/eventos proprios.
- **Vinculado a paradigma**: sim
  - O paradigma alvo absorve o caso com comandos Tauri tipados e estado gerenciado.
- **Reposicao no sistema novo**: comandos `#[tauri::command]` e camada de aplicacao Rust.
- **Risco de descartar**: baixo, desde que contratos funcionais sejam preservados.

### BR-DESCARTAR-002 — PyInstaller e fallback de Chrome
- **Origem**: `_reversa_sdd/inventory.md` Empacotamento; `_reversa_sdd/architecture.md` Packaging
- **Descricao**: empacotamento com PyInstaller, abertura de Chrome/default browser e assets copiados via `--add-data`.
- **Justificativa**: mecanismo especifico de Python/Eel, incompatível com Tauri.
- **Vinculado a paradigma**: sim
  - Tauri possui pipeline proprio de build/bundle.
- **Reposicao no sistema novo**: bundling Tauri.
- **Risco de descartar**: baixo.

### BR-DESCARTAR-003 — Handlers legados nao usados
- **Origem**: `_reversa_sdd/processos/requirements.md` Rastreabilidade; `_reversa_sdd/questions.md` pergunta 3
- **Descricao**: cerca de 60 handlers em `main.py` nao migrados para routers e nao usados pela UI atual.
- **Justificativa**: usuario confirmou desconsiderar os nao usados.
- **Vinculado a paradigma**: nao
- **Reposicao no sistema novo**: nenhuma.
- **Risco de descartar**: medio; mitigacao: Screen Translator e Inspector devem validar que fluxos usados pela UI atual continuam cobertos.

### BR-DESCARTAR-004 — `atualizar_usuario_old`
- **Origem**: `_reversa_sdd/questions.md` pergunta 9
- **Descricao**: handler antigo mantido por compatibilidade no legado.
- **Justificativa**: usuario confirmou que pode ser removido na migracao Rust.
- **Vinculado a paradigma**: nao
- **Reposicao no sistema novo**: usar apenas contrato atual de atualizacao de usuario.
- **Risco de descartar**: baixo.

### BR-DESCARTAR-005 — `processos_procedimentos.indicios_categorias` TEXT como fonte canonica
- **Origem**: `_reversa_sdd/questions.md` pergunta 4
- **Descricao**: campo legado TEXT de categorias de indicios no processo.
- **Justificativa**: usuario confirmou usar apenas `pm_envolvido_indicios.categorias_indicios` JSONB.
- **Vinculado a paradigma**: nao
- **Reposicao no sistema novo**: fonte canonica em `pm_envolvido_indicios.categorias_indicios`; fallback de leitura se necessario.
- **Risco de descartar**: medio em bases antigas; mitigar com leitura defensiva se houver dados historicos.

### BR-DESCARTAR-006 — SHA-256 em atualizacao de usuario
- **Origem**: `_reversa_sdd/usuarios/requirements.md` RN-13; `_reversa_sdd/questions.md` pergunta 7
- **Descricao**: `atualizar_usuario` salva nova senha em SHA-256.
- **Justificativa**: bug confirmado; usuario decidiu usar bcrypt.
- **Vinculado a paradigma**: nao
- **Reposicao no sistema novo**: bcrypt em cadastro, login upgrade e atualizacao.
- **Risco de descartar**: baixo; manter compatibilidade de login com hashes SHA-256 existentes.

### BR-DESCARTAR-007 — Debug prints de producao
- **Origem**: `_reversa_sdd/gaps.md` Acoes Obrigatorias
- **Descricao**: prints de debug em indicios, processos e relatorios.
- **Justificativa**: ruido de implementacao legado, nao regra de negocio.
- **Vinculado a paradigma**: sim
  - Rust/Tauri deve usar tratamento de erro e logging deliberado, nao prints dispersos.
- **Reposicao no sistema novo**: logs estruturados apenas onde forem uteis.
- **Risco de descartar**: baixo.

### BR-DESCARTAR-008 — Padrao duplo de resposta
- **Origem**: `_reversa_sdd/domain.md` RN-21
- **Descricao**: coexistencia de `{sucesso,mensagem}` e `{success,error}` no legado.
- **Justificativa**: compatibilidade acidental do frontend Eel; no alvo deve haver envelope consistente.
- **Vinculado a paradigma**: sim
  - Com Rust/Tauri, comandos podem retornar DTOs e erros tipados de forma uniforme.
- **Reposicao no sistema novo**: envelope/erro padronizado, com adaptacao no frontend.
- **Risco de descartar**: medio; mitigar com Screen Translator e Inspector validando mensagens e estados essenciais.

### BR-DESCARTAR-009 — Referencias a IPPM
- **Origem**: `_reversa_sdd/domain.md` Glossario/RN-14; specs que listam `IPPM`
- **Descricao**: referencias ao tipo `IPPM`.
- **Justificativa**: usuario esclareceu durante o `/reversa-migrate` que IPPM nao existe; o correto e IPM, cujo prazo inicial e 40 dias.
- **Vinculado a paradigma**: nao
- **Reposicao no sistema novo**: nenhuma. Usar apenas IPM.
- **Risco de descartar**: baixo; mitigar removendo IPPM dos enums/listas alvo e validando telas/fixtures.

## Itens descartados por mudanca de paradigma

| ID | Origem | Paradigma legado | Substituto no paradigma alvo |
|---|---|---|---|
| BR-DESCARTAR-001 | `_reversa_sdd/architecture.md` | Eel procedural com WebSocket proprietario | Comandos Tauri tipados |
| BR-DESCARTAR-002 | `_reversa_sdd/inventory.md` | Empacotamento Python/Eel | Bundling Tauri |
| BR-DESCARTAR-007 | `_reversa_sdd/gaps.md` | Debug print procedural | Logging/erros deliberados |
| BR-DESCARTAR-008 | `_reversa_sdd/domain.md` | Respostas flexiveis por dict | DTOs e erros Rust tipados |

## Notas

- Nenhum item de regra de negocio confirmada foi descartado.
- Os descartes removem mecanismos da plataforma antiga ou bugs confirmados, preservando paridade funcional.
