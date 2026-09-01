import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartOptions,
  type ChartType,
  type TooltipModel,
} from "chart.js";

import {
  baldesComDado,
  CORES,
  corDaClassificacao,
  denominadorPercentual,
  limitarRanking,
  ordenarAnos,
  percentual,
  quebrarRotulo,
  totalDe,
  type BasePercentual,
  type ContagemGrafico,
  type FaixaPrazo,
  type SituacaoContagem,
  type SituacaoGrafico,
} from "./dados";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

export type ModoAnalitico = "grafico" | "tabela";

type ConfiguracaoGrafico =
  | ChartConfiguration<"bar">
  | ChartConfiguration<"line">
  | ChartConfiguration<"doughnut">;

export type GraficoSpec = {
  chave: string;
  configuracao: ConfiguracaoGrafico;
  rotulosCompletos: string[];
  detalhes?: string[];
  altura?: number;
  alturaImpressao?: number;
  /**
   * Total do conjunto **antes** de qualquer recorte de exibição. Sem ele, o
   * percentual de um ranking limitado ao Top 12 dividiria pela soma dos doze
   * plotados, e todo mundo apareceria maior do que é.
   */
  totalReal?: number;
  /** Sobre o que o percentual do tooltip fala, e como nomeá-lo ali. */
  percentual?: { base: BasePercentual; rotulo: string };
};

export type CartaoAnalitico = {
  id: string;
  titulo: string;
  descricao?: string;
  grafico: GraficoSpec;
  tabela: string;
  vazio?: string;
  limitado?: boolean;
  classe?: string;
};

export function kpiAnalitico(
  valor: number | string,
  rotulo: string,
  opcoes: { tom?: "neutro" | "andamento" | "sucesso" | "alerta"; detalhe?: string } = {},
): string {
  const tom = opcoes.tom ?? "neutro";
  const detalhe = opcoes.detalhe
    ? `<small class="analytics-kpi__detail">${escapeHtml(opcoes.detalhe)}</small>`
    : "";
  return `<article class="analytics-kpi analytics-kpi--${tom}">
    <span class="analytics-kpi__eyebrow"><i aria-hidden="true"></i>${escapeHtml(rotulo)}</span>
    <strong>${escapeHtml(valor)}</strong>${detalhe}
  </article>`;
}

type MetadadosTooltip = Pick<
  GraficoSpec,
  "rotulosCompletos" | "detalhes" | "totalReal" | "percentual"
>;

type OpcoesBase = ChartOptions<"bar"> & {
  plugins: { legend: { display: boolean } };
  scales: {
    x: { stacked: boolean; max?: number };
    y: {
      stacked: boolean;
      grid: { display: boolean };
      ticks: { display?: boolean };
    };
  };
};

/** Altura da caixa quando o gráfico não pede uma sua. */
const ALTURA_PADRAO = 310;

const graficos = new Map<string, { instancia: Chart; spec: GraficoSpec }>();
const metadados = new WeakMap<Chart, MetadadosTooltip>();
const CHAVE_PREFERENCIA = "adm-p6:visualizacao:";

function escapeHtml(valor: unknown): string {
  return String(valor ?? "").replace(
    /[&<>"']/g,
    (caractere) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
        caractere
      ] ?? caractere,
  );
}

function preferencia(id: string): ModoAnalitico {
  try {
    return localStorage.getItem(`${CHAVE_PREFERENCIA}${id}`) === "tabela" ? "tabela" : "grafico";
  } catch {
    return "grafico";
  }
}

function salvarPreferencia(id: string, modo: ModoAnalitico): void {
  try {
    localStorage.setItem(`${CHAVE_PREFERENCIA}${id}`, modo);
  } catch {
    // Preferência visual não pode impedir o relatório de abrir.
  }
}

function temDados(spec: GraficoSpec): boolean {
  return spec.configuracao.data.datasets.some((dataset) =>
    dataset.data.some((valor) => typeof valor === "number" && valor > 0),
  );
}

