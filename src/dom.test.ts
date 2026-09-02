import { describe, expect, it } from "vitest";
import { blocosDeImpressao, tabela } from "./dom";

describe("tabela para impressão", () => {
  it("marca somente as tabelas que optam pela fragmentação no WebKitGTK", () => {
    const marcada = tabela(["Nome"], [["Ana"]], "Nada.", {
      linhasPorFragmentoImpressao: 6,
    });
    const comum = tabela(["Nome"], [["Ana"]]);

    expect(marcada).toContain('data-linhas-por-fragmento-impressao="6"');
    expect(comum).not.toContain("data-linhas-por-fragmento-impressao");
  });

  it("normaliza o tamanho do fragmento para um inteiro positivo", () => {
    const html = tabela(["Nome"], [["Ana"]], "Nada.", {
      linhasPorFragmentoImpressao: 3.9,
    });
    expect(html).toContain('data-linhas-por-fragmento-impressao="3"');
  });

  it("marca um primeiro fragmento menor quando o título divide a folha", () => {
    const html = tabela(["Nome"], [["Ana"]], "Nada.", {
      linhasPorFragmentoImpressao: 22,
      linhasNoPrimeiroFragmentoImpressao: 18,
    });
    expect(html).toContain('data-linhas-no-primeiro-fragmento-impressao="18"');
  });
});

describe("blocosDeImpressao", () => {
  it("fecha o último bloco no total, sem inventar linha que não existe", () => {
    expect(blocosDeImpressao(7, 3)).toEqual([
      [0, 3],
      [3, 6],
      [6, 7],
    ]);
  });

  it("não devolve bloco nenhum para tabela vazia ou limite inválido", () => {
    expect(blocosDeImpressao(0, 10)).toEqual([]);
    expect(blocosDeImpressao(10, 0)).toEqual([]);
  });

  it("aceita um primeiro bloco menor para dividir espaço com o título", () => {
    expect(blocosDeImpressao(50, 22, 18)).toEqual([
      [0, 18],
      [18, 40],
      [40, 50],
    ]);
  });
});
