// A regra da coluna "Status prazo" da listagem de apuratórios.
//
// Mora fora de `processo.ts` por um motivo prático: aquele módulo importa
// `../api`, que só existe dentro do WebView do Tauri, e por isso o Vitest não
// o alcança. Enquanto a regra viveu lá dentro, a única amarra que ela tinha
// era um comentário num teste de Rust. É o mesmo caso de `graficos/dados.ts`:
// função pura sai do módulo que o teste não alcança.
//
// A PRECEDÊNCIA, E POR QUE ELA É ESTA
//
//   Concluído > Entregue > Vencido/Vence em/Sem prazo
//
// "Entregue" ganha do prazo vencido de propósito. O prazo é do encarregado;
// registrada a remessa, o apuratório saiu das mãos dele e segue para
// julgamento ou homologação — continuar mostrando "Vencido há 40 dias" cobra
// de quem já entregou. O vencimento não se perde: ele vai para o `title`.
//
// Quem quiser o mesmo recorte no backend olha `ProceedingSituation` e o `$9` de
// `proceedings/repository.rs`, que repetem esta ordem em SQL — e a tela de
// Prazos, que pelo mesmo motivo deixou de listar o entregue.

import { escapeHtml, formatarData } from "../dom";

export type StatusPrazo = {
  classe: "badge--info" | "badge--neutro" | "badge--ok" | "badge--warn" | "badge--urgente" | "badge--erro";
  texto: string;
  /** O que o `title` do badge mostra; nem sempre é o mesmo que o texto. */
  detalhe: string;
};

/** O que a regra precisa saber do apuratório — um subconjunto do item da lista. */
export type FatosDoPrazo = {
  concluido: boolean;
  entregue: boolean;
  data_remessa: string | null;
  prazo_vencimento: string | null;
  prazo_dias_restantes: number | null;
};

const plural = (dias: number) => (dias === 1 ? "dia" : "dias");

export function statusPrazo(p: FatosDoPrazo): StatusPrazo {
  if (p.concluido) return { classe: "badge--info", texto: "Concluído", detalhe: "Concluído" };

  if (p.entregue) {
    // As duas datas juntas: o prazo deixa de ser cobrado, mas quem precisa
    // saber que a entrega passou do vencimento continua conseguindo ver.
    const remessa = p.data_remessa ? `Entregue em ${formatarData(p.data_remessa)}` : "Entregue";
    const vencimento = p.prazo_vencimento
      ? ` · prazo vencia em ${formatarData(p.prazo_vencimento)}`
      : "";
    return { classe: "badge--warn", texto: "Entregue", detalhe: `${remessa}${vencimento}` };
  }

  const dias = p.prazo_dias_restantes;
  if (dias === null) {
    return {
      classe: "badge--neutro",
      texto: "Sem prazo",
      detalhe: "Sem prazo: o recebimento nunca foi informado",
    };
  }
  if (dias < 0) {
    const texto = `Vencido há ${Math.abs(dias)} ${plural(Math.abs(dias))}`;
    return { classe: "badge--erro", texto, detalhe: texto };
  }
  if (dias === 0) return { classe: "badge--urgente", texto: "Vence hoje", detalhe: "Vence hoje" };

  const texto = `Vence em ${dias} ${plural(dias)}`;
  // Cinco dias é o limiar de urgência, e é o mesmo desde que a coluna existe.
  return { classe: dias <= 5 ? "badge--urgente" : "badge--ok", texto, detalhe: texto };
}

export function badgeStatusPrazo(p: FatosDoPrazo): string {
  const status = statusPrazo(p);
  return `<span class="badge status-prazo ${status.classe}" title="${escapeHtml(status.detalhe)}"><span class="status-prazo__ponto" aria-hidden="true"></span>${escapeHtml(status.texto)}</span>`;
}
