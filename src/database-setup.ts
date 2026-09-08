import { call, type ConnectionInput, type StartupStatus } from "./api";
import { comCarregamento, escapeHtml, montarModal } from "./dom";
import { brasaoUrl } from "./brasao";

type Ready = () => void | Promise<void>;

/** O que a configuração faz ao ser cancelada, e o texto que fica no fundo. */
type OpcoesConfiguracao = {
  /** Chamado ao cancelar. Sem ele, cancelar mantém o acesso bloqueado. */
  aoCancelar?: () => void;
  /** Mensagem do painel por baixo do modal. */
  mensagemDeFundo?: string;
};

/**
 * A abertura, enquanto ainda não se sabe se há configuração salva.
 *
 * O cabeçalho é **o mesmo** de `main.ts::renderLogin`, de propósito: quem já
 * configurou o banco — a imensa maioria das aberturas, porque a configuração
 * fica no cofre desde o primeiro uso — vê o formulário de login aparecer sob o
 * topo que já estava na tela, e não uma tela de banco trocada por outra. Falar
 * em conexão aqui anunciaria um pedido de credenciais que não vai acontecer.
 */
function abertura(app: HTMLElement): void {
  app.innerHTML = `<main class="login-screen"><section class="login-panel" aria-label="Iniciando">
    <div class="login-brand"><img src="${brasaoUrl}" alt="" /><div><span>Sistema administrativo</span><h1>GESTÃO P6/7ºBPM</h1><p>Seção de Justiça e Disciplina</p></div></div>
    <p role="status">Iniciando…</p>
  </section></main>`;
}

/** O painel do banco. Só aparece quando a conexão **não** está pronta. */
function tela(app: HTMLElement, message: string, ready: Ready) {
  app.innerHTML = `<main class="login-screen"><section class="login-panel" aria-label="Conexão com o banco">
    <div class="login-brand"><img src="${brasaoUrl}" alt="" /><div><h1>GESTÃO P6/7ºBPM</h1><p>Conexão com o banco</p></div></div>
    <p role="status">${escapeHtml(message)}</p>
    <button id="db-retry" type="button">Tentar novamente</button><button id="db-configure" type="button" class="secondary">Configurar conexão</button>
  </section></main>`;
  app.querySelector("#db-retry")?.addEventListener("click", () => void iniciarBanco(app, ready));
  app.querySelector("#db-configure")?.addEventListener("click", () => configurarBanco(app, ready));
}

export async function iniciarBanco(app: HTMLElement, ready: Ready): Promise<void> {
  abertura(app);
  // O véu cobre a partida inteira, e não só o IPC: o `ready()` ainda vai buscar
  // a sessão e desenhar a primeira rota. Ele mora fora de `#app` (`index.html`)
  // e por isso sobrevive aos `innerHTML` daqui; `comCarregamento` conta
  // profundidade, então o véu que `renderRoute` abre lá dentro não derruba este.
  await comCarregamento("Iniciando…", async (passo) => {
    const response = await call("database_initialize");
    if (!response.ok || !response.data) {
      tela(app, response.error ?? "Não foi possível verificar a conexão. Tente novamente.", ready);
      return;
    }
    await passo("Preparando o sistema…");
    await resultado(app, response.data, ready);
  });
}

async function resultado(app: HTMLElement, status: StartupStatus, ready: Ready) {
  if (status.state === "ready") { await ready(); return; }
  tela(app, status.message, ready);
  // Só falta de configuração pede credenciais. Rede fora, cofre bloqueado e
  // migration que falhou já têm o que precisam no painel: tentar de novo. E a
  // mensagem do fundo é a do backend — no primeiro uso não há "configuração já
  // salva" para sugerir.
  if (status.state === "missing" || status.state === "invalid_config") {
    configurarBanco(app, ready, { mensagemDeFundo: status.message });
  }
}

