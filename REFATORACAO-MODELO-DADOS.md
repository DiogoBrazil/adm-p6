# ADM-P6 — guia de continuidade da migração

> Estado da remodelagem do banco, do backend e do frontend do **ADM-P6**
> (Seção de Justiça e Disciplina do 7º BPM), na migração Python/Eel → Rust/Tauri.
>
> Este arquivo é a fonte de verdade para retomar o trabalho. Leia as seções 1 a 4
> antes de mudar qualquer coisa; a seção 8 diz exatamente o que fazer a seguir.

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
| Migrations | 3 (eram 32) |
| Tabelas · FKs · CHECKs · EXCLUDEs · triggers | 44 · 57 · 24 · 2 · 2 |
| Comandos Tauri | 67 (eram 146) |
| Backend Rust | 6.318 linhas (eram 9.194) |
| Testes de integração | **28** (eram 0) |
| Frontend | 5.404 linhas em 10 arquivos (era 1 arquivo de 2.124) |
| Comandos que o frontend invoca e não existem | **15** (eram 87) |

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
| `andamentos[].usuario` é **nome em texto**, não id | na importação será preciso casar por nome |

---

## 5. O que está PRONTO

### 5.1 Migrations — `src-tauri/migrations/`

| Arquivo | Linhas | Conteúdo |
|---|---:|---|
| `0001_schema.sql` | 1.127 | `btree_gist` → catálogos → pessoas → núcleo → filhas → sistema → índices → triggers. Comentado por seção, explicando o *porquê* de cada decisão. |
| `0002_seed_admin.sql` | 29 | **só** um perfil administrativo + uma conta. Nenhum policial fictício. |
| `0003_seed_catalogos_legais.sql` | 369 | os catálogos que são **lei**: 2 círculos, 13 postos, 112 municípios/distritos de RO, 7 dispositivos legais, 2 espécies, 2 esferas, 3 naturezas de transgressão, 3 artigos do RDPM, 95 transgressões, 26 infrações penais, 20 infrações do Estatuto. Idempotente (`ON CONFLICT DO NOTHING`). |

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

### 5.3 Configurabilidade — 26 catálogos + 2 tabelas de configuração

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
| `postos_graduacoes` | `ordem_hierarquica` | ordenação por nome |

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

### 5.5 Backend Rust — 10 módulos, 67 comandos

| Módulo | Papel |
|---|---|
| `auth` | login por conta, `pode_administrar` no lugar de `perfil == "admin"`, upgrade de hash SHA-256 legado |
| `users` | policial militar e conta **separados**, gravados por um formulário só, numa transação. Trava do último administrador |
| `legal_catalogs` | **7 comandos genéricos** sobre o registro `domain::CATALOGOS` (26 catálogos). Nome de tabela/coluna vem sempre do registro, nunca da requisição |
| `apuratorio_config` | **novo.** 5 comandos que cadastram `apuratorio_documentos_iniciadores` e `apuratorio_papeis` — sem eles nenhum processo pode existir |
| `proceedings` | uma tabela só; `tipo_to_table()` eliminado. Validações leem atributos semânticos |
| `deadlines` | `ordem` (0 = inicial); dias vêm de `COALESCE(adi.prazo_base_dias, a.prazo_base_dias)` |
| `evidence` | 5 tabelas de enquadramento → 3; esfera penal escolhida no vínculo |
| `movements` | tabela relacional com **autor** e tipo do catálogo; `cancelado_em` no lugar de booleano |
| `audit` | `alteracoes JSONB` registra o *diff* das mudanças de configuração |
| `maps_reports` | escopos de relatório vêm por parâmetro (`apuratorio_ids`), não por `IN ('IPM','SR','SV')` |

**Segurança:** as 13 escritas que rodavam só com `require_session` agora exigem
`require_admin`. Há trava do último administrador, no backend e dentro da transação.

### 5.6 Frontend — cliente tipado e 6 telas migradas

```
src/
  api.ts            252   cliente tipado: mapa `Commands` com os 67 comandos
  types.ts          789   71 interfaces + 1 enum, derivados de src-tauri/src/*/domain.rs
  dom.ts             32   escapeHtml, cellDisplay, option
  main.ts         1.478   shell, rotas, login, e as telas AINDA NÃO migradas
  telas/
    catalogos.ts    371   os 26 catálogos, gerada de legal_catalogs_definitions
    apuratorio.ts   336   configuração de documentos iniciadores e papéis
    processo.ts     919   lista, formulário completo e detalhe
    indicios.ts     315   enquadramento por envolvido
    prazos.ts        79   painel de prazos
```

