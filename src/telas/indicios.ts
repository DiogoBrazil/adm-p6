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
import { escapeHtml, option } from "../dom";
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

    const buscar = <T extends { id: string; rotulo: string }>(
      inputId: string,
      destinoId: string,
      procurar: (termo: string) => Promise<T[]>,
      escolher: (item: T) => void | Promise<void>,
    ) => {
      const input = document.querySelector<HTMLInputElement>(`#${inputId}`);
      const destino = document.querySelector<HTMLDivElement>(`#${destinoId}`);
      input?.addEventListener("input", async () => {
        const termo = input.value.trim();
        if (termo.length < 2 || !destino) {
          if (destino) destino.innerHTML = "";
          return;
        }
        const achados = await procurar(termo);
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
      });
    };

    if (!ctx.podeEscrever()) return;

    buscar(
      "busca-penal",
      "res-penal",
      (termo) => call("evidence_search_infracoes_penais", { termo }).then((r) => r.data ?? []),
      (item) => {
        const esfera = esferas[0];
        if (!esfera) return;
        selecao.penais.push({ infracao_penal_id: item.id, esfera_penal_id: esfera.id });
      },
    );

    buscar(
      "busca-transg",
      "res-transg",
      (termo) => call("evidence_search_transgressoes", { termo }).then((r) => r.data ?? []),
      (item) => {
        if (!selecao.transgressoes.includes(item.id)) selecao.transgressoes.push(item.id);
      },
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
        alert(r.error ?? "Falha ao salvar.");
        return;
      }
      voltar();
    });
  };

  desenhar();
}

/** Escolha da transgressão usada como analogia. Obrigatória por regra do modelo. */
async function pedirAnalogia(rotulos: Rotulos): Promise<string | null> {
  const termo = prompt("Transgressão do RDPM usada como analogia (busque por inciso ou texto):");
  if (!termo) return null;
  const achados = (await call("evidence_search_transgressoes", { termo })).data ?? [];
  if (achados.length === 0) {
    alert("Nenhuma transgressão encontrada.");
    return null;
  }
  const escolha = prompt(
    `Escolha o número:\n${achados.map((a, i) => `${i + 1}. ${a.rotulo}`).join("\n")}`,
  );
  const indice = Number(escolha) - 1;
  const item = achados[indice];
  if (!item) return null;
  rotulos[item.id] = item.rotulo;
  return item.id;
}
