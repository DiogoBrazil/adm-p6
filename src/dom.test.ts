// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import {
  ativarSelectsPesquisaveis,
  blocosDeImpressao,
  botaoIcone,
  focarCampo,
  formatarData,
  instalarValidacaoAmigavel,
  ligarCamposDeData,
  mensagemDeLimiteDeData,
  preservarRolagem,
  revalidarLimiteDeData,
  sincronizarSelectsPesquisaveis,
  tabela,
} from "./dom";

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

describe("formatação de data", () => {
  it("inverte a ordem ISO e aceita o timestamp inteiro", () => {
    expect(formatarData("2026-08-31")).toBe("31/08/2026");
    expect(formatarData("2026-08-31T16:10:39Z")).toBe("31/08/2026");
  });

  // O mesmo formato era escrito em quatro lugares que só discordavam no vazio.
  // Sobrou um, e é o parâmetro que carrega a diferença: a listagem quer o
  // travessão, o PDF do mapa quer "Não informado".
  it("deixa o chamador escolher o que dizer quando não há data", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData("")).toBe("—");
    expect(formatarData(undefined, "Não informado")).toBe("Não informado");
    expect(formatarData("31/08/2026", "Não informado")).toBe("Não informado");
  });
});

describe("limite de data", () => {
  const campoDeData = (atributos: Record<string, string>): HTMLInputElement => {
    const campo = document.createElement("input");
    campo.type = "date";
    for (const [nome, valor] of Object.entries(atributos)) campo.setAttribute(nome, valor);
    document.body.append(campo);
    return campo;
  };

  // O defeito relatado: num apuratório instaurado em 2025, o campo com
  // `min="2025-…"` não deixava o calendário voltar a 2024 — nem para consertar
  // a instauração errada. O limite saiu dos atributos que o navegador conhece,
  // e é esta ausência que destrava a navegação por ano.
  it("não escreve `min` nem `max`, que são o que trava o calendário", () => {
    const campo = campoDeData({ "data-limite-min": "2025-06-01" });
    campo.value = "2024-03-10";
    revalidarLimiteDeData(campo);

    expect(campo.hasAttribute("min")).toBe(false);
    expect(campo.hasAttribute("max")).toBe(false);
  });

  it("continua cobrando a ordem, com a mensagem de quem declarou o limite", () => {
    const padrao = campoDeData({ "data-limite-min": "2025-06-01" });
    padrao.value = "2024-03-10";
    expect(mensagemDeLimiteDeData(padrao)).toBe(
      "Escolha uma data igual ou posterior a 01/06/2025.",
    );

    const proprio = campoDeData({
      "data-limite-max": "2026-09-09",
      "data-mensagem-max": "A data de instauração não pode ser futura.",
    });
    proprio.value = "2026-12-25";
    expect(mensagemDeLimiteDeData(proprio)).toBe("A data de instauração não pode ser futura.");
  });

  it("não reclama de data dentro do intervalo nem de campo vazio", () => {
    const dentro = campoDeData({ "data-limite-min": "2025-06-01", "data-limite-max": "2026-09-09" });
    dentro.value = "2025-06-01";
    expect(mensagemDeLimiteDeData(dentro)).toBe("");

    // Quem exige o preenchimento é o `required`; limite não fala de ausência.
    const vazio = campoDeData({ "data-limite-min": "2025-06-01" });
    expect(mensagemDeLimiteDeData(vazio)).toBe("");
  });

  // Tirar `min`/`max` tira também o `invalid` nativo: sem isto o formulário
  // seria enviado em silêncio com a data fora de ordem, e só o Rust reclamaria.
  it("bloqueia o envio do formulário sem os atributos nativos", () => {
    instalarValidacaoAmigavel();
    const form = document.createElement("form");
    const campo = document.createElement("input");
    campo.type = "date";
    campo.name = "data_recebimento";
    campo.dataset.limiteMin = "2025-06-01";
    form.append(campo);
    document.body.append(form);

    campo.value = "2024-03-10";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    expect(form.checkValidity()).toBe(false);
    expect(campo.validationMessage).toBe("Escolha uma data igual ou posterior a 01/06/2025.");

    // Corrigido o valor, o bloqueio some sozinho.
    campo.value = "2025-07-01";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    expect(form.checkValidity()).toBe(true);
  });
});

describe("campos de data", () => {
  const proximoQuadro = () =>
    new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

  // O `change` de um `input[type="date"]` dispara assim que o valor fica
  // completo — e ao digitar o ano o primeiro dígito `2` já é o ano `0002`.
  // Tirar o foco ali era o que impedia digitar o resto do ano.
  it("não tira o foco de quem está digitando", async () => {
    const escopo = document.createElement("div");
    escopo.innerHTML = `<input type="date" name="data_instauracao" />`;
    document.body.append(escopo);
    const campo = escopo.querySelector("input")!;
    ligarCamposDeData(escopo, () => {});

    campo.focus();
    campo.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
    campo.value = "0002-01-01";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    await proximoQuadro();

    expect(document.activeElement).toBe(campo);
  });

  // E o motivo de o `blur()` existir continua atendido: o seletor nativo do
  // WebView permanece aberto depois da escolha em algumas plataformas.
  it("fecha o seletor de quem escolheu com o mouse", async () => {
    const escopo = document.createElement("div");
    escopo.innerHTML = `<input type="date" name="data_conclusao" />`;
    document.body.append(escopo);
    const campo = escopo.querySelector("input")!;
    const vistos: string[] = [];
    ligarCamposDeData(escopo, (alvo) => vistos.push(alvo.name));

    campo.focus();
    campo.value = "2026-03-10";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    await proximoQuadro();

    expect(document.activeElement).not.toBe(campo);
    expect(vistos).toEqual(["data_conclusao"]);
  });

  // O callback é opcional porque três formulários — os dois campos do filtro e
  // a data da substituição — só querem o comportamento do seletor. Foi por não
  // ter esse padrão que dois campos de prorrogação ficaram com uma cópia
  // manual do `change`, sem a guarda de teclado, e passaram uma rodada inteira
  // sem aceitar digitação.
  it("dispensa o callback e ainda trata o seletor e a digitação", async () => {
    const escopo = document.createElement("div");
    escopo.innerHTML = `<input type="date" name="nova_data_vencimento" />`;
    document.body.append(escopo);
    const campo = escopo.querySelector("input")!;
    ligarCamposDeData(escopo);

    campo.focus();
    campo.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
    campo.value = "0002-01-01";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    await proximoQuadro();
    expect(document.activeElement).toBe(campo);

    campo.dispatchEvent(new FocusEvent("blur"));
    campo.focus();
    campo.value = "2027-03-10";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    await proximoQuadro();
    expect(document.activeElement).not.toBe(campo);
  });
});

