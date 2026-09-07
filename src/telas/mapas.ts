// Mapa do período e mapas salvos.
//
// A tela chamava três comandos inexistentes — `reports_generate_monthly_map`,
// `reports_generate_complete_map` e `reports_process_types`. Os dois primeiros
// eram o mesmo relatório com um sentinela textual ("TODOS") no lugar do
// escopo; hoje são `reports_map_rows` com `apuratorio_ids`, e "completo" é
// simplesmente não marcar nenhum. O terceiro devolvia as espécies existentes:
// isso é o catálogo de apuratórios.
//
// A REGRA DO PERÍODO
//
// O mapa não lista "o que foi instaurado no mês". Lista o que a Seção tinha em
// mãos: tudo que ainda estava aberto ao fim do período, inclusive instaurado
// em anos anteriores, mais o que foi concluído dentro dele. Quem implementa é
// `maps_reports::repository::map_rows`; aqui só se escolhe o período.

import { call, type MapRow, type SavedMapListItem } from "../api";
import {
  barraDeExportacao,
  baixarPlanilha,
  comCarregamento,
  escapeHtml,
  formatarData,
  formatarOrigem,
  formatarQualificacaoMilitar,
  ITENS_POR_PAGINA,
  ligarExportacao,
  ligarPaginacao,
  notificar,
  option,
  paginacao,
  paginaValida,
  tabela,
  type Coluna,
} from "../dom";
import type { ContextoTela } from "./catalogos";
import { imprimirDocumentoMapa, renderDocumentoMapa } from "./mapa-pdf";

export const ROTA_MENSAL = "/mapas/mensal";
export const ROTA_SALVOS = "/mapas/anteriores";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Apuratorio = { id: string; sigla: string; nome: string };

const hoje = new Date();
let mesSelecionado = hoje.getMonth() + 1;
let anoSelecionado = hoje.getFullYear();
let apuratoriosSelecionados: string[] = [];
let linhasGeradas: MapRow[] | null = null;

/** Último dia do mês, sem depender de tabela de dias: o dia 0 do mês seguinte. */
function periodo(mes: number, ano: number): { inicio: string; fim: string } {
  const dois = (n: number) => String(n).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { inicio: `${ano}-${dois(mes)}-01`, fim: `${ano}-${dois(mes)}-${dois(ultimoDia)}` };
}

function tituloDoMapa(apuratorios: Apuratorio[]): string {
  const escopo =
    apuratoriosSelecionados.length === 0
      ? "todos os apuratórios"
      : apuratorios
          .filter((a) => apuratoriosSelecionados.includes(a.id))
          .map((a) => a.sigla)
          .join(", ");
  return `Mapa de ${MESES[mesSelecionado - 1]}/${anoSelecionado} — ${escopo}`;
}

/**
 * As dez colunas do mapa, com as proporções que a impressão já usava.
 *
 * Elas não são novas: viviam em `report-print.css`, como `th:nth-child(1..10)`,
 * porque a tabela nascia sem largura nenhuma e o papel precisava de alguma.
 * Somavam 100 lá e somam 100 aqui — o que mudou é que agora há **uma** fonte,
 * e a tela passa a mostrar as mesmas proporções do documento (princípio 4).
 *
 * `larga: true` continua: o mapa é o documento emitido, e espremer dez colunas
 * na largura do painel é pior que rolar. Com as larguras declaradas isso deixou
 * de ser escolha entre duas perdas — as proporções valem, o texto longo trunca
 * com `title`, e a tabela ainda rola quando a janela é estreita.
 */
/**
 * Piso da tabela desta tela, em px. **Medido**, não estimado — ver
 * `tools/tela/README.md`, que também diz como remedir depois de mexer em
 * coluna. Abaixo dele o `.table-wrap` rola; sem ele a coluna `nowrap` pinta
 * por cima da vizinha, e nada acusa.
 */
export const PISO_MAPA_PX = 1250;
// Medido: 1215. O `larga: true` desta tabela declara 1060, e faltavam 155px:
// as três datas e o cabeçalho "Instauração" transbordavam por cima da vizinha.
// O piso explícito vence a classe — e este é medido.

