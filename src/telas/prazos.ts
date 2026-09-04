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
// listagem de vencidos e existia só pela exportação tabular. Duas telas para o
// mesmo dado divergem; a planilha é um botão.
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
  baixarPlanilha,
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
/**
 * Piso da tabela desta tela, em px. **Medido**, não estimado — ver
 * `tools/tela/README.md`, que também diz como remedir depois de mexer em
 * coluna. Abaixo dele o `.table-wrap` rola; sem ele a coluna `nowrap` pinta
 * por cima da vizinha, e nada acusa.
 */
export const PISO_PX = 780;
// Medido: 756, com folga para o WebKitGTK.

export const COLUNAS: Coluna[] = [
  { rotulo: "Apuratório", largura: 16, alinhamento: "centro", truncar: true },
  { rotulo: "Unidade", largura: 18, alinhamento: "centro", truncar: true },
  { rotulo: "Responsável", largura: 32, truncar: true },
  { rotulo: "Vencimento", largura: 14, alinhamento: "centro", nowrap: true },
  { rotulo: "Dias", largura: 12, alinhamento: "centro", nowrap: true },
  // "1ª prorrogação" precisa quebrar: com `nowrap`, os 8% da coluna
  // terminavam na borda física da folha e o PDF perdia o último caractere.
  { rotulo: "Prazo", largura: 8, alinhamento: "centro" },
];

/**
 * Linhas por bloco indivisível no papel.
 *
 * A folha em paisagem leva 18 destas linhas no pior caso, medido em
 * `tools/impressao` (`medicao-prazos`); 14 deixa margem para a linha alta sem
 * empurrar o bloco inteiro para a folha seguinte.
 */
const LINHAS_POR_BLOCO = 14;

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
          ${barraDeExportacao({ imprimir: true, planilha: true })}
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

      <div id="conteudo-paginado-prazos">
        <h2>Vencidos <span class="badge badge--erro">${totalVencidos}</span></h2>
        ${tabela(COLUNAS, linhas(itensVencidos), "Nenhum prazo vencido.", {
          listagem: true,
          pisoPx: PISO_PX,
        })}
        ${paginacao("vencidos", paginas.vencidos, ITENS_POR_PAGINA, totalVencidos)}

        <!-- Laranja, e não o amarelo: este bloco é urgência de prazo, e o
             amarelo passou a significar "entregue" na coluna de status. -->
        <h2>Vencendo em até ${escapeHtml(janelaDias)} dias
          <span class="badge badge--urgente">${totalAVencer}</span></h2>
        ${tabela(COLUNAS, linhas(itensAVencer), "Nenhum prazo na janela.", {
          listagem: true,
          pisoPx: PISO_PX,
        })}
        ${paginacao("proximos", paginas.proximos, ITENS_POR_PAGINA, totalAVencer)}
      </div>
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

  // A planilha e o papel levam os **dois blocos inteiros**, não as dez linhas de
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
      const colunas = [
        { rotulo: "Situação", largura: 22, alinhamento: "centro" as const },
        { rotulo: "Apuratório", largura: 24 },
        { rotulo: "Unidade", largura: 30 },
        { rotulo: "Responsável", largura: 40 },
        { rotulo: "Vencimento", tipo: "data" as const, largura: 16, alinhamento: "centro" as const },
        { rotulo: "Dias restantes", tipo: "inteiro" as const, largura: 16, alinhamento: "direita" as const },
        { rotulo: "Prazo", largura: 20, alinhamento: "centro" as const },
      ];
      const linha = (i: DeadlineReportItem, bloco: string) => ({
        celulas: [
          bloco,
          identificacao(i),
          formatarOrigem(i.unidade_origem, i.subunidade_secao_origem),
          responsavel(i),
          i.data_vencimento,
          i.dias_restantes,
          vigencia(i),
        ],
      });
      return baixarPlanilha(`prazos-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        {
          nome: "Vencidos",
          titulo: "Prazos vencidos",
          metadados: [{ rotulo: "Registros", valor: String(todos.vencidos.length) }],
          colunas,
          linhas: todos.vencidos.map((i) => ({ ...linha(i, "Vencido"), tom: "perigo" })),
          congelar_colunas: 2,
        },
        {
          nome: "A vencer",
          titulo: `Prazos vencendo em até ${janelaDias} dias`,
          metadados: [
            { rotulo: "Janela", valor: `${janelaDias} dias` },
            { rotulo: "Registros", valor: String(todos.aVencer.length) },
          ],
          colunas,
          linhas: todos.aVencer.map((i) => ({
            ...linha(i, `Vence em até ${janelaDias} dias`),
            tom: "atencao",
          })),
          congelar_colunas: 2,
        },
      ]);
    },
    async () => {
      const todos = await carregarOsDois();
      return `<h2>Vencidos</h2>
        ${tabela(COLUNAS, linhas(todos.vencidos), "Nenhum prazo vencido.", {
          listagem: true,
          linhasPorFragmentoImpressao: LINHAS_POR_BLOCO,
        })}
        <h2>Vencendo em até ${escapeHtml(janelaDias)} dias</h2>
        ${tabela(COLUNAS, linhas(todos.aVencer), "Nenhum prazo na janela.", {
          listagem: true,
          linhasPorFragmentoImpressao: LINHAS_POR_BLOCO,
        })}`;
    },
    {
      orientacao: "paisagem",
      perfil: "tabular",
      seletorSubstituido: "#conteudo-paginado-prazos",
    },
  );
}
