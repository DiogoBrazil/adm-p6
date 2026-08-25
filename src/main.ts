import "./styles.css";
import { call, type SessionUser } from "./api";
import { escapeHtml, formularioTemPendencia, podeDescartarFormulario } from "./dom";
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
import { ROTA as ROTA_ENCARREGADOS, renderEncarregados } from "./telas/encarregados";
import { ROTA as ROTA_DASHBOARD, renderDashboard } from "./telas/dashboard";
import { ROTA as ROTA_AUDITORIA, renderAuditoria } from "./telas/auditoria";
import {
  ROTA_LISTA as ROTA_USUARIOS,
  ROTA_NOVO as ROTA_USUARIO_NOVO,
  renderFormularioUsuario,
  renderListaUsuarios,
} from "./telas/usuarios";
import {
  ROTA_MENSAL as ROTA_MAPA_MENSAL,
  ROTA_SALVOS as ROTA_MAPAS_SALVOS,
  renderMapaMensal,
  renderMapasSalvos,
} from "./telas/mapas";
import {
  aplicarBarras,
  ROTA as ROTA_ESTATISTICAS_PROCESSOS,
  ROTA_PROCEDIMENTOS as ROTA_STATS_PROCEDIMENTOS,
  renderEstatisticasProcedimentos,
  renderEstatisticasProcessos,
} from "./telas/estatisticas";

const brasaoUrl = new URL("../src-tauri/icons/icon.png", import.meta.url).href;

// Shell da aplicação: sessão, menu e roteamento. Nada mais.
//
// O `call()` local acabou aqui. Ele recebia o nome do comando como `string`,
// então comando inexistente e argumento errado só apareciam em runtime, como
// mensagem de erro na tela do usuário — foi assim que 15 comandos mortos
// sobreviveram a toda a remodelagem do backend. Agora tudo passa por `./api`,
// e uma divergência com o Rust é erro de compilação.
//
// Junto com ele saiu o renderizador genérico: tabela montada das chaves do
// JSON, formulários declarados em `crudConfigs` e uma ficha de detalhe que
// servia a qualquer coisa. Cada tela vive em `./telas`, e as de catálogo nem
// existem como arquivo — nascem de `legal_catalogs_definitions`.

/** Entrada de menu. Cada rota tem tela própria em `./telas`. */
type Route = {
  path: string;
  label: string;
  group: string;
  adminOnly?: boolean;
};

