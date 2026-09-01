# Design System — PDF de Mapas Mensais

## Produto e objetivo

ADM-P6 é o sistema desktop da Seção de Justiça e Disciplina do 7º BPM/PMRO. O novo alvo é um documento A4 institucional, gerado a partir do mapa mensal, para consulta, organização e arquivamento de processos e procedimentos.

## Estrutura do documento

- A4 paisagem, 297 × 210 mm.
- Uma capa inteira por espécie de apuratório encontrada.
- Depois da capa, processos e procedimentos seguem em fluxo contínuo e podem compartilhar a mesma página.
- Cada registro começa com cabeçalho institucional inequívoco, termina com marcador “Fim do …” e, quando atravessa uma página, recebe “Continuação do …” no topo da seguinte.
- Registros extensos podem continuar em páginas seguintes; nunca cortar informação nem comprimir tipografia até ficar ilegível. Cabeçalhos de tabelas se repetem quando a coleção é fragmentada.
- Capa: brasão oficial, Polícia Militar do Estado de Rondônia, 7ºBPM, espécie e sigla, mês/ano e resumo quantitativo, sem faixa decorativa lateral ou superior.
- Ficha: cabeçalho compacto com identificação e situação; grade de dados cadastrais; seções para pessoas, enquadramentos, designações, prazos, andamentos, anexos e resumo dos fatos.
- Repetir cabeçalho de tabela quando uma coleção atravessar páginas; impedir quebra dentro de uma linha.

## Identidade visual institucional

- Usar obrigatoriamente o brasão real fornecido como Brand Asset em todas as posições de logomarca. Não inventar símbolos, iniciais, SVGs ou substitutos.
- Azul-marinho principal: `#0b1f3a`.
- Azul institucional secundário: `#173b67`.
- Dourado discreto: `#b28a2e`; nunca usar grandes massas douradas.
- Verde PMRO apenas como acento pontual: `#2f6b4f`.
- Texto: `#172033`; secundário: `#526074`.
- Bordas: `#cfd6df`; superfícies suaves: `#f4f6f8`; papel: `#ffffff`.
- Preto e branco deve continuar legível: cor nunca pode ser a única indicação de situação.

## Tipografia

- Usar exclusivamente Segoe UI, Tahoma, Geneva, Verdana ou sans-serif do sistema.
- Capa: título 24–30pt, subtítulo 13–16pt, metadados 10–12pt.
- Ficha: título 14–17pt; títulos de seção 9–11pt; corpo 8.5–10pt.
- Números e datas com alinhamento e espaçamento consistentes.
- Evitar caixa alta em parágrafos; reservar para micro-rótulos institucionais e títulos curtos.

## Componentes de documento

- Brasão com área de respiro e proporção preservada.
- Chips de situação com contorno, legíveis em escala de cinza.
- Grade de pares rótulo/valor em duas ou três colunas conforme o conteúdo.
- Tabelas densas, com divisores claros, cabeçalho azul-marinho e corpo branco/cinza alternado.
- Seções vazias devem indicar “Não registrado” sem ocupar espaço excessivo.
- Rodapé discreto com identificação do documento e data de geração; não depender de contador de página do navegador.

## Impressão e responsividade

- **A orientação da folha não vem do `@page`.** O WebKitGTK — motor do Tauri no Linux —
  ignora o descritor `size`, e o documento sai retrato com o layout de 297mm espremido em
  210mm, sem erro nenhum. Quem orienta é o `GtkPageSetup`, montado em
  `print::commands::print_landscape`, declarando um papel de 297×210mm (pedir **rotação**
  ao GTK imprime páginas em branco). O `@page` continua declarado para os motores que o
  honram, e as margens físicas seguem controladas pelas páginas explícitas do documento.
  Ver a seção 7 do `GUIA.md`, e não validar impressão em Chromium: lá o `@page` funciona.
- Usar unidades físicas no layout impresso; controles na tela podem se adaptar a 900px e 600px.
- `print-color-adjust: exact` apenas onde necessário.
- `break-before: page` somente em capas e páginas explícitas; `break-inside: avoid` em linhas, cards curtos e blocos atômicos.
- O próximo registro aproveita o espaço restante quando couber seu cabeçalho com o primeiro bloco; caso contrário, começa na próxima página.
- Conteúdo extenso deve ser repartido pela paginação do documento; não truncar nem esconder overflow.
- Não imprimir sidebar, topbar, filtros, botões, tabela resumida nem notificações.

## Restrições

- Não adicionar fontes externas, gradientes decorativos, fotografias, glassmorphism ou aparência de landing page.
- Não incorporar o conteúdo binário dos anexos; listar metadados.
- A unidade institucional da capa é sempre 7º BPM; a origem cadastrada permanece na ficha.
- Nomes e siglas de apuratório vêm dos dados, nunca de hardcode.
- O resultado precisa funcionar no WebView/Tauri sob CSP restritiva.

## Painéis analíticos impressos

Desde a rodada 28 os relatórios de tela também saem em A4 paisagem, pelo mesmo
`print_landscape`. Valem as regras acima, mais três que são próprias de gráfico:

- **Canvas é bitmap.** A caixa do gráfico é fixada em `px` — unidade absoluta na
  impressão, 1/96 pol — **antes** de imprimir, para que a geometria medida na tela valha
  para a folha. Mudar a caixa depois de o canvas ser desenhado estica o desenho.
- **O bitmap sai ao dobro da densidade** (`devicePixelRatio` 2 na preparação): os 96 dpi
  da tela saem borrados no papel.
- **Legenda e rótulo não podem depender só de cor**, pela mesma razão da regra de escala
  de cinza acima: a classificação de gravidade colore as barras, e o texto do rótulo e do
  tooltip continua dizendo qual é.
