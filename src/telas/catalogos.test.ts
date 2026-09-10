import { describe, expect, it } from "vitest";

import {
  LARGURA_PX,
  colunasDaListagem,
  colunasFlexiveis,
  larguraFixaPx,
  linhasQueOTermoAlcanca,
  pisoDaTabela,
} from "./catalogos";
import type { Catalogo, Coluna } from "../api";

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
  rotulo_curto: null,
  na_listagem: true,
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

// ── Larguras da listagem ─────────────────────────────────────────────────────

const cat = (colunas: Coluna[]): Catalogo => ({
  chave: "teste",
  tabela: "teste",
  rotulo: "Teste",
  so_edicao: false,
  colunas,
  ordenacao: "nome",
});

const oculta = (c: Coluna): Coluna => ({ ...c, na_listagem: false });
const centrada = (c: Coluna): Coluna => ({ ...c, centralizar: true });

/** O formato real de "Apuratórios", que é o pior caso da tela. */
const APURATORIOS: Coluna[] = [
  centrada(coluna("sigla", "texto")),
  coluna("nome", "texto"),
  coluna("tipo_apuratorio_id", "referencia", "tipos_apuratorio"),
  oculta(coluna("ordem", "inteiro")),
  coluna("prazo_base_dias", "inteiro"),
  coluna("max_envolvidos", "inteiro_opcional"),
  ...[
    "exige_natureza_fato", "permite_julgamento", "permite_punicao",
    "permite_remessa_comissao", "permite_acusacao", "permite_acusacao_penal",
    "permite_indicios", "permite_solucao_sugerida",
  ].map((n) => coluna(n, "booleano")),
];

describe("larguras da listagem de catálogos", () => {
  it("tira da tabela a coluna marcada, sem tirá-la do formulário", () => {
    const nomes = colunasDaListagem(cat(APURATORIOS)).map((c) => c.nome);
    expect(nomes).not.toContain("ordem");
    expect(nomes).toHaveLength(APURATORIOS.length - 1);
    // O formulário continua com ela: é campo obrigatório para criar a espécie.
    expect(cat(APURATORIOS).colunas.map((c) => c.nome)).toContain("ordem");
  });

  it("dá largura fixa ao que tem tamanho conhecido, e nenhuma à identificação", () => {
    expect(larguraFixaPx(coluna("x", "booleano"))).toBe(LARGURA_PX.booleano);
    expect(larguraFixaPx(coluna("x", "inteiro"))).toBe(LARGURA_PX.inteiro);
    expect(larguraFixaPx(coluna("x", "referencia", "y"))).toBe(LARGURA_PX.referencia);
    // Centralizado é o sinal de "texto curto" que o registro já declarava.
    expect(larguraFixaPx(centrada(coluna("sigla", "texto")))).toBe(LARGURA_PX.textoCompacto);
    expect(larguraFixaPx(coluna("nome", "texto"))).toBeNull();
  });

  // O corpo de um aviso tem centenas de caracteres. Sem largura fixa ele seria
  // a coluna flexível e comeria a tabela inteira, deixando o "Nome do aviso" —
  // que é quem identifica a linha — espremido.
  it("texto longo tem teto e não disputa a sobra com a identificação", () => {
    expect(larguraFixaPx(coluna("corpo", "texto_longo"))).toBe(LARGURA_PX.textoLongo);

    const colunas = [
      coluna("nome", "texto"),
      coluna("assunto", "texto"),
      coluna("corpo", "texto_longo"),
    ];
    const flex = colunasFlexiveis(colunas);
    expect(flex.has("corpo")).toBe(false);
    expect(flex.has("nome")).toBe(true);
  });

  it("a coluna de identificação é a que absorve a sobra", () => {
    const flex = colunasFlexiveis(colunasDaListagem(cat(APURATORIOS)));
    expect([...flex]).toEqual(["nome"]);
  });

  // Sem nenhuma coluna livre o navegador reparte o excedente entre todas, e a
  // de Ações cresce sem motivo numa tela larga.
  it("sempre sobra alguém para absorver, mesmo com tudo centralizado", () => {
    const soCentralizadas = [centrada(coluna("nome", "texto")), coluna("ativo", "booleano")];
    expect([...colunasFlexiveis(soCentralizadas)]).toEqual(["nome"]);
  });

  it("o piso de Apuratórios cabe num monitor comum e rola no notebook", () => {
    const colunas = colunasDaListagem(cat(APURATORIOS));
    const piso = pisoDaTabela(colunas, colunasFlexiveis(colunas), true);
    // 96 sigla + 220 nome + 150 tipo + 84 + 84 + 8×78 + 92 situação + 128 ações
    expect(piso).toBe(1478);
    expect(piso).toBeLessThan(1920);
  });

  it("sem permissão de escrita o piso não reserva a coluna de ações", () => {
    const colunas = colunasDaListagem(cat(APURATORIOS));
    const flex = colunasFlexiveis(colunas);
    expect(pisoDaTabela(colunas, flex, true) - pisoDaTabela(colunas, flex, false)).toBe(
      LARGURA_PX.acoes,
    );
  });

  // Catálogo de uma coluna não pode herdar o piso do pior caso.
  it("catálogo simples não ganha rolagem", () => {
    const simples = [centrada(coluna("nome", "texto"))];
    expect(pisoDaTabela(simples, colunasFlexiveis(simples), true)).toBe(440);
  });
});
