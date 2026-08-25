// Indícios e enquadramento de um envolvido.
//
// DUAS REGRAS DO MODELO QUE ESTA TELA PRECISA RESPEITAR
//
// 1. A esfera penal (militar/comum) é escolhida NO VÍNCULO, não no catálogo do
//    artigo. Pelo art. 9º do CPM o mesmo artigo pode ser militar ou comum
//    conforme as circunstâncias do fato — por isso cada infração penal
//    selecionada carrega a sua esfera.
// 2. Toda infração estatutária EXIGE uma transgressão do RDPM por analogia.
//    É `NOT NULL` no banco; aqui é campo obrigatório ao lado da infração.
//
// A tela antiga tinha cinco tabelas de enquadramento e quatro categorias de
// indício codificadas em Rust (`crimes_cpm`, `transgressoes_rdpm`,
// `transgressoes_art29`, `sem_indicios`) que não batiam com os dados reais.
// Agora são três vínculos e um catálogo administrável.

import {
  call,
  type CategoriaIndicioItem,
  type SelecaoInfracaoEstatuto,
  type SelecaoInfracaoPenal,
} from "../api";
import { escapeHtml, notificar, option } from "../dom";
import type { ContextoTela } from "./catalogos";

type Selecao = {
  categorias: string[];
  penais: SelecaoInfracaoPenal[];
  transgressoes: string[];
  estatuto: SelecaoInfracaoEstatuto[];
};

type Rotulos = Record<string, string>;

