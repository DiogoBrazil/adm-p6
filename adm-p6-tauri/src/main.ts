import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

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
};

type CrudConfig = {
  saveCommand: string;
  updateCommand?: string;
  deleteCommand?: string;
  idKind: "string" | "number";
  fields: CrudField[];
};

const routes: Route[] = [
  { path: "/dashboard", label: "Dashboard", group: "Geral", command: "dashboard_summary", printable: true },
  {
    path: "/procedimentos/lista",
    label: "Procedimentos",
    group: "Procedimentos",
    command: "proceedings_list",
    csvExport: { tipoRelatorio: "processos" },
    printable: true,
    searchable: true,
    detailCommand: "proceedings_get",
    itemsKey: "items"
  },
  {
    path: "/prazos",
    label: "Prazos",
    group: "Procedimentos",
    printable: true
  },
  {
    path: "/catalogos/transgressoes",
    label: "Transgressões",
    group: "Catálogos",
    command: "legal_catalogs_list_transgressions",
    writeCommands: ["legal_catalogs_save_transgression", "legal_catalogs_delete_transgression"]
  },
  {
    path: "/catalogos/crimes",
    label: "Crimes e Contravenções",
    group: "Catálogos",
    command: "legal_catalogs_list_crimes",
    writeCommands: ["legal_catalogs_save_crime", "legal_catalogs_delete_crime"]
  },
  {
    path: "/catalogos/art29",
    label: "Estatuto Art. 29",
    group: "Catálogos",
    command: "legal_catalogs_list_art29",
    writeCommands: ["legal_catalogs_save_art29", "legal_catalogs_delete_art29"]
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
    path: "/estatisticas/processos",
    label: "Estatísticas de Processos",
    group: "Relatórios",
    command: "reports_by_type",
    printable: true
  },
  {
    path: "/estatisticas/prazos",
    label: "Prazos Vencidos",
    group: "Relatórios",
    command: "reports_overdue_deadlines",
    csvExport: { tipoRelatorio: "prazos" },
    printable: true
  },
  { path: "/mapas/mensal", label: "Mapa Mensal", group: "Mapas", printable: true },
  { path: "/mapas/anteriores", label: "Mapas Salvos", group: "Mapas", command: "reports_saved_maps", printable: true, detailCommand: "reports_get_saved_map" },
  { path: "/estatisticas/anuais", label: "Estatísticas Anuais", group: "Relatórios", printable: true },
  { path: "/stats/procedimentos", label: "Estatísticas de Procedimentos", group: "Relatórios", printable: true }
];

const TIPOS_ANDAMENTO = [
  "Despacho", "Distribuição", "Juntada", "Remessa", "Retorno",
  "Decisão", "Notificação", "Citação", "Prorrogação", "Conclusão", "Outros",
] as const;

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Movement = { id: string; tipo: string | null; texto: string; data: string; usuario: string };
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
let evidencePmId: string | null = null;
let auditFilters: { tabela: string; operacao: string; usuario_id: string } =
  { tabela: "", operacao: "", usuario_id: "" };

const app = document.querySelector<HTMLDivElement>("#app")!;

