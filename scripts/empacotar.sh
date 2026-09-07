#!/usr/bin/env bash
# Gera instaladores sem credenciais. Configuração no primeiro uso.
# Uso: ./scripts/empacotar.sh [--bundles deb,appimage]
# Windows: npm run tauri -- build --bundles nsis,msi (no Windows).
#
# POR QUE O `productName` É ASCII E O NOME BONITO ESTÁ NO `.desktop`
#
# Do `productName` o Tauri deriva o campo `Package` do .deb, e a política Debian
# só admite minúsculas ASCII, dígitos, `+`, `-` e `.`. Com "GESTÃO P6 - 7º BPM"
# o pacote saía como `gestão-p6-7º-bpm` e o dpkg RECUSAVA a instalação:
#
#   nome de pacote inválido no campo 'Package': caractere 'ã' não permitido
#
# Então o `productName` é o identificador ASCII (`Gestao P6` -> `gestao-p6`,
# igual ao `mainBinaryName`) e o nome que o usuário lê no menu vem do
# `src-tauri/gestao-p6.desktop`, apontado por `bundle.linux.deb.desktopTemplate`
# — ali não há restrição de caractere. A barra de título é outra coisa ainda, e
# sai de `app.windows[0].title`.
# =============================================================================
set -Eeuo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLES=deb

while [[ $# -gt 0 ]]; do
    case "$1" in
        --bundles)
            [[ -n "${2-}" && "$2" != --* ]] || { echo "ERRO: informe os pacotes após --bundles" >&2; exit 2; }
            BUNDLES="$2"; shift ;;
        -h|--help)
            sed -n '2,4p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
            exit 0 ;;
        *) echo "opção desconhecida: $1" >&2; exit 2 ;;
    esac
    shift
done

echo "pacotes: $BUNDLES (sem credenciais embutidas)"

cd "$RAIZ"
npm run tauri -- build --bundles "$BUNDLES"

# O bundler nomeia o arquivo pelo `productName`, que tem espaço ("Gestao P6").
# Espaço em nome de arquivo atrapalha `scp`, `curl` e a linha de comando de quem
# vai instalar. O nome do PACOTE (o campo `Package`) não muda com isto — só o
# nome do arquivo.
echo
echo "pacotes gerados:"
while IFS= read -r artefato; do
    dir="$(dirname "$artefato")"
    base="$(basename "$artefato")"
    limpo="${base// /}"
    limpo="${limpo/Gestao P6/gestao-p6}"
    limpo="${limpo/GestaoP6/gestao-p6}"
    if [[ "$base" != "$limpo" ]]; then
        mv -f "$artefato" "$dir/$limpo"
        artefato="$dir/$limpo"
    fi
    printf '  %s  (%s)\n' "$artefato" "$(du -h "$artefato" | cut -f1)"
done < <(find "$RAIZ/src-tauri/target/release/bundle" -maxdepth 2 -type f \
              \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \))
