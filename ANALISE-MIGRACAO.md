# Raio-X da Migração adm-p6

> Análise do estado da migração de **Python/Eel → Rust/Tauri**, do modelo de dados
> remodelado, e da migração dos dados de produção.

| | |
|---|---|
| **Branch analisada** | `migrate_to_rust_with_tauri` |
| **Branch legada** | `upload_pdf_to_procedure` (consulta pontual) |
| **Data da análise** | 20/08/2026 |
| **SGBD** | PostgreSQL 16 |
| **Método** | 32 migrations aplicadas em banco limpo · 219 queries SQL validadas por `PREPARE` contra o schema resultante · dump legado `adm-p6.sql` restaurado e consultado |
| **Escopo** | Somente leitura e análise. Única alteração no repositório: 3 migrations corrigidas (0009, 0014, 0015) para permitir a aplicação em banco vazio. |

### Números

| Métrica | Valor |
|---:|:---|
| Tabelas | 46 |
| Chaves estrangeiras | 111 |
| Comandos Tauri registrados | 146 |
| Queries SQL analisadas | 219 |
| **Queries que não executam** | **62** (28%) |
| **Comandos afetados** | **32** |
| Migrations que sobem do zero | 32/32 |
| Processos reais a migrar | 128 (2018–2026) |

---

## Índice

