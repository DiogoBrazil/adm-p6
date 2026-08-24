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

/** `<option>` já escapado, marcando o selecionado. */
export function option(valor: string, rotulo: string, selecionado: boolean): string {
  return `<option value="${escapeHtml(valor)}"${selecionado ? " selected" : ""}>${escapeHtml(rotulo)}</option>`;
}

// ── Tabelas ───────────────────────────────────────────────────────────

/** Célula de tabela: o texto já sai escapado, o alinhamento é opcional. */
export type Celula = string | { texto: string; numerica?: boolean; classe?: string };

/** Linha: só as células, ou as células com uma classe no `<tr>` (`atrasado`). */
export type Linha = Celula[] | { celulas: Celula[]; classe?: string };

/**
 * Tabela escapada, com o invólucro de rolagem horizontal que o CSS espera.
 *
 * Substitui o `tableFrom` do `main.ts`, que escapava o valor da célula mas
 * interpolava o **nome da coluna** cru — e os nomes de coluna vinham das
 * chaves do JSON do backend.
 */
export function tabela(colunas: string[], linhas: Linha[], vazio = "Nada a exibir."): string {
  if (!linhas.length) return `<p class="empty">${escapeHtml(vazio)}</p>`;
  const celula = (c: Celula) => {
    if (typeof c === "string") return `<td>${escapeHtml(c)}</td>`;
    const classes = [c.numerica ? "num" : "", c.classe ?? ""].filter(Boolean).join(" ");
    return `<td${classes ? ` class="${escapeHtml(classes)}"` : ""}>${escapeHtml(c.texto)}</td>`;
  };
  const linha = (l: Linha) => {
    const celulas = Array.isArray(l) ? l : l.celulas;
    const classe = Array.isArray(l) ? "" : (l.classe ?? "");
    return `<tr${classe ? ` class="${escapeHtml(classe)}"` : ""}>${celulas.map(celula).join("")}</tr>`;
  };
  return `<div class="table-wrap"><table>
      <thead><tr>${colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map(linha).join("")}</tbody>
    </table></div>`;
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
    alert(resposta.error ?? "Falha ao gravar o arquivo.");
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
 * Controle de página para as listagens paginadas.
 *
 * Existe porque as duas telas de lista pediam uma página grande e paravam por
 * aí: usuários pedia 200 (o teto do backend) com 235 militares no efetivo, e
 * processos pedia 100 com 128 processos. O resto não era alcançável por
 * caminho nenhum — não havia próxima página, e a contagem no cabeçalho dizia
 * um número maior que o de linhas na tela.
 *
 * Devolve string vazia quando tudo cabe numa página, para não poluir a tela.
 */
export function paginacao(pagina: number, porPagina: number, total: number): string {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return "";
  const primeiro = (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);
  return `<div class="paginacao">
    <button class="outline small" id="btn-pagina-anterior"${pagina <= 1 ? " disabled" : ""}>Anterior</button>
    <span>${primeiro}–${ultimo} de ${total} (página ${pagina} de ${paginas})</span>
    <button class="outline small" id="btn-pagina-proxima"${pagina >= paginas ? " disabled" : ""}>Próxima</button>
  </div>`;
}

/** Liga os botões de `paginacao`. `aoMudar` recebe a página escolhida. */
export function ligarPaginacao(pagina: number, aoMudar: (pagina: number) => void): void {
  document
    .querySelector<HTMLButtonElement>("#btn-pagina-anterior")
    ?.addEventListener("click", () => aoMudar(pagina - 1));
  document
    .querySelector<HTMLButtonElement>("#btn-pagina-proxima")
    ?.addEventListener("click", () => aoMudar(pagina + 1));
}

/** Liga os botões de `barraDeExportacao`. `aoExportar` pode ser assíncrono. */
export function ligarExportacao(aoExportar?: () => unknown | Promise<unknown>): void {
  document
    .querySelector<HTMLButtonElement>("#btn-imprimir")
    ?.addEventListener("click", () => window.print());

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
