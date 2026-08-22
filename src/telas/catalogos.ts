// Tela de administração dos catálogos — montada inteiramente a partir de
// `legal_catalogs_definitions`.
//
// A versão anterior tinha 21 `crudConfigs` escritos à mão e ~66 chamadas
// (`legal_catalogs_list_crimes`, `legal_catalogs_save_crime`, …), uma trinca
// por catálogo. O backend passou a expor 7 comandos genéricos sobre um registro
// de metadados, e este módulo consome esse registro: rótulos, tipo de campo,
// catálogo referenciado e o texto que explica o efeito de cada atributo
// semântico saem de lá. Acrescentar um catálogo no Rust passa a fazer a tela
// aparecer sozinha, sem tocar em nada aqui.

import { call, type Catalogo, type Coluna } from "../api";
import { cellDisplay, escapeHtml, option } from "../dom";

/** O que a tela precisa do shell da aplicação, sem importar `main.ts` de volta. */
export type ContextoTela = {
  shell: (html: string) => void;
  podeEscrever: () => boolean;
};

/** Linha de catálogo: as colunas do registro, mais `id` e `ativo`. */
type Linha = Record<string, unknown> & { id: string; ativo: boolean };

let definicoesCache: Catalogo[] | null = null;

/** Carrega e memoriza as definições. Elas não mudam durante a sessão. */
export async function carregarDefinicoes(): Promise<Catalogo[]> {
  if (definicoesCache) return definicoesCache;
  const resposta = await call("legal_catalogs_definitions");
  definicoesCache = resposta.data ?? [];
  return definicoesCache;
}

export function esquecerDefinicoes(): void {
  definicoesCache = null;
}

export const PREFIXO_ROTA = "/catalogos/";

/** Uma rota por catálogo, derivada do registro do backend. */
export function rotasDeCatalogo(definicoes: Catalogo[]) {
  return definicoes.map((cat) => ({
    path: `${PREFIXO_ROTA}${cat.chave}`,
    label: cat.rotulo,
    group: "Catálogos",
  }));
}

export function chaveDaRota(path: string): string | null {
  return path.startsWith(PREFIXO_ROTA) ? path.slice(PREFIXO_ROTA.length) : null;
}

// ── metadados → formulário ──────────────────────────────────────────────────

function ehOpcional(coluna: Coluna): boolean {
  return (
    coluna.tipo === "texto_opcional" ||
    coluna.tipo === "inteiro_opcional" ||
    coluna.tipo === "referencia_opcional"
  );
}

function ehReferencia(coluna: Coluna): boolean {
  return coluna.tipo === "referencia" || coluna.tipo === "referencia_opcional";
}

/**
 * Rótulo legível de uma linha, para os selects de referência e para a coluna
 * resolvida na tabela.
 *
 * Junta as colunas textuais do catálogo alvo — é o que produz "SR Sindicância
 * Regular" para apuratórios e "I portar-se inconvenientemente…" para
 * transgressões, em vez do UUID cru que a tela antiga mostrava.
 */
function rotuloDaLinha(cat: Catalogo, linha: Linha): string {
  const textuais = cat.colunas
    .filter((c) => c.tipo === "texto" || c.tipo === "texto_opcional")
    .map((c) => String(linha[c.nome] ?? "").trim())
    .filter(Boolean);
  const rotulo = textuais.join(" — ");
  return rotulo || String(linha.id);
}

/** Carrega as opções de todos os catálogos referenciados por este. */
async function carregarReferencias(
  cat: Catalogo,
  definicoes: Catalogo[],
): Promise<Record<string, { value: string; label: string }[]>> {
  const alvos = [...new Set(cat.colunas.filter(ehReferencia).map((c) => c.alvo!))];
  const pares = await Promise.all(
    alvos.map(async (alvo) => {
      const destino = definicoes.find((d) => d.chave === alvo);
      // Lista de OPÇÕES: só ativos. A leitura de um registro existente é outra
      // coisa e não filtra `ativo` — um processo de 2019 continua exibindo o
      // catálogo que foi desativado em 2026.
      const resposta = await call("legal_catalogs_list", { catalogo: alvo });
      const linhas = (resposta.data ?? []) as Linha[];
      const opcoes = linhas.map((l) => ({
        value: String(l.id),
        label: destino ? rotuloDaLinha(destino, l) : String(l.id),
      }));
      return [alvo, opcoes] as const;
    }),
  );
  return Object.fromEntries(pares);
}

