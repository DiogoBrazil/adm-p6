# ADM-P6 — guia de continuidade da migração

> Estado da remodelagem do banco, do backend e do frontend do **ADM-P6**
> (Seção de Justiça e Disciplina do 7º BPM), na migração Python/Eel → Rust/Tauri.
>
> Este arquivo é a fonte de verdade para retomar o trabalho. Leia as seções 1 a 4
> antes de mudar qualquer coisa; a seção 8 diz exatamente o que fazer a seguir.

> ## ▶ POR ONDE RETOMAR
>
> Os itens **8.1 a 8.4 estão concluídos**: o frontend não tem mais chamada não tipada,
> os módulos têm teste, todo SQL é validado contra o schema e a composição repetida
> virou uma view.
>
> **O próximo passo é a seção 8.5 — a importação dos 128 processos de produção.** Ela
> está *totalmente especificada*: decisões fechadas (seção 2, linhas 13 a 16), fatos do
> dump verificados (seção 4), mapeamento coluna a coluna, as oito etapas, o script da
> primeira delas por inteiro e os comandos para rodar.
>
> **Antes de escrever qualquer coisa, decida os dois bloqueios** descritos no começo da
> 8.5 — os dois derrubam a transação inteira no meio, e os dois foram medidos no dump:
> as prorrogações que começam no dia do vencimento anterior (97/97) e as que não têm
> motivo (58/97).

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
| Migrations | 4 (eram 32) |
| Tabelas · FKs · CHECKs · EXCLUDEs · triggers | 44 · 57 · 24 · 2 · 2 |
| Comandos Tauri | 75 (eram 146) |
| Backend Rust | 6.909 linhas (eram 9.194) |
| Testes de integração | **84** (eram 0) |
| Frontend | 5.072 linhas em 16 arquivos (era 1 arquivo de 2.124) |
| Comandos que o frontend invoca e não existem | **0** (eram 87) |
| Chamadas fora do cliente tipado | **0** (eram 118) |

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
| **97/97 prorrogações começam NO dia do vencimento anterior** | o `EXCLUDE` do schema novo usa intervalo fechado `[]` e as recusaria — **bloqueio, ver 8.5** |
| **58 das 97 prorrogações não têm motivo** | `ck_prazo_motivo` exige motivo quando `ordem >= 1` — **bloqueio, ver 8.5** |
| `data_vencimento == data_inicio + dias_adicionados` em 141/141, e `dias > 0` em 141/141 | a coluna gerada reproduz o histórico exatamente |
| `ativo = true` no prazo coincide com a maior `ordem` em 44/44 processos | a vigência derivada da `ordem` reproduz o legado |

---

## 5. O que está PRONTO

### 5.1 Migrations — `src-tauri/migrations/`

| Arquivo | Linhas | Conteúdo |
|---|---:|---|
| `0001_schema.sql` | 1.127 | `btree_gist` → catálogos → pessoas → núcleo → filhas → sistema → índices → triggers. Comentado por seção, explicando o *porquê* de cada decisão. |
| `0002_seed_admin.sql` | 29 | **só** um perfil administrativo + uma conta. Nenhum policial fictício. |
| `0004_view_processos_detalhados.sql` | 130 | `v_processos_detalhados`: catálogos resolvidos + as três derivações que o schema não guarda como coluna. Ver 8.4. |
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

### 5.5 Backend Rust — 11 módulos, 75 comandos

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
| `maps_reports` | escopos de relatório vêm por parâmetro (`apuratorio_ids`, `papel_ids`, ano), não por `IN ('IPM','SR','SV')` |
| `files` | **novo.** Um comando: abre o diálogo nativo de "salvar como" e grava. Existe porque `<a download>` não define destino no WebView, e porque a tela não precisa poder escrever em caminho arbitrário |

**Segurança:** as 13 escritas que rodavam só com `require_session` agora exigem
`require_admin`. Há trava do último administrador, no backend e dentro da transação.

### 5.6 Frontend — migração fechada

