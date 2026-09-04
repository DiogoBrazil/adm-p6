// Estatísticas dos apuratórios — o painel de explorar.
//
// POR QUE ESTE ARQUIVO EXISTE, E O QUE ELE NÃO É
//
// Até a rodada 28 eram três telas: "Visão Geral dos Apuratórios", "Relatório
// Anual" e esta. A Visão Geral era o Painel com dois cartões a mais; o
// Relatório Anual era esta tela com o ano fixado. Os mesmos números apareciam
// em três endereços, e — pior — em formas diferentes: a Visão Geral desenhava
// as quebras do acervo **inteiro** (`dashboard_summary` não aceita filtro) ao
// lado de cartões recortados por ano e espécie, dizendo duas coisas sobre a
// mesma pergunta na mesma tela.
//
// Agora há um escopo (ano + apuratórios) e todos os cartões o respeitam. Esta
// tela é a de **explorar**: filtrar, alternar gráfico e tabela, comparar.
//
// O Relatório Anual não é mais um modo daqui. Ele virou documento — capa,
// seções numeradas, só tabelas, sem controle nenhum —, e mora em `anual.ts`.
// São coisas diferentes: uma se opera, a outra se imprime e se arquiva. O que
// as duas compartilham é o **dado**, e por isso `carregarDadosDoEscopo` mora
// aqui e serve às duas: duas cargas separadas divergiriam no dia em que uma
// delas ganhasse um filtro.
//
// Os nove comandos que a tela antiga chamava e que nunca existiram
// (`proceedings_in_progress_stats`, `_pads_solutions`, `_ipm_evidence`…)
// traziam a espécie escrita no SQL (`IN ('IPM','SR','SV')`, `= 'PADS'`). Aqui
// os apuratórios vêm do catálogo: cadastrar uma espécie nova a faz aparecer
// sozinha, e nenhuma sigla é literal neste arquivo.

