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
//
// O cartão "Criticidade dos prazos" saiu daqui na rodada 29. Ele desenhava
// exatamente os três números da linha de KPIs logo acima — era a terceira vez
// que os mesmos totais apareciam na mesma tela — e é o mesmo cartão do Painel.
// Ficou no Painel, que é a tela de visão geral; aqui, o espaço voltou para as
// duas listagens, que são o motivo de esta tela existir.

import { call, type DeadlineReportFilter, type DeadlineReportItem } from "../api";
import { kpiAnalitico } from "../graficos";
import { faixasDePrazo } from "../graficos/dados";
import {
  avisarSeCortado,
  barraDeExportacao,
  baixarCsv,
  carregarTudo,
  escapeHtml,
  formatarOrigem,
  formatarQualificacaoMilitar,
  ITENS_POR_PAGINA,
  ligarExportacao,
  ligarPaginacao,
  paginacao,
  paginaValida,
  tabela,
  type Coluna,
} from "../dom";
import type { Linha } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/prazos";

let janelaDias = 14;

/**
 * Os dois blocos paginam **em separado**, e cada um guarda a sua página.
 *
 * Com um estado só, avançar em "Vencidos" arrastaria "Vencendo" junto — os
 * dois têm totais diferentes e não andam no mesmo passo. As chaves também
 * separam os ids dos botões: sem elas, o segundo paginador herdaria os do
 * primeiro e os dois responderiam ao mesmo clique.
 */
const paginas = { vencidos: 1, proximos: 1 };

/** As seis colunas dividem 100% da largura. */
const COLUNAS: Coluna[] = [
  { rotulo: "Apuratório", largura: 16, alinhamento: "centro", truncar: true },
  { rotulo: "Unidade", largura: 18, alinhamento: "centro", truncar: true },
  { rotulo: "Responsável", largura: 32, truncar: true },
  { rotulo: "Vencimento", largura: 14, alinhamento: "centro", nowrap: true },
  { rotulo: "Dias", largura: 12, alinhamento: "centro", nowrap: true },
  { rotulo: "Prazo", largura: 8, alinhamento: "centro", nowrap: true },
];

/** Os rótulos do CSV, sem acento no cabeçalho. */
const COLUNAS_CSV = ["Apuratorio", "Unidade", "Responsavel", "Vencimento"];

/**
 * Os dois recortes da tela, e a razão de serem **exclusivos**.
 *
 * "Vencido" é estritamente antes de hoje; "vencendo" vai de hoje até o fim da
 * janela. Até esta rodada o segundo não tinha piso e engolia o primeiro: o
 * mesmo processo aparecia nas duas tabelas, enquanto os cartões de contagem
 * logo acima — que sempre usaram o piso — diziam outra coisa.
 */
const FILTRO_VENCIDOS: DeadlineReportFilter = { apenas_vencidos: true };
const filtroProximos = (): DeadlineReportFilter => ({ dias_ate_vencer: janelaDias });

const identificacao = (i: DeadlineReportItem) => `${i.apuratorio_sigla} nº ${i.numero_controle}`;

const situacao = (i: DeadlineReportItem) =>
  i.dias_restantes < 0 ? `${-i.dias_restantes} em atraso` : `${i.dias_restantes} restantes`;

const vigencia = (i: DeadlineReportItem) =>
  i.ordem === 0 ? "inicial" : `${i.ordem}ª prorrogação`;

const responsavel = (i: DeadlineReportItem) =>
  formatarQualificacaoMilitar(
    i.responsavel_posto_graduacao,
    i.responsavel_matricula,
    i.responsavel_nome,
  );

function linhas(itens: DeadlineReportItem[]): Linha[] {
  return itens.map((i) => ({
    // `tr.atrasado` destaca a linha inteira, não só a célula dos dias.
    classe: i.dias_restantes < 0 ? "atrasado" : "",
    celulas: [
      identificacao(i),
      formatarOrigem(i.unidade_origem, i.subunidade_secao_origem),
      responsavel(i),
      i.data_vencimento,
      { texto: situacao(i), numerica: true },
      vigencia(i),
    ],
  }));
}

