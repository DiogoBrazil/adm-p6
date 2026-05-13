# Relatórios — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `processos_procedimentos` com dados
- [ ] Guard `guard_login` implementado
- [ ] Biblioteca de geração de PDF identificada e disponível

## Tarefas

- [ ] T-01 — Implementar `gerar_relatorio_anual_pdf(ano)`
  - Origem: `app/services/mapas_relatorios.py:641` + `_gerar_pdf_relatorio_anual:893`
  - Critério: agrega estatísticas do ano por tipo; gera PDF; retorna base64 + estatísticas
  - Confiança: 🟢

- [ ] T-02 — Identificar e registrar biblioteca de geração de PDF utilizada
  - Origem: `mapas_relatorios.py:893` (`_gerar_pdf_relatorio_anual`)
  - Critério: confirmar dependência (reportlab, weasyprint, etc.); documentar equivalente para Rust
  - Confiança: 🔴

- [ ] T-03 — Implementar `gerar_relatorio_estatisticas_gerais(ano?)`
  - Origem: declarado em `app/routers/relatorios.py:29`; **não implementado no service**
  - Critério: definir e implementar do zero na migração Rust
  - Confiança: 🟢 (escopo confirmado pelo usuário em `questions.md#14`)

- [ ] T-04 — Implementar `gerar_relatorio_processos_por_encarregado(ano?)`
  - Origem: declarado em `app/routers/relatorios.py:38`; **não implementado no service**
  - Critério: GROUP BY responsavel_id; retorna lista de encarregados com seus processos
  - Confiança: 🟢 (escopo confirmado pelo usuário em `questions.md#14`)

- [ ] T-05 — Implementar `gerar_relatorio_processos_por_tipo(ano?)`
  - Origem: declarado em `app/routers/relatorios.py:47`; **não implementado no service**
  - Critério: GROUP BY tipo_detalhe; retorna contagens por tipo
  - Confiança: 🟢 (escopo confirmado pelo usuário em `questions.md#14`)

- [ ] T-06 — Implementar `gerar_relatorio_prazos_vencidos(dias_atras?)`
  - Origem: declarado em `app/routers/relatorios.py:56`; **não implementado no service**
  - Critério: JOIN com prazos_processo; filtra prazos vencidos há mais de N dias
  - Confiança: 🟢 (escopo confirmado pelo usuário em `questions.md#14`)

- [ ] T-07 — Implementar `exportar_relatorio_csv(tipo, filtros?)`
  - Origem: declarado em `app/routers/relatorios.py:65`; **não implementado no service**
  - Critério: retorna CSV como string base64 ou download direto
  - Confiança: 🟢 (escopo confirmado pelo usuário em `questions.md#14`)

- [ ] T-08 — Implementar `exportar_relatorio_excel(tipo, filtros?)`
  - Origem: declarado em `app/routers/relatorios.py:74`; **não implementado no service**
  - Critério: retorna XLSX como base64 ou download direto
  - Confiança: 🟢 (escopo confirmado pelo usuário em `questions.md#14`)

## Ordem Sugerida

1. T-02 (identificar biblioteca PDF — bloqueia T-01)
2. T-01 (único relatório implementado — migrar primeiro)
3. T-03 a T-08 (implementações novas — priorizar por necessidade do negócio)

## Observação Importante

🟢 **6 das 7 funções deste módulo são stubs com escopo confirmado** — existem como handlers Eel declarados no router mas sem implementação no service Python. Na migração para Rust, essas funções precisarão ser **implementadas do zero** com base nos requisitos de negócio, não migradas do código legado. A prioridade confirmada é o relatório de mapa mensal em PDF.