export const COLUNAS_MAPA: Coluna[] = [
  { rotulo: "Apuratório", largura: 8, alinhamento: "centro", nowrap: true },
  { rotulo: "Identificação", largura: 12, truncar: true },
  { rotulo: "Unidade", largura: 11, truncar: true },
  { rotulo: "Natureza", largura: 9, truncar: true },
  { rotulo: "Instauração", largura: 9, alinhamento: "centro", nowrap: true },
  { rotulo: "Conclusão", largura: 8, alinhamento: "centro", nowrap: true },
  { rotulo: "Responsável", largura: 13, truncar: true },
  { rotulo: "Envolvidos", largura: 11, truncar: true },
  { rotulo: "Vencimento", largura: 9, alinhamento: "centro", nowrap: true },
  { rotulo: "Último andamento", largura: 10, truncar: true },
];

const linhaMapa = (l: MapRow) => [
  l.apuratorio_sigla,
  l.rotulo,
  formatarOrigem(l.unidade_origem, l.subunidade_secao_origem),
  l.natureza_fato ?? "—",
  formatarData(l.data_instauracao),
  // Sem conclusão o apuratório não é "sem data": está em andamento, e é isso
  // que a coluna diz. `formatarData` devolveria o travessão das outras.
  l.data_conclusao ? formatarData(l.data_conclusao) : "em andamento",
  formatarQualificacaoMilitar(
    l.responsavel_posto_graduacao,
    l.responsavel_matricula,
    l.responsavel_nome,
  ),
  l.envolvidos ?? "—",
  formatarData(l.prazo_vencimento),
  l.ultimo_andamento ?? "—",
];

