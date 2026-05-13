---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: cutover_plan
producedBy: strategist
hash: "sha256:b06cfac8e689e579e461c7974f059bf5bdfeae7b0606ec5056dda0112465e08d"
---

# Cutover Plan

> Plano de corte do legado para o sistema novo, alinhado a estrategia recomendada em `migration_strategy.md`.

## Estrategia base

- **Estrategia recomendada**: Big Bang controlado com Parallel Run de validacao.

## Pre-requisitos

- [ ] `parity_specs.md` e testes Gherkin do Inspector gerados.
- [ ] Vertical slice Rust/Tauri validada: login, listagem, comando de escrita admin e leitura comum.
- [ ] Todos os modulos usados implementados: auth, usuarios, catalogos, RDPM, Art29, processos, prazos, andamentos, indicios, mapas, relatorios, auditorias.
- [ ] RBAC alvo validado: comum somente leitura; escrita somente admin.
- [ ] IPPM removido de enums, filtros, telas e fixtures.
- [ ] Base PostgreSQL clonada ou ambiente de homologacao disponivel.
- [ ] Parallel Run executado nos fluxos criticos com divergencias resolvidas ou aceitas.

## Janela de cutover

- **Data alvo**: a definir.
- **Duracao estimada**: 2 a 4 horas para instalacao, smoke tests e decisao go/no-go, assumindo banco ja preparado.
- **Ambiente afetado**: maquina/ambiente operacional do app desktop.
- **Comunicacao previa**: ST-RIBEIRO valida e informa usuarios envolvidos.

## Passos do cutover

| # | Passo | Owner | Duracao | Reversivel? |
|---|---|---|---|---|
| 1 | Congelar uso do legado durante a janela | ST-RIBEIRO | 10 min | sim |
| 2 | Fazer backup do PostgreSQL e da pasta/configuracao do legado | ST-RIBEIRO | 20 min | sim |
| 3 | Instalar build Tauri assinado/gerado para homologacao final | agente de codificacao | 20 min | sim |
| 4 | Apontar configuracao do novo app para PostgreSQL alvo | agente de codificacao | 10 min | sim |
| 5 | Executar smoke tests: login, leitura comum, escrita admin, processos, prazos, relatorio/mapa, auditoria | ST-RIBEIRO + agente de codificacao | 60-90 min | sim |
| 6 | Comparar amostras com legado em Parallel Run | ST-RIBEIRO | 60 min | sim |
| 7 | Decisao go/no-go | ST-RIBEIRO | 10 min | sim |
| 8 | Liberar uso do Tauri e manter legado em standby somente leitura | ST-RIBEIRO | 10 min | sim |

## Plano de rollback

- **Criterios de acionamento**:
  - Falha em login ou permissao.
  - Divergencia critica em processo, prazo, mapa, relatorio ou auditoria.
  - Erro de leitura/escrita no PostgreSQL.
  - Bloqueio de fluxo essencial usado no dia a dia.
- **Passos**:
  1. Fechar o aplicativo Tauri.
  2. Restaurar orientacao de uso para o executavel Eel legado.
  3. Se houve escrita no banco pelo Tauri durante a janela, avaliar restauracao do backup ou aplicar correção manual registrada.
  4. Registrar divergencia em backlog de paridade.
- **Tempo maximo aceitavel ate rollback**: 30 minutos apos detectar falha critica.
- **Owner do rollback**: ST-RIBEIRO.

## Criterios de go / no-go

- **Go**:
  - Login/logout/usuario logado funcionam.
  - Perfil comum consegue ler e nao consegue criar/editar/remover.
  - Admin consegue criar/editar/remover nos modulos esperados.
  - Processos, prazos, indicios, mapas, relatorios e auditoria passam smoke tests.
  - Relatorios/mapas criticos batem com o legado em amostras.
  - Nenhuma referencia a IPPM aparece na UI alvo.
- **No-go**:
  - Qualquer perda de funcionalidade essencial.
  - Divergencia nao explicada em relatorios/mapas.
  - Escrita no banco falha ou corrompe dados.
  - RBAC alvo impede fluxo administrativo esperado.

## Pos-cutover

- [ ] Monitoramento assistido por 5 dias uteis.
- [ ] Validacao de paridade conforme `parity_specs.md`.
- [ ] Registrar divergencias em backlog.
- [ ] Manter legado disponivel como fallback por pelo menos 1 ciclo operacional.
- [ ] Decommission do legado apenas apos aceite de ST-RIBEIRO.

## Notas

- Como o banco sera reaproveitado, o rollback operacional e mais simples se o Tauri nao aplicar alteracoes destrutivas de schema.
- Se futuras migrations forem necessarias, devem ter backup e rollback proprios.
