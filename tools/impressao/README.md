# Arnês de impressão

Mede o PDF dos relatórios comuns **no motor que o aplicativo usa** — o
WebKitGTK — em vez de conferir CSS a olho.

Existe porque a rodada 30 escolheu margens, densidades e tamanhos de bloco sem
imprimir uma folha, e três dessas escolhas estavam erradas. Impresso, o motor
faz coisas que o CSS não avisa:

- ignora o descritor `size` do `@page` (quem orienta a folha é o `GtkPageSetup`);
- parte o `<tr>` apesar de `break-inside: avoid` — **e a parte que ficaria na
  folha anterior não é impressa**: a linha some do papel, sem erro;
- ignora o `break-inside` das caixas de dentro de um item de grid
  (`.analytics-card`, `.stat-panel`), onde fragmentar custa folha e não protege.

Validar em Chromium não prova nada sobre o aplicativo: lá o `@page` funciona.

## Como rodar

```bash
npm run build                                   # o arnês usa o CSS compilado
npx vite-node tools/impressao/gerar-fixturas.ts # monta as páginas
python3 tools/impressao/imprimir.py --todas     # imprime pelo WebKit2
python3 tools/impressao/conferir.py --todas     # confere e mede
```

`conferir.py --imagens` rasteriza cada página em PNG, para olhar o que a
asserção não alcança: alinhamento, respiro, gráfico esticado.

Depois de qualquer mexida em CSS de impressão, também:

```bash
tools/impressao/controle-mapa.sh                # Mapa Mensal, contra o HEAD
```

## O que cada peça faz

| arquivo | papel |
|---|---|
| `gerar-fixturas.ts` | monta as páginas com os helpers **reais** (`dom.ts::tabela`, `kpiAnalitico`, `renderDocumentoMapa`) e o CSS compilado |
| `imprimir.py` | imprime pelo `WebKit2.PrintOperation`, com o mesmo papel físico que `print/commands.rs` declara |
| `conferir.py` | folha, páginas, linhas por folha, cabeçalhos por folha, linhas perdidas e linhas partidas |
| `controle-mapa.sh` | imprime o Mapa Mensal com o CSS de antes e o de agora e compara texto e pixel |

## Como as asserções funcionam

Cada linha das fixturas carrega dois marcadores: `L####` na primeira célula e
`F####` na célula de texto mais longo — a que a quebra de página fatia. Daí
saem as três perguntas que "olhar o PDF" não responde com segurança:

- **nada se perdeu?** os N marcadores `L` e os N `F` estão no texto extraído;
- **alguma linha foi partida?** `L0042` e `F0042` têm de estar na mesma folha;
- **o cabeçalho está no lugar?** o rótulo da primeira coluna aparece **uma** vez
  por folha. Duas é bloco menor que a página, com cabeçalho no meio do papel.

As fixturas `medicao-*` imprimem **sem** fragmentação: elas não asseram nada,
elas registram quantas linhas cabem na folha e quantas o motor parte. Quem
assere é a `calibrado-*` do mesmo conjunto. `analitico-cartoes-fragmentados` e
`stat-panel-fragmentado` guardam, do mesmo jeito, a medição que tirou o
fragmento de dentro dos cartões e dos painéis.

## Ao acrescentar uma tabela imprimível

1. Declare o conjunto de colunas em `CONJUNTOS`, igual ao da tela.
2. `--fragmento=nome:N` varre candidatos sem editar arquivo:
   `npx vite-node tools/impressao/gerar-fixturas.ts --fragmento=auditoria:8`.
3. O valor bom é o maior que ainda dá **um** cabeçalho por folha e **zero**
   linha partida. Anote no código de onde ele saiu.

## Limites

- O arnês usa `print_()`; o aplicativo usa `run_dialog()`. A armadilha da folha
  girada só aparece no segundo, então isto não substitui uma conferência final
  no binário — ver a seção 11 do `GUIA.md`.
- Não cobre gráfico com dado real, cancelamento do diálogo nem o teto de 5.000
  registros.
- `gerar-fixturas.ts` está fora do `include` do `tsconfig.json`, que só cobre
  `src`: tipá-lo exigiria `@types/node`, dependência nova só para o arnês. Ele
  roda a cada validação, então o erro aparece na hora — mas o compilador não
  guarda esta pasta.
