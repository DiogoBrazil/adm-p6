# Refatoração do modelo de dados — estado e próximos passos

> Guia de continuidade da remodelagem do banco e do backend do **ADM-P6**
> (Seção de Justiça e Disciplina do 7º BPM), na migração Python/Eel → Rust/Tauri.

| | |
|---|---|
| **Branch** | `migrate_to_rust_with_tauri` |
| **Branch legada (Python/Eel)** | `upload_pdf_to_procedure` — consultar só quando precisar esclarecer regra |
| **Dump do banco em produção** | `adm-p6.sql` (44 MB, 13/05/2026) — **somente leitura**, nunca alterar |
| **Diagnóstico anterior** | `ANALISE-MIGRACAO.md` |
| **Plano aprovado** | `~/.claude/plans/sparkling-prancing-gizmo.md` |
| **SGBD** | PostgreSQL 16 (compose) — requer 12+ pela coluna gerada, e a extensão `btree_gist` |

---

## 1. Por que esta refatoração existe

O schema anterior (32 migrations) consolidou três problemas que ficariam caros depois de
importar os 128 processos reais:

1. **Identidade sem garantia.** Havia 10 tabelas quase idênticas (uma por espécie de
   apuratório) costuradas a um hub, `historico_processo_procedimentos`, por **código Rust
   sem FK nenhuma**. Pior: `tipo_to_table()` fazia um `match` sobre
   `apuratorios.nome_apuratorio` — uma linha **editável pelo usuário**. Renomear um
   apuratório quebrava update, delete, PDF e substituição de encarregado de todos os
   registros daquele tipo.
2. **Regra de negócio controlada por texto de exibição:** `== "Punido"`,
   `== "Feito Preliminar"`, `Some("Prisao") | Some("Detencao")`,
   `natureza.includes('sinistro de trânsito')`, `tipo_detalhe IN ('IPM','SR','SV')`.
3. **Duas fontes de verdade** para andamentos, PDFs, histórico de encarregados e indícios:
   JSONB nas 10 tabelas × tabelas normalizadas criadas depois e nunca usadas.

Somado a isso, 62 das 219 consultas SQL (28%) não executavam, e campos com dado real não
tinham destino: `numero_controle` (128/128), `natureza_procedimento` (88), vítimas
múltiplas (71), `motorista_id` (15), o autor de cada andamento.

---

## 2. Decisões de negócio já tomadas — **não reabrir sem motivo novo**

Foram decididas pelo responsável do projeto durante o planejamento. Estão implementadas.

| # | Questão | Decisão |
|---|---|---|
| 1 | Existe instalação do schema novo a preservar? | **Não.** As 32 migrations foram substituídas por baseline limpa. Histórico preservado no Git. |
| 2 | Solução e penalidade: do processo ou do envolvido? | **Do envolvido.** `apuratorios.max_envolvidos` torna configurável quantos PMs cada apuratório aceita (hoje 1 para processos, ilimitado para procedimentos). Com limite 1 o comportamento é idêntico ao de hoje; se mudar, não exige migration. |
| 3 | O que são `Sugerido_Arquivamento`, `Sugerido_IPM`, `Sugerido_Sindicancia`? | **Conceito distinto.** O encarregado *sugere*; a autoridade *decide*. Dois campos, dois catálogos: `tipos_solucao_sugerida` e `tipos_solucao_decidida`. |
| 4 | Crime militar × comum é do artigo ou do caso? | **Do caso** (art. 9º do CPM: militar da ativa em serviço pode praticar crime militar não previsto no CPM). A esfera é escolhida **no vínculo** envolvido↔artigo. Crime × Contravenção, esse sim, é atributo do artigo. Não há previsão de contravenção penal militar. |
| 5 | A analogia com o RDPM é obrigatória para toda infração estatutária? | **Sim, regra universal.** `analogia_transgressao_id` é `NOT NULL`. |
| 6 | O que significa `data_fim` de uma designação? | **O dia da troca, exclusivo.** O sucessor começa exatamente nesse dia. Intervalo semiaberto `[)`: sem sobreposição e sem lacuna, registrando uma única data (como o legado fazia). |
| 7 | Qual o escopo de unicidade do número de controle? | **Sequencial por unidade, ano e apuratório.** |
| 8 | Condutor (motorista) em sinistro | **No máximo um por processo, sempre entre os envolvidos.** É um papel do envolvido, não outra pessoa. |
| 9 | Papéis obrigatórios bloqueiam o salvamento? | **Sim.** Um `obrigatorio` que não bloqueia não significa nada. Quem quiser permitir a ausência desmarca `obrigatorio` naquele apuratório — quem decide é a configuração. O comentário do schema que dizia o contrário foi corrigido. |
| 10 | Que catálogos vêm semeados? | **Só o que é lei** e não varia por instalação (migration `0003`). O que é operacional por unidade — apuratórios, papéis, documentos, unidades — continua a cargo do administrador. |
| 11 | Como o administrador configura um apuratório? | Módulo dedicado `apuratorio_config`, não o CRUD genérico: as duas tabelas de associação têm PK composta, sem `id` e sem `nome`. |
| 12 | Rumo do frontend | Vanilla TS **dividido em módulos**, sem dependência nova, migrando tela por tela. |