function campo(
  coluna: Coluna,
  linha: Linha | null,
  referencias: Record<string, { value: string; label: string }[]>,
): string {
  const valor = linha?.[coluna.nome];
  const obrigatorio = ehOpcional(coluna) ? "" : " required";
  const ajuda = coluna.efeito
    ? `<small class="campo-efeito">${escapeHtml(coluna.efeito)}</small>`
    : "";

  if (coluna.tipo === "booleano") {
    return `
      <div class="campo">
        <label class="checkbox">
          <input name="${coluna.nome}" type="checkbox"${valor === true ? " checked" : ""} />
          ${escapeHtml(coluna.rotulo)}
        </label>
        ${ajuda}
      </div>`;
  }

  if (ehReferencia(coluna)) {
    const opcoes = referencias[coluna.alvo ?? ""] ?? [];
    const atual = valor === null || valor === undefined ? "" : String(valor);
    return `
      <div class="campo">
        <label>${escapeHtml(coluna.rotulo)}
          <select name="${coluna.nome}"${obrigatorio}>
            <option value=""></option>
            ${opcoes.map((o) => option(o.value, o.label, o.value === atual)).join("")}
          </select>
        </label>
        ${ajuda}
      </div>`;
  }

  const numero = coluna.tipo === "inteiro" || coluna.tipo === "inteiro_opcional";
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `
    <div class="campo">
      <label>${escapeHtml(coluna.rotulo)}
        <input name="${coluna.nome}" type="${numero ? "number" : "text"}"
               value="${escapeHtml(texto)}"${obrigatorio} />
      </label>
      ${ajuda}
    </div>`;
}

/** FormData → o objeto `valores` que `legal_catalogs_save` espera. */
function montarValores(cat: Catalogo, form: FormData): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const coluna of cat.colunas) {
    if (coluna.tipo === "booleano") {
      valores[coluna.nome] = form.get(coluna.nome) === "on";
      continue;
    }
    const bruto = String(form.get(coluna.nome) ?? "").trim();
    if (coluna.tipo === "inteiro" || coluna.tipo === "inteiro_opcional") {
      valores[coluna.nome] = bruto ? Number(bruto) : null;
      continue;
    }
    valores[coluna.nome] = bruto || null;
  }
  return valores;
}

// ── telas ───────────────────────────────────────────────────────────────────

type Estado = { incluirInativos: boolean; busca: string };
const estado: Estado = { incluirInativos: false, busca: "" };

