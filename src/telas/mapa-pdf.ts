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

function tabela(cabecalhos: string[], linhas: string[][], vazio: string): string {
  if (!linhas.length) return `<p class="mapa-pdf-vazio">${escapeHtml(vazio)}</p>`;
  return `<table class="mapa-pdf-tabela">
    <thead><tr>${cabecalhos.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead>
    <tbody>${linhas
      .map(
        (linha) => `<tr>${linha.map((item) => `<td>${escapeHtml(informado(item))}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function enquadramentosDe(
  envolvidoId: string,
  itens: EnvolvidoComIndicios[],
): string {
  const dados = itens.find((item) => item.envolvido_id === envolvidoId)?.indicios;
  if (!dados) return "Não registrado";
  const linhas = [
    ...dados.categorias.map((item) => `Categoria: ${item.nome}`),
    ...dados.infracoes_penais.map(
      (item) => `${item.rotulo} — esfera ${item.esfera_penal}: ${item.descricao}`,
    ),
    ...dados.transgressoes.map(
      (item) => `${item.rotulo} — ${item.natureza}: ${item.texto}`,
    ),
    ...dados.infracoes_estatuto.map(
      (item) => `${item.rotulo} — analogia: ${item.analogia_rotulo}`,
    ),
  ];
  return linhas.length ? linhas.join(" • ") : "Não registrado";
}

function resultadoDoEnvolvido(item: ProceedingDetail["envolvidos"][number]): string {
  const partes = [
    item.solucao_sugerida ? `Sugerida: ${item.solucao_sugerida}` : null,
    item.solucao_decidida ? `Decidida: ${item.solucao_decidida}` : null,
    item.penalidade_tipo
      ? `Penalidade: ${item.penalidade_tipo}${item.penalidade_dias ? ` — ${item.penalidade_dias} dias` : ""}`
      : null,
  ].filter((valor): valor is string => !!valor);
  return partes.length ? partes.join(" • ") : "Não registrado";
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
    ${campo("Natureza do fato", processo.natureza_fato)}
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

function renderDatas(processo: ProceedingDetail): string {
  return `<dl class="mapa-pdf-grade-dados mapa-pdf-grade-dados--datas">
    ${campo("Instauração", data(processo.data_instauracao))}
    ${campo("Recebimento", data(processo.data_recebimento))}
    ${campo("Remessa do encarregado", data(processo.data_remessa_encarregado))}
    ${campo("Remessa da comissão", data(processo.data_remessa_comissao))}
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
  return tabela(
    ["Militar", "Situação", "Enquadramentos e indícios", "Resultado"],
    item.processo.envolvidos.map((envolvido) => [
      `${qualificacao(envolvido.posto_graduacao, envolvido.matricula, envolvido.nome)}${envolvido.e_condutor ? " — condutor" : ""}`,
      envolvido.status_envolvido,
      enquadramentosDe(envolvido.id, item.enquadramentos),
      resultadoDoEnvolvido(envolvido),
    ]),
    "Nenhum envolvido registrado.",
  );
}

function renderDesignacoes(processo: ProceedingDetail): string {
  return tabela(
    ["Papel", "Militar", "Início", "Fim", "Documento", "Motivo"],
    processo.designacoes.map((item) => [
      `${item.papel}${item.e_responsavel ? " — responsável" : ""}`,
      qualificacao(item.posto_graduacao, item.matricula, item.nome),
      data(item.data_inicio),
      item.data_fim ? data(item.data_fim) : "Vigente",
      documentoDaDesignacao(item),
      item.motivo ?? "Não informado",
    ]),
    "Nenhuma designação registrada.",
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
  );
}

function renderFicha(item: MapPrintItem, contexto: ContextoPdfMapa): string {
  const processo = item.processo;
  const situacao = processo.concluido ? "Concluído" : "Em andamento";
  return `<article class="mapa-pdf-pagina mapa-pdf-ficha">
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
      ${secao("Datas e tramitação", renderDatas(processo))}
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
        ),
        "mapa-pdf-secao--fluida",
      )}
      ${secao(
        "Resumo dos fatos",
        `<p class="mapa-pdf-texto-livre">${escapeHtml(processo.resumo_fatos ?? "Nenhum resumo registrado.")}</p>`,
        "mapa-pdf-secao--fluida",
      )}
    </main>
    <footer class="mapa-pdf-rodape">
      <span>ADM-P6 · Mapa Mensal — ${escapeHtml(contexto.mes)}/${escapeHtml(contexto.ano)}</span>
      <span>${escapeHtml(processo.rotulo)}</span>
    </footer>
  </article>`;
}

function renderCapa(grupo: MapPrintItem[], contexto: ContextoPdfMapa): string {
  const processo = grupo[0]!.processo;
  const concluidos = grupo.filter((item) => item.processo.concluido).length;
  const andamento = grupo.length - concluidos;
  const geradoEm = contexto.geradoEm ?? new Date();
  return `<article class="mapa-pdf-pagina mapa-pdf-capa">
    <div class="mapa-pdf-faixa"></div>
    <header>
      <img src="${escapeHtml(brasaoUrl)}" alt="Brasão da Polícia Militar de Rondônia" />
      <p>Polícia Militar do Estado de Rondônia</p>
      <strong>7º Batalhão de Polícia Militar</strong>
      <span></span>
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
      .map((grupo) => `${renderCapa(grupo, contexto)}${grupo.map((item) => renderFicha(item, contexto)).join("")}`)
      .join("")}
  </section>`;
}

/** Insere o documento apenas durante a impressão e garante que o brasão carregou. */
export async function imprimirDocumentoMapa(html: string): Promise<void> {
  const raiz = document.createElement("div");
  raiz.className = "mapa-pdf-root";
  raiz.innerHTML = html;
  document.body.append(raiz);
  document.documentElement.classList.add("mapa-pdf-ativo");
  try {
    const imagens = [...raiz.querySelectorAll<HTMLImageElement>("img")];
    await Promise.all(
      imagens.map(async (imagem) => {
        try {
          await imagem.decode();
        } catch {
          throw new Error("Não foi possível carregar o brasão para o PDF. Tente novamente.");
        }
      }),
    );
    await new Promise<void>((resolver) => requestAnimationFrame(() => resolver()));
    window.print();
  } finally {
    document.documentElement.classList.remove("mapa-pdf-ativo");
    raiz.remove();
  }
}