---

## 3. Princípios invioláveis do modelo

Toda decisão futura deve respeitar estes seis pontos. Eles estão escritos também no
cabeçalho de `src-tauri/migrations/0001_schema.sql`.

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
> indistintamente em todos os repositórios — era um bug, não uma convenção.

---

## 4. Fatos do dump que fundamentam o modelo

Verificados por contagem direta sobre `adm-p6.sql`. Use-os como referência; não é preciso
reprocessar o dump.

| Achado | Consequência |
|---|---|
| `concluido` ⟺ `data_conclusao IS NOT NULL` em **128/128** | coluna booleana eliminada |
| `numero` == `numero_portaria` em 88/89, `numero_memorando` 32/32, `numero_feito` 7/7; nenhuma linha com a coluna de outro documento preenchida | as 3 colunas são o mesmo conceito → `numero_documento` |
| `numero_controle` ≠ `numero` em 5 linhas — e aí `numero` é o do documento (`056/P-6/7º BPM`) e o controle é o sequencial do P-6 (`020`) | são conceitos **distintos**; ambos ficam |
| `data_vencimento − data_inicio == dias_adicionados` em **141/141** prazos | regra única `vencimento = inicio + dias`; o `dias-1` que existia no Rust era bug |
| `(unidade, ano, apuratório, doc, numero)` e `(unidade, ano, apuratório, COALESCE(controle, numero))`: **0 duplicatas nos 99 ativos**, 7 se incluir inativos | os índices únicos **precisam** ser parciais `WHERE ativo` |
| `nome_pm_id` == PM de `ordem=1` em **91/91** | não existe "PM principal" |
| Os 37 "processos" (PADS/PAD/CD/CJ/PADE) têm **zero** linhas de envolvidos | envolvidos unificados para processo e procedimento |
| `motorista_id` == `nome_pm_id` e está entre os envolvidos em **15/15** | condutor é flag do envolvido |
| `status_pm` difere entre PMs do mesmo processo em 2 casos | status é **por envolvido** |
| Prazos: 1 vigente por processo (44/44), máx. 8 prorrogações | vigência derivada de `ordem`, sem coluna `ativo` |
| `escrivao_id` em **23** (= nº de IPMs); `presidente/interrogante/escrivao_processo` em **4** (= PAD 1 + CD 2 + CJ 1); `responsavel_id` NULL exatamente nesses 4 | papéis são **configuração por apuratório**, e o responsável do PAD/CD/CJ é o **Presidente** |
| `data_conclusao` existe para CP (2 registros) | a `carta_precatoria` antiga não tinha essa coluna; tabela única resolve |
| `transgressoes.artigo` mapeia 1:1 com `gravidade` (15=leve, 16=média, 17=grave) | gravidade vem do artigo, não duplicada |
| `natureza_processo` 0/128, `solucao_final` 0/128, `indicios_categorias` 26 linhas todas `[]`, `mapas_salvos.arquivo_pdf` 0/107 | colunas mortas, removidas |
| Só **7 dos 236** usuários têm e-mail+senha | separação policial × conta confirmada |
| `andamentos[].usuario` é **nome em texto**, não id | na importação será preciso casar por nome |

