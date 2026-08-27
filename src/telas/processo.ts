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
//   penalidade habilitada     <- tipos_solucao_decidida.permite_penalidade
//   dias de penalidade        <- tipos_penalidade.usa_quantidade_dias
//
// Nenhuma dessas regras aparece como literal aqui. Trocar o nome de um
// apuratório, de uma natureza ou de uma solução não muda nada nesta tela.

import {
  call,
  type ApuratorioConfig,
  type AtualizarSubstituicaoRequest,
  type CartaPrecatoriaRequest,
  type DesignacaoItem,
  type DesignacaoRequest,
  type EnvolvidoRequest,
  type MilitarQualificado,
  type PapelItem,
  type PessoaRequest,
  type SaveProceedingRequest,
  type UserListItem,
} from "../api";
import {
  baixarArquivoBase64,
  botaoIcone,
  escapeHtml,
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
import type { ContextoTela } from "./catalogos";
import { renderIndicios } from "./indicios";

export const ROTA_LISTA = "/procedimentos/lista";

const EXTENSAO_CARTA_PRECATORIA = "carta_precatoria";

type Opcao = { id: string; rotulo: string; extra?: Record<string, unknown> };

/** Catálogos que o formulário inteiro consulta. Carregados uma vez por abertura. */
type Catalogos = {
  apuratorios: Opcao[];
  unidades: Opcao[];
  municipios: Opcao[];
  naturezas: Opcao[];
  status: Opcao[];
  solucoesSugeridas: Opcao[];
  solucoesDecididas: Opcao[];
  penalidades: Opcao[];
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
    municipios,
    naturezas,
    status,
    solucoesSugeridas,
    solucoesDecididas,
    penalidades,
    papeisPessoa,
    militares,
  ] = await Promise.all([
    catalogo("apuratorios", ["sigla", "nome"]),
    catalogo("unidades_pm", ["nome"]),
    catalogo("municipios_distritos", ["nome"]),
    catalogo("naturezas_fato", ["nome"]),
    catalogo("status_envolvido", ["nome"]),
    catalogo("tipos_solucao_sugerida", ["nome"]),
    catalogo("tipos_solucao_decidida", ["nome"]),
    catalogo("tipos_penalidade", ["nome"]),
    catalogo("papeis_pessoa", ["nome"]),
    call("users_list_ativos", {}).then((r) => r.data ?? []),
  ]);
  return {
    apuratorios,
    unidades,
    municipios,
    naturezas,
    status,
    solucoesSugeridas,
    solucoesDecididas,
    penalidades,
    papeisPessoa,
    militares,
  };
}

// ── rascunho ────────────────────────────────────────────────────────────────

