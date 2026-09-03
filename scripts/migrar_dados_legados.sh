#!/usr/bin/env bash
# =============================================================================
# Migração dos dados do ADM-P6 antigo (Python/Eel) para o banco normalizado.
#
# Ponto único de entrada. Orquestra o dump legado, o backup do destino, as
# etapas SQL de src-tauri/importacao/ e o relatório de reconciliação.
#
#   ./scripts/migrar_dados_legados.sh                       # ensaio (padrão)
#   ./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db
#
# O modo padrão é o ENSAIO: restaura uma cópia descartável do destino, roda a
# migração inteira nela e emite o mesmo relatório. Não toca no banco real.
#
# Documentação completa: src-tauri/importacao/README.md
# =============================================================================
set -Eeuo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ETAPAS_DIR="$RAIZ/src-tauri/importacao"
CARIMBO="$(date +%Y%m%d_%H%M%S)"

# As etapas, na ordem de execução. Ordem alfabética NÃO serve: a 00 é a limpeza
# e precisa vir antes da 04, e a 09 fecha depois de tudo. É lista explícita de
# propósito — acrescentar arquivo na pasta não o coloca na migração.
ETAPAS=(
    00_limpeza_testes.sql
    01_catalogos.sql
    02_config_apuratorio.sql
    03_policiais.sql
    04_processos.sql
    05_envolvidos.sql
    06_designacoes.sql
    07_prazos_andamentos.sql
    08_enquadramentos_anexos.sql
    09_auditoria_migracao.sql
)

# ------------------------------------------------------------------ padrões --
MODO=ensaio
DUMP="$RAIZ/admp6_db_atualizado.sql"
DESTINO_AUTORIZADO=""
DIR_BACKUP="$RAIZ/backups"
DIR_SAIDA=""
SERVICO_DB=postgres      # nome do serviço no docker-compose.yml
ACESSO=auto              # auto | docker | host
MANTER_ENSAIO=0

# Recursos a limpar no fim. O trap preserva o que serve de evidência.
BANCO_TMP_LEGADO=""
BANCO_ENSAIO=""

uso() {
    cat <<'FIM'
Uso: scripts/migrar_dados_legados.sh [opções]

  --execute                 Executa de verdade. Exige --destino com o nome exato.
  --dry-run                 Ensaio numa cópia descartável do destino (padrão).
  --destino NOME            Nome do banco a migrar. Obrigatório com --execute.
  --dump ARQUIVO            Dump do sistema antigo (padrão: admp6_db_atualizado.sql).
  --backup-dir DIR          Onde gravar o backup do destino (padrão: ./backups).
  --saida DIR               Onde gravar log e relatórios (padrão: ./migracao_<carimbo>).
  --acesso auto|docker|host Como falar com o Postgres (padrão: auto).
  --manter-ensaio           Não descarta o banco de ensaio ao fim.
  -h, --help                Esta ajuda.

Credenciais vêm de .env (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD) ou do
ambiente. Nenhuma senha é aceita por argumento, gravada em arquivo ou impressa.
FIM
}

# --------------------------------------------------------------- argumentos --
while [[ $# -gt 0 ]]; do
    case "$1" in
        --execute)        MODO=execucao ;;
        --dry-run)        MODO=ensaio ;;
        --destino)        DESTINO_AUTORIZADO="${2-}"; shift ;;
        --dump)           DUMP="${2-}"; shift ;;
        --backup-dir)     DIR_BACKUP="${2-}"; shift ;;
        --saida)          DIR_SAIDA="${2-}"; shift ;;
        --acesso)         ACESSO="${2-}"; shift ;;
        --manter-ensaio)  MANTER_ENSAIO=1 ;;
        -h|--help)        uso; exit 0 ;;
        *) echo "opção desconhecida: $1" >&2; uso >&2; exit 2 ;;
    esac
    shift
done

DIR_SAIDA="${DIR_SAIDA:-$RAIZ/migracao_$CARIMBO}"
LOG=""