**O cliente tipado (`api.ts`) é a peça central.** O nome do comando é `keyof Commands`, e
argumentos e resposta saem do mesmo mapa. Comando inexistente, argumento errado ou campo de
resposta inventado passam a ser **erro de compilação** — antes viravam mensagem de erro na
tela do usuário. `tsconfig.json` roda em `strict` + `noUncheckedIndexedAccess`, e
`npm run build` executa `tsc --noEmit` antes do Vite.

**Duas armadilhas que o cliente tipado fixou:**

1. **As chaves de argumento do Tauri v2 são camelCase.** Um parâmetro `processo_id` no Rust
   chega como `processoId` no JS, salvo se o comando declarar `rename_all = "snake_case"` —
   e nenhum dos 67 declara. O `main.ts` mandava snake_case, então **toda chamada com
   argumento de mais de uma palavra falhava**. São 16 parâmetros nessa situação.
   Atenção: isso vale para os **argumentos do comando**, não para os campos de um struct
   de request — dentro de `{ request: {...} }` os campos continuam em snake_case, porque
   ali quem desserializa é o serde.
2. **`ProceedingListItem` devolve os ids ao lado dos rótulos**
   (`documento_iniciador_id`, `unidade_origem_id`, `municipio_fato_id`,
   `natureza_fato_id`). Sem eles o formulário de edição teria de casar por nome para
   repopular os selects — e falharia justamente no caso que o modelo protege: um catálogo
   desativado não aparece na lista de opções, e o processo antigo perderia o vínculo em
   silêncio ao ser reeditado.

**Tela de catálogos:** montada inteiramente de `legal_catalogs_definitions`. Acrescentar um
catálogo no Rust faz a tela aparecer sozinha. Referências aparecem com rótulo legível (o
rótulo é montado juntando as colunas textuais do catálogo alvo), e o texto `efeito` de cada
atributo semântico é exibido ao lado do campo.

**Formulário de processo:** os campos condicionais são dirigidos por dado, nunca por sigla —
natureza obrigatória vem de `apuratorios.exige_natureza_fato`, o campo de condutor de
`naturezas_fato.exige_condutor`, deprecante/deprecada de `codigo_extensao`, os papéis de
`apuratorio_papeis`, e penalidade/dias de `permite_penalidade`/`usa_quantidade_dias`.

### 5.7 Rede de proteção — 28 testes

| Arquivo | O que cobre |
|---|---|
| `util/mod.rs` | cria banco descartável, aplica migrations, remove ao final mesmo com pânico |
| `util/fixtures.rs` | `mundo_configurado()`: monta a cadeia inteira até um apuratório configurado. **Base de todo teste que toque em processo** |
| `migrations.rs` | migrations aplicam do zero **e são idempotentes**; tabelas extintas não ressuscitam; nenhuma FK sem `ON DELETE`; JSONB só nas 2 colunas justificadas; **a fronteira do seed** (11 catálogos legais com contagem exata, 17 operacionais vazios) |
| `schema_integrity.sql` + `.rs` | 38 asserções: estados impossíveis que o banco recusa + controles que ele deve aceitar |
| `auth_login.rs` | admin do seed autentica; busca case-insensitive; conta desativada não entra |
| `users_repository.rs` | policial com e sem conta; normalização; retirar acesso desativa |
| `proceedings_repository.rs` | **18 testes** — criação completa, prazo inicial vindo da configuração, edição, as 6 validações semânticas, limites configuráveis, FK composta de papel, numeração parcial, substituição de designação, os 8 filtros, anexos, ciclo de vida, dashboard, catálogo desativado |
| `apuratorio_config.rs` | 3 testes — troca de padrão e de responsável sem violar os índices únicos parciais; desativação preserva processos existentes |
| `deadlines_repository.rs` | 3 testes — `dias_base` com e sem override; prorrogação encostando no vencimento; motivo obrigatório |

---

## 6. Quatro bugs reais que os testes pegaram

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

---

## 7. Como rodar e verificar

```bash
cp .env.example .env                 # já aponta para o compose (porta 5438, adm_p6_db)
docker compose up -d

# Backend
cd src-tauri
cargo fmt --check
cargo test                           # 28 testes, bancos descartáveis
cargo run                            # aplica as migrations no startup e abre o app

# Frontend
cd ..
npm install
npm run typecheck                    # tsc --noEmit — é aqui que erro de comando aparece
npm run build                        # typecheck + vite build
```

Login inicial: `admin@sistema.com` / `123456`.

### Primeiro uso: a ordem de cadastro importa

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
   processo, e a tela avisa
7. **Usuários** — cadastrar os policiais militares
8. **Procedimentos → Novo**

### Cuidado com o checksum das migrations

