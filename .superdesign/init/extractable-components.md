# Componentes extraíveis

O frontend não usa componentes de framework; os padrões são funções TypeScript e blocos do shell. Para o alvo de impressão A4, nenhum componente do shell deve ser extraído: navegação e controles não pertencem ao documento.

## AppShell
- Source: `src/main.ts`
- Category: layout
- Description: sidebar, topo, sessão e área principal compartilhados pela aplicação.
- Extractable props: activePath, sessionName, sessionRole, sidebarCollapsed.
- Hardcoded: estrutura da navegação, posição do brasão, classes CSS globais.

## DataTable
- Source: `src/dom.ts`
- Category: basic
- Description: tabela escapada com larguras, alinhamento, rolagem e variante de listagem.
- Extractable props: columns, rows, emptyMessage, fixed, wide, listing.
- Hardcoded: classes `tabela-dados`, `table-wrap` e estrutura de cabeçalho/corpo.

## ExportBar
- Source: `src/dom.ts`
- Category: basic
- Description: botões de impressão/PDF e CSV.
- Extractable props: showPrint, showCsv.
- Hardcoded: rótulos e classes de botão.

## StatCard
- Source: `src/telas/estatisticas.ts` e `src/styles.css`
- Category: basic
- Description: cartão compacto de métrica. **Desde a rodada 28 ele não é mais o indicador
  dos relatórios** — as seis telas analíticas usam o `KpiCard` abaixo. Continua em uso nas
  telas que não viraram painel, como a ficha do usuário.
- Extractable props: value, label, alert.
- Hardcoded: classes `stat-card` e `stat-value`.

## KpiCard
- Source: `src/graficos/index.ts::kpiAnalitico` e `src/styles.css`
- Category: basic
- Description: indicador destacado dos painéis analíticos, com micro-rótulo, valor
  tabular, detalhe opcional e tom semântico (neutro, andamento, sucesso, alerta).
- Extractable props: valor, rotulo, tom, detalhe.
- Hardcoded: classes `analytics-kpi*` e a marca circular decorativa.

## AnalyticsCard
- Source: `src/graficos/index.ts::cartaoAnalitico` e `src/styles.css`
- Category: composite
- Description: cartão com título, descrição, alternador **Gráfico / Tabela** e os dois
  painéis. Trata o estado vazio sozinho (não emite alternador quando não há dado) e
  guarda a escolha por cartão no `localStorage`.
- Extractable props: id, titulo, descricao, grafico, tabela, vazio, limitado, classe.
- Hardcoded: classes `analytics-card*`, o texto "Top 12 no gráfico · tabela completa" e a
  chave `adm-p6:visualizacao:`.
- Não extrair sem a camada de gráficos junto: o alternador só faz sentido com
  `montarCartoesAnaliticos`, que monta o canvas preguiçosamente e o redimensiona ao
  voltar da tabela.

