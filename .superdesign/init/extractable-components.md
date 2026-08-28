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
- Description: cartão compacto de métrica usado em painéis e relatórios.
- Extractable props: value, label, alert.
- Hardcoded: classes `stat-card` e `stat-value`.