export async function renderMapaMensal(ctx: ContextoTela): Promise<void> {
  const [anos, catalogo] = await Promise.all([
    call("reports_available_years").then((r) => r.data ?? []),
    call("legal_catalogs_list", { catalogo: "apuratorios" }).then((r) => r.data ?? []),
  ]);
  const apuratorios: Apuratorio[] = catalogo.map((l) => ({
    id: String(l.id),
    sigla: String(l.sigla ?? ""),
    nome: String(l.nome ?? ""),
  }));
  const anosDisponiveis = anos.length ? anos : [anoSelecionado];
  const idsApuratorios = apuratorios.map((apuratorio) => apuratorio.id);
  const selecaoVisual = new Set(
    apuratoriosSelecionados.length === 0
      ? idsApuratorios
      : apuratoriosSelecionados.filter((id) => idsApuratorios.includes(id)),
  );
  const todosSelecionados =
    idsApuratorios.length > 0 && selecaoVisual.size === idsApuratorios.length;

  const concluidos = linhasGeradas?.filter((l) => l.data_conclusao !== null).length ?? 0;
  const andamento = (linhasGeradas?.length ?? 0) - concluidos;

  const resultado = linhasGeradas === null
    ? ""
    : `
      <div class="mapa-resultado-bar">
        <div class="mapa-resultado-resumo">
          <h2>${escapeHtml(tituloDoMapa(apuratorios))}</h2>
          <p>${linhasGeradas.length} no período · ${andamento} em andamento · ${concluidos} concluídos no mês</p>
        </div>
        <div class="mapa-resultado-acoes" role="group" aria-label="Ações do mapa gerado">
          <label class="mapa-resultado-pdf">Conteúdo do PDF
            <select id="pdf-processo">
              <option value="">Mapa completo (${linhasGeradas.length})</option>
              ${linhasGeradas
                .map(
                  (linha) =>
                    `<option value="${escapeHtml(linha.processo_id)}">${escapeHtml(
                      `${linha.apuratorio_sigla} · ${linha.rotulo}`,
                    )}</option>`,
                )
                .join("")}
            </select>
          </label>
          <button id="btn-gerar-pdf" class="outline small" type="button">Gerar PDF</button>
          ${ctx.podeEscrever() ? `<button id="btn-salvar-mapa" class="small" type="button">Salvar este mapa</button>` : ""}
        </div>
      </div>
      ${tabela(COLUNAS_MAPA, linhasGeradas.map(linhaMapa), "Nada em mãos neste período.", {
        larga: true,
        listagem: true,
        pisoPx: PISO_MAPA_PX,
      })}`;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Mapa do Período</h1>
          <p>
            O que estava em mãos no período: aberto até o fim dele — inclusive de
            anos anteriores — mais o concluído dentro dele.
          </p>
        </div>
        <div class="page-head-right">${barraDeExportacao({ planilha: !!linhasGeradas })}</div>
      </div>

      <form id="filtro-mapa" class="filtro-bar">
        <label>Mês
          <select name="mes">
            ${MESES.map((m, i) => option(String(i + 1), m, i + 1 === mesSelecionado)).join("")}
          </select>
        </label>
        <label>Ano
          <select name="ano">
            ${anosDisponiveis.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
          </select>
        </label>
        <fieldset class="filtro-apuratorios">
          <legend>Apuratórios <span class="hint">(escolha um ou mais)</span></legend>
          <div class="filtro-apuratorios__opcoes">
            <label class="checkbox-inline filtro-apuratorios__todos" title="Selecionar todos os apuratórios">
              <input id="apuratorios-todos" type="checkbox"
                     aria-describedby="erro-apuratorios"${todosSelecionados ? " checked" : ""}
                     ${idsApuratorios.length === 0 ? "disabled" : ""} />
              Todos
            </label>
            ${apuratorios
              .map(
                (a) => `<label class="checkbox-inline" title="${escapeHtml(a.nome)}">
                  <input type="checkbox" name="apuratorio" value="${escapeHtml(a.id)}"
                         ${selecaoVisual.has(a.id) ? "checked" : ""} />
                  ${escapeHtml(a.sigla)}
                </label>`,
              )
              .join("")}
          </div>
          <small class="campo-erro filtro-apuratorios__erro" id="erro-apuratorios" hidden></small>
        </fieldset>
        <button type="submit">Gerar mapa</button>
      </form>

      ${resultado}
    </section>
  `);

  const filtroMapa = document.querySelector<HTMLFormElement>("#filtro-mapa");
  const marcarTodos = filtroMapa?.querySelector<HTMLInputElement>("#apuratorios-todos") ?? null;
  const opcoesApuratorio = Array.from(
    filtroMapa?.querySelectorAll<HTMLInputElement>('input[name="apuratorio"]') ?? [],
  );
  const erroApuratorios = filtroMapa?.querySelector<HTMLElement>("#erro-apuratorios") ?? null;
  const fieldsetApuratorios = filtroMapa?.querySelector<HTMLElement>(".filtro-apuratorios") ?? null;

  const limparErroApuratorios = () => {
    if (erroApuratorios) {
      erroApuratorios.hidden = true;
      erroApuratorios.textContent = "";
    }
    fieldsetApuratorios?.classList.remove("filtro-apuratorios--erro");
    marcarTodos?.removeAttribute("aria-invalid");
  };

  const sincronizarTodos = () => {
    if (!marcarTodos) return;
    const quantidade = opcoesApuratorio.filter((opcao) => opcao.checked).length;
    marcarTodos.checked = opcoesApuratorio.length > 0 && quantidade === opcoesApuratorio.length;
    marcarTodos.indeterminate = quantidade > 0 && quantidade < opcoesApuratorio.length;
    if (quantidade > 0) limparErroApuratorios();
  };

  marcarTodos?.addEventListener("change", () => {
    for (const opcao of opcoesApuratorio) opcao.checked = marcarTodos.checked;
    marcarTodos.indeterminate = false;
    if (marcarTodos.checked) limparErroApuratorios();
  });
  opcoesApuratorio.forEach((opcao) => opcao.addEventListener("change", sincronizarTodos));
  sincronizarTodos();

  filtroMapa?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const selecionados = form.getAll("apuratorio").map(String);
    if (selecionados.length === 0) {
      const mensagem = idsApuratorios.length
        ? "Selecione pelo menos um apuratório ou marque “Todos”."
        : "Nenhum apuratório está disponível para gerar o mapa.";
      if (erroApuratorios) {
        erroApuratorios.textContent = mensagem;
        erroApuratorios.hidden = false;
      }
      fieldsetApuratorios?.classList.add("filtro-apuratorios--erro");
      marcarTodos?.setAttribute("aria-invalid", "true");
      marcarTodos?.focus();
      notificar(mensagem, "erro");
      return;
    }

    mesSelecionado = Number(form.get("mes"));
    anoSelecionado = Number(form.get("ano"));
    // O contrato do backend já usa lista vazia para representar mapa completo.
    // A interface mostra todos explicitamente, mas preserva esse contrato.
    apuratoriosSelecionados =
      selecionados.length === idsApuratorios.length ? [] : selecionados;

    // O mesmo véu do "Gerar PDF" ao lado, e pela mesma razão: são duas idas ao
    // banco, e a segunda é o redesenho inteiro da tela — que sozinho busca os
    // anos disponíveis e o catálogo de apuratórios. Sem isto o operador clica e
    // fica sem resposta até o mapa aparecer.
    //
    // O gatilho é o próprio botão do formulário: ele troca de rótulo e não
    // aceita um segundo clique enquanto a consulta corre.
    const gerar = (e.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    await comCarregamento(
      "Consultando o período…",
      async (passo) => {
        const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);
        const resposta = await call("reports_map_rows", {
          request: {
            periodo_inicio: inicio,
            periodo_fim: fim,
            apuratorio_ids: apuratoriosSelecionados,
          },
        });
        if (!resposta.ok) {
          notificar(resposta.error ?? "Falha ao gerar o mapa.", "erro");
          return;
        }
        linhasGeradas = resposta.data ?? [];
        await passo("Montando o mapa…");
        await renderMapaMensal(ctx);
      },
      gerar,
    );
  });

  document.querySelector<HTMLButtonElement>("#btn-salvar-mapa")?.addEventListener("click", async (evento) => {
    if (!linhasGeradas) return;
    const linhas = linhasGeradas;
    const botao = evento.currentTarget as HTMLButtonElement;
    const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);

    try {
      // O véu tem fases porque a busca do documento completo é a parte longa:
      // ela lê designações, prazos, andamentos e enquadramentos de cada
      // processo do mapa, e é a mesma consulta que o "Gerar PDF" ao lado faz.
      await comCarregamento(
        "Reunindo o documento completo…",
        async (passo) => {
          const completo = await call("reports_map_print_data", {
            request: {
              periodo_inicio: inicio,
              periodo_fim: fim,
              apuratorio_ids: apuratoriosSelecionados,
              processo_id: null,
            },
          });
          // Falhar aqui aborta o salvamento inteiro. Gravar só o resumo daria
          // um mapa que exibe o ícone do PDF completo e não o entrega.
          if (!completo.ok) {
            throw new Error(completo.error ?? "Falha ao reunir o documento completo.");
          }

          await passo("Salvando…");
          // O mapa salvo é snapshot do que foi emitido: recalcular depois daria
          // outro resultado, e é por isso que ele é salvo. `apuratorio_id` só é
          // preenchido quando o mapa é de uma espécie só.
          const resposta = await call("reports_save_map", {
            request: {
              titulo: tituloDoMapa(apuratorios),
              apuratorio_id:
                apuratoriosSelecionados.length === 1 ? apuratoriosSelecionados[0] : null,
              periodo_inicio: inicio,
              periodo_fim: fim,
              total_processos: linhas.length,
              total_concluidos: concluidos,
              total_andamento: andamento,
              dados_mapa: { versao: 2, resumo: linhas, completo: completo.data ?? [] },
            },
          });
          if (!resposta.ok) throw new Error(resposta.error ?? "Falha ao salvar.");
        },
        botao,
      );
      notificar("Mapa salvo, com o resumo e o documento completo.", "sucesso");
    } catch (erro) {
      notificar(erro instanceof Error ? erro.message : "Falha ao salvar.", "erro");
    }
  });

  document.querySelector<HTMLButtonElement>("#btn-gerar-pdf")?.addEventListener("click", async (evento) => {
    if (!linhasGeradas) return;
    const botao = evento.currentTarget as HTMLButtonElement;

    try {
      // As três fases são anunciadas porque a do meio **bloqueia a thread**: a
      // paginação mede layout linha a linha, e enquanto ela corre a animação do
      // véu congela junto. Quem informa que algo avançou é a mensagem, não o
      // giro. A terceira existe por outro motivo: `print_landscape` só volta
      // quando o operador fecha o diálogo nativo, e sem dizê-lo o véu pareceria
      // travado justamente na espera que não é nossa.
      await comCarregamento(
        "Carregando os dados do mapa…",
        async (passo) => {
          const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);
          const processoId = document.querySelector<HTMLSelectElement>("#pdf-processo")?.value;
          const resposta = await call("reports_map_print_data", {
            request: {
              periodo_inicio: inicio,
              periodo_fim: fim,
              apuratorio_ids: apuratoriosSelecionados,
              processo_id: processoId || null,
            },
          });
          if (!resposta.ok) {
            notificar(resposta.error ?? "Falha ao preparar o PDF.", "erro");
            return;
          }
          const itens = resposta.data ?? [];
          if (!itens.length) {
            notificar("Nenhum apuratório pertence a este mapa.", "erro");
            return;
          }

          await passo("Montando o documento…");
          const documento = renderDocumentoMapa(itens, {
            mes: MESES[mesSelecionado - 1]!,
            ano: anoSelecionado,
            periodoInicio: inicio,
            periodoFim: fim,
          });
          await imprimirDocumentoMapa(documento, () => passo("Abrindo a impressão…"));
        },
        botao,
      );
    } catch (erro) {
      notificar(
        erro instanceof Error ? erro.message : "Falha ao abrir a impressão do mapa.",
        "erro",
      );
    }
  });

  ligarExportacao(() => {
    if (!linhasGeradas) return;
    const { inicio, fim } = periodo(mesSelecionado, anoSelecionado);
    const escopoApuratorios = apuratoriosSelecionados.length
      ? apuratorios
          .filter((item) => apuratoriosSelecionados.includes(item.id))
          .map((item) => item.sigla)
          .join(", ")
      : "Todos os apuratórios";
    return baixarPlanilha(`mapa-${inicio}-a-${fim}.xlsx`, [
      {
        nome: "Mapa do período",
        titulo: tituloDoMapa(apuratorios),
        metadados: [
          {
            rotulo: "Período",
            valor: `${formatarData(inicio)} a ${formatarData(fim)}`,
          },
          { rotulo: "Apuratórios", valor: escopoApuratorios },
          { rotulo: "Registros", valor: String(linhasGeradas.length) },
        ],
        colunas: [
          { rotulo: "Apuratório", largura: 14 },
          { rotulo: "Número", largura: 20 },
          { rotulo: "Unidade", largura: 24 },
          { rotulo: "Natureza", largura: 28 },
          { rotulo: "Instauração", tipo: "data", largura: 14, alinhamento: "centro" },
          { rotulo: "Conclusão", tipo: "data", largura: 14, alinhamento: "centro" },
          { rotulo: "Situação", largura: 14, alinhamento: "centro" },
          { rotulo: "Responsável", largura: 34 },
          { rotulo: "Envolvidos", largura: 36 },
          { rotulo: "Vencimento", tipo: "data", largura: 14, alinhamento: "centro" },
          { rotulo: "Último andamento", largura: 60 },
        ],
        linhas: linhasGeradas.map((linha) => ({
          celulas: [
            linha.apuratorio_sigla,
            linha.rotulo,
            formatarOrigem(linha.unidade_origem, linha.subunidade_secao_origem),
            linha.natureza_fato,
            linha.data_instauracao,
            linha.data_conclusao,
            linha.data_conclusao ? "Concluído" : "Em andamento",
            formatarQualificacaoMilitar(
              linha.responsavel_posto_graduacao,
              linha.responsavel_matricula,
              linha.responsavel_nome,
            ),
            linha.envolvidos,
            linha.prazo_vencimento,
            linha.ultimo_andamento,
          ],
          tom: linha.data_conclusao ? "sucesso" : "informacao",
        })),
        congelar_colunas: 2,
      },
    ]);
  });
}

// ── Mapas salvos ──────────────────────────────────────────────────────

let mapaAberto: string | null = null;
let paginaSalvos = 1;

/**
 * As nove colunas dividem 100% da largura, e as larguras foram **medidas**, não
 * estimadas: a tabela é `table-layout: fixed`, e ali uma célula `nowrap` mais
 * estreita que o conteúdo não encolhe nem corta — ela transborda por cima da
 * coluna vizinha. Foi o que aconteceu com "Em" a 5%: a data pede 96px e a
 * coluna dava 46px.
 *
 * Duas defesas, e são diferentes:
 *
 * - as três colunas de texto livre (`truncar`) cortam com reticências e ganham
 *   o `title` com o valor inteiro — degradam em vez de invadir a vizinha, e é o
 *   que segura a janela estreita, onde percentual nenhum resolveria;
 * - "Período" fica **sem** `nowrap`: `01/08/2026 a 31/08/2026` quebra nos
 *   espaços e ocupa duas linhas. Cortá-la com reticências esconderia metade do
 *   intervalo, e alargá-la para caber numa linha custava 8% que o título — a
 *   coluna que identifica a linha — usa muito melhor.
 *
 * Medido em WebKitGTK, o motor do app, com o CSS compilado: numa janela de
 * 1280 a tabela tem 926px e nenhuma célula transborda.
 */
/**
 * Piso da tabela desta tela, em px. **Medido**, não estimado — ver
 * `tools/tela/README.md`, que também diz como remedir depois de mexer em
 * coluna. Abaixo dele o `.table-wrap` rola; sem ele a coluna `nowrap` pinta
 * por cima da vizinha, e nada acusa.
 */
export const PISO_SALVOS_PX = 1160;
// Medido: 1123. Quem manda aqui é a coluna de ações, com três botões de ícone.

export const COLUNAS_SALVOS: Coluna[] = [
  { rotulo: "Título", largura: 21, truncar: true },
  { rotulo: "Apuratório", largura: 10, alinhamento: "centro", nowrap: true },
  { rotulo: "Período", largura: 12, alinhamento: "centro" },
  { rotulo: "Total", largura: 6, alinhamento: "centro", nowrap: true },
  { rotulo: "Em andamento", largura: 11, alinhamento: "centro", nowrap: true },
  { rotulo: "Concluídos", largura: 10, alinhamento: "centro", nowrap: true },
  { rotulo: "Gerado por", largura: 7, truncar: true },
  { rotulo: "Em", largura: 11, alinhamento: "centro", truncar: true },
  { rotulo: "Ações", largura: 12, alinhamento: "centro", nowrap: true },
];

export async function renderMapasSalvos(ctx: ContextoTela): Promise<void> {
  // Toda entrada nesta tela — troca de rota, a paginação e a exclusão de um mapa — passa por aqui e volta ao
  // banco. O véu mora no render, e não em cada chamador, porque os
  // chamadores são vários e o motivo é um só. Numa troca de rota o véu do
  // roteador já está aberto: o helper conta profundidade, então este aqui
  // apenas troca a mensagem por uma que diz o que está sendo carregado.
  await comCarregamento("Carregando os mapas salvos…", () => desenharMapasSalvos(ctx));
}

async function desenharMapasSalvos(ctx: ContextoTela): Promise<void> {
  if (mapaAberto) return renderMapaSalvo(ctx, mapaAberto);

  const resposta = await call("reports_saved_maps", {
    page: paginaSalvos,
    perPage: ITENS_POR_PAGINA,
  });
  const mapas = resposta.data?.items ?? [];
  const total = resposta.data?.total ?? 0;

  // Excluir o único mapa da última página deixaria a tela vazia sem dizer por quê.
  const corrigida = paginaValida(paginaSalvos, ITENS_POR_PAGINA, total);
  if (corrigida !== paginaSalvos) {
    paginaSalvos = corrigida;
    return renderMapasSalvos(ctx);
  }

  const podeEscrever = ctx.podeEscrever();

  // O `id` na linha é o que o clique casa. Por posição, paginar abriria o mapa
  // errado — e um mapa salvo parece com o outro na tabela.
  const linhas = mapas.map((m: SavedMapListItem) => ({
    classe: "clicavel",
    id: m.id,
    celulas: [
      m.titulo,
      m.apuratorio_sigla ?? "todos",
      `${formatarData(m.periodo_inicio)} a ${formatarData(m.periodo_fim)}`,
      { texto: String(m.total_processos), numerica: true },
      { texto: String(m.total_andamento), numerica: true },
      { texto: String(m.total_concluidos), numerica: true },
      m.gerado_por ?? "—",
      formatarData(m.created_at),
      {
        texto: "",
        // Cada botão com o SEU `data-`: repetido, os três cliques cairiam no
        // mesmo listener. Excluir exige administrador no backend
        // (`require_admin`), e `podeEscrever()` é exatamente `is_admin`.
        acoes: [
          { rotulo: "Ver resumo", id: m.id, icone: "abrir" as const, classe: "outline" },
          {
            rotulo: "Ver PDF completo",
            id: m.id,
            icone: "documento" as const,
            classe: "outline",
            dado: "pdf-completo",
          },
          ...(podeEscrever
            ? [
                {
                  rotulo: "Excluir",
                  id: m.id,
                  icone: "excluir" as const,
                  classe: "danger",
                  dado: "excluir-mapa",
                },
              ]
            : []),
        ],
      },
    ],
  }));

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Mapas Salvos <span class="badge">${total}</span></h1>
          <p>Cada mapa é o registro do que foi emitido, não um recálculo.</p></div>
      </div>
      ${tabela(COLUNAS_SALVOS, linhas, "Nenhum mapa salvo.", {
        listagem: true,
        pisoPx: PISO_SALVOS_PX,
      })}
      ${paginacao("mapas-salvos", paginaSalvos, ITENS_POR_PAGINA, total)}
    </section>
  `);

  ligarPaginacao("mapas-salvos", paginaSalvos, (nova) => {
    paginaSalvos = nova;
    void renderMapasSalvos(ctx);
  });

  // O clique na linha continua abrindo o resumo — é o gesto que já estava no
  // dedo de quem usa. O `closest("button")` impede que ele dispare junto com o
  // clique num dos ícones, que borbulharia até a `<tr>`.
  document.querySelectorAll<HTMLTableRowElement>("tr[data-linha]").forEach((linha) => {
    linha.addEventListener("click", (evento) => {
      if ((evento.target as HTMLElement).closest("button")) return;
      mapaAberto = linha.dataset.linha ?? null;
      void renderMapasSalvos(ctx);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tabela-acao]").forEach((botao) => {
    botao.addEventListener("click", () => {
      mapaAberto = botao.dataset.tabelaAcao ?? null;
      void renderMapasSalvos(ctx);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-pdf-completo]").forEach((botao) => {
    botao.addEventListener("click", () => {
      void gerarPdfCompleto(botao.dataset.pdfCompleto!, botao);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-excluir-mapa]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      if (!confirm("Excluir este mapa salvo?")) return;
      await comCarregamento(
        "Excluindo…",
        async (passo) => {
          const resposta = await call("reports_delete_saved_map", {
            id: botao.dataset.excluirMapa!,
          });
          if (!resposta.ok) {
            notificar(resposta.error ?? "Falha ao excluir.", "erro");
            return;
          }
          await passo("Atualizando a lista…");
          await renderMapasSalvos(ctx);
        },
        botao,
      );
    });
  });
}

/**
 * Reemite o documento A4 de um mapa salvo, a partir do snapshot.
 *
 * Não recalcula nada: as fichas saem exatamente como foram publicadas, que é a
 * razão de o mapa ser salvo. O mês, o ano e as duas pontas do período vêm das
 * colunas da própria linha — por isso não estão dentro do snapshot.
 *
 * A listagem não carrega `dados_mapa` (seria o documento inteiro em cada linha
 * da página), então o clique busca o mapa antes.
 */
async function gerarPdfCompleto(id: string, gatilho: HTMLButtonElement): Promise<void> {
  try {
    await comCarregamento(
      "Carregando o documento salvo…",
      async (passo) => {
        const resposta = await call("reports_get_saved_map", { id });
        if (!resposta.ok || !resposta.data) {
          throw new Error(resposta.error ?? "Mapa não encontrado.");
        }
        const mapa = resposta.data;
        const completo = mapa.dados_mapa?.completo;
        if (!completo?.length) {
          throw new Error(
            "Este mapa foi salvo antes de o documento completo passar a ser guardado. " +
              "Só o resumo está disponível.",
          );
        }

        await passo("Montando o documento…");
        const documento = renderDocumentoMapa(completo, {
          mes: MESES[Number(mapa.periodo_inicio.slice(5, 7)) - 1]!,
          ano: Number(mapa.periodo_inicio.slice(0, 4)),
          periodoInicio: mapa.periodo_inicio,
          periodoFim: mapa.periodo_fim,
        });
        await imprimirDocumentoMapa(documento, () => passo("Abrindo a impressão…"));
      },
      gatilho,
    );
  } catch (erro) {
    notificar(erro instanceof Error ? erro.message : "Falha ao gerar o PDF.", "erro");
  }
}

/**
 * O resumo de um mapa salvo, com o botão de impressão.
 *
 * Sem Excluir: a listagem tem o ícone, e é de lá que se administra a coleção.
 * Ter os dois obrigaria a manter duas confirmações e dois caminhos de volta
 * para o mesmo efeito.
 */
async function renderMapaSalvo(ctx: ContextoTela, id: string): Promise<void> {
  const mapa = (await call("reports_get_saved_map", { id })).data;
  if (!mapa) {
    mapaAberto = null;
    ctx.shell(`<section class="panel"><p class="error">Mapa não encontrado.</p></section>`);
    return;
  }

  // O resumo mora no envelope (`{ versao, resumo, completo }`), que a 0020
  // instalou. A forma antiga era o array cru; um banco restaurado de backup
  // anterior à migration não chega aqui, mas se chegasse mostraríamos o
  // conteúdo cru em vez de fingir que sabemos lê-lo.
  const snapshot = mapa.dados_mapa;
  const linhas = Array.isArray(snapshot?.resumo)
    ? snapshot.resumo
    : Array.isArray(snapshot)
      ? (snapshot as MapRow[])
      : null;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(mapa.titulo)}</h1>
          <p>
            ${escapeHtml(`${formatarData(mapa.periodo_inicio)} a ${formatarData(mapa.periodo_fim)}`)} ·
            ${mapa.total_processos} no período · ${mapa.total_andamento} em andamento ·
            ${mapa.total_concluidos} concluídos · gerado por ${escapeHtml(mapa.gerado_por ?? "—")}
          </p>
        </div>
        <div class="page-head-right">
          <button id="btn-voltar" class="secondary small">Voltar</button>
          ${barraDeExportacao({ imprimir: true })}
        </div>
      </div>
      ${
        linhas
          ? `<div class="mapa-salvo__tabela">${tabela(
              COLUNAS_MAPA,
              linhas.map(linhaMapa),
              "O mapa foi salvo vazio.",
              // Cinco. São dez colunas com natureza do fato e último
              // andamento por extenso: a folha em paisagem leva nove destas
              // linhas no melhor caso e menos que isso quando os dois textos
              // vêm longos (`medicao-mapa-salvo`).
              { larga: true, listagem: true, linhasPorFragmentoImpressao: 5 },
            )}</div>`
          : `<pre class="mapa-salvo__conteudo-cru">${escapeHtml(JSON.stringify(mapa.dados_mapa, null, 2))}</pre>`
      }
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#btn-voltar")?.addEventListener("click", () => {
    mapaAberto = null;
    void renderMapasSalvos(ctx);
  });

  ligarExportacao(undefined, undefined, { orientacao: "paisagem", perfil: "tabular" });
}
