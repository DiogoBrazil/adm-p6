# Validação da migração dos dados legados — ADM-P6

**03/09/2026** · branch `migrate_to_rust_with_tauri`, a partir de `047012a`
Dump analisado: `admp6_db_atualizado.sql`, SHA-256
`15e4ed205527d8051feee005d63d9e334b1f71be260600708e2b1445ad8597a7`

Este documento audita o `Relatorio_comparativo_migracao_adm_p6.md` — que
**permanece intacto** — contra os dados reais, o esquema vivo e o código. Ele
registra o que se confirmou, o que precisou mudar e o que a migração deixa para
uma pessoa resolver.

---

## 1. Método

A conferência não partiu do relatório preliminar. Partiu do dado:

- o dump novo foi restaurado em `adm_p6_analise_legado_20260903` (`public` = dump
  de 03/09, `anterior` = dump anterior), para comparar os dois;
- o destino (`adm_p6_db`) foi apenas **lido**;
- toda a migração foi desenvolvida e exercitada em bancos descartáveis, montados
  como cópia fiel do real — inclusive com o schema `legado` antigo dentro, que é
  a situação que o operador vai encontrar.

---

## 2. Confirmado

Todos os números do plano foram re-derivados do dump e bateram.

| | Origem | Destino |
|---|---|---|
| Processos | 163 | 163 |
| Espécies | SR 75 · PADS 39 · IPM 29 · FP 9 · CP 3 · SV 3 · CD 2 · CJ 1 · PAD 1 · PADE 1 | idem |
| Unidades | 7ºBPM 139 · CORREGEPOM 21 · 9ºBPM 2 · 11ºBPM 1 | idem |
| Situação | 134 ativos · 29 inativos · 102 concluídos | idem |
| Envolvidos | união de `nome_pm_id` com a associativa | 265, dos quais 2 "À apurar" |
| Condutores | 17 `motorista_id` | 17, todos entre os envolvidos |
| Designações | 159 resp + 4 pres + 4 interrog + 29 escr + 4 escr-proc | 200 iniciais + 25 trocas = 225 |
| Substituições | 31 eventos no jsonb | 25 trocas + 6 elos colapsados |
| Prazos | 53 iniciais + 126 prorrogações | 163 + 126 = 289 |
| Vítimas · inquiridos · andamentos · cartas · anexos | 133 · 3 · 73 · 3 · 1 | idem |
| Enquadramento | 35 indícios · 18 penais · 88 RDPM · 23 Estatuto | idem |
| Soluções | 8 processos sugeridas · 97 decididas | 16 · 160 vínculos replicados |
| Penalidades | 10, sendo 7 com dias | idem |
| Efetivo | 245 militares (fora ADMIN001) | 246 no destino, com o de teste |

O anexo migra byte a byte: **20.595.685 bytes**, SHA-256
`b761e77d9ec04c8595a9033d2b1933fb6f78713a64c883fae474df1fff379479`.

### Nada do legado é recusado pelo esquema

Conferido antes de escrever qualquer código de carga:

- zero violações das 5 CHECKs cronológicas de `processos_procedimentos` (0013);
- zero sobreposições de prazo sob `daterange('[)')`; zero `dias <= 0`;
- zero colisões em `uq_processo_numero_documento` e `uq_processo_numero_controle`;
- `max_envolvidos` respeitado em todas as espécies (máx. real: IPM 9, SR 4, FP 4);
- cadeia de substituição íntegra: `responsavel_id` casa com o último
  `novo_encarregado` nos 24 processos, elos contíguos, nenhum id órfão;
- os *flags* de capacidade dos apuratórios batem espécie a espécie com o dado:
  vítima só em FP/IPM/SR/SV, solução sugerida só em FP, penalidade e julgamento
  só em CD/PAD/PADS, e `exige_natureza_fato` é falso exatamente nas 6 espécies
  cujos 47 processos têm natureza vazia;
- os 21 `local_fatos` resolvem, inclusive os 4 distritos compostos com o pai certo.

---

## 3. Corrigido

Oito pontos em que o plano estava incompleto ou o código não faria o que ele diz.

### 3.1 Faltavam 5 infrações penais no catálogo — ⛔ perda de dado

O plano afirmava que o único complemento de catálogo seria a natureza de armas e
munições. Dos 15 crimes usados por `pm_envolvido_crimes`, **cinco não existiam**
em `infracoes_penais`: CP art. 163, CPM art. 209, CPM art. 216, CPM art. 303 §2º
e CPM art. 319 — **5 dos 18 vínculos penais**.

A migration 0003 semeou o catálogo a partir do dump *anterior*; o legado passou a
usar esses artigos depois. Sem o complemento, ou a FK derruba a carga, ou (com um
`ON CONFLICT DO NOTHING` no lugar) 5 acusações penais reais somem sem erro.

