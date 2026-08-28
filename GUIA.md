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
| Migrations (`0001`–`0014`) | **14** |
| Comandos Tauri, todos no cliente tipado | **84** |
| Testes | **143** |
| Módulos Rust · linhas de Rust | 12 · 9.817 |
| Arquivos de frontend · linhas de TS/CSS | 18 · 11.991 |
| Catálogos administráveis | 26 |
| Comandos que o frontend invoca e não existem | **0** |
| Chamadas fora do cliente tipado | **0** |

| Schema | |
|---|---:|
| Tabelas · FKs · CHECKs · EXCLUDEs · triggers · views | **46 · 59 · 29 · 2 · 3 · 1** |

| No banco agora | |
|---|---:|
| Processos/procedimentos | **11** |
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
- **Seção 3** — as 51 decisões já tomadas. Não reabra sem motivo novo.
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
cargo test                           # 146 testes, bancos descartáveis
cargo run                            # aplica as migrations no startup e abre o app

# Frontend
cd ..
npm install
npm run typecheck                    # tsc --noEmit — é aqui que erro de comando aparece
npm run build                        # typecheck + vite build

# Binário de produção — é o único que exerce a CSP restritiva.
# `--no-bundle` compila o executável sem empacotar: necessário enquanto
# `bundle.icon` estiver vazio (seção 12, rodada 9).
npm run tauri build -- --no-bundle
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
penal). Os **operacionais** nascem vazios de propósito. Para chegar a um processo:

1. **Catálogos → Tipos de apuratório** — ex.: `processo`, `procedimento`
2. **Catálogos → Apuratórios** — sigla, nome, tipo, prazo base, `max_envolvidos`,
   `exige_natureza_fato`
3. **Catálogos → Tipos de documento** — ex.: Portaria, Memorando Disciplinar
4. **Catálogos → Papéis de processo** — ex.: Encarregado, Escrivão, Presidente
5. **Catálogos → Unidades PM**, **Naturezas do fato**, **Status do envolvido**,
   **Soluções**, **Penalidades**, **Papéis de pessoa**, **Tipos de andamento**
6. **Catálogos → Configuração de apuratórios** — para cada apuratório, habilitar ao menos
   **um documento iniciador** e **um papel responsável**. Sem isso o banco recusa qualquer
   processo, e a tela avisa. É também o que faz as colunas aparecerem em *Designações por
   Militar* e nos painéis de *Estatísticas de Procedimentos*
7. **Usuários** — cadastrar os policiais militares
8. **Procedimentos → Novo**

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
| 9 | Papéis obrigatórios bloqueiam o salvamento? | **Sim.** Um `obrigatorio` que não bloqueia não significa nada. Para permitir a ausência, desmarque `obrigatorio` naquele apuratório — quem decide é a configuração. |
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
  fechado `[]`) e em `processo_designacoes` (mesma pessoa, mesmo papel, intervalo `[)`).
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
npm run tauri build -- --no-bundle
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
    );
    ```

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

Testado de ponta a ponta. **Não edita uma linha do `adm-p6.sql`.**

```bash
# ── 1. Banco da aplicação, limpo, com as 12 migrations ────────────────────────
docker compose down -v && docker compose up -d
cd src-tauri && sqlx migrate run --source migrations && cd ..

# ── 2. O dump legado entra num banco PRÓPRIO, exatamente como está ───────────
# O role `app_user` aparece nos ALTER ... OWNER TO do dump; criá-lo vazio basta.
docker compose exec -T postgres psql -U adm_p6_user -d postgres -q \
  -c "CREATE DATABASE adm_p6_legado;" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_user')
        THEN CREATE ROLE app_user; END IF; END \$\$;"

docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_legado -q < adm-p6.sql

# ── 3. Lá dentro, `public` vira `legado`; então o schema é exportado ─────────
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_legado -q \
  -c "ALTER SCHEMA public RENAME TO legado;"

docker compose exec -T postgres pg_dump -U adm_p6_user -d adm_p6_legado \
  -n legado --no-owner --no-acl > /tmp/legado.sql        # ~43 MB

# ── 4. E entra ao lado do schema novo, sem tocar em `public` ────────────────
# NÃO crie o schema antes: o pg_dump -n já traz o CREATE SCHEMA.
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
  -q -v ON_ERROR_STOP=1 < /tmp/legado.sql

# ── 5. Conferir que o legado chegou inteiro ANTES de mapear ─────────────────
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -t \
  -c "SELECT 'processos: '||count(*) FROM legado.processos_procedimentos;" \
  -c "SELECT 'militares: '||count(*) FROM legado.usuarios;" \
  -c "SELECT 'prazos:    '||count(*) FROM legado.prazos_processo;"
# espera: 128 · 236 · 141

# ── 6. A importação, etapa por etapa ───────────────────────────────────────
for etapa in src-tauri/importacao/0*.sql; do
  printf "── %-40s" "$(basename $etapa)"
  docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
      -v ON_ERROR_STOP=1 -q < "$etapa" && echo ok || { echo FALHOU; break; }