const crudConfigs: Record<string, CrudConfig> = {
  "/usuarios/lista": {
    saveCommand: "users_save",
    deleteCommand: "users_delete",
    idKind: "string",
    fields: [
      { name: "tipo_usuario", label: "Tipo de usuário", kind: "select", required: true, options: ["Oficial", "Praça"] },
      { name: "posto_graduacao", label: "Posto/graduação", kind: "text", required: true },
      { name: "nome", label: "Nome", kind: "text", required: true },
      { name: "matricula", label: "Matrícula", kind: "text", required: true },
      { name: "is_encarregado", label: "Encarregado", kind: "checkbox" },
      { name: "is_operador", label: "Operador", kind: "checkbox" },
      { name: "email", label: "Email", kind: "email" },
      { name: "perfil", label: "Perfil", kind: "select", options: ["admin", "comum"] },
      { name: "senha", label: "Senha", kind: "password" }
    ]
  },
  "/catalogos/crimes": {
    saveCommand: "legal_catalogs_save_crime",
    deleteCommand: "legal_catalogs_delete_crime",
    idKind: "string",
    fields: [
      { name: "tipo", label: "Tipo", kind: "select", options: ["Crime", "Contravenção"] },
      { name: "dispositivo_legal", label: "Dispositivo legal", kind: "text" },
      { name: "artigo", label: "Artigo", kind: "text", required: true },
      { name: "descricao_artigo", label: "Descrição", kind: "textarea" },
      { name: "paragrafo", label: "Parágrafo", kind: "text" },
      { name: "inciso", label: "Inciso", kind: "text" },
      { name: "alinea", label: "Alínea", kind: "text" }
    ]
  },
  "/catalogos/transgressoes": {
    saveCommand: "legal_catalogs_save_transgression",
    deleteCommand: "legal_catalogs_delete_transgression",
    idKind: "number",
    fields: [
      { name: "artigo", label: "Artigo", kind: "number" },
      { name: "gravidade", label: "Gravidade", kind: "select", options: ["Leve", "Média", "Grave"] },
      { name: "inciso", label: "Inciso", kind: "text" },
      { name: "texto", label: "Texto", kind: "textarea", required: true }
    ]
  },
  "/catalogos/art29": {
    saveCommand: "legal_catalogs_save_art29",
    deleteCommand: "legal_catalogs_delete_art29",
    idKind: "string",
    fields: [
      { name: "inciso", label: "Inciso", kind: "text", required: true },
      { name: "texto", label: "Texto", kind: "textarea", required: true }
    ]
  },
  "/procedimentos/lista": {
    saveCommand: "proceedings_create",
    updateCommand: "proceedings_update",
    deleteCommand: "proceedings_delete",
    idKind: "string",
    fields: [
      { name: "numero", label: "Número", kind: "text", required: true },
      {
        name: "tipo_geral", label: "Tipo Geral", kind: "select", required: true,
        options: ["Processo", "Procedimento"]
      },
      {
        name: "tipo_detalhe", label: "Tipo", kind: "select", required: true,
        options: ["PAD", "PADE", "CD", "CJ", "SR", "SV", "IPM", "FP", "CP", "PADS"]
      },
      {
        name: "documento_iniciador", label: "Doc. Iniciador", kind: "select", required: true,
        options: ["Portaria", "Memorando Disciplinar", "Feito Preliminar"]
      },
      { name: "local_fatos", label: "Local dos Fatos", kind: "text", required: true },
      { name: "local_origem", label: "Local de Origem", kind: "text" },
      { name: "data_instauracao", label: "Data de Instauração", kind: "date" },
      { name: "data_recebimento", label: "Data de Recebimento", kind: "date" },
      { name: "numero_portaria", label: "N° da Portaria", kind: "text" },
      { name: "numero_memorando", label: "N° do Memorando", kind: "text" },
      { name: "numero_feito", label: "N° do Feito", kind: "text" },
      { name: "numero_rgf", label: "N° RGF", kind: "text" },
      { name: "numero_controle", label: "N° de Controle", kind: "text" },
      { name: "processo_sei", label: "Processo SEI", kind: "text" },
      { name: "nome_vitima", label: "Nome da Vítima", kind: "text" },
      { name: "natureza_processo", label: "Natureza", kind: "text" },
      { name: "resumo_fatos", label: "Resumo dos Fatos", kind: "textarea" },
      { name: "concluido", label: "Concluído", kind: "checkbox" },
      { name: "data_conclusao", label: "Data de Conclusão", kind: "date" },
      {
        name: "solucao_tipo", label: "Tipo de Solução", kind: "select",
        options: ["Punido", "Absolvido", "Arquivado", "Homologado", "Avocado"]
      },
      { name: "solucao_final", label: "Solução Final", kind: "textarea" },
      {
        name: "penalidade_tipo", label: "Penalidade", kind: "select",
        options: ["Prisao", "Detencao", "Advertencia", "Reprimenda"]
      },
      { name: "penalidade_dias", label: "Dias de Penalidade", kind: "number" }
    ]
  }
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
}

function groupedRoutes() {
  return routes.reduce<Record<string, Route[]>>((acc, route) => {
    acc[route.group] = acc[route.group] ?? [];
    acc[route.group].push(route);
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
    const data = new FormData(event.currentTarget);
    const response = await call<SessionUser>("auth_login", {
      email: data.get("email"),
      senha: data.get("senha")
    });
    if (!response.ok || !response.data) {
      renderLogin(response.error ?? "Falha ao autenticar.");
      return;
    }
    session = response.data;
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
  const columns = Object.keys(data[0] as Record<string, unknown>);
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

function renderField(field: CrudField, row: Record<string, unknown> | null) {
  const value = fieldValue(row, field);
  const required = field.required ? "required" : "";

  if (field.kind === "checkbox") {
    return `
      <label class="checkbox">
        <input name="${field.name}" type="checkbox" ${value === true ? "checked" : ""} />
        ${field.label}
      </label>
    `;
  }

  if (field.kind === "select") {
    return `
      <label>${field.label}
        <select name="${field.name}" ${required}>
          <option value=""></option>
          ${(field.options ?? []).map((option) => `
            <option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>
          `).join("")}
        </select>
      </label>
    `;
  }

  if (field.kind === "textarea") {
    return `<label>${field.label}<textarea name="${field.name}" ${required}>${escapeHtml(String(value))}</textarea></label>`;
  }

  if (field.kind === "date") {
    const dateVal = String(value).substring(0, 10);
    return `<label>${field.label}<input name="${field.name}" type="date" value="${escapeHtml(dateVal)}" ${required} /></label>`;
  }

  return `<label>${field.label}<input name="${field.name}" type="${field.kind}" value="${escapeHtml(String(value))}" ${required} /></label>`;
}

function renderCrudForm(route: Route, row: Record<string, unknown> | null = null, error = "") {
  const config = crudConfigs[route.path];
  if (!config) return;
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
        ${config.fields.map((field) => renderField(field, row)).join("")}
        ${error ? `<p class="error">${error}</p>` : ""}
        <div class="form-actions">
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);

  document.querySelector<HTMLButtonElement>("#cancel-form")?.addEventListener("click", () => {
    void renderRoute();
  });

  document.querySelector<HTMLFormElement>("#crud-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request = buildPayload(config, form);
    const isEdit = Boolean(request.id);
    const command = isEdit && config.updateCommand ? config.updateCommand : config.saveCommand;
    const response = await call(command, { request });
    if (!response.ok) {
      renderCrudForm(route, row, response.error ?? "Falha ao salvar.");
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
    renderCrudForm(route);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-edit-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.editIndex);
      renderCrudForm(route, currentRows[index] ?? null);
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

  const route = routes.find((item) => item.path === activePath) ?? routes[0];

  if (route.path === "/estatisticas/anuais") return renderAnnualStats();
  if (route.path === "/prazos") return renderPrazosGlobal();
  if (route.path === "/mapas/mensal") return renderMonthlyMap();
  if (route.path === "/auditoria") return renderAuditWithFilters();
  if (route.path === "/usuarios/lista") return renderUsersList();
  if (route.path === "/stats/procedimentos") return renderProceedingsStats();

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char] ?? char));
}

