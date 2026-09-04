// Tela de administração dos catálogos — montada inteiramente a partir de
// `legal_catalogs_definitions`.
//
// A versão anterior tinha 21 `crudConfigs` escritos à mão e ~66 chamadas
// (`legal_catalogs_list_crimes`, `legal_catalogs_save_crime`, …), uma trinca
// por catálogo. O backend passou a expor 7 comandos genéricos sobre um registro
// de metadados, e este módulo consome esse registro: rótulos, tipo de campo,
// catálogo referenciado e o texto que explica o efeito de cada atributo
// semântico saem de lá. Acrescentar um catálogo no Rust passa a fazer a tela
// aparecer sozinha, sem tocar em nada aqui.

import { call, type Catalogo, type Coluna } from "../api";
import {
  aplicarLarguras,
  ativarSelectsPesquisaveis,
  botaoIcone,
  cellDisplay,
  comCarregamento,
  escapeHtml,
  ITENS_POR_PAGINA,
  ligarBuscaInstantanea,
  ligarPaginacao,
  limparFormularioPendente,
  montarModal,
  notificar,
  option,
  paginacao,
  paginaValida,
  podeDescartarFormulario,
  protegerFormulario,
} from "../dom";

/** O que a tela precisa do shell da aplicação, sem importar `main.ts` de volta. */
export type ContextoTela = {
  shell: (html: string) => void;
  podeEscrever: () => boolean;
};

/** Linha de catálogo: as colunas do registro, mais `id` e `ativo`. */
type Linha = Record<string, unknown> & { id: string; ativo: boolean };

let definicoesCache: Catalogo[] | null = null;

/** Carrega e memoriza as definições. Elas não mudam durante a sessão. */
export async function carregarDefinicoes(): Promise<Catalogo[]> {
  if (definicoesCache) return definicoesCache;
  const resposta = await call("legal_catalogs_definitions");
  definicoesCache = resposta.data ?? [];
  return definicoesCache;
}

export function esquecerDefinicoes(): void {
  definicoesCache = null;
}

export const PREFIXO_ROTA = "/catalogos/";

/** Uma rota por catálogo, derivada do registro do backend. */
export function rotasDeCatalogo(definicoes: Catalogo[]) {
  return definicoes.map((cat) => ({
    path: `${PREFIXO_ROTA}${cat.chave}`,
    label: cat.rotulo,
    group: "Catálogos",
  }));
}

export function chaveDaRota(path: string): string | null {
  return path.startsWith(PREFIXO_ROTA) ? path.slice(PREFIXO_ROTA.length) : null;
}

// ── metadados → formulário ──────────────────────────────────────────────────

function ehOpcional(coluna: Coluna): boolean {
  return (
    coluna.tipo === "texto_opcional" ||
    coluna.tipo === "inteiro_opcional" ||
    coluna.tipo === "referencia_opcional"
  );
}

function ehReferencia(coluna: Coluna): boolean {
  return coluna.tipo === "referencia" || coluna.tipo === "referencia_opcional";
}

/**
 * Colunas que a tela mostra.
 *
 * `referencia_fixa` existe no banco e é resolvida pelo backend a partir de um
 * atributo — perguntá-la seria pedir ao administrador que confirme o óbvio.
 * Some da lista, do formulário e do que é enviado ao salvar.
 */
function colunasVisiveis(cat: Catalogo): Coluna[] {
  return cat.colunas.filter((c) => c.tipo !== "referencia_fixa");
}

/**
 * Na listagem, números e booleanos são compactos e ficam centralizados. Texto
 * e referências seguem o alinhamento declarado pelo catálogo; descrições
 * longas permanecem à esquerda para preservar a leitura por varredura.
 */
function classeDadoNaListagem(coluna: Coluna): string {
  const compacto =
    coluna.tipo === "booleano" ||
    coluna.tipo === "inteiro" ||
    coluna.tipo === "inteiro_opcional";
  return `col--trunc${compacto || coluna.centralizar ? " col--centro" : ""}`;
}

/**
 * Rótulo legível de uma linha, para os selects de referência e para a coluna
 * resolvida na tabela.
 *
 * Junta as colunas textuais do catálogo alvo — é o que produz "SR Sindicância
 * Regular" para apuratórios e "I portar-se inconvenientemente…" para
 * transgressões, em vez do UUID cru que a tela antiga mostrava.
 */