export function configurarBanco(app: HTMLElement, ready: Ready, opcoes: OpcoesConfiguracao = {}): void {
  // Retira o formulário de login enquanto configura. Cancelar só o devolve
  // quando quem abriu tinha um login para voltar (`aoCancelar`); vindo do
  // primeiro uso não há conexão nenhuma, e cancelar nunca libera o login.
  tela(app, opcoes.mensagemDeFundo ?? "Configure a conexão ou tente usar a configuração já salva para continuar.", ready);
  let busy = false;
  const cancelar = () => {
    if (busy) return;
    modal?.fechar();
    opcoes.aoCancelar?.();
  };
  const modal = montarModal(`
    <header><h2>Configurar conexão</h2><p>Informe os dados fornecidos pelo responsável pelo banco. Eles serão salvos no cofre seguro da sua conta neste computador.</p></header>
    <form id="db-form" autocomplete="off">
      <fieldset class="db-mode"><legend>Como deseja informar a conexão?</legend>
        <label><input type="radio" name="mode" value="url" checked /> URL de conexão</label>
        <label><input type="radio" name="mode" value="fields" /> Campos separados</label>
      </fieldset>
      <fieldset id="db-url"><label>URL PostgreSQL<input name="url" type="password" autocomplete="new-password" spellcheck="false" placeholder="postgresql://usuario:senha@servidor:5432/banco" required /></label>
        <p>Sem modo SSL na URL, o certificado e o nome do servidor serão verificados.</p></fieldset>
      <fieldset id="db-fields" class="db-fields" hidden disabled>
        <label>Servidor<input name="host" autocomplete="off" spellcheck="false" required /></label>
        <label>Porta<input name="port" type="number" min="1" max="65535" value="5432" required /></label>
        <label>Banco<input name="database" autocomplete="off" required /></label>
        <label>Usuário do banco<input name="username" autocomplete="off" required /></label>
        <label>Senha do banco<input name="password" type="password" autocomplete="new-password" required /></label>
        <label>SSL<select name="sslmode">
          <option value="verify-full">Verificar certificado e servidor (recomendado)</option>
          <option value="verify-ca">Verificar certificado</option>
          <option value="require">Exigir criptografia</option>
          <option value="prefer">Preferir criptografia</option>
          <option value="allow">Permitir criptografia</option>
          <option value="disable">Desativado</option>
        </select></label>
      </fieldset>
      <p id="db-feedback" role="status" aria-live="polite"></p>
      <div class="db-actions"><button type="button" class="secondary" data-fechar-modal>Cancelar</button><button type="submit">Testar e salvar</button></div>
    </form>`, "Configurar conexão", cancelar);
  if (!modal) return;
  const form = modal.overlay.querySelector<HTMLFormElement>("#db-form")!;
  const feedback = modal.overlay.querySelector<HTMLElement>("#db-feedback")!;
  const fields = form.querySelector<HTMLFieldSetElement>("#db-fields")!;
  const url = form.querySelector<HTMLFieldSetElement>("#db-url")!;
  form.querySelectorAll<HTMLInputElement>('[name="mode"]').forEach(radio => radio.addEventListener("change", () => {
    const separate = radio.checked && radio.value === "fields";
    fields.hidden = fields.disabled = !separate;
    url.hidden = url.disabled = separate;
  }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "");
    const input: ConnectionInput = value("mode") === "url"
      ? { mode: "url", url: value("url") }
      : { mode: "fields", host: value("host"), port: Number(value("port")), database: value("database"), username: value("username"), password: value("password"), sslmode: value("sslmode") };
    busy = true;
    const controls = [...form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input, button, select")];
    controls.forEach(control => { control.disabled = true; });
    feedback.textContent = "Testando a conexão, salvando no cofre e preparando o banco…";
    const response = await call("database_save", { input });
    // Não conservar cópias das credenciais após o IPC.
    if (input.mode === "url") input.url = ""; else input.password = "";
    busy = false;
    controls.forEach(control => { control.disabled = false; });
    if (!response.ok || !response.data) { feedback.textContent = response.error ?? "Não foi possível salvar. Tente novamente."; return; }
    if (response.data.state === "ready" || response.data.state === "migration_error") {
      form.reset();
      modal.fechar();
      await resultado(app, response.data, ready);
    } else feedback.textContent = response.data.message;
  });
}