```
src/
  api.ts            269   cliente tipado: mapa `Commands` com os 75 comandos
  types.ts          859   interfaces derivadas de src-tauri/src/*/domain.rs
  dom.ts            147   escape, tabela, exportação (CSV e impressão)
  main.ts           272   shell, sessão, menu e roteamento — e nada mais
  telas/
    catalogos.ts    371   os 26 catálogos, gerada de legal_catalogs_definitions
    apuratorio.ts   336   configuração de documentos iniciadores e papéis
    processo.ts     919   lista, formulário completo e detalhe
    indicios.ts     315   enquadramento por envolvido
    usuarios.ts     356   lista, formulário (militar + conta) e detalhe
    mapas.ts        300   mapa do período e mapas salvos
    estatisticas.ts 264   /estatisticas/processos e /stats/procedimentos
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

**Como um arquivo é entregue ao usuário:** `dom.ts::baixarCsv` →
`files_save_download`. Não é `<a download>` com blob — no WebView do Tauri essa
via não define destino, não abre "salvar como" e varia por plataforma. O
diálogo é aberto no Rust, que também grava; a tela nunca recebe um caminho.

### 5.7 Rede de proteção — 84 testes

| Arquivo | O que cobre |
|---|---|
| `util/mod.rs` | cria banco descartável, aplica migrations, remove ao final mesmo com pânico |
| `util/fixtures.rs` | `mundo_configurado()`: monta a cadeia inteira até um apuratório configurado. **Base de todo teste que toque em processo** |
| `migrations.rs` | **2 testes** — o contrato de 32 colunas de `v_processos_detalhados`, e que a antiga `v_processos` não voltou; migrations aplicam do zero **e são idempotentes**; tabelas extintas não ressuscitam; nenhuma FK sem `ON DELETE`; JSONB só nas 2 colunas justificadas; **a fronteira do seed** (11 catálogos legais com contagem exata, 17 operacionais vazios) |
| `schema_integrity.sql` + `.rs` | 38 asserções: estados impossíveis que o banco recusa + controles que ele deve aceitar |
| `auth_login.rs` | admin do seed autentica; busca case-insensitive; conta desativada não entra |
| `users_repository.rs` | **5 testes** — policial com e sem conta; normalização; retirar acesso desativa; listagem que pagina, busca e ordena pela hierarquia; as duas listas de processos do militar |
| `proceedings_repository.rs` | **18 testes** — criação completa, prazo inicial vindo da configuração, edição, as 6 validações semânticas, limites configuráveis, FK composta de papel, numeração parcial, substituição de designação, os 8 filtros, anexos, ciclo de vida, dashboard, catálogo desativado |
| `apuratorio_config.rs` | 3 testes — troca de padrão e de responsável sem violar os índices únicos parciais; desativação preserva processos existentes |
| `deadlines_repository.rs` | 3 testes — `dias_base` com e sem override; prorrogação encostando no vencimento; motivo obrigatório |
| `maps_reports_repository.rs` | **10 testes** — o mapa salvo como snapshot imutável; a regra do período do mapa; escopo vazio = todos; situação por apuratório; esfera penal escolhida no vínculo; catálogo desativado continua contando; matriz de designações por papel; sugerida × decidida; categorias de indício |
| `evidence_repository.rs` | **10 testes** — gravação substitui o enquadramento inteiro; esfera penal do vínculo; analogia do RDPM obrigatória; `indica_ausencia` lida do atributo, não do nome; lista de opções filtra `ativo` e leitura de registro não; painel na ordem dos envolvidos |
| `movements_repository.rs` | **7 testes** — o autor como FK; tipo opcional; ordem do mais recente; cancelamento datado, e o par (processo, andamento) obrigatório |
| `audit_repository.rs` | **7 testes** — o autor é uma conta, e a conta técnica não inventa militar; o diff de `alteracoes`; os três filtros; total do escopo na paginação; período nas estatísticas |
| `legal_catalogs_repository.rs` | **9 testes** — os 26 catálogos do registro leem de verdade e toda referência aponta para catálogo existente; cada tipo de coluna é lido como declara; item em uso desativa e não apaga; a busca recusa campo fora do registro |
| `commands_ipc.rs` | **6 testes** — os comandos pelo IPC real, sobre o `MockRuntime`: guards, as duas convenções de argumento e o envelope `ApiResponse` |
| `sql_prepare.rs` | **2 testes** — as 88 consultas literais são analisadas pelo PostgreSQL, extraídas do próprio código-fonte; e as 40 dinâmicas precisam ter um teste que as execute, conferido nos dois sentidos |

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
cargo test                           # 84 testes, bancos descartáveis
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
   processo, e a tela avisa. É também o que faz as colunas aparecerem em *Designações por
   Militar* e nos painéis de *Estatísticas de Procedimentos*
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

**O que sobra do item original:** a escolha da analogia RDPM em `telas/indicios.ts` ainda
usa `prompt()`. Funciona e respeita a regra, mas merece um seletor de verdade — as três
buscas de enquadramento (`evidence_search_*`) já existem para isso.

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

### 8.5 Importação dos dados de produção — **PRÓXIMO PASSO**

Estado: **não iniciada**, mas totalmente especificada. As decisões estão fechadas (linhas 13
a 16 da seção 2) e os fatos do dump foram verificados um a um (seção 4). O que falta é
escrever e rodar o script.

#### O que entra

| | |
|---:|:---|
| 128 | processos e procedimentos, de 2018 a 2026 |
| 236 | policiais militares — **7** com conta de acesso |
| 156 | envolvidos, **mais 37 criados** dos processos que os guardavam em coluna (decisão 14) |
| 141 | prazos — 44 iniciais e 97 prorrogações |
| 19 | substituições de encarregado → `processo_designacoes` |
| 64 | andamentos, de 2 autores, ambos identificáveis |
| 22 | registros de indício → 12 crimes, 11 transgressões do RDPM, 3 do art. 29 |
| 1 | PDF (41 MB), de um único processo |

**Não entra:** os 107 mapas salvos e as 448 linhas de auditoria (decisão 16). E as colunas
mortas: `natureza_processo` (0/128), `solucao_final` (0/128), `indicios_categorias` (todas
vazias).

---

#### DOIS BLOQUEIOS QUE PRECISAM DE DECISÃO ANTES DE RODAR

Ambos foram medidos no dump, e ambos derrubam a transação inteira no meio.

**Bloqueio 1 — as prorrogações começam no dia do vencimento anterior.**

`ex_prazo_sobreposicao` usa `daterange(data_inicio, data_inicio + dias, '[]')` — intervalo
**fechado nas duas pontas**. No legado, **97 de 97** prorrogações começam exatamente no dia
em que o prazo anterior vence. Sob `[]`, os dois intervalos compartilham esse dia e o
PostgreSQL recusa.

> Exemplo real: o processo `f430289a…` tem a 4ª prorrogação começando em 2024-09-26,
> mesmo dia em que a 3ª vence.

Não é um defeito do dado: é uma **convenção de domínio diferente** da que o schema novo
adotou. O teste `prorrogacao_comeca_no_dia_seguinte_ao_vencimento_anterior` fixou "o dia
seguinte"; a Seção sempre praticou "no mesmo dia".

| Saída | O que custa |
|---|---|
| **A — deslocar as datas em +1 dia na importação** | Reescreve 97 vencimentos registrados. Viola o princípio 5 ("configuração não reescreve fatos"). **Não recomendo.** |
| **B — trocar o `EXCLUDE` para `[)`** | Uma migration de uma linha. Mas muda o sentido de `data_vencimento`: deixaria de ser o último dia válido. **Não recomendo.** |
| **C — comparar `[data_inicio, data_inicio + dias)` no `EXCLUDE`, mantendo `data_vencimento` como está** | O intervalo de *ocupação* passa a excluir o dia do vencimento, que é justamente o dia em que a prorrogação é concedida. `data_vencimento` continua sendo o último dia válido do prazo. **É a que reflete a prática.** |

Se for a C, a migration `0005` altera só a constraint, e o teste
`prorrogacao_comeca_no_dia_seguinte_ao_vencimento_anterior` passa a admitir também o mesmo
dia.

**Bloqueio 2 — 58 das 97 prorrogações não têm motivo.**

`ck_prazo_motivo` exige `motivo` não vazio quando `ordem >= 1`. Saídas: preencher com um
texto único e reconhecível (`'Motivo não registrado no sistema anterior'`), ou relaxar o
CHECK para valer só em registros novos. A primeira é honesta e não mexe no schema — o texto
diz exatamente o que aconteceu.

---

#### Onde o script mora e como se roda

**SQL, não um binário Rust.** O trabalho é mapeamento de conjuntos, o PostgreSQL lê os JSON
do legado nativamente (`jsonb_array_elements`), e não sobra código descartável no
repositório. O dump legado é restaurado num **schema separado do mesmo banco**, e o script
faz `INSERT ... SELECT` cruzando os dois.

O script **não é uma migration**: é um roteiro de uso único, que vive em
`src-tauri/importacao/` e não é aplicado pelo `sqlx::migrate!`.

O dump legado **não pode ser carregado direto num schema `legado`**: ele qualifica tudo com
`public.` e referencia o role `app_user`, que não existe aqui. Trocar `public.` por `legado.`
com `sed` sobre o arquivo arriscaria tocar nos dados. O caminho abaixo foi **testado** e não
mexe em uma linha do dump.

```bash
# ── 1. Banco da aplicação, limpo, com as 4 migrations aplicadas ──────────────
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
  echo "── $etapa"
  docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
      -v ON_ERROR_STOP=1 --single-transaction -q < "$etapa" || break
