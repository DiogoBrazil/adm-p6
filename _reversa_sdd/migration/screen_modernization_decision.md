---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: screen_modernization_decision
producedBy: screen-translator
decidedBy: usuario
decidedAt: 2026-05-12T22:51:48Z
mode: modernized
sourcePlatform: html-eel
targetPlatform: tauri
hash: "sha256:d9cc681711421029ce129c4978ba2661824c220379778cb0b12e658218221171"
---

# Decisao de Modernizacao de Telas

> Decisao consciente sobre como traduzir as telas do sistema legado: paridade visual aproximada, redesign idiomatico para a plataforma alvo, ou combinacao tela-a-tela.
> Este artefato e leitura obrigatoria do proprio Screen Translator, do Inspector e do agente de codificacao.

## Contexto

- **Plataforma origem detectada**: `html-eel`
- **Confianca**: CONFIRMADO. O legado carrega `/eel.js`, usa `eel.*` em HTML/JS e inicializa Eel em `main.py`.
- **Plataforma alvo**: `tauri`
- **Telas inventariadas**: 26
- **Origem do inventario**: `_reversa_sdd/screens/inventory.json` + leitura read-only de `web/*.html`
- **Adapter aplicado**: `html_eel__tauri` por extensao do adapter `html_legacy__spa` para Tauri webview. O formato alvo sera `component-tree`.

## Lacunas de entrada

- `_reversa_sdd/design-system/` nao existe. A Fase 2 devera derivar tokens minimos a partir de `web/static/css/*` ou registrar deviations.
- `_reversa_sdd/ui/inventory.md` nao existe. O inventario foi construido diretamente dos arquivos HTML do legado.
- Sem screenshots do legado no SDD. Modo literal pixel-equivalente fica inviavel sem aprovacao explicita e material visual.

## Modos avaliados

### Modo: literal

- **Definicao**: tentar reproduzir visualmente as telas atuais, mantendo disposicao, densidade, cores, textos, botoes e fluxos o mais proximo possivel do HTML/Eel.
- **Trade-offs**:
  - Custo de implementacao: alto
  - Fidelidade visual: media sem screenshots; alta somente com screenshots por tela
  - Viabilidade de parity tests construtivos: parcial
  - Aceitacao esperada do usuario final: media
  - Debito tecnico futuro: alto, pois preserva decisoes visuais do legado e acopla Tauri a layout antigo
- **Recomendado**: nao
- **Justificativa**: o brief autoriza ajustes de interface e exige preservar funcionalidades, nao pixel-perfect.

### Modo: modernizado

- **Definicao**: redesenhar a UI de forma idiomatica para Tauri/webview, preservando funcionalidades, textos de negocio, eventos, permissoes, listagens, filtros, relatorios, graficos, estatisticas e navegacao equivalente.
- **Trade-offs**:
  - Custo de implementacao: medio
  - Fidelidade visual: baixa a media, por escolha
  - Viabilidade de parity tests construtivos: sim, por contrato semantico de tela, comandos, estados e dados exibidos
  - Aceitacao esperada do usuario final: alta, porque corrige atritos de layout sem remover capacidades
  - Debito tecnico futuro: baixo a medio
- **Recomendado**: sim
- **Justificativa**: alinha com a migracao Rust/Tauri, elimina dependencia do Eel e preserva o requisito central de 100% das funcionalidades.

### Modo: hibrido

- **Definicao**: modernizar a maioria das telas e manter algumas telas criticas mais proximas do legado, especialmente relatorios, mapas ou formularios regulatorios.
- **Trade-offs**:
  - Custo de implementacao: medio a alto
  - Fidelidade visual mista: alta nas telas escolhidas para literal-ish; modernizada nas demais
  - Viabilidade de parity tests: visual parcial nas telas literal-ish e semantica nas demais
  - Custo de manutencao da separacao: medio
- **Recomendado**: nao como padrao, mas viavel se houver telas que precisam preservar disposicao operacional.
- **Justificativa**: exige listas explicitas de telas por modo e screenshots se a exigencia for visual forte.

## Decisao

- **Modo escolhido**: modernizado
- **Justificativa do humano**: usuario escolheu a opcao 2 apos a recomendacao do agente.
- **Alternativas descartadas**: literal descartado por exigir screenshots/pixel-equivalencia que nao fazem parte do objetivo; hibrido descartado por adicionar complexidade e exigir listas tela-a-tela sem necessidade atual.
- **Decidido em**: 2026-05-12T22:51:48Z
- **Decidido por**: usuario

### Em modo hibrido, listas explicitas obrigatorias

**Telas em modo literal**:
- N/A

**Telas em modo modernizado**:
- Todas as telas inventariadas em `_reversa_sdd/screens/inventory.json`.

> Listas vazias bloqueiam a Fase 2. O agente recusa prosseguir.

## Implicacoes pendentes para a Fase 2

| Etapa | Implicacao | Como honrar |
|---|---|---|
| Geracao de `target_screens.md` | Tauri usa webview, mas o backend muda de Eel para comandos Tauri tipados | Especificar eventos por `invoke`, estados `idle/loading/error/success` e envelope de resposta normalizado |
| Captura de golden files | Sem oraculo visual automatizado e sem screenshots no SDD | Emitir manifest quando necessario; usar parity semantica no modo modernizado |
| Tokens do design-system | Catalogo de tokens ausente | Derivar tokens de `web/static/css/*` e registrar deviations quando houver aproximacao |
| Conteudo textual | Labels, mensagens, titulos e textos de negocio devem ser preservados | Copiar strings do legado salvo aprovacao explicita de revisao linguistica |
| Permissoes | Criacao, edicao e remocao apenas para admins; demais perfis leitura | Especificar botoes/acoes de escrita ocultos ou desabilitados para perfis nao admin |

## Implicacoes para o Inspector

- **Estrategia de paridade**:
  - Modo literal: paridade visual aproximada/pixel-equivalente somente com screenshots ou golden files.
  - Modo modernizado: contrato semantico de tela, eventos, transicoes, conteudo textual, permissoes e estados.
  - Modo hibrido: estrategia mista declarada por tela em `parity_specs.md`.
- **Deviations conhecidas a propagar**: catalogo visual ausente, adapter `html_eel__tauri` derivado de `html_legacy__spa`, substituicao de Eel por comandos Tauri.

## Notas

- O Screen Translator nao altera codigo legado.
- Arquivos auxiliares detectados como backup, debug ou teste foram inventariados como nao criticos para nao perder rastreabilidade. A Fase 2 deve confirmar se entram como telas migradas, referencias descartadas ou evidencias historicas.
