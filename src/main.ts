import { invoke } from "@tauri-apps/api/core";
import "./styles.css";
import { escapeHtml, cellDisplay } from "./dom";
import {
  carregarDefinicoes,
  chaveDaRota,
  esquecerDefinicoes,
  renderCatalogo,
  rotasDeCatalogo,
  type ContextoTela,
} from "./telas/catalogos";
import { ROTA as ROTA_CONFIG_APURATORIO, renderConfiguracaoApuratorio } from "./telas/apuratorio";
import { ROTA_LISTA as ROTA_PROCESSOS, renderListaProcessos } from "./telas/processo";
import { ROTA as ROTA_PRAZOS, renderPrazos } from "./telas/prazos";
import { ROTA as ROTA_ANUAL, renderRelatorioAnual } from "./telas/anual";
import {
  ROTA_MENSAL as ROTA_MAPA_MENSAL,
  ROTA_SALVOS as ROTA_MAPAS_SALVOS,
  renderMapaMensal,
  renderMapasSalvos,
} from "./telas/mapas";
import {
  ROTA as ROTA_ESTATISTICAS_PROCESSOS,
  ROTA_PROCEDIMENTOS as ROTA_STATS_PROCEDIMENTOS,
  renderEstatisticasProcedimentos,
  renderEstatisticasProcessos,
} from "./telas/estatisticas";

// NOTA DE MIGRAÇÃO
//
// Este arquivo ainda usa o `call()` local, que recebe o nome do comando como
// `string` e por isso não valida nada. As telas migradas usam o cliente tipado
// de `./api`, onde comando, argumentos e resposta são checados em compilação.
// Cada tela migrada move suas chamadas para lá; quando não sobrar nenhuma
// chamada legada aqui, o `call()` local sai junto.

type ApiResponse<T> = {
  ok: boolean;
  data: T | null;
  error: string | null;
};

type SessionUser = {
  id: string;
  nome: string;
  email: string | null;
  perfil: "admin" | "comum";
  is_admin: boolean;
};

type Route = {
  path: string;
  label: string;
  group: string;
  command?: string;
  writeCommands?: string[];
  adminOnly?: boolean;
  csvExport?: { tipoRelatorio: string };
  printable?: boolean;
  searchable?: boolean;
  detailCommand?: string;
  itemsKey?: string;
};

type CrudField = {
  name: string;
  label: string;
  kind: "text" | "email" | "password" | "number" | "checkbox" | "textarea" | "select" | "date";
  required?: boolean;
  options?: string[];
  optionsCommand?: string;
  /** Catálogo do registro genérico. Substitui os `legal_catalogs_list_<x>`. */
  optionsCatalogo?: string;
  optionsValueKey?: string;
  optionsLabelKey?: string;
  showIf?: { field: string; value: boolean | string };
};

type CrudConfig = {
  saveCommand: string;
  updateCommand?: string;
  deleteCommand?: string;
  idKind: "string" | "number";
  fields: CrudField[];
  hiddenColumns?: string[];
};

let routes: Route[] = [
  { path: "/dashboard", label: "Dashboard", group: "Geral", command: "dashboard_summary", printable: true },
  {
    path: ROTA_PROCESSOS,
    label: "Procedimentos",
    group: "Procedimentos",
    printable: true
  },
  {
    path: "/prazos",
    label: "Prazos",
    group: "Procedimentos",
    printable: true
  },
  {
    path: "/usuarios/lista",
    label: "Usuários",
    group: "Usuários",
    command: "users_list",
    writeCommands: ["users_save", "users_delete", "users_reactivate"],
    printable: true,
    detailCommand: "users_get"
  },
  { path: "/usuarios/novo", label: "Novo usuário", group: "Usuários", command: "users_form_schema", adminOnly: true },
  {
    path: ROTA_CONFIG_APURATORIO,
    label: "Configuração de apuratórios",
    group: "Catálogos",
    adminOnly: true
  },
  { path: "/auditoria", label: "Auditoria", group: "Auditoria", command: "audit_list", printable: true, detailCommand: "audit_get" },
  {
    path: "/estatisticas/encarregados",
    label: "Estatísticas de Encarregados",
    group: "Relatórios",
    command: "reports_by_responsible",
    csvExport: { tipoRelatorio: "encarregados" },
    printable: true
  },
  {
    path: ROTA_ESTATISTICAS_PROCESSOS,
    label: "Estatísticas de Processos",
    group: "Relatórios"
  },
  { path: ROTA_MAPA_MENSAL, label: "Mapa do Período", group: "Mapas" },
  { path: ROTA_MAPAS_SALVOS, label: "Mapas Salvos", group: "Mapas" },
  { path: ROTA_ANUAL, label: "Relatório Anual", group: "Relatórios" },
  { path: ROTA_STATS_PROCEDIMENTOS, label: "Estatísticas de Procedimentos", group: "Relatórios" }
];

/** Fallback quando `activePath` não casa com nenhuma rota. */
const DASHBOARD: Route = routes[0] ?? {
  path: "/dashboard",
  label: "Dashboard",
  group: "Geral",
  command: "dashboard_summary"
};

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Movement = { id: string; texto: string; data: string };
type ProceedingData = Record<string, unknown> & {
  id?: string; numero?: string; tipo_detalhe?: string; concluido?: boolean | null;
  pdf_nome?: string | null; pdf_tamanho?: number | null; andamentos?: Movement[];
};

