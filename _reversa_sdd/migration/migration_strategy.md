---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: migration_strategy
producedBy: strategist
hash: "sha256:07c5727d6d4bf7fb28b0a997cef9376b72805e03495108a9df69bd98847367ca"
---

# Migration Strategy

> Estrategias de migracao avaliadas com trade-offs explicitos. A estrategia recomendada e a sugestao do Strategist; a decisao final e humana.

## Contexto sintetizado

- **Legado**: aplicacao desktop Python 3.12 + Eel, HTML/CSS/JS vanilla, PostgreSQL 16, ReportLab, 12 modulos de negocio, ~133 arquivos e 73 funcoes expostas ao frontend.
- **Integracoes externas**: nenhuma; sistema autocontido na maquina do operador, com PostgreSQL local/Docker.
- **Banco**: PostgreSQL deve ser reaproveitado; stack alvo usa Rust + Tauri + sqlx.
- **Apetite derivado**: `transformational`.
- **Gap de paradigma**: medio. Legado procedural em camadas; alvo Rust/Tauri idiomatico com structs/enums, comandos tipados, erros estruturados e validacoes backend centrais.
- **Regras criticas**: processos/procedimentos, RBAC admin-escrita/leitura comum, prazos, indicios, mapas/relatorios, auditoria, hash bcrypt, hard delete RDPM protegido, remocao de IPPM.

## Estrategias avaliadas

### Estrategia A: Big Bang controlado com Freeze Funcional

- **Descricao**: reconstruir o aplicativo Rust/Tauri completo em paralelo ao legado, usando `_reversa_sdd/` e os artefatos de migracao como contrato. O corte ocorre quando paridade funcional e testes de aceitacao estiverem aprovados.
- **Quando aplica**: app desktop autocontido, sem APIs externas, sem roteamento entre legado e novo, apetite transformacional, necessidade de trocar Eel por Tauri.
- **Custo**: medio
- **Risco**: medio-alto
- **Tempo**: medio
- **Adequacao ao apetite derivado** (`transformational`): alta. Permite redesenho interno idiomatico Rust/Tauri sem manter pontes tecnicas com Eel.
- **Trade-offs**:
  - Pros:
    - Evita arquitetura hibrida Python/Eel + Rust/Tauri.
    - Permite limpar bugs confirmados e artefatos legados desde o inicio.
    - Mais simples operacionalmente para app desktop sem integracoes externas.
    - Alinha com a decisao de adotar paradigma natural Rust/Tauri.
  - Contras:
    - Exige suite forte de paridade antes do corte.
    - Risco de esquecer comportamento de tela/listagem/relatorio usado na pratica.
    - Nao entrega valor incremental em producao ate um conjunto grande estar pronto.

### Estrategia B: Parallel Run por Paridade

- **Descricao**: manter legado e novo lado a lado durante validacao, comparando saidas de CRUDs, listagens, mapas, relatorios, estatisticas e regras criticas com o mesmo banco ou base clonada.
- **Quando aplica**: dominio disciplinar/regulatorio, paridade funcional obrigatoria, relatorios e estatisticas sensiveis.
- **Custo**: alto
- **Risco**: medio
- **Tempo**: medio
- **Adequacao ao apetite derivado** (`transformational`): media-alta como estrategia de validacao, nao como estrategia principal de desenvolvimento.
- **Trade-offs**:
  - Pros:
    - Reduz risco de regressao semantica.
    - Ajuda a validar relatorios, mapas e estatisticas com dados reais.
    - Permite aprovar por modulo/fluxo antes do corte.
  - Contras:
    - Aumenta custo de validacao.
    - Requer disciplina para manter dados comparaveis.
    - Nao resolve sozinho como construir o novo; funciona melhor combinado com Big Bang controlado.

### Estrategia C: Strangler Fig

- **Descricao**: substituir partes do legado gradualmente, mantendo roteamento entre sistema antigo e novo.
- **Quando aplica**: sistemas web/API em producao, com bordas roteaveis e necessidade de migracao incremental.
- **Custo**: medio-alto
- **Risco**: baixo-medio
- **Tempo**: longo
- **Adequacao ao apetite derivado** (`transformational`): baixa para este caso.
- **Trade-offs**:
  - Pros:
    - Reduz risco em sistemas web grandes.
    - Permite migração incremental.
  - Contras:
    - Pouco natural para app desktop Eel migrando para Tauri.
    - Criaria ponte complexa entre duas shells desktop.
    - Contraria a restricao de evitar complexidade desnecessaria.

### Estrategia D: Branch by Abstraction

- **Descricao**: criar abstracoes no legado para trocar implementacoes internas aos poucos.
- **Quando aplica**: mesma linguagem/framework ou migracao interna com dominio preservado.
- **Custo**: medio
- **Risco**: baixo
- **Tempo**: longo
- **Adequacao ao apetite derivado** (`transformational`): baixa.
- **Trade-offs**:
  - Pros:
    - Reduz risco quando se preserva runtime.
    - Bom para refatoracoes internas.
  - Contras:
    - Exigiria alterar Python/Eel legado, o que nao e objetivo.
    - Nao ajuda diretamente na reescrita Rust/Tauri.
    - Adiciona camada temporaria que o brief nao justifica.

## Comparativo

| Criterio | A: Big Bang controlado | B: Parallel Run | C: Strangler Fig | D: Branch by Abstraction |
|---|---|---|---|---|
| Custo | medio | alto | medio-alto | medio |
| Risco | medio-alto sem paridade; medio com paridade | medio | baixo-medio | baixo |
| Tempo | medio | medio | longo | longo |
| Aderencia ao apetite | alta | media-alta | baixa | baixa |
| Compatibilidade com mudanca de paradigma | alta | alta como validacao | media | baixa |
| Complexidade operacional | baixa | media | alta | alta |

## Recomendacao do Strategist

- **Estrategia recomendada**: A + B — **Big Bang controlado com Parallel Run de validacao**.
- **Justificativa**: o sistema e desktop, autocontido, sem integracoes externas e a migracao troca a shell inteira de Eel para Tauri. Strangler e Branch by Abstraction criariam complexidade temporaria maior que o beneficio. Como o dominio tem regras disciplinares, relatorios, prazos e estatisticas, a recomendacao inclui Parallel Run como criterio de validacao antes do corte, especialmente para processos, prazos, mapas, relatorios e auditoria.

## Sinais de alerta especificos

- Mudanca de paradigma + apetite transformacional exige validacao de paridade, nao apenas testes unitarios.
- Relatorios stub confirmados serao implementados do zero; isso precisa de aceite funcional especifico.
- O RBAC alvo ficou mais restritivo que o legado para escrita em processos; telas e comandos devem refletir isso claramente.
- Remover IPPM exige varredura de tipos, filtros, labels e fixtures para evitar opcao fantasma na UI.
- PostgreSQL reaproveitado significa que compatibilidade com dados existentes e campos legados JSON/TEXT precisa ser testada.

## Decisao humana

- **Estrategia escolhida**: A + B — Big Bang controlado com Parallel Run de validacao
- **Quem decidiu**: ST-RIBEIRO
- **Quando**: 2026-05-12T22:51:48Z
- **Justificativa do decisor**: usuario escolheu a recomendacao do Strategist.