export function cartaoAnalitico(config: CartaoAnalitico): string {
  const vazio = !temDados(config.grafico);
  const modo = preferencia(config.id);
  const descricao = config.descricao
    ? `<p class="analytics-card__description">${escapeHtml(config.descricao)}</p>`
    : "";
  const nota = config.limitado
    ? `<span class="analytics-card__note">Top 12 no gráfico · tabela completa</span>`
    : "";
  if (vazio) {
    return `<section class="analytics-card analytics-card--empty ${escapeHtml(config.classe ?? "")}">
      <header class="analytics-card__header"><div><h2>${escapeHtml(config.titulo)}</h2>${descricao}</div></header>
      <div class="analytics-empty" role="status">
        <span class="analytics-empty__mark" aria-hidden="true"></span>
        <strong>${escapeHtml(config.vazio ?? "Nada registrado neste escopo")}</strong>
        <span>Ajuste os filtros ou consulte outro período.</span>
      </div>
    </section>`;
  }
  return `<section class="analytics-card ${escapeHtml(config.classe ?? "")}" data-analytics-card="${escapeHtml(config.id)}" data-chart-key="${escapeHtml(config.grafico.chave)}">
    <header class="analytics-card__header">
      <div><h2>${escapeHtml(config.titulo)}</h2>${descricao}</div>
      <div class="analytics-card__tools">
        ${nota}
        <div class="analytics-toggle" role="group" aria-label="Visualização de ${escapeHtml(config.titulo)}">
          <button type="button" class="analytics-toggle__button" data-analytics-mode="grafico" aria-pressed="${String(modo === "grafico")}" aria-controls="${escapeHtml(config.id)}-grafico">Gráfico</button>
          <button type="button" class="analytics-toggle__button" data-analytics-mode="tabela" aria-pressed="${String(modo === "tabela")}" aria-controls="${escapeHtml(config.id)}-tabela">Tabela</button>
        </div>
      </div>
    </header>
    <div class="analytics-view analytics-view--chart" id="${escapeHtml(config.id)}-grafico" data-analytics-view="grafico"${modo === "tabela" ? " hidden" : ""}>
      <div class="analytics-chart"><canvas role="img" aria-label="${escapeHtml(config.titulo)}"></canvas></div>
    </div>
    <div class="analytics-view analytics-view--table" id="${escapeHtml(config.id)}-tabela" data-analytics-view="tabela"${modo === "grafico" ? " hidden" : ""}>${config.tabela}</div>
  </section>`;
}

function elementoTooltip(chart: Chart): HTMLDivElement {
  const pai = chart.canvas.parentElement!;
  let elemento = pai.querySelector<HTMLDivElement>(":scope > .analytics-tooltip");
  if (!elemento) {
    elemento = document.createElement("div");
    elemento.className = "analytics-tooltip";
    elemento.setAttribute("role", "tooltip");
    pai.append(elemento);
  }
  return elemento;
}

function numeroDoTooltip(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (valor && typeof valor === "object") {
    const ponto = valor as { x?: unknown; y?: unknown };
    if (typeof ponto.x === "number") return ponto.x;
    if (typeof ponto.y === "number") return ponto.y;
  }
  return 0;
}

function tooltipExterno<Tipo extends ChartType>(contexto: {
  chart: Chart;
  tooltip: TooltipModel<Tipo>;
}): void {
  const { chart, tooltip } = contexto;
  const elemento = elementoTooltip(chart);
  if (!tooltip.opacity || !tooltip.dataPoints.length) {
    elemento.classList.remove("is-visible");
    return;
  }
  const meta = metadados.get(chart);
  const indice = tooltip.dataPoints[0]?.dataIndex ?? 0;
  const titulo = meta?.rotulosCompletos[indice] ?? tooltip.title[0] ?? "";
  elemento.replaceChildren();
  const cabecalho = document.createElement("strong");
  cabecalho.textContent = titulo;
  elemento.append(cabecalho);

  const somaPlotada = chart.data.datasets.reduce(
    (soma, dataset) => soma + dataset.data.reduce<number>((acc, valor) => acc + numeroDoTooltip(valor), 0),
    0,
  );
  const base = meta?.percentual?.base ?? "total";
  const rotuloBase = meta?.percentual?.rotulo ?? "do total";
  const denominador = denominadorPercentual(
    base,
    chart.data.datasets.map((dataset) => numeroDoTooltip(dataset.data[indice])),
    meta?.totalReal,
    somaPlotada,
  );
  const lista = document.createElement("div");
  lista.className = "analytics-tooltip__rows";
  for (const ponto of tooltip.dataPoints) {
    const linha = document.createElement("span");
    const valor = numeroDoTooltip(ponto.raw);
    const rotuloSerie = chart.data.datasets[ponto.datasetIndex]?.label;
    const serie = rotuloSerie ? `${rotuloSerie}: ` : "";
    const parte = percentual(valor, denominador).toLocaleString("pt-BR");
    linha.textContent = `${serie}${valor.toLocaleString("pt-BR")} (${parte}% ${rotuloBase})`;
    lista.append(linha);
  }
  elemento.append(lista);
  const detalhe = meta?.detalhes?.[indice];
  if (detalhe) {
    const texto = document.createElement("small");
    texto.textContent = detalhe;
    elemento.append(texto);
  }
  elemento.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
  elemento.style.top = `${chart.canvas.offsetTop + tooltip.caretY}px`;
  elemento.classList.add("is-visible");
}