# ------------------------------------------------------------------- saída ---
# Tudo que o operador lê passa por aqui, e é gravado no log. Nenhuma função
# imprime senha: a única que existe vive em variável de ambiente e nunca é
# interpolada em mensagem nem em linha de comando.
diga()  { printf '%s\n' "$*" | tee -a "${LOG:-/dev/null}"; }
passo() { printf '\n=== %s\n' "$*" | tee -a "${LOG:-/dev/null}"; }
erro()  { printf '\nERRO: %s\n' "$*" | tee -a "${LOG:-/dev/null}" >&2; }

ao_sair() {
    local codigo=$?
    set +e
    if [[ -n "$BANCO_TMP_LEGADO" ]]; then
        # Banco auxiliar do dump legado: some sempre. O schema `legado` já foi
        # copiado para o destino, e é lá que ele precisa continuar existindo.
        sql_admin "DROP DATABASE IF EXISTS \"$BANCO_TMP_LEGADO\" WITH (FORCE);" >/dev/null 2>&1
    fi
    if [[ -n "$BANCO_ENSAIO" ]]; then
        if (( MANTER_ENSAIO )) || (( codigo != 0 )); then
            # Falhou: o banco de ensaio É a evidência. Não se apaga.
            diga "banco de ensaio preservado para diagnóstico: $BANCO_ENSAIO"
        else
            sql_admin "DROP DATABASE IF EXISTS \"$BANCO_ENSAIO\" WITH (FORCE);" >/dev/null 2>&1
        fi
    fi
    if (( codigo != 0 )); then
        erro "migração interrompida (código $codigo). Nada foi confirmado no destino."
        [[ -n "$LOG" ]] && echo "log: $LOG" >&2
    fi
    exit $codigo
}
trap ao_sair EXIT
trap 'erro "interrompido pelo operador"; exit 130' INT TERM

# ------------------------------------------------------------- configuração --
if [[ -f "$RAIZ/.env" ]]; then
    # Lê só as chaves que interessam, sem executar o arquivo.
    while IFS='=' read -r chave valor; do
        case "$chave" in
            DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)
                [[ -z "${!chave-}" ]] && printf -v "$chave" '%s' "$valor" ;;
        esac
    done < <(grep -E '^\s*DB_(HOST|PORT|NAME|USER|PASSWORD)=' "$RAIZ/.env" | sed 's/^[[:space:]]*//')
fi
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5438}"
DB_NAME="${DB_NAME:-adm_p6_db}"
DB_USER="${DB_USER:-adm_p6_user}"

# --------------------------------------------------- como falar com o banco --
# Dentro do container a conexão é por socket unix, que o postgres:16 aceita como
# `trust`: não há senha em lugar nenhum. Pelo host, a senha vai por PGPASSWORD
# no AMBIENTE do processo — nunca em argv, que qualquer `ps` mostraria.
detecta_acesso() {
    case "$ACESSO" in
        docker|host) return ;;
        auto) : ;;
        *) erro "--acesso aceita auto, docker ou host"; exit 2 ;;
    esac
    if command -v docker >/dev/null 2>&1 &&
       docker compose -f "$RAIZ/docker-compose.yml" ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx "$SERVICO_DB"; then
        ACESSO=docker
    elif command -v psql >/dev/null 2>&1; then
        ACESSO=host
    else
        erro "não achei nem o serviço '$SERVICO_DB' no docker compose nem o psql no PATH."
        erro "suba o banco com 'docker compose up -d' ou instale postgresql-client-16."
        exit 3
    fi
}

no_container() {
    docker compose -f "$RAIZ/docker-compose.yml" exec -T "$SERVICO_DB" "$@"
}

psql_em() {           # psql_em <banco> [args...]  — stdin é repassado
    local banco="$1"; shift
    if [[ $ACESSO == docker ]]; then
        no_container psql -U "$DB_USER" -d "$banco" -v ON_ERROR_STOP=1 "$@"
    else
        PGPASSWORD="${DB_PASSWORD-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -d "$banco" -v ON_ERROR_STOP=1 "$@"
    fi
}

pgdump_de() {         # pgdump_de <banco> [args...]  — stdout é o dump
    local banco="$1"; shift
    if [[ $ACESSO == docker ]]; then
        no_container pg_dump -U "$DB_USER" -d "$banco" "$@"
    else
        PGPASSWORD="${DB_PASSWORD-}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
            -d "$banco" "$@"
    fi
}

