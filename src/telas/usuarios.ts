// Policiais militares e contas de acesso.
//
// A tela vinha do CRUD genérico do `main.ts`, com um formulário declarado à
// mão que não correspondia mais ao backend: mandava `posto_graduacao` em vez
// de `posto_graduacao_id`, `perfil` em texto em vez de `perfil_id`, um campo
// `is_operador` que não existe, e chamava `users_list` com `per_page` — que o
// Tauri v2 entrega como `perPage`, então a paginação nunca foi aplicada.
//
// O detalhe estava pior: lia `stats.encarregado_sindicancia`,
// `stats.encarregado_pads`, `stats.escrivao` e mais onze campos com a sigla no
// nome. Nenhum existe. `users_statistics` devolve três contagens rotuladas
// pelo catálogo, e é assim que a tela passa a mostrar — os papéis e as
// espécies aparecem porque estão cadastrados, não porque estão escritos aqui.
//
// POLICIAL E CONTA SÃO COISAS DIFERENTES
//
// Só 7 dos 236 usuários do sistema legado tinham e-mail e senha. O militar
// existe no cadastro sem conta nenhuma; a conta é opcional e se desliga sem
// apagar o militar. Um formulário só grava os dois, numa transação.

import { call, type UserListItem, type UserProcessItem } from "../api";
import {
  aplicarLarguras,
  ativarSelectsPesquisaveis,
  avisarSeCortado,
  barraDeExportacao,
  baixarCsv,
  carregarTudo,
  escapeHtml,
  ITENS_POR_PAGINA,
  ligarBuscaInstantanea,
  ligarExportacao,
  ligarPaginacao,
  limparFormularioPendente,
  marcarCarregando,
  montarModal,
  notificar,
  option,
  paginacao,
  paginaValida,
  podeDescartarFormulario,
  protegerFormulario,
  tabela,
  type Coluna,
} from "../dom";
import { painelContagem } from "./estatisticas";
import type { ContextoTela } from "./catalogos";

export const ROTA_LISTA = "/usuarios/lista";
export const ROTA_NOVO = "/usuarios/novo";

type Opcao = { id: string; rotulo: string };

/** Tamanho da página da listagem. O backend trava `per_page` em 200. */
const POR_PAGINA = ITENS_POR_PAGINA;

/**
 * As oito colunas dividem 100% da largura, como na listagem de processos.
 *
 * O nome leva a maior fatia porque é o que se procura na tela; posto, situação
 * e ações são de conteúdo previsível e não podem quebrar em duas linhas. Sem
 * largura declarada o navegador dimensiona pelo conteúdo, e um nome longo
 * espremia "Encarregado" e "Perfil" até quebrarem.
 */
const COLUNAS: Coluna[] = [
  {
    rotulo: "Posto/Graduação",
    largura: 16,
    alinhamento: "centro",
    truncar: true,
    quebrarRotulo: true,
  },
  { rotulo: "Matrícula", largura: 10, alinhamento: "centro", nowrap: true },
  { rotulo: "Nome", largura: 24, truncar: true },
  { rotulo: "Encarregado", largura: 9, alinhamento: "centro", nowrap: true },
  {
    rotulo: "Usuário do sistema",
    largura: 11,
    alinhamento: "centro",
    nowrap: true,
    quebrarRotulo: true,
  },
  { rotulo: "Perfil", largura: 10, alinhamento: "centro", truncar: true },
  { rotulo: "Situação", largura: 8, alinhamento: "centro", nowrap: true },
  // 12%, e não os 6% de quando havia um botão só: são três agora, e
  // 3×32px + 2×8px de gap = 112px. Abaixo disso o terceiro botão passa da
  // borda da tabela — medido em 1024px de janela, onde 12% dão 117px.
  { rotulo: "Ações", largura: 12, alinhamento: "centro", nowrap: true },
];

