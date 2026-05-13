---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: migration_brief
producedBy: orchestrator
hash: "sha256:a6040457491b178c18eb2ee1d4c4663bc0e6a5186c355a7a572ee8be9289cbd9"
---

# Migration Brief

> Documento de criterio de migracao coletado em entrevista no inicio do `/reversa-migrate`.
> Consumido pelos seis agentes do Time de Migracao.

## Objetivo da migracao

Migrar o sistema porque a biblioteca Eel usada pelo legado esta em desuso. A migracao deve trocar linguagem e framework de aplicacao desktop, preservando 100% das funcionalidades usadas do sistema atual.

## Metricas de sucesso

- O sistema novo deve manter as mesmas funcionalidades do sistema atual: CRUDs dos modulos, graficos, listagens, geracao de relatorios, estatisticas e demais fluxos usados.
- A interface pode ser ajustada em layout, botoes e organizacao visual quando necessario, desde que as funcionalidades sejam preservadas.
- O sistema deve ser construido sem complexidade desnecessaria, mantendo boas praticas, codigo limpo e organizacao clara.

## Restricoes

- **Prazo**: nao informado.
- **Orcamento**: nao informado.
- **Tecnicas**: stack alvo Rust + Tauri, PostgreSQL com sqlx. Manter as funcionalidades do legado; banco PostgreSQL deve ser usado como base. Se houver duvidas sobre Rust, Tauri, PostgreSQL, sqlx ou outro componente tecnico, usar MCP Context7 para esclarecer com documentacao atualizada.
- **Operacionais**: nao informado.

## Fatores de risco conhecidos

- Perder funcionalidades durante a reescrita.
- Adaptar a interface de forma que alguma funcao existente deixe de estar disponivel ou equivalente.
- Introduzir complexidade desnecessaria na nova arquitetura.

## Stakeholders

| Nome / papel | Responsabilidade na migracao |
|---|---|
| ST-RIBEIRO | Validar a migracao e confirmar equivalencia funcional |

## Stack alvo

- **Linguagem**: Rust
- **Framework**: Tauri
- **Banco**: PostgreSQL com sqlx
- **Mensageria**: nenhuma por enquanto
- **Infra**: aplicacao desktop; infraestrutura nao detalhada nesta fase
- **Observabilidade**: sem necessidade por enquanto
- **Outros componentes relevantes**: usar MCP Context7 para esclarecer duvidas tecnicas sobre Rust, Tauri, PostgreSQL, sqlx ou bibliotecas relacionadas

## Escopo declarado

- **Incluido**: todos os modulos e codigo usados no sistema atual, incluindo CRUDs, graficos, listagens, relatorios, estatisticas e demais funcionalidades ativas.
- **Excluido**: codigo e handlers nao usados pela UI atual ou ja classificados como fora de escopo nas specs do Reversa.

## Notas livres

A migracao e uma reescrita desktop com foco em paridade funcional. A interface pode ser modernizada, mas nao deve reduzir o escopo funcional.