function cellDisplay(val: unknown): string {
  if (typeof val === "boolean") return val ? "sim" : "não";
  return String(val ?? "");
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
  if (evidencePmId && route.path === "/procedimentos/lista") {
    return renderEvidencePanel(route);
  }

  shell(`<section class="panel"><p>Carregando detalhes...</p></section>`);

  const isProceeding = route.path === "/procedimentos/lista";
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
                ${m.tipo ? `<strong class="andamento-tipo">${escapeHtml(m.tipo)}</strong>` : ""}
                <span>${escapeHtml(m.data)}</span>
                <span>${escapeHtml(m.usuario)}</span>
                ${canWrite() ? `<button class="danger small" data-remove-andamento="${escapeHtml(m.id)}">Remover</button>` : ""}
              </div>
              <p class="andamento-texto">${escapeHtml(m.texto)}</p>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="empty">Nenhum andamento registrado.</p>`}
      ${canWrite() ? `
        <form id="add-movement-form" class="add-movement-form">
          <select name="tipo">
            <option value="">Tipo (opcional)</option>
            ${TIPOS_ANDAMENTO.map((t) => `<option>${escapeHtml(t)}</option>`).join("")}
          </select>
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
  type PmEvidence = { pm_envolvido_id: string; nome?: string | null; posto_graduacao?: string | null; indicios?: { categorias: string[]; crimes: unknown[]; rdpm: unknown[]; art29: unknown[] } };
  const evidenceList: PmEvidence[] = Array.isArray(evidenceResp.data) ? evidenceResp.data as PmEvidence[] : [];

  const indiciosHtml = isProceeding ? `
    <div class="detail-section">
      <h2>Indícios por PM <span class="badge">${evidenceList.length}</span></h2>
      ${evidenceList.length === 0 ? `<p class="empty">Nenhum PM envolvido com indícios registrados.</p>` : `
        <ul class="andamentos-list">
          ${evidenceList.map((pm) => {
            const ind = pm.indicios ?? { categorias: [], crimes: [], rdpm: [], art29: [] };
            const cats = ind.categorias.length > 0 ? ind.categorias.join(", ") : "sem categorias";
            const total = ind.crimes.length + ind.rdpm.length + ind.art29.length;
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
      renderCrudForm(route, data as Record<string, unknown>);
    });
  }

  document.querySelector<HTMLFormElement>("#add-movement-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const tipo = (form.get("tipo") as string).trim() || null;
    const texto = (form.get("texto") as string).trim();
    const resp = await call("movements_add", { request: { processo_id: detailId, tipo, texto } });
    if (!resp.ok) { alert(resp.error ?? "Falha ao adicionar andamento."); return; }
    void renderDetail(route);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove-andamento]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remover este andamento?")) return;
      const andamentoId = btn.dataset.removeAndamento!;
      const resp = await call("movements_remove", { processo_id: detailId, andamento_id: andamentoId });
      if (!resp.ok) { alert(resp.error ?? "Falha ao remover."); return; }
      void renderDetail(route);
    });
  });

  document.querySelector<HTMLButtonElement>("#btn-view-pdf")?.addEventListener("click", async () => {
    const resp = await call<{ conteudo: string | null; content_type: string | null }>(
      "proceedings_get_pdf", { processo_id: detailId, include_content: true }
    );
    if (!resp.ok || !resp.data?.conteudo) { alert("Falha ao carregar PDF."); return; }
    const bytes = Uint8Array.from(atob(resp.data.conteudo), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: resp.data.content_type ?? "application/pdf" });
    window.open(URL.createObjectURL(blob), "_blank");
  });

  document.querySelector<HTMLButtonElement>("#btn-remove-pdf")?.addEventListener("click", async () => {
    if (!confirm("Remover o PDF anexado?")) return;
    const resp = await call("proceedings_remove_pdf", { processo_id: detailId });
    if (!resp.ok) { alert(resp.error ?? "Falha ao remover PDF."); return; }
    void renderDetail(route);
  });

  document.querySelector<HTMLInputElement>("#pdf-upload-input")?.addEventListener("change", async (e) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const resp = await call("proceedings_upload_pdf", {
        request: { processo_id: detailId, nome_arquivo: file.name, conteudo_base64: base64, content_type: file.type || "application/pdf" }
      });
      if (!resp.ok) { alert(resp.error ?? "Falha no upload."); return; }
      void renderDetail(route);
    };
    reader.readAsDataURL(file);
  });

  // Evidence: open panel for selected PM
  document.querySelectorAll<HTMLButtonElement>("[data-evidence-pm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      evidencePmId = btn.dataset.evidencePm!;
      void renderDetail(route);
    });
  });

  // Prazos: close active deadline
  document.querySelector<HTMLButtonElement>("#btn-close-deadline")?.addEventListener("click", async () => {
    if (!confirm("Encerrar o prazo ativo deste processo?")) return;
    const resp = await call("deadlines_close", { processo_id: detailId });
    if (!resp.ok) { alert(resp.error ?? "Falha ao encerrar prazo."); return; }
    void renderDetail(route);
  });

  // Prazos: add extension
  document.querySelector<HTMLFormElement>("#extension-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const dp = (form.get("data_portaria") as string).trim();
    const resp = await call("deadlines_add_extension", {
      request: {
        processo_id: detailId,
        dias_prorrogacao: Number(form.get("dias")),
        motivo: (form.get("motivo") as string).trim(),
        autorizado_por: (form.get("autorizado_por") as string).trim(),
        autorizado_tipo: (form.get("autorizado_tipo") as string).trim(),
        numero_portaria: (form.get("numero_portaria") as string).trim() || null,
        data_portaria: dp || null,
      }
    });
    if (!resp.ok) { alert(resp.error ?? "Falha ao prorrogar."); return; }
    void renderDetail(route);
  });

  bindExportEvents({ ...route, csvExport: undefined });
}

