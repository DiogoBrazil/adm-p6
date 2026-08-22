// Helpers de renderização compartilhados entre as telas.
//
// O app monta HTML por concatenação de template literal. Isso só é seguro
// enquanto TODO valor interpolado passa por `escapeHtml` — e o `tauri.conf.json`
// ainda está com `"csp": null`, então uma string com HTML vinda do banco
// executaria no contexto do WebView.

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
