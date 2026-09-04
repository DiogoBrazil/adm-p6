// Designações e carga de trabalho por militar.
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
// A PERGUNTA QUE A RODADA 29 ACRESCENTOU
//
// Contar designações não diz em que pé elas estão. A Seção precisa saber, por
// militar e por espécie, quanto está **concluído**, **em andamento no prazo** e
// **em andamento vencido** — e existe um quarto estado, o apuratório em
// andamento cujo recebimento nunca foi informado, que não tem prazo nenhum.
//
// Um filtro só responde às perguntas que motivaram a mudança:
//
//   • "quantos o Sgt Fulano tem, e quantos estão vencidos"  → escolher o militar
//   • "quais encarregados estão com IPM"                    → marcar IPM + Encarregado
//   • "quem está mais atrasado"                             → Situação = vencido
//   • "entre os encarregados de SR, qual concluiu por último"
//                          → marcar SR, Situação = concluído, Conclusão mais recente
//
// Por isso não há uma segunda tela: seria a mesma consulta com o filtro já
// marcado, e a rodada 29 existe justamente para acabar com telas assim.
//
// O filtro de situação recorta **o que é contado**, não quem é listado — e as
// duas datas saem do conjunto já recortado. É isso que faz a última pergunta ter
// resposta: com a data do conjunto inteiro, filtrar por "vencido" ainda traria a
// conclusão de um processo que o filtro acabou de excluir.
//
// A matriz conta TODA designação registrada, inclusive as já encerradas: se um
// militar foi encarregado e depois substituído, o trabalho que teve não
// desaparece do panorama. O alternador de vínculo inverte essa escolha para
// quem pergunta "o que ele tem hoje na mão". O relatório anual, esse sim, conta
// só o responsável vigente — são perguntas diferentes.

import { call, type DesignacaoMatrizLinha, type UserListItem } from "../api";
import {
  baldesComDado,
  cartaoAnalitico,
  graficoCarga,
  kpiAnalitico,
  montarCartoesAnaliticos,
  totalDaSituacao,
  type GraficoSpec,
  type SituacaoContagem,
} from "../graficos";
import {
  ativarSelectsPesquisaveis,
  barraDeExportacao,
  baixarPlanilha,
  escapeHtml,
  formatarData,
  formatarQualificacaoMilitar,
  ligarExportacao,
  option,
  tabela,
  type Coluna,
} from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/estatisticas/encarregados";

type Opcao = { id: string; rotulo: string; titulo?: string };

export type DesignacaoNormalizadaImpressao = {
  militar: string;
  apuratorio: string;
  quantidade: number;
  tipo: "item" | "total-militar" | "total-geral";
};

/**
 * Converte a matriz de largura variável numa listagem que cresce para baixo.
 * A tela continua matricial; só o papel usa esta forma, que permanece legível
 * quando o catálogo ganhar novas espécies de apuratório.
 */
export function normalizarDesignacoesParaImpressao(
  linhas: readonly DesignacaoMatrizLinha[],
  apuratorios: readonly Pick<Opcao, "id" | "rotulo">[],
): DesignacaoNormalizadaImpressao[] {
  const resultado: DesignacaoNormalizadaImpressao[] = [];

  for (const linha of linhas) {
    const militar = formatarQualificacaoMilitar(
      linha.posto_graduacao,
      linha.matricula,
      linha.nome,
    );
    for (const apuratorio of apuratorios) {
      const quantidade = linha.celulas.find((celula) => celula.id === apuratorio.id)?.total ?? 0;
      if (quantidade === 0) continue;
      resultado.push({
        militar,
        apuratorio: apuratorio.rotulo,
        quantidade,
        tipo: "item",
      });
    }
    resultado.push({
      militar: `Total — ${militar}`,
      apuratorio: "Todas as espécies",
      quantidade: linha.total,
      tipo: "total-militar",
    });
  }

  if (linhas.length) {
    resultado.push({
      militar: "Total geral",
      apuratorio: "Todos os policiais militares e espécies",
      quantidade: linhas.reduce((total, linha) => total + linha.total, 0),
      tipo: "total-geral",
    });
  }

  return resultado;
}

/**
 * Uma linha do cartão de carga.
 *
 * As duas leituras da tela têm a mesma forma — um rótulo, os quatro contadores
 * e as duas datas —, e é por isso que uma função só desenha as duas. Muda o que
 * o rótulo nomeia: o militar, ou a espécie de apuratório.
 */
