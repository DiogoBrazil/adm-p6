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
import { barraDeExportacao, escapeHtml, ligarExportacao, option, tabela } from "../dom";
import { painelContagem } from "./estatisticas";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/estatisticas/anuais";

let anoSelecionado = new Date().getFullYear();

/** Soma um campo da situação por apuratório. */
const somar = (linhas: StatusPorApuratorio[], campo: "em_andamento" | "concluidos" | "total") =>
  linhas.reduce((acc, l) => acc + l[campo], 0);

function tabelaPorTipo(linhas: StatusPorApuratorio[]): string {
  return tabela(
    [
      { rotulo: "Apuratório", largura: 46, truncar: true },
      { rotulo: "Total", largura: 18, alinhamento: "direita", nowrap: true },
      { rotulo: "Em andamento", largura: 18, alinhamento: "direita", nowrap: true },
      { rotulo: "Concluídos", largura: 18, alinhamento: "direita", nowrap: true },
    ],
    linhas.map((l) => [
      `${l.sigla} — ${l.nome}`,
      { texto: String(l.total), numerica: true },
      { texto: String(l.em_andamento), numerica: true },
      { texto: String(l.concluidos), numerica: true },
    ]),
    "Nada instaurado neste ano.",
  );
}

/** Um bloco por tipo de apuratório, na ordem em que o backend já os agrupa. */
function blocosPorTipo(situacao: StatusPorApuratorio[]): string {
  const tipos = new Map<string, { nome: string; linhas: StatusPorApuratorio[] }>();
  for (const linha of situacao) {
    const bloco = tipos.get(linha.tipo_apuratorio_id) ?? {
      nome: linha.tipo_apuratorio_nome,
      linhas: [],
    };
    bloco.linhas.push(linha);
    tipos.set(linha.tipo_apuratorio_id, bloco);
  }
  if (!tipos.size) return `<p class="empty">Nada instaurado neste ano.</p>`;
  return [...tipos.values()]
    .map(
      (bloco) => `<section class="stat-panel">
        <h2>${escapeHtml(bloco.nome)} — ${somar(bloco.linhas, "total")} no ano</h2>
        ${tabelaPorTipo(bloco.linhas)}
      </section>`,
    )
    .join("");
}

export async function renderRelatorioAnual(ctx: ContextoTela): Promise<void> {
  const anos = (await call("reports_available_years")).data ?? [];
  if (anos.length && !anos.includes(anoSelecionado)) anoSelecionado = anos[0] ?? anoSelecionado;
  const anosDisponiveis = anos.length ? anos : [anoSelecionado];

  const filter = { ano: anoSelecionado, apuratorio_ids: [] as string[] };
  const [situacao, solucoes, categorias, naturezas, responsaveis] = await Promise.all([
    call("reports_status_by_apuratorio", { filter }).then((r) => r.data ?? []),
    call("reports_by_solution", { filter }).then((r) => r.data),
    call("reports_by_evidence_category", { filter }).then((r) => r.data ?? []),
    call("reports_by_nature", { filter }).then((r) => r.data ?? []),
    call("reports_by_responsible", { filter }).then((r) => r.data ?? []),
  ]);

  const cartao = (valor: number | string, rotulo: string, alerta = false) =>
    `<div class="stat-card${alerta ? " stat-card--alert" : ""}">
       <span class="stat-value">${escapeHtml(valor)}</span><span>${escapeHtml(rotulo)}</span>
     </div>`;

  const decididas: ContagemRotulada[] = solucoes?.decididas ?? [];

  ctx.shell(`
    <section class="panel relatorio">
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

      <div class="stat-row">
        ${cartao(somar(situacao, "total"), "instaurados no ano")}
        ${cartao(somar(situacao, "em_andamento"), "ainda em andamento")}
        ${cartao(somar(situacao, "concluidos"), "concluídos")}
      </div>

      ${blocosPorTipo(situacao)}

      <div class="stat-grid">
        ${painelContagem("Soluções decididas pela autoridade", decididas, "Solução")}
        ${painelContagem("Soluções sugeridas pelo encarregado", solucoes?.sugeridas ?? [], "Solução")}
        ${painelContagem("Envolvidos por categoria de indício", categorias, "Categoria")}
        ${painelContagem("Por natureza do fato", naturezas, "Natureza")}
      </div>

      ${painelContagem("Processos por responsável vigente", responsaveis, "Responsável")}
    </section>
  `);

  document.querySelector<HTMLFormElement>("#filtro-ano")?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget as HTMLFormElement);
    anoSelecionado = Number(formulario.get("ano")) || anoSelecionado;
    void renderRelatorioAnual(ctx);
  });

  ligarExportacao();
}
