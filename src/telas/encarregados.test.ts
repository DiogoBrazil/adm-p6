import { describe, expect, it } from "vitest";
import type { DesignacaoMatrizLinha } from "../api";
import { normalizarDesignacoesParaImpressao } from "./encarregados";

const linha = (
  nome: string,
  total: number,
  celulas: DesignacaoMatrizLinha["celulas"],
): DesignacaoMatrizLinha => ({
  policial_militar_id: nome,
  nome,
  matricula: "100",
  posto_graduacao: "SGT",
  concluidos: total,
  no_prazo: 0,
  vencidos: 0,
  sem_prazo: 0,
  total,
  ultimo_recebimento: null,
  ultima_conclusao: null,
  celulas,
});

const celula = (id: string, rotulo: string, total: number) => ({
  id,
  rotulo,
  concluidos: total,
  no_prazo: 0,
  vencidos: 0,
  sem_prazo: 0,
  total,
  ultimo_recebimento: null,
  ultima_conclusao: null,
});

describe("normalizarDesignacoesParaImpressao", () => {
  it("omite zeros, respeita a ordem das espécies e conserva todos os totais", () => {
    const resultado = normalizarDesignacoesParaImpressao(
      [
        linha("Ana", 3, [celula("ipm", "IPM", 2), celula("sind", "SIND", 1)]),
        linha("Bia", 4, [celula("sind", "SIND", 4)]),
      ],
      [
        { id: "sind", rotulo: "Sindicância" },
        { id: "ipm", rotulo: "IPM" },
        { id: "pad", rotulo: "PAD" },
      ],
    );

    expect(resultado.filter((item) => item.tipo === "item")).toEqual([
      expect.objectContaining({ militar: "SGT 100 Ana", apuratorio: "Sindicância", quantidade: 1 }),
      expect.objectContaining({ militar: "SGT 100 Ana", apuratorio: "IPM", quantidade: 2 }),
      expect.objectContaining({ militar: "SGT 100 Bia", apuratorio: "Sindicância", quantidade: 4 }),
    ]);
    expect(resultado.filter((item) => item.tipo === "total-militar").map((item) => item.quantidade)).toEqual([3, 4]);
    expect(resultado.at(-1)).toEqual(
      expect.objectContaining({ tipo: "total-geral", quantidade: 7 }),
    );
  });

  it("não cria total geral para uma matriz vazia", () => {
    expect(normalizarDesignacoesParaImpressao([], [])).toEqual([]);
  });
});