---

## 5. O que está PRONTO

### 5.1 Schema — `src-tauri/migrations/`

Duas migrations no lugar das 32:

| Arquivo | Linhas | Conteúdo |
|---|---:|---|
| `0001_schema.sql` | 1.123 | extensão `btree_gist` → catálogos → pessoas → núcleo → filhas → sistema → índices → triggers. Comentado por seção, explicando o *porquê* de cada decisão. |
| `0002_seed_admin.sql` | 29 | **só** um perfil administrativo + uma conta. Nenhum catálogo de negócio, nenhum policial fictício. |
| `0003_seed_catalogos_legais.sql` | 368 | os catálogos que são **lei** e não variam por instalação, extraídos do dump: 2 círculos, 13 postos, 112 municípios/distritos de RO, 7 dispositivos legais, 2 espécies, 2 esferas, 3 naturezas de transgressão, 3 artigos do RDPM, 95 transgressões, 26 infrações penais, 20 infrações do Estatuto. Idempotente. |

> **Duas exclusões deliberadas na 0003**, para que nada suma em silêncio: o art. 42
> da LCP estava cadastrado duas vezes (fica a linha ativa) e três linhas de teste
> já inativas no inciso "LX" do art. 29 foram descartadas. Daí 26 e 20, e não 27 e 23.
> Onde o dump já tinha UUID (municípios, infrações penais e do Estatuto) ele é
> **preservado**, para que a importação da etapa 7.5 case por id sem reconsultar.

**Seed técnico:** `admin@sistema.com` / `123456` (bcrypt custo 12, hash verificado por
teste). `policial_militar_id` é `NULL` — a conta técnica não inventa militar, posto nem
círculo hierárquico só para satisfazer FK. **Trocar a senha em qualquer instalação real.**

### 5.2 Modelo de dados

```
                     circulos_hierarquicos
                              │
                     postos_graduacoes
                              │
                     policiais_militares ──── usuarios (0..1)
                       │            │              │
                       │            │              └── auditoria, andamentos, anexos
                       │            │
   ┌───────────────────┘            └──────────────────┐
   ▼                                                   ▼
processo_envolvidos                          processo_designacoes
   │  status, ordem, e_condutor                 papel, data_inicio, data_fim
   │  solucao_sugerida, solucao_decidida        (histórico de substituição)
   │  penalidade_tipo, penalidade_dias
   │
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

**44 tabelas** (eram 46, com 10 delas duplicadas), **57 FKs** (eram 111, todas em
`NO ACTION` por omissão), **24 CHECKs** (eram 0 úteis), **2 EXCLUDEs**, **2 constraint
triggers**, **1 coluna gerada**, **9 índices parciais/de expressão**, **0 views**.

### 5.3 Configurabilidade — 26 catálogos administráveis

Todos com `id`, `nome`, `ativo`, timestamps e único case-insensitive. Os atributos
semânticos abaixo são o que substitui o hardcode:

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
| `postos_graduacoes` | `ordem_hierarquica` | ordenação por nome (a coluna havia sido removida na 0010) |

> **`e_responsavel` fica em `apuratorio_papeis`, não em `papeis_processo`** — de propósito:
> o papel que responde pelo apuratório **varia por apuratório** (Encarregado nos
> procedimentos, Presidente em PAD/CD/CJ). Uma flag global não expressaria isso.

**Único código técnico do sistema:** `apuratorios.codigo_extensao` (valor
`'carta_precatoria'`). Existe porque acrescentar uma extensão de formulário é
inerentemente mudança de código. Fica **separado** de `sigla` e `nome`, que continuam
livremente editáveis. Constante em `proceedings/domain.rs::EXTENSAO_CARTA_PRECATORIA`.

### 5.4 Integridade garantida pelo PostgreSQL

Destaques (lista completa nos comentários de `0001_schema.sql`):

- **FK composta** `(apuratorio_id, documento_iniciador_id)` → `apuratorio_documentos_iniciadores`:
  o banco recusa qualquer par que o administrador não tenha cadastrado.
- **Par de FKs compostas** em `processo_designacoes`: uma amarra `apuratorio_id` ao
  apuratório real do processo (não pode divergir), outra exige que o papel esteja
  cadastrado para aquele apuratório. Juntas, "escrivão só em IPM" e "PAD/CD/CJ não têm
  encarregado" passam a ser garantidas pelo banco, sem nome nenhum no código.
- **`EXCLUDE USING gist`** em `processo_prazos` (períodos nunca se sobrepõem — mais forte
  que o booleano `ativo` que existia) e em `processo_designacoes` (mesma pessoa, mesmo
  papel, períodos disjuntos, intervalo `[)`).
- **`data_vencimento GENERATED ALWAYS AS (data_inicio + dias) STORED`** — a aritmética do
  prazo existe em um único lugar; a divergência `+dias` × `+dias-1` que havia entre dois
  módulos ficou impossível.
- Dois índices únicos **parciais** de numeração, um deles usando
  `COALESCE(numero_controle, numero_documento)` — materializa "controle nulo = igual ao do
  documento" sem coluna redundante.
- `CHECK (policial_militar_id IS NOT NULL OR nome_exibicao IS NOT NULL)` em `usuarios`:
  exatamente uma origem para o nome da conta.
- `ON DELETE` definido **por FK**: `CASCADE` só na extensão de CP e nas 4 associativas de
  envolvido; `RESTRICT` em todo o resto — apagar item de catálogo não pode apagar
  silenciosamente enquadramento jurídico de processo passado.

### 5.5 As duas constraint triggers — exceção deliberada

`fn_valida_max_envolvidos` e `fn_valida_max_ocupantes`, ambas
`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, ~12 linhas cada.

