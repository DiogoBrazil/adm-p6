# ADM-P6 — guia de continuidade da migração

> Estado da remodelagem do banco, do backend e do frontend do **ADM-P6**
> (Seção de Justiça e Disciplina do 7º BPM), na migração Python/Eel → Rust/Tauri.
>
> Este arquivo é a fonte de verdade para retomar o trabalho, e é escrito para ser lido
> por quem chega sem contexto nenhum. O quadro abaixo diz o que fazer a seguir; a §8 diz
> o que já foi feito e por quê; a §7 diz como mexer sem quebrar nada.

> ## ▶ POR ONDE RETOMAR
>
> **Estado:** as seções 8.1 a 8.7 estão concluídas. O banco tem os dados de produção dentro
> — 128 processos, 235 militares, 141 prazos, 64 andamentos, 123 enquadramentos —
> conferidos por 24 contagens, 17 invariantes e 377 comparações campo a campo, e travados
> por 88 testes. As 6 migrations estão aplicadas.
>
> **Tudo o que resta é conferência humana na tela.** Não há código pendente: nenhum item
> abaixo pede que você escreva algo, só que olhe e decida. É deliberado — o que sobrou é
> exatamente o que teste automatizado não alcança.
>
> ### Faça nesta ordem
>
> | # | O que | Onde está descrito | Bloqueia? |
> |---|---|---|---|
> | 1 | **Conferir a amostra na tela** — abrir os 6 processos e olhar rótulo e layout. O campo a campo já está feito e acusa **0 divergências em 377 comparações** | §8.5, "A pendência que sobra" | **Sim.** Enquanto não for aceita, o schema `legado` fica no banco e ninguém deve usar o app para valer |
> | 2 | **Percorrer as telas com o console aberto (F12)** — a CSP foi ligada e nunca foi exercida clicando. Violação aparece como `Refused to…` no console do WebView, não no log do processo | §7.5 | **Sim** para usar o app para valer: uma tela pode estar muda sem avisar |
> | 3 | **Remover o schema `legado`** — só depois de 1 e 2 | §8.5, passo 8 do roteiro | não |
> | 4 | **Resolver os 3 enquadramentos de art. 29** (SR 2 e SR 5) pela tela, no seletor novo | §8.5, "A pendência que sobra" | não |
>
> Feitos os quatro, **a migração está concluída** e o trabalho seguinte é manutenção
> normal: §7.3 para mudar schema, §7.4 para acrescentar catálogo.
>
> ### Antes de tocar em qualquer coisa, leia
>
> - **§3** — os 6 princípios do modelo. Toda decisão futura tem de caber neles.
> - **§7.2** — **acabou o `docker compose down -v`.** Com dado real dentro, recriar o
>   volume apaga 8 anos de registro. Mudança de schema agora é migration incremental
>   (§7.3 traz o ciclo novo, passo a passo).
> - **§10** — as armadilhas. Cada uma já custou tempo pelo menos uma vez.
>
> ### Se você precisar recomeçar o banco do zero
>
> Numa máquina de desenvolvimento, ou porque uma migration nova precisou ser reescrita: o
> roteiro completo (recriar volume → migrations → restaurar `adm-p6.sql` → oito etapas →
> conferência) está em **§8.5, "O roteiro, do zero"**. Ele foi testado de ponta a ponta e
> não edita uma linha do dump.

| | |
|---|---|
| **Branch** | `migrate_to_rust_with_tauri` |
| **Branch legada (Python/Eel)** | `upload_pdf_to_procedure` — consultar só para esclarecer regra |
| **Dump do banco em produção** | `adm-p6.sql` (44 MB, 13/05/2026) — **somente leitura**, no `.gitignore` |
| **Diagnóstico do estado anterior** | `ANALISE-MIGRACAO.md` |
| **SGBD** | PostgreSQL 16 (compose, porta 5438) — requer 12+ pela coluna gerada, e `btree_gist` |

**Números de hoje**

| | |
|---:|:---|
| Migrations | 6 (eram 32) |
| Tabelas · FKs · CHECKs · EXCLUDEs · triggers | 43 · 55 · 25 · 2 · 2 |
| Catálogos administráveis | 25 |
| Comandos Tauri | 75 (eram 146) |
| Backend Rust | 7.002 linhas (eram 9.194) |
| Testes de integração | **88** (eram 0) |
| Frontend | 5.263 linhas em 16 arquivos (era 1 arquivo de 2.124) |
| Comandos que o frontend invoca e não existem | **0** (eram 87) |
| Chamadas fora do cliente tipado | **0** (eram 118) |
| Scripts de importação | 10 arquivos, 1.428 linhas de SQL |
| **Dados de produção no banco** | **128 processos · 193 envolvidos · 235 militares · 123 enquadramentos** |

---

## 1. Por que esta refatoração existe

O schema anterior consolidou três problemas que ficariam caros depois de importar os 128
processos reais:

1. **Identidade sem garantia.** Havia 10 tabelas quase idênticas (uma por espécie de
   apuratório) costuradas a um hub por **código Rust sem FK nenhuma**. Pior:
   `tipo_to_table()` fazia um `match` sobre `apuratorios.nome_apuratorio` — uma linha
   **editável pelo usuário**. Renomear um apuratório quebrava update, delete, PDF e
   substituição de encarregado de todos os registros daquele tipo.
2. **Regra de negócio controlada por texto de exibição:** `== "Punido"`,
   `== "Feito Preliminar"`, `Some("Prisao") | Some("Detencao")`,
   `natureza.includes('sinistro de trânsito')`, `tipo_detalhe IN ('IPM','SR','SV')`.
3. **Duas fontes de verdade** para andamentos, PDFs, histórico de encarregados e indícios:
   JSONB nas 10 tabelas × tabelas normalizadas criadas depois e nunca usadas.

Somado a isso, 62 das 219 consultas SQL (28%) não executavam, e campos com dado real não
tinham destino: `numero_controle` (128/128), `natureza_procedimento` (88), vítimas
múltiplas (71), `motorista_id` (15), o autor de cada andamento.

---

## 2. Decisões de negócio tomadas — **não reabrir sem motivo novo**

Todas foram decididas pelo responsável do projeto e estão implementadas.

| # | Questão | Decisão |
|---|---|---|
| 1 | Existe instalação do schema novo a preservar? | **Não.** As 32 migrations foram substituídas por baseline limpa. Histórico no Git. |
| 2 | Solução e penalidade: do processo ou do envolvido? | **Do envolvido.** `apuratorios.max_envolvidos` torna configurável quantos PMs cada apuratório aceita. Com limite 1 o comportamento é idêntico ao de hoje. |
| 3 | O que são `Sugerido_Arquivamento`, `Sugerido_IPM`, `Sugerido_Sindicancia`? | **Conceito distinto.** O encarregado *sugere*; a autoridade *decide*. Dois campos, dois catálogos: `tipos_solucao_sugerida` e `tipos_solucao_decidida`. |
| 4 | Crime militar × comum é do artigo ou do caso? | **Do caso** (art. 9º do CPM). A esfera é escolhida **no vínculo** envolvido↔artigo. Crime × Contravenção, esse sim, é atributo do artigo. |
| 5 | A analogia com o RDPM é obrigatória para toda infração estatutária? | **Sim, regra universal.** `analogia_transgressao_id` é `NOT NULL`. |
| 6 | O que significa `data_fim` de uma designação? | **O dia da troca, exclusivo.** O sucessor começa exatamente nesse dia. Intervalo semiaberto `[)`. |
| 7 | Qual o escopo de unicidade do número de controle? | **Sequencial por unidade, ano e apuratório.** |
| 8 | Condutor (motorista) em sinistro | **No máximo um por processo, sempre entre os envolvidos.** É papel do envolvido, não outra pessoa. |
| 9 | Papéis obrigatórios bloqueiam o salvamento? | **Sim.** Um `obrigatorio` que não bloqueia não significa nada. Para permitir a ausência, desmarque `obrigatorio` naquele apuratório — quem decide é a configuração. |
| 10 | Que catálogos vêm semeados? | **Só o que é lei** e não varia por instalação (migration `0003`). O operacional por unidade fica com o administrador. |
| 11 | Como o administrador configura um apuratório? | Módulo dedicado `apuratorio_config`, não o CRUD genérico: as duas tabelas de associação têm PK composta, sem `id` e sem `nome`. |
| 12 | Rumo do frontend | Vanilla TS **dividido em módulos**, sem dependência nova, migrando tela por tela. |
| 13 | Quantos envolvidos cada apuratório aceita? | **Vem do tipo, não de uma lista à mão.** `procedimento` (CP, FP, IPM, SR, SV) fica **sem limite**; `processo` (CD, CJ, PAD, PADE, PADS) fica com **1**. Um processo disciplinar é instaurado contra um militar; um procedimento apura um fato e alcança quantos alcançar. Espécie nova herda a regra do tipo. |
| 14 | Os 37 processos sem envolvido na importação | **Criar o envolvido.** Não é inventar fato: os 37 têm `nome_pm_id` e `status_pm` preenchidos, e 13 têm solução e 7 têm penalidade. Como essas três informações só existem em `processo_envolvidos` no schema novo, não criar significaria **perdê-las**. |
| 15 | As unidades além do 7ºBPM | **São unidades de verdade.** CORREGEPOM (16 processos), 9ºBPM (2) e 11ºBPM (1) entram em `unidades_pm`. Importa para a numeração, que é única por unidade. |
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
| 26 | O recorte do legado (`tests/fixtures/legado_amostra.sql`) traz os 236 militares com nome real. Versiona? | **Sim, como está.** O repositório é interno da Seção e o risco foi avaliado e aceito. Não é o mesmo caso do `adm-p6.sql`, que fica fora do git por ser o **dump inteiro** — 44 MB com oito anos de fato disciplinar. O recorte é 158 KB, sem senha, sem CPF, e sem ele os 3 testes de importação não rodariam em clone nenhum: a rede de proteção da §8.5 deixaria de existir fora desta máquina. |
| 25 | Situação do processo (o catálogo `status_processo`, com 7 estados) | **Continua derivada das datas.** Era catálogo órfão: nenhuma coluna do legado o referenciava, e a situação nunca foi gravada em processo nenhum. O modelo novo a deriva do fato registrado — `data_conclusao`, `data_julgamento`, `data_remessa_*`, `prazo_vencimento` —, e assim não existe estado que alguém marque e esqueça de atualizar. |

---

## 3. Princípios invioláveis do modelo

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

## 4. Fatos do dump que fundamentam o modelo

Verificados por contagem direta sobre `adm-p6.sql`. Use-os como referência; não é preciso
reprocessar o dump.