type Carga = SituacaoContagem & {
  rotulo: string;
  ultimo_recebimento: string | null;
  ultima_conclusao: string | null;
};

let anoSelecionado: number | null = null;
let papeisSelecionados: string[] = [];
let apuratoriosSelecionados: string[] = [];
let militarSelecionado: string | null = null;
/**
 * O rótulo do militar escolhido, guardado no momento da escolha.
 *
 * Sem ele, um militar **desativado** com histórico sairia do seletor sozinho:
 * `users_list_ativos` não o traz (é lista de opções, e filtra `ativo`), e nem
 * sempre há linha no resultado de onde tirar o nome — basta que o escopo do
 * filtro não alcance nenhuma designação dele.
 */
let rotuloMilitarSelecionado: string | null = null;
let somenteVigentes = false;
let situacaoSelecionada = "";
let ordenacao = "total";

/**
 * Os recortes de situação, na ordem em que a tabela mostra os baldes.
 *
 * Quatro são os baldes exclusivos da decisão 57. `em_andamento` é o quinto
 * item, mas **não** um quinto balde: é a união de `no_prazo` e `vencidos`,
 * resolvida no filtro do backend (`repository::baldes_do_filtro`), e por isso
 * vem logo antes dos dois que ela soma.
 *
 * Ela deixa "Sem prazo definido" de fora por decisão: o apuratório sem
 * recebimento informado está em andamento, mas não tem prazo a acompanhar, e é
 * prazo o que este recorte serve para acompanhar. Daí que somar os dois
 * primeiros não fecha com `total - concluídos` quando existe algum sem prazo.
 */
const SITUACOES: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Todas as situações" },
  { valor: "concluidos", rotulo: "Concluídos" },
  { valor: "em_andamento", rotulo: "Em andamento (todos)" },
  { valor: "no_prazo", rotulo: "Em andamento no prazo" },
  { valor: "vencidos", rotulo: "Em andamento vencido" },
  { valor: "sem_prazo", rotulo: "Sem prazo definido" },
];

/**
 * As ordenações, e o que cada uma responde.
 *
 * As de data existem por uma pergunta concreta da Seção: "entre os encarregados
 * de SR, qual foi o mais recente que recebeu ou concluiu". A de recebimento
 * antigo responde a outra, igualmente prática: quem está com procedimento na
 * mão há mais tempo.
 */
const ORDENACOES: { valor: string; rotulo: string }[] = [
  { valor: "total", rotulo: "Mais apuratórios" },
  { valor: "recebimento_recente", rotulo: "Recebimento mais recente" },
  { valor: "recebimento_antigo", rotulo: "Recebimento mais antigo" },
  { valor: "conclusao_recente", rotulo: "Conclusão mais recente" },
  { valor: "conclusao_antiga", rotulo: "Conclusão mais antiga" },
];

const qualificacao = (l: { posto_graduacao: string; matricula: string; nome: string }) =>
  formatarQualificacaoMilitar(l.posto_graduacao, l.matricula, l.nome);

const totalDaColuna = (linhas: DesignacaoMatrizLinha[], apuratorioId: string) =>
  linhas.reduce((acc, l) => acc + (l.celulas.find((c) => c.id === apuratorioId)?.total ?? 0), 0);