Existem porque guardam invariantes que dependem de **valor configurável**
(`apuratorios.max_envolvidos`, `apuratorio_papeis.max_ocupantes`) e por isso não cabem em
índice único nem em CHECK. Dão de graça a semântica do princípio 5: baixar um limite
**bloqueia novas escritas** e **não invalida** as linhas existentes.

**São as únicas triggers do schema.** Se alguém for acrescentar outra, o ônus é justificar
por que não cabe em constraint.

### 5.6 Backend Rust — reescrito por inteiro

9 módulos, **5.779 linhas** (eram 9.194), **62 comandos Tauri** (eram 146).

| Módulo | O que mudou |
|---|---|
| `auth` | busca por conta (não mais `is_operador`); `pode_administrar` no lugar de `perfil == "admin"`; upgrade de hash SHA-256 legado preservado |
| `users` | **policial militar e conta separados**, gravados por um formulário só, numa transação. Retirar acesso *desativa* a conta (nunca apaga: é referenciada por andamentos, anexos, auditoria). Estatísticas agora são contagens rotuladas dinâmicas, não 14 contadores fixos |
| `legal_catalogs` | **2.856 → 908 linhas**; 68 comandos → **7 genéricos** sobre o registro `domain::CATALOGOS`. Acrescentar catálogo é acrescentar uma entrada. Nome de tabela/coluna no SQL vem **sempre** do registro, nunca da requisição; valores são sempre ligados como parâmetro |
| `proceedings` | `tipo_to_table()` eliminado; os 7 braços de INSERT e 7 de UPDATE viraram **um** de cada; some a escrita no hub. Validações passam a ler atributos semânticos dos catálogos |
| `deadlines` | `ordem` (0 = inicial) no lugar do catálogo `tipos_prazo`; dias vêm de `COALESCE(adi.prazo_base_dias, a.prazo_base_dias)`; off-by-one eliminado |
| `evidence` | 5 tabelas de enquadramento → 3; esfera penal escolhida no vínculo; rótulos ("Art. 29, inciso X, do …") montados a partir do dado, não por `format!` |
| `movements` | tabela relacional com **autor** e tipo do catálogo; `cancelado_em` no lugar de booleano |
| `audit` | `alteracoes JSONB` registra o *diff* das mudanças de configuração |
| `maps_reports` | 1.466 → 574 linhas; escopos de relatório vêm por parâmetro (`apuratorio_ids`), não por `IN ('IPM','SR','SV')`. `driver_ranking` e `nature_stats`, que eram `Ok(vec![])`, agora funcionam |
| `apuratorio_config` | **novo.** 5 comandos que cadastram `apuratorio_documentos_iniciadores` e `apuratorio_papeis`. Sem ele, nenhum processo podia ser criado: a FK composta de `processos_procedimentos` exige uma linha na primeira, e nenhuma tela ou comando a preenchia |