sql_admin() {         # comando avulso no banco `postgres` (CREATE/DROP DATABASE)
    psql_em postgres -q -c "$1"
}

sql_valor() {         # uma célula, sem cabeçalho
    psql_em "$1" -At -c "$2"
}

# ----------------------------------------------------------- pré-requisitos --
passo "verificando pré-requisitos"
mkdir -p "$DIR_SAIDA"
LOG="$DIR_SAIDA/migracao.log"
: > "$LOG"

detecta_acesso
diga "acesso ao banco: $ACESSO"

for prog in sha256sum; do
    command -v "$prog" >/dev/null 2>&1 || { erro "faltando: $prog"; exit 3; }
done
if [[ $ACESSO == host ]]; then
    for prog in psql pg_dump pg_restore; do
        command -v "$prog" >/dev/null 2>&1 || { erro "faltando: $prog (instale postgresql-client-16)"; exit 3; }
    done
    [[ -n "${DB_PASSWORD-}" ]] || { erro "DB_PASSWORD não definida e o acesso é pelo host."; exit 3; }
fi

[[ -n "$DUMP" ]] || { erro "--dump não pode ser vazio"; exit 2; }
[[ -r "$DUMP" ]] || { erro "dump não encontrado ou ilegível: $DUMP"; exit 3; }
[[ -s "$DUMP" ]] || { erro "dump está vazio: $DUMP"; exit 3; }

for etapa in "${ETAPAS[@]}" 00_preflight.sql 99_conferencia.sql; do
    [[ -r "$ETAPAS_DIR/$etapa" ]] || { erro "etapa ausente: $ETAPAS_DIR/$etapa"; exit 3; }
done

HASH_DUMP="$(sha256sum "$DUMP" | cut -d' ' -f1)"
diga "dump:  $DUMP"
diga "sha256: $HASH_DUMP"

# -------------------------------------------------- identidade do destino ----
# O banco real só é tocado com --execute E com o nome escrito por extenso. Sem
# isso o padrão é ensaio, e um engano digitando não alcança produção.
if [[ $MODO == execucao ]]; then
    [[ -n "$DESTINO_AUTORIZADO" ]] || {
        erro "--execute exige --destino com o nome exato do banco (proteção contra execução acidental)."
        exit 2; }
    [[ "$DESTINO_AUTORIZADO" == "$DB_NAME" ]] || {
        erro "--destino '$DESTINO_AUTORIZADO' não bate com o DB_NAME configurado ('$DB_NAME')."
        exit 2; }
    case "$DESTINO_AUTORIZADO" in
        postgres|template0|template1|"")
            erro "destino proibido: $DESTINO_AUTORIZADO"; exit 2 ;;
    esac
    DESTINO="$DB_NAME"
else
    DESTINO="$DB_NAME"
fi

sql_valor postgres "select 1" >/dev/null || { erro "não consegui conectar ao Postgres."; exit 3; }
if [[ "$(sql_valor postgres "select count(*) from pg_database where datname = '$DESTINO'")" != "1" ]]; then
    erro "banco de destino não existe: $DESTINO"
    exit 3
fi

# -------------------------------------------- já migrado? (antes de tudo) ---
# O marcador de idempotência é a linha de auditoria com o sha256 do dump, e ela
# não depende do schema `legado`. Conferir AQUI, e não só no preflight, evita
# que uma reexecução inocente faça backup e arquive mais uma cópia de 44 MB do
# dump antes de descobrir que não havia nada a fazer.
if [[ "$(sql_valor "$DESTINO" "select to_regclass('public.auditoria') is not null")" == "t" ]]; then
    JA="$(sql_valor "$DESTINO" \
        "select count(*) from auditoria where entidade = 'migracao_legado' and registro_id = '$HASH_DUMP'")"
    if [[ "$JA" != "0" ]]; then
        passo "este dump já foi migrado para este banco"
        diga "marcador sha256 $HASH_DUMP encontrado em '$DESTINO'; nada a fazer."
        diga "para conferir o estado atual:"
        diga "  psql -d $DESTINO -f $ETAPAS_DIR/99_conferencia.sql"
        exit 0
    fi