let session: SessionUser | null = null;
let activePath = "/dashboard";
let currentRows: Record<string, unknown>[] = [];
let searchTerm = "";
let detailId: string | null = null;
let selectedYear: number = new Date().getFullYear();
let auditFilters: { tabela: string; operacao: string; usuario_id: string } =
  { tabela: "", operacao: "", usuario_id: "" };

const app = document.querySelector<HTMLDivElement>("#app")!;

const crudConfigs: Record<string, CrudConfig> = {
  "/usuarios/lista": {
    saveCommand: "users_save",
    deleteCommand: "users_delete",
    idKind: "string",
    fields: [
      { name: "posto_graduacao", label: "Posto/Graduação", kind: "select", required: true, optionsCatalogo: "postos_graduacoes", optionsLabelKey: "nome" },
      { name: "nome", label: "Nome", kind: "text", required: true },
      { name: "matricula", label: "Matrícula", kind: "text", required: true },
      { name: "is_encarregado", label: "Encarregado", kind: "checkbox" },
      { name: "is_operador", label: "Operador", kind: "checkbox" },
      { name: "email", label: "Email", kind: "email" },
      { name: "perfil", label: "Perfil", kind: "select", options: ["admin", "comum"] },
      { name: "senha", label: "Senha", kind: "password" }
    ]
  },
};

function canWrite() {
  return session?.is_admin === true;
}

async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  try {
    return await invoke<ApiResponse<T>>(command, args);
  } catch (error) {
    return { ok: false, data: null, error: String(error) };
  }
}

async function loadSession() {
  const response = await call<SessionUser>("auth_current_user");
  session = response.ok ? response.data : null;
  if (session) await montarRotasDeCatalogo();
}

/**
 * As telas de catálogo não são declaradas: vêm de
 * `legal_catalogs_definitions`. Acrescentar um catálogo no Rust faz a tela
 * aparecer sozinha — era isto que os 21 `crudConfigs` escritos à mão custavam.
 */
async function montarRotasDeCatalogo() {
  const definicoes = await carregarDefinicoes();
  const estaticas = routes.filter((r) => chaveDaRota(r.path) === null);
  routes = [
    ...estaticas,
    ...rotasDeCatalogo(definicoes).map((r) => ({ ...r, adminOnly: false })),
  ];
}

/** O que as telas em `./telas` precisam do shell, sem importar este arquivo. */
const contexto: ContextoTela = {
  shell: (html: string) => shell(html),
  podeEscrever: () => canWrite(),
};

function groupedRoutes() {
  return routes.reduce<Record<string, Route[]>>((acc, route) => {
    const grupo = acc[route.group] ?? [];
    grupo.push(route);
    acc[route.group] = grupo;
    return acc;
  }, {});
}