/**
 * As colunas do papel: as mesmas, **menos "Ações"**.
 *
 * A regra de impressão esconde `.row-actions`, e numa tabela de layout fixo
 * isso colapsaria a célula do botão: o corpo ficaria com sete colunas e o
 * cabeçalho com oito, desalinhando a linha inteira. Botão não se imprime; a
 * coluna também não.
 */
const COLUNAS_IMPRESSAO = COLUNAS.slice(0, -1);

/** As colunas do CSV — sem "Ações", que é botão, e sem acento no cabeçalho. */
const COLUNAS_CSV = [
  "Posto/Graduacao",
  "Matricula",
  "Nome",
  "Encarregado",
  "Usuario do sistema",
  "Perfil",
  "Situacao",
];

const linhaCsv = (u: UserListItem) => [
  u.posto_graduacao,
  u.matricula,
  u.nome,
  u.is_encarregado ? "sim" : "nao",
  u.conta_ativa === true ? "sim" : "nao",
  u.conta_perfil ?? "",
  u.ativo ? "ativo" : "inativo",
];

let busca = "";
let pagina = 1;
let detalheAberto: string | null = null;

/** Descarta a resposta que chega depois de o termo já ter mudado. */
let sequenciaLista = 0;

/** Cancela a pesquisa pendente ao sair da listagem. Ver `dom.ts`. */
let cancelarBusca: (() => void) | null = null;

async function opcoes(catalogo: string, campo: string): Promise<Opcao[]> {
  const linhas = (await call("legal_catalogs_list", { catalogo })).data ?? [];
  return linhas.map((l) => ({ id: String(l.id), rotulo: String(l[campo] ?? l.id) }));
}

/** Uma linha da tabela. Serve a tela e o bloco completo da impressão. */
// `tr.inativo` já esmaece a linha inteira — o CSS espera a classe no `<tr>`.
const linhaDaTabela = (u: UserListItem, podeEscrever = false) => ({
  classe: u.ativo ? "" : "inativo",
  celulas: [
    u.posto_graduacao,
    u.matricula,
    u.nome,
    u.is_encarregado ? "sim" : "—",
    u.conta_ativa === true ? "sim" : "não",
    u.conta_perfil ?? "—",
    u.ativo ? "ativo" : "inativo",
    {
      texto: "",
      // Três ações, e cada uma com o seu `data-`: um `data-tabela-acao` só para
      // as três faria os três cliques caírem no mesmo listener.
      //
      // Só a exclusão é `danger`, e de propósito: desativar se desfaz com um
      // clique em Reativar, apagar não se desfaz de jeito nenhum. As outras
      // duas ficam `outline` para que o vermelho seja a única coisa que salta
      // na linha — com `secondary`, o botão escuro do meio puxava o olho para
      // a ação errada.
      acoes: [
        { rotulo: "Abrir", id: u.id, icone: "abrir" as const, classe: "outline" },
        // Desativar e excluir exigem administrador no backend
        // (`require_admin`), e `podeEscrever()` é exatamente `is_admin`. Um
        // botão que só sabe dizer "não" ao ser clicado é pior que botão nenhum.
        ...(podeEscrever
          ? [
              u.ativo
                ? { rotulo: "Desativar", id: u.id, icone: "desativar" as const, classe: "outline", dado: "desativar" }
                : { rotulo: "Reativar", id: u.id, icone: "reativar" as const, classe: "outline", dado: "reativar" },
              { rotulo: "Excluir", id: u.id, icone: "excluir" as const, classe: "danger", dado: "excluir" },
            ]
          : []),
      ],
    },
  ],
});

const nomeCompleto = (u: UserListItem) =>
  `${u.posto_graduacao_sigla} ${u.matricula} ${u.nome}`;

// ── Lista ─────────────────────────────────────────────────────────────

/**
 * A tabela e o controle de página — o que a pesquisa redesenha sozinha.
 *
 * Está separado do resto da tela porque refazer o `shell()` inteiro recriaria o
 * campo de busca e tiraria o foco a cada tecla. Ver `dom.ts::ligarBuscaInstantanea`.
 */
