# ADM-P6 — guia de continuidade da migração

> Estado da remodelagem do banco, do backend e do frontend do **ADM-P6**
> (Seção de Justiça e Disciplina do 7º BPM), na migração Python/Eel → Rust/Tauri.
>
> Este arquivo é a fonte de verdade para retomar o trabalho, e é escrito para ser lido
> por quem chega sem contexto nenhum. O quadro abaixo diz o que fazer a seguir; a §8 diz
> o que já foi feito e por quê; a §7 diz como mexer sem quebrar nada.

> ## ▶ POR ONDE RETOMAR
>
> **Estado em 26/08/2026:** as seções 8.1 a **8.15** estão concluídas. Os **130 registros
> históricos/de teste da importação foram removidos com autorização** (§8.11) e, depois
> disso, a conferência manual criou **2 processos/procedimentos ativos de teste**. O banco
> conserva 235 militares, 7 usuários, 10 apuratórios, 11 unidades e todos os
> catálogos/configurações. A rede de proteção tem **126 testes**, os **80 comandos Tauri**
> estão no cliente tipado e as **9 migrations** estão aplicadas.
>
> **Não há implementação conhecida pendente.** Não refaça as §8.11 a §8.14: elas já estão
> no código e cobertas por teste. O próximo trabalho é **validar pela tela** os casos do
> quadro abaixo e continuar **`CONFERENCIA-DE-TELA.md`**. Se a tela divergir deste
> documento, trate como defeito novo e preserve as regras registradas nas decisões 34–38.
>
> **A última rodada (§8.15)** deu à cadeia de designações o que a §8.13 deu à de prazos —
> substituir, corrigir e desfazer de trás para frente, com o vínculo explícito no dado — e
> varreu **~87 mensagens públicas** do backend inteiro. Esta rodada **traz migration nova
> (`0008`)**, a primeira desde a 0007: `processo_designacoes.designacao_anterior_id`, com
> `UNIQUE`, `ON DELETE RESTRICT` e trigger de contiguidade.
>
> A migration foi aplicada **em banco vazio** (pelo `migrations.rs`, via sqlx) **e numa
> cópia do banco atualizado** — as duas conferidas. Como os 130 registros históricos já
> haviam sido removidos (§8.11), as 4 designações atuais são todas vigentes e não havia
> cadeia a retroalimentar: `fn_vincular_cadeias_existentes()` devolveu 0, que é o resultado
> certo. **Quem reimportar o legado precisa chamá-la de novo** — ela é idempotente e está
> lá para isso.
>
> ⚠ **Esta frase já esteve aqui antes e era falsa duas vezes.** Nas duas rodadas em que
> alguém sentou para conferir a tela, apareceu código quebrado que nenhum teste alcançava:
> os seletores de militar truncados em 200 (§8.9) e o formulário de carta precatória que
> não renderizava (§8.10). Ambos corrigidos. A lição é que **a conferência de tela é a
> tarefa que resta, e ela encontra coisa** — não é formalidade.
>
> ### Faça nesta ordem
>
> Os itens 1, 2, 3, 5 e 7 são de tela e **todos exigem o binário de produção** — o comando
> está no item 6, e vale rodá-lo primeiro. `tauri dev` não serve: ele usa a `devCsp`, que
> afrouxa exatamente a diretiva onde mora o risco (§7.5).
>
> | # | O que | Onde está descrito | Bloqueia? |
> |---|---|---|---|
> | 1 | **Retestar a mensagem ao alterar Recebimento depois de prorrogar.** O backend agora valida antes de qualquer escrita; deve aparecer a frase de domínio, nunca o fallback de banco | §8.11 e §8.13 | **Sim** para validar esta rodada |
> | 2 | **Editar a última prorrogação pela tela.** Testar uma data anterior e outra posterior à atual, ambas depois do prazo precedente; o motivo deve permanecer igual | §8.13 | **Sim** |
> | 3 | **Excluir prorrogações de trás para frente.** A anterior deve virar vigente; prazo inicial e prorrogação antiga não podem ser excluídos por chamada direta | §8.13 | **Sim** |
> | 4 | **Confirmar os 2 registros atuais e decidir se continuam como massa de teste.** Não os apague por suposição | quadro abaixo | **Sim** antes de carga real |
> | 5 | **Conferir as seis listagens padronizadas.** Dez por página, controle de página que alcança o fim, e o prazo vencido num bloco só | §8.14; `CONFERENCIA-DE-TELA.md`, seção **(g)** | **Sim** |
> | 5b | **Substituir, corrigir e desfazer uma designação pela tela.** Duas cadeias no mesmo processo (Encarregado e Escrivão) para ver que cada uma tem a sua "última"; e conferir que a função com histórico aparece **bloqueada no cadastro**. É a rodada mais recente e a que menos foi vista por olho humano | §**8.15** | **Sim** |
> | 6 | **Percorrer as telas com o binário de produção e o console aberto (F12).** `npm run tauri build -- --no-bundle`, depois `./src-tauri/target/release/adm-p6-tauri` | `CONFERENCIA-DE-TELA.md`; §7.5 | **Sim** antes do uso real |
> | 7 | **Criar uma carta precatória de ponta a ponta** | `CONFERENCIA-DE-TELA.md`, seção (e2); §8.10 | **Sim** |
> | 8 | Para repetir a conferência dos 6 processos históricos, **restaurar o backup em banco descartável** ou reimportar os dados | §8.5 e §7.6 | não |
> | 9 | **Remover o schema `legado`** somente depois da conferência histórica que ainda se desejar fazer | §8.5, passo 8 | não |
>
> Feitos os nove, **a migração está concluída** e o trabalho seguinte é manutenção normal:
> §7.3 para mudar schema, §7.4 para acrescentar catálogo, §7.9 para acrescentar listagem.
>
> ### O que fazer **antes** de qualquer um deles
>
> ```bash
> docker compose up -d                              # o banco, na porta 5438
> cd src-tauri && cargo fmt --check && cargo test   # 102 testes
> cd .. && npm run typecheck && npm run build
> ```
>
> Se algo aqui falhar, **pare**: o que estiver quebrado é anterior ao que você ia fazer. A
> §7 explica cada comando e o que ele protege.
>
> ### O estado do banco agora, para você reconhecer o que vê
>
> | | Total |
> |---|---:|
> | Processos/procedimentos | **2 ativos · 0 inativos** |
> | Envolvidos · prazos · designações | **3 · 2 · 2** |
> | Pessoas · andamentos · anexos | **2 · 0 · 0** |
> | Militares | **235** |
> | Usuários | **7** |
> | Apuratórios · unidades · tipos de documento | **10 · 11 · 3** |
> | Auditorias | **22** — 15 preservadas + 4 de processos + 3 de prazos |
>
> Essas contagens foram consultadas diretamente no PostgreSQL em 25/08/2026, somente com
> `SELECT`. Os 2 prazos atuais são os iniciais; não havia prorrogação persistida no instante
> da consulta, embora a auditoria registre as operações de teste feitas e depois desfeitas.
>
> ### Há backup, e ele foi testado
>
> `~/backups/adm-p6/adm_p6_db_<data>.dump` (`pg_dump --format=custom`, ~46 MB, o schema
> `legado` incluído). **Restaurado num banco descartável e conferido contra a origem** —
> as 8 contagens batem e o anexo de 20 MB casa no md5. O comando está na §7.6.
>
> Fora do git de propósito: tem dado pessoal de 235 militares, pela mesma razão que
> `adm-p6.sql` está no `.gitignore`.
>
> **Refaça o backup antes do passo 8.** Remover o `legado` é irreversível, e é o gabarito
> de tudo que a §8.5 conferiu.
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
>
> ⚠ **Aquele roteiro apaga o que foi digitado pelo app.** Hoje há 2 registros de teste;
> confirme a natureza deles antes de qualquer limpeza. Assim que a Seção lançar processo
> de verdade, recriar o banco deixa de ser opção e toda correção passa a ser incremental.

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
| Migrations | 7 (eram 32) |
| Tabelas · FKs · CHECKs · EXCLUDEs · triggers | 43 · 55 · 25 · 2 · 2 |
| Catálogos administráveis | 25 |
| Comandos Tauri | **78** (eram 146) |
| Backend Rust | 7.693 linhas (eram 9.194) |
| Testes de integração | **102** (eram 0) |
| Frontend | 9.316 linhas em 17 arquivos TS/CSS (era 1 arquivo de 2.124) |
| Comandos que o frontend invoca e não existem | **0** (eram 87) |
| Comandos registrados que nenhuma tela chama | 15 — capacidade sem entrada de UI, ver §9 |
| Chamadas fora do cliente tipado | **0** (eram 118) |
| Scripts de importação | 10 arquivos, 1.428 linhas de SQL |
| **Dados históricos conferidos** | 128 processos · 193 envolvidos · 123 enquadramentos — preservados no backup e reproduzíveis pela importação |
| No banco **agora** | **2 processos ativos · 3 envolvidos · 2 prazos iniciais · 235 militares** — massa criada após a limpeza autorizada (§8.11) |

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
| `0007_campos_por_apuratorio.sql` | 147 | os três atributos que decidem quais campos o formulário de processo mostra (`permite_julgamento`, `permite_punicao`, `permite_remessa_comissao`), e a separação do escrivão do IPM do escrivão do processo, que a importação havia fundido (decisões 31 e 32). |
| `0008_cadeia_de_substituicao.sql` | 158 | liga cada substituição à sua antecessora e protege a contiguidade da cadeia. |
| `0009_regras_operacionais_conclusao.sql` | 21 | configura quais relações apuratório × papel usam documento; desliga a citação para o Escrivão do IPM. |

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

### 5.5 Backend Rust — 11 módulos, 80 comandos

| Módulo | Papel |
|---|---|
| `auth` | login por conta, `pode_administrar` no lugar de `perfil == "admin"`, upgrade de hash SHA-256 legado |
| `users` | policial militar e conta **separados**, gravados por um formulário só, numa transação. Trava do último administrador. **Duas leituras sem `LIMIT`** (`list_ativos`, `list_encarregados`) alimentam os seletores: lista de opções não pagina (§8.9) |
| `legal_catalogs` | **7 comandos genéricos** sobre o registro `domain::CATALOGOS` (25 catálogos). Nome de tabela/coluna vem sempre do registro, nunca da requisição |
| `apuratorio_config` | 5 comandos que cadastram `apuratorio_documentos_iniciadores` e `apuratorio_papeis` — sem eles nenhum processo pode existir. `apuratorio_config_get` é também **a fonte dos atributos de comportamento** que o formulário de processo consulta, e não o registro de catálogos (§8.10) |
| `proceedings` | uma tabela só; `tipo_to_table()` eliminado. Validações leem atributos semânticos |
| `deadlines` | `ordem` (0 = inicial); prazo base vem da configuração; adicionar/editar recebe vencimento e deriva `dias`; somente a última prorrogação pode ser editada/excluída |
| `evidence` | 5 tabelas de enquadramento → 3; esfera penal escolhida no vínculo |
| `movements` | tabela relacional com **autor** e tipo do catálogo; `cancelado_em` no lugar de booleano |
| `audit` | `alteracoes JSONB` registra o *diff* das mudanças de configuração |
| `maps_reports` | escopos de relatório vêm por parâmetro (`apuratorio_ids`, `papel_ids`, ano), não por `IN ('IPM','SR','SV')` |
| `files` | **novo.** Um comando: abre o diálogo nativo de "salvar como" e grava. Existe porque `<a download>` não define destino no WebView, e porque a tela não precisa poder escrever em caminho arbitrário |
| `db` | conexão (`pool`) e **o recorte das listagens** (`paginacao::Recorte`). Não tem comando: é a peça que `users`, `proceedings`, `audit`, `deadlines` e `maps_reports` usam para paginar do mesmo jeito, com o mesmo padrão (10) e o mesmo teto (200) — antes cada um tinha o seu, e um deles não tinha nenhum (§8.14) |

**Segurança:** as 13 escritas que rodavam só com `require_session` agora exigem
`require_admin`. Há trava do último administrador, no backend e dentro da transação.

**Toda listagem de tela devolve o mesmo envelope** — `{ items, total, page, per_page }`.
`page` e `per_page` voltam porque o backend **corrige** o pedido (página mínima 1, tamanho
entre 1 e 200): sem receber de volta o que foi de fato servido, a tela desenharia o
controle de página com o que pediu. Quem pede 5.000 por página recebe 200, e o envelope
conta isso. Ver `db/paginacao.rs` — o cabeçalho dele explica o porquê.

⚠ **Lista de opções não entra nesse contrato e não pode entrar.** `users_list_ativos`,
`users_list_encarregados` e `legal_catalogs_list` devolvem tudo, sem `LIMIT`. Paginar uma
delas trunca um `<select>` em silêncio, que é o defeito da §8.9.

### 5.6 Frontend — migração fechada

