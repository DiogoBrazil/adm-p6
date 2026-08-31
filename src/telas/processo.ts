// Cadastro de processo/procedimento.
//
// O formulário anterior declarava 22 campos planos, com nomes que não existem
// mais (`tipo_geral`, `tipo_detalhe`, `numero_portaria`, `nome_vitima`…), e não
// tinha nada dos papéis, envolvidos, vítimas ou campos por espécie. O novo
// `SaveProceedingRequest` recebe cabeçalho, `envolvidos[]`, `designacoes[]`,
// `pessoas[]` e `carta_precatoria` numa única chamada, gravados em uma
// transação.
//
// CAMPOS CONDICIONAIS SÃO DIRIGIDOS POR DADO, NUNCA POR SIGLA
//
//   natureza obrigatória      <- apuratorios.exige_natureza_fato
//   campo de condutor         <- naturezas_fato.exige_condutor
//   deprecante/deprecada      <- apuratorios.codigo_extensao == 'carta_precatoria'
//   papéis oferecidos         <- apuratorio_papeis do apuratório escolhido
//
// Nenhuma dessas regras aparece como literal aqui. Trocar o nome de um
// apuratório, de uma natureza ou de uma solução não muda nada nesta tela.

import {
  call,
  type AcusacoesRequest,
  type ApuratorioConfig,
  type AtualizarSubstituicaoRequest,
  type CartaPrecatoriaRequest,
  type DesignacaoItem,
  type DesignacaoRequest,
  type EnvolvidoRequest,
  type MilitarQualificado,
  type PapelItem,
  type PessoaRequest,
  type VitimaRequest,
  type SaveProceedingRequest,
  type SelecaoInfracaoEstatuto,
  type SelecaoInfracaoPenal,
  type UserListItem,
} from "../api";
import {
  ativarSelectsPesquisaveis,
  baixarArquivoBase64,
  botaoIcone,
  destruirSelectsPesquisaveis,
  escapeHtml,
  formatarOrigem,
  formatarQualificacaoMilitar,
  ligarPaginacao,
  limparFormularioPendente,
  notificar,
  option,
  ITENS_POR_PAGINA,
  paginacao,
  podeDescartarFormulario,
  protegerFormulario,
} from "../dom";
import { abrirCadastroRapidoCatalogo, type ContextoTela } from "./catalogos";
import { pedirAnalogia, renderIndicios } from "./indicios";
import { abrirCadastroRapidoMilitar } from "./usuarios";

export const ROTA_LISTA = "/procedimentos/lista";

const EXTENSAO_CARTA_PRECATORIA = "carta_precatoria";
/** Valor exclusivo do DOM. No IPC, esta opção vira `policial_militar_id: null`. */
const A_APURAR = "__a_apurar__";

type Opcao = { id: string; rotulo: string; extra?: Record<string, unknown> };

/** Catálogos que o formulário inteiro consulta. Carregados uma vez por abertura. */
type Catalogos = {
  apuratorios: Opcao[];
  unidades: Opcao[];
  subunidades: Opcao[];
  municipios: Opcao[];
  naturezas: Opcao[];
  status: Opcao[];
  papeisPessoa: Opcao[];
  militares: UserListItem[];
};

async function catalogo(chave: string, campos: string[]): Promise<Opcao[]> {
  const r = await call("legal_catalogs_list", { catalogo: chave });
  return (r.data ?? []).map((linha) => ({
    id: String(linha.id),
    rotulo:
      campos
        .map((c) => String(linha[c] ?? "").trim())
        .filter(Boolean)
        .join(" — ") || String(linha.id),
    extra: linha,
  }));
}

async function carregarCatalogos(): Promise<Catalogos> {
  const [
    apuratorios,
    unidades,
    subunidades,
    municipios,
    naturezas,
    status,
    papeisPessoa,
    militares,
  ] = await Promise.all([
    catalogo("apuratorios", ["sigla", "nome"]),
    catalogo("unidades_pm", ["nome"]),
    catalogo("subunidades_secoes", ["nome"]),
    catalogo("municipios_distritos", ["nome"]),
    catalogo("naturezas_fato", ["nome"]),
    catalogo("status_envolvido", ["nome"]),
    catalogo("papeis_pessoa", ["nome"]),
    call("users_list_ativos", {}).then((r) => r.data ?? []),
  ]);
  return {
    apuratorios,
    unidades,
    subunidades,
    municipios,
    naturezas,
    status,
    papeisPessoa,
    militares,
  };
}

// ── rascunho ────────────────────────────────────────────────────────────────

type AcusacoesFormulario = Required<AcusacoesRequest> & {
  rotulos: Record<string, string>;
};

type EnvolvidoFormulario = Omit<EnvolvidoRequest, "acusacoes"> & {
  acusacoes?: AcusacoesFormulario | null;
};

type Rascunho = Omit<SaveProceedingRequest, "envolvidos"> & {
  envolvidos: EnvolvidoFormulario[];
  designacoes: DesignacaoRequest[];
  pessoas: PessoaRequest[];
  vitimas: VitimaRequest[];
};

type DatasPosteriores = {
  data_remessa_encarregado: string | null;
  data_remessa_comissao: string | null;
  data_julgamento: string | null;
  data_conclusao: string | null;
};

const datasPosterioresVazias = (): DatasPosteriores => ({
  data_remessa_encarregado: null,
  data_remessa_comissao: null,
  data_julgamento: null,
  data_conclusao: null,
});

// As datas pós-cadastro não viajam em `SaveProceedingRequest`, mas precisam
// limitar Instauração e Recebimento ao editar o cabeçalho. Ficam como estado
// exclusivo da tela e sobrevivem aos re-renders provocados pelo formulário.
let datasPosterioresEdicao = datasPosterioresVazias();

// Opção histórica inativa. Fica fora do request, mas sobrevive aos re-renders
// estruturais do formulário para que uma mudança em outro campo não apague o
// vínculo em silêncio.
let subunidadeHistorica: Opcao | null = null;

function acusacoesVazias(): AcusacoesFormulario {
  return {
    infracoes_penais: [],
    transgressoes_ids: [],
    infracoes_estatuto: [],
    rotulos: {},
  };
}

function acusacoesDo(envolvido: EnvolvidoFormulario): AcusacoesFormulario {
  if (!envolvido.acusacoes) envolvido.acusacoes = acusacoesVazias();
  return envolvido.acusacoes;
}

function quantidadeAcusacoes(acusacoes: AcusacoesFormulario): number {
  return (
    acusacoes.infracoes_penais.length +
    acusacoes.transgressoes_ids.length +
    acusacoes.infracoes_estatuto.length
  );
}

function rascunhoVazio(): Rascunho {
  return {
    id: null,
    apuratorio_id: "",
    documento_iniciador_id: "",
    numero_documento: "",
    numero_controle: null,
    processo_sei: null,
    numero_rgf: null,
    unidade_origem_id: "",
    subunidade_secao_origem_id: null,
    municipio_fato_id: "",
    natureza_fato_id: null,
    data_instauracao: hojeIso(),
    data_recebimento: null,
    resumo_fatos: null,
    envolvidos: [],
    designacoes: [],
    pessoas: [],
    vitimas: [],
    carta_precatoria: null,
  };
}

/**
 * As designações que o cadastro NÃO alcança, por id.
 *
 * Vive fora do `Rascunho` de propósito: `Rascunho` é o corpo de
 * `proceedings_save`, e enfiar informação de tela nele mandaria campo
 * inventado pelo IPC. Sobrevive aos re-renders porque o formulário se
 * redesenha passando o mesmo rascunho adiante, e é recarregado toda vez que um
 * processo é aberto.
 */
const designacoesTravadas = new Map<string, { papel: string; ocupante: string }>();

/** Lê o formulário para o rascunho antes de qualquer re-render estrutural. */
function absorverFormulario(rascunho: Rascunho, form: HTMLFormElement): void {
  const dados = new FormData(form);
  const texto = (campo: string) => String(dados.get(campo) ?? "").trim() || null;

  rascunho.apuratorio_id = String(dados.get("apuratorio_id") ?? "");
  rascunho.documento_iniciador_id = String(dados.get("documento_iniciador_id") ?? "");
  rascunho.numero_documento = String(dados.get("numero_documento") ?? "").trim();
  rascunho.numero_controle = texto("numero_controle");
  rascunho.processo_sei = texto("processo_sei");
  rascunho.numero_rgf = texto("numero_rgf");
  rascunho.unidade_origem_id = String(dados.get("unidade_origem_id") ?? "");
  rascunho.subunidade_secao_origem_id = texto("subunidade_secao_origem_id");
  rascunho.municipio_fato_id = String(dados.get("municipio_fato_id") ?? "");
  rascunho.natureza_fato_id = texto("natureza_fato_id");
  rascunho.data_instauracao = String(dados.get("data_instauracao") ?? "");
  rascunho.data_recebimento = texto("data_recebimento");
  rascunho.resumo_fatos = texto("resumo_fatos");

  const deprecante = texto("cp_deprecante");
  const deprecada = String(dados.get("cp_unidade_deprecada_id") ?? "");
  rascunho.carta_precatoria =
    deprecante || deprecada
      ? ({ deprecante: deprecante ?? "", unidade_deprecada_id: deprecada } as CartaPrecatoriaRequest)
      : null;

  rascunho.envolvidos = rascunho.envolvidos.map((envolvido, i) => ({
    id: envolvido.id ?? null,
    policial_militar_id:
      String(dados.get(`env_${i}_pm`) ?? "") === A_APURAR
        ? null
        : String(dados.get(`env_${i}_pm`) ?? ""),
    status_envolvido_id: String(dados.get(`env_${i}_status`) ?? ""),
    ordem: i + 1,
    e_condutor: dados.get(`env_${i}_condutor`) === "on",
    acusacoes: envolvido.acusacoes,
  }));

  // A designação travada é desenhada como texto, sem `<select>`: `dados.has()`
  // devolve false para ela e o valor do rascunho é preservado. É o mesmo
  // cuidado de `textoSePresente` — campo ausente do DOM não é campo apagado.
  rascunho.designacoes = rascunho.designacoes.map((d, i) => ({
    id: d.id ?? null,
    policial_militar_id: dados.has(`des_${i}_pm`)
      ? String(dados.get(`des_${i}_pm`) ?? "")
      : d.policial_militar_id,
    papel_id: dados.has(`des_${i}_papel`)
      ? String(dados.get(`des_${i}_papel`) ?? "")
      : d.papel_id,
  }));

  rascunho.pessoas = rascunho.pessoas.map((_, i) => ({
    papel_pessoa_id: String(dados.get(`pes_${i}_papel`) ?? ""),
    nome: String(dados.get(`pes_${i}_nome`) ?? "").trim(),
    ordem: i + 1,
  }));

  // Vítima já gravada numa espécie que não a registra mais é desenhada como
  // TEXTO, sem `<input>`: `dados.has()` devolve false e o valor do rascunho é
  // preservado. Mesmo cuidado da designação travada, logo acima.
  rascunho.vitimas = rascunho.vitimas.map((v, i) => ({
    nome: dados.has(`vit_${i}_nome`)
      ? String(dados.get(`vit_${i}_nome`) ?? "").trim()
      : v.nome,
    ordem: i + 1,
  }));
}

// ── render ──────────────────────────────────────────────────────────────────

function nomeMilitar(m: UserListItem): string {
  return formatarQualificacaoMilitar(m.posto_graduacao_sigla, m.matricula, m.nome);
}

/** Qualificação completa de um designado: posto, matrícula e nome. */
function qualificacaoDesignado(d: DesignacaoItem): string {
  return `${d.posto_graduacao} ${d.matricula} ${d.nome}`;
}

function selectMilitares(nome: string, militares: UserListItem[], atual: string): string {
  // A lista de opções só traz militar ativo (princípio 6). Um registro já
  // gravado, porém, pode apontar para quem foi desativado depois — e aí o
  // `<option>` correspondente não existe, o select cai no vazio e a edição
  // apagaria o vínculo sem dizer nada. É a mesma armadilha que fez
  // `ProceedingListItem` devolver os ids ao lado dos rótulos.
  //
  // Então o valor atual é preservado como opção própria quando falta na lista.
  // O id é tudo o que o rascunho carrega; o rótulo diz por que está ali.
  const ausente = atual !== "" && !militares.some((m) => m.id === atual);
  return `<select name="${nome}" required data-select-pesquisavel data-tipo-cadastro="militar">
    <option value=""></option>
    ${ausente ? option(atual, "— militar desativado (vínculo preservado) —", true) : ""}
    ${militares.map((m) => option(m.id, nomeMilitar(m), m.id === atual)).join("")}
  </select>`;
}

function selectMilitarEnvolvido(
  nome: string,
  militares: UserListItem[],
  atual: string | null,
  permitirApenasApurar = true,
): string {
  const valorAtual = atual === null ? A_APURAR : atual;
  const ausente = valorAtual !== "" && valorAtual !== A_APURAR && !militares.some((m) => m.id === valorAtual);
  return `<select name="${nome}" required data-select-pesquisavel data-tipo-cadastro="militar">
    <option value=""></option>
    <option value="${A_APURAR}"${valorAtual === A_APURAR ? " selected" : ""}${permitirApenasApurar ? "" : " disabled"}>À apurar — PM ainda não identificado</option>
    ${ausente ? option(valorAtual, "— militar desativado (vínculo preservado) —", true) : ""}
    ${militares.map((m) => option(m.id, nomeMilitar(m), m.id === valorAtual)).join("")}
  </select>`;
}

function selectOpcoes(nome: string, opcoes: Opcao[], atual: string, obrigatorio = false): string {
  return `<select name="${nome}"${obrigatorio ? " required" : ""} data-select-pesquisavel>
    <option value=""></option>
    ${opcoes.map((o) => option(o.id, o.rotulo, o.id === atual)).join("")}
  </select>`;
}

function campoComCadastroRapido(
  rotuloCampo: string,
  nome: string,
  controle: string,
  tipo: string,
  rotulo: string,
  designavel = false,
  ajuda = "",
): string {
  const classeMilitar = tipo === "militar" ? " campo--militar" : "";
  return `<div class="campo campo-com-cadastro${classeMilitar}">
    <label>${escapeHtml(rotuloCampo)}${controle}</label>
    ${botaoIcone("adicionar", `Cadastrar ${rotulo}`, {
      classe: "secondary cadastro-rapido-botao",
      dados: {
        "cadastro-rapido": tipo,
        "select-alvo": nome,
        ...(designavel ? { "militar-designavel": "true" } : {}),
      },
    })}
    ${ajuda ? `<small class="campo-efeito">${escapeHtml(ajuda)}</small>` : ""}
  </div>`;
}

function campoData(
  nome: string,
  rotulo: string,
  valor: string | null | undefined,
  opcoes: { obrigatorio?: boolean; ajuda?: string; min?: string; max?: string } = {},
): string {
  const obrigatorio = opcoes.obrigatorio === true;
  const id = `campo-${nome}`;
  return `<div class="campo">
    <label for="${id}">${escapeHtml(rotulo)}</label>
    <div class="campo-data-controle">
      <input id="${id}" name="${escapeHtml(nome)}" type="date" value="${escapeHtml(valor ?? "")}"
        ${opcoes.min ? `min="${escapeHtml(opcoes.min)}"` : ""}
        ${opcoes.max ? `max="${escapeHtml(opcoes.max)}"` : ""}${obrigatorio ? " required" : ""} />
      ${
        obrigatorio
          ? ""
          : `<button type="button" class="ghost small campo-data-limpar" data-limpar-data="${escapeHtml(nome)}"${valor ? "" : " disabled"}>Limpar</button>`
      }
    </div>
    ${opcoes.ajuda ? `<small class="campo-efeito">${escapeHtml(opcoes.ajuda)}</small>` : ""}
  </div>`;
}