async function renderEvidencePanel(route: Route) {
  if (!detailId || !evidencePmId) return;

  shell(`<section class="panel"><p>Carregando indícios...</p></section>`);

  const [evResp, catsResp] = await Promise.all([
    call<{ pm_envolvido_id: string; categorias: string[]; crimes: unknown[]; rdpm: unknown[]; art29: unknown[] }>(
      "evidence_load_for_pm", { pm_envolvido_id: evidencePmId }
    ),
    call<string[]>("evidence_categories"),
  ]);

  const ev = evResp.data ?? { pm_envolvido_id: evidencePmId, categorias: [], crimes: [], rdpm: [], art29: [] };
  const allCats: string[] = catsResp.data ?? ["crimes_cpm", "transgressoes_rdpm", "transgressoes_art29", "sem_indicios"];

  type EvidItem = Record<string, unknown>;
  const selectedCrimes: EvidItem[] = Array.isArray(ev.crimes) ? (ev.crimes as EvidItem[]) : [];
  const selectedRdpm: EvidItem[] = Array.isArray(ev.rdpm) ? (ev.rdpm as EvidItem[]) : [];
  const selectedArt29: EvidItem[] = Array.isArray(ev.art29) ? (ev.art29 as EvidItem[]) : [];

  const itemRow = (item: EvidItem, removeAttr: string) => `
    <div class="evidence-item">
      <span>${escapeHtml(String(item.artigo ?? item.inciso ?? item.id ?? ""))}</span>
      <small>${escapeHtml(String(item.descricao_artigo ?? item.texto ?? ""))}</small>
      <button class="danger small" ${removeAttr}="true" data-item-id="${escapeHtml(String(item.id ?? ""))}">×</button>
    </div>`;

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Indícios — PM ${escapeHtml(evidencePmId)}</h1></div>
        <div class="page-head-right">
          <button id="save-evidence">Salvar Indícios</button>
          <button class="secondary" id="back-to-detail">← Voltar ao Processo</button>
        </div>
      </div>

      <div class="detail-section">
        <h2>Categorias</h2>
        <div class="evidence-cats">
          ${allCats.map((cat) => `
            <label class="checkbox">
              <input type="checkbox" name="cat" value="${escapeHtml(cat)}" ${ev.categorias.includes(cat) ? "checked" : ""} />
              ${escapeHtml(cat)}
            </label>`).join("")}
        </div>
      </div>

      <div class="detail-section">
        <h2>Crimes / Contravenções (${selectedCrimes.length})</h2>
        <div id="crimes-list">${selectedCrimes.map((c) => itemRow(c, "data-remove-crime")).join("") || `<p class="empty">Nenhum</p>`}</div>
        <div class="evidence-search">
          <input id="search-crimes-input" type="search" placeholder="Buscar crime..." />
          <button id="btn-search-crimes">Buscar</button>
        </div>
        <div id="crimes-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Transgressões RDPM (${selectedRdpm.length})</h2>
        <div id="rdpm-list">${selectedRdpm.map((r) => itemRow(r, "data-remove-rdpm")).join("") || `<p class="empty">Nenhuma</p>`}</div>
        <div class="evidence-search">
          <input id="search-rdpm-input" type="search" placeholder="Buscar transgressão..." />
          <button id="btn-search-rdpm">Buscar</button>
        </div>
        <div id="rdpm-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Art. 29 — Estatuto (${selectedArt29.length})</h2>
        <div id="art29-list">${selectedArt29.map((a) => itemRow(a, "data-remove-art29")).join("") || `<p class="empty">Nenhum</p>`}</div>
        <div class="evidence-search">
          <input id="search-art29-input" type="search" placeholder="Buscar art. 29..." />
          <button id="btn-search-art29">Buscar</button>
        </div>
        <div id="art29-results" class="evidence-results"></div>
      </div>
    </section>
  `);

  // Back
  document.querySelector<HTMLButtonElement>("#back-to-detail")?.addEventListener("click", () => {
    evidencePmId = null;
    void renderDetail(route);
  });

  // Build selected id sets (mutable as user adds/removes)
  const selectedCrimeIds = new Set(selectedCrimes.map((c) => String(c.id)));
  const selectedRdpmIds = new Set(selectedRdpm.map((r) => String(r.id)));
  const selectedArt29Ids = new Set(selectedArt29.map((a) => String(a.id)));

  // Remove buttons
  document.querySelectorAll<HTMLButtonElement>("[data-remove-crime]").forEach((btn) => {
    btn.addEventListener("click", () => { selectedCrimeIds.delete(btn.dataset.itemId!); btn.closest(".evidence-item")?.remove(); });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-remove-rdpm]").forEach((btn) => {
    btn.addEventListener("click", () => { selectedRdpmIds.delete(btn.dataset.itemId!); btn.closest(".evidence-item")?.remove(); });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-remove-art29]").forEach((btn) => {
    btn.addEventListener("click", () => { selectedArt29Ids.delete(btn.dataset.itemId!); btn.closest(".evidence-item")?.remove(); });
  });

  function makeAddBtn(label: string, id: string, container: string, idSet: Set<string>) {
    return `<button class="outline small" data-add-to="${container}" data-add-id="${escapeHtml(id)}">${label}</button>`;
  }

  async function doSearch(command: string, inputId: string, resultsId: string, container: string, idSet: Set<string>, extraArgs: Record<string, unknown> = {}) {
    const termo = (document.querySelector<HTMLInputElement>(`#${inputId}`)?.value ?? "").trim();
    const resp = await call<EvidItem[]>(command, { termo, ...extraArgs });
    const items = resp.data ?? [];
    const el = document.querySelector(`#${resultsId}`)!;
    if (!items.length) { el.innerHTML = `<p class="empty">Sem resultados.</p>`; return; }
    el.innerHTML = items.map((item) => `
      <div class="evidence-result-item">
        <div><strong>${escapeHtml(String(item.artigo ?? item.inciso ?? ""))}</strong> — <small>${escapeHtml(String(item.descricao_artigo ?? item.texto ?? "").substring(0, 80))}</small></div>
        ${idSet.has(String(item.id)) ? `<span class="badge badge--ok">✓ Adicionado</span>` : makeAddBtn("Adicionar", String(item.id), container, idSet)}
      </div>`).join("");
    el.querySelectorAll<HTMLButtonElement>("[data-add-to]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const addId = btn.dataset.addId!;
        const target = btn.dataset.addTo!;
        const item = items.find((i) => String(i.id) === addId);
        if (!item) return;
        idSet.add(addId);
        const list = document.querySelector(`#${target}-list`)!;
        const div = document.createElement("div");
        div.className = "evidence-item";
        div.innerHTML = `<span>${escapeHtml(String(item.artigo ?? item.inciso ?? ""))}</span><small>${escapeHtml(String(item.descricao_artigo ?? item.texto ?? ""))}</small><button class="danger small">×</button>`;
        div.querySelector("button")!.addEventListener("click", () => { idSet.delete(addId); div.remove(); });
        list.appendChild(div);
        btn.replaceWith(`<span class="badge badge--ok">✓ Adicionado</span>`);
      });
    });
  }

  document.querySelector("#btn-search-crimes")?.addEventListener("click", () => doSearch("evidence_search_crimes", "search-crimes-input", "crimes-results", "crimes", selectedCrimeIds));
  document.querySelector("#btn-search-rdpm")?.addEventListener("click", () => doSearch("evidence_search_rdpm", "search-rdpm-input", "rdpm-results", "rdpm", selectedRdpmIds));
  document.querySelector("#btn-search-art29")?.addEventListener("click", () => doSearch("evidence_search_art29", "search-art29-input", "art29-results", "art29", selectedArt29Ids));

  document.querySelector<HTMLButtonElement>("#save-evidence")?.addEventListener("click", async () => {
    const cats = [...document.querySelectorAll<HTMLInputElement>("input[name='cat']:checked")].map((el) => el.value);
    const resp = await call("evidence_save_for_pm", {
      request: {
        pm_envolvido_id: evidencePmId,
        categorias: cats,
        crimes: [...selectedCrimeIds],
        rdpm: [...selectedRdpmIds].map(Number),
        art29: [...selectedArt29Ids],
      }
    });
    if (!resp.ok) { alert(resp.error ?? "Falha ao salvar."); return; }
    evidencePmId = null;
    void renderDetail(route);
  });
}

