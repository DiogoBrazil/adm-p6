# Rotas

O projeto usa roteamento manual por `location.hash`, declarado em `src/main.ts`. Todas as telas usam o mesmo AppShell.

## Mapa funcional

- `/dashboard` → `src/telas/dashboard.ts`
- `/procedimentos/lista` → `src/telas/processo.ts`
- `/prazos` → `src/telas/prazos.ts`
- `/usuarios/lista` e `/usuarios/novo` → `src/telas/usuarios.ts`
- `/configuracao/apuratorios` → `src/telas/apuratorio.ts`
- `/auditoria` → `src/telas/auditoria.ts`
- `/estatisticas/encarregados` → `src/telas/encarregados.ts`
- `/estatisticas/processos` e `/stats/procedimentos` → `src/telas/estatisticas.ts`
- `/mapas/mensal` e `/mapas/anteriores` → `src/telas/mapas.ts`
- `/estatisticas/anuais` → `src/telas/anual.ts`
- Catálogos dinâmicos → `src/telas/catalogos.ts`

## Configuração e roteamento reais — `src/main.ts`

```ts
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
  { path: ROTA_STATS_PROCEDIMENTOS, label: "Estatísticas dos Apuratórios", group: "Relatórios" }
];

/** Fallback quando `activePath` não casa com nenhuma rota. */
const DASHBOARD: Route = { path: ROTA_DASHBOARD, label: "Painel", group: "Geral" };

let session: SessionUser | null = null;
let activePath = "/dashboard";
const app = document.querySelector<HTMLDivElement>("#app")!;
const CHAVE_SIDEBAR_RECOLHIDA = "adm-p6:sidebar-recolhida";
const CHAVE_GRUPOS_ABERTOS = "adm-p6:grupos-abertos";
let sidebarRecolhida = localStorage.getItem(CHAVE_SIDEBAR_RECOLHIDA) === "true";

function carregarGruposAbertos(): Set<string> {
  try {
    const salvos = JSON.parse(localStorage.getItem(CHAVE_GRUPOS_ABERTOS) ?? "null") as unknown;
    if (Array.isArray(salvos) && salvos.every((grupo) => typeof grupo === "string")) {
      return new Set(salvos);
    }
  } catch {
    // Estado visual corrompido não pode impedir a aplicação de abrir.
  }
  return new Set(["Geral", "Procedimentos"]);
}

const gruposAbertos = carregarGruposAbertos();

function salvarGruposAbertos(): void {
  localStorage.setItem(CHAVE_GRUPOS_ABERTOS, JSON.stringify([...gruposAbertos]));
}

function definirSidebarRecolhida(recolhida: boolean): void {
  sidebarRecolhida = recolhida;
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

```