/**
 * Uma linha de designação do cadastro.
 *
 * Dois estados. **Travada**: a função já tem substituição, e a linha vira texto
 * — sem `<select>`, sem botão de remover — com a orientação de onde a troca
 * acontece. **Livre**: papel e militar editáveis.
 *
 * As opções de papel de uma linha livre desabilitam as funções que as OUTRAS
 * linhas já preencheram até o teto de `max_ocupantes`. É a mesma regra que o
 * backend cobra, adiantada para o ponto em que ainda dá para escolher: sem
 * isso, o usuário só descobre no "Salvar" — e o `tg_max_ocupantes`, por ser
 * DEFERRABLE, falharia lá no commit, longe da linha que causou.
 */
function linhaDesignacao(
  d: DesignacaoRequest,
  i: number,
  papeis: PapelItem[],
  militares: UserListItem[],
  todas: DesignacaoRequest[],
): string {
  const travada = d.id ? designacoesTravadas.get(d.id) : undefined;
  if (travada) {
    return `<div class="linha-colecao linha-colecao--travada">
      <div class="linha-colecao-head"><strong>Designação ${i + 1}</strong>
        <span class="badge badge--neutro">com histórico</span>
      </div>
      <p class="campo-efeito"><strong>${escapeHtml(travada.papel)}</strong> — ${escapeHtml(travada.ocupante)}</p>
      <p class="campo-efeito">Esta função já foi substituída. Para trocar de novo, corrigir ou desfazer, use <strong>Substituir</strong> na página de detalhes do apuratório.</p>
    </div>`;
  }

  const opcoesPapel = papeis.map((p) => {
    const ocupadas = todas.filter((outra, j) => j !== i && outra.papel_id === p.papel_id).length;
    const cheio = ocupadas >= p.max_ocupantes && p.papel_id !== d.papel_id;
    const rotulo =
      p.papel +
      (p.obrigatorio ? " *" : "") +
      (cheio ? ` — já preenchido (máx. ${p.max_ocupantes})` : "");
    // `option()` não emite `disabled`; a marcação sai daqui e o atributo é
    // estático, então não esbarra na CSP como um `style` interpolado esbarraria.
    return option(p.papel_id, rotulo, p.papel_id === d.papel_id).replace(
      "<option ",
      cheio ? "<option disabled " : "<option ",
    );
  });

  return `<div class="linha-colecao">
    <div class="linha-colecao-head"><strong>Designação ${i + 1}</strong>
      <button type="button" class="danger small" data-remover-des="${i}">Remover</button>
    </div>
    <label>Função<select name="des_${i}_papel" required data-select-pesquisavel>
      <option value=""></option>
      ${opcoesPapel.join("")}
    </select></label>
    ${campoComCadastroRapido(
      "Militar",
      `des_${i}_pm`,
      selectMilitares(`des_${i}_pm`, militares, d.policial_militar_id),
      "militar",
      "policial militar",
      true,
    )}
  </div>`;
}

function listaAcusacoes(
  acusacoes: AcusacoesFormulario,
  indiceEnvolvido: number,
  esferas: Opcao[],
): string {
  const rotulo = (id: string) => acusacoes.rotulos[id] ?? id;
  return `
    <div class="acusacoes-lista">
      ${acusacoes.infracoes_penais
        .map(
          (item, indice) => `<div class="vinculo">
            <span>${escapeHtml(rotulo(item.infracao_penal_id))}</span>
            <label>Esfera<select data-acusacao-esfera="${indiceEnvolvido}:${indice}" data-select-pesquisavel>
              ${esferas.map((e) => option(e.id, e.rotulo, e.id === item.esfera_penal_id)).join("")}
            </select></label>
            <button type="button" class="danger small" data-remover-acusacao-penal="${indiceEnvolvido}:${indice}" aria-label="Remover infração penal">×</button>
          </div>`,
        )
        .join("")}
      ${acusacoes.transgressoes_ids
        .map(
          (id, indice) => `<div class="vinculo">
            <span>${escapeHtml(rotulo(id))}</span>
            <button type="button" class="danger small" data-remover-acusacao-transgressao="${indiceEnvolvido}:${indice}" aria-label="Remover transgressão">×</button>
          </div>`,
        )
        .join("")}
      ${acusacoes.infracoes_estatuto
        .map(
          (item, indice) => `<div class="vinculo">
            <span>${escapeHtml(rotulo(item.infracao_estatuto_id))}</span>
            <span class="analogia">analogia: ${escapeHtml(rotulo(item.analogia_transgressao_id))}</span>
            <button type="button" class="secondary small" data-trocar-analogia-acusacao="${indiceEnvolvido}:${indice}">Trocar analogia</button>
            <button type="button" class="danger small" data-remover-acusacao-estatuto="${indiceEnvolvido}:${indice}" aria-label="Remover infração do Estatuto">×</button>
          </div>`,
        )
        .join("")}
      ${quantidadeAcusacoes(acusacoes) === 0 ? `<p class="empty">Nenhuma acusação selecionada.</p>` : ""}
    </div>`;
}

function blocoAcusacoes(
  envolvido: EnvolvidoFormulario,
  indice: number,
  permitePenal: boolean,
  esferas: Opcao[],
  dispositivos: Opcao[],
  naturezasTransgressao: Opcao[],
): string {
  const acusacoes = acusacoesDo(envolvido);
  return `<section class="acusacoes-editor" aria-label="Acusações do envolvido ${indice + 1}">
    <div class="acusacoes-editor__cabecalho">
      <div><h3>Acusações</h3><p class="secao-ajuda">Selecione um ou mais enquadramentos. Infrações do Estatuto exigem analogia com o RDPM.</p></div>
      <span class="badge badge--neutro">${quantidadeAcusacoes(acusacoes)} selecionada(s)</span>
    </div>
    ${listaAcusacoes(acusacoes, indice, esferas)}
    <div class="acusacoes-buscas">
      ${
        permitePenal
          ? `<div class="acusacao-busca">
              <strong>Crime ou contravenção</strong>
              <div class="linha-form">
                <label>Buscar artigo<input id="acusacao-penal-${indice}" placeholder="artigo ou descrição" autocomplete="off" /></label>
                <label>Dispositivo<select id="acusacao-dispositivo-${indice}" data-select-pesquisavel><option value="">Todos</option>${dispositivos.map((d) => option(d.id, d.rotulo, false)).join("")}</select></label>
              </div>
              <div id="acusacao-penal-resultados-${indice}" class="resultados"></div>
            </div>`
          : ""
      }
      <div class="acusacao-busca">
        <strong>Transgressão do RDPM</strong>
        <div class="linha-form">
          <label>Buscar transgressão<input id="acusacao-transgressao-${indice}" placeholder="inciso ou texto" autocomplete="off" /></label>
          <label>Natureza<select id="acusacao-natureza-${indice}" data-select-pesquisavel><option value="">Todas</option>${naturezasTransgressao.map((n) => option(n.id, n.rotulo, false)).join("")}</select></label>
        </div>
        <div id="acusacao-transgressao-resultados-${indice}" class="resultados"></div>
      </div>
      <div class="acusacao-busca">
        <strong>Infração do Estatuto</strong>
        <label>Buscar infração<input id="acusacao-estatuto-${indice}" placeholder="artigo, inciso ou texto" autocomplete="off" /></label>
        <div id="acusacao-estatuto-resultados-${indice}" class="resultados"></div>
      </div>
    </div>
  </section>`;
}