function shell(content: string) {
  const nav = Object.entries(groupedRoutes())
    .map(([group, items]) => `
      <section class="nav-group">
        <h2>${group}</h2>
        ${items.map((route) => `
          <button class="nav-item ${route.path === activePath ? "active" : ""}" data-route="${route.path}">
            <span>${route.label}</span>
            ${route.adminOnly ? "<small>admin</small>" : ""}
          </button>
        `).join("")}
      </section>
    `).join("");

  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <strong>ADM P6</strong>
        <span>Rust/Tauri</span>
      </div>
      ${nav}
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <strong>${session?.nome ?? "Sessão não autenticada"}</strong>
          <span>${session?.perfil ?? "offline"}</span>
        </div>
        <button class="secondary" id="logout">Sair</button>
      </header>
      ${content}
    </main>
  `;

  document.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      activePath = button.dataset.route ?? "/dashboard";
      void renderRoute();
    });
  });

  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => {
    await call("auth_logout");
    session = null;
    esquecerDefinicoes();
    renderLogin();
  });
}

function renderLogin(error = "") {
  app.innerHTML = `
    <main class="login-screen">
      <form id="login-form" class="login-panel">
        <h1>ADM P6</h1>
        <label>Email<input name="email" type="email" autocomplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required /></label>
        ${error ? `<p class="error">${error}</p>` : ""}
        <button type="submit">Entrar</button>
      </form>
    </main>
  `;

  document.querySelector<HTMLFormElement>("#login-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const response = await call<SessionUser>("auth_login", {
      email: data.get("email"),
      senha: data.get("senha")
    });
    if (!response.ok || !response.data) {
      renderLogin(response.error ?? "Falha ao autenticar.");
      return;
    }
    session = response.data;
    await montarRotasDeCatalogo();
    activePath = "/dashboard";
    await renderRoute();
  });
}

function tableFrom(data: unknown, route: Route): string {
  if (!Array.isArray(data)) {
    return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }
  if (data.length === 0) {
    return `<p class="empty">Nenhum registro encontrado.</p>`;
  }
  const config = crudConfigs[route.path];
  const hiddenCols = new Set(["id", ...(config?.hiddenColumns ?? [])]);
  const columns = Object.keys(data[0] as Record<string, unknown>).filter((c) => !hiddenCols.has(c));
  const hasCrud = Boolean(crudConfigs[route.path]) && canWrite();
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}${hasCrud ? "<th>Ações</th>" : ""}</tr></thead>
        <tbody>
          ${data.map((row, index) => `
            <tr data-row-index="${index}">
              ${columns.map((column) => `<td>${escapeHtml(cellDisplay((row as Record<string, unknown>)[column]))}</td>`).join("")}
              ${hasCrud ? `
                <td class="row-actions">
                  <button class="secondary small" data-edit-index="${index}">Editar</button>
                  <button class="danger small" data-delete-index="${index}">Excluir</button>
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function crudActionBar(route: Route) {
  const config = crudConfigs[route.path];
  if (!canWrite()) {
    return `<p class="readonly">Perfil somente leitura: ações de criação, edição e remoção estão desabilitadas.</p>`;
  }
  if (!config) {
    return route.writeCommands?.length
      ? `<div class="actions">${route.writeCommands.map((command) => `<code>${command}</code>`).join("")}</div>`
      : "";
  }
  return `<div class="actions"><button id="new-record">Novo</button></div>`;
}

function fieldValue(row: Record<string, unknown> | null, field: CrudField) {
  const value = row?.[field.name];
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function applyShowIf(form: Element) {
  form.querySelectorAll<HTMLElement>("[data-show-if-field]").forEach((wrapper) => {
    const fieldName = wrapper.getAttribute("data-show-if-field")!;
    const expectedValue = wrapper.getAttribute("data-show-if-value")!;
    const input = form.querySelector<HTMLInputElement>(`[name="${fieldName}"]`);
    if (!input) return;
    const update = () => {
      const actual = input.type === "checkbox" ? String(input.checked) : input.value;
      wrapper.style.display = actual === expectedValue ? "" : "none";
    };
    input.addEventListener("change", update);
    update();
  });
}

function renderField(
  field: CrudField,
  row: Record<string, unknown> | null,
  dynamicOpts?: { value: string; label: string }[]
) {
  const value = fieldValue(row, field);
  const required = field.required ? "required" : "";

  let inner: string;

  if (field.kind === "checkbox") {
    inner = `
      <label class="checkbox">
        <input name="${field.name}" type="checkbox" ${value === true ? "checked" : ""} />
        ${field.label}
      </label>
    `;
  } else if (field.kind === "select") {
    const opts = dynamicOpts
      ? dynamicOpts.map((o) => `<option value="${escapeHtml(o.value)}" ${value === o.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")
      : (field.options ?? []).map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
    inner = `
      <label>${field.label}
        <select name="${field.name}" ${required}>
          <option value=""></option>
          ${opts}
        </select>
      </label>
    `;
  } else if (field.kind === "textarea") {
    inner = `<label>${field.label}<textarea name="${field.name}" ${required}>${escapeHtml(String(value))}</textarea></label>`;
  } else if (field.kind === "date") {
    const dateVal = String(value).substring(0, 10);
    inner = `<label>${field.label}<input name="${field.name}" type="date" value="${escapeHtml(dateVal)}" ${required} /></label>`;
  } else {
    inner = `<label>${field.label}<input name="${field.name}" type="${field.kind}" value="${escapeHtml(String(value))}" ${required} /></label>`;
  }

  if (field.showIf) {
    return `<div data-show-if-field="${escapeHtml(field.showIf.field)}" data-show-if-value="${escapeHtml(String(field.showIf.value))}">${inner}</div>`;
  }
  return inner;
}

async function renderCrudForm(route: Route, row: Record<string, unknown> | null = null, error = "") {
  const config = crudConfigs[route.path];
  if (!config) return;

  const dynamicOptions: Record<string, { value: string; label: string }[]> = {};
  await Promise.all(
    config.fields
      .filter((f) => f.optionsCommand || f.optionsCatalogo)
      .map(async (f) => {
        const resp = f.optionsCatalogo
          ? await call<Record<string, string>[]>("legal_catalogs_list", { catalogo: f.optionsCatalogo })
          : await call<Record<string, string>[]>(f.optionsCommand!);
        dynamicOptions[f.name] = (resp.data ?? []).map((item) => {
          const valueVal = (f.optionsValueKey ? item[f.optionsValueKey] : item.id) ?? item.id ?? "";
          const labelVal = (f.optionsLabelKey ? item[f.optionsLabelKey] : valueVal) ?? valueVal;
          return { value: valueVal, label: labelVal };
        });
      })
  );

  const id = row?.id ?? "";
  shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${row ? "Editar" : "Novo"} - ${route.label}</h1>
          <p>${config.saveCommand}</p>
        </div>
        <button class="secondary" id="cancel-form">Cancelar</button>
      </div>
      <form id="crud-form" class="crud-form">
        <input type="hidden" name="id" value="${escapeHtml(String(id))}" />
        ${config.fields.map((field) => renderField(field, row, dynamicOptions[field.name])).join("")}
        ${error ? `<p class="error">${error}</p>` : ""}
        <div class="form-actions">
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);

  const crudForm = document.querySelector<HTMLFormElement>("#crud-form");
  if (crudForm) applyShowIf(crudForm);

  document.querySelector<HTMLButtonElement>("#cancel-form")?.addEventListener("click", () => {
    void renderRoute();
  });

  document.querySelector<HTMLFormElement>("#crud-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const request = buildPayload(config, form);
    const isEdit = Boolean(request.id);
    const command = isEdit && config.updateCommand ? config.updateCommand : config.saveCommand;
    const response = await call(command, { request });
    if (!response.ok) {
      void renderCrudForm(route, row, response.error ?? "Falha ao salvar.");
      return;
    }
    await renderRoute();
  });
}

function buildPayload(config: CrudConfig, form: FormData) {
  const payload: Record<string, unknown> = {};
  const id = String(form.get("id") ?? "");
  payload.id = id ? castId(config, id) : null;

  for (const field of config.fields) {
    if (field.kind === "checkbox") {
      payload[field.name] = form.get(field.name) === "on";
      continue;
    }
    const raw = String(form.get(field.name) ?? "").trim();
    if (field.kind === "number") {
      payload[field.name] = raw ? Number(raw) : null;
      continue;
    }
    payload[field.name] = raw || null;
  }
  return payload;
}