```
src/
  api.ts            275   cliente tipado: mapa `Commands` com os 80 comandos
  types.ts          928   interfaces derivadas de src-tauri/src/*/domain.rs
  dom.ts            459   escape, tabela com metadados de coluna, paginação,
                          carga em lote para CSV/impressão, entrega de arquivo
  main.ts           398   shell, sessão, menu e roteamento — e nada mais
  styles.css       2601   a folha única; ver "Listagem de largura declarada"
  telas/
    processo.ts    1316   lista, formulário completo e detalhe — o maior do
                          frontend: os campos condicionais são oito blocos
                          dirigidos pela configuração; prazos ficam no detalhe
    catalogos.ts    509   os 25 catálogos, gerada de legal_catalogs_definitions
    usuarios.ts     487   lista paginada, formulário (militar + conta) e detalhe
    indicios.ts     467   enquadramento por envolvido, com o seletor de analogia
    mapas.ts        349   mapa do período e mapas salvos (paginados)
    apuratorio.ts   336   configuração de documentos iniciadores e papéis
    estatisticas.ts 316   /estatisticas/processos e /stats/procedimentos
    auditoria.ts    256   lista paginada com filtros e o diff de `alteracoes`
    prazos.ts       220   painel de prazos, dois blocos paginados em separado
    encarregados.ts 177   matriz militar × apuratório
    anual.ts        135   relatório anual, impresso pelo sistema
    dashboard.ts     87   painel de entrada
```

**`dom.ts` é o lugar onde o desenho de listagem mora.** Toda tela que mostra tabela passa
por ele, e é por isso que as seis listagens operacionais se parecem. O que ele oferece:

| | |
|---|---|
| `Coluna` | largura (%), alinhamento, truncamento e `nowrap` de cada coluna |
| `tabela(colunas, linhas, vazio, opcoes)` | aceita `string[]` (só rótulos, como antes) **ou** `Coluna[]`; com larguras, emite `<colgroup>` e liga `table-layout: fixed` |
| `aplicarLarguras()` | aplica as larguras pela CSSOM. **Chamada de `main.ts::shell()`**, para que nenhuma tela possa esquecer |
| `ITENS_POR_PAGINA` | 10, para todas. O backend usa o mesmo em `db::paginacao::PADRAO` |
| `paginacao(chave, …)` / `ligarPaginacao(chave, …)` | a `chave` permite dois paginadores independentes na mesma tela — é o que Prazos precisa |
| `paginaValida(pagina, porPagina, total)` | recua para a última página que ainda existe, depois de excluir ou filtrar |
| `carregarTudo(pagina)` | percorre um comando paginado em lotes de 200 até esgotar o filtro, com teto de `TETO_EXPORTACAO` (5.000) |
| `avisarSeCortado(cortado)` | anuncia o teto. **Nunca corte calado** — é o defeito que a §8.9 e a §8.14 corrigiram |
| `ligarExportacao(aoExportar, aoImprimir)` | com o 2º argumento, "Imprimir" carrega o conjunto completo, injeta o bloco, imprime e desfaz |

**A largura de coluna não pode ir em `style=""` — nem num `<col>`.** A CSP recusa o
atributo, o elemento fica sem largura e **não há erro de build nem mensagem que aponte a
tabela**: ela simplesmente volta a se dimensionar pelo conteúdo. Por isso a largura sai em
`data-largura` e é aplicada pela CSSOM por `aplicarLarguras()`.

**Não sobrou chamada não tipada.** `grep -rn "invoke" src/ --include=*.ts` só
acha `api.ts`. O `main.ts` caiu de 1.484 para 356 linhas: saíram o `call()`
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
   declarar `rename_all = "snake_case"` — e nenhum dos 78 declara.
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
nunca por sigla. **Todos os atributos vêm de `apuratorio_config_get`** — não do
registro de catálogos, pela razão da §8.10:

| Campo | Vem de |
|---|---|
| natureza do fato obrigatória | `apuratorios.exige_natureza_fato` |
| campo de condutor | `naturezas_fato.exige_condutor` |
| deprecante / unidade deprecada | `apuratorios.codigo_extensao` |
| data de julgamento | `apuratorios.permite_julgamento` |
| data de remessa à comissão | `apuratorios.permite_remessa_comissao` |
| penalidade e dias | `apuratorios.permite_punicao` **e** `tipos_solucao_decidida.permite_penalidade` **e** `tipos_penalidade.usa_quantidade_dias` |
| quais papéis designar | `apuratorio_papeis` |
| limite de envolvidos | `apuratorios.max_envolvidos` |

**Campo escondido preserva o que já foi gravado.** `FormData.get` não distingue
"apagado" de "não renderizado"; `textoSePresente` usa `dados.has()` para separar
os dois, e valor gravado fora da configuração continua à vista, com nota. Sem
isso, desligar um atributo apagaria fato registrado na primeira edição — o
princípio 5 diz o contrário.

**Como o formulário e a listagem se organizam** (§8.10.5): cada `<fieldset>` é
uma grade `auto-fit`, que dá 2–4 campos por linha no monitor e 1 na janela
estreita, sem media query; as coleções usam `auto-fill`, para que envolvidos com
número diferente de campos **alinhem** entre si. A listagem tem largura de coluna
em porcentagem, reticências com `title`, etiquetas de situação, cabeçalho fixo e
rolagem horizontal em vez de espremer. Tudo em classes: a CSP recusa `style=""`.

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

### 5.7 Rede de proteção — 126 testes

| Arquivo | O que cobre |
|---|---|
| testes unitários de `error.rs` | **3 testes** — mensagem pública legível sem vazar o detalhe técnico |
| `util/mod.rs` | cria banco descartável, aplica migrations, remove ao final mesmo com pânico |
| `util/fixtures.rs` | `mundo_configurado()`: monta a cadeia inteira até um apuratório configurado. **Base de todo teste que toque em processo** |
| `migrations.rs` | **4 testes** — o contrato de 32 colunas de `v_processos_detalhados`, e que a antiga `v_processos` não voltou; migrations aplicam do zero **e são idempotentes**; tabelas extintas não ressuscitam; nenhuma FK sem `ON DELETE`; JSONB só nas 2 colunas justificadas; **a fronteira do seed** (11 catálogos legais com contagem exata, 17 operacionais vazios, e nenhum papel de escrivão semeado pela `0007`); e os atributos de comportamento nascendo `NOT NULL DEFAULT false` |
| `schema_integrity.sql` + `.rs` | 42 asserções: estados impossíveis que o banco recusa + controles que ele deve aceitar |
| `auth_login.rs` | admin do seed autentica; busca case-insensitive; conta desativada não entra |
| `users_repository.rs` | **6 testes** — policial com e sem conta; normalização; retirar acesso desativa; listagem que pagina e busca; as duas listas de processos do militar; e a **lista de opções que não pagina**, montando 250 militares para passar do teto de 200 (§8.9) |
| `proceedings_repository.rs` | **32 testes** — criação completa, prazo inicial vindo da configuração, sincronização na edição, bloqueio após prorrogação, resultados e datas pós-cadastro preservados na edição geral, papel sem documento, conclusão bloqueando nova substituição, limites configuráveis, FK composta de papel, numeração parcial, filtros, anexos, ciclo de vida, dashboard, catálogo desativado — e a **cadeia de substituição**: duas cadeias com "últimas" independentes, correção sem lacuna, recusa da intermediária, remoção sucessiva reabrindo cada antecessora, as entradas inválidas, e o cadastro editando/removendo só o que não tem histórico |
| `apuratorio_config.rs` | **5 testes** — troca de padrão e de responsável sem violar os índices únicos parciais; desativação preserva processos existentes; o comando entrega os **atributos de comportamento** (`codigo_extensao` inclusive), que é o que teria pego a carta precatória morta da §8.10; e a citação de documento, que se configura por papel e **sobrevive** à gravação seguinte — o `ON CONFLICT` regrava a linha inteira |
| `deadlines_repository.rs` | **7 testes** — `dias_base`; prorrogação encostando no vencimento; conclusão bloqueando nova prorrogação; motivo obrigatório; edição/exclusão somente da última prorrogação; **os dois blocos do relatório sendo exclusivos** e batendo com o `dashboard`; e a paginação do relatório sobre 205 processos |
| `maps_reports_repository.rs` | **11 testes** — o mapa salvo como snapshot imutável; a regra do período do mapa; escopo vazio = todos; situação por apuratório; esfera penal escolhida no vínculo; catálogo desativado continua contando; matriz de designações por papel; sugerida × decidida; categorias de indício; e a **paginação dos mapas salvos**, em que o excluído sai da página *e* do total |
| `evidence_repository.rs` | **10 testes** — gravação substitui o enquadramento inteiro; esfera penal do vínculo; analogia do RDPM obrigatória; `indica_ausencia` lida do atributo, não do nome; lista de opções filtra `ativo` e leitura de registro não; painel na ordem dos envolvidos |
| `movements_repository.rs` | **10 testes** — o autor como FK; tipo opcional; ordem do mais recente; conclusão bloqueando novo andamento; edição preservando autoria/data; tipo histórico desativado; cancelamento datado, e o par (processo, andamento) obrigatório |
| `audit_repository.rs` | **8 testes** — o autor é uma conta, e a conta técnica não inventa militar; o diff de `alteracoes`; os três filtros; total do escopo na paginação; período nas estatísticas; e a **listagem principal paginando** sobre 205 registros, com o total acompanhando o filtro |
| `legal_catalogs_repository.rs` | **11 testes** — os catálogos do registro leem de verdade e toda referência aponta para catálogo existente; cada tipo de coluna é lido como declara; centralização vem dos metadados; item em uso desativa e não apaga; a busca recusa campo fora do registro; e a `ReferenciaFixa` sai do atributo, não da requisição — na gravação **e** na edição |
| `commands_ipc.rs` | **12 testes** — os comandos pelo IPC real, sobre o `MockRuntime`: guards, contratos, envelope `ApiResponse`, lista de opções, auditoria da edição de andamento, prorrogação, substituição, datas de encerramento e resultado do envolvido, e as listagens paginadas falando as duas convenções ao mesmo tempo (`perPage` camelCase no comando, `per_page` snake_case dentro do `filter`) |
| `sql_prepare.rs` | **2 testes** — todas as consultas literais são analisadas pelo PostgreSQL, extraídas do próprio código-fonte; e as dinâmicas precisam ter um teste que as execute, conferido nos dois sentidos |
| `importacao.rs` | **3 testes** — as oito etapas de `importacao/` rodam de verdade, na ordem, sobre um recorte do dump (`tests/fixtures/legado_amostra.sql`, 26 dos 128 processos, as 10 espécies). As contagens são comparadas com o próprio recorte, não com número mágico; o que fica fixado são as **decisões** — o colapso das trocas do mesmo dia, o motivo suprido, a solução replicada e o art. 29 que fica de fora. O terceiro roda o relatório de conferência da amostra e cobra **0 divergências** |

---

## 6. Nove bugs reais — sete que os testes pegaram, dois que só a tela pegou

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
   registro de administração**. A decisão 29 (§8.7) tirou `codigo_extensao` do registro,
   de propósito, para a pergunta sumir do cadastro do apuratório. Efeito colateral não
   previsto: a tela de processo lia do mesmo lugar, `codigo_extensao` passou a chegar
   `undefined`, e o bloco **nunca mais renderizou**.

   O backend continuou exigindo deprecante (`proceedings/repository.rs`), então a espécie
   ficou **impossível de cadastrar**: o formulário não oferecia os campos e o salvamento
   era recusado. A §8.7 argumentava que esconder a coluna era seguro "porque o `UPDATE`
   genérico só escreve o que está declarado" — verdade para a **escrita**; ninguém
   verificou a **leitura**.

   É exatamente o que o item (c) da §7.5 mandava conferir na tela — "criar um processo de
   carta precatória e confirmar que ainda exige deprecante" —, e que continua pendente.
   Vale como argumento para a conferência de tela: dois ciclos de teste automatizado não
   alcançaram isto.

   Corrigido pela separação que faltava: o **registro** governa o que o administrador
   edita, e `apuratorio_config_get` entrega o que o **formulário precisa saber**. São
   perguntas diferentes e não podiam depender da mesma lista.

---

## 7. Como rodar e verificar

```bash
cp .env.example .env                 # já aponta para o compose (porta 5438, adm_p6_db)
docker compose up -d

# Backend
cd src-tauri
cargo fmt --check
cargo test                           # 102 testes, bancos descartáveis
cargo run                            # aplica as migrations no startup e abre o app

# Frontend
cd ..
npm install
npm run typecheck                    # tsc --noEmit — é aqui que erro de comando aparece
npm run build                        # typecheck + vite build

# Binário de produção — é o único que exerce a CSP restritiva.
# `--no-bundle` compila o executável sem empacotar: necessário enquanto
# `bundle.icon` estiver vazio (§8.9, item 3).
npm run tauri build -- --no-bundle
./src-tauri/target/release/adm-p6-tauri
```

Login inicial: `admin@sistema.com` / `123456`.

