#!/usr/bin/env bash
# Prova que o CSS da árvore de trabalho não mexeu no PDF do Mapa Mensal.
#
# O congelamento do Mapa Mensal é a única regra inegociável desta família de
# telas, e até aqui ele era argumento: "nenhum seletor novo o alcança". Isto o
# transforma em medição — o mesmo documento impresso com o CSS de uma revisão
# anterior e com o CSS de agora, comparado no texto extraído e no pixel.
#
# A paginação real do mapa é medida no DOM por `mapa-pdf.ts` e não entra aqui;
# o que se compara é o desenho, que é o que o CSS decide.
#
#   tools/impressao/controle-mapa.sh [revisão]     # padrão: HEAD
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REVISAO="${1:-HEAD}"
TRABALHO="$(mktemp -d)"
BASE="$TRABALHO/base"
trap 'git -C "$RAIZ" worktree remove --force "$BASE" >/dev/null 2>&1 || true; rm -rf "$TRABALHO"' EXIT

echo "→ construindo o CSS de $REVISAO"
git -C "$RAIZ" worktree add --detach "$BASE" "$REVISAO" >/dev/null
ln -s "$RAIZ/node_modules" "$BASE/node_modules"
(cd "$BASE" && npx vite build >/dev/null 2>&1)
CSS_BASE="$(find "$BASE/dist/assets" -name 'index-*.css' | head -1)"

echo "→ construindo o CSS da árvore de trabalho"
(cd "$RAIZ" && npm run build >/dev/null 2>&1)

for lado in base atual; do
  if [ "$lado" = base ]; then argumento=(--css="$CSS_BASE"); else argumento=(); fi
  (cd "$RAIZ" && npx vite-node tools/impressao/gerar-fixturas.ts \
      "${argumento[@]}" --saida="$TRABALHO/fixturas-$lado" >/dev/null 2>&1)
  (cd "$RAIZ" && python3 tools/impressao/imprimir.py \
      --fixturas="$TRABALHO/fixturas-$lado" --saida="$TRABALHO/saida-$lado" \
      --fixtura=mapa-mensal-controle >/dev/null 2>&1)
  pdftoppm -png -r 110 "$TRABALHO/saida-$lado/mapa-mensal-controle.pdf" "$TRABALHO/$lado"
done

echo "→ comparando"
pdfinfo "$TRABALHO/saida-base/mapa-mensal-controle.pdf" | grep -E '^(Pages|Page size)'

if ! diff -q \
    <(pdftotext -layout "$TRABALHO/saida-base/mapa-mensal-controle.pdf" -) \
    <(pdftotext -layout "$TRABALHO/saida-atual/mapa-mensal-controle.pdf" -) >/dev/null; then
  echo "REGRESSÃO: o texto extraído do Mapa Mensal mudou." >&2
  exit 1
fi

for antes in "$TRABALHO"/base-*.png; do
  depois="${antes/\/base-/\/atual-}"
  if ! cmp -s "$antes" "$depois"; then
    echo "REGRESSÃO: $(basename "$antes") saiu diferente." >&2
    exit 1
  fi
done

echo "Mapa Mensal idêntico ao de $REVISAO — texto e pixel."
