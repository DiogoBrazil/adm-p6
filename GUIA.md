# ADM-P6 — guia do projeto

> Fonte de verdade única do **ADM-P6**, sistema da Seção de Justiça e Disciplina do
> 7º BPM (PMRO). Reúne o modelo de dados e o porquê de cada decisão, as receitas
> para mexer sem quebrar, as armadilhas que já custaram tempo e o roteiro do que
> falta conferir.
>
> Escrito para ser lido por quem chega sem contexto nenhum. Substitui os três
> documentos anteriores (`REFATORACAO-MODELO-DADOS.md`, `CONFERENCIA-DE-TELA.md` e
> `ANALISE-MIGRACAO.md`), que estão no histórico do git.

| | |
|---|---|
| **O que é** | app de desktop **Rust + Tauri 2**, frontend TypeScript sem framework, **PostgreSQL 16** |
| **Branch** | `migrate_to_rust_with_tauri` |
| **Branch legada** (Python/Eel) | `upload_pdf_to_procedure` — consultar só para esclarecer regra |
| **Dump do banco anterior** | `adm-p6.sql` (44 MB) — **somente leitura**, no `.gitignore` |
| **SGBD** | PostgreSQL 16 via compose, porta 5438. Requer 12+ pela coluna gerada, e `btree_gist` |

## ▶ Estado hoje

**A migração Python/Eel → Rust/Tauri está funcionalmente concluída.** O banco carrega
os dados reais de 2018 em diante, e o que resta é conferência de tela e a decisão
sobre remover o schema `legado`.

| Código | |
|---|---:|
| Migrations (`0001`–`0018`) | **18** |
| Comandos Tauri, todos no cliente tipado | **89** |
| Testes | **174** no Rust · **11** no frontend (Vitest, sobre `src/graficos/dados.ts`) |
| Módulos Rust · linhas de Rust | 13 · 11.460 |
| Arquivos de frontend · linhas de TS/CSS | 22 · 17.200 |
| Catálogos administráveis | 26 |
| Comandos que o frontend invoca e não existem | **0** |
| Chamadas fora do cliente tipado | **0** |
| Dependências de frontend | **3** — `@tauri-apps/api`, `tom-select` e `chart.js`, empacotadas pelo Vite |

| Schema | |
|---|---:|
| Tabelas · FKs · CHECKs · EXCLUDEs · triggers · views | **46 · 59 · 30 · 3 · 3 · 1** |

| No banco agora | |
|---|---:|
| Apuratórios | **11** |
| Envolvidos · designações · prazos | 12 · 18 · 12 |
| Ofendidos/vítimas · pessoas inquiridas | 7 · 0 |
| Militares · usuários · apuratórios · unidades | 235 · 7 · 10 · 11 |
| Anexos · auditorias | 1 · 64 |

O schema `legado` **ainda está no banco** — é o gabarito da conferência histórica, e
sai só quando ela fechar.

### O que falta, em ordem

| # | O quê | Onde | Bloqueia? |
|---|---|---|---|
| 1 | **Percorrer as telas com o binário de produção**, console aberto (F12). É o único que exerce a CSP restritiva | seção **11** | **Sim**, antes do uso real |
| 2 | **Criar uma carta precatória de ponta a ponta** | seção 11, item (f) | **Sim** |
| 3 | **Conferir Ofendido/Vítima e o Resumo dos fatos na tela** — segue entre as áreas menos vistas por olho humano | seção 11, item (i) | **Sim** |
| 3b | **Conferir "À apurar", os seletores pesquisáveis e o cadastro rápido** — nenhum deles existia antes, e o modal e a CSP só se provam no binário | seção 11, item **(k)** | **Sim** |
| 3c | **Conferir a pesquisa instantânea e o modal de filtros avançados** — é o primeiro modal do app com seletor pesquisável **e** CSP restritiva ao mesmo tempo | seção 11, item **(l)** | **Sim** |
| 3d | **Conferir a pesquisa instantânea de Catálogos e Usuários** — o redesenho parcial pode perder a largura das colunas **sem acusar** | seção 11, item **(n)** | **Sim** |
| 3e | **Conferir desativar e excluir militar** — a exclusão é física e não se desfaz; fazer em banco descartável ou com o responsável | seção 11, item **(o)** | **Sim** |
| 3f | **Conferir os painéis analíticos e o PDF deles** — o papel só se prova imprimindo: a geometria da folha é medida na tela, antes de a folha existir | seção 11, item **(p)** | **Sim** |
| 3g | **Conferir os painéis reorganizados e a carga por militar** — duas telas saíram do menu e uma trocou de pergunta; e a soma dos quatro baldes contra o Total é o tipo de erro que passa despercebido por parecer plausível | seção 11, item **(q)** | **Sim** |
| 4 | **Decidir se os 11 registros atuais continuam como massa de teste.** Não os apague por suposição | — | **Sim** antes de carga real |
| 5 | Repetir a conferência dos 6 processos históricos, restaurando o backup em banco descartável | seção 11, item (j) | não |
| 6 | **Remover o schema `legado`** — só depois da conferência histórica. Refaça o backup antes: é irreversível | seção 6 | não |

> ⚠ **A conferência de tela não é formalidade.** Nas duas vezes em que alguém sentou
> para fazê-la, apareceu código quebrado que nenhum teste alcançava: os seletores de
> militar truncados em 200 e o formulário de carta precatória que não renderizava.
> Ambos corrigidos — mas foi ela que os achou, não a suíte.

### Há backup, e ele foi testado

`~/backups/adm-p6/adm_p6_db_<data>.dump` (`pg_dump --format=custom`, ~27 MB, o schema
`legado` incluído). **Restaurado num banco descartável e conferido contra a origem** —
as 8 contagens batem e o anexo de 20 MB casa no md5. O comando está na seção 6.

Fora do git de propósito: tem dado pessoal de 235 militares, pela mesma razão que
`adm-p6.sql` está no `.gitignore`.

### Antes de tocar em qualquer coisa, leia

- **Seção 2** — os 6 princípios do modelo. Toda decisão futura tem de caber neles.
- **Seção 3** — as 54 decisões já tomadas. Não reabra sem motivo novo.
- **Seção 7** — as armadilhas. Cada uma já custou tempo pelo menos uma vez.
- **Acabou o `docker compose down -v`.** Com dado real dentro, recriar o volume apaga
  8 anos de registro. Mudança de schema agora é migration incremental (seção 5).

### De-para: as seções do documento anterior

Comentários em migrations e scripts de importação citam a numeração antiga. Migration
aplicada **não pode ser editada** (o `sqlx` guarda checksum), então os ponteiros ficam
e a tradução é esta:

| Citado no código | Agora é |
|---|---|
| §3, §3.1, §3.2 | seção **2** — princípios |
| §5.3 | seção **4** — configurabilidade |
| §7.1 | seção **5** — primeiro uso |
| §7.7 | seção **5** — campo que só alguns apuratórios usam |
| §8.5 | seção **6** — importação |
| §8.9, §8.10 | seção **12** — changelog, e seção **7** — armadilhas |
| §9 | seção **10** — pontos a reavaliar |
| §10 | seção **7** — armadilhas |
| decisão N | seção **3**, mesma numeração |

---
## 1. Como rodar e verificar

```bash
cp .env.example .env                 # já aponta para o compose (porta 5438, adm_p6_db)
docker compose up -d

# Backend
cd src-tauri
cargo fmt --check
cargo test                           # 180 testes, bancos descartáveis
cargo run                            # aplica as migrations no startup e abre o app

# Frontend
cd ..
npm install
npm test                             # Vitest — as transformações puras de `src/graficos/dados.ts`
npm run typecheck                    # tsc --noEmit — é aqui que erro de comando aparece
npm run build                        # typecheck + vite build

# Binário de produção — é o único que exerce a CSP restritiva.
# Empacota deb, rpm e AppImage: `bundle.icon` deixou de estar vazio quando o
# distintivo do 7º BPM virou ícone do app. `--no-bundle` continua servindo para
# conferir só a CSP, sem esperar os três pacotes.
npm run tauri build
./src-tauri/target/release/adm-p6-tauri
```

Login inicial: `admin@sistema.com` / `123456`.

> **`cargo run` e `npm run tauri dev` usam a `devCsp`**, que afrouxa `style-src` e libera o
> WebSocket do HMR. Servem para desenvolver; **não** servem para conferir a CSP. Para isso
> é o binário de produção acima.

### 1.1 Primeiro uso — **só numa instalação nova**

> **Nesta máquina isso já está feito.** A importação preencheu todos os catálogos
> operacionais e a configuração dos 10 apuratórios. A lista abaixo vale para uma instalação
> do zero, sem o dump de produção — outra unidade da PM, por exemplo.

Os catálogos **legais** já vêm prontos (postos, municípios, RDPM, Estatuto, legislação
penal). Os **operacionais** nascem vazios de propósito. Para chegar a um apuratório:

1. **Catálogos → Tipos de apuratório** — ex.: `processo`, `procedimento`
2. **Catálogos → Apuratórios** — sigla, nome, tipo, prazo base, `max_envolvidos`,
   `exige_natureza_fato`
3. **Catálogos → Tipos de documento** — ex.: Portaria, Memorando Disciplinar
4. **Catálogos → Funções no apuratório** — ex.: Encarregado, Escrivão, Presidente
5. **Catálogos → Unidades PM**, **Naturezas do fato**, **Status do envolvido**,
   **Soluções**, **Penalidades**, **Papéis de pessoa**, **Tipos de andamento**
6. **Catálogos → Configuração de apuratórios** — para cada apuratório, habilitar ao menos
   **um documento iniciador** e **uma função responsável**. Sem isso o banco recusa qualquer
   apuratório, e a tela avisa. É também o que faz as colunas aparecerem em *Designações por
   Militar* e nos painéis de *Estatísticas dos Apuratórios*
7. **Usuários** — cadastrar os policiais militares
8. **Apuratórios → Novo**

### 1.2 ⚠ Acabou o `docker compose down -v`

**Com os dados de produção dentro, recriar o volume apaga 8 anos de registro.** A regra que
valia enquanto o banco estava vazio — "editou migration, recria o banco" — não vale mais.

O `sqlx::migrate!` guarda um checksum por versão: editar um `.sql` já aplicado gera
`VersionMismatch` no próximo startup. A partir de agora **toda mudança de schema é uma
migration nova** (`0015`…), e todas as migrations já aplicadas são imutáveis.

Se ainda assim for preciso recomeçar do zero — numa máquina de desenvolvimento, por
exemplo — o caminho completo é: recriar o volume, aplicar as migrations, restaurar o
`adm-p6.sql` e rodar as oito etapas de `src-tauri/importacao/` de novo. O roteiro inteiro
está na seção 6, e o `adm-p6.sql` nunca é modificado.

---

## 2. Princípios invioláveis do modelo

Toda decisão futura deve respeitar estes seis pontos. Estão escritos também no cabeçalho de
`src-tauri/migrations/0001_schema.sql`.

1. Todo conceito de negócio é um cadastro administrável, não um literal no código.
2. **Nome e sigla são apresentação**; o comportamento vem de atributos semânticos.
   Renomear "Encarregado" para "Responsável pela apuração" não pode quebrar nada.
3. Relações conhecidas do domínio são tabelas com FK — nunca JSONB, nunca lista em `TEXT`.
4. Cada informação tem **uma única fonte de verdade**.
5. **Configuração define o comportamento futuro; não reescreve fatos já registrados.**
   Baixar `prazo_base_dias` de 40 para 30 não move nenhum vencimento já gravado.
6. Catálogo em uso se **desativa** (`ativo = false`); não se apaga (`ON DELETE RESTRICT`).

> **Regra de leitura que decorre do princípio 6 e precisa de disciplina no código:**
> listas de **opções** filtram `WHERE ativo`; leitura de **registro existente** faz JOIN
> **sem** filtrar `ativo`. Um processo de 2019 cuja natureza foi desativada em 2026 tem de
> continuar exibindo aquela natureza. O código antigo aplicava `coalesce(ativo,true)=true`
> indistintamente — era um bug, não uma convenção. Travado pelo teste
> `processo_antigo_continua_exibindo_catalogo_desativado`.

---


---

## 3. Decisões de negócio tomadas — **não reabrir sem motivo novo**

Todas foram decididas pelo responsável do projeto e estão implementadas.

| # | Questão | Decisão |
|---|---|---|
| 1 | Existe instalação do schema novo a preservar? | **Não.** As 32 migrations foram substituídas por baseline limpa. Histórico no Git. |
| 2 | Solução e penalidade: do processo ou do envolvido? | **Do envolvido.** `apuratorios.max_envolvidos` torna configurável quantos PMs cada apuratório aceita. Com limite 1 o comportamento é idêntico ao de hoje. |
| 3 | O que são `Sugerido_Arquivamento`, `Sugerido_IPM`, `Sugerido_Sindicancia`? | **Conceito distinto.** O encarregado *sugere*; a autoridade *decide*. Dois campos, dois catálogos: `tipos_solucao_sugerida` e `tipos_solucao_decidida`. |
| 4 | Crime militar × comum é do artigo ou do caso? | **Do caso** (art. 9º do CPM). A esfera é escolhida **no vínculo** envolvido↔artigo. Crime × Contravenção, esse sim, é atributo do artigo. |
| 5 | A analogia com o RDPM é obrigatória para toda infração estatutária? | **Sim, regra universal.** `analogia_transgressao_id` é `NOT NULL`. |
| 6 | O que significa `data_fim` de uma designação? | **O dia da troca, exclusivo.** O sucessor começa exatamente nesse dia. Intervalo semiaberto `[)`. |
| 7 | Qual o escopo de unicidade do número de controle? | **Sequencial por unidade, subunidade/seção opcional, ano e apuratório.** Dois registros sem subunidade continuam no mesmo escopo; sem subunidade e com subunidade são escopos distintos. |
| 8 | Condutor (motorista) em sinistro | **No máximo um por processo, sempre entre os envolvidos.** É papel do envolvido, não outra pessoa. |
| 9 | Funções obrigatórias bloqueiam o salvamento? | **Sim.** Um `obrigatorio` que não bloqueia não significa nada. Para permitir a ausência, desmarque `obrigatorio` naquele apuratório — quem decide é a configuração. |
| 10 | Que catálogos vêm semeados? | **Só o que é lei** e não varia por instalação (migration `0003`). O operacional por unidade fica com o administrador. |
| 11 | Como o administrador configura um apuratório? | Módulo dedicado `apuratorio_config`, não o CRUD genérico: as duas tabelas de associação têm PK composta, sem `id` e sem `nome`. |
| 12 | Rumo do frontend | Vanilla TS **dividido em módulos**, sem dependência nova, migrando tela por tela. |
| 13 | Quantos envolvidos cada apuratório aceita? | **Vem do tipo, não de uma lista à mão.** `procedimento` (CP, FP, IPM, SR, SV) fica **sem limite**; `processo` (CD, CJ, PAD, PADE, PADS) fica com **1**. Um processo disciplinar é instaurado contra um militar; um procedimento apura um fato e alcança quantos alcançar. Espécie nova herda a regra do tipo. |
| 14 | Os 37 processos sem envolvido na importação | **Criar o envolvido.** Não é inventar fato: os 37 têm `nome_pm_id` e `status_pm` preenchidos, e 13 têm solução e 7 têm penalidade. Como essas três informações só existem em `processo_envolvidos` no schema novo, não criar significaria **perdê-las**. |
| 15 | As unidades além do 7ºBPM | **São unidades de verdade.** CORREGEPOM (16 processos), 9ºBPM (2) e 11ºBPM (1) entram em `unidades_pm`. Importa para a numeração, que é única por unidade e pela subunidade/seção opcional. |
| 16 | Histórico de mapas salvos e de auditoria | **Não é importado.** Os 107 mapas são snapshots no formato antigo, que a tela nova não sabe renderizar como tabela; as 448 linhas de auditoria são do sistema anterior. Ficam no dump. |
| 17 | A prorrogação começa no dia do vencimento anterior, ou no seguinte? | **No mesmo dia** — 97/97 no histórico. A migration `0005` passou a comparar a *ocupação* como `[data_inicio, data_inicio + dias)`, e `deadlines::add_extension` foi alinhado. `data_vencimento` continua sendo o último dia válido. |
| 18 | As 58 prorrogações sem motivo | **Texto reconhecível:** `'Motivo não registrado no sistema anterior'`. Não mexe no schema, e diz exatamente o que aconteceu. |
| 19 | Duas ou três substituições de encarregado no mesmo dia (5 processos) | **Colapsar**, mantendo a última do dia. Os horários (minutos de diferença) mostram correção de digitação, não substituição real — o encarregado do meio nunca exerceu. 25 entradas → 19 substituições. |
| 20 | Solução de processo com 2+ envolvidos (27 casos) | **Replicada a todos.** É o que o fato legado afirma; atribuí-la só ao primeiro afirmaria o que o dump não diz. Alcançou 80 envolvidos. |
| 21 | A conta `admin@sistema.com` do legado | **Não importada.** O militar por trás dela (ADMIN001, CEL PM) não existe e está referenciado em zero registros. A conta técnica do seed `0002` continua sendo o acesso. Daí 235 militares, e não 236. |
| 22 | Enquadramento estatutário sem analogia RDPM | **Entra quando a analogia existe, fica de fora quando não existe.** O legado tinha duas fontes: o jsonb `transgressoes_ids` dos PADS, que **traz a analogia** (11 vínculos, importados), e a tabela `pm_envolvido_art29`, que nunca a teve (3 vínculos, SR 2 e SR 5). `analogia_transgressao_id` é NOT NULL (decisão 5) e escolher o inciso análogo é classificação jurídica, não trabalho de script — os 3 ficam listados como pendência na conferência. |
| 23 | `prazo_base_dias` de cada apuratório | **Derivado do praticado:** IPM 40, SR 30, PADS 30, SV 15 — cada um unânime nos prazos iniciais registrados. As 6 espécies sem prazo no legado ficam com 30. O Feito Preliminar carrega 15 no *documento iniciador*, que é onde a regra sempre morou. |
| 24 | Os 4 catálogos órfãos do legado (`locais_origem`, `naturezas`, `tipos_processo`, `status_processo`) | **Só as unidades entram.** Nenhum dos quatro é referenciado por dado real — são seed de demonstração do app antigo. As 5 unidades de `locais_origem` (1ºBPM, 2ºBPM, BOPE, ROTAM, CG) entram como **opção disponível**, por serem unidades reais da PMRO; CORREGEDORIA fica de fora por ser a mesma que CORREGEPOM. Naturezas e espécies não entram: seguem outro estilo e nenhuma é da Seção. |
| 30 | As "Subdivisões de textos normativos" (Títulos e Capítulos de uma norma) | **Removidas.** Levantado antes de tirar: 0 linhas na tabela, 0 no legado, as 26 infrações penais com `subdivisao_id` nulo, nenhuma consulta projetando a coluna, nada semeado e nada escrito pela importação. Veio do app anterior, onde também nunca chegou a ser ligada aos artigos. O princípio 6 protege catálogo **em uso**; este nunca esteve. |
| 29 | O dispositivo legal no cadastro de infração do Estatuto | **Sai da tela, fica no banco.** Uma infração do Estatuto é, por definição, do Estatuto — as 20 apontam para o mesmo dispositivo, e o select só podia ter uma resposta. A coluna continua, porque é ela que monta o rótulo completo em quatro consultas; quem a preenche é o novo atributo `dispositivos_legais.e_estatuto_militar`, no padrão de `e_responsavel`. Nunca por comparação de nome. |
| 28 | Município × distrito | **`tipo` (texto livre) virou `e_distrito` (booleano)**, com CHECK: distrito exige o município a que pertence, município não pode ter pai. Era o último lugar do schema em que a natureza de um registro dependia de string digitada, e a regra só existiria no formulário. Os 112 registros já a satisfaziam — 60 distritos todos com pai, 52 municípios nenhum. |
| 27 | A ordem hierárquica dos postos | **Removida**, por decisão do responsável, de olho na consequência: a relação de militares passa a sair em ordem **alfabética de nome**, e não mais de CEL para SD. Ordenava em `users::list_paginated`, `users::list_encarregados` e na listagem do próprio catálogo. `circulo_hierarquico_id` fica — agrupa Oficiais e Praças, e isso não é ordenação. Reverter exige migration nova **e redigitar os 13 valores**: o dado se perde, não só a coluna. |
| 26 | O recorte do legado (`tests/fixtures/legado_amostra.sql`) traz os 236 militares com nome real. Versiona? | **Sim, como está.** O repositório é interno da Seção e o risco foi avaliado e aceito. Não é o mesmo caso do `adm-p6.sql`, que fica fora do git por ser o **dump inteiro** — 44 MB com oito anos de fato disciplinar. O recorte é 158 KB, sem senha, sem CPF, e sem ele os 3 testes de importação não rodariam em clone nenhum: a rede de proteção da seção 6 deixaria de existir fora desta máquina. |
| 31 | Quais campos do formulário cada apuratório usa | **Atributo por apuratório, não sigla no código.** `permite_julgamento` e `permite_punicao` em CD, CJ, PAD, PADE e PADS; `permite_remessa_comissao` em CD, PAD e CJ. O dado do legado confirma: `data_julgamento` só aparece em CD, PAD e PADS, e em zero procedimento. A carga inicial da 0007 é por sigla — carga única de valor administrável, como `prazo_base_dias` (decisão 23); o que o princípio 2 proíbe é o **código** decidir por nome em tempo de execução. |
| 32 | O escrivão do IPM e o escrivão de PAD/CD/CJ são o mesmo papel? | **Não, e voltaram a ser dois.** O legado já os separava em `escrivao_id` e `escrivao_processo_id`; a importação mapeou os dois para um só 'Escrivão' (`01_catalogos.sql`, `map_papeis`) — simplificação de script, não decisão de domínio. A 0007 recria "Escrivão de Processo" e migra as 4 designações de CD/CJ/PAD, deixando as 24 do IPM onde estavam. O corte é limpo no dump: nenhum processo usou as duas colunas. |
| 33 | Listar todos os documentos iniciadores, independentemente do apuratório | **Não.** A FK composta `(apuratorio_id, documento_iniciador_id)` exige que o par esteja cadastrado, e hoje cada apuratório tem um só habilitado — oferecer os três faria o salvamento falhar com erro de FK. Quem precisar de outro documento o habilita em *Catálogos → Configuração de apuratórios*, que é onde essa decisão mora. |
| 34 | O usuário informa dias ou o novo vencimento ao prorrogar? | **O novo vencimento.** `dias` continua persistido porque alimenta a coluna gerada, mas é derivado no backend: `nova_data_vencimento - vencimento_atual`. A tela não faz essa aritmética. |
| 35 | Alterar o Recebimento deve alterar o prazo inicial? | **Sim, enquanto não houver prorrogação.** `data_recebimento` e `processo_prazos.ordem = 0` representam o mesmo fato: criar, mudar ou limpar um sincroniza o outro. Depois da primeira prorrogação, a cadeia vira histórico e o Recebimento não pode mais mudar nem ser removido. |
| 36 | Qual prorrogação pode ser corrigida? | **Somente a última.** Editar uma antiga reescreveria `data_inicio`/`dias` das posteriores. A última pode ser antecipada ou postergada, mas o novo vencimento deve continuar estritamente depois do prazo precedente. Só a data muda; motivo e autorização são preservados. |
| 37 | Qual prorrogação pode ser excluída? | **Somente a última, por exclusão física auditada.** Para chegar a uma antiga, excluem-se as mais recentes de trás para frente. A maior `ordem` restante volta a ser vigente automaticamente; prazo inicial nunca é excluído por esse fluxo. |
| 38 | Que erro de banco pode chegar à tela? | **Nenhum detalhe técnico.** Unicidades conhecidas têm mensagens específicas; todo erro SQL desconhecido recebe fallback seguro e é logado no backend. Regras previsíveis devem ser validadas antes da escrita para retornar mensagem de domínio, como no bloqueio do Recebimento após prorrogação. |
| 39 | Enquadramento de processo é indício ou acusação? | **Acusação.** PADS, CD, CJ e PAD recebem uma ou mais acusações no cadastro, vinculadas ao único PM acusado; PADS aceita apenas RDPM e Estatuto com analogia, e CD/CJ/PAD também aceitam crime ou contravenção com esfera penal. Indícios e solução sugerida pertencem somente aos procedimentos. PADE não usa nenhum dos dois fluxos. Quatro atributos independentes em `apuratorios` dirigem a tela e o backend; registros legados sem acusação continuam editáveis, mas processo novo não nasce sem acusado e enquadramento. |
| 39 | Como uma substituição sabe qual designação ela sucedeu? | **Coluna com autorreferência, não inferência.** `processo_designacoes.designacao_anterior_id` aponta para a designação encerrada, com `UNIQUE` (uma antecessora, uma sucessora), `ON DELETE RESTRICT` e trigger de contiguidade. Antes o par se adivinhava por `data_fim = data_inicio` dentro do mesmo `(processo, papel)` — e a adivinhação é ambígua justamente onde o papel aceita dois ocupantes. É o princípio 3 outra vez: relação conhecida do domínio é FK. |
| 40 | O que é "a última substituição"? | **A ponta de cada CADEIA, não do processo nem do papel.** É a designação vigente que tem antecessora: nada a sucedeu, senão teria `data_fim`. Com `max_ocupantes = 2` (a configuração de Escrivão prevê), duas cadeias correm em paralelo sob a mesma função, e corrigir a troca de um escrivão não pode depender da troca do outro. Coincide com "por função" sempre que o teto é 1. |
| 41 | Qual substituição pode ser corrigida ou desfeita? | **Somente a última da cadeia.** Corrigir move sucessor, data, motivo e documento — a data move as DUAS linhas, porque é uma só: o fim da antecessora e o início da sucessora. Desfazer exclui a sucessora e reabre a antecessora (`data_fim = NULL`), e então a substituição anterior vira a última. A função nunca muda: trocar de papel não é corrigir uma substituição. |
| 42 | Quem preenche data, documento e motivo da designação inicial? | **Ninguém — são derivados do cabeçalho.** Início = data de instauração; documento autorizador e número = o documento que instaurou o processo; motivo = "Designação inicial". O formulário pede só função e militar. Corrigir a instauração move junto o início de quem ainda não tem histórico, como `sync_initial` faz com o prazo. Documento e motivo próprios existem na SUBSTITUIÇÃO, que é onde o usuário de fato os informa. |
| 43 | O cadastro do processo pode alterar qualquer designação? | **Só a que não tem histórico.** `data_fim` preenchida ou `designacao_anterior_id` preenchido tiram a linha do alcance do formulário — alterar reescreveria fato registrado (princípio 5). A designação inicial intocada, essa sim, é editável e removível, agora sincronizada pelo `id`. A recusa é do backend, não da tela. |
| 44 | O que um processo concluído ainda pode receber? | **Nenhum novo fato operacional.** Nova substituição, prorrogação e andamento exigem `data_conclusao IS NULL`; a mensagem orienta reabrir. A checagem trava a linha do processo no backend, então vale também para IPC direto e para duas janelas concorrentes. Correções de registros históricos continuam separadas da inclusão. |
| 45 | Toda designação cita documento? | **Não.** A relação `apuratorio_papeis.usa_documento_designacao` decide. No IPM, o Escrivão tem a flag desligada: documento e número não são gravados nem pedidos, e a tabela mostra “-”. A retroalimentação por nomes acontece uma vez na migration; o código lê apenas o booleano. E, como todo conceito de negócio, é **cadastro administrável**: a flag é uma coluna da tabela de papéis em Catálogos → Apuratórios, com alternância própria — outra espécie que dispense a citação não precisa de migration nova. |
| 46 | Quem registra Ofendido/Vítima, e onde ele mora | **Todo procedimento — CP, FP, IPM, SR e SV —, e em tabela própria.** Três escolhas numa. (a) **Vítima deixa de ser papel de pessoa.** Era uma linha de `papeis_pessoa` escolhida num `<select>`; virou `processo_vitimas`, relação do procedimento como `processo_envolvidos` (princípio 3). O motivo é concreto: `papeis_pessoa` é catálogo **operacional** e nasce vazio, então uma seção que dependesse dele sumiria numa instalação nova — a forma exata do defeito da carta precatória (a seção 12, rodada 10). Sem catálogo no caminho, não há o que cadastrar nem o que renomear. (b) **Quem decide é `apuratorios.permite_cadastro_vitima`**, ligado pela `0012` em todo apuratório cujo tipo é `procedimento`; os cinco processos disciplinares ficam de fora, porque são instaurados **contra** um militar, e não para apurar um fato. Carga única, como `permite_indicios` (decisão 31). (c) **O atributo NÃO entra no registro de Catálogos** — desvio deliberado da seção 5, por decisão do responsável: registrar ofendido é capacidade da espécie, não escolha de administrador. Fica no mesmo caso de `codigo_extensao`. É opcional (zero, um ou vários), e o bloco genérico do formulário virou **"Pessoas inquiridas"**. |
| 47 | Qual é a ordem das datas do fluxo? | **Instauração ≤ Recebimento ≤ Remessa ≤ Julgamento ≤ Conclusão**, comparando somente as etapas preenchidas. Datas iguais são válidas; uma etapa ausente não torna as posteriores obrigatórias. `data_remessa_encarregado` e `data_remessa_comissao` são alternativas na mesma posição e não se comparam entre si. A aplicação devolve a incompatibilidade por nome e data, e a migration `0013` repete a regra no banco. |
| 48 | Como identificar a origem abaixo da Unidade PM? | **Subunidade/Seção opcional, sempre vinculada a uma Unidade PM.** É catálogo operacional `subunidades_secoes`, nasce vazio e pode repetir o nome em unidades diferentes. Quando informada, precisa pertencer à unidade escolhida e entra no escopo das duas unicidades de numeração. Assim `SR nº 1/2026/7ºBPM` e `SR nº 1/2026/7ºBPM/1ªCIA` coexistem; dois registros sem subunidade ou dois com a mesma subunidade colidem. A origem composta aparece em listagens, mapas, prazos e CSV, sem reescrever snapshots de mapas já salvos. |
| 49 | Como é emitido o PDF detalhado do mapa mensal? | **A partir do mapa corrente, pela impressão do sistema, sem crate de PDF.** Pode emitir todas as fichas do filtro ou somente uma; nos dois casos o backend reaplica mês e apuratórios antes de aceitar o processo. Há uma capa institucional por espécie de apuratório, com mês/ano e unidade fixa 7ºBPM. Depois dela, as fichas seguem em A4 paisagem e aproveitam a mesma folha: cabeçalho e marcador de fim delimitam cada registro, e páginas atravessadas recebem “Continuação do …”. A ficha reúne o detalhe cadastral, envolvidos, enquadramentos agrupados por natureza/esfera, resultados, vítimas, inquiridos, designações, prazos/prorrogações, andamentos e metadados dos anexos; o conteúdo binário dos anexos não entra. “Remessa da comissão” mostra “Não se aplica” conforme o atributo semântico do apuratório, nunca pela sigla. Mapas salvos continuam snapshots e ficam fora desta primeira versão. A **paisagem não vem do CSS**: o WebKitGTK ignora `@page { size }`, e quem a define é o `GtkPageSetup` de `print_landscape`, comando que abre o diálogo já orientado e só retorna quando a impressão termina. Ver a armadilha do `@page` na seção 7. |
| 50 | Como o PDF do mapa apresenta enquadramentos e indícios? | **Um bloco por natureza, citação com o artigo na frente, e a descrição uma única vez.** Os blocos penais saem por espécie+esfera ("Indícios de Crime Militar", "Indícios de Crime Comum"), e transgressão do RDPM e infração do Estatuto ocupam **um só** bloco disciplinar — é a mesma matéria —, com a transgressão análoga recuada em itálico sob a infração do Estatuto. A citação segue a ordem em que se cita uma norma: `Art. 312 do Código Penal Militar - …`, com o conector vindo de `dispositivos_legais.nome_feminino` (atributo semântico, nunca leitura do nome). O `rotulo` montado em `evidence/repository.rs` **já termina na descrição**; quem exibe não concatena de novo. As categorias de indício só entram quando acrescentam: as de `indica_ausencia` sempre, as demais apenas quando não há enquadramento nenhum — critério estrutural, sem olhar nome. O Resultado sai em linhas rótulo/valor empilhadas. |
| 51 | Como se registra um envolvido cujo PM ainda não foi identificado? | **`processo_envolvidos.policial_militar_id IS NULL`, e nada mais.** Era um policial fictício de cadastro — "À APURAR", matrícula `100000000` — e isso o punha em lista de opção, em estatística pessoal e em ranking de condutor, como se fosse gente. Três escolhas numa. (a) **O estado mora no vínculo, não numa pessoa inventada nem num booleano ao lado.** `NULL` é a única fonte de verdade (princípio 4); um `a_apurar` gravado ao lado do `policial_militar_id` seriam duas, e elas divergiriam. Os resumos expõem `a_apurar` **derivado**, para a tela não ter de deduzir de campo vazio. (b) **É envolvido de verdade.** Conta no `max_envolvidos`, recebe situação, enquadramento, indício e resultado. O que não pode é ser **condutor** — `ck_envolvido_condutor_identificado` —, porque conduzir é ato de pessoa identificada; e é **no máximo um por processo** (`uq_envolvido_a_apurar`), porque "os PMs a apurar" é um marcador coletivo, não uma fila. (c) **A `0016` converte e desativa, não apaga.** Os vínculos do cadastro artificial viram `NULL` preservando o **id do envolvido**, e o registro fica inativo — catálogo em uso se desativa (princípio 6). |
| 52 | Como um militar é identificado depois, sem perder o que já foi apurado? | **A sincronização de envolvidos passou a ser pelo id do VÍNCULO, não pelo id do PM.** Enquanto a chave era o militar, identificar quem estava "À apurar" apagava a linha e criava outra — e enquadramentos, indícios, resultado, situação e ordem, que penduram em `processo_envolvidos.id`, iam junto pelo `ON DELETE CASCADE`. `EnvolvidoRequest.id` viaja na edição justamente para que a linha sobreviva à troca do PM, nos dois sentidos: identificar quem faltava, e devolver a "À apurar" um militar registrado por engano. Sem `id` — cliente antigo — o repositório ainda casa pelo PM, e o `IS NOT DISTINCT FROM` alcança o `NULL`. |
| 53 | O formulário de processo pede cadastro que não existe. Cadastra ali? | **Sim, para os cadastros operacionais, em modal, sem perder o formulário em andamento.** PM, unidade, subunidade/seção, município, natureza geral do fato, situação do envolvido e papel de pessoa ganharam "+" ao lado do seletor. Ficam **de fora** apuratório, documento iniciador, papel de designação e as classificações jurídicas: dependem de configuração e de relações que uma caixinha não deveria decidir — esses seguem só na tela administrativa própria, e o seletor continua pesquisável. O modal **reusa** o formulário dirigido por metadados de Catálogos e o de militares, então não há segunda cópia das regras de validação; e **não cria conta de acesso**, que continua sendo escolha da tela de usuários. |
| 54 | A listagem de militares não tem como desativar nem excluir ninguém. O que ela ganha? | **Os dois, e são coisas diferentes.** *Desativar* tira o militar das listas de escolha e desliga a conta de acesso junto, sem perder nada — é o caminho normal, e o único que serve para quem tem histórico (princípio 6). *Excluir* apaga a linha do banco e **só conclui para quem não tem vínculo nenhum**: sem conta, sem designação, sem envolvimento e sem prorrogação em que seja autoridade. É o cadastro digitado errado, e nada além disso. As quatro FKs são `ON DELETE RESTRICT` e recusariam sozinhas; o comando confere antes para poder dizer **qual** vínculo segurou, que é o que a mensagem do banco não diz. Militar que já teve conta nunca poderá ser apagado — a conta se desativa e nunca se apaga —, e isso é consequência aceita, não descuido. Na tela, os dois ícones só aparecem para administrador, porque é o que o backend exige. |
| 55 | Os mesmos números aparecem em três telas de relatório. Qual fica com eles? | **Cada indicador tem uma tela dona, e as outras não o redesenham — princípio 4 aplicado à apresentação.** Seis telas viraram quatro. *Painel* fica com os quatro números do acervo, a criticidade dos prazos e os oito vencidos mais antigos: triagem. *Prazos* fica com as duas listagens completas, e **perdeu** o gráfico de criticidade, que era a terceira vez que aqueles três números apareciam na mesma tela. *Estatísticas dos Apuratórios* fica com **todas** as distribuições, agora com escopo — e é mais do que a Visão Geral fazia, porque lá elas vinham sempre do acervo inteiro. *Visão Geral dos Apuratórios* **sai**: era o Painel com dois cartões a mais. *Relatório Anual* continua no menu — e a decisão **59** conta o que aconteceu com ele. |
| 56 | O relatório "encarregados por espécie" é uma tela nova? | **Não: é a tela de Designações com o filtro marcado.** Marcar `IPM` e a função `Encarregado` já responde "quais encarregados estão com IPM", com a quebra por situação. Uma segunda tela seria a mesma consulta com o filtro pré-marcado — exatamente o que a decisão 55 acabou de remover. Os filtros da tela passam a ser cinco, combináveis: ano, espécie de apuratório, função, militar e vínculo. |
| 57 | Como se conta "em andamento" na carga de um militar? | **Em três estados, não um — e há um quarto que não é nenhum deles.** *No prazo* é `data_conclusao IS NULL` com o vencimento do prazo vigente de hoje em diante; *vencido* é o mesmo com o vencimento no passado; *sem prazo definido* é o apuratório em andamento cuja data de recebimento nunca foi informada, e que por isso **não tem linha em `processo_prazos`**. O quarto balde tem coluna própria, exibida só quando alguém está nele: somá-lo a "no prazo" afirmaria um prazo que não existe. Os quatro são exclusivos e somam o total. |
| 58 | A carga de um militar conta a designação que já terminou? | **Conta, por padrão — e a tela oferece o contrário num alternador.** São duas perguntas: "o que ele já tocou" inclui a designação encerrada por substituição, e é o que a matriz sempre respondeu; "o que ele tem hoje na mão" é `data_fim IS NULL`. Fixar uma das duas esconderia a outra, e nenhuma delas é mais legítima. O padrão continua sendo o histórico, para não mudar em silêncio o significado de uma tela que já existia. |
| 59 | O Relatório Anual como "modo" da tela de Estatísticas não se sustentou. O que ele é? | **Um documento, e não um painel — porque a diferença entre os dois não é o filtro, é o gênero.** Fixar o ano deixava duas entradas de menu abrindo a mesma tela, que é o defeito que a decisão 55 existia para corrigir. Estatísticas é tela de **operar**: filtra, alterna gráfico e tabela, compara. O Anual é peça que se imprime, assina e arquiva: capa com brasão, ano e unidade; onze seções numeradas em ordem fixa; **só tabelas**, nenhum alternador e nenhum chip no meio do texto — um relatório em que o leitor precisa clicar para ver o número não é um relatório. E o escopo é **o ano inteiro**, sem recorte por espécie: meio relatório anual não é o relatório anual do 7º BPM. O que as duas telas compartilham é o **dado** — `carregarDadosDoEscopo`, `tabelaContagem`, `tabelaSituacao` e `tabelaEnquadramento` moram em `estatisticas.ts` e servem às duas. Duas cargas separadas divergiriam no primeiro filtro novo, que foi exatamente como a Visão Geral passou a discordar do Painel. |
| 60 | Como se pergunta "quem concluiu por último" em Designações? | **Filtro por balde + ordenação por data, com as datas saindo do conjunto já recortado.** O filtro de situação recorta **o que é contado**, não quem é listado: marcando "vencidos", cada linha traz quantos vencidos aquele militar tem, e a lista vira um ranking de atraso. As duas datas — maior `data_recebimento` e maior `data_conclusao` — são calculadas **depois** do recorte, e é isso que faz a pergunta ter resposta: com as datas do conjunto inteiro, filtrar por "vencido" ainda devolveria a conclusão de um processo que o filtro acabou de excluir. As ordenações são cinco (total, recebimento recente/antigo, conclusão recente/antiga), e **quem não tem a data vai para o fim nas duas direções** — militar que nunca concluiu nada não é "o que concluiu há mais tempo", é o que não concluiu. As duas colunas de data ficam sempre visíveis: ordenar por coluna que não aparece deixa a lista numa ordem que ninguém consegue conferir. |
| 61 | Como os relatórios comuns cabem no PDF sem mexer no Mapa Mensal? | **Sessão de impressão escopada, três perfis e orientação explícita por relatório.** `ligarExportacao` aplica `body.relatorio-pdf-ativo` somente enquanto o diálogo está aberto; `report-print.css` não tem regra de papel fora desse escopo. Tabular, analítico e documento compartilham A4, margens físicas de **15mm na vertical e 12mm na horizontal**, quebra de linha/tabela e ocultação de controles, com exceções locais para a matriz de Designações e o detalhe de Mapa Salvo. Retrato e paisagem vão ao `GtkPageSetup` (`print_portrait`/`print_report_landscape`); o `<style>@page` é fallback de WebView2/Chromium. `print_landscape` permanece exclusivo do Mapa Mensal, que continua em `mapa-pdf.ts`, `html.mapa-pdf-ativo`, margem zero e fluxo próprio. Cabeçalhos estreitos quebram linha mesmo quando o corpo pede `nowrap`; tabelas longas são fragmentadas em blocos, levando o título da seção para dentro do primeiro; tabelas curtas mantêm seção e título indivisíveis. A matriz dinâmica continua na tela e vira `Militar | Apuratório | Quantidade` só no papel, com primeiro bloco menor para dividir a primeira folha com o título. **A validação é executável** (`tools/impressao`): mede folha, margens, conteúdo perdido, linhas partidas, páginas vazias, texto truncado, títulos órfãos e colisões geométricas; `controle-mapa.sh` prova, pixel a pixel, que o PDF mensal não mudou. |
| 62 | Como o gráfico chega ao papel, e quem paga a primeira folha de Designações? | **O gráfico vira imagem na hora de imprimir; o cartão é que desce, não o gráfico que encolhe.** O `<canvas>` não é pintado pelo caminho de impressão do WebKitGTK com o compositing ligado — sai preto chapado, sem erro —, então `congelarGraficosParaImpressao` troca cada gráfico visível pelo PNG dele mesmo (`toBase64Image()`) enquanto o diálogo está aberto, e o desfaz no `finally`. **Trocar é tirar do DOM, não esconder**: `hidden` no canvas não faz nada, porque o Chart.js escreve `display:block` inline ao montar e o projeto não tem regra `[hidden]` global — a primeira versão desta rodada escondeu o canvas e o PDF saiu com o gráfico **em duplicata**, o PNG certo e a faixa preta do canvas ainda ocupando caixa. O preço é **um** afrouxamento de CSP: `img-src 'self' data:`, nas duas políticas. Não abre canal de rede, e `script-src`, `style-src` e `connect-src` ficam como estavam; a alternativa seria imprimir sempre a tabela, o que apagaria do papel o resumo que a tela oferece. Cartão em modo "Tabela" continua imprimindo a tabela: quem está sob `[hidden]` não vai ao papel, e é o mesmo filtro que `prepararGraficosParaImpressao` já usava. **A folha órfã é outro defeito, e tem outra causa**: o cartão é indivisível e mais alto que a folha menos o cabeçalho. Encolher o gráfico até caber encavalaria os rótulos (seção 7), então em Designações o cartão **desce** para o fim do documento — `data-impressao-ao-fim`, mecanismo declarado no markup como `data-nao-imprimir`, e não `if` por tela dentro do helper. A matriz sobe e preenche a folha 1, com o primeiro bloco remedido de 18 para **12**. Painel e Estatísticas têm a mesma geometria e ficaram **deliberadamente de fora** desta rodada. A validação é executável e ficou mais honesta: `imprimir.py` passou a imprimir com compositing quando a fixtura pede, e `conferir.py` reprova folha com preto chapado — sem isso nenhuma asserção via a faixa preta, porque o PDF continua com todas as palavras no lugar. |
| 63 | "Em andamento (todos)" inclui o apuratório sem prazo definido? | **Não. São os dois baldes com prazo — `no_prazo` e `vencidos`.** O recorte existe para acompanhar **prazo**, e o apuratório cujo recebimento nunca foi informado não tem prazo para estar no prazo ou vencido. A consequência foi pesada e aceita: com algum deles no escopo, o filtro devolve **menos** que `total - concluídos`, e é por isso que ela está travada num teste que diz o porquê (`em_andamento_soma_no_prazo_e_vencido_e_deixa_sem_prazo_de_fora`), e não só no código. **`em_andamento` não é um quinto balde**: acrescentá-lo ao `BALDE` quebraria a exclusividade que faz os quatro somarem o total — um apuratório no prazo cairia em `no_prazo` ou em `em_andamento` conforme a ordem dos `WHEN`, e os quatro `FILTER` da consulta passariam a contar errado. A união mora em `repository::baldes_do_filtro`, no filtro, que é o único lugar onde ela é uma **pergunta** e não uma classificação; o predicado deixou de ser igualdade e virou `= ANY($6::text[])`. Valor desconhecido continua devolvendo lista vazia, e não "todas as situações". Os quatro KPIs da tela não mudaram: eles mostram os baldes, e a união é recorte, não indicador (decisão 57). |
| 64 | Como se fixa a ordem em que os apuratórios saem no mapa? | **Coluna `ordem` em `apuratorios`, semeada uma vez pela 0019 — não lista de siglas no código.** O pedido é que SR, IPM e PADS abram o documento quando estiverem no escopo; o resto, tanto faz. A ordem pedida não deriva de nada que já existisse: não é alfabética nem por tipo (PADS é *Processo* e vem no meio dos *Procedimentos*). Uma lista de siglas no `ORDER BY` resolveria hoje e quebraria **em silêncio** no dia em que o administrador renomeasse uma delas — sigla é apresentação (princípio 2). A carga inicial **é** por sigla, e isso é legítimo: mesmo caminho de `prazo_base_dias` (decisão 23) e dos atributos da 0007 (decisão 31); o que o princípio proíbe é o código decidir por nome **em tempo de execução**. `DEFAULT 100` mais o desempate por sigla deixam o resto exatamente como estava. A ordem vale para as **seções do PDF e as linhas da tabela da tela**, porque as duas saem do mesmo `ORDER BY` de `map_rows` (`map_print_data` o reusa) e `renderDocumentoMapa` monta as capas pela primeira ocorrência de cada apuratório — documento e tela passam a concordar. Os **checkboxes do filtro não mudam**: eles vêm do `legal_catalogs_list`, compartilhado com mais cinco telas, e nas de cadastro o primeiro da lista é o que vem pré-selecionado. A coluna entrou no catálogo administrável, então mudar a ordem amanhã é operação, não deploy — e, como `prazo_base_dias`, é campo obrigatório ao criar uma espécie. |
| 25 | Situação do processo (o catálogo `status_processo`, com 7 estados) | **Continua derivada das datas.** Era catálogo órfão: nenhuma coluna do legado o referenciava, e a situação nunca foi gravada em processo nenhum. O modelo novo a deriva do fato registrado — `data_conclusao`, `data_julgamento`, `data_remessa_*`, `prazo_vencimento` —, e assim não existe estado que alguém marque e esqueça de atualizar. |

