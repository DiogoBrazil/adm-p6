// Relatório anual.
//
// A tela chamava `reports_annual_statistics`, que não existe. O legado gerava
// um PDF no servidor com ReportLab; o Rust não tem crate de PDF, e não vai ter
// por causa disto: a página é montada aqui e o "Imprimir / PDF" usa a
// impressão do sistema. O layout fica onde é fácil ajustar, e não há um
// segundo desenho do relatório para manter em sincronia.
//
// O relatório se compõe de comandos que já existem — não há comando
// `annual_*`. A quebra processo × procedimento sai de `tipo_apuratorio_id` no
// catálogo, não de uma lista de siglas: era `tipo_geral = 'processo'` no SQL
// do legado, com `tipo_detalhe IN ('PAD','PADS')` para os punidos.

import { call, type ContagemRotulada, type StatusPorApuratorio } from "../api";
import {
  cartaoAnalitico,
  graficoBarras,
  graficoDonut,
  graficoSituacao,
  kpiAnalitico,
  montarCartoesAnaliticos,
  type GraficoSpec,
} from "../graficos";
import { barraDeExportacao, escapeHtml, ligarExportacao, option, tabela } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/estatisticas/anuais";

let anoSelecionado = new Date().getFullYear();

/** Soma um campo da situação por apuratório. */
const somar = (linhas: StatusPorApuratorio[], campo: "em_andamento" | "concluidos" | "total") =>
  linhas.reduce((acc, l) => acc + l[campo], 0);

function tabelaContagem(itens: ContagemRotulada[], rotulo: string): string {
  return tabela(
    [
      { rotulo, largura: 72, truncar: true },
      { rotulo: "Quantidade", largura: 28, alinhamento: "centro", nowrap: true },
    ],
    itens.map((item) => [item.rotulo, { texto: String(item.total), numerica: true }]),
    "Nada registrado neste escopo.",
    { listagem: true },
  );
}