**Segurança:** as 13 escritas que rodavam só com `require_session` (a trava era cosmética,
no `canWrite()` do frontend) agora exigem `require_admin`. Acrescentada a trava do último
administrador, no backend e dentro da transação: não é possível desativar a última conta
que administra, nem rebaixar o próprio perfil sendo a última, nem desativar/despromover o
último perfil administrativo em uso.

### 5.7 Rede de proteção — `src-tauri/tests/`

Era exatamente a ausência dela que deixou 62 queries apodrecerem sem ninguém notar.

| Arquivo | O que cobre |
|---|---|
| `util/mod.rs` | cria banco descartável, aplica migrations, remove ao final mesmo com pânico |
| `migrations.rs` | migrations aplicam do zero **e são idempotentes**; tabelas extintas não ressuscitam; **nenhuma FK sem `ON DELETE`**; **JSONB só nas 2 colunas justificadas**; as 2 triggers existem; nenhum catálogo de negócio semeado |
| `schema_integrity.sql` + `.rs` | **38 asserções**: 31 estados impossíveis que o banco recusa + 5 controles que ele deve aceitar + 2 sobre a aritmética do prazo |
| `auth_login.rs` | admin do seed autentica em banco sem catálogos; busca case-insensitive; conta desativada não entra |
| `users_repository.rs` | policial com e sem conta; nome em maiúsculas / e-mail em minúsculas; editar sem senha preserva o hash; retirar acesso desativa; desativar militar tira o acesso junto |
| `util/fixtures.rs` | `mundo_configurado()`: monta a cadeia inteira até um apuratório configurado (círculo → posto → PM, município → unidade, apuratório → documentos → papéis, status, naturezas, soluções, penalidades). É a base de todo teste que toque em processo |
| `proceedings_repository.rs` | **18 testes**: criação completa, prazo inicial vindo da configuração, edição, as 6 validações semânticas, os limites configuráveis, a FK composta de papel, a numeração parcial, substituição de designação, os 8 filtros da listagem, anexos, ciclo de vida, dashboard e a regra de catálogo desativado |
| `apuratorio_config.rs` | 3 testes: troca de padrão e de responsável sem violar os índices únicos parciais; desativação preserva processos existentes |
| `deadlines_repository.rs` | 3 testes: `dias_base` com e sem override do documento; prorrogação encostando no vencimento anterior; motivo e prazo inicial obrigatórios |

**28 testes ao todo** (eram 4). Todos rodam contra bancos descartáveis, em `cargo test`.

---

## 6. Verificação executada

```bash
docker compose down -v && docker compose up -d   # PostgreSQL 16, porta 5438
cd src-tauri
cargo fmt --check                                # OK
cargo check --lib                                # OK, 0 warnings
cargo test                                       # 28 testes, todos ok
```

Inspeção objetiva do schema aplicado (via `information_schema` / `pg_catalog`):

```
tabelas 44 | pks 44 | fks 57 | unique 6 | checks 24 | excludes 2 | índices 142 | triggers 2 | views 0
seed: 1 perfil, 1 usuário, 0 policiais
      13 postos, 112 municípios, 95 transgressões, 26 infrações penais  (catálogos LEGAIS, 0003)
      0 apuratórios, 0 tipos de documento, 0 unidades PM               (OPERACIONAIS, do administrador)
```

**Quatro bugs reais que os testes pegaram** — os dois primeiros na implementação anterior,
os dois seguintes nesta rodada (detalhe em 7.2). Vale como argumento para não deixar a rede
de proteção de lado:

1. O hash bcrypt do seed **não correspondia** à senha `123456`. Passaria despercebido até
   alguém tentar entrar.
2. A aritmética do prazo divergia entre `proceedings` (`+dias`) e `deadlines` (`+dias-1`).
   Hoje é coluna gerada — não há como divergir.

---

## 7. O que FALTA — em ordem de prioridade

