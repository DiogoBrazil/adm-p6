# Migração dos dados legados

Traz os dados do ADM-P6 antigo (Python/Eel, PostgreSQL menos normalizado) para o
banco deste projeto. **Um comando só.**

O padrão é **ensaio**: o script restaura uma cópia descartável do destino, roda a
migração inteira nela e emite o mesmo relatório. O banco real não é tocado.

## Os dois ambientes

Qual banco será migrado sai do arquivo de configuração, e **só dele**. O `.env`
aponta para o banco local do docker-compose; o `.env.producao` aponta para o
servidor de verdade. Trocar de alvo é trocar de arquivo — nunca editar um.

### Teste, no PostgreSQL desta máquina

```bash
./scripts/migrar_dados_legados.sh                        # ensaio
./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db
```

Lê o `.env`. Como o servidor é o próprio container, a conexão é pelo socket unix,
que o `postgres:16` aceita como `trust`: **não há senha em lugar nenhum**.

### Produção, no PostgreSQL de outra máquina

```bash
cp .env.producao.example .env.producao      # primeira vez: preencha host e senha
./scripts/migrar_dados_legados.sh --env-file .env.producao                          # ensaio
./scripts/migrar_dados_legados.sh --env-file .env.producao --execute --destino admp6db
```

Aqui o container empresta só os **binários** `psql`/`pg_dump`; quem responde é o
servidor remoto. A senha entra por arquivo `.pgpass` criado dentro do container
com `umask 177` e apagado no fim, inclusive se a execução falhar — nunca por
`-e PGPASSWORD=` nem por argumento, que apareceriam no `ps` da máquina toda.

O script diz com quem está falando logo na primeira linha, e vale conferir antes
de usar `--execute`:

```
configuração:   .env.producao
binários psql:  docker
servidor:       admp6@10.1.2.173:5432  (EXTERNO)
```

`.env.producao` é **gitignorado** — tem senha. O que se versiona é o
`.env.producao.example`.

### Quem lê qual arquivo

| Quem | Lê | Como aponta para outro banco |
|---|---|---|
| A aplicação (`lib.rs:133`, `dotenvy::dotenv()`) | `.env` | editando `DB_HOST/PORT/NAME/USER/PASSWORD` |
| Os testes (`tests/util/mod.rs`) | `../.env` | idem — e por isso o `.env` deve ficar no banco local |
| `sqlx migrate run` | `DATABASE_URL` do ambiente ou do `.env` | passando `DATABASE_URL=...` na linha de comando |
| **O script de migração** | o que `--env-file` disser (padrão `.env`) | **`--env-file .env.producao`** |

Dois detalhes que costumam confundir:

- A **aplicação ignora o `DATABASE_URL`**. Ela monta a URL a partir das cinco
  variáveis `DB_*` (`app_state.rs::from_env`). O `DATABASE_URL` existe só para as
  ferramentas de linha de comando do `sqlx`.
- **Trocar de banco no script não é editar o `.env`** — é passar outro arquivo.
  É de propósito: o `.env` é o que a aplicação e os testes leem, e mantê-lo
  apontando para o banco local é o que impede um `cargo test` ou um
  `npm run tauri dev` de alcançarem produção por engano. Um teste roda
  `DROP DATABASE` em banco descartável; apontado para o lugar errado, seria caro.

Se você quiser que a **aplicação** também abra o banco de produção, aí sim edita
o `.env` — mas então lembre que os testes passam a mirar lá, e eles criam e
derrubam bancos.

## Banco de produção novo, ainda sem schema

O preflight exige as **20 migrations aplicadas** — ele recusa um banco vazio, e
recusa também um schema que alguém tenha aplicado com `psql`, porque aí não
existe `_sqlx_migrations` e o startup seguinte tentaria recriar tudo. Quem aplica
é o `sqlx`:

```bash
cd src-tauri
DATABASE_URL="postgres://USUARIO:SENHA@HOST:5432/BANCO" \
    sqlx migrate run --source migrations
cd ..
```

Ou, mais simples, abrir a aplicação uma vez apontada para lá: ela roda as
migrations no startup. Depois disso, o script de migração.

---

## Pré-requisitos

| | |
|---|---|
| Banco de destino | com as migrations **0001 a 0020** aplicadas (veja a seção acima) |
| Dump legado | `admp6_db_atualizado.sql` na raiz — SQL puro, 44 MB |
| Postgres | o serviço `postgres` do `docker-compose.yml` **no ar** — mesmo migrando para outra máquina, é dele que saem os binários |
| Ferramentas | `docker` e `sha256sum`. `psql`/`pg_dump` do host são opcionais |

