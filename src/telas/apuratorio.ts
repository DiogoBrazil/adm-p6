// Configuração de um apuratório: quais documentos podem instaurá-lo e quais
// papéis ele usa.
//
// É a porta de entrada dos comandos `apuratorio_config_*`. Sem uma linha em
// `apuratorio_documentos_iniciadores` a FK composta de
// `processos_procedimentos` recusa QUALQUER processo, e sem uma linha em
// `apuratorio_papeis` nenhuma designação é possível — então esta tela é
// pré-requisito para o cadastro de processo funcionar.
//
// As duas tabelas não estão no registro de catálogos de propósito: têm PK
// composta, sem `id` e sem `nome`, e o CRUD genérico pressupõe os dois.

import { call, type ApuratorioConfig } from "../api";
import { escapeHtml, notificar, option } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/configuracao/apuratorios";

type Opcao = { id: string; rotulo: string };

/** Opções ativas de um catálogo, com rótulo montado das colunas textuais. */
async function opcoes(catalogo: string, campos: string[]): Promise<Opcao[]> {
  const resposta = await call("legal_catalogs_list", { catalogo });
  return (resposta.data ?? []).map((linha) => ({
    id: String(linha.id),
    rotulo:
      campos
        .map((c) => String(linha[c] ?? "").trim())
        .filter(Boolean)
        .join(" — ") || String(linha.id),
  }));
}

let apuratorioSelecionado = "";