| Achado | Consequência |
|---|---|
| `concluido` ⟺ `data_conclusao IS NOT NULL` em **128/128** | coluna booleana eliminada |
| `numero` == `numero_portaria` em 88/89, `numero_memorando` 32/32, `numero_feito` 7/7 | as 3 colunas são o mesmo conceito → `numero_documento` |
| `numero_controle` ≠ `numero` em 5 linhas | são conceitos **distintos**; ambos ficam |
| `data_vencimento − data_inicio == dias_adicionados` em **141/141** | regra única `vencimento = inicio + dias`; o `dias-1` do Rust era bug |
| 0 duplicatas de numeração nos 99 ativos, 7 se incluir inativos | os índices únicos **precisam** ser parciais `WHERE ativo` |
| `nome_pm_id` == PM de `ordem=1` em **91/91** | não existe "PM principal" |
| Os 37 "processos" (PADS/PAD/CD/CJ/PADE) têm **zero** envolvidos | envolvidos unificados para processo e procedimento |
| `motorista_id` == `nome_pm_id` e está entre os envolvidos em **15/15** | condutor é flag do envolvido |
| `status_pm` difere entre PMs do mesmo processo em 2 casos | status é **por envolvido** |
| Prazos: 1 vigente por processo (44/44), máx. 8 prorrogações | vigência derivada de `ordem`, sem coluna `ativo` |
| `escrivao_id` em 23 (= nº de IPMs); `presidente/interrogante` em 4 (PAD+CD+CJ) | papéis são **configuração por apuratório** |
| `transgressoes.artigo` mapeia 1:1 com `gravidade` (15=leve, 16=média, 17=grave) | gravidade vem do artigo, não duplicada |
| `natureza_processo` 0/128, `solucao_final` 0/128, `indicios_categorias` todas `[]` | colunas mortas, removidas |
| Só **7 dos 236** usuários têm e-mail+senha | separação policial × conta confirmada |
| `andamentos[].usuario` é **nome em texto**, não id | são só **2 autores distintos** em 64 andamentos, e **os dois casam** com militares cadastrados |
| `tipo_geral` já separa procedimento (CP, FP, IPM, SR, SV) de processo (CD, CJ, PAD, PADE, PADS) | é a fonte de `tipos_apuratorio` **e** de `max_envolvidos` (decisão 13) |
| Vários envolvidos é a norma, não exceção: 13 dos 23 IPMs e 19 das 55 SRs têm 2+ | o máximo é 9, num IPM |
| Os 37 processos sem envolvido têm 37/37 `nome_pm_id`, 37/37 `status_pm = Acusado`, 13 soluções e 7 penalidades | fundamenta a decisão 14 |
| **97/97 prorrogações começam NO dia do vencimento anterior** | resolvido pela migration `0005` (decisão 17): a ocupação virou `[)` e há **0** sobreposições |
| **58 das 97 prorrogações não têm motivo** | resolvido com texto reconhecível na importação (decisão 18) |
| `data_vencimento == data_inicio + dias_adicionados` em 141/141, e `dias > 0` em 141/141 | a coluna gerada reproduz o histórico exatamente |
| `ativo = true` no prazo coincide com a maior `ordem` em 44/44 processos | a vigência derivada da `ordem` reproduz o legado |

### Dez fatos que só a importação revelou

Estes contradizem o que as versões anteriores desta seção afirmavam. O que vale é a coluna
da direita — foi medida contra o dump e conferida pelos scripts que rodaram.

| Achado | Consequência |
|---|---|
| Os 3 CPs deprecam **8ºBPM e 10ºBPM**, que nunca aparecem em `local_origem` | `unidades_pm` são **6**, não 4: o catálogo vem da união de `local_origem` **com** `unidade_deprecada`, e `carta_precatoria_detalhes.unidade_deprecada_id` é NOT NULL |
| `local_fatos` guarda o **nome** do lugar, não o id | os UUIDs de município preservados na `0003` não servem para este join. 117/128 casam direto; os outros 11 vêm como `"Distrito (Município)"` (Bom Futuro ×8, Jaci-Paraná, Joelândia, Tarilândia). Sem o sufixo, **128/128** resolvem — e nenhum nome do catálogo contém `(` |
| `usuarios.posto_graduacao` era **texto livre** e não validava contra o catálogo do próprio legado | 1 militar está como `TC PM` e 7 como `ST PM`; o catálogo grafa `TEN CEL PM` e `SUB TEN PM`. Sem alias explícito, 8 militares não entrariam |
| **PADS (32) e PADE (1) são `processo` e usam `responsavel_id`** | `responsavel_id` → **Encarregado sempre**, e não "Presidente quando `tipo_geral = processo`". Presidente vem de `presidente_id`, e só existe em CD, CJ e PAD |
| `historico_encarregados` tem **25 entradas** em 19 processos | não 19 entradas. Depois do colapso das trocas do mesmo dia (decisão 19) sobram as 19 substituições |
| 4 das 7 contas do legado **já estavam em bcrypt**, não em SHA-256 | `auth::login` trata os dois: `$2…` verifica direto, 64 caracteres valida por SHA-256 e **substitui por bcrypt no primeiro acesso**. Nenhuma senha precisou ser trocada |
| **O legado tinha DUAS fontes de enquadramento que nunca se encontraram** | as tabelas `pm_envolvido_*`, usadas só pelos **procedimentos** (SR, IPM), e a coluna jsonb `processos_procedimentos.transgressoes_ids`, usada só pelos **32 PADS**. A segunda tem **62 vínculos de RDPM e 11 de infração estatutária** — mais que a primeira, e passou despercebida na primeira leitura do dump |
| Os 11 itens de estatuto do jsonb **trazem `rdmp_analogia`** | é exatamente o que `analogia_transgressao_id` exige. Os 3 vínculos sem analogia vêm todos da outra fonte (decisão 22) |
| O jsonb repete `"natureza": "grave"` em cada vínculo de RDPM | redundante: a gravidade vem do artigo. É o caso concreto do que o §3.2 chama de "comportamento vem de atributo semântico" — o schema novo não a duplica nos 95 incisos |
| Os 4 catálogos `locais_origem`, `naturezas`, `tipos_processo` e `status_processo` têm `created_at` idêntico e ids sintéticos (`loc001`, `nat001`…) | são **seed de demonstração** do app antigo, com **0 referências** em 128 processos e 8 anos. `locais_origem` lista 1ºBPM/2ºBPM/BOPE/ROTAM/CG enquanto os processos usam 7ºBPM/CORREGEPOM/9ºBPM/11ºBPM — zero interseção (decisão 24) |

---

## 5. O que está PRONTO

### 5.1 Migrations — `src-tauri/migrations/`

| Arquivo | Linhas | Conteúdo |
|---|---:|---|
| `0001_schema.sql` | 1.127 | `btree_gist` → catálogos → pessoas → núcleo → filhas → sistema → índices → triggers. Comentado por seção, explicando o *porquê* de cada decisão. |
| `0002_seed_admin.sql` | 29 | **só** um perfil administrativo + uma conta. Nenhum policial fictício. |
| `0003_seed_catalogos_legais.sql` | 369 | os catálogos que são **lei**: 2 círculos, 13 postos, 112 municípios/distritos de RO, 7 dispositivos legais, 2 espécies, 2 esferas, 3 naturezas de transgressão, 3 artigos do RDPM, 95 transgressões, 26 infrações penais, 20 infrações do Estatuto. Idempotente (`ON CONFLICT DO NOTHING`). |
| `0004_view_processos_detalhados.sql` | 135 | `v_processos_detalhados`: catálogos resolvidos + as três derivações que o schema não guarda como coluna. Ver 8.4. |
| `0005_prazo_intervalo_ocupacao.sql` | 31 | o intervalo de *ocupação* do prazo passou de `[]` para `[)`, para acomodar a prorrogação que começa no dia do vencimento anterior (decisão 17). Não mexe em `data_vencimento`. |
| `0006_ajustes_catalogos_administraveis.sql` | 93 | quatro ajustes vindos da conferência das telas: `e_estatuto_militar`, `e_distrito` no lugar de `tipo`, e a remoção de `ordem_hierarquica` e das subdivisões (decisões 27 a 30). |

**Seed técnico:** `admin@sistema.com` / `123456` (bcrypt custo 12, hash verificado por teste).
`policial_militar_id` é `NULL` — a conta técnica não inventa militar. **Trocar a senha em
qualquer instalação real.**

**Duas exclusões deliberadas na 0003**, para que nada suma em silêncio: o art. 42 da LCP
estava cadastrado duas vezes (fica a linha ativa) e três linhas de teste já inativas no
inciso "LX" do art. 29 foram descartadas. Daí 26 e 20, e não 27 e 23. Onde o dump já tinha
UUID (municípios, infrações penais e do Estatuto) ele é **preservado**, para a importação
da etapa 8.5 casar por id sem reconsultar.

**A 0003 foi gerada por script** a partir do dump. O script é descartável e não está
versionado; se precisar regerar, a lógica está documentada no cabeçalho do próprio `.sql`.

### 5.2 Modelo de dados

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

### 5.3 Configurabilidade — 25 catálogos + 2 tabelas de configuração

Os atributos semânticos abaixo são o que substitui o hardcode:

| Catálogo | Atributo semântico | Substitui |
|---|---|---|
| `apuratorios` | `prazo_base_dias`, `max_envolvidos`, `exige_natureza_fato`, `codigo_extensao` | `match tipo_detalhe`, `tipo_to_table()` |
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

### 5.4 Integridade garantida pelo PostgreSQL

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

### 5.5 Backend Rust — 11 módulos, 75 comandos

| Módulo | Papel |
|---|---|
| `auth` | login por conta, `pode_administrar` no lugar de `perfil == "admin"`, upgrade de hash SHA-256 legado |
| `users` | policial militar e conta **separados**, gravados por um formulário só, numa transação. Trava do último administrador |
| `legal_catalogs` | **7 comandos genéricos** sobre o registro `domain::CATALOGOS` (25 catálogos). Nome de tabela/coluna vem sempre do registro, nunca da requisição |
| `apuratorio_config` | **novo.** 5 comandos que cadastram `apuratorio_documentos_iniciadores` e `apuratorio_papeis` — sem eles nenhum processo pode existir |
| `proceedings` | uma tabela só; `tipo_to_table()` eliminado. Validações leem atributos semânticos |
| `deadlines` | `ordem` (0 = inicial); dias vêm de `COALESCE(adi.prazo_base_dias, a.prazo_base_dias)` |
| `evidence` | 5 tabelas de enquadramento → 3; esfera penal escolhida no vínculo |
| `movements` | tabela relacional com **autor** e tipo do catálogo; `cancelado_em` no lugar de booleano |
| `audit` | `alteracoes JSONB` registra o *diff* das mudanças de configuração |
| `maps_reports` | escopos de relatório vêm por parâmetro (`apuratorio_ids`, `papel_ids`, ano), não por `IN ('IPM','SR','SV')` |
| `files` | **novo.** Um comando: abre o diálogo nativo de "salvar como" e grava. Existe porque `<a download>` não define destino no WebView, e porque a tela não precisa poder escrever em caminho arbitrário |