O `sqlx::migrate!` guarda um checksum por versão: editar um `.sql` já aplicado gera
`VersionMismatch` no próximo startup. Enquanto o schema não estiver em produção, o certo é
**editar o arquivo e recriar o banco**:

```bash
docker compose down -v && docker compose up -d
```

Depois que houver instalação real, aí sim migrations incrementais.

---

## 8. O que FALTA — em ordem de execução

### 8.1 Terminar o frontend — **maior item pendente**

Restam **15 comandos** que o `main.ts` invoca e que não existem no backend. Todos estão em
quatro telas de relatório e estatística. Nenhuma outra parte do app depende delas, então dá
para fazer uma por vez, verificando com `npm run typecheck` a cada passo.

| Tela (função em `main.ts`) | Comandos inexistentes | Para onde vai |
|---|---|---|
| `renderProceedingsStats` (`/stats/procedimentos`) | `proceedings_in_progress_stats`, `_pads_solutions`, `_ipm_evidence`, `_sr_evidence`, `_top10_transgressions`, `_driver_ranking`, `_nature_stats`, `_common_crimes`, `_military_crimes` (9) | **Decisão necessária** — ver abaixo |
| `renderMonthlyMap` (`/mapas/mensal`) | `reports_generate_monthly_map`, `reports_generate_complete_map`, `reports_process_types` (3) | `reports_map_rows` com `MapPeriodRequest`; a lista de tipos vem de `legal_catalogs_list("apuratorios")` |
| `renderAnnualStats` (`/estatisticas/anuais`) | `reports_annual_statistics` (1) | compor de `reports_by_responsible`, `reports_by_nature` e `dashboard_summary`, todos com `ReportFilter` |
| rota `/estatisticas/processos` | `reports_by_type` (1) | `dashboard_summary` já devolve `por_apuratorio`, `por_natureza`, `por_unidade` e `por_ano` como contagens rotuladas |
| rota `/estatisticas/prazos` | `reports_overdue_deadlines` (1) | `deadlines_report` com `apenas_vencidos: true`. **Sobrepõe-se a `telas/prazos.ts`**, que já mostra vencidos; a diferença é que esta rota tem exportação CSV. Decidir: remover a rota, ou acrescentar o CSV à tela de prazos |

> **A decisão que trava `renderProceedingsStats`:** os 9 comandos não têm equivalente no
> backend novo, e não é omissão — eram consultas com sigla escrita no SQL
> (`IN ('IPM','SR','SV')`) e categorias de indício fixas, exatamente o que a refatoração
> eliminou. Antes de reimplementar, decida **o que a Seção precisa ver**; então a tela vira
> um punhado de chamadas a `reports_*` com `apuratorio_ids` por parâmetro. Reimplementar
> um a um reintroduziria o hardcode.

**Ordem sugerida:** `/estatisticas/prazos` (provavelmente só apagar a rota) →
`/estatisticas/processos` → `/mapas/mensal` → `/estatisticas/anuais` →
`/stats/procedimentos` (depois da decisão).

**Telas ainda no `main.ts` que funcionam mas usam o `call()` legado, não tipado:**
dashboard, auditoria, lista e detalhe de usuário, mapas salvos, estatísticas de
encarregados. Migrar cada uma para `api.ts` é mecânico e de baixo risco. Quando não sobrar
nenhuma chamada legada, **apagar o `call()` local de `main.ts`** — é o marco que fecha a
migração do frontend.

### 8.2 Testes para `evidence`, `movements` e `maps_reports` — **alta**

Continuam sem nenhum teste. Ficaram baratos: `util/fixtures.rs` já monta o mundo inteiro,
então cada arquivo novo é quase só asserção. `evidence` é o mais relevante — 352 linhas de
SQL e a lógica de esfera penal escolhida no vínculo.

**Nenhum comando Tauri foi testado ponta a ponta.** Os testes exercitam os repositórios; os
guards (`require_admin`), a desserialização dos requests e o envelope `ApiResponse` seguem
sem cobertura. Se algo quebrar de forma estranha ao ligar uma tela, é o primeiro lugar para
olhar.

### 8.3 `cargo sqlx prepare` — **alta**

Migrar `sqlx::query`/`query_as` para `query!`/`query_as!` onde a consulta for estática, e
versionar `.sqlx/`. Assim erro de SQL aparece no build, e não em runtime. Onde a macro não
couber (o SQL montado dinamicamente de `legal_catalogs` e os filtros compostos), manter
teste que faça `PREPARE` contra um banco recém-migrado.

```bash
cargo install sqlx-cli --no-default-features --features postgres
# habilitar a feature `macros` no Cargo.toml — hoje ela NÃO está ligada
cargo sqlx prepare
cargo sqlx prepare --check   # no CI
```