function castId(config: CrudConfig, raw: string) {
  return config.idKind === "number" ? Number(raw) : raw;
}

function bindCrudEvents(route: Route) {
  const config = crudConfigs[route.path];

  if (route.detailCommand) {
    document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-index]").forEach((tr) => {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        const index = Number(tr.dataset.rowIndex);
        const id = String(currentRows[index]?.id ?? "");
        if (!id) return;
        detailId = id;
        void renderDetail(route);
      });
    });
  }

  if (!config || !canWrite()) return;

  document.querySelector<HTMLButtonElement>("#new-record")?.addEventListener("click", () => {
    void renderCrudForm(route);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-edit-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.editIndex);
      void renderCrudForm(route, currentRows[index] ?? null);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.deleteIndex);
      const row = currentRows[index];
      const id = row?.id;
      if (!config.deleteCommand || id === undefined || id === null) return;
      if (!confirm("Confirmar exclusão?")) return;
      const response = await call(config.deleteCommand, { id: castId(config, String(id)) });
      if (!response.ok) {
        alert(response.error ?? "Falha ao excluir.");
        return;
      }
      await renderRoute();
    });
  });
}

async function renderRoute() {
  if (!session) {
    renderLogin();
    return;
  }

  const chaveCatalogo = chaveDaRota(activePath);
  if (chaveCatalogo) return renderCatalogo(chaveCatalogo, contexto);
  if (activePath === ROTA_CONFIG_APURATORIO) return renderConfiguracaoApuratorio(contexto);
  if (activePath === ROTA_PROCESSOS) return renderListaProcessos(contexto);

  const route = routes.find((item) => item.path === activePath) ?? DASHBOARD;

  if (route.path === ROTA_ANUAL) return renderRelatorioAnual(contexto);
  if (route.path === ROTA_PRAZOS) return renderPrazos(contexto);
  if (route.path === ROTA_ESTATISTICAS_PROCESSOS) return renderEstatisticasProcessos(contexto);
  if (route.path === ROTA_MAPA_MENSAL) return renderMapaMensal(contexto);
  if (route.path === ROTA_MAPAS_SALVOS) return renderMapasSalvos(contexto);
  if (route.path === "/auditoria") return renderAuditWithFilters();
  if (route.path === "/usuarios/lista") return renderUsersList();
  if (route.path === ROTA_STATS_PROCEDIMENTOS) return renderEstatisticasProcedimentos(contexto);
  if (route.path === "/usuarios/novo") {
    activePath = "/usuarios/lista";
    if (!canWrite()) {
      shell(`<section class="panel"><h1>Novo Usuário</h1><p class="error">Seu perfil é somente leitura.</p></section>`);
      return;
    }
    const usersRoute = routes.find((r) => r.path === "/usuarios/lista")!;
    await renderCrudForm(usersRoute);
    return;
  }

  // Reset search when navigating away from a searchable route
  if (!route.searchable) searchTerm = "";

  const writeBlocked = route.adminOnly && !canWrite();
  let body = "";

  if (writeBlocked) {
    body = `<section class="panel"><h1>${route.label}</h1><p class="error">Seu perfil é somente leitura.</p></section>`;
  } else if (route.command) {
    body = `<section class="panel"><h1>${route.label}</h1><p>Carregando...</p></section>`;
  }

  shell(body);

  if (!route.command || writeBlocked) return;

  const commandArgs: Record<string, unknown> = route.searchable
    ? { filter: { search: searchTerm || null } }
    : {};

  const response = await call<unknown>(route.command, commandArgs);
  const rawData = response.data;
  const listData = route.itemsKey
    ? (rawData as Record<string, unknown>)?.[route.itemsKey]
    : rawData;
  currentRows = Array.isArray(listData) ? listData as Record<string, unknown>[] : [];
  const actions = crudActionBar(route);
  const extra = exportBar(route);

  const isDashboard = route.path === "/dashboard" && !Array.isArray(rawData);
  const content = response.ok
    ? isDashboard
      ? renderDashboard(rawData as Record<string, unknown>)
      : tableFrom(listData, route)
    : `<p class="error">${response.error}</p>`;

  shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${route.label}</h1>
          <p>${route.path}</p>
        </div>
        <div class="page-head-right">
          ${actions}
          ${extra}
        </div>
      </div>
      ${searchBar(route)}
      ${content}
    </section>
  `);
  bindCrudEvents(route);
  bindExportEvents(route);
}

function renderDashboard(data: Record<string, unknown>) {
  const card = (label: string, value: unknown, highlight = false) => `
    <div class="stat-card ${highlight ? "stat-card--alert" : ""}">
      <span class="stat-value">${escapeHtml(String(value ?? 0))}</span>
      <span class="stat-label">${label}</span>
    </div>
  `;
  return `
    <div class="stat-grid">
      ${card("Total de Processos", data.total_processos)}
      ${card("Em Andamento", data.em_andamento)}
      ${card("Concluídos", data.concluidos)}
      ${card("Prazos Vencidos", data.prazos_vencidos, Number(data.prazos_vencidos) > 0)}
    </div>
  `;
}

async function renderDetail(route: Route) {
  if (!detailId || !route.detailCommand) return;

  // Evidence sub-panel takes over when a PM is selected
  shell(`<section class="panel"><p>Carregando detalhes...</p></section>`);

  // O detalhe de processo tem tela própria (telas/processo.ts). Aqui
  // sobraram auditoria e mapas salvos, que são só ficha de leitura.
  const isProceeding = false as boolean;
  const [response, evidenceResp, deadlinesResp] = await Promise.all([
    call<ProceedingData>(route.detailCommand, { id: detailId }),
    isProceeding ? call<unknown[]>("evidence_list_for_proceeding", { procedimento_id: detailId }) : Promise.resolve({ ok: true, data: [], error: null }),
    isProceeding ? call<unknown[]>("deadlines_list", { processo_id: detailId }) : Promise.resolve({ ok: true, data: [], error: null }),
  ]);

  if (!response.ok) {
    shell(`<section class="panel"><p class="error">${escapeHtml(response.error ?? "Erro")}</p></section>`);
    return;
  }

  const data: ProceedingData = response.data ?? {};
  const config = crudConfigs[route.path];
  const canEdit = Boolean(config && canWrite());

  const movements: Movement[] = Array.isArray(data.andamentos) ? (data.andamentos as Movement[]) : [];
  const hasPdf = Boolean(data.pdf_nome);

  const INFO_FIELDS = [
    ["numero", "Número"], ["tipo_geral", "Tipo Geral"], ["tipo_detalhe", "Tipo"],
    ["documento_iniciador", "Doc. Iniciador"], ["processo_sei", "SEI"],
    ["data_instauracao", "Instauração"], ["data_recebimento", "Recebimento"],
    ["responsavel_nome", "Encarregado"], ["escrivao_nome", "Escrivão"],
    ["local_origem", "Local Origem"], ["local_fatos", "Local dos Fatos"],
    ["natureza_processo", "Natureza"], ["resumo_fatos", "Resumo"],
    ["concluido", "Concluído"], ["data_conclusao", "Data Conclusão"],
    ["solucao_tipo", "Solução"], ["solucao_final", "Decisão Final"],
    ["penalidade_tipo", "Penalidade"], ["penalidade_dias", "Dias"],
  ] as const;

  const infoRows = isProceeding
    ? INFO_FIELDS
        .filter(([key]) => { const v = data[key]; return v !== null && v !== undefined && String(v).trim() !== ""; })
        .map(([key, label]) => {
          const v = data[key];
          const display = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
          return `<tr><th>${label}</th><td>${escapeHtml(display)}</td></tr>`;
        }).join("")
    : Object.entries(data)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "" && typeof v !== "object")
        .map(([key, v]) => {
          const display = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
          return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(display)}</td></tr>`;
        }).join("");

  const movementsHtml = isProceeding ? `
    <div class="detail-section">
      <h2>Andamentos <span class="badge">${movements.length}</span></h2>
      ${movements.length > 0 ? `
        <ul class="andamentos-list">
          ${movements.map((m) => `
            <li class="andamento-item">
              <div class="andamento-meta">
                <span>${escapeHtml(m.data)}</span>
                ${canWrite() ? `<button class="danger small" data-remove-andamento="${escapeHtml(m.id)}">Remover</button>` : ""}
              </div>
              <p class="andamento-texto">${escapeHtml(m.texto)}</p>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="empty">Nenhum andamento registrado.</p>`}
      ${canWrite() ? `
        <form id="add-movement-form" class="add-movement-form">
          <textarea name="texto" placeholder="Descreva o andamento..." required></textarea>
          <button type="submit">Adicionar Andamento</button>
        </form>
      ` : ""}
    </div>
  ` : "";

  const pdfHtml = isProceeding ? `
    <div class="detail-section">
      <h2>PDF Anexo</h2>
      ${hasPdf ? `
        <div class="pdf-info">
          <span class="pdf-name">${escapeHtml(String(data.pdf_nome))}</span>
          <span class="pdf-size">${formatBytes(Number(data.pdf_tamanho ?? 0))}</span>
          <button id="btn-view-pdf">Abrir PDF</button>
          ${canWrite() ? `<button class="danger small" id="btn-remove-pdf">Remover</button>` : ""}
        </div>
      ` : `
        <p class="empty">Nenhum PDF anexado.</p>
        ${canWrite() ? `
          <label class="upload-label">
            Fazer Upload de PDF
            <input type="file" id="pdf-upload-input" accept=".pdf" />
          </label>
        ` : ""}
      `}
    </div>
  ` : "";

  // Indícios section
  type PmEvidence = { pm_envolvido_id: string; nome?: string | null; posto_graduacao?: string | null; indicios?: { categorias: string[]; crimes_militares: unknown[]; crimes_comuns: unknown[]; rdpm: unknown[]; art29: unknown[]; art32: unknown[] } };
  const evidenceList: PmEvidence[] = Array.isArray(evidenceResp.data) ? evidenceResp.data as PmEvidence[] : [];

  const indiciosHtml = isProceeding ? `
    <div class="detail-section">
      <h2>Indícios por PM <span class="badge">${evidenceList.length}</span></h2>
      ${evidenceList.length === 0 ? `<p class="empty">Nenhum PM envolvido com indícios registrados.</p>` : `
        <ul class="andamentos-list">
          ${evidenceList.map((pm) => {
            const ind = pm.indicios ?? { categorias: [], crimes_militares: [], crimes_comuns: [], rdpm: [], art29: [], art32: [] };
            const cats = ind.categorias.length > 0 ? ind.categorias.join(", ") : "sem categorias";
            const total = ind.crimes_militares.length + ind.crimes_comuns.length + ind.rdpm.length + ind.art29.length + ind.art32.length;
            return `
              <li class="andamento-item">
                <div class="andamento-meta">
                  <strong>${escapeHtml(pm.posto_graduacao ?? "")} ${escapeHtml(pm.nome ?? pm.pm_envolvido_id)}</strong>
                  <span class="badge">${total} item(s)</span>
                  <span>${escapeHtml(cats)}</span>
                  <button class="secondary small" data-evidence-pm="${escapeHtml(pm.pm_envolvido_id)}">Gerenciar Indícios</button>
                </div>
              </li>`;
          }).join("")}
        </ul>
      `}
    </div>
  ` : "";

  // Prazos section
  type DLine = Record<string, unknown>;
  const deadlineList: DLine[] = Array.isArray(deadlinesResp.data) ? deadlinesResp.data as DLine[] : [];
  const activeDeadline = deadlineList.find((d) => d.ativo !== false && d.tipo_prazo === "inicial") ?? deadlineList.find((d) => d.ativo !== false);

  const prazosHtml = isProceeding ? `
    <div class="detail-section">
      <h2>Prazos <span class="badge">${deadlineList.length}</span></h2>
      ${deadlineList.length > 0 ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Início</th><th>Vencimento</th><th>Dias+</th><th>Motivo</th><th>Status</th></tr></thead>
            <tbody>
              ${deadlineList.map((d) => `
                <tr>
                  <td>${escapeHtml(String(d.tipo_prazo ?? ""))}</td>
                  <td>${escapeHtml(String(d.data_inicio ?? ""))}</td>
                  <td>${escapeHtml(String(d.data_vencimento ?? ""))}</td>
                  <td>${escapeHtml(String(d.dias_adicionados ?? ""))}</td>
                  <td>${escapeHtml(String(d.motivo ?? ""))}</td>
                  <td>${d.ativo !== false ? `<span class="badge badge--warn">Ativo</span>` : `<span class="badge">Encerrado</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<p class="empty">Nenhum prazo cadastrado.</p>`}
      ${canWrite() ? `
        ${activeDeadline ? `<button class="secondary small" id="btn-close-deadline">Encerrar Prazo Ativo</button>` : ""}
        <details class="extension-details">
          <summary>Adicionar Prorrogação</summary>
          <form id="extension-form" class="add-movement-form" style="margin-top:12px">
            <label>Dias de prorrogação<input name="dias" type="number" min="1" required /></label>
            <label>Motivo<input name="motivo" type="text" required /></label>
            <label>Autorizado por<input name="autorizado_por" type="text" required /></label>
            <label>Tipo autorização<select name="autorizado_tipo">
              <option value="Portaria">Portaria</option>
              <option value="Memorando">Memorando</option>
              <option value="Despacho">Despacho</option>
            </select></label>
            <label>N° Portaria (opcional)<input name="numero_portaria" type="text" /></label>
            <label>Data Portaria (opcional)<input name="data_portaria" type="date" /></label>
            <button type="submit">Salvar Prorrogação</button>
          </form>
        </details>
      ` : ""}
    </div>
  ` : "";

  const numero = escapeHtml(String(data.numero ?? "Detalhe"));
  const tipo = data.tipo_detalhe ? `<small>${escapeHtml(String(data.tipo_detalhe))}</small>` : "";
  const status = data.concluido
    ? `<span class="badge badge--ok">Concluído</span>`
    : `<span class="badge badge--warn">Em Andamento</span>`;

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${numero} ${tipo} ${isProceeding ? status : ""}</h1><p>${detailId}</p></div>
        <div class="page-head-right">
          ${canEdit ? `<button id="edit-detail">Editar</button>` : ""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${exportBar({ ...route, csvExport: undefined })}
        </div>
      </div>
      <div class="table-wrap"><table class="detail-table"><tbody>${infoRows}</tbody></table></div>
      ${pdfHtml}
      ${prazosHtml}
      ${indiciosHtml}
      ${movementsHtml}
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#back-to-list")?.addEventListener("click", () => {
    detailId = null; void renderRoute();
  });
  if (canEdit && config) {
    document.querySelector<HTMLButtonElement>("#edit-detail")?.addEventListener("click", () => {
      void renderCrudForm(route, data as Record<string, unknown>);
    });
  }

  // Os manipuladores de andamento, PDF, indícios e prazos foram removidos:
  // pertenciam ao detalhe de processo, que agora tem tela própria em
  // `telas/processo.ts`. O que resta aqui é ficha de leitura de auditoria e
  // de mapas salvos.

  bindExportEvents({ ...route, csvExport: undefined });
}


async function renderAuditWithFilters() {
  const auditRoute = routes.find((r) => r.path === "/auditoria")!;
  shell(`<section class="panel"><p>Carregando...</p></section>`);

  const resp = await call<unknown[]>("audit_list", {
    limit: 200,
    offset: 0,
    tabela: auditFilters.tabela || null,
    operacao: auditFilters.operacao || null,
    usuario_id: auditFilters.usuario_id || null,
  });

  const items = resp.data ?? [];
  currentRows = items as Record<string, unknown>[];

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Auditoria</h1></div>
        <div class="page-head-right">${exportBar({ ...auditRoute, csvExport: undefined })}</div>
      </div>
      <form id="audit-filter-form" class="search-bar" style="flex-wrap:wrap">
        <input name="tabela" type="text" placeholder="Tabela" value="${escapeHtml(auditFilters.tabela)}" style="max-width:160px" />
        <select name="operacao">
          <option value="">Operação</option>
          ${["CREATE","UPDATE","DELETE"].map((op) => `<option ${auditFilters.operacao === op ? "selected" : ""}>${op}</option>`).join("")}
        </select>
        <input name="usuario_id" type="text" placeholder="ID do usuário" value="${escapeHtml(auditFilters.usuario_id)}" style="max-width:220px" />
        <button type="submit">Filtrar</button>
        <button type="button" class="secondary small" id="clear-audit-filter">Limpar</button>
      </form>
      ${resp.ok ? tableFrom(items, auditRoute) : `<p class="error">${resp.error}</p>`}
    </section>
  `);

  document.querySelector<HTMLFormElement>("#audit-filter-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    auditFilters = {
      tabela: (form.get("tabela") as string).trim(),
      operacao: (form.get("operacao") as string).trim(),
      usuario_id: (form.get("usuario_id") as string).trim(),
    };
    void renderAuditWithFilters();
  });

  document.querySelector<HTMLButtonElement>("#clear-audit-filter")?.addEventListener("click", () => {
    auditFilters = { tabela: "", operacao: "", usuario_id: "" };
    void renderAuditWithFilters();
  });

  bindCrudEvents(auditRoute);
  bindExportEvents({ ...auditRoute, csvExport: undefined });
}


async function renderUsersList() {
  shell(`<section class="panel"><p>Carregando...</p></section>`);

  const resp = await call<{ items: unknown[]; total: number }>(
    "users_list", { search: searchTerm || null, per_page: 100 }
  );

  const items = resp.data?.items ?? [];
  const total = resp.data?.total ?? 0;
  currentRows = items as Record<string, unknown>[];
  const COL_ALIASES: Record<string, string> = {
    posto_graduacao: "POSTO/GRADUACAO",
    tipo_usuario: "TIPO",
    is_encarregado: "ENCARREGADO",
    is_operador: "OPERADOR",
  };
  const displayItems = items.map((raw) => {
    const r = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "id") continue;
      out[COL_ALIASES[k] ?? k] = v;
    }
    return out;
  });
  const usersRoute = routes.find((r) => r.path === "/usuarios/lista")!;
  const config = crudConfigs["/usuarios/lista"];

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Usuários <span class="badge">${total}</span></h1></div>
        <div class="page-head-right">
          ${canWrite() ? `<button id="new-record">Novo</button>` : ""}
          ${exportBar({ ...usersRoute, csvExport: undefined })}
        </div>
      </div>
      <form id="search-form" class="search-bar">
        <input name="q" type="search" placeholder="Buscar por nome ou matrícula..." value="${escapeHtml(searchTerm)}" />
        <button type="submit">Buscar</button>
        ${searchTerm ? `<button type="button" class="secondary small" id="clear-search">Limpar</button>` : ""}
      </form>
      ${resp.ok ? tableFrom(displayItems, usersRoute) : `<p class="error">${resp.error}</p>`}
    </section>
  `);

  document.querySelector<HTMLFormElement>("#search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    searchTerm = ((new FormData(e.currentTarget as HTMLFormElement).get("q") as string) ?? "").trim();
    void renderUsersList();
  });
  document.querySelector<HTMLButtonElement>("#clear-search")?.addEventListener("click", () => { searchTerm = ""; void renderUsersList(); });

  document.querySelector<HTMLButtonElement>("#new-record")?.addEventListener("click", () => { void renderCrudForm(usersRoute); });

  if (usersRoute.detailCommand) {
    document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-index]").forEach((tr) => {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        const idx = Number(tr.dataset.rowIndex);
        const id = String(currentRows[idx]?.id ?? "");
        if (!id) return;
        detailId = id;
        void renderUserDetail(usersRoute);
      });
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-edit-index]").forEach((btn) => {
    btn.addEventListener("click", () => { void renderCrudForm(usersRoute, currentRows[Number(btn.dataset.editIndex)] ?? null); });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-index]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = currentRows[Number(btn.dataset.deleteIndex)];
      if (!confirm("Confirmar exclusão?")) return;
      const r = await call("users_delete", { id: row?.id });
      if (!r.ok) { alert(r.error ?? "Erro"); return; }
      void renderUsersList();
    });
  });

  bindExportEvents({ ...usersRoute, csvExport: undefined });
}