done

# ── 7. Conferência final ───────────────────────────────────────────────────
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
    < src-tauri/importacao/99_conferencia.sql

# ── 8. Só depois de tudo conferido, o legado sai ───────────────────────────
docker compose exec -T postgres psql -U adm_p6_user -d adm_p6_db \
    -c "DROP SCHEMA legado CASCADE;"
docker compose exec -T postgres psql -U adm_p6_user -d postgres \
    -c "DROP DATABASE adm_p6_legado;"
```

**Cada etapa é um arquivo e uma transação.** Se a 04 falhar, as três primeiras já estão
gravadas e você corrige só a 04 — em vez de recomeçar do zero a cada tentativa. É o que
permite ir verificando de forma granular, que foi o pedido.

---

#### As oito etapas, na ordem que as FKs impõem

| # | Arquivo | O que faz | Confere com |
|---|---|---|---|
| 01 | `01_catalogos.sql` | `tipos_apuratorio`, `apuratorios`, `tipos_documento`, `unidades_pm`, `naturezas_fato`, `status_envolvido`, soluções, penalidades, `papeis_processo`, `tipos_andamento`, `categorias_indicio` | 2 · 10 · 3 · 4 · **16** · 4 · 3 · 5 · 5 |
| 02 | `02_config_apuratorio.sql` | `apuratorio_documentos_iniciadores` e `apuratorio_papeis` — **sem isto a FK composta recusa todo processo** | todo par (espécie, documento) observado no dump existe |
| 03 | `03_policiais.sql` | 236 militares; depois as 7 contas | 236 · 7 |
| 04 | `04_processos.sql` | os 128, com os ids do legado preservados | 128, e 0 violação de numeração |
| 05 | `05_envolvidos.sql` | 156 do legado + 37 criados (decisão 14) | **193** envolvidos |
| 06 | `06_designacoes.sql` | encarregado, escrivão, presidente, interrogante + as 19 substituições | ≥ 128 designações |
| 07 | `07_prazos_andamentos.sql` | 141 prazos e 64 andamentos | 141 · 64 |
| 08 | `08_enquadramentos_anexos.sql` | indícios, crimes, RDPM, art. 29, e o único PDF | 12 · 11 · 3 · 1 |

---

#### O mapeamento, coluna a coluna

**Catálogos (etapa 01).** Tudo sai de `DISTINCT` do próprio dump — nenhuma lista escrita à
mão:

| Catálogo novo | Vem de | Observação |
|---|---|---|
| `tipos_apuratorio` | `DISTINCT tipo_geral` | exatamente 2: `procedimento`, `processo` |
| `apuratorios` | `DISTINCT (tipo_geral, tipo_detalhe)` | `max_envolvidos = NULL` se procedimento, `1` se processo (decisão 13) |
| `tipos_documento` | `DISTINCT documento_iniciador` | Portaria, Memorando Disciplinar, Feito Preliminar |
| `unidades_pm` | `DISTINCT local_origem` | 7ºBPM, CORREGEPOM, 9ºBPM, 11ºBPM (decisão 15) |
| `naturezas_fato` | `DISTINCT natureza_procedimento` | **16** (os outros 40 processos não têm rubrica); `exige_condutor = true` nas 2 de sinistro |
| `status_envolvido` | `DISTINCT status_pm` ∪ o das linhas de envolvido | Sindicado, Acusado, Indiciado, Investigado |
| `tipos_solucao_decidida` | `solucao_tipo` sem prefixo `Sugerido_` | Homologado, Punido, Arquivado, Absolvido, Avocado — `permite_penalidade` só em Punido |
| `tipos_solucao_sugerida` | `solucao_tipo` com prefixo `Sugerido_` | 3 |
| `tipos_penalidade` | `DISTINCT penalidade_tipo` | `usa_quantidade_dias` em Prisão e Detenção |
| `papeis_processo` | as colunas de papel | Encarregado, Escrivão, Presidente, Interrogante |

**Processo (etapa 04).** As três colunas de número do legado eram o mesmo conceito
(verificado: `numero == numero_portaria` em 88/89, `numero_memorando` 32/32, `numero_feito`
7/7):

| Novo | Legado |
|---|---|
| `id` | `id` — **preservado**, é o que faz as etapas seguintes casarem sem reconsultar |
| `apuratorio_id` | resolve `tipo_detalhe` no catálogo criado na etapa 01 |
| `documento_iniciador_id` | resolve `documento_iniciador` |
| `numero_documento` | `numero` |
| `numero_controle` | `numero_controle` (é conceito distinto: difere de `numero` em 5 linhas) |
| `unidade_origem_id` | resolve `local_origem` |
| `municipio_fato_id` | resolve `local_fatos` — os UUIDs de município **foram preservados na 0003** |
| `natureza_fato_id` | resolve `natureza_procedimento` (88 de 128 preenchidos) |
| `data_conclusao` | `data_conclusao` — a coluna `concluido` é descartada (coincidem 128/128) |
| `processo_sei`, `numero_rgf`, `resumo_fatos`, `data_*`, `ativo` | diretos |

Os 3 CPs (Carta Precatória) ganham também uma linha em `carta_precatoria_detalhes`, com
`unidade_deprecada` e `deprecante`.

**Envolvidos (etapa 05).** Duas fontes, unidas:

```sql
-- (a) os 156 registrados na tabela do legado
SELECT procedimento_id, pm_id, status_pm, ordem  FROM legado.procedimento_pms_envolvidos
UNION ALL
-- (b) os 37 que o legado guardava em coluna do processo (decisão 14)
SELECT p.id, p.nome_pm_id, p.status_pm, 1
  FROM legado.processos_procedimentos p
 WHERE NOT EXISTS (SELECT 1 FROM legado.procedimento_pms_envolvidos e
                    WHERE e.procedimento_id = p.id)