---


---

## 4. O modelo de dados

### 4.1 As tabelas e o que cada uma resolve

```
                     circulos_hierarquicos
                              │
                     postos_graduacoes
                              │
                     policiais_militares ──── usuarios (0..1)
                       │            │              │
                       │            │              └── auditoria, andamentos, anexos
   ┌───────────────────┘            └──────────────────┐
   ▼                                                   ▼
processo_envolvidos                          processo_designacoes
   │  status, ordem, e_condutor                 papel, data_inicio, data_fim
   │  solucao_sugerida, solucao_decidida        (histórico de substituição)
   │  penalidade_tipo, penalidade_dias
   ├── envolvido_categorias_indicio
   ├── envolvido_transgressoes
   ├── envolvido_infracoes_estatuto  (+ analogia RDPM, NOT NULL)
   └── envolvido_infracoes_penais    (+ esfera penal, escolhida no vínculo)

tipos_apuratorio ──► apuratorios ──┬─► apuratorio_documentos_iniciadores
                                   └─► apuratorio_papeis
                                            │
                            processos_procedimentos  ◄── FK COMPOSTA
                              │  │  │  │  │  │
                              │  │  │  │  │  └── carta_precatoria_detalhes (1:0..1)
                              │  │  │  │  └───── processo_anexos
                              │  │  │  └──────── processo_andamentos
                              │  │  └─────────── processo_pessoas (vítimas / inquiridos)
                              │  └────────────── processo_prazos
                              └───────────────── processo_envolvidos
```

### 4.2 Configurabilidade — 26 catálogos + 2 tabelas de configuração

Os atributos semânticos abaixo são o que substitui o hardcode:

| Catálogo | Atributo semântico | Substitui |
|---|---|---|
| `apuratorios` | `prazo_base_dias`, `max_envolvidos`, `exige_natureza_fato`, `codigo_extensao`, **`permite_julgamento`**, **`permite_punicao`**, **`permite_remessa_comissao`** | `match tipo_detalhe`, `tipo_to_table()`, e o formulário que mostrava os mesmos campos para as dez espécies |
| `apuratorio_documentos_iniciadores` | `prazo_base_dias`, `padrao` | `if documento == "Feito Preliminar" { 15 }` |
| `apuratorio_papeis` | `obrigatorio`, `max_ocupantes`, **`e_responsavel`** | `["PAD","CD","CJ"].contains(...)`, colunas fixas de papel |
| `naturezas_fato` | `exige_condutor` | `natureza.includes('sinistro de trânsito')` |
| `tipos_solucao_decidida` | `permite_penalidade` | `solucao_tipo == "Punido"` |
| `tipos_penalidade` | `usa_quantidade_dias` | `Some("Prisao") \| Some("Detencao")` |
| `categorias_indicio` | `indica_ausencia` | as 4 categorias fixas do Rust |
| `perfis_acesso` | `pode_administrar` | `perfil == "admin"` |
| `dispositivos_legais` | `e_estatuto_militar` | o select de dispositivo no cadastro de infração do Estatuto |
| `municipios_distritos` | `e_distrito` | `tipo` em texto livre, e a regra do município pai no formulário |

**Dois recursos do registro genérico**, acrescentados com a decisão 29 e reusáveis:

| | |
|---|---|
| `TipoColuna::ReferenciaFixa` | coluna que existe no banco e **não** na tela. O `save` a preenche com `(SELECT id FROM <alvo> WHERE <marcador>)` — subconsulta montada do registro, sem parâmetro e sem valor vindo do frontend. É o que permite tirar uma pergunta cuja resposta é sempre a mesma sem deixar uma coluna `NOT NULL` órfã |
| `Coluna.visivel_se` | nomeia a coluna booleana **do mesmo catálogo** que revela o campo. O formulário o esconde enquanto ela estiver desmarcada, tira o `required` junto e grava `null` ao desmarcar. Conveniência de tela: quem garante a regra é o CHECK |

> **`e_responsavel` fica em `apuratorio_papeis`, não em `papeis_processo`** — de propósito:
> o papel que responde pelo apuratório **varia por apuratório** (Encarregado nos
> procedimentos, Presidente em PAD/CD/CJ). Uma flag global não expressaria isso.

**Único código técnico do sistema:** `apuratorios.codigo_extensao` (valor
`'carta_precatoria'`). Existe porque acrescentar uma extensão de formulário é inerentemente
mudança de código. Fica **separado** de `sigla` e `nome`. Constante em
`proceedings/domain.rs::EXTENSAO_CARTA_PRECATORIA` e em `telas/processo.ts`.

### 4.3 Integridade garantida pelo PostgreSQL

- **FK composta** `(apuratorio_id, documento_iniciador_id)` → `apuratorio_documentos_iniciadores`:
  o banco recusa qualquer par que o administrador não tenha cadastrado.
- **Par de FKs compostas** em `processo_designacoes`: uma amarra `apuratorio_id` ao
  apuratório real do processo, outra exige que o papel esteja cadastrado para aquele
  apuratório. Juntas, "escrivão só em IPM" e "PAD/CD/CJ não têm encarregado" passam a ser
  garantidas pelo banco, sem nome nenhum no código.
- **`EXCLUDE USING gist`** em `processo_prazos` (períodos nunca se sobrepõem, intervalo
  fechado `[]`), em `processo_designacoes` (mesma pessoa, mesmo papel, intervalo `[)`) e
  em `processo_envolvidos` (um condutor por processo — era índice parcial até a `0017`,
  e virou `EXCLUDE` porque índice não se adia).
- **`data_vencimento GENERATED ALWAYS AS (data_inicio + dias) STORED`** — a aritmética do
  prazo existe em um único lugar.
- Dois índices únicos **parciais** de numeração, um usando
  `COALESCE(numero_controle, numero_documento)`.
- `ON DELETE` definido **por FK**: `CASCADE` só na extensão de CP e nas 4 associativas de
  envolvido; `RESTRICT` em todo o resto.

**As duas constraint triggers** (`fn_valida_max_envolvidos`, `fn_valida_max_ocupantes`) são
`DEFERRABLE INITIALLY DEFERRED` e existem porque guardam invariantes que dependem de
**valor configurável**. Consequência prática para quem escreve teste: **o erro aparece no
`commit`, não no `insert`.** São as únicas triggers do schema; acrescentar outra exige
justificar por que não cabe em constraint.

**As três unicidades de `processo_envolvidos`** — `uq_envolvido_pm`, `uq_envolvido_ordem`
(`0016`) e `uq_envolvido_condutor` (`0017`) — também são adiadas, por outro motivo: a tela
permite **permutar** esses valores entre linhas, e com constraint imediata a permuta
colide no meio da transação com o estado final válido. Duas consequências, e as duas já
morderam: o erro sai no `commit`, e **`ON CONFLICT` não aceita constraint adiada como
árbitro** — upsert nessa tabela declara `ON CONFLICT (id)`. `tests/migrations.rs` falha se
alguma delas voltar a ser imediata. Só `ck_envolvido_condutor_identificado` e
`uq_envolvido_a_apurar` continuam imediatas: não há permuta que passe por elas.


---

## 5. Receitas — como mexer sem quebrar

### 5.1 Como fazer uma mudança de schema agora

O ciclo mudou depois da importação. O caminho seguro:

```bash
# 1. Escreva a migration nova. Nunca edite uma existente.
#    Comente o PORQUÊ, no tom das outras — é o que 0005 faz em 31 linhas.
$EDITOR src-tauri/migrations/0006_<o_que_muda>.sql

# 2. Os testes rodam em bancos DESCARTÁVEIS: aplicam as migrations do zero,
#    então validam a migration nova sem tocar no banco de produção.
cd src-tauri && cargo test

# 3. Só depois, aplique no banco real.
sqlx migrate run --source migrations

# 4. E confira que a trilha ficou coerente.
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
    -c "SELECT version, description, success FROM _sqlx_migrations ORDER BY version;"
```

**O que os testes cobrem sozinhos**, e por isso vale rodá-los antes de aplicar:
`migrations.rs` confere que as migrations aplicam do zero **e são idempotentes**, que
nenhuma FK ficou sem `ON DELETE`, que JSONB só existe nas 2 colunas justificadas e que o
contrato de 34 colunas de `v_processos_detalhados` continua de pé — quatro módulos leem
dessa view, e uma coluna renomeada quebraria os quatro só em runtime.

**Se a mudança afetar a importação** — renomear uma coluna que `src-tauri/importacao/` usa,
por exemplo — `tests/importacao.rs` falha, porque roda as oito etapas de verdade. É o
objetivo: sem ele, a importação quebraria em silêncio e só se descobriria no dia em que
alguém precisasse rodá-la de novo.

### 5.2 Como acrescentar um catálogo administrável

É a operação mais comum, e é quase toda declarativa. Acrescentar uma linha ao registro
`src-tauri/src/legal_catalogs/domain.rs::CATALOGOS` faz a tela de catálogos aparecer
sozinha — `src/telas/catalogos.ts` é montada inteiramente a partir dele.

1. Migration nova com a tabela (`id`, `nome`, `ativo`, `created_at`, `updated_at`, mais os
   **atributos semânticos** que o comportamento vai consultar) e o índice único
   `(lower(nome))`.
2. Uma entrada em `CATALOGOS`, declarando tabela, colunas e rótulos.
3. Nada no frontend.

**Nunca** faça o comportamento depender do `nome` da linha — é apresentação, e o
administrador pode renomeá-la (o princípio ). Se o código precisa distinguir uma linha das outras,
isso é um **atributo booleano** na tabela: foi assim que `permite_penalidade`,
`usa_quantidade_dias`, `exige_condutor`, `indica_ausencia`, `e_responsavel` e
`pode_administrar` substituíram os literais do sistema antigo (a seção 4).

---

### 5.3 A conferência de tela

**É o que falta para dar a migração por concluída**, e não é automatizável: são as
duas coisas que teste não alcança — a CSP, que só falha dentro do WebView, e o
julgamento de quem conhece o domínio. A lista para marcar é a **seção 11**.

⚠ **Rode o binário de produção, não `tauri dev`.** A `csp` restritiva só vale no
build; em desenvolvimento o Tauri usa a `devCsp`, que afrouxa `style-src` justamente
onde mora o risco:

```bash
npm run tauri build
./src-tauri/target/release/adm-p6-tauri
```

---
### 5.4 Como acrescentar um campo que só alguns apuratórios usam

É a operação que a seção 12, rodada 10 tornou rotina, e o caminho é sempre o mesmo — **nunca** um `if`
sobre a sigla.

1. **Migration nova** com a coluna do dado (se ainda não existir) e o **atributo booleano**
   que decide quem a usa, `NOT NULL DEFAULT false`. Ligue-o nas espécies certas por
   `UPDATE`, e comente que é carga única de valor administrável — senão o próximo leitor
   vai achar que é comportamento por nome (a seção 12, rodada 10).
2. **`legal_catalogs/domain.rs::CATALOGOS`**, entrada `apuratorios`: uma linha
   `booleano("...", "Rótulo", "o que revela")`. A tela de catálogos passa a oferecê-lo
   sozinha (a seção 5).
3. **`apuratorio_config/domain.rs::ApuratorioConfig`** e o `SELECT` de
   `repository.rs::get`: é por aqui que o formulário enxerga o atributo. **Não** deixe a
   tela lê-lo de `legal_catalogs_list` — foi o que matou a carta precatória (a seção 12, rodada 10).
4. **`src/types.ts`**, o mesmo campo na interface.
5. **`src/telas/processo.ts`**: a condição de renderização, e — se o campo puder esconder
   dado já gravado — `textoSePresente` na coleta e a regra "aparece assim mesmo quando há
   valor" (a seção 12, rodada 10).
6. **Teste** em `tests/apuratorio_config.rs`, no molde de
   `configuracao_entrega_os_atributos_de_comportamento`.

### 5.5 Como mexer numa migration de dado com segurança

A `0007` estabeleceu o procedimento, e ele vale para qualquer migration que **altere linhas
existentes** e não só o schema:

```bash
# 1. Ensaiar numa cópia restaurada do backup — nunca direto no banco real.
docker compose exec -T postgres psql -U adm_p6_user -d postgres \
  -c "DROP DATABASE IF EXISTS adm_p6_ensaio;" -c "CREATE DATABASE adm_p6_ensaio;"
docker compose exec -T postgres pg_restore -U adm_p6_user -d adm_p6_ensaio \
  --no-owner --no-acl < ~/backups/adm-p6/adm_p6_db_<data>.dump

# 2. Aplicar a migration sozinha, e CONFERIR o resultado com consultas próprias.
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_ensaio \
  -v ON_ERROR_STOP=1 < src-tauri/migrations/0007_....sql

# 3. Só então: cargo test verde, e o ciclo da seção 5 no banco real.
docker compose exec -T postgres psql -U adm_p6_user -d postgres \
  -c "DROP DATABASE adm_p6_ensaio;"
```

**Duas armadilhas que a `0007` teve de resolver, e que voltarão:**

| | |
|---|---|
| **A fronteira do seed** | Catálogo operacional tem de nascer **vazio** num banco novo, e `tests/migrations.rs` cobra. Migration que insere linha de catálogo precisa ser condicionada a haver o que corrigir (`DO $$ … IF … RETURN`), senão todo banco novo nasce com dado que ninguém pediu |
| **A ordem imposta pelas FKs** | Mexer em `processo_designacoes` exige que o par `(apuratorio_id, papel_id)` já exista em `apuratorio_papeis`. Cadastre o novo, **depois** migre as linhas, **depois** desative o antigo — nunca o contrário |

### 5.6 Como acrescentar uma listagem paginada

O padrão está fechado desde a seção 12, rodada 14. Siga-o e a tela nova sai parecida com as outras seis
sem que você precise decidir nada de estética.

**Primeiro, a pergunta que decide tudo:** isto é uma **listagem de tela** ou uma **lista de
opções**?

| | Listagem de tela | Lista de opções |
|---|---|---|
| O que é | uma tabela que o operador percorre | o que alimenta um `<select>` ou uma busca |
| Pagina? | **sim** | **nunca** |
| Exemplos | Processos, Usuários, Auditoria, Prazos, Mapas Salvos, Catálogos | `users_list_ativos`, `legal_catalogs_list` |

Paginar uma lista de opções trunca o `<select>` **em silêncio**. Foi assim que 35 militares
ficaram invisíveis por toda a migração (a seção 12, rodada 9). Se for lista de opções, pare aqui: comando
próprio, sem `LIMIT`, e um teste que monte mais linhas que qualquer teto imaginável.

#### No Rust

1. **O filtro ganha `page` e `per_page`** (`Option<i64>` nos dois), ou o comando os recebe
   como argumento solto. Não invente um `limit` ao lado: duas formas de recortar a mesma
   lista é ambiguidade — quem quer os N primeiros pede a página 1 com `per_page` N.

2. **O envelope** é `{ items, total, page, per_page }`, com `Serialize`. Copie
   `DeadlineReportResult` (`deadlines/domain.rs`). `page` e `per_page` voltam porque o
   backend corrige o pedido, e a tela precisa saber o que foi servido.

