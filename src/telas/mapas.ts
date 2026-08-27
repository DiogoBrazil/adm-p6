// Mapa do período e mapas salvos.
//
// A tela chamava três comandos inexistentes — `reports_generate_monthly_map`,
// `reports_generate_complete_map` e `reports_process_types`. Os dois primeiros
// eram o mesmo relatório com um sentinela textual ("TODOS") no lugar do
// escopo; hoje são `reports_map_rows` com `apuratorio_ids`, e "completo" é
// simplesmente não marcar nenhum. O terceiro devolvia as espécies existentes:
// isso é o catálogo de apuratórios.
//
// A REGRA DO PERÍODO
//
// O mapa não lista "o que foi instaurado no mês". Lista o que a Seção tinha em
// mãos: tudo que ainda estava aberto ao fim do período, inclusive instaurado
// em anos anteriores, mais o que foi concluído dentro dele. Quem implementa é
// `maps_reports::repository::map_rows`; aqui só se escolhe o período.

import { call, type MapRow, type SavedMapListItem } from "../api";
import {
  barraDeExportacao,
  baixarCsvBase64,
  escapeHtml,
  ITENS_POR_PAGINA,
  ligarExportacao,
  ligarPaginacao,
  notificar,
  option,
  paginacao,
  paginaValida,
  tabela,
  type Coluna,
} from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA_MENSAL = "/mapas/mensal";
export const ROTA_SALVOS = "/mapas/anteriores";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Apuratorio = { id: string; sigla: string; nome: string };

const hoje = new Date();
let mesSelecionado = hoje.getMonth() + 1;
let anoSelecionado = hoje.getFullYear();
let apuratoriosSelecionados: string[] = [];
let linhasGeradas: MapRow[] | null = null;

/** Último dia do mês, sem depender de tabela de dias: o dia 0 do mês seguinte. */
function periodo(mes: number, ano: number): { inicio: string; fim: string } {
  const dois = (n: number) => String(n).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { inicio: `${ano}-${dois(mes)}-01`, fim: `${ano}-${dois(mes)}-${dois(ultimoDia)}` };
}

function tituloDoMapa(apuratorios: Apuratorio[]): string {
  const escopo =
    apuratoriosSelecionados.length === 0
      ? "todos os apuratórios"
      : apuratorios
          .filter((a) => apuratoriosSelecionados.includes(a.id))
          .map((a) => a.sigla)
          .join(", ");
  return `Mapa de ${MESES[mesSelecionado - 1]}/${anoSelecionado} — ${escopo}`;
}

// Dez colunas de conteúdo imprevisível: o mapa é o documento emitido, e
// espremer coluna aqui é pior que rolar. Por isso `larga: true` nas três
// chamadas abaixo, e nenhuma largura declarada — ver o cabeçalho de `Coluna`.
const COLUNAS_MAPA = [
  "Apuratório", "Identificação", "Unidade", "Natureza", "Instauração",
  "Conclusão", "Responsável", "Envolvidos", "Vencimento", "Último andamento",
];

const linhaMapa = (l: MapRow) => [
  l.apuratorio_sigla,
  l.rotulo,
  l.unidade_origem,
  l.natureza_fato ?? "—",
  l.data_instauracao,
  l.data_conclusao ?? "em andamento",
  l.responsavel_nome ?? "—",
  l.envolvidos ?? "—",
  l.prazo_vencimento ?? "—",
  l.ultimo_andamento ?? "—",
];