async function renderUserDetail(route: Route) {
  if (!detailId) return;
  shell(`<section class="panel"><p>Carregando perfil...</p></section>`);

  type UserStats = Record<string, unknown>;
  type ProcItem = Record<string, unknown>;

  // "Como encarregado" e "como escrivão" eram dois comandos porque os papéis
  // estavam escritos no código. Agora o papel é configuração por apuratório, e
  // um único comando devolve todas as designações — separá-las por nome de
  // papel aqui seria reintroduzir o hardcode que a refatoração eliminou.
  const [userResp, statsResp, designResp, envolvResp] = await Promise.all([
    call<Record<string, unknown>>("users_get", { id: detailId }),
    call<UserStats>("users_statistics", { id: detailId }),
    call<ProcItem[]>("users_proceedings_designated", { id: detailId }),
    call<ProcItem[]>("users_proceedings_involved", { id: detailId }),
  ]);

  const user = userResp.data ?? {};
  const stats = statsResp.data ?? {};
  const procDesignado = designResp.data ?? [];
  const procEnvolv = envolvResp.data ?? [];
  const isInactive = user.ativo === false;

  const statCard = (label: string, value: unknown) => `
    <div class="stat-card">
      <span class="stat-value">${escapeHtml(String(value ?? 0))}</span>
      <span class="stat-label">${label}</span>
    </div>`;

  const procTable = (items: ProcItem[]) => items.length === 0
    ? `<p class="empty">Nenhum.</p>`
    : `<div class="table-wrap"><table>
        <thead><tr><th>Número</th><th>Tipo</th><th>Status</th><th>Instauração</th></tr></thead>
        <tbody>${items.map((p) => `
          <tr>
            <td>${escapeHtml(String(p.numero ?? ""))}</td>
            <td>${escapeHtml(String(p.tipo_detalhe ?? p.tipo_geral ?? ""))}</td>
            <td>${p.concluido ? `<span class="badge badge--ok">Concluído</span>` : `<span class="badge badge--warn">Andamento</span>`}</td>
            <td>${escapeHtml(String(p.data_instauracao ?? ""))}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;

  shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${escapeHtml(String(user.posto_graduacao ?? ""))} ${escapeHtml(String(user.nome ?? "Usuário"))}
            ${isInactive ? `<span class="badge">Inativo</span>` : `<span class="badge badge--ok">Ativo</span>`}
          </h1>
          <p>${escapeHtml(String(user.matricula ?? ""))} · ${escapeHtml(String(user.tipo_usuario ?? ""))} · ${escapeHtml(String(user.perfil ?? ""))}</p>
        </div>
        <div class="page-head-right">
          ${canWrite() ? `
            <button id="edit-user">Editar</button>
            ${isInactive ? `<button id="reactivate-user">Reativar</button>` : ""}
          ` : ""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${exportBar({ ...route, csvExport: undefined })}
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:24px">
        ${statCard("Sindicâncias (enc.)", stats.encarregado_sindicancia)}
        ${statCard("PADS (enc.)", stats.encarregado_pads)}
        ${statCard("IPM (enc.)", stats.encarregado_ipm)}
        ${statCard("PAD (enc.)", stats.encarregado_pad)}
        ${statCard("PADE (enc.)", stats.encarregado_pade)}
        ${statCard("Feito Prel. (enc.)", stats.encarregado_feito_preliminar)}
        ${statCard("CP (enc.)", stats.encarregado_cp)}
        ${statCard("CD (enc.)", stats.encarregado_cd)}
        ${statCard("CJ (enc.)", stats.encarregado_cj)}
        ${statCard("Escrivão", stats.escrivao)}
        ${statCard("Sindicado", stats.envolvido_sindicado)}
        ${statCard("Acusado", stats.envolvido_acusado)}
        ${statCard("Indiciado", stats.envolvido_indiciado)}
        ${statCard("Investigado", stats.envolvido_investigado)}
      </div>

      <div class="detail-section">
        <h2>Designado (${procDesignado.length})</h2>
        ${procTable(procDesignado)}
      </div>
      <div class="detail-section">
        <h2>Como Envolvido (${procEnvolv.length})</h2>
        ${procTable(procEnvolv)}
      </div>
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#back-to-list")?.addEventListener("click", () => { detailId = null; void renderUsersList(); });

  document.querySelector<HTMLButtonElement>("#edit-user")?.addEventListener("click", () => {
    const usersRoute = routes.find((r) => r.path === "/usuarios/lista")!;
    void renderCrudForm(usersRoute, user);
  });

  document.querySelector<HTMLButtonElement>("#reactivate-user")?.addEventListener("click", async () => {
    if (!confirm("Reativar este usuário?")) return;
    const r = await call("users_reactivate", { id: detailId });
    if (!r.ok) { alert(r.error ?? "Erro"); return; }
    void renderUserDetail(route);
  });

  bindExportEvents({ ...route, csvExport: undefined });
}


function downloadCsvBase64(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportBar(route: Route): string {
  const parts: string[] = [];
  if (route.printable) {
    parts.push(`<button class="outline small" id="btn-print">Imprimir / PDF</button>`);
  }
  if (route.csvExport) {
    parts.push(`<button class="outline small" id="btn-csv">Exportar CSV</button>`);
  }
  return parts.length ? `<div class="export-bar">${parts.join("")}</div>` : "";
}

function searchBar(route: Route): string {
  if (!route.searchable) return "";
  const cleared = searchTerm
    ? `<button type="button" class="secondary small" id="clear-search">Limpar</button>`
    : "";
  return `
    <form id="search-form" class="search-bar">
      <input name="q" type="search" placeholder="Buscar por número ou fatos..."
             value="${escapeHtml(searchTerm)}" />
      <button type="submit">Buscar</button>
      ${cleared}
    </form>
  `;
}

function bindExportEvents(route: Route) {
  document.querySelector<HTMLButtonElement>("#btn-print")?.addEventListener("click", () => {
    window.print();
  });

  document.querySelector<HTMLButtonElement>("#btn-csv")?.addEventListener("click", async () => {
    if (!route.csvExport) return;
    const btn = document.querySelector<HTMLButtonElement>("#btn-csv")!;
    btn.disabled = true;
    btn.textContent = "Gerando…";
    const response = await call<{ csv_base64: string; filename: string }>(
      "reports_export_csv",
      { request: { tipo_relatorio: route.csvExport.tipoRelatorio, ano: null } }
    );
    btn.disabled = false;
    btn.textContent = "Exportar CSV";
    if (!response.ok || !response.data) {
      alert(response.error ?? "Falha ao exportar.");
      return;
    }
    downloadCsvBase64(response.data.filename, response.data.csv_base64);
  });

  document.querySelector<HTMLFormElement>("#search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    searchTerm = ((form.get("q") as string) ?? "").trim();
    void renderRoute();
  });

  document.querySelector<HTMLButtonElement>("#clear-search")?.addEventListener("click", () => {
    searchTerm = "";
    void renderRoute();
  });
}

void loadSession().then(() => {
  if (session) {
    void renderRoute();
  } else {
    renderLogin();
  }
});