**Segurança:** as 13 escritas que rodavam só com `require_session` agora exigem
`require_admin`. Há trava do último administrador, no backend e dentro da transação.

### 5.6 Frontend — migração fechada

```
src/
  api.ts            269   cliente tipado: mapa `Commands` com os 75 comandos
  types.ts          863   interfaces derivadas de src-tauri/src/*/domain.rs
  dom.ts            150   escape, tabela, entrega de arquivo (CSV, anexo, impressão)
  main.ts           279   shell, sessão, menu e roteamento — e nada mais
  telas/
    processo.ts     921   lista, formulário completo e detalhe
    indicios.ts     421   enquadramento por envolvido, com o seletor de analogia
    catalogos.ts    417   os 25 catálogos, gerada de legal_catalogs_definitions
    usuarios.ts     356   lista, formulário (militar + conta) e detalhe
    apuratorio.ts   336   configuração de documentos iniciadores e papéis
    mapas.ts        300   mapa do período e mapas salvos
    estatisticas.ts 287   /estatisticas/processos e /stats/procedimentos
    auditoria.ts    178   lista com filtros e o diff de `alteracoes`
    encarregados.ts 163   matriz militar × apuratório
    anual.ts        130   relatório anual, impresso pelo sistema
    prazos.ts       113   painel de prazos, com exportação CSV
    dashboard.ts     80   painel de entrada
```

**Não sobrou chamada não tipada.** `grep -rn "invoke" src/ --include=*.ts` só
acha `api.ts`. O `main.ts` caiu de 1.484 para 272 linhas: saíram o `call()`
legado, o renderizador genérico (`tableFrom`, `crudConfigs`, `renderCrudForm`,
`renderDetail`, `exportBar`) e as sete telas que viviam ali.

**O cliente tipado (`api.ts`) é a peça central.** O nome do comando é
`keyof Commands`, e argumentos e resposta saem do mesmo mapa. Comando
inexistente, argumento errado ou campo de resposta inventado passam a ser
**erro de compilação** — antes viravam mensagem de erro na tela do usuário.
`tsconfig.json` roda em `strict` + `noUncheckedIndexedAccess`, e
`npm run build` executa `tsc --noEmit` antes do Vite.

**O que a migração das últimas telas encontrou quebrado**, tudo invisível até
o clique: os três filtros da auditoria (mandavam `tabela` e `usuario_id`; o
comando recebe `entidade` e `usuarioId`), a paginação de usuários (`per_page`
em vez de `perPage`), o formulário de usuário inteiro (`posto_graduacao` em
vez de `posto_graduacao_id`, `perfil` textual, um `is_operador` inexistente),
catorze campos com sigla no nome no detalhe do usuário
(`stats.encarregado_pads`, `stats.escrivao`…) e o cartão principal do painel
(`data.total_processos`, que se chama `total`).

**Duas armadilhas que o cliente tipado fixou:**

1. **As chaves de argumento do Tauri v2 são camelCase.** Um parâmetro
   `processo_id` no Rust chega como `processoId` no JS, salvo se o comando
   declarar `rename_all = "snake_case"` — e nenhum dos 75 declara.
   Atenção: isso vale para os **argumentos do comando**, não para os campos de
   um struct de request — dentro de `{ request: {...} }` os campos continuam em
   snake_case, porque ali quem desserializa é o serde.
2. **`ProceedingListItem` devolve os ids ao lado dos rótulos**
   (`documento_iniciador_id`, `unidade_origem_id`, `municipio_fato_id`,
   `natureza_fato_id`). Sem eles o formulário de edição teria de casar por nome
   para repopular os selects — e falharia justamente no caso que o modelo
   protege: um catálogo desativado não aparece na lista de opções, e o processo
   antigo perderia o vínculo em silêncio ao ser reeditado.

**Tela de catálogos:** montada inteiramente de `legal_catalogs_definitions`.
Acrescentar um catálogo no Rust faz a tela aparecer sozinha.

**Formulário de processo:** os campos condicionais são dirigidos por dado,
nunca por sigla — natureza obrigatória vem de `apuratorios.exige_natureza_fato`,
o campo de condutor de `naturezas_fato.exige_condutor`, deprecante/deprecada de
`codigo_extensao`, os papéis de `apuratorio_papeis`, e penalidade/dias de
`permite_penalidade`/`usa_quantidade_dias`.

**Telas de relatório:** o escopo é sempre filtro na tela, nunca sigla no
código. As caixas de apuratório vêm de `legal_catalogs_list("apuratorios")` e
as de papel de `papeis_processo`; cadastrar uma espécie nova a faz aparecer nos
painéis sozinha. Nenhuma sigla aparece em `src/telas/`.

**Como um arquivo é entregue ao usuário:** `dom.ts::baixarArquivoBase64` →
`files_save_download`. Não é `<a download>` com blob — no WebView do Tauri essa
via não define destino, não abre "salvar como" e varia por plataforma. O
diálogo é aberto no Rust, que também grava; a tela nunca recebe um caminho.

> O **anexo** era a exceção que contradizia a própria regra: `baixarAnexo`
> montava `Blob` + `URL.createObjectURL` + `<a download>`, isto é, exatamente a
> via que o cabeçalho de `dom.ts` explica não funcionar. Passou a usar o mesmo
> caminho do CSV — o conteúdo já chegava em base64, que é o que
> `files_save_download` recebe. Com isso não sobrou nenhum `blob:` no sistema, e
> a CSP pôde ficar sem ele.

### 5.7 Rede de proteção — 88 testes

| Arquivo | O que cobre |
|---|---|
| `util/mod.rs` | cria banco descartável, aplica migrations, remove ao final mesmo com pânico |
| `util/fixtures.rs` | `mundo_configurado()`: monta a cadeia inteira até um apuratório configurado. **Base de todo teste que toque em processo** |
| `migrations.rs` | **2 testes** — o contrato de 32 colunas de `v_processos_detalhados`, e que a antiga `v_processos` não voltou; migrations aplicam do zero **e são idempotentes**; tabelas extintas não ressuscitam; nenhuma FK sem `ON DELETE`; JSONB só nas 2 colunas justificadas; **a fronteira do seed** (11 catálogos legais com contagem exata, 17 operacionais vazios) |
| `schema_integrity.sql` + `.rs` | 42 asserções: estados impossíveis que o banco recusa + controles que ele deve aceitar |
| `auth_login.rs` | admin do seed autentica; busca case-insensitive; conta desativada não entra |
| `users_repository.rs` | **5 testes** — policial com e sem conta; normalização; retirar acesso desativa; listagem que pagina, busca e ordena pela hierarquia; as duas listas de processos do militar |
| `proceedings_repository.rs` | **18 testes** — criação completa, prazo inicial vindo da configuração, edição, as 6 validações semânticas, limites configuráveis, FK composta de papel, numeração parcial, substituição de designação, os 8 filtros, anexos, ciclo de vida, dashboard, catálogo desativado |
| `apuratorio_config.rs` | **3 testes** — troca de padrão e de responsável sem violar os índices únicos parciais; desativação preserva processos existentes |
| `deadlines_repository.rs` | **3 testes** — `dias_base` com e sem override; prorrogação encostando no vencimento; motivo obrigatório |
| `maps_reports_repository.rs` | **10 testes** — o mapa salvo como snapshot imutável; a regra do período do mapa; escopo vazio = todos; situação por apuratório; esfera penal escolhida no vínculo; catálogo desativado continua contando; matriz de designações por papel; sugerida × decidida; categorias de indício |
| `evidence_repository.rs` | **10 testes** — gravação substitui o enquadramento inteiro; esfera penal do vínculo; analogia do RDPM obrigatória; `indica_ausencia` lida do atributo, não do nome; lista de opções filtra `ativo` e leitura de registro não; painel na ordem dos envolvidos |
| `movements_repository.rs` | **7 testes** — o autor como FK; tipo opcional; ordem do mais recente; cancelamento datado, e o par (processo, andamento) obrigatório |
| `audit_repository.rs` | **7 testes** — o autor é uma conta, e a conta técnica não inventa militar; o diff de `alteracoes`; os três filtros; total do escopo na paginação; período nas estatísticas |
| `legal_catalogs_repository.rs` | **10 testes** — os 25 catálogos do registro leem de verdade e toda referência aponta para catálogo existente; cada tipo de coluna é lido como declara; item em uso desativa e não apaga; a busca recusa campo fora do registro; e a `ReferenciaFixa` sai do atributo, não da requisição — na gravação **e** na edição |
| `commands_ipc.rs` | **6 testes** — os comandos pelo IPC real, sobre o `MockRuntime`: guards, as duas convenções de argumento e o envelope `ApiResponse` |
| `sql_prepare.rs` | **2 testes** — as 88 consultas literais são analisadas pelo PostgreSQL, extraídas do próprio código-fonte; e as 40 dinâmicas precisam ter um teste que as execute, conferido nos dois sentidos |
| `importacao.rs` | **3 testes** — as oito etapas de `importacao/` rodam de verdade, na ordem, sobre um recorte do dump (`tests/fixtures/legado_amostra.sql`, 26 dos 128 processos, as 10 espécies). As contagens são comparadas com o próprio recorte, não com número mágico; o que fica fixado são as **decisões** — o colapso das trocas do mesmo dia, o motivo suprido, a solução replicada e o art. 29 que fica de fora. O terceiro roda o relatório de conferência da amostra e cobra **0 divergências** |

---

## 6. Sete bugs reais que os testes pegaram

Vale como argumento para não deixar a rede de proteção de lado.

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

---

## 7. Como rodar e verificar

```bash
cp .env.example .env                 # já aponta para o compose (porta 5438, adm_p6_db)
docker compose up -d

# Backend
cd src-tauri
cargo fmt --check
cargo test                           # 88 testes, bancos descartáveis
cargo run                            # aplica as migrations no startup e abre o app

# Frontend
cd ..
npm install
npm run typecheck                    # tsc --noEmit — é aqui que erro de comando aparece
npm run build                        # typecheck + vite build
```

Login inicial: `admin@sistema.com` / `123456`.

### 7.1 Primeiro uso — **só numa instalação nova**

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

### 7.2 ⚠ Acabou o `docker compose down -v`

**Com os dados de produção dentro, recriar o volume apaga 8 anos de registro.** A regra que
valia enquanto o banco estava vazio — "editou migration, recria o banco" — não vale mais.

O `sqlx::migrate!` guarda um checksum por versão: editar um `.sql` já aplicado gera
`VersionMismatch` no próximo startup. A partir de agora **toda mudança de schema é uma
migration nova** (`0006`, `0007`…), e os cinco arquivos existentes são imutáveis.

Se ainda assim for preciso recomeçar do zero — numa máquina de desenvolvimento, por
exemplo — o caminho completo é: recriar o volume, aplicar as migrations, restaurar o
`adm-p6.sql` e rodar as oito etapas de `src-tauri/importacao/` de novo. O roteiro inteiro
está na §8.5, e o `adm-p6.sql` nunca é modificado.

