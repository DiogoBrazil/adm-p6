// Documento A4 detalhado do mapa mensal.
//
// Esta não é uma segunda tela de processo. É um renderizador somente de
// leitura que recebe o mesmo contrato do detalhe e o organiza para papel. A
// raiz fica fora de `#app`, escondida em tela, e só aparece durante a impressão:
// assim sidebar, filtros e a tabela resumida nunca vazam para o PDF.

import type {
  DeadlineItem,
  EnvolvidoComIndicios,
  MapPrintItem,
  MovementItem,
  ProceedingDetail,
} from "../api";
import { call } from "../api";
import { escapeHtml, formatarOrigem } from "../dom";

const brasaoUrl = new URL("../../src-tauri/icons/icon.png", import.meta.url).href;

export type ContextoPdfMapa = {
  mes: string;
  ano: number;
  periodoInicio: string;
  periodoFim: string;
  geradoEm?: Date;
};

const informado = (valor: unknown): string =>
  valor === null || valor === undefined || valor === "" ? "Não informado" : String(valor);

function data(valor: string | null | undefined): string {
  if (!valor) return "Não informado";
  const apenasData = valor.slice(0, 10).split("-");
  if (apenasData.length !== 3) return valor;
  return `${apenasData[2]}/${apenasData[1]}/${apenasData[0]}`;
}

function dataHora(valor: string | null | undefined): string {
  if (!valor) return "Não informado";
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime())
    ? informado(valor)
    : instante.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function qualificacao(
  posto: string | null | undefined,
  matricula: string | null | undefined,
  nome: string | null | undefined,
): string {
  return [posto, matricula, nome].filter(Boolean).join(" ") || "Não informado";
}

function campo(rotulo: string, valor: unknown): string {
  return `<div class="mapa-pdf-campo">
    <dt>${escapeHtml(rotulo)}</dt>
    <dd>${escapeHtml(informado(valor))}</dd>
  </div>`;
}

function secao(titulo: string, conteudo: string, classe = ""): string {
  return `<section class="mapa-pdf-secao${classe ? ` ${classe}` : ""}">
    <h2>${escapeHtml(titulo)}</h2>
    ${conteudo}
  </section>`;
}