> **`cargo run` e `npm run tauri dev` usam a `devCsp`**, que afrouxa `style-src` e libera o
> WebSocket do HMR. Servem para desenvolver; **não** servem para conferir a CSP. Para isso
> é o binário de produção acima.

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
migration nova** (`0008`…), e todas as migrations já aplicadas são imutáveis.

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

> **A lista para marcar está em `CONFERENCIA-DE-TELA.md`, na raiz.** É esta seção
> transformada em checklist, mais o que as §8.9, §8.10 e §8.14 acrescentaram. Use aquele
> arquivo para percorrer; este aqui explica o porquê de cada item.

> **Comece pela seção (g)**, das listagens padronizadas: é a rodada mais recente (§8.14),
> a que menos foi vista por olho humano, e a que mexeu em **todas** as telas de tabela.
> Duas coisas de lá só se confirmam olhando: se as **larguras de coluna** foram aplicadas
> (se `aplicarLarguras()` não rodar, a tabela volta a se dimensionar pelo conteúdo e nada
> acusa) e se um prazo vencido aparece **num bloco só** na tela de Prazos.

> ⚠ **Rode o binário de produção, não `tauri dev`.** A `csp` restritiva só vale no build;
> em desenvolvimento o Tauri usa a `devCsp`, que afrouxa `style-src` justamente onde mora o
> risco. `npm run tauri build -- --no-bundle` e depois
> `./src-tauri/target/release/adm-p6-tauri`. O `--no-bundle` é necessário enquanto
> `bundle.icon` estiver vazio (§8.9).

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
| O app abre e **nenhuma tela carrega dado** | `connect-src` sem `ipc: http://ipc.localhost` — é por aí que os 80 comandos passam |
| Uma tela abre **sem estilo** | `style-src`. Em produção o Vite emite `<link>`; em dev injeta `<style>`, e é por isso que existe `devCsp` |
| Uma tabela de contagem mostra uma terceira coluna vazia | Sobrou marcação da antiga barra percentual; cada painel deve ter somente rótulo e quantidade |

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

### 7.6 Backup — e por que gerar não basta

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

### 7.7 Como acrescentar um campo que só alguns apuratórios usam

É a operação que a §8.10 tornou rotina, e o caminho é sempre o mesmo — **nunca** um `if`
sobre a sigla.

1. **Migration nova** com a coluna do dado (se ainda não existir) e o **atributo booleano**
   que decide quem a usa, `NOT NULL DEFAULT false`. Ligue-o nas espécies certas por
   `UPDATE`, e comente que é carga única de valor administrável — senão o próximo leitor
   vai achar que é comportamento por nome (§8.10.1).
2. **`legal_catalogs/domain.rs::CATALOGOS`**, entrada `apuratorios`: uma linha
   `booleano("...", "Rótulo", "o que revela")`. A tela de catálogos passa a oferecê-lo
   sozinha (§7.4).
3. **`apuratorio_config/domain.rs::ApuratorioConfig`** e o `SELECT` de
   `repository.rs::get`: é por aqui que o formulário enxerga o atributo. **Não** deixe a
   tela lê-lo de `legal_catalogs_list` — foi o que matou a carta precatória (§8.10.2).
4. **`src/types.ts`**, o mesmo campo na interface.
5. **`src/telas/processo.ts`**: a condição de renderização, e — se o campo puder esconder
   dado já gravado — `textoSePresente` na coleta e a regra "aparece assim mesmo quando há
   valor" (§8.10.4).
6. **Teste** em `tests/apuratorio_config.rs`, no molde de
   `configuracao_entrega_os_atributos_de_comportamento`.

### 7.8 Como mexer numa migration de dado com segurança

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

# 3. Só então: cargo test verde, e o ciclo da §7.3 no banco real.
docker compose exec -T postgres psql -U adm_p6_user -d postgres \
  -c "DROP DATABASE adm_p6_ensaio;"
