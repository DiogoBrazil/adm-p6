// Helpers de renderização compartilhados entre as telas.
//
// O app monta HTML por concatenação de template literal. Isso só é seguro
// enquanto TODO valor interpolado passa por `escapeHtml`: uma string com HTML
// vinda do banco executaria no contexto do WebView. A CSP do `tauri.conf.json`
// fecha o resto — e é ela que recusa `style=""` interpolado no markup, por isso
// largura calculada sai em `data-*` e é aplicada pela CSSOM.

import { call } from "./api";

/** Escapa para interpolação em corpo de elemento e em valor de atributo. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] ?? char,
  );
}

/** Exibição de célula: booleano vira sim/não, nulo vira vazio. */
export function cellDisplay(value: unknown): string {
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value ?? "");
}

/** Qualificação compacta usada nas listagens: `POSTO MATRÍCULA NOME`. */
export function formatarQualificacaoMilitar(
  posto: string | null,
  matricula: string | null,
  nome: string | null,
): string {
  return [posto, matricula, nome].filter((parte): parte is string => Boolean(parte)).join(" ") || "—";
}

export type IconeAcao =
  | "abrir"
  | "editar"
  | "desativar"
  | "reativar"
  | "padrao"
  | "excluir"
  | "baixar"
  | "substituir";

/** Ícones lineares das ações tabulares, desenhados com a cor do botão. */
function iconeAcao(nome: IconeAcao): string {
  const conteudo: Record<IconeAcao, string> = {
    abrir: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    editar: '<path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    desativar: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    reativar: '<path d="M20 7v5h-5"/><path d="M18.5 16a8 8 0 1 1 .5-8.5L20 12"/>',
    padrao: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    excluir: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m7 7 1 13h8l1-13"/><path d="M10 11v5M14 11v5"/>',
    baixar: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    // Duas setas em sentidos opostos: quem sai e quem entra na mesma função.
    substituir: '<path d="M4 8h13"/><path d="m13 4 4 4-4 4"/><path d="M20 16H7"/><path d="m11 12-4 4 4 4"/>',
  };
  return `<svg class="icone-acao" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${conteudo[nome]}</svg>`;
}

/** Botão compacto para células de ação, sempre com nome acessível e tooltip. */
export function botaoIcone(
  icone: IconeAcao,
  rotulo: string,
  opcoes: { classe?: string; dados?: Record<string, string> } = {},
): string {
  const dados = Object.entries(opcoes.dados ?? {})
    .map(([nome, valor]) => ` data-${nome}="${escapeHtml(valor)}"`)
    .join("");
  const classes = ["botao-icone", opcoes.classe ?? ""].filter(Boolean).join(" ");
  return `<button type="button" class="${escapeHtml(classes)}" aria-label="${escapeHtml(rotulo)}" title="${escapeHtml(rotulo)}"${dados}>${iconeAcao(icone)}</button>`;
}

/** `<option>` já escapado, marcando o selecionado. */
export function option(valor: string, rotulo: string, selecionado: boolean): string {
  return `<option value="${escapeHtml(valor)}"${selecionado ? " selected" : ""}>${escapeHtml(rotulo)}</option>`;
}

// ── Estado de formulários e feedback ─────────────────────────────────

let formularioPendente = false;

/** Marca um formulário de edição para proteger mudanças ainda não salvas. */
export function protegerFormulario(form: HTMLFormElement): void {
  const marcar = () => {
    formularioPendente = true;
  };
  form.addEventListener("input", marcar);
  form.addEventListener("change", marcar);
}

/** Limpa a proteção depois de salvar ou descartar de forma consciente. */
export function limparFormularioPendente(): void {
  formularioPendente = false;
}

export function formularioTemPendencia(): boolean {
  return formularioPendente;
}

/** Confirma a saída de qualquer formulário longo que tenha sido modificado. */
export function podeDescartarFormulario(): boolean {
  if (!formularioPendente) return true;
  const descartar = confirm("Há alterações não salvas. Deseja descartá-las?");
  if (descartar) formularioPendente = false;
  return descartar;
}

export type TipoFeedback = "sucesso" | "erro" | "info";

