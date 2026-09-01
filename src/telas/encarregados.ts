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
  cartaoAnalitico,
  graficoBarras,
  kpiAnalitico,
  montarCartoesAnaliticos,
} from "../graficos";
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
  const [anosResposta, apuratoriosResposta, papeisResposta] = await Promise.all([
    call("reports_available_years"),
    call("legal_catalogs_list", { catalogo: "apuratorios" }),
    call("legal_catalogs_list", { catalogo: "papeis_processo" }),
  ]);
  const falhaInicial = [anosResposta, apuratoriosResposta, papeisResposta].find(
    (resposta) => !resposta.ok,
  );
  if (falhaInicial) {
    ctx.shell(`<section class="panel"><h1>Designações por Militar</h1>
      <p class="error">${escapeHtml(falhaInicial.error ?? "Não foi possível carregar os filtros.")}</p></section>`);
    return;
  }
  const anos = anosResposta.data ?? [];
  const catalogoApuratorios = apuratoriosResposta.data ?? [];
  const catalogoPapeis = papeisResposta.data ?? [];

  const apuratorios: Opcao[] = catalogoApuratorios.map((l) => ({
    id: String(l.id),
    rotulo: String(l.sigla ?? ""),
    titulo: String(l.nome ?? ""),
  }));
  const papeis: Opcao[] = catalogoPapeis.map((l) => ({
    id: String(l.id),
    rotulo: String(l.nome ?? ""),
  }));

  const linhasResposta = await call("reports_designations_matrix", {
    filter: { ano: anoSelecionado, papel_ids: papeisSelecionados, apuratorio_ids: [] },
  });
  if (!linhasResposta.ok) {
    ctx.shell(`<section class="panel"><h1>Designações por Militar</h1>
      <p class="error">${escapeHtml(linhasResposta.error ?? "Não foi possível carregar as designações.")}</p></section>`);
    return;
  }
  const linhas = linhasResposta.data ?? [];

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

  const totalDesignacoes = linhas.reduce((acc, linha) => acc + linha.total, 0);
  const ranking = linhas.map((linha) => ({
    rotulo: formatarQualificacaoMilitar(linha.posto_graduacao, linha.matricula, linha.nome),
    total: linha.total,
  }));
  const specRanking = graficoBarras("designacoes-ranking", ranking, {
    limitar: true,
    rotuloPercentual: "das designações",
  });
  const tabelaRanking = tabela(
    [
      { rotulo: "Militar", largura: 72, truncar: true },
      { rotulo: "Designações", largura: 28, alinhamento: "centro", nowrap: true },
    ],
    ranking.map((item) => [item.rotulo, { texto: String(item.total), numerica: true }]),
    "Nenhuma designação neste escopo.",
    { listagem: true },
  );
  // Matriz de coluna dinâmica: quantas colunas existem depende do dado, então
  // largura percentual não se aplica. Rola na horizontal, que é o que uma
  // matriz pede.
  const tabelaMatriz = tabela(
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
  );

  ctx.shell(`
    <section class="panel panel--analytics">
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

      <div class="analytics-kpis">
        ${kpiAnalitico(linhas.length, "Militares designados")}
        ${kpiAnalitico(totalDesignacoes, "Designações registradas")}
        ${kpiAnalitico(linhas[0]?.total ?? 0, "Mais designado", {
          tom: "andamento",
          detalhe: linhas[0]
            ? formatarQualificacaoMilitar(linhas[0].posto_graduacao, linhas[0].matricula, linhas[0].nome)
            : "Nenhum militar no escopo",
        })}
        ${kpiAnalitico(colunasComDado.length, "Espécies com designação")}
      </div>

      <div class="analytics-grid">
        ${cartaoAnalitico({
          id: "designacoes-ranking",
          titulo: "Histórico de designações por militar",
          descricao: "Conta designações vigentes e encerradas, respeitando o ano e as funções selecionadas.",
          grafico: specRanking,
          tabela: tabelaRanking,
          limitado: linhas.length > 12,
          classe: "analytics-card--wide",
        })}
      </div>

      <h2>Matriz de designações</h2>
      <p class="hint">Militar × espécie de apuratório, no escopo do filtro.</p>
      ${tabelaMatriz}
    </section>
  `);

  montarCartoesAnaliticos([specRanking]);

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
    undefined,
    { paisagem: true },
  );
}