1. [Resumo executivo](#1-resumo-executivo)
2. [Estrutura do projeto](#2-estrutura-do-projeto)
3. [Arquitetura Rust/Tauri](#3-arquitetura-rusttauri)
4. [Banco de dados](#4-banco-de-dados)
5. [Tabelas](#5-tabelas)
6. [Relacionamentos](#6-relacionamentos)
7. [Regras de negócio](#7-regras-de-negócio)
8. [Migrations e evolução do schema](#8-migrations-e-evolução-do-schema)
9. [Divergências entre banco e código](#9-divergências-entre-banco-e-código)
10. [O legado: código consultado e o banco real](#10-o-legado-código-consultado-e-o-banco-real)
11. [Status da migração](#11-status-da-migração)
12. [Funcionalidades só no Python/Eel](#12-funcionalidades-só-no-pythoneel)
13. [Código e estrutura sem uso](#13-código-e-estrutura-sem-uso)
14. [Pontos incompletos](#14-pontos-incompletos)
15. [Riscos](#15-riscos)
16. [O que está pronto](#16-o-que-está-pronto)
17. [O que falta](#17-o-que-falta)
18. [Próximos passos recomendados](#18-próximos-passos-recomendados)

---

## 1. Resumo executivo

A migração está **bem avançada em superfície e desalinhada no núcleo**. Existe um backend Rust
completo — 9 módulos de domínio, 146 comandos Tauri, 9.194 linhas — sobre um banco PostgreSQL
totalmente remodelado em 32 migrations, com um frontend TypeScript único de 2.124 linhas que roteia
27 telas a partir de tabelas de configuração.

O problema é que o projeto andou em **duas velocidades**. A remodelagem do banco continuou avançando
(migrations 0016 a 0032 renomearam colunas de catálogo, trocaram chaves e reestruturaram a identidade
dos processos), e parte do código acompanhou: `legal_catalogs`, `users`, `evidence` e `movements`
usam os nomes novos. A outra parte não acompanhou: `proceedings`, `deadlines`, `maps_reports` e
`audit` continuam escritos contra o schema de antes da migration 0016.

Isso foi medido de forma objetiva: as 219 consultas SQL do código Rust foram extraídas e submetidas a
`PREPARE` contra o schema real. **62 falham** — 28% do total. Elas cobrem pelo menos 32 comandos,
entre eles listar, abrir, criar e editar procedimento, o dashboard inteiro, prazos vencidos, mapas,
relatórios e a auditoria. Na prática, o cadastro de catálogos funciona e **o fluxo central de
processos não**.

Havia ainda um bloqueio de partida: a cadeia de migrations não subia do zero. Isso foi **corrigido**
— as 32 migrations agora aplicam limpo em banco vazio e produzem exatamente o mesmo schema final.
Detalhes na seção 8.

### O dump legado muda o peso da decisão

O backup `adm-p6.sql` (44 MB, gerado em 13/05/2026 do banco `app_db` na revisão Alembic
`0006_add_pdf_processos`) é o banco da **aplicação Python em operação**, não o novo. Ele contém
**128 processos reais instaurados entre 2018 e 2026**, 236 militares, 141 prazos, 107 mapas mensais
e 448 registros de auditoria.

Isso transforma a remodelagem de um exercício de schema em uma **migração de dados com perdas
identificáveis**. A boa notícia é que o dump também é a fonte que faltava para semear os catálogos
que hoje nascem vazios. A seção 10 detalha os dois lados.

---

## 2. Estrutura do projeto

A branch não contém mais nenhum arquivo Python: os commits `9449592` e `41058a6` (19/05/2026)
removeram 552 arquivos e 128.621 linhas do sistema Eel. O que restou é um projeto Tauri 2 padrão.

| Caminho | Responsabilidade | Situação |
|---|---|---|
| `src-tauri/src/` | 9 módulos de domínio em Rust, um diretório por área | atual |
| `src-tauri/migrations/` | 32 arquivos `.sql` embarcados via `sqlx::migrate!` | atual |
| `src-tauri/tauri.conf.json` | Janela 1280×800, `frontendDist: ../dist`, CSP desativada | atual |
| `src-tauri/capabilities/` | Uma capability (`core:default`) — nenhum plugin Tauri em uso | atual |
| `src/main.ts` | Frontend inteiro: rotas, CRUD genérico, telas especiais | atual |
| `src/styles.css` | 583 linhas, com regras de impressão | atual |
| `dist/` | Build do Vite **versionado no repositório** | artefato |
| `docker-compose.yml` | Postgres 16, porta 5438, banco `adm_p6_db` | divergente |
| `.env.example` | Aponta para `db_config.py` e Alembic — arquivos que não existem mais | legado |
| `README.md` | Descreve venv, `pip install`, Alembic, PyInstaller e `python main.py` | legado |
| `CLAUDE.md` | Instruções do framework "reversa", descontinuado | legado |
| `src-tauri/gen/` | Schemas de ACL gerados pelo Tauri | gerado |

> **Três nomes de banco em circulação.** `app_state.rs:19` tem `adm_p6_db_normalized` como padrão;
> o `docker-compose.yml` cria `adm_p6_db`; o `.env.example` também diz `adm_p6_db`. Sem um `.env`
> presente, o app tenta conectar num banco que o compose não cria.

---

## 3. Arquitetura Rust/Tauri

Não é Clean Architecture, nem Hexagonal, nem MVC. É uma **arquitetura em camadas organizada por
feature** — cada módulo é uma fatia vertical com três arquivos de papéis fixos:

| Arquivo | Papel |
|---|---|
| `commands.rs` | Fronteira Tauri. Aplica o guard de sessão/admin, valida o request, abre transação, chama o repositório, registra auditoria, faz commit. |
| `domain.rs` | Structs de request/response (`Serialize`/`Deserialize`/`FromRow`) e os métodos `validate()`. É aqui que mora a regra de negócio pura. |
| `repository.rs` | SQL cru via `sqlx::query*` com bind parameters. Nenhum ORM, nenhuma macro checada em tempo de compilação. |

O padrão é consistente em 8 dos 9 módulos. A exceção é `movements`, que não tem `repository.rs` —
seu SQL está inline no `commands.rs`.

### Estado da aplicação

`AppState` guarda três coisas: a `database_url` montada a partir das variáveis `DB_*`, um pool
`PgPool` preguiçoso (máx. 5 conexões, criado na primeira chamada) e **uma única sessão** em
`RwLock<Option<SessionUser>>`. Não há token: o processo inteiro tem um usuário logado por vez, o que
é coerente com um app desktop de instância única.

### Como uma ação atravessa o sistema

```
Tela  (rota em routes[] / crudConfigs[] no main.ts)
  |
  |  call("proceedings_create", { request })
  v
invoke  ->  IPC do Tauri
  |
  v
commands.rs   require_session / require_admin
              request.validate()
              pool.begin()
  |
  v
repository.rs sqlx::query(...).bind(...)   <- SQL cru
  |
  v
PostgreSQL
  ^
  |  audit_repository::register_tx(...)   (mesma transacao)
  |  tx.commit()
  |
ApiResponse { ok, data, error }  ->  JSON  ->  frontend
```

Toda resposta é embrulhada em `ApiResponse<T>`, e o comando devolve `Result<ApiResponse<T>, String>`
— na prática sempre `Ok`, com o erro dentro do envelope. Os erros vêm de `AppError` (5 variantes:
`Database`, `InvalidCredentials`, `Unauthorized`, `Forbidden`, `Domain`) e são convertidos em string
para o frontend.

> **Erro de banco vaza para a tela.** `AppError::Database` formata como
> `"Banco de dados indisponivel: {0}"` concatenando o erro do sqlx. Hoje, com as 62 queries
> quebradas, o usuário vê literalmente `relation "v_processos" does not exist` na interface.

### Frontend

`src/main.ts` é um SPA sem framework. Duas tabelas de configuração governam quase tudo: `routes[]`
(27 rotas, cada uma com o comando de leitura, os comandos de escrita e flags de impressão/busca) e
`crudConfigs{}` (21 formulários declarados por campo). Um punhado de telas foge do genérico e tem
renderizador próprio: dashboard, detalhe de procedimento, painel de indícios, prazos, mapa mensal,
auditoria, estatísticas anuais, lista e detalhe de usuário, estatísticas de procedimentos.

A escrita é liberada por `canWrite()`, que exige `session.is_admin`. É uma trava de *interface*,
não de backend — ver seção 9.

### Dependências

**Rust (`Cargo.toml`)**

- `tauri 2` — sem plugins
- `sqlx 0.8` — postgres, chrono, uuid, json, runtime-tokio-rustls
- `tokio 1` — apenas a feature `sync`
- `serde` / `serde_json`
- `bcrypt 0.16` + `sha2` + `hex` — senhas e upgrade de hash legado
- `thiserror 2`, `uuid 1`, `chrono 0.4`
- `base64 0.22` — PDFs e CSV
- `dotenvy`, `regex`

**Frontend (`package.json`)**

- `@tauri-apps/api ^2` — única dependência de runtime
- `vite ^6` + `typescript ^5.6`
- Sem framework de UI, sem gerenciador de estado, sem biblioteca de componentes
- `node_modules` não está instalado nesta máquina

**Ausências notáveis:** nenhum crate de log (`tracing`, `log`), nenhum crate de PDF, e **nenhum teste**
— zero `#[test]` no projeto.

### Superfície de comandos por módulo

| Módulo | Comandos | Guard predominante | Alinhamento com o schema |
|---|---:|---|---|
| `legal_catalogs` | 68 | admin para escrita, sessão para leitura | alinhado (1 query quebrada) |
| `proceedings` | 20 | sessão; admin só em `form_schema` e `reopen` | **desalinhado** (33 queries) |
| `maps_reports` | 17 | sessão; admin em `delete_saved_map` | **desalinhado** (16 queries) |
| `users` | 11 | admin para escrita | parcial (4 queries) |
| `evidence` | 10 | sessão | alinhado (1 query) |
| `deadlines` | 8 | sessão | parcial (3 queries) |
| `audit` | 5 | admin em todos | parcial (1 query) |
| `movements` | 4 | sessão | alinhado |
| `auth` | 3 | — | alinhado |

---

## 4. Banco de dados

| | |
|---|---|
| **SGBD** | PostgreSQL. Requer **15 ou superior** — a migration 0024 usa `NULLS NOT DISTINCT`. O compose fixa a 16. |
| **Acesso** | sqlx 0.8 com SQL cru. Sem macros checadas em compilação, então nenhum erro de SQL aparece no `cargo build`. |
| **Objetos** | 46 tabelas, 0 views, 0 funções, 0 triggers. |
| **Chaves** | `UUID` com `DEFAULT gen_random_uuid()` em todas as tabelas. Exceção: a PK dos processos é gerada pela aplicação (`Uuid::new_v4()` no Rust). |
| **Exclusão** | Sempre lógica, via coluna `ativo BOOLEAN NOT NULL DEFAULT true`. Nenhum `DELETE` físico no código de domínio. |
| **Datas** | `TIMESTAMP` sem timezone em `created_at`/`updated_at`. A exceção é `pdf_upload_em`, que é `TIMESTAMPTZ`. |
| **JSON** | `jsonb` em andamentos, histórico de encarregados, categorias de indícios e dados de mapa — com índices GIN. |
| **Binários** | PDFs em `bytea` dentro do banco, limite de 100 MB imposto na aplicação. |
| **Integridade** | 111 FKs, **todas sem `ON DELETE` ou `ON UPDATE`** — ou seja, `NO ACTION` em tudo. |

O modelo é uma reescrita completa: o sistema Python tinha **uma** tabela `processos_procedimentos`
com `id TEXT` e campos desnormalizados (`posto_graduacao TEXT`, `local_origem TEXT`,
`documento_iniciador TEXT` com `CHECK` de 3 valores). O modelo atual quebra isso em 10 tabelas por
tipo de apuratório mais 20 tabelas de catálogo.

---

## 5. Tabelas

### 5.1 Núcleo de processo — as 10 tabelas por tipo

Uma tabela por espécie de apuratório. Todas compartilham 27 colunas e diferem apenas nos campos
específicos do rito.

| Tabela | Sigla | Col. | Colunas exclusivas do tipo |
|---|---|---:|---|
| `sindicancia_regular` | SR | 32 | `nome_vitima`, `numero_portaria`, `data_conclusao`, `data_remessa_encarregado`, `indicios_categorias` |
| `sindicancia_verbal` | SV | 32 | idem SR |
| `inquerito_policial_militar` | IPM | 33 | + **`escrivao_id`** (exclusivo) |
| `feito_preliminar` | FP | 31 | **`numero_feito`** (exclusivo), `nome_vitima`, `data_conclusao`, `data_remessa_encarregado` |
| `carta_precatoria` | CP | 32 | **`deprecante`**, **`unidade_deprecada`** (exclusivos); sem `data_conclusao` |
| `processo_apuratorio_disciplinar_sumario` | PADS | 34 | **`numero_memorando`** (exclusivo), `data_julgamento`, `penalidade_dias`, `penalidade_tipo_id`, `indicios_categorias` |
| `processo_apuratorio_dano_herario` | PADE | 32 | `data_julgamento`, `penalidade_tipo_id` — **sem** `penalidade_dias` |
| `processo_administrativo_disciplinar` | PAD | 36 | `presidente_id`, `interrogante_id`, `escrivao_processo_id`, `data_remessa_comissao`, `data_julgamento`, `penalidade_*` |
| `conselho_disciplina` | CD | 36 | idem PAD |
| `conselho_justificacao` | CJ | 36 | idem PAD |

#### Colunas comuns às 10

| Coluna | Tipo | Nulo | Padrão | Significado / chave |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK. Na prática o valor vem do Rust, não do default. |
| `numero` | text | não | — | Número do processo. Unicidade parcial com doc. iniciador e ano. |
| `tipo_geral` | text | não | — | `"processo"` ou `"procedimento"`. **Texto livre, sem FK e sem CHECK.** |
| `tipo_detalhe_id` | uuid | não | — | FK → `apuratorios`. A espécie do apuratório. |
| `documento_iniciador_id` | uuid | não | — | FK → `tipos_documentos`. Portaria, memorando etc. |
| `processo_sei` | text | sim | — | Número do processo no SEI. |
| `responsavel_id` | uuid | sim | — | FK → `usuarios`. O encarregado. |
| `local_origem_id` | uuid | sim | — | Unidade PM de origem. **SEM FK** — ver seção 6. |
| `local_fatos_id` | uuid | sim | — | FK → `municipios_distritos`. Onde os fatos ocorreram. |
| `natureza_processo_id` | uuid | sim | — | **SEM FK.** O código aponta para `natureza_transgressao`. |
| `solucao_tipo_id` | uuid | sim | — | FK → `solucoes_tipo`. Punido, Absolvido, Arquivado… |
| `data_instauracao` | date | sim | — | Indexada. Compõe a unicidade do número (por ano). |
| `data_recebimento` | date | sim | — | Dispara a criação do prazo inicial. |
| `numero_rgf` | text | sim | — | Registro Geral de Fatos. |
| `resumo_fatos` | text | sim | — | Campo de busca textual na listagem. |
| `solucao_final` | text | sim | — | Texto livre da decisão. |
| `andamentos` | jsonb | não | `'[]'` | Índice GIN. **Coexiste com a tabela nova** de andamentos. |
| `historico_encarregados` | jsonb | não | `'[]'` | Índice GIN. Único lugar onde o código grava substituições. |
| `pdf_nome`, `pdf_content_type` | varchar | sim | — | Metadados do anexo. |
| `pdf_tamanho` | bigint | sim | — | Bytes. |
| `pdf_upload_em` | timestamptz | sim | — | Única coluna com timezone no schema. |
| `pdf_arquivo` | bytea | sim | — | O PDF em si. **Coexiste com a tabela nova** de PDFs. |
| `ativo` | bool | não | `true` | Soft delete. Indexado. |
| `concluido` | bool | não | `false` | Indexado. Separa "em andamento" de "concluído". |
| `created_at`, `updated_at` | timestamp | não | `CURRENT_TIMESTAMP` | Atualizados manualmente no SQL — não há trigger. |

### 5.2 Hub de identidade

`historico_processo_procedimentos`

| Coluna | Tipo | Papel |
|---|---|---|
| `id` | uuid | PK surrogate própria. |
| `processo_procedimento_id` | uuid | **UNIQUE.** Recebe o `id` gerado na tabela específica. É o alvo de todas as FKs de processo. |
| `apuratorio_id` | uuid | FK → `apuratorios`. Diz de qual das 10 tabelas o registro veio. |
| `ativo`, `created_at`, `updated_at` | — | Metadados padrão. |

A migration 0027 explica a intenção: antes, o `id` era herdado — a tabela base
`processos_procedimentos` gerava o UUID e as específicas o reusavam como PK com FK de volta. Agora
cada específica tem id próprio e a base virou *registro histórico*: um espelho com
`processo_procedimento_id` único, que existe para dar às tabelas filhas um alvo de FK estável e
não-polimórfico.

### 5.3 Tabelas operacionais

| Tabela | Col. | Finalidade e colunas relevantes | Uso no código |
|---|---:|---|---|
| `prazos_processo` | 15 | Prazo inicial e prorrogações. `data_inicio`, `data_vencimento`, `dias_adicionados`, `ordem_prorrogacao`, `motivo`, `numero_portaria`, `data_portaria`, `autorizado_por` (texto) + `autorizado_tipo_id` (FK). Índice parcial em `data_vencimento WHERE ativo`. | em uso |
| `procedimento_pms_envolvidos` | 6 | PMs envolvidos no apuratório. `ordem` (default 1), `status_pm_id` → `status_envolvido`. É a única tabela do núcleo **sem** `ativo` nem `updated_at`. | em uso |
| `pm_envolvido_indicios` | 8 | Categorias de indício por PM. Guarda `categorias_indicios jsonb` (índice GIN) *e* uma coluna legada `categoria text`. | em uso |
| `andamentos_processo_procedimentos` | 6 | Andamentos normalizados. Criada na 0031. | em uso |
| `historico_encarregados` | 10 | Substituição de encarregado normalizada: substituído, substituto, documento autorizador, data, motivo. Criada na 0028. | **0 usos** |
| `pdf_processo_procedimentos` | 8 | PDFs normalizados em tabela própria. Criada na 0030. | **0 usos** |

### 5.4 Enquadramento — a família `pm_envolvido_*`

Reconstruída inteira na migration 0032. Antes elas penduravam em
`pm_envolvido_indicios.pm_indicios_id`; agora ligam-se direto ao par
`(processo_procedimento_id, envolvido_id)`.

| Tabela | Enquadramento | Colunas de vínculo |
|---|---|---|
| `pm_envolvido_rdpm` | Transgressão disciplinar do RDPM | `transgressao_id` → `transgressoes` |
| `pm_envolvido_art29` | Infração do art. 29 do Estatuto | `infracao_art29_id`, `analogia_art_rdpm_id` |
| `pm_envolvido_art32` | Infração do art. 32 do Estatuto | `infracao_art32_id`, `analogia_art_rdpm_id` |
| `pm_envolvido_crimes_militares` | Crime militar | `crime_id` → `crimes_contravencoes` |
| `pm_envolvido_crimes_comuns` | Crime comum / contravenção | `crime_id` → `crimes_contravencoes` |

Dois detalhes de modelagem relevantes:

- Em art. 29 e art. 32, `analogia_art_rdpm_id` é **NOT NULL** — toda infração estatutária *exige*
  uma transgressão do RDPM por analogia.
- Os dois tipos de crime apontam para a mesma tabela `crimes_contravencoes`; a separação
  militar/comum é feita pela tabela de vínculo escolhida, não por um campo do catálogo.

### 5.5 Pessoas e acesso

`usuarios`

| Coluna | Tipo | Nulo | Observações |
|---|---|---|---|
| `id` | uuid | não | PK. |
| `nome` | text | não | Gravado sempre em maiúsculas. Indexado. |
| `matricula` | text | não | `CHECK`: 9 caracteres e prefixo `1000` ou `3000`. Índice único em `lower(matricula)`. |
| `tipo_usuario_id` | uuid | não | FK → `tipos_usuario`. Derivado do posto, não informado no formulário. |
| `posto_graduacao_id` | uuid | não | FK → `postos_graduacoes`. |
| `perfil_id` | uuid | sim | FK → `perfis_acesso` (`admin` / `comum`). |
| `is_encarregado` | bool | não | Pode presidir apuratórios. Índice parcial `WHERE ativo`. |
| `is_operador` | bool | não | Pode fazer login. Índice parcial `WHERE ativo`. |
| `email` | text | sim | Índice único parcial em `lower(email) WHERE email IS NOT NULL`. |
| `senha` | text | sim | Hash bcrypt. Aceita SHA-256 legado e faz upgrade no login. |
| `ativo` | bool | não | Soft delete. |

O mesmo registro serve para três papéis: PM envolvido, encarregado e operador do sistema. As três
tabelas de apoio são `tipos_usuario` (Oficial, Praça, Outro, Administrador), `postos_graduacoes`
(com `tipo_usuario_id` *nullable*) e `perfis_acesso`.

### 5.6 Catálogos

Vinte tabelas com o mesmo formato: `id`, um campo de nome único, `ativo` e timestamps. A migration
0023 padronizou os nomes de coluna — nada de `nome`/`tipo`/`codigo` genéricos, cada catálogo nomeia
sua própria coluna.

| Tabela | Coluna de nome | Conteúdo e relações | Semeado |
|---|---|---|---:|
| `apuratorios` | `nome_apuratorio` | Espécies de apuratório. FK para `tipo_apuratorios` e `tipos_documentos`; `prazo_base_dias` default 30. | 0 |
| `tipo_apuratorios` | `nome_tipo_apuratorio` | `processo` / `procedimento`. | 2 |
| `tipos_documentos` | `nome_tipo_documento` | Documento iniciador e documento autorizador de prorrogação. | 0 |
| `solucoes_tipo` | `nome_solucao` | Punido, Absolvido, Arquivado, Homologado, Avocado. | 5 |
| `tipos_penalidade` | `nome_penalidade` | Prisão, Detenção, Advertência, Repreensão, Licenciado…, Excluído…, Demitido ex-ofício. | 7 |
| `tipos_prazo` | `nome_prazo` | `inicial`, `prorrogacao`. | 2 |
| `status_envolvido` | `nome_status` | Sindicado, Acusado, Indiciado, Investigado. | 4 |
| `natureza_transgressao` | `nome_natureza` | Leve, Média, Grave. | 3 |
| `artigo_rdpm_natureza_transgressao` | `artigo` | Artigo do RDPM + `natureza_id` (FK, NOT NULL). | 0 |
| `transgressoes` | `inciso` / `texto` | `artigo_id` → artigo RDPM (*nullable*). Único por `(inciso, artigo_id)`. | 0 |
| `dispositivos_legais` | `nome_dispositivo_legal` | Código Penal, LCP, ECA, Lei de Drogas, CTB, CPM. | 6 |
| `subdivisao_textos_normativos` | `nome_subdivisao` | FK → dispositivo legal. Único por `(nome, dispositivo)`. | 0 |
| `crimes_contravencoes` | `artigo` | artigo, descrição, parágrafo, inciso, alínea + `dispositivo_legal_id` (NOT NULL desde a 0024). Único por combinação, com `NULLS NOT DISTINCT`. | 0 |
| `infracoes_estatuto_art29` | `inciso` / `texto` | Art. 29 do Estatuto. Sem `updated_at`. | 0 |
| `infracoes_estatuto_art32` | `inciso` / `texto` | Art. 32 do Estatuto. Sem `updated_at`. | 0 |
| `categoria_indicios` | `nome_indicio` | Criada na 0029. Nunca referenciada. | 0 |
| `municipios_distritos` | `nome_municipio_distrito` | `tipo` + `municipio_pai` auto-referencial. **Sem `updated_at`.** | 0 |
| `locais_origem` | `nome_unidade_pm` | Unidade PM + `cidade_id` (FK, NOT NULL). | 0 |
| `tipos_usuario` | `nome_tipo_usuario` | Praça, Oficial, Outro, Administrador. | 4 |
| `perfis_acesso` | `nome_perfil` | admin, comum. | 2 |

### 5.7 Sistema

| Tabela | Col. | Finalidade |
|---|---:|---|
| `auditoria` | 6 | `tabela`, `registro_id` (text), `operacao`, `usuario_id` (FK), `timestamp`. Cinco índices. Gravada na mesma transação da operação auditada. |
| `mapas_salvos` | 18 | Snapshot de mapa mensal: período, totais, `dados_mapa jsonb` (GIN), autor, e `arquivo_pdf bytea` + `nome_arquivo`. |

---

## 6. Relacionamentos

### A identidade de um processo

```
 10 TABELAS POR TIPO                                        6 TABELAS FILHAS
 +---------------------------+                              +---------------------------+
 | sindicancia_regular       |                              | prazos_processo           |
 |   id (PK)                 |                              +---------------------------+
 +---------------------------+                              | procedimento_pms_envolvidos|
 | inquerito_policial_militar|                              +---------------------------+
 |   id (PK)                 |                              | andamentos_processo_proc. |
 +---------------------------+                              +---------------------------+
 | conselho_disciplina       |                              | pm_envolvido_indicios     |
 |   id (PK)                 |                              +---------------------------+
 +---------------------------+                              | historico_encarregados    |
 ... + 7 outras                                             +---------------------------+
 (SV, FP, CP, PADS, PADE, PAD, CJ)                          | pdf_processo_procedimentos|
              |                                             +---------------------------+
              |  id copiado pela app                                     |
              |  ***SEM FK - nenhuma garantia***                         |
              v                                                          |
      +------------------------------------------+                      |
      | historico_processo_procedimentos          | <--------------------+
      |   id (PK)                                 |   FK -> processo_procedimento_id
      |   processo_procedimento_id   UNIQUE       |
      |   apuratorio_id -> apuratorios            |
      +------------------------------------------+
                          ^
                          |  todas: FK -> processo_procedimento_id  +  FK -> usuarios(id)
    +---------------+-----+-----+---------------+------------------+
    |               |           |               |                  |
 pm_envolvido_   pm_envolvido_ pm_envolvido_  ..._crimes_        ..._crimes_
    rdpm            art29        art32          militares           comuns

 CONSEQUENCIA: apagar a linha especifica nao apaga nada mais.
 O hub nao tem FK de volta para as 10 tabelas (nao pode: o alvo e polimorfico).
 Um DELETE fisico em sindicancia_regular deixa o hub e as 11 tabelas dependentes
 apontando para um processo que nao existe.
```

A identidade de um processo é montada em duas etapas pela aplicação, e a única costura entre a
tabela específica e o hub é código Rust — o banco não a garante.

### Cardinalidades

| Relação | Tipo | Como é feita |
|---|---|---|
| `<tabela de tipo>` ↔ `historico_processo_procedimentos` | 1:1 | **Sem FK.** Garantida só pelo `UNIQUE` do lado do hub e pelo código. |
| hub → `prazos_processo` | 1:N | FK. Um prazo inicial + N prorrogações; só um `ativo` por vez. |
| hub → `procedimento_pms_envolvidos` → `usuarios` | N:N | Tabela associativa com `ordem` e `status_pm_id`. |
| hub → andamentos / pdfs / historico_encarregados | 1:N | FK. |
| `procedimento_pms_envolvidos` → `pm_envolvido_indicios` | 1:N | FK por `pm_envolvido_id`. O código trata como 1:1 (um registro por PM). |
| (hub, `usuarios`) → `pm_envolvido_<enquadramento>` | N:N | Cinco associativas ligando PM envolvido a crimes/transgressões/infrações. |
| `usuarios` → `postos_graduacoes` → `tipos_usuario` | N:1 | `postos_graduacoes.tipo_usuario_id` é *nullable*. |
| `locais_origem` → `municipios_distritos` | N:1 | FK obrigatória. |
| `municipios_distritos` → `municipios_distritos` | 1:N | Auto-referência: distrito aponta para o município pai. |
| `transgressoes` → `artigo_rdpm_natureza_transgressao` → `natureza_transgressao` | N:1 | Cadeia. O elo `artigo_id` é *nullable*. |
| `crimes_contravencoes` → `dispositivos_legais` | N:1 | Obrigatória desde a 0024. |

### Relacionamentos que existem só no código

| Coluna | Alvo pretendido | Por que perdeu a FK |
|---|---|---|
| `<10 tabelas>.local_origem_id` | `locais_origem(id)` | A migration 0013 fez `DROP TABLE locais_origem CASCADE` e recriou a tabela; as 10 FKs caíram junto e nunca foram recriadas. |
| `<10 tabelas>.natureza_processo_id` | `natureza_transgressao(id)` | A 0009 removeu a tabela e a 0016 a recriou com `CASCADE`; as FKs `fk_*_nat_pro` não voltaram. |
| `historico_processo_procedimentos.processo_procedimento_id` | uma das 10 tabelas | Impossível em SQL: o alvo é polimórfico. |
| `<10 tabelas>.tipo_geral` | `tipo_apuratorios(nome)` | Nunca teve. É `TEXT` livre, sem `CHECK`. |
| `auditoria.registro_id` | qualquer tabela | É `TEXT` genérico por natureza — correto para uma trilha de auditoria. |

### Integridade referencial

Nenhuma das 111 FKs declara `ON DELETE` ou `ON UPDATE`: todas são `NO ACTION`. Como o sistema só faz
exclusão lógica, isso *hoje* não gera órfãos — mas também significa que não há nenhuma limpeza
automática, e que qualquer `DELETE` manual em produção quebra o grafo. Vale registrar que a exclusão
lógica **não cascateia**: marcar um processo como `ativo = false` deixa seus prazos, andamentos e
PMs envolvidos com `ativo = true`.

### Índices

- Por tabela de processo: `ativo`, `concluido`, `data_instauracao`, GIN em `andamentos` e
  `historico_encarregados`, e GIN em `indicios_categorias` nas 4 que a possuem.
- Unicidade parcial por tabela de processo:
  `(numero, documento_iniciador_id, EXTRACT(YEAR FROM data_instauracao)) WHERE data_instauracao IS NOT NULL`.
- `usuarios`: único em `lower(matricula)`; único parcial em `lower(email)`; índice em `nome`;
  parciais em `is_encarregado` e `is_operador` com `WHERE ativo`.
- `prazos_processo`: `processo_id` e parcial em `data_vencimento WHERE ativo` — bem desenhado para a
  consulta de vencidos.
- `auditoria`: cinco índices (tabela, registro, operação, usuário e timestamp DESC).
- GIN em `mapas_salvos.dados_mapa` e `pm_envolvido_indicios.categorias_indicios`.
- **Lacuna:** nenhuma das colunas de FK das tabelas filhas tem índice próprio
  (`procedimento_pms_envolvidos.procedimento_id`, os cinco `pm_envolvido_*`,
  `andamentos.processo_procedimento_id`). Toda leitura de detalhe de processo faz varredura.

---

## 7. Regras de negócio

### Confirmadas pelo código

| Regra | Onde |
|---|---|
| Só faz login quem tem `is_operador = true` *e* `ativo = true`. A busca é por e-mail, case-insensitive. | `auth/repository.rs:5` |
| Senha bcrypt. Se o hash tiver 64 caracteres (SHA-256 do sistema antigo), valida por SHA-256 e **regrava em bcrypt** no mesmo login. | `auth/commands.rs:48` |
| Perfil `admin` ⇒ `is_admin`; qualquer outro valor, inclusive nulo, vira `comum`. | `auth/domain.rs:23` |
| Admin não pode desativar a própria conta nem tirar o próprio perfil admin. | `users/commands.rs:44,68` |
| Matrícula: exatamente 9 caracteres, prefixo `1000` ou `3000`. Validada no Rust *e* por `CHECK` no banco. | `users/domain.rs:56` + `0011` |
| Operador exige e-mail e perfil; na criação, senha de no mínimo 4 caracteres. | `users/domain.rs:66` |
| Nome de usuário é gravado em `UPPER`, e-mail em `lower`. | `users/repository.rs:139` |
| `tipo_usuario_id` não é escolhido: é herdado do posto selecionado. | `users/repository.rs:141` |
| Nome de vítima é normalizado para maiúsculas. | `proceedings/repository.rs:151` |
| Número de processo é único por `(numero, documento_iniciador, tipo_detalhe, local_origem, ano)` — verificado antes de inserir e de atualizar. | `proceedings/commands.rs:71` |
| Datas de instauração e de conclusão não podem ser futuras. | `proceedings/domain.rs:79` |
| Tipo `IPPM` é explicitamente rejeitado. | `proceedings/domain.rs:75` |
| Penalidade só é gravada se `solucao_tipo = 'Punido'`; caso contrário tipo e dias vão a nulo. | `proceedings/repository.rs:153` |
| `penalidade_dias > 0` só é aceito para Prisão ou Detenção. | `proceedings/domain.rs:91` |
| Prazo inicial só nasce se houver `data_recebimento`. Dias: **15** se o documento iniciador for "Feito Preliminar", senão **15** para SV, **40** para IPM, **30** para os demais. | `proceedings/domain.rs:113` |
| Prorrogação: desativa o prazo vigente, o novo começa no dia seguinte ao vencimento anterior e recebe `ordem_prorrogacao` sequencial. Exige motivo e dias > 0. | `deadlines/repository.rs:84` |
| Reabrir processo limpa `data_conclusao` e é exclusivo de admin. | `proceedings/repository.rs:956` |
| Substituir encarregado grava um snapshot `{id, nome, data, justificativa}` no jsonb `historico_encarregados`. | `proceedings/repository.rs:1113` |
| Salvar indícios de um PM **substitui** os vínculos existentes, dentro de uma transação. | `evidence/repository.rs` |
| PDF: máximo 100 MB, recebido em base64. | `proceedings/domain.rs:352` |
| Auditoria é escrita na mesma transação da operação — se a operação falhar, o registro some junto. | `audit/repository.rs` |
| Toda leitura filtra `coalesce(ativo, true) = true`. | todos os repositórios |
| **`apuratorios.nome_apuratorio` contém a sigla** (`SR`, `IPM`, `PADS`…). | Confirmado pelos dados reais — ver 10.3 |

### Apenas inferidas — precisam de confirmação

| Inferência | Base |
|---|---|
| `tipo_geral` deveria ser derivado de `apuratorios → tipo_apuratorios` em vez de vir do formulário. | A informação já existe normalizada; o frontend a envia como texto capitalizado enquanto o dado real é minúsculo. |
| Exclusão lógica não deve cascatear para filhos. | Nenhum código propaga `ativo = false`. Pode ser intencional (preservar histórico) ou omissão. |
| Um PM tem no máximo um registro em `pm_envolvido_indicios`. | O código faz `SELECT … LIMIT 1` e depois `UPDATE` ou `INSERT`. Não há `UNIQUE` no banco garantindo isso. |
| Só pode haver um prazo `ativo` por processo. | É o que o fluxo de prorrogação mantém, mas não há constraint. Um índice único parcial garantiria. |

### Refutada pelos dados

| Inferência anterior | O que os dados mostram |
|---|---|
| ~~`natureza_processo_id` → `natureza_transgressao` (Leve/Média/Grave)~~ | O campo em uso no banco real é `natureza_procedimento`, com rubricas de bem jurídico, não gravidade de transgressão. Ver 10.4. |

---

## 8. Migrations e evolução do schema

| | |
|---|---|
| **Ferramenta** | `sqlx::migrate!("./migrations")` — os `.sql` são embarcados no binário em tempo de compilação. |
| **Momento** | No startup, em `lib.rs:20-25`, antes de `tauri::Builder`. Falha aqui é `.expect()` ⇒ panic, o app não abre. |
| **Ordem** | Pelo prefixo numérico do nome do arquivo: 0001 → 0032. |
| **Controle** | Tabela `_sqlx_migrations`, com **checksum por migration**. Editar um arquivo já aplicado produz `MigrateError::VersionMismatch` no próximo startup. |
| **Transação** | Cada migration roda dentro de uma transação (sqlx 0.8). Nenhuma do projeto usa `-- no-transaction`. |
| **Rollback** | Não existe. Não há arquivos `.down.sql`. |

### O bloqueio que existia — e a correção aplicada

A cadeia **não subia em banco vazio**. A migration 0009 executava:

```sql
DROP TABLE natureza_transgressao;   -- sem CASCADE
```

Naquele ponto a tabela ainda era referenciada por 10 FKs `fk_*_nat_pro` (criadas na 0002) e pela view
`v_processos` (criada na 0005). O PostgreSQL abortava, o `expect()` disparava e o app não subia. Em
cascata, as migrations 0017 e 0024 também falhavam, porque dependiam da coluna
`transgressoes.artigo_id` que a 0009 nunca chegava a criar.

**Correção aplicada — 3 arquivos, 28 linhas:**

- **`0009`** — `DROP TABLE natureza_transgressao CASCADE`, com comentário explicando o que a cascata
  leva junto (as 10 FKs e a view, ambas recriadas depois).
- **`0014` e `0015`** — nas recriações de `v_processos`, o `LEFT JOIN natureza_transgressao` foi
  removido e a coluna `natureza_processo` passou a sair como `NULL::text` — que é o estado
  historicamente correto, já que entre a 0009 e a 0016 essa tabela não existia. A 0021 volta a
  preenchê-la depois que a 0016 recria a tabela.

**Validado:** as 32 migrations aplicam limpo em banco vazio, cada uma na sua transação e parando no
primeiro erro (mesma semântica do sqlx). O schema final resultante é **byte a byte idêntico** ao
schema de referência usado para validar as queries: 46 tabelas, 0 views, 111 FKs.

### Reprodutibilidade

> *"Se eu clonar a branch em outro computador e apagar o banco local, o repositório tem tudo para
> recriar a estrutura?"*

**Sim, agora tem.** Basta `docker compose up -d`, um `.env` com as variáveis `DB_*` (atenção ao nome
do banco, seção 2) e rodar o app: as migrations sobem sozinhas no startup.

O que **não** vem junto são os dados. Um banco recém-criado nasce com 1 usuário
(`admin@sistema.com` / `123456`), 2 postos (`Administrador` e `Outro`), 4 tipos de usuário,
2 perfis, e os catálogos de solução, penalidade, prazo, status, natureza e dispositivo legal
semeados. Vazias ficam `apuratorios`, `tipos_documentos`, `municipios_distritos`, `locais_origem`,
`transgressoes`, `crimes_contravencoes` e os dois artigos do Estatuto — todas obrigatórias para
criar qualquer processo.

> **Duas migrations destrutivas no histórico.** A `0010` faz `TRUNCATE` em `auditoria`, `usuarios`,
> `postos_graduacoes` e `tipos_usuario`, apagando os 13 postos da PMRO que a `0006` tinha semeado
> (SD PM até CEL PM, com `ordem_hierarquica`) e removendo a própria coluna de ordem hierárquica.
> A `0026` faz `DELETE FROM apuratorios`. Em banco de desenvolvimento isso é inofensivo; sobre um
> banco com dados, não.

---

## 9. Divergências entre banco e código

**Método:** extração das 219 consultas SQL dos arquivos `.rs` (raw strings e literais passados a
`sqlx::query*`), substituição dos `format!` dinâmicos por cada tabela candidata, e `PREPARE` de cada
uma contra o schema real. Uma query só conta como quebrada se falhar para *todas* as substituições
possíveis.

| | |
|---:|:---|
| Queries analisadas | 219 |
| **Não executam** | **62** |
| Executam | 157 |
| Comandos afetados | 32 |

### 9.1 Identificadores que não existem mais

| Referência no código | Ocorr. | O que aconteceu | Nome correto hoje |
|---|---:|---|---|
| `v_processos` | 44 | View removida pela migration 0023 | — (não existe substituto) |
| `solucoes_tipo.codigo` | 15 | Renomeada na 0019 | `nome_solucao` |
| `natureza_transgressao.codigo` | 15 | Tabela recriada na 0016 | `nome_natureza` |
| `postos_graduacoes.codigo` | 9 | Removida na 0010, renomeada na 0023 | `nome_posto_graduacao` |
| `status_envolvido.codigo` | 7 | Renomeada na 0020 | `nome_status` |
| `crimes_contravencoes.dispositivo_legal` | 7 | Virou FK na 0007 | `dispositivo_legal_id` → `dispositivos_legais` |
| `pm_envolvido_crimes` | 3 | Tabela substituída na 0032 | `pm_envolvido_crimes_militares` / `_comuns` |
| `*.pm_indicios_id` | 3 | Coluna eliminada na 0032 | `(processo_procedimento_id, envolvido_id)` |
| `tipos_prazo.codigo` | 2 | Renomeada na 0015 | `nome_prazo` |
| `tipos_infracao_penal` | 2 | Tabela removida na 0008 | — (conceito eliminado) |
| `transgressoes.gravidade_id` | 1 | Removida na 0009 | `artigo_id` → `artigo_rdpm_…` |
| `usuarios.posto_graduacao` | 1 | Nunca existiu no schema novo | `JOIN postos_graduacoes` |
| `municipios_distritos.updated_at` | 1 | Coluna nunca criada | — (só existe `created_at`) |

### 9.2 Comandos Tauri que não funcionam

| Comando | Motivo | Impacto na tela |
|---|---|---|
| `proceedings_list` | `v_processos` | A listagem de procedimentos não carrega |
| `proceedings_get` | `v_processos`, `se.codigo`, `tp.codigo` | Detalhe do procedimento não abre |
| `proceedings_create` | `solucoes_tipo.codigo`, `natureza_transgressao.codigo`, `tipos_prazo.codigo`, `v_processos` | Não é possível cadastrar |
| `proceedings_update` | idem | Não é possível editar |
| `proceedings_get_pdf` | `v_processos` | Visualizador de PDF vazio |
| `dashboard_summary` | `v_processos` | Dashboard inteiro |
| `deadlines_upcoming` / `_overdue` / `_report` | `v_processos` | Tela de prazos |
| `audit_list` | `u.posto_graduacao` | Tela de auditoria |
| `users_statistics` | `v_processos`, `se.codigo` | Estatísticas no detalhe do usuário |
| `users_proceedings_responsible` / `_escrivao` / `_involved` | `v_processos` | Abas do detalhe do usuário |
| `evidence_list_for_proceeding` | `pg.codigo`, `se.codigo` | Painel de indícios |
| `legal_catalogs_save_municipio_distrito` | `updated_at` inexistente | Não é possível editar município |
| `reports_*` | `v_processos`, `pg.codigo`, `tp.codigo` | 13 dos 17 comandos de mapas e relatórios |
| `proceedings_pads_solutions`, `_ipm_evidence`, `_sr_evidence`, `_common_crimes`, `_military_crimes`, `_top10_transgressions`, `_in_progress_stats` | `v_processos` e tabelas removidas | Tela de estatísticas de procedimentos |

### 9.3 Divergências de valor, não de estrutura

Estas passam pelo `PREPARE` — o SQL é válido — mas produzem resultado errado silenciosamente.

| Divergência | Efeito |
|---|---|
| O `select` de penalidade no frontend oferece `Prisao, Detencao, Advertencia, Reprimenda` (sem acento) e a validação em `domain.rs:96` aceita só `"Prisao"` / `"Detencao"`. O catálogo tem `Prisão`, `Detenção`, `Advertência`, `Repreensão`. | `(SELECT id FROM tipos_penalidade WHERE nome_penalidade = $x)` nunca casa ⇒ `penalidade_tipo_id` sempre nulo. E `penalidade_dias` nunca é aceito. |
| `tipo_geral` chega como `"Processo"`/`"Procedimento"` (maiúscula) enquanto `tipo_apuratorios` guarda minúsculas. | Filtros por `tipo_geral` em relatórios comparam com `'processo'` minúsculo e não retornam nada. |
| `local_origem`, `local_fatos` e `natureza_processo` são campos de **texto livre** no formulário, mas resolvidos por subselect de nome exato no backend. | Qualquer diferença de digitação grava `NULL` sem erro. E `local_fatos` é validado como obrigatório no Rust mas a coluna aceita nulo. |
| O `INSERT` no hub é `INSERT … SELECT … FROM apuratorios WHERE nome_apuratorio = $2`. | Se a sigla não existir no catálogo, **nenhuma linha é inserida e nenhum erro é levantado**. O processo nasce sem registro de identidade e todas as FKs de filhas passam a falhar. |
| Campo `numero_controle` existe no formulário do frontend. | Não existe no `CreateProceedingRequest` nem no banco. É descartado silenciosamente. |
| `proceedings_form_schema` devolve `admin_only: true`, mas `proceedings_create`, `_update` e `_delete` chamam apenas `require_session`. | A trava é só de interface (`canWrite()`). Um operador comum pode invocar os comandos diretamente. |
| `movements_types` devolve 11 tipos fixos e `evidence_categories` devolve 4 categorias fixas. | Nenhum dos dois consulta o banco. `andamentos_processo_procedimentos` não tem coluna de tipo, e `categoria_indicios` existe mas está vazia e sem uso. |
| `proceedings::insert_initial_deadline` busca `tipos_prazo WHERE codigo = 'inicial'`; o módulo `deadlines` já usa `nome_prazo`. | Dois módulos, duas versões do mesmo catálogo. |

---

## 10. O legado: código consultado e o banco real

### 10.1 O que precisou ser lido no código Python

A branch `upload_pdf_to_procedure` foi consultada de forma pontual, por busca dirigida. Nenhum
arquivo grande foi lido por inteiro.

| Arquivo | Por quê | O que resolveu |
|---|---|---|
| `ANALISE_FUNCOES_EEL.md` | Inventário pronto das 73 funções `@eel.expose` | Base da matriz da seção 11, sem precisar ler o `main.py` |
| `alembic/versions/0001_bootstrap_core_tables.py` | Entender o schema anterior | Confirmou a tabela única `processos_procedimentos` com `id TEXT` |
| `app/routers/processos.py` | Tratamento de PDF | O trio `salvar/obter/remover_pdf_processo` tem equivalente 1:1 no Rust |
| `app/routers/relatorios.py` | Procurar geração de PDF | Achou `gerar_relatorio_anual_pdf`, sem equivalente no Rust |
| `main.py` | Listar funções expostas | Confirmou a lista completa e as sem equivalente |

### 10.2 O banco em produção

O arquivo `adm-p6.sql` foi restaurado em um PostgreSQL 16 descartável e consultado. É um `pg_dump`
do banco `app_db` (owner `app_user`), tirado em **13/05/2026** — um dia depois do primeiro commit em
Rust — na revisão Alembic `0006_add_pdf_processos`. 24 tabelas, 1.562 linhas de dados, 44 MB (quase
tudo em um único PDF de 19,6 MB).

| Tabela legada | Linhas | Natureza | Destino no schema novo |
|---|---:|---|---|
| `processos_procedimentos` | 128 | Operacional, 2018–2026 | Dividir entre as 10 tabelas por tipo + hub |
| `usuarios` | 236 | Operacional | `usuarios` |
| `procedimento_pms_envolvidos` | 156 | Operacional | `procedimento_pms_envolvidos` |
| `prazos_processo` | 141 | Operacional (44 iniciais + 97 prorrogações) | `prazos_processo` |
| `mapas_salvos` | 107 | Operacional, out/2025 a mai/2026 | `mapas_salvos` |
| `auditoria` | 448 | Histórico | `auditoria` |
| `pm_envolvido_indicios` | 22 | Operacional | `pm_envolvido_indicios` |
| `pm_envolvido_crimes` / `_rdpm` / `_art29` | 26 | Operacional | As 5 tabelas `pm_envolvido_*` |
| `municipios_distritos` | 112 | **Catálogo real**: 52 municípios de RO + 60 distritos | `municipios_distritos` |
| `transgressoes` | 95 | **Catálogo real**: art. 15 (16 leves), 16 (40 médias), 17 (39 graves) | `transgressoes` |
| `crimes_contravencoes` | 27 | **Catálogo real**, com `tipo` Crime/Contravenção | `crimes_contravencoes` |
| `infracoes_estatuto_art29` | 23 | **Catálogo real** | `infracoes_estatuto_art29` |
| `postos_graduacoes` | 12 | **Catálogo real**, com `ordem_hierarquica` | `postos_graduacoes` |
| `locais_origem` | 6 | Seed de demonstração (BOPE, ROTAM…), **não usado** | Derivar dos valores reais |
| `tipos_processo` | 6 | Seed de demonstração (PCD, TERMO_CIRCUNSTANCIADO…), **não usado** | Descartar |
| `naturezas` | 8 | Seed de demonstração, **não usado** — mas revela o conceito | Ver 10.4 |
| `status_processo` | 7 | Seed de demonstração com cores, **não usado** | Sem destino |
| `procedimentos_indicios_*` | 0 | Vazias | Descartar |

> **Como distinguir dado real de seed.** Todas as tabelas marcadas como demonstração têm ids
> sequenciais artificiais (`loc001`, `nat001`, `tp001`) e o mesmo `created_at`:
> `2025-08-01 15:44:00`. São o bootstrap inicial do sistema, e o comportamento em produção seguiu
> por outro caminho — os campos correspondentes em `processos_procedimentos` são texto livre e não
> referenciam esses catálogos.

### 10.3 O que os dados reais confirmam

| Questão em aberto | Resposta que os dados dão |
|---|---|
| `apuratorios.nome_apuratorio` deve conter a sigla? | **Sim.** Os 128 processos usam exatamente `SR` (55), `PADS` (32), `IPM` (23), `FP` (7), `SV` (3), `CP` (3), `CD` (2), `CJ` (1), `PAD` (1), `PADE` (1). O mapa `tipo_to_table()` cobre 100% dos dados. |
| Qual o valor real de `tipo_geral`? | **Minúsculo**: `procedimento` (SR, IPM, FP, SV, CP = 91) e `processo` (PADS, CD, CJ, PAD, PADE = 37). O formulário novo envia capitalizado. |
| Quais documentos iniciadores existem? | Apenas três: `Portaria` (89), `Memorando Disciplinar` (32), `Feito Preliminar` (7). É o seed exato de `tipos_documentos`. |
| De onde vêm os 15 dias do Feito Preliminar? | Confirmado como regra real: os 7 FPs usam `documento_iniciador = 'Feito Preliminar'`, coerente com `deadline_days()`. |
| O ranking de motoristas é feature real? | **Sim.** `motorista_id` preenchido em 15 processos, batendo com os 15 de natureza "Sinistro de trânsito com viatura policial militar / veículo oficial". O stub `Ok(vec![])` descarta um relatório com dados. |
| Múltiplas vítimas é feature real? | **Sim.** `nome_vitima` é array JSON em 71 dos 87 preenchidos — ex.: `["ADMINISTRAÇÃO PÚBLICA","PAULO HENRIQUE …"]`. O schema novo tem `TEXT` único. |
| As 4 categorias de indício do Rust estão certas? | **Não.** As reais são "Indícios de transgressão disciplinar" (9), "Não houve indícios" (6), "Indícios de crime comum" (4), "Indícios de crime militar" (3). O Rust codifica `crimes_cpm, transgressoes_rdpm, transgressoes_art29, sem_indicios`. A tabela vazia `categoria_indicios` é exatamente o destino dessas 4 linhas — e a separação comum/militar explica a migration 0032. |
| `status_envolvido` confere? | **Sim, exatamente.** Sindicado (92), Indiciado (44), Investigado (19), Acusado (1) — idêntico ao seed da 0020. |
| A modelagem por tipo perde campos? | **Quase não.** Cruzando campo preenchido × coluna existente nas 10 tabelas, a única perda estrutural é `carta_precatoria.data_conclusao`, que não existe no schema novo e está preenchida em 2 dos 3 CPs. |
| A validação `"Prisao" \| "Detencao"` sem acento é descuido? | **Não — é o dado legado.** Os valores reais são `Detencao` (3), `Prisao` (1), `Repreensao`, `Licenciado_Disciplina`, `Excluido_Disciplina`. Quem divergiu foi o seed do catálogo novo. |

### 10.4 O que os dados reais contradizem

> ### `natureza_processo_id` está apontando para o conceito errado
>
> No banco real, `natureza_processo` está **100% nulo**. Quem é usado é `natureza_procedimento`,
> preenchido em 88 processos, e seus valores são categorias de bem jurídico:
> *"Dos crimes contra a pessoa"* (30), *"Sinistro de trânsito com viatura policial militar"* (13),
> *"Dos crimes contra a administração militar"* (7),
> *"Violência doméstica e familiar contra a mulher (Lei nº 11.340/2006)"* (5),
> *"Abuso de autoridade (Lei nº 13.869/2019)"* (3), e mais uma dezena de rubricas.
>
> O schema novo aponta `natureza_processo_id` para `natureza_transgressao`, que contém
> **Leve / Média / Grave** — a gravidade da transgressão disciplinar, um conceito completamente
> diferente. Não existe no schema novo nenhuma tabela para as ~15 rubricas reais. **São 88 registros
> sem destino**, e é deles que sai a classificação de sinistros de trânsito que alimenta o ranking
> de motoristas.

### 10.5 Campos reais sem destino no schema novo

| Coluna legada | Preench. | Conteúdo | Situação |
|---|---:|---|---|
| `numero_controle` | 128/128 | Numeração de controle interna | **sem destino** — mas o campo ainda existe no formulário novo, órfão |
| `natureza_procedimento` | 88 | Rubrica do fato apurado | **sem destino** — ver 10.4 |
| `nome_vitima` | 71 (array) | Uma ou mais vítimas em JSON | destino menor — `TEXT` único, em 5 das 10 tabelas |
| `status_pm` | 128/128 | Situação do PM principal | parcial — `procedimento_pms_envolvidos.status_pm_id` cobre, mas só 91 processos têm linhas lá |
| `nome_pm_id` | 128/128 | PM principal do processo | parcial — idem |
| `motorista_id` | 15 | Condutor no sinistro | **sem destino** |
| `transgressoes_ids` | 32 | Lista desnormalizada de transgressões | parcial — `pm_envolvido_rdpm` tem só 11 linhas |
| `pessoas_inquiridas` | 3 | Array JSON de inquiridos | **sem destino** |
| `solucao_tipo` | 6 | `Sugerido_Arquivamento` (4), `Sugerido_IPM` (1), `Sugerido_Sindicancia` (1) | **fora do catálogo** — `solucoes_tipo` só tem Punido, Absolvido, Arquivado, Homologado, Avocado |
| `crimes_contravencoes.tipo` | 27/27 | Crime × Contravenção Penal | **removido na 0008** — mas `common_crimes_stats` ainda tenta classificar por ele |
| `postos_graduacoes.ordem_hierarquica` | 12/12 | Ordenação hierárquica (−1 a 10) | **removida na 0010** |
| `carta_precatoria.data_conclusao` | 2/3 | Conclusão da CP | **coluna não existe** na tabela nova |
| `andamentos[].usuario` | 35 proc. | Autor do andamento | **sem destino** — `andamentos_processo_procedimentos` não tem coluna de autor |

### 10.6 Formato dos JSONB legados

O `substitute_responsible` do Rust grava um formato **incompatível** com o que existe no banco real:

```
legado (19 processos)                      Rust atual
{                                          {
  "encarregado_anterior": {                  "id": "<uuid do anterior>",
    "id", "nome",                            "nome": "<nome do anterior>",
    "matricula", "posto_graduacao"           "data_substituicao": "...",
  },                                         "justificativa": "..."
  "novo_encarregado": { ...mesmos campos }, }
  "data_substituicao": "...",
  "justificativa": "..."                    <- perde o substituto, matricula e posto
}
```

A tabela `historico_encarregados` criada na migration 0028 tem exatamente as colunas da estrutura
legada — `encarregado_substituido_id`, `encarregado_substituto_id`, `data_substituicao`,
`motivo_substituicao` — e ainda acrescenta `documento_autorizador_id`. Ou seja: a intenção da 0028
era claramente normalizar esse jsonb, e o código simplesmente não acompanhou.

O `andamentos` legado é `{id, data, texto, usuario}`. A tabela
`andamentos_processo_procedimentos` tem apenas `descricao_andamento` — falta a coluna de autor para
receber os 35 processos com andamentos.

### 10.7 Onde o dump resolve o problema dos catálogos vazios

As tabelas que hoje nascem vazias e bloqueiam a criação de qualquer processo têm origem pronta:

| Catálogo novo (vazio) | Fonte no dump | Linhas |
|---|---|---:|
| `tipos_documentos` | valores distintos de `processos_procedimentos.documento_iniciador` | 3 |
| `apuratorios` | valores distintos de `tipo_detalhe` + o `tipo_geral` correspondente | 10 |
| `municipios_distritos` | `municipios_distritos` | 112 |
| `locais_origem` | valores distintos de `local_origem` (7ºBPM, CORREGEPOM, 9ºBPM, 11ºBPM) | 4 |
| `postos_graduacoes` | `postos_graduacoes` | 12 |
| `artigo_rdpm_natureza_transgressao` | artigos 15/16/17 derivados de `transgressoes.gravidade` | 3 |
| `transgressoes` | `transgressoes` | 95 |
| `crimes_contravencoes` | `crimes_contravencoes` | 27 |
| `infracoes_estatuto_art29` | `infracoes_estatuto_art29` | 23 |
| `categoria_indicios` | valores distintos de `pm_envolvido_indicios.categoria` | 4 |
| `infracoes_estatuto_art32` | — | 0 |

Duas ressalvas na conversão. Primeira: `usuarios.posto_graduacao` era texto livre e traz abreviações
fora do catálogo — `ST PM` (7 militares) e `TC PM` (1) precisam ser mapeadas para `SUB TEN PM` e
`TEN CEL PM`. Segunda: das 236 matrículas, 235 já satisfazem o `CHECK` de 9 caracteres com prefixo
`1000`; a única exceção é o próprio admin.

---

## 11. Status da migração

"Migrado" aqui significa **fluxo completo e executável**: tela, comando, SQL válido contra o schema
atual. Um comando existir não basta.

| Funcionalidade | Python/Eel | Rust/Tauri | Tabelas | Situação |
|---|---|---|---|---|
| Login e sessão | sim | sim | `usuarios`, `perfis_acesso` | **Migrado** |
| CRUD de usuários | sim | sim | `usuarios`, `postos_graduacoes` | **Migrado** |
| Estatísticas e processos do usuário | sim | quebrado | `v_processos` | Pendente |
| Catálogos jurídicos (crimes, RDPM, art. 29/32, dispositivos) | parcial | sim, ampliado | `crimes_contravencoes`, `transgressoes`, `infracoes_*` | **Migrado** |
| Catálogos operacionais (16 telas novas) | não existia | sim | `apuratorios`, `tipos_*`, `locais_origem`… | Novo no Rust |
| Cadastro de procedimento | sim (~50 campos) | parcial e quebrado | 10 tabelas + hub | Pendente |
| Listagem e busca de procedimentos | sim | quebrado | `v_processos` | Pendente |
| Detalhe do procedimento | sim | quebrado | `v_processos` | Pendente |
| Andamentos | sim | sim | `andamentos_processo_procedimentos` | **Migrado** |
| Prazos: criação e prorrogação | sim | lógica ok, leitura quebrada | `prazos_processo` | Parcial |
| Prazos vencendo / vencidos | sim | quebrado | `v_processos` | Pendente |
| Indícios por PM envolvido | sim | sim, remodelado | `pm_envolvido_*` | Implementação diferente |
| Substituição de encarregado | sim | comando existe, sem tela | jsonb (tabela nova sem uso) | Parcial |
| Upload / download / remoção de PDF | sim | sim (leitura quebrada) | colunas inline | Parcial |
| Mapa mensal e mapa completo | sim | quebrado | `mapas_salvos`, `v_processos` | Pendente |
| Mapas salvos: listar / abrir / excluir | sim | sim | `mapas_salvos` | **Migrado** |
| Relatório anual | sim, com PDF | dados quebrados, sem PDF | `v_processos` | Pendente |
| Exportação CSV | não existia | sim (parte quebrada) | `v_processos` | Parcial |
| Auditoria | sim | gravação ok, leitura quebrada | `auditoria` | Parcial |
| Dashboard | sim | quebrado | `v_processos` | Pendente |
| Ranking de motoristas / sinistros | sim (`motorista_id`) | stub vazio | coluna não existe no schema novo | Pendente |
| Estatísticas por natureza | sim | stub vazio | `natureza_processo_id` | Pendente |
| Múltiplas vítimas por processo | sim, 71 registros em JSON | campo texto único | `nome_vitima text` | Pendente |
| Status detalhado do processo | catálogo semeado, nunca usado | não existe | — | Descartável |
| Numeração de controle | sim, 128/128 | campo órfão no formulário | coluna não existe | Pendente |
| Natureza do procedimento (rubrica do fato) | sim, 88 registros | mapeado para o catálogo errado | `natureza_processo_id` | Pendente |
| **Migração dos dados de produção** | 128 processos, 2018–2026 | nenhum script | todas | **Pendente** |

---

## 12. Funcionalidades só no Python/Eel

Filtrando o ruído (wrappers, funções `_old`, duplicatas), sobra o seguinte:

| Função no legado | Comportamento | Evidência de que não foi migrada |
|---|---|---|
| `gerar_relatorio_anual_pdf` | Gera o relatório anual em PDF no servidor | Nenhum crate de PDF no `Cargo.toml`; `mapas_salvos.arquivo_pdf` nunca é gravado |
| `gerar_relatorio_processo` | Relatório individual de um processo | Sem comando equivalente |
| `obter_ultimos_feitos_encarregado` | Últimas ações de um encarregado | Sem comando equivalente |
| `obter_opcoes_filtros` | Devolvia de uma vez todas as opções de filtro da listagem | Sem comando equivalente; o frontend novo não tem filtros compostos |
| `obter_status_detalhado_processo` | Status detalhado, além do par `ativo`/`concluido` | Sem comando e sem coluna correspondente |
| `atualizar_status_detalhado_processo` | Escrita do status detalhado | idem |
| `obter_estatisticas_encarregados` | Panorama consolidado por encarregado | Existe `reports_by_responsible`, com escopo menor e quebrado |
| Ranking de motoristas | Sinistros por motorista, via `motorista_id` | `driver_ranking` é `Ok(vec![])`; a coluna não existe no schema novo — **e há 15 registros reais** |
| Múltiplas vítimas | Array JSON de vítimas por processo | O schema novo tem `nome_vitima TEXT` único, em 5 das 10 tabelas — **71 registros reais em array** |
| Numeração de controle | Campo `numero_controle` por processo | **Preenchido em 128/128**; não existe no schema novo, mas o campo sobrevive órfão no formulário |
| Rubrica do fato apurado | `natureza_procedimento` com ~15 categorias de bem jurídico | **88 registros reais**; nenhuma tabela equivalente no schema novo |
| Pessoas inquiridas | Array JSON de inquiridos por processo | 3 registros; sem coluna equivalente |
| Autor do andamento | Cada andamento guardava `usuario` | `andamentos_processo_procedimentos` não tem coluna de autor |
| `backfill_tipos_funcoes_processo` | Rotina de correção de dados | Descartável — era one-off do legado |

---

## 13. Código e estrutura sem uso

| Item | Onde | Justificativa |
|---|---|---|
| `README.md` | raiz | Descreve venv, `requirements.txt`, Alembic e PyInstaller. Nada disso existe na branch. |
| `.env.example` | raiz | Comenta `db_config.py` e `alembic/env.py`, ambos removidos. |
| `CLAUDE.md` | raiz | Regras do framework "reversa", descontinuado. |
| `categoria_indicios` | tabela (0029) | Zero referências no código. As categorias são uma lista fixa em `evidence_categories`. |
| `pdf_processo_procedimentos` | tabela (0030) | Zero referências. O PDF continua sendo gravado nas colunas inline das 10 tabelas. |
| `historico_encarregados` | tabela (0028) | Zero referências à *tabela*. As 9 ocorrências do nome no Rust são todas a coluna jsonb homônima. |
| `mapas_salvos.arquivo_pdf` | coluna | Nunca escrita nem lida — **nem no legado**: 0 de 107 mapas têm PDF. |
| `pm_envolvido_indicios.categoria` | coluna | Coluna texto legada, coexistindo com `categorias_indicios jsonb`. |
| `<10 tabelas>.andamentos` | coluna jsonb | Lida em `proceedings::get`, mas o módulo `movements` escreve na tabela nova. Duas fontes de verdade divergentes. |
| `numero_controle` | frontend | Campo de formulário sem destino no backend nem no banco — embora exista dado real no legado. |
| 28 comandos registrados e nunca invocados | `lib.rs` × `main.ts` | Ex.: `proceedings_reopen`, `proceedings_substitute_responsible`, `movements_list`, `deadlines_report`, `audit_statistics`, `users_list_encarregados`, os 8 `legal_catalogs_get_*`. |
| `dist/` | raiz | Build do Vite versionado; regenerado a cada `npm run build`. |

---

## 14. Pontos incompletos

Não há um único `TODO`, `FIXME`, `todo!()` ou `unimplemented!()` no projeto. O trabalho pendente não
está marcado — está disfarçado de código pronto.

| Ponto | Local | Forma |
|---|---|---|
| `driver_ranking` | `proceedings/repository.rs:1378` | Assinatura completa, parâmetros prefixados com `_`, corpo é `Ok(vec![])`. O comando está registrado e responde sucesso com lista vazia. |
| `nature_stats` | `proceedings/repository.rs:1385` | Idem. |
| Formulário de procedimento | `src/main.ts:397` | 22 campos declarados; faltam responsável, escrivão, presidente, interrogante, escrivão do processo, PMs envolvidos, datas de remessa e julgamento, unidade deprecada e deprecante — todos existentes no backend e no banco. |
| Tela de prazos | `src/main.ts:1481` | Renderizador próprio, mas a rota `/prazos` não declara `command`. |
| Rotas sem comando de leitura | `src/main.ts:173,175,176` | `/mapas/mensal`, `/estatisticas/anuais` e `/stats/procedimentos` montam as chamadas dentro do renderizador. |
| Listas fixas no código | `movements/commands.rs:22`, `evidence/commands.rs:112` | 11 tipos de andamento e 4 categorias de indício codificados em Rust, sem tabela por trás — e as 4 categorias não batem com os dados reais. |
| Catálogos obrigatórios vazios | migrations | `apuratorios` e `tipos_documentos` são FK `NOT NULL` das 10 tabelas de processo e nascem sem nenhuma linha. |
| Ausência total de testes | projeto | Nenhum `#[test]`, nenhum diretório `tests/`. Com SQL cru e sem macros checadas, nada detecta uma query quebrada antes do usuário. |

---

## 15. Riscos

### Crítico

**Campos com dado real e sem destino no schema novo.**
`numero_controle` (128/128), `natureza_procedimento` (88), `nome_vitima` como array (71),
`motorista_id` (15), `pessoas_inquiridas` (3), o autor de cada andamento, a `ordem_hierarquica` dos
postos, o `tipo` Crime/Contravenção e `carta_precatoria.data_conclusao` (2). Se a migração de dados
for escrita antes de decidir sobre eles, o dado some silenciosamente. Detalhamento em 10.5.

**Nenhum script de migração de dados existe.**
São 128 processos de 2018 a 2026, 236 militares, 141 prazos, 107 mapas e 448 auditorias, saindo de
uma tabela única com `id TEXT` para 10 tabelas com `UUID`, 20 catálogos com FK obrigatória e um hub
de identidade. Não há no repositório nada que faça essa conversão.

**Seis soluções reais fora do catálogo novo.**
`Sugerido_Arquivamento` (4), `Sugerido_IPM` (1) e `Sugerido_Sindicancia` (1) existem nos dados e não
existem em `solucoes_tipo`. Como o código resolve a solução por subselect de nome exato, esses 6
processos migrariam com `solucao_tipo_id = NULL` — sem erro. O mesmo vale para as penalidades.

**O fluxo central de processos não executa.**
62 queries quebradas atingem criar, listar, abrir e editar procedimento, além do dashboard, prazos,
mapas, relatórios e auditoria. O erro só aparece em runtime, na cara do usuário.

**Processo pode nascer sem registro de identidade, em silêncio.**
O `INSERT … SELECT … FROM apuratorios WHERE nome_apuratorio = $2` não insere nada — e não falha — se
a sigla não estiver no catálogo. Como `apuratorios` nasce vazia e é preenchida por texto livre, um
erro de digitação produz um processo órfão cujas filhas passam a rejeitar qualquer inserção por
violação de FK.

**Duas fontes de verdade para andamentos e PDFs.**
`movements` grava na tabela normalizada; `proceedings::get` lê a coluna jsonb. O mesmo padrão vale
para PDF (colunas inline × tabela) e para histórico de encarregados (jsonb × tabela). Os dados reais
tornam a decisão urgente: 35 processos com andamentos e 19 com histórico de encarregados esperando
um destino — e o formato jsonb que o Rust grava hoje é **incompatível** com o do legado. Ver 10.6.

### Alto

**Nada garante o vínculo entre a tabela de tipo e o hub.**
A ligação 1:1 é feita por código, sem FK — impossível de declarar, já que o alvo é polimórfico.
Qualquer `DELETE` físico ou falha parcial de transação deixa 11 tabelas apontando para um processo
inexistente.

**Escrita de procedimento sem verificação de perfil no backend.**
`proceedings_create`, `_update` e `_delete` exigem apenas sessão, embora o próprio `form_schema`
declare `admin_only: true` e o frontend esconda os botões. A trava é cosmética.

**A rubrica do fato apurado foi mapeada para o conceito errado.**
`natureza_processo_id` aponta para `natureza_transgressao` (Leve/Média/Grave), mas o dado real é
`natureza_procedimento` com rubricas como "Dos crimes contra a pessoa". É dele que sai a
classificação que alimenta o ranking de motoristas. Ver 10.4.

**Penalidade nunca é gravada.**
Acentuação divergente entre o `select` do formulário, a validação em Rust e o catálogo no banco.
O dump mostra de que lado está a razão: o código segue os valores reais (`Prisao`, `Detencao`), e
foi o seed do catálogo novo que introduziu a forma acentuada e por extenso.

**Migrations destrutivas na cadeia.**
A 0010 dá `TRUNCATE` em usuários, postos, tipos e auditoria; a 0026 apaga `apuratorios`. Depois que
os 236 militares e os 128 processos forem importados, **qualquer nova execução da cadeia do zero
apaga tudo**. A importação precisa acontecer depois da 0032, nunca antes.

### Médio

**Sem rede de segurança contra regressão de SQL.**
SQL cru + `sqlx::query` em vez de `query!` + zero testes = nenhuma barreira. Foi exatamente assim
que 62 queries apodreceram sem ninguém notar.

**PDFs de até 100 MB em `bytea`.**
Trafegados em base64 pelo IPC (≈133 MB de string) e carregados inteiros em memória.

### Baixo

**Falta de índices nas FKs das tabelas filhas.**
Nenhuma das colunas `processo_procedimento_id` das 6 filhas e das 5 tabelas de enquadramento tem
índice.

**Configuração ambígua e CSP desligada.**
Três nomes de banco em três arquivos, e `"csp": null` no `tauri.conf.json`. O frontend monta HTML
por string — vale revisar a escapagem antes de ligar a CSP.

---

## 16. O que está pronto

- **Migrations** — as 32 sobem do zero, em transação, com controle de versão e checksum.
- **Modelo de dados** — 46 tabelas normalizadas, 111 FKs, índices GIN e parciais bem escolhidos.
- **Autenticação** — bcrypt com upgrade automático do hash SHA-256 legado, guards de sessão e admin.
- **CRUD de usuários** — completo, com validação dupla de matrícula e e-mail, soft delete e reativação.
- **Catálogos** — 68 comandos cobrindo 20 catálogos, com 21 formulários no frontend. É a área mais
  madura do projeto.
- **Indícios e enquadramento** — o módulo `evidence` está inteiramente alinhado ao schema pós-0032,
  com busca em 4 catálogos e substituição transacional.
- **Andamentos** — CRUD completo sobre a tabela normalizada.
- **Auditoria (gravação)** — registrada na mesma transação da operação auditada, com 5 índices.
- **Mapas salvos** — listar, abrir e excluir funcionam.
- **Arquitetura** — padrão de módulo consistente e legível; um desenvolvedor novo se localiza rápido.
- **Fonte de dados e de catálogos** — o dump de 13/05/2026 tem os 128 processos, os 236 militares e
  todos os catálogos que hoje faltam.

---

## 17. O que falta

| Item | Natureza | Tamanho |
|---|---|---|
| Decidir o destino de `v_processos` e alinhar as ~40 queries dependentes | Decisão + reescrita | Grande |
| Corrigir os nomes de coluna obsoletos nas 22 queries restantes | Mecânico | Médio |
| Resolver a duplicidade jsonb × tabelas (andamentos, PDF, encarregados, indícios) | Decisão de modelagem + migração | Grande |
| Semear os 11 catálogos vazios a partir do dump legado | Migration de seed | Médio |
| Decidir o destino dos 12 campos com dado real e sem coluna (§10.5) | Decisão de modelagem | Médio |
| Escrever a importação dos 128 processos e 236 militares | Script de migração de dados | Grande |
| Reconciliar valores fora do catálogo (soluções `Sugerido_*`, penalidades, postos `ST PM`/`TC PM`) | Mapeamento | Pequeno |
| Completar o formulário de procedimento (papéis, envolvidos, datas, campos por tipo) | Frontend | Grande |
| Alinhar penalidade, `tipo_geral` e os campos de texto livre com os catálogos | Correção | Pequeno |
| Aplicar `require_admin` nas escritas de procedimento | Segurança | Pequeno |
| Implementar `driver_ranking` e `nature_stats` — ou removê-los | Decisão + implementação | Médio |
| Telas para os 28 comandos sem uso (reabrir, substituir encarregado, relatório de prazos…) | Frontend | Médio |
| Geração de PDF do relatório anual, se for para manter | Decisão + implementação | Médio |
| Restaurar as FKs de `local_origem_id` e `natureza_processo_id` | Migration | Pequeno |
| Índices nas FKs das tabelas filhas | Migration | Pequeno |
| Rede de proteção contra regressão de SQL (macros `query!` ou teste de `PREPARE`) | Infraestrutura | Médio |
| Limpar `README.md`, `.env.example`, `CLAUDE.md` e unificar o nome do banco | Higiene | Pequeno |

---

## 18. Próximos passos recomendados

Com o dump em mãos, a ordem muda. Tudo o que altera o formato do banco precisa acontecer **antes**
de importar os dados de produção — importar duas vezes, ou importar e depois reestruturar, é o
caminho caro. As etapas 1 a 7 são preparação; a 8 é o ponto sem retorno.

1. **Subir o banco do zero e confirmar que o app abre.**
   As migrations já estão corrigidas. Falta unificar o nome do banco entre `app_state.rs`,
   `docker-compose.yml` e o `.env`. Menor passo, maior desbloqueio.

2. **Semear os catálogos a partir do dump.**
   Onze catálogos hoje vazios têm origem pronta (§10.7): 112 municípios e distritos de Rondônia,
   95 transgressões do RDPM, 27 crimes, 23 infrações do art. 29, 12 postos, os 3 documentos
   iniciadores, os 10 apuratórios, as 4 unidades de origem e as 4 categorias de indício. Sem isso,
   nenhum processo pode ser criado — nem a mão, nem por importação.

3. **Decidir o destino de `v_processos`.**
   Recriá-la com os nomes atuais conserta ~40 queries de uma vez e é reversível; abandoná-la exige
   reescrever cada consulta com `UNION ALL`. *Recomendação:* recriar agora como ponte, decidir a
   remoção depois, com o sistema funcionando.

4. **Varrer os nomes de coluna obsoletos.**
   As 22 queries restantes são substituição mecânica: `codigo` → o nome novo de cada catálogo,
   `pm_envolvido_crimes` → as duas tabelas novas, `cc.dispositivo_legal` → o `JOIN`.

5. **Instalar a rede de segurança.**
   Um teste que faz `PREPARE` de todas as queries contra um banco recém-migrado é barato e teria
   evitado tudo isto. Feito agora, protege as etapas seguintes — inclusive a importação.

6. **Decidir os 12 campos com dado real e sem destino.** *(requer decisão do time)*
   `numero_controle`, `natureza_procedimento`, vítimas múltiplas, `motorista_id`,
   `pessoas_inquiridas`, autor do andamento, `ordem_hierarquica`, Crime × Contravenção,
   `carta_precatoria.data_conclusao`. Cada "manter" vira coluna ou tabela numa migration nova; cada
   "descartar" precisa ser uma escolha explícita, não um efeito colateral.

7. **Resolver a duplicidade jsonb × tabelas normalizadas.** *(requer decisão do time)*
   As tabelas `historico_encarregados`, `pdf_processo_procedimentos` e
   `andamentos_processo_procedimentos` foram criadas para receber o que hoje está em jsonb e bytea.
   Se elas vencem, a importação já entra no formato final e as colunas antigas saem. Se não, elas
   devem ser removidas para não haver dois destinos.

8. **Escrever e rodar a importação.**
   Só depois de 6 e 7. A ordem interna é: catálogos → usuários (com mapeamento de `ST PM` e
   `TC PM`) → para cada processo, a linha na tabela do seu tipo + a linha no hub → PMs envolvidos →
   prazos → andamentos → indícios e enquadramento → mapas → auditoria. Reconciliar antes as soluções
   `Sugerido_*` e as penalidades. Vale rodar primeiro em cópia e conferir totais por tipo contra os
   128 originais.

9. **Fechar o fluxo de cadastro ponta a ponta.**
   Alinhar penalidade e `tipo_geral` aos catálogos, trocar os campos de texto livre por `select`,
   aplicar `require_admin` nas escritas, e completar o formulário com papéis, envolvidos e os campos
   por tipo.

10. **Reconstituir a integridade perdida nas reestruturações.**
    FKs de `local_origem_id` e `natureza_processo_id` — esta última depende da etapa 6 —, índices nas
    FKs das filhas, e um índice único parcial garantindo um só prazo ativo por processo. Com dados
    dentro, é o momento de verificar se algum registro viola as regras antes de declará-las no banco.

11. **Reativar os relatórios.**
    Com `v_processos` resolvida e dados carregados, a maior parte de `maps_reports` volta sozinha —
    e passa a ter o que exibir. Sobram o PDF do relatório anual, o ranking de motoristas e as
    estatísticas por natureza, os três dependentes da etapa 6.

12. **Higiene final.**
    Substituir `README.md`, `.env.example` e `CLAUDE.md`; decidir se `dist/` continua versionado;
    tirar `adm-p6.sql` da raiz do repositório (44 MB com dados pessoais de 236 militares não devem
    ser versionados); e criar telas para os comandos que hoje existem sem porta de entrada.

---

*Análise somente-leitura da branch `migrate_to_rust_with_tauri`. Nenhum código de aplicação foi
alterado. Única alteração no repositório: 3 migrations corrigidas (0009, 0014, 0015) para permitir a
aplicação em banco vazio.*
