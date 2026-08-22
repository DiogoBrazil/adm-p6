// Painel de prazos.
//
// A versão anterior usava três comandos que não existem mais —
// `deadlines_upcoming`, `deadlines_overdue` e `deadlines_close`. Os dois
// primeiros viraram um só, `deadlines_report`, parametrizado por filtro: a
// diferença entre "vencendo" e "vencido" passou a ser argumento, não comando.
// O terceiro sumiu porque prazo não se "encerra": a vigência é derivada da
// ordem, e prorrogar cria a próxima linha.

import { call, type DeadlineReportItem } from "../api";
import { escapeHtml } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/prazos";

let janelaDias = 14;

export async function renderPrazos(ctx: ContextoTela): Promise<void> {
  const [resumo, aVencer, vencidos] = await Promise.all([
    call("deadlines_dashboard", { diasJanela: janelaDias }).then((r) => r.data),
    call("deadlines_report", {
      filter: { dias_ate_vencer: janelaDias, apenas_vencidos: false },
    }).then((r) => r.data ?? []),
    call("deadlines_report", { filter: { apenas_vencidos: true } }).then((r) => r.data ?? []),
  ]);

  const tabela = (itens: DeadlineReportItem[], vazio: string) =>
    itens.length
      ? `<div class="table-wrap"><table>
          <thead><tr>
            <th>Processo</th><th>Unidade</th><th>Responsável</th>
            <th>Vencimento</th><th>Dias</th><th>Prazo</th>
          </tr></thead>
          <tbody>${itens
            .map(
              (i) => `<tr${i.dias_restantes < 0 ? ' class="atrasado"' : ""}>
                <td>${escapeHtml(`${i.apuratorio_sigla} nº ${i.numero_controle}`)}</td>
                <td>${escapeHtml(i.unidade_origem)}</td>
                <td>${escapeHtml(i.responsavel_nome ?? "—")}</td>
                <td>${escapeHtml(i.data_vencimento)}</td>
                <td>${i.dias_restantes < 0 ? `${-i.dias_restantes} em atraso` : `${i.dias_restantes} restantes`}</td>
                <td>${i.ordem === 0 ? "inicial" : `${i.ordem}ª prorrogação`}</td>
              </tr>`,
            )
            .join("")}</tbody></table></div>`
      : `<p class="empty">${vazio}</p>`;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Prazos</h1><p>Processos em andamento, pelo prazo vigente.</p></div>
        <label>Janela
          <select id="janela">
            ${[7, 14, 30, 60]
              .map((d) => `<option value="${d}"${d === janelaDias ? " selected" : ""}>${d} dias</option>`)
              .join("")}
          </select>
        </label>
      </div>

      <div class="stat-row">
        <div class="stat-card"><span class="stat-value">${resumo?.total ?? 0}</span><span>com prazo</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${resumo?.vencidos ?? 0}</span><span>vencidos</span></div>
        <div class="stat-card"><span class="stat-value">${resumo?.proximos ?? 0}</span><span>vencem em ${janelaDias} dias</span></div>
      </div>

      <h2>Vencidos</h2>
      ${tabela(vencidos, "Nenhum prazo vencido.")}

      <h2>Vencendo em até ${janelaDias} dias</h2>
      ${tabela(aVencer, "Nenhum prazo na janela.")}
    </section>
  `);

  document.querySelector<HTMLSelectElement>("#janela")?.addEventListener("change", (e) => {
    janelaDias = Number((e.currentTarget as HTMLSelectElement).value);
    void renderPrazos(ctx);
  });
}
