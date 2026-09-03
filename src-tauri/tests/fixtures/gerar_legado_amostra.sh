#!/usr/bin/env bash
# Regera tests/fixtures/legado_amostra.sql a partir do dump de produção.
#
# Não precisa rodar no dia a dia: a fixture está versionada. Serve para quando
# o recorte precisar de outro processo (um caminho novo da importação, um caso
# que passou a existir).
#
# Exige um banco com o schema `legado` já carregado. O padrão é adm_p6_db, mas
# o banco operacional normalmente NÃO tem o legado do dia — quem o carrega é
# scripts/migrar_dados_legados.sh, e num ensaio ele o deixa num banco à parte.
# Por isso o nome é parametrizável: regerar a fixture não deve exigir mexer no
# banco de produção.
#
#   ./src-tauri/tests/fixtures/gerar_legado_amostra.sh
#   BANCO=adm_p6_ensaio ./src-tauri/tests/fixtures/gerar_legado_amostra.sh
#
# O recorte é definido em gerar_legado_amostra.sql, ao lado.
set -euo pipefail
cd "$(dirname "$0")/../../.."

BANCO="${BANCO:-adm_p6_db}"
PSQL=(docker compose exec -T postgres psql -U adm_p6_user -d "$BANCO" -v ON_ERROR_STOP=1 -q)
DESTINO=src-tauri/tests/fixtures/legado_amostra.sql

"${PSQL[@]}" < src-tauri/tests/fixtures/gerar_legado_amostra.sql

{
  cat src-tauri/tests/fixtures/legado_amostra.cabecalho
  # `--inserts` porque o teste executa o arquivo pelo protocolo do Postgres, e
  # `COPY ... FROM stdin` é sintaxe do cliente psql, não SQL.
  # As linhas \restrict/\unrestrict são meta-comandos do psql pela mesma razão.
  docker compose exec -T postgres pg_dump -U adm_p6_user -d "$BANCO" \
      -n amostra --no-owner --no-acl --inserts --rows-per-insert=50 \
    | grep -v '^\\\(un\)\?restrict '
} > "$DESTINO.tmp"
mv "$DESTINO.tmp" "$DESTINO"

"${PSQL[@]}" -c 'DROP SCHEMA IF EXISTS amostra CASCADE;'
echo "gerado: $DESTINO ($(wc -l < "$DESTINO") linhas)"