export async function renderMapaMensal(ctx: ContextoTela): Promise<void> {
  const [anos, catalogo] = await Promise.all([
    call("reports_available_years").then((r) => r.data ?? []),
    call("legal_catalogs_list", { catalogo: "apuratorios" }).then((r) => r.data ?? []),
  ]);
  const apuratorios: Apuratorio[] = catalogo.map((l) => ({
    id: String(l.id),
    sigla: String(l.sigla ?? ""),
    nome: String(l.nome ?? ""),
  }));
  const anosDisponiveis = anos.length ? anos : [anoSelecionado];

  const concluidos = linhasGeradas?.filter((l) => l.data_conclusao !== null).length ?? 0;
  const andamento = (linhasGeradas?.length ?? 0) - concluidos;

  const resultado = !linhasGeradas
    ? ""
    : `
      <div class="page-head">
        <div>
          <h2>${escapeHtml(tituloDoMapa(apuratorios))}</h2>
          <p>${linhasGeradas.length} no período · ${andamento} em andamento · ${concluidos} concluídos no mês</p>
        </div>
        <div class="page-head-right">
          ${ctx.podeEscrever() ? `<button id="btn-salvar-mapa" class="small">Salvar este mapa</button>` : ""}
        </div>
      </div>
      ${tabela(COLUNAS_MAPA, linhasGeradas.map(linhaMapa), "Nada em mãos neste período.", {
        larga: true,
      })}`;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Mapa do Período</h1>
          <p>
            O que estava em mãos no período: aberto até o fim dele — inclusive de
            anos anteriores — mais o concluído dentro dele.
          </p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, csv: !!linhasGeradas })}</div>
      </div>

      <form id="filtro-mapa" class="filtro-bar">
        <label>Mês
          <select name="mes">
            ${MESES.map((m, i) => option(String(i + 1), m, i + 1 === mesSelecionado)).join("")}
          </select>
        </label>
        <label>Ano
          <select name="ano">
            ${anosDisponiveis.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
          </select>
        </label>
        <fieldset class="filtro-apuratorios">
          <legend>Apuratórios <span class="hint">(nenhum marcado = mapa completo)</span></legend>
          ${apuratorios
            .map(
              (a) => `<label class="checkbox-inline" title="${escapeHtml(a.nome)}">
                <input type="checkbox" name="apuratorio" value="${escapeHtml(a.id)}"
                       ${apuratoriosSelecionados.includes(a.id) ? "checked" : ""} />
                ${escapeHtml(a.sigla)}
              </label>`,
            )
            .join("")}
        </fieldset>
        <button type="submit">Gerar mapa</button>
      </form>

      ${resultado}
    </section>
  `);

  document.querySelector<HTMLFormElement>("#filtro-mapa")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    mesSelecionado = Number(form.get("mes"));
    anoSelecionado = Number(form.get("ano"));
    apuratoriosSelecionados = form.getAll("apuratorio").map(String);

    const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);
    const resposta = await call("reports_map_rows", {
      request: { periodo_inicio: inicio, periodo_fim: fim, apuratorio_ids: apuratoriosSelecionados },
    });
    if (!resposta.ok) {
      notificar(resposta.error ?? "Falha ao gerar o mapa.", "erro");
      return;
    }
    linhasGeradas = resposta.data ?? [];
    void renderMapaMensal(ctx);
  });

  document.querySelector<HTMLButtonElement>("#btn-salvar-mapa")?.addEventListener("click", async () => {
    if (!linhasGeradas) return;
    const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);
    // O mapa salvo é snapshot do que foi emitido: recalcular depois daria outro
    // resultado, e é por isso que ele é salvo. `apuratorio_id` só é preenchido
    // quando o mapa é de uma espécie só.
    const resposta = await call("reports_save_map", {
      request: {
        titulo: tituloDoMapa(apuratorios),
        apuratorio_id: apuratoriosSelecionados.length === 1 ? apuratoriosSelecionados[0] : null,
        periodo_inicio: inicio,
        periodo_fim: fim,
        total_processos: linhasGeradas.length,
        total_concluidos: concluidos,
        total_andamento: andamento,
        dados_mapa: linhasGeradas,
      },
    });
    notificar(
      resposta.ok ? "Mapa salvo." : (resposta.error ?? "Falha ao salvar."),
      resposta.ok ? "sucesso" : "erro",
    );
  });

  ligarExportacao(async () => {
    const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);
    const resposta = await call("reports_export_csv", {
      request: { periodo_inicio: inicio, periodo_fim: fim, apuratorio_ids: apuratoriosSelecionados },
    });
    if (!resposta.ok || !resposta.data) {
      notificar(resposta.error ?? "Falha ao exportar.", "erro");
      return;
    }
    return baixarCsvBase64(resposta.data.nome_arquivo, resposta.data.conteudo);
  });
}

// ── Mapas salvos ──────────────────────────────────────────────────────

let mapaAberto: string | null = null;
let paginaSalvos = 1;

/** As oito colunas dividem 100% da largura. As contagens não quebram linha. */
const COLUNAS_SALVOS: Coluna[] = [
  { rotulo: "Título", largura: 26, truncar: true },
  { rotulo: "Apuratório", largura: 11, alinhamento: "centro", nowrap: true },
  { rotulo: "Período", largura: 19, alinhamento: "centro", nowrap: true },
  { rotulo: "Total", largura: 7, alinhamento: "centro", nowrap: true },
  { rotulo: "Em andamento", largura: 10, alinhamento: "centro", nowrap: true },
  { rotulo: "Concluídos", largura: 9, alinhamento: "centro", nowrap: true },
  { rotulo: "Gerado por", largura: 12, truncar: true },
  { rotulo: "Em", largura: 6, alinhamento: "centro", nowrap: true },
];

export async function renderMapasSalvos(ctx: ContextoTela): Promise<void> {
  if (mapaAberto) return renderMapaSalvo(ctx, mapaAberto);

  const resposta = await call("reports_saved_maps", {
    page: paginaSalvos,
    perPage: ITENS_POR_PAGINA,
  });
  const mapas = resposta.data?.items ?? [];
  const total = resposta.data?.total ?? 0;

  // Excluir o único mapa da última página deixaria a tela vazia sem dizer por quê.
  const corrigida = paginaValida(paginaSalvos, ITENS_POR_PAGINA, total);
  if (corrigida !== paginaSalvos) {
    paginaSalvos = corrigida;
    return renderMapasSalvos(ctx);
  }

  // O `id` na linha é o que o clique casa. Por posição, paginar abriria o mapa
  // errado — e um mapa salvo parece com o outro na tabela.
  const linhas = mapas.map((m: SavedMapListItem) => ({
    classe: "clicavel",
    id: m.id,
    celulas: [
      m.titulo,
      m.apuratorio_sigla ?? "todos",
      `${m.periodo_inicio} a ${m.periodo_fim}`,
      { texto: String(m.total_processos), numerica: true },
      { texto: String(m.total_andamento), numerica: true },
      { texto: String(m.total_concluidos), numerica: true },
      m.gerado_por ?? "—",
      m.created_at.slice(0, 10),
    ],
  }));

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Mapas Salvos <span class="badge">${total}</span></h1>
          <p>Cada mapa é o registro do que foi emitido, não um recálculo.</p></div>
      </div>
      ${tabela(COLUNAS_SALVOS, linhas, "Nenhum mapa salvo.", { listagem: true })}
      ${paginacao("mapas-salvos", paginaSalvos, ITENS_POR_PAGINA, total)}
    </section>
  `);

  ligarPaginacao("mapas-salvos", paginaSalvos, (nova) => {
    paginaSalvos = nova;
    void renderMapasSalvos(ctx);
  });

  document.querySelectorAll<HTMLTableRowElement>("tr[data-linha]").forEach((linha) => {
    linha.addEventListener("click", () => {
      mapaAberto = linha.dataset.linha ?? null;
      void renderMapasSalvos(ctx);
    });
  });
}

