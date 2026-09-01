// Painel de entrada.
//
// O renderizador anterior lia `data.total_processos`, `data.em_andamento`,
// `data.concluidos` e `data.prazos_vencidos` de `dashboard_summary`. Só três
// desses campos existem: o primeiro se chama `total`. O cartão principal do
// painel de entrada mostrava zero desde que o comando foi remodelado.

import { call, type ContagemRotulada, type DeadlineReportItem } from "../api";
import {
  cartaoAnalitico,
  graficoBarras,
  graficoLinha,
  graficoPrazos,
  kpiAnalitico,
  montarCartoesAnaliticos,
  type GraficoSpec,
} from "../graficos";
import { faixasDePrazo } from "../graficos/dados";
import {
  barraDeExportacao,
  escapeHtml,
  formatarQualificacaoMilitar,
  ligarExportacao,
  tabela,
} from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/dashboard";

/** Quantos vencidos cabem no painel antes de ele virar a tela de prazos. */
const VENCIDOS_NO_PAINEL = 8;

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

export async function renderDashboard(ctx: ContextoTela): Promise<void> {
  const [resumoResposta, prazosResposta, vencidosResposta] = await Promise.all([
    call("dashboard_summary"),
    call("deadlines_dashboard", { diasJanela: 30 }),
    // O `limit` solto saiu do filtro: quem quer só os N primeiros pede a
    // página 1 com `per_page` N, que é uma forma só de recortar a mesma lista.
    call("deadlines_report", {
      filter: { apenas_vencidos: true, page: 1, per_page: VENCIDOS_NO_PAINEL },
    }),
  ]);

  const resumo = resumoResposta.data;
  const prazos = prazosResposta.data;
  const vencidos = vencidosResposta.data?.items ?? [];
  if (!resumo || !prazos || !resumoResposta.ok || !prazosResposta.ok || !vencidosResposta.ok) {
    ctx.shell(`<section class="panel"><h1>Painel</h1>
      <p class="error">${escapeHtml(resumoResposta.error ?? prazosResposta.error ?? vencidosResposta.error ?? "Não foi possível carregar o resumo.")}</p></section>`);
    return;
  }

  const linhaVencido = (i: DeadlineReportItem) => [
    `${i.apuratorio_sigla} nº ${i.numero_controle}`,
    formatarQualificacaoMilitar(
      i.responsavel_posto_graduacao,
      i.responsavel_matricula,
      i.responsavel_nome,
    ),
    i.data_vencimento,
    { texto: `${-i.dias_restantes} dias`, numerica: true },
  ];

  const faixas = faixasDePrazo(prazos.total, prazos.vencidos, prazos.proximos);
  const specs: GraficoSpec[] = [
    graficoPrazos("dashboard-prazos", faixas),
    graficoBarras("dashboard-unidades", resumo.por_unidade, { limitar: true }),
    graficoBarras("dashboard-apuratorios", resumo.por_apuratorio, { limitar: true }),
    graficoLinha("dashboard-evolucao", resumo.por_ano),
  ];
  const tabelaPrazos = tabela(
    [
      { rotulo: "Criticidade", largura: 68 },
      { rotulo: "Quantidade", largura: 32, alinhamento: "centro", nowrap: true },
    ],
    faixas.map((faixa) => [faixa.rotulo, { texto: String(faixa.total), numerica: true }]),
    "Nenhum prazo vigente.",
    { listagem: true },
  );

  ctx.shell(`
    <section class="panel panel--analytics">
      <div class="page-head">
        <div>
          <h1>Painel</h1>
          <p>Panorama operacional da Seção de Justiça e Disciplina · 7º BPM</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true })}</div>
      </div>

      <div class="analytics-kpis">
        ${kpiAnalitico(resumo.total, "Total de apuratórios")}
        ${kpiAnalitico(resumo.em_andamento, "Em andamento", { tom: "andamento" })}
        ${kpiAnalitico(resumo.concluidos, "Concluídos", { tom: "sucesso" })}
        ${kpiAnalitico(resumo.prazos_vencidos, "Prazos vencidos", {
          tom: resumo.prazos_vencidos ? "alerta" : "sucesso",
          detalhe: resumo.prazos_vencidos ? "Requer atenção imediata" : "Nenhuma pendência crítica",
        })}
      </div>

      <div class="analytics-grid">
        ${cartaoAnalitico({
          id: "dashboard-prazos",
          titulo: "Controle de prazos",
          descricao: "Criticidade dos prazos vigentes; janela de atenção de 30 dias.",
          grafico: specs[0]!,
          tabela: tabelaPrazos,
          classe: "analytics-card--wide",
        })}
        ${cartaoAnalitico({
          id: "dashboard-unidades",
          titulo: "Distribuição por unidade de origem",
          descricao: "Demanda acumulada por OPM ou unidade.",
          grafico: specs[1]!,
          tabela: tabelaContagem(resumo.por_unidade, "Unidade"),
          limitado: resumo.por_unidade.length > 12,
        })}
        ${cartaoAnalitico({
          id: "dashboard-apuratorios",
          titulo: "Distribuição por apuratório",
          grafico: specs[2]!,
          tabela: tabelaContagem(resumo.por_apuratorio, "Apuratório"),
          limitado: resumo.por_apuratorio.length > 12,
        })}
        ${cartaoAnalitico({
          id: "dashboard-evolucao",
          titulo: "Evolução das instaurações",
          descricao: "Série histórica ordenada pelo ano de instauração.",
          grafico: specs[3]!,
          tabela: tabelaContagem(resumo.por_ano, "Ano"),
          classe: "analytics-card--wide",
        })}
      </div>

      <section class="stat-panel dashboard-overdue">
        <h2>Prazos vencidos</h2>
        ${
          resumo.prazos_vencidos > VENCIDOS_NO_PAINEL
            ? `<p class="hint">Os ${VENCIDOS_NO_PAINEL} mais antigos. Veja todos em Prazos.</p>`
            : ""
        }
        ${tabela(
          [
            { rotulo: "Apuratório", largura: 26, truncar: true, alinhamento: "centro" },
            { rotulo: "Responsável", largura: 40, truncar: true, alinhamento: "centro" },
            { rotulo: "Venceu em", largura: 17, alinhamento: "centro", nowrap: true },
            { rotulo: "Atraso", largura: 17, alinhamento: "centro", nowrap: true },
          ],
          vencidos.map((i) => ({ celulas: linhaVencido(i), classe: "atrasado" })),
          "Nenhum prazo vencido.",
          { listagem: true },
        )}
      </section>
    </section>
  `);
  montarCartoesAnaliticos(specs);
  ligarExportacao(undefined, undefined, { paisagem: true });
}