### 7.3 Como fazer uma mudança de schema agora

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
contrato de 32 colunas de `v_processos_detalhados` continua de pé — quatro módulos leem
dessa view, e uma coluna renomeada quebraria os quatro só em runtime.

**Se a mudança afetar a importação** — renomear uma coluna que `src-tauri/importacao/` usa,
por exemplo — `tests/importacao.rs` falha, porque roda as oito etapas de verdade. É o
objetivo: sem ele, a importação quebraria em silêncio e só se descobriria no dia em que
alguém precisasse rodá-la de novo.

### 7.4 Como acrescentar um catálogo administrável

É a operação mais comum, e é quase toda declarativa. Acrescentar uma linha ao registro
`src-tauri/src/legal_catalogs/domain.rs::CATALOGOS` faz a tela de catálogos aparecer
sozinha — `src/telas/catalogos.ts` é montada inteiramente a partir dele.

1. Migration nova com a tabela (`id`, `nome`, `ativo`, `created_at`, `updated_at`, mais os
   **atributos semânticos** que o comportamento vai consultar) e o índice único
   `(lower(nome))`.
2. Uma entrada em `CATALOGOS`, declarando tabela, colunas e rótulos.
3. Nada no frontend.

**Nunca** faça o comportamento depender do `nome` da linha — é apresentação, e o
administrador pode renomeá-la (§3.2). Se o código precisa distinguir uma linha das outras,
isso é um **atributo booleano** na tabela: foi assim que `permite_penalidade`,
`usa_quantidade_dias`, `exige_condutor`, `indica_ausencia`, `e_responsavel` e
`pode_administrar` substituíram os literais do sistema antigo (§5.3).

---

### 7.5 O roteiro de conferência de tela

**É o que falta para dar a migração por concluída.** Nada aqui é automatizável: são as duas
coisas que teste não alcança — a CSP, que só falha dentro do WebView, e o julgamento de
quem conhece o domínio.

Rode `npm run tauri dev`, entre com `admin@sistema.com` / `123456` e **deixe o console
aberto (F12)**. Toda violação de CSP aparece lá como `Refused to…`, e em lugar nenhum mais:
não no log do `cargo`, não numa mensagem de erro na tela. Uma tela pode ficar muda sem
avisar.

#### a) A CSP, tela por tela

Percorra **todas**, porque a política é global e o que a quebra é sempre local: painel,
processos (lista, formulário e detalhe), indícios, catálogos, configuração de apuratório,
usuários, mapas, estatísticas (as duas), auditoria, encarregados, relatório anual, prazos.

| Sintoma | Causa provável |
|---|---|
| O app abre e **nenhuma tela carrega dado** | `connect-src` sem `ipc: http://ipc.localhost` — é por aí que os 75 comandos passam |
| Uma tela abre **sem estilo** | `style-src`. Em produção o Vite emite `<link>`; em dev injeta `<style>`, e é por isso que existe `devCsp` |
| As **barras** dos painéis de contagem aparecem sem largura | `aplicarBarras()` não rodou, ou voltou um `style=""` no markup (§10) |

> A `csp` de produção **não é exercida por `tauri dev`**, que usa a `devCsp`. Para provar a
> restritiva de verdade é preciso `npm run tauri build` e abrir o bundle. A diferença entre
> as duas é só `style-src` e o WebSocket do HMR — mas é justamente onde mora o risco.

#### b) Os dois caminhos que gravam arquivo

São os que a mudança de capability (`dialog:default` → `dialog:allow-save`) poderia derrubar,
e nenhum teste os cobre porque abrem diálogo nativo:

- **exportar CSV** em Prazos;
- **baixar o anexo** de 20 MB do IPM nº 1/P6/7ºBPM/2024 — este passou a usar o diálogo
  nativo na §8.6.6, e antes disso provavelmente não funcionava.

#### c) O que a rodada dos catálogos mudou (§8.7)

- **Apuratórios** — sem a coluna "Código de extensão". E então o teste que importa: **criar
  um processo de carta precatória e confirmar que ainda exige deprecante e unidade
  deprecada.** É a prova de que esconder o código não desligou a extensão.
- **Municípios e distritos** — marcar "É distrito" revela o select de município e o exige;
  desmarcar limpa. Conferir que os 60 distritos existentes seguem com o município certo.
- **Infrações do Estatuto** — sem o select de dispositivo legal. Cadastrar uma e conferir
  **na tela de indícios** que o rótulo sai completo, com " - Estatuto dos Policiais
  Militares": é lá que o dispositivo preenchido sozinho aparece.
- **Postos e graduações** — sem "Ordem hierárquica". E em **Usuários**, confirmar que a
  ordem alfabética é aceitável: é a mudança mais visível, e a única que não se desfaz sem
  migration nova **e** redigitar os 13 valores (decisão 27).
- **Catálogos** — "Subdivisões de textos normativos" sumiu do menu, e o formulário de
  Infrações penais perdeu o campo "Subdivisão".

#### d) O seletor de analogia (§8.6.1)

Abrir os indícios de um envolvido, adicionar uma infração do Estatuto e conferir: a busca
filtra a partir de 2 caracteres, o filtro por natureza funciona, `Esc` e o clique no fundo
cancelam, e **cancelar não grava nada** — a analogia é `NOT NULL`, então meia escolha não
pode virar registro.

Os 3 casos pendentes de art. 29 (§8.5) são a validação real disto.

#### e) A amostra dos 6 processos

Descrita na §8.5, "A pendência que sobra". O campo a campo já está feito e acusa 0
divergências; o que falta é o olho: rótulo, layout, o que a Seção reconhece.

**Aceitou tudo?** Então rode o passo 8 do roteiro da §8.5 e remova o schema `legado`.

---

## 8. O caminho percorrido, e o que falta

As subseções estão na ordem em que foram executadas. **8.1 a 8.7 estão concluídas** e
ficam aqui porque registram *por que* cada coisa é como é — reabrir uma delas sem ler o
registro costuma refazer trabalho já feito. O que falta é **conferência de tela**: a
amostra (fim da 8.5) e a CSP (§7.5). **8.8 é o que foi deliberadamente descartado.**

| | | |
|---|---|---|
| 8.1 | Terminar o frontend | ✅ concluído |
| 8.2 | Testes para os módulos sem cobertura | ✅ concluído |
| 8.3 | `cargo sqlx prepare` | ✅ resolvido por outro caminho |
| 8.4 | Views de conveniência | ✅ concluído |
| 8.5 | Importação dos dados de produção | ✅ concluída — 1 pendência humana |
| 8.6 | Higiene | ✅ concluída |
| 8.7 | Ajustes nos catálogos administráveis | ✅ concluída |
| 8.8 | O que NÃO está planejado | — registro |

### 8.1 ~~Terminar o frontend~~ — **CONCLUÍDO**

Os 15 comandos inexistentes acabaram e o `call()` legado foi apagado. O que foi decidido no
caminho, e não deve ser reaberto sem motivo novo:

| Decisão | |
|---|---|
| `/stats/procedimentos` | Painéis genéricos com um filtro só (ano + apuratórios). Os nove comandos antigos **não** foram reimplementados: traziam a sigla no SQL |
| `/estatisticas/prazos` | **Removida.** Era a mesma listagem de `telas/prazos.ts`; o CSV virou botão lá |
| Relatório anual | Página HTML + impressão do sistema. **Nenhum crate de PDF no Rust** — o layout fica no frontend, onde é fácil ajustar |
| Regra do mapa | Aberto até o fim do período + concluído dentro dele. Não é "instaurado no período" |
| `/estatisticas/encarregados` | Matriz militar × apuratório, com filtro de papel. Conta toda designação, inclusive as encerradas |
| Entrega de arquivo | Diálogo nativo pelo Rust (`files_save_download`), não `<a download>` |

**O que sobrava do item original** — a escolha da analogia RDPM por `prompt()` — foi
resolvido na §8.6.1.

### 8.2 ~~Testes para os módulos sem cobertura~~ — **CONCLUÍDO**

`evidence`, `movements`, `audit` e `legal_catalogs` passaram a ter teste, e os comandos
Tauri são exercitados **pelo IPC de verdade** em `commands_ipc.rs`, sobre o `MockRuntime`.
Guards, desserialização de request e envelope `ApiResponse` deixaram de ser ponto cego.

Duas coisas ficaram registradas no código e valem para quem acrescentar comando:

- **`registrar_comandos` é a lista única** de plugins e comandos, usada pelo `run()` e pelo
  teste. Duas listas deixariam um comando passar no teste sem estar registrado no app.
- Um comando que receba `AppHandle` precisa ser **genérico no runtime** (`AppHandle<R>`),
  senão não compila sob o `MockRuntime`. `files_save_download` é o exemplo.

O que o teste de IPC mostrou sobre as duas convenções de argumento, e que vale saber ao
depurar: **argumento de comando com a grafia errada é ignorado em silêncio** — o comando
roda com o default, sem erro nenhum —, enquanto **campo de request faltando vira `Err` do
IPC**, que no frontend cai no `catch` do `call()`. Por isso o primeiro tipo de defeito
sobreviveu tanto tempo no `main.ts` legado.

**Ainda sem teste:** `apuratorio_config` tem 3, `users` tem 1 e `auth` tem 1 — cobrem o
caminho feliz, não os limites. E a cobertura de IPC é de amostra: seis comandos dos 75.

### 8.3 ~~`cargo sqlx prepare`~~ — **RESOLVIDO POR OUTRO CAMINHO**

O objetivo era "erro de SQL aparece no build, e não em runtime". O caminho previsto —
migrar as consultas estáticas para `sqlx::query!` — **não sobrevive ao código**: alcança
**9 das 128 consultas**.

O obstáculo não é o SQL dinâmico que este item antecipava. É o **tipo do parâmetro**: 79
das 88 consultas literais ligam um id com `$n::uuid`, e a macro então exige `uuid::Uuid`
onde a aplicação carrega `String`. Os ids chegam do frontend como texto JSON, atravessam os
structs de request e as assinaturas dos repositórios assim, e as fixtures os escrevem como
literal. Não há como contornar pelo SQL: `WHERE id::text = $1` perde o índice da chave
primária, e o sqlx não aceita anotação de tipo em parâmetro de entrada.

Sem macros, `cargo sqlx prepare` responde `no queries found` e cria um `.sqlx/` vazio — não
há o que versionar.

**O que foi feito no lugar**, em `tests/sql_prepare.rs`, alcançando as 128:

| | |
|---|---|
| As **88 literais** | são extraídas do próprio código-fonte e submetidas ao `PREPARE` do PostgreSQL. É a mesma análise que a macro faria — coluna, tabela, tipo de parâmetro — no `cargo test` em vez de no `cargo build`. Erro aponta arquivo, linha e a mensagem do banco |
| As **40 dinâmicas** | nem a macro nem o `PREPARE` alcançam: o SQL não existe até rodar. O teste cobra que cada uma tenha um arquivo de teste que a execute, e confere a lista **nos dois sentidos** contra o mesmo extrator |