3. **O repositório recebe `Recorte`**, não `limit`/`offset`:

   ```rust
   use crate::db::paginacao::Recorte;

   pub async fn listar(pool: &PgPool, recorte: Recorte, /* filtros */)
       -> Result<MinhaListaResult, sqlx::Error>
   {
       let total: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM x {FILTRO}"))
           /* .bind dos filtros, na mesma ordem */
           .fetch_one(pool).await?;

       let items = sqlx::query_as::<_, MeuItem>(&format!(
           "SELECT … FROM x {FILTRO} ORDER BY campo, id LIMIT $n OFFSET $n+1"
       ))
       /* .bind dos filtros */
       .bind(recorte.per_page)
       .bind(recorte.offset)
       .fetch_all(pool).await?;

       Ok(MinhaListaResult { items, total, page: recorte.page, per_page: recorte.per_page })
   }
   ```

   ⚠ **A contagem e a página têm de compartilhar o `WHERE`.** Extraia-o para uma `const
   &str` e interpole nas duas, como `audit::repository::FILTRO_LISTA` e
   `deadlines::repository::FILTRO_REPORT`. Se divergirem, o rodapé conta um escopo que a
   tabela não mostra e **o número fica errado sem ninguém perceber**.

   ⚠ **O `ORDER BY` precisa de desempate** (`, id`). Sem ele, duas linhas com o mesmo valor
   de ordenação trocam de lugar entre uma consulta e outra, e a linha da fronteira aparece
   duas vezes ou nenhuma.

4. **O comando** chama `Recorte::novo(page, per_page)`. Sem `unwrap_or` próprio: o padrão
   (10) e o teto (200) são do `Recorte`.

5. **Registre em `lib.rs::registrar_comandos`** — é a lista única do app e do teste.

6. Se o SQL virou `format!`, **acrescente a função em `COBERTURA`**, em
   `tests/sql_prepare.rs`, e escreva um teste que a execute. O teste
   `toda_consulta_dinamica_e_exercitada_por_algum_teste` cobra os dois lados.

#### No TypeScript

7. **`types.ts`** ganha o envelope, e **`api.ts`** o contrato. Atenção à armadilha dupla:
   o argumento do comando é **camelCase** (`perPage`), mas dentro de `{ filter: {...} }` os
   campos são **snake_case** (`per_page`) — ali quem desserializa é o serde.

8. **A tela** declara as colunas e desenha:

   ```ts
   const COLUNAS: Coluna[] = [
     { rotulo: "Nome", largura: 40, truncar: true },
     { rotulo: "Situação", largura: 12, alinhamento: "centro", nowrap: true },
   ];                                   // as larguras têm de somar 100

   const resposta = await call("meu_comando", { page: pagina, perPage: ITENS_POR_PAGINA });
   const itens = resposta.data?.items ?? [];
   const total = resposta.data?.total ?? 0;

   const corrigida = paginaValida(pagina, ITENS_POR_PAGINA, total);
   if (corrigida !== pagina) { pagina = corrigida; return renderMinhaTela(ctx); }

   ctx.shell(`… ${tabela(COLUNAS, linhas, "Nada aqui.")}
              ${paginacao("minha-chave", pagina, ITENS_POR_PAGINA, total)}`);

   ligarPaginacao("minha-chave", pagina, (nova) => { pagina = nova; void renderMinhaTela(ctx); });
   ```

9. **Filtro e busca voltam para a página 1**; excluir e desativar **mantêm** a página (o
   `paginaValida` recua sozinho se ela tiver deixado de existir). A diferença está escrita
   em `telas/catalogos.ts`, nas funções `filtrar()` e `recarregar()`.

10. **Clique numa linha casa por `id`, nunca por índice.** `Linha` tem campo `id`, que sai
    como `data-linha`; a tela lê `linha.dataset.linha`. Por posição, qualquer recorte abre
    o registro errado — e uma linha de auditoria parece com a outra.

11. **Se a tela exporta**, o CSV e a impressão levam o **filtro inteiro**, não a página:

    ```ts
    const todosDoFiltro = () => carregarTudo<MeuItem>(async (page, perPage) =>
      (await call("meu_comando", { page, perPage, ...filtros })).data ?? null);

    ligarExportacao(
      async () => { const { itens, cortado } = await todosDoFiltro();
                    avisarSeCortado(cortado); return baixarCsv(nome, COLUNAS_CSV, itens.map(…)); },
      async () => { const { itens, cortado } = await todosDoFiltro();
                    avisarSeCortado(cortado); return tabela(COLUNAS_IMPRESSAO, itens.map(…)); },
      { orientacao: "paisagem", perfil: "tabular", seletorSubstituido: "#resultado-paginado" },
    );
    ```

    O `seletorSubstituido` aponta para um wrapper que inclui **tabela,
    paginação e títulos próprios do recorte**. O helper põe o bloco completo no
    mesmo lugar e esconde só esse wrapper; nunca procura toda `.table-wrap` da tela.

    ⚠ **A coluna de ações sai do bloco de impressão.** A regra de impressão esconde
    `.row-actions`, e numa tabela de layout fixo isso colapsa a célula: o corpo fica com uma
    coluna a menos que o cabeçalho e a linha inteira desalinha. Ver `COLUNAS_IMPRESSAO` em
    `telas/usuarios.ts`.

#### Os testes que a listagem nova precisa

Copie o feitio de `deadlines_repository::report_pagina_e_ordena`:

- o **total é do escopo filtrado**, não da página;
- duas páginas consecutivas **não repetem** linha (`assert!` sobre os ids);
- página além do fim é **vazia, não erro**;
- a ordenação é **estável** entre páginas;
- **monte mais linhas que o teto que está exercitando.** A fixture tem 3 militares e 1
  processo: um teste de limite sobre ela nunca alcança o clamp e passa sem provar nada. Os
  três testes de paginação da seção 12, rodada 14 inserem 205 para exercitar o teto de 200.

E um teste em `commands_ipc.rs` para o comando novo, que é onde a convenção camelCase ×
snake_case falha — e falha calada.


---

## 6. Importação e backup

### 6.1 Backup — e por que gerar não basta

O banco vive num **único volume Docker**, e até esta rodada não havia cópia nenhuma. A
regra "nunca `docker compose down -v`" é disciplina, não backup: não protege de disco
morto, de `DROP` errado, nem de uma migration que dê errado no meio.

```bash
mkdir -p ~/backups/adm-p6
DATA=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U adm_p6_user -d adm_p6_db --format=custom \
  > ~/backups/adm-p6/adm_p6_db_${DATA}.dump      # ~46 MB, o schema `legado` incluído
```

**Fora do repositório de propósito:** tem dado pessoal de 235 militares, pela mesma razão
que `adm-p6.sql` está no `.gitignore`.

**Um dump nunca restaurado não é backup.** Verificar custa um minuto:

```bash
docker compose exec -T postgres psql -U adm_p6_user -d postgres -q \
  -c "DROP DATABASE IF EXISTS adm_p6_backup_teste;" -c "CREATE DATABASE adm_p6_backup_teste;"
docker compose exec -T postgres pg_restore -U adm_p6_user -d adm_p6_backup_teste \
  --no-owner --no-acl < ~/backups/adm-p6/adm_p6_db_<data>.dump

# As contagens dos dois lados têm de bater — e o anexo de 20 MB, casar no md5.
for DB in adm_p6_db adm_p6_backup_teste; do
  docker compose exec -T postgres psql -U adm_p6_user -d $DB -t -A -c \
    "select count(*) from processos_procedimentos;
     select md5(conteudo::text) from processo_anexos;"
done

docker compose exec -T postgres psql -U adm_p6_user -d postgres -c "DROP DATABASE adm_p6_backup_teste;"
```

Feito assim antes de tocar no schema `legado`: 8 contagens iguais e o md5 do anexo
idêntico.

---


---

### 6.2 O roteiro da importação, do zero

**Um comando.** O roteiro manual que ficava aqui virou
`scripts/migrar_dados_legados.sh`, porque cada passo dele tinha uma forma
silenciosa de dar errado — e três deram, na rodada de 03/09/2026.

```bash
./scripts/migrar_dados_legados.sh                        # ensaio, o padrão
./scripts/migrar_dados_legados.sh --execute --destino adm_p6_db
```

O ensaio restaura uma cópia descartável do destino, roda a migração inteira nela
e emite o mesmo relatório. O banco real não é tocado. Documentação completa,
incluindo rollback e leitura dos relatórios: `src-tauri/importacao/README.md`.

#### O que o script faz que o roteiro manual não fazia

| | |
|---|---|
| Backup validado antes de mutar | `pg_dump -Fc` conferido com `pg_restore -l`. Backup que não abre não é backup |
| Uma transação para a carga inteira | as etapas deixaram de abrir `BEGIN`/`COMMIT` próprios — ver a armadilha na seção 7 |
| `SET LOCAL TimeZone` | o legado guarda timestamp sem fuso, digitado em Ariquemes; o container é UTC |
| Preflight | recusa dump antigo, analogia desativada, destino desconhecido e processo inesperado |
| Marcador de idempotência | linha de `auditoria` com o SHA-256 do dump; reexecutar não recarrega |
| Conferência com invariantes | 38 contagens e 51 comparações semânticas contra o próprio `legado` |
| Relatório de pendências | CSV nominal do que uma pessoa precisa resolver na tela |

#### O schema `legado` não sai mais no fim

O passo 8 do roteiro antigo (`DROP SCHEMA legado CASCADE`) foi **abandonado**.
Metade das invariantes da conferência compara o destino contra o `legado`, e
duas listas de pendência — o prazo reconstruído e o elo de substituição perdido —
só são deriváveis enquanto ele existir. Um dump anterior já carregado é
renomeado para `legado_anterior_<carimbo>`, nunca descartado.

#### Como se soube que deu certo


---

## 7. Armadilhas conhecidas

Coisas que já custaram tempo e vão custar de novo se esquecidas.