async function renderPrazosGlobal() {
  shell(`<section class="panel"><p>Carregando...</p></section>`);
  const [upcomingResp, overdueResp, summaryResp] = await Promise.all([
    call<unknown[]>("deadlines_upcoming", { days_ahead: 14 }),
    call<unknown[]>("deadlines_overdue"),
    call<Record<string, unknown>>("deadlines_dashboard"),
  ]);

  const upcoming: unknown[] = upcomingResp.data ?? [];
  const overdue: unknown[] = overdueResp.data ?? [];
  const summary = summaryResp.data ?? {};

  const printRoute = { path: "/prazos", label: "Prazos", group: "", printable: true };

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Prazos</h1></div>
        <div class="page-head-right">${exportBar(printRoute)}</div>
      </div>
      <div class="stat-grid" style="margin-bottom:24px">
        <div class="stat-card"><span class="stat-value">${escapeHtml(String(summary.total ?? 0))}</span><span class="stat-label">Total</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${escapeHtml(String(summary.vencidos ?? 0))}</span><span class="stat-label">Vencidos</span></div>
        <div class="stat-card"><span class="stat-value">${escapeHtml(String(summary.proximos_7_dias ?? 0))}</span><span class="stat-label">Próximos 7 dias</span></div>
      </div>
      ${overdue.length > 0 ? `
        <h2 style="color:#dc2626;margin:0 0 12px">Vencidos (${overdue.length})</h2>
        ${tableFrom(overdue, printRoute)}
      ` : ""}
      <h2 style="margin:24px 0 12px">Próximos 14 dias (${upcoming.length})</h2>
      ${upcoming.length > 0 ? tableFrom(upcoming, printRoute) : `<p class="empty">Nenhum prazo próximo.</p>`}
    </section>
  `);
  bindExportEvents(printRoute);
}

async function renderMonthlyMap() {
  shell(`<section class="panel"><p>Carregando...</p></section>`);
  const [typesResp, yearsResp] = await Promise.all([
    call<Array<{ codigo: string; total: number }>>("reports_process_types"),
    call<number[]>("reports_available_years"),
  ]);
  const types = typesResp.data ?? [];
  const years = yearsResp.data ?? [selectedYear];

  const printRoute = { path: "/mapas/mensal", label: "Mapa Mensal", group: "", printable: true };

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Mapa Mensal</h1></div>
        <div class="page-head-right">${exportBar(printRoute)}</div>
      </div>
      <form id="map-form" class="add-movement-form" style="max-width:500px">
        <label>Mês
          <select name="mes">
            ${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
              .map((m, i) => `<option value="${i+1}" ${(i+1) === new Date().getMonth()+1 ? "selected" : ""}>${m}</option>`).join("")}
          </select>
        </label>
        <label>Ano
          <select name="ano">
            ${years.map((y) => `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}</option>`).join("")}
          </select>
        </label>
        <label>Tipo de Processo
          <select name="tipo_processo">
            ${types.map((t) => `<option value="${escapeHtml(t.codigo)}">${escapeHtml(t.codigo)} (${t.total})</option>`).join("")}
            <option value="TODOS">Todos</option>
          </select>
        </label>
        <div style="display:flex;gap:8px">
          <button type="submit" name="mode" value="mensal">Gerar Mapa Mensal</button>
          <button type="submit" class="secondary" name="mode" value="completo">Gerar Completo</button>
        </div>
      </form>
      <div id="map-result"></div>
    </section>
  `);

  document.querySelector<HTMLFormElement>("#map-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const mes = Number(form.get("mes"));
    const ano = Number(form.get("ano"));
    const tipo = String(form.get("tipo_processo") ?? "TODOS");
    const mode = (e.submitter as HTMLButtonElement)?.value ?? "mensal";
    const resultEl = document.querySelector("#map-result")!;
    resultEl.innerHTML = `<p>Gerando mapa...</p>`;
    const resp = mode === "completo"
      ? await call<Record<string, unknown>>("reports_generate_complete_map", { request: { mes, ano } })
      : await call<Record<string, unknown>>("reports_generate_monthly_map", { request: { mes, ano, tipo_processo: tipo } });
    if (!resp.ok) { resultEl.innerHTML = `<p class="error">${escapeHtml(resp.error ?? "Erro")}</p>`; return; }
    const dados = resp.data as Record<string, unknown>;
    resultEl.innerHTML = `
      <h2 style="margin-top:24px">Resultado</h2>
      <pre>${escapeHtml(JSON.stringify(dados.meta ?? dados, null, 2))}</pre>
      <button id="btn-save-map">Salvar este Mapa</button>
    `;
    document.querySelector<HTMLButtonElement>("#btn-save-map")?.addEventListener("click", async () => {
      const saveResp = await call("reports_save_map", { request: { dados_mapa: dados } });
      if (!saveResp.ok) { alert(saveResp.error ?? "Falha ao salvar."); return; }
      alert("Mapa salvo com sucesso!");
    });
  });
  bindExportEvents(printRoute);
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