export async function renderEncarregados(ctx: ContextoTela): Promise<void> {
  const falhar = (mensagem: string) =>
    ctx.shell(`<section class="panel"><h1>Designações por Policial Militar</h1>
      <p class="error">${escapeHtml(mensagem)}</p></section>`);

  const [anosResposta, apuratoriosResposta, papeisResposta, militaresResposta] = await Promise.all([
    call("reports_available_years"),
    call("legal_catalogs_list", { catalogo: "apuratorios" }),
    call("legal_catalogs_list", { catalogo: "papeis_processo" }),
    // Lista de opções não pagina — ver a armadilha do teto de 200 na seção 7.
    call("users_list_ativos"),
  ]);
  const falhaInicial = [anosResposta, apuratoriosResposta, papeisResposta, militaresResposta].find(
    (resposta) => !resposta.ok,
  );
  if (falhaInicial) {
    falhar(falhaInicial.error ?? "Não foi possível carregar os filtros.");
    return;
  }
  const anos = anosResposta.data ?? [];
  const apuratorios: Opcao[] = (apuratoriosResposta.data ?? []).map((l) => ({
    id: String(l.id),
    rotulo: String(l.sigla ?? ""),
    titulo: String(l.nome ?? ""),
  }));
  const papeis: Opcao[] = (papeisResposta.data ?? []).map((l) => ({
    id: String(l.id),
    rotulo: String(l.nome ?? ""),
  }));
  const militares: UserListItem[] = militaresResposta.data ?? [];

  const linhasResposta = await call("reports_designations_matrix", {
    filter: {
      ano: anoSelecionado,
      papel_ids: papeisSelecionados,
      apuratorio_ids: apuratoriosSelecionados,
      somente_vigentes: somenteVigentes,
      situacao: situacaoSelecionada || null,
      ordenacao,
      policial_militar_id: militarSelecionado,
    },
  });
  if (!linhasResposta.ok) {
    falhar(linhasResposta.error ?? "Não foi possível carregar as designações.");
    return;
  }
  const linhas = linhasResposta.data ?? [];
  // A tela entra em modo militar pela **escolha**, não pelo resultado: um
  // militar sem nenhuma designação no escopo tem de mostrar zeros com o nome
  // dele, e não cair calado na visão de todos.
  const modoMilitar = militarSelecionado !== null;
  const linhaDoMilitar = modoMilitar ? (linhas[0] ?? null) : null;
  const situacaoDoMilitar = linhaDoMilitar ?? {
    concluidos: 0,
    no_prazo: 0,
    vencidos: 0,
    sem_prazo: 0,
    total: 0,
  };

  // Um militar já desativado continua aparecendo no histórico, mas não vem em
  // `users_list_ativos` — leitura de registro existente não filtra `ativo`. Sem
  // isto, escolher um deles faria a seleção sumir do seletor sozinha.
  const opcoesMilitar: Opcao[] = militares.map((m) => ({
    id: m.id,
    rotulo: formatarQualificacaoMilitar(m.posto_graduacao, m.matricula, m.nome),
  }));
  if (militarSelecionado && !opcoesMilitar.some((o) => o.id === militarSelecionado)) {
    const rotulo = linhaDoMilitar
      ? qualificacao(linhaDoMilitar)
      : (rotuloMilitarSelecionado ?? "Policial militar selecionado");
    opcoesMilitar.unshift({ id: militarSelecionado, rotulo: `${rotulo} (inativo)` });
  }

  // Só as colunas com alguma designação no escopo entram: a matriz inteira do
  // catálogo ficaria larga e vazia assim que houver muitos apuratórios.
  const colunasComDado = apuratorios.filter((a) => totalDaColuna(linhas, a.id) > 0);
  // "Sem prazo definido" só vira coluna quando alguém no escopo está nesse
  // estado, que é o caso incomum: uma coluna de zeros ocupa largura que a
  // matriz precisa para as espécies.
  const baldes = baldesComDado(linhas);
  /**
   * As colunas de situação dividem o que sobra depois do rótulo e do total.
   *
   * Quantos baldes existem depende do dado, então a largura é calculada: com
   * `table-layout: fixed`, coluna sem largura declarada divide a sobra por
   * conta própria, e a tabela deixa de somar 100 como as outras do sistema.
   */
  const colunasDeBalde = (larguraDisponivel: number): Coluna[] =>
    baldes.map((b) => ({
      rotulo: b.rotulo,
      largura: Math.floor(larguraDisponivel / Math.max(1, baldes.length)),
      alinhamento: "centro" as const,
      nowrap: true,
    }));

  const escopoAno = anoSelecionado === null ? "Todos os anos" : String(anoSelecionado);
  const escopoApuratorios = apuratoriosSelecionados.length
    ? `${apuratoriosSelecionados.length} apuratório(s) selecionado(s)`
    : "Todos os apuratórios";
  const escopoPapeis = papeisSelecionados.length
    ? `${papeisSelecionados.length} função(ões) selecionada(s)`
    : "Todas as funções";
  const escopoVinculo = somenteVigentes ? "Somente designações vigentes" : "Todas as designações";
  const escopoSituacao =
    SITUACOES.find((s) => s.valor === situacaoSelecionada)?.rotulo ?? "Todas as situações";
  const escopoOrdem = ORDENACOES.find((o) => o.valor === ordenacao)?.rotulo ?? "Mais apuratórios";

  // ── Cartão principal: muda de pergunta conforme haja ou não um militar ────
  const cargaPorMilitar: Carga[] = linhas.map((l) => ({ ...l, rotulo: qualificacao(l) }));
  const cargaPorEspecie: Carga[] = (linhaDoMilitar?.celulas ?? []).map((c) => ({
    ...c,
    rotulo: c.rotulo,
  }));

  const specCarga: GraficoSpec = modoMilitar
    ? graficoCarga("designacoes-carga", cargaPorEspecie, { rotuloPercentual: "da espécie" })
    : graficoCarga("designacoes-carga", cargaPorMilitar, {
        limitar: true,
        rotuloPercentual: "da carga do policial militar",
      });

  /**
   * A tabela do cartão de carga, com uma coluna por balde.
   *
   * Serve às duas leituras porque as duas têm a mesma forma: um rótulo e os
   * quatro contadores. Muda só o que o rótulo nomeia — o militar, ou a espécie.
   */
  /**
   * As duas datas ficam **sempre** na tabela, e não só quando se ordena por
   * elas: ordenar por uma coluna que não aparece deixa a lista numa ordem que
   * o operador não consegue conferir.
   */
  const tabelaDeCarga = (
    itens: readonly Carga[],
    rotuloPrimeira: string,
    larguraPrimeira: number,
  ) =>
    tabela(
      [
        { rotulo: rotuloPrimeira, largura: larguraPrimeira, truncar: true },
        ...colunasDeBalde(100 - larguraPrimeira - 34),
        { rotulo: "Total", largura: 8, alinhamento: "centro" as const, nowrap: true },
        { rotulo: "Últ. recebimento", largura: 13, alinhamento: "centro" as const, nowrap: true },
        { rotulo: "Últ. conclusão", largura: 13, alinhamento: "centro" as const, nowrap: true },
      ],
      itens.map((item) => [
        item.rotulo,
        ...baldes.map((b) => ({ texto: String(item[b.chave]), numerica: true })),
        { texto: String(totalDaSituacao(item)), numerica: true, classe: "total" },
        { texto: formatarData(item.ultimo_recebimento), numerica: true },
        { texto: formatarData(item.ultima_conclusao), numerica: true },
      ]),
      "Nenhuma designação neste escopo.",
      // Sem fragmento: esta tabela é o verso de um `cartaoAnalitico`, e dentro
      // de um item de `.analytics-grid` o WebKitGTK ignora o `break-inside`
      // das caixas internas. Medido em `tools/impressao`
      // (`analitico-cartoes` × `analitico-cartoes-inteiros`): fragmentar
      // custava uma folha a mais **e** partia uma linha. Quem protege é o
      // `break-inside: avoid` do próprio cartão.
      { listagem: true },
    );

  const tabelaCarga = modoMilitar
    ? tabelaDeCarga(cargaPorEspecie, "Apuratório", 26)
    : tabelaDeCarga(cargaPorMilitar, "Policial Militar", 32);

  // ── Matriz militar × apuratório, ou a ficha de um militar só ─────────────
  const celulasDe = (linha: DesignacaoMatrizLinha) =>
    colunasComDado.map((a) => {
      const valor = linha.celulas.find((c) => c.id === a.id)?.total ?? 0;
      return { texto: valor ? String(valor) : "—", numerica: true };
    });

  const rodape = linhas.length
    ? [
        {
          celulas: [
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
          classe: "linha-total",
        },
      ]
    : [];

  // Matriz de coluna dinâmica: quantas colunas existem depende do dado, então
  // largura percentual não se aplica. Rola na horizontal, que é o que uma
  // matriz pede.
  const tabelaMatriz = tabela(
    [
      { rotulo: "Policial Militar", truncar: true },
      ...colunasComDado.map((a) => ({
        rotulo: a.rotulo,
        alinhamento: "centro" as const,
        nowrap: true,
      })),
      { rotulo: "Total", alinhamento: "centro" as const, nowrap: true },
    ],
    [...linhas.map((l) => [qualificacao(l), ...celulasDe(l), { texto: String(l.total), numerica: true, classe: "total" }]), ...rodape],
    "Nenhuma designação neste escopo.",
    { larga: true, listagem: true },
  );

  const matrizNormalizada = normalizarDesignacoesParaImpressao(linhas, colunasComDado);
  const tabelaMatrizImpressao = tabela(
    [
      { rotulo: "Policial Militar", largura: 44 },
      { rotulo: "Apuratório", largura: 44 },
      { rotulo: "Quantidade", largura: 12, alinhamento: "direita", nowrap: true },
    ],
    matrizNormalizada.map((linha) => ({
      celulas: [
        linha.militar,
        linha.apuratorio,
        { texto: String(linha.quantidade), numerica: true, classe: "total" },
      ],
      classe: linha.tipo === "item" ? "" : "linha-total",
    })),
    "Nenhuma designação neste escopo.",
    // Vinte e cinco destas linhas cabem na folha em paisagem
    // (`medicao-matriz`); 22 deixa a folga da linha alta. Aqui o fragmento
    // vale: a matriz normalizada sai no fluxo do documento, não num cartão.
    {
      listagem: true,
      linhasPorFragmentoImpressao: 22,
      // A primeira folha divide espaço com o título da tela, a faixa de KPIs e
      // o título da matriz: sobram ~128mm dos 180mm úteis. Doze é o maior bloco
      // que ainda cabe ali — com 13 a tabela transborda a margem inferior e a
      // última folha sai vazia (`tools/impressao`, `calibrado-designacoes-folha1`,
      // varrido de 10 a 17). Os 18 anteriores foram medidos quando o cartão
      // ficava entre os KPIs e a matriz, e a matriz só começava na folha 3.
      linhasNoPrimeiroFragmentoImpressao: 12,
    },
  );

  const totalDesignacoes = linhas.reduce((acc, linha) => acc + linha.total, 0);
  const vencidosNoEscopo = linhas.reduce((acc, linha) => acc + linha.vencidos, 0);
  const concluidosNoEscopo = linhas.reduce((acc, linha) => acc + linha.concluidos, 0);
  const nomeDoMilitar = linhaDoMilitar
    ? qualificacao(linhaDoMilitar)
    : (rotuloMilitarSelecionado ?? "Policial militar selecionado");
  const semPrazo = situacaoDoMilitar.sem_prazo;

  const kpis = modoMilitar
    ? `
      ${kpiAnalitico(situacaoDoMilitar.total, "Apuratórios do policial militar", {
        detalhe: nomeDoMilitar,
      })}
      ${kpiAnalitico(situacaoDoMilitar.concluidos, "Concluídos", { tom: "sucesso" })}
      ${kpiAnalitico(situacaoDoMilitar.no_prazo, "Em andamento no prazo", {
        tom: "andamento",
        ...(semPrazo ? { detalhe: `${semPrazo} sem prazo definido` } : {}),
      })}
      ${kpiAnalitico(situacaoDoMilitar.vencidos, "Em andamento vencido", {
        tom: situacaoDoMilitar.vencidos ? "alerta" : "sucesso",
        detalhe: situacaoDoMilitar.vencidos
          ? "Requer atenção imediata"
          : "Nenhuma pendência crítica",
      })}`
    : `
      ${kpiAnalitico(linhas.length, "POLICIAIS MILITARES DESIGNADOS")}
      ${kpiAnalitico(totalDesignacoes, "Apuratórios no escopo")}
      ${kpiAnalitico(concluidosNoEscopo, "Concluídos", { tom: "sucesso" })}
      ${kpiAnalitico(vencidosNoEscopo, "Em andamento vencidos", {
        tom: vencidosNoEscopo ? "alerta" : "sucesso",
        detalhe: vencidosNoEscopo ? "Requer atenção imediata" : "Nenhuma pendência crítica",
      })}`;

  ctx.shell(`
    <section class="panel panel--analytics">
      <div class="page-head">
        <div>
          <h1>Designações por Policial Militar</h1>
          <p>${escapeHtml(
            modoMilitar
              ? `Carga de ${nomeDoMilitar}, por espécie de apuratório.`
              : "Carga de trabalho por policial militar e por espécie, na situação de hoje.",
          )}</p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ imprimir: true, planilha: !!linhas.length })}</div>
      </div>

      <form id="filtro-encarregados" class="filtro-bar">
        <label>Ano
          <select name="ano">
            <option value=""${anoSelecionado === null ? " selected" : ""}>Todos</option>
            ${anos.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
          </select>
        </label>
        <label class="filtro-campo--largo">Policial Militar
          <select name="militar" data-select-pesquisavel data-placeholder="Todos os policiais militares">
            <option value=""${militarSelecionado === null ? " selected" : ""}>Todos os policiais militares</option>
            ${opcoesMilitar.map((m) => option(m.id, m.rotulo, m.id === militarSelecionado)).join("")}
          </select>
        </label>
        <label>Situação
          <select name="situacao">
            ${SITUACOES.map((s) => option(s.valor, s.rotulo, s.valor === situacaoSelecionada)).join("")}
          </select>
        </label>
        <label>Ordenar por
          <select name="ordenacao">
            ${ORDENACOES.map((o) => option(o.valor, o.rotulo, o.valor === ordenacao)).join("")}
          </select>
        </label>
        <label>Vínculo
          <select name="vinculo">
            ${option("todas", "Todas as designações", !somenteVigentes)}
            ${option("vigentes", "Somente as vigentes", somenteVigentes)}
          </select>
        </label>
        <fieldset class="filtro-apuratorios">
          <legend>Apuratórios <span class="hint">(nenhum marcado = todos)</span></legend>
          ${apuratorios
            .map(
              (a) => `<label class="filtro-chip-check" title="${escapeHtml(a.titulo ?? "")}">
                <input type="checkbox" name="apuratorio" value="${escapeHtml(a.id)}"
                       ${apuratoriosSelecionados.includes(a.id) ? "checked" : ""} />
                <span>${escapeHtml(a.rotulo)}</span>
              </label>`,
            )
            .join("")}
        </fieldset>
        <fieldset class="filtro-apuratorios filtro-apuratorios--compacto">
          <legend>Funções <span class="hint">(nenhuma marcada = todas)</span></legend>
          ${papeis
            .map(
              (p) => `<label class="filtro-chip-check">
                <input type="checkbox" name="papel" value="${escapeHtml(p.id)}"
                       ${papeisSelecionados.includes(p.id) ? "checked" : ""} />
                <span>${escapeHtml(p.rotulo)}</span>
              </label>`,
            )
            .join("")}
        </fieldset>
        <button type="submit">Aplicar</button>
      </form>

      <div class="analytics-filter-summary" aria-live="polite">
        <strong>Escopo aplicado:</strong><span>${escapeHtml(escopoAno)}</span><span>·</span><span>${escapeHtml(escopoApuratorios)}</span><span>·</span><span>${escapeHtml(escopoPapeis)}</span><span>·</span><span>${escapeHtml(escopoSituacao)}</span><span>·</span><span>${escapeHtml(escopoVinculo)}</span><span>·</span><span>por ${escapeHtml(escopoOrdem.toLowerCase())}</span>
      </div>

      <div class="analytics-kpis">${kpis}</div>

      <!-- No papel este cartão desce para o fim do documento, por
           adiarBlocosParaOFimDaImpressao: ele é indivisível e mais alto que a
           folha menos o cabeçalho, e ficando aqui gastava duas folhas antes da
           primeira linha da matriz. -->
      <div class="analytics-grid" data-impressao-ao-fim>
        ${cartaoAnalitico({
          id: "designacoes-carga",
          titulo: modoMilitar ? "Situação por espécie de apuratório" : "Carga de trabalho por policial militar",
          descricao: modoMilitar
            ? "Os apuratórios deste policial militar, por espécie e situação."
            : "Concluídos, em andamento no prazo e vencidos, no escopo do filtro.",
          grafico: specCarga,
          tabela: tabelaCarga,
          vazio: modoMilitar
            ? "Nenhuma designação deste policial militar neste escopo"
            : "Nada registrado neste escopo",
          limitado: !modoMilitar && linhas.length > 12,
          classe: "analytics-card--wide",
        })}
      </div>

      ${
        modoMilitar
          ? ""
          : `<div class="matriz-designacoes--tela">
               <h2>Matriz de designações</h2>
               <p class="hint">Policial Militar × espécie de apuratório, no escopo do filtro.</p>
               ${tabelaMatriz}
             </div>
             <div class="somente-impressao matriz-designacoes--impressao">
               <h2>Designações por Policial Militar e espécie</h2>
               <p class="hint">Combinações com quantidade zero foram omitidas; os totais preservam o escopo do filtro.</p>
               ${tabelaMatrizImpressao}
             </div>`
      }
    </section>
  `);

  montarCartoesAnaliticos([specCarga]);
  ativarSelectsPesquisaveis(document.querySelector("#filtro-encarregados") ?? document);

  document
    .querySelector<HTMLFormElement>("#filtro-encarregados")
    ?.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const formulario = new FormData(evento.currentTarget as HTMLFormElement);
      const ano = String(formulario.get("ano") ?? "");
      anoSelecionado = ano ? Number(ano) : null;
      const seletorMilitar = (evento.currentTarget as HTMLFormElement).elements.namedItem(
        "militar",
      ) as HTMLSelectElement | null;
      const militar = String(formulario.get("militar") ?? "");
      militarSelecionado = militar || null;
      // O rótulo é guardado agora porque depois pode não haver de onde tirá-lo.
      // A marca "(inativo)" é da apresentação e sai aqui: guardá-la faria a
      // próxima volta escrever "(inativo) (inativo)".
      rotuloMilitarSelecionado = militar
        ? (seletorMilitar?.selectedOptions[0]?.textContent?.trim().replace(/\s*\(inativo\)$/, "") ??
          null)
        : null;
      somenteVigentes = String(formulario.get("vinculo") ?? "") === "vigentes";
      situacaoSelecionada = String(formulario.get("situacao") ?? "");
      ordenacao = String(formulario.get("ordenacao") ?? "total");
      papeisSelecionados = formulario.getAll("papel").map(String);
      apuratoriosSelecionados = formulario.getAll("apuratorio").map(String);
      void renderEncarregados(ctx);
    });

  // A planilha leva a situação, não só o total: é para ela que a exportação é aberta.
  ligarExportacao(
    () =>
      baixarPlanilha(
        `designacoes-por-policial-militar-${new Date().toISOString().slice(0, 10)}.xlsx`,
        [
          {
            nome: "Designações",
            titulo: "Designações por Policial Militar",
            metadados: [
              { rotulo: "Ano", valor: escopoAno },
              {
                rotulo: "Policial militar",
                valor: modoMilitar ? nomeDoMilitar : "Todos os policiais militares",
              },
              {
                rotulo: "Apuratórios",
                valor: apuratoriosSelecionados.length
                  ? apuratorios
                      .filter((item) => apuratoriosSelecionados.includes(item.id))
                      .map((item) => item.rotulo)
                      .join(", ")
                  : "Todos os apuratórios",
              },
              {
                rotulo: "Funções",
                valor: papeisSelecionados.length
                  ? papeis
                      .filter((item) => papeisSelecionados.includes(item.id))
                      .map((item) => item.rotulo)
                      .join(", ")
                  : "Todas as funções",
              },
              { rotulo: "Situação", valor: escopoSituacao },
              { rotulo: "Vínculo", valor: escopoVinculo },
              { rotulo: "Ordenação", valor: escopoOrdem },
              { rotulo: "Registros", valor: String(linhas.length) },
            ],
            colunas: [
              { rotulo: "Policial Militar", largura: 38 },
              { rotulo: "Matrícula", largura: 14 },
              {
                rotulo: "Concluídos",
                tipo: "inteiro",
                largura: 13,
                alinhamento: "direita",
                tom: "sucesso",
              },
              {
                rotulo: "Em andamento no prazo",
                tipo: "inteiro",
                largura: 19,
                alinhamento: "direita",
                tom: "informacao",
              },
              {
                rotulo: "Em andamento vencido",
                tipo: "inteiro",
                largura: 19,
                alinhamento: "direita",
                tom: "perigo",
              },
              {
                rotulo: "Sem prazo definido",
                tipo: "inteiro",
                largura: 17,
                alinhamento: "direita",
                tom: "atencao",
              },
              ...colunasComDado.map((item) => ({
                rotulo: item.rotulo,
                tipo: "inteiro" as const,
                largura: 12,
                alinhamento: "direita" as const,
              })),
              { rotulo: "Total", tipo: "inteiro", largura: 11, alinhamento: "direita" },
              { rotulo: "Último recebimento", tipo: "data", largura: 18, alinhamento: "centro" },
              { rotulo: "Última conclusão", tipo: "data", largura: 18, alinhamento: "centro" },
            ],
            linhas: linhas.map((linha) => ({
              celulas: [
                `${linha.posto_graduacao} ${linha.nome}`,
                linha.matricula,
                linha.concluidos,
                linha.no_prazo,
                linha.vencidos,
                linha.sem_prazo,
                ...colunasComDado.map(
                  (item) => linha.celulas.find((celula) => celula.id === item.id)?.total ?? 0,
                ),
                linha.total,
                linha.ultimo_recebimento,
                linha.ultima_conclusao,
              ],
            })),
            congelar_colunas: 2,
          },
        ],
      ),
    undefined,
    { orientacao: "paisagem", perfil: "analitico" },
  );
}
