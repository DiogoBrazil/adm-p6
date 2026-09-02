// Relatório Anual — o documento.
//
// POR QUE ELE VOLTOU A SER UM ARQUIVO PRÓPRIO
//
// Na rodada 29 o Relatório Anual virou um "modo" da tela de Estatísticas, com
// o ano fixado. Funcionava, e estava errado pelo motivo que a própria rodada
// existia para corrigir: duas entradas de menu abrindo a **mesma tela** só
// mudam de título. Quem olhava as duas via a mesma coisa.
//
// A diferença entre as duas não é o filtro — é o **gênero**. Estatísticas é
// uma tela de operar: filtra, alterna gráfico e tabela, compara, explora.
// O Relatório Anual é uma peça que se imprime, se assina e se arquiva: capa,
// seções numeradas em ordem fixa, só tabelas, nenhum controle no meio do texto.
// Um relatório em que o leitor precisa clicar para ver o número não é um
// relatório.
//
// O que as duas compartilham é o **dado**: `carregarDadosDoEscopo`,
// `tabelaContagem` e `tabelaSituacao` vêm de `estatisticas.ts`. Duas cargas
// separadas divergiriam no dia em que uma delas ganhasse um filtro — e foi
// exatamente assim que a Visão Geral passou a discordar do Painel.
//
// O escopo aqui é **o ano inteiro**, sem recorte por espécie. Um relatório
// anual com metade das espécies não é o relatório anual do 7º BPM; quem quer
// recortar tem a tela de Estatísticas ao lado.

import { call } from "../api";
import { barraDeExportacao, escapeHtml, formatarData, ligarExportacao, option } from "../dom";
import {
  carregarDadosDoEscopo,
  tabelaContagem,
  tabelaEnquadramento,
  tabelaSituacao,
  totaisDoEscopo,
} from "./estatisticas";
import type { ContextoTela } from "./catalogos";

/**
 * As seções do Anual correm no fluxo do documento, e não dentro de cartão.
 *
 * É a diferença que decide o bloco indivisível: aqui a tabela atravessa
 * páginas, e sem bloco a linha que cai na quebra **some do papel** — medido em
 * `tools/impressao/medicao-*`. Nos cartões da tela de Estatísticas a mesma
 * tabela não fragmenta, e o comentário de `tabelaContagem` diz por quê.
 */
const EM_DOCUMENTO = { fragmentar: true };

export const ROTA = "/estatisticas/anuais";

const brasaoUrl = new URL("../../src-tauri/icons/icon.png", import.meta.url).href;

let anoSelecionado = new Date().getFullYear();

/** Uma seção numerada do documento. O número não é decorativo: é referência. */
function secao(numero: number, titulo: string, corpo: string, nota = ""): string {
  return `
    <section class="relatorio-secao">
      <h2><span class="relatorio-secao__numero">${numero}</span>${escapeHtml(titulo)}</h2>
      ${nota ? `<p class="hint">${escapeHtml(nota)}</p>` : ""}
      ${corpo}
    </section>`;
}

