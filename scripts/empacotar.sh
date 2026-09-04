#!/usr/bin/env bash
# =============================================================================
# Gera o pacote de instalação com as credenciais do banco JÁ EMBUTIDAS.
#
#   ./scripts/empacotar.sh                      # .deb, lendo .env.producao
#   ./scripts/empacotar.sh --env-file .env      # aponta para o banco local
#   ./scripts/empacotar.sh --bundles deb,appimage
#
# As credenciais entram por `ADMP6_DB_*` no AMBIENTE do cargo, e o
# `app_state.rs::definicao` as lê com `option_env!` na compilação. É o que faz o
# pacote conectar sem nenhuma configuração na estação: instalado, o binário abre
# com o `cwd` no `$HOME` e não há `.env` nenhum para achar.
#
# A senha NÃO passa por argumento — `ps` mostraria a linha de comando inteira
# para qualquer usuário da máquina. Ela sai do arquivo de configuração e vai
# direto para o ambiente do processo filho.
#
# Ela também não é segredo depois de compilada: `strings` no binário a mostra.
# O pacote gerado carrega acesso ao banco de produção e deve ser tratado como
# tal — não vai para pasta compartilhada nem para o git (o `.gitignore` cobre a
# pasta de saída do bundler).
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
ARQ_ENV="$RAIZ/.env.producao"
BUNDLES=deb

while [[ $# -gt 0 ]]; do
    case "$1" in
        --env-file) ARQ_ENV="${2-}"; shift ;;
        --bundles)  BUNDLES="${2-}"; shift ;;
        -h|--help)
            sed -n '3,9p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
            exit 0 ;;
        *) echo "opção desconhecida: $1" >&2; exit 2 ;;
    esac
    shift
done

[[ -f "$ARQ_ENV" ]] || { echo "ERRO: configuração não encontrada: $ARQ_ENV" >&2; exit 2; }

# Lê só as chaves que interessam, sem executar o arquivo — mesmo cuidado do
# scripts/migrar_dados_legados.sh.
while IFS='=' read -r chave valor; do
    case "$chave" in
        DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|DB_SSLMODE)
            printf -v "$chave" '%s' "$valor" ;;
    esac
done < <(grep -E '^\s*DB_(HOST|PORT|NAME|USER|PASSWORD|SSLMODE)=' "$ARQ_ENV" | sed 's/^[[:space:]]*//')

for obrigatoria in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD; do
    [[ -n "${!obrigatoria-}" ]] || { echo "ERRO: $obrigatoria vazia em $ARQ_ENV" >&2; exit 2; }
done

# O `.env.producao` fica em `require` porque quem o lê no dia a dia é o
# `psql`/`pg_dump` do container do docker-compose, e a imagem `postgres:16` não
# traz pacote de certificados. A APLICAÇÃO é outro cliente: usa rustls com as
# raízes embutidas e valida a Neon até `verify-full` — medido. Então o pacote
# nasce com o modo mais estrito, não com o do arquivo.
export ADMP6_DB_HOST="$DB_HOST"
export ADMP6_DB_PORT="$DB_PORT"
export ADMP6_DB_NAME="$DB_NAME"
export ADMP6_DB_USER="$DB_USER"
export ADMP6_DB_PASSWORD="$DB_PASSWORD"
export ADMP6_DB_SSLMODE="${ADMP6_DB_SSLMODE:-verify-full}"

echo "configuração: $ARQ_ENV"
echo "banco:        $ADMP6_DB_USER@$ADMP6_DB_HOST:$ADMP6_DB_PORT/$ADMP6_DB_NAME (sslmode=$ADMP6_DB_SSLMODE)"
echo "pacotes:      $BUNDLES"
echo

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