export async function renderFormularioProcesso(
  ctx: ContextoTela,
  id: string | null,
  erro = "",
  rascunhoAtual?: Rascunho,
): Promise<void> {
  destruirSelectsPesquisaveis(document);
  if (!rascunhoAtual) {
    limparFormularioPendente();
    datasPosterioresEdicao = datasPosterioresVazias();
    subunidadeHistorica = null;
  }
  const cats = await carregarCatalogos();
  let rascunho = rascunhoAtual;

  if (!rascunho) {
    rascunho = rascunhoVazio();
    designacoesTravadas.clear();
    if (id) {
      const [r, evidenciasResp] = await Promise.all([
        call("proceedings_get", { id }),
        call("evidence_list_for_proceeding", { processoId: id }),
      ]);
      const d = r.data;
      if (!d) {
        ctx.shell(`<section class="panel"><p class="error">Apuratório não encontrado.</p></section>`);
        return;
      }
      datasPosterioresEdicao = {
        data_remessa_encarregado: d.data_remessa_encarregado,
        data_remessa_comissao: d.data_remessa_comissao,
        data_julgamento: d.data_julgamento,
        data_conclusao: d.data_conclusao,
      };
      const evidenciasPorEnvolvido = new Map(
        (evidenciasResp.data ?? []).map((item) => [item.envolvido_id, item.indicios]),
      );
      rascunho = {
        id: d.id,
        apuratorio_id: d.apuratorio_id,
        documento_iniciador_id: d.documento_iniciador_id,
        numero_documento: d.numero_documento,
        numero_controle: d.numero_controle,
        processo_sei: d.processo_sei,
        numero_rgf: d.numero_rgf,
        unidade_origem_id: d.unidade_origem_id,
        subunidade_secao_origem_id: d.subunidade_secao_origem_id,
        municipio_fato_id: d.municipio_fato_id,
        natureza_fato_id: d.natureza_fato_id,
        data_instauracao: d.data_instauracao,
        data_recebimento: d.data_recebimento,
        resumo_fatos: d.resumo_fatos,
        envolvidos: d.envolvidos.map((e, i) => {
          const dados = evidenciasPorEnvolvido.get(e.id);
          const rotulos: Record<string, string> = {};
          for (const item of dados?.infracoes_penais ?? []) rotulos[item.infracao_penal_id] = item.rotulo;
          for (const item of dados?.transgressoes ?? []) rotulos[item.id] = item.rotulo;
          for (const item of dados?.infracoes_estatuto ?? []) {
            rotulos[item.infracao_estatuto_id] = item.rotulo;
            rotulos[item.analogia_transgressao_id] = item.analogia_rotulo;
          }
          return {
            id: e.id,
            policial_militar_id: e.policial_militar_id,
            status_envolvido_id: e.status_envolvido_id,
            ordem: i + 1,
            e_condutor: e.e_condutor,
            acusacoes: {
              infracoes_penais: (dados?.infracoes_penais ?? []).map((item) => ({
                infracao_penal_id: item.infracao_penal_id,
                esfera_penal_id: item.esfera_penal_id,
              })),
              transgressoes_ids: (dados?.transgressoes ?? []).map((item) => item.id),
              infracoes_estatuto: (dados?.infracoes_estatuto ?? []).map((item) => ({
                infracao_estatuto_id: item.infracao_estatuto_id,
                analogia_transgressao_id: item.analogia_transgressao_id,
              })),
              rotulos,
            },
          };
        }),
        // Só as vigentes: designação encerrada é histórico e não viaja no
        // formulário. O `id` vai junto — é ele que faz o backend ATUALIZAR a
        // linha em vez de criar outra, que era o defeito de antes.
        designacoes: d.designacoes
          .filter((x) => x.data_fim === null)
          .map((x) => ({
            id: x.id,
            policial_militar_id: x.policial_militar_id,
            papel_id: x.papel_id,
          })),
        pessoas: d.pessoas.map((p, i) => ({
          papel_pessoa_id: p.papel_pessoa_id,
          nome: p.nome,
          ordem: i + 1,
        })),
        vitimas: d.vitimas.map((v, i) => ({ nome: v.nome, ordem: i + 1 })),
        carta_precatoria: d.carta_precatoria
          ? {
              deprecante: d.carta_precatoria.deprecante,
              unidade_deprecada_id: d.carta_precatoria.unidade_deprecada_id,
            }
          : null,
      };
      if (
        d.subunidade_secao_origem_id &&
        !cats.subunidades.some((subunidade) => subunidade.id === d.subunidade_secao_origem_id)
      ) {
        subunidadeHistorica = {
          id: d.subunidade_secao_origem_id,
          rotulo: `${d.subunidade_secao_origem ?? "Subunidade/Seção"} (inativa — vínculo preservado)`,
          extra: { unidade_pm_id: d.unidade_origem_id },
        };
      }

      // Quem já tem substituição sai do alcance do cadastro. A tela mostra a
      // linha bloqueada, com a orientação de onde a troca acontece; o backend
      // recusa a alteração de todo jeito, mesmo que se contorne o formulário.
      for (const x of d.designacoes) {
        if (x.data_fim === null && x.designacao_anterior_id !== null) {
          designacoesTravadas.set(x.id, {
            papel: x.papel,
            ocupante: qualificacaoDesignado(x),
          });
        }
      }
    }
  }

  if (
    subunidadeHistorica &&
    rascunho.subunidade_secao_origem_id === subunidadeHistorica.id &&
    !cats.subunidades.some((subunidade) => subunidade.id === subunidadeHistorica?.id)
  ) {
    cats.subunidades.push(subunidadeHistorica);
  }

  if (!rascunho.apuratorio_id && cats.apuratorios[0]) {
    rascunho.apuratorio_id = cats.apuratorios[0].id;
  }

  const apuratorio = cats.apuratorios.find((a) => a.id === rascunho.apuratorio_id);

  // Configuração do apuratório escolhido: é ela que decide o que aparece.
  //
  // Os atributos de comportamento vêm de `apuratorio_config_get`, NÃO de
  // `cats.apuratorios`. A lista de catálogos projeta só as colunas declaradas
  // no registro de administração, e foi assim que a carta precatória parou de
  // funcionar: a decisão 29 tirou `codigo_extensao` do registro, `extra`
  // deixou de trazê-lo, o bloco de deprecante nunca mais renderizou — e o
  // backend continuou exigindo os campos, tornando a espécie impossível de
  // cadastrar. Ver o cabeçalho de `ApuratorioConfig` no Rust.
  let config: ApuratorioConfig | null = null;
  if (rascunho.apuratorio_id) {
    const r = await call("apuratorio_config_get", { apuratorioId: rascunho.apuratorio_id });
    config = r.data ?? null;
  }

  const exigeNatureza = config?.exige_natureza_fato === true;
  const ehCartaPrecatoria = config?.codigo_extensao === EXTENSAO_CARTA_PRECATORIA;
  const maxEnvolvidos = config?.max_envolvidos ?? null;
  const permiteAcusacao = config?.permite_acusacao === true;
  const permiteAcusacaoPenal = config?.permite_acusacao_penal === true;
  const permiteVitima = config?.permite_cadastro_vitima === true;

  const [esferasPenais, dispositivosLegais, naturezasTransgressao] = permiteAcusacao
    ? await Promise.all([
        catalogo("esferas_penais", ["nome"]),
        catalogo("dispositivos_legais", ["nome"]),
        catalogo("naturezas_transgressao", ["nome"]),
      ])
    : [[], [], []];

  const documentos = (config?.documentos ?? []).filter((d) => d.ativo);
  const papeis = (config?.papeis ?? []).filter((p) => p.ativo);

  if (!rascunho.documento_iniciador_id) {
    rascunho.documento_iniciador_id =
      documentos.find((d) => d.padrao)?.tipo_documento_id ??
      documentos[0]?.tipo_documento_id ??
      "";
  }

  const natureza = cats.naturezas.find((n) => n.id === rascunho.natureza_fato_id);
  const exigeCondutor = natureza?.extra?.exige_condutor === true;

  const r = rascunho;
  const subunidadesDaUnidade = cats.subunidades.filter(
    (subunidade) => String(subunidade.extra?.unidade_pm_id ?? "") === r.unidade_origem_id,
  );
  const podeAdicionarEnvolvido = maxEnvolvidos === null || r.envolvidos.length < maxEnvolvidos;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${id ? "Editar" : "Novo"} apuratório</h1>
          <p>${escapeHtml(apuratorio?.rotulo ?? "")}</p>
        </div>
      </div>

      ${
        erro
          ? `<div class="feedback feedback--error formulario-feedback" role="alert" tabindex="-1">
               <strong>Não foi possível salvar.</strong>
               <span>${escapeHtml(erro)}</span>
             </div>`
          : ""
      }

      ${documentos.length === 0 ? `<p class="aviso">Este apuratório não tem documento iniciador habilitado. Configure em <strong>Catálogos → Configuração de apuratórios</strong>.</p>` : ""}

      <form id="form-processo" class="crud-form">
        <fieldset>
          <legend>Identificação</legend>
          <div class="campo"><label>Apuratório ${selectOpcoes("apuratorio_id", cats.apuratorios, r.apuratorio_id, true)}</label></div>
          <div class="campo"><label>Documento iniciador
            <select name="documento_iniciador_id" required data-select-pesquisavel>
              <option value=""></option>
              ${documentos.map((d) => option(d.tipo_documento_id, `${d.tipo_documento} (${d.prazo_efetivo_dias} dias)`, d.tipo_documento_id === r.documento_iniciador_id)).join("")}
            </select></label></div>
          <div class="campo"><label>Nº do documento<input name="numero_documento" value="${escapeHtml(r.numero_documento)}" required /></label></div>
          <div class="campo"><label>Nº de controle<input name="numero_controle" value="${escapeHtml(r.numero_controle ?? "")}" />
            <small class="campo-efeito">Em branco = igual ao número do documento.</small></label></div>
          <div class="campo"><label>Processo SEI<input name="processo_sei" value="${escapeHtml(r.processo_sei ?? "")}" /></label></div>
          <div class="campo"><label>Nº RGF<input name="numero_rgf" value="${escapeHtml(r.numero_rgf ?? "")}" /></label></div>
        </fieldset>

        <fieldset>
          <legend>Localização</legend>
          ${campoComCadastroRapido("Unidade de origem", "unidade_origem_id", selectOpcoes("unidade_origem_id", cats.unidades, r.unidade_origem_id, true), "unidades_pm", "unidade PM")}
          ${campoComCadastroRapido("Subunidade/Seção de origem", "subunidade_secao_origem_id", selectOpcoes("subunidade_secao_origem_id", subunidadesDaUnidade, r.subunidade_secao_origem_id ?? ""), "subunidades_secoes", "subunidade ou seção", false, "Opcional. As opções pertencem à unidade selecionada.")}
          ${campoComCadastroRapido("Município do fato", "municipio_fato_id", selectOpcoes("municipio_fato_id", cats.municipios, r.municipio_fato_id, true), "municipios_distritos", "município ou distrito")}
          ${campoComCadastroRapido("Natureza geral do fato", "natureza_fato_id", selectOpcoes("natureza_fato_id", cats.naturezas, r.natureza_fato_id ?? "", exigeNatureza), "naturezas_fato", "natureza geral do fato", false, exigeNatureza ? "Obrigatória para este apuratório." : "")}
        </fieldset>

        ${
          ehCartaPrecatoria
            ? `<fieldset>
                 <legend>Carta precatória</legend>
                 <div class="campo"><label>Deprecante<input name="cp_deprecante" value="${escapeHtml(r.carta_precatoria?.deprecante ?? "")}" required /></label></div>
                 ${campoComCadastroRapido("Unidade deprecada", "cp_unidade_deprecada_id", selectOpcoes("cp_unidade_deprecada_id", cats.unidades, r.carta_precatoria?.unidade_deprecada_id ?? "", true), "unidades_pm", "unidade PM")}
               </fieldset>`
            : ""
        }

        <fieldset>
          <legend>Datas</legend>
          ${campoData("data_instauracao", "Instauração", r.data_instauracao, {
            obrigatorio: true,
            max: menorDataIso([
              hojeIso(),
              r.data_recebimento,
              ...Object.values(datasPosterioresEdicao),
            ]),
          })}
          ${campoData("data_recebimento", "Recebimento", r.data_recebimento, {
            ajuda: "Dispara o prazo inicial: sem ela, nenhum prazo nasce.",
            min: r.data_instauracao,
            max: menorDataIso([hojeIso(), ...Object.values(datasPosterioresEdicao)]),
          })}
        </fieldset>

        <fieldset>
          <legend>Designações</legend>
          ${papeis.length === 0 ? `<p class="empty">Nenhuma função habilitada para este apuratório.</p>` : ""}
          ${papeis.some((p) => p.obrigatorio) ? `<p class="secao-ajuda">Funções obrigatórias: ${papeis.filter((p) => p.obrigatorio).map((p) => escapeHtml(p.papel)).join(", ")}. O apuratório não salva sem elas.</p>` : ""}
          <p class="secao-ajuda">A designação inicial começa na data de instauração e é autorizada pelo documento que instaurou o apuratório — por isso não se digitam data nem documento aqui. Trocas posteriores são feitas em <strong>Substituir</strong>, na página de detalhes.</p>
          ${r.designacoes
            .map((d, i) => linhaDesignacao(d, i, papeis, cats.militares, r.designacoes))
            .join("")}
          <button type="button" class="secondary small" id="add-des">Adicionar designação</button>
        </fieldset>

        <fieldset>
          <legend>Envolvidos</legend>
          ${maxEnvolvidos !== null ? `<p class="secao-ajuda">Este apuratório aceita no máximo ${maxEnvolvidos} envolvido(s).</p>` : ""}
          ${exigeCondutor ? `<p class="aviso">Esta natureza exige indicar o PM condutor entre os envolvidos.</p>` : ""}
          ${r.envolvidos
            .map(
              (e, i) => `
            <div class="linha-colecao">
              <div class="linha-colecao-head"><strong>Envolvido ${i + 1}</strong>
                <button type="button" class="danger small" data-remover-env="${i}">Remover</button>
              </div>
              ${campoComCadastroRapido(
                "Militar",
                `env_${i}_pm`,
                selectMilitarEnvolvido(
                  `env_${i}_pm`,
                  cats.militares,
                  e.policial_militar_id,
                  !r.envolvidos.some(
                    (outro, indiceOutro) => indiceOutro !== i && outro.policial_militar_id === null,
                  ),
                ),
                "militar",
                "policial militar",
              )}
              ${campoComCadastroRapido("Situação", `env_${i}_status`, selectOpcoes(`env_${i}_status`, cats.status, e.status_envolvido_id, true), "status_envolvido", "status do envolvido")}
              ${
                exigeCondutor
                  ? `<label class="checkbox"><input name="env_${i}_condutor" type="checkbox"${e.e_condutor && e.policial_militar_id !== null ? " checked" : ""}${e.policial_militar_id === null ? " disabled" : ""} /> Condutor</label>
                     ${e.policial_militar_id === null ? `<small class="campo-efeito">Identifique o PM antes de marcá-lo como condutor.</small>` : ""}`
                  : ""
              }
              ${
                permiteAcusacao
                  ? blocoAcusacoes(
                      e,
                      i,
                      permiteAcusacaoPenal,
                      esferasPenais,
                      dispositivosLegais,
                      naturezasTransgressao,
                    )
                  : ""
              }
            </div>`,
            )
            .join("")}
          ${podeAdicionarEnvolvido ? `<button type="button" class="secondary small" id="add-env">Adicionar envolvido</button>` : ""}
        </fieldset>

        ${
          permiteVitima
            ? `<fieldset>
          <legend>Ofendidos/Vítimas (opcional)</legend>
          ${r.vitimas
            .map(
              (v, i) => `
            <div class="linha-colecao">
              <div class="linha-colecao-head"><strong>Ofendido/Vítima ${i + 1}</strong>
                <button type="button" class="danger small" data-remover-vit="${i}">Remover</button>
              </div>
              <label>Nome<input name="vit_${i}_nome" value="${escapeHtml(v.nome)}" required /></label>
            </div>`,
            )
            .join("")}
          <button type="button" class="secondary small" id="add-vit">Adicionar ofendido/vítima</button>
        </fieldset>`
            : /*
               * Espécie que não registra mais ofendido, mas já registrou: o
               * bloco APARECE ASSIM MESMO, em texto, com a nota. Esconder
               * apagaria fato registrado na primeira edição — é o princípio 5,
               * e a mesma escolha da data de julgamento (§8.10.4).
               *
               * O `id` importa: num cadastro NOVO, trocar o apuratório de um
               * procedimento para um processo não preservou nada — o que está
               * no rascunho ainda não é fato. Sem essa condição a tela diria
               * "preservado" sobre um nome que nunca foi gravado.
               */
              id && r.vitimas.length > 0
              ? `<fieldset>
          <legend>Ofendidos/Vítimas</legend>
          <p class="aviso">Esta espécie não registra Ofendido/Vítima. O que já estava
            gravado é preservado e continua sendo exibido, mas não pode ser alterado aqui.</p>
          ${r.vitimas
            .map(
              (v, i) => `<div class="linha-colecao"><strong>${i + 1}. ${escapeHtml(v.nome)}</strong></div>`,
            )
            .join("")}
        </fieldset>`
              : ""
        }

        <fieldset>
          <legend>Pessoas inquiridas</legend>
          ${r.pessoas
            .map(
              (p, i) => `
            <div class="linha-colecao">
              <div class="linha-colecao-head"><strong>Pessoa ${i + 1}</strong>
                <button type="button" class="danger small" data-remover-pes="${i}">Remover</button>
              </div>
              ${campoComCadastroRapido("Papel", `pes_${i}_papel`, selectOpcoes(`pes_${i}_papel`, cats.papeisPessoa, p.papel_pessoa_id, true), "papeis_pessoa", "papel de pessoa")}
              <label>Nome<input name="pes_${i}_nome" value="${escapeHtml(p.nome)}" required /></label>
            </div>`,
            )
            .join("")}
          <button type="button" class="secondary small" id="add-pes">Adicionar pessoa</button>
        </fieldset>

        <fieldset>
          <legend>Fatos</legend>
          <div class="campo campo--largo"><label>Resumo<textarea name="resumo_fatos" rows="4">${escapeHtml(r.resumo_fatos ?? "")}</textarea></label></div>
        </fieldset>

        <div class="form-actions">
          <button type="button" class="secondary" id="cancelar">Cancelar</button>
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);

  const form = document.querySelector<HTMLFormElement>("#form-processo")!;
  protegerFormulario(form);
  ativarSelectsPesquisaveis(form);
  if (erro) {
    const feedback = document.querySelector<HTMLElement>(".formulario-feedback");
    window.requestAnimationFrame(() => {
      feedback?.focus({ preventScroll: true });
      feedback?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    notificar(erro, "erro");
  }

  const atualizarLimitesCabecalho = () => {
    const instauracao = form.elements.namedItem("data_instauracao");
    const recebimento = form.elements.namedItem("data_recebimento");
    if (!(instauracao instanceof HTMLInputElement) || !(recebimento instanceof HTMLInputElement)) {
      return;
    }
    const posteriores = Object.values(datasPosterioresEdicao);
    const hoje = hojeIso();
    const maximoInstauracao = menorDataIso([
      hoje,
      recebimento.value || null,
      ...posteriores,
    ]);
    const maximoRecebimento = menorDataIso([hoje, ...posteriores]);
    aplicarIntervaloData(
      instauracao,
      "",
      maximoInstauracao,
    );
    aplicarIntervaloData(
      recebimento,
      instauracao.value,
      maximoRecebimento,
    );
    instauracao.dataset.mensagemMax =
      maximoInstauracao === hoje
        ? "A data de instauração não pode ser futura."
        : `A data de instauração não pode ser posterior a ${dataParaExibicao(maximoInstauracao)}.`;
    recebimento.dataset.mensagemMin =
      "A data de recebimento não pode ser anterior à data de instauração.";
    recebimento.dataset.mensagemMax =
      maximoRecebimento === hoje
        ? "A data de recebimento não pode ser futura."
        : `A data de recebimento não pode ser posterior a ${dataParaExibicao(maximoRecebimento)}.`;
  };
  atualizarLimitesCabecalho();

  // O seletor nativo do WebView permanece aberto depois da escolha em algumas
  // plataformas. Tirar o foco no quadro seguinte fecha o popover sem substituir
  // o controle nativo nem introduzir uma dependência de calendário.
  form.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
    input.addEventListener("change", () => {
      atualizarLimitesCabecalho();
      const limpar = form.querySelector<HTMLButtonElement>(
        `[data-limpar-data="${input.name}"]`,
      );
      if (limpar) limpar.disabled = input.value === "";
      window.requestAnimationFrame(() => input.blur());
    });
  });

  form.querySelectorAll<HTMLButtonElement>("[data-limpar-data]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const nome = botao.dataset.limparData;
      if (!nome) return;
      const input = form.elements.namedItem(nome);
      if (!(input instanceof HTMLInputElement)) return;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  const rerender = (mutar: () => void) => {
    absorverFormulario(r, form);
    mutar();
    void renderFormularioProcesso(ctx, id, "", r);
  };

  const coordenadas = (valor: string | undefined): [number, number] | null => {
    if (!valor) return null;
    const partes = valor.split(":");
    if (partes.length !== 2) return null;
    const envolvido = Number(partes[0]);
    const item = Number(partes[1]);
    return Number.isInteger(envolvido) && Number.isInteger(item) ? [envolvido, item] : null;
  };

  form.querySelectorAll<HTMLSelectElement>("[data-acusacao-esfera]").forEach((select) =>
    select.addEventListener("change", () => {
      const posicao = coordenadas(select.dataset.acusacaoEsfera);
      if (!posicao) return;
      const item = r.envolvidos[posicao[0]]?.acusacoes?.infracoes_penais[posicao[1]];
      if (item) item.esfera_penal_id = select.value;
    }),
  );

  const ligarRemocao = (
    seletor: string,
    atributo: "removerAcusacaoPenal" | "removerAcusacaoTransgressao" | "removerAcusacaoEstatuto",
    removerItem: (acusacoes: AcusacoesFormulario, indice: number) => void,
  ) =>
    form.querySelectorAll<HTMLButtonElement>(seletor).forEach((botao) =>
      botao.addEventListener("click", () => {
        const posicao = coordenadas(botao.dataset[atributo]);
        if (!posicao) return;
        rerender(() => removerItem(acusacoesDo(r.envolvidos[posicao[0]]!), posicao[1]));
      }),
    );
  ligarRemocao("[data-remover-acusacao-penal]", "removerAcusacaoPenal", (a, i) =>
    a.infracoes_penais.splice(i, 1),
  );
  ligarRemocao(
    "[data-remover-acusacao-transgressao]",
    "removerAcusacaoTransgressao",
    (a, i) => a.transgressoes_ids.splice(i, 1),
  );
  ligarRemocao("[data-remover-acusacao-estatuto]", "removerAcusacaoEstatuto", (a, i) =>
    a.infracoes_estatuto.splice(i, 1),
  );

  form.querySelectorAll<HTMLButtonElement>("[data-trocar-analogia-acusacao]").forEach((botao) =>
    botao.addEventListener("click", async () => {
      const posicao = coordenadas(botao.dataset.trocarAnalogiaAcusacao);
      if (!posicao) return;
      absorverFormulario(r, form);
      const acusacoes = acusacoesDo(r.envolvidos[posicao[0]]!);
      const item = acusacoes.infracoes_estatuto[posicao[1]];
      if (!item) return;
      const analogia = await pedirAnalogia(acusacoes.rotulos);
      if (!analogia) return;
      item.analogia_transgressao_id = analogia;
      void renderFormularioProcesso(ctx, id, "", r);
    }),
  );

  type ResultadoBusca = { id: string; rotulo: string };
  const ligarBusca = (
    input: HTMLInputElement | null,
    destino: HTMLElement | null,
    buscar: (termo: string) => Promise<ResultadoBusca[]>,
    escolher: (item: ResultadoBusca) => void | Promise<void>,
    filtro?: HTMLSelectElement | null,
  ) => {
    let sequencia = 0;
    const executar = async () => {
      const termo = input?.value.trim() ?? "";
      if (!destino) return;
      if (termo.length < 2) {
        destino.innerHTML = "";
        return;
      }
      const atual = ++sequencia;
      const resultados = await buscar(termo);
      if (atual !== sequencia) return;
      destino.innerHTML = resultados.length
        ? resultados
            .map(
              (item) =>
                `<button type="button" class="secondary small" data-escolher-acusacao="${escapeHtml(item.id)}">${escapeHtml(item.rotulo)}</button>`,
            )
            .join("")
        : `<span class="empty">Nenhum enquadramento encontrado.</span>`;
      destino.querySelectorAll<HTMLButtonElement>("[data-escolher-acusacao]").forEach((botao) =>
        botao.addEventListener("click", async () => {
          const item = resultados.find((resultado) => resultado.id === botao.dataset.escolherAcusacao);
          if (item) await escolher(item);
        }),
      );
    };
    input?.addEventListener("input", () => void executar());
    filtro?.addEventListener("change", () => void executar());
  };

  if (permiteAcusacao) {
    r.envolvidos.forEach((envolvido, indice) => {
      const acusacoes = acusacoesDo(envolvido);
      const filtroDispositivo = form.querySelector<HTMLSelectElement>(
        `#acusacao-dispositivo-${indice}`,
      );
      ligarBusca(
        form.querySelector<HTMLInputElement>(`#acusacao-penal-${indice}`),
        form.querySelector(`#acusacao-penal-resultados-${indice}`),
        (termo) =>
          call("evidence_search_infracoes_penais", {
            termo,
            dispositivoLegalId: filtroDispositivo?.value || null,
          }).then((resposta) => resposta.data ?? []),
        (item) => {
          const esfera = esferasPenais[0];
          if (!esfera) {
            notificar("Cadastre ao menos uma esfera penal antes de selecionar o artigo.", "erro");
            return;
          }
          if (acusacoes.infracoes_penais.some((x) => x.infracao_penal_id === item.id)) return;
          absorverFormulario(r, form);
          acusacoes.rotulos[item.id] = item.rotulo;
          acusacoes.infracoes_penais.push({
            infracao_penal_id: item.id,
            esfera_penal_id: esfera.id,
          } satisfies SelecaoInfracaoPenal);
          void renderFormularioProcesso(ctx, id, "", r);
        },
        filtroDispositivo,
      );

      const filtroNatureza = form.querySelector<HTMLSelectElement>(`#acusacao-natureza-${indice}`);
      ligarBusca(
        form.querySelector<HTMLInputElement>(`#acusacao-transgressao-${indice}`),
        form.querySelector(`#acusacao-transgressao-resultados-${indice}`),
        (termo) =>
          call("evidence_search_transgressoes", {
            termo,
            naturezaId: filtroNatureza?.value || null,
          }).then((resposta) => resposta.data ?? []),
        (item) => {
          if (acusacoes.transgressoes_ids.includes(item.id)) return;
          absorverFormulario(r, form);
          acusacoes.rotulos[item.id] = item.rotulo;
          acusacoes.transgressoes_ids.push(item.id);
          void renderFormularioProcesso(ctx, id, "", r);
        },
        filtroNatureza,
      );

      ligarBusca(
        form.querySelector<HTMLInputElement>(`#acusacao-estatuto-${indice}`),
        form.querySelector(`#acusacao-estatuto-resultados-${indice}`),
        (termo) =>
          call("evidence_search_infracoes_estatuto", { termo }).then(
            (resposta) => resposta.data ?? [],
          ),
        async (item) => {
          if (acusacoes.infracoes_estatuto.some((x) => x.infracao_estatuto_id === item.id)) return;
          absorverFormulario(r, form);
          acusacoes.rotulos[item.id] = item.rotulo;
          const analogia = await pedirAnalogia(acusacoes.rotulos);
          if (!analogia) return;
          acusacoes.infracoes_estatuto.push({
            infracao_estatuto_id: item.id,
            analogia_transgressao_id: analogia,
          } satisfies SelecaoInfracaoEstatuto);
          void renderFormularioProcesso(ctx, id, "", r);
        },
      );
    });
  }

  document.querySelector<HTMLButtonElement>("#cancelar")?.addEventListener("click", () => {
    if (!podeDescartarFormulario()) return;
    void renderListaProcessos(ctx);
  });

  const adicionarAosSelects = (
    tipo: string,
    idNovo: string,
    rotulo: string,
    nomeAlvo: string,
  ) => {
    const seletores: Record<string, string> = {
      militar: 'select[name^="env_"][name$="_pm"], select[name^="des_"][name$="_pm"]',
      unidades_pm: 'select[name="unidade_origem_id"], select[name="cp_unidade_deprecada_id"]',
      subunidades_secoes: 'select[name="subunidade_secao_origem_id"]',
      municipios_distritos: 'select[name="municipio_fato_id"]',
      naturezas_fato: 'select[name="natureza_fato_id"]',
      status_envolvido: 'select[name^="env_"][name$="_status"]',
      papeis_pessoa: 'select[name^="pes_"][name$="_papel"]',
    };
    const seletor = seletores[tipo];
    if (!seletor) return;
    form.querySelectorAll<HTMLSelectElement>(seletor).forEach((select) => {
      if (!select.querySelector(`option[value="${CSS.escape(idNovo)}"]`)) {
        select.add(new Option(rotulo, idNovo));
      }
      if (select.tomselect && !select.tomselect.options[idNovo]) {
        select.tomselect.addOption({ value: idNovo, text: rotulo });
      }
      if (select.name === nomeAlvo) {
        if (select.tomselect) select.tomselect.setValue(idNovo);
        else {
          select.value = idNovo;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  };

  form.querySelectorAll<HTMLButtonElement>("[data-cadastro-rapido]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const tipo = botao.dataset.cadastroRapido;
      const nomeAlvo = botao.dataset.selectAlvo;
      if (!tipo || !nomeAlvo) return;
      botao.disabled = true;
      try {
        if (tipo === "militar") {
          const militar = await abrirCadastroRapidoMilitar(
            botao.dataset.militarDesignavel === "true",
            botao,
          );
          if (!militar) return;
          cats.militares.push(militar);
          cats.militares.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          adicionarAosSelects(tipo, militar.id, nomeMilitar(militar), nomeAlvo);
          return;
        }

        const iniciais =
          tipo === "subunidades_secoes"
            ? { unidade_pm_id: String(new FormData(form).get("unidade_origem_id") ?? "") }
            : {};
        const resultado = await abrirCadastroRapidoCatalogo(tipo, iniciais, botao);
        if (!resultado) return;
        const nova: Opcao = {
          id: resultado.id,
          rotulo: resultado.rotulo,
          extra: resultado.valores,
        };
        const lista =
          tipo === "unidades_pm"
            ? cats.unidades
            : tipo === "subunidades_secoes"
              ? cats.subunidades
              : tipo === "municipios_distritos"
                ? cats.municipios
                : tipo === "naturezas_fato"
                  ? cats.naturezas
                  : tipo === "status_envolvido"
                    ? cats.status
                    : tipo === "papeis_pessoa"
                      ? cats.papeisPessoa
                      : null;
        lista?.push(nova);
        lista?.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
        adicionarAosSelects(tipo, resultado.id, resultado.rotulo, nomeAlvo);
      } finally {
        botao.disabled = false;
      }
    });
  });

  // Trocar apuratório, natureza ou unidade muda campos/opções do cadastro.
  for (const seletor of ['[name="apuratorio_id"]', '[name="natureza_fato_id"]']) {
    form.querySelector<HTMLSelectElement>(seletor)?.addEventListener("change", () => rerender(() => {}));
  }
  form
    .querySelectorAll<HTMLSelectElement>('select[name^="env_"][name$="_pm"]')
    .forEach((select) => {
      select.addEventListener("change", () =>
        rerender(() => {
          const indice = Number(select.name.match(/^env_(\d+)_pm$/)?.[1]);
          if (Number.isInteger(indice) && r.envolvidos[indice]?.policial_militar_id === null) {
            r.envolvidos[indice]!.e_condutor = false;
          }
        }),
      );
    });
  form.querySelector<HTMLSelectElement>('[name="unidade_origem_id"]')?.addEventListener(
    "change",
    () =>
      rerender(() => {
        const selecionada = cats.subunidades.find(
          (subunidade) => subunidade.id === r.subunidade_secao_origem_id,
        );
        if (
          selecionada &&
          String(selecionada.extra?.unidade_pm_id ?? "") !== r.unidade_origem_id
        ) {
          r.subunidade_secao_origem_id = null;
        }
      }),
  );
  document.querySelector("#add-des")?.addEventListener("click", () =>
    rerender(() =>
      r.designacoes.push({ id: null, policial_militar_id: "", papel_id: "" }),
    ),
  );
  document.querySelector("#add-env")?.addEventListener("click", () =>
    rerender(() =>
      r.envolvidos.push({
        id: null,
        policial_militar_id: "",
        status_envolvido_id: "",
        ordem: r.envolvidos.length + 1,
        e_condutor: false,
        acusacoes: permiteAcusacao ? acusacoesVazias() : null,
      }),
    ),
  );
  document.querySelector("#add-pes")?.addEventListener("click", () =>
    rerender(() => r.pessoas.push({ papel_pessoa_id: "", nome: "", ordem: r.pessoas.length + 1 })),
  );
  document.querySelector("#add-vit")?.addEventListener("click", () =>
    rerender(() => r.vitimas.push({ nome: "", ordem: r.vitimas.length + 1 })),
  );

  const remover = <T,>(lista: T[], indice: number) => lista.splice(indice, 1);
  form.querySelectorAll<HTMLButtonElement>("[data-remover-des]").forEach((b) =>
    b.addEventListener("click", () => rerender(() => remover(r.designacoes, Number(b.dataset.removerDes)))),
  );
  form.querySelectorAll<HTMLButtonElement>("[data-remover-env]").forEach((b) =>
    b.addEventListener("click", () => rerender(() => remover(r.envolvidos, Number(b.dataset.removerEnv)))),
  );
  form.querySelectorAll<HTMLButtonElement>("[data-remover-pes]").forEach((b) =>
    b.addEventListener("click", () => rerender(() => remover(r.pessoas, Number(b.dataset.removerPes)))),
  );
  form.querySelectorAll<HTMLButtonElement>("[data-remover-vit]").forEach((b) =>
    b.addEventListener("click", () => rerender(() => remover(r.vitimas, Number(b.dataset.removerVit)))),
  );

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const salvar = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    salvar.disabled = true;
    salvar.textContent = "Salvando…";
    absorverFormulario(r, form);
    const request: SaveProceedingRequest = {
      ...r,
      // A vítima histórica de uma espécie que não as registra mais NÃO viaja: o
      // backend recusaria a lista não vazia e o registro ficaria impossível de
      // salvar. Quem a preserva é `gravar_vitimas`, que não toca na tabela
      // quando o atributo está desligado.
      vitimas: permiteVitima ? r.vitimas : [],
      envolvidos: r.envolvidos.map((envolvido) => ({
        id: envolvido.id ?? null,
        policial_militar_id: envolvido.policial_militar_id,
        status_envolvido_id: envolvido.status_envolvido_id,
        ordem: envolvido.ordem,
        e_condutor: envolvido.e_condutor,
        acusacoes:
          permiteAcusacao && envolvido.acusacoes
            ? {
                infracoes_penais: envolvido.acusacoes.infracoes_penais,
                transgressoes_ids: envolvido.acusacoes.transgressoes_ids,
                infracoes_estatuto: envolvido.acusacoes.infracoes_estatuto,
              }
            : undefined,
      })),
    };
    const resposta = await call("proceedings_save", { request });
    if (!resposta.ok) {
      void renderFormularioProcesso(ctx, id, resposta.error ?? "Falha ao salvar.", r);
      return;
    }
    limparFormularioPendente();
    await renderListaProcessos(ctx);
    notificar("Apuratório salvo com sucesso.", "sucesso");
  });
}