async function renderMapaSalvo(ctx: ContextoTela, id: string): Promise<void> {
  const mapa = (await call("reports_get_saved_map", { id })).data;
  if (!mapa) {
    mapaAberto = null;
    ctx.shell(`<section class="panel"><p class="error">Mapa não encontrado.</p></section>`);
    return;
  }

  // O snapshot foi gravado como a lista de linhas do mapa. Mapas gravados por
  // versões anteriores podem trazer outra forma — nesse caso mostramos o
  // conteúdo cru em vez de fingir que sabemos lê-lo.
  const linhas = Array.isArray(mapa.dados_mapa) ? (mapa.dados_mapa as MapRow[]) : null;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(mapa.titulo)}</h1>
          <p>
            ${escapeHtml(`${mapa.periodo_inicio} a ${mapa.periodo_fim}`)} ·
            ${mapa.total_processos} no período · ${mapa.total_andamento} em andamento ·
            ${mapa.total_concluidos} concluídos · gerado por ${escapeHtml(mapa.gerado_por ?? "—")}
          </p>
        </div>
        <div class="page-head-right">
          <button id="btn-voltar" class="secondary small">Voltar</button>
          ${ctx.podeEscrever() ? `<button id="btn-excluir" class="danger small">Excluir</button>` : ""}
          ${barraDeExportacao({ imprimir: true })}
        </div>
      </div>
      ${
        linhas
          ? tabela(COLUNAS_MAPA, linhas.map(linhaMapa), "O mapa foi salvo vazio.", { larga: true })
          : `<pre>${escapeHtml(JSON.stringify(mapa.dados_mapa, null, 2))}</pre>`
      }
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#btn-voltar")?.addEventListener("click", () => {
    mapaAberto = null;
    void renderMapasSalvos(ctx);
  });

  document.querySelector<HTMLButtonElement>("#btn-excluir")?.addEventListener("click", async () => {
    if (!confirm("Excluir este mapa salvo?")) return;
    const resposta = await call("reports_delete_saved_map", { id });
    if (!resposta.ok) {
      notificar(resposta.error ?? "Falha ao excluir.", "erro");
      return;
    }
    mapaAberto = null;
    void renderMapasSalvos(ctx);
  });

  ligarExportacao();
}
