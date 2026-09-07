// Painel de entrada.
//
// O renderizador anterior lia `data.total_processos`, `data.em_andamento`,
// `data.concluidos` e `data.prazos_vencidos` de `dashboard_summary`. Só três
// desses campos existem: o primeiro se chama `total`. O cartão principal do
// painel de entrada mostrava zero desde que o comando foi remodelado.
//
// O QUE ESTA TELA **NÃO** DESENHA, E POR QUÊ
//
// As distribuições por unidade, por apuratório e por ano saíram daqui na
// rodada 29. Elas viviam em duplicata na "Visão Geral dos Apuratórios", e nas
// duas telas eram sempre do acervo inteiro, porque `dashboard_summary` não
// aceitava filtro. Agora moram em Estatísticas dos Apuratórios, com escopo.
//
// O Painel ficou com o que é dele: os quatro números do acervo, a criticidade
// dos prazos e a lista do que já venceu — triagem, não exploração.

import { call, type DeadlineReportItem } from "../api";
import {
  cartaoAnalitico,
  graficoPrazos,
  kpiAnalitico,
  montarCartoesAnaliticos,
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
  const specPrazos = graficoPrazos("dashboard-prazos", faixas);
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
          grafico: specPrazos,
          tabela: tabelaPrazos,
          classe: "analytics-card--wide",
        })}
      </div>

      <section class="stat-panel dashboard-overdue">
        <div class="page-head">
          <h2>Prazos vencidos</h2>
          <button type="button" class="ghost small" id="ir-para-prazos"
                  data-nao-imprimir>Ver todos em Prazos</button>
        </div>
        ${
          resumo.prazos_vencidos > VENCIDOS_NO_PAINEL
            ? `<p class="hint">Os ${VENCIDOS_NO_PAINEL} mais antigos.</p>`
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
          // São no máximo `VENCIDOS_NO_PAINEL` linhas dentro de um
          // `.stat-panel` indivisível: não há quebra de página para proteger.
          { listagem: true },
        )}
      </section>
    </section>
  `);
  montarCartoesAnaliticos([specPrazos]);

  // Navega pelo mesmo caminho do menu: o `data-route` é lido pelo `shell()`, e
  // assim o botão não precisa conhecer o roteador.
  document.querySelector<HTMLButtonElement>("#ir-para-prazos")?.addEventListener("click", () => {
    document.querySelector<HTMLButtonElement>('[data-route="/prazos"]')?.click();
  });

  ligarExportacao(undefined, undefined, { orientacao: "paisagem", perfil: "analitico" });
}
