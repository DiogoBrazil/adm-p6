// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, type StartupStatus } from "./api";
import { configurarBanco, iniciarBanco } from "./database-setup";

vi.mock("./api", () => ({ call: vi.fn() }));
const ipc = vi.mocked(call);
const status = (state: StartupStatus["state"], message = "Mensagem segura.") => ({
  ok: true, data: { state, message }, error: null,
});
let app: HTMLElement;
const ready = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  app = document.querySelector("#app")!;
});
afterEach(() => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  document.body.innerHTML = "";
});
const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();
const fill = (name: string, value: string) => { document.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value; };
const submit = () => document.querySelector("#db-form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

describe("configuração inicial do banco", () => {
  it("abre modal se não houver configuração e cancelar não libera login", async () => {
    ipc.mockResolvedValueOnce(status("missing", "Configure a conexão com o banco para começar."));
    await iniciarBanco(app, ready);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    // No primeiro uso não existe "configuração já salva" para sugerir: o fundo
    // repete o que o backend disse, e não um texto fixo da tela.
    expect(app.querySelector('[role="status"]')!.textContent).toBe("Configure a conexão com o banco para começar.");
    expect(ready).not.toHaveBeenCalled();
    click("[data-fechar-modal]");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(ready).not.toHaveBeenCalled();
    click("#db-configure");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("a abertura não anuncia o banco enquanto a configuração salva é usada", async () => {
    // Quem já configurou vê abertura → login. O painel "Conexão com o banco" e
    // os botões dele só existem para os estados que não são `ready`.
    let finish!: (value: ReturnType<typeof status>) => void;
    ipc.mockImplementationOnce((() => new Promise(resolve => { finish = resolve; })) as typeof call);
    const partida = iniciarBanco(app, ready);
    // `comCarregamento` cede um quadro antes de agir, para o véu pintar: sem
    // esperar por ele, a asserção correria antes de o IPC sequer sair.
    await vi.waitFor(() => expect(ipc).toHaveBeenCalledOnce());
    expect(app.textContent).not.toContain("Conexão com o banco");
    expect(document.querySelector("#db-retry")).toBeNull();
    expect(document.querySelector("#db-configure")).toBeNull();
    expect(ready).not.toHaveBeenCalled();
    finish(status("ready"));
    await partida;
    expect(ready).toHaveBeenCalledOnce();
  });

  it("configuração pronta abre login sem solicitar credenciais", async () => {
    ipc.mockResolvedValueOnce(status("ready"));
    await iniciarBanco(app, ready);
    expect(ready).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(ipc).toHaveBeenCalledExactlyOnceWith("database_initialize");
  });

  it.each(["connection_error", "vault_error", "migration_error"] as const)("permite repetir %s sem solicitar credenciais outra vez", async state => {
    ipc.mockResolvedValueOnce(status(state)).mockResolvedValueOnce(status("ready"));
    await iniciarBanco(app, ready);
    expect(ready).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click("#db-retry");
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(ipc.mock.calls.map(args => args[0])).toEqual(["database_initialize", "database_initialize"]);
  });

  it("envia campos especiais intactos e impede salvar/cancelar durante a operação", async () => {
    let finish!: (value: ReturnType<typeof status>) => void;
    let captured: unknown;
    ipc.mockImplementationOnce(((_command: unknown, args: unknown) => {
      captured = JSON.parse(JSON.stringify(args));
      return new Promise(resolve => { finish = resolve; });
    }) as typeof call);
    configurarBanco(app, ready);
    click('[name="mode"][value="fields"]');
    fill("host", "localhost"); fill("database", "test"); fill("username", "a@b"); fill("password", "p@:/?#% ç");
    submit(); submit();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(ipc).toHaveBeenCalledOnce();
    expect(captured).toEqual({ input: { mode: "fields", host: "localhost", port: 5432, database: "test", username: "a@b", password: "p@:/?#% ç", sslmode: "verify-full" } });
    finish(status("ready"));
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(document.querySelector('[name="password"]')).toBeNull();
  });

  it("cancelar devolve ao login quando a conexão já funciona", async () => {
    // Contraponto do primeiro teste: aqui a tela do banco só apareceu porque o
    // usuário pediu para trocar a conexão, e desistir tem de devolver o login.
    const aoCancelar = vi.fn();
    configurarBanco(app, ready, { aoCancelar });
    click("[data-fechar-modal]");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(aoCancelar).toHaveBeenCalledOnce();
    expect(ready).not.toHaveBeenCalled();
  });

  it("não libera login quando o cofre recusa salvar; permite nova tentativa", async () => {
    ipc.mockResolvedValueOnce(status("vault_error", "Desbloqueie o cofre.")).mockResolvedValueOnce(status("ready"));
    configurarBanco(app, ready);
    fill("url", "postgres://u:pw@host/db");
    submit();
    await vi.waitFor(() => expect(document.querySelector("#db-feedback")!.textContent).toBe("Desbloqueie o cofre."));
    expect(ready).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('[name="url"]')!.value).toBe("postgres://u:pw@host/db");
    submit();
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  });

  it("falha de migration após salvar fecha formulário e permite repetir sem redigitar", async () => {
    ipc.mockResolvedValueOnce(status("migration_error")).mockResolvedValueOnce(status("ready"));
    configurarBanco(app, ready);
    fill("url", "postgres://u:pw@host/db");
    submit();
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(ready).not.toHaveBeenCalled();
    click("#db-retry");
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  });
});
