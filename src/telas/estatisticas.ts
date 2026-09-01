// Visão geral dos apuratórios.
//
// A rota chamava `reports_by_type`, que nunca existiu no backend novo. Não é
// omissão: "por tipo" era `GROUP BY tipo_detalhe`, uma coluna de texto que a
// remodelagem eliminou. O `dashboard_summary` já devolve as quatro quebras que
// a tela precisa — por apuratório, natureza, unidade e ano — todas rotuladas
// pelo catálogo, e nenhuma delas conhece sigla.

import {
  call,
  type ContagemRotulada,
  type EnquadramentoContagem,
} from "../api";
import {
  cartaoAnalitico,
  graficoBarras,
  graficoDonut,
  graficoEnquadramentos,
  graficoLinha,
  graficoSituacao,
  kpiAnalitico,
  montarCartoesAnaliticos,
  type GraficoSpec,
} from "../graficos";
import { barraDeExportacao, baixarCsv, escapeHtml, ligarExportacao, tabela } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/estatisticas/processos";

function tabelaContagem(
  itens: ContagemRotulada[],
  rotuloColuna = "Item",
  vazio = "Nada registrado neste escopo.",
): string {
  return tabela(
    [
      { rotulo: rotuloColuna, largura: 72, truncar: true },
      { rotulo: "Quantidade", largura: 28, alinhamento: "centro", nowrap: true },
    ],
    itens.map((item) => [item.rotulo, { texto: String(item.total), numerica: true }]),
    vazio,
    { listagem: true },
  );
}