```

Sobre esses envolvidos vão ainda:
- `solucao_sugerida_id` / `solucao_decidida_id` — de `solucao_tipo`, conforme o prefixo;
- `penalidade_tipo_id` e `penalidade_dias` — de `penalidade_tipo` / `penalidade_dias`;
- `e_condutor = true` onde `motorista_id = pm_id` (15 casos, todos entre os envolvidos).

**Vítimas e inquiridos → `processo_pessoas`.** `nome_vitima` é array JSON em **71 dos 87**
preenchidos; os outros 16 são texto simples. `pessoas_inquiridas` são 3 registros, JSON
dentro de coluna `TEXT`.

**Designações (etapa 06).** As quatro colunas de papel viram linhas, e o `historico_encarregados`
fecha o período do antecessor:

| Coluna do legado | Papel |
|---|---|
| `responsavel_id` | Encarregado (procedimento) ou Presidente (processo) — depende de `tipo_geral` |
| `escrivao_id`, `escrivao_processo_id` | Escrivão |
| `presidente_id` | Presidente |
| `interrogante_id` | Interrogante |

Nas 19 substituições: `data_fim` do antecessor = `data_substituicao` = `data_inicio` do
sucessor (decisão 6, intervalo `[)`).

**Prazos (etapa 07).** `ordem = COALESCE(ordem_prorrogacao, 0)`, `dias = dias_adicionados`.
A coluna `data_vencimento` do schema novo é **gerada** e reproduz o legado exatamente
(verificado 141/141). A coluna `ativo` do legado é descartada: a vigência passa a ser
derivada da maior `ordem`, e as duas coincidem em 44/44.

**Andamentos (etapa 07).** De `andamentos` jsonb:

```sql
INSERT INTO processo_andamentos (processo_id, descricao, ocorrido_em, registrado_por_id)
SELECT p.id,
       a->>'texto',
       (a->>'data')::timestamptz,
       u.id                      -- casado por nome; os 2 autores casam
  FROM legado.processos_procedimentos p
  CROSS JOIN LATERAL jsonb_array_elements(p.andamentos) a
  LEFT JOIN policiais_militares pm ON pm.nome = a->>'usuario'
  LEFT JOIN usuarios u            ON u.policial_militar_id = pm.id;
