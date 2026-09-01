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

/**
 * Os quatro estados de um apuratório sob a mão de um militar.
 *
 * `sem_prazo` é o apuratório em andamento cuja data de recebimento nunca foi
 * informada: não há linha em `processo_prazos`, então ele não está nem no prazo
 * nem vencido. Contá-lo junto com "no prazo" afirmaria um prazo que não existe.
 */
export type SituacaoContagem = {
  concluidos: number;
  no_prazo: number;
  vencidos: number;
  sem_prazo: number;
};

export type BaldeSituacao = {
  chave: keyof SituacaoContagem;
  rotulo: string;
  cor: string;
};

/**
 * A ordem em que os baldes são empilhados, e a cor de cada um.
 *
 * Da esquerda para a direita é a leitura que a Seção faz: o que já saiu, o que
 * está sob controle, o que está atrasado e o que sequer tem prazo. As cores
 * seguem as mesmas de `faixasDePrazo`, para que vermelho signifique "vencido"
 * em toda tela do sistema.
 */
export const BALDES_SITUACAO: readonly BaldeSituacao[] = [
  { chave: "concluidos", rotulo: "Concluídos", cor: CORES.success },
  { chave: "no_prazo", rotulo: "Em andamento no prazo", cor: CORES.navy },
  { chave: "vencidos", rotulo: "Em andamento vencido", cor: CORES.danger },
  { chave: "sem_prazo", rotulo: "Sem prazo definido", cor: CORES.muted },
];

/**
 * Só os baldes que têm algum registro no conjunto.
 *
 * Uma série inteira de zeros ocupa a legenda e não desenha nada — e "Sem prazo
 * definido" é o caso comum de balde vazio, porque a maioria dos apuratórios tem
 * o recebimento informado. A ordem de `BALDES_SITUACAO` é preservada.
 */
export function baldesComDado(itens: readonly SituacaoContagem[]): BaldeSituacao[] {
  return BALDES_SITUACAO.filter((balde) => itens.some((item) => item[balde.chave] > 0));
}

/** Soma os quatro baldes. É o total do militar ou o da espécie. */
export function totalDaSituacao(item: SituacaoContagem): number {
  return item.concluidos + item.no_prazo + item.vencidos + item.sem_prazo;
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
