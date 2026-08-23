// Painel de prazos.
//
// A versão anterior usava três comandos que não existem mais —
// `deadlines_upcoming`, `deadlines_overdue` e `deadlines_close`. Os dois
// primeiros viraram um só, `deadlines_report`, parametrizado por filtro: a
// diferença entre "vencendo" e "vencido" passou a ser argumento, não comando.
// O terceiro sumiu porque prazo não se "encerra": a vigência é derivada da
// ordem, e prorrogar cria a próxima linha.
//
// Esta tela absorveu a rota `/estatisticas/prazos`, que mostrava a mesma
// listagem de vencidos e existia só pela exportação CSV. Duas telas para o
// mesmo dado divergem; o CSV é um botão.

import { call, type DeadlineReportItem } from "../api";
import { barraDeExportacao, baixarCsv, escapeHtml, ligarExportacao, tabela } from "../dom";
import type { Linha } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/prazos";

let janelaDias = 14;

const COLUNAS = ["Processo", "Unidade", "Responsável", "Vencimento", "Dias", "Prazo"];

const identificacao = (i: DeadlineReportItem) => `${i.apuratorio_sigla} nº ${i.numero_controle}`;

const situacao = (i: DeadlineReportItem) =>
  i.dias_restantes < 0 ? `${-i.dias_restantes} em atraso` : `${i.dias_restantes} restantes`;

const vigencia = (i: DeadlineReportItem) =>
  i.ordem === 0 ? "inicial" : `${i.ordem}ª prorrogação`;

function linhas(itens: DeadlineReportItem[]): Linha[] {
  return itens.map((i) => ({
    // `tr.atrasado` destaca a linha inteira, não só a célula dos dias.
    classe: i.dias_restantes < 0 ? "atrasado" : "",
    celulas: [
      identificacao(i),
      i.unidade_origem,
      i.responsavel_nome ?? "—",
      i.data_vencimento,
      { texto: situacao(i), numerica: true },
      vigencia(i),
    ],
  }));
}

export async function renderPrazos(ctx: ContextoTela): Promise<void> {
  const [resumo, aVencer, vencidos] = await Promise.all([
    call("deadlines_dashboard", { diasJanela: janelaDias }).then((r) => r.data),
    call("deadlines_report", {
      filter: { dias_ate_vencer: janelaDias, apenas_vencidos: false },
    }).then((r) => r.data ?? []),
    call("deadlines_report", { filter: { apenas_vencidos: true } }).then((r) => r.data ?? []),
  ]);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Prazos</h1><p>Processos em andamento, pelo prazo vigente.</p></div>
        <div class="page-head-right">
          <label>Janela
            <select id="janela">
              ${[7, 14, 30, 60]
                .map((d) => `<option value="${d}"${d === janelaDias ? " selected" : ""}>${d} dias</option>`)
                .join("")}
            </select>
          </label>
          ${barraDeExportacao({ imprimir: true, csv: true })}
        </div>
      </div>

      <div class="stat-row">
        <div class="stat-card"><span class="stat-value">${resumo?.total ?? 0}</span><span>com prazo</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${resumo?.vencidos ?? 0}</span><span>vencidos</span></div>
        <div class="stat-card"><span class="stat-value">${resumo?.proximos ?? 0}</span><span>vencem em ${janelaDias} dias</span></div>
      </div>

      <h2>Vencidos</h2>
      ${tabela(COLUNAS, linhas(vencidos), "Nenhum prazo vencido.")}

      <h2>Vencendo em até ${escapeHtml(janelaDias)} dias</h2>
      ${tabela(COLUNAS, linhas(aVencer), "Nenhum prazo na janela.")}
    </section>
  `);

  document.querySelector<HTMLSelectElement>("#janela")?.addEventListener("change", (e) => {
    janelaDias = Number((e.currentTarget as HTMLSelectElement).value);
    void renderPrazos(ctx);
  });

  // O CSV sai do dado já carregado: uma coluna a mais diz de qual bloco cada
  // linha veio, para a planilha não perder essa distinção.
  ligarExportacao(() => {
    const linha = (i: DeadlineReportItem, bloco: string) => [
      bloco,
      identificacao(i),
      i.unidade_origem,
      i.responsavel_nome ?? "",
      i.data_vencimento,
      i.dias_restantes,
      vigencia(i),
    ];
    return baixarCsv(
      `prazos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Situacao", ...COLUNAS.slice(0, 4), "Dias restantes", "Prazo"],
      [
        ...vencidos.map((i) => linha(i, "Vencido")),
        ...aVencer.map((i) => linha(i, `Vence em ate ${janelaDias} dias`)),
      ],
    );
  });
}
