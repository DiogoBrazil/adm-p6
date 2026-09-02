/**
 * Monta as páginas HTML que o arnês de impressão manda ao WebKitGTK.
 *
 * POR QUE ISTO EXISTE
 *
 * A rodada 30 escolheu margens, densidades e tamanhos de bloco sem imprimir uma
 * folha sequer. CSS de impressão não se confere lendo: o WebKitGTK ignora
 * `@page size`, parte `<tr>` que mandou não partir e mede a folha por conta
 * própria. O arnês existe para que a próxima mexida em `report-print.css`
 * possa ser medida em vez de argumentada.
 *
 * As fixturas usam os helpers **reais** (`dom.ts::tabela`,
 * `graficos::kpiAnalitico`, `mapa-pdf.ts::renderDocumentoMapa`) e o CSS
 * **compilado** por `npm run build` — é o cascade que o app tem, com os blocos
 * `@media print` antigos de `styles.css` no meio. Reescrever o markup aqui
 * mediria outra coisa.
 *
 * Este arquivo fica fora do `include` do `tsconfig.json` (que só cobre `src`) e
 * portanto **não passa por `tsc --noEmit`**: typá-lo exigiria `@types/node`,
 * uma dependência nova só para o arnês. Ele roda a cada validação, então o erro
 * aparece na hora — mas não conte com o compilador aqui.
 *
 *   npm run build && npx vite-node tools/impressao/gerar-fixturas.ts
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { blocosDeImpressao, escapeHtml, tabela, type Coluna, type Linha } from "../../src/dom";
import { kpiAnalitico } from "../../src/graficos";
import { normalizarDesignacoesParaImpressao } from "../../src/telas/encarregados";
import { renderDocumentoMapa } from "../../src/telas/mapa-pdf";

type Orientacao = "retrato" | "paisagem";
type Perfil = "tabular" | "analitico" | "documento";

type Fixtura = {
  nome: string;
  orientacao: Orientacao;
  /** O que a fixtura prova. Vai para o manifesto e para o relatório. */
  proposito: string;
  perfil?: Perfil;
  corpo: string;
  /** Quantos marcadores `L####` o PDF tem de conter, todos, um por linha. */
  marcadores?: number;
  /**
   * A fixtura mede, não assere.
   *
   * As `medicao-*` imprimem **sem** fragmentação, para registrar quantas linhas
   * cabem por folha e quantas o motor parte na quebra de página. O resultado é
   * número, não veredito: quem assere é a `calibrado-*` correspondente. Marcar
   * isso evita um arnês cronicamente vermelho, que ninguém lê.
   */
  medicao?: boolean;
  /** O Mapa Mensal não passa pelo helper: nem `body`, nem perfil. */
  documentoProprio?: boolean;
  /**
   * Rótulo da primeira coluna, em caixa alta como o `th` o imprime.
   *
   * `conferir.py` conta quantas vezes ele aparece por folha: mais de uma vez é
   * fragmento menor que a página, com cabeçalho repetido no meio do papel.
   */
  rotuloCabecalho?: string;
  /** Textos que precisam sobreviver completos à composição do PDF. */
  textosObrigatorios?: string[];
  /** Textos de tela que não podem alcançar o documento. */
  textosProibidos?: string[];
  /** Pares que precisam aparecer juntos em pelo menos uma folha. */
  textosNaMesmaPagina?: [string, string][];
  /** Ativa a detecção geométrica de palavras sobrepostas. */
  semSobreposicao?: boolean;
  /** Limite para detectar folhas vazias acrescentadas pelo shell. */
  paginasMaximas?: number;
  /**
   * Imprime com o compositing do WebKit **ligado**, como o aplicativo roda.
   *
   * O arnês desliga o compositing por padrão, porque a janela offscreen não
   * consegue o contexto GL na sessão Wayland. Só que desligá-lo esconde o
   * defeito: com ele ligado o `<canvas>` vira textura de GPU e sai preto
   * chapado no papel. Quem precisa da resposta honesta pede isto, e
   * `imprimir.py` a imprime num processo à parte.
   */
  compositing?: boolean;
  /** Reprova a folha com preto chapado — gráfico que não foi pintado. */
  semFaixaPreta?: boolean;
};

const RAIZ = resolve(import.meta.dirname ?? ".", "../..");

// ── Dados sintéticos ──────────────────────────────────────────────────

/**
 * Cada linha carrega um marcador único.
 *
 * É ele que transforma "o PDF parece certo" em asserção: `conferir.py` exige
 * os N marcadores no texto extraído. Linha comida por uma quebra de página,
 * célula cortada por `overflow: hidden` e fragmento perdido aparecem como
 * marcador ausente — que é a única forma de esses defeitos darem erro.
 */
const marcador = (i: number) => `L${String(i + 1).padStart(4, "0")}`;

/**
 * O par do marcador, na **última** célula da linha.
 *
 * Com os dois, "a linha foi partida entre páginas" deixa de ser impressão
 * visual e vira asserção: `L0042` numa folha e `F0042` na seguinte é o defeito
 * que `break-inside: avoid` no `<tr>` deveria impedir e o WebKitGTK ignora.
 */
const marcadorFinal = (i: number) => `F${String(i + 1).padStart(4, "0")}`;

/**
 * Costura o par de marcadores na linha.
 *
 * O final vai na célula de **texto mais longo**, não na última coluna: é a
 * célula alta que a quebra de página fatia, e é lá que o marcador prova o
 * corte. Numa coluna estreita de `col--nowrap` — "Dias", "Total" — o marcador
 * transbordaria a célula e sumiria do texto extraído, medindo o arnês em vez
 * do papel.
 */
function comMarcadores(linha: Linha, i: number): Linha {
  const celulas = Array.isArray(linha) ? [...linha] : [...linha.celulas];
  const textoDe = (c: (typeof celulas)[number]) => (typeof c === "string" ? c : c.texto);
  let alvo = 0;
  celulas.forEach((c, indice) => {
    if (textoDe(c).length > textoDe(celulas[alvo]!).length) alvo = indice;
  });
  const celula = celulas[alvo]!;
  celulas[alvo] =
    typeof celula === "string"
      ? `${celula} ${marcadorFinal(i)}`
      : { ...celula, texto: `${celula.texto} ${marcadorFinal(i)}` };
  return Array.isArray(linha) ? celulas : { ...linha, celulas };
}

