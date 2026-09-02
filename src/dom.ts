// Helpers de renderização compartilhados entre as telas.
//
// O app monta HTML por concatenação de template literal. Isso só é seguro
// enquanto TODO valor interpolado passa por `escapeHtml`: uma string com HTML
// vinda do banco executaria no contexto do WebView. A CSP do `tauri.conf.json`
// fecha o resto — e é ela que recusa `style=""` interpolado no markup, por isso
// largura calculada sai em `data-*` e é aplicada pela CSSOM.

import { call } from "./api";
import { brasaoUrl } from "./brasao";
import {
  congelarGraficosParaImpressao,
  prepararGraficosParaImpressao,
  restaurarGraficosDepoisDaImpressao,
} from "./graficos";
import TomSelect from "tom-select";

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

/**
 * `2026-08-31T16:10:39Z` → `31/08/2026 16:10:39`.
 *
 * A auditoria escrevia isto na mão, com `.replace("T"," ").slice(0,19)`, e o
 * resultado era a data em ordem americana na tela de quem lê em português.
 */
export function formatarDataHora(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(iso);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]} ${partes[4]}` : iso;
}

/** `2026-08-31` → `31/08/2026`. Vazio vira travessão, para a coluna não sumir. */
export function formatarData(iso: string | null | undefined): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "—";
}

/** Qualificação compacta usada nas listagens: `POSTO MATRÍCULA NOME`. */
export function formatarQualificacaoMilitar(
  posto: string | null | undefined,
  matricula: string | null | undefined,
  nome: string | null | undefined,
): string {
  return [posto, matricula, nome].filter((parte): parte is string => Boolean(parte)).join(" ") || "—";
}

/** Origem compacta usada nas listagens e relatórios. */
export function formatarOrigem(
  unidade: string,
  subunidade?: string | null,
): string {
  return subunidade ? `${unidade} / ${subunidade}` : unidade;
}

export type IconeAcao =
  | "abrir"
  | "editar"
  | "desativar"
  | "reativar"
  | "padrao"
  | "excluir"
  | "baixar"
  | "substituir"
  | "adicionar";

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
    adicionar: '<path d="M12 5v14M5 12h14"/>',
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

// ── Select pesquisável e modal compartilhado ──────────────────────────────

/** Ativa busca por teclado sem trocar o `<select>` que alimenta o FormData. */
export function ativarSelectsPesquisaveis(root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>("select[data-select-pesquisavel]").forEach((select) => {
    if (select.tomselect) return;
    const placeholder = select.dataset.placeholder ?? "Digite para buscar…";
    new TomSelect(select, {
      maxItems: 1,
      create: false,
      diacritics: true,
      placeholder,
      closeAfterSelect: true,
      selectOnTab: true,
      render: {
        no_results(data: { input: string }, escape: (valor: string) => string) {
          return `<div class="no-results">Nenhum resultado para “${escape(data.input)}”.</div>`;
        },
      },
    });
  });
}

/** Libera listeners e devolve os selects ao estado nativo antes de um redraw. */
export function destruirSelectsPesquisaveis(root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>("select.tomselected").forEach((select) => {
    select.tomselect?.destroy();
  });
}

export type ModalMontado = {
  overlay: HTMLDivElement;
  fechar: () => void;
};

/** Modal acessível usado pelos cadastros rápidos, sempre fora do `#app`. */
export function montarModal(
  conteudo: string,
  rotulo: string,
  aoCancelar: () => void,
  gatilho?: HTMLElement | null,
): ModalMontado | null {
  if (document.querySelector(".modal-overlay")) return null;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal panel modal--cadastro" role="dialog" aria-modal="true" aria-label="${escapeHtml(rotulo)}">${conteudo}</div>`;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector<HTMLElement>("[role=dialog]")!;
  let encerrado = false;
  const focaveis = () =>
    [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((item) => !item.hidden && item.offsetParent !== null);

  const aoTeclar = (evento: KeyboardEvent) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      aoCancelar();
      return;
    }
    if (evento.key !== "Tab") return;
    const itens = focaveis();
    if (!itens.length) return;
    const primeiro = itens[0]!;
    const ultimo = itens[itens.length - 1]!;
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  };

  const fechar = () => {
    if (encerrado) return;
    encerrado = true;
    document.removeEventListener("keydown", aoTeclar);
    destruirSelectsPesquisaveis(overlay);
    overlay.remove();
    gatilho?.focus();
  };
  document.addEventListener("keydown", aoTeclar);
  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) aoCancelar();
  });
  overlay.querySelectorAll<HTMLElement>("[data-fechar-modal]").forEach((botao) => {
    botao.addEventListener("click", aoCancelar);
  });
  ativarSelectsPesquisaveis(overlay);
  window.setTimeout(() => focaveis()[0]?.focus(), 0);
  return { overlay, fechar };
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

type CampoValidavel = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

type EstadoErroCampo = {
  aviso: HTMLElement;
  descricaoOriginal: string | null;
};

const errosDeCampo = new WeakMap<CampoValidavel, EstadoErroCampo>();
const formulariosComAvisoAgendado = new WeakSet<HTMLFormElement>();
let validacaoAmigavelInstalada = false;
let sequenciaErroCampo = 0;

