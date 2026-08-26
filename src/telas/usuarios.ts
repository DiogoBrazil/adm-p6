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
  avisarSeCortado,
  barraDeExportacao,
  baixarCsv,
  carregarTudo,
  escapeHtml,
  ITENS_POR_PAGINA,
  ligarExportacao,
  ligarPaginacao,
  limparFormularioPendente,
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
  { rotulo: "Posto", largura: 8, alinhamento: "centro", nowrap: true },
  { rotulo: "Matrícula", largura: 10, alinhamento: "centro", nowrap: true },
  { rotulo: "Nome", largura: 30, truncar: true },
  { rotulo: "Encarregado", largura: 9, alinhamento: "centro", nowrap: true },
  { rotulo: "Conta", largura: 20, truncar: true },
  { rotulo: "Perfil", largura: 11, truncar: true },
  { rotulo: "Situação", largura: 8, alinhamento: "centro", nowrap: true },
  { rotulo: "Ações", largura: 4, alinhamento: "centro", nowrap: true },
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
  "Posto",
  "Matricula",
  "Nome",
  "Encarregado",
  "Conta",
  "Perfil",
  "Situacao",
];

const linhaCsv = (u: UserListItem) => [
  u.posto_graduacao,
  u.matricula,
  u.nome,
  u.is_encarregado ? "sim" : "nao",
  u.conta_email ?? "",
  u.conta_perfil ?? "",
  u.ativo ? "ativo" : "inativo",
];

let busca = "";
let pagina = 1;
let detalheAberto: string | null = null;

async function opcoes(catalogo: string, campo: string): Promise<Opcao[]> {
  const linhas = (await call("legal_catalogs_list", { catalogo })).data ?? [];
  return linhas.map((l) => ({ id: String(l.id), rotulo: String(l[campo] ?? l.id) }));
}

/** Uma linha da tabela. Serve a tela e o bloco completo da impressão. */
// `tr.inativo` já esmaece a linha inteira — o CSS espera a classe no `<tr>`.
const linhaDaTabela = (u: UserListItem) => ({
  classe: u.ativo ? "" : "inativo",
  celulas: [
    u.posto_graduacao,
    u.matricula,
    u.nome,
    u.is_encarregado ? "sim" : "—",
    u.conta_email ?? "sem conta",
    u.conta_perfil ?? "—",
    u.ativo ? "ativo" : "inativo",
    { texto: "", acao: { rotulo: "Abrir", id: u.id } },
  ],
});

const nomeCompleto = (u: UserListItem) => `${u.posto_graduacao} ${u.matricula} ${u.nome}`;

// ── Lista ─────────────────────────────────────────────────────────────

export async function renderListaUsuarios(ctx: ContextoTela): Promise<void> {
  limparFormularioPendente();
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

  const linhas = itens.map(linhaDaTabela);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Usuários <span class="badge">${total}</span></h1>
          <p>Policiais militares. A conta de acesso é opcional.</p></div>
        <div class="page-head-right">
          ${ctx.podeEscrever() ? `<button id="btn-novo">Novo</button>` : ""}
          ${barraDeExportacao({ imprimir: true, csv: !!itens.length })}
        </div>
      </div>

      <form id="busca-usuarios" class="search-bar">
        <input name="q" type="search" placeholder="Buscar por nome ou matrícula..."
               value="${escapeHtml(busca)}" />
        <button type="submit">Buscar</button>
        ${busca ? `<button type="button" class="secondary small" id="limpar-busca">Limpar</button>` : ""}
      </form>

      ${
        resposta.ok
          ? tabela(COLUNAS, linhas, "Nenhum militar cadastrado.", { viewport: true })
          : `<p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar.")}</p>`
      }
      ${paginacao("usuarios", pagina, POR_PAGINA, total)}
    </section>
  `);

  ligarPaginacao("usuarios", pagina, (nova) => {
    pagina = nova;
    void renderListaUsuarios(ctx);
  });

  document.querySelector<HTMLFormElement>("#busca-usuarios")?.addEventListener("submit", (e) => {
    e.preventDefault();
    busca = String(new FormData(e.currentTarget as HTMLFormElement).get("q") ?? "").trim();
    pagina = 1;
    void renderListaUsuarios(ctx);
  });

  document.querySelector<HTMLButtonElement>("#limpar-busca")?.addEventListener("click", () => {
    busca = "";
    pagina = 1;
    void renderListaUsuarios(ctx);
  });

  document.querySelector<HTMLButtonElement>("#btn-novo")?.addEventListener("click", () => {
    void renderFormularioUsuario(ctx, null);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tabela-acao]").forEach((botao) => {
    botao.addEventListener("click", () => {
      detalheAberto = botao.dataset.tabelaAcao ?? null;
      void renderListaUsuarios(ctx);
    });
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
      );
    },
  );
}

// ── Formulário ────────────────────────────────────────────────────────

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
            <select name="posto_graduacao_id" required>
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
              <select name="perfil_id">
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
      { rotulo: "Processo", largura: 22, truncar: true },
      { rotulo: "Apuratório", largura: 24, truncar: true },
      { rotulo: coluna, largura: 24, truncar: true },
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
                 ${inativo ? `<button id="btn-reativar" class="small">Reativar</button>` : ""}`
              : ""
          }
          ${barraDeExportacao({ imprimir: true })}
        </div>
      </div>

      <div class="stat-grid">
        ${painelContagem("Designações por papel", estatisticas?.designacoes_por_papel ?? [], "Papel")}
        ${painelContagem("Designações por apuratório", estatisticas?.designacoes_por_apuratorio ?? [], "Apuratório")}
        ${painelContagem("Envolvimentos por status", estatisticas?.envolvimentos_por_status ?? [], "Status")}
      </div>

      <div class="detail-section">
        <h2>Designado (${designados.length})</h2>
        <p class="hint">
          Uma seção só, e não "como encarregado" e "como escrivão": o papel é
          configuração por apuratório, e separar por nome aqui traria de volta o
          hardcode. A coluna Papel mostra qual foi.
        </p>
        ${tabelaProcessos(designados, "Papel", "papel")}
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

  ligarExportacao();
}