export async function renderRelatorioAnual(ctx: ContextoTela): Promise<void> {
  const anosResposta = await call("reports_available_years");
  if (!anosResposta.ok) {
    ctx.shell(`<section class="panel"><h1>Relatório Anual</h1>
      <p class="error">${escapeHtml(anosResposta.error ?? "Não foi possível carregar os anos disponíveis.")}</p></section>`);
    return;
  }
  const anos = anosResposta.data ?? [];
  if (anos.length && !anos.includes(anoSelecionado)) anoSelecionado = anos[0] ?? anoSelecionado;
  const anosDisponiveis = anos.length ? anos : [anoSelecionado];

  const filter = { ano: anoSelecionado, apuratorio_ids: [] as string[] };
  const respostas = await Promise.all([
    call("reports_status_by_apuratorio", { filter }),
    call("reports_by_solution", { filter }),
    call("reports_by_evidence_category", { filter }),
    call("reports_by_nature", { filter }),
    call("reports_by_responsible", { filter }),
  ] as const);
  const falha = respostas.find((resposta) => !resposta.ok);
  if (falha) {
    ctx.shell(`<section class="panel"><h1>Relatório Anual</h1>
      <p class="error">${escapeHtml(falha.error ?? "Não foi possível carregar o relatório anual.")}</p></section>`);
    return;
  }
  const situacao = respostas[0].data ?? [];
  const solucoes = respostas[1].data;
  const categorias = respostas[2].data ?? [];
  const naturezas = respostas[3].data ?? [];
  const responsaveis = respostas[4].data ?? [];

  const decididas: ContagemRotulada[] = solucoes?.decididas ?? [];
  const situacaoGrafico = situacao.map((item) => ({
    sigla: item.sigla,
    nome: item.nome,
    tipo: item.tipo_apuratorio_nome,
    emAndamento: item.em_andamento,
    concluidos: item.concluidos,
  }));
  const specs: GraficoSpec[] = [
    graficoSituacao("anual-situacao", situacaoGrafico),
    graficoDonut("anual-decisoes", decididas),
    graficoDonut("anual-sugestoes", solucoes?.sugeridas ?? []),
    graficoBarras("anual-categorias", categorias, { limitar: true }),
    graficoBarras("anual-naturezas", naturezas, { limitar: true }),
    graficoBarras("anual-responsaveis", responsaveis, { limitar: true }),
  ];
  const tabelaSituacao = tabela(
    [
      { rotulo: "Apuratório", largura: 30, truncar: true },
      { rotulo: "Tipo", largura: 24, truncar: true },
      { rotulo: "Total", largura: 14, alinhamento: "centro", nowrap: true },
      { rotulo: "Em andamento", largura: 18, alinhamento: "centro", nowrap: true },
      { rotulo: "Concluídos", largura: 14, alinhamento: "centro", nowrap: true },
    ],
    situacao.map((item) => [
      `${item.sigla} — ${item.nome}`,
      item.tipo_apuratorio_nome,
      { texto: String(item.total), numerica: true },
      { texto: String(item.em_andamento), numerica: true },
      { texto: String(item.concluidos), numerica: true },
    ]),
    "Nada instaurado neste ano.",
    { listagem: true },
  );

  ctx.shell(`
    <section class="panel panel--analytics relatorio">
      <div class="page-head">
        <div>
          <h1>Relatório Anual — ${escapeHtml(anoSelecionado)}</h1>
          <p>Seção de Justiça e Disciplina · 7º BPM</p>
        </div>
        <div class="page-head-right">
          <form id="filtro-ano" class="filtro-bar">
            <label>Ano
              <select name="ano">
                ${anosDisponiveis.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
              </select>
            </label>
            <button type="submit">Ver</button>
          </form>
          ${barraDeExportacao({ imprimir: true })}
        </div>
      </div>

      <div class="analytics-kpis">
        ${kpiAnalitico(somar(situacao, "total"), "Instaurados no ano")}
        ${kpiAnalitico(somar(situacao, "em_andamento"), "Ainda em andamento", { tom: "andamento" })}
        ${kpiAnalitico(somar(situacao, "concluidos"), "Concluídos", { tom: "sucesso" })}
        ${kpiAnalitico(situacao.length, "Espécies com registros")}
      </div>

      <div class="analytics-grid">
        ${cartaoAnalitico({ id: "anual-situacao", titulo: "Procedimentos e processos", descricao: "Situação por espécie e tipo de apuratório no ano selecionado.", grafico: specs[0]!, tabela: tabelaSituacao, classe: "analytics-card--wide" })}
        ${cartaoAnalitico({ id: "anual-decisoes", titulo: "Soluções decididas pela autoridade", grafico: specs[1]!, tabela: tabelaContagem(decididas, "Solução") })}
        ${cartaoAnalitico({ id: "anual-sugestoes", titulo: "Soluções sugeridas pelo encarregado", grafico: specs[2]!, tabela: tabelaContagem(solucoes?.sugeridas ?? [], "Solução") })}
        ${cartaoAnalitico({ id: "anual-categorias", titulo: "Categorias de indício", grafico: specs[3]!, tabela: tabelaContagem(categorias, "Categoria"), limitado: categorias.length > 12 })}
        ${cartaoAnalitico({ id: "anual-naturezas", titulo: "Natureza geral do fato", grafico: specs[4]!, tabela: tabelaContagem(naturezas, "Natureza"), limitado: naturezas.length > 12 })}
        ${cartaoAnalitico({ id: "anual-responsaveis", titulo: "Responsabilidade vigente", descricao: "Apuratórios do ano atribuídos ao responsável vigente.", grafico: specs[5]!, tabela: tabelaContagem(responsaveis, "Responsável"), limitado: responsaveis.length > 12, classe: "analytics-card--wide" })}
      </div>
    </section>
  `);

  montarCartoesAnaliticos(specs);

  document.querySelector<HTMLFormElement>("#filtro-ano")?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget as HTMLFormElement);
    anoSelecionado = Number(formulario.get("ano")) || anoSelecionado;
    void renderRelatorioAnual(ctx);
  });

  ligarExportacao(undefined, undefined, { paisagem: true });
}
