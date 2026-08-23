// Estatísticas de processos.
//
// A rota chamava `reports_by_type`, que nunca existiu no backend novo. Não é
// omissão: "por tipo" era `GROUP BY tipo_detalhe`, uma coluna de texto que a
// remodelagem eliminou. O `dashboard_summary` já devolve as quatro quebras que
// a tela precisa — por apuratório, natureza, unidade e ano — todas rotuladas
// pelo catálogo, e nenhuma delas conhece sigla.

import { call, type ContagemRotulada } from "../api";
import { barraDeExportacao, baixarCsv, escapeHtml, ligarExportacao, tabela } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/estatisticas/processos";

/**
 * Painel de contagem com barra proporcional.
 *
 * A barra é largura relativa ao maior valor do próprio painel — comparar entre
 * painéis não faria sentido, porque as unidades são diferentes (processos por
 * apuratório × processos por ano).
 */
export function painelContagem(
  titulo: string,
  itens: ContagemRotulada[],
  rotuloColuna = "Item",
): string {
  if (!itens.length) {
    return `<section class="stat-panel"><h2>${escapeHtml(titulo)}</h2>
      <p class="empty">Nada registrado neste escopo.</p></section>`;
  }
  const maior = Math.max(...itens.map((i) => i.total), 1);
  const linhas = itens.map((i) => [
    i.rotulo,
    { texto: String(i.total), numerica: true },
    { texto: "", classe: "barra" },
  ]);
  const html = tabela([rotuloColuna, "Quantidade", ""], linhas);
  // A barra entra depois, porque `tabela()` escapa todo conteúdo — e aqui o
  // conteúdo é marcação, não dado.
  let indice = -1;
  const comBarras = html.replace(/<td class="barra"><\/td>/g, () => {
    indice += 1;
    const largura = Math.round(((itens[indice]?.total ?? 0) / maior) * 100);
    return `<td class="barra"><span style="width:${largura}%"></span></td>`;
  });
  return `<section class="stat-panel"><h2>${escapeHtml(titulo)}</h2>${comBarras}</section>`;
}

export async function renderEstatisticasProcessos(ctx: ContextoTela): Promise<void> {
  const resumo = (await call("dashboard_summary")).data;
  if (!resumo) {
    ctx.shell(`<section class="panel"><h1>Estatísticas de Processos</h1>
      <p class="error">Não foi possível carregar o resumo.</p></section>`);
    return;
  }

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Estatísticas de Processos</h1>
          <p>Panorama de todos os processos e procedimentos ativos.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, csv: true })}</div>
      </div>

      <div class="stat-row">
        <div class="stat-card"><span class="stat-value">${resumo.total}</span><span>no total</span></div>
        <div class="stat-card"><span class="stat-value">${resumo.em_andamento}</span><span>em andamento</span></div>
        <div class="stat-card"><span class="stat-value">${resumo.concluidos}</span><span>concluídos</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${resumo.prazos_vencidos}</span><span>com prazo vencido</span></div>
      </div>

      <div class="stat-grid">
        ${painelContagem("Por apuratório", resumo.por_apuratorio, "Apuratório")}
        ${painelContagem("Por natureza do fato", resumo.por_natureza, "Natureza")}
        ${painelContagem("Por unidade de origem", resumo.por_unidade, "Unidade")}
        ${painelContagem("Por ano de instauração", resumo.por_ano, "Ano")}
      </div>
    </section>
  `);

  ligarExportacao(() => {
    const bloco = (nome: string, itens: ContagemRotulada[]) =>
      itens.map((i) => [nome, i.rotulo, i.total]);
    return baixarCsv(
      `estatisticas-processos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Quebra", "Item", "Quantidade"],
      [
        ["Totais", "No total", resumo.total],
        ["Totais", "Em andamento", resumo.em_andamento],
        ["Totais", "Concluidos", resumo.concluidos],
        ["Totais", "Com prazo vencido", resumo.prazos_vencidos],
        ...bloco("Por apuratorio", resumo.por_apuratorio),
        ...bloco("Por natureza do fato", resumo.por_natureza),
        ...bloco("Por unidade de origem", resumo.por_unidade),
        ...bloco("Por ano de instauracao", resumo.por_ano),
      ],
    );
  });
}

// =============================================================================
// Estatísticas de procedimentos — painéis de escopo configurável
//
// Esta tela chamava nove comandos que não existiam:
// `proceedings_in_progress_stats`, `_pads_solutions`, `_ipm_evidence`,
// `_sr_evidence`, `_top10_transgressions`, `_driver_ranking`, `_nature_stats`,
// `_common_crimes` e `_military_crimes`. Não eram esquecimento — cada um
// trazia a espécie escrita no SQL (`IN ('IPM','SR','SV')`, `= 'PADS'`) e as
// categorias de indício pelo nome, que é o hardcode que a remodelagem
// eliminou. Dois deles já devolviam `vec![]` vazio.
//
// No lugar, um filtro só — ano e apuratórios — alimenta todos os painéis. Os
// apuratórios vêm do catálogo, então cadastrar uma espécie nova a faz aparecer
// aqui sozinha. Nenhuma sigla neste arquivo.
// =============================================================================

export const ROTA_PROCEDIMENTOS = "/stats/procedimentos";

type Apuratorio = { id: string; sigla: string; nome: string };

let anoSelecionado: number | null = null;
let apuratoriosSelecionados: string[] = [];