export async function renderRelatorioAnual(ctx: ContextoTela): Promise<void> {
  const falhar = (mensagem: string) =>
    ctx.shell(`<section class="panel"><h1>Relatório Anual</h1>
      <p class="error">${escapeHtml(mensagem)}</p></section>`);

  const anosResposta = await call("reports_available_years");
  if (!anosResposta.ok) {
    falhar(anosResposta.error ?? "Não foi possível carregar os anos disponíveis.");
    return;
  }
  const anos = anosResposta.data ?? [];
  // O ano é obrigatório: se o escolhido não existe mais no acervo, cai no mais
  // recente em vez de virar "todos" em silêncio.
  if (anos.length && !anos.includes(anoSelecionado)) anoSelecionado = anos[0]!;
  const anosDisponiveis = anos.length ? anos : [anoSelecionado];

  const resultado = await carregarDadosDoEscopo({ ano: anoSelecionado, apuratorio_ids: [] });
  if ("erro" in resultado) {
    falhar(resultado.erro);
    return;
  }
  const d = resultado.dados;
  const totais = totaisDoEscopo(d.situacao);
  const hoje = formatarData(new Date().toISOString().slice(0, 10));

  const resumo = `
    <dl class="relatorio-resumo">
      <div><dt>Instaurados no ano</dt><dd>${totais.total}</dd></div>
      <div><dt>Ainda em andamento</dt><dd>${totais.emAndamento}</dd></div>
      <div><dt>Concluídos</dt><dd>${totais.concluidos}</dd></div>
      <div><dt>Espécies com registros</dt><dd>${totais.especies}</dd></div>
    </dl>`;

  ctx.shell(`
    <section class="panel relatorio-anual">
      <div class="page-head">
        <div>
          <h1>Relatório Anual — ${escapeHtml(anoSelecionado)}</h1>
          <p>Documento de encerramento do exercício. Para explorar os dados, use Estatísticas dos Apuratórios.</p>
        </div>
        <div class="page-head-right">
          <form id="filtro-ano" class="filtro-bar">
            <label>Ano
              <select name="ano">
                ${anosDisponiveis.map((a) => option(String(a), String(a), a === anoSelecionado)).join("")}
              </select>
            </label>
            <button type="submit">Emitir</button>
          </form>
          ${barraDeExportacao({ imprimir: true })}
        </div>
      </div>

      <header class="relatorio-capa">
        <img src="${brasaoUrl}" alt="" />
        <span class="relatorio-capa__eyebrow">Polícia Militar do Estado de Rondônia</span>
        <strong>Relatório Anual</strong>
        <span class="relatorio-capa__ano">${escapeHtml(anoSelecionado)}</span>
        <span class="relatorio-capa__orgao">7º Batalhão de Polícia Militar<br />Seção de Justiça e Disciplina</span>
        <span class="relatorio-capa__emissao">Emitido em ${escapeHtml(hoje)}</span>
      </header>

      ${secao(1, "Resumo do exercício", resumo)}
      ${secao(
        2,
        "Processos e procedimentos por espécie",
        tabelaSituacao(d.situacao, EM_DOCUMENTO),
        "Situação derivada da data de conclusão registrada.",
      )}
      ${secao(3, "Unidades de origem", tabelaContagem(d.unidades, "Unidade", undefined, EM_DOCUMENTO))}
      ${secao(4, "Natureza geral do fato", tabelaContagem(d.naturezas, "Natureza", undefined, EM_DOCUMENTO))}
      ${secao(5, "Categorias de indício", tabelaContagem(d.categorias, "Categoria", undefined, EM_DOCUMENTO))}
      ${secao(
        6,
        "Soluções sugeridas pelo encarregado",
        tabelaContagem(d.sugeridas, "Solução", undefined, EM_DOCUMENTO),
      )}
      ${secao(
        7,
        "Soluções decididas pela autoridade",
        tabelaContagem(d.decididas, "Solução", undefined, EM_DOCUMENTO),
      )}
      ${secao(
        8,
        "Responsabilidade vigente",
        tabelaContagem(d.responsaveis, "Responsável", undefined, EM_DOCUMENTO),
        "Apuratórios do ano atribuídos ao responsável vigente; não é o histórico de designações.",
      )}
      ${secao(9, "Transgressões do RDPM", tabelaEnquadramento(d.transgressoes, "Artigo / inciso", EM_DOCUMENTO))}
      ${secao(10, "Infrações do Estatuto", tabelaEnquadramento(d.estatuto, "Artigo / inciso", EM_DOCUMENTO))}
      ${secao(11, "Infrações penais", tabelaEnquadramento(d.penais, "Dispositivo / artigo", EM_DOCUMENTO))}

      <footer class="relatorio-fecho">
        <p>Seção de Justiça e Disciplina · 7º BPM · Exercício de ${escapeHtml(anoSelecionado)}</p>
      </footer>
    </section>
  `);

  document.querySelector<HTMLFormElement>("#filtro-ano")?.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget as HTMLFormElement);
    anoSelecionado = Number(formulario.get("ano")) || anoSelecionado;
    void renderRelatorioAnual(ctx);
  });

  // Sem CSV: o documento é a saída. Quem quer a planilha usa Estatísticas, que
  // exporta as mesmas quebras com o escopo que o operador escolher.
  ligarExportacao(undefined, undefined, { orientacao: "paisagem", perfil: "documento" });
}