function htmlResultadosUsuarios(
  itens: UserListItem[],
  total: number,
  podeEscrever: boolean,
): string {
  return `
    ${tabela(
      COLUNAS,
      itens.map((u) => linhaDaTabela(u, podeEscrever)),
      busca ? "Nenhum militar encontrado." : "Nenhum militar cadastrado.",
      { viewport: true, listagem: true },
    )}
    ${paginacao("usuarios", pagina, POR_PAGINA, total)}`;
}

/** Religa o que vive dentro da área redesenhada. */
function ligarResultadosUsuarios(ctx: ContextoTela, itens: UserListItem[]): void {
  ligarPaginacao("usuarios", pagina, (nova) => {
    pagina = nova;
    void atualizarListaUsuarios(ctx);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tabela-acao]").forEach((botao) => {
    botao.addEventListener("click", () => {
      detalheAberto = botao.dataset.tabelaAcao ?? null;
      void renderListaUsuarios(ctx);
    });
  });

  /** As três ações de linha seguem o mesmo roteiro: confirmar, chamar, refazer. */
  const ligarAcao = (
    dado: string,
    confirmacao: (u: UserListItem) => string,
    comando: "users_deactivate" | "users_reactivate" | "users_delete",
    falha: string,
    sucesso: (u: UserListItem) => string,
  ) => {
    document.querySelectorAll<HTMLButtonElement>(`[data-${dado}]`).forEach((botao) => {
      botao.addEventListener("click", async () => {
        const id = botao.dataset[dado]!;
        const militar = itens.find((u) => u.id === id);
        if (!militar || !confirm(confirmacao(militar))) return;
        const resposta = await call(comando, { id });
        if (!resposta.ok) {
          // A recusa da exclusão diz **qual** vínculo segurou, e é o texto que
          // orienta a desativar. Vale a pena ser lido inteiro.
          notificar(resposta.error ?? falha, "erro");
          return;
        }
        notificar(sucesso(militar), "sucesso");
        void atualizarListaUsuarios(ctx);
      });
    });
  };

  ligarAcao(
    "desativar",
    (u) =>
      `Desativar ${nomeCompleto(u)}?\n\nEle sai das listas de escolha e a conta de acesso, se houver, é desativada junto. O histórico continua inteiro.`,
    "users_deactivate",
    "Falha ao desativar.",
    (u) => `${nomeCompleto(u)} foi desativado.`,
  );

  ligarAcao(
    "reativar",
    (u) => `Reativar ${nomeCompleto(u)}?`,
    "users_reactivate",
    "Falha ao reativar.",
    (u) => `${nomeCompleto(u)} foi reativado.`,
  );

  // A exclusão é física e não se desfaz — a confirmação diz isso com todas as
  // letras, e o backend ainda recusa quem tiver qualquer vínculo.
  ligarAcao(
    "excluir",
    (u) =>
      `Excluir ${nomeCompleto(u)} definitivamente?\n\nO cadastro sai do banco e NÃO há como desfazer. Para tirar de circulação sem perder o registro, use Desativar.`,
    "users_delete",
    "Falha ao excluir.",
    (u) => `${nomeCompleto(u)} foi excluído.`,
  );
}

/**
 * Refaz só a área de resultados, com o termo e a página correntes.
 *
 * Duas cautelas que a listagem de apuratórios já pagou:
 *
 *   - o **carimbo de sequência**, porque a consulta vai ao backend e digitar
 *     rápido deixaria na tela a resposta de um termo que já não está no campo;
 *   - o `aplicarLarguras`, porque as larguras declaradas em `Coluna.largura`
 *     saem em `data-largura` e quem as aplica é o `shell()` — trocar o
 *     `innerHTML` sem rechamá-lo devolve a tabela ao dimensionamento por
 *     conteúdo, **sem erro nenhum**.
 */