fi

# ------------------------------------------------------ backup / cópia ------
if [[ $MODO == execucao ]]; then
    passo "backup do destino antes de qualquer mutação"
    mkdir -p "$DIR_BACKUP"
    ARQ_BACKUP="$DIR_BACKUP/${DESTINO}_antes_migracao_$CARIMBO.dump"
    pgdump_de "$DESTINO" -Fc --no-owner --no-acl > "$ARQ_BACKUP"
    [[ -s "$ARQ_BACKUP" ]] || { erro "backup saiu vazio — abortando antes de tocar no destino."; exit 4; }
    # `pg_restore -l` só lê o índice: prova que o arquivo é um archive legível e
    # completo, sem restaurar nada. Um backup que não abre não é backup, e
    # descobrir isso depois de mutar o destino é tarde demais.
    #
    # Ele PRECISA de um arquivo posicionável: por um pipe o pg_restore falha com
    # "did not find magic string", mesmo o arquivo estando perfeito. Por isso o
    # backup é copiado para dentro do container em vez de mandado por stdin.
    if [[ $ACESSO == docker ]]; then
        local_cid="$(docker compose -f "$RAIZ/docker-compose.yml" ps -q "$SERVICO_DB")"
        [[ -n "$local_cid" ]] || { erro "não achei o container do serviço $SERVICO_DB"; exit 4; }
        docker cp "$ARQ_BACKUP" "$local_cid:/tmp/verificar_backup.dump" >/dev/null
        if ! docker exec "$local_cid" pg_restore -l /tmp/verificar_backup.dump > "$DIR_SAIDA/backup_indice.txt" 2>&1; then
            docker exec "$local_cid" rm -f /tmp/verificar_backup.dump || true
            erro "o backup não passou na verificação; veja $DIR_SAIDA/backup_indice.txt"
            exit 4
        fi
        docker exec "$local_cid" rm -f /tmp/verificar_backup.dump
    else
        pg_restore -l "$ARQ_BACKUP" > "$DIR_SAIDA/backup_indice.txt" || {
            erro "o backup não passou na verificação; veja $DIR_SAIDA/backup_indice.txt"; exit 4; }
    fi
    diga "backup: $ARQ_BACKUP ($(du -h "$ARQ_BACKUP" | cut -f1), $(wc -l < "$DIR_SAIDA/backup_indice.txt") objetos)"
    ALVO="$DESTINO"
else
    passo "ensaio: montando cópia descartável do destino"
    BANCO_ENSAIO="${DESTINO}_ensaio_$CARIMBO"
    sql_admin "DROP DATABASE IF EXISTS \"$BANCO_ENSAIO\" WITH (FORCE);"
    sql_admin "CREATE DATABASE \"$BANCO_ENSAIO\";"
    pgdump_de "$DESTINO" --no-owner --no-acl | psql_em "$BANCO_ENSAIO" -q > /dev/null
    diga "cópia: $BANCO_ENSAIO (o banco real, $DESTINO, não será tocado)"
    ALVO="$BANCO_ENSAIO"
fi

# ------------------------------------------------- schema legado no alvo ----
# O caminho é o da seção 6.2 do GUIA: o dump nasce em `public` de um banco
# auxiliar, vira `legado` ali, e só então é copiado para o alvo. Não há parsing
# de SQL — quem lê o dump é o próprio Postgres.
passo "carregando o dump legado no schema isolado"
LEGADO_EXISTENTE="$(sql_valor "$ALVO" "select count(*) from pg_namespace where nspname = 'legado'")"
if [[ "$LEGADO_EXISTENTE" == "1" ]]; then
    N_ANTIGO="$(sql_valor "$ALVO" "select count(*) from legado.processos_procedimentos" 2>/dev/null || echo 0)"
    ARQUIVO_LEGADO="legado_anterior_$CARIMBO"
    diga "já existe um schema 'legado' com $N_ANTIGO processos; renomeando para '$ARQUIVO_LEGADO'"
    diga "  (não é descartado: é a cópia do backup anterior, e o plano manda preservá-la)"
    psql_em "$ALVO" -q -c "ALTER SCHEMA legado RENAME TO \"$ARQUIVO_LEGADO\";"