function rotuloDaLinha(cat: Catalogo, linha: Linha): string {
  const textuais = cat.colunas
    .filter((c) => c.tipo === "texto" || c.tipo === "texto_opcional")
    .map((c) => String(linha[c.nome] ?? "").trim())
    .filter(Boolean);
  const rotulo = textuais.join(" — ");
  return rotulo || String(linha.id);
}

/** Carrega as opções de todos os catálogos referenciados por este. */
async function carregarReferencias(
  cat: Catalogo,
  definicoes: Catalogo[],
): Promise<Record<string, { value: string; label: string }[]>> {
  const alvos = [...new Set(colunasVisiveis(cat).filter(ehReferencia).map((c) => c.alvo!))];
  const pares = await Promise.all(
    alvos.map(async (alvo) => {
      const destino = definicoes.find((d) => d.chave === alvo);
      // Lista de OPÇÕES: só ativos. A leitura de um registro existente é outra
      // coisa e não filtra `ativo` — um processo de 2019 continua exibindo o
      // catálogo que foi desativado em 2026.
      const resposta = await call("legal_catalogs_list", { catalogo: alvo });
      const linhas = (resposta.data ?? []) as Linha[];
      const opcoes = linhas.map((l) => ({
        value: String(l.id),
        label: destino ? rotuloDaLinha(destino, l) : String(l.id),
      }));
      return [alvo, opcoes] as const;
    }),
  );
  return Object.fromEntries(pares);
}

function campo(
  coluna: Coluna,
  linha: Linha | null,
  referencias: Record<string, { value: string; label: string }[]>,
): string {
  const valor = linha?.[coluna.nome];
  const ajuda = coluna.efeito
    ? `<small class="campo-efeito">${escapeHtml(coluna.efeito)}</small>`
    : "";

  // Campo condicional: enquanto o booleano-porta estiver desmarcado, o campo
  // fica escondido e não é exigido. Quem garante a regra de verdade é o CHECK
  // do banco; aqui é só não pedir o que não se aplica.
  const porta = coluna.visivel_se;
  const abertoAgora = porta ? linha?.[porta] === true : true;
  const marca = porta ? ` data-visivel-se="${escapeHtml(porta)}"` : "";
  const oculto = abertoAgora ? "" : " hidden";
  // Um campo escondido não pode ser `required`: o navegador recusaria enviar o
  // formulário apontando para um campo que ninguém vê.
  const obrigatorio = ehOpcional(coluna) && !porta ? "" : abertoAgora ? " required" : "";

  if (coluna.tipo === "booleano") {
    return `
      <div class="campo"${marca}${oculto}>
        <label class="checkbox">
          <input name="${coluna.nome}" type="checkbox"${valor === true ? " checked" : ""} />
          ${escapeHtml(coluna.rotulo)}
        </label>
        ${ajuda}
      </div>`;
  }

  if (ehReferencia(coluna)) {
    const opcoes = referencias[coluna.alvo ?? ""] ?? [];
    const atual = valor === null || valor === undefined ? "" : String(valor);
    return `
      <div class="campo"${marca}${oculto}>
        <label>${escapeHtml(coluna.rotulo)}
          <select name="${coluna.nome}"${obrigatorio} data-select-pesquisavel>
            <option value=""></option>
            ${opcoes.map((o) => option(o.value, o.label, o.value === atual)).join("")}
          </select>
        </label>
        ${ajuda}
      </div>`;
  }

  const numero = coluna.tipo === "inteiro" || coluna.tipo === "inteiro_opcional";
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `
    <div class="campo"${marca}${oculto}>
      <label>${escapeHtml(coluna.rotulo)}
        <input name="${coluna.nome}" type="${numero ? "number" : "text"}"
               value="${escapeHtml(texto)}"${obrigatorio} />
      </label>
      ${ajuda}
    </div>`;
}

/** FormData → o objeto `valores` que `legal_catalogs_save` espera. */
function montarValores(cat: Catalogo, form: FormData): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const coluna of colunasVisiveis(cat)) {
    // Campo condicional fechado vai como nulo, e não com o que ficou digitado
    // antes de desmarcar: é o que o CHECK do banco exige de um município.
    if (coluna.visivel_se && form.get(coluna.visivel_se) !== "on") {
      valores[coluna.nome] = null;
      continue;
    }
    if (coluna.tipo === "booleano") {
      valores[coluna.nome] = form.get(coluna.nome) === "on";
      continue;
    }
    const bruto = String(form.get(coluna.nome) ?? "").trim();
    if (coluna.tipo === "inteiro" || coluna.tipo === "inteiro_opcional") {
      valores[coluna.nome] = bruto ? Number(bruto) : null;
      continue;
    }
    valores[coluna.nome] = bruto || null;
  }
  return valores;
}