/** Mensagem não bloqueante, anunciada também por leitor de tela. */
export function notificar(mensagem: string, tipo: TipoFeedback = "info"): void {
  const regiao = document.querySelector<HTMLElement>("#toast-region");
  if (!regiao) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.textContent = mensagem;
  regiao.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

// ── Tabelas ───────────────────────────────────────────────────────────

/**
 * Uma coluna da listagem: rótulo, quanto ocupa e como o texto se comporta.
 *
 * Existe porque o padrão visual fechado na listagem de processos vivia num
 * arquivo só — `colgroup` com largura percentual, `table-layout: fixed`,
 * reticências com `title` — e as outras onze telas caíram nas classes
 * genéricas ou em nenhuma. Aqui ele é declarado uma vez e cada tela diz só o
 * que é seu: quanto cada coluna ocupa.
 *
 * `largura` é **percentual da tabela**, não pixel. Foi assim que a listagem de
 * processos resolveu o problema de a primeira coluna sem restrição ficar com
 * toda a sobra e as demais encolherem até "7º Batalhã…".
 */
export type Coluna = {
  rotulo: string;
  /** Percentual da largura da tabela. Sem ela, o navegador dimensiona pelo conteúdo. */
  largura?: number;
  alinhamento?: "centro" | "direita";
  /** Corta com reticências e entrega o conteúdo inteiro no `title`. */
  truncar?: boolean;
  /** Impede a quebra em duas linhas: data, contagem, etiqueta, botão. */
  nowrap?: boolean;
  /** Permite quebrar apenas o rótulo do cabeçalho, nunca o dado da célula. */
  quebrarRotulo?: boolean;
};

/** Célula de tabela: o texto já sai escapado, o alinhamento é opcional. */
export type Celula = string | {
  texto: string;
  numerica?: boolean;
  classe?: string;
  acao?: { rotulo: string; id: string; icone?: IconeAcao };
};

/**
 * Linha: só as células, ou as células com uma classe no `<tr>` (`atrasado`).
 *
 * `id` sai como `data-linha` e é o que o clique da tela deve casar. Existe
 * porque duas telas mapeavam a linha clicada **por posição** no array — e aí
 * qualquer coisa que mude a ordem (filtrar, paginar, recarregar) abre o
 * registro errado, sem errar visivelmente: uma linha de auditoria parece com a
 * outra.
 */
export type Linha =
  | Celula[]
  | { celulas: Celula[]; classe?: string; id?: string };

/**
 * Tabela escapada, com o invólucro de rolagem horizontal que o CSS espera.
 *
 * Substitui o `tableFrom` do `main.ts`, que escapava o valor da célula mas
 * interpolava o **nome da coluna** cru — e os nomes de coluna vinham das
 * chaves do JSON do backend.
 */
export function tabela(
  colunas: (string | Coluna)[],
  linhas: Linha[],
  vazio = "Nada a exibir.",
  opcoes: { viewport?: boolean; larga?: boolean; listagem?: boolean } = {},
): string {
  if (!linhas.length) return `<p class="empty">${escapeHtml(vazio)}</p>`;

  const definicoes: Coluna[] = colunas.map((c) => (typeof c === "string" ? { rotulo: c } : c));
  // Só vira tabela de layout fixo quem declarou largura. Uma tela de relatório
  // que passou apenas rótulos continua exatamente como era.
  const fixa = definicoes.some((c) => c.largura !== undefined);

  const classeDaColuna = (c: Coluna) =>
    [
      c.alinhamento === "centro" ? "col--centro" : "",
      c.alinhamento === "direita" ? "col--direita" : "",
      c.truncar ? "col--trunc" : "",
      c.nowrap ? "col--nowrap" : "",
      c.quebrarRotulo ? "col--rotulo-quebra" : "",
    ]
      .filter(Boolean)
      .join(" ");

  const celula = (c: Celula, indice: number) => {
    const definicao = definicoes[indice] ?? { rotulo: "" };
    if (c && typeof c === "object" && c.acao) {
      return `<td class="row-actions ${escapeHtml(classeDaColuna(definicao))}">${botaoIcone(c.acao.icone ?? "abrir", c.acao.rotulo, { classe: "outline", dados: { "tabela-acao": c.acao.id } })}</td>`;
    }
    const texto = typeof c === "string" ? c : c.texto;
    const extra = typeof c === "string" ? "" : [c.numerica ? "num" : "", c.classe ?? ""].join(" ");
    const classes = [classeDaColuna(definicao), extra].join(" ").trim().replace(/\s+/g, " ");
    // O `title` só existe onde a coluna trunca: num texto que cabe inteiro ele
    // é ruído, e o navegador ainda o mostra em cima do conteúdo já visível.
    const title = definicao.truncar && texto ? ` title="${escapeHtml(texto)}"` : "";
    return `<td${classes ? ` class="${escapeHtml(classes)}"` : ""}${title}>${escapeHtml(texto)}</td>`;
  };

  const linha = (l: Linha) => {
    const celulas = Array.isArray(l) ? l : l.celulas;
    const classe = Array.isArray(l) ? "" : (l.classe ?? "");
    const id = Array.isArray(l) ? undefined : l.id;
    return `<tr${classe ? ` class="${escapeHtml(classe)}"` : ""}${id === undefined ? "" : ` data-linha="${escapeHtml(id)}"`}>${celulas.map(celula).join("")}</tr>`;
  };

  // A largura sai em `data-largura` e é aplicada pela CSSOM em
  // `aplicarLarguras`. `style=""` interpolado no markup — inclusive num
  // `<col>` — é recusado pela CSP, e o elemento aparece sem estilo **sem erro
  // de build**. É a mesma via das barras dos painéis de contagem.
  const colgroup = fixa
    ? `<colgroup>${definicoes
        .map((c) => `<col${c.largura === undefined ? "" : ` data-largura="${c.largura}"`} />`)
        .join("")}</colgroup>`
    : "";

  // `tabela-dados` traz cabeçalho fixo, zebra e realce de linha. Vale para toda
  // listagem montada por este helper — ver o bloco "Listagem densa" no CSS.
  return `<div class="table-wrap${opcoes.viewport ? " table-wrap--viewport" : ""}"><table class="tabela-dados${fixa ? " tabela-dados--fixa" : ""}${opcoes.larga ? " tabela-dados--larga" : ""}${opcoes.listagem ? " tabela-dados--listagem" : ""}">
      ${colgroup}
      <thead><tr>${definicoes
        .map((c) => {
          const classe = classeDaColuna(c);
          return `<th${classe ? ` class="${escapeHtml(classe)}"` : ""}>${escapeHtml(c.rotulo)}</th>`;
        })
        .join("")}</tr></thead>
      <tbody>${linhas.map(linha).join("")}</tbody>
    </table></div>`;
}

/**
 * Aplica as larguras declaradas em `Coluna.largura`.
 *
 * Gêmea de `aplicarBarras`, e pela mesma razão: a CSP recusa `style=""` no
 * markup, e a CSSOM é a única via que ela não alcança. Chamada de
 * `main.ts::shell()` depois de cada render, para que nenhuma tela possa
 * esquecer — se ela não rodar, as colunas ficam sem largura e **nada acusa**.
 */
export function aplicarLarguras(raiz: ParentNode = document): void {
  raiz.querySelectorAll<HTMLElement>("col[data-largura]").forEach((col) => {
    col.style.width = `${col.dataset.largura}%`;
  });
}

// ── Exportação ────────────────────────────────────────────────────────

/**
 * Entrega um arquivo ao usuário, pelo diálogo nativo de "salvar como".
 *
 * Não é `<a download>` com blob: no WebView do Tauri essa via não define
 * destino nem abre seletor, e o comportamento muda por plataforma. Quem abre o
 * diálogo e grava é o backend (`src-tauri/src/files/commands.rs`), para que
 * nenhuma tela ganhe o poder de escrever num caminho arbitrário.
 *
 * Devolve o caminho gravado, ou `null` se o usuário cancelou — cancelar não é
 * erro e não deve virar alerta.
 */
export async function baixarArquivoBase64(
  nomeArquivo: string,
  conteudoBase64: string,
): Promise<string | null> {
  const resposta = await call("files_save_download", {
    request: { nome_sugerido: nomeArquivo, conteudo_base64: conteudoBase64 },
  });
  if (!resposta.ok) {
    notificar(resposta.error ?? "Falha ao gravar o arquivo.", "erro");
    return null;
  }
  return resposta.data;
}

/** CSV que o backend já montou (`CsvExport.conteudo` vem em base64). */
export function baixarCsvBase64(nomeArquivo: string, base64: string): Promise<string | null> {
  return baixarArquivoBase64(nomeArquivo, base64);
}

/**
 * CSV montado no cliente, no mesmo formato do backend: separador `;`, aspas
 * dobradas e BOM — sem o BOM o Excel abre o arquivo em Latin-1 e estraga todo
 * acento.
 */
export function baixarCsv(
  nomeArquivo: string,
  colunas: string[],
  linhas: unknown[][],
): Promise<string | null> {
  const campo = (valor: unknown) => {
    const texto = valor === null || valor === undefined ? "" : String(valor);
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const csv = [colunas, ...linhas].map((l) => l.map(campo).join(";")).join("\n");
  const bytes = new TextEncoder().encode(`\ufeff${csv}\n`);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return baixarArquivoBase64(nomeArquivo, btoa(binario));
}

/** Barra com os botões de saída da tela. Os ids são ligados por `ligarExportacao`. */
export function barraDeExportacao(opcoes: { imprimir?: boolean; csv?: boolean }): string {
  const botoes = [
    opcoes.imprimir ? `<button class="outline small" id="btn-imprimir">Imprimir / PDF</button>` : "",
    opcoes.csv ? `<button class="outline small" id="btn-csv">Exportar CSV</button>` : "",
  ].filter(Boolean);
  return botoes.length ? `<div class="export-bar">${botoes.join("")}</div>` : "";
}

/**
 * Itens por página de toda listagem operacional.
 *
 * Um número só, aqui, porque eram cinco espalhados — 50 em processos, 50 em
 * usuários, 200 na auditoria, e catálogos e mapas salvos sem nenhum. O backend
 * usa o mesmo padrão (`db::paginacao::PADRAO`), para que chamar sem tamanho
 * explícito devolva o que a tela desenharia de qualquer jeito.
 */
export const ITENS_POR_PAGINA = 10;

/**
 * Controle de página para as listagens paginadas.
 *
 * Existe porque as duas telas de lista pediam uma página grande e paravam por
 * aí: usuários pedia 200 (o teto do backend) com 235 militares no efetivo, e
 * processos pedia 100 com 128 processos. O resto não era alcançável por
 * caminho nenhum — não havia próxima página, e a contagem no cabeçalho dizia
 * um número maior que o de linhas na tela.
 *
 * A `chave` distingue dois paginadores na mesma tela: Prazos tem "Vencidos" e
 * "Vencendo em até X dias" lado a lado, e com um id fixo o segundo bloco
 * herdaria os botões do primeiro — os dois andariam juntos.
 *
 * Devolve string vazia quando tudo cabe numa página, para não poluir a tela.
 */
export function paginacao(
  chave: string,
  pagina: number,
  porPagina: number,
  total: number,
): string {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return "";
  const primeiro = (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);
  const id = (lado: string) => `btn-pagina-${lado}-${chave}`;
  return `<div class="paginacao">
    <button class="outline small" id="${escapeHtml(id("anterior"))}"${pagina <= 1 ? " disabled" : ""}>Anterior</button>
    <span>${primeiro}–${ultimo} de ${total} (página ${pagina} de ${paginas})</span>
    <button class="outline small" id="${escapeHtml(id("proxima"))}"${pagina >= paginas ? " disabled" : ""}>Próxima</button>
  </div>`;
}

/** Liga os botões de `paginacao`. `aoMudar` recebe a página escolhida. */
export function ligarPaginacao(
  chave: string,
  pagina: number,
  aoMudar: (pagina: number) => void,
): void {
  document
    .querySelector<HTMLButtonElement>(`#btn-pagina-anterior-${CSS.escape(chave)}`)
    ?.addEventListener("click", () => aoMudar(pagina - 1));
  document
    .querySelector<HTMLButtonElement>(`#btn-pagina-proxima-${CSS.escape(chave)}`)
    ?.addEventListener("click", () => aoMudar(pagina + 1));
}

/**
 * A maior página que ainda existe no total corrente.
 *
 * Excluir o único item da última página, ou estreitar o filtro, deixaria a tela
 * numa página vazia sem dizer por quê — a listagem some e o rodapé some junto,
 * porque `paginacao` se apaga quando só há uma página. Quem chama compara com a
 * página corrente e recarrega se mudou.
 */
export function paginaValida(pagina: number, porPagina: number, total: number): number {
  return Math.min(Math.max(1, pagina), Math.max(1, Math.ceil(total / porPagina)));
}

/** Lote de cada chamada ao percorrer um filtro inteiro. É o teto do backend. */
const LOTE = 200;

/**
 * Teto do que sai num CSV ou numa impressão.
 *
 * A auditoria cresce sem limite, e "todos os registros do filtro" pode ser
 * dezenas de milhares — uma espera longa e um PDF que ninguém lê. O teto
 * existe, mas **quem chama tem de avisar**: cortar calado é a armadilha que
 * escondeu 35 militares por toda a migração.
 */
export const TETO_EXPORTACAO = 5000;

/**
 * Percorre um comando paginado até esgotar o filtro.
 *
 * O CSV e a impressão levam o que o filtro alcança, não os dez da tela — foi
 * por isso que a exportação de usuários saía com uma página e o operador só
 * descobria abrindo a planilha.
 */
export async function carregarTudo<T>(
  pagina: (page: number, porPagina: number) => Promise<{ items: T[]; total: number } | null>,
): Promise<{ itens: T[]; cortado: boolean }> {
  const itens: T[] = [];
  let page = 1;
  let total = Infinity;

  while (itens.length < total && itens.length < TETO_EXPORTACAO) {
    const resposta = await pagina(page, LOTE);
    if (!resposta) break;
    total = resposta.total;
    if (!resposta.items.length) break;
    itens.push(...resposta.items);
    page += 1;
  }

  return { itens: itens.slice(0, TETO_EXPORTACAO), cortado: total > TETO_EXPORTACAO };
}

/** Avisa quando a exportação bateu no teto. Silencioso quando coube inteira. */
export function avisarSeCortado(cortado: boolean): void {
  if (cortado) {
    notificar(
      `Saíram os ${TETO_EXPORTACAO.toLocaleString("pt-BR")} registros mais recentes do filtro. Estreite o filtro para levar o resto.`,
      "info",
    );
  }
}

/**
 * Liga os botões de `barraDeExportacao`. `aoExportar` pode ser assíncrono.
 *
 * `aoImprimir` é opcional e existe para as listagens paginadas: sem ele o papel
 * sairia com os dez itens da tela, que não é o que ninguém quer imprimir. Quem
 * o passa devolve o HTML do conjunto completo; a tabela da tela é escondida da
 * impressão, o bloco completo entra no lugar, e tudo é desfeito depois —
 * inclusive se a impressão for cancelada.
 */
export function ligarExportacao(
  aoExportar?: () => unknown | Promise<unknown>,
  aoImprimir?: () => Promise<string>,
): void {
  const imprimir = document.querySelector<HTMLButtonElement>("#btn-imprimir");
  if (imprimir && aoImprimir) {
    imprimir.addEventListener("click", async () => {
      imprimir.disabled = true;
      const rotulo = imprimir.textContent;
      imprimir.textContent = "Preparando…";
      const bloco = document.createElement("div");
      bloco.className = "bloco-impressao";
      const naTela = document.querySelectorAll<HTMLElement>(".table-wrap, .paginacao");
      try {
        bloco.innerHTML = await aoImprimir();
        aplicarLarguras(bloco);
        const destino = document.querySelector("main");
        // Só esconde a tabela da tela depois de o bloco completo estar no
        // documento: falhar entre uma coisa e outra imprimiria a folha em branco.
        if (!destino) throw new Error("sem área principal para imprimir");
        destino.append(bloco);
        naTela.forEach((elemento) => elemento.classList.add("ocultar-na-impressao"));
        window.print();
      } catch (erro) {
        // Sem isto a falha vira rejeição não tratada: o botão volta ao normal e
        // nada explica por que o diálogo de impressão não abriu.
        notificar(
          erro instanceof Error ? erro.message : "Falha ao preparar a impressão.",
          "erro",
        );
      } finally {
        bloco.remove();
        naTela.forEach((elemento) => elemento.classList.remove("ocultar-na-impressao"));
        imprimir.disabled = false;
        imprimir.textContent = rotulo;
      }
    });
  } else {
    imprimir?.addEventListener("click", () => window.print());
  }

  const botao = document.querySelector<HTMLButtonElement>("#btn-csv");
  if (!botao || !aoExportar) return;
  botao.addEventListener("click", async () => {
    botao.disabled = true;
    const rotulo = botao.textContent;
    botao.textContent = "Gerando…";
    try {
      await aoExportar();
    } finally {
      botao.disabled = false;
      botao.textContent = rotulo;
    }
  });
}