export async function renderCatalogo(chave: string, ctx: ContextoTela): Promise<void> {
  const definicoes = await carregarDefinicoes();
  const cat = definicoes.find((d) => d.chave === chave);
  if (!cat) {
    ctx.shell(`<section class="panel"><p class="error">Catálogo desconhecido: ${escapeHtml(chave)}</p></section>`);
    return;
  }

  const resposta = await call("legal_catalogs_list", {
    catalogo: chave,
    incluirInativos: estado.incluirInativos,
  });
  if (!resposta.ok) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar.")}</p></section>`);
    return;
  }

  let linhas = (resposta.data ?? []) as Linha[];
  const referencias = await carregarReferencias(cat, definicoes);

  if (estado.busca) {
    const termo = estado.busca.toLowerCase();
    linhas = linhas.filter((l) =>
      cat.colunas.some((c) => String(l[c.nome] ?? "").toLowerCase().includes(termo)),
    );
  }

  const rotuloReferencia = (coluna: Coluna, valor: unknown) =>
    referencias[coluna.alvo ?? ""]?.find((o) => o.value === String(valor))?.label ??
    (valor === null || valor === undefined ? "" : String(valor));

  const podeEscrever = ctx.podeEscrever();

  const corpo = linhas.length
    ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${cat.colunas.map((c) => `<th>${escapeHtml(c.rotulo)}</th>`).join("")}
              <th>Situação</th>
              ${podeEscrever ? "<th>Ações</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${linhas
              .map(
                (linha) => `
              <tr${linha.ativo ? "" : ' class="inativo"'}>
                ${cat.colunas
                  .map(
                    (c) =>
                      `<td>${escapeHtml(
                        ehReferencia(c) ? rotuloReferencia(c, linha[c.nome]) : cellDisplay(linha[c.nome]),
                      )}</td>`,
                  )
                  .join("")}
                <td>${linha.ativo ? "ativo" : "inativo"}</td>
                ${
                  podeEscrever
                    ? `<td class="row-actions">
                         <button class="secondary small" data-editar="${escapeHtml(linha.id)}">Editar</button>
                         ${
                           linha.ativo
                             ? `<button class="danger small" data-desativar="${escapeHtml(linha.id)}">Desativar</button>`
                             : `<button class="secondary small" data-reativar="${escapeHtml(linha.id)}">Reativar</button>`
                         }
                       </td>`
                    : ""
                }
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : `<p class="empty">Nenhum registro.</p>`;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(cat.rotulo)}</h1>
          <p>${linhas.length} registro(s)</p>
        </div>
        ${podeEscrever ? `<button id="novo">Novo</button>` : ""}
      </div>
      <div class="filtros">
        <input id="busca" type="search" placeholder="Filtrar…" value="${escapeHtml(estado.busca)}" />
        <label class="checkbox">
          <input id="inativos" type="checkbox"${estado.incluirInativos ? " checked" : ""} />
          Mostrar inativos
        </label>
      </div>
      ${podeEscrever ? "" : `<p class="readonly">Perfil somente leitura.</p>`}
      ${corpo}
    </section>
  `);

  const recarregar = () => void renderCatalogo(chave, ctx);

  const busca = document.querySelector<HTMLInputElement>("#busca");
  busca?.addEventListener("change", () => {
    estado.busca = busca.value.trim();
    recarregar();
  });
  document.querySelector<HTMLInputElement>("#inativos")?.addEventListener("change", (e) => {
    estado.incluirInativos = (e.currentTarget as HTMLInputElement).checked;
    recarregar();
  });

  if (!podeEscrever) return;

  document.querySelector<HTMLButtonElement>("#novo")?.addEventListener("click", () => {
    void renderFormulario(cat, null, ctx);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const linha = linhas.find((l) => l.id === botao.dataset.editar);
      if (linha) void renderFormulario(cat, linha, ctx);
    });
  });

  // Desativar, não apagar: o item some dos cadastros novos e continua visível
  // nos registros históricos que já o usam.
  document.querySelectorAll<HTMLButtonElement>("[data-desativar]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.dataset.desativar!;
      if (!confirm(`Desativar este item de "${cat.rotulo}"?`)) return;
      const r = await call("legal_catalogs_deactivate", { catalogo: cat.chave, id });
      if (!r.ok) alert(r.error ?? "Falha ao desativar.");
      recarregar();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-reativar]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const r = await call("legal_catalogs_reactivate", {
        catalogo: cat.chave,
        id: botao.dataset.reativar!,
      });
      if (!r.ok) alert(r.error ?? "Falha ao reativar.");
      recarregar();
    });
  });
}

async function renderFormulario(
  cat: Catalogo,
  linha: Linha | null,
  ctx: ContextoTela,
  erro = "",
): Promise<void> {
  const definicoes = await carregarDefinicoes();
  const referencias = await carregarReferencias(cat, definicoes);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${linha ? "Editar" : "Novo"} — ${escapeHtml(cat.rotulo)}</h1></div>
        <button class="secondary" id="cancelar">Cancelar</button>
      </div>
      <form id="form-catalogo" class="crud-form">
        ${cat.colunas.map((c) => campo(c, linha, referencias)).join("")}
        ${erro ? `<p class="error">${escapeHtml(erro)}</p>` : ""}
        <div class="form-actions"><button type="submit">Salvar</button></div>
      </form>
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#cancelar")?.addEventListener("click", () => {
    void renderCatalogo(cat.chave, ctx);
  });

  document.querySelector<HTMLFormElement>("#form-catalogo")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget as HTMLFormElement);
    const resposta = await call("legal_catalogs_save", {
      request: {
        catalogo: cat.chave,
        id: linha?.id ?? null,
        valores: montarValores(cat, form),
      },
    });
    if (!resposta.ok) {
      void renderFormulario(cat, linha, ctx, resposta.error ?? "Falha ao salvar.");
      return;
    }
    void renderCatalogo(cat.chave, ctx);
  });
}