// ── listagem ────────────────────────────────────────────────────────────────

const filtro = { busca: "", concluido: null as boolean | null, ano: null as number | null };

// O tamanho da página é o mesmo de toda listagem operacional.
const POR_PAGINA = ITENS_POR_PAGINA;
let pagina = 1;

type StatusPrazo = {
  classe: "badge--info" | "badge--neutro" | "badge--ok" | "badge--warn" | "badge--erro";
  texto: string;
};

function qualificacaoMilitar(militar: MilitarQualificado): string {
  if (militar.a_apurar) return "À apurar";
  return `${militar.posto_graduacao} ${militar.matricula} ${militar.nome}`;
}

function statusPrazo(concluido: boolean, diasRestantes: number | null): StatusPrazo {
  if (concluido) return { classe: "badge--info", texto: "Concluído" };
  if (diasRestantes === null) return { classe: "badge--neutro", texto: "Sem prazo" };
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return { classe: "badge--erro", texto: `Vencido há ${dias} ${dias === 1 ? "dia" : "dias"}` };
  }
  if (diasRestantes === 0) return { classe: "badge--warn", texto: "Vence hoje" };
  return {
    classe: diasRestantes <= 5 ? "badge--warn" : "badge--ok",
    texto: `Vence em ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`,
  };
}

function badgeStatusPrazo(concluido: boolean, diasRestantes: number | null): string {
  const status = statusPrazo(concluido, diasRestantes);
  return `<span class="badge status-prazo ${status.classe}" title="${escapeHtml(status.texto)}"><span class="status-prazo__ponto" aria-hidden="true"></span>${escapeHtml(status.texto)}</span>`;
}