function tabela(cabecalhos: string[], linhas: string[][], vazio: string, classe = ""): string {
  if (!linhas.length) return `<p class="mapa-pdf-vazio">${escapeHtml(vazio)}</p>`;
  return `<table class="mapa-pdf-tabela${classe ? ` ${classe}` : ""}">
    <thead><tr>${cabecalhos.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead>
    <tbody>${linhas
      .map(
        (linha) => `<tr>${linha.map((item) => `<td>${escapeHtml(informado(item))}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

/**
 * Um bloco de indícios. Os itens já chegam como HTML montado — a analogia do
 * Estatuto tem marcação própria —, então quem monta é quem escapa.
 */
function grupoEnquadramento(titulo: string, itens: string[]): string {
  if (!itens.length) return "";
  // Ponto e vírgula entre os itens e ponto no último: é uma relação de
  // enquadramentos, e no papel ela se lê como texto corrido, não como lista de
  // tarefas.
  const pontuados = itens.map(
    (item, indice) => `<li>${item}${indice === itens.length - 1 ? "." : ";"}</li>`,
  );
  return `<div class="mapa-pdf-enquadramento-grupo">
    <h3>${escapeHtml(titulo)}</h3>
    <ul>${pontuados.join("")}</ul>
  </div>`;
}

// O `rotulo` que vem do backend já termina na descrição da infração — ver
// `evidence/repository.rs::ROTULO_PENAL`. Concatenar `descricao`/`texto` aqui
// imprimia o mesmo parágrafo duas vezes na mesma linha; foi o defeito que
// motivou esta rodada.
function enquadramentosDe(envolvidoId: string, itens: EnvolvidoComIndicios[]): string {
  const dados = itens.find((item) => item.envolvido_id === envolvidoId)?.indicios;
  if (!dados) return `<p class="mapa-pdf-vazio-celula">Não registrado</p>`;

  // A espécie e a esfera já são rótulos vindos dos catálogos. Agrupar pela
  // combinação produz “Indícios de Crime Militar”, “Indícios de Crime Comum”
  // etc. sem transformar esses nomes administráveis em regra de negócio do
  // frontend. O caixa-alta é do CSS.
  const penais = new Map<string, string[]>();
  for (const item of dados.infracoes_penais) {
    const titulo = `Indícios de ${item.especie} ${item.esfera_penal}`;
    const grupo = penais.get(titulo) ?? [];
    grupo.push(escapeHtml(item.rotulo));
    penais.set(titulo, grupo);
  }

  // Transgressão do RDPM e infração do Estatuto são a mesma matéria
  // disciplinar, e saíam em dois blocos. A do Estatuto sempre vem com a
  // transgressão análoga, que fica recuada abaixo dela em vez de disputar a
  // mesma linha.
  const disciplinares = [
    ...dados.transgressoes.map((item) => escapeHtml(item.rotulo)),
    ...dados.infracoes_estatuto.map(
      (item) =>
        `${escapeHtml(item.rotulo)}<span class="mapa-pdf-analogia">Analogia com ${escapeHtml(
          item.analogia_rotulo,
        )}</span>`,
    ),
  ];

  const temEnquadramento = !!(penais.size || disciplinares.length);

  // A categoria é a indicação grossa; o enquadramento é a fina. Quando existe
  // enquadramento, repetir “Indícios de crime militar” ao lado do artigo não
  // acrescenta nada. Já a categoria de ausência é a única declaração que existe
  // quando nada foi enquadrado, e precisa constar sempre. O critério é este —
  // estrutural —, e não o nome da linha, que o administrador pode renomear.
  const categorias = dados.categorias
    .filter((item) => item.indica_ausencia || !temEnquadramento)
    .map((item) => escapeHtml(item.nome));

  const grupos = [
    ...[...penais.entries()].map(([titulo, valores]) => grupoEnquadramento(titulo, valores)),
    grupoEnquadramento("Indícios de transgressão disciplinar", disciplinares),
    grupoEnquadramento("Outros indícios", categorias),
  ].filter(Boolean);
  return grupos.length
    ? `<div class="mapa-pdf-enquadramentos">${grupos.join("")}</div>`
    : `<p class="mapa-pdf-vazio-celula">Não registrado</p>`;
}

/**
 * Devolve **marcação**, e não texto: quem chama não deve escapar de novo.
 * Numa coluna estreita, três informações separadas por bolinha viram um
 * emaranhado; empilhadas com o rótulo em cima, cada uma se acha.
 */
function resultadoDoEnvolvido(item: ProceedingDetail["envolvidos"][number]): string {
  const partes: [string, string][] = [
    ["Sugerida", item.solucao_sugerida ?? ""],
    ["Decidida", item.solucao_decidida ?? ""],
    [
      "Penalidade",
      item.penalidade_tipo
        ? `${item.penalidade_tipo}${item.penalidade_dias ? ` — ${item.penalidade_dias} dias` : ""}`
        : "",
    ],
  ];
  const presentes = partes.filter(([, valor]) => !!valor);
  if (!presentes.length) return `<p class="mapa-pdf-vazio-celula">Não registrado</p>`;
  return `<dl class="mapa-pdf-resultado">${presentes
    .map(
      ([rotulo, valor]) =>
        `<dt>${escapeHtml(rotulo)}</dt><dd>${escapeHtml(valor)}</dd>`,
    )
    .join("")}</dl>`;
}

function documentoDaDesignacao(item: ProceedingDetail["designacoes"][number]): string {
  if (!item.usa_documento_designacao) return "Dispensado para esta função";
  if (!item.documento_autorizador) return "Não informado";
  return item.numero_documento
    ? `${item.documento_autorizador} nº ${item.numero_documento}`
    : item.documento_autorizador;
}

function documentoDoPrazo(item: DeadlineItem): string {
  const ato = item.documento_autorizador
    ? `${item.documento_autorizador}${item.numero_documento ? ` nº ${item.numero_documento}` : ""}`
    : null;
  return [
    ato,
    item.data_documento ? `de ${data(item.data_documento)}` : null,
    item.autoridade ? `por ${item.autoridade}` : null,
  ]
    .filter(Boolean)
    .join(" ") || "Não informado";
}

function renderCabecalhoDados(processo: ProceedingDetail): string {
  const responsavel = processo.responsavel_nome
    ? `${qualificacao(
        processo.responsavel_posto_graduacao,
        processo.responsavel_matricula,
        processo.responsavel_nome,
      )}${processo.responsavel_papel ? ` — ${processo.responsavel_papel}` : ""}`
    : "Não informado";
  return `<dl class="mapa-pdf-grade-dados">
    ${campo("Documento iniciador", processo.documento_iniciador)}
    ${campo("Nº do documento", processo.numero_documento)}
    ${campo("Nº de controle", processo.numero_controle)}
    ${campo("Processo SEI", processo.processo_sei)}
    ${campo("Nº RGF", processo.numero_rgf)}
    ${campo(
      "Origem",
      formatarOrigem(processo.unidade_origem, processo.subunidade_secao_origem),
    )}
    ${campo("Município do fato", processo.municipio_fato)}
    ${campo("Natureza geral do fato", processo.natureza_fato)}
    ${campo("Responsável vigente", responsavel)}
    ${campo("Total de envolvidos", processo.total_envolvidos)}
    ${
      processo.carta_precatoria
        ? `${campo("Deprecante", processo.carta_precatoria.deprecante)}
           ${campo("Unidade deprecada", processo.carta_precatoria.unidade_deprecada)}`
        : ""
    }
  </dl>`;
}

function renderDatas(item: MapPrintItem): string {
  const processo = item.processo;
  return `<dl class="mapa-pdf-grade-dados mapa-pdf-grade-dados--datas">
    ${campo("Instauração", data(processo.data_instauracao))}
    ${campo("Recebimento", data(processo.data_recebimento))}
    ${campo("Remessa do encarregado", data(processo.data_remessa_encarregado))}
    ${campo(
      "Remessa da comissão",
      item.permite_remessa_comissao ? data(processo.data_remessa_comissao) : "Não se aplica",
    )}
    ${campo("Julgamento", data(processo.data_julgamento))}
    ${campo("Conclusão", data(processo.data_conclusao))}
    ${campo("Prazo vigente", data(processo.prazo_vencimento))}
    ${campo(
      "Situação do prazo",
      processo.prazo_dias_restantes === null
        ? "Não calculada"
        : processo.prazo_dias_restantes < 0
          ? `${-processo.prazo_dias_restantes} dias em atraso`
          : `${processo.prazo_dias_restantes} dias restantes`,
    )}
  </dl>`;
}

function renderEnvolvidos(item: MapPrintItem): string {
  if (!item.processo.envolvidos.length) {
    return `<p class="mapa-pdf-vazio">Nenhum envolvido registrado.</p>`;
  }
  return `<table class="mapa-pdf-tabela mapa-pdf-tabela--envolvidos">
    <thead><tr><th>Militar</th><th>Situação</th><th>Enquadramentos e indícios</th><th>Resultado</th></tr></thead>
    <tbody>${item.processo.envolvidos
      .map(
        (envolvido) => `<tr>
          <td>${escapeHtml(
            `${qualificacao(envolvido.posto_graduacao, envolvido.matricula, envolvido.nome)}${envolvido.e_condutor ? " — condutor" : ""}`,
          )}</td>
          <td>${escapeHtml(envolvido.status_envolvido)}</td>
          <td>${enquadramentosDe(envolvido.id, item.enquadramentos)}</td>
          <td>${resultadoDoEnvolvido(envolvido)}</td>
        </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function renderDesignacoes(processo: ProceedingDetail): string {
  return tabela(
    ["Função", "Militar", "Início", "Fim", "Documento", "Motivo"],
    processo.designacoes.map((item) => [
      `${item.papel}${item.e_responsavel ? " — responsável" : ""}`,
      qualificacao(item.posto_graduacao, item.matricula, item.nome),
      data(item.data_inicio),
      item.data_fim ? data(item.data_fim) : "Vigente",
      documentoDaDesignacao(item),
      item.motivo ?? "Não informado",
    ]),
    "Nenhuma designação registrada.",
    "mapa-pdf-tabela--designacoes",
  );
}

function renderPrazos(itens: DeadlineItem[]): string {
  return tabela(
    ["Ordem", "Início", "Dias", "Vencimento", "Ato autorizador", "Motivo"],
    itens.map((item) => [
      item.ordem === 0 ? "Prazo inicial" : `${item.ordem}ª prorrogação${item.vigente ? " — vigente" : ""}`,
      data(item.data_inicio),
      String(item.dias),
      data(item.data_vencimento),
      documentoDoPrazo(item),
      item.ordem === 0 ? "Prazo inicial" : (item.motivo ?? "Não informado"),
    ]),
    "Nenhum prazo registrado.",
    "mapa-pdf-tabela--prazos",
  );
}

function renderAndamentos(itens: MovementItem[]): string {
  return tabela(
    ["Data e hora", "Tipo", "Registrado por", "Descrição"],
    itens.map((item) => [
      dataHora(item.ocorrido_em),
      item.tipo_andamento ?? "Não informado",
      item.registrado_por ?? "Não informado",
      item.descricao,
    ]),
    "Nenhum andamento registrado.",
    "mapa-pdf-tabela--andamentos",
  );
}

function renderFicha(item: MapPrintItem): string {
  const processo = item.processo;
  const situacao = processo.concluido ? "Concluído" : "Em andamento";
  return `<article class="mapa-pdf-ficha" data-rotulo="${escapeHtml(processo.rotulo)}">
    <header class="mapa-pdf-cabecalho-ficha">
      <img src="${escapeHtml(brasaoUrl)}" alt="Brasão da Polícia Militar de Rondônia" />
      <div>
        <p>Polícia Militar do Estado de Rondônia · 7º BPM</p>
        <h1>${escapeHtml(processo.rotulo)}</h1>
        <span>${escapeHtml(processo.apuratorio_nome)} · Ficha individual</span>
      </div>
      <strong class="mapa-pdf-situacao${processo.concluido ? " is-concluido" : ""}">${escapeHtml(situacao)}</strong>
    </header>
    <main class="mapa-pdf-corpo-ficha">
      ${secao("Identificação e dados cadastrais", renderCabecalhoDados(processo), "mapa-pdf-secao--destaque")}
      ${secao("Datas e tramitação", renderDatas(item))}
      ${secao("Envolvidos, enquadramentos e resultados", renderEnvolvidos(item), "mapa-pdf-secao--fluida")}
      ${secao(
        "Ofendidos/Vítimas",
        tabela(
          ["#", "Nome"],
          processo.vitimas.map((vitima) => [String(vitima.ordem), vitima.nome]),
          "Nenhum ofendido ou vítima registrado.",
        ),
        "mapa-pdf-secao--fluida",
      )}
      ${secao(
        "Pessoas inquiridas",
        tabela(
          ["Papel", "Nome"],
          processo.pessoas.map((pessoa) => [pessoa.papel_pessoa, pessoa.nome]),
          "Nenhuma pessoa inquirida registrada.",
        ),
        "mapa-pdf-secao--fluida",
      )}
      ${secao("Designações", renderDesignacoes(processo), "mapa-pdf-secao--fluida")}
      ${secao("Prazos e prorrogações", renderPrazos(item.prazos), "mapa-pdf-secao--fluida")}
      ${secao("Andamentos", renderAndamentos(item.andamentos), "mapa-pdf-secao--fluida")}
      ${secao(
        "Relação de anexos",
        tabela(
          ["Arquivo", "Tipo", "Tamanho", "Enviado por", "Em"],
          processo.anexos.map((anexo) => [
            anexo.nome_arquivo,
            anexo.mime_type,
            tamanho(anexo.tamanho_bytes),
            anexo.enviado_por ?? "Não informado",
            dataHora(anexo.created_at),
          ]),
          "Nenhum anexo registrado.",
          "mapa-pdf-tabela--anexos",
        ),
        "mapa-pdf-secao--fluida",
      )}
      ${secao(
        "Resumo dos fatos",
        `<p class="mapa-pdf-texto-livre">${escapeHtml(processo.resumo_fatos ?? "Nenhum resumo registrado.")}</p>`,
        "mapa-pdf-secao--fluida",
      )}
    </main>
    <div class="mapa-pdf-fim">Fim do ${escapeHtml(processo.rotulo)}</div>
  </article>`;
}

function renderCapa(grupo: MapPrintItem[], contexto: ContextoPdfMapa): string {
  const processo = grupo[0]!.processo;
  const concluidos = grupo.filter((item) => item.processo.concluido).length;
  const andamento = grupo.length - concluidos;
  const geradoEm = contexto.geradoEm ?? new Date();
  return `<article class="mapa-pdf-pagina mapa-pdf-capa">
    <header>
      <img src="${escapeHtml(brasaoUrl)}" alt="Brasão da Polícia Militar de Rondônia" />
      <p>Polícia Militar do Estado de Rondônia</p>
      <strong>7ºBPM</strong>
    </header>
    <main>
      <p>Mapa Mensal</p>
      <h1>${escapeHtml(processo.apuratorio_sigla)}</h1>
      <h2>${escapeHtml(processo.apuratorio_nome)}</h2>
      <h3>${escapeHtml(contexto.mes)} de ${escapeHtml(contexto.ano)}</h3>
      <p class="mapa-pdf-periodo">Período de ${escapeHtml(data(contexto.periodoInicio))} a ${escapeHtml(data(contexto.periodoFim))}</p>
      <dl class="mapa-pdf-metricas">
        ${campo("Registros", grupo.length)}
        ${campo("Em andamento", andamento)}
        ${campo("Concluídos", concluidos)}
      </dl>
    </main>
    <footer class="mapa-pdf-rodape">
      <span>ADM-P6 · Seção de Justiça e Disciplina</span>
      <span>Gerado em ${escapeHtml(geradoEm.toLocaleDateString("pt-BR"))}</span>
    </footer>
  </article>`;
}

/** Monta capas e fichas preservando a primeira ocorrência de cada apuratório. */
export function renderDocumentoMapa(itens: MapPrintItem[], contexto: ContextoPdfMapa): string {
  const grupos = new Map<string, MapPrintItem[]>();
  for (const item of itens) {
    const grupo = grupos.get(item.processo.apuratorio_id) ?? [];
    grupo.push(item);
    grupos.set(item.processo.apuratorio_id, grupo);
  }
  return `<section class="mapa-pdf-documento" aria-label="Mapa mensal detalhado">
    ${[...grupos.values()]
      .map((grupo) => {
        const processo = grupo[0]!.processo;
        return `<section class="mapa-pdf-grupo"
          data-rodape-esquerdo="${escapeHtml(`ADM-P6 · Mapa Mensal — ${contexto.mes}/${contexto.ano}`)}"
          data-rodape-direito="${escapeHtml(processo.apuratorio_sigla)}">
          ${renderCapa(grupo, contexto)}
          <div class="mapa-pdf-fluxo-fonte">${grupo.map((item) => renderFicha(item)).join("")}</div>
        </section>`;
      })
      .join("")}
  </section>`;
}

type EstadoPaginacao = {
  grupo: HTMLElement;
  paginas: HTMLElement;
  pagina: HTMLElement;
  corpo: HTMLElement;
};

function criarPaginaConteudo(grupo: HTMLElement, rotuloContinuacao?: string): EstadoPaginacao {
  const paginas = grupo.querySelector<HTMLElement>(".mapa-pdf-paginas")!;
  const pagina = document.createElement("article");
  pagina.className = "mapa-pdf-pagina mapa-pdf-pagina-conteudo";

  const corpo = document.createElement("main");
  corpo.className = "mapa-pdf-corpo-pagina";
  if (rotuloContinuacao) {
    const continuacao = document.createElement("header");
    continuacao.className = "mapa-pdf-continuacao";
    continuacao.textContent = `Continuação do ${rotuloContinuacao}`;
    corpo.append(continuacao);
  }

  const rodape = document.createElement("footer");
  rodape.className = "mapa-pdf-rodape";
  const esquerdo = document.createElement("span");
  esquerdo.textContent = grupo.dataset.rodapeEsquerdo ?? "ADM-P6 · Mapa Mensal";
  const direito = document.createElement("span");
  direito.textContent = grupo.dataset.rodapeDireito ?? "";
  rodape.append(esquerdo, direito);
  pagina.append(corpo, rodape);
  paginas.append(pagina);
  return { grupo, paginas, pagina, corpo };
}

function cabeNaPagina(corpo: HTMLElement): boolean {
  return corpo.scrollHeight <= corpo.clientHeight + 1;
}

function paginaTemConteudo(corpo: HTMLElement): boolean {
  return !!corpo.querySelector(
    ".mapa-pdf-cabecalho-ficha, .mapa-pdf-secao, .mapa-pdf-fim",
  );
}

function novaPagina(estado: EstadoPaginacao, rotuloContinuacao?: string): void {
  const novo = criarPaginaConteudo(estado.grupo, rotuloContinuacao);
  estado.pagina = novo.pagina;
  estado.corpo = novo.corpo;
}

function tentarAdicionar(estado: EstadoPaginacao, elemento: HTMLElement): boolean {
  estado.corpo.append(elemento);
  if (cabeNaPagina(estado.corpo)) return true;
  elemento.remove();
  return false;
}

function fragmentoTabela(secao: HTMLElement, continuacao: boolean): HTMLElement {
  const fragmento = secao.cloneNode(true) as HTMLElement;
  fragmento.querySelector("tbody")?.replaceChildren();
  if (continuacao) {
    const titulo = fragmento.querySelector("h2");
    if (titulo) titulo.textContent = `${titulo.textContent ?? "Seção"} (continuação)`;
  }
  return fragmento;
}

function adicionarTabelaPaginada(
  estado: EstadoPaginacao,
  secao: HTMLElement,
  rotulo: string,
): void {
  const linhas = [...secao.querySelectorAll<HTMLTableRowElement>("tbody > tr")];
  let continuacaoDaSecao = false;
  let fragmento = fragmentoTabela(secao, continuacaoDaSecao);

  if (!tentarAdicionar(estado, fragmento)) {
    novaPagina(estado, rotulo);
    continuacaoDaSecao = true;
    fragmento = fragmentoTabela(secao, continuacaoDaSecao);
    estado.corpo.append(fragmento);
  }

  for (const linha of linhas) {
    let corpoTabela = fragmento.querySelector<HTMLTableSectionElement>("tbody")!;
    let copia = linha.cloneNode(true) as HTMLTableRowElement;
    corpoTabela.append(copia);
    if (cabeNaPagina(estado.corpo)) continue;

    copia.remove();
    if (corpoTabela.children.length === 0) fragmento.remove();

    novaPagina(estado, rotulo);
    continuacaoDaSecao = true;
    fragmento = fragmentoTabela(secao, continuacaoDaSecao);
    estado.corpo.append(fragmento);
    corpoTabela = fragmento.querySelector<HTMLTableSectionElement>("tbody")!;
    copia = linha.cloneNode(true) as HTMLTableRowElement;
    corpoTabela.append(copia);

    // Uma única linha maior que toda a área útil é excepcional, mas não pode
    // ser descartada. A classe permite ao motor de impressão fragmentá-la.
    if (!cabeNaPagina(estado.corpo)) copia.classList.add("mapa-pdf-linha-longa");
  }
}

function adicionarTextoPaginado(
  estado: EstadoPaginacao,
  secao: HTMLElement,
  rotulo: string,
): void {
  const original = secao.querySelector<HTMLElement>(".mapa-pdf-texto-livre");
  const partes = original?.textContent?.match(/\S+\s*/g) ?? [];
  let fragmento = secao.cloneNode(true) as HTMLElement;
  let texto = fragmento.querySelector<HTMLElement>(".mapa-pdf-texto-livre")!;
  texto.textContent = "";

  if (!tentarAdicionar(estado, fragmento)) {
    novaPagina(estado, rotulo);
    estado.corpo.append(fragmento);
  }

  let acumulado = "";
  for (const parte of partes) {
    texto.textContent = acumulado + parte;
    if (cabeNaPagina(estado.corpo)) {
      acumulado += parte;
      continue;
    }
    texto.textContent = acumulado.trimEnd();
    novaPagina(estado, rotulo);
    fragmento = secao.cloneNode(true) as HTMLElement;
    const titulo = fragmento.querySelector("h2");
    if (titulo) titulo.textContent = `${titulo.textContent ?? "Resumo dos fatos"} (continuação)`;
    texto = fragmento.querySelector<HTMLElement>(".mapa-pdf-texto-livre")!;
    acumulado = parte;
    texto.textContent = acumulado;
    estado.corpo.append(fragmento);
  }
}

function adicionarSecao(
  estado: EstadoPaginacao,
  secao: HTMLElement,
  rotulo: string,
): void {
  const copia = secao.cloneNode(true) as HTMLElement;
  if (tentarAdicionar(estado, copia)) return;
  if (secao.querySelector("table")) {
    adicionarTabelaPaginada(estado, secao, rotulo);
    return;
  }
  if (secao.querySelector(".mapa-pdf-texto-livre")) {
    adicionarTextoPaginado(estado, secao, rotulo);
    return;
  }
  novaPagina(estado, rotulo);
  estado.corpo.append(copia);
}

function paginarFicha(estado: EstadoPaginacao, ficha: HTMLElement): void {
  const rotulo = ficha.dataset.rotulo ?? "apuratório";
  const cabecalho = ficha.querySelector<HTMLElement>(":scope > .mapa-pdf-cabecalho-ficha")!;
  const secoes = [
    ...ficha.querySelectorAll<HTMLElement>(":scope > .mapa-pdf-corpo-ficha > .mapa-pdf-secao"),
  ];
  const primeiraSecao = secoes.shift();

  const inicial = document.createElement("div");
  inicial.className = "mapa-pdf-inicio-ficha";
  inicial.append(cabecalho.cloneNode(true));
  if (primeiraSecao) inicial.append(primeiraSecao.cloneNode(true));

  if (!tentarAdicionar(estado, inicial)) {
    if (paginaTemConteudo(estado.corpo)) novaPagina(estado);
    if (!tentarAdicionar(estado, inicial)) {
      estado.corpo.append(cabecalho.cloneNode(true));
      if (primeiraSecao) adicionarSecao(estado, primeiraSecao, rotulo);
    }
  }

  for (const secao of secoes) adicionarSecao(estado, secao, rotulo);

  const fim = ficha.querySelector<HTMLElement>(":scope > .mapa-pdf-fim")!.cloneNode(true) as HTMLElement;
  if (!tentarAdicionar(estado, fim)) {
    novaPagina(estado, rotulo);
    estado.corpo.append(fim);
  }
}

function paginarGrupo(grupo: HTMLElement): void {
  const fonte = grupo.querySelector<HTMLElement>(":scope > .mapa-pdf-fluxo-fonte")!;
  const fichas = [...fonte.querySelectorAll<HTMLElement>(":scope > .mapa-pdf-ficha")];
  const paginas = document.createElement("div");
  paginas.className = "mapa-pdf-paginas";
  grupo.insertBefore(paginas, fonte);
  const estado = criarPaginaConteudo(grupo);
  for (const ficha of fichas) paginarFicha(estado, ficha);
  fonte.remove();
}

/**
 * Pagina cada grupo, cedendo um quadro **entre** eles.
 *
 * A paginação mede layout: para cada linha de tabela e cada palavra do resumo
 * ela faz append e lê `scrollHeight`. São reflows síncronos em série, e é aqui
 * que a interface congela por segundos — inclusive a animação do véu, que fica
 * parada exatamente quando mais precisaria girar.
 *
 * A cessão fica **entre grupos**, e não dentro de um: cada grupo abre o seu
 * `criarPaginaConteudo` e não compartilha estado com os outros, então ceder ali
 * não atravessa a paginação de ficha nenhuma. Descer o `await` para dentro de
 * `paginarGrupo` atravessaria — e um documento diferente não vale um véu mais
 * animado.
 */
async function paginarDocumentoMapa(raiz: HTMLElement): Promise<void> {
  const grupos = [...raiz.querySelectorAll<HTMLElement>(".mapa-pdf-grupo")];
  for (const [indice, grupo] of grupos.entries()) {
    paginarGrupo(grupo);
    if (indice < grupos.length - 1) {
      await new Promise<void>((resolver) => requestAnimationFrame(() => resolver()));
    }
  }
}

async function aguardarImagens(raiz: HTMLElement): Promise<void> {
  await Promise.all(
    [...raiz.querySelectorAll<HTMLImageElement>("img")].map(async (imagem) => {
      try {
        await imagem.decode();
      } catch {
        throw new Error("Não foi possível carregar o brasão para o PDF. Tente novamente.");
      }
    }),
  );
}

/**
 * Declara a folha em paisagem enquanto o mapa está sendo impresso, e desfaz
 * depois.
 *
 * A regra não pode morar no `styles.css`: uma `@page` anônima vale para o
 * documento inteiro, e os outros relatórios têm de continuar saindo em retrato.
 * E não pode ser um `<style>` interpolado no HTML, que a CSP recusa
 * (`style-src 'self'`) — regra criada por CSSOM o CSP não alcança.
 *
 * No WebKitGTK, motor do Tauri no Linux, isto não faz efeito nenhum: lá a
 * orientação vem do page setup, e quem a define é `print_landscape`. Serve aos
 * motores que honram o `@page` — Chromium e WebView2 —, onde o comando não tem
 * caminho específico e a impressão cai no `window.print()`.
 */
function comFolhaPaisagem(): () => void {
  const folha = new CSSStyleSheet();
  folha.insertRule("@page { size: A4 landscape; margin: 0; }");
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, folha];
  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((atual) => atual !== folha);
  };
}

/**
 * Insere, pagina e revela o documento somente durante a impressão.
 *
 * `aoImprimir` é avisado quando a montagem termina e a espera passa a ser do
 * operador: `print_landscape` só volta quando o diálogo nativo fecha, e quem
 * está olhando o véu precisa saber que a demora mudou de dono.
 */
export async function imprimirDocumentoMapa(
  html: string,
  aoImprimir?: () => Promise<void>,
): Promise<void> {
  const raiz = document.createElement("div");
  raiz.className = "mapa-pdf-root mapa-pdf-root--medindo";
  raiz.innerHTML = html;
  document.body.append(raiz);
  document.documentElement.classList.add("mapa-pdf-ativo");
  let soltarFolha: (() => void) | undefined;
  try {
    await new Promise<void>((resolver) => requestAnimationFrame(() => resolver()));
    await paginarDocumentoMapa(raiz);
    await aguardarImagens(raiz);
    await new Promise<void>((resolver) => requestAnimationFrame(() => resolver()));

    const transbordou = [...raiz.querySelectorAll<HTMLElement>(".mapa-pdf-corpo-pagina")].some(
      (corpo) => corpo.scrollHeight > corpo.clientHeight + 1,
    );
    if (transbordou) {
      throw new Error(
        "Uma informação é maior que a área útil da folha e não pôde ser paginada. Revise os dados e tente novamente.",
      );
    }

    raiz.classList.remove("mapa-pdf-root--medindo");
    soltarFolha = comFolhaPaisagem();
    await aoImprimir?.();

    // `print_landscape` só retorna quando a impressão termina ou o diálogo é
    // cancelado — o documento é desmontado no `finally` logo abaixo, e voltar
    // antes imprimiria folha em branco.
    const resposta = await call("print_landscape");
    if (!resposta.ok) throw new Error(resposta.error ?? "Falha ao abrir a impressão do mapa.");
    // `false` = plataforma sem caminho específico; aí o `@page` acima resolve.
    if (!resposta.data) window.print();
  } finally {
    soltarFolha?.();
    document.documentElement.classList.remove("mapa-pdf-ativo");
    raiz.remove();
  }
}