type Rascunho = SaveProceedingRequest & {
  envolvidos: EnvolvidoRequest[];
  designacoes: DesignacaoRequest[];
  pessoas: PessoaRequest[];
};

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
    municipio_fato_id: "",
    natureza_fato_id: null,
    data_instauracao: new Date().toISOString().slice(0, 10),
    data_recebimento: null,
    data_remessa_encarregado: null,
    data_remessa_comissao: null,
    data_julgamento: null,
    data_conclusao: null,
    resumo_fatos: null,
    envolvidos: [],
    designacoes: [],
    pessoas: [],
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

  // Campo que a configuração do apuratório pode esconder precisa deste, e não
  // de `texto`: `FormData.get` devolve `null` tanto para "o usuário apagou"
  // quanto para "o campo nem foi renderizado". Tratar os dois igual apagaria
  // fato já registrado só porque a espécie deixou de prever aquele campo — o
  // princípio 5 diz o contrário: configuração define comportamento futuro, não
  // reescreve o que já foi gravado. `has()` separa os dois casos.
  const textoSePresente = (campo: string, atual: string | null | undefined) =>
    dados.has(campo) ? texto(campo) : (atual ?? null);

  rascunho.apuratorio_id = String(dados.get("apuratorio_id") ?? "");
  rascunho.documento_iniciador_id = String(dados.get("documento_iniciador_id") ?? "");
  rascunho.numero_documento = String(dados.get("numero_documento") ?? "").trim();
  rascunho.numero_controle = texto("numero_controle");
  rascunho.processo_sei = texto("processo_sei");
  rascunho.numero_rgf = texto("numero_rgf");
  rascunho.unidade_origem_id = String(dados.get("unidade_origem_id") ?? "");
  rascunho.municipio_fato_id = String(dados.get("municipio_fato_id") ?? "");
  rascunho.natureza_fato_id = texto("natureza_fato_id");
  rascunho.data_instauracao = String(dados.get("data_instauracao") ?? "");
  rascunho.data_recebimento = texto("data_recebimento");
  rascunho.data_remessa_encarregado = texto("data_remessa_encarregado");
  rascunho.data_remessa_comissao = textoSePresente(
    "data_remessa_comissao",
    rascunho.data_remessa_comissao,
  );
  rascunho.data_julgamento = textoSePresente("data_julgamento", rascunho.data_julgamento);
  rascunho.data_conclusao = texto("data_conclusao");
  rascunho.resumo_fatos = texto("resumo_fatos");

  const deprecante = texto("cp_deprecante");
  const deprecada = String(dados.get("cp_unidade_deprecada_id") ?? "");
  rascunho.carta_precatoria =
    deprecante || deprecada
      ? ({ deprecante: deprecante ?? "", unidade_deprecada_id: deprecada } as CartaPrecatoriaRequest)
      : null;

  rascunho.envolvidos = rascunho.envolvidos.map((anterior, i) => ({
    policial_militar_id: String(dados.get(`env_${i}_pm`) ?? ""),
    status_envolvido_id: String(dados.get(`env_${i}_status`) ?? ""),
    ordem: i + 1,
    e_condutor: dados.get(`env_${i}_condutor`) === "on",
    solucao_sugerida_id: String(dados.get(`env_${i}_sug`) ?? "") || null,
    solucao_decidida_id: String(dados.get(`env_${i}_dec`) ?? "") || null,
    // Penalidade e dias somem quando a espécie não pune ou o desfecho não
    // permite. Ausente ≠ apagado: preserva o que estava, pela mesma razão de
    // `textoSePresente`.
    penalidade_tipo_id: dados.has(`env_${i}_pena`)
      ? String(dados.get(`env_${i}_pena`) ?? "") || null
      : (anterior.penalidade_tipo_id ?? null),
    penalidade_dias: dados.has(`env_${i}_dias`)
      ? Number(dados.get(`env_${i}_dias`) ?? 0) || null
      : (anterior.penalidade_dias ?? null),
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
}

// ── render ──────────────────────────────────────────────────────────────────

function nomeMilitar(m: UserListItem): string {
  return `${m.posto_graduacao} ${m.nome} (${m.matricula})`;
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
  return `<select name="${nome}" required>
    <option value=""></option>
    ${ausente ? option(atual, "— militar desativado (vínculo preservado) —", true) : ""}
    ${militares.map((m) => option(m.id, nomeMilitar(m), m.id === atual)).join("")}
  </select>`;
}

function selectOpcoes(nome: string, opcoes: Opcao[], atual: string, obrigatorio = false): string {
  return `<select name="${nome}"${obrigatorio ? " required" : ""}>
    <option value=""></option>
    ${opcoes.map((o) => option(o.id, o.rotulo, o.id === atual)).join("")}
  </select>`;
}

function campoData(
  nome: string,
  rotulo: string,
  valor: string | null | undefined,
  opcoes: { obrigatorio?: boolean; ajuda?: string } = {},
): string {
  const obrigatorio = opcoes.obrigatorio === true;
  const id = `campo-${nome}`;
  return `<div class="campo">
    <label for="${id}">${escapeHtml(rotulo)}</label>
    <div class="campo-data-controle">
      <input id="${id}" name="${escapeHtml(nome)}" type="date" value="${escapeHtml(valor ?? "")}"${obrigatorio ? " required" : ""} />
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
      <p class="campo-efeito">Esta função já foi substituída. Para trocar de novo, corrigir ou desfazer, use <strong>Substituir</strong> na página de detalhes do processo.</p>
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
    <label>Papel<select name="des_${i}_papel" required>
      <option value=""></option>
      ${opcoesPapel.join("")}
    </select></label>
    <label>Militar${selectMilitares(`des_${i}_pm`, militares, d.policial_militar_id)}</label>
  </div>`;
}

export async function renderFormularioProcesso(
  ctx: ContextoTela,
  id: string | null,
  erro = "",
  rascunhoAtual?: Rascunho,
): Promise<void> {
  if (!rascunhoAtual) limparFormularioPendente();
  const cats = await carregarCatalogos();
  let rascunho = rascunhoAtual;

  if (!rascunho) {
    rascunho = rascunhoVazio();
    designacoesTravadas.clear();
    if (id) {
      const r = await call("proceedings_get", { id });
      const d = r.data;
      if (!d) {
        ctx.shell(`<section class="panel"><p class="error">Processo não encontrado.</p></section>`);
        return;
      }
      rascunho = {
        id: d.id,
        apuratorio_id: d.apuratorio_id,
        documento_iniciador_id: d.documento_iniciador_id,
        numero_documento: d.numero_documento,
        numero_controle: d.numero_controle,
        processo_sei: d.processo_sei,
        numero_rgf: d.numero_rgf,
        unidade_origem_id: d.unidade_origem_id,
        municipio_fato_id: d.municipio_fato_id,
        natureza_fato_id: d.natureza_fato_id,
        data_instauracao: d.data_instauracao,
        data_recebimento: d.data_recebimento,
        data_remessa_encarregado: d.data_remessa_encarregado,
        data_remessa_comissao: d.data_remessa_comissao,
        data_julgamento: d.data_julgamento,
        data_conclusao: d.data_conclusao,
        resumo_fatos: d.resumo_fatos,
        envolvidos: d.envolvidos.map((e, i) => ({
          policial_militar_id: e.policial_militar_id,
          status_envolvido_id: e.status_envolvido_id,
          ordem: i + 1,
          e_condutor: e.e_condutor,
          solucao_sugerida_id: e.solucao_sugerida_id,
          solucao_decidida_id: e.solucao_decidida_id,
          penalidade_tipo_id: e.penalidade_tipo_id,
          penalidade_dias: e.penalidade_dias,
        })),
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
        carta_precatoria: d.carta_precatoria
          ? {
              deprecante: d.carta_precatoria.deprecante,
              unidade_deprecada_id: d.carta_precatoria.unidade_deprecada_id,
            }
          : null,
      };

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

  // Campo escondido não pode apagar fato já registrado (princípio 5). Se a
  // configuração mudar depois de o processo existir, o valor gravado continua
  // aparecendo — com nota dizendo por quê — em vez de sumir da tela e ser
  // zerado no próximo salvamento. Mesma escolha de `selectMilitares`.
  const mostrar = (permitido: boolean | undefined, valorGravado: string | null | undefined) =>
    permitido === true || !!valorGravado;

  const mostraJulgamento = mostrar(config?.permite_julgamento, rascunho.data_julgamento);
  const mostraRemessaComissao = mostrar(
    config?.permite_remessa_comissao,
    rascunho.data_remessa_comissao,
  );
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

  // Dois gates, em níveis diferentes, e os dois valem: o apuratório diz se a
  // ESPÉCIE pune (um IPM nunca pune), a solução decidida diz se AQUELE desfecho
  // pune (um PADS pune quando a solução é "Punido", não quando é "Absolvido").
  const permitePenalidade = (solucaoId: string | null | undefined) =>
    config?.permite_punicao === true &&
    cats.solucoesDecididas.find((s) => s.id === solucaoId)?.extra?.permite_penalidade === true;
  const usaDias = (penalidadeId: string | null | undefined) =>
    cats.penalidades.find((p) => p.id === penalidadeId)?.extra?.usa_quantidade_dias === true;

  const r = rascunho;
  const podeAdicionarEnvolvido = maxEnvolvidos === null || r.envolvidos.length < maxEnvolvidos;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${id ? "Editar" : "Novo"} processo</h1>
          <p>${escapeHtml(apuratorio?.rotulo ?? "")}</p>
        </div>
      </div>

      ${documentos.length === 0 ? `<p class="aviso">Este apuratório não tem documento iniciador habilitado. Configure em <strong>Catálogos → Configuração de apuratórios</strong>.</p>` : ""}

      <form id="form-processo" class="crud-form">
        <fieldset>
          <legend>Identificação</legend>
          <div class="campo"><label>Apuratório ${selectOpcoes("apuratorio_id", cats.apuratorios, r.apuratorio_id, true)}</label></div>
          <div class="campo"><label>Documento iniciador
            <select name="documento_iniciador_id" required>
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
          <div class="campo"><label>Unidade de origem ${selectOpcoes("unidade_origem_id", cats.unidades, r.unidade_origem_id, true)}</label></div>
          <div class="campo"><label>Município do fato ${selectOpcoes("municipio_fato_id", cats.municipios, r.municipio_fato_id, true)}</label></div>
          <div class="campo"><label>Natureza do fato ${selectOpcoes("natureza_fato_id", cats.naturezas, r.natureza_fato_id ?? "", exigeNatureza)}
            ${exigeNatureza ? `<small class="campo-efeito">Obrigatória para este apuratório.</small>` : ""}</label></div>
        </fieldset>

        ${
          ehCartaPrecatoria
            ? `<fieldset>
                 <legend>Carta precatória</legend>
                 <div class="campo"><label>Deprecante<input name="cp_deprecante" value="${escapeHtml(r.carta_precatoria?.deprecante ?? "")}" required /></label></div>
                 <div class="campo"><label>Unidade deprecada ${selectOpcoes("cp_unidade_deprecada_id", cats.unidades, r.carta_precatoria?.unidade_deprecada_id ?? "", true)}</label></div>
               </fieldset>`
            : ""
        }

        <fieldset>
          <legend>Datas</legend>
          ${campoData("data_instauracao", "Instauração", r.data_instauracao, { obrigatorio: true })}
          ${campoData("data_recebimento", "Recebimento", r.data_recebimento, {
            ajuda: "Dispara o prazo inicial: sem ela, nenhum prazo nasce.",
          })}
          ${campoData("data_remessa_encarregado", "Remessa do encarregado", r.data_remessa_encarregado)}
          ${
            mostraRemessaComissao
              ? campoData("data_remessa_comissao", "Remessa à comissão", r.data_remessa_comissao, {
                  ajuda:
                    config?.permite_remessa_comissao === false
                      ? "Esta espécie não prevê comissão; o campo aparece porque já há data registrada."
                      : undefined,
                })
              : ""
          }
          ${
            mostraJulgamento
              ? campoData("data_julgamento", "Julgamento", r.data_julgamento, {
                  ajuda:
                    config?.permite_julgamento === false
                      ? "Esta espécie não é julgada; o campo aparece porque já há data registrada."
                      : undefined,
                })
              : ""
          }
          ${campoData("data_conclusao", "Conclusão", r.data_conclusao, {
            ajuda: "Preenchida = processo concluído.",
          })}
        </fieldset>

        <fieldset>
          <legend>Designações</legend>
          ${papeis.length === 0 ? `<p class="empty">Nenhum papel habilitado para este apuratório.</p>` : ""}
          ${papeis.some((p) => p.obrigatorio) ? `<p class="secao-ajuda">Papéis obrigatórios: ${papeis.filter((p) => p.obrigatorio).map((p) => escapeHtml(p.papel)).join(", ")}. O processo não salva sem eles.</p>` : ""}
          <p class="secao-ajuda">A designação inicial começa na data de instauração e é autorizada pelo documento que instaurou o processo — por isso não se digitam data nem documento aqui. Trocas posteriores são feitas em <strong>Substituir</strong>, na página de detalhes.</p>
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
              <label>Militar${selectMilitares(`env_${i}_pm`, cats.militares, e.policial_militar_id)}</label>
              <label>Situação${selectOpcoes(`env_${i}_status`, cats.status, e.status_envolvido_id, true)}</label>
              ${exigeCondutor ? `<label class="checkbox"><input name="env_${i}_condutor" type="checkbox"${e.e_condutor ? " checked" : ""} /> Condutor</label>` : ""}
              <label>Solução sugerida${selectOpcoes(`env_${i}_sug`, cats.solucoesSugeridas, e.solucao_sugerida_id ?? "")}</label>
              <label>Solução decidida${selectOpcoes(`env_${i}_dec`, cats.solucoesDecididas, e.solucao_decidida_id ?? "")}</label>
              ${
                // Penalidade já gravada continua à vista mesmo se a configuração
                // mudar depois — esconder apagaria o fato no próximo salvamento.
                permitePenalidade(e.solucao_decidida_id) || e.penalidade_tipo_id
                  ? `<label>Penalidade${selectOpcoes(`env_${i}_pena`, cats.penalidades, e.penalidade_tipo_id ?? "")}</label>
                     ${usaDias(e.penalidade_tipo_id) ? `<label>Dias<input name="env_${i}_dias" type="number" min="1" value="${e.penalidade_dias ?? ""}" /></label>` : ""}`
                  : ""
              }
            </div>`,
            )
            .join("")}
          ${podeAdicionarEnvolvido ? `<button type="button" class="secondary small" id="add-env">Adicionar envolvido</button>` : ""}
        </fieldset>

        <fieldset>
          <legend>Pessoas (vítimas, inquiridos)</legend>
          ${r.pessoas
            .map(
              (p, i) => `
            <div class="linha-colecao">
              <div class="linha-colecao-head"><strong>Pessoa ${i + 1}</strong>
                <button type="button" class="danger small" data-remover-pes="${i}">Remover</button>
              </div>
              <label>Papel${selectOpcoes(`pes_${i}_papel`, cats.papeisPessoa, p.papel_pessoa_id, true)}</label>
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

        ${erro ? `<p class="error">${escapeHtml(erro)}</p>` : ""}
        <div class="form-actions">
          <button type="button" class="secondary" id="cancelar">Cancelar</button>
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);

  const form = document.querySelector<HTMLFormElement>("#form-processo")!;
  protegerFormulario(form);

  // O seletor nativo do WebView permanece aberto depois da escolha em algumas
  // plataformas. Tirar o foco no quadro seguinte fecha o popover sem substituir
  // o controle nativo nem introduzir uma dependência de calendário.
  form.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
    input.addEventListener("change", () => {
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

  document.querySelector<HTMLButtonElement>("#cancelar")?.addEventListener("click", () => {
    if (!podeDescartarFormulario()) return;
    void renderListaProcessos(ctx);
  });

  // Trocar apuratório, natureza ou solução muda o que o formulário mostra —
  // por isso re-renderiza em vez de esconder campo com CSS.
  for (const seletor of ['[name="apuratorio_id"]', '[name="natureza_fato_id"]']) {
    form.querySelector<HTMLSelectElement>(seletor)?.addEventListener("change", () => rerender(() => {}));
  }
  form.querySelectorAll<HTMLSelectElement>('[name$="_dec"], [name$="_pena"]').forEach((s) =>
    s.addEventListener("change", () => rerender(() => {})),
  );

  document.querySelector("#add-des")?.addEventListener("click", () =>
    rerender(() =>
      r.designacoes.push({ id: null, policial_militar_id: "", papel_id: "" }),
    ),
  );
  document.querySelector("#add-env")?.addEventListener("click", () =>
    rerender(() =>
      r.envolvidos.push({
        policial_militar_id: "",
        status_envolvido_id: "",
        ordem: r.envolvidos.length + 1,
        e_condutor: false,
        solucao_sugerida_id: null,
        solucao_decidida_id: null,
        penalidade_tipo_id: null,
        penalidade_dias: null,
      }),
    ),
  );
  document.querySelector("#add-pes")?.addEventListener("click", () =>
    rerender(() => r.pessoas.push({ papel_pessoa_id: "", nome: "", ordem: r.pessoas.length + 1 })),
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

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const salvar = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    salvar.disabled = true;
    salvar.textContent = "Salvando…";
    absorverFormulario(r, form);
    const resposta = await call("proceedings_save", { request: r });
    if (!resposta.ok) {
      void renderFormularioProcesso(ctx, id, resposta.error ?? "Falha ao salvar.", r);
      return;
    }
    limparFormularioPendente();
    await renderListaProcessos(ctx);
    notificar("Processo salvo com sucesso.", "sucesso");
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
        <div><h1>Processos e procedimentos</h1><p>${total} registro(s)</p></div>
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
                    <td class="col-origem" title="${escapeHtml(p.unidade_origem)}">${escapeHtml(p.unidade_origem)}</td>
                    <td class="col-sei" title="${escapeHtml(p.processo_sei ?? "")}">${escapeHtml(p.processo_sei ?? "—")}</td>
                    <td class="col-pessoa" title="${escapeHtml(encarregado === "—" ? "" : encarregado)}"><span class="celula-reticencias">${escapeHtml(encarregado)}</span></td>
                    <td class="col-pessoa">${resumoEnvolvidos(p.id, p.envolvidos_resumo)}</td>
                    <td class="col-status-prazo">${badgeStatusPrazo(p.concluido, p.prazo_dias_restantes)}</td>
                    <td class="col-acao"><div class="row-actions">${botaoIcone("abrir", "Abrir", { classe: "outline", dados: { processo: p.id } })}</div></td>
                  </tr>`;
                  })
                  .join("")}
              </tbody></table></div>`
          : `<p class="empty">Nenhum processo encontrado.</p>`
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
  return new Date().toISOString().slice(0, 10);
}

/** O ato que autorizou a designação, como a Seção o escreve. */
function documentoDaDesignacao(d: DesignacaoItem): string {
  if (!d.documento_autorizador) return "";
  return d.numero_documento
    ? `${d.documento_autorizador} nº ${d.numero_documento}`
    : d.documento_autorizador;
}

export async function renderDetalheProcesso(ctx: ContextoTela, id: string): Promise<void> {
  // `users_list_ativos` e não um comando paginado: lista de OPÇÕES não pagina.
  // O teto de 200 de uma listagem cortaria o seletor em silêncio, que foi o
  // defeito da §8.9 — e são 235 militares no banco real.
  const [detalheResp, prazos, andamentos, tiposAndamento, militares, tiposDocumento] =
    await Promise.all([
      call("proceedings_get", { id }),
      call("deadlines_list", { processoId: id }).then((r) => r.data ?? []),
      call("movements_list", { processoId: id }).then((r) => r.data ?? []),
      catalogo("tipos_andamento", ["nome"]),
      call("users_list_ativos", {}).then((r) => r.data ?? []),
      catalogo("tipos_documento", ["nome"]),
    ]);

  const d = detalheResp.data;
  if (!detalheResp.ok || !d) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(detalheResp.error ?? "Processo não encontrado.")}</p></section>`);
    return;
  }

  const podeEscrever = ctx.podeEscrever();
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
        ${linha("Município do fato", d.municipio_fato)}
        ${linha("Natureza do fato", d.natureza_fato)}
        ${linha("Instauração", d.data_instauracao)}
        ${linha("Recebimento", d.data_recebimento)}
        ${linha("Remessa do encarregado", d.data_remessa_encarregado)}
        ${linha("Remessa à comissão", d.data_remessa_comissao)}
        ${linha("Julgamento", d.data_julgamento)}
        ${linha("Conclusão", d.data_conclusao)}
        ${linha("Responsável", d.responsavel_nome ? `${d.responsavel_nome} (${d.responsavel_papel})` : null)}
        ${d.carta_precatoria ? linha("Deprecante", d.carta_precatoria.deprecante) : ""}
        ${d.carta_precatoria ? linha("Unidade deprecada", d.carta_precatoria.unidade_deprecada) : ""}
        ${linha("Resumo dos fatos", d.resumo_fatos)}
      </table>

      <h2>Envolvidos</h2>
      ${
        d.envolvidos.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--envolvidos">
              <thead><tr><th>#</th><th>Militar</th><th>Situação</th><th>Condutor</th>
                <th>Sugerida</th><th>Decidida</th><th>Penalidade</th><th>Indícios</th></tr></thead>
              <tbody>${d.envolvidos
                .map(
                  (e) => `<tr>
                    <td>${e.ordem}</td>
                    <td>${escapeHtml(`${e.posto_graduacao} ${e.nome}`)}</td>
                    <td>${escapeHtml(e.status_envolvido)}</td>
                    <td>${e.e_condutor ? "sim" : ""}</td>
                    <td>${escapeHtml(e.solucao_sugerida ?? "")}</td>
                    <td>${escapeHtml(e.solucao_decidida ?? "")}</td>
                    <td>${escapeHtml(e.penalidade_tipo ?? "")}${e.penalidade_dias ? ` — ${e.penalidade_dias} dias` : ""}</td>
                    <td class="row-actions">${botaoIcone("abrir", "Ver indícios", {
                      classe: "secondary",
                      dados: { indicios: e.id },
                    })}</td>
                  </tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Nenhum envolvido.</p>`
      }

      <h2>Designações</h2>
      ${
        d.designacoes.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-detalhe-processo tabela-detalhe-processo--designacoes">
              <thead><tr><th>Papel</th><th>Militar</th><th>Início</th><th>Fim</th><th>Documento</th><th>Motivo</th>${podeEscrever ? "<th>Ações</th>" : ""}</tr></thead>
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
                              : `${botaoIcone("substituir", `Substituir ${x.papel}`, {
                                  classe: "secondary",
                                  dados: { substituir: x.id },
                                })}
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
               <label>Documento autorizador
                 ${selectOpcoes("documento_autorizador_id", tiposDocumento, "")}
                 <small class="campo-erro" data-erro="documento_autorizador_id" hidden></small>
               </label>
               <label>Nº do documento
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
                    <td>${escapeHtml(p.motivo ?? "")}</td>
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
        podeEscrever && prazoVigente
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
                      ? `<td class="row-actions">${botaoIcone("excluir", "Remover", {
                          classe: "danger",
                          dados: { "remover-andamento": a.id },
                        })}</td>`
                      : ""
                  }
                </tr>`,
                )
                .join("")}</tbody></table></div>`
          : `<p class="empty">Nenhum andamento.</p>`
      }
      ${
        podeEscrever
          ? `<form id="form-andamento" class="linha-form">
               <label>Tipo<select name="tipo_andamento_id">
                 <option value=""></option>
                 ${tiposAndamento.map((t) => option(t.id, t.rotulo, false)).join("")}
               </select></label>
               <label>Descrição<input name="descricao" required /></label>
               <button type="submit">Registrar</button>
             </form>`
          : ""
      }

      <h2>Anexos</h2>
      ${
        d.anexos.length
          ? `<div class="table-wrap"><table class="tabela-dados">
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
    if (!confirm("Reabrir este processo?")) return;
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
    preencher(
      "documento_autorizador_id",
      editando ? (designacao.documento_autorizador_id ?? "") : "",
    );
    preencher("numero_documento", editando ? (designacao.numero_documento ?? "") : "");
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

  document.querySelector<HTMLFormElement>("#form-andamento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const r = await call("movements_add", {
      request: {
        processo_id: id,
        descricao: String(form.get("descricao") ?? ""),
        tipo_andamento_id: String(form.get("tipo_andamento_id") ?? "") || null,
      },
    });
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