export async function renderPrazos(ctx: ContextoTela): Promise<void> {
  const pagina = (filtro: DeadlineReportFilter, page: number, perPage = ITENS_POR_PAGINA) =>
    call("deadlines_report", { filter: { ...filtro, page, per_page: perPage } });

  const [resumoResposta, aVencerResposta, vencidosResposta] = await Promise.all([
    call("deadlines_dashboard", { diasJanela: janelaDias }),
    pagina(filtroProximos(), paginas.proximos),
    pagina(FILTRO_VENCIDOS, paginas.vencidos),
  ]);
  const falha = [resumoResposta, aVencerResposta, vencidosResposta].find(
    (resposta) => !resposta.ok,
  );
  if (falha) {
    ctx.shell(`<section class="panel"><h1>Prazos</h1>
      <p class="error">${escapeHtml(falha.error ?? "Não foi possível carregar os prazos.")}</p></section>`);
    return;
  }
  const resumo = resumoResposta.data;
  const aVencer = aVencerResposta.data;
  const vencidos = vencidosResposta.data;

  const itensVencidos = vencidos?.items ?? [];
  const itensAVencer = aVencer?.items ?? [];
  const totalVencidos = vencidos?.total ?? 0;
  const totalAVencer = aVencer?.total ?? 0;

  // Um prazo prorrogado sai do bloco de vencidos e a página em que se estava
  // pode não existir mais. Corrige antes de desenhar, não depois.
  const corrigidas = {
    vencidos: paginaValida(paginas.vencidos, ITENS_POR_PAGINA, totalVencidos),
    proximos: paginaValida(paginas.proximos, ITENS_POR_PAGINA, totalAVencer),
  };
  if (corrigidas.vencidos !== paginas.vencidos || corrigidas.proximos !== paginas.proximos) {
    paginas.vencidos = corrigidas.vencidos;
    paginas.proximos = corrigidas.proximos;
    return renderPrazos(ctx);
  }

  // As faixas seguem servindo ao KPI "Regulares", que é o que sobra depois de
  // vencidos e a vencer — a conta é a mesma, e mora num lugar só.
  const faixas = faixasDePrazo(resumo?.total ?? 0, resumo?.vencidos ?? 0, resumo?.proximos ?? 0);

  ctx.shell(`
    <section class="panel panel--analytics">
      <div class="page-head">
        <div><h1>Prazos</h1><p>Apuratórios em andamento, pelo prazo vigente.</p></div>
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

      <div class="analytics-kpis">
        ${kpiAnalitico(resumo?.total ?? 0, "Com prazo vigente")}
        ${kpiAnalitico(resumo?.vencidos ?? 0, "Vencidos", {
          tom: resumo?.vencidos ? "alerta" : "sucesso",
          detalhe: resumo?.vencidos ? "Fora do prazo" : "Nenhuma pendência crítica",
        })}
        ${kpiAnalitico(resumo?.proximos ?? 0, `Vencem em ${janelaDias} dias`, { tom: "andamento" })}
        ${kpiAnalitico(faixas[2]?.total ?? 0, "Regulares", { tom: "sucesso" })}
      </div>

      <h2>Vencidos <span class="badge badge--erro">${totalVencidos}</span></h2>
      ${tabela(COLUNAS, linhas(itensVencidos), "Nenhum prazo vencido.", { listagem: true })}
      ${paginacao("vencidos", paginas.vencidos, ITENS_POR_PAGINA, totalVencidos)}

      <h2>Vencendo em até ${escapeHtml(janelaDias)} dias
        <span class="badge badge--warn">${totalAVencer}</span></h2>
      ${tabela(COLUNAS, linhas(itensAVencer), "Nenhum prazo na janela.", { listagem: true })}
      ${paginacao("proximos", paginas.proximos, ITENS_POR_PAGINA, totalAVencer)}
    </section>
  `);

  ligarPaginacao("vencidos", paginas.vencidos, (nova) => {
    paginas.vencidos = nova;
    void renderPrazos(ctx);
  });
  ligarPaginacao("proximos", paginas.proximos, (nova) => {
    paginas.proximos = nova;
    void renderPrazos(ctx);
  });

  document.querySelector<HTMLSelectElement>("#janela")?.addEventListener("change", (e) => {
    janelaDias = Number((e.currentTarget as HTMLSelectElement).value);
    // A janela redefine o escopo dos dois blocos: o de vencidos não muda de
    // conteúdo, mas ficar na 3ª página enquanto o outro volta à 1ª confunde.
    paginas.vencidos = 1;
    paginas.proximos = 1;
    void renderPrazos(ctx);
  });

  // O CSV e o papel levam os **dois blocos inteiros**, não as dez linhas de
  // cada um que estão na tela: um relatório de prazos pela metade não serve
  // para cobrar prazo nenhum.
  const blocoInteiro = (filtro: DeadlineReportFilter) =>
    carregarTudo<DeadlineReportItem>(async (page, perPage) => {
      const r = await pagina(filtro, page, perPage);
      return r.data ?? null;
    });

  const carregarOsDois = async () => {
    const [todosVencidos, todosAVencer] = await Promise.all([
      blocoInteiro(FILTRO_VENCIDOS),
      blocoInteiro(filtroProximos()),
    ]);
    avisarSeCortado(todosVencidos.cortado || todosAVencer.cortado);
    return { vencidos: todosVencidos.itens, aVencer: todosAVencer.itens };
  };

  ligarExportacao(
    async () => {
      const todos = await carregarOsDois();
      // Uma coluna a mais diz de qual bloco cada linha veio, para a planilha
      // não perder a distinção que a tela faz com dois títulos.
      const linha = (i: DeadlineReportItem, bloco: string) => [
        bloco,
        identificacao(i),
        formatarOrigem(i.unidade_origem, i.subunidade_secao_origem),
        responsavel(i),
        i.data_vencimento,
        i.dias_restantes,
        vigencia(i),
      ];
      return baixarCsv(
        `prazos-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Situacao", ...COLUNAS_CSV, "Dias restantes", "Prazo"],
        [
          ...todos.vencidos.map((i) => linha(i, "Vencido")),
          ...todos.aVencer.map((i) => linha(i, `Vence em ate ${janelaDias} dias`)),
        ],
      );
    },
    async () => {
      const todos = await carregarOsDois();
      return `<h2>Vencidos</h2>
        ${tabela(COLUNAS, linhas(todos.vencidos), "Nenhum prazo vencido.", { listagem: true })}
        <h2>Vencendo em até ${escapeHtml(janelaDias)} dias</h2>
        ${tabela(COLUNAS, linhas(todos.aVencer), "Nenhum prazo na janela.", { listagem: true })}`;
    },
    { paisagem: true },
  );
}