export async function renderIndicios(
  ctx: ContextoTela,
  envolvidoId: string,
  voltar: () => void,
): Promise<void> {
  const [dados, categorias, esferas] = await Promise.all([
    call("evidence_load_for_pm", { envolvidoId }).then((r) => r.data),
    call("legal_catalogs_list", { catalogo: "categorias_indicio" }).then((r) =>
      (r.data ?? []).map((l) => ({
        id: String(l.id),
        nome: String(l.nome ?? ""),
        indica_ausencia: l.indica_ausencia === true,
      })),
    ),
    call("legal_catalogs_list", { catalogo: "esferas_penais" }).then((r) =>
      (r.data ?? []).map((l) => ({ id: String(l.id), nome: String(l.nome ?? "") })),
    ),
  ]);

  if (!dados) {
    ctx.shell(`<section class="panel"><p class="error">Envolvido não encontrado.</p></section>`);
    return;
  }

  const selecao: Selecao = {
    categorias: dados.categorias.map((c) => c.id),
    penais: dados.infracoes_penais.map((i) => ({
      infracao_penal_id: i.infracao_penal_id,
      esfera_penal_id: i.esfera_penal_id,
    })),
    transgressoes: dados.transgressoes.map((t) => t.id),
    estatuto: dados.infracoes_estatuto.map((i) => ({
      infracao_estatuto_id: i.infracao_estatuto_id,
      analogia_transgressao_id: i.analogia_transgressao_id,
    })),
  };

  const rotulos: Rotulos = {};
  for (const i of dados.infracoes_penais) rotulos[i.infracao_penal_id] = i.rotulo;
  for (const t of dados.transgressoes) rotulos[t.id] = t.rotulo;
  for (const i of dados.infracoes_estatuto) {
    rotulos[i.infracao_estatuto_id] = i.rotulo;
    rotulos[i.analogia_transgressao_id] = i.analogia_rotulo;
  }

  // "Não houve indícios" não coexiste com enquadramento: é o que
  // `categorias_indicio.indica_ausencia` significa.
  const ausencia = (c: CategoriaIndicioItem) => c.indica_ausencia;

  const desenhar = () => {
    const marcouAusencia = selecao.categorias.some((id) =>
      categorias.find((c) => c.id === id && ausencia(c)),
    );

    ctx.shell(`
      <section class="panel">
        <div class="page-head">
          <div><h1>Indícios e enquadramento</h1></div>
          <div class="actions">
            <button class="secondary" id="voltar">Voltar</button>
            ${ctx.podeEscrever() ? `<button id="salvar">Salvar</button>` : ""}
          </div>
        </div>

        <h2>Categorias</h2>
        <div class="linha-form">
          ${categorias
            .map(
              (c) => `<label class="checkbox">
                <input type="checkbox" data-categoria="${escapeHtml(c.id)}"${selecao.categorias.includes(c.id) ? " checked" : ""} />
                ${escapeHtml(c.nome)}${c.indica_ausencia ? " <small>(exclusiva)</small>" : ""}
              </label>`,
            )
            .join("")}
        </div>
        ${marcouAusencia ? `<p class="aviso">Categoria de ausência marcada: o enquadramento abaixo deve ficar vazio.</p>` : ""}

        <h2>Infrações penais</h2>
        <p class="secao-ajuda">A esfera é do caso, não do artigo: o mesmo tipo penal pode ser militar ou comum conforme as circunstâncias (art. 9º do CPM).</p>
        <div id="lista-penais" class="lista-vinculos">
          ${selecao.penais
            .map(
              (p, i) => `<div class="vinculo">
                <span>${escapeHtml(rotulos[p.infracao_penal_id] ?? p.infracao_penal_id)}</span>
                <label>Esfera
                  <select data-esfera="${i}">
                    ${esferas.map((e) => option(e.id, e.nome, e.id === p.esfera_penal_id)).join("")}
                  </select>
                </label>
                <button class="danger small" data-rm-penal="${i}">×</button>
              </div>`,
            )
            .join("")}
        </div>
        <div class="linha-form">
          <label>Buscar artigo<input id="busca-penal" placeholder="artigo ou descrição" /></label>
          <label>Dispositivo
            <select id="filtro-penal"><option value="">Todos</option></select>
          </label>
          <div id="res-penal" class="resultados"></div>
        </div>

        <h2>Transgressões do RDPM</h2>
        <div id="lista-transgressoes" class="lista-vinculos">
          ${selecao.transgressoes
            .map(
              (id, i) => `<div class="vinculo">
                <span>${escapeHtml(rotulos[id] ?? id)}</span>
                <button class="danger small" data-rm-transg="${i}">×</button>
              </div>`,
            )
            .join("")}
        </div>
        <div class="linha-form">
          <label>Buscar transgressão<input id="busca-transg" placeholder="inciso ou texto" /></label>
          <label>Natureza
            <select id="filtro-transg"><option value="">Todas</option></select>
          </label>
          <div id="res-transg" class="resultados"></div>
        </div>

        <h2>Infrações do Estatuto</h2>
        <p class="secao-ajuda">Toda infração estatutária exige uma transgressão do RDPM por analogia — é regra universal, e o banco recusa gravar sem ela.</p>
        <div id="lista-estatuto" class="lista-vinculos">
          ${selecao.estatuto
            .map(
              (e, i) => `<div class="vinculo">
                <span>${escapeHtml(rotulos[e.infracao_estatuto_id] ?? e.infracao_estatuto_id)}</span>
                <span class="analogia">analogia: ${escapeHtml(rotulos[e.analogia_transgressao_id] ?? "—")}</span>
                <button class="secondary small" data-analogia="${i}">Trocar analogia</button>
                <button class="danger small" data-rm-est="${i}">×</button>
              </div>`,
            )
            .join("")}
        </div>
        <div class="linha-form">
          <label>Buscar infração<input id="busca-est" placeholder="artigo, inciso ou texto" /></label>
          <div id="res-est" class="resultados"></div>
        </div>
      </section>
    `);

    document.querySelector("#voltar")?.addEventListener("click", voltar);

    document.querySelectorAll<HTMLInputElement>("[data-categoria]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const id = cb.dataset.categoria!;
        selecao.categorias = cb.checked
          ? [...selecao.categorias, id]
          : selecao.categorias.filter((x) => x !== id);
        desenhar();
      }),
    );

    document.querySelectorAll<HTMLSelectElement>("[data-esfera]").forEach((sel) =>
      sel.addEventListener("change", () => {
        const item = selecao.penais[Number(sel.dataset.esfera)];
        if (item) item.esfera_penal_id = sel.value;
      }),
    );

    const removedor = (attr: string, aplicar: (i: number) => void) =>
      document.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) =>
        b.addEventListener("click", () => {
          aplicar(Number(b.getAttribute(attr)));
          desenhar();
        }),
      );
    removedor("data-rm-penal", (i) => selecao.penais.splice(i, 1));
    removedor("data-rm-transg", (i) => selecao.transgressoes.splice(i, 1));
    removedor("data-rm-est", (i) => selecao.estatuto.splice(i, 1));

    // `filtroId` é opcional e nomeia um `<select>` ao lado da busca. O valor
    // escolhido vai para `procurar` como segundo argumento — é assim que os
    // filtros que o backend sempre aceitou passam a ser usados de verdade.
    const buscar = <T extends { id: string; rotulo: string }>(
      inputId: string,
      destinoId: string,
      procurar: (termo: string, filtro: string | null) => Promise<T[]>,
      escolher: (item: T) => void | Promise<void>,
      filtroId?: string,
    ) => {
      const input = document.querySelector<HTMLInputElement>(`#${inputId}`);
      const destino = document.querySelector<HTMLDivElement>(`#${destinoId}`);
      const filtro = filtroId
        ? document.querySelector<HTMLSelectElement>(`#${filtroId}`)
        : null;

      // Carimbo de sequência: cada tecla dispara uma consulta, e sem ele a
      // resposta atrasada de um termo antigo sobrescreve a lista do atual. O
      // seletor de analogia já fazia isso; estas três buscas, não.
      let sequencia = 0;

      const rodar = async () => {
        const termo = input?.value.trim() ?? "";
        if (!destino) return;
        if (termo.length < 2) {
          destino.innerHTML = "";
          return;
        }
        const minha = ++sequencia;
        const achados = await procurar(termo, filtro?.value || null);
        if (minha !== sequencia) return;
        destino.innerHTML = achados
          .map((a) => `<button type="button" class="secondary small" data-escolher="${escapeHtml(a.id)}">${escapeHtml(a.rotulo)}</button>`)
          .join("");
        destino.querySelectorAll<HTMLButtonElement>("[data-escolher]").forEach((b) =>
          b.addEventListener("click", async () => {
            const item = achados.find((a) => a.id === b.dataset.escolher);
            if (!item) return;
            rotulos[item.id] = item.rotulo;
            await escolher(item);
            desenhar();
          }),
        );
      };

      input?.addEventListener("input", () => void rodar());
      filtro?.addEventListener("change", () => void rodar());
    };

    if (!ctx.podeEscrever()) return;

    // Os dois filtros saem de catálogo, como tudo mais: nenhum nome de
    // dispositivo ou de natureza escrito aqui. Cadastrar um quinto dispositivo
    // o faz aparecer sozinho. Ver §3.1 do guia.
    const popular = (seletor: string, catalogo: string) =>
      void call("legal_catalogs_list", { catalogo }).then((r) => {
        const alvo = document.querySelector<HTMLSelectElement>(`#${seletor}`);
        for (const linha of r.data ?? []) {
          const id = String(linha.id ?? "");
          const nome = String(linha.nome ?? "");
          if (id && nome) alvo?.insertAdjacentHTML("beforeend", option(id, nome, false));
        }
      });
    popular("filtro-penal", "dispositivos_legais");
    popular("filtro-transg", "naturezas_transgressao");

    buscar(
      "busca-penal",
      "res-penal",
      (termo, dispositivoLegalId) =>
        call("evidence_search_infracoes_penais", { termo, dispositivoLegalId }).then(
          (r) => r.data ?? [],
        ),
      (item) => {
        const esfera = esferas[0];
        if (!esfera) return;
        selecao.penais.push({ infracao_penal_id: item.id, esfera_penal_id: esfera.id });
      },
      "filtro-penal",
    );

    buscar(
      "busca-transg",
      "res-transg",
      (termo, naturezaId) =>
        call("evidence_search_transgressoes", { termo, naturezaId }).then((r) => r.data ?? []),
      (item) => {
        if (!selecao.transgressoes.includes(item.id)) selecao.transgressoes.push(item.id);
      },
      "filtro-transg",
    );

    buscar(
      "busca-est",
      "res-est",
      (termo) => call("evidence_search_infracoes_estatuto", { termo }).then((r) => r.data ?? []),
      async (item) => {
        const analogia = await pedirAnalogia(rotulos);
        if (!analogia) return;
        selecao.estatuto.push({
          infracao_estatuto_id: item.id,
          analogia_transgressao_id: analogia,
        });
      },
    );

    document.querySelectorAll<HTMLButtonElement>("[data-analogia]").forEach((b) =>
      b.addEventListener("click", async () => {
        const item = selecao.estatuto[Number(b.dataset.analogia)];
        if (!item) return;
        const analogia = await pedirAnalogia(rotulos);
        if (analogia) item.analogia_transgressao_id = analogia;
        desenhar();
      }),
    );

    document.querySelector("#salvar")?.addEventListener("click", async () => {
      const r = await call("evidence_save_for_pm", {
        request: {
          envolvido_id: envolvidoId,
          categorias_ids: selecao.categorias,
          infracoes_penais: selecao.penais,
          transgressoes_ids: selecao.transgressoes,
          infracoes_estatuto: selecao.estatuto,
        },
      });
      if (!r.ok) {
        notificar(r.error ?? "Falha ao salvar.", "erro");
        return;
      }
      voltar();
    });
  };

  desenhar();
}