Isso achou sete lacunas reais, agora cobertas: mapas salvos e cinco leituras de `users`.

> **A decisão que sobra:** migrar os ids de `String` para `uuid::Uuid` em todo o caminho —
> structs de request, assinaturas de repositório, fixtures — e então usar as macros de
> verdade. Ganha-se verificação em compilação; paga-se um refactor cruzado e um tratamento
> novo para UUID malformado vindo da tela, que hoje vira erro de banco legível. Não é
> trabalho mecânico, e por isso não foi feito por conta própria.

No `Cargo.toml`, `migrate` passou a ser **declarado** em vez de chegar por unificação
transitiva de features — era frágil, e uma mudança de dependência derrubaria o build sem
aviso. `macros` fica de fora, com o porquê escrito ao lado.

### 8.4 ~~Views de conveniência~~ — **CONCLUÍDO**

`v_processos_detalhados` (migration `0004`) substituiu a composição que estava escrita em
SQL em **cinco lugares**: `proceedings` (`COLUNAS_LISTA`, `JOIN_RESPONSAVEL`, `JOIN_PRAZO`),
`maps_reports::map_rows`, `deadlines::report`, `deadlines::dashboard` e
`users::proceedings_as_*`.

Duas cópias **já divergiam**: o mapa montava o rótulo do processo com uma expressão
diferente da listagem, e `deadlines` derivava a vigência do prazo por `DISTINCT ON`
enquanto o resto do código usava `LATERAL`.

A view resolve os catálogos e as três derivações que o schema não guarda como coluna:
responsável vigente (via `apuratorio_papeis.e_responsavel`), prazo vigente (maior `ordem`)
e contagem de envolvidos. **Não é a antiga `v_processos`** — aquela escondia dez tabelas
quase idênticas; um teste garante que o nome não volte.

#### A regra que a medição impôs

Medido com **5.000 processos** (o volume real é 128 em oito anos):

| | antes | pela view | decisão |
|---|---:|---:|---|
| contagem da listagem | 58 ms | **408 ms** | tabelas base |
| lista paginada (25) | 1,5 ms | 2,0 ms | view |
| mapa do período | 29 ms | 31 ms | view |
| relatório de prazos | 32 ms | 37 ms | view |
| prazos vencidos (agregação) | 7 ms | **40 ms** | tabelas base |

> **O PostgreSQL não poda os `LATERAL` cujo resultado a consulta não usa.** Então a view
> serve para **buscar linhas** — onde há `LIMIT` ou um recorte estreito —, nunca para
> **agregar sobre a tabela inteira**. Quem escrever um `count(*)` ou um `GROUP BY` que
> alcance muitas linhas deve partir das tabelas base.

A contagem da listagem passou a usar uma projeção enxuta em `BASE_CONTAGEM`
(`proceedings/repository.rs`), que repete de propósito os nomes de coluna da view — é o que
permite um `FILTRO` só valer para as duas fontes. Ficou **38× mais rápida que antes**, porque
a versão anterior arrastava quatro joins de catálogo que a contagem nunca leu.

O contrato de 32 colunas é travado por teste em `migrations.rs`: quatro módulos leem da
view, e uma coluna renomeada quebraria os quatro de uma vez, só em runtime.

Nenhum índice novo — a `0001` já traz os três que as derivações usam. Índice redundante
custa em toda escrita e não paga leitura nenhuma.

### 8.5 ~~Importação dos dados de produção~~ — **CONCLUÍDA**

Rodou inteira, do zero, num banco limpo. O que entrou:

| | |
|---:|:---|
| 128 | processos e procedimentos, de 2018 a 2026 (3 deles com extensão de carta precatória) |
| 193 | envolvidos — 156 do legado **mais 37 criados** dos processos que os guardavam em coluna |
| 235 | policiais militares — **7** contas de acesso (6 do legado + a técnica do seed) |
| 178 | designações, das quais **19 encerradas** por substituição |
| 141 | prazos — 44 iniciais e 97 prorrogações |
| 105 | vítimas e pessoas inquiridas |
| 64 | andamentos, de 2 autores, ambos com FK de verdade |
| 123 | enquadramentos — 27 categorias de indício, 12 infrações penais, **73 transgressões do RDPM** (11 dos procedimentos + 62 dos PADS) e **11 infrações estatutárias** |
| 1 | anexo (20 MB) |

Mais os catálogos operacionais, todos derivados do próprio dump: 2 tipos de apuratório,
10 apuratórios, 3 tipos de documento, 6 unidades, 16 naturezas do fato, 4 status, 3+5
soluções, 5 penalidades, 4 papéis de processo, 2 papéis de pessoa, 4 categorias de indício
e o perfil de acesso que faltava. Das 11 unidades, 6 vêm dos processos e 5 do catálogo
órfão `locais_origem`, como opção disponível (decisão 24).

#### O que NÃO entrou, e por quê

Levantado por auditoria coluna a coluna do dump — cada linha foi verificada, não suposta.

| O que | Motivo |
|---|---|
| 107 mapas salvos · 448 linhas de auditoria | decisão 16 |
| Militar fictício `ADMIN001` e sua conta | decisão 21 — **0 referências** em processo, envolvido, designação ou andamento |
| 3 vínculos de art. 29 (SR 2, SR 5) | decisão 22 — sem analogia RDPM em nenhuma das duas fontes |
| 3 incisos de teste do art. 29 + 1 art. 42 da LCP duplicado | descartados na `0003`; verificado: **0 referências** em dado real |
| Catálogos órfãos `naturezas` (8), `tipos_processo` (6), `status_processo` (7) | decisões 24 e 25 — **0 referências**, seed de demonstração do app antigo |
| Colunas **vazias**: `natureza_processo`, `solucao_final`, `infracao_id`, `indicios_categorias`, `prazos.autorizado_por` | 0 preenchidos em 128/141 linhas |
| Colunas **deriváveis**: `concluido`, `ano_instauracao`, `pdf_tamanho`, `prazos.ativo`, `prazos.tipo_prazo`, `indicios.categoria`, `usuarios.is_operador`, `usuarios.tipo_usuario` | cada uma reproduzível do que entrou — conferido uma a uma. Guardá-las seria criar segunda fonte de verdade (§3.4) |
| Discriminadores `pm_tipo`, `responsavel_tipo`, `escrivao_tipo`, `presidente_tipo`, `interrogante_tipo`, `escrivao_processo_tipo`, `autorizado_tipo` | de quando havia duas tabelas de pessoa; hoje só há `policiais_militares` |
| 3 tabelas `procedimentos_indicios_*` | 0 linhas |
| `alembic_version`, `schema_migrations` | controle de migration do sistema anterior |

#### Os cinco bloqueios que apareceram, e como cada um foi resolvido

Dois estavam previstos. Os outros três só apareceram ao medir o dump coluna a coluna, e
os três derrubavam a transação no meio.

| | Bloqueio | Saída |
|---|---|---|
| 1 | 97/97 prorrogações começam no dia do vencimento anterior, e o `EXCLUDE` usava `[]` | migration `0005`: a ocupação virou `[)`, e `add_extension` passou a praticar a mesma convenção (decisão 17) |
| 2 | 58/97 prorrogações sem motivo, com `ck_prazo_motivo` exigindo | texto reconhecível na importação (decisão 18) |
| 3 | 5 processos com 2–3 substituições **no mesmo dia**, e `ck_designacao_periodo` exige `data_fim > data_inicio` | colapso, mantendo a última do dia (decisão 19) |
| 4 | solução é do processo no legado e do envolvido no schema novo; 27 processos com solução têm 2+ envolvidos | replicada a todos (decisão 20) |
| 5 | `analogia_transgressao_id` é NOT NULL, e uma das duas fontes de enquadramento nunca registrou analogia | entra o que tem analogia (11, do jsonb dos PADS); ficam de fora os 3 de `pm_envolvido_art29` (decisão 22) |

#### Onde o script mora

`src-tauri/importacao/` — **SQL, não binário Rust.** O trabalho é mapeamento de conjuntos,
o PostgreSQL lê os JSON do legado nativamente, e não sobra código descartável no
repositório. Não é migration: não passa pelo `sqlx::migrate!`.

| Arquivo | Linhas | O que faz |
|---|---:|---|
| `01_catalogos.sql` | 255 | os 14 catálogos operacionais, todos de `DISTINCT` sobre o dump. Cria também `legado.map_papeis` e duas views auxiliares, usadas pelas etapas 02 e 06 |
| `02_config_apuratorio.sql` | 79 | `apuratorio_documentos_iniciadores` e `apuratorio_papeis` — **sem isto a FK composta recusa todo processo** |
| `03_policiais.sql` | 71 | 235 militares, depois as 6 contas |
| `04_processos.sql` | 74 | os 128, com os ids do legado preservados, mais os 3 detalhes de CP |
| `05_envolvidos.sql` | 106 | 156 + 37, soluções, penalidades, condutor, vítimas e inquiridos |
| `06_designacoes.sql` | 90 | os 4 papéis + a cadeia de substituição, com o colapso do mesmo dia |
| `07_prazos_andamentos.sql` | 70 | 141 prazos e 64 andamentos |
| `08_enquadramentos_anexos.sql` | 144 | indícios, crimes, RDPM e o anexo — das **duas** fontes de enquadramento do legado |
| `98_amostra_lado_a_lado.sql` | 346 | a conferência campo a campo dos 6 processos da amostra, legado × novo. **Uma instrução SQL só, sem meta-comando de psql**, para servir ao mesmo tempo à leitura humana e ao `cargo test` |
| `99_conferencia.sql` | 182 | 24 contagens e 17 invariantes, contra o schema `legado` como gabarito |

Os dois arquivos de conferência (`98_` e `99_`) são numerados fora da faixa de propósito:
o laço do roteiro casa `importacao/0*.sql`, então nenhum dos dois roda como etapa.

**A ordem é imposta pelas FKs**, não é arbitrária: catálogo antes de configuração,
configuração antes de processo (a FK composta), processo antes de envolvido, envolvido
antes de enquadramento. Rodar fora de ordem falha na hora, com erro de FK legível.

**Cada etapa é um arquivo e uma transação própria** (`BEGIN`/`COMMIT` dentro do arquivo).
Se a 04 falhar, as três primeiras já estão gravadas e você corrige só a 04. Por isso o
laço abaixo **não** usa `--single-transaction`: o arquivo já abre a sua.

**Nenhuma sigla é escrita à mão.** Tudo sai de `DISTINCT`, e todo id que o legado tem é
preservado — é o que faz as etapas seguintes casarem sem reconsultar. As exceções, todas
declaradas no cabeçalho da etapa 01:

1. `apuratorios.codigo_extensao = 'carta_precatoria'` — é o único **código técnico** do
   schema (§5.3), e acrescentar extensão é inerentemente mudança de código.