| Armadilha | O que acontece | Como evitar |
|---|---|---|
| Argumento de comando em snake_case | O Tauri v2 espera **camelCase** nos argumentos do comando. Falha em runtime, sem erro de build | Use `call()` de `api.ts`; ele codifica a convenção. Dentro de `{ request: {...} }` os campos seguem snake_case |
| Constraint trigger `DEFERRABLE` | `max_envolvidos`, `max_ocupantes` e `tg_cadeia_designacao` **só falham no `commit`** | Em teste, sempre dar `tx.commit()` e verificar o erro ali. E validar antes, no repositório, para o usuário ler a regra e não o fallback |
| Mandar `null` num campo que o formulário não desenha | Com sincronização por `id`, `null` deixa de ser "não informado" e vira **UPDATE que apaga**. Foi o que quase apagou a portaria da designação inicial | Ou o campo existe no formulário, ou o valor é derivado no backend. Nunca `null` de conveniência — ver decisão 42 |
| Mensagem de erro nova sem acento ou sem o que fazer | O texto vai direto para a tela de quem opera. `"registro nao encontrado"` não diz o que fazer, e `error.rs` tem um teste que recusa termo técnico | Frase em português, começando com maiúscula, terminando em ponto, dizendo qual campo corrigir ou onde a operação acontece |
| Regra nova de designação só no `error.rs` | O mapa de constraints é rede, não primeira linha: ele fala depois do PostgreSQL e sem saber qual linha o usuário errou | Validar no repositório, com as linhas travadas por `FOR UPDATE`; o mapa cobre só o que escapa |
| Fixture colidindo com o seed | A 0003 ocupa os nomes reais dos catálogos legais; índices únicos são case-insensitive | Nomes de fixture carregam "Teste"/"TST" |
| Editar migration já aplicada | `VersionMismatch` no próximo startup | `docker compose down -v && docker compose up -d` |
| Schema aplicado fora do sqlx | Se alguém rodar o `.sql` por `psql`, não existe `_sqlx_migrations` e o startup seguinte tenta recriar tudo | Conferir `select * from _sqlx_migrations;` |
| Trocar a espécie de um processo com designação | Recusado por regra de negócio (as designações são histórico e amarram o apuratório) | É intencional; a mensagem explica |
| `count(*)` ou `GROUP BY` sobre `v_processos_detalhados` | 7× mais lento: o PostgreSQL calcula os três `LATERAL` por linha mesmo sem usá-los | Agregação parte das tabelas base. A view é para buscar linhas |
| Consulta nova com SQL montado em `format!` | `sql_prepare.rs` falha até você escrever um teste que a execute e listá-la | É intencional: aquele SQL só é validado executando |
| Comando novo com `AppHandle` não genérico | Não compila sob o `MockRuntime`, e o teste de IPC quebra | Declare `AppHandle<R>` com `R: Runtime`, como em `files_save_download` |
| Registrar comando fora de `registrar_comandos` | O comando existe no app e não no teste, ou o contrário | A lista é uma só, em `lib.rs::registrar_comandos` |
| `replace` sem `assert` em script de edição | Um `s.replace(a, b)` que não casa é um **no-op silencioso**. Foi assim que a rota de configuração de apuratórios ficou sem botão de menu por três commits | Sempre `assert alvo in s` antes de substituir |
| Filtrar `ativo` na leitura de registro | Um processo antigo perde o catálogo desativado que usava | Filtrar `ativo` só em lista de **opções** |
| Lista de escopo vazia num filtro | `= ANY('{}')` é falso para toda linha: quem não filtra nada não vê nada | `maps_reports::repository::escopo()` normaliza vazio para `NULL`. Use-o em todo filtro novo |
| `<a download>` para entregar arquivo | No WebView não define destino nem abre "salvar como", e muda por plataforma. Sobreviveu no download de anexo até a seção 12, rodada 6, porque nenhum teste chega lá e a tela não acusa | `dom.ts::baixarArquivoBase64` → `files_save_download`, que abre o diálogo nativo no Rust. Vale para **todo** arquivo, não só o CSV |
| **`docker compose down -v` com dado de produção dentro** | Apaga 8 anos de registro. A regra "editou migration, recria o banco" **acabou** | Migration incremental (`0008`…). Se realmente precisar recomeçar, o roteiro completo está na 8.5 |
| Comparar coluna anulável com `=` num `INSERT ... SELECT` | `pm_id = motorista_id` devolve **NULL**, não `false`, quando o motorista é nulo — e a coluna NOT NULL recusa a linha inteira. Custou uma transação da etapa 05 | `IS NOT DISTINCT FROM`, ou `COALESCE(..., false)` |
| `BEGIN;`/`COMMIT;` dentro de arquivo servido por `psql --single-transaction` | O `BEGIN` vira aviso e o `COMMIT` **encerra a transação externa**: tudo depois dele corre em autocommit, e a migração deixa de ser tudo-ou-nada — sem erro nenhum | As etapas de `importacao/` não abrem transação. Quem a abre é `scripts/migrar_dados_legados.sh` |
| Converter `timestamp` do legado sem dizer o fuso | O legado guarda hora INGÊNUA, digitada em Ariquemes. O cast para `timestamptz` usa o fuso da **sessão** — que no container é `Etc/UTC` — e todo o histórico entra 4h adiantado; o que passou das 20h muda de dia | `SET LOCAL TimeZone = 'America/Porto_Velho'` na transação, e a etapa 00 recusa a carga se a sessão estiver errada |
| `ON COMMIT DROP` numa tabela temporária fora de transação explícita | A tabela é criada e destruída no mesmo instante, e a instrução seguinte falha com "relation does not exist" | É sintoma de estar rodando a etapa sem `--single-transaction`. Rode pelo script |
| `pg_restore -l` lendo de um pipe | Falha com `did not find magic string in file header` mesmo com o arquivo perfeito: ele precisa **posicionar** no arquivo | `docker cp` o backup para dentro do container e valide o caminho, nunca por `stdin` |
| Carregar o dump legado sob outro nome de schema | Os 10 arquivos de `importacao/` dizem `legado.` literalmente. Um `legado` preexistente com o dump ANTERIOR faz a carga ler 128 processos em vez de 163, **sem erro nenhum** | O preflight conta os processos da origem e recusa. Um dump antigo é renomeado para `legado_anterior_<carimbo>`, não descartado |
| Casar registro importado por timestamp entre duas conexões | O cast `::timestamptz` de cada lado usa o fuso da sua própria sessão. O comparativo 98 passou a não achar nenhum dos 73 andamentos, e relatou "sumiu" com todos no lugar | Casar por **id**. O andamento tem id no jsonb do legado, e a etapa 07 o preserva |
| `psql -At -F','` para gerar CSV | Não escapa nada: um valor como `Art. 29, IV` vira duas colunas e desalinha o arquivo inteiro | `psql --csv`, que cita o que precisa e escreve o cabeçalho |
| Migration corretiva para consertar dado importado depois | A 0007 (Escrivão de Processo), a 0008 (cadeia de substituição) e a 0016 ("À apurar") corrigiam a carga — e **já foram aplicadas**. Elas não rodam de novo | O dado tem de nascer certo na etapa de importação. Se a correção estava numa migration, ela agora é regra da etapa |
| Executar dump de `pg_dump` pelo protocolo do Postgres | `COPY ... FROM stdin`, `\restrict` e `\.` são sintaxe do **cliente psql**, não SQL: `sqlx::raw_sql` estoura com "syntax error at or near \" | Gerar a fixture com `--inserts` e filtrar as linhas `\restrict`/`\unrestrict` — é o que `gerar_legado_amostra.sh` faz |
| Supor que tirar a coluna do registro apaga o dado | Não apaga, e é o que torna seguro esconder o `codigo_extensao`: o `UPDATE` genérico monta o `SET` **só** com as colunas declaradas, então editar um apuratório pela tela não toca a extensão de carta precatória. O reverso também vale — uma coluna `NOT NULL` fora do registro faz o **INSERT** falhar, porque ninguém a preenche | Coluna obrigatória que não cabe na tela vira `ReferenciaFixa`, que o `save` resolve sozinho (a seção 4) |
| CSP sem `ipc:` em `connect-src` | Não quebra uma tela: quebra os **84 comandos** de uma vez, porque é por aí que o IPC do Tauri v2 passa. E some no console como `Refused to connect` | `connect-src 'self' ipc: http://ipc.localhost`. Se o app abrir mudo logo na primeira tela, é isto |
| **Largura de coluna num `<col style="">`** | É `style` como qualquer outro, e a CSP recusa igual: o `<col>` fica sem largura e a tabela volta a se dimensionar pelo conteúdo, **sem erro de build e sem erro de console que aponte a tabela** | A largura sai em `data-largura` e é aplicada pela CSSOM em `dom.ts::aplicarLarguras`, chamada de `main.ts::shell()` |
| **Duas gerações da mesma regra de CSS no arquivo** | Qual vence deixa de ser a intenção e passa a ser a ordem e a especificidade. `.tabela-dados thead th` mantinha o cabeçalho da listagem branco por ser mais específica que o `th` escrito depois — o efeito era bom, e ninguém sabia que era acidente | Ao mexer em regra que já existe duplicada, **medir o computado antes e depois** num navegador, sobre o CSS compilado. Foi como a seção 12, rodada 14 provou que a listagem de processos não mudou |
| `style=""` no markup, com a CSP ligada | O atributo é recusado e o elemento aparece sem estilo, **sem erro de build**. Só a CSSOM (`elemento.style.width = …`) escapa da diretiva | Larguras calculadas de coluna vão em `data-*` e são aplicadas por `aplicarLarguras()` em `shell()` |
| **`@page` para orientar a folha impressa** | O WebKitGTK — motor do Tauri no **Linux** — ignora o descritor `size` do `@page`. Medido no webkit2gtk-4.1 2.48 com `@page nome { size: A4 landscape }`, `@page { size: A4 landscape }` e `@page { size: 297mm 210mm }`: as três saíram 595×842 pt, **retrato**. A propriedade `page` (página nomeada) também não existe no WebKit, então uma `@page` nomeada nem chega a casar. O documento sai com a geometria errada, sem erro nenhum | A orientação e as margens dos relatórios vêm do `GtkPageSetup`: `print_report_landscape` declara 297×210mm, `print_portrait` declara 210×297mm, ambos com 15×12mm. `print_landscape` conserva margem zero para o Mapa Mensal. O `<style>@page` temporário continua só como fallback para motores que o honram, e a chamada **espera** a impressão terminar |
| **Concatenar a descrição a um `rotulo` de enquadramento** | O `rotulo` de `evidence/repository.rs` **já termina** em `' - ' \|\| descricao`. Quem acrescentar `: ${descricao}` imprime o mesmo parágrafo duas vezes na mesma linha — foi o que o PDF do mapa mensal fez desde que nasceu, e com a transgressão saía pior ainda, repetindo também a gravidade | O rótulo é a citação **completa**. Exiba-o sozinho. `rotulo_cita_o_artigo_antes_da_norma_e_nao_repete_a_descricao` trava as duas metades |
| **Pedir ao GTK que gire a folha para paisagem** | Com `run_dialog`, o WebKitGTK sai com **as páginas em branco**: a contagem de páginas está certa, a folha sai 842×595, e não se pinta nada — nenhum texto no PDF. Não há erro, nem no console nem no `failed`. Com `print()` direto o mesmo page setup funciona, o que torna a armadilha fácil de "validar" errado | Declarar um **papel de 297×210mm** no `GtkPageSetup`, sem pedir rotação: a folha sai igual e o conteúdo aparece. É o que `folha_a4_paisagem` faz, e o comentário dela guarda a medição |
| **Validar impressão em Chromium headless** | Não prova nada sobre o app: o Chromium honra `@page` e páginas nomeadas desde a v110, o WebKitGTK não honra nenhum dos dois. Foi assim que a rodada 20 deu o A4 paisagem por pronto enquanto o PDF saía retrato | Medir no motor que o app usa. `python3` + `gi` (`WebKit2` 4.1) imprime para arquivo, e `pdfinfo` lê `Page size` |
| `csp` sem `devCsp` | Em desenvolvimento o Vite injeta o CSS por `<style>` e abre um WebSocket de HMR; a CSP de produção derruba os dois, e parece que o app quebrou | `devCsp` afrouxa só `style-src` e `connect-src`, e só em dev. Ver a seção 12, rodada 6 |
| Meta-comando de psql em SQL que um teste executa | `\echo`, `\pset` e `\.` são sintaxe do **cliente**, não SQL: `sqlx` estoura com "syntax error at or near \". É por isso que `98_` é uma instrução só e `99_` não roda no `cargo test` | SQL que precisa rodar nos dois lugares não leva barra invertida |
| Supor que um conceito tem **uma** fonte no legado | O enquadramento tinha duas, que nunca se encontraram: `pm_envolvido_*` para procedimentos e o jsonb `transgressoes_ids` para PADS. A segunda tinha 73 vínculos e quase ficou de fora | Antes de dar um conceito por importado, contar **por espécie de apuratório**: um zero redondo numa espécie inteira é sinal de fonte paralela |
| Cruzar `jsonb_array_elements` com cast no `WHERE` | `(item->>'id')::int` estoura nos itens cujo `id` é UUID, mesmo com `WHERE tipo='rdpm'` ao lado: o Postgres não garante a ordem de avaliação | Separar em duas consultas, uma por tipo — foi o que a conferência precisou fazer |
| **Ler comportamento de `legal_catalogs_list`** | Aquele comando projeta só as colunas **declaradas no registro**. Tirar uma do registro (para sumir da tela do administrador) some com ela para **todo mundo que lê por ali** — foi assim que o bloco de carta precatória parou de renderizar, com o backend ainda exigindo os campos | Comportamento que a tela consulta vem de comando próprio. Para o apuratório é `apuratorio_config_get`, que entrega os atributos ao lado dos documentos e papéis |
| **Comando paginado servindo de lista de opções** | `list_paginated` trava `per_page` em 200 e **corta em silêncio**: quem pede 500 recebe 200 sem erro, sem aviso e sem sinal de que faltou. Custou 35 militares invisíveis nos seletores do formulário de processo, por toda a migração | Lista de **opções** não pagina — comando próprio sem `LIMIT` (`users_list_ativos`, `list_encarregados`). Paginação é da **listagem de tela**, e aí precisa de controle de página, senão o resto fica inalcançável do mesmo jeito |
| Teste de paginação que nunca passa do teto | A fixture tem 3 militares, e 3 < 200 para qualquer `per_page`: o teste passa e o clamp nunca é exercido | Teste de limite monta **mais que o limite**. `lista_de_opcoes_de_militar_nao_pagina` insere 250 |
| Select cujo valor atual não está na lista de opções | A lista filtra `ativo`; um registro gravado antes da desativação aponta para quem não está lá, o `<select>` cai no vazio e a edição apaga o vínculo calado | `selectMilitares` acrescenta o valor atual como opção própria quando falta. É a mesma razão de `ProceedingListItem` devolver os ids ao lado dos rótulos |
| Esconder campo lendo o formulário pelo DOM | `FormData.get` devolve `null` tanto para "o usuário apagou" quanto para "o campo nem foi renderizado". Tratar os dois igual **apaga fato já registrado** quando a configuração muda (princípio 5) | `dados.has(campo)` separa os dois. Ver `processo.ts::textoSePresente`; e o campo com valor gravado continua à vista, com nota, em vez de sumir |
| `auto-fit` para alinhar linhas com número diferente de campos | Ele **colapsa** as trilhas vazias, então cada linha ganha a sua própria grade e nada alinha entre linhas | `auto-fill` mantém as trilhas. É a diferença entre os envolvidos alinharem "Situação" na mesma coluna ou não |
| Busca incremental sem carimbo de sequência | Cada tecla dispara uma consulta, e a resposta atrasada de um termo antigo sobrescreve a lista do termo atual | Um contador local: descarte a resposta cuja sequência não é a última. O seletor de analogia já fazia; as três buscas de indícios, não |
| **Constraint adiada como árbitro de `ON CONFLICT`** | O PostgreSQL recusa: `ON CONFLICT does not support deferrable unique constraints/exclusion constraints as arbiters`. E a forma **sem alvo** (`ON CONFLICT DO NOTHING`) considera *todos* os índices da tabela, então basta **uma** constraint adiada para o upsert inteiro parar de funcionar. Adiar `uq_envolvido_pm` na `0016` quebrou a etapa 05 da importação, que nem sabia da mudança — o `cargo check` passa, só `cargo test` acusa | As três unicidades de `processo_envolvidos` são adiadas de propósito (decisões 51 e 52). Upsert nessa tabela declara árbitro **não adiável**: `ON CONFLICT (id)`. Um teste em `tests/migrations.rs` falha se alguma delas voltar a ser imediata |
| **Trocar um valor único entre duas linhas com constraint imediata** | A colisão acontece **no meio** da transação, com o estado final perfeitamente válido — e a mensagem descreve a regra certa para a situação errada. Mudar o condutor de envolvido lia "Só pode haver um condutor por processo." com exatamente um condutor na tela, porque o de cima era marcado antes de o de baixo ser desmarcado | Unicidade que a tela permite *permutar* é `DEFERRABLE INITIALLY DEFERRED`, conferida no `commit`. Índice parcial não se adia: vire uma constraint `EXCLUDE`, como a `0017` fez com `uq_envolvido_condutor` |
| **Sincronizar coleção pelo id da entidade referida** | `DELETE … WHERE NOT (fk = ANY(...))` seguido de upsert pela FK: trocar o valor da FK deixa de ser correção e vira **apagar e recriar**, e tudo o que pendura na linha por `ON DELETE CASCADE` some junto. Identificar um envolvido "À apurar" levava com ele enquadramentos, indícios, resultado, situação e ordem | Sincronize pelo **id da própria linha**, que a edição devolve no request (`EnvolvidoRequest.id`). E ordene as escritas: identificados antes dos nulos, senão a transição simultânea nos dois sentidos colide no índice parcial de `À apurar` |
| **`<select>` enfeitado que deixa de alimentar o `FormData`** | Trocar o `<select>` por uma lista de `<div>` derruba de uma vez o `FormData`, o `required` nativo, a validação amigável e as regras que leem `select.value` — e nada disso acusa em build | O Tom Select **mantém** o `<select>` original no DOM e o mantém sincronizado; ele só o esconde com `.ts-hidden-accessible` (clip, não `display:none`), que é o que preserva `required` — um controle obrigatório com `display:none` faz o navegador **recusar o submit em silêncio**, porque não consegue focá-lo |
| Redesenhar o formulário sem destruir os selects pesquisáveis | O `innerHTML` novo descarta os `<select>` originais, mas os `TomSelect` ficam com listeners e estado presos ao DOM antigo. Vaza a cada rerender, e o formulário de processo redesenha a cada troca de apuratório, natureza, unidade ou envolvido | `dom.ts::destruirSelectsPesquisaveis` antes de todo redraw — já chamada de `main.ts::shell()` e do topo de `renderFormularioProcesso`. `destroy()` **restaura as opções originais**, então absorva o formulário para o rascunho *antes* de destruir |
| Gravar em `auditoria.operacao` um verbo fora de `CREATE`/`UPDATE`/`DELETE` | `ck_auditoria_operacao` recusa, e como o `INSERT` da trilha corre na MESMA transação da operação auditada, **as duas caem juntas**. `apuratorio_config_deactivate_*` gravava `DEACTIVATE` e por isso nunca conseguiu desativar nada — latente desde a `0001`, e o repositório tinha teste, o comando não | Desativação é `ativo = false`, ou seja `UPDATE`; quem diz que foi desativação é a `acao`. Comando que escreve no banco precisa de teste no **comando**, não só no repositório |
| Registrar auditoria de exclusão física depois do `DELETE` | O `assunto` sai de uma junção com a linha que acabou de sumir, e a trilha guarda um UUID que não aponta para nada. Foi o que deixou 7 dos 8 prazos da trilha antiga sem identificação | Ler o assunto **antes** da exclusão, na mesma transação — é o que `audit/assunto.rs` documenta e o que `legal_catalogs_delete` e `proceedings_remove_attachment` fazem |
| Envolver num `<label>` em coluna um campo que já tem `flex` declarado | `flex-basis` é do **eixo principal**. `.filtros input[type="search"]` declara `flex: 1 1 260px` contando com o `.filtros` em linha; pôr o input dentro de um `<label>` `flex-direction: column` faz aqueles 260px deixarem de ser largura e virarem **altura**. A barra de pesquisa dos apuratórios foi para 340px de altura contra os 89px das outras listagens, e nada acusa | Campo de filtro é filho **direto** de `.filtros`, como em Catálogos e Usuários. Precisando de rótulo visível, declare a altura do campo em vez de herdar o `flex` de outra regra — e meça o computado, que é como isto apareceu |
| Limpar um `<select>` pesquisável por `select.value = ""` | O `<select>` original zera, mas o controle visível continua exibindo o rótulo escolhido: quem desenha é a instância do Tom Select, e ela não observa a propriedade. O usuário vê um filtro que jurou ter limpado | `select.tomselect?.clear(true)` quando houver instância, e `select.value = ""` só no `<select>` cru. Ver o botão *Limpar filtros* em `processo.ts::abrirFiltrosAvancados` |
| Empacotar biblioteca de frontend por CDN | A CSP é `default-src 'self'`: o script nem carrega, e a tela quebra só no build de produção | Dependência entra pelo `package.json` e é empacotada pelo Vite. E confira que ela não escreve `style=""` nem `setAttribute('style', …)` — `elemento.style.x = …` e `style.cssText` passam pela CSSOM e escapam da diretiva; markup com `style` não |
| Carregar dump de `pg_dump` e continuar usando a conexão | Ele emite `SELECT pg_catalog.set_config('search_path', '', false)`, e daí em diante nem `public` é enxergado — o erro que aparece é "relation ... does not exist" | `SET search_path = public;` logo depois de carregar |
| Redesenhar **parte** de uma listagem sem rechamar `aplicarLarguras` | As larguras declaradas em `Coluna.largura` saem em `data-largura` e são aplicadas pela CSSOM em `aplicarLarguras`, que só `main.ts::shell()` chama. A pesquisa instantânea troca o `innerHTML` da área de resultados sem passar pelo `shell()` — e a tabela volta a se dimensionar pelo conteúdo **sem erro nenhum**, num redesenho que acontece a cada tecla | `aplicarLarguras(area)` logo depois de escrever o `innerHTML`, como em `usuarios.ts::atualizarListaUsuarios` e `catalogos.ts::atualizarListaCatalogo`. A listagem de apuratórios não sofre disso porque o `<colgroup>` dela é de classes de CSS, não de `data-largura` |
| Debounce sem atualizar o estado a cada tecla | Se o termo só entrar na variável do módulo **depois** dos 250 ms, quem exporta o CSV ou aplica o modal de filtros dentro dessa janela leva o termo **anterior** — os dois leem a variável no clique, não o campo | `dom.ts::ligarBuscaInstantanea` separa as duas coisas: `aoDigitar` corre a cada tecla e é onde o estado se atualiza; só o redesenho espera |
| **Redimensionar o gráfico em vez da caixa** | `chart.resize(largura, altura)` muda o **bitmap** do canvas. Como `.analytics-chart canvas` fixa `width`/`height` em `100% !important` — é isso que faz o canvas seguir a caixa —, a caixa renderizada não acompanha, e o desenho sai **esticado**: medido, 4,8% na horizontal e 17,6% na vertical em todo gráfico impresso. Não há erro em lugar nenhum; só o PDF fica torto | Dimensione a **caixa** (`.analytics-chart`) e chame `resize()` **sem medidas**: aí o Chart.js relê o container e bitmap e caixa voltam a coincidir. É o que `graficos/index.ts::prepararGraficosParaImpressao` faz |
| **`Chart.resize()` com animação em curso** | Ele **adia** o pedido (`_resizeBeforeDraw`) e quem o aplica é o `draw()` seguinte — com as medidas **guardadas**, não com as atuais. Um pedido do `ResizeObserver` pendente desde a montagem fazia o gráfico ir para a medida certa e voltar para a antiga no mesmo quadro: quatro dos nove saíam impressos com o bitmap de meia coluna esticado até a largura da folha, e só eles | `stop()` encerra a animação (senão o `resize()` novo também é adiado), `draw()` consome a pendência enquanto as medidas guardadas ainda são as que valem, e **só então** a caixa muda. Ver `graficos/index.ts::pararEredimensionar` |
| **Medir a folha depois que a impressão começou** | Canvas é bitmap: a largura útil do papel só existe quando já é tarde para redesenhar. E o `@media print` esconde a sidebar e põe o grid em uma coluna, então a caixa do papel **não é** a da tela | `px` é unidade absoluta na impressão (1/96 pol): fixar a caixa em px antes de imprimir faz a geometria medida na tela valer para a folha. `LARGURA_IMPRESSAO = 960` (≈254mm) cabe na área útil de um A4 paisagem com folga para o page setup que o GTK escolher |
| Altura de impressão menor que a da tela num ranking horizontal | Comprimir a caixa "para caber melhor" tira o espaço entre as barras, e os rótulos de três linhas **encavalam** — o primeiro cai em cima do segundo. Ficou invisível enquanto o desenho saía esticado; apareceu no instante em que a distorção foi corrigida | Mesmos 42px por barra da tela, com teto de 700px (≈185mm, a altura útil da A4 paisagem) |
| **Roving tabindex sem tratador de setas** | `tabIndex = ativo ? 0 : -1` tira o botão não selecionado da ordem de Tab; sem `keydown` para as setas, ele fica **inalcançável pelo teclado**, e o que sobra no Tab é o botão que já está selecionado. O alternador Gráfico/Tabela nasceu assim, com `role="tab"` e sem `tabpanel` — semântica de aba pela metade | Alternador de dois estados é grupo de botões com `aria-pressed`, que o navegador opera sozinho. Roving tabindex só com o tratador de setas junto, e aí a semântica de aba tem de estar completa |
| Percentual de tooltip sobre o que está plotado | Num ranking limitado ao Top 12, somar só as doze barras infla todos os percentuais **em silêncio** (63/274 em vez de 63/277). E num empilhado, dividir pelo total do gráfico responde outra pergunta: 96 em andamento do IPM viram 20,9% do relatório, não os 70,1% do apuratório que o leitor espera | `GraficoSpec.totalReal` guarda o total do conjunto **antes** do recorte, e `percentual.base` diz se a conta é da categoria ou do total. `dados.ts::denominadorPercentual` decide, e tem teste |
| Rótulo de eixo cortado sem reticências | `quebrarRotulo` limita a três linhas: "Acidente de trânsito envolvendo viatura policial militar" virava "envolvendo viatura", e o eixo passava a mentir o nome da categoria. Na tela o tooltip desmente; **no papel não há tooltip** | O corte é explícito, com `…`. E o texto inteiro continua no tooltip e na tabela do cartão |
| Esconder toda `.table-wrap` para pôr o bloco completo na impressão | A tabela **dentro de um cartão analítico** não é a listagem paginada que o bloco vem substituir; esconder por classe global também deixa títulos antigos soltos e pode duplicá-los no bloco completo | Envolva a região paginada — títulos, tabela e paginação — e passe seu id em `seletorSubstituido`. `ligarExportacao` esconde somente esse alvo |
| Confiar em `break-inside: avoid` no `<tr>` | Pior do que dividir: o WebKitGTK 2.52.6 aceita a propriedade, parte a linha na quebra de página **e não imprime a metade que ficaria na folha anterior**. O registro some do PDF, sem erro, sem aviso e sem buraco visível — a folha seguinte simplesmente começa no meio de uma linha. Medido em `tools/impressao`: 14 de 400 linhas na listagem de auditoria, 40 de 400 no mapa salvo | Tabela longa opta por `linhasPorFragmentoImpressao`: no clique, `dom.ts` cria blocos indivisíveis com cabeçalho próprio e os remove ao fechar o diálogo. O tamanho do bloco é **medido**, nunca estimado |
| Escolher o tamanho do bloco no olho | Os dois lados erram para pior. Bloco **menor** que a folha imprime o cabeçalho no meio da página — com 4 linhas por bloco a auditoria saía com dois cabeçalhos por folha, e 15 folhas viravam 16. Bloco **maior** que a folha deixa de ser indivisível: o motor volta a fatiar, e a linha some de novo | Roda-se `tools/impressao` com `--fragmento=nome:N` até achar o maior N que ainda dê **um** cabeçalho por folha e **zero** linha partida. Os nove valores atuais estão comentados no código, cada um dizendo de qual medição saiu |
| Fragmentar a tabela que mora dentro de um cartão | Dentro de um item de `.analytics-grid` ou `.stat-grid` o WebKitGTK **ignora** o `break-inside` das caixas de dentro. Fragmentar ali não protege nada e ainda gasta folha: medido, o painel analítico saía com 4 folhas e uma linha partida contra 3 folhas e nenhuma | Ali quem protege é o `break-inside: avoid` do próprio cartão ou painel, que o motor respeita. `linhasPorFragmentoImpressao` é só para tabela no **fluxo do documento** — listagem substituída, seção do Anual, matriz normalizada. As três tabelas de `estatisticas.ts` servem aos dois lugares, e por isso o fragmento é opção de quem chama |
| Dar CSS de impressão por pronto sem imprimir | Nada disto aparece lendo CSS: `@page size` ignorado, linha que desaparece, `break-inside` que não vale dentro de grid, coluna de dez colunas espremida a dois caracteres quando falta o invólucro que carrega as larguras. A rodada 30 escolheu margens, densidades e nove tamanhos de bloco sem imprimir uma folha, e três dessas escolhas estavam erradas | `tools/impressao`: monta as páginas com os helpers reais e o CSS compilado, imprime pelo WebKit2 e afere com `pdfinfo`/`pdftotext`/`pdftoppm`. `controle-mapa.sh` imprime o Mapa Mensal com o CSS de antes e o de agora e compara **texto e pixel** |
| Contar "em andamento" sem olhar se há prazo | O apuratório cuja **data de recebimento nunca foi informada** não tem linha em `processo_prazos`: `prazo_vencimento` é `NULL`, e ele não está nem no prazo nem vencido. Somá-lo a "no prazo" afirma um prazo que não existe, e o número fica plausível — que é o pior tipo de erro de relatório | São **quatro** baldes exclusivos, e o quarto ("Sem prazo definido") tem coluna própria, exibida só quando alguém está nele. Ver decisão 57 e `designations_matrix` |
| Inserir `dias` negativo para forjar um prazo vencido num teste | `ck_prazo_dias` exige `dias > 0` e `data_vencimento` é coluna **gerada** (`data_inicio + dias`), então o `INSERT` é recusado — e o teste falha por um motivo que não é o que ele testa | Quem anda para trás é a `data_inicio`: um prazo vencido é um prazo de 30 dias que começou há mais de 30. Ver `prazo_vencendo_em`, em `tests/maps_reports_repository.rs` |
| Acrescentar um cartão a um painel sem olhar as telas vizinhas | Foi assim que três telas passaram a desenhar os mesmos quatro KPIs e a mesma evolução por ano — duas delas **sem escopo nenhum**, ao lado de cartões filtrados, dizendo números diferentes sobre a mesma pergunta na mesma tela | Cada indicador tem **uma** tela dona (decisão 55). Antes de acrescentar, procurar o cartão nas outras telas de relatório |
| Agregar data sem olhar de qual conjunto ela sai | `max(data_conclusao)` calculado antes do recorte responde a pergunta errada: filtrando "vencidos", ele devolveria a conclusão de um processo que o filtro **acabou de excluir**. O número é plausível, e por isso ninguém desconfia | A data sai do mesmo `WHERE` que os contadores — ver `designations_matrix` e o teste `recorte_por_situacao_leva_as_datas_junto` |
| Ordenar por `Option<data>` direto | `None` é menor que qualquer `Some`, então no crescente a lista **abre** com quem não tem a data. Ordenando por "conclusão mais antiga", os primeiros da lista seriam justamente os que nunca concluíram nada | Quem não tem a data vai para o fim **nas duas direções** — `ordenar_por_data`, em `maps_reports/repository.rs` |
| Distinguir duas telas só pelo filtro | "Relatório Anual" nasceu como a tela de Estatísticas com o ano fixo, e o resultado foram duas entradas de menu abrindo a mesma coisa — o defeito que a rodada 29 existia para corrigir | Se duas telas mostram os mesmos fatos, ou uma sai, ou elas diferem no **gênero**: uma se opera, a outra se imprime. E o **dado** continua vindo de uma função só — decisão 59 |
| Repetir o SQL de uma regra em cada `FILTER` | Os quatro baldes apareciam em cinco lugares da mesma consulta, e cinco cópias divergem no primeiro ajuste — além de nada garantir que sejam exclusivos | Um `CASE` de saída única (`BALDE`), interpolado por `format!`. Consulta com `format!` **precisa** entrar na `COBERTURA` de `tests/sql_prepare.rs`, senão o `PREPARE` automático não a alcança |
| Trocar `serde(flatten)` por struct aninhada numa resposta | Os campos achatados sobem para o topo do JSON, e é isso que mantém `linha.total` onde a tela sempre o leu. Aninhar quebra o frontend **sem** erro de compilação no Rust — o `tsc` só reclama se `types.ts` for atualizado junto | `SituacaoDesignacao` é achatada de propósito, na linha e na célula. Se mudar, mudar `types.ts` na mesma alteração — é o que o teste `resposta_traz_os_campos_que_o_frontend_espera` vigia |
| Imprimir um `<canvas>` pelo WebKitGTK | Com o compositing **ligado** — que é como o aplicativo roda — o desenho é textura de GPU, e o caminho de impressão a pinta de **preto puro**: o gráfico sai como uma faixa preta, sem erro no console nem no `failed` da operação. Medido em `tools/impressao/medicao-grafico-canvas`: 31,2% da folha em preto contra 0,0% do mesmo desenho como `<img>`. Pior: o arnês **escondia** o defeito, porque `imprimir.py` desligava o compositing para conseguir o contexto GL na janela offscreen | O canvas é congelado num `<img>` com `toBase64Image()` enquanto o diálogo está aberto — `graficos/index.ts::congelarGraficosParaImpressao`. Isso custa `data:` no `img-src` da CSP (decisão 62), e obriga `decode()` antes de imprimir. A fixtura que precisa da resposta honesta declara `compositing: true`, e `conferir.py` reprova folha com mais de 3% de preto chapado |
| Esconder com `hidden` um canvas que o Chart.js montou | **Não esconde nada.** O Chart.js escreve `style.display = 'block'` no elemento ao montar (`initCanvas`), e estilo inline vence a regra `[hidden]` do navegador — que é a **única** que existe, porque o projeto não declara nenhuma `[hidden]` global (só `.analytics-view[hidden]`, `.campo-erro[hidden]` e outras seis, todas com classe). O canvas segue ocupando caixa e sendo pintado de preto **ao lado** do PNG certo: no PDF de Estatísticas, cada gráfico saía como **duas** imagens do mesmo tamanho, a boa com `smask` e a chapada sem, e o par ainda atravessava a quebra de página | O canvas sai do **DOM** (`canvas.remove()`), e volta no `finally` pelo vizinho lido antes da remoção — a caixa também hospeda o `.analytics-tooltip`. Medido: `medicao-grafico-oculto` dá 31,2% de preto e duas imagens de 1920×600; `calibrado-grafico-removido`, 0,0% e uma |
| Fixtura de gráfico com o canvas nascendo oculto | Um canvas que nunca foi visível **nunca ganha camada de composição**, e a fixtura aprova o que o PDF real reprova — foi assim que a primeira volta da rodada 31 deu por resolvida uma faixa preta que continuava saindo. Não basta reproduzir o resultado: é preciso reproduzir a **sequência** | A fixtura pinta o canvas **visível**, deixa o motor compor alguns quadros (`setTimeout` de 120ms, dentro dos 300ms que o arnês espera), põe nele o `display:block` inline que o Chart.js põe, e só então troca — `trocaPeloPng` em `gerar-fixturas.ts` |
| Mostrar um véu de carregamento sem ceder um quadro antes do trabalho | O véu é marcado como visível e o navegador entra no bloqueio **antes de pintar**: o loader só aparece quando a ação termina, que é quando ele não serve para nada. Quase todo trabalho pesado daqui é síncrono — a paginação do mapa mede layout linha a linha, a impressão fragmenta tabelas e converte canvas em PNG | `comCarregamento` cede um `requestAnimationFrame` **antes** de chamar a ação, e `passo()` cede outro a cada troca de mensagem. Sem isso o helper seria decoração |
| Confiar no giro do spinner durante trabalho síncrono longo | Durante a paginação do mapa a thread principal fica bloqueada e a animação **congela junto** — um spinner parado parece aplicação travada, que é o oposto do recado | Quem informa é o **véu mais a mensagem**, e ela muda de fase: "Carregando os dados…" → "Montando o documento…" → "Abrindo a impressão…". O giro é enfeite, e o bloco `prefers-reduced-motion` do projeto já o zera de qualquer forma |
| Esconder com `hidden` um elemento cujo próprio CSS declara `display` | O projeto **não tem** `[hidden]` global — só oito regras, todas com classe. Um `display: flex` no seletor vence a regra do navegador, e o elemento continua ocupando caixa. É a mesma família do canvas que seguiu sendo impresso depois de "escondido" | Quem declara `display` declara também o `[hidden]` composto: `.carregando[hidden] { display: none !important }`. Ou tira do DOM, como `congelarGraficosParaImpressao` faz |
| Combinar dois modificadores de tabela que discordam | `--larga` pede `min-width: 1060px` e `--fixa` pede `0`. Mesma especificidade: quem vence é a **ordem no arquivo**, e a ordem dá `0` — dez colunas espremidas na largura do painel, sem ninguém ter escolhido isso | Seletor composto, de especificidade maior, decidindo de propósito: `.tabela-dados--larga.tabela-dados--fixa { min-width: 1060px }` |
| Pôr um bloco indivisível alto logo abaixo de uma faixa de KPIs | `.analytics-card` é `break-inside: avoid` e o cartão de ranking mede 532px (11 militares) a 700px de altura — mais que os 180mm úteis da A4 paisagem menos o cabeçalho. O motor não tem onde o pôr: desmancha o cartão por cima da folha seguinte e ainda empurra o que vem depois. Medido em Designações, `medicao-designacoes-folha1`: **duas** folhas gastas antes da primeira linha da matriz — a primeira com título, KPIs e a faixa preta do gráfico, a segunda só com o `h2` da matriz | Ou o bloco desce, ou ele encolhe — e encolher um ranking encavala os rótulos de três linhas. Designações desce: `data-impressao-ao-fim` na `.analytics-grid`, e `dom.ts::adiarBlocosParaOFimDaImpressao` a move para o fim do `.panel` só enquanto o diálogo está aberto. O primeiro bloco da matriz é **remedido** depois disso — 18 valia para uma folha 1 que a matriz não alcançava |
| Guardar o brasão dos documentos na pasta de ícones do Tauri | `src-tauri/icons/icon.png` era, ao mesmo tempo, o brasão da PMRO que quatro telas carregam (sidebar, login, capa do Anual e o Mapa Mensal inteiro) e a vaga que `npx tauri icon` sobrescreve ao gerar o ícone do app. Gerar o ícone **trocava o brasão de todos os documentos** pelo distintivo do batalhão, sem erro e sem aviso — e o Mapa Mensal, que ninguém pediu para mexer, sairia com o emblema errado | O brasão é `src/assets/brasao-pmro.png` e sai de `src/brasao.ts`, numa fonte só (estava triplicado em `main.ts`, `anual.ts` e `mapa-pdf.ts`). `src-tauri/icons/` passa a ser exclusivamente do empacotador. Quem prova que a separação funcionou é `controle-mapa.sh`: mesmos bytes em caminho novo têm de dar PDF idêntico ao de `HEAD`, texto **e** pixel |
| Achatar a resposta com `sqlx(flatten)` achando que serve para o JSON | Os dois atributos governam sentidos opostos: `#[sqlx(flatten)]` monta o struct **a partir** da linha do banco; `#[serde(flatten)]` achata o struct **para** o JSON. `SavedMapFull` tinha só o primeiro, e a resposta saía `{ "cabecalho": {…}, "dados_mapa": [...] }` enquanto `types.ts` declarava os 11 campos no topo. O detalhe do mapa salvo imprimiu meses de PDF com o cabeçalho `undefined a undefined · undefined no período · undefined em andamento · undefined concluídos · gerado por —`, e a tabela abaixo saía perfeita — porque `dados_mapa` era o único campo realmente de primeiro nível | Os dois atributos juntos. E o teste tem de olhar o **JSON**, não o struct: `assert_eq!(completo.cabecalho.titulo, …)` passa exatamente igual com e sem o flatten, que foi por que nenhum dos 178 testes viu. `commands_ipc.rs::o_mapa_salvo_chega_achatado_ao_frontend` afere as duas metades — `titulo` no topo e `cabecalho` ausente |
| Dar um botão de ícone a `comCarregamento` como gatilho | O helper escreve a mensagem de progresso no botão que disparou a ação e restaura o rótulo no `finally`. Isso vale para botão de texto; num `.botao-icone` o conteúdo é um `<svg>` e `textContent` é a string vazia, então a escrita **remove o ícone do DOM** e a restauração devolve vazio. O botão vira um quadrado em branco, e só volta quando a tela é redesenhada — foi o que aconteceu com "Ver PDF completo" na listagem de mapas salvos | `comCarregamento` pula os `.botao-icone`: neles só o `disabled` muda, e quem informa é o véu, que já está na frente de tudo. `dom.test.ts` trava as duas propriedades de que a decisão depende: o botão traz a classe e não tem texto nenhum fora das tags |
| Estimar largura de coluna em tabela de largura declarada | `Coluna.largura` liga `table-layout: fixed`, e ali uma célula `nowrap` menor que o conteúdo **não** encolhe nem corta: transborda por cima da coluna vizinha, sem aviso. A coluna "Em" dos mapas salvos tinha 5% (46px) para uma data que pede 96px | Medir no motor do app, com o CSS compilado — `<col>` só ganha largura por `aplicarLarguras`, então a página de medição precisa assar o `data-largura` em `style`, como `gerar-fixturas.ts::comLarguras` faz. E escolher a defesa certa: `truncar` corta com reticências e dá o `title` (serve a texto livre); tirar o `nowrap` deixa quebrar em duas linhas (serve a um intervalo de datas, que cortado esconderia metade); percentual nenhum salva ícone, que não encolhe |
| Escrever à mão, na fixtura, o tamanho do bloco que a tela declara | `matriz-normalizada` chamava `blocosDeImpressao(linhas.length, 22, 18)` com os números digitados, e o `18` ficou para trás quando `encarregados.ts` baixou o primeiro bloco para 12. A fixtura passou a certificar uma folha que o app não imprime mais — e passou verde por várias rodadas, porque a folha maior acomodava o bloco maior. Só reprovou quando o cabeçalho institucional tirou 24mm do topo: a última linha do bloco de 18 cruzou a margem inferior por **0,8pt** | Tamanho de bloco sai de `CONJUNTOS`, que é onde o valor da tela mora — `fragmentoAtual` e `fragmentoPrimeiro`, como `calibrado-designacoes-folha1` já fazia. Fixtura que copia o número em vez de o ler mede a si mesma |
| Criar a imagem no clique de imprimir e não esperar por ela | Uma `<img>` inserida no DOM durante a preparação da impressão ainda não está decodificada quando o comando nativo abre o diálogo, e o WebKitGTK imprime **o espaço em branco** no lugar dela — sem erro, sem console, sem nada. Um PDF oficial sem brasão parece um PDF que simplesmente não tem brasão | `await img.decode()` antes de chamar `print_portrait`/`print_report_landscape`, e falhar alto se não decodificar: `mapa-pdf.ts::aguardarImagens` foi o primeiro, `dom.ts::inserirCabecalhoInstitucional` é o segundo. Quem confere no arnês é `pdfimages -list`, que mostra a imagem e a `smask` na folha 1 — `pdftotext` não vê imagem nenhuma |

---


---

## 8. Os bugs reais — e quem os pegou

Vale como argumento para não deixar a rede de proteção de lado — e, nos dois últimos, para
não deixar a **conferência de tela** de lado. Os itens 8 e 9 atravessaram a migração
inteira sem nenhum teste acusar, e apareceram quando alguém sentou para usar o app.

1. O hash bcrypt do seed **não correspondia** à senha `123456`. Passaria despercebido até
   alguém tentar entrar.
2. A aritmética do prazo divergia entre `proceedings` (`+dias`) e `deadlines` (`+dias-1`).
   Hoje é coluna gerada — não há como divergir.
3. **Não havia como cadastrar a configuração do apuratório.** As duas tabelas de associação
   eram lidas em 8 pontos e não tinham caminho de escrita — nenhum processo podia existir.
4. **Trocar a espécie do apuratório vazava violação de FK crua na tela.** As designações são
   registro histórico e nunca são apagadas, então a FK composta impede a troca —
   corretamente; faltava recusar com uma regra legível.
5. **O mapa filtrava por `data_instauracao BETWEEN`** e escondia justamente o processo
   antigo ainda pendente — que é o que a Seção abre o mapa para ver. Vale a regra do
   sistema legado: aberto até o fim do período, mais concluído dentro dele.
6. **Escopo vazio significava "nenhum".** `= ANY('{}')` é falso para toda linha, então o
   operador que não filtrava nada não via nada. `MapPeriodRequest` já documentava "vazio =
   todas"; o código é que não cumpria.
7. **Rótulo de enquadramento com prefixo duplicado:** "Art. **Art. 15**, inciso I do RDPM".
   `artigos_rdpm.artigo` e `infracoes_estatuto.artigo` já guardam o artigo por extenso — é o
   que o administrador digita e o que a tela de catálogos exibe — e o SQL de `evidence`
   prefixava `'Art. '` de novo. Aparecia em toda a tela de indícios.

### E o oitavo, que os testes **não** pegaram

8. **Os seletores de militar estavam truncados em 200.** O formulário de processo pedia
   `perPage: 500` a `users_list`, e `users::repository::list_paginated` faz
   `per_page.clamp(1, 200)`. O clamp corta **em silêncio**: nem erro, nem aviso, nem
   resposta parcial sinalizada. Com 235 militares no efetivo, os 35 últimos em ordem
   alfabética — de `RODRIGO SANTOS MADEIRA` a `ZAQUEU DE ALMEIDA KVIATKOSKI` — não podiam
   ser lançados como envolvido nem como designado em processo nenhum.

   **Por que a rede de proteção não pegou:** nenhum teste exercitava uma lista maior que o
   clamp. A fixture tem 3 militares, e 3 < 200 para qualquer valor de `per_page`. O teste
   de paginação existia e passava — ele conferia que a paginação *funciona*, não que a
   *tela* pedisse a coisa certa.

   Corrigido separando os dois papéis, que é o que o princípio 6 já dizia: lista de
   **opções** não pagina (`users_list_ativos`, sem `LIMIT`), listagem de **tela** pagina
   (`users_list`, com controle de página de verdade — que também não existia). O teste
   `lista_de_opcoes_de_militar_nao_pagina` monta **250 militares** justamente para passar
   do teto.

9. **O formulário de carta precatória estava morto, e ninguém sabia.** A tela decidia o
   bloco Deprecante/Unidade deprecada por
   `apuratorio.extra.codigo_extensao === 'carta_precatoria'`, e `extra` vinha de
   `legal_catalogs_list("apuratorios")` — que projeta **apenas as colunas declaradas no
   registro de administração**. A decisão 29 (a seção 12, rodada 7) tirou `codigo_extensao` do registro,
   de propósito, para a pergunta sumir do cadastro do apuratório. Efeito colateral não
   previsto: a tela de processo lia do mesmo lugar, `codigo_extensao` passou a chegar
   `undefined`, e o bloco **nunca mais renderizou**.

   O backend continuou exigindo deprecante (`proceedings/repository.rs`), então a espécie
   ficou **impossível de cadastrar**: o formulário não oferecia os campos e o salvamento
   era recusado. A a seção 12, rodada 7 argumentava que esconder a coluna era seguro "porque o `UPDATE`
   genérico só escreve o que está declarado" — verdade para a **escrita**; ninguém
   verificou a **leitura**.

   É exatamente o que o item (c) da seção 11 mandava conferir na tela — "criar um processo de
   carta precatória e confirmar que ainda exige deprecante" —, e que continua pendente.
   Vale como argumento para a conferência de tela: dois ciclos de teste automatizado não
   alcançaram isto.

   Corrigido pela separação que faltava: o **registro** governa o que o administrador
   edita, e `apuratorio_config_get` entrega o que o **formulário precisa saber**. São
   perguntas diferentes e não podiam depender da mesma lista.

---


---

## 9. Onde olhar no código

