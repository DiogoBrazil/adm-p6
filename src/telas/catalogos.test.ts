import { describe, expect, it } from "vitest";

import { linhasQueOTermoAlcanca } from "./catalogos";
import type { Coluna } from "../api";

/** Uma coluna do registro, com os campos que a tela não usa em branco. */
const coluna = (nome: string, tipo: Coluna["tipo"], alvo: string | null = null): Coluna => ({
  nome,
  rotulo: nome,
  tipo,
  alvo,
  efeito: null,
  marcador: null,
  visivel_se: null,
  centralizar: false,
});

// O recorte real de "Transgressões do RDPM": o artigo é REFERÊNCIA, e o que a
// linha guarda é o UUID de `artigos_rdpm` — não o texto "Art. 15".
const COLUNAS = [
  coluna("artigo_rdpm_id", "referencia", "artigos_rdpm"),
  coluna("inciso", "texto"),
  coluna("texto", "texto"),
];

const ART_15 = "c7000000-0000-4000-8000-000000000001";
const ART_16 = "c7000000-0000-4000-8000-000000000002";

const REFERENCIAS = {
  artigos_rdpm: [
    { value: ART_15, label: "Art. 15" },
    { value: ART_16, label: "Art. 16" },
  ],
};

const LINHAS = [
  { id: "1", ativo: true, artigo_rdpm_id: ART_15, inciso: "IV", texto: "permutar serviço" },
  { id: "2", ativo: true, artigo_rdpm_id: ART_16, inciso: "II", texto: "faltar à verdade" },
];

const filtrar = (termo: string) =>
  linhasQueOTermoAlcanca(COLUNAS, LINHAS, REFERENCIAS, termo).map((l) => l.id);

describe("filtro da tela de catálogos", () => {
  // O defeito que este teste existe para travar: comparar com `l[c.nome]`
  // comparava com o UUID, e o número do artigo que a tela mostra não era
  // alcançável por nenhum termo.
  it("alcança o artigo pelo número, embora a coluna guarde um UUID", () => {
    expect(filtrar("15")).toEqual(["1"]);
    expect(filtrar("16")).toEqual(["2"]);
  });

  it("alcança o artigo pelo rótulo inteiro, como ele aparece na tabela", () => {
    expect(filtrar("Art. 15")).toEqual(["1"]);
  });

  it("continua alcançando as colunas de texto, e sem diferenciar maiúsculas", () => {
    expect(filtrar("PERMUTAR")).toEqual(["1"]);
    expect(filtrar("iv")).toEqual(["1"]);
  });

  it("termo vazio devolve tudo, sem copiar a lista à toa", () => {
    expect(linhasQueOTermoAlcanca(COLUNAS, LINHAS, REFERENCIAS, "")).toBe(LINHAS);
  });

  // O travessão é decoração da célula vazia. Se entrasse no que se compara,
  // digitá-lo traria de volta toda linha com campo em branco.
  it("não casa com o travessão que a tela desenha no lugar do vazio", () => {
    const comVazio = [{ id: "3", ativo: true, artigo_rdpm_id: ART_15, inciso: "", texto: "" }];
    expect(linhasQueOTermoAlcanca(COLUNAS, comVazio, REFERENCIAS, "—")).toEqual([]);
  });

  // Sem o catálogo alvo carregado não há rótulo a resolver: o valor bruto é o
  // que sobra, e é melhor que devolver vazio e sumir com a linha.
  it("sem referência carregada, cai no valor bruto em vez de sumir", () => {
    expect(linhasQueOTermoAlcanca(COLUNAS, LINHAS, {}, ART_15).map((l) => l.id)).toEqual(["1"]);
  });
});