function opcoesComuns(horizontal = false): OpcoesBase {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? false
      : { duration: 350 },
    interaction: { mode: "index" as const, intersect: false },
    layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: { color: "#607084", usePointStyle: true, pointStyle: "circle" as const, boxWidth: 8 },
      },
      tooltip: { enabled: false, external: tooltipExterno },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: "rgba(96,112,132,.14)" },
        ticks: { color: "#607084", precision: 0 },
        stacked: false,
      },
      y: {
        beginAtZero: true,
        grid: { display: !horizontal, color: "rgba(96,112,132,.10)" },
        ticks: { color: "#33475b", precision: 0, autoSkip: false },
        stacked: false,
      },
    },
  } as OpcoesBase;
}

export function graficoBarras(
  chave: string,
  itensOriginais: readonly ContagemGrafico[],
  opcoes: {
    serie?: string;
    horizontal?: boolean;
    cores?: string[];
    detalhes?: string[];
    limitar?: boolean;
    rotuloPercentual?: string;
  } = {},
): GraficoSpec {
  const horizontal = opcoes.horizontal ?? true;
  const itens = opcoes.limitar ? limitarRanking(itensOriginais) : [...itensOriginais];
  const rotulos = itens.map((item) => item.rotulo);
  const base = opcoesComuns(horizontal);
  base.plugins.legend.display = false;
  return {
    chave,
    rotulosCompletos: rotulos,
    detalhes: opcoes.detalhes?.slice(0, itens.length),
    // Do conjunto **original**: o percentual de um Top 12 dividido pela soma
    // dos doze plotados infla todo mundo, e em silêncio.
    totalReal: totalDe(itensOriginais),
    percentual: { base: "total", rotulo: opcoes.rotuloPercentual ?? "do total" },
    // 42px por barra é o que separa três linhas de rótulo sem elas se
    // encavalarem. No papel vale o mesmo espaçamento — comprimir a caixa só
    // para caber "mais bonito" fazia o primeiro rótulo cair em cima do
    // segundo. O teto de 700px (≈185mm) é a altura útil de uma A4 paisagem.
    altura: horizontal ? Math.max(250, itens.length * 42 + 70) : 310,
    alturaImpressao: horizontal
      ? Math.min(700, Math.max(250, itens.length * 42 + 70))
      : 330,
    configuracao: {
      type: "bar",
      data: {
        labels: horizontal ? rotulos.map((rotulo) => quebrarRotulo(rotulo)) : rotulos,
        datasets: [
          {
            label: opcoes.serie ?? "Quantidade",
            data: itens.map((item) => item.total),
            backgroundColor: opcoes.cores?.slice(0, itens.length) ?? CORES.brand,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 30,
          },
        ],
      },
      options: { ...base, indexAxis: horizontal ? "y" : "x" },
    },
  };
}