function resumoEnvolvidos(processoId: string, envolvidos: MilitarQualificado[]): string {
  if (envolvidos.length === 0) return "—";
  const qualificacoes = envolvidos.map(qualificacaoMilitar);
  if (qualificacoes.length === 1) {
    return `<span class="pessoas-resumo__texto" title="${escapeHtml(qualificacoes[0]!)}">${escapeHtml(qualificacoes[0]!)}</span>`;
  }

  const rotulo = `${qualificacoes[0]} e outros`;
  return `<span class="pessoas-resumo" tabindex="0"
    data-tooltip-pessoas="${escapeHtml(JSON.stringify(qualificacoes))}"
    aria-label="${escapeHtml(`${rotulo}. Lista completa: ${qualificacoes.join("; ")}`)}"
    data-processo-tooltip="${escapeHtml(processoId)}">
      <span class="pessoas-resumo__texto">${escapeHtml(rotulo)}</span>
    </span>`;
}

let tooltipPessoasAberto: HTMLDivElement | null = null;
let alvoTooltipPessoas: HTMLElement | null = null;

function fecharTooltipPessoas(): void {
  tooltipPessoasAberto?.remove();
  alvoTooltipPessoas?.removeAttribute("aria-describedby");
  tooltipPessoasAberto = null;
  alvoTooltipPessoas = null;
}

function abrirTooltipPessoas(alvo: HTMLElement): void {
  fecharTooltipPessoas();
  const bruto = alvo.dataset.tooltipPessoas;
  if (!bruto) return;

  let qualificacoes: string[];
  try {
    qualificacoes = JSON.parse(bruto) as string[];
  } catch {
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip-pessoas";
  tooltip.id = `tooltip-pessoas-${alvo.dataset.processoTooltip ?? "lista"}`;
  tooltip.setAttribute("role", "tooltip");
  for (const qualificacao of qualificacoes) {
    const linha = document.createElement("div");
    linha.textContent = qualificacao;
    tooltip.append(linha);
  }
  document.body.append(tooltip);

  const margem = 12;
  const espaco = 8;
  const alvoRect = alvo.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const esquerda = Math.min(
    Math.max(margem, alvoRect.left),
    window.innerWidth - tooltipRect.width - margem,
  );
  const abaixo = alvoRect.bottom + espaco;
  const topo = abaixo + tooltipRect.height <= window.innerHeight - margem
    ? abaixo
    : Math.max(margem, alvoRect.top - tooltipRect.height - espaco);
  tooltip.style.left = `${esquerda}px`;
  tooltip.style.top = `${topo}px`;
  alvo.setAttribute("aria-describedby", tooltip.id);
  tooltipPessoasAberto = tooltip;
  alvoTooltipPessoas = alvo;
}

function ligarTooltipsPessoas(): void {
  document.querySelectorAll<HTMLElement>("[data-tooltip-pessoas]").forEach((alvo) => {
    alvo.addEventListener("mouseenter", () => abrirTooltipPessoas(alvo));
    alvo.addEventListener("mouseleave", fecharTooltipPessoas);
    alvo.addEventListener("focus", () => abrirTooltipPessoas(alvo));
    alvo.addEventListener("blur", fecharTooltipPessoas);
    alvo.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        fecharTooltipPessoas();
        alvo.blur();
      }
    });
  });
}

export async function renderListaProcessos(ctx: ContextoTela): Promise<void> {
  fecharTooltipPessoas();
  limparFormularioPendente();
  const resposta = await call("proceedings_list", {
    filter: {
      busca: filtro.busca || null,
      concluido: filtro.concluido,
      ano: filtro.ano,
      page: pagina,
      per_page: POR_PAGINA,
    },
  });
  if (!resposta.ok || !resposta.data) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(resposta.error ?? "Falha ao listar.")}</p></section>`);
    return;
  }

  const { items, total } = resposta.data;
  const podeEscrever = ctx.podeEscrever();

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Apuratórios</h1><p>${total} registro(s)</p></div>
        ${podeEscrever ? `<button id="novo">Novo</button>` : ""}
      </div>
      <div class="filtros">
        <input id="busca" type="search" placeholder="Número, SEI, resumo…" value="${escapeHtml(filtro.busca)}" />
        <label>Situação <select id="concluido">
          <option value="">todas</option>
          <option value="false"${filtro.concluido === false ? " selected" : ""}>em andamento</option>
          <option value="true"${filtro.concluido === true ? " selected" : ""}>concluídos</option>
        </select></label>
      </div>
      ${
        items.length
          ? `<div class="table-wrap table-wrap--viewport"><table class="tabela-dados tabela-dados--fixa tabela-dados--larga tabela-dados--listagem tabela-processos">
              <colgroup>
                <col class="col-layout-tipo" />
                <col class="col-layout-ano" />
                <col class="col-layout-numero" />
                <col class="col-layout-origem" />
                <col class="col-layout-sei" />
                <col class="col-layout-pessoa" />
                <col class="col-layout-pessoa" />
                <col class="col-layout-status" />
                <col class="col-layout-acao" />
              </colgroup>
              <thead><tr>
                <th class="col-tipo">Tipo</th>
                <th class="col-ano">Ano</th>
                <th class="col-numero-processo">Número</th>
                <th class="col-origem">Origem</th>
                <th class="col-sei">SEI</th>
                <th class="col-pessoa">Encarregado</th>
                <th class="col-pessoa">PM envolvido</th>
                <th class="col-status-prazo">Status prazo</th>
                <th class="col-acao">Ações</th>
              </tr></thead>
              <tbody>
                ${items
                  .map((p) => {
                    const encarregado = formatarQualificacaoMilitar(
                      p.responsavel_posto_graduacao,
                      p.responsavel_matricula,
                      p.responsavel_nome,
                    );
                    return `
                  <tr>
                    <td class="col-tipo">${escapeHtml(p.apuratorio_sigla)}</td>
                    <td class="col-ano">${escapeHtml(p.data_instauracao.slice(0, 4))}</td>
                    <td class="col-numero-processo" title="${escapeHtml(p.numero_controle)}">${escapeHtml(p.numero_controle)}</td>
                    <td class="col-origem" title="${escapeHtml(formatarOrigem(p.unidade_origem, p.subunidade_secao_origem))}">${escapeHtml(formatarOrigem(p.unidade_origem, p.subunidade_secao_origem))}</td>
                    <td class="col-sei" title="${escapeHtml(p.processo_sei ?? "")}">${escapeHtml(p.processo_sei ?? "—")}</td>
                    <td class="col-pessoa" title="${escapeHtml(encarregado === "—" ? "" : encarregado)}"><span class="celula-reticencias">${escapeHtml(encarregado)}</span></td>
                    <td class="col-pessoa">${resumoEnvolvidos(p.id, p.envolvidos_resumo)}</td>
                    <td class="col-status-prazo">${badgeStatusPrazo(p.concluido, p.prazo_dias_restantes)}</td>
                    <td class="col-acao"><div class="row-actions">${botaoIcone("abrir", "Abrir", { classe: "outline", dados: { processo: p.id } })}</div></td>
                  </tr>`;
                  })
                  .join("")}
              </tbody></table></div>`
          : `<p class="empty">Nenhum apuratório encontrado.</p>`
      }
      ${paginacao("processos", pagina, POR_PAGINA, total)}
    </section>
  `);

  ligarPaginacao("processos", pagina, (nova) => {
    pagina = nova;
    void renderListaProcessos(ctx);
  });
  ligarTooltipsPessoas();

  // Mudar filtro volta para a primeira página: seguir na 3ª de um resultado
  // que agora tem 1 mostraria tela vazia sem dizer por quê.
  const recarregar = () => {
    pagina = 1;
    void renderListaProcessos(ctx);
  };
  const busca = document.querySelector<HTMLInputElement>("#busca");
  busca?.addEventListener("change", () => {
    filtro.busca = busca.value.trim();
    recarregar();
  });
  document.querySelector<HTMLSelectElement>("#concluido")?.addEventListener("change", (e) => {
    const v = (e.currentTarget as HTMLSelectElement).value;
    filtro.concluido = v === "" ? null : v === "true";
    recarregar();
  });

  document.querySelector<HTMLButtonElement>("#novo")?.addEventListener("click", () => {
    void renderFormularioProcesso(ctx, null);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-processo]").forEach((botao) => {
    botao.addEventListener("click", () => void renderDetalheProcesso(ctx, botao.dataset.processo!));
  });
}

// ── detalhe ─────────────────────────────────────────────────────────────────
//
// Reúne o que antes estava espalhado: cabeçalho, envolvidos, designações com
// histórico, prazos e prorrogações, andamentos e anexos. Três diferenças em
// relação à versão anterior:
//
//   - anexos são N por processo, não um PDF inline por tabela de espécie;
//   - o histórico de designações é tabela com período, não um jsonb;
//   - cada andamento tem autor e tipo, que o modelo antigo havia perdido.

/**
 * O anexo sai pelo mesmo caminho do CSV: o diálogo nativo aberto no Rust.
 *
 * Já saiu por `<a download>` com `blob:`, e era o único ponto do sistema que
 * ainda fazia isso — no WebView do Tauri essa via não define destino, não abre
 * "salvar como" e muda de comportamento por plataforma. O conteúdo já chega em
 * base64, que é exatamente o que `files_save_download` recebe.
 */
async function baixarAnexo(anexoId: string): Promise<void> {
  const r = await call("proceedings_get_attachment", { anexoId });
  if (!r.ok || !r.data) {
    notificar(r.error ?? "Falha ao obter o anexo.", "erro");
    return;
  }
  await baixarArquivoBase64(r.data.nome_arquivo, r.data.conteudo);
}

/** Soma dias a uma data ISO sem depender do fuso horário local. */
function somarDiasIso(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1, dia! + dias));
  return data.toISOString().slice(0, 10);
}