done

# ── 7. Conferência: 24 contagens e 17 invariantes ──────────────────────────
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -q \
    < src-tauri/importacao/99_conferencia.sql

# ── 8. Só depois da amostra manual na tela, o legado sai ───────────────────
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
    -c "DROP SCHEMA legado CASCADE;"
docker compose exec -T postgres psql -U adm_p6_user -d postgres \
    -c "DROP DATABASE adm_p6_legado;"
```

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
| Executar dump de `pg_dump` pelo protocolo do Postgres | `COPY ... FROM stdin`, `\restrict` e `\.` são sintaxe do **cliente psql**, não SQL: `sqlx::raw_sql` estoura com "syntax error at or near \" | Gerar a fixture com `--inserts` e filtrar as linhas `\restrict`/`\unrestrict` — é o que `gerar_legado_amostra.sh` faz |
| Supor que tirar a coluna do registro apaga o dado | Não apaga, e é o que torna seguro esconder o `codigo_extensao`: o `UPDATE` genérico monta o `SET` **só** com as colunas declaradas, então editar um apuratório pela tela não toca a extensão de carta precatória. O reverso também vale — uma coluna `NOT NULL` fora do registro faz o **INSERT** falhar, porque ninguém a preenche | Coluna obrigatória que não cabe na tela vira `ReferenciaFixa`, que o `save` resolve sozinho (a seção 4) |
| CSP sem `ipc:` em `connect-src` | Não quebra uma tela: quebra os **84 comandos** de uma vez, porque é por aí que o IPC do Tauri v2 passa. E some no console como `Refused to connect` | `connect-src 'self' ipc: http://ipc.localhost`. Se o app abrir mudo logo na primeira tela, é isto |
| **Largura de coluna num `<col style="">`** | É `style` como qualquer outro, e a CSP recusa igual: o `<col>` fica sem largura e a tabela volta a se dimensionar pelo conteúdo, **sem erro de build e sem erro de console que aponte a tabela** | A largura sai em `data-largura` e é aplicada pela CSSOM em `dom.ts::aplicarLarguras`, chamada de `main.ts::shell()` |
| **Duas gerações da mesma regra de CSS no arquivo** | Qual vence deixa de ser a intenção e passa a ser a ordem e a especificidade. `.tabela-dados thead th` mantinha o cabeçalho da listagem branco por ser mais específica que o `th` escrito depois — o efeito era bom, e ninguém sabia que era acidente | Ao mexer em regra que já existe duplicada, **medir o computado antes e depois** num navegador, sobre o CSS compilado. Foi como a seção 12, rodada 14 provou que a listagem de processos não mudou |
| `style=""` no markup, com a CSP ligada | O atributo é recusado e o elemento aparece sem estilo, **sem erro de build**. Só a CSSOM (`elemento.style.width = …`) escapa da diretiva | Larguras calculadas de coluna vão em `data-*` e são aplicadas por `aplicarLarguras()` em `shell()` |
| **`@page` para orientar a folha impressa** | O WebKitGTK — motor do Tauri no **Linux** — ignora o descritor `size` do `@page`. Medido no webkit2gtk-4.1 2.48 com `@page nome { size: A4 landscape }`, `@page { size: A4 landscape }` e `@page { size: 297mm 210mm }`: as três saíram 595×842 pt, **retrato**. A propriedade `page` (página nomeada) também não existe no WebKit, então uma `@page` nomeada nem chega a casar. O documento sai com o layout de 297mm espremido numa folha de 210mm, sem erro nenhum | A orientação vem do `GtkPageSetup`, e só. É o que `print::commands::print_landscape` monta, antes de rodar o diálogo. O `@page` continua no frontend só para os motores que o honram, e a chamada **espera** a impressão terminar — voltar antes desmonta o documento e imprime folha em branco |
| **Concatenar a descrição a um `rotulo` de enquadramento** | O `rotulo` de `evidence/repository.rs` **já termina** em `' - ' || descricao`. Quem acrescentar `: ${descricao}` imprime o mesmo parágrafo duas vezes na mesma linha — foi o que o PDF do mapa mensal fez desde que nasceu, e com a transgressão saía pior ainda, repetindo também a gravidade | O rótulo é a citação **completa**. Exiba-o sozinho. `rotulo_cita_o_artigo_antes_da_norma_e_nao_repete_a_descricao` trava as duas metades |
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
| Carregar dump de `pg_dump` e continuar usando a conexão | Ele emite `SELECT pg_catalog.set_config('search_path', '', false)`, e daí em diante nem `public` é enxergado — o erro que aparece é "relation ... does not exist" | `SET search_path = public;` logo depois de carregar |

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
| como o responsável do processo é resolvido sem nome de papel | `proceedings/repository.rs::JOIN_RESPONSAVEL` |
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
| o contrato de cada comando (TypeScript) | `src/api.ts::Commands` — é o mapa completo dos 78 |
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
| por que a prorrogação começa no dia do vencimento | `src-tauri/migrations/0005_prazo_intervalo_ocupacao.sql` |
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
npm run tauri build -- --no-bundle

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
- [ ] **Procedimentos → lista** — a tabela lista processos
- [ ] **Procedimentos → detalhe** — registrar/corrigir remessas, julgamento e conclusão; editar o resultado de um envolvido; confirmar que só **Reabrir** remove a conclusão
- [ ] Em um **IPM**, a linha de Escrivão mostra apenas **“-”** na coluna Documento e o formulário de substituição não pede tipo/número
- [ ] Depois de concluir, desaparecem os controles de nova substituição, prorrogação e andamento; o aviso orienta usar **Reabrir**
- [ ] Com o processo concluído, chamadas diretas desses três comandos devolvem mensagem amigável e não gravam nada
- [ ] **Catálogos → Apuratórios** — a coluna **Cita documento** aparece nos papéis, a alternância grava, e tornar o mesmo papel responsável logo depois **não** religa a flag
- [ ] **Procedimentos → formulário** — abrir "Novo" e confirmar que remessas, julgamento, conclusão, soluções e penalidade não aparecem antes do cadastro
- [ ] **Indícios** — a partir do detalhe de um procedimento, num envolvido; em processo a ação não aparece
- [ ] **Prazos** — o painel carrega
- [ ] **Usuários → lista**
- [ ] **Usuários → detalhe** — clicar numa linha
- [ ] **Usuários → novo** — o formulário abre
- [ ] **Configuração de apuratórios**
- [ ] **Catálogos** — abrir ao menos três catálogos diferentes do menu
- [ ] **Auditoria** — a lista e os três filtros
- [ ] **Designações por Militar**
- [ ] **Estatísticas de Processos** — tabelas centralizadas, somente rótulo e quantidade
- [ ] **Estatísticas de Procedimentos** — idem, sem barras percentuais
- [ ] **Mapa do Período** — gerar o mês sem apuratório marcado e com uma espécie marcada; os registros devem obedecer à mesma regra da tabela
- [ ] **PDF do Mapa do Período** — conferir o documento completo e uma ficha individual: capa por espécie, 7ºBPM, mês/ano, A4 paisagem **sem mexer em Orientação no diálogo**, fichas compartilhando folha, marcadores de fim, “Continuação do …” e tabelas longas sem perda. Nos enquadramentos: um bloco por natureza, artigo antes da norma, **nenhum texto repetido**, analogia recuada sob a infração do Estatuto e Resultado empilhado
- [ ] **Mapas Salvos**
- [ ] **Relatório Anual**

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
- [ ] **Procedimentos** — idem, com 128 (ou 129 se o IPM de teste ainda estiver lá)
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
- [ ] **Procedimentos**, **Auditoria**, **Mapas Salvos** e **Catálogos** — idem,
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
- [ ] Se algum filtro passar de 5.000 registros, aparece o aviso dizendo que
      saíram os 5.000 mais recentes. **Não pode cortar calado**