2. `legado.map_papeis` — o dump guarda o papel em **nome de coluna** (`responsavel_id`,
   `escrivao_id`…), não em texto. A tradução é declarada uma vez e reusada pelas etapas
   02 e 06. Mora dentro do schema `legado` de propósito: some junto com ele.
3. `papeis_pessoa` — vítima e inquirido não têm rótulo nenhum no legado.
4. O alias de posto `TC PM → TEN CEL PM` e `ST PM → SUB TEN PM`, sem o qual 8 militares
   não entrariam.
5. Os 15 dias do Feito Preliminar, no `apuratorio_documentos_iniciadores`: nenhum FP
   chegou a ter prazo registrado, então o valor vem da regra que o código legado
   carregava.

#### O roteiro, do zero

Testado de ponta a ponta. **Não edita uma linha do `adm-p6.sql`.**

```bash
# ── 1. Banco da aplicação, limpo, com as 5 migrations ────────────────────────
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

**As 24 contagens** batem (`99_conferencia.sql` imprime obtido × esperado, linha a linha).

**As 17 invariantes**, que valem mais que as contagens, todas em zero:

- nenhum processo perdeu espécie, unidade ou município na tradução;
- **nenhum processo ficou sem responsável vigente**, e o ocupante vigente do papel
  responsável é o mesmo que o legado registrava, nos 128;
- nenhum papel com dois ocupantes vigentes; nenhum buraco nem sobreposição entre
  designações consecutivas;
- todo envolvido do legado tem contrapartida, **e vice-versa** (checado nos dois sentidos);
- nenhum vencimento ou `dias` divergente — a coluna gerada reproduz o legado em 141/141;
- o prazo vigente derivado da maior `ordem` é o que o legado marcava `ativo`, em 44/44;
- nenhum andamento sem autor; nenhuma penalidade sem decisão; nenhum condutor que não
  fosse o motorista do legado; nenhum enquadramento apontando para envolvido de outro
  processo; nenhum militar do legado deixado de fora;
- **todo vínculo do jsonb `transgressoes_ids` tem contrapartida** — conferido separado
  para RDPM e para estatuto —, e nenhuma infração estatutária ficou sem analogia.

**Dois testes automatizados**, em `src-tauri/tests/importacao.rs` (494 linhas), rodam as
oito etapas de verdade — na ordem, pelos mesmos arquivos que a produção usa — sobre um
recorte do dump:

| Teste | O que trava |
|---|---|
| `as_oito_etapas_reproduzem_o_legado_sem_perder_nada` | as contagens, comparadas **contra o próprio recorte** e não contra número escrito no teste, mais 10 invariantes |
| `as_decisoes_da_importacao_ficam_registradas_no_dado` | as **decisões**: o colapso das trocas do mesmo dia (confere a SR 20 nome por nome), o motivo suprido, a solução replicada, o art. 29 que entra e o que não entra, o enquadramento dos PADS, as unidades do catálogo órfão, o prazo base derivado |

Os arquivos da fixture:

| Arquivo | O que é |
|---|---|
| `tests/fixtures/legado_amostra.sql` | o recorte: 26 dos 128 processos, cobrindo **as 10 espécies** e cada caminho. **Gerado, não escrito à mão** |
| `tests/fixtures/gerar_legado_amostra.sql` | qual recorte — a lista de processos escolhidos, comentada um a um |
| `tests/fixtures/gerar_legado_amostra.sh` | como gerar. Exige o schema `legado` carregado; roda o `.sql` acima e faz o `pg_dump` |
| `tests/fixtures/legado_amostra.cabecalho` | o cabeçalho explicativo que o gerador prepende ao dump |

**Para acrescentar um processo ao recorte** (um caminho novo, um caso que passou a existir):
edite a lista em `gerar_legado_amostra.sql` e rode o `.sh`. Não edite o
`legado_amostra.sql` à mão.

Três detalhes do gerador que existem por motivo, e que quebram se alguém os remover:
`--inserts` (o teste executa o arquivo pelo protocolo do Postgres, e `COPY ... FROM stdin`
é sintaxe do cliente psql); o filtro das linhas `\restrict`/`\unrestrict` (mesma razão); e
o `SET search_path = public` que o teste roda depois de carregar (o `pg_dump` zera o
`search_path` da conexão). Os três estão em §10.

**O recorte prova que o teste não é vazio.** Removendo o bloco dos PADS da etapa 08, os dois
testes falham com as contagens certas — foi verificado.

#### A pendência que sobra

##### 1. A conferência da amostra — **é o que falta para dar a importação por aceita**

As 24 contagens e as 17 invariantes provam que o **conjunto** está íntegro. O que elas não
provam é que cada processo, olhado de perto, diz a mesma coisa que dizia antes.

Metade disso deixou de ser trabalho manual. **`98_amostra_lado_a_lado.sql`** imprime, para
os 6 processos da amostra, o que o legado guardava e o que o schema novo guarda — campo a
campo, em nove aspectos: cabeçalho, responsável vigente, cadeia de prazos, envolvidos com
solução e penalidade, vítimas e inquiridos, andamentos, enquadramento, anexo e a extensão
de carta precatória. São **377 comparações, 0 divergências**.

```bash
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -q \
    < src-tauri/importacao/98_amostra_lado_a_lado.sql
```

A leitura é a última coluna: `igual = f` é o que interessa, e nenhuma linha com `f`
significa que os 6 atravessaram sem perder nada.

**Quatro comparações não são igualdade literal**, e é de propósito — são exatamente as
transformações que a importação fez, e é por isso que valem mais que as outras: o município
compara o nome **sem** o sufixo `"(Município)"` (etapa 04); as substituições comparam **dias
distintos**, não entradas, porque três trocas no mesmo dia foram uma só (decisão 19); a
solução é comparada **por envolvido** contra a coluna do processo (decisão 20); e o art. 29
tem uma linha que confere que os 3 sem analogia continuam **fora** (decisão 22).

O relatório é travado pelo teste `a_amostra_lado_a_lado_nao_acusa_divergencia`, que o roda
sobre o recorte e cobra três coisas: que a consulta continue válida contra o schema, que os
6 processos estejam no recorte — senão "sem divergência" não significaria nada — e que não
haja divergência. Que ele não é vazio foi verificado injetando três divergências numa
transação revertida: pegou as três.

**O que sobra é a conferência de tela**, que é o que o relatório não alcança: rótulo,
layout, o que a Seção reconhece de olho. O schema `legado` foi **deixado no banco de
propósito** para servir de gabarito. Rode `cargo run`, entre com `admin@sistema.com` /
`123456`, e abra os 6:

| Processo | Id | Por que este |
|---|---|---|
| IPM nº 8/7ºBPM/2024 | `10b39de3-fad8-4e93-9cea-7b2027118253` | 9 envolvidos (o máximo) e substituição de encarregado colapsada |
| IPM nº 1/7ºBPM/2024 | `ec07f120-e4c5-4337-b628-592c5859339c` | 8 prorrogações — a cadeia de prazos mais longa |
| IPM nº 1/P6/7ºBPM/2024 | `b0294d82-4d35-46d4-a10f-2bd2b555d462` | o anexo de 20 MB |
| PADS nº 1/7ºBPM/2025 | `22ce21be-aa00-42b5-98cd-65e1d328ba4e` | penalidade + envolvido criado (decisão 14) + enquadramento vindo do jsonb |
| CP nº 1/7ºBPM/2025 | `6b1f19a8-4ab8-4ecc-b596-27480bf9e017` | a extensão de carta precatória |
| SR nº 20/7ºBPM/2025 | `980f1a82-3771-4193-b43b-37a09eadf0c5` | três trocas de encarregado no mesmo dia, colapsadas em uma |

Para ver o mesmo registro do lado do legado:

```bash
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -x -c \
  "SELECT * FROM legado.processos_procedimentos WHERE id = '<id>';"
```

**Confira em especial** o que a importação transformou, e não só copiou: responsável
vigente, cadeia de prazos, envolvidos com solução e penalidade, vítimas (o legado
guardava array JSON), enquadramento, e o município nos processos de distrito
(Bom Futuro, Jaci-Paraná, Joelândia, Tarilândia — vinham como `"Distrito (Município)"`).

**Deu certo?** Então rode o passo 8 do roteiro e remova o `legado`. **Achou divergência?**
Ela é de mapeamento, não de dado: corrija a etapa correspondente em `src-tauri/importacao/`
e rode o roteiro do zero — leva menos de dois minutos e é idempotente por construção.

##### 2. Os 3 enquadramentos de art. 29 sem analogia — na tela, quando a Seção decidir

SR 2 e SR 5. `analogia_transgressao_id` é NOT NULL (decisão 5) e nenhuma das duas fontes do
legado registrou a analogia para eles. A conferência os lista com nome do militar e inciso;
a tela de indícios obriga a escolher a analogia ao reabrir o enquadramento.

**O que a própria Seção já decidiu em casos análogos**, extraído dos 11 vínculos que
entraram — serve de referência, não de resposta automática:

| Infração pendente | Analogias que a Seção já usou |
|---|---|
| Art. 29, III (SR 2 e SR 5) | **Art. 17, XXXII** — precedente único, a Seção foi consistente |
| Art. 29, XIII (SR 5) | Art. 16, XXIII · Art. 17, XX · Art. 17, XXI — **três precedentes diferentes**, não há resposta única |

Nada disso foi aplicado automaticamente: é classificação jurídica caso a caso, e o próprio
art. 29 XIII mostra por quê.

Para listar os 3 a qualquer momento:

```bash
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db -q \
    < src-tauri/importacao/99_conferencia.sql   # o último bloco imprime a pendência
```

> Depois que o schema `legado` sair, essa consulta deixa de funcionar. Os 3 casos são:
> **SR 2** — CHRISTIANO KAULING CAMPANINI, art. 29 III; **SR 5** — ADRIANO DE SÃO PAULO
> ASSUMPÇÃO, art. 29 III e art. 29 XIII.

### 8.6 ~~Higiene~~ — **CONCLUÍDA**

Cinco itens, nenhum bloqueante. Saíram todos, mais dois defeitos que apareceram no caminho
e que nenhuma tela deixava ver.

#### 8.6.1 Seletor de analogia RDPM no lugar do `prompt()`

`src/telas/indicios.ts::pedirAnalogia`. Eram dois `prompt()` do navegador — um pedia o termo
de busca, o outro pedia **o número da opção**. Era a única tela do sistema que pedia um
número digitado, e a que menos podia pedir: escolher o inciso análogo é classificação
jurídica, e quem escolhe precisa **ler** as opções.

Virou um seletor com busca incremental e lista clicável, montado em `document.body` — fora
do `#app`, porque `desenhar()` reescreve o painel inteiro a cada mudança e destruiria um
seletor montado ali. Fecha por botão, por `Esc` ou por clique no fundo.

Três coisas que valem registrar:

- **A assinatura não mudou.** `pedirAnalogia(rotulos): Promise<string | null>` continua
  igual, e os dois pontos de chamada não mudaram uma vírgula. `null` segue significando
  "não mexe em nada", que é o comportamento certo quando a analogia é `NOT NULL`.
- **O filtro por natureza da transgressão já existia e ninguém expunha.**
  `evidence_search_transgressoes` sempre aceitou `naturezaId`; agora há um select ao lado da
  busca, alimentado pelo catálogo `naturezas_transgressao` — nada de "leve/média/grave" no
  código. É por gravidade que se procura o inciso análogo.
- **Há um carimbo de sequência nas buscas.** Cada tecla dispara uma consulta; sem ele, a
  resposta atrasada de um termo antigo sobrescreveria a lista do termo atual.

No CSS entrou o **único modal do sistema** (`.modal-overlay` + `.modal`), e a lista de
resultados reaproveita `.evidence-results` / `.evidence-result-item`, que estavam no
`styles.css` sem nenhum `.ts` usando — sobra da tela antiga.

Os 3 enquadramentos de art. 29 pendentes são o primeiro uso real disto.

#### 8.6.2 A CSP, ligada

`src-tauri/tauri.conf.json`. Eram duas linhas de configuração — mas só depois de tirar os
dois obstáculos da §8.6.6.

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self' ipc: http://ipc.localhost;
object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'none'
```

**`connect-src` precisa de `ipc: http://ipc.localhost`.** É por aí que todo o IPC do Tauri
v2 passa: sem isso não é uma tela que quebra, são os 75 comandos de uma vez.

**`devCsp` existe porque desenvolvimento e produção carregam o CSS de formas diferentes.**
Em dev o Vite injeta o `styles.css` por `<style>` via JS (e o overlay de erro faz o mesmo),
então `style-src` precisa de `'unsafe-inline'` **só ali**; no build o Vite emite `<link>`,
que `'self'` cobre. `devCsp` também libera `ws://127.0.0.1:5173`, que é o HMR. O Tauri usa
`devCsp` em desenvolvimento e cai de volta em `csp` quando ela não existe.

Nada de nonce ou hash escrito à mão: o Tauri os acrescenta sozinho aos assets empacotados,
em tempo de compilação, e o `dist/index.html` gerado não tem script inline.

#### 8.6.3 Permissões do diálogo, estreitadas

`src-tauri/capabilities/default.json` concedia `dialog:default`, que arrasta `allow-open`,
`allow-message`, `allow-ask` e `allow-confirm`. O app chama **uma** API do plugin —
`save_file`, em `files/commands.rs`. Ficou `["core:default", "dialog:allow-save"]`, e o
`gen/schemas/capabilities.json` gerado pelo build confirma que é só isso que sobrou.

#### 8.6.4 `README.md`

Descrevia o mundo Python inteiro: venv, `requirements.txt`, Alembic, `python main.py`,
PyInstaller apontando para `web/`, `static/` e `db_config.py` — nenhum dos quais existe.
Reescrito curto, apontando para este arquivo.

> **Uma senha vazou por ele.** O README trazia `DB_PASSWORD=p67bpm` de `192.168.0.137`.
> Reescrever o arquivo tira do HEAD e **não do histórico** — `git log -p README.md` continua
> mostrando. Se aquele banco ainda existe, a senha precisa ser rotacionada; é a única
> remediação real.

#### 8.6.5 `CLAUDE.md`

Descrevia o framework "Reversa" e mandava escrever em `.reversa/` e `_reversa_sdd/` —
**nenhum dos quatro diretórios que ele cita existe no repositório**. Era artefato morto
carregado em toda sessão. Substituído pelos princípios do modelo, pelos quatro "nunca" e
pelas armadilhas que mordem quem escreve código aqui, apontando para cá.

#### 8.6.6 Os dois defeitos que a higiene descobriu

Nenhum dos dois estava previsto, e os dois eram invisíveis até o clique.

**O anexo ainda saía por `<a download>` com `blob:`** — `src/telas/processo.ts::baixarAnexo`.
Era exatamente a via que o cabeçalho de `dom.ts` explica não funcionar no WebView, e que o
CSV havia abandonado. Passou a usar `dom.ts::baixarArquivoBase64` →`files_save_download`,
como todo o resto. Ver §5.6.

**A barra dos painéis de contagem interpolava `style=""` no markup** —
`src/telas/estatisticas.ts`. Era a única do sistema, e a CSP a recusaria. A largura passou a
sair num `data-largura`, e quem a aplica é `aplicarBarras()`, pela CSSOM — que a CSP não
governa. A chamada mora em `main.ts::shell()`, o **único** ponto que escreve em `#app`,
para que nenhuma tela nova precise lembrar de fazê-la.

Os dois juntos são o que permitiu a CSP de produção ficar sem `'unsafe-inline'` e sem
`blob:`.

---

### 8.7 ~~Ajustes nos catálogos administráveis~~ — **CONCLUÍDA**

Veio da conferência das telas com o app rodando — o primeiro uso de verdade depois que a
importação fechou. Cinco campos que atrapalhavam mais do que ajudavam, e que só aparecem
quando alguém senta para cadastrar.

O achado que organiza a seção: **os cinco não eram o mesmo tipo de problema.** Três eram
campo a menos na tela; dois eram modelo a corrigir. Levantar antes de mexer foi o que
separou um do outro — e evitou remover uma coluna que quatro consultas usam.

| Campo | O que o levantamento mostrou | O que foi feito |
|---|---|---|
| `apuratorios.codigo_extensao` | Carrega comportamento real, mas é **código técnico**: a §5.3 já dizia que acrescentar extensão é mudança de código | Saiu do registro. **Sem migration** |
| `subdivisao_textos_normativos` | **Nunca usada**: 0 linhas, 0 no legado, `subdivisao_id` nulo nas 26 infrações penais, nenhuma consulta projetando | Removida por inteiro |
| `infracoes_estatuto.dispositivo_legal_id` | Sempre o mesmo valor, **mas não é coluna morta**: monta o rótulo em 4 consultas | Saiu da tela, ficou no banco, resolvida por atributo |
| `municipios_distritos.tipo` | Texto livre NOT NULL sem CHECK, e o pai opcional para todos | Virou `e_distrito` + CHECK |
| `postos_graduacoes.ordem_hierarquica` | Ordena de fato em 3 lugares | Removida, com a consequência aceita (decisão 27) |

As quatro decisões estão na §2 (27 a 30) e a migration é a `0006`.

#### O que **não** foi feito, e por que importa saber

`codigo_extensao` **continua no banco e continua dirigindo a carta precatória.** Só a
pergunta saiu da tela. Isso é seguro por um detalhe do CRUD genérico que vale ter em mente
(está na §10): o `UPDATE` monta o `SET` só com as colunas declaradas no registro, então
editar um apuratório pela tela não toca o que não está lá. Conferido no banco depois de
aplicar: `CP → carta_precatoria` intacto.

O reverso é a armadilha: uma coluna **obrigatória** fora do registro faria o `INSERT`
falhar, porque ninguém a preencheria. Foi por isso que o dispositivo do Estatuto precisou
do recurso novo, em vez de simplesmente sair da lista.

#### Dois recursos novos no registro genérico, não dois casos especiais

Os dois pedidos mais delicados podiam ter virado `if catalogo == "municipios_distritos"` em
`catalogos.ts`. Viraram declaração — e a tela continua sem **nenhuma** menção a nome de
catálogo, que é a propriedade que a §5.6 protege.

**`TipoColuna::ReferenciaFixa`** — a coluna existe no banco e não na tela. O `save` a
preenche com `(SELECT id FROM <alvo> WHERE <marcador>)`, subconsulta montada do registro:
não consome posição de parâmetro e **não recebe valor nenhum do frontend**. Foi preciso
mudar a numeração dos placeholders, que antes vinha de `enumerate()` — uma coluna fixa no
meio da lista deslocaria todas as seguintes.

**`Coluna.visivel_se`** — nomeia a coluna booleana do mesmo catálogo que revela o campo. O
formulário o esconde enquanto ela estiver desmarcada, **tira o `required` junto** (um campo
escondido e obrigatório trava o envio sem dizer onde) e grava `null` ao desmarcar, que é o
que o CHECK de município exige.

Os dois estão descritos na §5.3 e apontados na §11.

#### Como se soube que não quebrou

A migration foi aplicada no banco de produção depois de `cargo test` verde, e conferida
contra o estado anterior: **128 processos, 13 postos, 112 municípios, 60 distritos e 26
infrações penais** atravessaram intactos, os 60 distritos com o município certo. Antes de
aplicar, um `pg_dump --data-only` das cinco tabelas afetadas.

Quatro asserções novas em `schema_integrity.sql` travam o que a migration passou a garantir:
distrito sem pai é recusado, município com pai é recusado, distrito com pai é aceito, e um
segundo dispositivo marcado como Estatuto é recusado. Mais um teste em
`legal_catalogs_repository.rs` prova que a `ReferenciaFixa` sai do atributo **na gravação e
na edição** — sem ele, uma edição que perdesse o dispositivo passaria calada.

---

### 8.8 O que NÃO está planejado, e por quê

Registrado para que ninguém gaste tempo redescobrindo que a decisão já foi tomada.

| Ideia | Por que não |
|---|---|
| Migrar os ids de `String` para `uuid::Uuid` e usar `sqlx::query!` | Ganha verificação em tempo de compilação; custa um refactor cruzado (structs de request, assinaturas de repositório, fixtures) e um tratamento novo para UUID malformado vindo da tela. O objetivo — "erro de SQL não chega em runtime" — **já está atendido** por `tests/sql_prepare.rs`, que alcança as 128 consultas contra as 9 que a macro alcançaria. Ver §8.3 |
| Gerar PDF no Rust | O relatório anual é página HTML + impressão do sistema. Nenhum crate de PDF entrou de propósito: o layout fica no frontend, onde é fácil ajustar. Ver §8.1 |
| Reimplementar os 9 comandos antigos de `/stats/procedimentos` | Traziam a sigla no SQL. Foram substituídos por painéis genéricos com filtro de ano + apuratórios. Ver §8.1 |
| Um campo de "situação" editável no processo | Decisão 25: a situação é derivada do fato registrado. Um estado marcado à mão é um estado que alguém esquece de atualizar |
| Importar os 107 mapas salvos e as 448 linhas de auditoria | Decisão 16 |
| Importar os catálogos órfãos `naturezas`, `tipos_processo` e `status_processo` | Decisão 24: seed de demonstração do app antigo, 0 referências em 8 anos |
| Tirar o dispositivo legal também das **infrações penais** | Ali é diferente do Estatuto (decisão 29): há **4 dispositivos distintos** entre as 26 infrações — Código Penal, CPM, CTB e LCP —, e a coluna é filtro de verdade em `evidence::search_infracoes_penais`. O que existe é uma capacidade morta: o comando aceita `dispositivo_legal_id` e a tela nunca o envia. Expor esse filtro é melhoria de tela, não remoção de campo |
| Devolver a ordenação hierárquica de militares | Decisão 27, tomada com a consequência à vista. Voltar atrás custa migration nova **e** redigitar os 13 valores, que a `0006` não guardou |