export function graficoSituacao(chave: string, itens: readonly SituacaoGrafico[]): GraficoSpec {
  const base = opcoesComuns(false);
  base.scales.x.stacked = true;
  base.scales.y.stacked = true;
  return {
    chave,
    rotulosCompletos: itens.map((item) => `${item.sigla} — ${item.nome}`),
    detalhes: itens.map((item) => item.tipo),
    percentual: { base: "categoria", rotulo: "do apuratório" },
    altura: 350,
    alturaImpressao: 360,
    configuracao: {
      type: "bar",
      data: {
        labels: itens.map((item) => item.sigla),
        datasets: [
          {
            label: "Em andamento",
            data: itens.map((item) => item.emAndamento),
            backgroundColor: CORES.warning,
            borderRadius: 4,
          },
          {
            label: "Concluídos",
            data: itens.map((item) => item.concluidos),
            backgroundColor: CORES.success,
            borderRadius: 4,
          },
        ],
      },
      options: { ...base, indexAxis: "y" },
    },
  };
}

/**
 * Carga de trabalho empilhada: uma barra por categoria, um segmento por balde.
 *
 * Difere de `graficoSituacao` por não ser fixo em duas séries — os baldes que
 * entram são os que têm dado (`baldesComDado`), então uma legenda nunca traz
 * "Sem prazo definido" quando ninguém está nesse estado.
 *
 * O percentual do tooltip é `categoria`: num empilhado, o que interessa é
 * quanto aquele segmento é **da barra** — 3 vencidos de 8 do militar, não 3 de
 * todo o relatório.
 */
export function graficoCarga(
  chave: string,
  itensOriginais: readonly (SituacaoContagem & { rotulo: string })[],
  opcoes: { limitar?: boolean; rotuloPercentual?: string } = {},
): GraficoSpec {
  const itens = opcoes.limitar ? limitarRanking(itensOriginais) : [...itensOriginais];
  const rotulos = itens.map((item) => item.rotulo);
  const baldes = baldesComDado(itens);
  const base = opcoesComuns(true);
  base.plugins.legend.display = true;
  base.scales.x.stacked = true;
  base.scales.y.stacked = true;
  return {
    chave,
    rotulosCompletos: rotulos,
    percentual: { base: "categoria", rotulo: opcoes.rotuloPercentual ?? "da carga" },
    // Mesmos 42px por barra do ranking, pela mesma razão: é o que separa três
    // linhas de rótulo sem elas se encavalarem, na tela e no papel.
    altura: Math.max(250, itens.length * 42 + 70),
    alturaImpressao: Math.min(700, Math.max(250, itens.length * 42 + 70)),
    configuracao: {
      type: "bar",
      data: {
        labels: rotulos.map((rotulo) => quebrarRotulo(rotulo)),
        datasets: baldes.map((balde) => ({
          label: balde.rotulo,
          data: itens.map((item) => item[balde.chave]),
          backgroundColor: balde.cor,
          borderRadius: 4,
          maxBarThickness: 30,
        })),
      },
      options: { ...base, indexAxis: "y" },
    },
  };
}

export function graficoLinha(chave: string, itensOriginais: readonly ContagemGrafico[]): GraficoSpec {
  const itens = ordenarAnos(itensOriginais);
  const base = opcoesComuns(false);
  base.plugins.legend.display = false;
  return {
    chave,
    rotulosCompletos: itens.map((item) => item.rotulo),
    totalReal: totalDe(itens),
    percentual: { base: "total", rotulo: "do período" },
    altura: 310,
    alturaImpressao: 330,
    configuracao: {
      type: "line",
      data: {
        labels: itens.map((item) => item.rotulo),
        datasets: [
          {
            label: "Instaurações",
            data: itens.map((item) => item.total),
            borderColor: CORES.brand,
            backgroundColor: "rgba(23,96,95,.15)",
            pointBackgroundColor: CORES.gold,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.32,
            fill: true,
          },
        ],
      },
      options: base as unknown as ChartOptions<"line">,
    },
  };
}

export function graficoDonut(chave: string, itens: readonly ContagemGrafico[]): GraficoSpec {
  return {
    chave,
    rotulosCompletos: itens.map((item) => item.rotulo),
    totalReal: totalDe(itens),
    percentual: { base: "total", rotulo: "do total" },
    altura: 310,
    alturaImpressao: 320,
    configuracao: {
      type: "doughnut",
      data: {
        labels: itens.map((item) => item.rotulo),
        datasets: [
          {
            label: "Quantidade",
            data: itens.map((item) => item.total),
            backgroundColor: [CORES.brand, CORES.gold, CORES.navy, CORES.violet, CORES.brandLight, CORES.navyLight],
            borderColor: "#fff",
            borderWidth: 3,
            hoverOffset: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "64%",
        animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 350 },
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#607084", usePointStyle: true, pointStyle: "circle", boxWidth: 8 },
          },
          tooltip: { enabled: false, external: tooltipExterno },
        },
      },
    },
  };
}

