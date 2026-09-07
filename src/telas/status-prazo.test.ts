import { describe, expect, it } from "vitest";

import { badgeStatusPrazo, statusPrazo, type FatosDoPrazo } from "./status-prazo";

/** O apuratório mais simples: em andamento, com prazo folgado. */
const apuratorio = (fatos: Partial<FatosDoPrazo> = {}): FatosDoPrazo => ({
  concluido: false,
  entregue: false,
  data_remessa: null,
  prazo_vencimento: "2026-12-31",
  prazo_dias_restantes: 30,
  ...fatos,
});

describe("status do prazo na listagem de apuratórios", () => {
  it("conclusão vence tudo, inclusive a remessa", () => {
    const status = statusPrazo(
      apuratorio({
        concluido: true,
        entregue: true,
        data_remessa: "2026-03-10",
        prazo_dias_restantes: -40,
      }),
    );
    expect(status.texto).toBe("Concluído");
    expect(status.classe).toBe("badge--info");
  });

  /**
   * A decisão desta rodada, e o único caso em que ela aparece.
   *
   * O prazo é do encarregado; registrada a remessa, ele entregou. Manter
   * "Vencido há 40 dias" cobraria de quem já cumpriu — e é por isso que o
   * mesmo recorte foi repetido no filtro de Situação e na tela de Prazos.
   */
  it("remessa registrada vence o prazo vencido, e o vencimento vai para o title", () => {
    const status = statusPrazo(
      apuratorio({
        entregue: true,
        data_remessa: "2026-03-10",
        prazo_vencimento: "2026-01-29",
        prazo_dias_restantes: -40,
      }),
    );
    expect(status.texto).toBe("Entregue");
    expect(status.classe).toBe("badge--warn");
    expect(status.detalhe).toBe("Entregue em 10/03/2026 · prazo vencia em 29/01/2026");
  });

  it("entregue sem prazo nenhum ainda é entregue", () => {
    const status = statusPrazo(
      apuratorio({
        entregue: true,
        data_remessa: "2026-03-10",
        prazo_vencimento: null,
        prazo_dias_restantes: null,
      }),
    );
    expect(status.texto).toBe("Entregue");
    expect(status.detalhe).toBe("Entregue em 10/03/2026");
  });

  it("sem prazo é estado próprio, e não 'no prazo'", () => {
    const status = statusPrazo(
      apuratorio({ prazo_vencimento: null, prazo_dias_restantes: null }),
    );
    expect(status.texto).toBe("Sem prazo");
    expect(status.classe).toBe("badge--neutro");
  });

  it("conta os dias no plural certo, nos dois sentidos", () => {
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: -1 })).texto).toBe("Vencido há 1 dia");
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: -2 })).texto).toBe("Vencido há 2 dias");
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: 1 })).texto).toBe("Vence em 1 dia");
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: 2 })).texto).toBe("Vence em 2 dias");
  });

  /**
   * O amarelo passou a ser do "Entregue", então a urgência tem cor própria —
   * dois estados diferentes na mesma coluna não podem sair iguais.
   */
  it("urgência é laranja, e o limiar continua em cinco dias", () => {
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: 0 })).classe).toBe("badge--urgente");
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: 5 })).classe).toBe("badge--urgente");
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: 6 })).classe).toBe("badge--ok");
    expect(statusPrazo(apuratorio({ prazo_dias_restantes: 0 })).texto).toBe("Vence hoje");
  });

  it("o badge escapa o title e leva o ponto decorativo", () => {
    const html = badgeStatusPrazo(apuratorio({ prazo_dias_restantes: -3 }));
    expect(html).toContain('class="badge status-prazo badge--erro"');
    expect(html).toContain('title="Vencido há 3 dias"');
    expect(html).toContain('<span class="status-prazo__ponto" aria-hidden="true"></span>');
  });
});
