# ADM P6

Sistema da **Seção de Justiça e Disciplina do 7º BPM** (PMRO): cadastro e
acompanhamento de apuratórios — processos disciplinares e procedimentos de
apuração, como IPM, sindicância, PADS e carta precatória —, com prazos,
designações, enquadramento e os relatórios que a Seção emite.

Aplicativo de desktop em **Rust + Tauri 2**, com frontend em TypeScript e
PostgreSQL 16. Foi migrado de uma versão anterior em Python/Eel; o banco carrega
os registros de 2018 em diante.

## Rodar

Requer Rust estável, Node 20+ e Docker.

```bash
cp .env.example .env          # já aponta para o compose (porta 5438)
docker compose up -d          # PostgreSQL 16

npm install
npm run tauri dev             # aplica as migrations no startup e abre o app
```

Login inicial: `admin@sistema.com` / `123456` — **troque numa instalação real.**

## Rodar contra o Neon (produção)

`npm run tauri dev` sempre lê o `.env` (banco local) — é o que impede alcançar
produção por engano. Para conectar de propósito ao Neon, usando as credenciais
de `.env.producao`:

```bash
./scripts/rodar_contra_neon.sh
```

Vale só para aquele processo do shell; um terminal novo volta ao banco local.

## Instaladores e conexão no primeiro uso

Os novos builds **não leem `.env.producao` e não incorporam credenciais**.

Execute os comandos abaixo na raiz do repositório. É necessário Rust estável,
Node 20+ e as dependências do projeto (`npm ci`). O build não precisa acessar o
banco nem receber `.env.producao`; a opção antiga `--env-file` foi removida.

### Linux — pacote .deb