// O `shell()` refaz o `innerHTML` do app inteiro a cada tela, e a `.sidebar`
// tem rolagem própria. O que estes testes prendem é a LIGAÇÃO — leu antes,
// escreveu depois —, que é o que uma refatoração do `shell()` pode desfazer
// sem ninguém notar. O happy-dom guarda `scrollTop` como propriedade simples,
// sem layout, então a rolagem de verdade do WebView continua sendo coisa de
// conferir na tela.
describe("preservarRolagem", () => {
  it("devolve a posição ao elemento recriado", () => {
    document.body.innerHTML = `<aside class="sidebar">antes</aside>`;
    document.querySelector<HTMLElement>(".sidebar")!.scrollTop = 420;

    preservarRolagem(".sidebar", () => {
      document.body.innerHTML = `<aside class="sidebar">depois</aside>`;
    });

    const recriado = document.querySelector<HTMLElement>(".sidebar")!;
    expect(recriado.textContent).toBe("depois");
    expect(recriado.scrollTop).toBe(420);
  });

  it("redesenha mesmo sem elemento antes ou depois", () => {
    document.body.innerHTML = "";
    let redesenhou = 0;

    // Primeira tela depois do login: vem da tela de acesso, que não tem menu.
    expect(() =>
      preservarRolagem(".sidebar", () => {
        redesenhou += 1;
        document.body.innerHTML = `<aside class="sidebar"></aside>`;
      }),
    ).not.toThrow();

    // E o inverso: havia menu, o redesenho não o recria.
    document.querySelector<HTMLElement>(".sidebar")!.scrollTop = 90;
    expect(() =>
      preservarRolagem(".sidebar", () => {
        redesenhou += 1;
        document.body.innerHTML = `<main>tela de acesso</main>`;
      }),
    ).not.toThrow();

    expect(redesenhou).toBe(2);
  });
});

describe("select pesquisável", () => {
  const montarSelect = (): HTMLSelectElement => {
    document.body.innerHTML = `
      <form>
        <select name="solucao_decidida_id" data-select-pesquisavel>
          <option value=""></option>
          <option value="arq">Arquivamento</option>
        </select>
      </form>`;
    ativarSelectsPesquisaveis(document.body);
    return document.querySelector("select")!;
  };

  const rotuloVisivel = () => document.querySelector(".ts-control")?.textContent ?? "";

  // `garantirOpcaoHistorica` insere a opção desativada no `<select>` em runtime,
  // e é ela que mantém na tela a solução de um processo de 2019 (princípio 6).
  // A instância do Tom Select não a enxerga: sem `sync()` a opção some do menu e
  // o campo abre vazio sobre um valor que existe — sem erro nenhum.
  it("enxerga a opção histórica inserida em runtime só depois do sync", () => {
    const select = montarSelect();
    const historica = document.createElement("option");
    historica.value = "sind";
    historica.textContent = "Sindicância (desativada)";
    select.append(historica);
    select.value = "sind";

    expect(Object.keys(select.tomselect!.options)).not.toContain("sind");

    sincronizarSelectsPesquisaveis(document.body);

    expect(Object.keys(select.tomselect!.options)).toContain("sind");
    expect(select.tomselect!.getValue()).toBe("sind");
    expect(rotuloVisivel()).toContain("Sindicância (desativada)");
  });

  // O `preencher` da substituição e o `reset()` do formulário de resultado
  // mexem no `<select>` nativo: sem o sync, abrir "substituir" logo depois de
  // "corrigir" mostraria o sucessor anterior sobre um valor já vazio.
  it("limpa o controle visível quando o valor nativo é zerado", () => {
    const select = montarSelect();
    select.tomselect!.setValue("arq", true);
    expect(rotuloVisivel()).toContain("Arquivamento");

    select.closest("form")!.reset();
    expect(rotuloVisivel()).toContain("Arquivamento");

    sincronizarSelectsPesquisaveis(document.body);
    expect(rotuloVisivel()).not.toContain("Arquivamento");
  });

  it("manda o foco ao controle visível, não ao select recortado", () => {
    const select = montarSelect();
    let recebeu = false;
    select.tomselect!.focus = () => {
      recebeu = true;
    };
    focarCampo(select);
    expect(recebeu).toBe(true);

    // Campo comum continua recebendo o foco nativo.
    const texto = document.createElement("input");
    document.body.append(texto);
    focarCampo(texto);
    expect(document.activeElement).toBe(texto);
  });
});
