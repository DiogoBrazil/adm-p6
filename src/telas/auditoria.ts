// Trilha de auditoria.
//
// A tela vinha do renderizador genérico do `main.ts`: tabela montada das
// chaves do JSON, e filtros que mandavam `tabela` e `usuario_id` — nomes que o
// backend não recebe. Os argumentos de comando do Tauri v2 são camelCase, e o
// comando declara `entidade` e `usuarioId`, então nenhum dos três filtros
// funcionava. Falha em runtime, sem erro de build: é o caso que o cliente
// tipado existe para pegar.
//
// Os dois filtros de lista deixam de ser caixa de texto. Entidade sai de
// `audit_statistics`, que já sabe quais existem; o autor sai da lista de
// contas — ninguém digita um UUID à mão.

import { call, type AuditDetailItem } from "../api";
import { barraDeExportacao, baixarCsv, escapeHtml, ligarExportacao, option, tabela } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/auditoria";

const OPERACOES = ["CREATE", "UPDATE", "DELETE"];
const LIMITE = 200;

let filtros = { entidade: "", operacao: "", usuarioId: "" };
let registroAberto: AuditDetailItem | null = null;

const autor = (i: AuditDetailItem) =>
  i.usuario_nome ? `${i.usuario_posto ?? ""} ${i.usuario_nome}`.trim() : "—";

export async function renderAuditoria(ctx: ContextoTela): Promise<void> {
  if (registroAberto) return renderDetalhe(ctx, registroAberto);

  const [resposta, estatisticas, usuarios] = await Promise.all([
    call("audit_list", {
      limit: LIMITE,
      offset: 0,
      entidade: filtros.entidade || null,
      operacao: filtros.operacao || null,
      usuarioId: filtros.usuarioId || null,
    }),
    call("audit_statistics", {}).then((r) => r.data),
    // Lista de opções do filtro de autor. `users_list` pagina e trava em 200,
    // então pedir 500 devolvia 200 calado — e um autor fora dos 200 primeiros
    // sumia do filtro. Só quem tem conta é autor de auditoria (o recorte é
    // logo abaixo), mas o recorte precisa partir da lista inteira.
    call("users_list_ativos", {}).then((r) => r.data ?? []),
  ]);

  const itens = resposta.data ?? [];
  const comConta = usuarios.filter((u) => u.conta_id !== null);

  const linhas = itens.map((i) => [
    i.ocorrido_em.replace("T", " ").slice(0, 19),
    i.entidade,
    i.operacao,
    autor(i),
    i.alteracoes ? "sim" : "—",
  ]);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Auditoria</h1>
          <p>Últimos ${LIMITE} registros do escopo. Clique numa linha para ver o diff.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, csv: !!itens.length })}</div>
      </div>

      <form id="filtro-auditoria" class="filtro-bar">
        <label>Entidade
          <select name="entidade">
            <option value="">Todas</option>
            ${(estatisticas?.por_entidade ?? [])
              .map((e) =>
                option(e.entidade, `${e.entidade} (${e.total})`, e.entidade === filtros.entidade),
              )
              .join("")}
          </select>
        </label>
        <label>Operação
          <select name="operacao">
            <option value="">Todas</option>
            ${OPERACOES.map((o) => option(o, o, o === filtros.operacao)).join("")}
          </select>
        </label>
        <label>Autor
          <select name="usuarioId">
            <option value="">Todos</option>
            ${comConta
              .map((u) =>
                option(
                  u.conta_id ?? "",
                  `${u.posto_graduacao} ${u.nome}`,
                  u.conta_id === filtros.usuarioId,
                ),
              )
              .join("")}
          </select>
        </label>
        <button type="submit">Filtrar</button>
        <button type="button" class="secondary" id="limpar-filtro">Limpar</button>
      </form>

      ${
        resposta.ok
          ? tabela(
              ["Quando", "Entidade", "Operação", "Autor", "Diff"],
              linhas.map((celulas) => ({ celulas, classe: "clicavel" })),
              "Nenhum registro neste escopo.",
            )
          : `<p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar a auditoria.")}</p>`
      }
    </section>
  `);

  document.querySelector<HTMLFormElement>("#filtro-auditoria")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget as HTMLFormElement);
    filtros = {
      entidade: String(formulario.get("entidade") ?? ""),
      operacao: String(formulario.get("operacao") ?? ""),
      usuarioId: String(formulario.get("usuarioId") ?? ""),
    };
    void renderAuditoria(ctx);
  });

  document.querySelector<HTMLButtonElement>("#limpar-filtro")?.addEventListener("click", () => {
    filtros = { entidade: "", operacao: "", usuarioId: "" };
    void renderAuditoria(ctx);
  });

  document.querySelectorAll<HTMLTableRowElement>("tr.clicavel").forEach((linha, indice) => {
    linha.addEventListener("click", () => {
      registroAberto = itens[indice] ?? null;
      void renderAuditoria(ctx);
    });
  });

  ligarExportacao(() =>
    baixarCsv(
      `auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Quando", "Entidade", "Registro", "Operacao", "Autor"],
      itens.map((i) => [i.ocorrido_em, i.entidade, i.registro_id, i.operacao, autor(i)]),
    ),
  );
}

function renderDetalhe(ctx: ContextoTela, item: AuditDetailItem): void {
  // `.detail-table` é a convenção que as outras telas de detalhe já usam:
  // rótulo no `th`, valor no `td`.
  const campo = (rotulo: string, valor: string) =>
    `<tr><th>${escapeHtml(rotulo)}</th><td>${escapeHtml(valor)}</td></tr>`;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Registro de auditoria</h1><p>${escapeHtml(item.entidade)} · ${escapeHtml(item.operacao)}</p></div>
        <div class="page-head-right"><button id="btn-voltar" class="secondary small">Voltar</button></div>
      </div>

      <div class="table-wrap"><table class="detail-table"><tbody>
        ${campo("Quando", item.ocorrido_em.replace("T", " ").slice(0, 19))}
        ${campo("Entidade", item.entidade)}
        ${campo("Registro", item.registro_id)}
        ${campo("Operação", item.operacao)}
        ${campo("Autor", autor(item))}
      </tbody></table></div>

      <h2>Alterações</h2>
      ${
        item.alteracoes
          ? `<pre>${escapeHtml(JSON.stringify(item.alteracoes, null, 2))}</pre>`
          : `<p class="empty">Esta operação não registrou diff. O diff é gravado nas mudanças de configuração, que alteram o comportamento futuro do sistema.</p>`
      }
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#btn-voltar")?.addEventListener("click", () => {
    registroAberto = null;
    void renderAuditoria(ctx);
  });
}