## 9. Pontos a reavaliar (registrados, não bloqueantes)

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

**Formato da matrícula.** `9 caracteres, prefixo 1000 ou 3000` ficou como validação de
domínio (`users/domain.rs`), não como CHECK, para não impedir a importação de registros
históricos. Se virar regra rígida, promover a CHECK.

**Anexos em `BYTEA`.** Limite de 100 MB na aplicação, trafegando em base64 pelo IPC
(~133 MB de string). Se o volume crescer, avaliar armazenamento em disco com o caminho no
banco.

**Mapa excluído continua alcançável por id.** `delete_saved_map` é exclusão lógica
(`ativo = false`) e `list_saved_maps` filtra `m.ativo`, mas `get_saved_map` não — então um
mapa "excluído" ainda volta se alguém pedir por id. Nenhuma tela chega lá: só se navega
para um mapa a partir da lista. A assimetria está travada por teste como está; decidir se
`get_saved_map` deve filtrar, ou se a leitura por id é deliberada (mapa é documento
emitido, e o princípio 6 diz que leitura de registro não filtra `ativo`).

**JSONB remanescente — os dois são justificados e travados por teste:**
`mapas_salvos.dados_mapa` (snapshot imutável de relatório já emitido) e
`auditoria.alteracoes` (diff heterogêneo e imutável). O teste `migrations.rs` **falha** se
aparecer um terceiro.

**`ASP OF PM` no círculo "Praças".** A 0003 o inseriu assim porque o dump só tem dois
círculos e um militar real usa esse posto. Aspirante a Oficial é praça especial; se a PMRO
classificar em círculo próprio, é uma linha a mudar.

---

## 10. Armadilhas conhecidas

Coisas que já custaram tempo e vão custar de novo se esquecidas.

| Armadilha | O que acontece | Como evitar |
|---|---|---|
| Argumento de comando em snake_case | O Tauri v2 espera **camelCase** nos argumentos do comando. Falha em runtime, sem erro de build | Use `call()` de `api.ts`; ele codifica a convenção. Dentro de `{ request: {...} }` os campos seguem snake_case |
| Constraint trigger `DEFERRABLE` | `max_envolvidos`/`max_ocupantes` estourados **só falham no `commit`** | Em teste, sempre dar `tx.commit()` e verificar o erro ali |
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
| `<a download>` para entregar arquivo | No WebView não define destino nem abre "salvar como", e muda por plataforma. Sobreviveu no download de anexo até a §8.6.6, porque nenhum teste chega lá e a tela não acusa | `dom.ts::baixarArquivoBase64` → `files_save_download`, que abre o diálogo nativo no Rust. Vale para **todo** arquivo, não só o CSV |
| **`docker compose down -v` com dado de produção dentro** | Apaga 8 anos de registro. A regra "editou migration, recria o banco" **acabou** | Migration incremental (`0006`…). Se realmente precisar recomeçar, o roteiro completo está na 8.5 |
| Comparar coluna anulável com `=` num `INSERT ... SELECT` | `pm_id = motorista_id` devolve **NULL**, não `false`, quando o motorista é nulo — e a coluna NOT NULL recusa a linha inteira. Custou uma transação da etapa 05 | `IS NOT DISTINCT FROM`, ou `COALESCE(..., false)` |
| Executar dump de `pg_dump` pelo protocolo do Postgres | `COPY ... FROM stdin`, `\restrict` e `\.` são sintaxe do **cliente psql**, não SQL: `sqlx::raw_sql` estoura com "syntax error at or near \" | Gerar a fixture com `--inserts` e filtrar as linhas `\restrict`/`\unrestrict` — é o que `gerar_legado_amostra.sh` faz |
| Supor que tirar a coluna do registro apaga o dado | Não apaga, e é o que torna seguro esconder o `codigo_extensao`: o `UPDATE` genérico monta o `SET` **só** com as colunas declaradas, então editar um apuratório pela tela não toca a extensão de carta precatória. O reverso também vale — uma coluna `NOT NULL` fora do registro faz o **INSERT** falhar, porque ninguém a preenche | Coluna obrigatória que não cabe na tela vira `ReferenciaFixa`, que o `save` resolve sozinho (§5.3) |
| CSP sem `ipc:` em `connect-src` | Não quebra uma tela: quebra os **75 comandos** de uma vez, porque é por aí que o IPC do Tauri v2 passa. E some no console como `Refused to connect` | `connect-src 'self' ipc: http://ipc.localhost`. Se o app abrir mudo logo na primeira tela, é isto |
| `style=""` no markup, com a CSP ligada | O atributo é recusado e o elemento aparece sem estilo, **sem erro de build**. Só a CSSOM (`elemento.style.width = …`) escapa da diretiva | Largura calculada vai num `data-*` e é aplicada em JS. `aplicarBarras()` faz isso, chamada de `shell()` |
| `csp` sem `devCsp` | Em desenvolvimento o Vite injeta o CSS por `<style>` e abre um WebSocket de HMR; a CSP de produção derruba os dois, e parece que o app quebrou | `devCsp` afrouxa só `style-src` e `connect-src`, e só em dev. Ver §8.6.2 |
| Meta-comando de psql em SQL que um teste executa | `\echo`, `\pset` e `\.` são sintaxe do **cliente**, não SQL: `sqlx` estoura com "syntax error at or near \". É por isso que `98_` é uma instrução só e `99_` não roda no `cargo test` | SQL que precisa rodar nos dois lugares não leva barra invertida |
| Supor que um conceito tem **uma** fonte no legado | O enquadramento tinha duas, que nunca se encontraram: `pm_envolvido_*` para procedimentos e o jsonb `transgressoes_ids` para PADS. A segunda tinha 73 vínculos e quase ficou de fora | Antes de dar um conceito por importado, contar **por espécie de apuratório**: um zero redondo numa espécie inteira é sinal de fonte paralela |
| Cruzar `jsonb_array_elements` com cast no `WHERE` | `(item->>'id')::int` estoura nos itens cujo `id` é UUID, mesmo com `WHERE tipo='rdpm'` ao lado: o Postgres não garante a ordem de avaliação | Separar em duas consultas, uma por tipo — foi o que a conferência precisou fazer |
| Carregar dump de `pg_dump` e continuar usando a conexão | Ele emite `SELECT pg_catalog.set_config('search_path', '', false)`, e daí em diante nem `public` é enxergado — o erro que aparece é "relation ... does not exist" | `SET search_path = public;` logo depois de carregar |

---

## 11. Onde olhar no código

| Quero entender… | Vá em |
|---|---|
| o schema e o porquê de cada decisão | `src-tauri/migrations/0001_schema.sql` (comentado por seção) |
| o que vem semeado e o que não vem | `src-tauri/migrations/0003_seed_catalogos_legais.sql` e `tests/migrations.rs` |
| quais catálogos existem e o que cada atributo faz | `src-tauri/src/legal_catalogs/domain.rs::CATALOGOS` |
| como o responsável do processo é resolvido sem nome de papel | `proceedings/repository.rs::JOIN_RESPONSAVEL` |
| as validações que dependem de configuração | `proceedings/repository.rs::validar_contra_configuracao` |
| por que apuratório não é um catálogo comum | `src-tauri/src/apuratorio_config/domain.rs` |
| o que o banco recusa | `src-tauri/tests/schema_integrity.sql` |
| como montar um cenário de teste com processo | `src-tauri/tests/util/fixtures.rs` |
| como chamar um comando como o frontend chama | `src-tauri/tests/commands_ipc.rs` |
| por que não usamos `sqlx::query!` | `src-tauri/tests/sql_prepare.rs` (cabeçalho) e `Cargo.toml` |
| a composição comum de processo, e por que a contagem não a usa | `src-tauri/migrations/0004_view_processos_detalhados.sql` e `proceedings/repository.rs::BASE_CONTAGEM` |
| o contrato de cada comando (Rust) | `src-tauri/src/*/domain.rs` |
| o contrato de cada comando (TypeScript) | `src/api.ts::Commands` — é o mapa completo dos 75 |
| como o escopo de um relatório é parametrizado | `maps_reports/repository.rs::FILTRO_ESCOPO` e `escopo()` |
| por que o mapa não filtra por instauração | `maps_reports/repository.rs::map_rows` (cabeçalho) |
| como um arquivo chega ao usuário | `src-tauri/src/files/commands.rs` (cabeçalho) |
| como uma tela é montada de metadados | `src/telas/catalogos.ts` |
| como os campos condicionais saem do dado | `src/telas/processo.ts` (cabeçalho do arquivo) |
| o roteiro da importação, etapa por etapa | seção **8.5** deste arquivo, e `src-tauri/importacao/` |
| como cada catálogo operacional foi derivado do dump | `src-tauri/importacao/01_catalogos.sql` (comentado atributo por atributo) |
| as duas fontes de enquadramento do legado, e por que 11 infrações estatutárias entram e 3 não | `src-tauri/importacao/08_enquadramentos_anexos.sql` (cabeçalho do bloco dos PADS) |
| o que o legado tinha e não foi importado, item por item | §**8.5**, quadro "O que NÃO entrou, e por quê" |
| como acrescentar um catálogo administrável | §**7.4** |
| como esconder da tela uma coluna obrigatória no banco | `legal_catalogs/domain.rs::referencia_fixa` e `repository.rs::expressao` |
| como um campo de catálogo aparece só quando outro está marcado | `legal_catalogs/domain.rs::referencia_condicional` e o `[data-visivel-se]` de `src/telas/catalogos.ts` |
| como fazer uma mudança de schema agora que há dado real | §**7.3** |
| o que falta fazer | §**7.5**, o roteiro de conferência de tela — e o quadro no topo deste arquivo |
| o que foi deliberadamente **não** planejado | §**8.8** |
| como o recorte de teste da importação é gerado | `src-tauri/tests/fixtures/gerar_legado_amostra.sh` |
| como "escrivão só em IPM" virou configuração, sem lista de siglas | `src-tauri/importacao/02_config_apuratorio.sql` |
| o que a importação garante, e como se conferiu | `src-tauri/importacao/99_conferencia.sql` e `src-tauri/tests/importacao.rs` |
| a conferência campo a campo dos 6 processos da amostra | `src-tauri/importacao/98_amostra_lado_a_lado.sql` (cabeçalho) e §**8.5** |
| por que a CSP é o que é, e o que ela recusaria | §**8.6.2**, e as quatro armadilhas de CSP na §10 |
| como um seletor de busca é montado nesta base | `src/telas/indicios.ts::pedirAnalogia` e o helper `buscar()` do mesmo arquivo |
| por que a prorrogação começa no dia do vencimento | `src-tauri/migrations/0005_prazo_intervalo_ocupacao.sql` |
| o diagnóstico do estado anterior | `ANALISE-MIGRACAO.md` |
