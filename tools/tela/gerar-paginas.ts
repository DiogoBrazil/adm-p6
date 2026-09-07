/**
 * Monta as páginas que o arnês de TELA mede num navegador.
 *
 * POR QUE ISTO EXISTE
 *
 * As listagens usam `table-layout: fixed` com as colunas repartindo 100% da
 * área. Ao encolher, coluna `truncar` corta com reticências — certo — mas
 * coluna `nowrap` tem `overflow: visible`: o texto **pinta por cima da
 * vizinha**, sem erro e sem aviso. Foi assim que a matrícula de 9 dígitos
 * cobria o começo do nome em qualquer janela abaixo de 1006px, e que o Mapa
 * Mensal transbordava três datas dentro do piso de 1060px que ele já declarava.
 *
 * Isso não se confere lendo CSS: depende da métrica da fonte, do rótulo do
 * cabeçalho e do dado real. O arnês mede, e `conferir.mjs` afere se o
 * `PISO_PX` que cada tela declara cobre o que foi medido.
 *
 * Usa as colunas e os pisos REAIS, importados das telas — escrevê-los aqui
 * faria a fixtura certificar um layout que o app não desenha mais.
 *
 *   npm run build && npx vite-node tools/tela/gerar-paginas.ts
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { tabela, type Coluna, type Linha } from "../../src/dom";
import { COLUNAS as COLUNAS_AUDITORIA, PISO_PX as PISO_AUDITORIA } from "../../src/telas/auditoria";
import { COLUNAS as COLUNAS_PRAZOS, PISO_PX as PISO_PRAZOS } from "../../src/telas/prazos";
import { COLUNAS as COLUNAS_USUARIOS, PISO_PX as PISO_USUARIOS } from "../../src/telas/usuarios";
import {
  COLUNAS_MAPA, COLUNAS_SALVOS, PISO_MAPA_PX, PISO_SALVOS_PX,
} from "../../src/telas/mapas";

const RAIZ = process.cwd();
const assets = join(RAIZ, "dist/assets");
const css = readdirSync(assets).find((f) => f.endsWith(".css"));
if (!css) throw new Error("rode `npm run build` antes: o arnês usa o CSS compilado");

// Pior caso REAL, conferido no banco de produção em 04/09/2026:
// matrícula tem 9 dígitos, o nome mais longo tem 42 caracteres, a sigla de
// posto mais longa tem 10 e a natureza mais longa tem 88.
const NOME = "ANTONIO CARLOS WANZELLER DOS SANTOS JUNIOR";
const POSTO = "TEN CEL PM";
const MATRICULA = "100096627";
const UNIDADE = "7º BPM — Subunidade de Policiamento Ostensivo";
const NATUREZA = "Violência doméstica e familiar contra a mulher (Lei Maria da Penha)";
const acoes = (ids: string[]) => ({
  texto: "",
  acoes: ids.map((r, i) => ({ rotulo: r, id: "1", icone: "abrir" as never, dado: `acao${i}` })),
});

type Conjunto = { nome: string; colunas: Coluna[]; piso: number; linhas: Linha[] };

const CONJUNTOS: Conjunto[] = [
  {
    nome: "usuarios", colunas: COLUNAS_USUARIOS, piso: PISO_USUARIOS,
    linhas: Array.from({ length: 8 }, () => [
      POSTO, MATRICULA, NOME, "Sim", "Sim", "Administrador", "Ativo",
      acoes(["Abrir", "Desativar", "Excluir"]),
    ]),
  },
  {
    nome: "prazos", colunas: COLUNAS_PRAZOS, piso: PISO_PRAZOS,
    linhas: Array.from({ length: 8 }, () => [
      "PADS", UNIDADE, `${POSTO} ${MATRICULA} ${NOME}`, "31/12/2026",
      { texto: "365", numerica: true }, "Vencido",
    ]),
  },
  {
    nome: "auditoria", colunas: COLUNAS_AUDITORIA, piso: PISO_AUDITORIA,
    linhas: Array.from({ length: 8 }, () => [
      "31/12/2026 23:59", `${POSTO} ${MATRICULA} ${NOME}`,
      "Atualizou o resultado do envolvido", `Processo 100/P-6/7º BPM — ${NATUREZA}`,
    ]),
  },
  {
    nome: "mapa-mensal", colunas: COLUNAS_MAPA, piso: PISO_MAPA_PX,
    linhas: Array.from({ length: 8 }, () => [
      "PADS", "100/2026/PM-7BPMP6", UNIDADE, NATUREZA, "31/12/2026", "31/12/2026",
      `${POSTO} ${NOME}`, `${NOME} e mais 3`, "31/12/2026", "Remetido à autoridade",
    ]),
  },
  {
    nome: "mapas-salvos", colunas: COLUNAS_SALVOS, piso: PISO_SALVOS_PX,
    linhas: Array.from({ length: 8 }, () => [
      "Mapa Mensal de Dezembro de 2026 — completo", "PADS", "12/2026",
      { texto: "163", numerica: true }, { texto: "134", numerica: true },
      { texto: "102", numerica: true }, `${POSTO} ${NOME}`, "31/12/2026 23:59",
      acoes(["Ver resumo", "PDF", "Excluir"]),
    ]),
  },
];

const pagina = (corpo: string) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/dist/assets/${css}" />
<title>listagens</title></head>
<body><div id="app"><div class="app-shell">
  <aside class="sidebar"><div class="brand"><strong>GESTÃO P6/7ºBPM</strong><span>Justiça e Disciplina</span></div></aside>
  <main class="main">
    <header class="topbar"><div class="session-info"><strong>Sessão</strong></div></header>
    <div class="content-area"><section class="panel">${corpo}</section></div>
  </main>
</div></div>
<script>
  // O mesmo que dom.ts::aplicarLarguras faz, e que o shell() chama a cada render.
  document.querySelectorAll("col[data-largura]").forEach((c) => { c.style.width = c.dataset.largura + "%"; });
  document.querySelectorAll("table[data-piso]").forEach((t) => { t.style.minWidth = t.dataset.piso + "px"; });
</script>
</body></html>`;

const corpo = CONJUNTOS.map((c) =>
  `<h2>${c.nome}</h2><div data-tabela="${c.nome}" data-piso-declarado="${c.piso}">` +
  tabela(c.colunas, c.linhas, "Nada.", { listagem: true, pisoPx: c.piso }) +
  `</div>`,
).join("\n");

const saida = resolve(RAIZ, "tools/tela/paginas");
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, "listagens.html"), pagina(corpo), "utf8");
console.log("página gerada:", join(saida, "listagens.html"));
console.log("pisos declarados:", CONJUNTOS.map((c) => `${c.nome}=${c.piso}`).join("  "));
