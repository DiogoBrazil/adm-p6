#!/usr/bin/env python3
"""Imprime as fixturas no MESMO motor do app: WebKitGTK, via gi.

POR QUE NÃO CHROMIUM

O Chromium honra `@page { size }` e página nomeada; o WebKitGTK não honra
nenhum dos dois. Foi assim que a rodada 20 deu o A4 paisagem por pronto
enquanto o PDF saía retrato. Medir aqui é medir no motor que o usuário tem.

O caminho abaixo espelha `src-tauri/src/print/commands.rs`: papel declarado
como tamanho físico (297×210mm ou 210×297mm), **sem pedir rotação ao GTK** —
pedir rotação imprime páginas em branco, sem erro nenhum —, margens zero no
page setup porque quem dá a margem é o `@page` do CSS.

A diferença é o `print_()` em vez do `run_dialog()`: aqui não há operador para
escolher a impressora. Vale a ressalva registrada no GUIA — a armadilha da
rotação só aparece com `run_dialog`, então esta medição não substitui uma
conferência final no binário.

    python3 tools/impressao/imprimir.py --todas
"""

import argparse
import json
import os
import pathlib
import sys

# Tem de valer ANTES de o GTK inicializar.
#
# `GTK_PRINT_BACKENDS=file` porque sem ele o backend CUPS entra na frente e a
# impressora virtual de arquivo não é enumerada — o erro é "Printer not found",
# que não diz nada sobre backend nenhum. `LC_ALL=C` porque o nome dessa
# impressora é **traduzido**: em pt_BR ela não se chama "Print to File", e o
# `set_printer` falha do mesmo jeito silencioso. `WEBKIT_DISABLE_COMPOSITING_MODE`
# porque o WebKit 2.52 pede um contexto GL que a sessão Wayland não concede a
# uma janela offscreen, e aí o processo morre antes de renderizar.
os.environ.setdefault("GTK_PRINT_BACKENDS", "file")
os.environ.setdefault("LC_ALL", "C")
os.environ.setdefault("WEBKIT_DISABLE_COMPOSITING_MODE", "1")
os.environ.setdefault("GDK_BACKEND", "x11")

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parents[2]

# As duas folhas de `print/commands.rs`, em milímetros.
FOLHAS = {"retrato": (210.0, 297.0), "paisagem": (297.0, 210.0)}


def page_setup(orientacao: str) -> Gtk.PageSetup:
    largura, altura = FOLHAS[orientacao]
    folha = Gtk.PageSetup()
    folha.set_paper_size(
        Gtk.PaperSize.new_custom(
            f"a4-{orientacao}", f"A4 {orientacao}", largura, altura, Gtk.Unit.MM
        )
    )
    for margem in ("top", "bottom", "left", "right"):
        getattr(folha, f"set_{margem}_margin")(0.0, Gtk.Unit.MM)
    return folha


def imprimir(entrada: pathlib.Path, saida: pathlib.Path, orientacao: str) -> None:
    janela = Gtk.OffscreenWindow()
    # A janela em px não decide a folha, mas uma janela estreita faz o layout de
    # tela nascer no ponto errado antes de o motor trocar para a mídia impressa.
    janela.set_default_size(1280, 900)
    vista = WebKit2.WebView()
    ajustes = vista.get_settings()
    # O CSS compilado é carregado por `file://` a partir de outro `file://`.
    ajustes.set_allow_file_access_from_file_urls(True)
    ajustes.set_allow_universal_access_from_file_urls(True)
    janela.add(vista)
    janela.show_all()

    resultado = {"erro": None}
    laco = GLib.MainLoop()

    def ao_terminar(_operacao):
        laco.quit()

    def ao_falhar(_operacao, erro):
        resultado["erro"] = erro.message
        laco.quit()

    def ao_carregar(_vista, evento):
        if evento != WebKit2.LoadEvent.FINISHED:
            return

        # Um respiro depois do load: fontes e layout ainda assentam, e imprimir
        # no mesmo tick sai com a geometria de antes — é o mesmo motivo do
        # `requestAnimationFrame` em `dom.ts::abrirImpressao`.
        def disparar():
            operacao = WebKit2.PrintOperation.new(vista)
            operacao.set_page_setup(page_setup(orientacao))
            ajustes_impressao = Gtk.PrintSettings()
            ajustes_impressao.set(Gtk.PRINT_SETTINGS_OUTPUT_URI, saida.as_uri())
            ajustes_impressao.set(Gtk.PRINT_SETTINGS_OUTPUT_FILE_FORMAT, "pdf")
            ajustes_impressao.set_printer("Print to File")
            operacao.set_print_settings(ajustes_impressao)
            operacao.connect("finished", ao_terminar)
            operacao.connect("failed", ao_falhar)
            operacao.print_()
            return False

        GLib.timeout_add(300, disparar)

    vista.connect("load-changed", ao_carregar)
    vista.load_uri(entrada.as_uri())

    def esgotar():
        resultado["erro"] = "tempo esgotado"
        laco.quit()
        return False

    # Rede de segurança: uma fixtura que nunca termina não pode travar a suíte.
    GLib.timeout_add_seconds(90, esgotar)
    laco.run()
    janela.destroy()

    if resultado["erro"]:
        raise RuntimeError(f"{entrada.name}: {resultado['erro']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixturas", default=str(RAIZ / "tools/impressao/fixturas"))
    parser.add_argument("--saida", default=str(RAIZ / "tools/impressao/saida"))
    parser.add_argument("--todas", action="store_true")
    parser.add_argument("--fixtura", action="append", default=[])
    args = parser.parse_args()

    pasta = pathlib.Path(args.fixturas)
    manifesto = json.loads((pasta / "manifesto.json").read_text("utf8"))
    saida = pathlib.Path(args.saida)
    saida.mkdir(parents=True, exist_ok=True)

    escolhidas = [f for f in manifesto["fixturas"] if args.todas or f["nome"] in args.fixtura]
    if not escolhidas:
        print("nada a imprimir: use --todas ou --fixtura=nome", file=sys.stderr)
        return 2

    for fixtura in escolhidas:
        destino = saida / f"{fixtura['nome']}.pdf"
        imprimir(pasta / fixtura["arquivo"], destino, fixtura["orientacao"])
        print(f"{fixtura['nome']:24} {fixtura['orientacao']:9} -> {destino.name}")

    (saida / "manifesto.json").write_text(json.dumps(manifesto, indent=2), "utf8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