| Quero entender… | Vá em |
|---|---|
| o schema e o porquê de cada decisão | `src-tauri/migrations/0001_schema.sql` (comentado por seção) |
| o que vem semeado e o que não vem | `src-tauri/migrations/0003_seed_catalogos_legais.sql` e `tests/migrations.rs` |
| quais catálogos existem e o que cada atributo faz | `src-tauri/src/legal_catalogs/domain.rs::CATALOGOS` |
| como o responsável do processo é resolvido sem nome de papel | o `LATERAL resp` da view, em `migrations/0014_subunidade_secao_origem.sql` — casa `processo_designacoes` com `apuratorio_papeis.e_responsavel`, e é a mesma definição que `proceedings/repository.rs::FILTRO` usa |
| de onde sai o "sobre o quê" de cada linha da auditoria | `audit/assunto.rs` (cabeçalho) — e `Catalogo::assunto_sql`, para os 26 catálogos |
| por que a auditoria guarda o rótulo em vez de resolvê-lo na leitura | a migration `0018` (cabeçalho) e o teste `o_assunto_continua_legivel_depois_de_a_linha_ser_apagada` |
| quem escreve a frase "Reabriu o apuratório" | o próprio comando, em `*/commands.rs`, via `audit::repository::Acao` |
| como a listagem de apuratórios pesquisa e filtra | `proceedings/repository.rs::FILTRO` (um `WHERE` para as duas fontes) e `bind_filtro` |
| de onde saem as opções do modal de filtros avançados | `proceedings/repository.rs::filter_options` (cabeçalho) — e por que elas **não** filtram `WHERE ativo` |
| as validações que dependem de configuração | `proceedings/repository.rs::validar_contra_configuracao` |
| como a cadeia de substituição é ligada e protegida | `migrations/0008_cadeia_de_substituicao.sql` |
| quem pode ser corrigido ou desfeito numa cadeia | `proceedings/repository.rs::travar_ultima_substituicao` |
| por que o cadastro não alcança uma designação | `proceedings/repository.rs::DesignacaoGravada::imutavel` |
| que texto o usuário lê quando o banco recusa | `error.rs::mensagem_de_constraint` e `mensagem_de_categoria` |
| onde o detalhe técnico de um erro vai parar | `error.rs::detalhe_tecnico`, impresso por `response.rs::err` |
| por que apuratório não é um catálogo comum | `src-tauri/src/apuratorio_config/domain.rs` |
| o que o banco recusa | `src-tauri/tests/schema_integrity.sql` |
| como montar um cenário de teste com processo | `src-tauri/tests/util/fixtures.rs` |
| como chamar um comando como o frontend chama | `src-tauri/tests/commands_ipc.rs` |
| por que não usamos `sqlx::query!` | `src-tauri/tests/sql_prepare.rs` (cabeçalho) e `Cargo.toml` |
| a composição comum de processo, e por que a contagem não a usa | `src-tauri/migrations/0004_view_processos_detalhados.sql`, sua ampliação na `0014_subunidade_secao_origem.sql` e `proceedings/repository.rs::BASE_CONTAGEM` |
| o contrato de cada comando (Rust) | `src-tauri/src/*/domain.rs` |
| o contrato de cada comando (TypeScript) | `src/api.ts::Commands` — é o mapa completo dos 89 |
| como o escopo de um relatório é parametrizado | `maps_reports/repository.rs::FILTRO_ESCOPO` e `escopo()` |
| por que o mapa não filtra por instauração | `maps_reports/repository.rs::map_rows` (cabeçalho) |
| como um arquivo chega ao usuário | `src-tauri/src/files/commands.rs` (cabeçalho) |
| como uma tela é montada de metadados | `src/telas/catalogos.ts` |
| como os campos condicionais saem do dado | `src/telas/processo.ts` (cabeçalho do arquivo) |
| como Recebimento cria/move/remove o prazo inicial | `deadlines/repository.rs::sync_initial` e `proceedings/repository.rs::save` |
| como incluir, editar e excluir prorrogação | `deadlines/repository.rs::{add_extension, update_extension, delete_extension}`; decisões 34–37; a seção 12, rodada 12–8.13 |
| onde ficam as ações e os formulários de prazo | `src/telas/processo.ts::renderDetalheProcesso` |
| como erro SQL vira mensagem pública segura | `src-tauri/src/error.rs::mensagem_banco` e `response.rs::ApiResponse::err` |
| o roteiro da importação, etapa por etapa | seção **6.2** deste arquivo, e `src-tauri/importacao/` |
| como cada catálogo operacional foi derivado do dump | `src-tauri/importacao/01_catalogos.sql` (comentado atributo por atributo) |
| as duas fontes de enquadramento do legado, e por que 11 infrações estatutárias entram e 3 não | `src-tauri/importacao/08_enquadramentos_anexos.sql` (cabeçalho do bloco dos PADS) |
| o que o legado tinha e não foi importado, item por item | **seção 6**, quadro "O que NÃO entrou, e por quê" |
| como acrescentar um catálogo administrável | **seção 5** |
| como esconder da tela uma coluna obrigatória no banco | `legal_catalogs/domain.rs::referencia_fixa` e `repository.rs::expressao` |
| como um campo de catálogo aparece só quando outro está marcado | `legal_catalogs/domain.rs::referencia_condicional` e o `[data-visivel-se]` de `src/telas/catalogos.ts` |
| como fazer uma mudança de schema agora que há dado real | **seção 5** |
| o que falta fazer | `a seção 11` (a lista para marcar), **seção 11** (o porquê) e o quadro no topo |
| por que lista de opções não pode paginar | **seção 12**, rodada 9 e `users/repository.rs::list_ativos` |
| como paginar uma listagem de tela | `dom.ts::paginacao`/`ligarPaginacao`/`paginaValida` e `src-tauri/src/db/paginacao.rs::Recorte`; **seção 12**, rodada 14 |
| como declarar largura, alinhamento e truncamento de coluna | `dom.ts::Coluna` e o bloco "Listagem de largura declarada" em `src/styles.css` |
| por que CSV e impressão não saem com dez linhas | `dom.ts::carregarTudo` e `ligarExportacao`; **seção 12**, rodada 14 |
| por que os dois blocos de Prazos não se sobrepõem | `deadlines/repository.rs::FILTRO_REPORT` e o teste `blocos_de_prazo_sao_exclusivos` |
| como acrescentar uma listagem paginada, do Rust à tela | **seção 5** — o passo a passo completo |
| por que lista de opções **não** pode paginar | **seção 12**, rodada 9, `users/repository.rs::list_ativos` e o quadro do início da seção 5 |
| como provar que uma mexida em CSS não mudou a tela | **seção 12**, rodada 14, "Como repetir a medição de CSS" |
| o que vigiar quando a Seção começar a usar | fim da **seção 12**, rodada 14 |
| como fazer backup, e como saber que ele presta | **seção 6** |
| quais campos cada apuratório mostra, e por quê | decisões **31** a **33**, e `apuratorio_config/domain.rs::ApuratorioConfig` |
| por que o comportamento não vem de `legal_catalogs_list` | o cabeçalho de `ApuratorioConfig`, e a **seção 6**, item 9 |
| como esconder um campo sem apagar o que já foi gravado | `processo.ts::textoSePresente` e o princípio 5 |
| como o formulário e a listagem se organizam na tela | **seção 12**, rodada 10, item 5, e o bloco "Listagem densa" em `src/styles.css` |
| como acrescentar um campo que só alguns apuratórios usam | **seção 5** — o passo a passo completo |
| por que o ofendido não é papel de pessoa, e onde ele mora | decisão **46**, **seção 12** e `migrations/0012_ofendido_vitima.sql` |
| por que `permite_cadastro_vitima` não aparece em Catálogos | **seção 12**, "O atributo fica fora do registro" — e decisão **46**, item (c) |
| como uma vítima gravada sobrevive a desligar a configuração | `proceedings/repository.rs::gravar_vitimas` (cabeçalho) e **seção 12** |
| como mexer numa migration que altera dado existente | **seção 5** — o ensaio sobre cópia do backup |
| por que o escrivão do IPM é um papel diferente | decisão **32** e **seção 12**, rodada 10, item 3 |
| por que o documento iniciador não lista todos | decisão **33** |
| onde estão as duas coisas que a conferência de tela já achou | **seção 12**, rodada 9 e **seção 12**, rodada 10 — e é por isso que ela não é formalidade |
| o que falta, em ordem, para fechar a migração | o quadro **▶ POR ONDE RETOMAR**, no topo, e `a seção 11` |
| como rodar o app com a CSP de produção | **seção 11** (o aviso do topo) e **seção 12**, rodada 9, item 3 |
| o que foi deliberadamente **não** planejado | **seção 10** |
| como o recorte de teste da importação é gerado | `src-tauri/tests/fixtures/gerar_legado_amostra.sh` |
| como "escrivão só em IPM" virou configuração, sem lista de siglas | `src-tauri/importacao/02_config_apuratorio.sql` |
| o que a importação garante, e como se conferiu | `src-tauri/importacao/99_conferencia.sql` e `src-tauri/tests/importacao.rs` |
| a conferência campo a campo dos 6 processos da amostra | `src-tauri/importacao/98_amostra_lado_a_lado.sql` (cabeçalho) e **seção 6** |
| por que a CSP é o que é, e o que ela recusaria | **seção 12**, rodada 6, e as quatro armadilhas de CSP na seção 7 |
| como um seletor de busca é montado nesta base | `src/telas/indicios.ts::pedirAnalogia` e o helper `buscar()` do mesmo arquivo |
| por que desativar e excluir militar são comandos diferentes | decisão **54**, `users/commands.rs::users_deactivate` e `users_delete` (cabeçalhos), e `users/repository.rs::Vinculos` |
| como uma listagem filtra enquanto se digita | `dom.ts::ligarBuscaInstantanea` (cabeçalho) e as três `atualizar*` que ela move: `processo.ts::atualizarListaProcessos`, `usuarios.ts::atualizarListaUsuarios`, `catalogos.ts::atualizarListaCatalogo` |
| por que Catálogos guarda as linhas num `let` do módulo | o cabeçalho de `linhasCarregadas`, em `src/telas/catalogos.ts` — e a **seção 12**, rodada 26 |
| por que a prorrogação começa no dia do vencimento | `src-tauri/migrations/0005_prazo_intervalo_ocupacao.sql` |
| como se registra um envolvido sem PM identificado | decisões **51** e **52**, `migrations/0016_envolvido_a_apurar.sql` e o teste `a_0016_converte_o_pm_ficticio_sem_perder_o_que_pendurava_nele` |
| por que a sincronização de envolvidos é pelo id do vínculo | `proceedings/repository.rs::gravar_envolvidos` (cabeçalho do bloco) e decisão **52** |
| por que as unicidades do envolvido são adiadas | `migrations/0016` e `0017`, e as duas armadilhas de `ON CONFLICT` e permuta na seção 7 |
| como um `<select>` vira pesquisável sem deixar de ser `<select>` | `dom.ts::ativarSelectsPesquisaveis` / `destruirSelectsPesquisaveis`, e o atributo `data-select-pesquisavel` |
| como o cadastro rápido em modal reusa o formulário da tela cheia | `catalogos.ts::abrirCadastroRapidoCatalogo`, `usuarios.ts::abrirCadastroRapidoMilitar` e `dom.ts::montarModal` |
| quais cadastros têm "+" no formulário de processo, e por que os outros não | decisão **53** e o mapa `seletores` em `processo.ts` |
| como um painel analítico é montado, do dado ao canvas | `src/graficos/dados.ts` (transformações puras, testadas) e `src/graficos/index.ts` (Chart.js, cartão, tooltip, impressão) |
| por que o gráfico impresso não sai esticado | `graficos/index.ts::prepararGraficosParaImpressao` e `pararEredimensionar` (cabeçalhos) — e as três armadilhas de impressão de gráfico na seção 7 |
| por que a caixa do gráfico é fixada em **px** para imprimir | o cabeçalho de `LARGURA_IMPRESSAO`: `px` é unidade absoluta no papel, e é o que permite medir a folha antes de ela existir |
| de que total o percentual do tooltip fala | `dados.ts::denominadorPercentual` (cabeçalho) e `GraficoSpec.percentual` / `totalReal` |
| por que o alternador Gráfico/Tabela não é `role="tab"` | `graficos/index.ts::definirModo` (comentário) e a armadilha do roving tabindex na seção 7 |
| onde fica a preferência de ver gráfico ou tabela | `localStorage`, chave `adm-p6:visualizacao:<id do cartão>`, em `graficos/index.ts::preferencia` |
| por que o ranking mostra 12 e a tabela mostra tudo | `dados.ts::limitarRanking` e a nota "Top 12 no gráfico · tabela completa" do cabeçalho do cartão |
| onde a matriz de designações vive, e por que não está dentro do cartão | `src/telas/encarregados.ts` — o cartão traz a carga por situação; a matriz é o conteúdo da tela, e continua fora dele |
| qual tela é dona de cada indicador | decisão **55**, e os cabeçalhos de `src/telas/dashboard.ts`, `prazos.ts` e `estatisticas.ts` — cada um diz o que **não** desenha, e por quê |
| por que "Relatório Anual" e "Estatísticas" são telas diferentes | decisão **59**, e os cabeçalhos de `src/telas/anual.ts` e `estatisticas.ts` |
| onde as duas telas de relatório buscam o mesmo dado | `estatisticas.ts::carregarDadosDoEscopo` — e `tabelaContagem`, `tabelaSituacao` e `tabelaEnquadramento`, ao lado dela |
| como se pergunta "quem concluiu por último" | decisão **60**, e `designations_matrix` — o filtro de balde e as duas datas do conjunto recortado |
| por que os quatro baldes são um `CASE` só | `maps_reports/repository.rs::BALDE` (cabeçalho) — a regra aparece em cinco lugares da mesma consulta |
| como se conta a carga de trabalho de um militar | decisões **57** e **58**, e `maps_reports/repository.rs::designations_matrix` (cabeçalho) |
| por que "sem prazo definido" é um balde e não um zero | decisão **57**, `SituacaoDesignacao` (cabeçalho) e `dados.ts::baldesComDado` |
| por que a série por ano ignora o filtro de ano | `maps_reports/repository.rs::by_year` (cabeçalho) — o ano é o eixo dela |
| onde mora o brasão, e por que não na pasta de ícones | `src/brasao.ts` (cabeçalho) e a armadilha do `tauri icon` na seção 7 |
| quem põe o brasão no topo de todo relatório | `dom.ts::inserirCabecalhoInstitucional`, chamada por `abrirImpressao` — e a guarda do perfil `documento`, que evita o segundo brasão no Relatório Anual |
| por que o mapa salvo guarda resumo e documento no mesmo JSONB | `migrations/0020_snapshot_mapa_completo.sql` (cabeçalho) e o `SavedMapSnapshot` de `types.ts` — o schema admite dois JSONB, e `tests/migrations.rs` reprova o terceiro |
| como o PDF completo de um mapa salvo é reemitido sem recalcular | `mapas.ts::gerarPdfCompleto` — o snapshot alimenta o mesmo `renderDocumentoMapa` da tela ao vivo, e o período sai das colunas da linha |
| o diagnóstico do estado anterior | `a seção 13` |

---

## 10. Pontos a reavaliar, e o que NÃO está planejado

**Solução decidida: por envolvido ou por processo? — RESOLVIDO, e a importação mediu.**
Ficou **por envolvido**, e a investigação da importação confirmou. Os 7 `Punido` e os 4
`Absolvido` são exatamente os processos disciplinares (PADS/PAD/CD/CJ/PADE), e **cada um
tem um único acusado** — 37/37 com `nome_pm_id` preenchido. Já `Homologado` (48) e
`Avocado` (3) só aparecem em procedimentos. A coluna fica onde está. Continua valendo o
sinal de alerta: se, ao cadastrar um procedimento com 3+ sindicados, a solução decidida se
repetir idêntica em todos, é porque naquele caso ela é do processo.

**"Como escrivão" saiu do detalhe de usuário.** Virou uma seção só, "Designado", porque
separar por nome de papel reintroduziria o hardcode que a refatoração eliminou. Se a Seção
precisa dessa quebra, o caminho é filtrar por `papel_id` escolhido pelo usuário —
`users_proceedings_designated` já aceita o parâmetro.

**Quinze comandos registrados que nenhuma tela chama.** Levantados na seção 12, rodada 9. Não são código
morto — são capacidade sem entrada de UI —, mas alguns são lacuna de verdade: `users_delete`
(não há como **desativar** um militar pela tela, embora `users_reactivate` tenha botão —
assimetria visível), `proceedings_delete`, `evidence_remove_for_pm`, `audit_by_record` e
`audit_by_user` (não há trilha de auditoria por registro nem por usuário),
e `deadlines_calculate` (nenhuma prévia de cálculo de prazo). Expor cada um é decisão de
produto: o backend e os testes já estão de pé. A lista completa está no levantamento da
a seção 12, rodada 9. **`proceedings_substitute_designation` saiu desta lista na seção 12, rodada 15**: tem botão na
tabela de Designações, e ganhou dois irmãos para corrigir e desfazer.

**Formato da matrícula.** `9 caracteres, prefixo 1000 ou 3000` ficou como validação de
domínio (`users/domain.rs`), não como CHECK, para não impedir a importação de registros
históricos. Se virar regra rígida, promover a CHECK.

**Anexos em `BYTEA`.** Limite de 100 MB na aplicação, trafegando em base64 pelo IPC
(~133 MB de string). Se o volume crescer, avaliar armazenamento em disco com o caminho no
banco.

**Mapa excluído continua alcançável por id — RESOLVIDO: fica como está.** `delete_saved_map`
é exclusão lógica (`ativo = false`) e `list_saved_maps` filtra `m.ativo`, mas `get_saved_map`
não. A assimetria é **correta**, pelo princípio 6: lista de *opções* filtra, leitura de
*registro existente* não, e um mapa é documento já emitido. O que faltava era o comentário
dizendo isso — está agora em `maps_reports/repository.rs`, para o próximo leitor não
"consertar" o que está certo. Excluir duas vezes também não é erro, e é deliberado:
exclusão idempotente. Id inexistente, esse sim, é recusado com regra legível.

**JSONB remanescente — os dois são justificados e travados por teste:**
`mapas_salvos.dados_mapa` (snapshot imutável de relatório já emitido) e
`auditoria.alteracoes` (diff heterogêneo e imutável). O teste `migrations.rs` **falha** se
aparecer um terceiro.

**A Visão Geral dos Apuratórios foi absorvida, e o Relatório Anual virou documento — RESOLVIDO.**
A primeira era o Painel com dois cartões a mais, e saiu. O segundo chegou a ser um "modo"
da tela de Estatísticas — e isso durou uma volta, porque deixava duas entradas de menu
abrindo o mesmo desenho: virou peça impressa, com capa e seções numeradas. Ver decisões 55
e 59, e a rodada 29. O que **não** foi feito, e é escolha: fundir Painel e Prazos. Eles respondem perguntas
diferentes — "como está o acervo" e "o que preciso cobrar" —, e a única sobreposição que
havia (o gráfico de criticidade) já ficou num lugar só.

**As preferências de visualização dos cartões que saíram continuam no `localStorage`.**
Chaves `adm-p6:visualizacao:visao-*`, `dashboard-unidades`, `dashboard-apuratorios`,
`dashboard-evolucao`, `anual-*` e `prazos-criticidade`, de cartões que não existem mais.
São alguns bytes por navegador e nada os lê; limpá-las exigiria código que roda uma vez e
depois é lixo. Ficam.

**`ASP OF PM` no círculo "Praças".** A 0003 o inseriu assim porque o dump só tem dois
círculos e um militar real usa esse posto. Aspirante a Oficial é praça especial; se a PMRO
classificar em círculo próprio, é uma linha a mudar.

---

Registrado para que ninguém gaste tempo redescobrindo que a decisão já foi tomada.

| Ideia | Por que não |
|---|---|
| Migrar os ids de `String` para `uuid::Uuid` e usar `sqlx::query!` | Ganha verificação em tempo de compilação; custa um refactor cruzado (structs de request, assinaturas de repositório, fixtures) e um tratamento novo para UUID malformado vindo da tela. O objetivo — "erro de SQL não chega em runtime" — **já está atendido** por `tests/sql_prepare.rs`, que alcança as 132 consultas contra as 9 que a macro alcançaria. Ver a seção 12, rodada 3 |
| Gerar PDF no Rust | O relatório anual é página HTML + impressão do sistema. Nenhum crate de PDF entrou de propósito: o layout fica no frontend, onde é fácil ajustar. Ver a seção 12, rodada 1 |
| Reimplementar os 9 comandos antigos de `/stats/procedimentos` | Traziam a sigla no SQL. Foram substituídos por painéis genéricos com filtro de ano + apuratórios. Ver a seção 12, rodada 1 |
| Um campo de "situação" editável no processo | Decisão 25: a situação é derivada do fato registrado. Um estado marcado à mão é um estado que alguém esquece de atualizar |
| Importar os 107 mapas salvos e as 448 linhas de auditoria | Decisão 16 |
| Importar os catálogos órfãos `naturezas`, `tipos_processo` e `status_processo` | Decisão 24: seed de demonstração do app antigo, 0 referências em 8 anos |
| Tirar o dispositivo legal também das **infrações penais** | Ali é diferente do Estatuto (decisão 29): há **4 dispositivos distintos** entre as 26 infrações — Código Penal, CPM, CTB e LCP —, e a coluna é filtro de verdade em `evidence::search_infracoes_penais`. O que existe é uma capacidade morta: o comando aceita `dispositivo_legal_id` e a tela nunca o envia. Expor esse filtro é melhoria de tela, não remoção de campo |
| Devolver a ordenação hierárquica de militares | Decisão 27, tomada com a consequência à vista. Voltar atrás custa migration nova **e** redigitar os 13 valores, que a `0006` não guardou |


---

## 11. Roteiro de conferência de tela

> **Lista para marcar enquanto percorre.** Nada aqui é automatizável: são as duas
> coisas que teste não alcança — a CSP, que só falha dentro do WebView, e o
> julgamento de quem conhece o domínio. Foi ela que achou os dois defeitos que
> nenhum teste pegava.

### Antes de começar

```bash
# 1. O binário de produção — é ele que carrega a CSP restritiva.
#    `tauri dev` usa a `devCsp`, que afrouxa `style-src`: não serve para isto.
npm run tauri build

# 2. O banco precisa estar de pé.
docker compose up -d

# 3. Abrir o app
./src-tauri/target/release/adm-p6-tauri
```

Entre com `admin@sistema.com` / `123456` e **deixe o console aberto (F12)**.

> **Toda violação de CSP aparece só no console**, como `Refused to…`. Não aparece
> no log do processo e não vira mensagem de erro na tela. Uma tela pode ficar
> muda sem avisar.

| Sintoma | Causa provável |
|---|---|
| O app abre e **nenhuma tela carrega dado** | `connect-src` sem `ipc: http://ipc.localhost` — é por aí que todos os comandos passam |
| Uma tela abre **sem estilo** | `style-src`. Em produção o Vite emite `<link>`; em dev injeta `<style>` |
| Uma tabela de contagem mostra uma terceira coluna vazia | Sobrou marcação da antiga barra percentual; cada painel deve ter somente rótulo e quantidade |

---

### a) As telas, uma a uma, com o console aberto

Marque a tela quando ela **carregar dado** e o console seguir **sem `Refused to`**.

- [ ] **Painel** (`/`) — os cartões trazem números, não zeros
- [ ] **Apuratórios → lista** — a tabela lista os apuratórios
- [ ] **Apuratórios → detalhe** — registrar/corrigir remessas, julgamento e conclusão; editar o resultado de um envolvido; confirmar que só **Reabrir** remove a conclusão
- [ ] Em um **IPM**, a linha de Escrivão mostra apenas **“-”** na coluna Documento e o formulário de substituição não pede tipo/número
- [ ] Depois de concluir, desaparecem os controles de nova substituição, prorrogação e andamento; o aviso orienta usar **Reabrir**
- [ ] Com o processo concluído, chamadas diretas desses três comandos devolvem mensagem amigável e não gravam nada
- [ ] **Catálogos → Apuratórios** — a coluna **Cita documento** aparece nas funções, a alternância grava, e tornar a mesma função responsável logo depois **não** religa a flag
- [ ] **Apuratórios → formulário** — abrir "Novo" e confirmar que remessas, julgamento, conclusão, soluções e penalidade não aparecem antes do cadastro
- [ ] **Indícios** — a partir do detalhe de um procedimento, num envolvido; em processo a ação não aparece
- [ ] **Prazos** — o painel carrega
- [ ] **Usuários → lista**
- [ ] **Usuários → detalhe** — clicar numa linha
- [ ] **Usuários → novo** — o formulário abre
- [ ] **Configuração de apuratórios**
- [ ] **Catálogos** — abrir ao menos três catálogos diferentes do menu
- [ ] **Auditoria** — a lista e os três filtros
- [ ] **Designações por Policial Militar**
- [ ] **Estatísticas dos Apuratórios** — os doze cartões, em dois blocos
- [ ] **Mapa do Período** — gerar o mês sem apuratório marcado e com uma espécie marcada; os registros devem obedecer à mesma regra da tabela
- [ ] **PDF do Mapa do Período** — conferir o documento completo e uma ficha individual: capa por espécie, 7ºBPM, mês/ano, A4 paisagem **sem mexer em Orientação no diálogo**, fichas compartilhando folha, marcadores de fim, “Continuação do …” e tabelas longas sem perda. Nos enquadramentos: um bloco por natureza, artigo antes da norma, **nenhum texto repetido**, analogia recuada sob a infração do Estatuto e Resultado empilhado
- [ ] **Mapas Salvos**
- [ ] **Relatório Anual** — é a tela de Estatísticas em modo documento (rodada 29)

---

### b) Os dois caminhos que gravam arquivo

Abrem diálogo nativo — nenhum teste os cobre.

- [ ] **Exportar CSV** em Prazos → o diálogo "salvar como" abre, e o arquivo sai correto
- [ ] **Baixar o anexo** de 20 MB do **IPM nº 1/P6/7ºBPM/2024** → salva e abre
      (é o único anexo do banco; passou a usar o diálogo nativo na rodada 6, e
      antes disso provavelmente não funcionava)

---

### c) O que a rodada dos catálogos mudou (seção 12, rodada 7)

- [ ] **Apuratórios** — a coluna "Código de extensão" **não** aparece
- [ ] **Carta precatória** — criar um processo de CP e confirmar que **ainda
      exige deprecante e unidade deprecada**. É a prova de que esconder o código
      não desligou a extensão
- [ ] **Municípios e distritos** — marcar "É distrito" revela o select de
      município e o exige; desmarcar limpa
- [ ] **Municípios e distritos** — conferir por amostragem que os 60 distritos
      existentes seguem com o município certo
- [ ] **Infrações do Estatuto** — o select de dispositivo legal **não** aparece
- [ ] **Infrações do Estatuto** — cadastrar uma e conferir **na tela de indícios**
      que o rótulo sai completo, com " - Estatuto dos Policiais Militares"
- [ ] **Postos e graduações** — "Ordem hierárquica" **não** aparece
- [ ] **Usuários** — confirmar que a **ordem alfabética** é aceitável. É a
      mudança mais visível, e a única que não se desfaz sem migration nova **e**
      redigitar os 13 valores (decisão 27)
- [ ] **Catálogos** — "Subdivisões de textos normativos" sumiu do menu, e o
      formulário de Infrações penais perdeu o campo "Subdivisão"

---

### d) O seletor de analogia (seção 12, rodada 6)

Abrir os indícios de um envolvido e adicionar uma infração do Estatuto.

- [ ] A busca filtra a partir de **2 caracteres**
- [ ] O filtro por **natureza** funciona
- [ ] **`Esc`** cancela
- [ ] **Clique no fundo** cancela
- [ ] **Cancelar não grava nada** — a analogia é `NOT NULL`, então meia escolha
      não pode virar registro

---

### e) O que a rodada de correções de hoje acrescentou

#### Os seletores de militar, antes truncados

Havia um defeito que atravessou a migração inteira: os seletores eram
alimentados por um comando paginado que trava em 200, e com 235 militares os 35
últimos em ordem alfabética **não apareciam**.

- [ ] No **formulário de processo**, abrir o seletor de **envolvidos** e
      confirmar que **`ZAQUEU DE ALMEIDA KVIATKOSKI`** está na lista (é o último
      alfabético — se ele aparece, os 35 voltaram)
- [ ] O mesmo no seletor de **designações**
- [ ] Na **Auditoria**, o filtro de autor lista os autores esperados

#### Paginação nas duas listagens

- [ ] **Usuários** — o controle de página aparece no rodapé, "Próxima" avança, e
      o intervalo mostrado bate com o total (235)
- [ ] **Apuratórios** — idem, com 128 (ou 129 se o IPM de teste ainda estiver lá)
- [ ] Buscar ou trocar filtro **volta para a página 1** (não deixa tela vazia)

#### Os filtros novos de indícios

- [ ] **Infrações penais** — o select "Dispositivo" aparece ao lado da busca e
      **filtra de verdade** (há 4 dispositivos distintos entre as 26 infrações)
- [ ] **Transgressões do RDPM** — o select "Natureza" aparece e filtra

---

### f) Os campos por apuratório, e a carta precatória que voltou

A migration `0007` tornou condicionais os campos que antes apareciam nas dez espécies, e
consertou o bloco de carta precatória, que **não renderizava havia dois ciclos**.

#### O que precisa aparecer no detalhe, por espécie

Cadastre primeiro apenas Instauração e Recebimento. Remessas, Julgamento e Conclusão são
fatos posteriores e não podem aparecer no formulário geral, nem ao criar nem ao editar.
Em CD, CJ e PAD aparece somente **Remessa à comissão**; “Remessa do encarregado” não pode
aparecer, pois nesses ritos as duas datas representam o mesmo fato.

| Abra o detalhe de… | Tem de mostrar | Não pode mostrar |
|---|---|---|
| **IPM** | Escrivão (designação) | Julgamento · Remessa à comissão · Penalidade |
| **SR** ou **SV** | — | Julgamento · Remessa à comissão · Penalidade |
| **PADS** | Julgamento · Penalidade (quando a solução decidida for de punição) | Remessa à comissão |
| **PADE** | Julgamento · Penalidade | Remessa à comissão |
| **CD**, **CJ** ou **PAD** | Julgamento · Remessa à comissão · Penalidade · **Escrivão de Processo** | — |
| **CP** | **Deprecante e Unidade deprecada** | Julgamento · Remessa à comissão · Penalidade |

Em todos os processos, **Solução sugerida** não aparece. No cadastro, PADS exige uma ou
mais acusações disciplinares; CD, CJ e PAD também oferecem crime/contravenção. O detalhe
mostra o resumo das acusações sem botão de Indícios. PADE não apresenta nenhum dos dois
fluxos.

- [ ] IPM — confere a linha da tabela
- [ ] SR — confere a linha da tabela
- [ ] PADS — confere a linha da tabela
- [ ] CD — confere a linha da tabela, e o papel aparece como **Escrivão de Processo**
- [ ] **CP — criar um processo de carta precatória de ponta a ponta e salvar.** É o teste
      que importa: até agora o formulário não oferecia os campos e o backend recusava o
      salvamento, então a espécie era impossível de cadastrar

#### O que não pode acontecer

- [ ] Abrir um **PADS que já tem data de julgamento**, salvar sem tocar no campo, e
      conferir que a data **continua lá**. Campo escondido não pode apagar fato gravado
- [ ] Em *Catálogos → Apuratórios*, os atributos de comportamento aparecem e são editáveis,
      incluindo julgamento, punição, remessa à comissão, acusação, acusação penal, indícios
      e solução sugerida

#### A reforma de tela

- [ ] **Formulário** — os campos se distribuem em 2–3 colunas por bloco, e não numa
      coluna só; o resumo ocupa a linha inteira
- [ ] **Envolvidos e designações** — os campos de linhas diferentes **alinham** entre si,
      e o botão Remover fica sempre no mesmo lugar
- [ ] **Listagem** — colunas com largura estável, situação e "vencido" como etiqueta,
      cabeçalho fixo ao rolar
- [ ] **Janela estreita** — o formulário cai para 1–2 colunas e a tabela rola na
      horizontal em vez de espremer as colunas; os botões não atravessam a tela

---

### g) As listagens padronizadas (seção 12, rodada 14)

Seis listagens passaram a dez itens por página, com o desenho da listagem de
processos. Três defeitos foram corrigidos junto, e cada um só se confirma na tela.

#### O que a paginação tem de fazer

- [ ] **Usuários** — dez linhas; o rodapé diz "1–10 de 235"; "Próxima" avança até
      a última página, e "Anterior" volta
- [ ] **Apuratórios**, **Auditoria**, **Mapas Salvos** e **Catálogos** — idem,
      cada um com o seu total
- [ ] **Auditoria** — o cabeçalho **não** diz mais "últimos 200 registros": diz o
      total real do escopo, e o 201º é alcançável
- [ ] Buscar ou trocar filtro **volta para a página 1** (não deixa tela vazia)
- [ ] **Catálogos** — trocar de catálogo pelo menu volta para a página 1. Ir para
      a 4ª página de Municípios e clicar em "Postos e graduações" não pode abrir
      o vazio
- [ ] **Catálogos** — desativar um item da 3ª página **mantém** a 3ª página; se
      aquela página deixar de existir, recua uma
- [ ] Desativar/excluir o único item da última página recua sozinho

#### Prazos: os dois blocos não podem se sobrepor

É o defeito mais visível desta rodada. Antes, um prazo vencido aparecia em
**Vencidos** e outra vez em **Vencendo em até X dias**.

- [ ] Um processo com prazo **vencido** aparece só em "Vencidos"
- [ ] Um processo vencendo **hoje** aparece só em "Vencendo em até X dias"
- [ ] Os três **cartões de contagem** batem com os totais das duas tabelas —
      antes discordavam, porque o cartão usava a regra certa e a tabela não
- [ ] Os **dois paginadores são independentes**: avançar em "Vencidos" não mexe
      em "Vencendo"
- [ ] Trocar a **janela** (7/14/30/60) reinicia os dois

#### CSV e impressão levam o filtro, não a página

- [ ] **Usuários** — buscar algo que dê mais de 10 resultados, exportar CSV, e
      conferir que a planilha traz **todos** os do filtro, não os 10 da tela
- [ ] **Auditoria** — idem, com filtro de entidade aplicado
- [ ] **Prazos** — o CSV traz os dois blocos inteiros, com a coluna "Situacao"
      dizendo de qual bloco veio cada linha