async function atualizarListaUsuarios(ctx: ContextoTela): Promise<void> {
  const chamada = ++sequenciaLista;
  const area = document.querySelector<HTMLElement>("#resultados-usuarios");
  const status = document.querySelector<HTMLElement>("#status-pesquisa-usuarios");
  marcarCarregando(area, true);
  if (status) status.textContent = "Atualizando resultados…";

  const resposta = await call("users_list", {
    search: busca || null,
    page: pagina,
    perPage: POR_PAGINA,
  });
  if (chamada !== sequenciaLista) return;
  marcarCarregando(area, false);

  if (!resposta.ok || !resposta.data) {
    if (status) status.textContent = "Não foi possível atualizar os resultados.";
    notificar(resposta.error ?? "Falha ao carregar.", "erro");
    return;
  }

  const { items: itens, total } = resposta.data;

  // Estreitar a busca pode deixar a página corrente fora do total. O rodapé
  // some junto com a tabela, e a tela ficaria vazia sem dizer por quê.
  const corrigida = paginaValida(pagina, POR_PAGINA, total);
  if (corrigida !== pagina) {
    pagina = corrigida;
    return atualizarListaUsuarios(ctx);
  }

  if (area) {
    area.innerHTML = htmlResultadosUsuarios(itens, total, ctx.podeEscrever());
    aplicarLarguras(area);
  }

  const contagem = document.querySelector<HTMLElement>("[data-total-usuarios]");
  if (contagem) contagem.textContent = String(total);

  // O botão nasce sempre, e some quando o filtro não acha nada: com redesenho
  // parcial ele não pode entrar e sair do HTML, que fica fora desta área.
  const csv = document.querySelector<HTMLButtonElement>("#btn-csv");
  if (csv) csv.hidden = itens.length === 0;

  const limpar = document.querySelector<HTMLButtonElement>("#limpar-busca");
  if (limpar) limpar.hidden = busca === "";

  if (status) status.textContent = `${total} resultado(s).`;
  ligarResultadosUsuarios(ctx, itens);
}