```

**Duas armadilhas que a `0007` teve de resolver, e que voltarão:**

| | |
|---|---|
| **A fronteira do seed** | Catálogo operacional tem de nascer **vazio** num banco novo, e `tests/migrations.rs` cobra. Migration que insere linha de catálogo precisa ser condicionada a haver o que corrigir (`DO $$ … IF … RETURN`), senão todo banco novo nasce com dado que ninguém pediu |
| **A ordem imposta pelas FKs** | Mexer em `processo_designacoes` exige que o par `(apuratorio_id, papel_id)` já exista em `apuratorio_papeis`. Cadastre o novo, **depois** migre as linhas, **depois** desative o antigo — nunca o contrário |

### 7.9 Como acrescentar uma listagem paginada

O padrão está fechado desde a §8.14. Siga-o e a tela nova sai parecida com as outras seis
sem que você precise decidir nada de estética.

**Primeiro, a pergunta que decide tudo:** isto é uma **listagem de tela** ou uma **lista de
opções**?

| | Listagem de tela | Lista de opções |
|---|---|---|
| O que é | uma tabela que o operador percorre | o que alimenta um `<select>` ou uma busca |
| Pagina? | **sim** | **nunca** |
| Exemplos | Processos, Usuários, Auditoria, Prazos, Mapas Salvos, Catálogos | `users_list_ativos`, `legal_catalogs_list` |

Paginar uma lista de opções trunca o `<select>` **em silêncio**. Foi assim que 35 militares
ficaram invisíveis por toda a migração (§8.9). Se for lista de opções, pare aqui: comando
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
  três testes de paginação da §8.14 inserem 205 para exercitar o teto de 200.

E um teste em `commands_ipc.rs` para o comando novo, que é onde a convenção camelCase ×
snake_case falha — e falha calada.

## 8. O caminho percorrido, e o que falta

As subseções estão na ordem em que foram executadas. **8.1 a 8.14 estão concluídas** e
ficam aqui porque registram *por que* cada coisa é como é — reabrir uma delas sem ler o
registro costuma refazer trabalho já feito. **8.8 é o que foi deliberadamente descartado.**

O que falta é **conferência de tela**: a amostra (fim da 8.5), a CSP (§7.5), os campos por
apuratório (§8.10), os últimos estados do CRUD de prazo (§8.13) e as listagens padronizadas
(§8.14). As rodadas 8.9 a 8.14 nasceram justamente de testes manuais e encontraram
comportamento que a cobertura anterior não alcançava — a §8.14 achou um prazo vencido
aparecendo em duas tabelas da mesma tela, com os cartões de contagem acima discordando das
duas. É o melhor argumento disponível para fazer a conferência antes de liberar o app.

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
| 8.9 | O que a conferência de tela achou de código | ✅ concluída |
| 8.10 | Campos por apuratório, e a reforma do formulário e da listagem | ✅ concluída |
| 8.11 | Mensagens amigáveis, datas opcionais e sincronização do prazo inicial | ✅ concluída |
| 8.12 | Prorrogação informada pela nova data de vencimento | ✅ concluída |
| 8.13 | Edição/exclusão da última prorrogação e validação antecipada do Recebimento | ✅ concluída |
| 8.14 | Padronização das listagens e paginação em dez itens | ✅ concluída |

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

**Estado atual:** todos os módulos de repositório têm integração sobre PostgreSQL
descartável; os totais por arquivo estão na §5.7. A cobertura de IPC continua
deliberadamente representativa, não exaustiva: 9 dos 80 comandos são chamados pelo nome e
JSON reais para travar guards, camelCase/snake_case, envelope, formato de resposta e o
fluxo transacional de prorrogação. Acrescentar comando de formato novo pede um caso aqui.

### 8.3 ~~`cargo sqlx prepare`~~ — **RESOLVIDO POR OUTRO CAMINHO**

O objetivo era "erro de SQL aparece no build, e não em runtime". O caminho previsto —
migrar as consultas estáticas para `sqlx::query!` — **não sobrevive ao código**: alcança
**9 das 132 consultas**.

O obstáculo não é o SQL dinâmico que este item antecipava. É o **tipo do parâmetro**: 83
das 92 consultas literais ligam um id com `$n::uuid`, e a macro então exige `uuid::Uuid`
onde a aplicação carrega `String`. Os ids chegam do frontend como texto JSON, atravessam os
structs de request e as assinaturas dos repositórios assim, e as fixtures os escrevem como
literal. Não há como contornar pelo SQL: `WHERE id::text = $1` perde o índice da chave
primária, e o sqlx não aceita anotação de tipo em parâmetro de entrada.

Sem macros, `cargo sqlx prepare` responde `no queries found` e cria um `.sqlx/` vazio — não
há o que versionar.

**O que foi feito no lugar**, em `tests/sql_prepare.rs`, alcançando as 132:

| | |
|---|---|
| As **92 literais** | são extraídas do próprio código-fonte e submetidas ao `PREPARE` do PostgreSQL. É a mesma análise que a macro faria — coluna, tabela, tipo de parâmetro — no `cargo test` em vez de no `cargo build`. Erro aponta arquivo, linha e a mensagem do banco |
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
# ── 1. Banco da aplicação, limpo, com as 7 migrations ────────────────────────
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
v2 passa: sem isso não é uma tela que quebra, são os 80 comandos de uma vez.

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
`src/telas/estatisticas.ts`. Era a única do sistema, e a CSP a recusaria. Depois de uma
correção intermediária pela CSSOM, as barras foram removidas por completo: os painéis
agora mostram somente rótulo e quantidade, centralizados como as demais tabelas.

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
| Migrar os ids de `String` para `uuid::Uuid` e usar `sqlx::query!` | Ganha verificação em tempo de compilação; custa um refactor cruzado (structs de request, assinaturas de repositório, fixtures) e um tratamento novo para UUID malformado vindo da tela. O objetivo — "erro de SQL não chega em runtime" — **já está atendido** por `tests/sql_prepare.rs`, que alcança as 132 consultas contra as 9 que a macro alcançaria. Ver §8.3 |
| Gerar PDF no Rust | O relatório anual é página HTML + impressão do sistema. Nenhum crate de PDF entrou de propósito: o layout fica no frontend, onde é fácil ajustar. Ver §8.1 |
| Reimplementar os 9 comandos antigos de `/stats/procedimentos` | Traziam a sigla no SQL. Foram substituídos por painéis genéricos com filtro de ano + apuratórios. Ver §8.1 |
| Um campo de "situação" editável no processo | Decisão 25: a situação é derivada do fato registrado. Um estado marcado à mão é um estado que alguém esquece de atualizar |
| Importar os 107 mapas salvos e as 448 linhas de auditoria | Decisão 16 |
| Importar os catálogos órfãos `naturezas`, `tipos_processo` e `status_processo` | Decisão 24: seed de demonstração do app antigo, 0 referências em 8 anos |
| Tirar o dispositivo legal também das **infrações penais** | Ali é diferente do Estatuto (decisão 29): há **4 dispositivos distintos** entre as 26 infrações — Código Penal, CPM, CTB e LCP —, e a coluna é filtro de verdade em `evidence::search_infracoes_penais`. O que existe é uma capacidade morta: o comando aceita `dispositivo_legal_id` e a tela nunca o envia. Expor esse filtro é melhoria de tela, não remoção de campo |
| Devolver a ordenação hierárquica de militares | Decisão 27, tomada com a consequência à vista. Voltar atrás custa migration nova **e** redigitar os 13 valores, que a `0006` não guardou |

### 8.9 ~~O que a conferência de tela achou de código~~ — **CONCLUÍDA**

O topo deste arquivo afirmava, antes desta rodada, que **não havia código pendente** — só
conferência humana. Não era verdade, e o que se achou é instrutivo: os defeitos que
sobraram eram todos do tipo que **nenhum teste alcança e nenhuma tela acusa**.

#### 1. Os seletores de militar, truncados em 200

O defeito mais grave, e o que mais tempo passou escondido. Está contado na §6, item 8, com
o porquê de a rede de proteção não ter pego. O resumo: `perPage: 500` a um comando que faz
`clamp(1, 200)`, e o clamp corta calado. 35 dos 235 militares não podiam ser lançados em
processo nenhum.

| O que mudou | Onde |
|---|---|
| `users_list_ativos` — militares ativos, **sem `LIMIT`**, para os seletores | `users/repository.rs::list_ativos`, `users/commands.rs`, registrado em `lib.rs` |
| Os dois seletores do formulário de processo passam a lê-lo | `src/telas/processo.ts::carregarCatalogos` |
| O filtro de autor da auditoria também | `src/telas/auditoria.ts` |
| Controle de página de verdade nas duas listagens | `dom.ts::paginacao`/`ligarPaginacao`, usados por `telas/usuarios.ts` e `telas/processo.ts` |
| O valor atual sobrevive quando falta na lista de opções | `src/telas/processo.ts::selectMilitares` |

**`users_list_encarregados` foi considerado e recusado para o seletor de designações**, e
o motivo importa: `is_encarregado` **não** gate quem pode ser designado, na prática. Dos
178 designados do banco real, **5 militares exerceram Encarregado sem a marca** e 2
exerceram Escrivão. Estreitar o seletor por essa flag apagaria 9 designações existentes ao
reeditar o processo — trocaria um defeito por outro pior. A flag continua servindo à lista
de encarregados, que é outra coisa.

#### 2. Os filtros de busca que a tela nunca enviava

Três parâmetros que o backend sempre aceitou e nenhuma tela mandava. Dois viraram select,
alimentados por catálogo (nenhum nome escrito no código):

| Comando | Parâmetro | O que foi feito |
|---|---|---|
| `evidence_search_infracoes_penais` | `dispositivo_legal_id` | **select "Dispositivo"** — há 4 distintos entre as 26 infrações, é filtro de verdade (§8.8 já endossava) |
| `evidence_search_transgressoes` | `natureza_id` | **select "Natureza"** na busca principal — antes só existia no overlay de analogia |
| `evidence_search_infracoes_estatuto` | `artigo` | **fica sem select, de propósito:** é texto livre, e a própria consulta já casa `termo` contra `artigo`. Um segundo campo de texto ao lado do primeiro só confundiria |

No caminho, o helper `buscar()` de `indicios.ts` ganhou o **carimbo de sequência** que o
seletor de analogia já tinha e as três buscas não: sem ele, a resposta atrasada de um termo
antigo sobrescreve a lista do atual.

#### 3. O build de produção, que nunca havia sido rodado

`npm run tauri build` **nunca tinha sido executado neste repositório** — não havia
`target/release/`. Como a `devCsp` afrouxa `style-src`, a CSP restritiva **jamais foi
exercida**, embora a §8.6.2 a descrevesse como ligada.

Roda, e o binário sai em 3m41s (24 MB). O caminho é `--no-bundle`, que compila o
executável sem passar pelo empacotamento — necessário porque `bundle.icon` é `[]` e
`targets` é `"all"`, o que faria o empacotamento falhar. Conferido que a CSP embutida no
binário é a restritiva, sem `'unsafe-inline'`.

> **Pendência registrada, fora do escopo desta rodada:** gerar instalador (deb/rpm/AppImage)
> exige o conjunto de ícones — hoje há um `icons/icon.png` só — e decidir como cada
> instalação alcança o PostgreSQL. Só faz sentido quando o app for para outra máquina.

#### 4. Um IPM de teste no banco de produção

Criado ao conferir as telas: `250d8ee1-c167-4604-8cdf-2bd5a62d8422`, IPM nº 1, instaurado
17/08/2026, com 1 envolvido, 1 prazo e 2 designações. Não existe no `legado` — é por isso
que as contagens dão 129/194/142 em vez de 128/193/141. **Sai antes do go-live**, e é o
passo 3 do quadro no topo.

#### O que ficou de fora, e por quê

**Os 15 comandos registrados que nenhuma tela chama** (`users_delete`, `proceedings_delete`,
`audit_by_record`, `evidence_remove_for_pm`, `proceedings_substitute_designation`…). Não é
código morto: é **capacidade sem entrada de UI**, e algumas são lacunas de verdade — não há
como desativar um militar pela tela, embora haja botão de reativar. Levantado e registrado
na §9; virar tela é decisão de produto, não conserto de defeito.

---

### 8.10 ~~Campos por apuratório, e a reforma do formulário e da listagem~~ — **CONCLUÍDA**

Pedido do responsável, depois de usar o cadastro: **o formulário mostrava os mesmos campos
para os dez apuratórios**. Data de julgamento num IPM, remessa à comissão numa sindicância,
penalidade onde nunca se pune. E as telas estavam mal organizadas.

Ao implementar, apareceu um defeito maior que o pedido — a carta precatória, abaixo.

#### 1. Os três atributos que decidem os campos

A regra existia no domínio e não no código. O dado do legado a confirma:

| Coluna | Onde está preenchida no legado |
|---|---|
| `data_julgamento` | CD (1), PAD (1), PADS (11) — **zero** em qualquer procedimento |
| `data_remessa_comissao` | **nenhum dos 128** |

Como sempre neste schema, quem decide não é a sigla (§3.2). A migration `0007` acrescentou
três booleanos em `apuratorios`, administráveis em *Catálogos → Apuratórios*:

| Atributo | Ligado em | O que revela |
|---|---|---|
| `permite_julgamento` | CD, CJ, PAD, PADE, PADS | a data de julgamento |
| `permite_punicao` | CD, CJ, PAD, PADE, PADS | penalidade e dias, **em cada envolvido** |
| `permite_remessa_comissao` | CD, PAD, CJ | a data de remessa à comissão |

> **`permite_punicao` não substitui `tipos_solucao_decidida.permite_penalidade`** — são
> dois gates em níveis diferentes e os dois valem. O apuratório diz se a **espécie** pune
> (um IPM não pune nunca); a solução decidida diz se **aquele desfecho** pune (um PADS pune
> quando a solução é "Punido", não quando é "Absolvido"). A punição continua sendo do
> envolvido, como a decisão 2 fixou.

**A carga inicial da `0007` é por sigla, e está comentada como deliberada.** Parece violar o
princípio 2, e não viola: o princípio veta o **código** perguntar "a sigla é IPM?" em tempo
de execução, porque o administrador pode renomear a linha. Aqui é carga **única** de um
valor que passa a morar no dado — mesmo molde de `prazo_base_dias` (decisão 23) e
`max_envolvidos` (decisão 13). Num banco novo `apuratorios` nasce vazio, o `UPDATE` alcança
0 linhas e vale o `DEFAULT false`.

#### 2. 🔴 O formulário de carta precatória estava morto

**O achado desta rodada, e o mais grave até aqui:** a espécie era **impossível de
cadastrar**, e nada acusava.

A tela decidia o bloco Deprecante/Unidade deprecada assim:

```ts
const ehCartaPrecatoria = apuratorio?.extra?.codigo_extensao === EXTENSAO_CARTA_PRECATORIA;
```

`extra` vinha de `legal_catalogs_list("apuratorios")`, e
`legal_catalogs/repository.rs::colunas_select` projeta **apenas `id`, as colunas declaradas
no registro de administração e `ativo`**. A decisão 29 (§8.7) tirou `codigo_extensao` do
registro — de propósito, para a pergunta sumir do cadastro do apuratório. Efeito colateral
não previsto: **a tela de processo lia do mesmo lugar**, `codigo_extensao` passou a chegar
`undefined`, e o bloco nunca mais renderizou. O backend continuou exigindo deprecante
(`proceedings/repository.rs::validar_contra_configuracao`), então o formulário não oferecia
os campos e o salvamento era recusado.

A §8.7 argumentava que esconder a coluna era seguro "porque o `UPDATE` genérico monta o
`SET` só com as colunas declaradas". **Verdade para a escrita; ninguém verificou a
leitura.**

**A correção é uma separação de responsabilidade, não um remendo:**

> O **registro de catálogos** governa o que o administrador **edita**.
> **`apuratorio_config_get`** entrega o que o formulário precisa **saber**.

`ApuratorioConfig` passou a trazer, ao lado de `documentos` e `papeis`:
`max_envolvidos`, `exige_natureza_fato`, os três atributos novos e **`codigo_extensao`**.
A tela lê tudo de lá. `codigo_extensao` continua fora do registro — a decisão 29 vale.

O formulário já chamava `apuratorio_config_get` a cada troca de apuratório, então não há
requisição nova.

#### 3. O escrivão do IPM e o escrivão do processo, outra vez separados

O legado guardava **dois** escrivães, em colunas distintas — `escrivao_id` e
`escrivao_processo_id` — e a importação mapeou as duas para o mesmo papel `'Escrivão'`
(`importacao/01_catalogos.sql`, `legado.map_papeis`). Foi simplificação de script, não
decisão de domínio.

O corte no dump é limpo, e é o que torna a separação segura:

| Coluna do legado | Onde aparece |
|---|---|
| `escrivao_id` | só IPM (23) |
| `escrivao_processo_id` | só CD (2), CJ (1), PAD (1) |

Nenhum processo usou as duas. Por isso dá para separar **pelo apuratório**, sem depender do
schema `legado`, que sai do banco quando a conferência fechar.

A `0007` faz, nesta ordem — que é imposta pela FK composta `(apuratorio_id, papel_id)`:

1. cria o papel **"Escrivão de Processo"**;
2. cadastra as associações novas em `apuratorio_papeis`, copiando `obrigatorio` e
   `max_ocupantes` da antiga;
3. migra as designações históricas (troca de papel, nunca exclusão);
4. **desativa** as associações antigas — não apaga (princípio 6). A FK segue satisfeita,
   porque chave estrangeira não olha `ativo`.

**Como o apuratório colegiado é identificado sem nomear sigla:** é o que prevê o escrivão
**e** um terceiro papel não responsável (o Interrogante). O IPM prevê só Encarregado, que é
o responsável, e o Escrivão — nunca um terceiro.

⚠ **O bloco inteiro é condicionado a haver o que separar** (`DO $$ … IF … RETURN`). É o que
preserva a fronteira do seed: `papeis_processo` é catálogo **operacional** e tem de nascer
**vazio** num banco novo, e há teste cobrando isso (`tests/migrations.rs`). Numa instalação
nova não existe 'Escrivão' nenhum, o bloco é pulado, e quem cadastra os papéis é o
administrador (§7.1). **Não remova a condição.**

#### 4. Campo escondido não pode apagar fato já registrado

O formulário monta a requisição a partir do DOM, e `FormData.get` devolve `null` para dois
casos diferentes: "o usuário apagou" e "o campo nem foi renderizado". Tratar os dois igual
zeraria a `data_julgamento` de um PADS na primeira edição depois de alguém desligar
`permite_julgamento` — exatamente o que o princípio 5 proíbe.

Duas defesas, ambas em `src/telas/processo.ts`:

| | |
|---|---|
| `textoSePresente(campo, atual)` | usa `dados.has(campo)` para separar ausente de vazio, e preserva o valor do rascunho quando o campo não foi renderizado. O mesmo vale para `penalidade_tipo_id` e `penalidade_dias` de cada envolvido |
| O campo **aparece assim mesmo** | se há valor gravado que a configuração não prevê mais, ele é renderizado com nota explicando. É a mesma escolha de `selectMilitares`, que preserva o militar fora da lista de opções em vez de perder o vínculo em silêncio |

#### 5. A reforma de tela

Conferida **renderizando o CSS num navegador**, não no olho: três iterações, e duas coisas
só apareceram ali.

**Formulário** — era uma coluna de 760px com ~20 campos empilhados:

- cada `<fieldset>` virou grade responsiva `repeat(auto-fit, minmax(230px, 1fr))`: 2–4
  campos por linha num monitor, 1 numa janela estreita, **sem media query**;
- `.campo--largo` para o que atravessa a linha (resumo, avisos, coleções);
- as coleções (envolvido, designação, pessoa) saíram do `flex-wrap`.

> **`auto-fill`, e não `auto-fit`, nas coleções.** `auto-fit` **colapsa** as trilhas vazias,
> então um envolvido com 4 campos ganhava uma grade diferente do que tem 6 e nada alinhava
> entre linhas. Com `auto-fill` as trilhas permanecem e "Situação" fica na mesma coluna em
> todos. Foi a primeira das duas coisas que só a renderização mostrou.

**Listagem** — já era `<table>`; o problema eram nove colunas sem largura declarada:

- largura em **porcentagem** nas colunas de texto. Sem ela, a primeira coluna sem restrição
  ficava com toda a sobra e as outras encolhiam até "7º Batalhã…" — a segunda coisa que só
  a renderização mostrou;
- texto longo com reticências e `title` com o conteúdo inteiro;
- situação e "vencido" viraram etiqueta (`.badge`), não texto solto;
- cabeçalho fixo ao rolar, zebra e realce de linha;
- `.tabela-dados--larga` dá `min-width` às listagens de muitas colunas, para
  `.table-wrap` **rolar** em vez de espremer. Só as largas levam o modificador: uma tabela
  de três colunas não deve exigir rolagem.

**Um defeito pré-existente no caminho:** abaixo de 860px, `.page-head` virava coluna com
`align-items: stretch` — e em coluna o eixo cruzado é o horizontal, então o botão "Novo"
atravessava a tela inteira. Passou a `flex-start`.

Tudo em classes: **a CSP recusa `style=""` interpolado** (§10), e a reforma não introduziu
nenhum.

#### 6. O que ficou de fora, e por quê

| Pedido | Decisão |
|---|---|
| **Listar todos os documentos iniciadores**, independentemente do apuratório | **Não** (decisão 33). A FK composta `(apuratorio_id, documento_iniciador_id)` exige o par cadastrado, e cada apuratório tem hoje um só habilitado — oferecer os três faria o salvamento falhar com erro de FK cru. Quem precisar habilita em *Catálogos → Configuração de apuratórios* |
| Usar `users_list_encarregados` no seletor de **designações** | **Não.** `is_encarregado` não gate quem pode ser designado na prática: **5 militares exerceram Encarregado sem a marca** e 2 exerceram Escrivão. Estreitar por ela apagaria 9 designações existentes ao reeditar o processo — trocaria um defeito por outro pior |
| Expor o filtro `artigo` das **infrações do Estatuto** | **Não.** É texto livre, e a própria consulta já casa `termo` contra `artigo`. Um segundo campo de texto ao lado do primeiro só confundiria. Os outros dois filtros (dispositivo legal e natureza) viraram select, alimentados por catálogo |

#### Como se soube que não quebrou

A `0007` foi **ensaiada numa cópia restaurada do backup de produção** antes de tocar no
banco real — é um passo que vale repetir em toda migration de dado:

```bash
docker compose exec -T postgres psql -U adm_p6_user -d postgres \
  -c "CREATE DATABASE adm_p6_ensaio;"
