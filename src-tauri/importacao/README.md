# Migração dos dados legados

Traz os dados do ADM-P6 antigo (Python/Eel, PostgreSQL menos normalizado) para o
banco deste projeto. **Um comando só:**

```bash
./scripts/migrar_dados_legados.sh                        # ensaio (padrão)
./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db
```

O padrão é **ensaio**: o script restaura uma cópia descartável do destino, roda a
migração inteira nela e emite o mesmo relatório. O banco real não é tocado.

---

## Pré-requisitos

| | |
|---|---|
| Banco de destino | com as migrations **0001 a 0020** aplicadas (suba a aplicação uma vez) |
| Dump legado | `admp6_db_atualizado.sql` na raiz — SQL puro, 44 MB |
| Postgres | o serviço `postgres` do `docker-compose.yml` **no ar** |
| Ferramentas | `docker` e `sha256sum`. `psql`/`pg_dump` do host são opcionais |

O script fala com o banco por `docker compose exec -T postgres` e cai para os
clientes do host se eles existirem (`--acesso host` força). Dentro do container a
conexão é por socket unix, que o `postgres:16` aceita como `trust`: **não há
senha em lugar nenhum**. Pelo host, a senha vai por `PGPASSWORD` no ambiente do
processo — nunca em `argv`, que qualquer `ps` mostraria.

Credenciais saem de `.env` (`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`)
ou do ambiente. Nenhuma é aceita por argumento nem gravada em relatório.

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