function dataParaExibicao(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Hoje em ISO, para o `max` dos campos que não aceitam data futura. */
function hojeIso(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function menorDataIso(datas: Array<string | null | undefined>): string {
  return datas.filter((data): data is string => !!data).sort()[0] ?? "";
}

function maiorDataIso(datas: Array<string | null | undefined>): string {
  return datas.filter((data): data is string => !!data).sort().at(-1) ?? "";
}

function aplicarIntervaloData(input: HTMLInputElement | null, min: string, max: string): void {
  if (!input) return;
  if (min) input.min = min;
  else input.removeAttribute("min");
  if (max) input.max = max;
  else input.removeAttribute("max");
}

/** O ato que autorizou a designação, como a Seção o escreve. */
function documentoDaDesignacao(d: DesignacaoItem): string {
  if (!d.usa_documento_designacao) return "-";
  if (!d.documento_autorizador) return "";
  return d.numero_documento
    ? `${d.documento_autorizador} nº ${d.numero_documento}`
    : d.documento_autorizador;
}

export async function renderDetalheProcesso(ctx: ContextoTela, id: string): Promise<void> {
  // `users_list_ativos` e não um comando paginado: lista de OPÇÕES não pagina.
  // O teto de 200 de uma listagem cortaria o seletor em silêncio, que foi o
  // defeito da §8.9 — e são 235 militares no banco real.
  const [
    detalheResp,
    prazos,
    andamentos,
    tiposAndamento,
    militares,
    tiposDocumento,
    solucoesSugeridas,
    solucoesDecididas,
    penalidades,
    envolvidosComEnquadramento,
  ] =
    await Promise.all([
      call("proceedings_get", { id }),
      call("deadlines_list", { processoId: id }).then((r) => r.data ?? []),
      call("movements_list", { processoId: id }).then((r) => r.data ?? []),
      catalogo("tipos_andamento", ["nome"]),
      call("users_list_ativos", {}).then((r) => r.data ?? []),
      catalogo("tipos_documento", ["nome"]),
      catalogo("tipos_solucao_sugerida", ["nome"]),
      catalogo("tipos_solucao_decidida", ["nome"]),
      catalogo("tipos_penalidade", ["nome"]),
      call("evidence_list_for_proceeding", { processoId: id }).then((r) => r.data ?? []),
    ]);

  const d = detalheResp.data;
  if (!detalheResp.ok || !d) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(detalheResp.error ?? "Apuratório não encontrado.")}</p></section>`);
    return;
  }

  const config = await call("apuratorio_config_get", { apuratorioId: d.apuratorio_id }).then(
    (r) => r.data,
  );

  // A configuração decide quais fatos novos a espécie aceita. Um valor antigo
  // continua visível mesmo se o atributo for desligado depois: configuração
  // futura não pode apagar nem esconder fato já registrado (princípio 5).
  //
  // Serve a qualquer fato, não só data: `valor` é `unknown` porque o bloco de
  // Ofendidos/Vítimas passa uma CONTAGEM, e `!!0` já é falso. Sem isso, desligar
  // `permite_cadastro_vitima` faria sumirem do detalhe ofendidos já registrados.
  const mostrarData = (permitido: boolean | undefined, valor: unknown) =>
    permitido === true || !!valor;
  const usaRemessaComissao = config?.permite_remessa_comissao === true;
  const remessaComissao =
    d.data_remessa_comissao ?? (usaRemessaComissao ? d.data_remessa_encarregado : null);
  const mostraRemessaComissao = mostrarData(
    config?.permite_remessa_comissao,
    remessaComissao,
  );
  const mostraJulgamento = mostrarData(config?.permite_julgamento, d.data_julgamento);
  const permiteAcusacao = config?.permite_acusacao === true;
  const permiteIndicios = config?.permite_indicios === true;
  const permiteSolucaoSugerida = config?.permite_solucao_sugerida === true;
  const enquadramentoPorEnvolvido = new Map(
    envolvidosComEnquadramento.map((item) => [item.envolvido_id, item.indicios]),
  );
  const resumoAcusacoes = (envolvidoId: string) => {
    const dados = enquadramentoPorEnvolvido.get(envolvidoId);
    const itens = [
      ...(dados?.infracoes_penais ?? []).map(
        (item) => `${item.rotulo} — esfera ${item.esfera_penal}`,
      ),
      ...(dados?.transgressoes ?? []).map((item) => item.rotulo),
      ...(dados?.infracoes_estatuto ?? []).map(
        (item) => `${item.rotulo} — analogia: ${item.analogia_rotulo}`,
      ),
    ];
    return itens.length
      ? `<ul class="acusacoes-resumo">${itens.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : `<span class="empty">Nenhuma acusação registrada.</span>`;
  };

  const campoDataPosterior = (
    nome: string,
    rotulo: string,
    valor: string | null,
    ajuda?: string,
  ) => `<div class="campo campo-data-posterior">
          <label for="detalhe-${escapeHtml(nome)}">${escapeHtml(rotulo)}</label>
          <div class="campo-data-controle">
            <input id="detalhe-${escapeHtml(nome)}" name="${escapeHtml(nome)}" type="date"
              min="${escapeHtml(d.data_instauracao)}" max="${escapeHtml(hojeIso())}"
              value="${escapeHtml(valor ?? "")}" />
            <button type="button" class="ghost small campo-data-limpar"
              data-limpar-data-detalhe="${escapeHtml(nome)}"${valor ? "" : " disabled"}>Limpar</button>
          </div>
          ${ajuda ? `<small class="campo-efeito">${escapeHtml(ajuda)}</small>` : ""}
        </div>`;

  const podeEscrever = ctx.podeEscrever();
  const mostraAcoesEnvolvido = podeEscrever || permiteIndicios;
  const prazoVigente = prazos.find((prazo) => prazo.vigente) ?? null;
  const ultimaProrrogacao = prazos.find((prazo) => prazo.vigente && prazo.ordem > 0) ?? null;
  const linha = (rotulo: string, valor: unknown) =>
    valor === null || valor === undefined || valor === ""
      ? ""
      : `<tr><th>${escapeHtml(rotulo)}</th><td>${escapeHtml(String(valor))}</td></tr>`;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(d.rotulo)}</h1>
          <p>${escapeHtml(d.apuratorio_nome)} — ${d.concluido ? "concluído" : "em andamento"}</p>
        </div>
        <div class="actions">
          <button class="secondary" id="voltar">Voltar</button>
          ${podeEscrever ? `<button id="editar">Editar</button>` : ""}
          ${podeEscrever && d.concluido ? `<button class="secondary" id="reabrir">Reabrir</button>` : ""}
        </div>
      </div>

      <table class="ficha">
        ${linha("Documento iniciador", d.documento_iniciador)}
        ${linha("Nº do documento", d.numero_documento)}
        ${linha("Nº de controle", d.numero_controle)}
        ${linha("Processo SEI", d.processo_sei)}
        ${linha("Nº RGF", d.numero_rgf)}
        ${linha("Unidade de origem", d.unidade_origem)}
        ${linha("Subunidade/Seção de origem", d.subunidade_secao_origem)}
        ${linha("Município do fato", d.municipio_fato)}
        ${linha("Natureza geral do fato", d.natureza_fato)}
        ${linha("Instauração", d.data_instauracao)}
        ${linha("Recebimento", d.data_recebimento)}
        ${usaRemessaComissao ? "" : linha("Remessa do encarregado", d.data_remessa_encarregado)}
        ${linha("Remessa da comissão", usaRemessaComissao ? remessaComissao : d.data_remessa_comissao)}
        ${linha("Julgamento", d.data_julgamento)}
        ${linha("Conclusão", d.data_conclusao)}
        ${linha(
          "Responsável",
          d.responsavel_nome
            ? `${formatarQualificacaoMilitar(
                d.responsavel_posto_graduacao,
                d.responsavel_matricula,
                d.responsavel_nome,
              )} (${d.responsavel_papel})`
            : null,
        )}
        ${d.carta_precatoria ? linha("Deprecante", d.carta_precatoria.deprecante) : ""}
        ${d.carta_precatoria ? linha("Unidade deprecada", d.carta_precatoria.unidade_deprecada) : ""}
      </table>

      ${
        podeEscrever && d.concluido
          ? `<p class="aviso">Este apuratório está concluído. Para registrar substituições, prorrogações ou novos andamentos, use <strong>Reabrir</strong>.</p>`
          : ""
      }

      ${
        podeEscrever
          ? `<h2>Datas posteriores ao cadastro</h2>
             <form id="form-datas-processo" class="linha-form linha-form--datas">
               ${
                 usaRemessaComissao
                   ? ""
                   : campoDataPosterior(
                       "data_remessa_encarregado",
                       "Remessa do encarregado",
                       d.data_remessa_encarregado,
                     )
               }
               ${
                 mostraRemessaComissao
                   ? campoDataPosterior(
                       "data_remessa_comissao",
                       "Remessa da comissão",
                       remessaComissao,
                       config?.permite_remessa_comissao === false
                         ? "O campo permanece disponível porque já há uma data registrada."
                         : undefined,
                     )
                   : ""
               }
               ${
                 mostraJulgamento
                   ? campoDataPosterior(
                       "data_julgamento",
                       "Julgamento",
                       d.data_julgamento,
                       config?.permite_julgamento === false
                         ? "O campo permanece disponível porque já há uma data registrada."
                         : undefined,
                     )
                   : ""
               }
               <label>Conclusão
                 <input name="data_conclusao" type="date"
                   min="${escapeHtml(d.data_instauracao)}" max="${escapeHtml(hojeIso())}"
                   value="${escapeHtml(d.data_conclusao ?? "")}"${d.data_conclusao ? " required" : ""} />
               </label>
               <button type="submit">Salvar datas</button>
             </form>
             <p class="secao-ajuda">Remessas e julgamento podem ser corrigidos ou removidos. Para remover uma conclusão já registrada, use <strong>Reabrir</strong>.</p>`
          : ""
      }

      <h2>Envolvidos</h2>
      ${
        d.envolvidos.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--envolvidos">
              <thead><tr><th>#</th><th>Militar</th><th>Situação</th><th>Condutor</th>
                ${permiteAcusacao ? "<th>Acusações</th>" : ""}
                ${permiteSolucaoSugerida ? "<th>Sugerida</th>" : ""}<th>Decidida</th><th>Penalidade</th>${mostraAcoesEnvolvido ? "<th>Ações</th>" : ""}</tr></thead>
              <tbody>${d.envolvidos
                .map(
                  (e) => `<tr>
                    <td>${e.ordem}</td>
                    <td>${escapeHtml(formatarQualificacaoMilitar(e.posto_graduacao, e.matricula, e.nome))}</td>
                    <td>${escapeHtml(e.status_envolvido)}</td>
                    <td>${e.e_condutor ? "sim" : ""}</td>
                    ${permiteAcusacao ? `<td class="celula-acusacoes">${resumoAcusacoes(e.id)}</td>` : ""}
                    ${permiteSolucaoSugerida ? `<td>${escapeHtml(e.solucao_sugerida ?? "")}</td>` : ""}
                    <td>${escapeHtml(e.solucao_decidida ?? "")}</td>
                    <td>${escapeHtml(e.penalidade_tipo ?? "")}${e.penalidade_dias ? ` — ${e.penalidade_dias} dias` : ""}</td>
                    ${
                      mostraAcoesEnvolvido
                        ? `<td class="row-actions">
                      ${
                        podeEscrever
                          ? botaoIcone("editar", "Editar resultado", {
                              classe: "secondary",
                              dados: { "editar-resultado": e.id },
                            })
                          : ""
                      }
                      ${
                        permiteIndicios
                          ? botaoIcone("abrir", "Ver indícios", {
                              classe: "secondary",
                              dados: { indicios: e.id },
                            })
                          : ""
                      }
                    </td>`
                        : ""
                    }
                  </tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Nenhum envolvido.</p>`
      }
      ${
        podeEscrever && d.envolvidos.length
          ? `<form id="form-resultado-envolvido" class="linha-form linha-form--bloco" hidden>
               <p id="resumo-resultado" class="secao-ajuda linha-form__resumo"></p>
               ${
                 permiteSolucaoSugerida
                   ? `<label>Solução sugerida
                        ${selectOpcoes("solucao_sugerida_id", solucoesSugeridas, "")}
                      </label>`
                   : ""
               }
               <label>Solução decidida
                 ${selectOpcoes("solucao_decidida_id", solucoesDecididas, "")}
               </label>
               <label id="campo-penalidade" hidden>Penalidade
                 ${selectOpcoes("penalidade_tipo_id", penalidades, "")}
               </label>
               <label id="campo-penalidade-dias" hidden>Dias
                 <input name="penalidade_dias" type="number" min="1" />
               </label>
               <button type="submit">Salvar resultado</button>
               <button type="button" class="secondary" id="cancelar-resultado">Cancelar</button>
             </form>`
          : ""
      }

      ${
        /*
         * Ofendidos/Vítimas. Somente leitura: o cadastro é do formulário, e um
         * segundo caminho de escrita para a mesma coisa seria duas fontes para
         * o mesmo fato.
         *
         * A coluna `#` é a `ordem` do próprio dado — `uq_vitima_ordem` a faz
         * única POR PROCESSO, então a numeração não se repete.
         */
        mostrarData(config?.permite_cadastro_vitima, d.vitimas.length)
          ? `<h2>Ofendidos/Vítimas</h2>
      ${
        d.vitimas.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo">
              <thead><tr><th>#</th><th>Nome</th></tr></thead>
              <tbody>${d.vitimas
                .map(
                  (v) => `<tr><td>${v.ordem}</td><td>${escapeHtml(v.nome)}</td></tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Nenhum ofendido/vítima registrado.</p>`
      }`
          : ""
      }

      ${
        /*
         * Pessoas inquiridas. Diferente do bloco acima, aparece só quando HÁ
         * linha: nenhum atributo de apuratório a governa, e um cabeçalho vazio
         * em cada uma das dez espécies seria ruído — são 3 registros em todo o
         * dump legado.
         *
         * Sem coluna `#`: aqui a `ordem` é única por (processo, PAPEL), então
         * uma coluna de número recomeçaria em 1 a cada papel e pareceria
         * defeito. `list_pessoas` já devolve ordenado por papel e ordem.
         */
        d.pessoas.length
          ? `<h2>Pessoas inquiridas</h2>
      <div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo">
        <thead><tr><th>Papel</th><th>Nome</th></tr></thead>
        <tbody>${d.pessoas
          .map(
            (p) =>
              `<tr><td>${escapeHtml(p.papel_pessoa)}</td><td>${escapeHtml(p.nome)}</td></tr>`,
          )
          .join("")}</tbody></table></div>`
          : ""
      }

      <h2>Designações</h2>
      ${
        d.designacoes.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--designacoes">
              <thead><tr><th>Função</th><th>Militar</th><th>Início</th><th>Fim</th><th>Documento</th><th>Motivo</th>${podeEscrever ? "<th>Ações</th>" : ""}</tr></thead>
              <tbody>${d.designacoes
                .map(
                  (x) => `<tr${x.data_fim ? ' class="inativo"' : ""}>
                    <td>${escapeHtml(x.papel)}${x.e_responsavel ? " (responsável)" : ""}</td>
                    <td>${escapeHtml(qualificacaoDesignado(x))}</td>
                    <td>${escapeHtml(dataParaExibicao(x.data_inicio))}</td>
                    <td>${escapeHtml(x.data_fim ? dataParaExibicao(x.data_fim) : "vigente")}</td>
                    <td>${escapeHtml(documentoDaDesignacao(x))}</td>
                    <td>${escapeHtml(x.motivo ?? "")}</td>
                    ${
                      podeEscrever
                        ? `<td class="row-actions">${
                            x.data_fim
                              ? ""
                              : `${
                                  d.concluido
                                    ? ""
                                    : botaoIcone("substituir", `Substituir ${x.papel}`, {
                                  classe: "secondary",
                                  dados: { substituir: x.id },
                                      })
                                }
                                 ${
                                   // Só a ponta da cadeia se corrige e se desfaz.
                                   // Uma designação vigente COM antecessora é,
                                   // por definição, a última da sua cadeia —
                                   // nada a sucedeu, senão teria `data_fim`.
                                   x.designacao_anterior_id
                                     ? `${botaoIcone("editar", "Editar esta substituição", {
                                         classe: "secondary",
                                         dados: { "editar-substituicao": x.id },
                                       })}
                                        ${botaoIcone("excluir", "Desfazer esta substituição", {
                                          classe: "danger",
                                          dados: { "remover-substituicao": x.id },
                                        })}`
                                     : ""
                                 }`
                          }</td>`
                        : ""
                    }
                  </tr>`,
                )
                .join("")}</tbody></table></div>
             <p class="secao-ajuda">O fim é exclusivo: é o dia em que o sucessor assume, sem sobreposição nem lacuna. Só a substituição mais recente de cada função pode ser corrigida ou desfeita.</p>`
          : `<p class="empty">Nenhuma designação.</p>`
      }
      ${
        podeEscrever
          ? `<form id="form-substituicao" class="linha-form linha-form--bloco" hidden>
               <p id="resumo-substituicao" class="secao-ajuda linha-form__resumo"></p>
               <label>Sucessor
                 ${selectMilitares("sucessor_id", militares, "")}
                 <small class="campo-erro" data-erro="sucessor_id" hidden></small>
               </label>
               <label>Data da substituição
                 <input name="data_troca" type="date" max="${escapeHtml(hojeIso())}" required />
                 <small class="campo-erro" data-erro="data_troca" hidden></small>
               </label>
               <label>Motivo
                 <input name="motivo" required />
                 <small class="campo-erro" data-erro="motivo" hidden></small>
               </label>
               <label id="campo-documento-substituicao">Documento autorizador
                 ${selectOpcoes("documento_autorizador_id", tiposDocumento, "")}
                 <small class="campo-erro" data-erro="documento_autorizador_id" hidden></small>
               </label>
               <label id="campo-numero-documento-substituicao">Nº do documento
                 <input name="numero_documento" />
                 <small class="campo-erro" data-erro="numero_documento" hidden></small>
               </label>
               <button type="submit" id="salvar-substituicao">Substituir</button>
               <button type="button" class="secondary" id="cancelar-substituicao">Cancelar</button>
             </form>`
          : ""
      }

      <h2>Prazos</h2>
      ${
        prazos.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--prazos">
              <thead><tr><th>Ordem</th><th>Início</th><th>Dias</th><th>Vencimento</th><th>Motivo</th>${podeEscrever ? "<th>Ações</th>" : ""}</tr></thead>
              <tbody>${prazos
                .map(
                  (p) => `<tr${p.vigente ? ' class="vigente"' : ""}>
                    <td>${p.ordem === 0 ? "inicial" : `${p.ordem}ª prorrogação`}</td>
                    <td>${escapeHtml(p.data_inicio)}</td>
                    <td>${p.dias}</td>
                    <td>${escapeHtml(p.data_vencimento)}</td>
                    <td>${escapeHtml(p.ordem === 0 ? "Prazo inicial" : (p.motivo ?? ""))}</td>
                    ${
                      podeEscrever
                        ? `<td class="row-actions">${
                            p.vigente && p.ordem > 0
                              ? `${botaoIcone("editar", "Editar data", {
                                  classe: "secondary",
                                  dados: { "editar-prorrogacao": p.id },
                                })}
                                 ${botaoIcone("excluir", "Excluir", {
                                   classe: "danger",
                                   dados: { "excluir-prorrogacao": p.id },
                                 })}`
                              : ""
                          }</td>`
                        : ""
                    }
                  </tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Sem prazo. O prazo inicial nasce da data de recebimento.</p>`
      }
      ${
        podeEscrever && !d.concluido && prazoVigente
          ? `<form id="form-prorrogacao" class="linha-form">
               <label>Novo vencimento<input name="nova_data_vencimento" type="date" min="${somarDiasIso(prazoVigente.data_vencimento, 1)}" required /></label>
               <label>Motivo<input name="motivo" required /></label>
               <button type="submit">Prorrogar</button>
             </form>
             <p class="secao-ajuda">Vencimento atual: <strong>${escapeHtml(dataParaExibicao(prazoVigente.data_vencimento))}</strong>. A nova data deve ser posterior; a prorrogação começa no vencimento atual.</p>`
          : ""
      }
      ${
        podeEscrever && ultimaProrrogacao
          ? `<form id="form-editar-prorrogacao" class="linha-form" hidden>
               <label>Corrigir vencimento
                 <input name="nova_data_vencimento" type="date"
                   min="${somarDiasIso(ultimaProrrogacao.data_inicio, 1)}"
                   value="${escapeHtml(ultimaProrrogacao.data_vencimento)}" required />
               </label>
               <button type="submit">Salvar alteração</button>
               <button type="button" class="secondary" id="cancelar-edicao-prorrogacao">Cancelar</button>
             </form>
             <p id="ajuda-edicao-prorrogacao" class="secao-ajuda" hidden>A data deve ser posterior ao prazo anterior, vencido em <strong>${escapeHtml(dataParaExibicao(ultimaProrrogacao.data_inicio))}</strong>. O motivo da prorrogação será preservado.</p>`
          : ""
      }

      <h2>Andamentos</h2>
      ${
        andamentos.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--andamentos">
              <thead><tr><th>Data</th><th>Tipo</th><th>Registrado por</th><th>Descrição</th>${podeEscrever ? "<th>Ações</th>" : ""}</tr></thead>
              <tbody>${andamentos
                .map(
                  (a) => `<tr>
                  <td>${escapeHtml(a.ocorrido_em.slice(0, 10))}</td>
                  <td>${escapeHtml(a.tipo_andamento ?? "")}</td>
                  <td>${escapeHtml(a.registrado_por ?? "")}</td>
                  <td class="col-descricao">${escapeHtml(a.descricao)}</td>
                  ${
                    podeEscrever
                      ? `<td class="row-actions">
                          ${botaoIcone("editar", "Editar", {
                            classe: "secondary",
                            dados: { "editar-andamento": a.id },
                          })}
                          ${botaoIcone("excluir", "Remover", {
                            classe: "danger",
                            dados: { "remover-andamento": a.id },
                          })}
                        </td>`
                      : ""
                  }
                </tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Nenhum andamento.</p>`
      }
      ${
        podeEscrever
          ? `<form id="form-andamento" class="linha-form"${d.concluido ? " hidden" : ""}>
               <label>Tipo<select name="tipo_andamento_id">
                 <option value=""></option>
                 ${tiposAndamento.map((t) => option(t.id, t.rotulo, false)).join("")}
               </select></label>
               <label>Descrição<input name="descricao" required /></label>
               <button type="submit" id="salvar-andamento">Registrar</button>
               <button type="button" class="secondary" id="cancelar-edicao-andamento" hidden>Cancelar</button>
             </form>`
          : ""
      }

      <h2>Anexos</h2>
      ${
        d.anexos.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--anexos">
              <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Enviado por</th><th>Ações</th></tr></thead>
              <tbody>${d.anexos
                .map(
                  (a) => `<tr>
                    <td>${escapeHtml(a.nome_arquivo)}</td>
                    <td>${(a.tamanho_bytes / 1024).toFixed(1)} KB</td>
                    <td>${escapeHtml(a.enviado_por ?? "")}</td>
                    <td class="row-actions">
                      ${botaoIcone("baixar", "Baixar", { classe: "secondary", dados: { baixar: a.id } })}
                      ${
                        podeEscrever
                          ? botaoIcone("excluir", "Remover", {
                              classe: "danger",
                              dados: { "remover-anexo": a.id },
                            })
                          : ""
                      }
                    </td>
                  </tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Nenhum anexo.</p>`
      }
      ${podeEscrever ? `<div class="linha-form"><label>Anexar arquivo<input type="file" id="anexo" /></label></div>` : ""}

      ${/*
         * Última seção da página, e em largura inteira de propósito: era a
         * derradeira linha da `.ficha`, espremida ao lado de um rótulo de 220px
         * e com as quebras de linha comidas por falta de `white-space`. O campo
         * é um `textarea`, então o operador escreve em parágrafos — `.texto-livre`
         * os preserva.
         */ ""}
      <h2>Resumo dos fatos</h2>
      ${
        d.resumo_fatos
          ? `<p class="texto-livre">${escapeHtml(d.resumo_fatos)}</p>`
          : `<p class="empty">Nenhum resumo registrado.</p>`
      }
    </section>
  `);

  const recarregar = () => void renderDetalheProcesso(ctx, id);
  const reportar = (ok: boolean, erro: string | null) => {
    if (!ok) notificar(erro ?? "Falha na operação.", "erro");
    recarregar();
  };

  document.querySelector("#voltar")?.addEventListener("click", () => void renderListaProcessos(ctx));
  document.querySelector("#editar")?.addEventListener("click", () => void renderFormularioProcesso(ctx, id));
  document.querySelector("#reabrir")?.addEventListener("click", async () => {
    if (!confirm("Reabrir este apuratório?")) return;
    const r = await call("proceedings_reopen", { id });
    reportar(r.ok, r.error);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-baixar]").forEach((b) =>
    b.addEventListener("click", () => void baixarAnexo(b.dataset.baixar!)),
  );

  // O enquadramento é por envolvido, não pelo processo: cada PM tem as suas
  // categorias, infrações penais, transgressões e infrações do Estatuto.
  document.querySelectorAll<HTMLButtonElement>("[data-indicios]").forEach((b) =>
    b.addEventListener("click", () =>
      void renderIndicios(ctx, b.dataset.indicios!, () => void renderDetalheProcesso(ctx, id)),
    ),
  );

  if (!podeEscrever) return;

  const formDatas = document.querySelector<HTMLFormElement>("#form-datas-processo");
  const atualizarLimitesDatasPosteriores = () => {
    if (!formDatas) return;
    const input = (nome: string) =>
      formDatas.elements.namedItem(nome) instanceof HTMLInputElement
        ? (formDatas.elements.namedItem(nome) as HTMLInputElement)
        : null;
    const remessaEncarregado = input("data_remessa_encarregado");
    const remessaComissaoInput = input("data_remessa_comissao");
    const julgamento = input("data_julgamento");
    const conclusao = input("data_conclusao");
    const valor = (campo: HTMLInputElement | null, gravado: string | null) =>
      campo ? campo.value || null : gravado;
    const recebimento = d.data_recebimento;
    const valorRemessaEncarregado = valor(remessaEncarregado, d.data_remessa_encarregado);
    const valorRemessaComissao = valor(remessaComissaoInput, d.data_remessa_comissao);
    const valorJulgamento = valor(julgamento, d.data_julgamento);
    const valorConclusao = valor(conclusao, d.data_conclusao);
    const antesDaRemessa = maiorDataIso([d.data_instauracao, recebimento]);
    const depoisDaRemessa = menorDataIso([hojeIso(), valorJulgamento, valorConclusao]);

    aplicarIntervaloData(remessaEncarregado, antesDaRemessa, depoisDaRemessa);
    aplicarIntervaloData(remessaComissaoInput, antesDaRemessa, depoisDaRemessa);
    aplicarIntervaloData(
      julgamento,
      maiorDataIso([
        d.data_instauracao,
        recebimento,
        valorRemessaEncarregado,
        valorRemessaComissao,
      ]),
      menorDataIso([hojeIso(), valorConclusao]),
    );
    aplicarIntervaloData(
      conclusao,
      maiorDataIso([
        d.data_instauracao,
        recebimento,
        valorRemessaEncarregado,
        valorRemessaComissao,
        valorJulgamento,
      ]),
      hojeIso(),
    );
  };
  atualizarLimitesDatasPosteriores();
  formDatas?.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
    input.addEventListener("change", () => {
      atualizarLimitesDatasPosteriores();
      const limpar = formDatas.querySelector<HTMLButtonElement>(
        `[data-limpar-data-detalhe="${input.name}"]`,
      );
      if (limpar) limpar.disabled = input.value === "";
      window.requestAnimationFrame(() => input.blur());
    });
  });
  formDatas?.querySelectorAll<HTMLButtonElement>("[data-limpar-data-detalhe]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const nome = botao.dataset.limparDataDetalhe;
      if (!nome || !formDatas) return;
      const input = formDatas.elements.namedItem(nome);
      if (!(input instanceof HTMLInputElement)) return;
      input.value = "";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  formDatas?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(formDatas);
    const data = (nome: string) => String(dados.get(nome) ?? "") || null;
    const r = await call("proceedings_update_dates", {
      request: {
        processo_id: id,
        data_remessa_encarregado: usaRemessaComissao
          ? null
          : data("data_remessa_encarregado"),
        data_remessa_comissao: mostraRemessaComissao
          ? data("data_remessa_comissao")
          : d.data_remessa_comissao,
        data_julgamento: mostraJulgamento ? data("data_julgamento") : d.data_julgamento,
        data_conclusao: data("data_conclusao"),
      },
    });
    if (r.ok) notificar("Datas atualizadas.", "sucesso");
    reportar(r.ok, r.error);
  });

  // ── Resultado do envolvido ───────────────────────────────────────────────
  const formResultado = document.querySelector<HTMLFormElement>("#form-resultado-envolvido");
  const resumoResultado = document.querySelector<HTMLElement>("#resumo-resultado");
  const campoPenalidade = document.querySelector<HTMLElement>("#campo-penalidade");
  const campoDias = document.querySelector<HTMLElement>("#campo-penalidade-dias");
  const envolvidosPorId = new Map(d.envolvidos.map((envolvido) => [envolvido.id, envolvido]));
  let resultadoEmEdicao = null as (typeof d.envolvidos)[number] | null;

  const selectResultado = (nome: string) =>
    formResultado?.querySelector<HTMLSelectElement>(`select[name="${nome}"]`) ?? null;
  const inputDias = () =>
    formResultado?.querySelector<HTMLInputElement>('input[name="penalidade_dias"]') ?? null;
  const limparOpcoesHistoricasResultado = () => {
    formResultado
      ?.querySelectorAll<HTMLOptionElement>("option[data-resultado-historico]")
      .forEach((opcao) => opcao.remove());
  };
  const garantirOpcaoHistorica = (
    nome: string,
    valor: string | null,
    rotulo: string | null,
  ) => {
    if (!valor) return;
    const select = selectResultado(nome);
    if (!select || Array.from(select.options).some((opcao) => opcao.value === valor)) return;
    const historica = document.createElement("option");
    historica.value = valor;
    historica.textContent = `${rotulo ?? "Opção"} (desativada)`;
    historica.dataset.resultadoHistorico = "true";
    select.append(historica);
  };

  const atualizarCamposPenalidade = () => {
    const decididaId = selectResultado("solucao_decidida_id")?.value ?? "";
    const decisaoHistoricaPermitia =
      resultadoEmEdicao?.solucao_decidida_id === decididaId &&
      resultadoEmEdicao.penalidade_tipo_id !== null;
    const permitePena =
      config?.permite_punicao === true &&
      (solucoesDecididas.find((item) => item.id === decididaId)?.extra?.permite_penalidade === true ||
        decisaoHistoricaPermitia);
    if (campoPenalidade) campoPenalidade.hidden = !permitePena;
    const selectPena = selectResultado("penalidade_tipo_id");
    if (!permitePena && selectPena) selectPena.value = "";

    const penalidadeId = selectPena?.value ?? "";
    const penalidadeHistoricaUsavaDias =
      resultadoEmEdicao?.penalidade_tipo_id === penalidadeId &&
      resultadoEmEdicao.penalidade_dias !== null;
    const usaQuantidade =
      permitePena &&
      (penalidades.find((item) => item.id === penalidadeId)?.extra?.usa_quantidade_dias === true ||
        penalidadeHistoricaUsavaDias);
    if (campoDias) campoDias.hidden = !usaQuantidade;
    if (!usaQuantidade && inputDias()) inputDias()!.value = "";
  };

  const fecharResultado = () => {
    resultadoEmEdicao = null;
    formResultado?.reset();
    limparOpcoesHistoricasResultado();
    if (formResultado) formResultado.hidden = true;
  };

  document.querySelectorAll<HTMLButtonElement>("[data-editar-resultado]").forEach((botao) =>
    botao.addEventListener("click", () => {
      const envolvido = envolvidosPorId.get(botao.dataset.editarResultado!);
      if (!envolvido || !formResultado) return;
      resultadoEmEdicao = envolvido;
      limparOpcoesHistoricasResultado();
      if (permiteSolucaoSugerida) {
        garantirOpcaoHistorica(
          "solucao_sugerida_id",
          envolvido.solucao_sugerida_id,
          envolvido.solucao_sugerida,
        );
      }
      garantirOpcaoHistorica(
        "solucao_decidida_id",
        envolvido.solucao_decidida_id,
        envolvido.solucao_decidida,
      );
      garantirOpcaoHistorica(
        "penalidade_tipo_id",
        envolvido.penalidade_tipo_id,
        envolvido.penalidade_tipo,
      );
      const sugerida = selectResultado("solucao_sugerida_id");
      if (sugerida) sugerida.value = envolvido.solucao_sugerida_id ?? "";
      selectResultado("solucao_decidida_id")!.value = envolvido.solucao_decidida_id ?? "";
      selectResultado("penalidade_tipo_id")!.value = envolvido.penalidade_tipo_id ?? "";
      inputDias()!.value = envolvido.penalidade_dias?.toString() ?? "";
      if (resumoResultado) {
        resumoResultado.textContent =
          `Editando o resultado de ${formatarQualificacaoMilitar(envolvido.posto_graduacao, envolvido.matricula, envolvido.nome)}.`;
      }
      formResultado.hidden = false;
      atualizarCamposPenalidade();
      formResultado.scrollIntoView({ block: "nearest" });
      (selectResultado("solucao_sugerida_id") ?? selectResultado("solucao_decidida_id"))?.focus();
    }),
  );

  selectResultado("solucao_decidida_id")?.addEventListener("change", atualizarCamposPenalidade);
  selectResultado("penalidade_tipo_id")?.addEventListener("change", atualizarCamposPenalidade);
  document.querySelector("#cancelar-resultado")?.addEventListener("click", fecharResultado);
  formResultado?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!resultadoEmEdicao) return;
    const penalidadeVisivel = campoPenalidade?.hidden === false;
    const diasVisiveis = campoDias?.hidden === false;
    const r = await call("proceedings_update_involved_outcome", {
      request: {
        processo_id: id,
        envolvido_id: resultadoEmEdicao.id,
        solucao_sugerida_id: permiteSolucaoSugerida
          ? selectResultado("solucao_sugerida_id")?.value || null
          : null,
        solucao_decidida_id: selectResultado("solucao_decidida_id")?.value || null,
        penalidade_tipo_id: penalidadeVisivel
          ? selectResultado("penalidade_tipo_id")?.value || null
          : null,
        penalidade_dias: diasVisiveis ? Number(inputDias()?.value) || null : null,
      },
    });
    if (r.ok) notificar("Resultado do envolvido atualizado.", "sucesso");
    reportar(r.ok, r.error);
  });

  // ── Substituição de designação ────────────────────────────────────────────
  //
  // Um formulário só, em dois modos. Substituir e corrigir pedem exatamente os
  // mesmos cinco campos e diferem apenas no alvo e no comando — dois
  // formulários seriam a mesma marcação duas vezes, com duas chances de
  // divergir.
  const formSubstituicao = document.querySelector<HTMLFormElement>("#form-substituicao");
  const resumoSubstituicao = document.querySelector<HTMLElement>("#resumo-substituicao");
  const botaoSalvarSubstituicao =
    document.querySelector<HTMLButtonElement>("#salvar-substituicao");
  const campoDocumentoSubstituicao = document.querySelector<HTMLElement>(
    "#campo-documento-substituicao",
  );
  const campoNumeroDocumentoSubstituicao = document.querySelector<HTMLElement>(
    "#campo-numero-documento-substituicao",
  );
  const porId = new Map(d.designacoes.map((x) => [x.id, x]));
  let alvo: { designacao: DesignacaoItem; modo: "criar" | "editar" } | null = null;

  const campo = (nome: string) =>
    formSubstituicao?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${nome}"]`) ??
    null;

  const limparErros = () => {
    formSubstituicao?.querySelectorAll<HTMLElement>(".campo-erro").forEach((e) => {
      e.hidden = true;
      e.textContent = "";
    });
  };

  /** Marca o campo, mostra o motivo e leva o foco para o primeiro que falhou. */
  const marcarErro = (nome: string, mensagem: string) => {
    const aviso = formSubstituicao?.querySelector<HTMLElement>(`[data-erro="${nome}"]`);
    if (aviso) {
      aviso.textContent = mensagem;
      aviso.hidden = false;
    }
    campo(nome)?.focus();
  };

  const fecharSubstituicao = () => {
    alvo = null;
    limparErros();
    if (formSubstituicao) formSubstituicao.hidden = true;
  };

  /**
   * Abre o formulário sobre uma designação.
   *
   * Em "criar", os campos nascem vazios: a substituição é um ato novo, com
   * motivo e documento próprios. Em "editar", nascem com o que está gravado —
   * corrigir é ajustar o que já foi registrado, não redigitar.
   */
  const abrirSubstituicao = (designacao: DesignacaoItem, modo: "criar" | "editar") => {
    if (!formSubstituicao) return;
    alvo = { designacao, modo };
    limparErros();
    formSubstituicao.hidden = false;

    const editando = modo === "editar";
    // Em "editar" o alvo é a sucessora, mas quem define o piso da data é a
    // ANTECESSORA: a troca precisa ser posterior ao dia em que ela assumiu.
    const antecessora = editando
      ? (porId.get(designacao.designacao_anterior_id ?? "") ?? designacao)
      : designacao;

    if (resumoSubstituicao) {
      resumoSubstituicao.innerHTML = editando
        ? `Corrigindo a substituição de <strong>${escapeHtml(antecessora.papel)}</strong>: ` +
          `${escapeHtml(qualificacaoDesignado(antecessora))} saiu em ` +
          `<strong>${escapeHtml(dataParaExibicao(designacao.data_inicio))}</strong>.`
        : `Substituindo <strong>${escapeHtml(qualificacaoDesignado(designacao))}</strong> ` +
          `na função de <strong>${escapeHtml(designacao.papel)}</strong>, ` +
          `ocupada desde ${escapeHtml(dataParaExibicao(designacao.data_inicio))}.`;
    }

    // `min` é o dia seguinte ao início da antecessora: a troca tem de ser
    // posterior, e o backend recusa o contrário com a mesma conta.
    const data = campo("data_troca") as HTMLInputElement | null;
    if (data) {
      data.min = somarDiasIso(antecessora.data_inicio, 1);
      data.value = editando ? designacao.data_inicio : "";
    }
    const preencher = (nome: string, valor: string) => {
      const alvo = campo(nome);
      if (alvo) alvo.value = valor;
    };
    preencher("sucessor_id", editando ? designacao.policial_militar_id : "");
    preencher("motivo", editando ? (designacao.motivo ?? "") : "");
    const usaDocumento = designacao.usa_documento_designacao;
    if (campoDocumentoSubstituicao) campoDocumentoSubstituicao.hidden = !usaDocumento;
    if (campoNumeroDocumentoSubstituicao) campoNumeroDocumentoSubstituicao.hidden = !usaDocumento;
    preencher(
      "documento_autorizador_id",
      usaDocumento && editando ? (designacao.documento_autorizador_id ?? "") : "",
    );
    preencher(
      "numero_documento",
      usaDocumento && editando ? (designacao.numero_documento ?? "") : "",
    );
    if (botaoSalvarSubstituicao) {
      botaoSalvarSubstituicao.textContent = editando ? "Salvar correção" : "Substituir";
    }
    formSubstituicao.scrollIntoView({ block: "nearest" });
    campo("sucessor_id")?.focus();
  };

  document.querySelectorAll<HTMLButtonElement>("[data-substituir]").forEach((b) =>
    b.addEventListener("click", () => {
      const designacao = porId.get(b.dataset.substituir!);
      if (designacao) abrirSubstituicao(designacao, "criar");
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-editar-substituicao]").forEach((b) =>
    b.addEventListener("click", () => {
      const designacao = porId.get(b.dataset.editarSubstituicao!);
      if (designacao) abrirSubstituicao(designacao, "editar");
    }),
  );
  document.querySelector("#cancelar-substituicao")?.addEventListener("click", fecharSubstituicao);

  formSubstituicao?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!alvo) return;
    limparErros();

    const sucessor = String(campo("sucessor_id")?.value ?? "");
    const dataTroca = String(campo("data_troca")?.value ?? "");
    const motivo = String(campo("motivo")?.value ?? "").trim();
    const documento = String(campo("documento_autorizador_id")?.value ?? "");
    const numero = String(campo("numero_documento")?.value ?? "").trim();

    // As mesmas regras que o backend reverifica, adiantadas para junto do
    // campo. Aqui elas dizem ONDE corrigir; lá elas garantem que valem.
    const antecessora =
      alvo.modo === "editar"
        ? (porId.get(alvo.designacao.designacao_anterior_id ?? "") ?? alvo.designacao)
        : alvo.designacao;

    if (!sucessor) return marcarErro("sucessor_id", "Escolha quem assume a função.");
    if (sucessor === antecessora.policial_militar_id) {
      return marcarErro(
        "sucessor_id",
        `${qualificacaoDesignado(antecessora)} já ocupa a função. Escolha outro militar.`,
      );
    }
    if (!dataTroca) return marcarErro("data_troca", "Informe a data da substituição.");
    if (dataTroca <= antecessora.data_inicio) {
      return marcarErro(
        "data_troca",
        `A data deve ser posterior a ${dataParaExibicao(antecessora.data_inicio)}.`,
      );
    }
    if (dataTroca > hojeIso()) {
      return marcarErro("data_troca", "A data da substituição não pode ser futura.");
    }
    if (!motivo) return marcarErro("motivo", "Informe o motivo da substituição.");
    if (documento && !numero) {
      return marcarErro("numero_documento", "Informe o número do documento.");
    }
    if (!documento && numero) {
      return marcarErro("documento_autorizador_id", "Escolha o tipo de documento.");
    }

    const pedido = {
      processo_id: id,
      designacao_id: alvo.designacao.id,
      sucessor_id: sucessor,
      data_troca: dataTroca,
      motivo,
      documento_autorizador_id: documento || null,
      numero_documento: numero || null,
    };
    const r =
      alvo.modo === "editar"
        ? await call("proceedings_update_substitution", {
            request: pedido satisfies AtualizarSubstituicaoRequest,
          })
        : await call("proceedings_substitute_designation", { request: pedido });
    if (r.ok) {
      notificar(
        alvo.modo === "editar" ? "Substituição corrigida." : "Substituição registrada.",
        "sucesso",
      );
    }
    reportar(r.ok, r.error);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remover-substituicao]").forEach((b) =>
    b.addEventListener("click", async () => {
      const designacao = porId.get(b.dataset.removerSubstituicao!);
      if (!designacao) return;
      const antecessora = porId.get(designacao.designacao_anterior_id ?? "");
      // Confirmação nominal: quem sai, quem volta e desde quando. "Tem
      // certeza?" não dá ao usuário como conferir se o alvo é o que ele acha.
      const volta = antecessora
        ? `${qualificacaoDesignado(antecessora)} voltará a ser ${antecessora.papel}`
        : "a designação anterior voltará a ser a vigente";
      if (
        !confirm(
          `Desfazer a substituição de ${designacao.papel} feita em ` +
            `${dataParaExibicao(designacao.data_inicio)}?\n\n` +
            `A designação de ${qualificacaoDesignado(designacao)} será excluída e ${volta}.`,
        )
      ) {
        return;
      }
      const r = await call("proceedings_delete_substitution", {
        processoId: id,
        designacaoId: designacao.id,
      });
      if (r.ok) notificar("Substituição desfeita.", "sucesso");
      reportar(r.ok, r.error);
    }),
  );

  const formProrrogacao = document.querySelector<HTMLFormElement>("#form-prorrogacao");
  formProrrogacao?.querySelector<HTMLInputElement>('input[type="date"]')?.addEventListener("change", (e) => {
    const input = e.currentTarget as HTMLInputElement;
    window.requestAnimationFrame(() => input.blur());
  });
  formProrrogacao?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const r = await call("deadlines_add_extension", {
      request: {
        processo_id: id,
        nova_data_vencimento: String(form.get("nova_data_vencimento") ?? ""),
        motivo: String(form.get("motivo") ?? ""),
      },
    });
    reportar(r.ok, r.error);
  });

  const formEditarProrrogacao = document.querySelector<HTMLFormElement>("#form-editar-prorrogacao");
  const ajudaEditarProrrogacao = document.querySelector<HTMLElement>("#ajuda-edicao-prorrogacao");
  const alternarEdicaoProrrogacao = (editando: boolean) => {
    if (formEditarProrrogacao) formEditarProrrogacao.hidden = !editando;
    if (ajudaEditarProrrogacao) ajudaEditarProrrogacao.hidden = !editando;
    if (formProrrogacao) formProrrogacao.hidden = editando;
  };

  document.querySelector<HTMLButtonElement>("[data-editar-prorrogacao]")?.addEventListener("click", () => {
    alternarEdicaoProrrogacao(true);
    formEditarProrrogacao?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
  });
  document.querySelector<HTMLButtonElement>("#cancelar-edicao-prorrogacao")?.addEventListener("click", () => {
    alternarEdicaoProrrogacao(false);
  });
  formEditarProrrogacao?.querySelector<HTMLInputElement>('input[type="date"]')?.addEventListener("change", (e) => {
    const input = e.currentTarget as HTMLInputElement;
    window.requestAnimationFrame(() => input.blur());
  });
  formEditarProrrogacao?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ultimaProrrogacao) return;
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const r = await call("deadlines_update_extension", {
      request: {
        processo_id: id,
        prazo_id: ultimaProrrogacao.id,
        nova_data_vencimento: String(form.get("nova_data_vencimento") ?? ""),
      },
    });
    reportar(r.ok, r.error);
  });

  document.querySelector<HTMLButtonElement>("[data-excluir-prorrogacao]")?.addEventListener("click", async () => {
    if (!ultimaProrrogacao) return;
    const vencimento = dataParaExibicao(ultimaProrrogacao.data_vencimento);
    if (!confirm(`Excluir a ${ultimaProrrogacao.ordem}ª prorrogação, com vencimento em ${vencimento}? O prazo anterior voltará a ser o vigente.`)) return;
    const r = await call("deadlines_delete_extension", {
      processoId: id,
      prazoId: ultimaProrrogacao.id,
    });
    reportar(r.ok, r.error);
  });

  const formAndamento = document.querySelector<HTMLFormElement>("#form-andamento");
  const botaoSalvarAndamento = document.querySelector<HTMLButtonElement>("#salvar-andamento");
  const botaoCancelarEdicaoAndamento =
    document.querySelector<HTMLButtonElement>("#cancelar-edicao-andamento");
  const andamentosPorId = new Map(andamentos.map((andamento) => [andamento.id, andamento]));
  let andamentoEmEdicao: string | null = null;

  const limparTipoHistorico = () => {
    formAndamento
      ?.querySelectorAll<HTMLOptionElement>("option[data-tipo-historico]")
      .forEach((opcao) => opcao.remove());
  };

  const encerrarEdicaoAndamento = () => {
    andamentoEmEdicao = null;
    formAndamento?.reset();
    limparTipoHistorico();
    if (botaoSalvarAndamento) botaoSalvarAndamento.textContent = "Registrar";
    if (botaoCancelarEdicaoAndamento) botaoCancelarEdicaoAndamento.hidden = true;
    if (formAndamento && d.concluido) formAndamento.hidden = true;
  };

  document.querySelectorAll<HTMLButtonElement>("[data-editar-andamento]").forEach((botao) =>
    botao.addEventListener("click", () => {
      const andamento = andamentosPorId.get(botao.dataset.editarAndamento!);
      if (!andamento || !formAndamento) return;
      andamentoEmEdicao = andamento.id;
      formAndamento.hidden = false;
      const tipo = formAndamento.querySelector<HTMLSelectElement>('[name="tipo_andamento_id"]');
      const descricao = formAndamento.querySelector<HTMLInputElement>('[name="descricao"]');
      limparTipoHistorico();
      if (tipo && andamento.tipo_andamento_id) {
        // Uma opção desativada não pode voltar ao formulário de cadastro, mas
        // precisa aparecer ao corrigir o registro histórico que já a usa.
        const existe = Array.from(tipo.options).some(
          (opcao) => opcao.value === andamento.tipo_andamento_id,
        );
        if (!existe) {
          const historica = document.createElement("option");
          historica.value = andamento.tipo_andamento_id;
          historica.textContent = `${andamento.tipo_andamento ?? "Tipo de andamento"} (desativado)`;
          historica.dataset.tipoHistorico = "true";
          tipo.append(historica);
        }
      }
      if (tipo) tipo.value = andamento.tipo_andamento_id ?? "";
      if (descricao) descricao.value = andamento.descricao;
      if (botaoSalvarAndamento) botaoSalvarAndamento.textContent = "Salvar alteração";
      if (botaoCancelarEdicaoAndamento) botaoCancelarEdicaoAndamento.hidden = false;
      formAndamento.scrollIntoView({ block: "nearest" });
      descricao?.focus();
    }),
  );

  botaoCancelarEdicaoAndamento?.addEventListener("click", encerrarEdicaoAndamento);

  formAndamento?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const dados = {
      processo_id: id,
      descricao: String(form.get("descricao") ?? ""),
      tipo_andamento_id: String(form.get("tipo_andamento_id") ?? "") || null,
    };
    const r = andamentoEmEdicao
      ? await call("movements_update", {
          request: { ...dados, andamento_id: andamentoEmEdicao },
        })
      : await call("movements_add", { request: dados });
    if (r.ok) {
      notificar(
        andamentoEmEdicao ? "Andamento atualizado." : "Andamento registrado.",
        "sucesso",
      );
    }
    reportar(r.ok, r.error);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remover-andamento]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remover este andamento?")) return;
      const r = await call("movements_remove", {
        processoId: id,
        andamentoId: b.dataset.removerAndamento!,
      });
      reportar(r.ok, r.error);
    }),
  );

  document.querySelectorAll<HTMLButtonElement>("[data-remover-anexo]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Remover este anexo?")) return;
      const r = await call("proceedings_remove_attachment", { anexoId: b.dataset.removerAnexo! });
      reportar(r.ok, r.error);
    }),
  );

  document.querySelector<HTMLInputElement>("#anexo")?.addEventListener("change", async (evento) => {
    const arquivo = (evento.currentTarget as HTMLInputElement).files?.[0];
    if (!arquivo) return;
    const buffer = await arquivo.arrayBuffer();
    let binario = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i]!);
    const r = await call("proceedings_upload_attachment", {
      request: {
        processo_id: id,
        nome_arquivo: arquivo.name,
        mime_type: arquivo.type || "application/octet-stream",
        conteudo: btoa(binario),
      },
    });
    reportar(r.ok, r.error);
  });
}
