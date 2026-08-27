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

const OPCOES_CONTAGEM_PAINEL = {
  listagem: true,
} as const;

export async function renderDashboard(ctx: ContextoTela): Promise<void> {
  const [resumo, vencidos] = await Promise.all([
    call("dashboard_summary").then((r) => r.data),
    // O `limit` solto saiu do filtro: quem quer só os N primeiros pede a
    // página 1 com `per_page` N, que é uma forma só de recortar a mesma lista.
    call("deadlines_report", {
      filter: { apenas_vencidos: true, page: 1, per_page: VENCIDOS_NO_PAINEL },
    }).then((r) => r.data?.items ?? []),
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
          [
            { rotulo: "Processo", largura: 26, truncar: true, alinhamento: "centro" },
            { rotulo: "Responsável", largura: 40, truncar: true, alinhamento: "centro" },
            { rotulo: "Venceu em", largura: 17, alinhamento: "centro", nowrap: true },
            { rotulo: "Atraso", largura: 17, alinhamento: "centro", nowrap: true },
          ],
          vencidos.map((i) => ({ celulas: linhaVencido(i), classe: "atrasado" })),
          "Nenhum prazo vencido.",
          { listagem: true },
        )}
      </section>

      <div class="stat-grid">
        ${painelContagem("Por apuratório", resumo.por_apuratorio, "Apuratório", OPCOES_CONTAGEM_PAINEL)}
        ${painelContagem("Por ano de instauração", resumo.por_ano, "Ano", OPCOES_CONTAGEM_PAINEL)}
      </div>
    </section>
  `);
}