async function renderAnnualStats() {
  shell(`<section class="panel"><p>Carregando...</p></section>`);

  const yearsResp = await call<number[]>("reports_available_years");
  const years: number[] = yearsResp.data ?? [selectedYear];

  const statsResp = await call<Record<string, unknown>>("reports_annual_statistics", { ano: selectedYear });
  const stats = statsResp.data;

  const yearOptions = years.map((y) =>
    `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}</option>`
  ).join("");

  const summaryCards = stats ? `
    <div class="stat-grid">
      ${[
        ["Total Geral", stats.total_geral],
        ["Processos", stats.total_processos],
        ["Procedimentos", stats.total_procedimentos],
        ["Punidos (PAD/PADS)", stats.pad_pads_punidos],
        ["Absolvidos/Arq.", stats.pad_pads_absolvidos_arquivados],
        ["Indícios Crime", stats.ipm_sindicancia_indicios_crime],
        ["Indícios Transgressão", stats.ipm_sindicancia_indicios_transgressao],
      ].map(([label, value]) => `
        <div class="stat-card">
          <span class="stat-value">${escapeHtml(String(value ?? 0))}</span>
          <span class="stat-label">${label}</span>
        </div>
      `).join("")}
    </div>
  ` : `<p class="error">${statsResp.error ?? "Erro ao carregar"}</p>`;

  const buildTypeTable = (rows: unknown[]) => {
    if (!Array.isArray(rows) || rows.length === 0) return `<p class="empty">Sem dados.</p>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Total</th><th>Concluídos</th><th>Em Andamento</th></tr></thead>
          <tbody>
            ${rows.map((r) => {
              const row = r as Record<string, unknown>;
              return `<tr>
                <td>${escapeHtml(String(row.tipo_detalhe ?? row.categoria ?? "—"))}</td>
                <td>${escapeHtml(String(row.total ?? 0))}</td>
                <td>${escapeHtml(String(row.concluidos ?? 0))}</td>
                <td>${escapeHtml(String(row.em_andamento ?? 0))}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  };

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas Anuais</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${yearOptions}</select>
            <button type="submit">Ver</button>
          </form>
          ${exportBar({ path: "/estatisticas/anuais", label: "", group: "", printable: true })}
        </div>
      </div>
      ${summaryCards}
      ${stats ? `
        <h2 style="margin-top:24px">Processos por Tipo</h2>
        ${buildTypeTable(stats.processos_por_tipo as unknown[])}
        <h2 style="margin-top:24px">Procedimentos por Tipo</h2>
        ${buildTypeTable(stats.procedimentos_por_tipo as unknown[])}
      ` : ""}
    </section>
  `);

  document.querySelector<HTMLFormElement>("#year-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    selectedYear = Number(form.get("ano")) || selectedYear;
    void renderAnnualStats();
  });

  bindExportEvents({ path: "/estatisticas/anuais", label: "", group: "", printable: true });
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

  document.querySelector<HTMLButtonElement>("#new-record")?.addEventListener("click", () => renderCrudForm(usersRoute));

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
    btn.addEventListener("click", () => renderCrudForm(usersRoute, currentRows[Number(btn.dataset.editIndex)] ?? null));
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

  const [userResp, statsResp, respResp, escrivaoResp, envolvResp] = await Promise.all([
    call<Record<string, unknown>>("users_get", { id: detailId }),
    call<UserStats>("users_statistics", { id: detailId }),
    call<ProcItem[]>("users_proceedings_responsible", { id: detailId }),
    call<ProcItem[]>("users_proceedings_escrivao", { id: detailId }),
    call<ProcItem[]>("users_proceedings_involved", { id: detailId }),
  ]);

  const user = userResp.data ?? {};
  const stats = statsResp.data ?? {};
  const procResp = respResp.data ?? [];
  const procEscrivao = escrivaoResp.data ?? [];
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
        <h2>Como Encarregado (${procResp.length})</h2>
        ${procTable(procResp)}
      </div>
      <div class="detail-section">
        <h2>Como Escrivão (${procEscrivao.length})</h2>
        ${procTable(procEscrivao)}
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
    renderCrudForm(usersRoute, user);
  });

  document.querySelector<HTMLButtonElement>("#reactivate-user")?.addEventListener("click", async () => {
    if (!confirm("Reativar este usuário?")) return;
    const r = await call("users_reactivate", { id: detailId });
    if (!r.ok) { alert(r.error ?? "Erro"); return; }
    void renderUserDetail(route);
  });

  bindExportEvents({ ...route, csvExport: undefined });
}

async function renderProceedingsStats() {
  shell(`<section class="panel"><p>Carregando estatísticas...</p></section>`);

  const statsRoute = { path: "/stats/procedimentos", label: "Estatísticas de Procedimentos", group: "", printable: true };

  const yearParam = { ano: selectedYear };
  const [inProgressResp, padsSolResp, ipmEvResp, srEvResp, top10Resp, driverResp, natureResp, crimeResp, milResp] = await Promise.all([
    call<Record<string, unknown>>("proceedings_in_progress_stats"),
    call<unknown[]>("proceedings_pads_solutions", yearParam),
    call<Record<string, unknown>>("proceedings_ipm_evidence", yearParam),
    call<Record<string, unknown>>("proceedings_sr_evidence", yearParam),
    call<unknown[]>("proceedings_top10_transgressions", yearParam),
    call<unknown[]>("proceedings_driver_ranking", yearParam),
    call<unknown[]>("proceedings_nature_stats", yearParam),
    call<unknown[]>("proceedings_common_crimes", yearParam),
    call<unknown[]>("proceedings_military_crimes", yearParam),
  ]);

  const inProg = inProgressResp.data ?? {};
  const ipmEv = ipmEvResp.data ?? {};
  const srEv = srEvResp.data ?? {};

  const yearsResp = await call<number[]>("reports_available_years");
  const years = yearsResp.data ?? [selectedYear];
  const yearOptions = years.map((y) => `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}</option>`).join("");

  function simpleTable(items: unknown[], cols: string[]) {
    if (!Array.isArray(items) || items.length === 0) return `<p class="empty">Sem dados.</p>`;
    return `<div class="table-wrap"><table>
      <thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
      <tbody>${(items as Record<string, unknown>[]).map((row) =>
        `<tr>${cols.map((c) => `<td>${escapeHtml(String(row[c.toLowerCase().replace(/ /g,"_")] ?? row[c] ?? ""))}</td>`).join("")}</tr>`
      ).join("")}</tbody>
    </table></div>`;
  }

  shell(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas de Procedimentos</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${yearOptions}</select>
            <button type="submit">Ver</button>
          </form>
          ${exportBar(statsRoute)}
        </div>
      </div>

      <div class="detail-section">
        <h2>Em Andamento</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(inProg.total ?? 0))}</span><span class="stat-label">Total</span></div>
          <div class="stat-card badge--ok"><span class="stat-value">${escapeHtml(String(inProg.concluidos ?? 0))}</span><span class="stat-label">Concluídos</span></div>
          ${Array.isArray(inProg.por_tipo) ? (inProg.por_tipo as Record<string,unknown>[]).map((t) =>
            `<div class="stat-card"><span class="stat-value">${escapeHtml(String(t.quantidade ?? 0))}</span><span class="stat-label">${escapeHtml(String(t.tipo ?? ""))}</span></div>`
          ).join("") : ""}
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios IPM/Sindicância — ${selectedYear}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(ipmEv.com_indicios ?? 0))}</span><span class="stat-label">Com Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(ipmEv.sem_indicios ?? 0))}</span><span class="stat-label">Sem Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(ipmEv.com_indicios_crime ?? 0))}</span><span class="stat-label">Crimes</span></div>
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(ipmEv.com_indicios_transgressao ?? 0))}</span><span class="stat-label">Transgressões</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios SR — ${selectedYear}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(srEv.crimes_comuns ?? 0))}</span><span class="stat-label">Crimes Comuns</span></div>
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(srEv.transgressoes ?? 0))}</span><span class="stat-label">Transgressões</span></div>
          <div class="stat-card"><span class="stat-value">${escapeHtml(String(srEv.sem_indicios ?? 0))}</span><span class="stat-label">Sem Indícios</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Top 10 Transgressões — ${selectedYear}</h2>
        ${tableFrom(top10Resp.data ?? [], statsRoute)}
      </div>

      <div class="detail-section">
        <h2>Soluções PADS/PAD — ${selectedYear}</h2>
        ${tableFrom(padsSolResp.data ?? [], statsRoute)}
      </div>

      <div class="detail-section">
        <h2>Crimes Comuns — ${selectedYear}</h2>
        ${tableFrom(crimeResp.data ?? [], statsRoute)}
      </div>

      <div class="detail-section">
        <h2>Crimes Militares (IPM) — ${selectedYear}</h2>
        ${tableFrom(milResp.data ?? [], statsRoute)}
      </div>

      <div class="detail-section">
        <h2>Naturezas Apuradas — ${selectedYear}</h2>
        ${tableFrom(natureResp.data ?? [], statsRoute)}
      </div>

      <div class="detail-section">
        <h2>Ranking de Motoristas (Sinistros) — ${selectedYear}</h2>
        ${tableFrom(driverResp.data ?? [], statsRoute)}
      </div>
    </section>
  `);

  document.querySelector<HTMLFormElement>("#year-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    selectedYear = Number(new FormData(e.currentTarget as HTMLFormElement).get("ano")) || selectedYear;
    void renderProceedingsStats();
  });

  bindExportEvents(statsRoute);
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