export type CadastroRapidoResultado = {
  id: string;
  rotulo: string;
  valores: Record<string, unknown>;
};

/**
 * Reutiliza o mesmo formulário dirigido por metadados dentro do processo.
 * Não toca na proteção global de formulário: o processo aberto continua sujo
 * antes e depois do modal, e o novo valor passa a fazer parte dele.
 */
export async function abrirCadastroRapidoCatalogo(
  chave: string,
  valoresIniciais: Record<string, unknown> = {},
  gatilho?: HTMLElement | null,
): Promise<CadastroRapidoResultado | null> {
  const definicoes = await carregarDefinicoes();
  const cat = definicoes.find((item) => item.chave === chave);
  if (!cat) {
    notificar("Este cadastro não está disponível. Recarregue a página.", "erro");
    return null;
  }
  const referencias = await carregarReferencias(cat, definicoes);
  const linhaInicial = { id: "", ativo: true, ...valoresIniciais } as Linha;

  return new Promise((resolver) => {
    let finalizado = false;
    let modal: ReturnType<typeof montarModal> = null;
    const concluir = (resultado: CadastroRapidoResultado | null) => {
      if (finalizado) return;
      finalizado = true;
      modal?.fechar();
      resolver(resultado);
    };

    modal = montarModal(
      `<div class="page-head">
         <div><h1>Novo — ${escapeHtml(cat.rotulo)}</h1><p>Cadastre sem sair do apuratório.</p></div>
       </div>
       <div class="feedback feedback--error formulario-feedback" data-erro-cadastro hidden role="alert"></div>
       <form class="crud-form" data-form-cadastro-rapido>
         <fieldset><legend>Dados do registro</legend>
           ${colunasVisiveis(cat).map((coluna) => campo(coluna, linhaInicial, referencias)).join("")}
         </fieldset>
         <div class="form-actions">
           <button type="button" class="secondary" data-fechar-modal>Cancelar</button>
           <button type="submit">Salvar e selecionar</button>
         </div>
       </form>`,
      `Cadastrar ${cat.rotulo}`,
      () => concluir(null),
      gatilho,
    );
    if (!modal) {
      resolver(null);
      return;
    }

    const form = modal.overlay.querySelector<HTMLFormElement>("[data-form-cadastro-rapido]")!;
    for (const alvo of form.querySelectorAll<HTMLElement>("[data-visivel-se]")) {
      const porta = form.querySelector<HTMLInputElement>(
        `input[name="${alvo.dataset.visivelSe}"]`,
      );
      if (!porta) continue;
      const sincronizar = () => {
        alvo.hidden = !porta.checked;
        const entrada = alvo.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
        if (entrada) {
          entrada.required = porta.checked;
          if (!porta.checked) {
            entrada.value = "";
            if (entrada instanceof HTMLSelectElement) entrada.tomselect?.clear(true);
          }
        }
      };
      porta.addEventListener("change", sincronizar);
      sincronizar();
    }
    ativarSelectsPesquisaveis(form);

    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const salvar = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const erro = modal?.overlay.querySelector<HTMLElement>("[data-erro-cadastro]");
      salvar.disabled = true;
      salvar.textContent = "Salvando…";
      const resposta = await call("legal_catalogs_save", {
        request: {
          catalogo: cat.chave,
          id: null,
          valores: montarValores(cat, new FormData(form)),
        },
      });
      if (!resposta.ok || !resposta.data) {
        if (erro) {
          erro.hidden = false;
          erro.textContent = resposta.error ?? "Não foi possível salvar o registro.";
          erro.focus();
        }
        salvar.disabled = false;
        salvar.textContent = "Salvar e selecionar";
        return;
      }
      const gravado = await call("legal_catalogs_get", {
        catalogo: cat.chave,
        id: resposta.data.id,
      });
      const linha = gravado.data as Linha | null;
      if (!linha) {
        if (erro) {
          erro.hidden = false;
          erro.textContent = "O registro foi salvo, mas não pôde ser recarregado.";
        }
        salvar.disabled = false;
        salvar.textContent = "Salvar e selecionar";
        return;
      }
      notificar("Registro cadastrado e selecionado.", "sucesso");
      concluir({
        id: String(linha.id),
        rotulo: rotuloDaLinha(cat, linha),
        valores: linha,
      });
    });
  });
}