fi

BANCO_TMP_LEGADO="adm_p6_legado_tmp_$CARIMBO"
sql_admin "DROP DATABASE IF EXISTS \"$BANCO_TMP_LEGADO\" WITH (FORCE);"
sql_admin "CREATE DATABASE \"$BANCO_TMP_LEGADO\";"
psql_em "$BANCO_TMP_LEGADO" -q -f - < "$DUMP" > "$DIR_SAIDA/carga_legado.log" 2>&1 || {
    erro "o dump não carregou; veja $DIR_SAIDA/carga_legado.log"; exit 4; }
N_ORIGEM="$(sql_valor "$BANCO_TMP_LEGADO" "select count(*) from public.processos_procedimentos")"
diga "dump carregado: $N_ORIGEM processos"
psql_em "$BANCO_TMP_LEGADO" -q -c "ALTER SCHEMA public RENAME TO legado;"
pgdump_de "$BANCO_TMP_LEGADO" -n legado --no-owner --no-acl | psql_em "$ALVO" -q > /dev/null
diga "schema 'legado' instalado em $ALVO"

# ------------------------------------------------------------- preflight ----
passo "preflight (nenhuma mutação até aqui, fora o schema legado)"
set +e
psql_em "$ALVO" -v hash_dump="$HASH_DUMP" -f - < "$ETAPAS_DIR/00_preflight.sql" \
    > "$DIR_SAIDA/preflight.txt" 2>&1
COD_PREFLIGHT=$?
set -e
cat "$DIR_SAIDA/preflight.txt" | tee -a "$LOG"
if (( COD_PREFLIGHT != 0 )); then
    erro "preflight reprovou. Nada foi alterado no destino."
    exit 5
fi

if grep -q 'JA_MIGRADO' "$DIR_SAIDA/preflight.txt"; then
    passo "este dump já foi migrado para este banco"
    diga "o marcador de auditoria com o sha256 $HASH_DUMP já existe em '$ALVO'."
    diga "nada a fazer. Para conferir o estado, rode a conferência:"
    diga "  psql -d $ALVO -f $ETAPAS_DIR/99_conferencia.sql"
    exit 0
fi

# ---------------------------------------------------------------- a carga ---
# Uma transação só, uma conexão só. As etapas NÃO abrem transação própria: um
# COMMIT no meio encerraria esta e o resto correria em autocommit.
#
# `SET LOCAL TimeZone` é a primeira coisa dentro dela: o legado guarda timestamp
# sem fuso, digitado em Ariquemes, e o cast implícito usa o fuso da sessão — que
# no container é UTC. Sem isso o histórico entraria 4h adiantado, sem erro.
passo "carga (transação única sobre $ALVO)"
{
    echo "SET LOCAL TimeZone = 'America/Porto_Velho';"
    for etapa in "${ETAPAS[@]}"; do
        echo "\\echo '-- etapa $etapa'"
        cat "$ETAPAS_DIR/$etapa"
    done
} > "$DIR_SAIDA/carga.sql"

set +e
psql_em "$ALVO" --single-transaction -v hash_dump="$HASH_DUMP" \
    -f - < "$DIR_SAIDA/carga.sql" > "$DIR_SAIDA/carga.log" 2>&1
COD_CARGA=$?
set -e
grep -E '^(-- etapa|ERROR|NOTICE)' "$DIR_SAIDA/carga.log" | tee -a "$LOG" || true
if (( COD_CARGA != 0 )); then
    erro "a carga falhou. A transação foi desfeita: o destino está como estava."
    erro "detalhes em $DIR_SAIDA/carga.log"
    exit 6
fi
diga "carga confirmada."

# ------------------------------------------------------------ conferência ---
passo "conferência e reconciliação"
set +e
psql_em "$ALVO" -f - < "$ETAPAS_DIR/99_conferencia.sql" \
    > "$DIR_SAIDA/conferencia.txt" 2>&1