A etapa 01 passou a inserir os artigos **usados** que faltam, preservando o UUID
de origem — que é o que faz a etapa 08 casar sem tabela de-para.

### 3.2 Os 23 vínculos do Estatuto vinham de duas fontes, e uma estava fora

O plano listava "23 vínculos" sem dizer de onde. São:

| Fonte | Espécies | Vínculos | Analogia |
|---|---|---|---|
| `transgressoes_ids` (jsonb) | PADS | 13 | **presente** no próprio dado |
| `pm_envolvido_art29` | IPM (7) e SR (3) | 10 | **ausente** |

A etapa 08 **excluía deliberadamente** a segunda fonte, porque
`analogia_transgressao_id` é `NOT NULL`. Isso perdia 10 acusações estatutárias
reais. Elas agora entram com a analogia provisória fixa, e a conferência as lista
nominalmente.

As duas fontes **não se cruzam** — uma só aparece em PADS, a outra só em IPM/SR —,
o que torna a regra determinística. Uma invariante prova que nenhuma analogia
real foi trocada pela provisória.

### 3.3 O schema `legado` já existia, com o dump anterior — ⛔ erro silencioso

`adm_p6_db` tem um schema `legado` com os 128 processos do backup anterior. Os 10
arquivos de `importacao/` dizem `legado.` literalmente. Carregar o dump novo sob
outro nome faria a carga ler o dump **errado, sem erro nenhum**.

Agora um `legado` preexistente é renomeado para `legado_anterior_<carimbo>` — não
descartado — e o preflight conta os processos da origem e recusa se forem menos
que 163. Verificado: com o dump antigo no lugar, o preflight reprova citando os
35 processos que se perderiam.

### 3.4 `--single-transaction` não valia nada

As 8 etapas abriam `BEGIN;`/`COMMIT;` próprios. Sob `psql --single-transaction` o
`BEGIN` vira aviso e o **`COMMIT` encerra a transação externa**: tudo depois do
primeiro corre em autocommit. A garantia de tudo-ou-nada não existia.

As etapas deixaram de abrir transação; quem a abre é o orquestrador.

### 3.5 O fuso deslocava todo o histórico em 4 horas

`07_prazos_andamentos.sql` fazia `(a->>'data')::timestamptz`, que interpreta a
hora ingênua no fuso da **sessão** — `Etc/UTC` no container. Os 73 andamentos
entravam 4h adiantados, e **um deles, gravado às 20h07, mudava de dia**.

São 8 conversões desse tipo nas etapas. A correção é num ponto só: o orquestrador
faz `SET LOCAL TimeZone = 'America/Porto_Velho'` e a etapa 00 recusa a carga se a
sessão estiver errada. A conversão do andamento também ficou explícita, por ser
um cast de texto.

### 3.6 As "2 promoções" eram 10 antes de normalizar a sigla

`legado.usuarios.posto_graduacao` é texto livre e guarda `ST PM` (8) e `TC PM`
(1) — siglas que os catálogos grafam `SUB TEN PM` e `TEN CEL PM`. Comparando cru
apareciam 10 diferenças. As promoções reais são duas:

| Matrícula | Militar | De | Para |
|---|---|---|---|
| 100062644 | CLAUDEMIR ARAUJO DOS SANTOS SALVALAIO | 1º SGT PM | SUB TEN PM |
| 100085466 | FABIANA CAVALCANTE MIRANDA | CAP PM | MAJ PM |

A detecção é pelo dado, com o alias aplicado, e **confere contra o esperado nos
dois sentidos**: promoção não prevista aborta a transação.

### 3.7 Três correções dependiam de migrations que já rodaram

A 0007 (separar Escrivão de Escrivão de Processo), a 0008 (cadeia de substituição)
e a 0016 (converter o "À apurar") corrigiam a carga **depois** dela. Todas já
foram aplicadas e não rodam de novo. Sem mudar as etapas, a migração produziria:
os 4 CD/CJ/PAD com o escrivão no papel errado, 25 substituições sem elo, e um
policial fictício "À APURAR" vivo no efetivo. Cada uma virou regra da etapa
correspondente, com asserção no teste.

### 3.8 Precisões

- **"os 4 CD/CJ/PAD sem acusação"**: cada um tem 1 envolvido. O que falta é
  **enquadramento** — nenhum `pm_envolvido_*`, nenhum `transgressoes_ids` —
  embora `permite_acusacao` seja verdadeiro para eles. A conferência lista os 4.
- **Autor do andamento é nome em texto**, não id. Os 2 autores resolvem para
  contas existentes; a etapa aborta se um nome deixar de casar com o efetivo.