```

**Enquadramentos (etapa 08).** As cinco tabelas do legado viram três. A esfera penal de
`pm_envolvido_crimes` sai do `dispositivo_legal` do artigo (Código Penal Militar → Militar;
Código Penal e LCP → Comum) — é a única inferência da importação, e vale registrar que
depois disso a esfera passa a ser escolhida no vínculo (decisão 4). As categorias de indício
saem de `pm_envolvido_indicios.categorias_indicios`, que tem 6 combinações distintas.

---

#### Exemplo: a etapa 01, por inteiro

Serve de molde para as outras sete — resolução por `DISTINCT`, id do legado preservado onde
existe, e nenhuma sigla escrita à mão. **Este script foi executado contra o dump real**: as
contagens ao final da seção são as que ele produziu, e a decisão 13 saiu correta
(CP/FP/IPM/SR/SV sem limite; CD/CJ/PAD/PADE/PADS com 1).

```sql
-- src-tauri/importacao/01_catalogos.sql
-- Catálogos operacionais, derivados do próprio dump. Roda em transação única.
BEGIN;

-- Os dois tipos, direto do que o legado já classificava.
INSERT INTO tipos_apuratorio (nome)
SELECT DISTINCT initcap(tipo_geral) FROM legado.processos_procedimentos
ON CONFLICT DO NOTHING;