COD_CONF=$?
set -e
cat "$DIR_SAIDA/conferencia.txt" | tee -a "$LOG"
if (( COD_CONF != 0 )); then
    erro "a conferência não rodou até o fim; veja $DIR_SAIDA/conferencia.txt"
    exit 7
fi

DIVERGENCIAS=$(grep -c 'DIVERGE\|FALHOU' "$DIR_SAIDA/conferencia.txt" || true)

# CSV nominal das pendências, para levar à tela e resolver uma a uma.
psql_em "$ALVO" --csv -c "
    select 'analogia_provisoria' as tipo, a.sigla as apuratorio,
           p.numero_documento as processo,
           coalesce(pm.nome,'(A apurar)') as detalhe,
           'Art. 29, ' || ie.inciso as complemento
      from envolvido_infracoes_estatuto eie
      join infracoes_estatuto ie on ie.id = eie.infracao_estatuto_id
      join processo_envolvidos e on e.id = eie.envolvido_id
      join processos_procedimentos p on p.id = e.processo_id
      join apuratorios a on a.id = p.apuratorio_id
      left join policiais_militares pm on pm.id = e.policial_militar_id
     where eie.analogia_transgressao_id = 'c8000000-0000-4000-8000-000000000001'
    union all
    select 'papel_obrigatorio_vago', a.sigla, p.numero_documento, pp.nome, ''
      from processos_procedimentos p
      join apuratorios a on a.id = p.apuratorio_id
      join apuratorio_papeis ap on ap.apuratorio_id = p.apuratorio_id and ap.obrigatorio
      join papeis_processo pp on pp.id = ap.papel_id
     where not exists (select 1 from processo_designacoes d
                        where d.processo_id = p.id and d.papel_id = ap.papel_id and d.data_fim is null)
    union all
    select 'prazo_reconstruido', a.sigla, p.numero_documento, z.dias::text, z.data_inicio::text
      from processo_prazos z
      join processos_procedimentos p on p.id = z.processo_id
      join apuratorios a on a.id = p.apuratorio_id
     where z.ordem = 0
       and not exists (select 1 from legado.prazos_processo lz where lz.id::uuid = z.id)
    union all
    select 'prorrogacao_sem_motivo', a.sigla, p.numero_documento, z.ordem::text, z.data_inicio::text
      from processo_prazos z
      join processos_procedimentos p on p.id = z.processo_id
      join apuratorios a on a.id = p.apuratorio_id
     where z.motivo = 'Motivo não registrado no sistema anterior'
    order by 1,2,3;" > "$DIR_SAIDA/pendencias.csv"

# ------------------------------------------------------------- manifesto ----
{
    echo "migração ADM-P6 — $CARIMBO"
    echo "modo:            $MODO"
    echo "banco alvo:      $ALVO"
    [[ $MODO == ensaio ]] && echo "banco real:      $DESTINO (intocado)"
    echo "dump:            $DUMP"
    echo "sha256 do dump:  $HASH_DUMP"
    echo "processos origem:$N_ORIGEM"
    [[ -n "${ARQ_BACKUP-}" ]] && echo "backup:          $ARQ_BACKUP"
    [[ -n "${ARQUIVO_LEGADO-}" ]] && echo "legado anterior: schema $ARQUIVO_LEGADO (preservado)"
    echo "divergências:    $DIVERGENCIAS"
    echo "pendências:      $(( $(wc -l < "$DIR_SAIDA/pendencias.csv") - 1 ))"
} > "$DIR_SAIDA/manifesto.txt"

passo "resultado"
cat "$DIR_SAIDA/manifesto.txt" | tee -a "$LOG"
diga ""
diga "relatórios em $DIR_SAIDA/"

if (( DIVERGENCIAS > 0 )); then
    erro "a conferência acusou $DIVERGENCIAS divergência(s). Veja conferencia.txt."
    exit 8
fi

if [[ $MODO == ensaio ]]; then
    diga ""
    diga "ENSAIO concluído sem divergência. Para valer:"
    diga "  $0 --execute --destino $DESTINO"
fi