docker compose exec -T postgres pg_restore -U adm_p6_user -d adm_p6_ensaio \
  --no-owner --no-acl < ~/backups/adm-p6/adm_p6_db_<data>.dump
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_ensaio \
  -v ON_ERROR_STOP=1 < src-tauri/migrations/0007_campos_por_apuratorio.sql
```

Depois, aplicada em produção pelo ciclo da §7.3, com `cargo test` verde antes. Conferido:

- **129 processos, 180 designações, 194 envolvidos** atravessaram intactos;
- os escrivães ficaram **24 no IPM** e **4 em CD/CJ/PAD**, no papel novo;
- os três atributos ligados exatamente nas espécies previstas;
- `98_amostra_lado_a_lado.sql` segue em **377 comparações, 0 divergências**;
- `99_conferencia.sql` acusa **uma** linha, e é o IPM de teste (passo 4 do quadro do topo),
  não regressão.

**Testes novos (90 → 92):**

| Teste | O que trava |
|---|---|
| `configuracao_entrega_os_atributos_de_comportamento` | `apuratorio_config_get` devolve `codigo_extensao` e os três atributos. **É o teste que teria pego a carta precatória morta** |
| `atributos_de_comportamento_do_apuratorio_nascem_desligados` | os três são booleanos `NOT NULL DEFAULT false` — o comportamento vem do dado, e quem liga é o administrador |
| asserção nova em `migrations.rs` | nenhum papel `Escriv%` é semeado em banco novo — é o que impede alguém "melhorar" a `0007` tirando a condição do `DO $$` |

---

### 8.11 ~~Mensagens, seletor de datas e sincronização do prazo~~ — **CONCLUÍDA**

Rodada de manutenção feita depois dos primeiros testes manuais do CRUD:

- erros de banco não atravessam mais o IPC com SQL, texto do PostgreSQL ou constraint
  desconhecida. As duas unicidades de numeração têm mensagens próprias; os demais erros
  recebem texto seguro, e o detalhe técnico fica no terminal do backend;
- campos opcionais de data ganharam botão **Limpar**, e todo `input[type=date]` do
  formulário perde o foco após a escolha para fechar o calendário nativo do WebView;
- editar `data_recebimento` agora sincroniza o prazo inicial: cria quando a data passa a
  existir, move a ordem zero preservando os dias concedidos, e remove quando a data é
  limpa. A coluna gerada recalcula o vencimento;
- depois de existir prorrogação, alterar ou remover o recebimento é bloqueado com mensagem
  de domínio. A cadeia é histórico e não é deslocada pelo formulário do processo.

#### Como os erros chegam ao usuário

`AppError::Database` conserva o `sqlx::Error` completo somente no backend. `response.rs`
escreve esse detalhe no terminal e entrega pelo `ApiResponse` apenas `AppError::message()`.
O mapeamento público fica centralizado em `error.rs`:

| Caso | Mensagem pública |
|---|---|
| `uq_processo_numero_documento` | “Já existe um processo ou procedimento ativo com este número de documento para a mesma unidade, ano, apuratório e documento iniciador.” |
| `uq_processo_numero_controle` | “Já existe um processo ou procedimento ativo com este número de controle para a mesma unidade, ano e apuratório.” |
| constraint/erro SQL ainda não mapeado | “Não foi possível concluir a operação no banco de dados. Tente novamente e, se o problema persistir, procure o suporte.” |
| regra conhecida antes da escrita | texto específico de `AppError::Domain`, sem o prefixo técnico “Regra de negócio violada” |

Ao acrescentar uma unicidade nova, há duas escolhas deliberadas: validar no domínio quando
a regra depender do estado do fluxo, ou mapear o nome estável da constraint quando o banco
for a proteção correta contra concorrência. Nunca usar `error.to_string()` como texto de
tela.

#### Comportamento dos campos de data

`processo.ts::campoData` é o ponto comum das datas do formulário. Instauração continua
obrigatória; Recebimento, remessas, Julgamento e Conclusão podem ser limpos quando a regra
do apuratório permite o campo. O botão **Limpar** zera o `input`, dispara `input`/`change`
e fica desabilitado quando já não há valor. Todo seletor nativo perde o foco no `change`,
fechando o calendário no WebView sem exigir `Esc`. A mesma perda de foco é aplicada aos
seletores usados para incluir e editar prorrogação.

#### Uma fonte de verdade para Recebimento e prazo inicial

`deadlines::repository::sync_initial` mantém `data_recebimento` e a linha de prazo de
`ordem = 0` sincronizadas:

| Estado anterior → novo | Efeito |
|---|---|
| sem Recebimento → com data | calcula o prazo base pela configuração e cria a ordem 0 |
| data A → data B, sem prorrogação | preserva `dias`, move `data_inicio`; a coluna gerada move o vencimento |
| com data → vazio, sem prorrogação | remove a ordem 0 |
| qualquer mudança, com `ordem > 0` | recusa; a cadeia histórica permanece intacta |

O bloqueio depois de prorrogar é verificado duas vezes: no início de
`proceedings::repository::save`, antes de qualquer `UPDATE`, e novamente em `sync_initial`
como defesa interna. A primeira verificação é essencial para que outra constraint não
falhe antes e substitua a mensagem de domínio pelo fallback genérico.

Dois testes novos elevaram a suíte de 92 para **94** e cobrem a sincronização completa e o
bloqueio do histórico. O teste de numeração passou a exigir o texto público e a recusar
qualquer vazamento de `duplicate` ou `uq_processo_*`.

#### Limpeza autorizada do banco em 25/08/2026

O responsável confirmou que os registros eram de teste e que havia backup. Foram removidos
em uma transação: 130 processos/procedimentos, 196 envolvidos, 182 designações, 143 prazos,
64 andamentos, 107 pessoas, 2 anexos e as 12 auditorias processuais. As quatro tabelas de
enquadramento foram esvaziadas pelo `ON DELETE CASCADE`, e as 3 cartas precatórias pelo
`CASCADE` do processo.

Conferido depois do commit: todas as 13 contagens transacionais ficaram em zero, enquanto
235 militares, 7 usuários, 10 apuratórios, 11 unidades, 3 tipos de documento e 15
auditorias não processuais permaneceram exatamente como antes. Não houve migration nem
mudança de schema; para recuperar os fatos removidos, restaurar o backup ou repetir a
importação da §8.5.

---

### 8.12 ~~Prorrogação informada pelo novo vencimento~~ — **CONCLUÍDA**

O formulário deixou de pedir uma quantidade abstrata de dias e passou a pedir a **nova
data de vencimento**. O contrato `AddExtensionRequest` acompanha a intenção: recebe
`nova_data_vencimento`, não `dias`.

Contrato que atravessa o IPC (campos internos do request continuam em `snake_case`):

| Campo | Regra |
|---|---|
| `processo_id` | processo/procedimento que receberá a prorrogação |
| `nova_data_vencimento` | obrigatória, ISO `YYYY-MM-DD`, estritamente posterior ao vencimento vigente |
| `motivo` | obrigatório e não pode conter apenas espaços |
| `documento_autorizador_id`, `numero_documento`, `data_documento`, `autoridade_id` | metadados opcionais preservados pelo modelo, embora o formulário compacto atual envie só data e motivo |

O schema não mudou. O repositório lê o vencimento vigente — que continua sendo também o
início da nova prorrogação, pela decisão 17 — e deriva:

```text
dias = nova_data_vencimento - vencimento_atual
```

É esse número que entra em `processo_prazos.dias`; a coluna gerada
`data_vencimento = data_inicio + dias` precisa então reproduzir exatamente o dia escolhido.
A nova data deve ser estritamente posterior ao prazo vigente. Não precisa ser posterior a
hoje: lançamento histórico continua permitido, como já era quando a tela recebia dias.

A inclusão abre transação administrativa, bloqueia a linha vigente com `FOR UPDATE`, usa
`ordem_atual + 1`, grava `data_inicio = vencimento_atual` e registra auditoria `CREATE` em
`processo_prazos`. O bloqueio serializa duas tentativas concorrentes para que ambas não
calculem a mesma ordem. O `EXCLUDE` do schema continua sendo a proteção final contra
sobreposição.

Na tela, o campo nativo de data usa como mínimo visual o dia seguinte ao vencimento atual,
fecha depois da escolha e mostra a data vigente ao lado da regra. O motivo continua
obrigatório, e a tabela histórica continua exibindo os dias derivados.

Os testes dessa etapa em `deadlines_repository.rs` cobrem datas consecutivas, conversão exata
em 15 e 10 dias, lançamento histórico, data igual/anterior recusada com mensagem legível,
ausência de prazo inicial e motivo obrigatório.

---

### 8.13 ~~Edição e exclusão da última prorrogação~~ — **CONCLUÍDA**

A cadeia de prazos agora pode ser corrigida de trás para frente. Somente a prorrogação
vigente — a linha de maior `ordem`, nunca a inicial — pode ser editada ou excluída. Essa
mesma regra existe na tela e no repositório; portanto, uma chamada IPC direta também não
consegue reescrever o meio do histórico. Para alcançar uma prorrogação antiga é preciso
excluir antes todas as mais recentes.

Na edição, apenas o vencimento muda. `data_inicio`, motivo e documento autorizador são
preservados, e `dias` volta a ser derivado da diferença entre o novo vencimento e o prazo
anterior. A nova data pode antecipar ou postergar a que estava gravada, mas precisa ser
estritamente posterior a `data_inicio`. Na exclusão, a vigência volta automaticamente para
a maior ordem restante; não há coluna de estado nem renumeração a manter.

#### Invariantes da cadeia

| Operação | Permitido | Recusado |
|---|---|---|
| incluir | processo com prazo inicial; nova data depois do vencimento vigente | processo sem ordem 0, data igual/anterior, motivo vazio |
| editar | somente maior `ordem`, desde que seja `> 0`; data depois de seu `data_inicio` | prazo inicial, prorrogação antiga, data igual/anterior ao prazo precedente |
| excluir | somente maior `ordem`, desde que seja `> 0` | prazo inicial ou qualquer prorrogação com outra mais recente |

Não se faz *cascade update* das prorrogações seguintes. Essa alternativa foi descartada
porque mudaria silenciosamente a duração e o início de fatos históricos já concedidos. A
regra “somente a última” torna a correção reversível e previsível: desfaça de trás para
frente, corrija a linha alcançada e, se necessário, registre novamente as posteriores.

Editar não significa “prorrogar de novo”. Por isso a comparação é com `data_inicio` da
linha editada — o vencimento precedente —, não com o vencimento atualmente salvo. Isso
permite corrigir 20/09 para 18/09 ou 25/09, desde que o prazo anterior tenha vencido antes
da nova escolha.

Os comandos `deadlines_update_extension` e `deadlines_delete_extension` exigem
administrador, executam com bloqueio transacional da última linha e registram `UPDATE` e
`DELETE` em `auditoria`. A tela concentra as duas ações na linha vigente, usa o mesmo
seletor nativo de data e pede confirmação antes de excluir.

#### Contratos e fluxo implementados

| Camada | Inclusão | Edição | Exclusão |
|---|---|---|---|
| comando Tauri | `deadlines_add_extension` | `deadlines_update_extension` | `deadlines_delete_extension` |
| argumentos externos | `{ request }` | `{ request }` | `{ processoId, prazoId }` — camelCase por serem argumentos do comando |
| request interno | `AddExtensionRequest` | `UpdateExtensionRequest { processo_id, prazo_id, nova_data_vencimento }` | dois ids simples |
| retorno | id `String` criado | `true` | `true` |
| auditoria | `CREATE` | `UPDATE` | `DELETE` |

Os três comandos exigem administrador e executam regra + auditoria na mesma transação. O
repositório seleciona a maior ordem com `FOR UPDATE`; edição e exclusão comparam o `id`
solicitado com essa linha bloqueada antes de escrever. Os ids do processo e do prazo são
usados juntos no `UPDATE`/`DELETE`, impedindo operar uma linha que pertença a outro
processo.

No frontend, a tabela de prazos mostra a coluna **Ações** apenas para quem pode escrever.
Somente a linha vigente que também seja prorrogação recebe **Editar data** e **Excluir**;
as linhas antigas continuam visíveis, mas sem ação. **Editar data** esconde temporariamente
o formulário de nova prorrogação e abre um formulário contextual preenchido com a data
atual, `min = data_inicio + 1 dia`, ajuda textual e **Cancelar**. O motivo não aparece nesse
formulário porque não faz parte da correção decidida. **Excluir** confirma ordem, data e o
efeito de devolver a vigência ao prazo anterior. Depois do sucesso, o detalhe inteiro é
recarregado, inclusive tabela e vencimento vigente.

A validação que impede alterar `data_recebimento` depois da primeira prorrogação passou
para antes de qualquer escrita do processo. Assim, outra constraint não pode mascará-la
com o fallback genérico de banco; o usuário recebe diretamente: “A data de recebimento
não pode ser alterada porque este processo já possui prorrogação de prazo.”

Mensagens de domínio relevantes para chamadas fora da interface:

- “Somente a última prorrogação pode ser editada.”
- “Somente a última prorrogação pode ser excluída. Exclua primeiro as prorrogações mais
  recentes.”
- “O prazo inicial não pode ser editado/excluído como prorrogação.”
- “A nova data de vencimento deve ser posterior ao prazo anterior (DD/MM/AAAA).”

Essas mensagens são parte do comportamento público. Não trocar por erro genérico nem
confiar apenas no `min` do HTML: a interface orienta, mas o repositório decide.

Os testes cobrem antecipação/postergação, limite no prazo anterior, tentativa sobre linha
antiga ou inicial, exclusão regressiva, retorno da vigência, contrato IPC e as duas
operações de auditoria. Não houve mudança de schema nem migration.

#### Cobertura e estado de validação

- `deadlines_repository::somente_ultima_prorrogacao_pode_ser_editada_ou_excluida` cria duas
  prorrogações, recusa a antiga, antecipa e posterga a última, confere `dias` e motivo,
  recusa o limite e exclui de trás para frente até o prazo inicial.
- `commands_ipc::editar_e_excluir_prorrogacao_passam_pelo_ipc_e_auditoria` chama os nomes e
  formatos usados pelo frontend, confere o vencimento devolvido pela listagem e cobra as
  auditorias `UPDATE` e `DELETE`.
- `proceedings_repository::recebimento_nao_muda_depois_de_prorrogacao` provoca também uma
  colisão de numeração. A mensagem de Recebimento precisa vencer essa colisão, provando que
  a validação ocorre antes do `UPDATE` e não contém “banco de dados”.
- Rodada automática final: **96 testes Rust aprovados**, `cargo fmt --check`,
  `git diff --check` e `npm run build` aprovados. O único aviso é um `achar` não utilizado
  já existente em `tests/users_repository.rs`; não afeta execução.
- Inclusão pela nova data já foi confirmada manualmente pelo responsável. A edição,
  exclusão e a nova precedência da mensagem de Recebimento ainda devem ser repetidas pela
  tela conforme o quadro **POR ONDE RETOMAR**.

---

### 8.14 ~~Padronização das listagens e paginação em dez itens~~ — **CONCLUÍDA**

Pedido do responsável depois de percorrer as telas: **cada listagem havia sido migrada por
conta própria e nenhuma se parecia com a outra.** O commit `13dd217` fechou o desenho da
listagem de processos — `colgroup` percentual, `table-layout: fixed`, reticências com
`title`, etiquetas, cabeçalho fixo — e aquele desenho existia num arquivo só.

Junto vieram quatro defeitos que a padronização expôs. Três eram do tipo que a §8.9 já
havia catalogado: **corte silencioso**.

#### 1. Prazos mostrava o mesmo processo duas vezes

O mais grave, porque contradizia a própria tela. O bloco "vencendo em até X dias" filtrava
`prazo_vencimento <= CURRENT_DATE + X`, **sem piso**, então continha todo o vencido. O
`deadlines_dashboard` imediatamente acima sempre usou `>= CURRENT_DATE`:

| | vencidos | vencendo |
|---|---|---|
| `dashboard()` (os três cartões) | `< CURRENT_DATE` | `>= CURRENT_DATE AND <= +N` |
| `report()` (as duas tabelas) | `< CURRENT_DATE` | `<= +N` ← **sem piso** |

Os cartões e as tabelas da mesma tela discordavam, e um prazo vencido aparecia nas duas
listas. Corrigido com o piso, e travado por `blocos_de_prazo_sao_exclusivos`, que monta
prazo vencido ontem, vencendo hoje, dentro e fora da janela, e cobra interseção vazia **e**
as contagens batendo com `dashboard`. `report()` **não tinha teste nenhum** até esta rodada
— era a única consulta grande do módulo sem cobertura, e foi exatamente ali que o defeito
estava.

#### 2. A auditoria parava no 200º registro

`audit_list` recebia `limit`/`offset` **sem teto**, devolvia um `Vec` **sem total** e a
tela anunciava "Últimos 200 registros" porque era tudo que podia saber. Não havia como
descobrir que existia um 201º nem como alcançá-lo. Hoje devolve `AuditPageResult` completo,
com controle de página.

#### 3. O CSV exportava a página, não o filtro

Usuários exportava os itens carregados. Com 235 militares e página de 50, a planilha saía
com 21% do efetivo e não dizia. Agora CSV e impressão percorrem o filtro inteiro em lotes
de 200, com teto de 5.000 — e o teto **avisa** (`avisarSeCortado`), porque cortar calado é
o defeito que se está corrigindo, não a solução.

#### 4. Duas gerações de CSS de tabela, e quem vencia era a ordem do arquivo

`styles.css` tinha dois `.table-wrap`, dois `table {}`, dois `.paginacao` e dois
`.tabela-dados--larga` (940px e 1060px). Pior: `.tabela-dados thead th`, sobrevivente da
primeira geração, era **mais específica** que o `th` da segunda e mantinha o cabeçalho das
listagens branco enquanto o das fichas ficava cinza. A distinção é boa; acontecia por
acidente. Ficou escrita.

E uma regra genérica, `.table-wrap > table:not(...) { min-width: 680px }`, alcançava as
listagens novas e as fazia rolar na horizontal **já em 1600px** — o oposto do pretendido.

#### O que passou a existir

| | Onde |
|---|---|
| Metadados de coluna: largura, alinhamento, truncamento, `nowrap` | `dom.ts::Coluna`, consumido por `tabela()` |
| `ITENS_POR_PAGINA = 10`, um número para todas | `dom.ts`; o backend usa o mesmo em `db::paginacao::PADRAO` |
| Paginação **por chave**, para dois paginadores na mesma tela | `dom.ts::paginacao`/`ligarPaginacao`; Prazos tem "vencidos" e "proximos" |
| Recuo automático para a última página válida | `dom.ts::paginaValida`, chamado antes de desenhar |
| Carga completa em lotes para CSV e impressão | `dom.ts::carregarTudo` + `TETO_EXPORTACAO` + `avisarSeCortado` |
| Impressão do conjunto completo, não da página | `dom.ts::ligarExportacao`, 2º argumento |
| Recorte único do backend, com teto e padrão num lugar só | `src-tauri/src/db/paginacao.rs::Recorte` |
| Envelope `{items,total,page,per_page}` nos três comandos que faltavam | `audit_list`, `deadlines_report`, `reports_saved_maps` |

**`page` e `per_page` voltam no envelope**, e isso não é enfeite: o backend **corrige** o
pedido, e sem receber de volta o que foi servido a tela desenha um controle de página
mentiroso. Pedir 5.000 por página devolve 200, e agora o envelope conta.

**O `limit` solto de `deadlines_report` saiu.** Duas formas de recortar a mesma lista é
ambiguidade; o painel, que queria os 8 mais antigos, pede `page: 1, per_page: 8`.

#### O inventário, arquivo por arquivo

Para quem for mexer nisto depois, ou precisar entender um `git diff` sem contexto.

**Rust — 11 arquivos**

| Arquivo | O que mudou |
|---|---|
| `src/db/paginacao.rs` | **novo.** `Recorte::novo(page, per_page)`, `PADRAO = 10`, `TETO = 200`. O cabeçalho explica por que o teto é um só e por que `page`/`per_page` voltam no envelope |
| `src/db/mod.rs` | passa a expor `paginacao` |
| `src/audit/domain.rs` | `AuditPageResult` ganha `page` e `per_page` — era o único envelope do repositório que não os devolvia |
| `src/audit/repository.rs` | `list` devolve envelope e recebe `Recorte`; o `WHERE` dos três filtros virou `FILTRO_LISTA`, usado pela contagem **e** pela página; `list_by_user` idem; `ORDER BY … , a.id DESC` para desempatar |
| `src/audit/commands.rs` | `audit_list` troca `limit`/`offset` por `page`/`perPage`. **Antes não tinha teto nenhum** |
| `src/deadlines/domain.rs` | filtro perde `limit` e ganha `page`/`per_page`; novo `DeadlineReportResult` |
| `src/deadlines/repository.rs` | `FILTRO_REPORT` com **o piso `>= CURRENT_DATE`** — é a correção da exclusividade; `report` pagina e conta |
| `src/deadlines/commands.rs` | tipo de retorno do comando |
| `src/maps_reports/{domain,repository,commands}.rs` | `SavedMapListResult`; `list_saved_maps` recebe `Recorte`; contagem filtra `ativo` igual à página |
| `src/users/commands.rs` | padrão 50 → `PADRAO` |
| `src/proceedings/repository.rs` | padrão 25 → `PADRAO`, teto → `TETO` |

**TypeScript — 13 arquivos**

| Arquivo | O que mudou |
|---|---|
| `dom.ts` | `Coluna`, `tabela()` com `<colgroup>`, `aplicarLarguras`, `ITENS_POR_PAGINA`, paginação por chave, `paginaValida`, `carregarTudo`, `TETO_EXPORTACAO`, `avisarSeCortado`, `ligarExportacao` com impressão completa, e `Linha.id` (o `data-linha` do clique) |
| `main.ts` | chama `aplicarLarguras(document)` em `shell()` |
| `types.ts` · `api.ts` | os três envelopes e os três contratos |
| `telas/processo.ts` | **só** o tamanho de página, a chave `"processos"` e a classe `tabela-dados--fixa`. Aparência intacta |
| `telas/usuarios.ts` | `COLUNAS`/`COLUNAS_IMPRESSAO`/`COLUNAS_CSV`, dez por página, CSV e impressão sobre o filtro inteiro |
| `telas/auditoria.ts` | sai o `LIMITE = 200` e o texto "últimos 200"; entra paginação, clique por `data-linha` e exportação completa |
| `telas/prazos.ts` | dois paginadores independentes, filtros nomeados (`FILTRO_VENCIDOS`, `filtroProximos()`), exportação dos dois blocos inteiros |
| `telas/mapas.ts` | Mapas Salvos pagina e casa o clique por id; as tabelas de mapa declaram `larga: true` |
| `telas/catalogos.ts` | recorte no cliente depois da busca e do filtro; `filtrar()` volta à página 1, `recarregar()` mantém |
| `telas/dashboard.ts` | `limit: 8` → `page: 1, per_page: 8` |
| `telas/estatisticas.ts` | some o corte manual de 90 caracteres da descrição legal — agora trunca por CSS, com o texto inteiro no `title` |
| `telas/{anual,encarregados}.ts` | metadados de coluna; a matriz declara `larga: true` |
| `styles.css` | consolidação (adiante) |

**CSS — o que foi removido e o que nasceu**

| | |
|---|---|
| **Removido** | o bloco "Listagem densa" inteiro (segunda geração das mesmas regras) e as classes `.col-curta`, `.col-numero`, `.col-texto`, `.col-principal`, que **nenhuma tela usava** |
| **Fundido** | os dois `.paginacao` num só (`justify-content` era declarado duas vezes, com valores diferentes) |
| **Escrito de propósito** | `.tabela-dados thead th` branco — a distinção listagem × ficha existia por acidente de especificidade |
| **Generalizado** | `.tabela-dados--fixa` e os modificadores `.col--centro`, `.col--direita`, `.col--nowrap`, `.col--trunc`, tirados de `.tabela-processos` |
| **Corrigido** | `.table-wrap > table:not(…)` passou a excluir `.tabela-dados--fixa`: o `min-width: 680px` genérico alcançava as listagens novas e as fazia rolar já em 1600px |
| **Novo** | `.bloco-impressao` e `.ocultar-na-impressao`, para o papel levar o conjunto completo |

#### Onde a paginação **não** entrou, e por quê

`legal_catalogs_list` continua trazendo o catálogo inteiro: a mesma resposta alimenta os
selects de referência de outras telas, e paginar ali truncaria **lista de opções** — o
defeito da §8.9. Catálogos recorta **no cliente**, depois da busca e do filtro de inativos.
Relatórios, painéis, matrizes e tabelas de detalhe receberam o desenho e seguem mostrando
o conjunto inteiro. Designações por Militar e Mapa do Período mantêm rolagem horizontal:
quantas colunas existem depende do dado, então largura percentual não se aplica.

#### Como se soube que a listagem de processos não mudou

Ela é a referência aprovada, e a decisão foi **não tocar na aparência dela** — mas as
regras dela subiram para `.tabela-dados--fixa`, o que é mexer. A conferência foi feita
medindo, não olhando: **17 elementos** da tabela (cabeçalhos, cada tipo de célula, badge,
botão, invólucro, paginação) tiveram **34 propriedades computadas mais o retângulo**
comparados antes e depois, num navegador, sobre o CSS já compilado.

Resultado: **15 idênticos**, e os 2 `<th>` diferindo em uma única propriedade —
`z-index: 1 → 2`, que não é visível: nada dentro da tabela disputa empilhamento com o
cabeçalho. Larguras, alturas, cores, bordas, fontes e retângulos, **iguais ao pixel**.

A mesma medição provou o caminho novo: as oito colunas de Usuários chegam a
**8/10/30/9/20/11/8/4% exatos**, o nome longo trunca de fato (o `scrollWidth` passa do
`clientWidth`) com o inteiro no `title`, o HTML que `tabela()` devolve **não contém
`style=`** — só `data-largura` —, e o `min-width` computado é `0` em viewport de 1600px e
`900px` em 899px, que é a regra pedida.

**Testes novos (96 → 102):**

| Teste | O que trava |
|---|---|
| `deadlines::blocos_de_prazo_sao_exclusivos` | nenhum prazo nos dois blocos, e os cartões batendo com as tabelas |
| `deadlines::report_pagina_e_ordena` | 205 processos: o teto corta, `per_page` conta que cortou, páginas disjuntas, ordem estável |
| `audit::lista_pagina_preservando_filtros` | 205 registros: total acompanha o filtro, páginas disjuntas, página além do fim vazia |
| `maps_reports::mapas_salvos_paginam_do_mais_recente` | o mapa excluído sai da página **e** do total |
| `commands_ipc::listagens_paginadas_falam_a_mesma_lingua_pelo_ipc` | `perPage` camelCase no comando, `per_page` snake_case dentro do `filter`, padrão 10 e o teto contado |

Os três testes de paginação montam **mais linhas que o teto que exercitam** (205 contra
200). Com a fixture crua o clamp nunca seria alcançado e o teste passaria sem provar nada
— é a armadilha registrada na §10, e `lista_de_opcoes_de_militar_nao_pagina` já existia
por causa dela.

#### Como repetir a medição de CSS

Vale para **qualquer** mexida futura em regra de tabela, e é a única forma honesta de
afirmar "não mudou nada" num arquivo com regras sobrepostas. O roteiro, em cinco passos:

1. `npm run build` e guarde o `dist/assets/index-*.css` gerado como *antes*.
2. Monte uma página estática que carregue esse CSS e reproduza o markup da tela — o
   `<colgroup>`, as classes das células, uma linha com texto longo e outra curta.
3. Num navegador, para cada elemento que importa, leia `getComputedStyle` das propriedades
   relevantes **mais** o `getBoundingClientRect`, e reduza tudo a um *hash* por elemento.
   O hash é o que evita despejar centenas de linhas de estilo para comparar a olho.
4. Faça a mudança, rebuild, e recarregue com o CSS novo comparando contra os hashes.
   Só o elemento que mudou aparece, e aí sim com o detalhe todo.
5. Para a rolagem, redimensione a **viewport** (a media query é da viewport, não do
   contêiner) e leia `min-width` computado em 900px e 899px.

Foi o passo 4 que pegou o `min-width: 680px` genérico alcançando as listagens novas — um
defeito que passaria despercebido, porque a tela continuava *funcionando*, só rolando à toa.

#### O que ficou de fora desta rodada, e por quê

| Pedido possível | Decisão |
|---|---|
| Migrar `telas/processo.ts` para o `tabela()` centralizado | **Não**, por decisão do responsável. Ela tem uma célula que nenhuma outra tela tem — o resumo de envolvidos com tooltip posicionado — e é a referência visual aprovada. Ficou com markup próprio, consumindo as mesmas classes. Se um dia for migrada, o `tabela()` precisará de um tipo de célula "conteúdo já montado", e a medição do CSS acima é obrigatória |
| Tamanho de página escolhido pelo usuário | **Não.** Dez é o número que o responsável pediu, e um seletor de tamanho é estado a mais para guardar, por tela, sem pedido real |
| Ordenação por clique no cabeçalho | **Não.** Cada listagem tem hoje uma ordem que é regra de negócio (prazo por vencimento, auditoria por data, mapas do mais recente). Ordenação escolhida na tela precisa entrar no `ORDER BY` do backend junto com o desempate, e vira contrato novo em cinco comandos |
| Paginar `legal_catalogs_list` no backend | **Não, e não deve.** A mesma resposta alimenta os selects de referência de outras telas — ver a §8.9 |
| Teto de exportação configurável | **Não.** 5.000 é constante em `dom.ts::TETO_EXPORTACAO`. Se a Seção reclamar do corte, o número muda ali; virar configuração exigiria catálogo e tela para uma decisão que ninguém tomou ainda |

#### O que vigiar quando a Seção começar a usar

Nada disto é pendência — é o que se deve observar com dado real, porque o banco de hoje tem
2 processos e nenhuma dessas situações aparece:

- **A auditoria cresce sem teto.** Hoje tem 22 linhas. Com uso real, o CSV e a impressão
  vão bater nos 5.000 e o aviso vai aparecer. Se acontecer com frequência, o caminho é dar
  **filtro de período** à tela de auditoria (o backend já aceita em `audit_statistics`,
  mas a listagem não), e não aumentar o teto.
- **Dez itens em Catálogos pode incomodar** em Municípios, que tem ~60 distritos. O recorte
  é no cliente e a busca já filtra antes; se incomodar, é uma constante por catálogo, não
  uma reforma.
- **`count(*)` a cada página.** Toda listagem faz duas consultas. Nas tabelas base isso é
  barato; se algum dia uma contagem sair de `v_processos_detalhados`, lembre da §10: ali
  é **7× mais lento**, e a agregação tem de partir das tabelas base.

### 8.15 ~~Substituição de designações e mensagens amigáveis~~ — **CONCLUÍDA**

Duas frentes numa rodada. A primeira dá à cadeia de designações o mesmo tratamento que a
§8.13 deu à cadeia de prazos: **corrigir e desfazer, de trás para frente, sem reescrever o
meio do histórico.** A segunda varre as mensagens públicas do backend inteiro.

**Migration 0008 — a cadeia deixa de ser inferida.** `processo_designacoes` ganha
`designacao_anterior_id`, autorreferência com `UNIQUE`, `ON DELETE RESTRICT` e um
`CHECK` contra apontar para si. Antes, saber que a designação de PM DOIS sucedeu a de PM
UM exigia adivinhar pelo par `data_fim = data_inicio` dentro do mesmo `(processo, papel)`.
Isso basta para *ler* o histórico e **não basta para desfazê-lo**: com `max_ocupantes = 2`
o par é ambíguo, e "a última substituição" não tem alvo definido.

O trigger `tg_cadeia_designacao` (DEFERRABLE, como os outros dois) cobra a contiguidade:
mesma função, mesmo processo, ocupante diferente, e a sucessora começando no dia em que a
antecessora termina. **É a contiguidade que fecha o buraco dos ciclos** — como
`ck_designacao_periodo` já exige `data_fim > data_inicio`, a data cresce a cada elo, e uma
cadeia que voltasse a si mesma precisaria de um elo com início menor. Nem o ciclo de dois
elos, que o `CHECK` sozinho deixaria passar, é possível.

A retroalimentação vive em `fn_vincular_cadeias_existentes()`, chamada pela migration e
disponível para quem reimportar o legado. Ela **se recusa a chutar**: o par precisa ser
único nos dois sentidos, e onde houver ambiguidade o vínculo fica `NULL` — a designação
segue legível como histórico, apenas sem oferecer "desfazer". Ligar a sucessora de uma
cadeia à antecessora da outra seria pior do que não ligar nada.

**Três comandos, e o alvo deixou de ser o papel.** `SubstituirDesignacaoRequest` passou a
identificar a **designação vigente exata**, não a função. A versão anterior encerrava com
`UPDATE ... WHERE papel_id = $2 AND data_fim IS NULL` e teria derrubado os dois escrivães
de uma vez. Somaram-se `proceedings_update_substitution` e
`proceedings_delete_substitution`; os três travam as linhas com `FOR UPDATE`, revalidam
tudo no banco e auditam **as duas** designações que cada operação mexe — a antecessora
muda de estado tanto quanto a sucessora.

**O cadastro passou a editar, e não só acrescentar.** `DesignacaoRequest` ganhou `id`.
Sem ele, corrigir um encarregado lançado errado criava uma *segunda* designação vigente em
vez de arrumar a primeira. Em compensação o request **perdeu** `data_inicio`, `documento`,
`numero` e `motivo`: são derivados do cabeçalho (decisão 42), e mandá-los como `null` a
cada edição apagaria a portaria já registrada — a mesma armadilha que `textoSePresente` já
tratava no cabeçalho.

**As mensagens.** Foram revisados ~87 textos públicos: 54 `AppError::Domain`, 13 montados
com `format!` e 20 validações, a maioria sem acentuação (`"data de instauracao nao pode
ser futura"`). `AppError` ganhou `Arquivo` e `Interno`, que existem para **separar o que o
usuário lê do que o console registra** — caminho local, erro de bcrypt e base64 quebrado
saíam pela mensagem de domínio. O `error.rs` passou a mapear constraint conhecida em duas
camadas: a frase específica por regra de negócio, e a **categoria pelo SQLSTATE** para o
resto (duplicidade, vínculo, período, campo obrigatório, registro desatualizado, banco
indisponível). Dois testes unitários recusam termo técnico em qualquer mensagem pública e
exigem que ela comece com maiúscula e termine em ponto.

