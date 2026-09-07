import { describe, expect, it } from "vitest";
import { blocosDeImpressao, botaoIcone, tabela } from "./dom";

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

describe("botão de ícone", () => {
  // `comCarregamento` escreve a mensagem de progresso no botão que a disparou,
  // e restaura o rótulo no fim. Num botão de ícone isso **apagava o desenho**:
  // o conteúdo é um `<svg>`, `textContent` ali é vazio, e restaurar o vazio
  // deixava um quadrado em branco até a tela ser redesenhada. Por isso o helper
  // pula os `.botao-icone`, e por isso este teste trava as duas propriedades de
  // que aquela decisão depende.
  it("não tem texto para emprestar, e se identifica pela classe", () => {
    const html = botaoIcone("documento", "Ver PDF completo", { classe: "outline" });

    expect(html).toContain("botao-icone");
    expect(html).toContain("<svg");
    // Nada fora das tags: o nome acessível vem de `aria-label`/`title`, não de
    // texto no corpo do botão.
    expect(html.replace(/<[^>]*>/g, "").trim()).toBe("");
  });
});