- [ ] **Imprimir / PDF** nas três: o papel sai com o conjunto completo, e a
      tabela de dez **não** sai impressa junto (duplicada)
- [ ] Em **Prazos**, “Vencidos” e “Vencendo” aparecem uma vez cada; nenhum título
      original fica solto antes do bloco completo
- [ ] Se algum filtro passar de 5.000 registros, aparece o aviso dizendo que
      saíram os 5.000 mais recentes. **Não pode cortar calado**

#### O desenho, e o que a CSP recusaria

- [ ] **Apuratórios** — lado a lado com uma captura de antes: tem de estar
      **idêntica**. Foi medida propriedade a propriedade, mas o olho é o juiz
- [ ] **Larguras de coluna aparecem** em todas as listagens. Se
      `aplicarLarguras()` não rodar, as colunas voltam a se dimensionar pelo
      conteúdo e **nada acusa** — é o mesmo sintoma das barras dos painéis
- [ ] Console **sem `Refused to`** nas seis listagens. É o que pegaria uma
      largura que tenha escapado para um `style=""`
- [ ] Texto longo (nome, unidade, descrição de infração) corta com **reticências**
      e entrega o inteiro no **tooltip**
- [ ] **Estatísticas dos Apuratórios** — a descrição das infrações não está mais
      cortada em 90 caracteres com "…" no meio do texto: corta por largura e o
      tooltip traz o texto legal inteiro
- [ ] Em **1600, 1366, 1100 e 900px** nenhuma listagem operacional rola na
      horizontal; em **899px** rola, em vez de espremer as colunas
- [ ] **Designações por Policial Militar** e **Mapa do Período** continuam rolando na
      horizontal e mostrando o conjunto completo — são matrizes, não listagens

---

### h) Substituição de designações e mensagens (seção 12, rodada 15)

Esta rodada mexe em duas coisas que só a tela conta se estão certas:
o fluxo de substituição, que envolve duas linhas por operação, e o texto que o
usuário lê quando alguma coisa é recusada.

#### Preparar: duas cadeias no mesmo processo

Use um apuratório que tenha **Encarregado e Escrivão** habilitados, com o Escrivão
aceitando 2 ocupantes (*Catálogos → Configuração de apuratórios*). Cadastre um
processo com um Encarregado e dois Escrivães.

No cadastro, confira antes de salvar:

- a linha de designação tem **Papel e Militar, e mais nada** — sem campo de data;
- ao escolher Encarregado numa linha, a opção **some da outra** (fica desabilitada,
  com "já preenchido"), porque o teto é 1;
- Escrivão continua disponível nas duas, porque o teto é 2.

#### O que a tabela de Designações tem de mostrar

Sete colunas: Papel, Militar, Início, Fim, **Documento**, Motivo, **Ações**. O
militar aparece com **posto, matrícula e nome**. A designação inicial já nasce com
Documento preenchido (o documento que instaurou) e motivo "Designação inicial" —
ninguém digitou isso.

#### O fluxo, na ordem

| # | O que fazer | O que tem de acontecer |
|---|---|---|
| 1 | *Substituir* no Encarregado | Formulário abre **abaixo da tabela**, com o resumo dizendo quem está sendo substituído e desde quando |
| 2 | Salvar sem escolher sucessor | Aviso **em vermelho, embaixo do campo Sucessor**, e o foco vai para ele. Nada é salvo |
| 3 | Escolher o **mesmo** militar que já ocupa | Aviso no campo Sucessor, nomeando quem já ocupa |
| 4 | Data igual ou anterior ao início | Aviso no campo Data, com a data-limite escrita por extenso |
| 5 | Data futura | Recusada — o campo já tem `max`, e a validação repete |
| 6 | Motivo em branco | Aviso no campo Motivo |
| 7 | Escolher Documento e **não** preencher o Nº (e o contrário) | Aviso no campo que falta. Os dois são opcionais **juntos** |
| 8 | Preencher tudo e salvar | Duas linhas: a anterior encerrada na data da troca, a nova vigente **começando no mesmo dia**. Sem buraco, sem sobreposição |
| 9 | Substituir **um dos escrivães** | A cadeia do outro escrivão **não se mexe** — e os dois passam a ter *Editar* e *Remover* |

#### O que só a última pode fazer

Substitua o Encarregado **duas vezes**. Agora:

- só a **última** linha da cadeia tem *Editar* e *Remover*;
- a do meio e a inicial ficam **só com leitura** (a inicial mantém *Substituir*);
- em *Editar*, o formulário abre **preenchido** com o que está gravado, e o botão
  diz "Salvar correção";
- mudar a data na correção move **as duas** linhas: o Fim da anterior e o Início
  da corrigida andam juntos;
- *Remover* pede confirmação **nominal** — quem sai, quem volta a ser o quê;
- removida a última, a do meio **vira a última** e ganha os dois botões.

#### O cadastro depois que existe substituição

Reabra o processo em *Editar*. A designação do Encarregado tem de aparecer
**bloqueada**: sem `<select>`, com a tarja "com histórico", a borda em tom
diferente e a frase mandando usar *Substituir* na página de detalhes. O Escrivão
sem substituição continua editável e removível.

Corrija a **data de instauração** e salve: o Início das designações **sem
histórico** acompanha; as com histórico não se mexem.

#### As mensagens

Nenhuma tela pode mostrar nome de constraint, SQL, caminho de arquivo ou texto em
inglês. Três provocações rápidas:

1. Cadastrar dois processos com o **mesmo número de documento** → frase explicando
   a combinação (unidade, ano, apuratório, documento), não `uq_processo_...`;
2. Excluir um item de catálogo **já usado** → "já foi usado... Desative-o";
3. **Parar o banco** (`docker compose stop postgres`), tentar qualquer tela e
   religar → tem de dizer para **verificar o serviço do banco**, não "tente
   novamente". Religue com `docker compose start postgres`.

> Toda mensagem começa com maiúscula, termina em ponto e diz **o que fazer**. Se
> alguma só constatar o problema, é defeito — anote qual.

#### Janela estreita

Estreite a janela até ~720px. A tabela de Designações **rola dentro da própria
moldura**; a página **não** rola na horizontal. O formulário de substituição
quebra em linhas, sem campo sobrepondo outro nem escapando da borda.

---

### i) Ofendido/Vítima nos procedimentos (seção 12, rodada 17)

A informação é do **procedimento**, e ninguém a configura pela tela. Quem decide é
`apuratorios.permite_cadastro_vitima`, ligado pela `0012` nos cinco procedimentos.

#### O que tem de aparecer

| Espécie | "Ofendidos/Vítimas" | "Pessoas inquiridas" |
|---|---|---|
| IPM, SR, SV, FP, **CP** | **sim**, com "(opcional)" no título e sem seletor de papel | sim |
| CD, CJ, PAD, PADE, PADS | **não** | sim |

Na CP, o bloco tem de conviver com o de Carta precatória (Deprecante / Unidade
deprecada) — as duas seções aparecem no mesmo formulário.

#### O fluxo, na ordem

1. Num **IPM novo**, salvar **sem nenhuma** vítima. Tem de fechar: a informação é
   opcional, não obrigatória.
2. Reabrir, **Adicionar ofendido/vítima** três vezes, com um nome minúsculo, um com
   acento e "ADMINISTRAÇÃO PÚBLICA". Salvar e reabrir: os três voltam **em
   maiúsculas** e na ordem em que foram digitados.
3. **Remover** o do meio e salvar. Voltam dois, e a numeração da tela recomeça em 1.
4. Remover os dois e salvar. Fecha, e a seção volta vazia.
5. Num **PADS**, conferir que a seção **não existe** — e que "Pessoas inquiridas"
   continua funcionando normalmente.

#### O que não pode acontecer

- Em *Catálogos → Apuratórios*, **não pode haver checkbox de vítima**. Se aparecer, a
  coluna entrou no registro por engano — é o item (c) da decisão 46.
- Em *Catálogos → Papéis de pessoa*, o papel **'Vítima' aparece inativo**, e **não** é
  oferecido no seletor de "Pessoas inquiridas".
- O `<legend>` de "Pessoas inquiridas" não pode mais dizer "(vítimas, inquiridos)".

#### Na página de detalhe

Abrir o detalhe de um procedimento que tenha ofendido. Entre **Envolvidos** e
**Designações** têm de aparecer, nesta ordem:

| Bloco | Colunas | Quando aparece |
|---|---|---|
| **Ofendidos/Vítimas** | `#` e `Nome` | espécie que registra ofendido, **ou** registro que já tem um gravado |
| **Pessoas inquiridas** | `Papel` e `Nome` | só quando há pelo menos uma |

Com a massa que já está no banco:

- **SR nº 6/7ºBPM/2026** — dois ofendidos, `ADMINISTRAÇÃO PÚBLICA` (1) e
  `MARIA FERREIRA` (2), nessa ordem.
- **IPM nº 2/7ºBPM/2026** — um, `MANUEL GOMES`.
- Qualquer **PADS/CD/PAD** — **nenhum** bloco de Ofendidos/Vítimas.
- Hoje **nenhum** registro mostra Pessoas inquiridas: `processo_pessoas` está
  vazia. Para ver o bloco, cadastre um inquirido pelo formulário e reabra.

Nada ali é editável — sem botão de incluir ou remover. O cadastro é do
formulário, e só dele.

**O Resumo dos fatos é a última seção da página**, em largura inteira — saiu da
ficha do topo, onde ficava espremido. Para conferir o que importa nele, edite um
procedimento e escreva no campo Resumo **dois parágrafos separados por linha em
branco**, mais uma URL longa sem espaços. Salvar e abrir o detalhe:

- os dois parágrafos aparecem **separados**, não emendados num bloco corrido;
- a URL **quebra dentro do parágrafo**; a página não pode rolar na horizontal,
  nem a 720px de largura;
- num registro sem resumo, o título continua lá com `Nenhum resumo registrado.`;
- e o resumo **não** aparece mais na ficha do topo — se aparecer nos dois lugares,
  a linha antiga não foi removida.

#### A preservação do que já foi gravado

Este é o caso que só a tela pega. Pelo `psql`, num procedimento que já tem vítima:

```sql
UPDATE apuratorios SET permite_cadastro_vitima = false
 WHERE id = (SELECT apuratorio_id FROM processos_procedimentos WHERE id = '<o processo>');
```

Reabrir o cadastro. As vítimas têm de aparecer **em texto**, com o aviso de que a
espécie não as registra mais — e, **na página de detalhe, o bloco tem de continuar
aparecendo também**. **Salvar sem mexer em nada** e reabrir: elas continuam lá. Se sumirem, `gravar_vitimas` está sincronizando quando não devia — é o princípio
5, e o teste `vitima_historica_sobrevive_ao_desligar_a_configuracao` cobre o backend,
mas só a tela prova que o formulário não as reenviou.

Depois, religar o atributo pelo `psql` e conferir que a seção volta editável.

---

### j) A amostra dos 6 processos

O campo a campo já está feito e acusa **0 divergências em 377 comparações**,
rodado contra o banco de produção. O que falta é o olho: rótulo, layout, o que a
Seção reconhece.

| Processo | Id | Por que este |
|---|---|---|
| IPM nº 8/7ºBPM/2024 | `10b39de3-fad8-4e93-9cea-7b2027118253` | 9 envolvidos (o máximo) e substituição de encarregado colapsada |
| IPM nº 1/7ºBPM/2024 | `ec07f120-e4c5-4337-b628-592c5859339c` | 8 prorrogações — a cadeia de prazos mais longa |
| IPM nº 1/P6/7ºBPM/2024 | `b0294d82-4d35-46d4-a10f-2bd2b555d462` | o anexo de 20 MB |
| PADS nº 1/7ºBPM/2025 | `22ce21be-aa00-42b5-98cd-65e1d328ba4e` | penalidade + envolvido criado (decisão 14) + enquadramento do jsonb |
| CP nº 1/7ºBPM/2025 | `6b1f19a8-4ab8-4ecc-b596-27480bf9e017` | a extensão de carta precatória |
| SR nº 20/7ºBPM/2025 | `980f1a82-3771-4193-b43b-37a09eadf0c5` | três trocas de encarregado no mesmo dia, colapsadas em uma |

- [ ] IPM nº 8/7ºBPM/2024
- [ ] IPM nº 1/7ºBPM/2024
- [ ] IPM nº 1/P6/7ºBPM/2024
- [ ] PADS nº 1/7ºBPM/2025
- [ ] CP nº 1/7ºBPM/2025
- [ ] SR nº 20/7ºBPM/2025

**Confira em especial o que a importação transformou**, e não só copiou:
responsável vigente, cadeia de prazos, envolvidos com solução e penalidade,
vítimas (o legado guardava array JSON), enquadramento, e o município nos
processos de distrito (Bom Futuro, Jaci-Paraná, Joelândia, Tarilândia — vinham
como `"Distrito (Município)"`).

Para ver o mesmo registro do lado do legado, **enquanto o schema ainda existe**:

```bash
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -x -c \
  "SELECT * FROM legado.processos_procedimentos WHERE id = '<id>';"
```

---

### Aceitou tudo?

Então a limpeza final (é a Fase 4 do plano):

1. Rodar `99_conferencia.sql` e conferir as 38 contagens e as 51 invariantes
2. Resolver o `pendencias.csv` na tela — as 10 analogias provisórias primeiro
3. **Não** remover o schema `legado`: metade das invariantes o compara, e as
   pendências do prazo reconstruído e do elo perdido só são deriváveis com ele
   (ver o fim da seção 6.2)

Os processos de teste não estão mais nessa lista: quem os apaga é a etapa
`00_limpeza_testes.sql`, dentro da transação da migração, conferindo os 13 UUIDs
um a um antes.

**Achou divergência na amostra?** Ela é de mapeamento, não de dado: corrija a
etapa correspondente em `src-tauri/importacao/` e rode o roteiro do zero.

> ⚠ **Cuidado:** o roteiro do zero recria o banco. Se alguém já tiver lançado
> processo real pelo app, ele se perde. Hoje há **um backup verificado** em
> `~/backups/adm-p6/`, restaurado e conferido contra a origem — inclusive o
> anexo de 20 MB, byte a byte.

---

### k) "À apurar", seletores pesquisáveis e cadastro rápido (seção 12, rodada 23)

A parte que o `cargo test` alcança está travada por teste. O que sobra aqui é o que só
o olho vê — e a CSP restritiva, que **só vale no binário de produção**
(`npm run tauri build`); em `tauri dev` a `devCsp` afrouxa `style-src` e
esconderia um `style` recusado.

#### O envolvido ainda não identificado

- [ ] No formulário de processo, o seletor de **Militar** de um envolvido traz
      **"À apurar — PM ainda não identificado"** logo abaixo da opção vazia
- [ ] Escolhendo-a, o checkbox **Condutor** fica desabilitado, com a nota
      "Identifique o PM antes de marcá-lo como condutor"
- [ ] Com um envolvido já "À apurar", a mesma opção aparece **desabilitada** na
      linha do outro envolvido
- [ ] Salvo o processo, a **listagem**, o **detalhe**, o **mapa do período** e o
      **PDF** escrevem só `À apurar` — sem posto vazio à frente nem matrícula em branco
- [ ] O painel de **indícios** lista o "À apurar" na ordem e aceita enquadramento
- [ ] **Identificar depois**: editar o processo, trocar "À apurar" por um militar,
      salvar, e conferir que enquadramento, indícios, **resultado** e situação
      continuam lá
- [ ] **Corrigir para trás**: trocar um militar registrado por "À apurar" e conferir
      o mesmo
- [ ] Em **Usuários**, o cadastro "À APURAR" (matrícula `100000000`) aparece só com
      "incluir inativos" marcado, e **não** aparece em nenhum seletor

#### Os seletores pesquisáveis

- [ ] Digitar em cada seletor filtra: militar por **nome e por matrícula**, catálogo
      por qualquer pedaço do rótulo
- [ ] Busca **sem acento** acha o com acento (`municipio` acha `Município`)
- [ ] ↑ ↓ percorrem, **Enter** escolhe, **Esc** fecha; **Tab** sai do campo
- [ ] Campo obrigatório vazio ainda bloqueia o salvamento e mostra a mensagem —
      é o `<select>` escondido que valida, e é a metade mais fácil de quebrar
- [ ] "Nenhum resultado para …" aparece em português
- [ ] Um processo antigo com catálogo **desativado** continua exibindo a opção
      histórica ao abrir para edição
- [ ] Trocar apuratório, natureza ou unidade **redesenha** o formulário e os
      seletores continuam funcionando (é aí que um `TomSelect` não destruído vaza)

#### O cadastro rápido em modal

Para cada um dos sete — PM (envolvido **e** designado), unidade de origem, unidade
deprecada, subunidade/seção, município, natureza geral do fato, situação do envolvido,
papel de pessoa:

- [ ] O "+" abre o modal, o foco entra nele, **Esc** e **Cancelar** fecham, e o foco
      volta para o "+"
- [ ] Salvando, o registro novo **já vem selecionado** naquele campo
- [ ] Todo o resto do formulário continua preenchido, e o aviso de alterações
      pendentes continua de pé
- [ ] A **subunidade** criada pelo atalho já vem com a unidade atual, e passa a
      aparecer no seletor filtrado por ela
- [ ] O PM criado por uma **designação** vem com "Pode ser designado" sugerido; o
      criado por um **envolvido**, não
- [ ] Erro do backend (nome repetido, por exemplo) aparece **dentro** do modal, sem
      fechá-lo e sem perder o que foi digitado
- [ ] Apuratório, documento iniciador, papel de designação e as classificações
      jurídicas **não** têm "+" — e continuam pesquisáveis
- [ ] Em **largura de tablet e de celular**, o modal cabe na tela, o conteúdo rola
      dentro dele e os botões ficam alcançáveis

---

### l) Pesquisa instantânea e filtros avançados dos apuratórios (seção 12, rodada 24)

Mesma advertência da (k): o binário de produção, e o console aberto. O modal de filtros
é o **primeiro** lugar do app em que um `TomSelect` vive dentro de um modal que a CSP
restritiva também governa — os dois já foram exercitados, mas nunca juntos.

#### A pesquisa que filtra ao digitar

- [ ] A barra de pesquisa tem **uma linha só** e a mesma altura da de Catálogos —
      foi medida em 70px, e já esteve em 340px sem que nada acusasse
- [ ] Digitar filtra sozinho, sem apertar nada; o **foco e a posição do cursor** ficam
      onde estavam, e a barra de pesquisa não pisca
- [ ] A busca acha por **número, controle, SEI, RGF, resumo**, e agora também por
      **nome do encarregado** e **nome de PM envolvido**
- [ ] Digitar rápido e apagar em seguida não deixa um resultado antigo na tela —
      é o descarte de resposta atrasada
- [ ] Apagar tudo devolve a listagem inteira, na página 1

#### O modal de filtros avançados

- [ ] O botão abre o modal; **Esc**, **Cancelar** e clique no fundo fecham, e o foco
      volta para o botão
- [ ] Os seis seletores pesquisáveis abrem e buscam **dentro do modal**, sem nenhum
      `Refused to` no console
- [ ] As opções trazem só o que algum apuratório usa; o cadastro **desativado em uso**
      aparece marcado `(inativo)`
- [ ] Combinar três filtros recorta por todos ao mesmo tempo, e o **total** e o
      controle de página batem com o que a tabela mostra
- [ ] Data inicial maior que a final mostra a mensagem **dentro** do modal e não aplica
- [ ] **Limpar filtros** esvazia os campos e **o modal continua aberto** — inclusive os
      seletores pesquisáveis, que precisam voltar ao placeholder, não ao rótulo antigo
- [ ] Limpar e em seguida **Cancelar** descarta a limpeza: a listagem não muda
- [ ] Os *chips* abaixo da barra mostram cada filtro aplicado, e clicar em um remove só
      aquele; o contador no botão acompanha
- [ ] Sair da tela e voltar preserva os filtros, e os chips continuam dizendo quais são
- [ ] Em **largura de celular** o formulário vira uma coluna e os botões empilham, com
      *Aplicar* em cima

---

### m) Auditoria legível (seção 12, rodada 25)

- [ ] A tabela tem quatro colunas — **Quando, Quem fez, O que foi feito, Sobre o quê** —
      e nenhum nome de tabela, verbo em inglês ou UUID à vista
- [ ] A data sai em `31/08/2026 16:10:39`, e não em ordem americana
- [ ] Os registros anteriores à `0018` aparecem com a frase de reserva, e os 9 sem
      assunto dizem "registro já removido" em vez de linha vazia
- [ ] Os filtros dizem **Sobre o quê**, **Tipo de ação** e **Quem fez**, com os nomes em
      português e a contagem ao lado; o total do rodapé bate com a tabela
- [ ] Abrir uma linha: o detalhe repete as quatro, mostra "O que mudou" quando houver
      diff (em `campo: de X para Y`, não JSON), e traz tabela/registro/operação no bloco
      **Rastreio**, ao pé
- [ ] **Catálogos → Configuração de apuratórios**: desativar um documento iniciador e uma
      função **grava** — é o defeito que ficou latente desde a `0001` — e a trilha
      registra "Desativou…" com a sigla do apuratório
- [ ] Reabrir um apuratório e conferir que a linha diz **"Reabriu o apuratório"**, e não
      "Alterou"; registrar conclusão diz "Registrou as datas do fluxo"
- [ ] Excluir uma prorrogação e conferir que a trilha continua nomeando o apuratório
- [ ] CSV e impressão saem com as quatro colunas (o CSV leva também entidade e registro)

---

### n) Pesquisa instantânea em Catálogos e Usuários (seção 12, rodada 26)

Mesma advertência das anteriores: o binário de produção, e o console aberto. O que se
confere aqui é sobretudo o que **não** acusa sozinho — a largura das colunas depois do
redesenho parcial.

#### Nas duas telas

- [ ] Digitar filtra sozinho, sem apertar nada; o **foco e a posição do cursor** ficam
      onde estavam, e a barra não pisca
- [ ] A barra continua numa linha só, na mesma altura de antes — medir, não olhar
- [ ] **As colunas mantêm a mesma largura depois de filtrar**: é o que cai se
      `aplicarLarguras` faltar, e cai calado
- [ ] Apagar tudo devolve a listagem inteira, na página 1
- [ ] A contagem do cabeçalho acompanha o filtro, e o controle de página bate com o que
      a tabela mostra
- [ ] Estreitar o filtro estando na 4ª página recua a página em vez de mostrar tabela
      vazia
- [ ] Enter busca na hora, sem esperar o quarto de segundo

#### Catálogos

- [ ] Digitar **não** dispara consulta nenhuma — a rede fica quieta enquanto se digita
- [ ] Editar, desativar e reativar continuam funcionando **depois** de um filtro, e
      mantêm a página
- [ ] Desativar com "Mostrar inativos" desmarcado tira a linha da lista, e marcar a
      caixa a traz de volta — a caixa recarrega a tela inteira, de propósito
- [ ] Trocar de catálogo pelo menu volta à página 1; o termo digitado continua no campo
      e continua valendo, como antes
- [ ] O vazio diz "Nenhum registro encontrado." quando há termo, e "Nenhum registro."
      quando não há

#### Usuários

- [ ] Não há mais botão "Buscar"; **Limpar** aparece só quando há termo, devolve o foco
      ao campo e recarrega a lista
- [ ] Digitar rápido e apagar em seguida não deixa resultado antigo na tela — é o
      descarte de resposta atrasada
- [ ] **Exportar CSV** e **Imprimir** logo depois de digitar levam o termo **atual**, e
      o conjunto inteiro do filtro, não os dez da tela
- [ ] O botão de CSV some quando o filtro não acha nada, e volta quando acha
- [ ] Abrir o detalhe de um militar e voltar preserva o termo e a página
- [ ] A barra de pesquisa **não** sai no papel

---

### o) Desativar e excluir militar (seção 12, rodada 27)

O binário de produção, e o console aberto. **Faça num banco descartável ou combinado com
o responsável**: a exclusão é física e não se desfaz.

- [ ] Cada linha da listagem tem **três** ícones: abrir, desativar (ou reativar, se já
      inativo) e excluir — e só o de excluir é vermelho
- [ ] Os três cabem na coluna sem passar da borda da tabela nem criar rolagem
      horizontal, inclusive em janela de 1024px
- [ ] **Com perfil somente leitura, só o de abrir aparece**
- [ ] Desativar pede confirmação nomeando o militar, e a linha passa a "inativo" sem
      sair da listagem; o ícone do meio vira Reativar
- [ ] Se o militar tinha conta de acesso, ela fica **inativa** junto — conferir na
      coluna "Usuário do sistema"
- [ ] Reativar devolve os dois ao ativo
- [ ] Desativar **a própria conta** é recusado com a mensagem de pedir a outro
      administrador; desativar o **último** administrador também é recusado
- [ ] Excluir um militar **com histórico** é recusado, e a mensagem diz **qual** vínculo
      segurou (conta de acesso, designações, envolvimentos ou prorrogações) e manda
      desativar — o cadastro continua lá depois da recusa
- [ ] Excluir um militar recém-cadastrado, sem nada pendurado, tira a linha da listagem
      e ela não volta em busca nenhuma
- [ ] A confirmação de excluir avisa que **não há como desfazer** e sugere Desativar
- [ ] Excluir o único item da última página recua a página em vez de mostrar tabela vazia
- [ ] No **detalhe** do militar existe agora **Desativar** (e Reativar quando inativo) —
      excluir não fica aqui, de propósito
- [ ] Na **Auditoria**: a desativação aparece como "Desativou o policial militar" com tipo de ação
      **Alterou**, e a exclusão como "Excluiu o militar" nomeando quem foi — mesmo depois
      de a linha ter sumido do banco

---

### p) Painéis analíticos e o PDF deles (seção 12, rodada 28)

> ⚠ **A rodada 29 mudou o elenco analítico para quatro telas:** Painel, Prazos,
> Estatísticas dos Apuratórios e Designações por Policial Militar. O Relatório Anual é
> documento separado, não modo de Estatísticas; “Visão Geral” não existe mais.

O binário de produção, e o console aberto.

**Na tela**

- [ ] Cada cartão tem o alternador **Gráfico / Tabela**, e a escolha **sobrevive** a sair
      da tela e voltar — é por cartão, guardada no `localStorage`
- [ ] O gráfico volta a desenhar ao voltar da tabela (não fica em branco nem cortado)
- [ ] Passar o mouse numa barra mostra o **rótulo inteiro**, mesmo quando o eixo corta
      com `…`; num empilhado, as duas séries e o tipo do apuratório
- [ ] O percentual do tooltip diz **de que** ele é: "do apuratório" no empilhado,
      "do total" nos rankings
- [ ] Onde o gráfico mostra "Top 12", a **tabela do mesmo cartão mostra todos**
- [ ] Cartão sem dado no escopo mostra "Nada registrado neste escopo" — e **falha de
      backend não vira cartão vazio**: aparece a mensagem de erro da tela
- [ ] Em Estatísticas, marcar dois ou três apuratórios e **Aplicar** recarrega todos os
      cartões, os chips continuam marcados e a linha "Escopo aplicado" acompanha
- [ ] **Designações por Policial Militar**: a matriz militar × apuratório aparece **sem precisar
      clicar em nada**, abaixo do cartão do ranking
- [ ] Em janela de **1024px** (o mínimo da janela do Tauri) nenhuma tela ganha rolagem
      horizontal; encolhendo mais, os cartões passam a uma coluna e as legendas
      continuam legíveis

**No teclado**

- [ ] Tab alcança **os dois** botões do alternador, não só o selecionado
- [ ] Espaço e Enter alternam, e o anel de foco aparece nos dois

**No papel — é aqui que mora o risco**

Imprimir para arquivo nas **quatro telas analíticas**, e abrir o PDF:

- [ ] A folha sai **paisagem** (o `GtkPageSetup`, não o `@page` — ver a rodada 21)
- [ ] Os gráficos **não estão esticados**: círculo redondo na rosca, texto do eixo com a
      mesma proporção da tela. Um texto "achatado" na vertical é o sintoma exato de a
      caixa ter mudado depois de o canvas ser desenhado
- [ ] Nos rankings, **os rótulos não se encavalam** — o de cima não invade a linha do de
      baixo
- [ ] O gráfico fica **centrado** no cartão, e nenhum cartão é partido pela quebra de
      página
- [ ] O texto do gráfico está **nítido**, não borrado (o bitmap sai ao dobro da densidade)
- [ ] O PDF respeita a visualização escolhida: cartão em **Tabela** imprime a tabela, e
      não um quadro branco
- [ ] Em **Prazos**, as duas listagens saem **completas**, não com os dez itens da página
- [ ] Filtros, alternadores e botões **não** aparecem no papel
- [ ] A matriz geral de Designações vira a tabela vertical
      `Militar | Apuratório | Quantidade`, com total por militar e total geral

### p-ter) O gráfico no papel e a folha 1 de Designações (seção 12, rodada 31)

O binário de produção — o arnês imprime com `print_()`, e a armadilha da folha
girada só aparece pelo `run_dialog`.

- [ ] **Designações por Policial Militar**, cartão em **Gráfico** → Imprimir/PDF: a folha 1
      leva título, os quatro KPIs **e** as primeiras linhas da matriz; o gráfico
      sai desenhado (não uma faixa preta) e não esticado; o cartão está na
      **última** folha
- [ ] A mesma tela em **Tabela**: o cartão imprime a tabela, e não o gráfico
- [ ] **Painel** e **Estatísticas**: todos os gráficos aparecem desenhados no
      papel. A folha órfã dessas duas continua lá, por decisão da rodada
- [ ] Console **sem violação de CSP** nas três telas — o `data:` do `img-src` é a
      única concessão, e ela vale só para imagem
- [ ] **Cancelar** o diálogo devolve a tela ao normal: gráfico no lugar do `<img>`,
      cartão de volta à posição de tela, fragmentos removidos
- [ ] **Mapa Mensal** inalterado

### p-septies) Mapas salvos (seção 12, rodada 35)

O binário de produção, com o console aberto.

- [ ] **Mapa do Período** → gerar → **Salvar**: o véu passa por "Reunindo o
      documento completo…" e "Salvando…", e o toast diz que salvou os dois
- [ ] As datas da tabela do mapa saem `dd/mm/aaaa` — nesta tela **e** no mapa
      salvo, que dividem a mesma `linhaMapa`. Sem conclusão a coluna continua
      dizendo "em andamento", não travessão
- [ ] **Mapas Salvos**: a coluna **AÇÕES** com três ícones, e cada um fazendo a
      **sua** coisa. Se dois deles abrirem a mesma tela, é `data-` repetido
- [ ] **Ver resumo**: cabeçalho com título, período em `dd/mm/aaaa`, os três
      totais e quem gerou. **Nenhum `undefined`** — era o defeito da rodada
- [ ] "Imprimir / PDF" dali leva esse cabeçalho ao papel
- [ ] **Ver PDF completo**: capas e fichas iguais às que a tela do período
      produz para o mesmo escopo. Comparar os dois PDFs lado a lado é a
      conferência que importa