No frontend, o `catch` do `call()` deixou de devolver `String(error)` — o texto cru do
Tauri — e passou a orientar a reiniciar o programa, com o detalhe no console.

> **A camada certa é a validação de domínio, não o mapa de constraints.** O mapa fala
> depois do PostgreSQL e sem saber qual linha o usuário errou. Onde a aplicação sabe, quem
> responde é ela: papel não previsto, teto de ocupantes, militar desativado e designação
> repetida agora têm frase própria e nem chegam ao banco. O `banco_recusa_papel_nao_previsto`
> era um teste que **esperava o fallback genérico** — hoje espera a frase de domínio, e a
> FK composta continua no lugar, como rede.

#### O que a tela ganhou

A tabela de Designações tem **Documento** e **Ações**, e o militar aparece com a
qualificação completa (posto, matrícula, nome). Designação vigente oferece *Substituir*; a
**última de cada cadeia** oferece também *Editar* e *Remover*; o histórico encerrado é só
leitura. O formulário é inline, abaixo da tabela, no padrão dos Prazos — e é **um só, em
dois modos**, porque substituir e corrigir pedem exatamente os mesmos cinco campos.
Validação junto do campo, foco no primeiro inválido, e confirmação nominal antes de
desfazer, dizendo quem sai e quem volta.