export function graficoPrazos(chave: string, faixas: readonly FaixaPrazo[]): GraficoSpec {
  const total = faixas.reduce((soma, faixa) => soma + faixa.total, 0);
  const base = opcoesComuns(true);
  base.plugins.legend.display = true;
  base.scales.x.stacked = true;
  base.scales.y.stacked = true;
  base.scales.x.max = Math.max(1, total);
  base.scales.y.grid.display = false;
  base.scales.y.ticks.display = false;
  return {
    chave,
    rotulosCompletos: ["Prazos vigentes"],
    percentual: { base: "categoria", rotulo: "dos prazos" },
    altura: 180,
    alturaImpressao: 210,
    configuracao: {
      type: "bar",
      data: {
        labels: ["Prazos vigentes"],
        datasets: faixas.map((faixa) => ({
          label: faixa.rotulo,
          data: [faixa.total],
          backgroundColor: faixa.cor,
          borderRadius: 7,
          borderSkipped: false,
          barThickness: 34,
        })),
      },
      options: { ...base, indexAxis: "y" },
    },
  };
}

export function graficoEnquadramentos(
  chave: string,
  itens: readonly (ContagemGrafico & { classificacao?: string | null; descricao?: string })[],
): GraficoSpec {
  return graficoBarras(chave, itens, {
    horizontal: true,
    limitar: true,
    cores: limitarRanking(itens).map((item) => corDaClassificacao(item.classificacao)),
    detalhes: limitarRanking(itens).map((item) =>
      [item.classificacao, item.descricao].filter(Boolean).join(" · "),
    ),
  });
}

function montarGrafico(card: HTMLElement, spec: GraficoSpec): void {
  if (graficos.has(spec.chave)) {
    graficos.get(spec.chave)?.instancia.resize();
    return;
  }
  const canvas = card.querySelector<HTMLCanvasElement>("canvas");
  const container = card.querySelector<HTMLElement>(".analytics-chart");
  if (!canvas || !container) return;
  container.style.height = `${spec.altura ?? ALTURA_PADRAO}px`;
  const instancia = new Chart(canvas, spec.configuracao as ChartConfiguration);
  metadados.set(instancia, {
    rotulosCompletos: spec.rotulosCompletos,
    detalhes: spec.detalhes,
    totalReal: spec.totalReal,
    percentual: spec.percentual,
  });
  graficos.set(spec.chave, { instancia, spec });
}

function definirModo(card: HTMLElement, modo: ModoAnalitico, spec: GraficoSpec): void {
  card.querySelectorAll<HTMLElement>("[data-analytics-view]").forEach((painel) => {
    painel.hidden = painel.dataset.analyticsView !== modo;
  });
  // `aria-pressed` num grupo de botões, e não `role="tab"`: o alternador tinha
  // semântica de aba pela metade — sem `tabpanel` e, pior, com *roving
  // tabindex* sem tratador de setas, o que deixava o botão não selecionado
  // fora da ordem de Tab. Botão alternável o navegador já opera sozinho.
  card.querySelectorAll<HTMLButtonElement>("[data-analytics-mode]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.analyticsMode === modo));
  });
  if (modo === "grafico") requestAnimationFrame(() => montarGrafico(card, spec));
}

export function montarCartoesAnaliticos(specs: readonly GraficoSpec[], raiz: ParentNode = document): void {
  const porChave = new Map(specs.map((spec) => [spec.chave, spec]));
  raiz.querySelectorAll<HTMLElement>("[data-analytics-card]").forEach((card) => {
    const spec = porChave.get(card.dataset.chartKey ?? "");
    if (!spec) return;
    const id = card.dataset.analyticsCard!;
    const inicial = preferencia(id);
    definirModo(card, inicial, spec);
    card.querySelectorAll<HTMLButtonElement>("[data-analytics-mode]").forEach((botao) => {
      botao.addEventListener("click", () => {
        const modo = botao.dataset.analyticsMode as ModoAnalitico;
        salvarPreferencia(id, modo);
        definirModo(card, modo, spec);
      });
    });
  });
}

