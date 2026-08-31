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
import { botaoIcone, escapeHtml, notificar, option } from "../dom";
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
          antes de configurar documentos e funções.
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
          <p>Define o que o banco aceita como apuratório desta espécie.</p>
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
               ${semDocumentoAtivo ? "Sem documento iniciador ativo, nenhum registro pode ser criado neste apuratório. " : ""}
               ${semResponsavel ? "Sem função responsável ativa, os apuratórios aparecem sem responsável na listagem e nos relatórios." : ""}
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
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-configuracao-apuratorio">
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
                                  ? botaoIcone("desativar", "Desativar", {
                                      classe: "danger",
                                      dados: { "desativar-doc": d.tipo_documento_id },
                                    })
                                  : botaoIcone("reativar", "Reativar", {
                                      classe: "secondary",
                                      dados: { "reativar-doc": d.tipo_documento_id },
                                    })
                              }
                              ${
                                d.ativo && !d.padrao
                                  ? botaoIcone("padrao", "Tornar padrão", {
                                      classe: "secondary",
                                      dados: { "padrao-doc": d.tipo_documento_id },
                                    })
                                  : ""
                              }
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

      <h2>Funções</h2>
      <p class="secao-ajuda">
        <strong>Obrigatório</strong> impede salvar o apuratório sem a designação.
        <strong>Responsável</strong> é a função que responde pelo apuratório — é
        dele que saem o responsável da listagem, do dashboard e dos relatórios,
        e só pode haver um. <strong>Cita documento</strong> diz se a designação
        desta função informa tipo e número do documento que a autorizou; desligado,
        o detalhe do apuratório mostra apenas “-” e o formulário de substituição
        deixa de pedir os dois campos.
      </p>
      ${
        config.papeis.length
          ? `<div class="table-wrap"><table class="tabela-dados tabela-dados--listagem tabela-configuracao-apuratorio">
               <thead><tr>
                 <th>Função</th><th>Obrigatória</th><th>Máx. ocupantes</th>
                 <th>Responsável</th><th>Cita documento</th><th>Situação</th><th>Em uso</th>
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
                     <td>${p.usa_documento_designacao ? "sim" : ""}</td>
                     <td><span class="badge ${p.ativo ? "badge--ok" : "badge--neutro"}">${p.ativo ? "ativo" : "inativo"}</span></td>
                     <td>${p.em_uso ? "sim" : ""}</td>
                     ${
                       podeEscrever
                         ? `<td class="row-actions">
                              ${
                                p.ativo
                                  ? botaoIcone("desativar", "Desativar", {
                                      classe: "danger",
                                      dados: { "desativar-papel": p.papel_id },
                                    })
                                  : botaoIcone("reativar", "Reativar", {
                                      classe: "secondary",
                                      dados: { "reativar-papel": p.papel_id },
                                    })
                              }
                              ${
                                p.ativo && !p.e_responsavel
                                  ? botaoIcone("padrao", "Tornar responsável", {
                                      classe: "secondary",
                                      dados: { responsavel: p.papel_id },
                                    })
                                  : ""
                              }
                              ${botaoIcone(
                                "editar",
                                p.usa_documento_designacao
                                  ? "Deixar de citar documento"
                                  : "Passar a citar documento",
                                {
                                  classe: "secondary",
                                  dados: { "documento-papel": p.papel_id },
                                },
                              )}
                            </td>`
                         : ""
                     }
                   </tr>`,
                   )
                   .join("")}
               </tbody></table></div>`
          : `<p class="empty">Nenhuma função habilitada.</p>`
      }
      ${
        podeEscrever
          ? `<form id="form-papel" class="linha-form">
               <label>Habilitar função
                 <select name="papel_id" required>
                   <option value=""></option>
                   ${naoConfigurados(papeis, papeisUsados).map((o) => option(o.id, o.rotulo, false)).join("")}
                 </select>
               </label>
               <label>Máx. ocupantes<input name="max_ocupantes" type="number" min="1" value="1" required /></label>
               <label class="checkbox"><input name="obrigatorio" type="checkbox" /> Obrigatória</label>
               <label class="checkbox"><input name="e_responsavel" type="checkbox" /> Responsável</label>
               <label class="checkbox"><input name="usa_documento_designacao" type="checkbox" checked /> Cita documento</label>
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
      usaDocumento?: boolean;
      ativo?: boolean;
    },
  ) => {
    // O backend regrava a linha inteira. Mesclar com o item atual é o que
    // permite mexer num atributo só sem zerar os outros por omissão.
    const atual = config.papeis.find((p) => p.papel_id === papelId);
    const r = await call("apuratorio_config_save_papel", {
      request: {
        apuratorio_id: apuratorioSelecionado,
        papel_id: papelId,
        obrigatorio: campos.obrigatorio ?? atual?.obrigatorio ?? false,
        max_ocupantes: campos.maxOcupantes ?? atual?.max_ocupantes ?? 1,
        e_responsavel: campos.eResponsavel ?? atual?.e_responsavel ?? false,
        usa_documento_designacao:
          campos.usaDocumento ?? atual?.usa_documento_designacao ?? true,
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
      usaDocumento: form.get("usa_documento_designacao") === "on",
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
  // Alterna a citação de documento sem passar pelo formulário de habilitar —
  // é regra de um papel já configurado, não parte do cadastro dele.
  document.querySelectorAll<HTMLButtonElement>("[data-documento-papel]").forEach((b) =>
    b.addEventListener("click", () => {
      const papelId = b.dataset.documentoPapel!;
      const atual = config.papeis.find((p) => p.papel_id === papelId);
      void salvarPapel(papelId, { usaDocumento: !(atual?.usa_documento_designacao ?? true) });
    }),
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