// ── telas ───────────────────────────────────────────────────────────────────

type Estado = { incluirInativos: boolean; busca: string; pagina: number; catalogo: string };

/**
 * O estado é da tela, e a tela é uma só para os 25 catálogos.
 *
 * `catalogo` fica guardado junto porque o menu troca de catálogo sem passar por
 * lugar nenhum que pudesse reiniciar a página: ir para a 4ª página de Municípios
 * e clicar em "Postos e graduações" abriria a 4ª página de 13 registros, ou
 * seja, o vazio.
 */
const estado: Estado = { incluirInativos: false, busca: "", pagina: 1, catalogo: "" };

/**
 * O que `renderCatalogo` já carregou do backend, guardado para a pesquisa.
 *
 * A busca é no cliente, mas o render inteiro custa caro: refaz o catálogo **e
 * mais uma consulta por coluna de referência** (`carregarReferencias`, sem
 * cache). Digitar não pode disparar isso a cada tecla.
 *
 * Não envelhece porque nada que muda dado passa por fora do `renderCatalogo`:
 * gravar, desativar e reativar recarregam a tela, e o cache se refaz no mesmo
 * bloco síncrono que redesenha a tela — nunca há tabela de um catálogo com o
 * cache de outro.
 */
let linhasCarregadas: Linha[] = [];
let referenciasCarregadas: Record<string, { value: string; label: string }[]> = {};

/** Cancela a pesquisa pendente ao sair da tela. Ver `dom.ts`. */
let cancelarBusca: (() => void) | null = null;

/** As linhas que o termo alcança. O filtro é o mesmo desde sempre. */
function linhasFiltradas(cat: Catalogo): Linha[] {
  if (!estado.busca) return linhasCarregadas;
  const termo = estado.busca.toLowerCase();
  return linhasCarregadas.filter((l) =>
    colunasVisiveis(cat).some((c) => String(l[c.nome] ?? "").toLowerCase().includes(termo)),
  );
}

/** O rótulo de uma referência, resolvido pelo que o cache trouxe. */
function rotuloReferencia(coluna: Coluna, valor: unknown): string {
  return (
    referenciasCarregadas[coluna.alvo ?? ""]?.find((o) => o.value === String(valor))?.label ??
    (valor === null || valor === undefined ? "" : String(valor))
  );
}

// Listagem administrativa segue o mesmo vazio visual das demais telas. Isso
// torna explícito, por exemplo, que uma linha de município não tem município
// pai porque não representa um distrito.
function valorDaListagem(coluna: Coluna, linha: Linha): string {
  const texto = ehReferencia(coluna)
    ? rotuloReferencia(coluna, linha[coluna.nome])
    : cellDisplay(linha[coluna.nome]);
  return texto || "—";
}

/**
 * A tabela e o controle de página — o que a pesquisa redesenha sozinha.
 *
 * Está separado do resto da tela porque refazer o `shell()` inteiro recriaria
 * o campo de busca e tiraria o foco a cada tecla. Ver
 * `dom.ts::ligarBuscaInstantanea`.
 */
