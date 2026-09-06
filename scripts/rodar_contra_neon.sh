#!/usr/bin/env bash
# =============================================================================
# Sobe o app (npm run tauri dev) apontando para o Neon de PRODUÇÃO, não para o
# docker-compose local.
#
#   ./scripts/rodar_contra_neon.sh
#
# `src-tauri/src/lib.rs::run` chama `dotenvy::dotenv().ok()`, que carrega o
# `.env` mas NÃO sobrescreve variável já presente no ambiente do processo. Este
# script exporta DB_HOST/PORT/NAME/USER/PASSWORD ANTES do `npm run tauri dev`,
# e é isso — não editar `.env` — que faz o Neon vencer o banco local.
#
# Por que não reaproveitar o DB_SSLMODE de .env.producao: aquele arquivo é lido
# só pelo `psql`/`pg_dump` do container do docker-compose (ver o próprio
# .env.producao), que não tem pacote de certificados e por isso pede `require`.
# A aplicação usa rustls e valida a Neon até `verify-full`
# (src-tauri/src/app_state.rs::definicao) — aqui o modo é sempre esse,
# independente do que o arquivo disser.
#
# Efêmero de propósito: as variáveis valem só para este processo do shell. Um
# terminal novo volta a ler o `.env` local — é o que impede apontar para
# produção por engano (mesma razão do README, seção "Migrar os dados").
# =============================================================================
set -Eeuo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARQ_ENV="$RAIZ/.env.producao"

if [[ ! -f "$ARQ_ENV" ]]; then
    printf 'ERRO: arquivo de configuração não encontrado: %s\n' "$ARQ_ENV" >&2
    exit 2
fi

# Lê só as chaves que interessam, sem executar o arquivo — mesmo padrão de
# scripts/migrar_dados_legados.sh.
while IFS='=' read -r chave valor; do
    case "$chave" in
        DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)
            export "$chave=$valor" ;;
    esac
done < <(grep -E '^\s*DB_(HOST|PORT|NAME|USER|PASSWORD)=' "$ARQ_ENV" | sed 's/^[[:space:]]*//')

export DB_SSLMODE=verify-full

if [[ -z "${DB_HOST-}" || -z "${DB_PASSWORD-}" ]]; then
    printf 'ERRO: %s não definiu DB_HOST/DB_PASSWORD\n' "$ARQ_ENV" >&2
    exit 2
fi

printf 'Conectando ao Neon: %s@%s:%s/%s (sslmode=%s)\n' \
    "$DB_USER" "$DB_HOST" "$DB_PORT" "$DB_NAME" "$DB_SSLMODE" >&2

cd "$RAIZ"
exec npm run tauri dev