- [ ] **Excluir** tira da listagem e o contador do título acompanha — e o
      resumo **não** tem mais esse botão: lá ficam só Voltar e Imprimir / PDF
- [ ] Clicar em "Ver PDF completo" e fechar o diálogo: **o ícone continua lá**.
      Quadrado em branco no lugar dele é o defeito do `comCarregamento`
- [ ] Nenhuma coluna da listagem invade a vizinha — em especial "Em", e com a
      janela estreitada até o mínimo (1024). O período usa duas linhas de
      propósito; título e "gerado por" cortam com reticências e mostram o valor
      inteiro no `title`
- [ ] O que o banco gravou:
      `SELECT jsonb_object_keys(dados_mapa) FROM mapas_salvos;` → `versao`,
      `resumo`, `completo`

### p-sexies) O brasão nos documentos e o ícone do app (seção 12, rodada 34)

O binário de produção — é ele que carrega a CSP restritiva, e o brasão é uma
imagem que ela precisa aceitar.

- [ ] Imprimir as **oito** telas do caminho comum — Painel, Estatísticas,
      Prazos, Auditoria, Usuários, detalhe do militar, Designações e Mapa
      Salvo — e conferir em cada PDF: brasão **centralizado** no topo da folha 1,
      as duas linhas abaixo dele, o título da tela em seguida
- [ ] O brasão **aparece** — se sair um espaço em branco no lugar, o `decode()`
      não foi esperado (seção 7). `pdfimages -list` mostra a imagem e a `smask`
- [ ] Só na folha 1: o caminho comum não repete cabeçalho por folha
- [ ] **Auditoria** e **detalhe do militar** são os dois em **retrato** — o
      cabeçalho centraliza igual na folha mais estreita
- [ ] **Relatório Anual**: a capa como sempre foi, com **um** brasão só
- [ ] **Mapa Mensal → Gerar PDF**: capa e fichas idênticas às de antes. O
      `controle-mapa.sh` já provou pixel a pixel, mas é o documento que ninguém
      pediu para mexer
- [ ] Nenhuma das oito telas mudou **na tela**: o cabeçalho não existe fora da
      janela de impressão
- [ ] O ícone do app na barra de tarefas e no lançador, em tema **claro e
      escuro** — o fundo é transparente, e um halo claro em volta do distintivo
      significa que a limpeza do PNG não pegou
- [ ] `npm run tauri build` empacota sem `--no-bundle`, e o `.deb` traz
      `usr/share/icons/hicolor/*/apps/adm-p6-tauri.png`

### p-quinquies) Loaders e a tabela do mapa (seção 12, rodada 33)

O binário, com o console aberto.

- [ ] **Login**: o botão vira "Entrando…" e o véu cobre a tela. Errando a senha,
      **e-mail e senha continuam digitados** e a mensagem aparece no formulário
- [ ] Acertando, o toast "Bem-vindo(a), …" aparece com posto, matrícula e nome
- [ ] Trocar para **Estatísticas**: o véu aparece e a tela anterior fica inerte
- [ ] Imprimir em **Painel, Estatísticas, Designações, Anual e Mapa Salvo**: as
      cinco agora dão retorno; cancelar o diálogo devolve tudo ao normal
- [ ] **Mapa Mensal → Gerar PDF**: as três mensagens de fase aparecem, e a
      contagem de folhas do PDF é a mesma de antes desta rodada
- [ ] A tabela do mapa, nas **duas** telas: grade vertical, cabeçalho
      centralizado, datas sem quebrar, texto longo truncado com `title` — e
      ainda rolando na horizontal quando a janela é estreita
- [ ] Selecionando SR, IPM, PADS e mais um: as capas do PDF saem nessa ordem, e a
      tabela da tela também. Os **checkboxes do filtro seguem alfabéticos**
- [ ] Com `prefers-reduced-motion` ligado: o giro para, e o véu com a mensagem
      continua dizendo o que está acontecendo
- [ ] **Catálogos → Apuratórios**: o campo "Ordem no mapa" aparece e é
      obrigatório ao criar uma espécie nova, como o prazo base

### p-quater) O recorte "em andamento" (seção 12, rodada 32)

- [ ] Em **Designações por Policial Militar**, "Situação" oferece "Em andamento (todos)"
      entre "Concluídos" e "Em andamento no prazo"
- [ ] Escolhendo-o, o total de cada militar é a soma do que "Em andamento no
      prazo" e "Em andamento vencido" devolvem separadamente
- [ ] A linha "Escopo aplicado" nomeia o recorte escolhido
- [ ] O CSV e o PDF saem com o mesmo recorte da tela

### p-bis) O arnês de impressão (seção 12, rodada 30)

A conferência acima é de olho, e olho não pega registro que sumiu. O que dá para
medir, mede-se antes — e **sem abrir a aplicação**:

```bash
npm run build
npx vite-node tools/impressao/gerar-fixturas.ts
python3 tools/impressao/imprimir.py --todas
python3 tools/impressao/conferir.py --todas       # --imagens rasteriza em PNG
tools/impressao/controle-mapa.sh                  # obrigatório: Mapa Mensal
```

O arnês imprime pelo **WebKitGTK**, com o mesmo page setup de
`print/commands.rs`. Cada linha das fixturas carrega dois marcadores, e daí saem
as três perguntas que a leitura do PDF não responde: nenhum registro se perdeu,
nenhuma linha foi partida entre folhas, e o cabeçalho aparece **uma** vez por
folha. As fixturas `medicao-*` não asseram — elas registram o que o motor faz
sem a fragmentação, e é delas que sai cada `linhasPorFragmentoImpressao`.
`tools/impressao/README.md` tem o resto.

**O que o arnês não alcança**, e por isso continua no roteiro de olho acima:
gráfico com **dado real** (o desenho das fixturas é sintético; o que elas provam
é que um `<canvas>` sai preto e um `<img>` não), cancelamento do diálogo, o teto
de 5.000 registros, e a armadilha da folha girada — que só aparece pelo
`run_dialog`, não pelo `print_()` do arnês.

Desde a rodada 31 o arnês **imprime com o compositing ligado** nas fixturas que
pedem (`compositing: true` no manifesto, num processo à parte, porque a variável
de ambiente tem de valer antes de o GTK inicializar), e `conferir.py` reprova
folha com mais de 3% de preto chapado. Sem as duas coisas o gráfico não pintado
passava: o PDF continua com todas as palavras no lugar.

### q) Painéis sem repetição e carga por militar (seção 12, rodada 29)

O binário de produção, e o console aberto. As quatro telas de relatório.

**A repetição acabou — é o que este item existe para provar**

- [ ] Os quatro KPIs do acervo (total, em andamento, concluídos, prazos vencidos)
      aparecem **só** no Painel
- [ ] "Evolução das instaurações", "Unidades de origem" e "Natureza geral do fato"
      aparecem **só** em Estatísticas dos Apuratórios
- [ ] O gráfico de criticidade dos prazos aparece **só** no Painel; em Prazos ficaram os
      quatro KPIs e as duas listagens
- [ ] "Visão Geral dos Apuratórios" **não está** no menu
- [ ] "Relatório Anual" abre um **documento**, não o painel: capa com brasão, ano e
      unidade, e onze seções numeradas, só com tabelas — sem chips, sem alternador
      Gráfico/Tabela e sem gráfico nenhum
- [ ] Trocar o ano e **Emitir** reemite o documento inteiro; o seletor não oferece "Todos"
- [ ] O botão "Ver todos em Prazos", no Painel, leva à tela de Prazos — e **não** aparece
      no papel

**Estatísticas dos Apuratórios**

- [ ] Os doze cartões aparecem em dois blocos, "Acervo" e "Apuração"
- [ ] Marcar dois apuratórios e um ano e **Aplicar**: todos os cartões recarregam, os
      chips continuam marcados e a linha "Escopo aplicado" acompanha
- [ ] "Evolução das instaurações" continua mostrando **todos** os anos mesmo com um ano
      escolhido — é o comportamento declarado na descrição do cartão, não um filtro que
      não pegou. Marcar um apuratório, esse sim, muda a série
- [ ] O CSV sai com todas as quebras e traz o escopo nas duas primeiras linhas

**Designações por Policial Militar**

- [ ] A barra de filtro tem sete campos: Ano, Militar, Situação, Ordenar por, Vínculo,
      Apuratórios e Funções
- [ ] O seletor de militar é pesquisável (digitar filtra) e cabe na barra sem esticá-la
- [ ] Sem militar escolhido: a tabela do cartão lista **todos** os militares do escopo com
      as colunas de situação, e a matriz militar × espécie continua abaixo
- [ ] Marcar `IPM` + função `Encarregado` responde "quais encarregados estão com IPM" —
      confira um deles contra a tela de Prazos
- [ ] Escolher um militar troca a tela: os KPIs passam a ser dele (total, concluídos, no
      prazo, vencido), o cartão vira "Situação por espécie de apuratório" e a matriz sai
- [ ] Escolher um militar **sem designação no escopo** mostra os KPIs zerados **com o nome
      dele**, e a mensagem "Nenhuma designação deste militar neste escopo" — não pode cair
      calado na visão de todos
- [ ] "Sem prazo definido" só vira coluna e série quando alguém no escopo está nesse
      estado; onde não há, a legenda tem três séries
- [ ] O alternador de vínculo muda os números: um militar substituído tem menos em
      "Somente as vigentes" do que em "Todas as designações"
- [ ] A soma das colunas de situação bate com o Total, linha a linha
- [ ] **Situação = Em andamento vencido**: cada militar passa a mostrar só os vencidos, as
      colunas dos outros baldes somem e "Últ. conclusão" fica em "—" (vencido não tem
      conclusão, e a data não pode vir do que o filtro excluiu)
- [ ] **Situação = Concluídos + Ordenar por Conclusão mais recente**, com `SR` marcado:
      o primeiro da lista é o encarregado que concluiu por último — confira a data dele
      contra a tela do apuratório
- [ ] **Conclusão mais antiga**: quem nunca concluiu nada continua **no fim** da lista, e
      não no começo
- [ ] **Recebimento mais antigo** responde quem está com procedimento na mão há mais tempo
- [ ] As colunas "Últ. recebimento" e "Últ. conclusão" aparecem em qualquer ordenação, e
      as datas saem em dd/mm/aaaa
- [ ] O CSV traz as quatro colunas de situação, as espécies e as duas datas

**No papel, e no teclado**

- [ ] O **Relatório Anual** imprime com a capa sozinha na primeira folha, e nenhuma seção
      é partida entre páginas (título numa folha e tabela na seguinte é o defeito clássico)
- [ ] As telas imprimem em paisagem, com os gráficos não esticados e os rótulos do
      empilhado sem se encavalar
- [ ] Filtros, chips e alternadores não aparecem no papel
- [ ] Em 1024px nenhuma das quatro ganha rolagem horizontal; a barra de filtro de
      Designações quebra em linhas e os chips continuam legíveis
- [ ] Tab alcança os dois botões do alternador Gráfico/Tabela em todos os cartões novos

---

## 12. Changelog — as 35 rodadas

O que cada rodada resolveu, em ordem. O **porquê** de cada decisão está na seção 3, e
o que cada uma ensinou está na seção 7 — aqui fica só o registro de que aconteceu.
A narrativa completa de cada uma está no histórico do git.

| # | Rodada | O que entregou |
|---|---|---|
| 1 | Frontend | 1 arquivo de 2.124 linhas → 17 módulos TS/CSS. Relatório anual como HTML + impressão, sem crate de PDF |
| 2 | Cobertura | testes para os módulos que não tinham nenhum |
| 3 | `cargo sqlx prepare` | **resolvido por outro caminho**: `tests/sql_prepare.rs` alcança as 132 consultas literais contra as 9 que a macro alcançaria |
| 4 | Views | `v_processos_detalhados`, a composição comum de processo |
| 5 | **Importação dos dados de produção** | 128 processos · 193 envolvidos · 123 enquadramentos, em 8 etapas de SQL. Roteiro na seção 6 |
| 6 | Higiene | CSP restritiva ligada; sobras do app anterior removidas |
| 7 | Catálogos administráveis | decisões 26–30: `e_distrito`, `e_estatuto_militar`, subdivisões removidas |
| 8 | *(não é rodada)* | **O que NÃO está planejado** — seção 10 |
| 9 | 🔴 O que a conferência de tela achou | **os seletores de militar truncavam em 200 em silêncio** — 35 militares invisíveis por toda a migração. Daí a regra "lista de opções não pagina" |
| 10 | Campos por apuratório | os 3 atributos que decidem os campos; **a carta precatória estava impossível de cadastrar e nada acusava**. Reforma do formulário e da listagem |
| 11 | Mensagens e prazo | seletor de datas; `data_recebimento` e o prazo inicial sincronizados nos dois sentidos |
| 12 | Prorrogação | informada pelo **novo vencimento**, não por dias (decisão 34) |
| 13 | Prorrogação, edição e exclusão | só a última, de trás para frente (decisões 36 e 37) |
| 14 | Listagens | as seis padronizadas, dez por página, largura de coluna declarada |
| 15 | Designações | cadeia de substituição com vínculo explícito (`designacao_anterior_id`); ~87 mensagens públicas revistas |
| 16 | Datas pós-cadastro | remessa e julgamento saíram do cadastro para o detalhe; as duas remessas unificadas |
| 17 | **Ofendido/Vítima** | tabela própria `processo_vitimas`, atributo por apuratório, e os blocos do detalhe. Detalhe abaixo |
| 18 | Datas do fluxo | cadeia Instauração ≤ Recebimento ≤ Remessa ≤ Julgamento ≤ Conclusão, com etapas opcionais e proteção no formulário, backend e banco |
| 19 | Origem detalhada | catálogo de Subunidade/Seção, vínculo opcional à unidade e novo escopo de numeração |
| 20 | PDF do mapa mensal | impressão A4 paisagem do mapa corrente, completa ou individual, com capa por apuratório e fichas detalhadas em fluxo contínuo |
| 21 | Paisagem de verdade | a folha do PDF saía retrato: o WebKitGTK ignora `@page { size }`. A orientação passou para o `GtkPageSetup`, em `print::commands::print_landscape` |
| 22 | Enquadramentos e indícios | citação com o artigo na frente (`Art. 312 do Código Penal Militar`), descrição sem repetição, bloco disciplinar único com a analogia recuada, e Resultado empilhado. Migration `0015` traz `dispositivos_legais.nome_feminino` |
| 23 | **"À apurar" e seleções pesquisáveis** | o PM fictício virou estado do vínculo (`0016`); envolvidos sincronizados pelo id da linha; todo seletor do formulário de processo pesquisável (Tom Select); cadastro rápido em modal para os sete cadastros operacionais. A `0017` tornou a unicidade do condutor adiável, e com isso trocar o condutor entre dois envolvidos parou de falhar. Detalhe abaixo |
| 24 | **Pesquisa instantânea e filtros avançados** | a pesquisa da listagem passou a filtrar ao digitar e a alcançar o **nome do encarregado e do PM envolvido**; modal com dez parâmetros combináveis por `AND`, chips removíveis e contador. `situacao` substituiu `concluido`, e as opções do modal passaram a sair dos apuratórios em vez dos cadastros. Sem migration. Detalhe abaixo |
| 25 | **Auditoria legível** | a trilha passou a responder quando, quem, o que foi feito e sobre o quê, em português. A `0018` acrescenta `acao` e `assunto`, escritas pelo comando no momento da ação — o que faz o rastro sobreviver à exclusão da linha. No caminho, o `DEACTIVATE` que derrubava a desativação de configuração desde a `0001`. Detalhe abaixo |
| 26 | **Pesquisa instantânea nas outras listagens** | Catálogos e Usuários passaram a filtrar ao digitar, como os apuratórios desde a 24. O "250 ms + Enter" saiu de dentro de `processo.ts` e virou `dom.ts::ligarBuscaInstantanea`, usado pelas três. Sem migration e sem comando novo — os dois backends já pesquisavam. Detalhe abaixo |
| 27 | **Desativar e excluir militar** | A listagem de militares não tinha nem uma coisa nem outra: `users_delete` **desativava** apesar do nome, e tela nenhuma o chamava. O comando virou `users_deactivate`, e `users_delete` passou a apagar de verdade — só para quem não tem vínculo nenhum, com mensagem que nomeia o vínculo que segurou. Três ícones por linha, e o par do Reativar que faltava no detalhe. Decisão **54**. Sem migration. Detalhe abaixo |
| 29 | **Painéis sem repetição, e a carga por militar** | Seis telas de relatório viraram quatro: os mesmos quatro KPIs, a mesma evolução por ano e a mesma unidade de origem eram desenhados em três endereços, e nas telas antigas sempre **sem escopo**. "Visão Geral dos Apuratórios" saiu e o gráfico de criticidade ficou só no Painel. Do outro lado, Designações por Policial Militar passou a responder por **carga de trabalho**: concluído, em andamento no prazo, em andamento vencido e sem prazo definido, por militar e por espécie, com cinco filtros combináveis. Numa segunda volta, o Relatório Anual virou **documento** — capa e seções numeradas, só tabelas — em vez de um "modo" da tela de Estatísticas, e as Designações ganharam filtro por balde, cinco ordenações e as datas de último recebimento e última conclusão por militar. Duas consultas novas (`by_unit`, `by_year`), `dashboard_summary` enxugado aos quatro números, nenhuma migration. Decisões **55–60**. Detalhe abaixo |
| 28 | **Painéis analíticos** | As seis telas de relatório deixaram de ser só tabela: KPIs, barras, barras empilhadas, linha/área e rosca, com alternador Gráfico/Tabela por cartão. Uma dependência nova (`chart.js`), nenhum comando e nenhuma migration — todo dado já vinha dos relatórios existentes. O Vitest entrou junto, sobre a camada pura de `src/graficos/dados.ts`. Detalhe abaixo |
| 30 | **PDFs dos relatórios comuns** | Impressão A4 escopada por sessão, perfis tabular/analítico/documento, cabeçalhos repetidos, linhas indivisíveis, textos sem elipse e orientação por conteúdo. Retrato ganhou `GtkPageSetup` próprio; listagens completas substituem somente seu wrapper; Designações normaliza a matriz só no papel e Mapa Salvo usa paisagem densa. O documento especial do Mapa Mensal ficou congelado e fora de todos os seletores novos. Numa segunda volta veio o **arnês** (`tools/impressao`), que imprime pelo WebKitGTK sem abrir a aplicação: ele mostrou que a linha partida pela quebra de página **some do PDF**, calibrou os nove tamanhos de bloco por medição, tirou a fragmentação de dentro dos cartões — onde o motor ignora o `break-inside` — e passou a provar o congelamento do Mapa Mensal pixel a pixel. Sem migration e sem biblioteca de PDF. Decisão **61**. |
| 31 | **O gráfico no papel, e a folha órfã** | O gráfico saía como faixa preta e Designações gastava duas folhas antes da primeira linha da matriz. Eram dois defeitos com uma causa em comum: o arnês não alcançava nenhum dos dois. Nenhuma fixtura tinha `<canvas>`, e `imprimir.py` desligava o compositing — que é justamente o que faz o canvas ir para a GPU e sair chapado de preto. Com o compositing ligado o defeito se reproduziu na hora: 31,2% da folha em preto, contra 0,0% do mesmo desenho como `<img>`. A correção congela cada gráfico num PNG enquanto o diálogo está aberto, ao preço de `data:` no `img-src` — e o canvas tem de **sair do DOM**, porque `hidden` não o esconde (o Chart.js põe `display:block` inline): a primeira versão imprimiu o gráfico em duplicata, o PNG certo e a faixa preta ao lado. A folha órfã é geometria: cartão indivisível de 532px logo abaixo de uma faixa de KPIs, numa folha de 180mm úteis. O cartão desce para o fim do documento por `data-impressao-ao-fim`, a matriz sobe e o primeiro bloco foi remedido de 18 para 12. O arnês ficou mais honesto do que estava: imprime com compositing quando a fixtura pede, e reprova folha com preto chapado. Sem migration, sem CSS novo, sem dependência nova. Decisão **62**. |
| 32 | **O recorte "em andamento"** | A tela de Designações passou a oferecer "Em andamento (todos)" no filtro de situação, somando no prazo e vencido. A união ficou **no filtro**, não no `BALDE`: os quatro baldes continuam exclusivos e somando o total, e o predicado virou `= ANY($6::text[])`. "Sem prazo definido" fica de fora por decisão, com a consequência — o filtro devolve menos que `total - concluídos` — travada em teste. Sem migration, sem comando novo. Decisão **63**. |
| 33 | **Loaders, boas-vindas e a tabela do mapa** | O app não dizia que estava trabalhando: o login não desabilitava nem o botão, seis telas imprimiam sem retorno nenhum e a troca de rota deixava a tela anterior inteira e clicável enquanto onze consultas corriam. Entrou um helper único, `comCarregamento`, com véu fora de `#app` — `shell()` reescreve o `innerHTML` a cada tela — e a regra que o faz funcionar: **ceder um quadro antes do trabalho**, porque quase tudo aqui é síncrono e sem isso o véu só pintaria depois. No Mapa Mensal, onde a paginação bloqueia a thread e congela a própria animação, quem informa é a mensagem em três fases. O login parou de redesenhar a tela no erro, que apagava e-mail e senha digitados, e passou a dar as boas-vindas por toast. A tabela do conteúdo do mapa — a única listagem declarada como `string[]` — ganhou o padrão das demais, e as dez larguras saíram do `report-print.css` para `Coluna.largura`: o papel já as tinha, a tela não. E a ordem das seções do PDF virou coluna administrável (0019), com SR, IPM e PADS à frente. Decisão **64**. |
| 34 | **O brasão em todo documento, e o ícone do app** | Só o Mapa Mensal e o Relatório Anual saíam identificados; os outros oito caminhos imprimíveis levavam ao papel o `<h1>` da tela e mais nada — documento oficial da Seção sem dizer de que Seção é. O cabeçalho institucional (brasão de 16mm, "Polícia Militar de Rondônia" e "7º BPM · Seção de Justiça e Disciplina") entra num lugar só, `dom.ts::abrirImpressao`, que é o gargalo por onde todo o caminho comum passa: tela nova nasce com cabeçalho sem ninguém lembrar. O perfil `documento` é pulado por guarda em JS, porque o Anual já tem capa e dois brasões na mesma folha é defeito. A parte que exigiu cuidado foi a colisão de arquivo: `src-tauri/icons/icon.png` era **ao mesmo tempo** o brasão que quatro telas carregam e a vaga que `tauri icon` sobrescreve — gerar o ícone teria trocado o brasão do Mapa Mensal pelo distintivo do batalhão, sem erro nenhum. O brasão saiu para `src/assets/brasao-pmro.png` com fonte única em `src/brasao.ts` (estava triplicado), e `controle-mapa.sh` provou o congelamento: idêntico a `HEAD`, texto e pixel. O distintivo do 7º BPM virou o ícone, e com isso `bundle.icon` deixou de estar vazio — o build volta a empacotar deb, rpm e AppImage, e o `--no-bundle` saiu de cinco pontos da documentação. O arnês passou a emitir o cabeçalho nas fixturas, ganhou o par de regressão que exige o texto no comum e o proíbe no `documento`, e no caminho **reprovou** `matriz-normalizada`: ela guardava `22, 18` escritos à mão enquanto a tela já estava em 12. Os nove blocos calibrados sobreviveram aos 24mm a mais — medido, não suposto: 38/38. Sem migration. |
| 35 | **Mapas salvos: o cabeçalho `undefined` e o documento completo** | Abrir um mapa salvo e imprimir dava um PDF cujo cabeçalho dizia `undefined a undefined · undefined no período · undefined em andamento · undefined concluídos`, com o título vazio e a tabela perfeita logo abaixo. O dado no banco estava íntegro: `SavedMapFull` tinha `#[sqlx(flatten)]` e **não** `#[serde(flatten)]`, então a resposta saía aninhada sob `cabecalho` enquanto `types.ts` declarava os campos no topo — nenhum erro em lugar nenhum, e os 178 testes cegos porque todos aferiam o campo do struct, que o serde não altera. Uma linha corrige; o guarda novo mora em `commands_ipc.rs` e olha o JSON, exigindo `titulo` no topo **e** a ausência de `cabecalho`. Junto: as datas dos mapas deixaram o ISO e passaram por `formatarData`, o que também corrigiu a tela do Mapa do Período, que dividia a mesma `linhaMapa`. E o mapa salvo passou a guardar o **documento completo**, não só o resumo — os dois num envelope dentro do mesmo `dados_mapa`, porque o schema admite exatamente dois JSONB e a `migrations.rs` reprova o terceiro; o período fica de fora do envelope, já que `periodo_inicio`/`periodo_fim` são colunas. A listagem ganhou a coluna **AÇÕES** com ver resumo, ver PDF completo e excluir — cada botão com o seu `data-` —, e o PDF completo é reemitido do snapshot pelo mesmo `renderDocumentoMapa` da tela ao vivo, sem recalcular. Numa segunda volta saíram três arestas da própria rodada: o ícone de PDF completo **sumia** depois do clique, porque `comCarregamento` escreve a mensagem no gatilho e num botão de ícone isso apaga o `<svg>`; a coluna "Em" transbordava por cima da vizinha, e as nove larguras foram **medidas** no WebKitGTK com o CSS compilado em vez de estimadas; e o Excluir saiu do resumo, que agora tem só Voltar e Imprimir / PDF. Migration **0020**. |

### A rodada 31, em detalhe

Pedido: dois acertos no PDF dos relatórios. Em Designações, a primeira folha saía com o
título e os quatro KPIs e o resto em branco. E, com o cartão em modo "Gráfico", o
desenho virava uma faixa preta no documento.

**Os dois defeitos tinham a mesma causa de fundo: o arnês não os alcançava.** A rodada 30
montou um arnês que imprime pelo WebKitGTK e afere o PDF, e ele existe justamente para
que escolha de impressão seja medida em vez de argumentada. Só que ele declarava, nos
próprios limites, que não cobria "gráfico com dado real" — e a razão era mais funda do
que parecia: `grep -c canvas fixturas/*.html` dava **zero** em todas as 32 fixturas.

**A faixa preta reproduziu-se em uma medição, e a medição apontou para o próprio arnês.**
A primeira fixtura com `<canvas>` saiu **pintada**, o que refutaria o diagnóstico — não
fosse o `WEBKIT_DISABLE_COMPOSITING_MODE=1` que `imprimir.py` põe para conseguir o
contexto GL numa janela offscreen. Com o compositing ligado, como o aplicativo roda, a
mesma fixtura saiu com **31,2% da folha em preto puro**; o `<img>` gerado por
`toDataURL()` do mesmo canvas saiu com 0,0% nas duas condições. O defeito não era do
CSS nem do Chart.js: é o caminho de impressão do WebKitGTK não sabendo ler uma textura
de GPU, e pintando o retângulo de preto sem erro nenhum.

Daí saíram três coisas, e não uma. A correção — `congelarGraficosParaImpressao` troca
cada gráfico visível pelo PNG dele mesmo enquanto o diálogo está aberto. O preço —
`img-src 'self' data:`, a única concessão de CSP da rodada. E a correção **do arnês**:
`imprimir.py` passou a imprimir num processo à parte as fixturas que declaram
`compositing: true` (a variável tem de valer antes de o GTK inicializar), e `conferir.py`
ganhou uma asserção que nenhuma asserção de texto poderia substituir — folha com mais de
3% de preto chapado reprova. O PDF com a faixa preta continua com **todas as palavras no
lugar**; era invisível para tudo o que o arnês media.

#### A segunda volta, e o que ela ensinou sobre fixtura

A conferência do responsável no PDF real mostrou o gráfico **em duplicata**: o PNG
certo e, ao lado, a faixa preta. E o arnês continuava verde — o que era o defeito mais
caro dos dois.

A causa do papel: `canvas.hidden = true` não esconde canvas nenhum aqui. O Chart.js
escreve `style.display = 'block'` no elemento ao montar (`initCanvas`), estilo inline
vence a regra `[hidden]` do navegador, e o projeto não declara nenhuma `[hidden]`
global — só oito com classe. O canvas seguia ocupando caixa, sendo composto e sendo
pintado de preto logo acima do PNG. A assinatura no PDF é inconfundível, e foi ela que
resolveu o caso antes de qualquer palpite: `pdfimages -list` mostrava, por gráfico,
**duas** imagens de dimensão idêntica — a boa de 12 a 114 KB com `smask`, a chapada de
3 a 5 KB sem —, e o par atravessando a quebra de página, prova de que as duas ocupavam
layout.

A causa da fixtura verde é mais instrutiva. A primeira tinha o canvas nascendo `hidden`
no HTML, e um canvas que nunca foi visível **nunca ganha camada de composição**: ela
media outra coisa e aprovava. Reproduzir o *resultado* não basta — é preciso reproduzir
a **sequência**. `trocaPeloPng` pinta o canvas visível, deixa o motor compor 120ms de
quadros, põe nele o mesmo `display:block` inline que o Chart.js põe, e só então troca.
Com isso a fixtura passou a sair com 31,2% de preto e duas imagens de 1920×600 — a
assinatura exata do PDF do responsável —, e `calibrado-grafico-removido` com uma imagem
e 0,0%.

A correção é `canvas.remove()`, com o vizinho lido **antes** da remoção para devolvê-lo
ao lugar exato: a caixa também hospeda o `.analytics-tooltip`.

**A folha órfã não era `break-after` nenhum — era aritmética.** A A4 paisagem do
`folha_a4_relatorio` dá 180mm úteis. O `page-head` come ~14mm, a faixa de KPIs ~26mm, e o
cartão de carga mede `min(700, n × 42 + 70)` px de gráfico — 532px ≈ 141mm com os 11
militares do caso relatado, mais a moldura. Como `.analytics-card` é `break-inside:
avoid`, o motor não tem onde o pôr: desmancha o cartão por cima da folha seguinte e
empurra o resto. A medição mostrou o defeito **maior** do que o relato: duas folhas
gastas, não uma — a segunda ficava só com o `h2` da matriz, porque o gráfico transbordava
da primeira e o bloco de 18 linhas já não cabia no que sobrava dela.

Havia dois caminhos, e um deles estava barrado pela seção 7: encolher o gráfico até caber
encavala os rótulos de três linhas, defeito que a rodada 28 já tinha pago. Então o cartão
**desce**. `data-impressao-ao-fim` é atributo no markup, como `data-nao-imprimir` — não
um `if` por tela dentro do helper —, e `adiarBlocosParaOFimDaImpressao` move o nó para o
fim do `.panel` só enquanto o diálogo está aberto, deixando um comentário como âncora
para o desfazer. Move o nó de verdade, e não `order` de flex, porque dentro de um
container flex ou grid o WebKitGTK ignora o `break-inside` das caixas de dentro — o que
essa mesma pasta já tinha medido na rodada 30.

**E o primeiro bloco da matriz teve de ser remedido.** Os 18 anteriores foram calibrados
para uma folha 1 que a matriz nem alcançava. Com ela subindo, a folha 1 passa a dividir
espaço com o título, os KPIs e o `h2`: sobram ~128mm. A varredura de 10 a 17 deu 12 como
o maior valor que ainda cabe — com 13 a tabela transborda a margem inferior e a última
folha sai vazia. Oito folhas viraram sete, e a primeira deixou de ser desperdício.