/**
 * Painel de contagem no mesmo padrão centralizado das demais tabelas.
 *
 * Tem colunas próprias, e não as do `tabelaContagem` dos cartões analíticos:
 * quem o usa hoje é a ficha do usuário, que não virou painel analítico e não
 * tem por que mudar de forma junto com eles.
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
  const html = tabela(
    [
      { rotulo: rotuloColuna, largura: 65, truncar: true, alinhamento: "centro" },
      { rotulo: "Quantidade", largura: 35, alinhamento: "centro", nowrap: true },
    ],
    itens.map((i) => [i.rotulo, { texto: String(i.total), numerica: true }]),
    "Nada registrado neste escopo.",
    { listagem: true },
  );
  return `<section class="stat-panel"><h2>${escapeHtml(titulo)}</h2>${html}</section>`;
}

export async function renderEstatisticasProcessos(ctx: ContextoTela): Promise<void> {
  const [resumoResposta, situacaoResposta, responsaveisResposta] = await Promise.all([
    call("dashboard_summary"),
    call("reports_status_by_apuratorio", { filter: { apuratorio_ids: [] } }),
    call("reports_by_responsible", { filter: { apuratorio_ids: [], limit: 50 } }),
  ]);
  const resumo = resumoResposta.data;
  const situacao = situacaoResposta.data ?? [];
  const responsaveis = responsaveisResposta.data ?? [];
  if (!resumo || !resumoResposta.ok || !situacaoResposta.ok || !responsaveisResposta.ok) {
    ctx.shell(`<section class="panel"><h1>Visão Geral dos Apuratórios</h1>
      <p class="error">${escapeHtml(resumoResposta.error ?? situacaoResposta.error ?? responsaveisResposta.error ?? "Não foi possível carregar o resumo.")}</p></section>`);
    return;
  }

  const situacaoGrafico = situacao.map((item) => ({
    sigla: item.sigla,
    nome: item.nome,
    tipo: item.tipo_apuratorio_nome,
    emAndamento: item.em_andamento,
    concluidos: item.concluidos,
  }));
  const specs: GraficoSpec[] = [
    graficoSituacao("visao-situacao", situacaoGrafico),
    graficoLinha("visao-evolucao", resumo.por_ano),
    graficoBarras("visao-unidades", resumo.por_unidade, { limitar: true }),
    graficoBarras("visao-naturezas", resumo.por_natureza, { limitar: true }),
    graficoBarras("visao-responsaveis", responsaveis, { limitar: true }),
  ];
  const tabelaSituacao = tabela(
    [
      { rotulo: "Apuratório", largura: 30, truncar: true },
      { rotulo: "Tipo", largura: 24, truncar: true },
      { rotulo: "Em andamento", largura: 18, alinhamento: "centro", nowrap: true },
      { rotulo: "Concluídos", largura: 14, alinhamento: "centro", nowrap: true },
      { rotulo: "Total", largura: 14, alinhamento: "centro", nowrap: true },
    ],
    situacao.map((item) => [
      `${item.sigla} — ${item.nome}`,
      item.tipo_apuratorio_nome,
      { texto: String(item.em_andamento), numerica: true },
      { texto: String(item.concluidos), numerica: true },
      { texto: String(item.total), numerica: true },
    ]),
    "Nenhum apuratório registrado.",
    { listagem: true },
  );

  ctx.shell(`
    <section class="panel panel--analytics">
      <div class="page-head">
        <div>
          <h1>Visão Geral dos Apuratórios</h1>
          <p>Panorama de todos os apuratórios ativos.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, csv: true })}</div>
      </div>

      <div class="analytics-kpis">
        ${kpiAnalitico(resumo.total, "Total de apuratórios")}
        ${kpiAnalitico(resumo.em_andamento, "Em andamento", { tom: "andamento" })}
        ${kpiAnalitico(resumo.concluidos, "Concluídos", { tom: "sucesso" })}
        ${kpiAnalitico(resumo.prazos_vencidos, "Prazos vencidos", {
          tom: resumo.prazos_vencidos ? "alerta" : "sucesso",
        })}
      </div>

      <div class="analytics-grid">
        ${cartaoAnalitico({ id: "visao-situacao", titulo: "Situação por apuratório", descricao: "Processos e procedimentos segmentados por andamento e conclusão.", grafico: specs[0]!, tabela: tabelaSituacao, classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "visao-evolucao", titulo: "Evolução das instaurações", grafico: specs[1]!, tabela: tabelaContagem(resumo.por_ano, "Ano"), classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "visao-unidades", titulo: "Unidades de origem", grafico: specs[2]!, tabela: tabelaContagem(resumo.por_unidade, "Unidade"), limitado: resumo.por_unidade.length > 12 })}
        ${cartaoAnalitico({ id: "visao-naturezas", titulo: "Natureza geral do fato", grafico: specs[3]!, tabela: tabelaContagem(resumo.por_natureza, "Natureza"), limitado: resumo.por_natureza.length > 12 })}
        ${cartaoAnalitico({ id: "visao-responsaveis", titulo: "Responsabilidade vigente", descricao: "Apuratórios vinculados ao responsável vigente; não representa o histórico de designações.", grafico: specs[4]!, tabela: tabelaContagem(responsaveis, "Responsável"), limitado: responsaveis.length > 12, classe: "analytics-card--wide" })}
      </div>
    </section>
  `);

  montarCartoesAnaliticos(specs);

  ligarExportacao(() => {
    const bloco = (nome: string, itens: ContagemRotulada[]) =>
      itens.map((i) => [nome, i.rotulo, i.total]);
    return baixarCsv(
      `visao-geral-apuratorios-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Quebra", "Item", "Quantidade"],
      [
        ["Totais", "No total", resumo.total],
        ["Totais", "Em andamento", resumo.em_andamento],
        ["Totais", "Concluidos", resumo.concluidos],
        ["Totais", "Com prazo vencido", resumo.prazos_vencidos],
        ...bloco("Por apuratorio", resumo.por_apuratorio),
        ...bloco("Por natureza geral do fato", resumo.por_natureza),
        ...bloco("Por unidade de origem", resumo.por_unidade),
        ...bloco("Por ano de instauracao", resumo.por_ano),
      ],
    );
  }, undefined, { paisagem: true });
}

// =============================================================================
// Estatísticas dos apuratórios — painéis de escopo configurável
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
    <label class="filtro-chip-check" title="${escapeHtml(a.nome)}">
      <input type="checkbox" name="apuratorio" value="${escapeHtml(a.id)}"
             ${apuratoriosSelecionados.includes(a.id) ? "checked" : ""} />
      <span>${escapeHtml(a.sigla)}</span>
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
function tabelaEnquadramento(
  itens: EnquadramentoContagem[],
  rotuloColuna: string,
): string {
  const linhas = itens.map((i) => [
    i.rotulo,
    i.classificacao ?? "—",
    // O corte manual em 90 caracteres saiu daqui: o `tabela()` agora trunca por
    // CSS e entrega o texto legal inteiro no `title`. Cortar na string perdia o
    // resto de vez, e a coluna que exige mais contexto era justamente esta.
    i.descricao,
    { texto: String(i.total), numerica: true },
  ]);
  return tabela(
    [
      { rotulo: rotuloColuna, largura: 18, truncar: true },
      { rotulo: "Classificação", largura: 16, truncar: true },
      { rotulo: "Descrição", largura: 58, truncar: true },
      { rotulo: "Qtd.", largura: 8, alinhamento: "centro", nowrap: true },
    ],
    linhas,
    "Nada registrado neste escopo.",
    { listagem: true },
  );
}

export async function renderEstatisticasProcedimentos(ctx: ContextoTela): Promise<void> {
  const [anosResposta, catalogoResposta] = await Promise.all([
    call("reports_available_years"),
    call("legal_catalogs_list", { catalogo: "apuratorios" }),
  ]);
  if (!anosResposta.ok || !catalogoResposta.ok) {
    ctx.shell(`<section class="panel"><h1>Estatísticas dos Apuratórios</h1>
      <p class="error">${escapeHtml(anosResposta.error ?? catalogoResposta.error ?? "Não foi possível carregar os filtros.")}</p></section>`);
    return;
  }
  const anos = anosResposta.data ?? [];
  const catalogo = catalogoResposta.data ?? [];
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

  const respostas = await Promise.all([
    call("reports_status_by_apuratorio", { filter }),
    call("reports_by_solution", { filter }),
    call("reports_by_evidence_category", { filter }),
    call("reports_transgressoes", { filter }),
    call("reports_infracoes_estatuto", { filter }),
    call("reports_infracoes_penais", { filter }),
    call("reports_driver_ranking", { filter }),
    call("reports_by_nature", { filter }),
  ] as const);
  const falha = respostas.find((resposta) => !resposta.ok);
  if (falha) {
    ctx.shell(`<section class="panel"><h1>Estatísticas dos Apuratórios</h1>
      <p class="error">${escapeHtml(falha.error ?? "Não foi possível carregar os indicadores.")}</p></section>`);
    return;
  }
  const situacao = respostas[0].data ?? [];
  const solucoes = respostas[1].data;
  const categorias = respostas[2].data ?? [];
  const transgressoes = respostas[3].data ?? [];
  const estatuto = respostas[4].data ?? [];
  const penais = respostas[5].data ?? [];
  const condutores = respostas[6].data ?? [];
  const naturezas = respostas[7].data ?? [];

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

  const situacaoGrafico = situacao.map((item) => ({
    sigla: item.sigla,
    nome: item.nome,
    tipo: item.tipo_apuratorio_nome,
    emAndamento: item.em_andamento,
    concluidos: item.concluidos,
  }));
  const condutoresContagem = condutores.map((item) => ({
    rotulo: `${item.posto_graduacao} ${item.matricula} ${item.nome}`,
    total: item.total,
  }));
  const specs: GraficoSpec[] = [
    graficoSituacao("stats-situacao", situacaoGrafico),
    graficoDonut("stats-solucoes-sugeridas", solucoes?.sugeridas ?? []),
    graficoDonut("stats-solucoes-decididas", solucoes?.decididas ?? []),
    graficoBarras("stats-categorias", categorias, { limitar: true }),
    graficoBarras("stats-naturezas", naturezas, { limitar: true }),
    graficoBarras("stats-condutores", condutoresContagem, { limitar: true }),
    graficoEnquadramentos("stats-rdpm", transgressoes),
    graficoEnquadramentos("stats-estatuto", estatuto),
    graficoEnquadramentos("stats-penais", penais),
  ];
  const total = situacao.reduce((soma, item) => soma + item.total, 0);
  const emAndamento = situacao.reduce((soma, item) => soma + item.em_andamento, 0);
  const concluidos = situacao.reduce((soma, item) => soma + item.concluidos, 0);
  const escopoAno = anoSelecionado === null ? "Todos os anos" : String(anoSelecionado);
  const escopoApuratorios = apuratoriosSelecionados.length
    ? `${apuratoriosSelecionados.length} apuratório(s) selecionado(s)`
    : "Todos os apuratórios";

  ctx.shell(`
    <section class="panel panel--analytics">
      <div class="page-head">
        <div>
          <h1>Estatísticas dos Apuratórios</h1>
          <p>O escopo é escolhido no filtro; todos os painéis o respeitam.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true })}</div>
      </div>

      ${barraDeFiltro(anos, apuratorios)}

      <div class="analytics-filter-summary" aria-live="polite">
        <strong>Escopo aplicado:</strong><span>${escapeHtml(escopoAno)}</span><span>·</span><span>${escapeHtml(escopoApuratorios)}</span>
      </div>

      <div class="analytics-kpis">
        ${kpiAnalitico(total, "Total no escopo")}
        ${kpiAnalitico(emAndamento, "Em andamento", { tom: "andamento" })}
        ${kpiAnalitico(concluidos, "Concluídos", { tom: "sucesso" })}
        ${kpiAnalitico(situacao.length, "Espécies com registros")}
      </div>

      <div class="analytics-grid">
        ${cartaoAnalitico({
          id: "stats-situacao",
          titulo: "Situação por apuratório",
          descricao: "Comparação por espécie, tipo e situação derivada da data de conclusão.",
          grafico: specs[0]!,
          tabela: tabela(
          [
            { rotulo: "Apuratório", largura: 34, truncar: true },
            { rotulo: "Tipo", largura: 26, truncar: true },
            { rotulo: "Em andamento", largura: 14, alinhamento: "centro", nowrap: true },
            { rotulo: "Concluídos", largura: 13, alinhamento: "centro", nowrap: true },
            { rotulo: "Total", largura: 13, alinhamento: "centro", nowrap: true },
          ],
          situacaoLinhas,
          "Nenhum apuratório neste escopo.",
          { listagem: true },
          ),
          classe: "analytics-card--wide",
        })}
        ${cartaoAnalitico({ id: "stats-solucoes-sugeridas", titulo: "Soluções sugeridas pelo encarregado", grafico: specs[1]!, tabela: tabelaContagem(solucoes?.sugeridas ?? [], "Solução") })}
        ${cartaoAnalitico({ id: "stats-solucoes-decididas", titulo: "Soluções decididas pela autoridade", grafico: specs[2]!, tabela: tabelaContagem(solucoes?.decididas ?? [], "Solução") })}
        ${cartaoAnalitico({ id: "stats-categorias", titulo: "Categorias de indício", grafico: specs[3]!, tabela: tabelaContagem(categorias, "Categoria"), limitado: categorias.length > 12 })}
        ${cartaoAnalitico({ id: "stats-naturezas", titulo: "Natureza geral do fato", grafico: specs[4]!, tabela: tabelaContagem(naturezas, "Natureza"), limitado: naturezas.length > 12 })}
        ${cartaoAnalitico({
          id: "stats-condutores",
          titulo: "Condutores em sinistro",
          descricao: "Ocorrências cuja natureza geral do fato exige condutor.",
          grafico: specs[5]!,
          tabela: tabela(
          [
            { rotulo: "Militar", largura: 80, truncar: true },
            { rotulo: "Ocorrências", largura: 20, alinhamento: "centro", nowrap: true },
          ],
          condutoresLinhas,
          "Nenhum condutor registrado neste escopo.",
          { listagem: true },
          ),
          limitado: condutores.length > 12,
          classe: "analytics-card--wide",
        })}
        ${cartaoAnalitico({ id: "stats-rdpm", titulo: "Transgressões do RDPM", descricao: "Artigos mais incidentes, coloridos pela classificação de gravidade.", grafico: specs[6]!, tabela: tabelaEnquadramento(transgressoes, "Artigo / inciso"), limitado: transgressoes.length > 12, classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "stats-estatuto", titulo: "Infrações do Estatuto", grafico: specs[7]!, tabela: tabelaEnquadramento(estatuto, "Artigo / inciso"), limitado: estatuto.length > 12, classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "stats-penais", titulo: "Infrações penais", descricao: "A esfera e a espécie permanecem vinculadas a cada ocorrência.", grafico: specs[8]!, tabela: tabelaEnquadramento(penais, "Dispositivo / artigo"), limitado: penais.length > 12, classe: "analytics-card--wide" })}
      </div>
    </section>
  `);

  montarCartoesAnaliticos(specs);

  document.querySelector<HTMLFormElement>("#filtro-stats")?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget as HTMLFormElement);
    const ano = String(formulario.get("ano") ?? "");
    anoSelecionado = ano ? Number(ano) : null;
    apuratoriosSelecionados = formulario.getAll("apuratorio").map(String);
    void renderEstatisticasProcedimentos(ctx);
  });

  ligarExportacao(undefined, undefined, { paisagem: true });
}
