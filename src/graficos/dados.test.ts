import { describe, expect, it } from "vitest";

import {
  BALDES_SITUACAO,
  baldesComDado,
  CORES,
  corDaClassificacao,
  denominadorPercentual,
  faixasDePrazo,
  limitarRanking,
  ordenarAnos,
  ordenarContagens,
  percentual,
  quebrarRotulo,
  totalDaSituacao,
  totalDe,
} from "./dados";

const carga = (
  concluidos: number,
  no_prazo: number,
  vencidos: number,
  sem_prazo: number,
) => ({ concluidos, no_prazo, vencidos, sem_prazo });

describe("transformações dos painéis analíticos", () => {
  it("deriva prazos regulares sem permitir contagem negativa", () => {
    expect(faixasDePrazo(20, 3, 5).map((faixa) => faixa.total)).toEqual([3, 5, 12]);
    expect(faixasDePrazo(4, 3, 5).map((faixa) => faixa.total)).toEqual([3, 5, 0]);
  });

  it("ordena a evolução cronologicamente sem alterar a origem", () => {
    const origem = [
      { rotulo: "2026", total: 3 },
      { rotulo: "2024", total: 8 },
      { rotulo: "2025", total: 5 },
    ];
    expect(ordenarAnos(origem).map((item) => item.rotulo)).toEqual(["2024", "2025", "2026"]);
    expect(origem[0]?.rotulo).toBe("2026");
  });

  it("ordena rankings por quantidade e usa rótulo como desempate", () => {
    const itens = ordenarContagens([
      { rotulo: "B", total: 2 },
      { rotulo: "C", total: 8 },
      { rotulo: "A", total: 2 },
    ]);
    expect(itens.map((item) => item.rotulo)).toEqual(["C", "A", "B"]);
    expect(totalDe(itens)).toBe(12);
  });

  it("limita apenas a visualização do ranking", () => {
    const origem = Array.from({ length: 20 }, (_, indice) => indice);
    expect(limitarRanking(origem)).toEqual(origem.slice(0, 12));
    expect(origem).toHaveLength(20);
  });

  it("calcula percentuais e protege total zero", () => {
    expect(percentual(1, 3)).toBe(33.3);
    expect(percentual(5, 0)).toBe(0);
    expect(percentual(Number.NaN, 10)).toBe(0);
  });

  it("mapeia gravidades e preserva fallback institucional", () => {
    expect(corDaClassificacao("Leve")).toBe(CORES.success);
    expect(corDaClassificacao("Média")).toBe(CORES.warning);
    expect(corDaClassificacao("GRAVE")).toBe(CORES.danger);
    expect(corDaClassificacao("Classificação futura")).toBe(CORES.brand);
  });

  it("quebra o rótulo do eixo e avisa quando cortou", () => {
    expect(quebrarRotulo("Deserção")).toEqual(["Deserção"]);
    expect(quebrarRotulo("Conduta desonrosa em ambiente virtual")).toEqual([
      "Conduta desonrosa",
      "em ambiente",
      "virtual",
    ]);
    const cortado = quebrarRotulo("Acidente de trânsito envolvendo viatura policial militar");
    expect(cortado).toHaveLength(3);
    expect(cortado[2]).toMatch(/…$/);
  });

  it("empilha a situação na ordem de leitura, com o vermelho no vencido", () => {
    expect(BALDES_SITUACAO.map((b) => b.chave)).toEqual([
      "concluidos",
      "no_prazo",
      "vencidos",
      "sem_prazo",
    ]);
    // Vermelho significa "vencido" em toda tela do sistema, inclusive aqui.
    expect(BALDES_SITUACAO.find((b) => b.chave === "vencidos")?.cor).toBe(CORES.danger);
  });

  it("omite o balde que ninguém no escopo tem", () => {
    // O caso comum: todo mundo com recebimento informado, logo sem "Sem prazo".
    expect(baldesComDado([carga(4, 2, 1, 0), carga(0, 3, 0, 0)]).map((b) => b.chave)).toEqual([
      "concluidos",
      "no_prazo",
      "vencidos",
    ]);
    // Um único registro num balde já o traz de volta, e na posição dele.
    expect(baldesComDado([carga(0, 0, 0, 1)]).map((b) => b.chave)).toEqual(["sem_prazo"]);
    expect(baldesComDado([])).toEqual([]);
  });

  it("soma os quatro baldes como total do militar", () => {
    expect(totalDaSituacao(carga(4, 2, 1, 1))).toBe(8);
    expect(totalDaSituacao(carga(0, 0, 0, 0))).toBe(0);
  });

  it("escolhe o denominador do percentual sem inflar ranking cortado", () => {
    // Barra do IPM num empilhado: 96 de 137, não 96 do relatório inteiro.
    expect(denominadorPercentual("categoria", [96, 41], 459, 459)).toBe(137);
    // Ranking limitado ao Top 12: o total real manda, não a soma do que ficou.
    expect(denominadorPercentual("total", [63], 277, 274)).toBe(277);
    expect(denominadorPercentual("total", [63], undefined, 274)).toBe(274);
  });
});