`--acesso` decide de onde vêm os binários (`auto`, `docker` ou `host`), e é
independente de **qual servidor** será migrado — quem decide isso é o
`DB_HOST`/`DB_PORT` do arquivo de configuração. Nenhuma credencial é aceita por
argumento nem gravada em relatório.

**Servidor remoto que recusa conexão?** Na ordem: a máquina responde na 5432
(`ping` não serve, o ICMP costuma estar bloqueado); `listen_addresses = '*'` no
`postgresql.conf`; a sua rede liberada no `pg_hba.conf`
(`host all all 10.1.2.0/24 scram-sha-256`); e a 5432 aberta no firewall — no
Windows, o Defender a bloqueia por padrão. O script lista exatamente isso quando
falha.

---

## O que o script faz, na ordem

| # | Etapa | Onde |
|---|---|---|
| 1 | Confere ferramentas, dump e legibilidade; calcula o SHA-256 do dump | — |
| 2 | Confere a identidade do destino e se **este dump já foi migrado** | destino |
| 3 | **Backup** `-Fc` do destino e valida com `pg_restore -l` | disco |
| 4 | Renomeia um `legado` preexistente para `legado_anterior_<carimbo>` | destino |
| 5 | Carrega o dump num banco auxiliar, renomeia `public`→`legado`, copia | destino |
| 6 | `00_preflight.sql` — as guardas, sem mutar nada | destino |
| 7 | **Uma transação:** `SET LOCAL TimeZone` + etapas 00 a 09 | destino |
| 8 | `99_conferencia.sql` — contagens, invariantes e pendências | destino |
| 9 | Manifesto, log, `conferencia.txt` e `pendencias.csv` | `--saida` |

No modo ensaio, o passo 3 vira "monta a cópia descartável" e todos os seguintes
correm nela.

### As etapas SQL

Rodam **na ordem da lista**, não em ordem alfabética — a 00 apaga os processos de
teste e precisa vir antes da 04, e a 09 fecha depois de tudo. Nenhuma abre
transação própria.

| Arquivo | O que faz |
|---|---|
| `00_preflight.sql` | Guardas. **Fora** da transação, não escreve nada |
| `00_limpeza_testes.sql` | Apaga os 13 processos cadastrados no desenvolvimento |
| `01_catalogos.sql` | Catálogos operacionais + complemento do catálogo penal |
| `02_config_apuratorio.sql` | Documentos iniciadores e papéis por apuratório |
| `03_policiais.sql` | Efetivo, contas de acesso e as 2 promoções |
| `04_processos.sql` | Os 163 processos e a extensão de carta precatória |
| `05_envolvidos.sql` | Envolvidos, soluções, penalidades, vítimas e inquiridos |
| `06_designacoes.sql` | Designações e a cadeia de substituição |
| `07_prazos_andamentos.sql` | Prazos (inclusive os reconstruídos) e andamentos |
| `08_enquadramentos_anexos.sql` | Indícios, enquadramentos e o anexo |
| `09_auditoria_migracao.sql` | A linha de auditoria que marca a migração |
| `98_amostra_lado_a_lado.sql` | Comparativo campo a campo, para leitura humana |
| `99_conferencia.sql` | Conferência pós-carga |

---

## Segurança

- **Ensaio é o padrão.** `--execute` exige `--destino` com o nome exato do banco,
  e ele tem de bater com o `DB_NAME` configurado. `postgres`, `template0` e
  `template1` são recusados sempre.
- **Backup antes de qualquer mutação**, validado com `pg_restore -l`. Backup que
  não abre não é backup, e descobrir isso depois de mutar o destino é tarde.
- **Uma transação para toda a carga.** Qualquer falha desfaz tudo; o destino fica
  exatamente como estava. É por isso que nenhuma etapa abre `BEGIN`/`COMMIT`
  próprio: um `COMMIT` no meio encerraria a transação externa e o resto correria
  em autocommit, **sem erro nenhum**.
- **Nada de `CASCADE`, `TRUNCATE` ou exclusão sem alvo.** A limpeza apaga só os
  13 processos conferidos, e por FK, dos filhos para o pai.
- **Constraint nenhuma é desabilitada.** As adiáveis são conferidas no `COMMIT`,
  que é onde elas já são conferidas em produção.
- **O schema legado não é descartado**, nem o anterior: vira
  `legado_anterior_<carimbo>`. É dele que a conferência tira as comparações, e
  várias delas continuam valendo depois.
- **Mapas mensais e auditoria do legado não são migrados** — a conferência
  afirma isso, não só o script.