function ehCampoValidavel(alvo: EventTarget | null): alvo is CampoValidavel {
  return (
    alvo instanceof HTMLInputElement ||
    alvo instanceof HTMLSelectElement ||
    alvo instanceof HTMLTextAreaElement
  );
}

function dataPtBr(valor: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
}

/** Traduz o `ValidityState` do WebView sem substituir as regras do HTML. */
function mensagemDeValidacao(campo: CampoValidavel): string {
  // Uma mensagem personalizada anterior mantém `customError=true` mesmo
  // depois que o valor muda. Limpar primeiro revela o estado nativo atual.
  campo.setCustomValidity("");
  const validade = campo.validity;
  if (validade.valid) return "";

  if (validade.valueMissing) {
    return (
      campo.dataset.mensagemObrigatorio ??
      (campo instanceof HTMLSelectElement
        ? "Selecione uma opção para este campo."
        : "Preencha este campo obrigatório.")
    );
  }
  if (validade.typeMismatch && campo instanceof HTMLInputElement && campo.type === "email") {
    return "Informe um endereço de e-mail válido.";
  }
  if (validade.rangeUnderflow && campo instanceof HTMLInputElement) {
    if (campo.dataset.mensagemMin) return campo.dataset.mensagemMin;
    return campo.type === "date"
      ? `Escolha uma data igual ou posterior a ${dataPtBr(campo.min)}.`
      : `Informe um valor maior ou igual a ${campo.min}.`;
  }
  if (validade.rangeOverflow && campo instanceof HTMLInputElement) {
    if (campo.dataset.mensagemMax) return campo.dataset.mensagemMax;
    return campo.type === "date"
      ? `Escolha uma data igual ou anterior a ${dataPtBr(campo.max)}.`
      : `Informe um valor menor ou igual a ${campo.max}.`;
  }
  if (validade.tooShort && campo instanceof HTMLInputElement) {
    return `Informe pelo menos ${campo.minLength} caracteres.`;
  }
  if (validade.tooLong && campo instanceof HTMLInputElement) {
    return `Use no máximo ${campo.maxLength} caracteres.`;
  }
  if (validade.stepMismatch) return "Informe um valor permitido para este campo.";
  if (validade.patternMismatch) return "Revise o formato informado neste campo.";
  if (validade.badInput) return "Informe um valor válido para este campo.";
  return "Revise o valor informado neste campo.";
}

function recipienteDoErro(campo: CampoValidavel): HTMLElement | null {
  const grupo = campo.closest<HTMLElement>(".campo");
  if (grupo) return grupo;
  return campo.closest<HTMLElement>("label") ?? campo.parentElement;
}

function mostrarErroDoCampo(campo: CampoValidavel, mensagem: string): void {
  let estado = errosDeCampo.get(campo);
  if (!estado) {
    const recipiente = recipienteDoErro(campo);
    if (!recipiente) return;

    const aviso = document.createElement("small");
    aviso.className = "campo-erro campo-erro--validacao";
    aviso.dataset.validacaoCampo = "true";
    aviso.id = `erro-validacao-${++sequenciaErroCampo}`;

    const controleData = campo.closest<HTMLElement>(".campo-data-controle");
    if (controleData && controleData.parentElement === recipiente) {
      controleData.insertAdjacentElement("afterend", aviso);
    } else {
      recipiente.append(aviso);
    }

    estado = {
      aviso,
      descricaoOriginal: campo.getAttribute("aria-describedby"),
    };
    errosDeCampo.set(campo, estado);
  }

  estado.aviso.textContent = mensagem;
  campo.setAttribute("aria-invalid", "true");
  const descricoes = new Set(
    (estado.descricaoOriginal ?? "").split(/\s+/).filter(Boolean),
  );
  descricoes.add(estado.aviso.id);
  campo.setAttribute("aria-describedby", [...descricoes].join(" "));
}

function limparErroDoCampo(campo: CampoValidavel): void {
  campo.setCustomValidity("");
  const estado = errosDeCampo.get(campo);
  if (!estado) return;
  estado.aviso.remove();
  campo.removeAttribute("aria-invalid");
  if (estado.descricaoOriginal) campo.setAttribute("aria-describedby", estado.descricaoOriginal);
  else campo.removeAttribute("aria-describedby");
  errosDeCampo.delete(campo);
}

/**
 * Localiza e apresenta de forma acessível a validação nativa de todos os
 * formulários, inclusive os que as rotas desenham depois do carregamento.
 */