No cadastro, a linha de designação perdeu o campo *Início* (é derivado) e ganhou dois
estados: **livre**, com as funções já preenchidas nas outras linhas desabilitadas até
`max_ocupantes`; e **travada**, quando a função já tem substituição — vira texto, com a
orientação de onde a troca acontece.

**O piso da tabela subiu de 760px para 1080px**: eram cinco colunas, agora são sete. Medido
no navegador, com a folga indo para Documento e Motivo — as duas de texto livre — para que
as de data não quebrem em duas linhas. A adaptação em janela estreita continua sendo o
scroll do `.table-wrap`, e o `<body>` não rola na horizontal em 720px nem em 1440px.

> **A medição pegou um conflito real**, do tipo que a §10 avisa. O parágrafo de resumo do
> formulário usa `.secao-ajuda`, que limita a `70ch` — certo para texto corrido, errado
> para uma faixa que precisa da linha inteira. Com `flex-basis: 100%` ele ainda ficava em
> **574px**, e os campos subiam para o lado dele. Só o computado no navegador mostrava
> isso; o CSS lido parecia correto.

#### Invariantes da cadeia de designações

| Operação | Permitido | Recusado |
|---|---|---|
| substituir | designação **vigente**; data depois do início dela e não futura; sucessor ativo e diferente | designação encerrada, data igual/anterior/futura, sucessor igual, motivo vazio, documento sem número (ou o contrário) |
| corrigir | somente a **ponta da cadeia** (vigente com antecessora); move as duas datas juntas | designação inicial, substituição já sucedida, e qualquer troca de função |
| desfazer | somente a ponta; exclui a sucessora e reabre a antecessora | substituição intermediária — desfaça antes as mais recentes |
| cadastro | designação **sem histórico**: editar, acrescentar, remover | alterar, remover ou duplicar quem tem `data_fim` ou antecessora |