export async function renderConfiguracaoApuratorio(ctx: ContextoTela): Promise<void> {
  const apuratorios = await opcoes("apuratorios", ["sigla", "nome"]);

  if (apuratorios.length === 0) {
    ctx.shell(`
      <section class="panel">
        <h1>Configuração de apuratórios</h1>
        <p class="empty">
          Nenhum apuratório cadastrado. Cadastre em <strong>Catálogos → Apuratórios</strong>
          antes de configurar documentos e papéis.
        </p>
      </section>`);
    return;
  }

  if (!apuratorios.some((a) => a.id === apuratorioSelecionado)) {
    apuratorioSelecionado = apuratorios[0]!.id;
  }

  const [documentos, papeis, resposta] = await Promise.all([
    opcoes("tipos_documento", ["nome"]),
    opcoes("papeis_processo", ["nome"]),
    call("apuratorio_config_get", { apuratorioId: apuratorioSelecionado }),
  ]);

  const config = resposta.data;
  if (!resposta.ok || !config) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(resposta.error ?? "Falha ao carregar.")}</p></section>`);
    return;
  }

  const podeEscrever = ctx.podeEscrever();
  const naoConfigurados = (todos: Opcao[], usados: Set<string>) =>
    todos.filter((o) => !usados.has(o.id));

  const docsUsados = new Set(config.documentos.map((d) => d.tipo_documento_id));
  const papeisUsados = new Set(config.papeis.map((p) => p.papel_id));

  const semResponsavel = !config.papeis.some((p) => p.e_responsavel && p.ativo);
  const semDocumentoAtivo = !config.documentos.some((d) => d.ativo);

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Configuração de apuratórios</h1>
          <p>Define o que o banco aceita como processo desta espécie.</p>
        </div>
        <label class="seletor-apuratorio">Apuratório
          <select id="apuratorio">
            ${apuratorios.map((a) => option(a.id, a.rotulo, a.id === apuratorioSelecionado)).join("")}
          </select>
        </label>
      </div>

      ${
        semDocumentoAtivo || semResponsavel
          ? `<p class="aviso">
               ${semDocumentoAtivo ? "Sem documento iniciador ativo, nenhum processo pode ser criado neste apuratório. " : ""}
               ${semResponsavel ? "Sem papel responsável ativo, os processos aparecem sem responsável na listagem e nos relatórios." : ""}
             </p>`
          : ""
      }

      <h2>Documentos iniciadores</h2>
      <p class="secao-ajuda">
        O prazo em branco herda os ${config.prazo_base_dias} dias do apuratório.
        Preenchido, sobrepõe — é assim que "Feito Preliminar tem 15 dias" virou dado.
      </p>
      ${
        config.documentos.length
          ? `<div class="table-wrap"><table class="tabela-dados">
               <thead><tr>
                 <th>Documento</th><th>Prazo próprio</th><th>Prazo efetivo</th>
                 <th>Padrão</th><th>Situação</th><th>Em uso</th>
                 ${podeEscrever ? "<th>Ações</th>" : ""}
               </tr></thead>
               <tbody>
                 ${config.documentos
                   .map(
                     (d) => `
                   <tr${d.ativo ? "" : ' class="inativo"'}>
                     <td>${escapeHtml(d.tipo_documento)}</td>
                     <td>${d.prazo_base_dias ?? "—"}</td>
                     <td>${d.prazo_efetivo_dias} dias</td>
                     <td>${d.padrao ? "sim" : ""}</td>
                     <td><span class="badge ${d.ativo ? "badge--ok" : "badge--neutro"}">${d.ativo ? "ativo" : "inativo"}</span></td>
                     <td>${d.em_uso ? "sim" : ""}</td>
                     ${
                       podeEscrever
                         ? `<td class="row-actions">
                              ${
                                d.ativo
                                  ? `<button class="danger small" data-desativar-doc="${escapeHtml(d.tipo_documento_id)}">Desativar</button>`
                                  : `<button class="secondary small" data-reativar-doc="${escapeHtml(d.tipo_documento_id)}">Reativar</button>`
                              }
                              ${d.ativo && !d.padrao ? `<button class="secondary small" data-padrao-doc="${escapeHtml(d.tipo_documento_id)}">Tornar padrão</button>` : ""}
                            </td>`
                         : ""
                     }
                   </tr>`,
                   )
                   .join("")}
               </tbody></table></div>`
          : `<p class="empty">Nenhum documento iniciador habilitado.</p>`
      }
      ${
        podeEscrever
          ? `<form id="form-doc" class="linha-form">
               <label>Habilitar documento
                 <select name="tipo_documento_id" required>
                   <option value=""></option>
                   ${naoConfigurados(documentos, docsUsados).map((o) => option(o.id, o.rotulo, false)).join("")}
                 </select>
               </label>
               <label>Prazo próprio (dias)<input name="prazo_base_dias" type="number" min="1" placeholder="herda" /></label>
               <label class="checkbox"><input name="padrao" type="checkbox" /> Padrão</label>
               <button type="submit">Habilitar</button>
             </form>`
          : ""
      }

      <h2>Papéis</h2>
      <p class="secao-ajuda">
        <strong>Obrigatório</strong> impede salvar o processo sem a designação.
        <strong>Responsável</strong> é o papel que responde pelo apuratório — é
        dele que saem o responsável da listagem, do dashboard e dos relatórios,
        e só pode haver um.
      </p>
      ${
        config.papeis.length
          ? `<div class="table-wrap"><table class="tabela-dados">
               <thead><tr>
                 <th>Papel</th><th>Obrigatório</th><th>Máx. ocupantes</th>
                 <th>Responsável</th><th>Situação</th><th>Em uso</th>
                 ${podeEscrever ? "<th>Ações</th>" : ""}
               </tr></thead>
               <tbody>
                 ${config.papeis
                   .map(
                     (p) => `
                   <tr${p.ativo ? "" : ' class="inativo"'}>
                     <td>${escapeHtml(p.papel)}</td>
                     <td>${p.obrigatorio ? "sim" : ""}</td>
                     <td>${p.max_ocupantes}</td>
                     <td>${p.e_responsavel ? "sim" : ""}</td>
                     <td><span class="badge ${p.ativo ? "badge--ok" : "badge--neutro"}">${p.ativo ? "ativo" : "inativo"}</span></td>
                     <td>${p.em_uso ? "sim" : ""}</td>
                     ${
                       podeEscrever
                         ? `<td class="row-actions">
                              ${
                                p.ativo
                                  ? `<button class="danger small" data-desativar-papel="${escapeHtml(p.papel_id)}">Desativar</button>`
                                  : `<button class="secondary small" data-reativar-papel="${escapeHtml(p.papel_id)}">Reativar</button>`
                              }
                              ${p.ativo && !p.e_responsavel ? `<button class="secondary small" data-responsavel="${escapeHtml(p.papel_id)}">Tornar responsável</button>` : ""}
                            </td>`
                         : ""
                     }
                   </tr>`,
                   )
                   .join("")}
               </tbody></table></div>`
          : `<p class="empty">Nenhum papel habilitado.</p>`
      }
      ${
        podeEscrever
          ? `<form id="form-papel" class="linha-form">
               <label>Habilitar papel
                 <select name="papel_id" required>
                   <option value=""></option>
                   ${naoConfigurados(papeis, papeisUsados).map((o) => option(o.id, o.rotulo, false)).join("")}
                 </select>
               </label>
               <label>Máx. ocupantes<input name="max_ocupantes" type="number" min="1" value="1" required /></label>
               <label class="checkbox"><input name="obrigatorio" type="checkbox" /> Obrigatório</label>
               <label class="checkbox"><input name="e_responsavel" type="checkbox" /> Responsável</label>
               <button type="submit">Habilitar</button>
             </form>`
          : `<p class="readonly">Perfil somente leitura.</p>`
      }
    </section>
  `);

  const recarregar = () => void renderConfiguracaoApuratorio(ctx);

  document.querySelector<HTMLSelectElement>("#apuratorio")?.addEventListener("change", (e) => {
    apuratorioSelecionado = (e.currentTarget as HTMLSelectElement).value;
    recarregar();
  });

  if (!podeEscrever) return;

  const reportar = (ok: boolean, erro: string | null) => {
    if (!ok) notificar(erro ?? "Falha ao salvar.", "erro");
    recarregar();
  };

  const salvarDoc = async (
    tipoDocumentoId: string,
    campos: { prazoBaseDias?: number | null; padrao?: boolean; ativo?: boolean },
  ) => {
    const atual = config.documentos.find((d) => d.tipo_documento_id === tipoDocumentoId);
    const r = await call("apuratorio_config_save_documento", {
      request: {
        apuratorio_id: apuratorioSelecionado,
        tipo_documento_id: tipoDocumentoId,
        prazo_base_dias: campos.prazoBaseDias ?? atual?.prazo_base_dias ?? null,
        padrao: campos.padrao ?? atual?.padrao ?? false,
        ativo: campos.ativo ?? atual?.ativo ?? true,
      },
    });
    reportar(r.ok, r.error);
  };

  document.querySelector<HTMLFormElement>("#form-doc")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget as HTMLFormElement);
    const prazo = String(form.get("prazo_base_dias") ?? "").trim();
    await salvarDoc(String(form.get("tipo_documento_id")), {
      prazoBaseDias: prazo ? Number(prazo) : null,
      padrao: form.get("padrao") === "on",
      ativo: true,
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-padrao-doc]").forEach((b) =>
    b.addEventListener("click", () => void salvarDoc(b.dataset.padraoDoc!, { padrao: true })),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-reativar-doc]").forEach((b) =>
    b.addEventListener("click", () => void salvarDoc(b.dataset.reativarDoc!, { ativo: true })),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-desativar-doc]").forEach((b) =>
    b.addEventListener("click", async () => {
      const r = await call("apuratorio_config_deactivate_documento", {
        apuratorioId: apuratorioSelecionado,
        tipoDocumentoId: b.dataset.desativarDoc!,
      });
      reportar(r.ok, r.error);
    }),
  );

  const salvarPapel = async (
    papelId: string,
    campos: {
      obrigatorio?: boolean;
      maxOcupantes?: number;
      eResponsavel?: boolean;
      ativo?: boolean;
    },
  ) => {
    const atual = config.papeis.find((p) => p.papel_id === papelId);
    const r = await call("apuratorio_config_save_papel", {
      request: {
        apuratorio_id: apuratorioSelecionado,
        papel_id: papelId,
        obrigatorio: campos.obrigatorio ?? atual?.obrigatorio ?? false,
        max_ocupantes: campos.maxOcupantes ?? atual?.max_ocupantes ?? 1,
        e_responsavel: campos.eResponsavel ?? atual?.e_responsavel ?? false,
        ativo: campos.ativo ?? atual?.ativo ?? true,
      },
    });
    reportar(r.ok, r.error);
  };

  document.querySelector<HTMLFormElement>("#form-papel")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget as HTMLFormElement);
    await salvarPapel(String(form.get("papel_id")), {
      obrigatorio: form.get("obrigatorio") === "on",
      maxOcupantes: Number(form.get("max_ocupantes") ?? 1),
      eResponsavel: form.get("e_responsavel") === "on",
      ativo: true,
    });
  });

  // O backend exige que o responsável seja obrigatório e ativo; mandar os três
  // juntos evita um erro de validação que o usuário não teria como adivinhar.
  document.querySelectorAll<HTMLButtonElement>("[data-responsavel]").forEach((b) =>
    b.addEventListener("click", () =>
      void salvarPapel(b.dataset.responsavel!, {
        eResponsavel: true,
        obrigatorio: true,
        ativo: true,
      }),
    ),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-reativar-papel]").forEach((b) =>
    b.addEventListener("click", () => void salvarPapel(b.dataset.reativarPapel!, { ativo: true })),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-desativar-papel]").forEach((b) =>
    b.addEventListener("click", async () => {
      const r = await call("apuratorio_config_deactivate_papel", {
        apuratorioId: apuratorioSelecionado,
        papelId: b.dataset.desativarPapel!,
      });
      reportar(r.ok, r.error);
    }),
  );
}
