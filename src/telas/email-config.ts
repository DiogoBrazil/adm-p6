// Servidor de envio dos avisos por e-mail.
//
// POR QUE ESTA CONFIGURAÇÃO MORA NO BANCO, E NÃO NO COFRE DO SISTEMA
//
// A conexão do banco vive no cofre do sistema operacional de cada máquina, e o
// instalador não embute credencial nenhuma (README §8). Repetir esse caminho
// aqui obrigaria digitar a senha do Gmail em CADA PC da seção, e quem
// esquecesse descobriria só na hora de disparar. A configuração de e-mail é da
// SEÇÃO, não da máquina: uma linha no banco serve todas.
//
// A senha ENTRA e não volta — `email_config_get` não a devolve, só informa se
// existe. É a mesma regra da conexão do banco, e pela mesma razão: o que não
// trafega não vaza.

import { call, type ConfiguracaoEmailVisivel } from "../api";
import { comCarregamento, escapeHtml, notificar } from "../dom";
import type { ContextoTela } from "./catalogos";

export const ROTA = "/configuracao/email";

export async function renderConfiguracaoEmail(ctx: ContextoTela): Promise<void> {
  const resposta = await call("email_config_get", {});
  if (!resposta.ok) {
    ctx.shell(`<section class="panel"><p class="error">${escapeHtml(resposta.error ?? "")}</p></section>`);
    return;
  }
  desenhar(ctx, resposta.data ?? null);
}

function desenhar(ctx: ContextoTela, config: ConfiguracaoEmailVisivel | null): void {
  const podeEscrever = ctx.podeEscrever();
  const temSenha = config?.tem_senha === true;

  ctx.shell(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>Configuração de e-mail</h1>
          <p>Servidor usado para avisar os encarregados. Vale para todos os computadores da seção.</p>
        </div>
      </div>

      <form id="form-email" class="crud-form">
        <label>Servidor SMTP
          <input name="host" type="text" required value="${escapeHtml(config?.host ?? "smtp.gmail.com")}" />
        </label>
        <label>Porta
          <input name="porta" type="number" required min="1" max="65535"
                 value="${escapeHtml(String(config?.porta ?? 587))}" />
          <span class="hint">587 usa STARTTLS e é a porta de submissão padrão do Gmail.
            465 também funciona, com TLS desde a conexão.</span>
        </label>
        <label>Usuário
          <input name="usuario" type="text" required autocomplete="off"
                 value="${escapeHtml(config?.usuario ?? "")}" />
        </label>
        <label>Senha
          <input name="senha" type="password" autocomplete="new-password" ${temSenha ? "" : "required"} />
          <span class="hint">${
            temSenha
              ? "Em branco mantém a senha atual."
              : "No Gmail é a <strong>senha de aplicativo</strong> de 16 letras, gerada na conta Google. A senha comum é recusada."
          }</span>
        </label>
        <label>Remetente
          <input name="remetente" type="text" required value="${escapeHtml(config?.remetente ?? "")}" />
          <span class="hint">Como aparece para quem recebe. Ex.: Seção de Justiça e Disciplina &lt;7bpmp6@gmail.com&gt;</span>
        </label>
        <label class="checkbox-inline">
          <input name="ativo" type="checkbox" ${config?.ativo !== false ? "checked" : ""} />
          Envio habilitado
        </label>
        ${podeEscrever ? `<div class="form-actions"><button type="submit">Salvar</button></div>`
                       : `<p class="readonly">Perfil somente leitura.</p>`}
      </form>
    </section>
  `);

  if (!podeEscrever) return;
  const form = document.querySelector<HTMLFormElement>("#form-email");
  form?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const f = new FormData(form);
    await comCarregamento(
      "Salvando a configuração…",
      async () => {
        const r = await call("email_config_save", {
          request: {
            host: String(f.get("host") ?? "").trim(),
            porta: Number(f.get("porta") ?? 587),
            usuario: String(f.get("usuario") ?? "").trim(),
            // Vazia significa "mantenha a que está lá" — é o que permite
            // corrigir a porta sem redigitar 16 caracteres.
            senha: String(f.get("senha") ?? ""),
            remetente: String(f.get("remetente") ?? "").trim(),
            ativo: f.get("ativo") === "on",
          },
        });
        if (!r.ok) {
          notificar(r.error ?? "", "erro");
          return;
        }
        notificar("Configuração de e-mail salva.", "sucesso");
        await renderConfiguracaoEmail(ctx);
      },
      form.querySelector<HTMLButtonElement>('button[type="submit"]'),
    );
  });
}
