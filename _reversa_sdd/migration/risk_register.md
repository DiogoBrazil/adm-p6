---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: risk_register
producedBy: strategist
hash: "sha256:a8dc0a87bd59cf1c26a0e6f1bbaede6ca3b3b74463246f0ed2d9f3a0a054f073"
---

# Risk Register

> Registro de riscos da migracao com probabilidade, impacto, mitigacao e responsavel.

## Riscos

### RISK-001 — Perda de funcionalidade usada
- **Categoria**: tecnico
- **Probabilidade**: media
- **Impacto**: critico
- **Severidade combinada**: alta
- **Trigger / sinal de alerta**: tela, listagem, filtro, relatorio ou fluxo usado no legado nao tem equivalente no Tauri.
- **Mitigacao**: inventario por tela no Screen Translator; testes de paridade no Inspector; checklist de CRUDs, graficos, listagens, relatorios e estatisticas.
- **Plano de contingencia**: bloquear cutover ate a funcionalidade ser implementada ou explicitamente descartada pelo decisor.
- **Owner**: agente de codificacao + ST-RIBEIRO
- **Status**: aberto

### RISK-002 — Relatorios e mapas divergentes
- **Categoria**: tecnico
- **Probabilidade**: media
- **Impacto**: alto
- **Severidade combinada**: alta
- **Trigger / sinal de alerta**: contagens, agrupamentos ou PDFs diferentes entre legado e novo usando a mesma base.
- **Mitigacao**: Parallel Run de validacao para mapa mensal PDF, relatorio anual e estatisticas; golden files quando possivel.
- **Plano de contingencia**: manter legado para geracao oficial ate corrigir queries/formatacao.
- **Owner**: agente de codificacao + ST-RIBEIRO
- **Status**: aberto

### RISK-003 — Regras de processo mal modeladas em Rust
- **Categoria**: tecnico
- **Probabilidade**: media
- **Impacto**: alto
- **Severidade combinada**: alta
- **Trigger / sinal de alerta**: enums incompletos, IPPM aparecendo na UI, validacoes de PADS/datas ausentes, papéis inconsistentes.
- **Mitigacao**: modelagem com enums/structs no Designer; testes de validacao e fixtures de processo.
- **Plano de contingencia**: corrigir modelo e migrar fixtures antes de liberar escrita.
- **Owner**: Designer + agente de codificacao
- **Status**: aberto

### RISK-004 — Dados legados JSON/TEXT incompatíveis
- **Categoria**: dados
- **Probabilidade**: media
- **Impacto**: medio
- **Severidade combinada**: media
- **Trigger / sinal de alerta**: falha ao carregar andamentos, historico, indicios ou categorias antigas.
- **Mitigacao**: manter fallback de leitura para campos legados; testes com dump real ou amostra anonimizável.
- **Plano de contingencia**: criar rotina de normalizacao ou fallback temporario.
- **Owner**: agente de codificacao
- **Status**: aberto

### RISK-005 — RBAC mais restritivo quebra fluxo operacional
- **Categoria**: operacional
- **Probabilidade**: media
- **Impacto**: medio
- **Severidade combinada**: media
- **Trigger / sinal de alerta**: usuario comum tenta criar/editar/remover e fica bloqueado em fluxo que antes executava.
- **Mitigacao**: UI deve ocultar/desabilitar acoes de escrita para perfis comuns; validacao de aceite com ST-RIBEIRO.
- **Plano de contingencia**: ajustar perfil de operadores ou rever regra antes do cutover.
- **Owner**: ST-RIBEIRO + Screen Translator
- **Status**: aberto

### RISK-006 — Curva de aprendizado Rust/Tauri/sqlx
- **Categoria**: organizacional
- **Probabilidade**: media
- **Impacto**: medio
- **Severidade combinada**: media
- **Trigger / sinal de alerta**: atrasos por duvidas de Tauri, sqlx, PDF ou empacotamento.
- **Mitigacao**: usar Context7 para duvidas tecnicas; implementar primeiro vertical slice pequena.
- **Plano de contingencia**: reduzir escopo de relatorios avancados para segunda entrega apenas se ST-RIBEIRO aprovar.
- **Owner**: agente de codificacao
- **Status**: aberto

### RISK-007 — PDF em Rust nao replica ReportLab
- **Categoria**: tecnico
- **Probabilidade**: alta
- **Impacto**: medio
- **Severidade combinada**: alta
- **Trigger / sinal de alerta**: relatorio PDF difere visualmente ou perde informacao.
- **Mitigacao**: definir biblioteca/estrategia PDF no Designer; comparar PDFs por conteudo essencial, nao pixel perfeito, salvo quando exigido.
- **Plano de contingencia**: gerar PDF via HTML/webview ou biblioteca alternativa.
- **Owner**: Designer + agente de codificacao
- **Status**: aberto

### RISK-008 — Cutover sem base comparavel
- **Categoria**: operacional
- **Probabilidade**: baixa
- **Impacto**: alto
- **Severidade combinada**: media
- **Trigger / sinal de alerta**: falta dump/base de teste para validar o novo app antes do corte.
- **Mitigacao**: preparar base clonada do PostgreSQL e roteiro de smoke tests.
- **Plano de contingencia**: adiar cutover ate haver base valida.
- **Owner**: ST-RIBEIRO
- **Status**: aberto

## Resumo por severidade

| Severidade | Quantidade | IDs |
|---|---:|---|
| Critica | 0 | — |
| Alta | 4 | RISK-001, RISK-002, RISK-003, RISK-007 |
| Media | 4 | RISK-004, RISK-005, RISK-006, RISK-008 |
| Baixa | 0 | — |

## Riscos relacionados ao paradigma alvo

- RISK-003: regras de dominio precisam sair de fluxos procedurais flexiveis para tipos Rust explicitamente modelados.
- RISK-006: curva de aprendizado e decisoes tecnicas em Rust/Tauri/sqlx.
- RISK-007: substituicao de ReportLab e PDF Python por alternativa Rust/Tauri.