- **`subunidade_secao_origem_id` fica NULL nos 163**: `local_origem` não carrega
  subunidade. Perda de detalhe deliberada, registrada aqui.

---

## 4. Como foi verificado

| | |
|---|---|
| Ensaio completo | `./scripts/migrar_dados_legados.sh` — 6,8 s, **0 divergências** |
| Execução real | em destino descartável idêntico ao real, com backup validado |
| Idempotência | 3 execuções seguidas convergem; a 3ª nem faz backup |
| Rollback | backup restaurado em banco separado devolve exatamente o estado anterior |
| Conferência | **38 contagens** e **51 invariantes**, todas em zero |
| Guardas | 5 estados perigosos testados um a um, todos recusados com mensagem |
| Testes | 180 Rust + 20 frontend + `cargo fmt --check` + `typecheck`, verdes |

As guardas exercitadas: dump anterior no lugar do novo · schema `legado` ausente
· analogia provisória desativada · processo inesperado no destino · banco sem
migrations.

---

## 5. Pendências para decisão humana

201 itens, no `pendencias.csv` de cada execução.

| Tipo | Qtd. | O que fazer |
|---|---|---|
| `analogia_provisoria` | 10 | Escolher o inciso do RDPM análogo, na tela de indícios |
| `prazo_reconstruido` | 110 | Conferir os dias, se o processo ainda estiver aberto |
| `prorrogacao_sem_motivo` | 77 | Preencher o motivo, se houver registro em papel |
| `papel_obrigatorio_vago` | 4 | Informar o Escrivão dos CD/CJ/PAD |

### As 10 analogias provisórias

Entram com `c8000000-0000-4000-8000-000000000001` (RDPM, Art. 15, I), **fixa e
sem validade jurídica**, escolhida assim para ser identificável por consulta. As
três já conhecidas estão entre elas:

| Apuratório | Processo | Militar | Infração |
|---|---|---|---|
| IPM | 012/P-6/7º BPM | MARCILEI PEREIRA LEITE | Art. 29, I · II · IV · XIII · XVI · XVII · XIX |
| SR | 2 | CHRISTIANO KAULING CAMPANINI | Art. 29, III |
| SR | 5 | ADRIANO DE SÃO PAULO ASSUMPÇÃO | Art. 29, III · XIII |

O IPM 012/P-6/7º BPM, com 7 vínculos, **não constava** do relatório preliminar:
apareceu no dump novo.

### Os 6 elos de substituição perdidos

Colapso das trocas do mesmo dia. O encarregado intermediário nunca exerceu um dia
sequer, e `ck_designacao_periodo` exige `data_fim > data_inicio`: a designação é
**inrepresentável**, não é escolha de estilo. Ficam registrados aqui e na
conferência.

| Apuratório | Processo | Dia | Encarregado não registrado |
|---|---|---|---|
| IPM | 2 | 09/02/2026 | JULIANO PEREIRA DE MIRANDA |
| IPM | 3 | 28/11/2025 | LEANDERSON COUTO DE JESUS |
| IPM | 7/2025/PM-7BPMP6 | 25/03/2026 | SIDNEI SILVA DE SOUZA |
| IPM | 8 | 02/03/2026 | SIDNEI SILVA DE SOUZA |
| SR | 20 | 13/01/2026 | SIDNEI SILVA DE SOUZA · LEANDERSON COUTO DE JESUS |

---

## 6. O que **não** é migrado

Afirmado por invariante, não só por omissão do script:

- as **117 linhas de `mapas_salvos`** do legado — os 3 mapas atuais ficam intactos;
- as **574 linhas de auditoria** do legado — as 79 atuais são preservadas,
  inclusive as 45 que falam dos testes apagados;
- `alembic_version` e `schema_migrations`, que permanecem só no schema legado.

A migração grava **uma** linha nova de auditoria, com executor nulo e o SHA-256 do
dump — que é o marcador de idempotência.

---

## 7. Arquivos

**Criados**
`scripts/migrar_dados_legados.sh` · `src-tauri/importacao/00_preflight.sql` ·
`00_limpeza_testes.sql` · `09_auditoria_migracao.sql` · `importacao/README.md` ·
este relatório.

**Alterados**
As etapas 01–08 · `98_amostra_lado_a_lado.sql` · `99_conferencia.sql` ·
`tests/importacao.rs` e a fixture (34 processos, de 26) ·
`tests/fixtures/gerar_legado_amostra.{sh,sql}` · `GUIA.md` · `README.md` ·
`CLAUDE.md`.

**Intocados**
As migrations 0001–0020 · `adm-p6.sql` · `admp6_db_atualizado.sql` ·
`Relatorio_comparativo_migracao_adm_p6.md`.