export function instalarValidacaoAmigavel(): void {
  if (validacaoAmigavelInstalada) return;
  validacaoAmigavelInstalada = true;

  document.addEventListener(
    "invalid",
    (evento) => {
      if (!ehCampoValidavel(evento.target)) return;
      evento.preventDefault();

      const campo = evento.target;
      const mensagem = mensagemDeValidacao(campo);
      if (!mensagem) return;
      campo.setCustomValidity(mensagem);
      mostrarErroDoCampo(campo, mensagem);

      const form = campo.form;
      if (!form || formulariosComAvisoAgendado.has(form)) return;
      formulariosComAvisoAgendado.add(form);
      window.queueMicrotask(() => {
        formulariosComAvisoAgendado.delete(form);
        campo.focus({ preventScroll: true });
        campo.scrollIntoView({ behavior: "smooth", block: "center" });
        notificar("Revise os campos destacados antes de continuar.", "erro");
      });
    },
    true,
  );

  const revisarCampo = (evento: Event) => {
    if (!ehCampoValidavel(evento.target) || !errosDeCampo.has(evento.target)) return;
    const campo = evento.target;
    const mensagem = mensagemDeValidacao(campo);
    if (mensagem) {
      campo.setCustomValidity(mensagem);
      mostrarErroDoCampo(campo, mensagem);
    } else {
      limparErroDoCampo(campo);
    }
  };
  document.addEventListener("input", revisarCampo);
  document.addEventListener("change", revisarCampo);
}

