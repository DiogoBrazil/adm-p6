export type ContagemGrafico = {
  rotulo: string;
  total: number;
};

export type SituacaoGrafico = {
  sigla: string;
  nome: string;
  tipo: string;
  emAndamento: number;
  concluidos: number;
};

export type FaixaPrazo = {
  rotulo: "Vencidos" | "A vencer" | "Regulares";
  total: number;
  cor: string;
};

export const CORES = {
  brand: "#17605f",
  brandLight: "#4f9b8d",
  navy: "#17455f",
  navyLight: "#5c89a0",
  gold: "#bd8b18",
  success: "#18794e",
  warning: "#d69e1d",
  danger: "#c73d32",
  muted: "#a9b6c2",
  violet: "#74569c",
} as const;

export function percentual(parte: number, total: number): number {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

export function limitarRanking<T>(itens: readonly T[], limite = 12): T[] {
  return itens.slice(0, Math.max(0, limite));
}

export function ordenarContagens(itens: readonly ContagemGrafico[]): ContagemGrafico[] {
  return [...itens].sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export function ordenarAnos(itens: readonly ContagemGrafico[]): ContagemGrafico[] {
  return [...itens].sort((a, b) => Number(a.rotulo) - Number(b.rotulo));
}

export function faixasDePrazo(total: number, vencidos: number, proximos: number): FaixaPrazo[] {
  const totalSeguro = Math.max(0, total);
  const vencidosSeguros = Math.max(0, vencidos);
  const proximosSeguros = Math.max(0, proximos);
  return [
    { rotulo: "Vencidos", total: vencidosSeguros, cor: CORES.danger },
    { rotulo: "A vencer", total: proximosSeguros, cor: CORES.warning },
    {
      rotulo: "Regulares",
      total: Math.max(0, totalSeguro - vencidosSeguros - proximosSeguros),
      cor: CORES.navy,
    },
  ];
}

export function corDaClassificacao(classificacao: string | null | undefined): string {
  const normalizada = String(classificacao ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  if (normalizada.includes("grave")) return CORES.danger;
  if (normalizada.includes("media")) return CORES.warning;
  if (normalizada.includes("leve")) return CORES.success;
  if (normalizada.includes("militar")) return CORES.navy;
  if (normalizada.includes("comum")) return CORES.violet;
  return CORES.brand;
}

export function totalDe(itens: readonly ContagemGrafico[]): number {
  return itens.reduce((soma, item) => soma + item.total, 0);
}

/**
 * Quebra o rótulo do eixo em linhas curtas, para o texto não sair do canvas.
 *
 * O corte é explícito: passar de `maxLinhas` sem reticências fazia o eixo
 * mentir o nome da categoria — "Acidente de trânsito envolvendo viatura
 * policial militar" saía como "envolvendo viatura", e no papel não há tooltip
 * para desmentir. Palavra maior que o limite não é partida no meio; vai
 * inteira na sua linha, que é o menos pior para sigla e artigo.
 */
export function quebrarRotulo(rotulo: string, limite = 18, maxLinhas = 3): string[] {
  if (rotulo.length <= limite) return [rotulo];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of rotulo.split(/\s+/)) {
    if (!atual || `${atual} ${palavra}`.length <= limite) atual = atual ? `${atual} ${palavra}` : palavra;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length <= maxLinhas) return linhas;
  const cortadas = linhas.slice(0, maxLinhas);
  cortadas[maxLinhas - 1] = `${cortadas[maxLinhas - 1]}…`;
  return cortadas;
}

/** Sobre o que o percentual do tooltip é calculado. */
export type BasePercentual = "categoria" | "total";

/**
 * Denominador do percentual exibido no tooltip.
 *
 * `categoria` responde "quanto esta fatia é da barra" — num empilhado, os 96 em
 * andamento do IPM são 70% do IPM, não 21% do relatório inteiro. `total`
 * responde "quanto esta barra é do conjunto", e aí o denominador é o total
 * **real**: num ranking limitado ao Top 12, somar só o que está plotado
 * inflaria todos os percentuais em silêncio.
 */
export function denominadorPercentual(
  base: BasePercentual,
  valoresDaCategoria: readonly number[],
  totalReal: number | undefined,
  somaPlotada: number,
): number {
  if (base === "categoria") return valoresDaCategoria.reduce((soma, valor) => soma + valor, 0);
  return totalReal ?? somaPlotada;
}
