// Panorama de designações por militar.
//
// O legado montava esta tela com onze consultas por militar, uma por sigla
// (`tipo_detalhe = 'SR'`, `= 'SV'`, `= 'IPM'`…), e lia colunas fixas de papel
// — `escrivao_id`, `presidente_id`, `interrogante_id`. Quando essas colunas
// saíram do schema, a quebra por papel saiu junto.
//
// Aqui as colunas da matriz nascem do catálogo de apuratórios e o recorte por
// papel é um filtro. "Quantas vezes foi escrivão" deixa de ser uma coluna
// codificada e passa a ser uma pergunta que o operador faz.
//
// A matriz conta TODA designação registrada, inclusive as já encerradas: se um
// militar foi encarregado e depois substituído, o trabalho que teve não
// desaparece do panorama. O relatório anual, esse sim, conta só o responsável
// vigente — são perguntas diferentes.

import { call, type DesignacaoMatrizLinha } from "../api";
import {
  barraDeExportacao,
  baixarCsv,
  escapeHtml,
  formatarQualificacaoMilitar,
  ligarExportacao,
  option,
  tabela,
} from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/estatisticas/encarregados";

type Opcao = { id: string; rotulo: string; titulo?: string };

let anoSelecionado: number | null = null;
let papeisSelecionados: string[] = [];

const totalDaColuna = (linhas: DesignacaoMatrizLinha[], apuratorioId: string) =>
  linhas.reduce((acc, l) => acc + (l.celulas.find((c) => c.id === apuratorioId)?.total ?? 0), 0);

export async function renderEncarregados(ctx: ContextoTela): Promise<void> {
  const [anos, catalogoApuratorios, catalogoPapeis] = await Promise.all([
    call("reports_available_years").then((r) => r.data ?? []),
    call("legal_catalogs_list", { catalogo: "apuratorios" }).then((r) => r.data ?? []),
    call("legal_catalogs_list", { catalogo: "papeis_processo" }).then((r) => r.data ?? []),
  ]);

  const apuratorios: Opcao[] = catalogoApuratorios.map((l) => ({
    id: String(l.id),
    rotulo: String(l.sigla ?? ""),
    titulo: String(l.nome ?? ""),
  }));
  const papeis: Opcao[] = catalogoPapeis.map((l) => ({
    id: String(l.id),
    rotulo: String(l.nome ?? ""),
  }));

  const linhas =
    (
      await call("reports_designations_matrix", {
        filter: { ano: anoSelecionado, papel_ids: papeisSelecionados, apuratorio_ids: [] },
      })
    ).data ?? [];

  // Só as colunas com alguma designação no escopo entram: a matriz inteira do
  // catálogo ficaria larga e vazia assim que houver muitos apuratórios.
  const colunasComDado = apuratorios.filter((a) => totalDaColuna(linhas, a.id) > 0);

  const celulasDe = (linha: DesignacaoMatrizLinha) =>
    colunasComDado.map((a) => {
      const valor = linha.celulas.find((c) => c.id === a.id)?.total ?? 0;
      return { texto: valor ? String(valor) : "—", numerica: true };
    });

  const corpo = linhas.map((l) => [
    `${l.posto_graduacao} ${l.matricula} ${l.nome}`,
    ...celulasDe(l),
    { texto: String(l.total), numerica: true, classe: "total" },
  ]);

  const rodape = linhas.length
    ? [
        [
          "Total",
          ...colunasComDado.map((a) => ({
            texto: String(totalDaColuna(linhas, a.id)),
            numerica: true,
          })),
          {
            texto: String(linhas.reduce((acc, l) => acc + l.total, 0)),
            numerica: true,
            classe: "total",
          },
        ],
      ]
    : [];

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Designações por Militar</h1>
          <p>Conta toda designação registrada, inclusive as já encerradas.</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, csv: !!linhas.length })}</div>
      </div>

      <form id="filtro-encarregados" class="filtro-bar">
        <label>Ano
          <select name="ano">
            <option value=""${anoSelecionado === null ? " selected" : ""}>Todos</option>
            ${anos.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
          </select>
        </label>
        <fieldset class="filtro-apuratorios">
          <legend>Funções <span class="hint">(nenhuma marcada = todas)</span></legend>
          ${papeis
            .map(
              (p) => `<label class="checkbox-inline">
                <input type="checkbox" name="papel" value="${escapeHtml(p.id)}"
                       ${papeisSelecionados.includes(p.id) ? "checked" : ""} />
                ${escapeHtml(p.rotulo)}
              </label>`,
            )
            .join("")}
        </fieldset>
        <button type="submit">Aplicar</button>
      </form>

      <div class="stat-row">
        <div class="stat-card"><span class="stat-value">${linhas.length}</span><span>militares designados</span></div>
        <div class="stat-card"><span class="stat-value">${escapeHtml(
          linhas[0]
            ? formatarQualificacaoMilitar(
                linhas[0].posto_graduacao,
                linhas[0].matricula,
                linhas[0].nome,
              )
            : "—",
        )}</span><span>mais designado</span></div>
      </div>

      ${
        // Matriz de coluna dinâmica: quantas colunas existem depende do dado,
        // então largura percentual não se aplica. Rola na horizontal, que é o
        // que uma matriz pede.
        tabela(
          [
            { rotulo: "Militar", truncar: true },
            ...colunasComDado.map((a) => ({
              rotulo: a.rotulo,
              alinhamento: "centro" as const,
              nowrap: true,
            })),
            { rotulo: "Total", alinhamento: "centro" as const, nowrap: true },
          ],
          [...corpo, ...rodape.map((celulas) => ({ celulas, classe: "linha-total" }))],
          "Nenhuma designação neste escopo.",
          { larga: true, listagem: true },
        )
      }
    </section>
  `);

  document
    .querySelector<HTMLFormElement>("#filtro-encarregados")
    ?.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const formulario = new FormData(evento.currentTarget as HTMLFormElement);
      const ano = String(formulario.get("ano") ?? "");
      anoSelecionado = ano ? Number(ano) : null;
      papeisSelecionados = formulario.getAll("papel").map(String);
      void renderEncarregados(ctx);
    });

  ligarExportacao(() =>
    baixarCsv(
      `designacoes-por-militar-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Militar", "Matricula", ...colunasComDado.map((a) => a.rotulo), "Total"],
      linhas.map((l) => [
        `${l.posto_graduacao} ${l.nome}`,
        l.matricula,
        ...colunasComDado.map((a) => l.celulas.find((c) => c.id === a.id)?.total ?? 0),
        l.total,
      ]),
    ),
  );
}