---

### 8.16 ~~Datas de comissão e julgamento depois do cadastro~~ — **CONCLUÍDA**

Remessa à comissão e Julgamento saíram do cadastro geral pelo mesmo motivo que já havia
tirado Remessa do encarregado e Conclusão: são fatos posteriores à instauração. Agora o
formulário de processo cuida apenas de Instauração e Recebimento; as quatro datas do fluxo
ficam juntas na página de detalhes.

O contrato também separa as responsabilidades. `SaveProceedingRequest` não carrega mais
`data_remessa_comissao` nem `data_julgamento`, portanto editar número, local, envolvidos ou
designações não consegue regravar essas datas. `UpdateProceedingDatesRequest`, chamado por
`proceedings_update_dates`, recebe as quatro datas pós-cadastro numa operação auditada.

| Campo no detalhe | Quando aparece |
|---|---|
| Remessa do encarregado | apuratórios sem comissão |
| Remessa à comissão | `permite_remessa_comissao` — hoje CD, CJ e PAD; substitui a remessa do encarregado |
| Julgamento | `permite_julgamento` — hoje CD, CJ, PAD, PADS e PADE |
| Conclusão | todos os apuratórios, como antes |

Os dois campos condicionais continuam dirigidos pelos atributos do apuratório, nunca por
sigla no código. Se a configuração for desligada depois de existir uma data, o campo
permanece visível e corrigível: configuração futura não reescreve fato passado. Remessas e
julgamento podem ser limpos; conclusão só sai pela ação explícita **Reabrir**. Todas as
datas recusam futuro e valor anterior à instauração tanto na tela quanto no backend.

**A unificação das duas remessas.** Em CD, CJ e PAD, “Remessa do encarregado” e
“Remessa à comissão” são o mesmo fato. O legado só possuía a primeira coluna, então a
importação original deixou a coluna específica vazia. A `0010` transfere o valor para
`data_remessa_comissao` e limpa `data_remessa_encarregado` nos apuratórios cujo atributo
`permite_remessa_comissao` está ligado. A etapa 04 da importação faz a mesma escolha para
restaurações futuras. Tela e backend recusam manter as duas fontes nesses ritos.

---

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

**Quinze comandos registrados que nenhuma tela chama.** Levantados na §8.9. Não são código
morto — são capacidade sem entrada de UI —, mas alguns são lacuna de verdade: `users_delete`
(não há como **desativar** um militar pela tela, embora `users_reactivate` tenha botão —
assimetria visível), `proceedings_delete`, `evidence_remove_for_pm`, `audit_by_record` e
`audit_by_user` (não há trilha de auditoria por registro nem por usuário),
e `deadlines_calculate` (nenhuma prévia de cálculo de prazo). Expor cada um é decisão de
produto: o backend e os testes já estão de pé. A lista completa está no levantamento da
§8.9. **`proceedings_substitute_designation` saiu desta lista na §8.15**: tem botão na
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

## 10. Armadilhas conhecidas

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
| `<a download>` para entregar arquivo | No WebView não define destino nem abre "salvar como", e muda por plataforma. Sobreviveu no download de anexo até a §8.6.6, porque nenhum teste chega lá e a tela não acusa | `dom.ts::baixarArquivoBase64` → `files_save_download`, que abre o diálogo nativo no Rust. Vale para **todo** arquivo, não só o CSV |
| **`docker compose down -v` com dado de produção dentro** | Apaga 8 anos de registro. A regra "editou migration, recria o banco" **acabou** | Migration incremental (`0008`…). Se realmente precisar recomeçar, o roteiro completo está na 8.5 |
| Comparar coluna anulável com `=` num `INSERT ... SELECT` | `pm_id = motorista_id` devolve **NULL**, não `false`, quando o motorista é nulo — e a coluna NOT NULL recusa a linha inteira. Custou uma transação da etapa 05 | `IS NOT DISTINCT FROM`, ou `COALESCE(..., false)` |
| Executar dump de `pg_dump` pelo protocolo do Postgres | `COPY ... FROM stdin`, `\restrict` e `\.` são sintaxe do **cliente psql**, não SQL: `sqlx::raw_sql` estoura com "syntax error at or near \" | Gerar a fixture com `--inserts` e filtrar as linhas `\restrict`/`\unrestrict` — é o que `gerar_legado_amostra.sh` faz |
| Supor que tirar a coluna do registro apaga o dado | Não apaga, e é o que torna seguro esconder o `codigo_extensao`: o `UPDATE` genérico monta o `SET` **só** com as colunas declaradas, então editar um apuratório pela tela não toca a extensão de carta precatória. O reverso também vale — uma coluna `NOT NULL` fora do registro faz o **INSERT** falhar, porque ninguém a preenche | Coluna obrigatória que não cabe na tela vira `ReferenciaFixa`, que o `save` resolve sozinho (§5.3) |
| CSP sem `ipc:` em `connect-src` | Não quebra uma tela: quebra os **80 comandos** de uma vez, porque é por aí que o IPC do Tauri v2 passa. E some no console como `Refused to connect` | `connect-src 'self' ipc: http://ipc.localhost`. Se o app abrir mudo logo na primeira tela, é isto |
| **Largura de coluna num `<col style="">`** | É `style` como qualquer outro, e a CSP recusa igual: o `<col>` fica sem largura e a tabela volta a se dimensionar pelo conteúdo, **sem erro de build e sem erro de console que aponte a tabela** | A largura sai em `data-largura` e é aplicada pela CSSOM em `dom.ts::aplicarLarguras`, chamada de `main.ts::shell()` |
| **Duas gerações da mesma regra de CSS no arquivo** | Qual vence deixa de ser a intenção e passa a ser a ordem e a especificidade. `.tabela-dados thead th` mantinha o cabeçalho da listagem branco por ser mais específica que o `th` escrito depois — o efeito era bom, e ninguém sabia que era acidente | Ao mexer em regra que já existe duplicada, **medir o computado antes e depois** num navegador, sobre o CSS compilado. Foi como a §8.14 provou que a listagem de processos não mudou |
| `style=""` no markup, com a CSP ligada | O atributo é recusado e o elemento aparece sem estilo, **sem erro de build**. Só a CSSOM (`elemento.style.width = …`) escapa da diretiva | Larguras calculadas de coluna vão em `data-*` e são aplicadas por `aplicarLarguras()` em `shell()` |
| `csp` sem `devCsp` | Em desenvolvimento o Vite injeta o CSS por `<style>` e abre um WebSocket de HMR; a CSP de produção derruba os dois, e parece que o app quebrou | `devCsp` afrouxa só `style-src` e `connect-src`, e só em dev. Ver §8.6.2 |
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

## 11. Onde olhar no código

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
| a composição comum de processo, e por que a contagem não a usa | `src-tauri/migrations/0004_view_processos_detalhados.sql` e `proceedings/repository.rs::BASE_CONTAGEM` |
| o contrato de cada comando (Rust) | `src-tauri/src/*/domain.rs` |
| o contrato de cada comando (TypeScript) | `src/api.ts::Commands` — é o mapa completo dos 78 |
| como o escopo de um relatório é parametrizado | `maps_reports/repository.rs::FILTRO_ESCOPO` e `escopo()` |
| por que o mapa não filtra por instauração | `maps_reports/repository.rs::map_rows` (cabeçalho) |
| como um arquivo chega ao usuário | `src-tauri/src/files/commands.rs` (cabeçalho) |
| como uma tela é montada de metadados | `src/telas/catalogos.ts` |
| como os campos condicionais saem do dado | `src/telas/processo.ts` (cabeçalho do arquivo) |
| como Recebimento cria/move/remove o prazo inicial | `deadlines/repository.rs::sync_initial` e `proceedings/repository.rs::save` |
| como incluir, editar e excluir prorrogação | `deadlines/repository.rs::{add_extension, update_extension, delete_extension}`; decisões 34–37; §8.12–8.13 |
| onde ficam as ações e os formulários de prazo | `src/telas/processo.ts::renderDetalheProcesso` |
| como erro SQL vira mensagem pública segura | `src-tauri/src/error.rs::mensagem_banco` e `response.rs::ApiResponse::err` |
| o roteiro da importação, etapa por etapa | seção **8.5** deste arquivo, e `src-tauri/importacao/` |
| como cada catálogo operacional foi derivado do dump | `src-tauri/importacao/01_catalogos.sql` (comentado atributo por atributo) |
| as duas fontes de enquadramento do legado, e por que 11 infrações estatutárias entram e 3 não | `src-tauri/importacao/08_enquadramentos_anexos.sql` (cabeçalho do bloco dos PADS) |
| o que o legado tinha e não foi importado, item por item | §**8.5**, quadro "O que NÃO entrou, e por quê" |
| como acrescentar um catálogo administrável | §**7.4** |
| como esconder da tela uma coluna obrigatória no banco | `legal_catalogs/domain.rs::referencia_fixa` e `repository.rs::expressao` |
| como um campo de catálogo aparece só quando outro está marcado | `legal_catalogs/domain.rs::referencia_condicional` e o `[data-visivel-se]` de `src/telas/catalogos.ts` |
| como fazer uma mudança de schema agora que há dado real | §**7.3** |
| o que falta fazer | `CONFERENCIA-DE-TELA.md` (a lista para marcar), §**7.5** (o porquê) e o quadro no topo |
| por que lista de opções não pode paginar | §**8.9** e `users/repository.rs::list_ativos` |
| como paginar uma listagem de tela | `dom.ts::paginacao`/`ligarPaginacao`/`paginaValida` e `src-tauri/src/db/paginacao.rs::Recorte`; §**8.14** |
| como declarar largura, alinhamento e truncamento de coluna | `dom.ts::Coluna` e o bloco "Listagem de largura declarada" em `src/styles.css` |
| por que CSV e impressão não saem com dez linhas | `dom.ts::carregarTudo` e `ligarExportacao`; §**8.14** |
| por que os dois blocos de Prazos não se sobrepõem | `deadlines/repository.rs::FILTRO_REPORT` e o teste `blocos_de_prazo_sao_exclusivos` |
| como acrescentar uma listagem paginada, do Rust à tela | §**7.9** — o passo a passo completo |
| por que lista de opções **não** pode paginar | §**8.9**, `users/repository.rs::list_ativos` e o quadro do início da §7.9 |
| como provar que uma mexida em CSS não mudou a tela | §**8.14**, "Como repetir a medição de CSS" |
| o que vigiar quando a Seção começar a usar | fim da §**8.14** |
| como fazer backup, e como saber que ele presta | §**7.6** |
| quais campos cada apuratório mostra, e por quê | decisões **31** a **33**, e `apuratorio_config/domain.rs::ApuratorioConfig` |
| por que o comportamento não vem de `legal_catalogs_list` | o cabeçalho de `ApuratorioConfig`, e a §**6**, item 9 |
| como esconder um campo sem apagar o que já foi gravado | `processo.ts::textoSePresente` e o princípio 5 |
| como o formulário e a listagem se organizam na tela | §**8.10**, item 5, e o bloco "Listagem densa" em `src/styles.css` |
| como acrescentar um campo que só alguns apuratórios usam | §**7.7** — o passo a passo completo |
| como mexer numa migration que altera dado existente | §**7.8** — o ensaio sobre cópia do backup |
| por que o escrivão do IPM é um papel diferente | decisão **32** e §**8.10**, item 3 |
| por que o documento iniciador não lista todos | decisão **33** |
| onde estão as duas coisas que a conferência de tela já achou | §**8.9** e §**8.10** — e é por isso que ela não é formalidade |
| o que falta, em ordem, para fechar a migração | o quadro **▶ POR ONDE RETOMAR**, no topo, e `CONFERENCIA-DE-TELA.md` |
| como rodar o app com a CSP de produção | §**7.5** (o aviso do topo) e §**8.9**, item 3 |
| o que foi deliberadamente **não** planejado | §**8.8** |
| como o recorte de teste da importação é gerado | `src-tauri/tests/fixtures/gerar_legado_amostra.sh` |
| como "escrivão só em IPM" virou configuração, sem lista de siglas | `src-tauri/importacao/02_config_apuratorio.sql` |
| o que a importação garante, e como se conferiu | `src-tauri/importacao/99_conferencia.sql` e `src-tauri/tests/importacao.rs` |
| a conferência campo a campo dos 6 processos da amostra | `src-tauri/importacao/98_amostra_lado_a_lado.sql` (cabeçalho) e §**8.5** |
| por que a CSP é o que é, e o que ela recusaria | §**8.6.2**, e as quatro armadilhas de CSP na §10 |
| como um seletor de busca é montado nesta base | `src/telas/indicios.ts::pedirAnalogia` e o helper `buscar()` do mesmo arquivo |
| por que a prorrogação começa no dia do vencimento | `src-tauri/migrations/0005_prazo_intervalo_ocupacao.sql` |
| o diagnóstico do estado anterior | `ANALISE-MIGRACAO.md` |