export function destruirGraficos(): void {
  for (const { instancia } of graficos.values()) instancia.destroy();
  graficos.clear();
}

/**
 * Largura da caixa do gráfico no papel, em px.
 *
 * `px` é unidade absoluta na impressão (1/96 pol), então fixar a caixa em px
 * faz a geometria medida **na tela** valer para a folha. É o que torna a
 * preparação possível: canvas é bitmap, e a largura útil do papel só existe
 * depois que a impressão começou — tarde demais para medir.
 *
 * 960px ≈ 254mm. Cabe na área útil de um A4 paisagem (297mm) descontando as
 * margens do page setup, o `padding` do `.panel` (`clamp(18px, 2vw, 28px)`) e
 * os 12px do cartão no `@media print`, com folga para o papel que o GTK
 * escolher.
 */
const LARGURA_IMPRESSAO = 960;

/** Densidade do bitmap no papel: os 96 dpi da tela saem borrados impressos. */
const DENSIDADE_IMPRESSAO = 2;

/**
 * Muda a caixa e redimensiona o gráfico por ela, garantindo que seja agora.
 *
 * A ordem aqui não é decorativa. `Chart.resize()` **adia** o pedido quando há
 * animação em curso, e quem o aplica é o `draw()` seguinte — com as medidas
 * guardadas, não com as atuais. Um pedido do `ResizeObserver` podia estar
 * pendente desde a montagem: mudar a caixa e chamar `resize()` fazia o gráfico
 * ir para a medida certa e voltar para a antiga no mesmo quadro, e quatro dos
 * nove saíam impressos com o bitmap de meia coluna esticado até a folha.
 *
 * Então: `stop()` encerra a animação (senão o `resize()` novo também é
 * adiado), `draw()` consome a pendência enquanto ela ainda é inofensiva — as
 * medidas guardadas são as que estão valendo —, e só aí a caixa muda. O
 * `resize()` final é síncrono: a transição `resize` tem duração zero.
 */
function pararEredimensionar(instancia: Chart, redimensionarCaixa: () => void): void {
  instancia.stop();
  instancia.draw();
  redimensionarCaixa();
  instancia.resize();
}

/**
 * Dá ao gráfico a geometria da folha antes de a folha existir.
 *
 * Quem é redimensionado é a **caixa**, não o gráfico. `instancia.resize(l, a)`
 * mexia só no bitmap, e como `.analytics-chart canvas` fixa `width`/`height` em
 * `100% !important` — é isso que faz o canvas seguir a caixa —, a caixa
 * renderizada não acompanhava: o desenho saía esticado no papel, 4,8% na
 * horizontal e 17,6% na vertical. Dimensionando a caixa e chamando `resize()`
 * sem medidas, o Chart.js relê o container e bitmap e caixa voltam a coincidir.
 */
export function prepararGraficosParaImpressao(): void {
  for (const { instancia, spec } of graficos.values()) {
    if (instancia.canvas.closest<HTMLElement>("[data-analytics-view]")?.hidden) continue;
    const caixa = instancia.canvas.parentElement;
    if (!caixa) continue;
    instancia.options.devicePixelRatio = Math.max(
      DENSIDADE_IMPRESSAO,
      window.devicePixelRatio || 1,
    );
    pararEredimensionar(instancia, () => {
      caixa.style.width = `${LARGURA_IMPRESSAO}px`;
      caixa.style.height = `${spec.alturaImpressao ?? spec.altura ?? ALTURA_PADRAO}px`;
    });
  }
}

export function restaurarGraficosDepoisDaImpressao(): void {
  for (const { instancia, spec } of graficos.values()) {
    const caixa = instancia.canvas.parentElement;
    instancia.options.devicePixelRatio = window.devicePixelRatio || 1;
    pararEredimensionar(instancia, () => {
      if (!caixa) return;
      caixa.style.width = "";
      caixa.style.height = `${spec.altura ?? ALTURA_PADRAO}px`;
    });
  }
}

export { baldesComDado, BALDES_SITUACAO, CORES, totalDaSituacao, totalDe } from "./dados";
export type { BaldeSituacao, SituacaoContagem } from "./dados";