#### O desenho, e o que a CSP recusaria

- [ ] **Procedimentos** — lado a lado com uma captura de antes: tem de estar
      **idêntica**. Foi medida propriedade a propriedade, mas o olho é o juiz
- [ ] **Larguras de coluna aparecem** em todas as listagens. Se
      `aplicarLarguras()` não rodar, as colunas voltam a se dimensionar pelo
      conteúdo e **nada acusa** — é o mesmo sintoma das barras dos painéis
- [ ] Console **sem `Refused to`** nas seis listagens. É o que pegaria uma
      largura que tenha escapado para um `style=""`
- [ ] Texto longo (nome, unidade, descrição de infração) corta com **reticências**
      e entrega o inteiro no **tooltip**
- [ ] **Estatísticas de Procedimentos** — a descrição das infrações não está mais
      cortada em 90 caracteres com "…" no meio do texto: corta por largura e o
      tooltip traz o texto legal inteiro
- [ ] Em **1600, 1366, 1100 e 900px** nenhuma listagem operacional rola na
      horizontal; em **899px** rola, em vez de espremer as colunas
- [ ] **Designações por Militar** e **Mapa do Período** continuam rolando na
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

1. Apagar o IPM de teste `250d8ee1-c167-4604-8cdf-2bd5a62d8422`
2. Rodar `99_conferencia.sql` e conferir 24 contagens e 17 invariantes em zero
3. Remover o schema `legado` (passo 8 do roteiro da seção 6.2)

**Achou divergência na amostra?** Ela é de mapeamento, não de dado: corrija a
etapa correspondente em `src-tauri/importacao/` e rode o roteiro do zero.

> ⚠ **Cuidado:** o roteiro do zero recria o banco. Se alguém já tiver lançado
> processo real pelo app, ele se perde. Hoje há **um backup verificado** em
> `~/backups/adm-p6/`, restaurado e conferido contra a origem — inclusive o
> anexo de 20 MB, byte a byte.

---

## 12. Changelog — as 20 rodadas

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
