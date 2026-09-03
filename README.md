# ADM P6

Sistema da **Seção de Justiça e Disciplina do 7º BPM** (PMRO): cadastro e
acompanhamento de apuratórios — processos disciplinares e procedimentos de
apuração, como IPM, sindicância, PADS e carta precatória —, com prazos,
designações, enquadramento e os relatórios que a Seção emite.

Aplicativo de desktop em **Rust + Tauri 2**, com frontend em TypeScript e
PostgreSQL 16. Foi migrado de uma versão anterior em Python/Eel; o banco carrega
os registros de 2018 em diante.

## Rodar

Requer Rust estável, Node 18+ e Docker.

```bash
cp .env.example .env          # já aponta para o compose (porta 5438)
docker compose up -d          # PostgreSQL 16

npm install
npm run tauri dev             # aplica as migrations no startup e abre o app
```

Login inicial: `admin@sistema.com` / `123456` — **troque numa instalação real.**

## Conferir

```bash
cd src-tauri
cargo fmt --check
cargo test                    # 180 testes, em bancos descartáveis
cd ..
npm run typecheck             # é aqui que erro de comando aparece
npm run build                 # typecheck + vite build
```

Os testes sobem e derrubam o próprio banco; não tocam no de desenvolvimento.

## ⚠ Antes de mexer no banco

**Não rode `docker compose down -v`.** O banco de desenvolvimento tem os dados
de produção dentro, e recriar o volume apaga oito anos de registro.

Mudança de schema agora é **migration nova** (`0021`…) — os arquivos existentes
de `src-tauri/migrations/` são imutáveis, e editar um já aplicado
quebra o startup seguinte com `VersionMismatch`.

## Migrar os dados do sistema anterior

Um comando. O padrão é **ensaio**: roda a migração inteira numa cópia
descartável do banco e emite o relatório, sem tocar no real.

```bash
./scripts/migrar_dados_legados.sh                        # ensaio
./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db
```

Ele faz backup validado antes de qualquer mutação, carrega o dump legado num
schema isolado, roda a carga numa transação só e emite contagens, invariantes e
o CSV das pendências que precisam de decisão humana. Detalhes, rollback e
leitura dos relatórios: [`src-tauri/importacao/README.md`](src-tauri/importacao/README.md).

## Onde está o resto

**[`GUIA.md`](GUIA.md) é a fonte de verdade** deste projeto e o lugar por onde
começar. Ele traz o estado atual, o modelo de dados e o porquê de cada decisão,
as 50 decisões de negócio já tomadas, as receitas para mexer sem quebrar, o
roteiro da importação, as armadilhas conhecidas e a lista do que ainda falta
conferir na tela.

- `src-tauri/migrations/0001_schema.sql` — o schema, comentado seção por seção.
- `src-tauri/importacao/` — a importação do banco legado, etapa por etapa.
- `scripts/migrar_dados_legados.sh` — o comando único que orquestra tudo isso.

## Estrutura

```
src/               frontend TypeScript (sem framework), uma tela por arquivo
src-tauri/src/     backend Rust, um módulo por área
src-tauri/migrations/   o schema
src-tauri/tests/        os testes de integração
src-tauri/importacao/   a importação do banco legado (SQL, uso pontual)
scripts/           o script de migração dos dados legados
```