let routes: Route[] = [
  { path: ROTA_DASHBOARD, label: "Painel", group: "Geral" },
  { path: ROTA_PROCESSOS, label: "Procedimentos", group: "Procedimentos" },
  { path: ROTA_PRAZOS, label: "Prazos", group: "Procedimentos" },
  { path: ROTA_USUARIOS, label: "Usuários", group: "Usuários" },
  { path: ROTA_USUARIO_NOVO, label: "Novo usuário", group: "Usuários", adminOnly: true },
  {
    path: ROTA_CONFIG_APURATORIO,
    label: "Configuração de apuratórios",
    group: "Catálogos",
    adminOnly: true
  },
  { path: ROTA_AUDITORIA, label: "Auditoria", group: "Auditoria" },
  { path: ROTA_ENCARREGADOS, label: "Designações por Militar", group: "Relatórios" },
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
const DASHBOARD: Route = { path: ROTA_DASHBOARD, label: "Painel", group: "Geral" };

let session: SessionUser | null = null;
let activePath = "/dashboard";
const app = document.querySelector<HTMLDivElement>("#app")!;
let sidebarRecolhida = localStorage.getItem("adm-p6:sidebar-recolhida") === "true";
const gruposAbertos = new Set<string>(["Geral", "Procedimentos"]);

window.addEventListener("beforeunload", (evento) => {
  if (!formularioTemPendencia()) return;
  evento.preventDefault();
});

function canWrite() {
  return session?.is_admin === true;
}

async function loadSession() {
  const response = await call("auth_current_user");
  session = response.ok ? response.data : null;
  if (session) await montarRotasDeCatalogo();
}

/**
 * As telas de catálogo não são declaradas: vêm de
 * `legal_catalogs_definitions`. Acrescentar um catálogo no Rust faz a tela
 * aparecer sozinha — era isto que os 21 CRUDs escritos à mão custavam.
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
  const grupoAtivo = routes.find((route) => route.path === activePath)?.group ?? "Geral";
  gruposAbertos.add(grupoAtivo);
  const nav = Object.entries(groupedRoutes())
    .map(([group, items]) => {
      const aberto = gruposAbertos.has(group);
      return `
      <section class="nav-group${aberto ? " is-open" : ""}">
        <button class="nav-group-toggle" type="button" data-nav-group="${escapeHtml(group)}"
                aria-expanded="${aberto}" title="${escapeHtml(group)}">
          <span class="nav-group-mark" aria-hidden="true">${escapeHtml(group.slice(0, 1))}</span>
          <span class="nav-group-label">${escapeHtml(group)}</span>
          <span class="nav-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="nav-group-items"${aberto ? "" : " hidden"}>
          ${items.map((route) => `
            <button class="nav-item ${route.path === activePath ? "active" : ""}" data-route="${escapeHtml(route.path)}"
                    title="${escapeHtml(route.label)}">
              <span>${escapeHtml(route.label)}</span>
              ${route.adminOnly ? "<small>admin</small>" : ""}
            </button>
          `).join("")}
        </div>
      </section>
    `;
    }).join("");

  app.innerHTML = `
    <div class="app-shell${sidebarRecolhida ? " sidebar-is-collapsed" : ""}">
    <aside class="sidebar" aria-label="Navegação principal">
      <div class="brand">
        <img src="${brasaoUrl}" alt="" />
        <div><strong>ADM-P6</strong><span>Justiça e Disciplina</span></div>
      </div>
      <button class="sidebar-toggle" id="sidebar-toggle" type="button"
              aria-label="${sidebarRecolhida ? "Expandir menu" : "Recolher menu"}"
              title="${sidebarRecolhida ? "Expandir menu" : "Recolher menu"}">
        <span aria-hidden="true">${sidebarRecolhida ? "›" : "‹"}</span>
      </button>
      ${nav}
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="session-info">
          <span class="session-avatar" aria-hidden="true">${escapeHtml((session?.nome ?? "A").slice(0, 1).toUpperCase())}</span>
          <div>
          <strong>${escapeHtml(session?.nome ?? "Sessão não autenticada")}</strong>
          <span>${escapeHtml(session?.perfil ?? "offline")}</span>
          </div>
        </div>
        <button class="ghost small" id="logout">Sair</button>
      </header>
      <div class="content-area">${content}</div>
    </main>
    </div>
    <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="true"></div>
  `;

  // As barras proporcionais dos painéis de contagem: a largura é calculada e
  // por isso não cabe no CSS, e com a CSP ligada também não cabe num `style=""`
  // no markup. Aplicá-la aqui — o único ponto que escreve em `#app` — evita que
  // uma tela nova esqueça de fazê-lo.
  aplicarBarras(document);

  document.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!podeDescartarFormulario()) return;
      activePath = button.dataset.route ?? "/dashboard";
      void renderRoute();
    });
  });

  document.querySelector<HTMLButtonElement>("#sidebar-toggle")?.addEventListener("click", () => {
    sidebarRecolhida = !sidebarRecolhida;
    localStorage.setItem("adm-p6:sidebar-recolhida", String(sidebarRecolhida));
    document.querySelector(".app-shell")?.classList.toggle("sidebar-is-collapsed", sidebarRecolhida);
    const botao = document.querySelector<HTMLButtonElement>("#sidebar-toggle");
    if (botao) {
      const rotulo = sidebarRecolhida ? "Expandir menu" : "Recolher menu";
      botao.setAttribute("aria-label", rotulo);
      botao.title = rotulo;
      const simbolo = botao.querySelector("span");
      if (simbolo) simbolo.textContent = sidebarRecolhida ? "›" : "‹";
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-nav-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const grupo = button.dataset.navGroup!;
      if (sidebarRecolhida) {
        sidebarRecolhida = false;
        document.querySelector(".app-shell")?.classList.remove("sidebar-is-collapsed");
        const recolher = document.querySelector<HTMLButtonElement>("#sidebar-toggle");
        if (recolher) {
          recolher.setAttribute("aria-label", "Recolher menu");
          recolher.title = "Recolher menu";
          const simbolo = recolher.querySelector("span");
          if (simbolo) simbolo.textContent = "‹";
        }
      }
      const abrir = !gruposAbertos.has(grupo);
      if (abrir) gruposAbertos.add(grupo);
      else gruposAbertos.delete(grupo);
      localStorage.setItem("adm-p6:sidebar-recolhida", String(sidebarRecolhida));
      button.setAttribute("aria-expanded", String(abrir));
      button.closest(".nav-group")?.classList.toggle("is-open", abrir);
      button.parentElement?.querySelector<HTMLElement>(".nav-group-items")?.toggleAttribute("hidden", !abrir);
    });
  });

  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => {
    if (!podeDescartarFormulario()) return;
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
        <div class="login-brand">
          <img src="${brasaoUrl}" alt="" />
          <div><span>Sistema administrativo</span><h1>ADM-P6</h1><p>Seção de Justiça e Disciplina</p></div>
        </div>
        <div class="login-copy"><strong>Acesso ao sistema</strong><span>Use suas credenciais para continuar.</span></div>
        <label>E-mail<input name="email" type="email" autocomplete="username" placeholder="nome@dominio.com" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" placeholder="Digite sua senha" required /></label>
        ${error ? `<p class="feedback feedback--error" role="alert">${escapeHtml(error)}</p>` : ""}
        <button type="submit">Entrar no ADM-P6</button>
      </form>
    </main>
  `;

  document.querySelector<HTMLFormElement>("#login-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const response = await call("auth_login", {
      email: String(data.get("email") ?? ""),
      senha: String(data.get("senha") ?? ""),
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
  if (route.path === ROTA_AUDITORIA) return renderAuditoria(contexto);
  if (route.path === ROTA_ENCARREGADOS) return renderEncarregados(contexto);
  if (route.path === ROTA_ESTATISTICAS_PROCESSOS) return renderEstatisticasProcessos(contexto);
  if (route.path === ROTA_MAPA_MENSAL) return renderMapaMensal(contexto);
  if (route.path === ROTA_MAPAS_SALVOS) return renderMapasSalvos(contexto);
  if (route.path === ROTA_PRAZOS) return renderPrazos(contexto);
  if (route.path === ROTA_STATS_PROCEDIMENTOS) return renderEstatisticasProcedimentos(contexto);
  if (route.path === ROTA_USUARIOS) return renderListaUsuarios(contexto);
  if (route.path === ROTA_USUARIO_NOVO) {
    activePath = ROTA_USUARIOS;
    return renderFormularioUsuario(contexto, null);
  }

  return renderDashboard(contexto);
}















void loadSession().then(() => {
  if (session) {
    void renderRoute();
  } else {
    renderLogin();
  }
});
