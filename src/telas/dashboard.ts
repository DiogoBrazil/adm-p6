// Painel de entrada.
//
// O renderizador anterior lia `data.total_processos`, `data.em_andamento`,
// `data.concluidos` e `data.prazos_vencidos` de `dashboard_summary`. Só três
// desses campos existem: o primeiro se chama `total`. O cartão principal do
// painel de entrada mostrava zero desde que o comando foi remodelado.

import { call, type DeadlineReportItem } from "../api";
import { escapeHtml, tabela } from "../dom";
import { painelContagem } from "./estatisticas";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/dashboard";

/** Quantos vencidos cabem no painel antes de ele virar a tela de prazos. */
const VENCIDOS_NO_PAINEL = 8;

export async function renderDashboard(ctx: ContextoTela): Promise<void> {
  const [resumo, vencidos] = await Promise.all([
    call("dashboard_summary").then((r) => r.data),
    call("deadlines_report", { filter: { apenas_vencidos: true, limit: VENCIDOS_NO_PAINEL } }).then(
      (r) => r.data ?? [],
    ),
  ]);

  if (!resumo) {
    ctx.shell(`<section class="panel"><h1>Painel</h1>
      <p class="error">Não foi possível carregar o resumo.</p></section>`);
    return;
  }

  const cartao = (valor: number, rotulo: string, alerta = false) =>
    `<div class="stat-card${alerta ? " stat-card--alert" : ""}">
       <span class="stat-value">${valor}</span><span>${escapeHtml(rotulo)}</span>
     </div>`;

  const linhaVencido = (i: DeadlineReportItem) => [
    `${i.apuratorio_sigla} nº ${i.numero_controle}`,
    i.responsavel_nome ?? "—",
    i.data_vencimento,
    { texto: `${-i.dias_restantes} dias`, numerica: true },
  ];

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Painel</h1>
          <p>Seção de Justiça e Disciplina · 7º BPM</p>
        </div>
      </div>

      <div class="stat-row">
        ${cartao(resumo.total, "no total")}
        ${cartao(resumo.em_andamento, "em andamento")}
        ${cartao(resumo.concluidos, "concluídos")}
        ${cartao(resumo.prazos_vencidos, "com prazo vencido", resumo.prazos_vencidos > 0)}
      </div>

      <section class="stat-panel">
        <h2>Prazos vencidos</h2>
        ${
          resumo.prazos_vencidos > VENCIDOS_NO_PAINEL
            ? `<p class="hint">Os ${VENCIDOS_NO_PAINEL} mais antigos. Veja todos em Prazos.</p>`
            : ""
        }
        ${tabela(
          ["Processo", "Responsável", "Venceu em", "Atraso"],
          vencidos.map((i) => ({ celulas: linhaVencido(i), classe: "atrasado" })),
          "Nenhum prazo vencido.",
        )}
      </section>

      <div class="stat-grid">
        ${painelContagem("Por apuratório", resumo.por_apuratorio, "Apuratório")}
        ${painelContagem("Por ano de instauração", resumo.por_ano, "Ano")}
      </div>
    </section>
  `);
}