import {
  call,
  type ContagemRotulada,
  type EnquadramentoContagem,
  type SpreadsheetSheet,
  type StatusPorApuratorio,
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
import { barraDeExportacao, baixarPlanilha, escapeHtml, ligarExportacao, option, tabela } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/stats/procedimentos";

export type Apuratorio = { id: string; sigla: string; nome: string };

/** O escopo que todos os relatórios desta família respeitam. */
export type EscopoRelatorio = { ano: number | null; apuratorio_ids: string[] };

/** Os onze relatórios do escopo, numa carga só. */
export type DadosDoEscopo = {
  situacao: StatusPorApuratorio[];
  porAno: ContagemRotulada[];
  unidades: ContagemRotulada[];
  naturezas: ContagemRotulada[];
  responsaveis: ContagemRotulada[];
  sugeridas: ContagemRotulada[];
  decididas: ContagemRotulada[];
  categorias: ContagemRotulada[];
  condutores: ContagemRotulada[];
  transgressoes: EnquadramentoContagem[];
  estatuto: EnquadramentoContagem[];
  penais: EnquadramentoContagem[];
};

/**
 * Carrega o escopo inteiro. Serve a esta tela e ao Relatório Anual.
 *
 * Devolve `{ dados }` ou `{ erro }` em vez de lançar: as duas telas tratam a
 * falha do mesmo jeito — mostrando a mensagem —, e um `throw` obrigaria as duas
 * a um `try/catch` que não acrescenta nada.
 */
export async function carregarDadosDoEscopo(
  filter: EscopoRelatorio,
): Promise<{ dados: DadosDoEscopo } | { erro: string }> {
  const respostas = await Promise.all([
    call("reports_status_by_apuratorio", { filter }),
    call("reports_by_year", { filter }),
    call("reports_by_unit", { filter }),
    call("reports_by_nature", { filter }),
    call("reports_by_responsible", { filter: { ...filter, limit: 50 } }),
    call("reports_by_solution", { filter }),
    call("reports_by_evidence_category", { filter }),
    call("reports_driver_ranking", { filter }),
    call("reports_transgressoes", { filter }),
    call("reports_infracoes_estatuto", { filter }),
    call("reports_infracoes_penais", { filter }),
  ] as const);
  const falha = respostas.find((resposta) => !resposta.ok);
  if (falha) return { erro: falha.error ?? "Não foi possível carregar os indicadores." };

  const solucoes = respostas[5].data;
  return {
    dados: {
      situacao: respostas[0].data ?? [],
      porAno: respostas[1].data ?? [],
      unidades: respostas[2].data ?? [],
      naturezas: respostas[3].data ?? [],
      responsaveis: respostas[4].data ?? [],
      sugeridas: solucoes?.sugeridas ?? [],
      decididas: solucoes?.decididas ?? [],
      categorias: respostas[6].data ?? [],
      condutores: (respostas[7].data ?? []).map((item) => ({
        id: item.policial_militar_id,
        rotulo: `${item.posto_graduacao} ${item.matricula} ${item.nome}`,
        total: item.total,
      })),
      transgressoes: respostas[8].data ?? [],
      estatuto: respostas[9].data ?? [],
      penais: respostas[10].data ?? [],
    },
  };
}

/** Lista de espécies do catálogo, no formato que as duas telas usam. */
export async function carregarApuratorios(): Promise<Apuratorio[] | null> {
  const resposta = await call("legal_catalogs_list", { catalogo: "apuratorios" });
  if (!resposta.ok) return null;
  return (resposta.data ?? []).map((l) => ({
    id: String(l.id),
    sigla: String(l.sigla ?? ""),
    nome: String(l.nome ?? ""),
  }));
}

/**
 * Onde o bloco indivisível vale, e onde ele atrapalha.
 *
 * Estas três tabelas saem em dois lugares: no verso de um `cartaoAnalitico`,
 * que é item de `.analytics-grid`, e nas seções do Relatório Anual, que correm
 * no fluxo do documento. Dentro do item de grid o WebKitGTK **ignora** o
 * `break-inside` das caixas de dentro — medido em `tools/impressao` —, então
 * fragmentar ali gasta folha e ainda parte a linha; quem protege o cartão é o
 * `break-inside: avoid` dele mesmo. No documento é o contrário: sem bloco, a
 * linha da quebra de página some do papel.
 *
 * Por isso o fragmento é **opção de quem chama**, e não padrão da tabela.
 */
export type OpcoesTabelaRelatorio = { fragmentar?: boolean };

/** Tabela rótulo × quantidade, a forma de quase todo relatório desta família. */
export function tabelaContagem(
  itens: ContagemRotulada[],
  rotuloColuna = "Item",
  vazio = "Nada registrado neste escopo.",
  opcoes: OpcoesTabelaRelatorio = {},
): string {
  return tabela(
    [
      { rotulo: rotuloColuna, largura: 72, truncar: true },
      { rotulo: "Quantidade", largura: 28, alinhamento: "centro", nowrap: true },
    ],
    itens.map((item) => [item.rotulo, { texto: String(item.total), numerica: true }]),
    vazio,
    // Vinte e três linhas destas cabem na folha em paisagem
    // (`medicao-contagem`); 20 deixa a folga da linha alta.
    { listagem: true, linhasPorFragmentoImpressao: opcoes.fragmentar ? 20 : undefined },
  );
}

/** Situação por espécie: em andamento, concluídos e total. */
export function tabelaSituacao(
  itens: StatusPorApuratorio[],
  opcoes: OpcoesTabelaRelatorio = {},
): string {
  return tabela(
    [
      { rotulo: "Apuratório", largura: 34, truncar: true },
      { rotulo: "Tipo", largura: 26, truncar: true },
      { rotulo: "Em andamento", largura: 14, alinhamento: "centro", nowrap: true },
      { rotulo: "Concluídos", largura: 13, alinhamento: "centro", nowrap: true },
      { rotulo: "Total", largura: 13, alinhamento: "centro", nowrap: true },
    ],
    itens.map((item) => [
      `${item.sigla} — ${item.nome}`,
      item.tipo_apuratorio_nome,
      { texto: String(item.em_andamento), numerica: true },
      { texto: String(item.concluidos), numerica: true },
      { texto: String(item.total), numerica: true },
    ]),
    "Nenhum apuratório neste escopo.",
    // Vinte cabem na folha em paisagem (`medicao-situacao`).
    { listagem: true, linhasPorFragmentoImpressao: opcoes.fragmentar ? 16 : undefined },
  );
}

/** Enquadramentos: rótulo, classificação vinda de JOIN, texto e contagem. */
export function tabelaEnquadramento(
  itens: EnquadramentoContagem[],
  rotuloColuna: string,
  opcoes: OpcoesTabelaRelatorio = {},
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
    // Dez cabem na folha em paisagem (`medicao-enquadramento`) — a descrição
    // legal inteira faz destas as linhas mais altas do relatório.
    { listagem: true, linhasPorFragmentoImpressao: opcoes.fragmentar ? 8 : undefined },
  );
}