export async function renderListaUsuarios(ctx: ContextoTela): Promise<void> {
  limparFormularioPendente();
  cancelarBusca?.();
  if (detalheAberto) return renderDetalheUsuario(ctx, detalheAberto);

  const resposta = await call("users_list", {
    search: busca || null,
    page: pagina,
    perPage: POR_PAGINA,
  });
  const itens = resposta.data?.items ?? [];
  const total = resposta.data?.total ?? 0;

  // Desativar o único militar da última página deixaria a tela vazia sem dizer
  // por quê — o rodapé some junto, porque `paginacao` se apaga com uma página só.
  const corrigida = paginaValida(pagina, POR_PAGINA, total);
  if (corrigida !== pagina) {
    pagina = corrigida;
    return renderListaUsuarios(ctx);
  }

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Usuários <span class="badge" data-total-usuarios>${total}</span></h1>
          <p>Policiais militares. A conta de acesso é opcional.</p></div>
        <div class="page-head-right">
          ${ctx.podeEscrever() ? `<button id="btn-novo">Novo</button>` : ""}
          ${barraDeExportacao({ imprimir: true, csv: true })}
        </div>
      </div>

      <div class="search-bar">
        <input id="busca" type="search" autocomplete="off"
               aria-label="Pesquisar militares" aria-controls="resultados-usuarios"
               placeholder="Buscar por nome ou matrícula..."
               value="${escapeHtml(busca)}" />
        <button type="button" class="secondary small" id="limpar-busca"${busca ? "" : " hidden"}>Limpar</button>
        <span id="status-pesquisa-usuarios" class="status-pesquisa" aria-live="polite"></span>
      </div>

      ${
        resposta.ok
          ? `<div id="resultados-usuarios" class="area-resultados">${htmlResultadosUsuarios(itens, total, ctx.podeEscrever())}</div>`
          : `<p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar.")}</p>`
      }
    </section>
  `);

  const csv = document.querySelector<HTMLButtonElement>("#btn-csv");
  if (csv) csv.hidden = itens.length === 0;

  ligarResultadosUsuarios(ctx, itens);

  // O termo entra em `busca` a cada tecla, e só o redesenho espera: o CSV e a
  // impressão leem `busca` no clique, e clicar dentro dos 250 ms tem de levar
  // o que está no campo.
  cancelarBusca = ligarBuscaInstantanea(
    document.querySelector<HTMLInputElement>("#busca"),
    () => void atualizarListaUsuarios(ctx),
    {
      aoDigitar: (termo) => {
        busca = termo.trim();
        pagina = 1;
      },
    },
  );

  document.querySelector<HTMLButtonElement>("#limpar-busca")?.addEventListener("click", () => {
    const campo = document.querySelector<HTMLInputElement>("#busca");
    if (campo) campo.value = "";
    busca = "";
    pagina = 1;
    campo?.focus();
    void atualizarListaUsuarios(ctx);
  });

  document.querySelector<HTMLButtonElement>("#btn-novo")?.addEventListener("click", () => {
    void renderFormularioUsuario(ctx, null);
  });

  // CSV e impressão levam o que a **busca** alcança, não os dez da tela: com
  // 235 militares, exportar a página era exportar 4% do efetivo, e a planilha
  // não dizia que estava incompleta.
  const todosDoFiltro = () =>
    carregarTudo<UserListItem>(async (page, perPage) => {
      const r = await call("users_list", { search: busca || null, page, perPage });
      return r.data ?? null;
    });

  ligarExportacao(
    async () => {
      const { itens: todos, cortado } = await todosDoFiltro();
      avisarSeCortado(cortado);
      return baixarCsv(
        `usuarios-${new Date().toISOString().slice(0, 10)}.csv`,
        COLUNAS_CSV,
        todos.map(linhaCsv),
      );
    },
    async () => {
      const { itens: todos, cortado } = await todosDoFiltro();
      avisarSeCortado(cortado);
      return tabela(
        COLUNAS_IMPRESSAO,
        todos.map((u) => {
          const linha = linhaDaTabela(u);
          return { ...linha, celulas: linha.celulas.slice(0, -1) };
        }),
        "Nenhum militar cadastrado.",
        { listagem: true },
      );
    },
  );
}

// ── Formulário ────────────────────────────────────────────────────────

/** Cadastro enxuto de PM: conta de acesso continua sendo uma decisão da tela própria. */
export async function abrirCadastroRapidoMilitar(
  sugerirDesignavel: boolean,
  gatilho?: HTMLElement | null,
): Promise<UserListItem | null> {
  const postos = await opcoes("postos_graduacoes", "nome");
  return new Promise((resolver) => {
    let finalizado = false;
    let modal: ReturnType<typeof montarModal> = null;
    const concluir = (resultado: UserListItem | null) => {
      if (finalizado) return;
      finalizado = true;
      modal?.fechar();
      resolver(resultado);
    };
    modal = montarModal(
      `<div class="page-head">
         <div><h1>Novo policial militar</h1><p>O cadastro será selecionado no apuratório.</p></div>
       </div>
       <div class="feedback feedback--error formulario-feedback" data-erro-militar hidden role="alert"></div>
       <form class="crud-form" data-form-militar-rapido>
         <fieldset><legend>Dados do militar</legend>
           <label>Posto / Graduação
             <select name="posto_graduacao_id" required data-select-pesquisavel>
               <option value=""></option>
               ${postos.map((posto) => option(posto.id, posto.rotulo, false)).join("")}
             </select>
           </label>
           <label>Nome<input name="nome" required autocomplete="off" /></label>
           <label>Matrícula<input name="matricula" required inputmode="numeric" autocomplete="off" /></label>
           <label class="checkbox-inline">
             <input name="is_encarregado" type="checkbox"${sugerirDesignavel ? " checked" : ""} />
             Pode ser designado
           </label>
           <p class="campo-efeito">Este atalho não cria conta de acesso ao sistema.</p>
         </fieldset>
         <div class="form-actions">
           <button type="button" class="secondary" data-fechar-modal>Cancelar</button>
           <button type="submit">Salvar e selecionar</button>
         </div>
       </form>`,
      "Cadastrar policial militar",
      () => concluir(null),
      gatilho,
    );
    if (!modal) {
      resolver(null);
      return;
    }
    const form = modal.overlay.querySelector<HTMLFormElement>("[data-form-militar-rapido]")!;
    ativarSelectsPesquisaveis(form);
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const salvar = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const erro = modal?.overlay.querySelector<HTMLElement>("[data-erro-militar]");
      salvar.disabled = true;
      salvar.textContent = "Salvando…";
      const dados = new FormData(form);
      const resposta = await call("users_save", {
        request: {
          id: null,
          nome: String(dados.get("nome") ?? "").trim(),
          matricula: String(dados.get("matricula") ?? "").trim(),
          posto_graduacao_id: String(dados.get("posto_graduacao_id") ?? ""),
          is_encarregado: dados.get("is_encarregado") === "on",
          conta: null,
        },
      });
      if (!resposta.ok || !resposta.data) {
        if (erro) {
          erro.hidden = false;
          erro.textContent = resposta.error ?? "Não foi possível cadastrar o militar.";
          erro.focus();
        }
        salvar.disabled = false;
        salvar.textContent = "Salvar e selecionar";
        return;
      }
      const ativos = await call("users_list_ativos", {});
      const militar = (ativos.data ?? []).find((item) => item.id === resposta.data?.id) ?? null;
      if (!militar) {
        if (erro) {
          erro.hidden = false;
          erro.textContent = "O militar foi salvo, mas não pôde ser recarregado.";
        }
        salvar.disabled = false;
        salvar.textContent = "Salvar e selecionar";
        return;
      }
      notificar("Militar cadastrado e selecionado.", "sucesso");
      concluir(militar);
    });
  });
}

export async function renderFormularioUsuario(
  ctx: ContextoTela,
  usuario: UserListItem | null,
  erro = "",
): Promise<void> {
  if (!ctx.podeEscrever()) {
    ctx.shell(`<section class="panel"><h1>Usuários</h1>
      <p class="error">Seu perfil é somente leitura.</p></section>`);
    return;
  }

  const [postos, perfis] = await Promise.all([
    opcoes("postos_graduacoes", "nome"),
    opcoes("perfis_acesso", "nome"),
  ]);
  const temConta = usuario?.conta_id != null;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${usuario ? "Editar" : "Novo"} militar</h1></div>
      </div>
      ${erro ? `<p class="error">${escapeHtml(erro)}</p>` : ""}

      <form id="form-usuario" class="crud-form">
        <fieldset>
          <legend>Dados do militar</legend>
          <label>Posto / Graduação
            <select name="posto_graduacao_id" required data-select-pesquisavel>
              <option value="">Selecione…</option>
              ${postos.map((p) => option(p.id, p.rotulo, p.id === usuario?.posto_graduacao_id)).join("")}
            </select>
          </label>
          <label>Nome
            <input name="nome" type="text" required value="${escapeHtml(usuario?.nome ?? "")}" />
          </label>
          <label>Matrícula
            <input name="matricula" type="text" required value="${escapeHtml(usuario?.matricula ?? "")}" />
          </label>
          <label class="checkbox-inline">
            <input name="is_encarregado" type="checkbox" ${usuario?.is_encarregado ? "checked" : ""} />
            Pode ser designado
          </label>
        </fieldset>

        <fieldset class="conta-fieldset">
          <legend>
            <label class="checkbox-inline">
              <input name="tem_conta" type="checkbox" id="tem-conta" ${temConta ? "checked" : ""} />
              Tem acesso ao sistema
            </label>
          </legend>
          <div id="campos-conta" ${temConta ? "" : "hidden"}>
            <label>E-mail
              <input name="email" type="email" value="${escapeHtml(usuario?.conta_email ?? "")}" />
            </label>
            <label>Perfil
              <select name="perfil_id" data-select-pesquisavel>
                <option value="">Selecione…</option>
                ${perfis.map((p) => option(p.id, p.rotulo, p.id === usuario?.conta_perfil_id)).join("")}
              </select>
            </label>
            <label>Senha
              <input name="senha" type="password" autocomplete="new-password" />
              <span class="hint">${temConta ? "Em branco mantém a senha atual." : "Obrigatória ao criar a conta."}</span>
            </label>
          </div>
          <p class="hint">
            Desmarcar retira o acesso e desativa a conta — o militar continua
            cadastrado, com todo o histórico.
          </p>
        </fieldset>

        <div class="form-actions">
          <button type="button" id="btn-cancelar" class="secondary">Cancelar</button>
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);

  const alternarConta = () => {
    const marcado = document.querySelector<HTMLInputElement>("#tem-conta")?.checked ?? false;
    document.querySelector<HTMLElement>("#campos-conta")?.toggleAttribute("hidden", !marcado);
  };
  document.querySelector<HTMLInputElement>("#tem-conta")?.addEventListener("change", alternarConta);

  document.querySelector<HTMLButtonElement>("#btn-cancelar")?.addEventListener("click", () => {
    if (!podeDescartarFormulario()) return;
    void renderListaUsuarios(ctx);
  });

  const formulario = document.querySelector<HTMLFormElement>("#form-usuario")!;
  ativarSelectsPesquisaveis(formulario);
  protegerFormulario(formulario);
  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const salvar = formulario.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    salvar.disabled = true;
    salvar.textContent = "Salvando…";
    const f = new FormData(e.currentTarget as HTMLFormElement);
    const senha = String(f.get("senha") ?? "");

    // `conta: null` é o que retira o acesso — não é ausência de informação.
    const conta = f.get("tem_conta")
      ? {
          email: String(f.get("email") ?? "").trim(),
          perfil_id: String(f.get("perfil_id") ?? ""),
          senha: senha || null,
        }
      : null;

    const resposta = await call("users_save", {
      request: {
        id: usuario?.id ?? null,
        nome: String(f.get("nome") ?? "").trim(),
        matricula: String(f.get("matricula") ?? "").trim(),
        posto_graduacao_id: String(f.get("posto_graduacao_id") ?? ""),
        is_encarregado: f.get("is_encarregado") === "on",
        conta,
      },
    });

    if (!resposta.ok) {
      notificar(resposta.error ?? "Falha ao salvar.", "erro");
      salvar.disabled = false;
      salvar.textContent = "Salvar";
      return;
    }
    limparFormularioPendente();
    detalheAberto = null;
    await renderListaUsuarios(ctx);
    notificar("Militar salvo com sucesso.", "sucesso");
  });
}

// ── Detalhe ───────────────────────────────────────────────────────────

function tabelaProcessos(itens: UserProcessItem[], coluna: string, campo: "papel" | "status_envolvido") {
  return tabela(
    [
      { rotulo: "Apuratório", largura: 22, truncar: true, alinhamento: "centro" },
      { rotulo: "Apuratório", largura: 24, truncar: true, alinhamento: "centro" },
      { rotulo: coluna, largura: 24, truncar: true, alinhamento: "centro" },
      { rotulo: "Instauração", largura: 15, alinhamento: "centro", nowrap: true },
      { rotulo: "Situação", largura: 15, alinhamento: "centro", nowrap: true },
    ],
    itens.map((p) => [
      `${p.apuratorio_sigla} nº ${p.numero_controle}`,
      p.apuratorio_nome,
      p[campo] ?? "—",
      p.data_instauracao,
      p.data_conclusao ? `concluído em ${p.data_conclusao}` : "em andamento",
    ]),
    "Nenhum.",
    { listagem: true },
  );
}

async function renderDetalheUsuario(ctx: ContextoTela, id: string): Promise<void> {
  const [usuario, estatisticas, designados, envolvidos] = await Promise.all([
    call("users_get", { id }).then((r) => r.data),
    call("users_statistics", { id }).then((r) => r.data),
    call("users_proceedings_designated", { id }).then((r) => r.data ?? []),
    call("users_proceedings_involved", { id }).then((r) => r.data ?? []),
  ]);

  if (!usuario) {
    detalheAberto = null;
    ctx.shell(`<section class="panel"><p class="error">Militar não encontrado.</p></section>`);
    return;
  }

  const inativo = !usuario.ativo;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(nomeCompleto(usuario))}
            <span class="badge${inativo ? "" : " badge--ok"}">${inativo ? "Inativo" : "Ativo"}</span>
          </h1>
          <p>
            ${escapeHtml(usuario.circulo_hierarquico)} ·
            ${usuario.is_encarregado ? "pode ser designado" : "não designável"} ·
            ${escapeHtml(usuario.conta_email ?? "sem conta de acesso")}
            ${usuario.conta_perfil ? ` (${escapeHtml(usuario.conta_perfil)})` : ""}
          </p>
        </div>
        <div class="page-head-right">
          <button id="btn-voltar" class="secondary small">← Voltar</button>
          ${
            ctx.podeEscrever()
              ? `<button id="btn-editar" class="small">Editar</button>
                 ${
                   inativo
                     ? `<button id="btn-reativar" class="small">Reativar</button>`
                     : `<button id="btn-desativar" class="secondary small">Desativar</button>`
                 }`
              : ""
          }
          ${barraDeExportacao({ imprimir: true })}
        </div>
      </div>

      <div class="stat-grid">
        ${painelContagem("Designações por função", estatisticas?.designacoes_por_papel ?? [], "Função")}
        ${painelContagem("Designações por apuratório", estatisticas?.designacoes_por_apuratorio ?? [], "Apuratório")}
        ${painelContagem("Envolvimentos por status", estatisticas?.envolvimentos_por_status ?? [], "Status")}
      </div>

      <div class="detail-section">
        <h2>Designado (${designados.length})</h2>
        <p class="hint">
          Uma seção só, e não "como encarregado" e "como escrivão": a função é
          configuração por apuratório, e separar por nome aqui traria de volta o
          hardcode. A coluna Função mostra qual foi.
        </p>
        ${tabelaProcessos(designados, "Função", "papel")}
      </div>

      <div class="detail-section">
        <h2>Como envolvido (${envolvidos.length})</h2>
        ${tabelaProcessos(envolvidos, "Status", "status_envolvido")}
      </div>
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#btn-voltar")?.addEventListener("click", () => {
    detalheAberto = null;
    void renderListaUsuarios(ctx);
  });

  document.querySelector<HTMLButtonElement>("#btn-editar")?.addEventListener("click", () => {
    void renderFormularioUsuario(ctx, usuario);
  });

  document.querySelector<HTMLButtonElement>("#btn-reativar")?.addEventListener("click", async () => {
    if (!confirm("Reativar este militar?")) return;
    const resposta = await call("users_reactivate", { id });
    if (!resposta.ok) {
      notificar(resposta.error ?? "Falha ao reativar.", "erro");
      return;
    }
    void renderDetalheUsuario(ctx, id);
  });

  // O par do Reativar, que faltava: o detalhe sabia devolver alguém ao ativo,
  // mas não tirar. Excluir não vem para cá de propósito — é irreversível e o
  // lugar dela é a listagem, onde a linha inteira está à vista.
  document.querySelector<HTMLButtonElement>("#btn-desativar")?.addEventListener("click", async () => {
    if (
      !confirm(
        `Desativar ${nomeCompleto(usuario)}?\n\nEle sai das listas de escolha e a conta de acesso, se houver, é desativada junto. O histórico continua inteiro.`,
      )
    ) {
      return;
    }
    const resposta = await call("users_deactivate", { id });
    if (!resposta.ok) {
      notificar(resposta.error ?? "Falha ao desativar.", "erro");
      return;
    }
    notificar(`${nomeCompleto(usuario)} foi desativado.`, "sucesso");
    void renderDetalheUsuario(ctx, id);
  });

  ligarExportacao();
}