/**
 * Escolha da transgressão usada como analogia. Obrigatória por regra do modelo.
 *
 * Já foram dois `prompt()` do navegador — um para o termo, outro para "digite o
 * número da opção". Era a única tela do sistema que pedia um número digitado, e
 * a que mais precisava não pedir: escolher o inciso análogo é classificação
 * jurídica, e quem escolhe quer LER as opções antes.
 *
 * A busca é a mesma que a tela já usava (`evidence_search_transgressoes`), com
 * o filtro opcional por natureza que o comando sempre aceitou e ninguém expunha
 * — é por gravidade que se procura o inciso análogo.
 *
 * Devolve `null` quando o usuário desiste, e os dois pontos de chamada tratam
 * `null` como "não mexe em nada". É o comportamento certo: a analogia é
 * `NOT NULL`, então metade de uma escolha não pode virar registro.
 */
function pedirAnalogia(rotulos: Rotulos): Promise<string | null> {
  return new Promise((resolver) => {
    // Dois cliques rápidos em "Trocar analogia" empilhariam dois seletores —
    // cada um resolvendo a sua Promise, e o de baixo escondido. Um por vez.
    if (document.querySelector(".modal-overlay")) {
      resolver(null);
      return;
    }

    // Montado em `document.body`, e não em `#app`: `desenhar()` reescreve o
    // `#app` inteiro, e o seletor montado lá seria destruído no meio do fluxo.
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal panel" role="dialog" aria-modal="true" aria-label="Escolher transgressão análoga">
        <div class="page-head">
          <div>
            <h1>Transgressão análoga</h1>
            <p>Busque por inciso ou pelo texto e escolha uma da lista.</p>
          </div>
        </div>
        <div class="linha-form">
          <label>Buscar<input id="analogia-termo" placeholder="inciso ou texto" autocomplete="off" /></label>
          <label>Natureza
            <select id="analogia-natureza"><option value="">Todas</option></select>
          </label>
        </div>
        <div id="analogia-resultados" class="evidence-results">
          <p class="empty">Digite ao menos 2 caracteres.</p>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary" id="analogia-cancelar">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // O overlay sai ANTES de resolver: quem chamou segue direto para
    // `desenhar()`, e um seletor ainda pendurado apareceria sobre a tela nova.
    let encerrado = false;
    const encerrar = (escolhido: string | null) => {
      if (encerrado) return;
      encerrado = true;
      document.removeEventListener("keydown", aoTeclar);
      overlay.remove();
      resolver(escolhido);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") encerrar(null);
    };
    document.addEventListener("keydown", aoTeclar);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) encerrar(null);
    });
    overlay.querySelector("#analogia-cancelar")?.addEventListener("click", () => encerrar(null));

    const entrada = overlay.querySelector<HTMLInputElement>("#analogia-termo");
    const filtro = overlay.querySelector<HTMLSelectElement>("#analogia-natureza");
    const destino = overlay.querySelector<HTMLDivElement>("#analogia-resultados");

    // A natureza é catálogo, como tudo mais: nada de "leve/média/grave" no
    // código. Se o cadastro ganhar uma quarta, ela aparece aqui sozinha.
    void call("legal_catalogs_list", { catalogo: "naturezas_transgressao" }).then((r) => {
      for (const linha of r.data ?? []) {
        const id = String(linha.id ?? "");
        const nome = String(linha.nome ?? "");
        if (id && nome) filtro?.insertAdjacentHTML("beforeend", option(id, nome, false));
      }
    });

    let sequencia = 0;
    const buscar = async () => {
      const termo = entrada?.value.trim() ?? "";
      if (!destino) return;
      if (termo.length < 2) {
        destino.innerHTML = `<p class="empty">Digite ao menos 2 caracteres.</p>`;
        return;
      }
      // Cada tecla dispara uma busca; sem o carimbo, uma resposta atrasada de
      // um termo antigo sobrescreveria a lista do termo atual.
      const minha = ++sequencia;
      const naturezaId = filtro?.value || null;
      const achados = (await call("evidence_search_transgressoes", { termo, naturezaId })).data ?? [];
      if (minha !== sequencia || encerrado) return;
      if (achados.length === 0) {
        destino.innerHTML = `<p class="empty">Nenhuma transgressão encontrada.</p>`;
        return;
      }
      destino.innerHTML = achados
        .map(
          (a) =>
            `<button type="button" class="evidence-result-item" data-escolher="${escapeHtml(a.id)}">${escapeHtml(a.rotulo)}</button>`,
        )
        .join("");
      destino.querySelectorAll<HTMLButtonElement>("[data-escolher]").forEach((b) =>
        b.addEventListener("click", () => {
          const item = achados.find((a) => a.id === b.dataset.escolher);
          if (!item) return;
          rotulos[item.id] = item.rotulo;
          encerrar(item.id);
        }),
      );
    };

    entrada?.addEventListener("input", () => void buscar());
    filtro?.addEventListener("change", () => void buscar());
    entrada?.focus();
  });
}
