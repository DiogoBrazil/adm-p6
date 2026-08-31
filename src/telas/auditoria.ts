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
import {
  avisarSeCortado,
  barraDeExportacao,
  baixarCsv,
  carregarTudo,
  escapeHtml,
  formatarQualificacaoMilitar,
  ITENS_POR_PAGINA,
  ligarExportacao,
  ligarPaginacao,
  option,
  paginacao,
  paginaValida,
  tabela,
  type Coluna,
} from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/auditoria";

const OPERACOES = ["CREATE", "UPDATE", "DELETE"];

/**
 * As cinco colunas dividem 100% da largura.
 *
 * "Quando" é data e hora e não pode quebrar; "Entidade" é nome de tabela e
 * pode ser longo, então trunca com o inteiro no `title`.
 */
const COLUNAS: Coluna[] = [
  { rotulo: "Quando", largura: 20, alinhamento: "centro", nowrap: true },
  { rotulo: "Entidade", largura: 30, truncar: true },
  { rotulo: "Operação", largura: 12, alinhamento: "centro", nowrap: true },
  { rotulo: "Autor", largura: 30, truncar: true },
  { rotulo: "Diff", largura: 8, alinhamento: "centro", nowrap: true },
];

let filtros = { entidade: "", operacao: "", usuarioId: "" };
let pagina = 1;
let registroAberto: AuditDetailItem | null = null;

const autor = (i: AuditDetailItem) =>
  formatarQualificacaoMilitar(i.usuario_posto, i.usuario_matricula, i.usuario_nome);

/** Os três filtros da tela, no formato do comando. Um lugar só. */
const argumentosDoFiltro = () => ({
  entidade: filtros.entidade || null,
  operacao: filtros.operacao || null,
  usuarioId: filtros.usuarioId || null,
});

/** Uma linha da tabela. O `id` vira `data-linha`, que é o que o clique casa. */
const linhaDaTabela = (i: AuditDetailItem) => ({
  classe: "clicavel",
  id: i.id,
  celulas: [
    i.ocorrido_em.replace("T", " ").slice(0, 19),
    i.entidade,
    i.operacao,
    autor(i),
    i.alteracoes ? "sim" : "—",
  ],
});

export async function renderAuditoria(ctx: ContextoTela): Promise<void> {
  if (registroAberto) return renderDetalhe(ctx, registroAberto);

  const [resposta, estatisticas, usuarios] = await Promise.all([
    call("audit_list", {
      page: pagina,
      perPage: ITENS_POR_PAGINA,
      ...argumentosDoFiltro(),
    }),
    call("audit_statistics", {}).then((r) => r.data),
    // Lista de opções do filtro de autor. `users_list` pagina e trava em 200,
    // então pedir 500 devolvia 200 calado — e um autor fora dos 200 primeiros
    // sumia do filtro. Só quem tem conta é autor de auditoria (o recorte é
    // logo abaixo), mas o recorte precisa partir da lista inteira.
    call("users_list_ativos", {}).then((r) => r.data ?? []),
  ]);

  const itens = resposta.data?.items ?? [];
  const total = resposta.data?.total ?? 0;
  const comConta = usuarios.filter((u) => u.conta_id !== null);

  // Filtrar pode encolher o escopo abaixo da página em que se estava.
  const corrigida = paginaValida(pagina, ITENS_POR_PAGINA, total);
  if (corrigida !== pagina) {
    pagina = corrigida;
    return renderAuditoria(ctx);
  }

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Auditoria</h1>
          <p>${total} registro(s) no escopo. Clique numa linha para ver o diff.</p>
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
                  formatarQualificacaoMilitar(u.posto_graduacao_sigla, u.matricula, u.nome),
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
          ? tabela(COLUNAS, itens.map(linhaDaTabela), "Nenhum registro neste escopo.", {
              viewport: true,
              listagem: true,
            })
          : `<p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar a auditoria.")}</p>`
      }
      ${paginacao("auditoria", pagina, ITENS_POR_PAGINA, total)}
    </section>
  `);

  ligarPaginacao("auditoria", pagina, (nova) => {
    pagina = nova;
    void renderAuditoria(ctx);
  });

  document.querySelector<HTMLFormElement>("#filtro-auditoria")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget as HTMLFormElement);
    filtros = {
      entidade: String(formulario.get("entidade") ?? ""),
      operacao: String(formulario.get("operacao") ?? ""),
      usuarioId: String(formulario.get("usuarioId") ?? ""),
    };
    // Seguir na 8ª página de um escopo que agora tem 2 mostraria tela vazia.
    pagina = 1;
    void renderAuditoria(ctx);
  });

  document.querySelector<HTMLButtonElement>("#limpar-filtro")?.addEventListener("click", () => {
    filtros = { entidade: "", operacao: "", usuarioId: "" };
    pagina = 1;
    void renderAuditoria(ctx);
  });

  // Casa por id, não por posição. Com o índice, qualquer recorte que mudasse a
  // ordem das linhas — filtrar, paginar, recarregar — abriria o registro errado
  // sem errar visivelmente: uma linha da auditoria parece com a outra.
  document.querySelectorAll<HTMLTableRowElement>("tr[data-linha]").forEach((linha) => {
    linha.addEventListener("click", () => {
      registroAberto = itens.find((i) => i.id === linha.dataset.linha) ?? null;
      void renderAuditoria(ctx);
    });
  });

  // O CSV e o papel levam o filtro inteiro, não os dez da tela. A trilha cresce
  // sem limite, então a carga tem teto — e `avisarSeCortado` o anuncia, porque
  // um recorte silencioso aqui seria indistinguível de "não havia mais nada".
  const todosDoFiltro = () =>
    carregarTudo<AuditDetailItem>(async (page, perPage) => {
      const r = await call("audit_list", { page, perPage, ...argumentosDoFiltro() });
      return r.data ?? null;
    });

  ligarExportacao(
    async () => {
      const { itens: todos, cortado } = await todosDoFiltro();
      avisarSeCortado(cortado);
      return baixarCsv(
        `auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Quando", "Entidade", "Registro", "Operacao", "Autor"],
        todos.map((i) => [i.ocorrido_em, i.entidade, i.registro_id, i.operacao, autor(i)]),
      );
    },
    async () => {
      const { itens: todos, cortado } = await todosDoFiltro();
      avisarSeCortado(cortado);
      return tabela(COLUNAS, todos.map(linhaDaTabela), "Nenhum registro neste escopo.", {
        listagem: true,
      });
    },
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