### 7.1 Frontend (`src/main.ts`, 2.124 linhas) — **bloqueante**

O `main.ts` referencia **118 comandos do backend, e 88 deles não existem mais.** Enquanto
isso não for feito, **o app não abre funcional**. É o maior item pendente.

**Abordagem decidida:** vanilla TS **dividido em módulos**, sem dependência nova —
`api.ts` (cliente tipado, com os nomes de comando como union type, que teria pego este
problema em tempo de compilação), `router.ts`, `telas/catalogos.ts` gerada de
`legal_catalogs_definitions`, `telas/processo.ts` para as coleções aninhadas. Migrar tela
por tela, mantendo o app abrindo a cada passo.

Dois achados a tratar junto: **não há `tsconfig.json` nem type-check no build**
(`vite build` só transpila, então nenhum erro de tipo quebra a compilação), e
`renderEvidencePanel` (`src/main.ts:1208`) é a única tela de escrita que não chama
`canWrite()`.

O que precisa acontecer:

1. **Catálogos → genéricos.** As ~66 chamadas `legal_catalogs_{list,save,delete}_<catálogo>`
   viram `legal_catalogs_list/save/deactivate/delete` com o parâmetro `catalogo`. A tela de
   administração deve ser **montada a partir de `legal_catalogs_definitions`**, que devolve
   rótulos, tipos de campo, catálogos referenciados e o texto explicando o efeito de cada
   atributo semântico. Isso substitui os 21 `crudConfigs` escritos à mão.
2. **Eliminar as listas fixas** — trocar por `optionsCommand` (o padrão já existe em
   `main.ts:413`):
   - `:406` `tipo_geral` `["Processo","Procedimento"]` (com o agravante de mandar
     capitalizado enquanto o backend comparava minúsculo)
   - `:410` `tipo_detalhe` — as 10 siglas
   - `:433` `solucao_tipo`, `:438` `penalidade_tipo` (sem acento, nunca casavam com o catálogo)
   - `:215` `perfil` `["admin","comum"]`
   - `:1072` `autorizado_tipo`, `:1233` categorias de indício
3. **Renomes de comando:**
   `proceedings_create`/`proceedings_update` → **`proceedings_save`**;
   `proceedings_upload_pdf`/`_get_pdf`/`_remove_pdf` → **`proceedings_{upload,get,remove}_attachment`**
   (agora N anexos por processo, não um PDF inline);
   `users_proceedings_responsible`/`_escrivao` → **`users_proceedings_designated`** com
   `papel_id` opcional;
   `proceedings_substitute_responsible` → **`proceedings_substitute_designation`**;
   `evidence_search_{crimes,rdpm,art29,art32}` → **`evidence_search_{infracoes_penais,transgressoes,infracoes_estatuto}`**;
   `deadlines_upcoming`/`_overdue`/`_close` → **`deadlines_report`** com filtro;
   `reports_generate_monthly_map`/`_complete_map` → **`reports_map_rows`** com `MapPeriodRequest`.
4. **Completar o formulário de procedimento**, que hoje declara 22 campos e não tem
   nenhum dos papéis, envolvidos, datas de remessa/julgamento nem os campos por tipo.
   O novo `SaveProceedingRequest` recebe `envolvidos[]`, `designacoes[]`, `pessoas[]` e
   `carta_precatoria` em uma única chamada.
5. **Campos condicionais dirigidos por dado**, não por sigla: mostrar o campo de condutor
   quando `naturezas_fato.exige_condutor`; exigir natureza quando
   `apuratorios.exige_natureza_fato`; mostrar deprecante/unidade deprecada quando
   `apuratorios.codigo_extensao == 'carta_precatoria'`; mostrar os papéis que
   `apuratorio_papeis` declarar para o apuratório escolhido.

### 7.2 Testes de integração de `proceedings` — ~~alta~~ **FEITO**

Coberto por `tests/proceedings_repository.rs` (18 testes) e `tests/deadlines_repository.rs`
(3). Detalhe em 5.7. Falta fazer o mesmo para **`evidence`, `movements` e `maps_reports`**,
que continuam sem nenhum teste.

Dois defeitos reais que estes testes pegaram, além dos dois já registrados na seção 6:

3. **Não havia como cadastrar a configuração do apuratório.** `apuratorio_papeis` e
   `apuratorio_documentos_iniciadores` eram lidas em 8 pontos e não tinham caminho de
   escrita — nenhum processo podia existir. Resolvido pelo módulo `apuratorio_config`.
4. **Trocar a espécie do apuratório vazava violação de FK crua na tela.** As designações
   são registro histórico e nunca são apagadas, então a FK composta
   `(processo_id, apuratorio_id)` impede a troca — corretamente. O que faltava era
   recusar com uma regra legível, e não com
   `violates foreign key constraint "fk_designacao_processo"`.

### 7.3 `cargo sqlx prepare` — **alta**

Migrar `sqlx::query`/`query_as` para `query!`/`query_as!` onde a consulta for estática, e
versionar `.sqlx/`. Assim erro de SQL aparece no build, e não em runtime na cara do
usuário. Onde a macro não couber (o SQL montado dinamicamente de `legal_catalogs` e os
filtros compostos), manter teste que faça `PREPARE` contra um banco recém-migrado.

```bash
cargo install sqlx-cli --no-default-features --features postgres
cargo sqlx prepare          # gera .sqlx/, versionar
cargo sqlx prepare --check  # valida no CI
```

### 7.4 Views de conveniência — **média**

Só agora, com o schema fechado, faz sentido: `v_processos_detalhados` (processo +
apuratório + unidade + natureza + responsável vigente + prazo vigente + contagem de
envolvidos). Hoje essa composição está repetida como `const` em
`proceedings/repository.rs` (`COLUNAS_LISTA`, `JOIN_RESPONSAVEL`, `JOIN_PRAZO`) e em
`maps_reports`. **Não recriar a antiga `v_processos`** — ela existia para esconder as 10
tabelas.

### 7.5 Importação dos dados de produção — **depois de tudo acima**

Explicitamente **fora do escopo** desta etapa e não iniciada. Ordem recomendada:
catálogos → policiais militares → processos → envolvidos → designações → prazos →
andamentos → enquadramentos → anexos → mapas → auditoria.

Pontos de atenção já mapeados:

- `usuarios.posto_graduacao` do legado é texto livre com códigos fora do catálogo:
  `ST PM` (7 militares), `TC PM` (1), `ASP OF PM` (1). Mapear antes de importar.
- `andamentos[].usuario` é **nome em texto**; casar por nome ou deixar o autor nulo.
- As 6 soluções `Sugerido_*` vão para `tipos_solucao_sugerida`; as demais para
  `tipos_solucao_decidida`.
- `nome_vitima` é array JSON em 71 de 87 registros → `processo_pessoas`.
- `pessoas_inquiridas` (3 registros, JSON em coluna `TEXT`) → `processo_pessoas`.
- `historico_encarregados` (19 registros) → `processo_designacoes`, com `data_fim` do
  antecessor = `data_substituicao` = `data_inicio` do sucessor.
- Os 37 processos sem linhas de envolvidos: criar um envolvido `ordem = 1` a partir de
  `nome_pm_id` + `status_pm`.
- `motorista_id` (15) → `e_condutor = true` no envolvido correspondente.
- Só **1** dos 128 processos tem PDF (41 MB).

### 7.6 Higiene — **baixa**

- `README.md` ainda descreve venv, `pip install`, Alembic e PyInstaller.
- `CLAUDE.md` descreve o framework "reversa", descontinuado.
- ~~**`adm-p6.sql` está na raiz do repositório**~~ — **resolvido**: acrescentado ao
  `.gitignore`. Continua na raiz como fonte somente-leitura da 0003 e da importação.
- `dist/` (build do Vite) continua **versionado**: não basta pôr no `.gitignore`, é
  preciso `git rm --cached`. Deixado para a passada de higiene.
- `tauri.conf.json` tem `"csp": null`. O frontend monta HTML por concatenação de string;
  revisar escapagem antes de ligar a CSP.

---

## 8. Pontos a reavaliar (registrados, não bloqueantes)