/** Mensagem não bloqueante, anunciada também por leitor de tela. */
export function notificar(mensagem: string, tipo: TipoFeedback = "info"): void {
  const regiao = document.querySelector<HTMLElement>("#toast-region");
  if (!regiao) return;

  const configuracao = {
    sucesso: { titulo: "Tudo certo", icone: "✓", duracao: 4200 },
    erro: { titulo: "Não foi possível concluir", icone: "!", duracao: 8000 },
    info: { titulo: "Informação", icone: "i", duracao: 6000 },
  }[tipo];

  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.setAttribute("role", tipo === "erro" ? "alert" : "status");

  const icone = document.createElement("span");
  icone.className = "toast__icone";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = configuracao.icone;

  const corpo = document.createElement("span");
  corpo.className = "toast__corpo";
  const titulo = document.createElement("strong");
  titulo.className = "toast__titulo";
  titulo.textContent = configuracao.titulo;
  const texto = document.createElement("span");
  texto.className = "toast__mensagem";
  texto.textContent = mensagem;
  corpo.append(titulo, texto);

  const fechar = document.createElement("button");
  fechar.className = "toast__fechar";
  fechar.type = "button";
  fechar.setAttribute("aria-label", "Fechar notificação");
  fechar.textContent = "×";

  let temporizador = window.setTimeout(() => toast.remove(), configuracao.duracao);
  const remover = () => {
    window.clearTimeout(temporizador);
    toast.remove();
  };
  fechar.addEventListener("click", remover);
  toast.addEventListener("mouseenter", () => window.clearTimeout(temporizador));
  toast.addEventListener("mouseleave", () => {
    temporizador = window.setTimeout(remover, 2500);
  });

  toast.append(icone, corpo, fechar);
  regiao.append(toast);
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
/** Botão de uma célula de ação. `classe` escolhe a cor do botão. */
export type AcaoDeLinha = {
  rotulo: string;
  id: string;
  icone?: IconeAcao;
  classe?: string;
  /** Sai como `data-<nome>` no lugar de `data-tabela-acao`. */
  dado?: string;
};

export type Celula = string | {
  texto: string;
  numerica?: boolean;
  classe?: string;
  acao?: AcaoDeLinha;
  /** Mais de um botão na mesma célula, na ordem em que aparecem. */
  acoes?: AcaoDeLinha[];
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
  opcoes: {
    viewport?: boolean;
    larga?: boolean;
    listagem?: boolean;
    /** Quantas linhas formam cada bloco indivisível no PDF. */
    linhasPorFragmentoImpressao?: number;
    /** Primeiro bloco menor, quando um título ocupa o topo da mesma folha. */
    linhasNoPrimeiroFragmentoImpressao?: number;
  } = {},
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
    // Uma célula de ação pode ter um botão (`acao`) ou vários (`acoes`). O
    // `data-` de cada um é `tabela-acao` por padrão: é o que a tela liga para
    // abrir o registro. Quem precisa de mais de uma ação nomeia as outras
    // (`dado`), senão os dois cliques cairiam no mesmo listener.
    const acoes = c && typeof c === "object" ? (c.acoes ?? (c.acao ? [c.acao] : null)) : null;
    if (acoes) {
      const botoes = acoes
        .map((a) =>
          botaoIcone(a.icone ?? "abrir", a.rotulo, {
            classe: a.classe ?? "outline",
            dados: { [a.dado ?? "tabela-acao"]: a.id },
          }),
        )
        .join("");
      return `<td class="row-actions ${escapeHtml(classeDaColuna(definicao))}">${botoes}</td>`;
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
  // de build**. A CSSOM mantém a CSP restritiva sem perder as proporções.
  const colgroup = fixa
    ? `<colgroup>${definicoes
        .map((c) => `<col${c.largura === undefined ? "" : ` data-largura="${c.largura}"`} />`)
        .join("")}</colgroup>`
    : "";

  // `tabela-dados` traz cabeçalho fixo, zebra e realce de linha. Vale para toda
  // listagem montada por este helper — ver o bloco "Listagem densa" no CSS.
  const fragmento = opcoes.linhasPorFragmentoImpressao
    ? ` data-linhas-por-fragmento-impressao="${Math.max(1, Math.floor(opcoes.linhasPorFragmentoImpressao))}"${
        opcoes.linhasNoPrimeiroFragmentoImpressao
          ? ` data-linhas-no-primeiro-fragmento-impressao="${Math.max(1, Math.floor(opcoes.linhasNoPrimeiroFragmentoImpressao))}"`
          : ""
      }`
    : "";
  return `<div class="table-wrap${opcoes.viewport ? " table-wrap--viewport" : ""}"${fragmento}><table class="tabela-dados${fixa ? " tabela-dados--fixa" : ""}${opcoes.larga ? " tabela-dados--larga" : ""}${opcoes.listagem ? " tabela-dados--listagem" : ""}">
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
 * Os intervalos `[inicio, fim)` de cada bloco indivisível de uma tabela longa.
 *
 * Mora fora do DOM porque o arnês de `tools/impressao` monta as mesmas fatias
 * sem navegador nenhum: se cada um contasse as suas, o PDF que o arnês confere
 * deixaria de ser o PDF que o app imprime, e a divergência não daria erro.
 */
export function blocosDeImpressao(
  total: number,
  limite: number,
  limitePrimeiro = limite,
): [number, number][] {
  if (total <= 0 || limite < 1 || limitePrimeiro < 1) return [];
  const blocos: [number, number][] = [];
  const fimPrimeiro = Math.min(total, limitePrimeiro);
  blocos.push([0, fimPrimeiro]);
  for (let inicio = fimPrimeiro; inicio < total; inicio += limite) {
    blocos.push([inicio, Math.min(inicio + limite, total)]);
  }
  return blocos;
}

/**
 * Põe o brasão e a identificação da unidade no topo do documento, e tira depois.
 *
 * Até aqui só dois documentos saíam identificados: o Mapa Mensal, que tem
 * paginador próprio, e o Relatório Anual, pela `.relatorio-capa`. Os outros oito
 * caminhos imprimíveis levavam ao papel o `<h1>` da tela e mais nada — documento
 * oficial da Seção sem dizer de que Seção é.
 *
 * Mora aqui, e não em cada tela, porque `abrirImpressao` é o gargalo por onde
 * todo o caminho comum passa: tela nova nasce com cabeçalho sem ninguém
 * lembrar, e não há oito cópias para divergirem entre si.
 *
 * O `perfil` decide se entra. No `documento` — hoje só o Relatório Anual — a
 * `.relatorio-capa` já abre com o mesmo brasão e as mesmas duas linhas, e dois
 * brasões na mesma folha é defeito. A guarda é aqui e não no CSS de propósito:
 * assim a `<img>` nem chega a existir, e não há `decode()` para esperar.
 *
 * É `async` pelo mesmo motivo que `congelarGraficosParaImpressao`: a imagem
 * nasce no clique, e o WebKitGTK imprime **espaço em branco** por uma `<img>`
 * ainda não decodificada, sem erro nenhum. `mapa-pdf.ts::aguardarImagens` é o
 * precedente, e falhar aqui é preferível a um PDF oficial sem brasão.
 */
async function inserirCabecalhoInstitucional(
  perfil: PerfilImpressao,
): Promise<() => void> {
  if (perfil === "documento") return () => {};

  // Acima do `.page-head`, que é onde as oito telas põem o título: o brasão
  // encabeça o documento, e o título vem logo abaixo dele. Sem `.page-head` —
  // nenhuma tela imprimível está nesse caso hoje — sobra o topo do painel.
  const titulo = document.querySelector<HTMLElement>(".page-head");
  const painel = titulo ? null : document.querySelector<HTMLElement>(".content-area .panel");
  if (!titulo && !painel) return () => {};

  const cabecalho = document.createElement("header");
  cabecalho.className = "cabecalho-institucional";

  const brasao = document.createElement("img");
  brasao.src = brasaoUrl;
  // Decorativo: as duas linhas abaixo já nomeiam a instituição, e um `alt`
  // repetindo isso faria o leitor de tela dizer tudo duas vezes.
  brasao.alt = "";
  const orgao = document.createElement("p");
  orgao.textContent = "Polícia Militar de Rondônia";
  const secao = document.createElement("span");
  secao.textContent = "7º BPM · Seção de Justiça e Disciplina";
  cabecalho.append(brasao, orgao, secao);

  if (titulo) titulo.before(cabecalho);
  else painel!.prepend(cabecalho);

  try {
    await brasao.decode();
  } catch {
    cabecalho.remove();
    throw new Error("Não foi possível carregar o brasão para a impressão. Tente novamente.");
  }

  return () => cabecalho.remove();
}

/**
 * Manda para o fim do documento, só no papel, os blocos com
 * `data-impressao-ao-fim`.
 *
 * Um cartão analítico é indivisível (`report-print.css`) e mais alto do que a
 * folha menos o cabeçalho: com a faixa de KPIs em cima, o motor não tem onde o
 * pôr e o desmancha por cima da folha seguinte. Medido em
 * `tools/impressao/medicao-designacoes-folha1`, Designações gastava **duas**
 * folhas antes da primeira linha da matriz — a primeira com título, KPIs e o
 * gráfico, a segunda com o `h2` da matriz sozinho, porque o gráfico transbordava
 * para dentro dela e o primeiro bloco de 18 linhas já não cabia no que sobrava.
 *
 * Descer o cartão deixa a matriz fragmentada preencher a folha 1, e o gráfico
 * não precisa encolher — encolher é o que faz os rótulos de três linhas se
 * encavalarem (seção 7).
 *
 * Move o nó de verdade, não `order` de flex: dentro de um container flex ou grid
 * o WebKitGTK ignora o `break-inside` das caixas de dentro, medido em
 * `analitico-cartoes-fragmentados`. No fluxo de blocos ele respeita.
 */
function adiarBlocosParaOFimDaImpressao(): () => void {
  const desfazer: (() => void)[] = [];

  document.querySelectorAll<HTMLElement>("[data-impressao-ao-fim]").forEach((bloco) => {
    const destino = bloco.closest<HTMLElement>(".panel") ?? bloco.parentElement;
    if (!destino || destino.lastElementChild === bloco) return;
    // A âncora é um comentário porque ela precisa sobreviver no fluxo sem
    // desenhar nada nem casar com seletor nenhum enquanto o diálogo está aberto.
    const ancora = document.createComment("impressao-ao-fim");
    bloco.before(ancora);
    destino.append(bloco);
    desfazer.push(() => ancora.replaceWith(bloco));
  });

  return () => desfazer.forEach((restaurar) => restaurar());
}

/**
 * O WebKitGTK 2.52 ainda fragmenta `<tr>` apesar de `break-inside: avoid`.
 * Tabelas longas optam por cópias em blocos pequenos, montadas só enquanto o
 * diálogo está aberto. Cada bloco é indivisível e repete o cabeçalho; a tabela
 * operacional permanece única e intocada na tela.
 */
function fragmentarTabelasParaImpressao(): () => void {
  const criados: HTMLElement[] = [];
  const originais: HTMLElement[] = [];
  const cartoes = new Set<HTMLElement>();
  const secoes = new Set<HTMLElement>();

  document
    .querySelectorAll<HTMLElement>("[data-linhas-por-fragmento-impressao]")
    .forEach((envoltorio) => {
      if (envoltorio.closest("[hidden]")) return;
      const tabelaOriginal = envoltorio.querySelector<HTMLTableElement>(":scope > table");
      const limite = Number(envoltorio.dataset.linhasPorFragmentoImpressao);
      const limitePrimeiro = Number(
        envoltorio.dataset.linhasNoPrimeiroFragmentoImpressao ?? limite,
      );
      if (
        !tabelaOriginal ||
        !Number.isInteger(limite) ||
        limite < 1 ||
        !Number.isInteger(limitePrimeiro) ||
        limitePrimeiro < 1
      ) return;

      const linhas = [...tabelaOriginal.tBodies].flatMap((corpo) => [...corpo.rows]);
      if (!linhas.length) return;
      // Uma tabela que cabe num bloco não ganha cópia. O clone interpunha
      // uma caixa entre o título e a tabela; foi assim que seções curtas do
      // Relatório Anual deixaram o título órfão na folha anterior.
      if (linhas.length <= limite) return;

      const conjunto = document.createElement("div");
      conjunto.className = "somente-impressao tabela-impressao-fragmentada";

      const secao = envoltorio.closest<HTMLElement>(".relatorio-secao");
      const cabecalhoDaSecao = secao
        ? [...secao.querySelectorAll<HTMLElement>(":scope > h2, :scope > .hint")]
        : [];
      cabecalhoDaSecao.forEach((elemento) => {
        elemento.classList.add("somente-tela-na-impressao");
        originais.push(elemento);
      });

      for (const [inicio, fim] of blocosDeImpressao(linhas.length, limite, limitePrimeiro)) {
        const fragmento = document.createElement("div");
        fragmento.className = "table-wrap tabela-impressao-fragmento";
        // O WebKitGTK ignora `break-after: avoid` quando o próximo irmão é um
        // bloco indivisível. Levar o título para dentro do primeiro fragmento
        // torna a relação estrutural e impede a folha só com o título.
        if (inicio === 0) {
          cabecalhoDaSecao.forEach((elemento) => {
            const copia = elemento.cloneNode(true) as HTMLElement;
            // O original já recebeu esta classe para desaparecer no papel;
            // `cloneNode` também a copia, então ela precisa sair da versão que
            // efetivamente encabeça o primeiro fragmento.
            copia.classList.remove("somente-tela-na-impressao");
            fragmento.append(copia);
          });
        }
        const tabelaNova = tabelaOriginal.cloneNode(false) as HTMLTableElement;
        const colgroup = tabelaOriginal.querySelector(":scope > colgroup");
        const cabecalho = tabelaOriginal.querySelector(":scope > thead");
        if (colgroup) tabelaNova.append(colgroup.cloneNode(true));
        if (cabecalho) tabelaNova.append(cabecalho.cloneNode(true));
        const corpo = document.createElement("tbody");
        linhas.slice(inicio, fim).forEach((linha) => corpo.append(linha.cloneNode(true)));
        tabelaNova.append(corpo);
        fragmento.append(tabelaNova);
        conjunto.append(fragmento);
      }

      envoltorio.insertAdjacentElement("afterend", conjunto);
      envoltorio.classList.add("somente-tela-na-impressao");
      aplicarLarguras(conjunto);
      criados.push(conjunto);
      originais.push(envoltorio);
      const cartao = envoltorio.closest<HTMLElement>(".analytics-card");
      if (cartao) {
        cartao.classList.add("analytics-card--fragmentada-impressao");
        cartoes.add(cartao);
      }
      if (secao) {
        secao.classList.add("relatorio-secao--fragmentada-impressao");
        secoes.add(secao);
      }
    });

  return () => {
    criados.forEach((elemento) => elemento.remove());
    originais.forEach((elemento) => elemento.classList.remove("somente-tela-na-impressao"));
    cartoes.forEach((cartao) => cartao.classList.remove("analytics-card--fragmentada-impressao"));
    secoes.forEach((secao) => secao.classList.remove("relatorio-secao--fragmentada-impressao"));
  };
}

/**
 * Painel de contagem rotulada, centralizado, com título próprio.
 *
 * Mora aqui, e não junto dos painéis analíticos, porque quem o usa é a ficha do
 * usuário — que **não** virou painel analítico e não tem por que mudar de forma
 * junto com eles. Suas colunas são próprias de propósito.
 */
export function painelContagem(
  titulo: string,
  itens: { rotulo: string; total: number }[],
  rotuloColuna = "Item",
): string {
  if (!itens.length) {
    return `<section class="stat-panel"><h2>${escapeHtml(titulo)}</h2>
      <p class="empty">Nada registrado neste escopo.</p></section>`;
  }
  const html = tabela(
    [
      { rotulo: rotuloColuna, largura: 65, truncar: true, alinhamento: "centro" },
      { rotulo: "Quantidade", largura: 35, alinhamento: "centro", nowrap: true },
    ],
    itens.map((i) => [i.rotulo, { texto: String(i.total), numerica: true }]),
    "Nada registrado neste escopo.",
    // Sem fragmento: o painel é item de `.stat-grid`, e dentro de um item de
    // grid o WebKitGTK ignora o `break-inside` das caixas de dentro — medido
    // em `tools/impressao` (`stat-panel-fragmentado` × `stat-panel-inteiro`:
    // uma folha a mais, e a mesma linha partida). Quem protege aqui é o
    // `break-inside: avoid` do próprio `.stat-panel`.
    { listagem: true },
  );
  return `<section class="stat-panel"><h2>${escapeHtml(titulo)}</h2>${html}</section>`;
}

/**
 * Aplica as larguras declaradas em `Coluna.largura`.
 *
 * A CSP recusa `style=""` no markup, e a CSSOM é a via usada para aplicar os
 * valores calculados. Chamada de
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

// ── Busca que filtra enquanto se digita ───────────────────────────────────

/**
 * A espera do teclado antes de refazer a busca.
 *
 * Um número só, aqui, porque a listagem de apuratórios o tinha escrito à mão e
 * as outras duas telas com campo de busca repetiriam a escolha sem saber dela.
 */
export const ESPERA_BUSCA_MS = 250;

/**
 * Liga um campo que filtra a listagem **enquanto se digita**.
 *
 * Duas coisas que a listagem de apuratórios ensinou, e que este helper carrega
 * para quem chegar depois:
 *
 *   - `aoDigitar` corre a **cada tecla**, e é onde o estado do módulo se
 *     atualiza. Quem exportar o CSV ou abrir o modal de filtros dentro dos
 *     250 ms tem de levar o termo que está no campo, não o anterior — só o
 *     redesenho é que espera.
 *   - Enter dispara na hora, cancelando o timer pendente. Quem digita e aperta
 *     Enter não deve esperar mais um quarto de segundo.
 *
 * Quem redesenha é o chamador, e **só a área de resultados**: refazer a tela
 * inteira recria o `<input>` e tira o foco a cada tecla, que é o defeito
 * clássico do recurso.
 *
 * Devolve `cancelar()`. O render que troca de tela precisa chamá-lo, senão um
 * timer pendente redesenha uma área que já não está no documento.
 */
export function ligarBuscaInstantanea(
  input: HTMLInputElement | null,
  aoBuscar: (termo: string) => void,
  opcoes: { aoDigitar?: (termo: string) => void; espera?: number } = {},
): () => void {
  const espera = opcoes.espera ?? ESPERA_BUSCA_MS;
  let temporizador: number | null = null;

  const cancelar = () => {
    if (temporizador !== null) window.clearTimeout(temporizador);
    temporizador = null;
  };

  input?.addEventListener("input", () => {
    opcoes.aoDigitar?.(input.value);
    cancelar();
    temporizador = window.setTimeout(() => {
      temporizador = null;
      aoBuscar(input.value);
    }, espera);
  });

  input?.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    cancelar();
    opcoes.aoDigitar?.(input.value);
    aoBuscar(input.value);
  });

  return cancelar;
}

/** Cede um quadro ao navegador, para o que acabou de mudar chegar à tela. */
export function proximoQuadro(): Promise<void> {
  return new Promise((resolver) => requestAnimationFrame(() => resolver()));
}

/**
 * Quantas chamadas de `comCarregamento` estão em curso.
 *
 * O login abre o véu e, lá dentro, chama `renderRoute`, que o abre de novo.
 * Sem contar, o `finally` de dentro esconderia o véu com a ação de fora ainda
 * correndo — e a tela ficaria "pronta" no meio do carregamento.
 */
let veusAbertos = 0;

/**
 * Cobre a tela enquanto a ação corre, e **garante que o véu pinta antes dela**.
 *
 * O quadro cedido antes de chamar `acao` não é zelo: quase todo trabalho pesado
 * daqui é síncrono — a paginação do mapa mede layout linha a linha, a impressão
 * fragmenta tabelas e converte canvas em PNG. Sem ceder, o navegador entra no
 * bloqueio antes de ter pintado o véu, e o loader só apareceria depois de a
 * ação terminar, que é quando ele não serve para nada.
 *
 * `passo` existe pela mesma razão, e é o que salva o caso mais duro: durante um
 * bloqueio longo a animação do giro **congela junto**, então quem informa que
 * algo avançou é a mensagem mudando de fase. Ela também cede um quadro.
 *
 * O `gatilho` é opcional e mantém o padrão que já existia antes deste helper —
 * botão desabilitado com o rótulo trocado. Quando há os dois, o véu diz o que
 * está acontecendo e o botão impede o segundo clique.
 */
export async function comCarregamento<T>(
  mensagem: string,
  acao: (passo: (texto: string) => Promise<void>) => Promise<T>,
  gatilho?: HTMLButtonElement | null,
): Promise<T> {
  const veu = document.querySelector<HTMLElement>("#carregando");
  const alvo = veu?.querySelector<HTMLElement>(".carregando__mensagem");
  const rotulo = gatilho?.textContent ?? "";

  const escrever = (texto: string) => {
    if (alvo) alvo.textContent = texto;
    if (gatilho) gatilho.textContent = texto;
  };

  if (gatilho) gatilho.disabled = true;
  escrever(mensagem);
  veusAbertos += 1;
  if (veu) veu.hidden = false;

  try {
    await proximoQuadro();
    return await acao(async (texto) => {
      escrever(texto);
      await proximoQuadro();
    });
  } finally {
    veusAbertos -= 1;
    if (veu && veusAbertos === 0) veu.hidden = true;
    if (gatilho) {
      gatilho.disabled = false;
      gatilho.textContent = rotulo;
    }
  }
}

/**
 * O par que marca a área de resultados como "atualizando".
 *
 * `aria-busy` é para quem ouve a tela; `.is-loading` é o esmaecido de
 * `.area-resultados` no CSS. Andam sempre juntos, e por isso moram aqui: cada
 * tela que os escrevesse por conta própria acabaria esquecendo um dos dois.
 */
export function marcarCarregando(area: HTMLElement | null, ligado: boolean): void {
  if (!area) return;
  if (ligado) area.setAttribute("aria-busy", "true");
  else area.removeAttribute("aria-busy");
  area.classList.toggle("is-loading", ligado);
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

export type OrientacaoImpressao = "retrato" | "paisagem";
export type PerfilImpressao = "tabular" | "analitico" | "documento";

export type OpcoesImpressao = {
  orientacao?: OrientacaoImpressao;
  perfil?: PerfilImpressao;
  /** Região da tela substituída pelo HTML completo devolvido por `aoImprimir`. */
  seletorSubstituido?: string;
};

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
  opcoes: OpcoesImpressao = {},
): void {
  const configuracao = {
    orientacao: opcoes.orientacao ?? "retrato",
    perfil: opcoes.perfil ?? "tabular",
    seletorSubstituido: opcoes.seletorSubstituido,
  } satisfies Required<Pick<OpcoesImpressao, "orientacao" | "perfil">> &
    Pick<OpcoesImpressao, "seletorSubstituido">;
  const imprimir = document.querySelector<HTMLButtonElement>("#btn-imprimir");
  if (imprimir && aoImprimir) {
    imprimir.addEventListener("click", async () => {
      const bloco = document.createElement("div");
      bloco.className = "bloco-impressao";
      let naTela: HTMLElement | null = null;
      try {
        if (!configuracao.seletorSubstituido) {
          throw new Error("a área paginada da impressão não foi identificada");
        }
        naTela = document.querySelector<HTMLElement>(configuracao.seletorSubstituido);
        if (!naTela) throw new Error("a área paginada da impressão não foi encontrada");
        // O véu começa aqui, e não em `abrirImpressao`: `aoImprimir` carrega o
        // filtro inteiro em lotes de 200 — até 25 idas ao backend em série antes
        // de haver documento nenhum para preparar. É a espera mais longa deste
        // caminho, e era a que não aparecia.
        bloco.innerHTML = await comCarregamento(
          "Carregando os registros…",
          () => aoImprimir(),
          imprimir,
        );
        aplicarLarguras(bloco);
        // A cópia completa ocupa exatamente a posição da listagem paginada. Os
        // títulos que pertencem ao recorte também ficam dentro do alvo, por isso
        // não aparecem duplicados no papel.
        naTela.insertAdjacentElement("afterend", bloco);
        naTela.classList.add("ocultar-na-impressao");
        await abrirImpressao(configuracao.orientacao, configuracao.perfil, imprimir);
      } catch (erro) {
        // Sem isto a falha vira rejeição não tratada: o botão volta ao normal e
        // nada explica por que o diálogo de impressão não abriu.
        notificar(
          erro instanceof Error ? erro.message : "Falha ao preparar a impressão.",
          "erro",
        );
      } finally {
        bloco.remove();
        naTela?.classList.remove("ocultar-na-impressao");
      }
    });
  } else {
    // Este caminho servia seis telas — Painel, Estatísticas, Designações,
    // Anual, Mapa Salvo e o detalhe do usuário — e era `void`: nem desabilitava
    // o botão, nem esperava o `await`. O retorno visual mora dentro de
    // `abrirImpressao`, que os dois caminhos atravessam; aqui basta passar o
    // botão para ele ser desabilitado enquanto o diálogo está aberto.
    imprimir?.addEventListener("click", () =>
      void abrirImpressao(configuracao.orientacao, configuracao.perfil, imprimir),
    );
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

/**
 * Prepara o relatório comum para A4. O WebKitGTK ignora `@page size`, por isso
 * orientação e margens seguem ao page setup nativo; Chromium/WebView2 usam
 * um `<style>` temporário no fallback.
 */
async function abrirImpressao(
  orientacao: OrientacaoImpressao,
  perfil: PerfilImpressao,
  gatilho?: HTMLButtonElement | null,
): Promise<void> {
  let folhaFallback: HTMLStyleElement | undefined;
  let limparCabecalho = () => {};
  let limparOrdem = () => {};
  let limparFragmentos = () => {};
  let limparImagens = () => {};
  // A classe existe só pelo quadro em que a caixa do gráfico fica maior que o
  // painel; sem ela, uma janela estreita mostra a barra de rolagem aparecer e
  // sumir antes de o diálogo abrir.
  const classePerfil = `impressao-perfil--${perfil}`;
  document.body.classList.add("preparando-impressao", "relatorio-pdf-ativo", classePerfil);
  try {
    // O véu é o único retorno visual das seis telas que não passam `aoImprimir`,
    // e as duas mensagens separam o que é trabalho nosso do que é espera pelo
    // operador: o comando de impressão só volta quando o diálogo nativo fecha, e
    // sem dizer isso o véu pareceria travado justamente na parte mais longa.
    await comCarregamento(
      "Preparando o documento…",
      async (passo) => {
        // Primeiro de todos: o cabeçalho é o que vem ANTES da tabela, e tanto o
        // adiamento quanto o clone em blocos têm de nascer já com ele no fluxo.
        limparCabecalho = await inserirCabecalhoInstitucional(perfil);
        // Antes de fragmentar, para que o clone em blocos já nasça na posição final.
        limparOrdem = adiarBlocosParaOFimDaImpressao();
        limparFragmentos = fragmentarTabelasParaImpressao();
        prepararGraficosParaImpressao();
        // Um quadro para a folha deitada e a nova geometria dos gráficos valerem
        // antes de o documento virar papel. O canvas já foi redesenhado pelo
        // `resize()`, que é síncrono; o layout ao redor dele não.
        await proximoQuadro();
        // Só agora: o PNG tem de sair do canvas já com a geometria da folha.
        limparImagens = await congelarGraficosParaImpressao();

        await passo("Abrindo a impressão…");
        const comando = orientacao === "paisagem" ? "print_report_landscape" : "print_portrait";
        const resposta = await call(comando);
        if (!resposta.ok) throw new Error(resposta.error ?? "Falha ao abrir a impressão.");
        if (resposta.data) return;

        // Fora do Linux não há GtkPageSetup. Uma folha construída em
        // `adoptedStyleSheets` desapareceu dos PDFs reais embora as classes de
        // sessão chegassem ao papel; um `<style>` no documento participa da
        // árvore de estilos que Chromium/WebView2 efetivamente imprime.
        const direcao = orientacao === "paisagem" ? "landscape" : "portrait";
        folhaFallback = document.createElement("style");
        folhaFallback.dataset.folhaRelatorio = "";
        folhaFallback.textContent = `@page { size: A4 ${direcao}; margin: 15mm 12mm; }`;
        document.head.append(folhaFallback);
        await proximoQuadro();
        window.print();
      },
      gatilho,
    );
  } catch (erro) {
    notificar(erro instanceof Error ? erro.message : "Falha ao abrir a impressão.", "erro");
  } finally {
    folhaFallback?.remove();
    limparImagens();
    limparFragmentos();
    limparOrdem();
    limparCabecalho();
    restaurarGraficosDepoisDaImpressao();
    document.body.classList.remove("preparando-impressao", "relatorio-pdf-ativo", classePerfil);
  }
}