Com os [pré-requisitos Linux do Tauri](https://v2.tauri.app/start/prerequisites/#linux)
instalados, **mais `libdbus-1-dev`**: a feature `sync-secret-service` do
`keyring` puxa `libdbus-sys`, que compila por `pkg-config` e não consta da lista
do Tauri.

```bash
sudo apt-get install -y libdbus-1-dev
```


```bash
npm ci
./scripts/empacotar.sh                  # .deb
# Opcional: gerar também AppImage
./scripts/empacotar.sh --bundles deb,appimage
```

O script normaliza o nome do arquivo. Para a versão 0.1.0 em Linux x64, a saída é:

```text
src-tauri/target/release/bundle/deb/gestao-p6_0.1.0_amd64.deb
```

### Windows — gerar .exe pelo WSL/Linux

Este foi o processo usado para gerar o instalador x64 testado com sucesso no
Windows em 07/09/2026. Usa NSIS e `cargo-xwin`, seguindo o
[fluxo de compilação cruzada do Tauri](https://v2.tauri.app/distribute/windows-installer/#build-windows-apps-on-linux-and-macos).
O `.msi` deve ser gerado no próprio Windows, conforme a seção seguinte.

**Preparação da máquina, uma vez (Ubuntu/WSL):**

```bash
sudo apt-get update
sudo apt-get install -y clang llvm lld nsis
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin --version 0.23.1
```

A instalação de pacotes pede a senha de administrador do WSL. Confira as ferramentas:

```bash
command -v clang llvm-rc lld-link llvm-lib makensis cargo-xwin
rustup target list --installed          # deve listar x86_64-pc-windows-msvc
```

**Preparação local e build:** alguns pacotes Ubuntu trazem `clang`, mas não o
atalho `clang-cl`. O bloco abaixo cria esse atalho quando necessário, sem alterar
`/usr/bin`, e guarda as ferramentas auxiliares e o SDK em `target/`, já ignorado
pelo Git. Pode ser repetido a cada geração.

```bash
npm ci
mkdir -p src-tauri/target/windows-tools/bin
if ! command -v clang-cl >/dev/null 2>&1; then
    ln -sf "$(command -v clang)" src-tauri/target/windows-tools/bin/clang-cl
fi
export PATH="$PWD/src-tauri/target/windows-tools/bin:$PATH"
export XWIN_CACHE_DIR="$PWD/src-tauri/target/xwin-cache"

npm run tauri -- build \
    --runner cargo-xwin \
    --target x86_64-pc-windows-msvc \
    --config '{"bundle":{"targets":["nsis"]}}'
```

A primeira execução baixa o SDK/CRT da Microsoft, as dependências Windows e o
plugin do NSIS; reserve acesso à internet e alguns GB livres. Nas próximas,
o cache é reaproveitado. O frontend é compilado automaticamente pelo Tauri.

A saída para a versão 0.1.0 é:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Gestao P6_0.1.0_x64-setup.exe
```

Esse `-setup.exe` é o instalador a distribuir. O arquivo `gestao-p6.exe`, na
pasta `release`, é somente o executável do app. O Tauri mantém o espaço no nome
do instalador; no pacote entregue para teste, ele foi renomeado para
`gestao-p6_0.1.0_x64-setup.exe`. Os nomes acompanham a versão em `tauri.conf.json`.

O instalador atual não tem assinatura digital. O modo padrão do Tauri baixa o
WebView2 se ele estiver ausente no PC de destino, exigindo internet nesse caso.
A geração pelo WSL foi concluída e o teste no Windows foi confirmado pelo usuário;
ainda se deve repetir a verificação manual abaixo para cada nova versão.

### Windows — gerar no próprio Windows

Com Rust/MSVC e os [pré-requisitos Windows do Tauri](https://v2.tauri.app/start/prerequisites/#windows)
instalados, execute no terminal do Windows:

```powershell
npm ci
npm run tauri -- build --bundles nsis,msi
```

Os instaladores ficam em `src-tauri/target/release/bundle/nsis/` e
`src-tauri/target/release/bundle/msi/`. O `.msi` usa WiX e requer o recurso
VBScript do Windows habilitado. Este caminho nativo é uma alternativa; o pacote
validado nesta rodada foi o `.exe` gerado pelo WSL.

### Configuração da conexão no PC de destino

Na primeira abertura, antes do login, informe a URL PostgreSQL (com senha) ou
servidor, porta, banco, usuário, senha e SSL. **Testar e salvar** conecta, grava
no cofre e aplica as migrations antes de liberar o login. SSL usa `verify-full`
quando não informado; no PostgreSQL local sem TLS, escolha explicitamente o
modo adequado. A URL conserva as opções suportadas pelo driver, incluindo
`options` usado por provedores, e rejeita opções desconhecidas sem logar valores.

A conexão fica no **Gerenciador de Credenciais do Windows** ou no **Secret
Service do Linux**, sob o serviço `br.gov.pmro.admp6`, entrada `database-v1`.
Cada conta do sistema operacional configura uma vez. Atualizar o aplicativo
preserva essa entrada; o instalador não executa a configuração como administrador.
O aplicativo não usa arquivo de senha, localStorage, `.env`, `DATABASE_URL`,
`DB_*` ou `PG*` como fonte alternativa em builds release.

No Linux, é necessário um provedor Secret Service ativo na sessão gráfica,
como GNOME Keyring ou KWallet com Secret Service habilitado. No Debian/Ubuntu,
instale `gnome-keyring` se a sessão não tiver um provedor; abra uma nova sessão
e desbloqueie o cofre. O `.deb` recomenda esse pacote, sem impor a troca do
cofre de quem já usa outro provedor. Se o cofre estiver ausente, bloqueado ou
recusar a gravação, o app orienta corrigir e tentar novamente; não continua sem
armazenamento seguro. O sistema operacional pode exibir seu próprio pedido de
desbloqueio, mesmo quando a conexão já está salva.

Falha de rede não apaga credenciais. Use **Tentar novamente** para reconectar
ou **Configurar conexão** antes do login para corrigir/trocar os dados. Por
segurança, a senha salva não é reenviada à interface: ao reconfigurar, informe
os dados completos. Cancelar não salva e mantém o acesso bloqueado. Falha nas
migrations mantém a conexão salva, mas impede o login até resolver a atualização.

Em desenvolvimento, `tauri dev` continua usando `.env`/`DB_*`; `DATABASE_URL`
é alternativa quando `DB_HOST` está ausente — e, por isso, o cofre **nunca** é
consultado ali. Para percorrer o fluxo real (modal de primeiro uso, cofre
bloqueado, reabertura direta no login) sem gerar instalador, exporte
`ADM_P6_USAR_COFRE=1`: o build de debug passa a ignorar o ambiente e a ler a
configuração do cofre, como o app instalado. O script de execução contra Neon
continua sobrescrevendo as variáveis para aquele processo. Testes usam bancos
descartáveis e cofres simulados, sem escrever no cofre pessoal.

Instaladores antigos ainda contêm as credenciais que receberam no build; gerar
um pacote novo não modifica os antigos. O cofre protege o segredo armazenado
conforme a segurança da conta do sistema operacional; o app continua conectando
diretamente ao PostgreSQL.

### Verificação manual dos pacotes

Em Windows e em uma sessão gráfica Linux, instalar, configurar com uma conta
de teste, fechar, reabrir e reiniciar o computador: o login deve aparecer sem
novo pedido de conexão. Atualizar o pacote deve preservar a configuração; outra
conta do sistema deve receber o modal. Conferir cancelamento, troca de senha,
rede indisponível e cofre bloqueado/ausente, sem expor credenciais em mensagens.

## Conferir

```bash
cd src-tauri
cargo fmt --check
cargo test                    # 205 testes, em bancos descartáveis
cd ..
npm run typecheck             # é aqui que erro de comando aparece
npm test                      # 50 testes de frontend
npm run build                 # typecheck + vite build
```

Os testes sobem e derrubam o próprio banco; não tocam no de desenvolvimento.

## ⚠ Antes de mexer no banco

**Não rode `docker compose down -v`.** O banco de desenvolvimento tem os dados
de produção dentro, e recriar o volume apaga oito anos de registro.

Mudança de schema agora é **migration nova** (`0023`…) — os arquivos existentes
de `src-tauri/migrations/` são imutáveis, e editar um já aplicado
quebra o startup seguinte com `VersionMismatch`.

## Migrar os dados do sistema anterior

Um comando. O padrão é **ensaio**: roda a migração inteira numa cópia
descartável do banco e emite o relatório, sem tocar no real.

```bash
# teste, no PostgreSQL desta máquina (lê o .env)
./scripts/migrar_dados_legados.sh                        # ensaio
./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db

# produção, no PostgreSQL de outra máquina (lê o .env.producao)
./scripts/migrar_dados_legados.sh --env-file .env.producao
./scripts/migrar_dados_legados.sh --env-file .env.producao --execute --destino admp6db
```

Qual banco será migrado sai do arquivo de configuração, e só dele. O `.env`
aponta para o banco local — é o arquivo usado no desenvolvimento e pelos testes, e deixá-lo
assim é o que impede `cargo test` ou `npm run tauri dev` de alcançarem produção.

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