function htmlResultadosCatalogo(cat: Catalogo, podeEscrever: boolean): string {
  const linhas = linhasFiltradas(cat);
  const total = linhas.length;
  const inicio = (estado.pagina - 1) * ITENS_POR_PAGINA;
  const daPagina = linhas.slice(inicio, inicio + ITENS_POR_PAGINA);

  // As colunas de dado repartem o que sobra em partes iguais: o catálogo é
  // genérico e nenhuma tela sabe de antemão quais colunas ele tem. O que se
  // sabe é que Situação e Ações são estreitas e de conteúdo previsível.
  const larguraSituacao = 10;
  const larguraAcoes = podeEscrever ? 10 : 0;
  const larguraDado = (100 - larguraSituacao - larguraAcoes) / colunasVisiveis(cat).length;

  const corpo = daPagina.length
    ? `
      <div class="table-wrap">
        <table class="tabela-dados tabela-dados--fixa tabela-dados--listagem tabela-catalogos">
          <colgroup>
            ${colunasVisiveis(cat)
              .map(() => `<col data-largura="${larguraDado.toFixed(2)}" />`)
              .join("")}
            <col data-largura="${larguraSituacao}" />
            ${podeEscrever ? `<col data-largura="${larguraAcoes}" />` : ""}
          </colgroup>
          <thead>
            <tr>
              ${colunasVisiveis(cat)
                .map((c) => `<th class="col--trunc col--rotulo-quebra">${escapeHtml(c.rotulo)}</th>`)
                .join("")}
              <th class="col--centro col--nowrap">Situação</th>
              ${podeEscrever ? `<th class="col--centro col--nowrap">Ações</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${daPagina
              .map(
                (linha) => `
              <tr${linha.ativo ? "" : ' class="inativo"'}>
                ${colunasVisiveis(cat)
                  .map(
                    (c) =>
                      ((texto) =>
                        `<td class="${classeDadoNaListagem(c)}" title="${escapeHtml(texto)}">${escapeHtml(texto)}</td>`)(
                        valorDaListagem(c, linha),
                      ),
                  )
                  .join("")}
                <td class="col--centro col--nowrap"><span class="badge ${linha.ativo ? "badge--ok" : "badge--neutro"}">${linha.ativo ? "ativo" : "inativo"}</span></td>
                ${
                  podeEscrever
                    ? `<td class="row-actions col--centro col--nowrap">
                         ${botaoIcone("editar", "Editar", { classe: "secondary", dados: { editar: linha.id } })}
                         ${
                           linha.ativo
                             ? botaoIcone("desativar", "Desativar", {
                                 classe: "danger",
                                 dados: { desativar: linha.id },
                               })
                             : botaoIcone("reativar", "Reativar", {
                                 classe: "secondary",
                                 dados: { reativar: linha.id },
                               })
                         }
                       </td>`
                    : ""
                }
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : `<p class="empty">${estado.busca ? "Nenhum registro encontrado." : "Nenhum registro."}</p>`;

  return `${corpo}${paginacao("catalogo", estado.pagina, ITENS_POR_PAGINA, total)}`;
}

/** Religa o que vive dentro da área redesenhada. */
function ligarResultadosCatalogo(cat: Catalogo, ctx: ContextoTela): void {
  ligarPaginacao("catalogo", estado.pagina, (nova) => {
    estado.pagina = nova;
    void atualizarListaCatalogo(cat, ctx);
  });

  if (!ctx.podeEscrever()) return;

  document.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const linha = linhasCarregadas.find((l) => l.id === botao.dataset.editar);
      if (linha) void renderFormulario(cat, linha, ctx);
    });
  });

  // Desativar, não apagar: o item some dos cadastros novos e continua visível
  // nos registros históricos que já o usam.
  //
  // Desativar e reativar **não** redefinem o escopo, e por isso mantêm a
  // página: quem desativou o terceiro item da 4ª página quer continuar ali,
  // não voltar ao começo. Se aquela página tiver deixado de existir, o clamp
  // do render recua uma; é o bastante. E os dois passam pelo `renderCatalogo`
  // inteiro de propósito — mudaram dado, e o cache tem de se refazer.
  document.querySelectorAll<HTMLButtonElement>("[data-desativar]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.dataset.desativar!;
      if (!confirm(`Desativar este item de "${cat.rotulo}"?`)) return;
      // O redesenho do catálogo inteiro é a parte cara, não a gravação: ele
      // refaz o cache e volta ao banco. É por ele que o véu existe aqui.
      await comCarregamento(
        "Desativando…",
        async (passo) => {
          const r = await call("legal_catalogs_deactivate", { catalogo: cat.chave, id });
          if (!r.ok) notificar(r.error ?? "Falha ao desativar.", "erro");
          await passo("Atualizando a lista…");
          await renderCatalogo(cat.chave, ctx);
        },
        botao,
      );
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-reativar]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      await comCarregamento(
        "Reativando…",
        async (passo) => {
          const r = await call("legal_catalogs_reactivate", {
            catalogo: cat.chave,
            id: botao.dataset.reativar!,
          });
          if (!r.ok) notificar(r.error ?? "Falha ao reativar.", "erro");
          await passo("Atualizando a lista…");
          await renderCatalogo(cat.chave, ctx);
        },
        botao,
      );
    });
  });
}

/**
 * Refaz só a área de resultados, com o termo e a página correntes.
 *
 * **Sem carimbo de sequência, e de propósito**: aqui não há ida ao backend —
 * o filtro corre sobre o que o cache já tem, logo não existe resposta atrasada
 * para chegar fora de ordem. O que **não** se pode dispensar é o
 * `aplicarLarguras`: as larguras saem em `data-largura` e quem as aplica é o
 * `shell()`, então trocar o `innerHTML` sem rechamá-lo devolve a tabela ao
 * dimensionamento por conteúdo **sem erro nenhum**.
 */
function atualizarListaCatalogo(cat: Catalogo, ctx: ContextoTela): void {
  const total = linhasFiltradas(cat).length;

  // Estreitar a busca pode deixar a página corrente fora do total, e o rodapé
  // some junto com a tabela: a tela ficaria vazia sem dizer por quê.
  estado.pagina = paginaValida(estado.pagina, ITENS_POR_PAGINA, total);

  const area = document.querySelector<HTMLElement>("#resultados-catalogo");
  if (area) {
    area.innerHTML = htmlResultadosCatalogo(cat, ctx.podeEscrever());
    aplicarLarguras(area);
  }

  const contagem = document.querySelector<HTMLElement>("[data-total-catalogo]");
  if (contagem) contagem.textContent = `${total} registro(s)`;

  const status = document.querySelector<HTMLElement>("#status-pesquisa-catalogo");
  if (status) status.textContent = `${total} resultado(s).`;

  ligarResultadosCatalogo(cat, ctx);
}

export async function renderCatalogo(chave: string, ctx: ContextoTela): Promise<void> {
  // Toda entrada nesta tela — troca de rota, gravação, desativação e reativação — passa por aqui e volta ao
  // banco. O véu mora no render, e não em cada chamador, porque os
  // chamadores são vários e o motivo é um só. Quando o chamador já
  // abriu o véu (a troca de rota, ou uma ação), o helper conta
  // profundidade e este aqui apenas troca a mensagem.
  await comCarregamento("Carregando o catálogo…", () => desenharCatalogo(chave, ctx));
}

async function desenharCatalogo(chave: string, ctx: ContextoTela): Promise<void> {
  limparFormularioPendente();
  cancelarBusca?.();
  const definicoes = await carregarDefinicoes();
  const cat = definicoes.find((d) => d.chave === chave);
  if (!cat) {
    ctx.shell(`<section class="panel"><p class="error">Catálogo desconhecido: ${escapeHtml(chave)}</p></section>`);
    return;
  }

  if (estado.catalogo !== chave) {
    estado.catalogo = chave;
    estado.pagina = 1;
  }

  const resposta = await call("legal_catalogs_list", {
    catalogo: chave,
    incluirInativos: estado.incluirInativos,
  });
  if (!resposta.ok) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar.")}</p></section>`);
    return;
  }

  // O recorte é **no cliente**, e de propósito: `legal_catalogs_list` continua
  // trazendo o catálogo inteiro porque a mesma resposta alimenta os selects de
  // referência de outras telas — paginar no backend truncaria lista de opções,
  // que é justamente o que não pode acontecer (§8.9). É essa resposta que a
  // pesquisa instantânea refiltra, sem voltar ao backend.
  linhasCarregadas = (resposta.data ?? []) as Linha[];
  referenciasCarregadas = await carregarReferencias(cat, definicoes);

  const total = linhasFiltradas(cat).length;
  const corrigida = paginaValida(estado.pagina, ITENS_POR_PAGINA, total);
  if (corrigida !== estado.pagina) {
    estado.pagina = corrigida;
    return renderCatalogo(chave, ctx);
  }

  const podeEscrever = ctx.podeEscrever();

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(cat.rotulo)}</h1>
          <p data-total-catalogo>${total} registro(s)</p>
        </div>
        ${podeEscrever ? `<button id="novo">Novo</button>` : ""}
      </div>
      <div class="filtros">
        <input id="busca" type="search" autocomplete="off"
               aria-label="Pesquisar em ${escapeHtml(cat.rotulo)}" aria-controls="resultados-catalogo"
               placeholder="Filtrar…" value="${escapeHtml(estado.busca)}" />
        <label class="checkbox">
          <input id="inativos" type="checkbox"${estado.incluirInativos ? " checked" : ""} />
          Mostrar inativos
        </label>
        <span id="status-pesquisa-catalogo" class="status-pesquisa" aria-live="polite"></span>
      </div>
      ${podeEscrever ? "" : `<p class="readonly">Perfil somente leitura.</p>`}
      <div id="resultados-catalogo" class="area-resultados">${htmlResultadosCatalogo(cat, podeEscrever)}</div>
    </section>
  `);

  ligarResultadosCatalogo(cat, ctx);

  // Buscar **redefine o escopo**: seguir na 4ª página de um resultado que agora
  // tem 3 linhas mostraria tela vazia sem dizer por quê.
  cancelarBusca = ligarBuscaInstantanea(
    document.querySelector<HTMLInputElement>("#busca"),
    () => atualizarListaCatalogo(cat, ctx),
    {
      aoDigitar: (termo) => {
        estado.busca = termo.trim();
        estado.pagina = 1;
      },
    },
  );

  // "Mostrar inativos" continua refazendo a tela inteira: muda o que o backend
  // traz, não o recorte do que já veio.
  document.querySelector<HTMLInputElement>("#inativos")?.addEventListener("change", (e) => {
    estado.incluirInativos = (e.currentTarget as HTMLInputElement).checked;
    estado.pagina = 1;
    void renderCatalogo(chave, ctx);
  });

  if (!podeEscrever) return;

  document.querySelector<HTMLButtonElement>("#novo")?.addEventListener("click", () => {
    void renderFormulario(cat, null, ctx);
  });
}

async function renderFormulario(
  cat: Catalogo,
  linha: Linha | null,
  ctx: ContextoTela,
  erro = "",
): Promise<void> {
  // O "Novo", o "Editar" e a volta de um erro de gravação passam por aqui,
  // e as definições e as referências do catálogo vêm do banco antes do
  // `shell`. O véu mora no render pelo mesmo motivo das demais telas.
  await comCarregamento("Abrindo o formulário…", () => desenharFormulario(cat, linha, ctx, erro));
}

async function desenharFormulario(
  cat: Catalogo,
  linha: Linha | null,
  ctx: ContextoTela,
  erro = "",
): Promise<void> {
  const definicoes = await carregarDefinicoes();
  const referencias = await carregarReferencias(cat, definicoes);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${linha ? "Editar" : "Novo"} — ${escapeHtml(cat.rotulo)}</h1></div>
      </div>
      <form id="form-catalogo" class="crud-form">
        <fieldset>
          <legend>Dados do registro</legend>
          ${colunasVisiveis(cat).map((c) => campo(c, linha, referencias)).join("")}
        </fieldset>
        ${erro ? `<p class="error">${escapeHtml(erro)}</p>` : ""}
        <div class="form-actions">
          <button type="button" class="secondary" id="cancelar">Cancelar</button>
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#cancelar")?.addEventListener("click", () => {
    if (!podeDescartarFormulario()) return;
    void renderCatalogo(cat.chave, ctx);
  });

  const formulario = document.querySelector<HTMLFormElement>("#form-catalogo")!;
  ativarSelectsPesquisaveis(formulario);
  protegerFormulario(formulario);

  // Cada campo condicional acompanha o seu booleano-porta. Guiado pelo
  // registro: nenhum nome de catálogo ou de coluna aparece aqui.
  for (const alvo of document.querySelectorAll<HTMLElement>("[data-visivel-se]")) {
    const porta = document.querySelector<HTMLInputElement>(
      `input[name="${alvo.dataset.visivelSe}"]`,
    );
    if (!porta) continue;
    const sincronizar = () => {
      alvo.hidden = !porta.checked;
      const entrada = alvo.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
      if (entrada) {
        entrada.required = porta.checked;
        if (!porta.checked) {
          entrada.value = "";
          if (entrada instanceof HTMLSelectElement) entrada.tomselect?.clear(true);
        }
      }
    };
    porta.addEventListener("change", sincronizar);
    sincronizar();
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const salvar = formulario.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    salvar.disabled = true;
    salvar.textContent = "Salvando…";
    const form = new FormData(evento.currentTarget as HTMLFormElement);
    const resposta = await call("legal_catalogs_save", {
      request: {
        catalogo: cat.chave,
        id: linha?.id ?? null,
        valores: montarValores(cat, form),
      },
    });
    if (!resposta.ok) {
      notificar(resposta.error ?? "Falha ao salvar.", "erro");
      salvar.disabled = false;
      salvar.textContent = "Salvar";
      return;
    }
    limparFormularioPendente();
    await renderCatalogo(cat.chave, ctx);
    notificar("Registro salvo com sucesso.", "sucesso");
  });
}