function barraDeFiltro(anos: number[], apuratorios: Apuratorio[]): string {
  const opcaoAno = (a: number) =>
    `<option value="${a}"${a === anoSelecionado ? " selected" : ""}>${a}</option>`;
  const caixa = (a: Apuratorio) => `
    <label class="checkbox-inline" title="${escapeHtml(a.nome)}">
      <input type="checkbox" name="apuratorio" value="${escapeHtml(a.id)}"
             ${apuratoriosSelecionados.includes(a.id) ? "checked" : ""} />
      ${escapeHtml(a.sigla)}
    </label>`;
  return `
    <form id="filtro-stats" class="filtro-bar">
      <label>Ano
        <select name="ano">
          <option value=""${anoSelecionado === null ? " selected" : ""}>Todos</option>
          ${anos.map(opcaoAno).join("")}
        </select>
      </label>
      <fieldset class="filtro-apuratorios">
        <legend>Apuratórios <span class="hint">(nenhum marcado = todos)</span></legend>
        ${apuratorios.map(caixa).join("")}
      </fieldset>
      <button type="submit">Aplicar</button>
    </form>`;
}

/** Enquadramentos: rótulo, classificação vinda de JOIN, texto e contagem. */
function painelEnquadramento(
  titulo: string,
  itens: { rotulo: string; descricao: string; classificacao: string | null; total: number }[],
  rotuloColuna: string,
): string {
  const linhas = itens.map((i) => [
    i.rotulo,
    i.classificacao ?? "—",
    // O texto legal é longo; a coluna fica legível com o corte, e o título
    // do `tabela()` não comporta tooltip — quem precisa do inteiro abre o
    // catálogo.
    i.descricao.length > 90 ? `${i.descricao.slice(0, 90)}…` : i.descricao,
    { texto: String(i.total), numerica: true },
  ]);
  return `<section class="stat-panel"><h2>${escapeHtml(titulo)}</h2>
    ${tabela([rotuloColuna, "Classificação", "Descrição", "Qtd."], linhas, "Nada registrado neste escopo.")}
  </section>`;
}

export async function renderEstatisticasProcedimentos(ctx: ContextoTela): Promise<void> {
  const [anos, catalogo] = await Promise.all([
    call("reports_available_years").then((r) => r.data ?? []),
    call("legal_catalogs_list", { catalogo: "apuratorios" }).then((r) => r.data ?? []),
  ]);
  const apuratorios: Apuratorio[] = catalogo.map((l) => ({
    id: String(l.id),
    sigla: String(l.sigla ?? ""),
    nome: String(l.nome ?? ""),
  }));

  // Um filtro só, para todos os painéis. Lista vazia significa "todos": é o
  // backend que normaliza, e por isso não há sentinela aqui.
  const filter = {
    ano: anoSelecionado,
    apuratorio_ids: apuratoriosSelecionados,
  };

  const [situacao, solucoes, categorias, transgressoes, estatuto, penais, condutores, naturezas] =
    await Promise.all([
      call("reports_status_by_apuratorio", { filter }).then((r) => r.data ?? []),
      call("reports_by_solution", { filter }).then((r) => r.data),
      call("reports_by_evidence_category", { filter }).then((r) => r.data ?? []),
      call("reports_transgressoes", { filter }).then((r) => r.data ?? []),
      call("reports_infracoes_estatuto", { filter }).then((r) => r.data ?? []),
      call("reports_infracoes_penais", { filter }).then((r) => r.data ?? []),
      call("reports_driver_ranking", { filter }).then((r) => r.data ?? []),
      call("reports_by_nature", { filter }).then((r) => r.data ?? []),
    ]);

  const situacaoLinhas = situacao.map((s) => [
    s.sigla,
    s.tipo_apuratorio_nome,
    { texto: String(s.em_andamento), numerica: true },
    { texto: String(s.concluidos), numerica: true },
    { texto: String(s.total), numerica: true },
  ]);

  const condutoresLinhas = condutores.map((c) => [
    `${c.posto_graduacao} ${c.matricula} ${c.nome}`,
    { texto: String(c.total), numerica: true },
  ]);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Estatísticas de Procedimentos</h1>
          <p>O escopo é escolhido no filtro; todos os painéis o respeitam.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true })}</div>
      </div>

      ${barraDeFiltro(anos, apuratorios)}

      <section class="stat-panel">
        <h2>Situação por apuratório</h2>
        ${tabela(
          ["Apuratório", "Tipo", "Em andamento", "Concluídos", "Total"],
          situacaoLinhas,
          "Nenhum processo neste escopo.",
        )}
      </section>

      <div class="stat-grid">
        ${painelContagem("Solução sugerida pelo encarregado", solucoes?.sugeridas ?? [], "Solução")}
        ${painelContagem("Solução decidida pela autoridade", solucoes?.decididas ?? [], "Solução")}
        ${painelContagem("Envolvidos por categoria de indício", categorias, "Categoria")}
        ${painelContagem("Processos por natureza do fato", naturezas, "Natureza")}
      </div>

      <section class="stat-panel">
        <h2>Condutores em sinistro</h2>
        <p class="hint">Alcança os processos cuja natureza do fato exige condutor.</p>
        ${tabela(["Militar", "Ocorrências"], condutoresLinhas, "Nenhum condutor registrado neste escopo.")}
      </section>

      ${painelEnquadramento("Transgressões do RDPM", transgressoes, "Artigo / inciso")}
      ${painelEnquadramento("Infrações do Estatuto", estatuto, "Artigo / inciso")}
      ${painelEnquadramento("Infrações penais", penais, "Dispositivo / artigo")}
    </section>
  `);

  document.querySelector<HTMLFormElement>("#filtro-stats")?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget as HTMLFormElement);
    const ano = String(formulario.get("ano") ?? "");
    anoSelecionado = ano ? Number(ano) : null;
    apuratoriosSelecionados = formulario.getAll("apuratorio").map(String);
    void renderEstatisticasProcedimentos(ctx);
  });

  ligarExportacao();
}