**O que ficou de fora, e de propósito.** Painel e Estatísticas têm a mesma geometria e
podem orfanar folha pelo mesmo motivo; a decisão desta rodada foi não mexer neles. O
mecanismo já serve quando entrarem, e o próximo número a corrigir está anotado: o teto de
`alturaImpressao` é 700px ≈ 185mm, maior que os 180mm úteis da folha.

### A rodada 29, em detalhe

Pedido: "muitas informações se repetem de uma página pra outra"; e, em Designações por
Militar, poder saber quantos apuratórios um militar tem e quantos estão concluídos, em
andamento no prazo e em andamento vencido — por ano, e por espécie de apuratório.

**A repetição era real, e tinha uma causa.** A rodada 28 transformou seis telas em
painéis, mas uma a uma: cada tela escolheu os seus cartões sem olhar para as vizinhas.
O resultado media-se: a linha de quatro KPIs era **idêntica** no Painel e na Visão Geral;
"Evolução das instaurações" e "Unidades de origem" apareciam nas duas; o gráfico de
criticidade dos prazos estava no Painel **e** em Prazos; e cinco dos seis cartões do
Relatório Anual já existiam em Estatísticas dos Apuratórios, que tem filtro de ano.

**E era pior do que repetição.** As quebras da Visão Geral e do Painel vinham de
`dashboard_summary`, que não aceita filtro: eram sempre do acervo inteiro. Na mesma tela,
elas ficavam ao lado de cartões recortados por ano e espécie — dois números diferentes
para a mesma pergunta, sem nada dizendo qual respondia o quê.

**A saída foi dar dono a cada indicador** (decisão 55), que é o princípio 4 aplicado à
apresentação. O Painel ficou com triagem: os quatro números, a criticidade e os oito
vencidos mais antigos, com um botão para Prazos. Prazos ficou com as duas listagens e
**perdeu** o gráfico — que era a terceira vez que aqueles três números apareciam ali,
depois da linha de KPIs. Estatísticas ficou com as doze distribuições, todas com escopo,
em dois blocos ("Acervo" e "Apuração"). E o Relatório Anual continua no menu, porque é
como a Seção chama o entregável, mas é `renderEstatisticas(ctx, "anual")` — mesmo
desenho, ano obrigatório.

Para isso, duas consultas novas em `maps_reports`: `by_unit` e `by_year`. E
`dashboard_summary` **encolheu** para os quatro números — as quatro quebras que moravam
nele ficaram sem leitor no momento em que passaram a existir com escopo, e mantê-las
seria guardar a segunda fonte que a rodada acabou de eliminar. São quatro agregações a
menos no carregamento do Painel.

**A carga de trabalho não virou comando novo.** `designations_matrix` já filtrava por ano,
espécie e função, e já agrupava por militar × apuratório: o que faltava eram quatro
`count(...) FILTER (WHERE ...)` no mesmo `GROUP BY`, mais dois filtros — militar e
vínculo. Um comando paralelo duplicaria o SQL, e as duas respostas discordariam no dia em
que uma mudasse. A agregação parte das tabelas base com o `LATERAL` do prazo vigente, e
não da view: `GROUP BY` sobre `v_processos_detalhados` é 7× mais lento.

**O terceiro estado que ninguém tinha contado.** "Em andamento" quebrado em "no prazo" e
"vencido" deixa de fora o apuratório cujo **recebimento nunca foi informado** — sem linha
em `processo_prazos`, ele não está em nenhum dos dois. São quatro baldes, e o quarto tem
coluna própria, exibida só quando alguém está nele (decisão 57). Somá-lo a "no prazo"
daria um número plausível e errado, que é o pior defeito possível num relatório.

**Uma tela, duas perguntas.** O pedido mencionava "outro relatório" para filtrar por
espécie de apuratório. Ele não virou tela: marcar `IPM` e a função `Encarregado` na
própria tela de Designações já responde "quais encarregados estão com IPM", com a quebra
por situação — e uma segunda tela seria a mesma consulta com o filtro pré-marcado, que é
exatamente o que a decisão 55 acabou de remover (decisão 56). Escolher um militar troca a
tela de pergunta: os KPIs passam a ser dele, e a matriz dá lugar à situação por espécie.

**O que os testes novos travam.** Que os quatro baldes são exclusivos e somam o total; que
recortar num militar não muda os números dele; que `somente_vigentes` esconde a designação
encerrada por substituição e o padrão não (decisão 58); que `by_unit` e `by_year`
respeitam o escopo e que `by_year` **ignora** o ano de propósito; e que
`dashboard_summary` **não** voltou a trazer as quebras — este último pelo IPC, porque a
divergência com `types.ts` não seria erro de compilação em lado nenhum.

**Sem migration.** O schema não mudou: os quatro baldes são leitura de `data_conclusao` e
do prazo vigente, que já existiam.

#### A segunda volta da rodada, e o que ela corrigiu

A conferência do responsável apontou duas coisas, e as duas eram justas.

**"Relatório Anual e Estatísticas têm as mesmas informações."** Tinham mesmo: eram a
mesma tela, e a única diferença era o ano ficar fixo — ou seja, duas entradas de menu
para o mesmo desenho, que é o defeito que esta rodada existia para corrigir. A diferença
entre os dois nunca foi o filtro; é o **gênero**. O Anual virou documento de verdade
(decisão 59): capa com brasão, ano e unidade, onze seções numeradas em ordem fixa, só
tabelas, nenhum controle no meio do texto, e a capa sozinha na primeira folha impressa.
O dado continua vindo de uma função só, `carregarDadosDoEscopo`, que as duas telas
chamam — o que muda é a forma, não os fatos.

**"Aparece a informação, mas não dá para filtrar nem ordenar."** A tela mostrava os
quatro baldes e não deixava recortar por eles, e a pergunta prática da Seção —
"entre os encarregados de SR, qual foi o mais recente que recebeu ou concluiu" — não
tinha como ser feita. Entraram o filtro por balde, cinco ordenações e as duas datas por
militar (decisão 60).

O detalhe que quase passou: as datas precisam sair do conjunto **já recortado**. Com o
`max()` calculado antes do filtro, pedir "vencidos" ainda devolveria a conclusão de um
processo que o filtro acabou de excluir — número plausível, e por isso ninguém
desconfiaria. E ordenar por `Option<data>` direto põe quem **não tem** a data na frente
no crescente: "conclusão mais antiga" abriria justamente com quem nunca concluiu nada.
Nas duas direções, quem não tem a data vai para o fim.

No caminho, os quatro baldes viraram um `CASE` só (`BALDE`), interpolado nos cinco
lugares da consulta em que a regra aparece — o que os torna exclusivos por construção, e
não por coincidência entre cinco condições escritas à mão. Com `format!` no SQL, a
consulta passou a precisar da linha em `tests/sql_prepare.rs`.

### A rodada 28, em detalhe

Pedido: transformar os relatórios tabulares num painel analítico, sem perder a precisão
da tabela.

**Nenhum comando novo, nenhuma migration.** Os oito relatórios que os cartões desenham
já existiam desde a rodada 1 — o que faltava era desenhá-los. `dashboard_summary`,
`reports_status_by_apuratorio`, `reports_by_solution`, `reports_by_nature`,
`reports_by_evidence_category`, as três de enquadramento e `reports_driver_ranking`
continuam com o mesmo contrato, e o `ReportFilter` continua o mesmo.

**Gráfico e tabela convivem, e quem escolhe é quem lê.** Cada cartão tem os dois lados;
a escolha fica no `localStorage`, por cartão. O ranking mostra os 12 primeiros — a
ordenação vem do `ORDER BY total DESC` do backend, não do frontend —, e a **tabela do
mesmo cartão mostra todos**, o que é o ponto: o gráfico é resumo, a tabela é o registro.

**A camada pura ficou separada da renderização, e é a que tem teste.** `graficos/dados.ts`
não conhece Chart.js: ordenação, percentual, faixas de prazo, cor por gravidade, quebra de
rótulo e escolha de denominador. É testável em Node — `graficos/index.ts` não seria, porque
importa `chart.js` e chama `matchMedia`. Daí o Vitest, e os 8 testes.

**A impressão foi a parte difícil, e por um motivo que não é óbvio.** Canvas é bitmap: a
largura útil do papel só existe depois que a impressão começou, e o `@media print`
esconde a sidebar e põe o grid em uma coluna — a caixa do papel não é a da tela. A
primeira versão redimensionava o **gráfico** (`resize(980, altura)`), o que muda só o
bitmap; com `.analytics-chart canvas` fixando `100% !important`, a caixa não acompanhava
e todo gráfico saía esticado 4,8% na horizontal e 17,6% na vertical, sem erro nenhum.

A saída foi dimensionar a **caixa** em `px` — unidade absoluta na impressão, 1/96 de
polegada —, o que faz a medição feita na tela valer para a folha. E, no meio do caminho,
duas armadilhas que a seção 7 agora guarda: `Chart.resize()` **adia** o pedido quando há
animação em curso, e o `draw()` seguinte o aplica com as medidas velhas (quatro dos nove
gráficos, e só eles, saíam com o bitmap de meia coluna esticado até a folha); e uma
altura de impressão menor que a da tela faz os rótulos de três linhas se encavalarem —
defeito que ficou invisível enquanto o desenho saía esticado.

**O alternador não era operável pelo teclado.** Nasceu com `role="tab"` sem `tabpanel` e
com *roving tabindex* sem tratador de setas: o botão não selecionado ficava fora da ordem
de Tab, e o que sobrava era o que já estava selecionado. Virou grupo de botões com
`aria-pressed`, que o navegador opera sozinho — menos código, e correto.

**Duas coisas voltaram para onde estavam.** A matriz de designações tinha virado o lado
"Tabela" do cartão do ranking, ou seja, o conteúdo principal daquela tela passou a exigir
um clique; voltou para o corpo da tela, e o cartão ficou com uma tabela própria de militar
× total. E `painelContagem`, que a ficha do usuário usa, tinha sido redirecionada para o
formato dos cartões: voltou às colunas que tinha, porque aquela tela não virou painel
analítico e não havia razão para mudar de forma junto.

### A rodada 27, em detalhe

Pedido: a listagem de militares mostra se o cadastro está ativo, mas não tem como
desativar nem excluir ninguém. Um ícone para cada, ao lado do de abrir.

**Desativar já existia — e nenhuma tela chamava.** O comando se chamava `users_delete`
e, apesar do nome, fazia `set_ativo(false)`, com as travas de não desativar a própria
conta nem o último administrador. O detalhe do militar só oferecia **Reativar**: dava
para devolver alguém ao ativo, nunca para tirar. Ou seja, o caminho de volta existia sem
o de ida, e o de ida estava escrito e inalcançável.

**Os dois verbos passaram a ter nomes que dizem o que fazem.** `users_deactivate`
desativa; `users_delete` apaga. Enquanto os dois couberam no mesmo nome, quem lesse a
lista de comandos entenderia o contrário do que acontece — e foi por isso que a
renomeação veio junto, e não depois.

**Na trilha, desativar virou `UPDATE`.** Gravava `DELETE`, herança do nome antigo, e
dizia que uma linha que continua no banco tinha sido apagada. É a regra que a rodada 25
fixou: o verbo descreve o que aconteceu com a linha, e quem diz que foi desativação é a
`acao`. Registros anteriores não mudam — configuração não reescreve fato registrado.

**Excluir só conclui para quem não tem vínculo nenhum.** As quatro FKs que apontam para
o militar são `ON DELETE RESTRICT` e recusariam sozinhas, mas a mensagem do PostgreSQL é
a mesma para os quatro casos. O comando conta os vínculos antes e monta a frase que diz
**qual** deles segurou — conta de acesso, designações, envolvimentos ou prorrogações em
que ele é autoridade —, e manda desativar. A conferência não substitui a rede: o teste
tenta o `DELETE` direto e exige o `23503` do banco, para que a proteção continue de pé
se um dia a conferência esquecer um caso.

**Militar que já teve conta nunca poderá ser apagado.** A conta é desativada e nunca
apagada (`users/repository.rs`), então a linha em `usuarios` fica lá segurando a FK para
sempre. É consequência aceita, não descuido: quem tem conta operou o sistema, e o que
operou o sistema tem rastro em auditoria, andamento, anexo e mapa — todos `RESTRICT`
também. Apagar essa gente seria apagar a trilha junto.

**Três ícones, e um só em vermelho.** Abrir, desativar/reativar e excluir. Cada botão
leva o seu próprio `data-`, senão os três cliques cairiam no mesmo listener — o
`dom.ts::tabela` ganhou `Celula.acoes` para isso. Os dois primeiros ficaram `outline` e
só a exclusão é `danger`: com `secondary`, o botão escuro do meio puxava o olho para a
ação errada. E os dois novos **só aparecem para administrador**, porque é o que
`require_admin` exige — botão que só sabe dizer "não" ao ser clicado é pior que botão
nenhum.

**A coluna "Ações" foi de 6% para 12%.** Três botões de 32px com 8px de gap são 112px, e
a 6% eles passavam da borda da tabela. Medido em janela de 1024px, onde 12% dão 118px,
com os três dentro e sem barra de rolagem; os 2 pontos que faltavam saíram da coluna
Nome, que trunca com reticências e tem `title`.

### A rodada 26, em detalhe

Pedido: aplicar às outras telas com campo de busca o que a listagem de apuratórios já
fazia — filtrar enquanto se digita.

**Eram duas telas, não sete.** O levantamento achou campo de busca textual só em
Catálogos e Usuários. Auditoria, Encarregados, Estatísticas, Anual, Mapas, Prazos e
Apuratório filtram por `<select>` e checkbox: não há texto para filtrar ao digitar.
As buscas de Indícios e das acusações do formulário **já** disparavam no `input` com
carimbo de sequência — são autocomplete, não listagem, e ficaram como estavam.

**O helper existe porque o padrão tem duas partes, e uma delas não é óbvia.**
`dom.ts::ligarBuscaInstantanea` espera 250 ms para redesenhar, mas corre `aoDigitar` a
**cada tecla**. É `aoDigitar` que atualiza o estado do módulo, e sem ele quem exportasse
o CSV de Usuários ou aplicasse o modal de filtros dos apuratórios dentro dos 250 ms
levaria o termo anterior — os dois leem a variável do módulo no clique, não o campo.
Enter dispara na hora; o `cancelar()` devolvido é o que impede um timer pendente de
redesenhar uma área que já saiu do documento.

**O que quase passou em silêncio: a largura das colunas.** As larguras declaradas em
`Coluna.largura` saem em `data-largura` e quem as aplica pela CSSOM é `aplicarLarguras`,
chamada de `main.ts::shell()`. Redesenho parcial não passa pelo `shell()` — trocar o
`innerHTML` sem rechamá-la devolve a tabela ao dimensionamento por conteúdo, **sem erro
nenhum**. A listagem de apuratórios não sofria disso porque monta o `<colgroup>` com
classes de CSS; as de Catálogos e Usuários, sim. É a armadilha nova da seção 7.

**Catálogos filtra sem ir ao backend, e é por isso que não tem carimbo de sequência.**
O `renderCatalogo` inteiro custa o catálogo **mais uma consulta por coluna de
referência** (`carregarReferencias`, que não tem cache): dispará-lo por tecla era o que
não podia acontecer. As linhas e as referências que o render já carregou ficam num `let`
do módulo, e a busca refiltra o que está ali. Como não há ida ao backend, não existe
resposta atrasada para chegar fora de ordem — e o comentário no código diz isso, para
que ninguém acrescente um carimbo achando que faltou. O cache não envelhece porque
gravar, desativar e reativar continuam passando pelo `renderCatalogo` inteiro; e
"Mostrar inativos" também, porque muda o que o backend traz, não o recorte do que veio.

**Usuários perdeu o botão "Buscar" e o `<form>`.** Com a busca disparando sozinha o
botão não tinha mais o que fazer, e Enter continua funcionando pelo helper. Duas coisas
tiveram de deixar de ser condicionais no HTML: o "Limpar" e o "Exportar CSV" nasciam
conforme o termo e a quantidade de itens, e ficam **fora** da área redesenhada — passaram
a existir sempre, alternando `hidden`. A classe `search-bar` ficou: é ela que a regra de
impressão esconde, e trocá-la por `.filtros` traria a barra para o papel.

**A busca de Usuários vai ao backend, então o carimbo veio junto.** `users_list` já
aceitava `search` e já paginava — nada mudou no Rust. O que mudou é que digitar rápido e
apagar em seguida não deixa mais na tela o resultado de um termo que já não está no
campo, e que estreitar o filtro recua a página em vez de mostrar tabela vazia.

### A rodada 25, em detalhe

Pedido: a auditoria estava técnica demais. Ela tinha de dizer **quando, quem fez, o que
foi feito e sobre o quê** — e servir de rastro.

**O que a tela mostrava.** `processos_procedimentos`, `UPDATE` e
`bbea1b92-6cc1-4d0b-…`: nome de tabela, verbo de SQL e chave primária. Mais uma coluna
"Diff" que imprimia "—" nos 74 registros do banco, porque diff só é gravado nas mudanças
de configuração.

**Dois problemas que não eram de redação, e que a consulta ao banco revelou.** O
primeiro: `UPDATE` não diz *qual* atualização foi. Reabrir um apuratório, registrar a
conclusão, corrigir as datas do fluxo e editar o cadastro gravavam todos a mesma linha, e
essa distinção **não existia no banco** — nenhuma tela conseguiria recuperá-la depois. O
segundo: `processo_prazos` e `processo_designacoes` são exclusão física, e ali o
`registro_id` vira UUID órfão. Eram 7 dos 8 prazos e 2 das 6 designações já sem
identificação possível — justamente a exclusão, que é o que mais importa auditar.

**Daí a `0018` e as duas colunas.** `acao` e `assunto` nascem preenchidas pelo comando que
executou a ação, no único instante em que as duas informações existem juntas: o comando
sabe que aquele `UPDATE` foi um *reabrir*, e a linha referida ainda está lá para ser
nomeada. Guardar o `assunto` duplica um rótulo que também vive na tabela de origem, e isso
merece justificativa contra o princípio 4 — é a mesma de `mapas_salvos.dados_mapa`, que a
`0001` já declara: **snapshot imutável de um fato já ocorrido**. Resolver por junção na
leitura devolveria outra coisa (o número corrigido em 2027 reescreveria o que a trilha
registrou em 2026) ou coisa nenhuma. A migration preencheu o que dava dos 74 antigos:
`acao` em 74, `assunto` em 65 — os 9 que faltam são exatamente os órfãos, e a tela diz
"registro já removido" neles.

**A assinatura mudou de propósito.** `register_tx`/`register_tx_com_alteracoes` viraram
`registrar(tx, Acao {...})`, com struct nomeada porque são cinco campos de texto seguidos
e trocar dois de lugar compilaria calado. O compilador apontou os 30 pontos de chamada,
todos em `*/commands.rs` — que é a camada certa, porque é ela que conhece a intenção.

**O defeito que apareceu no caminho.** `apuratorio_config_deactivate_documento` e
`_papel` gravavam `operacao = "DEACTIVATE"`, e `ck_auditoria_operacao` só aceita três
verbos. Como o `INSERT` da trilha corre na **mesma transação** da desativação, a violação
do CHECK derrubava as duas: desativar documento iniciador ou função de apuratório
**nunca funcionou**, desde a `0001`. Ninguém tinha esbarrado porque a configuração dos 10
apuratórios veio pela importação, não pela tela. O conserto foi gravar `UPDATE` com a
`acao` dizendo que foi desativação — sem alargar o CHECK, que ganharia um quarto verbo
para dizer o que a frase já diz melhor. A lição travada por teste: **comando que escreve
no banco precisa de teste no comando**, não só no repositório.

**Onde o assunto é lido.** `audit/assunto.rs`, uma função por entidade, cada uma com a
consulta inteira escrita ali — e não passada a um helper comum, porque `sql_prepare.rs` só
enxerga SQL que é literal no argumento de `sqlx::query*`. Os cinco filhos de apuratório
(envolvido, prazo, designação, andamento, anexo) são nomeados pelo **pai**: o UUID do
prazo não diz nada a ninguém. Para os 26 catálogos, `CATALOGOS` ganhou `assunto_sql` —
não dá para adivinhar a coluna de exibição, já que os quatro catálogos jurídicos compõem
o rótulo com junções.

### A rodada 24, em detalhe

Pedido: pesquisar a listagem de apuratórios também pelo nome do encarregado e do PM
envolvido, filtrando **enquanto se digita**, e um modal de filtros avançados que
combine vários parâmetros.

**A busca ficou instantânea sem redesenhar a tela.** O `change` do input virou `input`
com 250 ms de espera, e o que se redesenha é só `#resultados-apuratorios` — não a tela
inteira. Redesenhar tudo tiraria o foco do campo a cada tecla, que é o defeito clássico
desse recurso. Cada chamada leva um número de sequência e a resposta que chega fora de
ordem é **descartada**: sem isso, digitar rápido deixa na tela o resultado de um termo
que já não está no campo.

**Encarregado na busca é o papel, não o nome do papel.** A busca textual e o filtro de
Encarregado passam por `apuratorio_papeis.e_responsavel`, a mesma definição que o
`LATERAL resp` da view usa para preencher a coluna. O filtro antigo se contentava com
*qualquer* designação vigente — de modo que procurar pelo Encarregado achava também o
processo em que a pessoa era Escrivão. Era defeito, e está travado por teste.

**Situação absorveu `concluido`.** As quatro opções — em andamento, concluído, no prazo,
vencido — cabem num seletor só, e as duas últimas recortam a primeira. O corte é
`data_vencimento >= CURRENT_DATE`: **vencer hoje ainda é estar no prazo**, que é o mesmo
corte do badge da tela (`statusPrazo` escreve "Vence hoje" com zero dias restantes). Quem
não tem prazo nenhum fica em "em andamento" e fora das outras duas — não há por onde
dizer que está no prazo. O campo `concluido` do filtro **saiu**: dizia a mesma coisa que
`situacao`, e duas formas de perguntar o mesmo é o que o princípio 4 proíbe.

**As opções do modal saem dos apuratórios, não dos cadastros.** É desvio deliberado da
regra "lista de opções filtra `WHERE ativo`", e o motivo está no cabeçalho de
`filter_options`: um seletor de formulário oferece o que *pode* ser escolhido daqui para
frente, e aí `ativo` é porta; estas listas oferecem por onde *cortar o que já foi
registrado*, e valor que nenhum apuratório usa não corta nada. Sem isso, "Local dos
fatos" traria as dezenas de municípios que a `0003` semeia, todos devolvendo lista vazia.
Do outro lado, o cadastro **desativado e em uso** continua na lista, marcado
`(inativo)` — é o princípio 6 pelo outro lado, e é o que mantém o apuratório de 2019
encontrável pela unidade desativada em 2026.

**A barra de pesquisa nasceu com o dobro da altura.** O campo tinha ganhado um
`<label>` em coluna para exibir a legenda "Pesquisar" acima dele — e com isso o
`flex: 1 1 260px` que `.filtros input[type="search"]` declara deixou de ser largura e
virou **altura**, porque `flex-basis` é do eixo principal. Medido no Chromium contra a
barra de Catálogos: **339,5px contra 89,5px**, com o input sozinho em 260px de altura. O
conserto foi voltar ao arranjo das outras listagens — input filho direto de `.filtros`,
legenda no `aria-label` — e mandar a linha de status para fora da vista, já que a
contagem sempre esteve no cabeçalho da tela. Ficou em **70px**, numa linha só, e empilha
abaixo de 700px sem rolagem horizontal até 320px. A linha de status continua na árvore
de acessibilidade: `display:none` calaria o `aria-live`.

**Três coisas que a implementação ensinou.** A primeira: `montarModal` já ativa e destrói
os `TomSelect` sozinho, mas o `FormData` tem de ser lido **antes** do `fechar()` — o
`destroy()` restaura as opções originais e o que foi escolhido some. A segunda, do botão
*Limpar*: zerar `select.value` não limpa o controle visível, que continua exibindo o
rótulo antigo; quem manda no que aparece é a instância (`tomselect.clear()`), não o
`<select>`. O *Limpar* esvazia os campos e **mantém o modal aberto**; só *Aplicar* fecha
e recarrega, de modo que cancelar depois de limpar descarta a limpeza junto com o resto.

### A rodada 23, em detalhe

Pedido: parar de registrar "PM ainda não identificado" como se fosse uma pessoa, e
tornar os seletores do formulário de processo utilizáveis com 235 militares na lista.

**O policial fictício.** Havia um cadastro "À APURAR", matrícula `100000000`, usado
como envolvido enquanto o militar não era identificado. Ele aparecia nas listas de
opção ao lado de gente de verdade, entrava em estatística pessoal e podia ser marcado
condutor. Virou `policial_militar_id IS NULL` — estado do **vínculo**, não pessoa
inventada e não booleano ao lado (princípio 4). A `0016` converte os vínculos
existentes **preservando o id do envolvido** e desativa o cadastro artificial sem
apagá-lo. Duas travas novas: no máximo um "À apurar" por processo, e ele não conduz.

**O que a conversão obrigou a mudar no repositório.** Enquanto a sincronização de
envolvidos era pelo id do **militar**, identificar quem estava "À apurar" apagava a
linha e criava outra — e enquadramentos, indícios, resultado, situação e ordem, todos
pendurados em `processo_envolvidos.id`, iam junto pelo `ON DELETE CASCADE`. A chave
passou a ser o id do **vínculo**, que a edição devolve no request. Nos dois sentidos:
identificar quem faltava, e devolver a "À apurar" um militar registrado por engano.

**As duas coisas que só apareceram rodando os testes.** Adiar `uq_envolvido_pm` para
permitir a permuta quebrou a **etapa 05 da importação**, que usava `ON CONFLICT DO
NOTHING` sem alvo — constraint adiada não serve de árbitro, e a forma sem alvo
considera todos os índices. E o teste da própria conversão não existia: um banco de
teste nasce sem o cadastro artificial, então aplicar as migrations de uma vez nunca
exercita o `UPDATE` que converte. `a_0016_converte_o_pm_ficticio_sem_perder_o_que_pendurava_nele`
para na `0015`, monta o cenário legado e só então roda a `0016` — é o único teste do
repositório que aplica migrations em faixa.

**O condutor que não trocava de dono.** Achado durante a conferência, e **anterior a
esta rodada**: marcar o condutor no envolvido de cima antes de desmarcar o de baixo
colidia no índice parcial da `0001`, e o usuário lia "Só pode haver um condutor por
processo." com exatamente um condutor na tela. A `0017` trocou o índice por uma
constraint `EXCLUDE` adiada, conferida no `commit`, quando o processo já está no
estado pedido. A trava continua de pé — `schema_integrity.sql` dá
`SET CONSTRAINTS ALL IMMEDIATE` antes de cada caso, então o "dois condutores" segue
recusado ali.

**Os seletores.** Tom Select 2.4.3, empacotado pelo Vite (CDN não passa na CSP). Ele
**mantém o `<select>` original** no DOM e sincronizado, e é isso que preserva
`FormData`, `required`, a validação amigável e as regras que leem `select.value`; o
esconde por `clip`, não por `display:none`, senão o navegador recusaria o submit em
silêncio por não conseguir focar o campo obrigatório. Busca sem acento e sem caixa,
teclado, e as opções históricas desativadas continuam preservadas como antes.

**O cadastro rápido.** "+" ao lado de PM, unidade, subunidade/seção, município,
natureza geral do fato, situação do envolvido e papel de pessoa — os cadastros
**operacionais**, que nascem vazios. O modal reusa o formulário dirigido por metadados
de Catálogos e o de militares, então não há segunda cópia das regras de validação.
Ficam de fora apuratório, documento iniciador, papel de designação e as classificações
jurídicas: dependem de configuração e de relações que uma caixinha não deveria
decidir. E o PM criado pelo atalho **não ganha conta de acesso**.

Duas coisas ficaram sabidas e não feitas, por não valerem o risco agora: a **sigla** da
unidade não é pesquisável (o rótulo de `unidades_pm` só traz `nome`, e a busca é sobre
o rótulo), e a validação amigável, num seletor obrigatório vazio, foca o `<select>`
escondido em vez do controle visível — a mensagem aparece no lugar certo, o foco não.

---

### A rodada 17, em detalhe

Pedido: o procedimento passa a registrar **Ofendido/Vítima**, opcional e em qualquer
quantidade. Três escolhas, todas do responsável, e a segunda evitou um defeito:

1. **Vítima deixou de ser papel de pessoa.** Era uma linha de `papeis_pessoa` escolhida
   num `<select>`; virou `processo_vitimas`, relação do procedimento como
   `processo_envolvidos`. O motivo é concreto: `papeis_pessoa` é catálogo
   **operacional** e nasce vazio, então uma seção que dependesse dele sumiria numa
   instalação nova — a forma exata do defeito da carta precatória.
2. **Quem decide é `apuratorios.permite_cadastro_vitima`**, ligado pela `0012` em todo
   apuratório cujo tipo é `procedimento`. Os cinco processos disciplinares ficam de
   fora: são instaurados **contra** um militar, não para apurar um fato.
3. **O atributo não entra no registro de Catálogos** — desvio deliberado da receita da
   seção 5, pelo mesmo motivo de `codigo_extensao`: é capacidade da espécie, não
   escolha de administrador.

`gravar_vitimas` **só sincroniza quando o atributo está ligado**; desligado, não toca
na tabela nem para apagar. Do outro lado, `validar_contra_configuracao` **recusa**
vítima enviada a apuratório que não as registra. Os dois juntos dão a regra: preserva
o que existe, e nunca descarta em silêncio o que alguém mandou.

Na mesma rodada, dois achados de tela: o detalhe **recebia `d.pessoas` e descartava**
— nunca houve bloco de pessoas citadas —, e o **Resumo dos fatos** vivia na última
linha da ficha, onde `.ficha td` não declara `white-space` e **as quebras de linha
sumiam**. Os dois viraram seção própria.

---

## 13. De onde viemos

O sistema anterior era Python/Eel: um frontend de 2.124 linhas num arquivo só,
9.194 linhas de backend e 32 migrations. O diagnóstico de 20/08/2026 encontrou
**62 das 219 consultas SQL sem executar** (28%), alcançando 32 comandos, e **87
comandos que o frontend invocava e não existiam mais** — nada disso acusava em build,
porque `invoke()` recebe o nome do comando como string crua e o erro só aparece em
runtime, na cara do usuário.

Foi isso que motivou as três mudanças estruturais que sustentam o projeto hoje: o
**cliente tipado** (`src/api.ts`), em que comando inexistente vira erro de compilação;
o **`tests/sql_prepare.rs`**, que manda o PostgreSQL analisar cada consulta literal no
`cargo test`; e a **baseline limpa** de migrations, que substituiu as 32 antigas.

O diagnóstico completo está no histórico do git (`ANALISE-MIGRACAO.md`). Não vale
reler para trabalhar: descreve um sistema que não existe mais.