const NOMES = ["Silva", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima"];
const POSTOS = ["CEL PM", "TEN CEL PM", "MAJ PM", "CAP PM", "1º TEN PM", "SGT PM", "CB PM", "SD PM"];

const LONGO =
  "Apuração de responsabilidade por conduta atribuída a militar estadual em serviço " +
  "de policiamento ostensivo, com desdobramento administrativo e disciplinar";

/** Palavra sem espaço: é ela que estoura a coluna quando falta `overflow-wrap`. */
const SEM_ESPACO = "PROCESSO-ADMINISTRATIVO-DISCIPLINAR-2026-000000000000-RETIFICADO";

function textoDaLinha(i: number): string {
  if (i % 17 === 0) return `${marcador(i)} ${SEM_ESPACO}`;
  if (i % 5 === 0) return `${marcador(i)} ${LONGO}`;
  return `${marcador(i)} ${NOMES[i % NOMES.length]} do processo ${100 + i}`;
}

// ── Conjuntos de colunas, iguais aos das telas ────────────────────────

type Conjunto = {
  orientacao: Orientacao;
  colunas: (string | Coluna)[];
  larga?: boolean;
  /** O valor que a tela declara hoje. Só existe para a fixtura calibrada. */
  fragmentoAtual: number;
  /**
   * O primeiro bloco, quando ele é menor que os demais.
   *
   * A tela declara os dois quando a folha 1 divide espaço com o que vem antes
   * da tabela — em Designações, o título, os KPIs e o `h2` da matriz.
   */
  fragmentoPrimeiro?: number;
  /** O mesmo, quando o perfil documento imprime a mesma tabela em 10pt. */
  fragmentoAtualDocumento?: number;
  /** Onde o valor mora, para que calibrar não vire caça ao arquivo. */
  origem: string;
  /**
   * Classe do invólucro que a tela põe em volta da tabela.
   *
   * Não é enfeite: as larguras de `.mapa-salvo__tabela` moram nele. Sem o
   * invólucro a fixtura mede uma tabela que a aplicação não imprime — foi o
   * que fez a primeira medição sair com colunas de dois caracteres.
   */
  envoltorio?: string;
  /**
   * Rótulo curto de cabeçalho que cabe numa linha só.
   *
   * `conferir.py` conta o rótulo no texto extraído, e um rótulo que quebra em
   * duas linhas some da contagem — "APURATÓRIO" nos 8% do mapa salvo sai
   * "APURATÓRI/O". Quando a primeira coluna é estreita, escolha outra.
   */
  rotulo?: string;
  linha: (i: number) => Linha;
};

const CONJUNTOS: Record<string, Conjunto> = {
  // src/telas/auditoria.ts:55
  auditoria: {
    orientacao: "retrato",
    fragmentoAtual: 8,
    origem: "src/telas/auditoria.ts (aoImprimir)",
    colunas: [
      { rotulo: "Quando", largura: 18, alinhamento: "centro", nowrap: true },
      { rotulo: "Quem fez", largura: 26, truncar: true },
      { rotulo: "O que foi feito", largura: 28, truncar: true },
      { rotulo: "Sobre o quê", largura: 28, truncar: true },
    ],
    linha: (i) => [
      `${String((i % 28) + 1).padStart(2, "0")}/02/2026 08:${String(i % 60).padStart(2, "0")}`,
      `${POSTOS[i % POSTOS.length]} ${100000 + i} ${NOMES[i % NOMES.length]}`,
      textoDaLinha(i),
      `Processo ${100 + i} — ${LONGO}`,
    ],
  },
  // src/telas/prazos.ts:57
  prazos: {
    orientacao: "paisagem",
    fragmentoAtual: 14,
    origem: "src/telas/prazos.ts (aoImprimir)",
    colunas: [
      { rotulo: "Apuratório", largura: 16, alinhamento: "centro", truncar: true },
      { rotulo: "Unidade", largura: 18, alinhamento: "centro", truncar: true },
      { rotulo: "Responsável", largura: 32, truncar: true },
      { rotulo: "Vencimento", largura: 14, alinhamento: "centro", nowrap: true },
      { rotulo: "Dias", largura: 12, alinhamento: "centro", nowrap: true },
      { rotulo: "Prazo", largura: 8, alinhamento: "centro" },
    ],
    linha: (i) => [
      "IPM",
      `7º BPM — ${i % 3 === 0 ? "Subunidade de Policiamento Ostensivo" : "Sede"}`,
      textoDaLinha(i),
      `${String((i % 28) + 1).padStart(2, "0")}/03/2026`,
      { texto: String(30 + (i % 30)), numerica: true },
      i % 4 === 0 ? "Vencido" : "No prazo",
    ],
  },
  // src/telas/usuarios.ts:99 (COLUNAS_IMPRESSAO)
  usuarios: {
    orientacao: "paisagem",
    fragmentoAtual: 16,
    origem: "src/telas/usuarios.ts (aoImprimir)",
    colunas: [
      {
        rotulo: "Posto/Graduação",
        largura: 16,
        alinhamento: "centro",
        truncar: true,
        quebrarRotulo: true,
      },
      { rotulo: "Matrícula", largura: 10, alinhamento: "centro", nowrap: true },
      { rotulo: "Nome", largura: 24, truncar: true },
      { rotulo: "Encarregado", largura: 9, alinhamento: "centro", nowrap: true },
      {
        rotulo: "Usuário do sistema",
        largura: 11,
        alinhamento: "centro",
        nowrap: true,
        quebrarRotulo: true,
      },
      { rotulo: "Perfil", largura: 10, alinhamento: "centro", truncar: true },
      { rotulo: "Situação", largura: 8, alinhamento: "centro", nowrap: true },
    ],
    linha: (i) => [
      POSTOS[i % POSTOS.length]!,
      String(100000 + i),
      textoDaLinha(i),
      i % 3 === 0 ? "Sim" : "Não",
      i % 2 === 0 ? "Sim" : "Não",
      i % 2 === 0 ? "Administrador" : "Leitura",
      i % 7 === 0 ? "Inativo" : "Ativo",
    ],
  },
  // src/telas/usuarios.ts (tabelaProcessos) — retrato, dentro de `.detail-section`
  "usuario-processos": {
    orientacao: "retrato",
    fragmentoAtual: 14,
    origem: "src/telas/usuarios.ts (tabelaProcessos)",
    colunas: [
      { rotulo: "Apuratório", largura: 22, truncar: true, alinhamento: "centro" },
      { rotulo: "Apuratório", largura: 24, truncar: true, alinhamento: "centro" },
      { rotulo: "Função", largura: 24, truncar: true, alinhamento: "centro" },
      { rotulo: "Instauração", largura: 15, alinhamento: "centro", nowrap: true },
      { rotulo: "Situação", largura: 15, alinhamento: "centro", nowrap: true },
    ],
    rotulo: "FUNÇÃO",
    linha: (i) => [
      `${marcador(i)} IPM nº ${100 + i}`,
      i % 5 === 0 ? LONGO : "Inquérito Policial Militar",
      i % 3 === 0 ? "Encarregado" : "Escrivão",
      `${String((i % 28) + 1).padStart(2, "0")}/01/2026`,
      i % 3 === 0 ? "em andamento" : "concluído em 30/06/2026",
    ],
  },

  // src/telas/mapas.ts:74 (COLUNAS_MAPA) — dez colunas, a tabela mais larga do app
  "mapa-salvo": {
    orientacao: "paisagem",
    larga: true,
    fragmentoAtual: 5,
    origem: "src/telas/mapas.ts (renderMapaSalvo)",
    envoltorio: "mapa-salvo__tabela",
    rotulo: "UNIDADE",
    colunas: [
      { rotulo: "Apuratório", largura: 8, alinhamento: "centro", nowrap: true },
      { rotulo: "Identificação", largura: 12, truncar: true },
      { rotulo: "Unidade", largura: 11, truncar: true },
      { rotulo: "Natureza", largura: 9, truncar: true },
      { rotulo: "Instauração", largura: 9, alinhamento: "centro", nowrap: true },
      { rotulo: "Conclusão", largura: 8, alinhamento: "centro", nowrap: true },
      { rotulo: "Responsável", largura: 13, truncar: true },
      { rotulo: "Envolvidos", largura: 11, truncar: true },
      { rotulo: "Vencimento", largura: 9, alinhamento: "centro", nowrap: true },
      { rotulo: "Último andamento", largura: 10, truncar: true },
    ],
    linha: (i) => [
      "IPM",
      `${marcador(i)} 2026-7BPM`,
      "7º BPM — Subunidade de Policiamento Ostensivo",
      i % 5 === 0 ? LONGO : "Conduta disciplinar",
      `${String((i % 28) + 1).padStart(2, "0")}/01/2026`,
      i % 3 === 0 ? "em andamento" : `${String((i % 28) + 1).padStart(2, "0")}/06/2026`,
      `${POSTOS[i % POSTOS.length]} ${100000 + i} ${NOMES[i % NOMES.length]}`,
      `${POSTOS[(i + 1) % POSTOS.length]} ${200000 + i} ${NOMES[(i + 1) % NOMES.length]}`,
      `${String((i % 28) + 1).padStart(2, "0")}/07/2026`,
      i % 4 === 0 ? SEM_ESPACO : "Termo de declarações juntado aos autos",
    ],
  },
  // src/telas/estatisticas.ts (tabelaSituacao) — cinco colunas, linhas curtas
  situacao: {
    orientacao: "paisagem",
    fragmentoAtual: 16,
    origem: "src/telas/estatisticas.ts (tabelaSituacao)",
    colunas: [
      { rotulo: "Apuratório", largura: 34, truncar: true },
      { rotulo: "Tipo", largura: 26, truncar: true },
      { rotulo: "Em andamento", largura: 14, alinhamento: "centro", nowrap: true },
      { rotulo: "Concluídos", largura: 13, alinhamento: "centro", nowrap: true },
      { rotulo: "Total", largura: 13, alinhamento: "centro", nowrap: true },
    ],
    rotulo: "TIPO",
    linha: (i) => [
      `${marcador(i)} IPM — ${i % 5 === 0 ? LONGO : "Inquérito Policial Militar"}`,
      i % 3 === 0 ? "Apuratório disciplinar" : "Apuratório penal militar",
      { texto: String(i % 40), numerica: true },
      { texto: String(i % 25), numerica: true },
      { texto: String(i % 60), numerica: true },
    ],
  },

  // src/telas/estatisticas.ts (tabelaEnquadramento) — a descrição legal inteira
  enquadramento: {
    orientacao: "paisagem",
    fragmentoAtual: 8,
    origem: "src/telas/estatisticas.ts (tabelaEnquadramento)",
    colunas: [
      { rotulo: "Artigo / inciso", largura: 18, truncar: true },
      { rotulo: "Classificação", largura: 16, truncar: true },
      { rotulo: "Descrição", largura: 58, truncar: true },
      { rotulo: "Qtd.", largura: 8, alinhamento: "centro", nowrap: true },
    ],
    rotulo: "CLASSIFICAÇÃO",
    linha: (i) => [
      `${marcador(i)} Art. ${12 + (i % 40)}, inciso ${1 + (i % 9)}`,
      i % 3 === 0 ? "Transgressão grave" : "Transgressão média",
      // A descrição legal é o texto mais longo que o app imprime.
      `${LONGO}, ${LONGO.toLowerCase()}`,
      { texto: String(1 + (i % 30)), numerica: true },
    ],
  },

  // src/telas/encarregados.ts — a matriz normalizada do papel
  matriz: {
    orientacao: "paisagem",
    fragmentoAtual: 22,
    fragmentoPrimeiro: 12,
    origem: "src/telas/encarregados.ts (tabelaMatrizImpressao)",
    colunas: [
      { rotulo: "Policial Militar", largura: 44 },
      { rotulo: "Apuratório", largura: 44 },
      { rotulo: "Quantidade", largura: 12, alinhamento: "direita", nowrap: true },
    ],
    linha: (i) => ({
      celulas: [
        `${marcador(i)} ${POSTOS[i % POSTOS.length]} ${100000 + i} ${NOMES[i % NOMES.length]}`,
        i % 4 === 0 ? "Sindicância Administrativa Disciplinar" : "Inquérito Policial Militar",
        { texto: String(1 + (i % 9)), numerica: true, classe: "total" },
      ],
      classe: i % 9 === 8 ? "linha-total" : "",
    }),
  },
  // dom.ts::painelContagem — duas colunas, a tabela mais estreita
  contagem: {
    orientacao: "paisagem",
    fragmentoAtual: 20,
    origem: "src/dom.ts (painelContagem)",
    colunas: [
      { rotulo: "Item", largura: 70 },
      { rotulo: "Total", largura: 30, alinhamento: "direita", nowrap: true },
    ],
    linha: (i) => [textoDaLinha(i), { texto: String(i * 3), numerica: true }],
  },
};

// ── Montagem das páginas ──────────────────────────────────────────────

/**
 * O que `dom.ts::inserirCabecalhoInstitucional` monta no clique de imprimir.
 *
 * A fixtura não tem JS: é o retrato do DOM que o app leva ao papel, e o
 * cabeçalho tem de estar nele — senão o arnês certifica uma folha com ~24mm a
 * mais de espaço do que o app realmente imprime, e o primeiro bloco de cada
 * tabela fica calibrado para uma folha que não existe.
 *
 * O `file://` é absoluto pelo mesmo motivo que o do CSS: a fixtura é aberta
 * fora da árvore do Vite, e caminho relativo não acharia o asset.
 */
function cabecalhoInstitucional(): string {
  const brasao = `file://${resolve("src/assets/brasao-pmro.png")}`;
  return `<header class="cabecalho-institucional">
    <img src="${escapeHtml(brasao)}" alt="" />
    <p>Polícia Militar de Rondônia</p>
    <span>7º BPM · Seção de Justiça e Disciplina</span>
  </header>`;
}

/**
 * `institucional: false` reproduz a guarda do perfil `documento`: ali o
 * Relatório Anual já abre com a `.relatorio-capa`, e o app não insere o
 * cabeçalho para não pôr dois brasões na mesma folha.
 */
function cabecalho(
  titulo: string,
  subtitulo: string,
  opcoes: { institucional?: boolean } = {},
): string {
  const institucional = opcoes.institucional === false ? "" : cabecalhoInstitucional();
  return `${institucional}<div class="page-head">
    <div><h1>${escapeHtml(titulo)}</h1><p>${escapeHtml(subtitulo)}</p></div>
    <div class="page-head-right">
      <div class="export-bar"><button class="outline small">Imprimir / PDF</button></div>
    </div>
  </div>`;
}

/** A tela vive dentro do `.app-shell` do `main.ts::shell`; o papel também. */
function painel(conteudo: string): string {
  return `<div class="app-shell">
    <aside class="sidebar"><div class="brand"><strong>ADM-P6</strong></div></aside>
    <main class="main">
      <header class="topbar"><div class="session-info"><strong>Sessão de teste</strong></div></header>
      <div class="content-area"><section class="panel">${conteudo}</section></div>
    </main>
  </div>`;
}

/**
 * `aplicarLarguras` roda pela CSSOM no app, e a fixtura não tem JS. Aqui a
 * largura vira `style` no `<col>` — o que a CSP proíbe **no app**, não num
 * arquivo solto: o resultado renderizado é o mesmo que `shell()` produz.
 */
function comLarguras(html: string): string {
  return html.replace(/<col data-largura="([\d.]+)" \/>/g, '<col style="width:$1%" />');
}

/** O mesmo recorte de `dom.ts::fragmentarTabelasParaImpressao`, sem DOM. */
function envolver(conjunto: Conjunto, html: string): string {
  return conjunto.envoltorio ? `<div class="${conjunto.envoltorio}">${html}</div>` : html;
}

function tabelaFragmentada(
  conjunto: Conjunto,
  total: number,
  limite: number,
  deslocamento = 0,
  cabecalhoPrimeiro = "",
  limitePrimeiro = limite,
): string {
  const blocos = blocosDeImpressao(total, limite, limitePrimeiro);
  return `<div class="tabela-impressao-fragmentada">${blocos
    .map(([inicio, fim]) => {
      const linhas = Array.from({ length: fim - inicio }, (_, k) =>
        comMarcadores(conjunto.linha(deslocamento + inicio + k), deslocamento + inicio + k),
      );
      let html = tabela(conjunto.colunas, linhas, "Nada a exibir.", {
        listagem: true,
        larga: conjunto.larga,
      });
      html = html.replace(
        '<div class="table-wrap"',
        '<div class="table-wrap tabela-impressao-fragmento"',
      );
      if (inicio === 0 && cabecalhoPrimeiro) {
        html = html.replace("><table", `>${cabecalhoPrimeiro}<table`);
      }
      return envolver(
        conjunto,
        html,
      );
    })
    .join("")}</div>`;
}

function tabelaInteira(conjunto: Conjunto, total: number, deslocamento = 0): string {
  const linhas = Array.from({ length: total }, (_, i) =>
    comMarcadores(conjunto.linha(deslocamento + i), deslocamento + i),
  );
  return envolver(
    conjunto,
    tabela(conjunto.colunas, linhas, "Nada a exibir.", {
      listagem: true,
      larga: conjunto.larga,
    }),
  );
}

function pagina(fixtura: Fixtura, css: string): string {
  const classesHtml = fixtura.documentoProprio ? ' class="mapa-pdf-ativo"' : "";
  const classesBody = fixtura.documentoProprio
    ? ""
    : ` class="relatorio-pdf-ativo impressao-perfil--${fixtura.perfil ?? "tabular"}"`;
  const direcao = fixtura.orientacao === "paisagem" ? "landscape" : "portrait";
  // No Linux tamanho e margens vêm do GtkPageSetup. A regra fica com margem
  // zero para provar que o CSS não soma uma segunda margem à folha nativa; o
  // fallback de Chromium/WebView2 é coberto separadamente.
  const folha = fixtura.documentoProprio
    ? ""
    : `<style>@page { size: A4 ${direcao}; margin: 0; }</style>`;
  return `<!doctype html>
<html lang="pt-BR"${classesHtml}>
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(fixtura.nome)}</title>
    <link rel="stylesheet" href="${escapeHtml(css)}" />
    ${folha}
  </head>
  <body${classesBody}>${comLarguras(fixtura.corpo)}</body>
</html>`;
}

// ── O Mapa Mensal, controle de regressão ──────────────────────────────

/**
 * Um `MapPrintItem` sintético, com todos os campos que `renderFicha` e
 * `renderCapa` percorrem.
 *
 * Serve ao **controle**: o mesmo markup impresso com o CSS de antes e o de
 * depois. A paginação real do mapa é medida no DOM por `mapa-pdf.ts` e não
 * entra aqui — o que se prova é que nenhuma regra nova alcançou o documento.
 */
function itemDoMapa(i: number): any {
  const processo = {
    id: `p${i}`,
    rotulo: `IPM ${String(i + 1).padStart(3, "0")}/2026-7BPM`,
    apuratorio_id: "ipm",
    apuratorio_sigla: "IPM",
    apuratorio_nome: "Inquérito Policial Militar",
    numero_rgf: `RGF-${1000 + i}`,
    concluido: i % 2 === 0,
    unidade_origem: "7º BPM",
    subunidade_secao_origem: "Subunidade de Policiamento Ostensivo",
    natureza_fato: LONGO,
    resumo_fatos: `${LONGO}. ${LONGO}.`,
    data_instauracao: "2026-01-12",
    data_conclusao: i % 2 === 0 ? "2026-06-30" : null,
    data_remessa_encarregado: "2026-01-15",
    data_remessa_comissao: null,
    data_julgamento: null,
    envolvidos: [
      {
        id: `e${i}`,
        ordem: 1,
        nome: `${POSTOS[i % POSTOS.length]} ${100000 + i} ${NOMES[i % NOMES.length]}`,
        status_envolvido: "Sindicado",
        e_condutor: false,
      },
    ],
    designacoes: [
      {
        id: `d${i}`,
        papel: "Encarregado",
        nome: `${POSTOS[(i + 2) % POSTOS.length]} ${200000 + i} ${NOMES[(i + 2) % NOMES.length]}`,
        data_inicio: "2026-01-15",
        data_fim: null,
      },
    ],
    pessoas: [{ papel_pessoa: "Testemunha", nome: `${NOMES[i % NOMES.length]} da Silva`, ordem: 1 }],
    vitimas: [{ ordem: 1, nome: `${NOMES[(i + 3) % NOMES.length]} de Souza` }],
    anexos: [
      {
        nome_arquivo: "termo-de-declaracoes.pdf",
        mime_type: "application/pdf",
        tamanho_bytes: 148_233,
        enviado_por: "Administrador",
        created_at: "2026-02-01T10:00:00Z",
      },
    ],
    carta_precatoria: null,
  };
  return {
    processo,
    permite_remessa_comissao: false,
    prazos: [
      {
        id: `pr${i}`,
        dias: 30,
        data_inicio: "2026-01-15",
        prazo_vencimento: "2026-02-14",
        prorrogacao: false,
      },
    ],
    andamentos: [
      { id: `a${i}`, data_andamento: "2026-02-03", descricao: LONGO },
    ],
    enquadramentos: [],
  };
}

// ── Catálogo de fixturas ──────────────────────────────────────────────

/** Em caixa alta porque é assim que o `th` sai no papel (`text-transform`). */
function rotuloDaPrimeiraColuna(conjunto: Conjunto): string {
  if (conjunto.rotulo) return conjunto.rotulo.toUpperCase();
  const primeira = conjunto.colunas[0]!;
  return (typeof primeira === "string" ? primeira : primeira.rotulo).toUpperCase();
}

/**
 * O cartão analítico como `cartaoAnalitico` o emite, com a caixa do gráfico já
 * dimensionada em px.
 *
 * Dimensionar em px é o que `prepararGraficosParaImpressao` faz no app antes de
 * abrir o diálogo — `px` é unidade absoluta na impressão, e é assim que a
 * medida feita na tela vale para a folha. Aqui interessa porque é essa altura,
 * somada à moldura do cartão, que decide se ele cabe na folha 1.
 */
function cartaoDeGrafico(
  titulo: string,
  descricao: string,
  altura: number,
  caixa: string,
): string {
  const texto = descricao
    ? `<p class="analytics-card__description">${escapeHtml(descricao)}</p>`
    : "";
  return `<section class="analytics-card analytics-card--wide">
    <header class="analytics-card__header">
      <div><h2>${escapeHtml(titulo)}</h2>${texto}</div>
      <div class="analytics-card__tools">
        <div class="analytics-toggle" role="group" aria-label="Visualização">
          <button type="button" class="analytics-toggle__button" aria-pressed="true">Gráfico</button>
          <button type="button" class="analytics-toggle__button" aria-pressed="false">Tabela</button>
        </div>
      </div>
    </header>
    <div class="analytics-view analytics-view--chart" data-analytics-view="grafico">
      <div class="analytics-chart" style="width:960px;height:${altura}px">${caixa}</div>
    </div>
  </section>`;
}

/**
 * Pinta um `<canvas>` **visível**, deixa o motor compor alguns quadros e só
 * então o troca pelo PNG — que é a sequência exata do aplicativo.
 *
 * A fidelidade está no "visível primeiro". Um canvas que nasce oculto nunca
 * ganha camada de composição, e a fixtura passa sem provar nada: foi assim que
 * a primeira volta desta rodada deu por resolvida uma faixa preta que continuava
 * saindo no PDF real. Aqui o canvas é composto antes de ser escondido, como na
 * tela.
 *
 * `estrategia` é o que se está medindo: `"oculto"` põe `hidden` no canvas,
 * `"removido"` o tira do DOM.
 */
const trocaPeloPng = (estrategia: "oculto" | "removido") => `<script>
  (function () {
    document.querySelectorAll("canvas[data-desenho]").forEach(function (canvas) {
      var ctx = canvas.getContext("2d");
      var l = canvas.width;
      var a = canvas.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, l, a);
      var cores = ["#1f6feb", "#2da44e", "#bf8700", "#cf222e", "#8250df"];
      for (var i = 0; i < 5; i++) {
        var h = ((i + 2) / 8) * (a - 96);
        ctx.fillStyle = cores[i];
        ctx.fillRect(48 + (i * (l - 96)) / 5, a - 48 - h, (l - 96) / 5 - 28, h);
      }
      ctx.fillStyle = "#15202b";
      ctx.font = "30px sans-serif";
      ctx.fillText("BARRAS DE CONTROLE", 48, 44);
      // O Chart.js escreve isto ao montar (chart.js, style.display =
      // style.display || 'block'), e é o detalhe que decide a fixtura: estilo
      // inline vence a regra [hidden] display:none do navegador, que é a única
      // que existe — o projeto não declara nenhuma. Sem esta linha o canvas do
      // arnês some com hidden, e a fixtura aprova o que o PDF real reprova.
      canvas.style.display = "block";
    });
    // 120ms de quadros compostos antes da troca: é o que faz a camada de GPU
    // existir de verdade. O arnês imprime 300ms depois do load.
    setTimeout(function () {
      document.querySelectorAll("canvas[data-desenho]").forEach(function (canvas) {
        var caixa = canvas.parentElement;
        var imagem = document.createElement("img");
        imagem.src = canvas.toDataURL("image/png");
        imagem.alt = "Barras de controle";
        imagem.style.width = "100%";
        imagem.style.height = "100%";
        ${
          estrategia === "removido"
            ? "canvas.remove();"
            : "canvas.hidden = true;"
        }
        caixa.appendChild(imagem);
      });
    }, 120);
  })();
<\/script>`;

/**
 * Pinta os `<canvas>` da fixtura e espelha cada um num `<img>`.
 *
 * O arnês roda em Node, onde não há canvas nem Chart.js — e o desenho não é o
 * ponto. O que se mede é se o WebKitGTK **pinta** um `<canvas>` no caminho de
 * impressão, e se pinta o PNG que `toDataURL()` tira dele. É a mesma chamada
 * que `congelarGraficosParaImpressao` faz no app.
 */
const DESENHO_DE_TESTE = `<script>
  (function () {
    document.querySelectorAll("canvas[data-desenho]").forEach(function (canvas) {
      var ctx = canvas.getContext("2d");
      var l = canvas.width;
      var a = canvas.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, l, a);
      var cores = ["#1f6feb", "#2da44e", "#bf8700", "#cf222e", "#8250df"];
      for (var i = 0; i < 5; i++) {
        var h = ((i + 2) / 8) * (a - 96);
        ctx.fillStyle = cores[i];
        ctx.fillRect(48 + (i * (l - 96)) / 5, a - 48 - h, (l - 96) / 5 - 28, h);
      }
      ctx.fillStyle = "#15202b";
      ctx.font = "30px sans-serif";
      ctx.fillText("BARRAS DE CONTROLE", 48, 44);
      var espelho = document.querySelector(
        'img[data-espelho="' + canvas.dataset.desenho + '"]',
      );
      if (espelho) espelho.src = canvas.toDataURL("image/png");
    });
  })();
<\/script>`;

function catalogo(): Fixtura[] {
  const lista: Fixtura[] = [];

  for (const [nome, conjunto] of Object.entries(CONJUNTOS)) {
    // Medição: tabela única e longa. Serve para contar linhas por folha e para
    // ver se o WebKitGTK ainda parte `<tr>` — as duas perguntas que decidem
    // cada `linhasPorFragmentoImpressao`.
    lista.push({
      nome: `medicao-${nome}`,
      orientacao: conjunto.orientacao,
      proposito: `linhas por folha e integridade de <tr> — ${conjunto.origem}`,
      medicao: true,
      rotuloCabecalho: rotuloDaPrimeiraColuna(conjunto),
      corpo: painel(
        cabecalho(`Medição — ${nome}`, "Tabela única, sem fragmentação.") +
          tabelaInteira(conjunto, 400),
      ),
      marcadores: 400,
    });

    // Como a tela imprime hoje, com o valor que ela declara.
    lista.push({
      nome: `calibrado-${nome}`,
      orientacao: conjunto.orientacao,
      proposito: `fragmento de ${conjunto.fragmentoAtual} linhas — ${conjunto.origem}`,
      rotuloCabecalho: rotuloDaPrimeiraColuna(conjunto),
      corpo: painel(
        cabecalho(`Fragmentado — ${nome}`, `Blocos de ${conjunto.fragmentoAtual} linhas.`) +
          tabelaFragmentada(conjunto, 120, conjunto.fragmentoAtual),
      ),
      marcadores: 120,
    });
  }

  // Volumes de borda: nenhuma linha, uma linha, e o suficiente para uma folha só.
  const auditoria = CONJUNTOS.auditoria!;
  lista.push({
    nome: "volume-vazio",
    orientacao: "retrato",
    proposito: "listagem vazia não deve imprimir folha quebrada",
    corpo: painel(cabecalho("Auditoria", "Sem registros.") + tabelaInteira(auditoria, 0)),
    paginasMaximas: 1,
  });
  lista.push({
    nome: "volume-um",
    orientacao: "retrato",
    proposito: "uma linha só, com cabeçalho",
    corpo: painel(cabecalho("Auditoria", "Um registro.") + tabelaFragmentada(auditoria, 1, 4)),
    marcadores: 1,
    paginasMaximas: 1,
  });

  // O cabeçalho institucional entra em todo documento do caminho comum, e em
  // nenhum do perfil `documento`. As duas fixturas são o par: uma exige o texto
  // no papel, a outra o proíbe. Sem a segunda, uma regressão que trocasse a
  // guarda de JS por CSS — ou a apagasse — só apareceria no Relatório Anual
  // impresso com dois brasões, que é onde ninguém olha.
  lista.push({
    nome: "regressao-cabecalho-institucional",
    orientacao: "retrato",
    proposito: "brasão e unidade encabeçam o documento comum — src/dom.ts",
    corpo: painel(
      cabecalho("Auditoria", "Registros do escopo.") + tabelaFragmentada(auditoria, 12, 8),
    ),
    marcadores: 12,
    textosObrigatorios: ["Polícia Militar de Rondônia", "Seção de Justiça e Disciplina"],
    // Só na primeira folha: o caminho comum não repete cabeçalho por folha, e
    // um dia em que passasse a repetir seria mudança a decidir, não a herdar.
    textosNaMesmaPagina: [["Polícia Militar de Rondônia", "L0001"]],
  });
  lista.push({
    nome: "regressao-cabecalho-documento",
    orientacao: "paisagem",
    perfil: "documento",
    proposito: "o perfil documento tem capa própria e não recebe o cabeçalho — src/dom.ts",
    corpo: painel(
      `<div class="relatorio-anual">
        ${cabecalho("Relatório Anual — 2026", "Não pertence ao PDF.", { institucional: false })}
        <section class="relatorio-capa"><h1>Relatório Anual</h1><p>7º BPM — 2026</p></section>
        <section class="relatorio-secao"><h2>1. Seção</h2>${tabelaInteira(auditoria, 4)}</section>
      </div>`,
    ),
    marcadores: 4,
    textosProibidos: ["Polícia Militar de Rondônia"],
  });

  // Reproduções mínimas dos dois recortes encontrados nos PDFs enviados.
  // Não são aproximações: larguras, rótulos e `nowrap` são os das telas.
  const colunasDesignacoes: Coluna[] = [
    { rotulo: "Policial Militar", largura: 32, truncar: true },
    { rotulo: "Concluídos", largura: 11, alinhamento: "centro", nowrap: true },
    { rotulo: "Em andamento no prazo", largura: 11, alinhamento: "centro", nowrap: true },
    { rotulo: "Em andamento vencido", largura: 11, alinhamento: "centro", nowrap: true },
    { rotulo: "Total", largura: 8, alinhamento: "centro", nowrap: true },
    { rotulo: "Últ. recebimento", largura: 13, alinhamento: "centro", nowrap: true },
    { rotulo: "Últ. conclusão", largura: 13, alinhamento: "centro", nowrap: true },
  ];
  lista.push({
    nome: "regressao-designacoes-cabecalho",
    orientacao: "paisagem",
    perfil: "analitico",
    proposito: "cabeçalhos estreitos de Designações quebram sem colisão geométrica",
    corpo: painel(
      cabecalho("Designações por Policial Militar", "Cabeçalhos reais do cartão de carga.") +
        tabela(
          colunasDesignacoes,
          [["CEL PM 100000 Silva", "12", "8", "3", "23", "14/08/2026", "31/07/2026"]],
          "Nada.",
          { listagem: true },
        ),
    ),
    textosObrigatorios: ["NO PRAZO", "VENCIDO", "TOTAL"],
    semSobreposicao: true,
    paginasMaximas: 1,
  });

  lista.push({
    nome: "regressao-prazos-prorrogacao",
    orientacao: "paisagem",
    proposito: "o rótulo 1ª prorrogação chega completo à coluna final",
    corpo: painel(
      cabecalho("Prazos", "Colunas reais da listagem.") +
        tabela(
          CONJUNTOS.prazos!.colunas,
          [["IPM nº 123/2026", "7º BPM — Sede", "CAP PM 100000 Silva", "30/09/2026", "4 restantes", "1ª prorrogação"]],
          "Nada.",
          { listagem: true },
        ),
    ),
    textosObrigatorios: ["1ª prorrogação"],
    semSobreposicao: true,
    paginasMaximas: 1,
  });

  // Fragmento propositalmente maior que a folha: é o teste do `overflow:
  // hidden` do `.tabela-impressao-fragmento`. Se ele cortar, faltam marcadores.
  lista.push({
    nome: "fragmento-gigante",
    orientacao: "retrato",
    proposito: "fragmento maior que a folha degrada ao comportamento sem bloco",
    medicao: true,
    corpo: painel(
      cabecalho("Fragmento gigante", "Um bloco só, de 120 linhas.") +
        tabelaFragmentada(auditoria, 120, 120),
    ),
    marcadores: 120,
  });

  // Perfil documento: capa própria e seções que passam de uma folha.
  // O perfil documento imprime em 10pt, contra os 9pt dos demais: cabe menos
  // linha por folha, e o mesmo `tabelaContagem` serve às duas telas. Por isso a
  // medição do documento é separada.
  const contagem = CONJUNTOS.contagem!;
  lista.push({
    nome: "medicao-documento",
    orientacao: "paisagem",
    perfil: "documento",
    proposito: "linhas por folha em 10pt — `estatisticas.ts` servindo o Relatório Anual",
    rotuloCabecalho: rotuloDaPrimeiraColuna(contagem),
    medicao: true,
    corpo: painel(
      `<section class="relatorio-secao"><h2>Medição — documento</h2>${tabelaInteira(contagem, 400)}</section>`,
    ),
    marcadores: 400,
  });

  const secoesLongas = Array.from({ length: 6 }, (_, s) => {
    const cabecalhoSecao = `<h2>${s + 1}. Seção longa</h2>
      <p class="hint">Cada seção passa de uma folha; o título não pode ficar órfão.</p>`;
    return `<section class="relatorio-secao relatorio-secao--fragmentada-impressao">
      <div class="somente-tela-na-impressao">${cabecalhoSecao}</div>
      ${tabelaFragmentada(
        contagem,
        40,
        contagem.fragmentoAtualDocumento ?? contagem.fragmentoAtual,
        s * 40,
        cabecalhoSecao,
      )}
    </section>`;
  }).join("");
  const secaoCurta = `<section class="relatorio-secao">
    <h2>7. Seção curta</h2>
    <p class="hint">Título e tabela precisam mudar de folha juntos.</p>
    ${tabelaInteira(contagem, 4, 240)}
  </section>`;
  lista.push({
    nome: "anual-documento",
    orientacao: "paisagem",
    perfil: "documento",
    proposito: "capa isolada, seção longa atravessando páginas, título não órfão",
    rotuloCabecalho: rotuloDaPrimeiraColuna(contagem),
    corpo: painel(
      `<div class="relatorio-anual">
        ${cabecalho("Relatório Anual — 2026", "Cabeçalho operacional que não pertence ao PDF.", {
          institucional: false,
        })}
        <section class="relatorio-capa"><h1>Relatório Anual</h1><p>7º BPM — 2026</p></section>
        ${secoesLongas}${secaoCurta}
      </div>`,
    ),
    marcadores: 244,
    textosProibidos: ["Cabeçalho operacional que não pertence ao PDF."],
    textosNaMesmaPagina: [
      ["1. Seção longa", "L0001"],
      ["2. Seção longa", "L0041"],
      ["3. Seção longa", "L0081"],
      ["4. Seção longa", "L0121"],
      ["5. Seção longa", "L0161"],
      ["6. Seção longa", "L0201"],
      ["7. Seção curta", "L0241"],
    ],
  });

  // Perfil analítico: KPIs e cartões com tabela dentro.
  const cartoes = Array.from({ length: 4 }, (_, c) => {
    const inicio = 300 + c * 12;
    return `<article class="analytics-card analytics-card--fragmentada-impressao">
      <div class="analytics-card__header"><h2>Cartão ${c + 1}</h2>
        <div class="analytics-card__tools"><button>Gráfico</button><button>Tabela</button></div>
      </div>
      <div class="analytics-view analytics-view--table" data-analytics-view="tabela">
        ${tabelaFragmentada(contagem, 12, contagem.fragmentoAtual, inicio)}
      </div>
    </article>`;
  }).join("");
  // O mesmo painel, com as tabelas dos cartões **sem** fragmentação: quem
  // protege a linha aqui é o `break-inside: avoid` do próprio cartão.
  const cartoesInteiros = Array.from({ length: 4 }, (_, c) => {
    const inicio = 300 + c * 12;
    const linhas = Array.from({ length: 12 }, (_, k) =>
      comMarcadores(contagem.linha(inicio + k), inicio + k),
    );
    return `<article class="analytics-card">
      <div class="analytics-card__header"><h2>Cartão ${c + 1}</h2>
        <div class="analytics-card__tools"><button>Gráfico</button><button>Tabela</button></div>
      </div>
      <div class="analytics-view analytics-view--table" data-analytics-view="tabela">
        ${tabela(contagem.colunas, linhas, "Nada.", { listagem: true })}
      </div>
    </article>`;
  }).join("");
  lista.push({
    nome: "analitico-cartoes",
    orientacao: "paisagem",
    perfil: "analitico",
    proposito: "como o Painel e Estatísticas imprimem: KPIs e cartões indivisíveis",
    corpo: painel(
      cabecalho("Painel", "Indicadores do escopo.") +
        `<div class="analytics-grid">${cartoesInteiros}</div>`,
    ),
    marcadores: 48,
  });

  lista.push({
    nome: "analitico-cartoes-fragmentados",
    orientacao: "paisagem",
    perfil: "analitico",
    medicao: true,
    proposito: "por que o cartão não fragmenta: uma folha a mais e uma linha partida",
    corpo: painel(
      cabecalho("Painel", "Indicadores do escopo.") +
        `<div class="analytics-kpis">${[
          kpiAnalitico(128, "Com prazo vigente"),
          kpiAnalitico(12, "Vencidos", { tom: "alerta", detalhe: "Fora do prazo" }),
          kpiAnalitico(30, "Vencem em 7 dias", { tom: "andamento" }),
          kpiAnalitico(86, "Regulares", { tom: "sucesso" }),
        ].join("")}</div><div class="analytics-grid">${cartoes}</div>`,
    ),
    marcadores: 48,
  });

  // A matriz normalizada como `encarregados.ts` a monta, pela função real.
  const normalizada = normalizarDesignacoesParaImpressao(
    Array.from({ length: 24 }, (_, i) => ({
      policial_militar_id: `m${i}`,
      nome: NOMES[i % NOMES.length]!,
      matricula: String(100000 + i),
      posto_graduacao: POSTOS[i % POSTOS.length]!,
      concluidos: i,
      no_prazo: 0,
      vencidos: 0,
      sem_prazo: 0,
      total: 3 + (i % 5),
      ultimo_recebimento: null,
      ultima_conclusao: null,
      celulas: [
        { id: "ipm", rotulo: "IPM", concluidos: 0, no_prazo: 0, vencidos: 0, sem_prazo: 0, total: 1 + (i % 3), ultimo_recebimento: null, ultima_conclusao: null },
        { id: "sind", rotulo: "SIND", concluidos: 0, no_prazo: 0, vencidos: 0, sem_prazo: 0, total: 2 + (i % 2), ultimo_recebimento: null, ultima_conclusao: null },
      ],
    })) as any,
    [
      { id: "ipm", rotulo: "Inquérito Policial Militar" },
      { id: "sind", rotulo: "Sindicância Administrativa Disciplinar" },
    ],
  );
  lista.push({
    nome: "matriz-normalizada",
    orientacao: "paisagem",
    perfil: "analitico",
    proposito: "a matriz que só existe no papel, com totais por militar e geral",
    corpo: (() => {
      const colunas: Coluna[] = [
        { rotulo: "Policial Militar", largura: 44 },
        { rotulo: "Apuratório", largura: 44 },
        { rotulo: "Quantidade", largura: 12, alinhamento: "direita", nowrap: true },
      ];
      const linhas = normalizada.map((l) => ({
        celulas: [
          l.militar,
          l.apuratorio,
          { texto: String(l.quantidade), numerica: true, classe: "total" },
        ],
        classe: l.tipo === "item" ? "" : "linha-total",
      }));
      // Os tamanhos vêm de `CONJUNTOS.matriz`, que é onde os valores da tela
      // moram. Estavam escritos à mão aqui, e o primeiro bloco ficou em 18
      // depois que `encarregados.ts` já o tinha baixado para 12: a fixtura
      // passou a certificar uma folha que a tela não imprime mais.
      const matrizDoConjunto = CONJUNTOS.matriz!;
      const fragmentos = blocosDeImpressao(
        linhas.length,
        matrizDoConjunto.fragmentoAtual,
        matrizDoConjunto.fragmentoPrimeiro ?? matrizDoConjunto.fragmentoAtual,
      )
        .map(([inicio, fim]) =>
          tabela(colunas, linhas.slice(inicio, fim), "Nada.", { listagem: true }).replace(
            '<div class="table-wrap"',
            '<div class="table-wrap tabela-impressao-fragmento"',
          ),
        )
        .join("");
      return painel(
        cabecalho("Designações por Policial Militar", "Escopo do filtro.") +
          `<div class="somente-impressao matriz-designacoes--impressao">
            <h2>Designações por Policial Militar e espécie</h2>
            <div class="tabela-impressao-fragmentada">${fragmentos}</div>
          </div>`,
      );
    })(),
  });

  // ── O gráfico no papel ───────────────────────────────────────────────
  //
  // Nenhuma fixtura tinha `<canvas>` — `grep -c canvas fixturas/*.html` dava
  // zero em todas —, e foi por isso que a rodada 30 calibrou nove tamanhos de
  // bloco sem nunca imprimir um gráfico. Esta põe as duas formas na mesma
  // folha: o canvas pintado por script e o PNG que `toDataURL()` tira dele. A
  // pergunta é qual das duas o WebKitGTK pinta, e quem responde é a
  // rasterização (`conferir.py --imagens`), não asserção de texto.
  lista.push({
    nome: "medicao-grafico-canvas",
    orientacao: "paisagem",
    perfil: "analitico",
    medicao: true,
    proposito: "o WebKitGTK pinta <canvas> no papel? e o PNG que sai dele?",
    corpo: painel(
      cabecalho("Gráfico no papel", "Canvas e PNG do mesmo desenho, lado a lado.") +
        `<div class="analytics-grid">${cartaoDeGrafico(
          "Canvas — o que o aplicativo imprime hoje",
          "",
          300,
          `<canvas data-desenho="a" width="1920" height="600" role="img" aria-label="Barras de controle"></canvas>`,
        )}${cartaoDeGrafico(
          "PNG do mesmo canvas — a correção proposta",
          "",
          300,
          `<img data-espelho="a" alt="Barras de controle" style="width:100%;height:100%" />`,
        )}</div>${DESENHO_DE_TESTE}`,
    ),
    compositing: true,
  });

  // As duas estratégias de troca, com o canvas composto **antes** de sair de
  // cena — a sequência do aplicativo. Esconder por `hidden` não basta: a camada
  // já existe, e o motor a imprime assim mesmo, de preto, ao lado do PNG certo.
  // Medido no PDF real de Estatísticas: cada gráfico saía como duas imagens do
  // mesmo tamanho, a boa com `smask` e a chapada sem.
  for (const [estrategia, nome, assere] of [
    ["oculto", "medicao-grafico-oculto", false],
    ["removido", "calibrado-grafico-removido", true],
  ] as const) {
    lista.push({
      nome,
      orientacao: "paisagem",
      perfil: "analitico",
      medicao: !assere,
      compositing: true,
      semFaixaPreta: assere,
      proposito:
        estrategia === "removido"
          ? "tirar o canvas do DOM antes de imprimir apaga a camada — graficos/index.ts"
          : "esconder o canvas com `hidden` NÃO apaga a camada composta",
      corpo: painel(
        cabecalho("Gráfico no papel", `O canvas é composto e depois ${estrategia}.`) +
          `<div class="analytics-grid">${cartaoDeGrafico(
            "Carga de trabalho por policial militar",
            "Concluídos, em andamento no prazo e vencidos, no escopo do filtro.",
            300,
            `<canvas data-desenho="c" width="1920" height="600" role="img" aria-label="Carga de trabalho por policial militar"></canvas>`,
          )}</div>${trocaPeloPng(estrategia)}`,
      ),
      ...(assere ? { paginasMaximas: 1 } : {}),
    });
  }

  // Designações por Policial Militar **como sai hoje**: título, faixa de KPIs, o cartão
  // indivisível de 532px (11 militares × 42px + 70) e só então a matriz. Mede
  // em que folha cada coisa cai — a folha 1 fica com título e KPIs sobre o
  // resto em branco, e é isso que a `calibrado-*` do mesmo par vem corrigir.
  const matriz = CONJUNTOS.matriz!;
  const kpisDeDesignacoes = `<div class="analytics-kpis">${[
    kpiAnalitico(11, "POLICIAIS MILITARES DESIGNADOS"),
    kpiAnalitico(20, "Apuratórios no escopo"),
    kpiAnalitico(5, "Concluídos", { tom: "sucesso" }),
    kpiAnalitico(1, "Em andamento vencidos", {
      tom: "alerta",
      detalhe: "Requer atenção imediata",
    }),
  ].join("")}</div>`;
  // A altura real do cartão de carga: `min(700, max(250, n * 42 + 70))` de
  // `graficos/index.ts::graficoCarga`, com os 11 militares do caso relatado.
  const cartaoDeCarga = (caixa: string) =>
    `<div class="analytics-grid">${cartaoDeGrafico(
      "Carga de trabalho por policial militar",
      "Concluídos, em andamento no prazo e vencidos, no escopo do filtro.",
      532,
      caixa,
    )}</div>`;
  const matrizDoPapel = (primeiro: number) =>
    `<div class="somente-impressao matriz-designacoes--impressao">
      <h2>Designações por Policial Militar e espécie</h2>
      <p class="hint">Combinações com quantidade zero foram omitidas; os totais preservam o escopo do filtro.</p>
      ${tabelaFragmentada(matriz, 120, matriz.fragmentoAtual, 0, "", primeiro)}
    </div>`;
  const cabecalhoDeDesignacoes = cabecalho(
    "Designações por Policial Militar",
    "Carga de trabalho por policial militar e por espécie, na situação de hoje.",
  );
  // Post-correção o canvas é composto, desenhado e **removido** do DOM antes de
  // imprimir, exatamente como `congelarGraficosParaImpressao` faz. Reproduzir a
  // sequência, e não só o resultado, é o que faz a fixtura valer: um canvas que
  // nasce oculto nunca ganha camada de composição e aprova o que o PDF reprova.
  const graficoDaCarga = () =>
    cartaoDeCarga(
      `<canvas data-desenho="b" width="1920" height="1064" role="img" aria-label="Carga de trabalho por policial militar"></canvas>`,
    );
  // Antes: o cartão entre os KPIs e a matriz. Duas folhas se vão antes da
  // primeira linha — a segunda fica só com o `h2`, porque o gráfico transborda
  // da primeira e o bloco de 18 linhas já não cabe no que sobra dela.
  lista.push({
    nome: "medicao-designacoes-folha1",
    orientacao: "paisagem",
    perfil: "analitico",
    medicao: true,
    compositing: true,
    proposito: "onde cai cada bloco de Designações com o cartão entre os KPIs e a matriz",
    // "MILITAR", da primeira coluna, também está dentro de "MILITARES
    // DESIGNADOS" — o rótulo do primeiro KPI. O contador de cabeçalhos por
    // folha casa substring, e mediria dois onde há um.
    rotuloCabecalho: "QUANTIDADE",
    corpo: painel(
      cabecalhoDeDesignacoes +
        kpisDeDesignacoes +
        cartaoDeCarga(
          `<canvas data-desenho="b" width="1920" height="1064" role="img" aria-label="Carga de trabalho por policial militar"></canvas>`,
        ) +
        matrizDoPapel(matriz.fragmentoPrimeiro ?? matriz.fragmentoAtual) +
        DESENHO_DE_TESTE,
    ),
    marcadores: 120,
  });

  // Depois: a matriz logo abaixo dos KPIs e o cartão no fim, que é o que
  // `data-impressao-ao-fim` produz. A asserção é o par título × primeira linha:
  // se a folha 1 voltar a ficar só com título e KPIs, ele quebra.
  lista.push({
    nome: "calibrado-designacoes-folha1",
    orientacao: "paisagem",
    perfil: "analitico",
    compositing: true,
    semFaixaPreta: true,
    proposito: `matriz na folha 1 e cartão no fim, primeiro bloco de ${matriz.fragmentoPrimeiro} — src/telas/encarregados.ts`,
    rotuloCabecalho: "QUANTIDADE",
    corpo: painel(
      cabecalhoDeDesignacoes +
        kpisDeDesignacoes +
        matrizDoPapel(matriz.fragmentoPrimeiro ?? matriz.fragmentoAtual) +
        graficoDaCarga() +
        trocaPeloPng("removido"),
    ),
    marcadores: 120,
    textosNaMesmaPagina: [["Designações por Policial Militar", "L0001"]],
  });

  // O `.stat-panel` também é indivisível no papel, e é onde moram os painéis de
  // contagem do detalhe de usuário e a tabela de vencidos do Painel. Mesma
  // pergunta dos cartões: fragmentar dentro dele ajuda ou atrapalha?
  for (const [sufixo, conteudo] of [
    ["fragmentado", tabelaFragmentada(contagem, 40, 20, 500)],
    [
      "inteiro",
      tabela(
        contagem.colunas,
        Array.from({ length: 40 }, (_, k) => comMarcadores(contagem.linha(500 + k), 500 + k)),
        "Nada.",
        { listagem: true },
      ),
    ],
  ] as const) {
    lista.push({
      nome: `stat-panel-${sufixo}`,
      orientacao: "retrato",
      medicao: sufixo === "fragmentado",
      proposito:
        sufixo === "fragmentado"
          ? "por que `painelContagem` não fragmenta: uma folha a mais, a mesma linha partida"
          : "como o detalhe de usuário imprime: painel indivisível, tabela inteira",
      corpo: painel(
        cabecalho("Detalhe do policial militar", "Painéis de contagem.") +
          `<div class="stat-grid">${[0, 1, 2]
            .map((n) => `<section class="stat-panel"><h2>Painel ${n + 1}</h2>${conteudo}</section>`)
            .join("")}</div>`,
      ),
      // Os três painéis repetem as mesmas 14 linhas: o marcador é o mesmo, e o
      // que se confere aqui é a integridade da linha, não a contagem.
      marcadores: 0,
    });
  }

  // Controle do Mapa Mensal: documento próprio, fora do helper e dos perfis.
  lista.push({
    nome: "mapa-mensal-controle",
    orientacao: "paisagem",
    documentoProprio: true,
    proposito: "regressão do Mapa Mensal — tem de sair idêntico ao CSS anterior",
    corpo: `<div class="mapa-pdf-root">${renderDocumentoMapa(
      Array.from({ length: 3 }, (_, i) => itemDoMapa(i)),
      { mes: "Fevereiro", ano: "2026", periodoInicio: "2026-02-01", periodoFim: "2026-02-28", geradoEm: new Date("2026-03-01T12:00:00Z") } as any,
    )}</div>`,
  });

  return lista;
}

// ── Execução ──────────────────────────────────────────────────────────

function cssCompilado(argumento?: string): string {
  if (argumento) return `file://${resolve(argumento)}`;
  const pasta = join(RAIZ, "dist", "assets");
  const arquivo = readdirSync(pasta).find((n) => n.startsWith("index-") && n.endsWith(".css"));
  if (!arquivo) throw new Error("CSS compilado não encontrado — rode `npm run build` antes.");
  return `file://${join(pasta, arquivo)}`;
}

const argumentos = new Map(
  process.argv.slice(2).map((a) => {
    const [chave, valor] = a.replace(/^--/, "").split("=");
    return [chave, valor ?? ""] as const;
  }),
);

// Calibrar é varrer valores: `--fragmento=auditoria:8,prazos:16` sobrescreve o
// que os conjuntos declaram, sem editar arquivo a cada tentativa.
for (const par of (argumentos.get("fragmento") || "").split(",").filter(Boolean)) {
  const [nome, valor, primeiro] = par.split(":");
  const conjunto = CONJUNTOS[nome ?? ""];
  if (!conjunto) throw new Error(`conjunto desconhecido em --fragmento: ${nome}`);
  conjunto.fragmentoAtual = Number(valor);
  // A terceira parte é o primeiro bloco: `--fragmento=matriz:22:14`. Só a
  // matriz de Designações divide a folha 1 com título, KPIs e `h2`, e é o
  // único valor que não se deduz do tamanho dos demais blocos.
  if (primeiro) conjunto.fragmentoPrimeiro = Number(primeiro);
}

const css = cssCompilado(argumentos.get("css"));
const saida = resolve(argumentos.get("saida") || join(RAIZ, "tools/impressao/fixturas"));
rmSync(saida, { recursive: true, force: true });
mkdirSync(saida, { recursive: true });

const fixturas = catalogo();
for (const fixtura of fixturas) {
  writeFileSync(join(saida, `${fixtura.nome}.html`), pagina(fixtura, css), "utf8");
}
writeFileSync(
  join(saida, "manifesto.json"),
  JSON.stringify(
    {
      css,
      fixturas: fixturas.map((f) => ({
        nome: f.nome,
        arquivo: `${f.nome}.html`,
        orientacao: f.orientacao,
        perfil: f.documentoProprio ? "mapa" : (f.perfil ?? "tabular"),
        documentoProprio: f.documentoProprio ?? false,
        proposito: f.proposito,
        marcadores: f.marcadores ?? 0,
        rotuloCabecalho: f.rotuloCabecalho ?? null,
        medicao: f.medicao ?? false,
        textosObrigatorios: f.textosObrigatorios ?? [],
        textosProibidos: f.textosProibidos ?? [],
        textosNaMesmaPagina: f.textosNaMesmaPagina ?? [],
        semSobreposicao: f.semSobreposicao ?? false,
        paginasMaximas: f.paginasMaximas ?? null,
        compositing: f.compositing ?? false,
        semFaixaPreta: f.semFaixaPreta ?? false,
      })),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`${fixturas.length} fixturas em ${saida}`);
console.log(`CSS: ${css}`);