-- Uma espécie por (tipo_geral, tipo_detalhe). `max_envolvidos` vem do TIPO
-- (decisão 13): procedimento sem limite, processo com 1.
INSERT INTO apuratorios (sigla, nome, tipo_apuratorio_id, prazo_base_dias,
                         max_envolvidos, exige_natureza_fato)
SELECT DISTINCT
       l.tipo_detalhe,
       l.tipo_detalhe,                       -- nome por extenso: revisar depois na tela
       ta.id,
       30,                                   -- prazo base: revisar por espécie
       CASE WHEN l.tipo_geral = 'processo' THEN 1 ELSE NULL END,
       (l.tipo_geral = 'procedimento')       -- procedimento apura fato: exige natureza
  FROM legado.processos_procedimentos l
  JOIN tipos_apuratorio ta ON lower(ta.nome) = lower(l.tipo_geral)
ON CONFLICT DO NOTHING;

INSERT INTO tipos_documento (nome)
SELECT DISTINCT documento_iniciador FROM legado.processos_procedimentos
 WHERE documento_iniciador IS NOT NULL
ON CONFLICT DO NOTHING;

-- Unidades (decisão 15). O município é o do 7ºBPM; ajustar se divergir.
INSERT INTO unidades_pm (nome, municipio_id)
SELECT DISTINCT l.local_origem,
       (SELECT id FROM municipios_distritos WHERE nome ILIKE 'Ji-Paran%' LIMIT 1)
  FROM legado.processos_procedimentos l
 WHERE l.local_origem IS NOT NULL
ON CONFLICT DO NOTHING;

-- Rubrica do fato. `exige_condutor` marca as de sinistro — o atributo semântico
-- que substituiu o `natureza.includes('sinistro de trânsito')` do legado.
INSERT INTO naturezas_fato (nome, exige_condutor)
SELECT DISTINCT natureza_procedimento,
       natureza_procedimento ILIKE '%sinistro de tr_nsito%'
  FROM legado.processos_procedimentos
 WHERE natureza_procedimento IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO status_envolvido (nome)
SELECT DISTINCT status_pm FROM legado.procedimento_pms_envolvidos WHERE status_pm IS NOT NULL
UNION
SELECT DISTINCT status_pm FROM legado.processos_procedimentos     WHERE status_pm IS NOT NULL
ON CONFLICT DO NOTHING;

-- Solução: o prefixo `Sugerido_` separa os dois catálogos (decisão 3).
INSERT INTO tipos_solucao_sugerida (nome)
SELECT DISTINCT replace(substr(solucao_tipo, 10), '_', ' ')
  FROM legado.processos_procedimentos WHERE solucao_tipo LIKE 'Sugerido\_%'
ON CONFLICT DO NOTHING;

INSERT INTO tipos_solucao_decidida (nome, permite_penalidade)
SELECT DISTINCT solucao_tipo, solucao_tipo = 'Punido'
  FROM legado.processos_procedimentos
 WHERE solucao_tipo IS NOT NULL AND solucao_tipo NOT LIKE 'Sugerido\_%'
ON CONFLICT DO NOTHING;

