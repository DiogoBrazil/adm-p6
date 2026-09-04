# Arnês de tela

Mede a **largura mínima** de cada listagem, em vez de estimá-la a olho.

## Por que existe

As listagens usam `table-layout: fixed` com as colunas repartindo 100% da área
(`dom.ts::Coluna.largura`). Quando a área encolhe, as colunas encolhem junto — e
aí as duas famílias de coluna se comportam de modo **oposto**:

| | |
|---|---|
| `truncar` | `overflow: hidden` + reticências. Corta, dá o `title`, e está certo |
| `nowrap` | `overflow: visible`. O texto **pinta por cima da coluna vizinha**, sem erro e sem aviso |

Isso não se confere lendo CSS: depende da métrica da fonte, do rótulo do
cabeçalho e do tamanho do dado real. A rodada que criou este arnês achou, medindo:

- a **matrícula de 9 dígitos** cobria o começo do nome em qualquer janela abaixo
  de 1006px — e a janela mínima do app é 1024, com 709px úteis para a tabela;
- o **Mapa Mensal** já declarava um piso (`--larga`, 1060px) e ele estava
  **155px curto**: as três datas e o cabeçalho "Instauração" transbordavam;
- na largura padrão da janela (1280) quatro das cinco listagens ainda
  transbordavam alguma coisa.

Quem quase sempre manda no piso é o **rótulo do cabeçalho**: "Encarregado" pede
91px e, sendo palavra única, não quebra em coluna nenhuma. `quebrarRotulo` só
resolve rótulo de duas palavras.

## O piso

Cada tela declara o seu em `PISO_PX` (ou `PISO_MAPA_PX`/`PISO_SALVOS_PX`), ao
lado das colunas, e passa em `tabela(..., { pisoPx })`. O valor sai em
`data-piso` e é aplicado pela CSSOM em `dom.ts::aplicarLarguras` — `style=""`
interpolado no markup é recusado pela CSP. Abaixo do piso quem adapta é o
scroll horizontal do `.table-wrap`, que é o que o CSS deste projeto já declara
para as tabelas do detalhe do processo.

Na impressão o piso **não vale**: `min-width: 0 !important` das folhas de papel
vence o estilo inline, e é de propósito.

| Tela | medido | declarado | folga |
|---|---|---|---|
| Mapa Mensal | 1215 | 1250 | 35 |
| Mapas salvos | 1123 | 1160 | 37 |
| Usuários | 1006 | 1040 | 34 |
| Prazos | 756 | 780 | 24 |
| Auditoria | 681 | 700 | 19 |

A folga existe porque a medição sai do **Chromium** e quem desenha o app é o
**WebKitGTK**: as métricas de fonte não são as mesmas. Não é margem de conforto
— é a diferença entre o motor onde se mede e o motor onde se usa.

## Como rodar

```bash
npm run build                                  # o arnês usa o CSS compilado
npx vite-node tools/tela/gerar-paginas.ts      # monta paginas/listagens.html
python3 -m http.server 8899                    # `file://` não serve: o CSS é absoluto
```

Abra `http://127.0.0.1:8899/tools/tela/paginas/listagens.html` e cole no console:

- `medir.js` — o que ainda transborda, por tabela e por largura de janela
  (1024, 1280, 1600). **Tudo tem de sair `—`.**
- `piso.js` — a busca binária pelo menor px sem transbordo. É de onde sai o
  `PISO_PX`, e o que mostra se a folga sobre o medido continua de pé.

## Depois de mexer em coluna

Acrescentar coluna, mudar percentual ou **renomear um rótulo** muda o piso.
Rode `piso.js` e atualize o `PISO_PX` da tela. Um piso desatualizado não
quebra nada visivelmente: só volta a deixar a coluna `nowrap` pintar por cima
da vizinha, que é o defeito que este arnês existe para pegar.

As colunas e os pisos são **importados das telas**, nunca copiados para cá — uma
fixtura com o valor escrito à mão certifica um layout que o app não desenha mais.