**Solução decidida: por envolvido ou por processo?**
Ficou **por envolvido**, conforme decidido, e com `max_envolvidos = 1` nos processos o
modelo é exato. Mas vale registrar o que os dados mostram: `Homologado` (48) e `Avocado`
(3) só aparecem em procedimentos — que têm vários envolvidos — e parecem ser atos sobre o
**procedimento inteiro**; já `Punido` (7) e `Absolvido` (4) só aparecem em processos e são
claramente individuais. Se, ao cadastrar procedimentos com 3+ sindicados, a solução
decidida se repetir idêntica em todos, é sinal de que ela é do processo — e aí basta mover
a coluna.

**Formato da matrícula.** `9 caracteres, prefixo 1000 ou 3000` ficou como validação de
domínio (`users/domain.rs`), não como CHECK, para não impedir a importação de registros
históricos que eventualmente não sigam o padrão. Se virar regra rígida, promover a CHECK.

**Anexos em `BYTEA`.** Mantido por ora — o problema desta etapa era eliminar a duplicidade
de modelagem (colunas `pdf_*` inline × tabela de PDFs), e isso foi feito. Limite de 100 MB
na aplicação, trafegando em base64 pelo IPC (~133 MB de string). Se o volume crescer,
avaliar armazenamento em disco com o caminho no banco.

**JSONB remanescente — os dois são justificados e estão travados por teste:**
`mapas_salvos.dados_mapa` (snapshot imutável de relatório já emitido; recalcular daria
outro resultado) e `auditoria.alteracoes` (diff heterogêneo e imutável, nunca consultado
campo a campo). O teste `migrations.rs` **falha** se aparecer um terceiro.

---

## 9. Como rodar

```bash
cp .env.example .env                 # já aponta para o compose (porta 5438, adm_p6_db)
docker compose up -d

cd src-tauri
cargo test                           # cria bancos descartáveis, migra, valida, remove
cargo run                            # aplica as migrations no startup e abre o app
```

Login inicial: `admin@sistema.com` / `123456`.

**O primeiro `cargo run` aplica as três migrations e registra `_sqlx_migrations`.** Vale
conferir que a tabela existe: houve um período em que o schema estava aplicado no banco de
desenvolvimento **fora** do controle do sqlx, o que faz o startup seguinte falhar tentando
recriar tabelas que já existem. Se acontecer, `docker compose down -v && docker compose up -d`.

Depois de subir, para chegar a um processo é preciso cadastrar, nesta ordem: unidade PM,
apuratório, tipo de documento e — em **Configuração do apuratório** — pelo menos um
documento iniciador e o papel responsável. Os catálogos legais (postos, municípios, RDPM,
Estatuto, legislação penal) já vêm prontos pela 0003.

**Cuidado com o checksum das migrations.** O `sqlx::migrate!` guarda um checksum por
versão: editar `0001_schema.sql` depois de aplicado gera `VersionMismatch` no próximo
startup. Enquanto o schema não estiver em produção, o certo é **editar o arquivo e
recriar o banco**, não acrescentar `0003`:

```bash
docker compose down -v && docker compose up -d
```

Depois que houver instalação real, aí sim migrations incrementais.

---

## 10. Onde olhar no código

| Quero entender… | Vá em |
|---|---|
| o schema e o porquê de cada decisão | `src-tauri/migrations/0001_schema.sql` (comentado por seção) |
| quais catálogos existem e o que cada atributo faz | `src-tauri/src/legal_catalogs/domain.rs::CATALOGOS` |
| como o responsável do processo é resolvido sem nome de papel | `proceedings/repository.rs::JOIN_RESPONSAVEL` |
| as validações que dependem de configuração | `proceedings/repository.rs::validar_contra_configuracao` |
| o que o banco recusa | `src-tauri/tests/schema_integrity.sql` |
| como configurar um apuratório (e por que não é um catálogo) | `src-tauri/src/apuratorio_config/domain.rs` |
| como montar um cenário de teste com processo | `src-tauri/tests/util/fixtures.rs` |
| o que exatamente vem semeado, e o que não vem | `src-tauri/tests/migrations.rs` (é o teste que trava a fronteira) |
| o contrato de cada comando | `src-tauri/src/*/domain.rs` (structs de request/response) |
| o diagnóstico do estado anterior | `ANALISE-MIGRACAO.md` |