-- `usa_quantidade_dias` só onde o legado registrou dias.
INSERT INTO tipos_penalidade (nome, usa_quantidade_dias)
SELECT replace(penalidade_tipo, '_', ' '),
       bool_or(penalidade_dias IS NOT NULL)
  FROM legado.processos_procedimentos
 WHERE penalidade_tipo IS NOT NULL
 GROUP BY penalidade_tipo
ON CONFLICT DO NOTHING;

COMMIT;
```

Conferência da etapa:

```sql
SELECT 'tipos_apuratorio' t, count(*) FROM tipos_apuratorio       -- 2
UNION ALL SELECT 'apuratorios',  count(*) FROM apuratorios         -- 10
UNION ALL SELECT 'tipos_documento', count(*) FROM tipos_documento  -- 3
UNION ALL SELECT 'unidades_pm', count(*) FROM unidades_pm          -- 4
UNION ALL SELECT 'naturezas_fato', count(*) FROM naturezas_fato    -- 16
UNION ALL SELECT 'status_envolvido', count(*) FROM status_envolvido; -- 4
```

---

#### Como se sabe que deu certo

**Contagens** (`99_conferencia.sql`): 128 processos · 193 envolvidos · 141 prazos ·
64 andamentos · 236 militares · 7 contas · 12 crimes · 11 transgressões · 3 do art. 29.

**Invariantes**, que valem mais que as contagens:

```sql
-- Nenhum processo perdeu espécie, unidade ou natureza na tradução
SELECT count(*) FROM processos_procedimentos p
  JOIN legado.processos_procedimentos l ON l.id = p.id
  JOIN apuratorios a ON a.id = p.apuratorio_id
  JOIN unidades_pm u ON u.id = p.unidade_origem_id
 WHERE a.sigla <> l.tipo_detalhe OR u.nome <> l.local_origem;   -- espera 0

-- Todo processo tem responsável, e todo envolvido tem status
SELECT count(*) FROM v_processos_detalhados WHERE responsavel_nome IS NULL;  -- espera 0

-- As 7 penalidades e as 13 soluções dos 37 sobreviveram (decisão 14)
SELECT count(*) FROM processo_envolvidos WHERE penalidade_tipo_id IS NOT NULL;  -- espera 7+
```

**Amostra manual:** abrir cinco processos na tela e comparar campo a campo com o legado —
de preferência o IPM com 9 envolvidos, um PADS com penalidade, o processo com PDF, uma CP e
um dos que têm 8 prorrogações.

**Um teste automatizado** vale a pena, no formato dos outros: carrega um recorte do dump num
banco descartável, roda as oito etapas e afirma as contagens e invariantes acima.

---

#### Depois da importação, uma regra muda

Com dado real dentro, **acaba o `docker compose down -v`**. A partir daí toda mudança de
schema é migration incremental, e editar um `.sql` já aplicado passa a ser erro — o
`sqlx::migrate!` guarda checksum por versão. Ver a seção 7.

### 8.6 Higiene — **baixa**

- `README.md` ainda descreve venv, `pip install`, Alembic e PyInstaller.
- `CLAUDE.md` descreve o framework "reversa", descontinuado.
- `tauri.conf.json` tem `"csp": null`. **A escapagem já está completa**: nenhum arquivo
  interpola dado de backend sem `escapeHtml`, e as quatro interpolações cruas que sobram
  no `main.ts` são markup montado ali mesmo. Ligar a CSP virou uma linha de configuração —
  falta só testar que nada no app depende de `unsafe-inline`.
- A escolha da analogia RDPM em `telas/indicios.ts` usa `prompt()`. Funciona e respeita a
  regra, mas merece um seletor de verdade.
- `capabilities/default.json` concede `dialog:default`, que inclui `allow-open` e
  `allow-message` além do `allow-save` que o app usa. Estreitar para
  `["dialog:allow-save"]` quando alguém encostar no arquivo.

---

## 9. Pontos a reavaliar (registrados, não bloqueantes)

**Solução decidida: por envolvido ou por processo? — RESOLVIDO.**
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
| `<a download>` para entregar arquivo | No WebView não define destino nem abre "salvar como", e muda por plataforma | `dom.ts::baixarCsv` → `files_save_download`, que abre o diálogo nativo no Rust |

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
| o roteiro da importação, etapa por etapa | seção **8.5** deste arquivo |
| o diagnóstico do estado anterior | `ANALISE-MIGRACAO.md` |