### 8.4 Views de conveniência — **média**

Com o schema fechado, faz sentido: `v_processos_detalhados` (processo + apuratório +
unidade + natureza + responsável vigente + prazo vigente + contagem de envolvidos). Hoje
essa composição está repetida como `const` em `proceedings/repository.rs`
(`COLUNAS_LISTA`, `JOIN_RESPONSAVEL`, `JOIN_PRAZO`) e em `maps_reports`.
**Não recriar a antiga `v_processos`** — ela existia para esconder as 10 tabelas.

### 8.5 Importação dos dados de produção — **depois de tudo acima**

Não iniciada. Ordem: catálogos operacionais → policiais militares → processos →
envolvidos → designações → prazos → andamentos → enquadramentos → anexos → mapas →
auditoria.

Pontos de atenção já mapeados:

- `usuarios.posto_graduacao` do legado é texto livre: `ST PM` (7 militares) → `SUB TEN PM`,
  `TC PM` (1) → `TEN CEL PM`, `ASP OF PM` (1) → já existe no catálogo pela 0003.
- `andamentos[].usuario` é **nome em texto**; casar por nome ou deixar o autor nulo.
- As 6 soluções `Sugerido_*` vão para `tipos_solucao_sugerida`; as demais para
  `tipos_solucao_decidida`.
- `nome_vitima` é array JSON em 71 de 87 registros → `processo_pessoas`.
- `pessoas_inquiridas` (3 registros, JSON em coluna `TEXT`) → `processo_pessoas`.
- `historico_encarregados` (19 registros) → `processo_designacoes`, com `data_fim` do
  antecessor = `data_substituicao` = `data_inicio` do sucessor.
- Os 37 processos sem envolvidos: criar um envolvido `ordem = 1` de `nome_pm_id` +
  `status_pm`.
- `motorista_id` (15) → `e_condutor = true` no envolvido correspondente.
- Só **1** dos 128 processos tem PDF (41 MB).
- A 0003 **preservou os UUIDs do dump** para municípios, infrações penais e do Estatuto —
  use isso para casar sem reconsultar.

### 8.6 Higiene — **baixa**

- `README.md` ainda descreve venv, `pip install`, Alembic e PyInstaller.
- `CLAUDE.md` descreve o framework "reversa", descontinuado.
- `tauri.conf.json` tem `"csp": null`. O frontend monta HTML por concatenação; a escapagem
  passa por `dom.ts::escapeHtml` nas telas migradas, mas **o `main.ts` legado ainda
  interpola sem escapar** — mensagens de erro do backend (`${error}`, `${response.error}`),
  `session.nome`, `session.perfil`, nomes de coluna vindos das chaves do JSON e rótulos de
  `stat card`. A maioria é dado estático ou do próprio backend, mas erro de banco pode
  carregar texto do usuário. Revisar antes de ligar a CSP; as telas em `src/telas/` já
  estão limpas.
- A escolha da analogia RDPM em `telas/indicios.ts` usa `prompt()`. Funciona e respeita a
  regra, mas merece um seletor de verdade.

---

## 9. Pontos a reavaliar (registrados, não bloqueantes)

**Solução decidida: por envolvido ou por processo?**
Ficou **por envolvido**. Mas vale registrar o que os dados mostram: `Homologado` (48) e
`Avocado` (3) só aparecem em procedimentos e parecem ser atos sobre o **procedimento
inteiro**; já `Punido` (7) e `Absolvido` (4) só aparecem em processos e são claramente
individuais. Se, ao cadastrar procedimentos com 3+ sindicados, a solução decidida se
repetir idêntica em todos, é sinal de que ela é do processo — e aí basta mover a coluna.

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
| `replace` sem `assert` em script de edição | Um `s.replace(a, b)` que não casa é um **no-op silencioso**. Foi assim que a rota de configuração de apuratórios ficou sem botão de menu por três commits | Sempre `assert alvo in s` antes de substituir |
| Filtrar `ativo` na leitura de registro | Um processo antigo perde o catálogo desativado que usava | Filtrar `ativo` só em lista de **opções** |

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
| o contrato de cada comando (Rust) | `src-tauri/src/*/domain.rs` |
| o contrato de cada comando (TypeScript) | `src/api.ts::Commands` — é o mapa completo dos 67 |
| como uma tela é montada de metadados | `src/telas/catalogos.ts` |
| como os campos condicionais saem do dado | `src/telas/processo.ts` (cabeçalho do arquivo) |
| o diagnóstico do estado anterior | `ANALISE-MIGRACAO.md` |