## Idempotência

O marcador é a linha de `auditoria` com `entidade = 'migracao_legado'` e
`registro_id` = SHA-256 do dump. Rodar de novo com o mesmo dump termina em
`exit 0` dizendo que não há o que fazer, **antes** de fazer backup ou carregar
schema. Ainda assim, todas as etapas são idempotentes por conta própria: uma
carga interrompida e repetida converge, e um estado **parcial** aborta em vez de
adivinhar.

IDs: os do legado são preservados sempre que existem (processos, envolvidos,
prazos, andamentos, policiais, artigos). Onde não existem — designação, prazo
reconstruído, anexo — são derivados por `md5('<tabela>|<origem>|<posição>')`.
Determinístico, reproduzível e conferível de fora recalculando o md5.

## Rollback

O backup fica em `--backup-dir` (padrão `./backups`). **Nunca restaure por
cima**: restaure em banco separado, confira e só então troque.

```bash
CID=$(docker compose ps -q postgres)
docker exec -i "$CID" psql -U adm_p6_user -d postgres \
    -c 'CREATE DATABASE adm_p6_restaurado;'
docker cp backups/adm_p6_db_antes_migracao_<carimbo>.dump "$CID:/tmp/rb.dump"
docker exec "$CID" pg_restore -U adm_p6_user -d adm_p6_restaurado \
    --no-owner --no-acl /tmp/rb.dump
docker exec "$CID" rm -f /tmp/rb.dump
# confira adm_p6_restaurado; só então decida trocar
```

## Lendo os relatórios

O diretório de `--saida` contém:

| Arquivo | |
|---|---|
| `manifesto.txt` | destino, hash do dump, backup, divergências, pendências |
| `conferencia.txt` | as contagens, as invariantes e as pendências por extenso |
| `pendencias.csv` | as pendências nominais, uma por linha, para resolver na tela |
| `preflight.txt` | o que foi conferido antes de tocar em qualquer coisa |
| `carga.log` | a saída da transação, etapa por etapa |
| `carga.sql` | exatamente o SQL que rodou, para conferência ou repetição |
| `migracao.log` | tudo que o operador viu |

**Divergência** é erro: a conferência esperava um número e achou outro, ou uma
invariante deu diferente de zero. O script sai com código ≠ 0.

**Pendência** não é erro: é o que a migração não tinha como decidir e uma pessoa
precisa resolver. São quatro tipos, e todos estão no CSV:

| Tipo | Quantos | O que fazer |
|---|---|---|
| `analogia_provisoria` | 10 | Escolher o inciso do RDPM análogo, na tela de indícios |
| `prazo_reconstruido` | 110 | Conferir os dias, se o processo ainda estiver aberto |
| `prorrogacao_sem_motivo` | 77 | Preencher o motivo, se houver registro em papel |
| `papel_obrigatorio_vago` | 4 | Informar o Escrivão dos CD/CJ/PAD |

### A analogia provisória

Os 10 vínculos de art. 29 vindos de `pm_envolvido_art29` **não têm analogia com
o RDPM no legado** — aquela tabela nunca a guardou. Como
`analogia_transgressao_id` é `NOT NULL`, ou eles entram com um valor, ou as 10
acusações estatutárias reais se perdem.

Entram com `c8000000-0000-4000-8000-000000000001` (RDPM, Art. 15, inciso I),
**fixa e sem validade jurídica**. É fixa de propósito: uma consulta por esse id
devolve exatamente os casos a rever, hoje e daqui a um ano. O preflight recusa a
migração se ela estiver desativada, em vez de escolher outra sozinha.

Os outros 13 vínculos estatutários vêm do jsonb dos PADS, que **traz** a analogia
verdadeira — e essa é usada. As duas fontes não se cruzam (uma só aparece em
PADS, a outra só em IPM/SR), e a conferência tem uma invariante que prova que
nenhuma analogia real foi trocada pela provisória.

---

## Regerar a fixture do teste

`tests/importacao.rs` roda as etapas de verdade sobre um recorte versionado, e o
recorte precisa de um banco com o schema `legado` carregado — que o banco
operacional normalmente não tem:

```bash
./scripts/migrar_dados_legados.sh --manter-ensaio          # deixa o banco de ensaio
BANCO=adm_p6_db_ensaio_<carimbo> ./src-tauri/tests/fixtures/gerar_legado_amostra.sh
cd src-tauri && cargo test --test importacao
```

Os processos do recorte são escolhidos por UUID em
`tests/fixtures/gerar_legado_amostra.sql`, cada um com o caminho que ele cobre.
