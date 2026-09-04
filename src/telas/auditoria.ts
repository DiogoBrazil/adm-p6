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
//
// A tela responde quatro perguntas, e só elas: QUANDO, QUEM, O QUE FOI FEITO e
// SOBRE O QUÊ. Nome de tabela, verbo de SQL e UUID não sobem para a listagem —
// ficam no detalhe, para quem precisa rastrear até o banco. Quem escreve as
// duas colunas do meio é o comando que executou a ação, no momento em que ela
// aconteceu (`auditoria.acao` e `auditoria.assunto`, migration 0018); aqui só
// se exibe, com uma frase de reserva para o que foi gravado antes disso.

import { call, type AuditDetailItem } from "../api";
import {
  avisarSeCortado,
  barraDeExportacao,
  baixarPlanilha,
  carregarTudo,
  escapeHtml,
  formatarDataHora,
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
 * As quatro colunas dividem 100% da largura.
 *
 * "Quando" é data e hora e não pode quebrar. As outras três truncam com o
 * inteiro no `title` — nome de militar e rótulo de apuratório são longos.
 *
 * Saíram "Entidade" e "Diff": a primeira era nome de tabela, e a segunda
 * imprimia "—" em todos os 74 registros do banco, porque diff só é gravado nas
 * mudanças de configuração. As duas continuam no detalhe.
 */
const COLUNAS: Coluna[] = [
  { rotulo: "Quando", largura: 18, alinhamento: "centro", nowrap: true },
  { rotulo: "Quem fez", largura: 26, truncar: true },
  { rotulo: "O que foi feito", largura: 28, truncar: true },
  { rotulo: "Sobre o quê", largura: 28, truncar: true },
];

let filtros = { entidade: "", operacao: "", usuarioId: "" };
let pagina = 1;
let registroAberto: AuditDetailItem | null = null;

const autor = (i: AuditDetailItem) =>
  formatarQualificacaoMilitar(i.usuario_posto, i.usuario_matricula, i.usuario_nome);

/**
 * O que foi feito. Sai de `acao`, escrita pelo comando.
 *
 * A reserva vale só para o que foi gravado antes da `0018` e a migration não
 * conseguiu descrever: ali existe apenas o verbo de SQL, e "Alterou" é tudo que
 * dá para dizer com honestidade.
 */
const oQueFoiFeito = (i: AuditDetailItem) =>
  i.acao ?? `${OPERACAO_EM_PORTUGUES[i.operacao] ?? "Registrou"} — ${i.entidade}`;

/**
 * Sobre o quê. Sai de `assunto`, congelado no momento da ação.
 *
 * Vazio quer dizer uma coisa só, e vale dizê-la: a linha já tinha sido apagada
 * antes da `0018` poder nomeá-la. São 8 dos 74 registros antigos — prazos e
 * designações, que são exclusão física. Daqui para frente não acontece mais.
 */
const sobreOQue = (i: AuditDetailItem) => i.assunto ?? "registro já removido";

const OPERACAO_EM_PORTUGUES: Record<string, string> = {
  CREATE: "Cadastrou",
  UPDATE: "Alterou",
  DELETE: "Excluiu",
};

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
  celulas: [formatarDataHora(i.ocorrido_em), autor(i), oQueFoiFeito(i), sobreOQue(i)],
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
          <p>${total} registro(s) no escopo. Clique numa linha para ver os detalhes.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, planilha: !!itens.length })}</div>
      </div>

      <form id="filtro-auditoria" class="filtro-bar">
        <label>Sobre o quê
          <select name="entidade">
            <option value="">Tudo</option>
            ${(estatisticas?.por_entidade ?? [])
              .map((e) =>
                option(e.entidade, `${e.rotulo} (${e.total})`, e.entidade === filtros.entidade),
              )
              .join("")}
          </select>
        </label>
        <label>Tipo de ação
          <select name="operacao">
            <option value="">Todas</option>
            ${OPERACOES.map((o) => option(o, OPERACAO_EM_PORTUGUES[o] ?? o, o === filtros.operacao)).join("")}
          </select>
        </label>
        <label>Quem fez
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

      <div id="conteudo-paginado-auditoria">
        ${
          resposta.ok
            ? tabela(COLUNAS, itens.map(linhaDaTabela), "Nenhum registro neste escopo.", {
                viewport: true,
                listagem: true,
              })
            : `<p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar a auditoria.")}</p>`
        }
        ${paginacao("auditoria", pagina, ITENS_POR_PAGINA, total)}
      </div>
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

  // A planilha e o papel levam o filtro inteiro, não os dez da tela. A trilha cresce
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
      // A planilha leva as quatro colunas da tela e mais o par entidade/registro:
      // quem exporta costuma ser quem vai rastrear até o banco.
      const autorSelecionado = comConta.find((u) => u.conta_id === filtros.usuarioId);
      return baixarPlanilha(`auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        {
          nome: "Auditoria",
          titulo: "Trilha de auditoria",
          metadados: [
            { rotulo: "Entidade", valor: filtros.entidade || "Todas" },
            { rotulo: "Operação", valor: filtros.operacao || "Todas" },
            {
              rotulo: "Autor",
              valor: autorSelecionado
                  ? formatarQualificacaoMilitar(
                    autorSelecionado.posto_graduacao_sigla,
                    autorSelecionado.matricula,
                    autorSelecionado.nome,
                  )
                : "Todos",
            },
            { rotulo: "Registros", valor: String(todos.length) },
          ],
          colunas: [
            { rotulo: "Quando", tipo: "data_hora", largura: 20, alinhamento: "centro" },
            { rotulo: "Quem fez", largura: 34 },
            { rotulo: "O que foi feito", largura: 36 },
            { rotulo: "Sobre o quê", largura: 42 },
            { rotulo: "Entidade", largura: 24 },
            { rotulo: "Registro", largura: 38 },
          ],
          linhas: todos.map((i) => ({
            celulas: [
              i.ocorrido_em,
              autor(i),
              oQueFoiFeito(i),
              sobreOQue(i),
              i.entidade,
              i.registro_id,
            ],
          })),
          congelar_colunas: 1,
        },
      ]);
    },
    async () => {
      const { itens: todos, cortado } = await todosDoFiltro();
      avisarSeCortado(cortado);
      return tabela(COLUNAS, todos.map(linhaDaTabela), "Nenhum registro neste escopo.", {
        listagem: true,
        // Oito: a folha em retrato leva nove destas linhas no pior caso
        // (`medicao-auditoria`), e um bloco que não cabe volta a partir a
        // linha. Com quatro saíam dois cabeçalhos por folha.
        linhasPorFragmentoImpressao: 8,
      });
    },
    {
      orientacao: "retrato",
      perfil: "tabular",
      seletorSubstituido: "#conteudo-paginado-auditoria",
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
        <div><h1>Registro de auditoria</h1><p>${escapeHtml(oQueFoiFeito(item))}</p></div>
        <div class="page-head-right"><button id="btn-voltar" class="secondary small">Voltar</button></div>
      </div>

      <div class="table-wrap"><table class="detail-table"><tbody>
        ${campo("Quando", formatarDataHora(item.ocorrido_em))}
        ${campo("Quem fez", autor(item))}
        ${campo("O que foi feito", oQueFoiFeito(item))}
        ${campo("Sobre o quê", sobreOQue(item))}
      </tbody></table></div>

      ${htmlAlteracoes(item)}

      <h2>Rastreio</h2>
      <p class="empty">Estes dois identificam a linha no banco, e só servem para
      conferência técnica.</p>
      <div class="table-wrap"><table class="detail-table"><tbody>
        ${campo("Tabela", item.entidade)}
        ${campo("Registro", item.registro_id)}
        ${campo("Operação", item.operacao)}
      </tbody></table></div>
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#btn-voltar")?.addEventListener("click", () => {
    registroAberto = null;
    void renderAuditoria(ctx);
  });
}

/**
 * O diff de uma mudança de configuração, em português.
 *
 * O formato gravado por `legal_catalogs::commands::diferenca` é
 * `{"campo": {"de": <antes>, "para": <depois>}}`; a configuração de apuratório
 * grava só os valores novos. Os dois viravam um despejo de JSON na tela.
 */
function htmlAlteracoes(item: AuditDetailItem): string {
  if (!item.alteracoes || typeof item.alteracoes !== "object") {
    return `<h2>O que mudou</h2>
      <p class="empty">Esta ação não registrou detalhamento. Ele é gravado nas
      mudanças de configuração, que alteram o comportamento futuro do sistema.</p>`;
  }

  const valor = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "vazio";
    if (typeof v === "boolean") return v ? "sim" : "não";
    return String(v);
  };
  const linhas = Object.entries(item.alteracoes as Record<string, unknown>).map(([campo, mudanca]) => {
    const par = mudanca as { de?: unknown; para?: unknown } | null;
    const texto =
      par && typeof par === "object" && "para" in par
        ? `de ${valor(par.de)} para ${valor(par.para)}`
        : valor(mudanca);
    return `<tr><th>${escapeHtml(campo)}</th><td>${escapeHtml(texto)}</td></tr>`;
  });

  return `<h2>O que mudou</h2>
    <div class="table-wrap"><table class="detail-table"><tbody>${linhas.join("")}</tbody></table></div>`;
}
