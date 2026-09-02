#!/usr/bin/env python3
"""Confere os PDFs impressos por `imprimir.py`.

O QUE ISTO PROVA, E COMO

Cada linha das fixturas carrega um par de marcadores: `L####` na primeira
célula e `F####` na última. Daí saem as três asserções que "olhar o PDF" nunca
dá com segurança:

  * **nada se perdeu** — os N marcadores `L` e os N `F` estão no texto extraído.
    Linha comida por quebra de página, célula cortada por `overflow: hidden` e
    fragmento perdido aparecem aqui como marcador ausente;
  * **nenhuma linha foi partida** — `L0042` e `F0042` na mesma folha. Em folhas
    diferentes, o `<tr>` foi fatiado;
  * **o cabeçalho está no lugar** — quantas vezes o rótulo da primeira coluna
    aparece por folha. Mais de uma vez é fragmento menor que a página, com
    cabeçalho no meio do papel.

E mede o que calibra os fragmentos: linhas por folha, por conjunto de colunas e
por orientação.

    python3 tools/impressao/conferir.py --todas
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]

# 595×842 pt é o A4 em retrato; 842×595, em paisagem. É a folha que o
# `GtkPageSetup` entrega — o `@page size` do CSS o WebKitGTK ignora.
FOLHAS = {"retrato": (595, 842), "paisagem": (842, 595)}


def paginas_e_folha(pdf: pathlib.Path) -> tuple[int, tuple[int, int]]:
    saida = subprocess.run(
        ["pdfinfo", str(pdf)], capture_output=True, text=True, check=True
    ).stdout
    paginas = int(re.search(r"^Pages:\s+(\d+)", saida, re.M).group(1))
    medida = re.search(r"^Page size:\s+([\d.]+) x ([\d.]+)", saida, re.M)
    return paginas, (round(float(medida.group(1))), round(float(medida.group(2))))


def texto_da_pagina(pdf: pathlib.Path, pagina: int) -> str:
    return subprocess.run(
        ["pdftotext", "-layout", "-f", str(pagina), "-l", str(pagina), str(pdf), "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def conferir(pdf: pathlib.Path, fixtura: dict, imagens: bool) -> list[str]:
    """Devolve a lista de falhas. Vazia significa aprovado."""
    falhas: list[str] = []
    paginas, folha = paginas_e_folha(pdf)

    esperada = FOLHAS[fixtura["orientacao"]]
    if folha != esperada:
        falhas.append(f"folha {folha[0]}×{folha[1]} pt, esperada {esperada[0]}×{esperada[1]}")

    inicio: dict[str, int] = {}
    fim: dict[str, int] = {}
    por_pagina: list[int] = []
    cabecalhos: list[int] = []
    rotulo = fixtura.get("rotuloCabecalho")

    for numero in range(1, paginas + 1):
        bruto = texto_da_pagina(pdf, numero)
        # A quebra de palavra do `overflow-wrap: anywhere` pode partir o
        # marcador em duas linhas; sem espaço nenhum, ele volta a ser um só.
        colado = re.sub(r"\s+", "", bruto)
        achados = re.findall(r"L\d{4}", colado)
        for chave in achados:
            inicio.setdefault(chave, numero)
        for chave in re.findall(r"F\d{4}", colado):
            fim.setdefault(chave, numero)
        por_pagina.append(len(set(achados)))
        if rotulo:
            cabecalhos.append(len(re.findall(re.escape(re.sub(r"\s+", "", rotulo)), colado)))

    esperados = fixtura["marcadores"]
    if esperados:
        if len(inicio) != esperados:
            falhas.append(f"{len(inicio)} de {esperados} linhas no texto extraído")
        if len(fim) != esperados:
            falhas.append(f"{len(fim)} de {esperados} fins de linha no texto extraído")
        partidas = [c for c in inicio if fim.get("F" + c[1:]) not in (None, inicio[c])]
        if partidas:
            amostra = ", ".join(sorted(partidas)[:5])
            falhas.append(f"{len(partidas)} linha(s) partida(s) entre páginas: {amostra}")

    if imagens:
        pasta = pdf.parent / "imagens" / pdf.stem
        pasta.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["pdftoppm", "-png", "-r", "80", str(pdf), str(pasta / "p")], check=True
        )

    cheias = [n for n in por_pagina[:-1] if n] if len(por_pagina) > 1 else por_pagina
    medida = {
        "paginas": paginas,
        "linhas_por_pagina": max(cheias) if cheias else 0,
        "cabecalhos_por_pagina": max(cabecalhos) if cabecalhos else 0,
    }
    return falhas, medida


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--saida", default=str(RAIZ / "tools/impressao/saida"))
    parser.add_argument("--todas", action="store_true")
    parser.add_argument("--fixtura", action="append", default=[])
    parser.add_argument("--imagens", action="store_true", help="rasteriza cada página em PNG")
    args = parser.parse_args()

    pasta = pathlib.Path(args.saida)
    manifesto = json.loads((pasta / "manifesto.json").read_text("utf8"))
    escolhidas = [f for f in manifesto["fixturas"] if args.todas or f["nome"] in args.fixtura]
    if not escolhidas:
        print("nada a conferir: use --todas ou --fixtura=nome", file=sys.stderr)
        return 2

    print(f"{'fixtura':24} {'folhas':>6} {'linhas/folha':>12} {'cabeç./folha':>12}  situação")
    problemas = 0
    for fixtura in escolhidas:
        pdf = pasta / f"{fixtura['nome']}.pdf"
        if not pdf.exists():
            print(f"{fixtura['nome']:24} {'—':>6} {'—':>12} {'—':>12}  PDF ausente")
            problemas += 1
            continue
        falhas, medida = conferir(pdf, fixtura, args.imagens)
        # A fixtura de medição reporta o que achou e não reprova nada: quem
        # assere é a `calibrado-*` do mesmo conjunto.
        if fixtura.get("medicao"):
            estado = "medição — " + ("; ".join(falhas) if falhas else "linha nenhuma partida")
        else:
            estado = "ok" if not falhas else "; ".join(falhas)
            problemas += bool(falhas)
        print(
            f"{fixtura['nome']:24} {medida['paginas']:>6} "
            f"{medida['linhas_por_pagina']:>12} {medida['cabecalhos_por_pagina']:>12}  {estado}"
        )

    print(f"\n{len(escolhidas) - problemas}/{len(escolhidas)} aprovadas")
    return 1 if problemas else 0


if __name__ == "__main__":
    raise SystemExit(main())