/** Os totais do escopo, somados da situação por espécie. */
export function totaisDoEscopo(situacao: StatusPorApuratorio[]) {
  return {
    total: situacao.reduce((soma, item) => soma + item.total, 0),
    emAndamento: situacao.reduce((soma, item) => soma + item.em_andamento, 0),
    concluidos: situacao.reduce((soma, item) => soma + item.concluidos, 0),
    especies: situacao.length,
  };
}

let anoSelecionado: number | null = null;
let apuratoriosSelecionados: string[] = [];

function barraDeFiltro(anos: number[], apuratorios: Apuratorio[]): string {
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
          ${anos.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
        </select>
      </label>
      <fieldset class="filtro-apuratorios">
        <legend>Apuratórios <span class="hint">(nenhum marcado = todos)</span></legend>
        ${apuratorios.map(caixa).join("")}
      </fieldset>
      <button type="submit">Aplicar</button>
    </form>`;
}

export async function renderEstatisticas(ctx: ContextoTela): Promise<void> {
  const falhar = (mensagem: string) =>
    ctx.shell(`<section class="panel"><h1>Estatísticas dos Apuratórios</h1>
      <p class="error">${escapeHtml(mensagem)}</p></section>`);

  const [anosResposta, apuratorios] = await Promise.all([
    call("reports_available_years"),
    carregarApuratorios(),
  ]);
  if (!anosResposta.ok || !apuratorios) {
    falhar(anosResposta.error ?? "Não foi possível carregar os filtros.");
    return;
  }
  const anos = anosResposta.data ?? [];

  // Um filtro só, para todos os painéis. Lista vazia significa "todos": é o
  // backend que normaliza, e por isso não há sentinela aqui.
  const filter: EscopoRelatorio = {
    ano: anoSelecionado,
    apuratorio_ids: apuratoriosSelecionados,
  };
  const resultado = await carregarDadosDoEscopo(filter);
  if ("erro" in resultado) {
    falhar(resultado.erro);
    return;
  }
  const d = resultado.dados;

  const specs: GraficoSpec[] = [
    graficoSituacao(
      "stats-situacao",
      d.situacao.map((item) => ({
        sigla: item.sigla,
        nome: item.nome,
        tipo: item.tipo_apuratorio_nome,
        emAndamento: item.em_andamento,
        concluidos: item.concluidos,
      })),
    ),
    graficoLinha("stats-evolucao", d.porAno),
    graficoBarras("stats-unidades", d.unidades, { limitar: true }),
    graficoBarras("stats-naturezas", d.naturezas, { limitar: true }),
    graficoBarras("stats-responsaveis", d.responsaveis, { limitar: true }),
    graficoDonut("stats-solucoes-sugeridas", d.sugeridas),
    graficoDonut("stats-solucoes-decididas", d.decididas),
    graficoBarras("stats-categorias", d.categorias, { limitar: true }),
    graficoBarras("stats-condutores", d.condutores, { limitar: true }),
    graficoEnquadramentos("stats-rdpm", d.transgressoes),
    graficoEnquadramentos("stats-estatuto", d.estatuto),
    graficoEnquadramentos("stats-penais", d.penais),
  ];

  const totais = totaisDoEscopo(d.situacao);
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
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, planilha: true })}</div>
      </div>

      ${barraDeFiltro(anos, apuratorios)}

      <div class="analytics-filter-summary" aria-live="polite">
        <strong>Escopo aplicado:</strong><span>${escapeHtml(escopoAno)}</span><span>·</span><span>${escapeHtml(escopoApuratorios)}</span>
      </div>

      <div class="analytics-kpis">
        ${kpiAnalitico(totais.total, "Total no escopo")}
        ${kpiAnalitico(totais.emAndamento, "Em andamento", { tom: "andamento" })}
        ${kpiAnalitico(totais.concluidos, "Concluídos", { tom: "sucesso" })}
        ${kpiAnalitico(totais.especies, "Espécies com registros")}
      </div>

      <h2>Acervo</h2>
      <div class="analytics-grid">
        ${cartaoAnalitico({
          id: "stats-situacao",
          titulo: "Situação por apuratório",
          descricao: "Comparação por espécie, tipo e situação derivada da data de conclusão.",
          grafico: specs[0]!,
          tabela: tabelaSituacao(d.situacao),
          classe: "analytics-card--wide",
        })}
        ${cartaoAnalitico({
          id: "stats-evolucao",
          titulo: "Evolução das instaurações",
          // O ano é o eixo desta série: aplicá-lo a ela deixaria uma barra só.
          descricao: "Série histórica completa — respeita os apuratórios escolhidos, não o ano.",
          grafico: specs[1]!,
          tabela: tabelaContagem(d.porAno, "Ano"),
          classe: "analytics-card--wide",
        })}
        ${cartaoAnalitico({
          id: "stats-unidades",
          titulo: "Unidades de origem",
          descricao: "Demanda acumulada por OPM ou unidade.",
          grafico: specs[2]!,
          tabela: tabelaContagem(d.unidades, "Unidade"),
          limitado: d.unidades.length > 12,
        })}
        ${cartaoAnalitico({
          id: "stats-naturezas",
          titulo: "Natureza geral do fato",
          grafico: specs[3]!,
          tabela: tabelaContagem(d.naturezas, "Natureza"),
          limitado: d.naturezas.length > 12,
        })}
        ${cartaoAnalitico({
          id: "stats-responsaveis",
          titulo: "Responsabilidade vigente",
          descricao:
            "Apuratórios vinculados ao responsável vigente; não representa o histórico de designações.",
          grafico: specs[4]!,
          tabela: tabelaContagem(d.responsaveis, "Responsável"),
          limitado: d.responsaveis.length > 12,
          classe: "analytics-card--wide",
        })}
      </div>

      <h2>Apuração</h2>
      <div class="analytics-grid">
        ${cartaoAnalitico({ id: "stats-solucoes-sugeridas", titulo: "Soluções sugeridas pelo encarregado", grafico: specs[5]!, tabela: tabelaContagem(d.sugeridas, "Solução") })}
        ${cartaoAnalitico({ id: "stats-solucoes-decididas", titulo: "Soluções decididas pela autoridade", grafico: specs[6]!, tabela: tabelaContagem(d.decididas, "Solução") })}
        ${cartaoAnalitico({ id: "stats-categorias", titulo: "Categorias de indício", grafico: specs[7]!, tabela: tabelaContagem(d.categorias, "Categoria"), limitado: d.categorias.length > 12 })}
        ${cartaoAnalitico({
          id: "stats-condutores",
          titulo: "Condutores em sinistro",
          descricao: "Ocorrências cuja natureza geral do fato exige condutor.",
          grafico: specs[8]!,
          tabela: tabelaContagem(d.condutores, "Policial Militar", "Nenhum condutor registrado neste escopo."),
          limitado: d.condutores.length > 12,
          classe: "analytics-card--wide",
        })}
        ${cartaoAnalitico({ id: "stats-rdpm", titulo: "Transgressões do RDPM", descricao: "Artigos mais incidentes, coloridos pela classificação de gravidade.", grafico: specs[9]!, tabela: tabelaEnquadramento(d.transgressoes, "Artigo / inciso"), limitado: d.transgressoes.length > 12, classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "stats-estatuto", titulo: "Infrações do Estatuto", grafico: specs[10]!, tabela: tabelaEnquadramento(d.estatuto, "Artigo / inciso"), limitado: d.estatuto.length > 12, classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "stats-penais", titulo: "Infrações penais", descricao: "A esfera e a espécie permanecem vinculadas a cada ocorrência.", grafico: specs[11]!, tabela: tabelaEnquadramento(d.penais, "Dispositivo / artigo"), limitado: d.penais.length > 12, classe: "analytics-card--wide" })}
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
    void renderEstatisticas(ctx);
  });

  // A planilha leva as tabelas inteiras, não o Top 12 do gráfico, e registra
  // o escopo em cada aba para que ela continue conferível quando for separada.
  ligarExportacao(
    () => {
      const metadados = [
        { rotulo: "Ano", valor: escopoAno },
        {
          rotulo: "Apuratórios",
          valor: apuratoriosSelecionados.length
            ? apuratorios
                .filter((item) => apuratoriosSelecionados.includes(item.id))
                .map((item) => item.sigla)
                .join(", ")
            : "Todos os apuratórios",
        },
      ];
      const abaContagem = (
        nome: string,
        titulo: string,
        rotulo: string,
        itens: ContagemRotulada[],
      ): SpreadsheetSheet => ({
        nome,
        titulo,
        metadados,
        colunas: [
          { rotulo, largura: 48 },
          {
            rotulo: "Quantidade",
            tipo: "inteiro",
            largura: 14,
            alinhamento: "direita",
            tom: "informacao",
          },
        ],
        linhas: itens.map((item) => ({ celulas: [item.rotulo, item.total] })),
        congelar_colunas: 1,
      });
      const abaEnquadramento = (
        nome: string,
        titulo: string,
        rotulo: string,
        itens: EnquadramentoContagem[],
      ): SpreadsheetSheet => ({
        nome,
        titulo,
        metadados,
        colunas: [
          { rotulo, largura: 24 },
          { rotulo: "Classificação", largura: 20 },
          { rotulo: "Descrição", largura: 60 },
          {
            rotulo: "Quantidade",
            tipo: "inteiro",
            largura: 14,
            alinhamento: "direita",
            tom: "informacao",
          },
        ],
        linhas: itens.map((item) => ({
          celulas: [item.rotulo, item.classificacao, item.descricao, item.total],
        })),
        congelar_colunas: 1,
      });

      return baixarPlanilha(
        `estatisticas-apuratorios-${new Date().toISOString().slice(0, 10)}.xlsx`,
        [
          {
            nome: "Resumo",
            titulo: "Resumo das estatísticas dos apuratórios",
            metadados,
            colunas: [
              { rotulo: "Indicador", largura: 36 },
              {
                rotulo: "Quantidade",
                tipo: "inteiro",
                largura: 14,
                alinhamento: "direita",
              },
            ],
            linhas: [
              { celulas: ["Total no escopo", totais.total], tom: "informacao" },
              { celulas: ["Em andamento", totais.emAndamento], tom: "atencao" },
              { celulas: ["Concluídos", totais.concluidos], tom: "sucesso" },
              { celulas: ["Espécies com registros", totais.especies] },
            ],
          },
          {
            nome: "Situação",
            titulo: "Situação por apuratório",
            metadados,
            colunas: [
              { rotulo: "Apuratório", largura: 18 },
              { rotulo: "Tipo", largura: 30 },
              {
                rotulo: "Em andamento",
                tipo: "inteiro",
                largura: 15,
                alinhamento: "direita",
                tom: "atencao",
              },
              {
                rotulo: "Concluídos",
                tipo: "inteiro",
                largura: 14,
                alinhamento: "direita",
                tom: "sucesso",
              },
              { rotulo: "Total", tipo: "inteiro", largura: 12, alinhamento: "direita" },
            ],
            linhas: d.situacao.map((item) => ({
              celulas: [
                `${item.sigla} — ${item.nome}`,
                item.tipo_apuratorio_nome,
                item.em_andamento,
                item.concluidos,
                item.total,
              ],
            })),
            congelar_colunas: 1,
          },
          abaContagem("Por ano", "Evolução das instaurações", "Ano", d.porAno),
          abaContagem("Unidades", "Unidades de origem", "Unidade", d.unidades),
          abaContagem("Naturezas", "Natureza geral do fato", "Natureza", d.naturezas),
          abaContagem(
            "Responsáveis",
            "Responsabilidade vigente",
            "Policial militar",
            d.responsaveis,
          ),
          abaContagem("Sol. sugeridas", "Soluções sugeridas", "Solução", d.sugeridas),
          abaContagem("Sol. decididas", "Soluções decididas", "Solução", d.decididas),
          abaContagem("Categorias", "Categorias de indício", "Categoria", d.categorias),
          abaContagem("Condutores", "Condutores em sinistro", "Policial militar", d.condutores),
          abaEnquadramento(
            "RDPM",
            "Transgressões do RDPM",
            "Artigo / inciso",
            d.transgressoes,
          ),
          abaEnquadramento(
            "Estatuto",
            "Infrações do Estatuto",
            "Artigo / inciso",
            d.estatuto,
          ),
          abaEnquadramento(
            "Infrações penais",
            "Infrações penais",
            "Dispositivo / artigo",
            d.penais,
          ),
        ],
      );
    },
    undefined,
    { orientacao: "paisagem", perfil: "analitico" },
  );
}
