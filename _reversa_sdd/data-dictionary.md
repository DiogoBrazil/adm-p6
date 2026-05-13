# Dicionário de Dados — adm-p6

> Gerado pelo Arqueólogo em 2026-05-12
> Fonte: `alembic/versions/0001` a `0006`
> Banco: PostgreSQL 16 — porta 5438 — database `adm_p6_db`
> **Política:** banco reutilizado sem alterações na migração para Rust/Tauri

---

## Índice de Tabelas

| # | Tabela | Domínio | Linhas estimadas |
|---|--------|---------|-----------------|
| 1 | [usuarios](#1-usuarios) | Auth / Usuários | operacional |
| 2 | [processos_procedimentos](#2-processos_procedimentos) | Processos | principal |
| 3 | [crimes_contravencoes](#3-crimes_contravencoes) | Catálogo | seed |
| 4 | [transgressoes](#4-transgressoes) | Catálogo RDPM | seed |
| 5 | [infracoes_estatuto_art29](#5-infracoes_estatuto_art29) | Catálogo Art.29 | seed |
| 6 | [municipios_distritos](#6-municipios_distritos) | Catálogo | seed |
| 7 | [auditoria](#7-auditoria) | Auditoria | cresce com uso |
| 8 | [mapas_salvos](#8-mapas_salvos) | Mapas | operacional |
| 9 | [prazos_processo](#9-prazos_processo) | Prazos | operacional |
| 10 | [procedimento_pms_envolvidos](#10-procedimento_pms_envolvidos) | Indícios | operacional |
| 11 | [pm_envolvido_indicios](#11-pm_envolvido_indicios) | Indícios | operacional |
| 12 | [pm_envolvido_crimes](#12-pm_envolvido_crimes) | Indícios | operacional |
| 13 | [pm_envolvido_rdpm](#13-pm_envolvido_rdpm) | Indícios | operacional |
| 14 | [pm_envolvido_art29](#14-pm_envolvido_art29) | Indícios | operacional |
| 15 | [procedimentos_indicios_crimes](#15-procedimentos_indicios_crimes) | Indícios | operacional |
| 16 | [procedimentos_indicios_rdpm](#16-procedimentos_indicios_rdpm) | Indícios | operacional |
| 17 | [procedimentos_indicios_art29](#17-procedimentos_indicios_art29) | Indícios | operacional |

---

## 1. usuarios

Tabela central de usuários do sistema. Cobre tanto operadores (acesso ao sistema) quanto policiais militares (sujeitos dos processos).

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID gerado em Python (uuid4) |
| `tipo_usuario` | TEXT | NÃO | — | CHECK ('Oficial','Praça') | Tipo hierárquico do PM |
| `posto_graduacao` | TEXT | NÃO | — | — | Posto ou graduação (ex: Cel, Sd) |
| `nome` | TEXT | NÃO | — | — | Nome completo |
| `matricula` | TEXT | NÃO | — | UNIQUE | Matrícula funcional |
| `is_encarregado` | BOOLEAN | SIM | FALSE | — | Flag: pode ser encarregado de processo |
| `is_operador` | BOOLEAN | SIM | FALSE | — | Flag: tem acesso ao sistema |
| `email` | TEXT | SIM | NULL | UNIQUE | E-mail para login |
| `senha` | TEXT | SIM | NULL | — | Hash bcrypt ou SHA-256 (legado) |
| `perfil` | TEXT | SIM | NULL | CHECK ('admin','comum') | Perfil de acesso quando is_operador=TRUE |
| `created_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Data de criação |
| `updated_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Última atualização |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |

**Índices:** `ix_user_nome (nome)`, `ix_user_operador (is_operador) WHERE ativo=TRUE`, `ix_user_encarregado (is_encarregado) WHERE ativo=TRUE`

**Relacionamentos (FK recebidas):**
- `processos_procedimentos.responsavel_id` → `usuarios.id`
- `processos_procedimentos.presidente_id` → `usuarios.id`
- `processos_procedimentos.interrogante_id` → `usuarios.id`
- `processos_procedimentos.escrivao_processo_id` → `usuarios.id`
- `auditoria.usuario_id` → `usuarios.id`
- `mapas_salvos.usuario_id` → `usuarios.id`

**Regras de negócio:**
- Um PM pode ser `is_operador=FALSE` e existir apenas como sujeito de processo
- Um usuário operador precisa de `email`, `senha` e `perfil` definidos
- Soft delete: `ativo=FALSE` — não aparece em listagens mas permanece no banco
- 🔴 LACUNA: `senha` pode ser bcrypt (60 chars `$2b$...`) ou SHA-256 hex (64 chars) — legado sem flag discriminante

---

## 2. processos_procedimentos

Tabela principal do sistema. Armazena todos os tipos de processos e procedimentos disciplinares.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID gerado em Python |
| `numero` | TEXT | NÃO | — | UNIQUE c/ doc+ano | Número sequencial do processo |
| `tipo_geral` | TEXT | NÃO | — | CHECK ('processo','procedimento') | Categoria macro |
| `tipo_detalhe` | TEXT | NÃO | — | — | PAD/PADE/CD/CJ (proc) ou SR/SV/IPM/IPPM/FP/CP/PADS (proc.) |
| `documento_iniciador` | TEXT | NÃO | — | CHECK ('Portaria','Memorando Disciplinar','Feito Preliminar') | Documento que inaugurou o processo |
| `processo_sei` | TEXT | SIM | NULL | — | Número SEI (sistema externo) |
| `responsavel_id` | TEXT | SIM | NULL | FK→usuarios | Encarregado responsável |
| `responsavel_tipo` | TEXT | SIM | NULL | CHECK ('usuario') | Tipo do responsável (discriminador) |
| `local_origem` | TEXT | SIM | NULL | — | Unidade de origem |
| `local_fatos` | TEXT | SIM | NULL | — | Local onde ocorreram os fatos |
| `data_instauracao` | DATE | SIM | NULL | — | Data de abertura formal |
| `data_recebimento` | DATE | SIM | NULL | — | Data de recebimento pela P6 |
| `escrivao_id` | TEXT | SIM | NULL | — | Escrivão (campo legado, sem FK formal) |
| `status_pm` | TEXT | SIM | NULL | — | Status do PM envolvido |
| `nome_pm_id` | TEXT | SIM | NULL | — | ID do PM principal envolvido |
| `nome_vitima` | TEXT | SIM | NULL | — | Nome da vítima quando aplicável |
| `natureza_processo` | TEXT | SIM | NULL | — | Natureza calculada: PAD→'Disciplinar Administrativa' etc. |
| `natureza_procedimento` | TEXT | SIM | NULL | — | Natureza do procedimento |
| `resumo_fatos` | TEXT | SIM | NULL | — | Descrição dos fatos |
| `numero_portaria` | TEXT | SIM | NULL | — | Número da portaria (quando doc_iniciador='Portaria') |
| `numero_memorando` | TEXT | SIM | NULL | — | Número do memorando (quando doc_iniciador='Memorando Disciplinar') |
| `numero_feito` | TEXT | SIM | NULL | — | Número do feito preliminar |
| `numero_rgf` | TEXT | SIM | NULL | — | Número RGF |
| `created_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Criação do registro |
| `updated_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Última atualização |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |
| `numero_controle` | TEXT | SIM | NULL | — | Número de controle interno |
| `concluido` | BOOLEAN | SIM | NULL | — | Flag de conclusão |
| `data_conclusao` | DATE | SIM | NULL | — | Data de conclusão |
| `infracao_id` | INTEGER | SIM | NULL | — | FK para infracoes_estatuto_art29 (sem constraint formal) |
| `transgressoes_ids` | TEXT | SIM | NULL | — | 🔴 Campo legado TEXT (IDs separados por vírgula ou JSON) |
| `solucao_final` | TEXT | SIM | NULL | — | Texto da decisão final |
| `ano_instauracao` | TEXT | SIM | NULL | — | Ano extraído da data_instauracao |
| `andamentos` | JSONB | SIM | '[]' | GIN index | Array JSON de andamentos do processo |
| `data_remessa_encarregado` | DATE | SIM | NULL | — | Data de envio ao encarregado |
| `data_julgamento` | DATE | SIM | NULL | — | Data do julgamento |
| `solucao_tipo` | TEXT | SIM | NULL | — | Tipo da solução (Arquivamento, Punição, etc.) |
| `penalidade_tipo` | TEXT | SIM | NULL | — | Tipo de penalidade aplicada |
| `penalidade_dias` | INTEGER | SIM | NULL | — | Dias de punição quando aplicável |
| `indicios_categorias` | JSONB | SIM | '[]' | GIN index | Categorias de indícios (resumo) |
| `presidente_id` | TEXT | SIM | NULL | FK→usuarios | Presidente da comissão (PAD/PADE/CD) |
| `presidente_tipo` | TEXT | SIM | NULL | CHECK ('usuario') | Discriminador de tipo |
| `interrogante_id` | TEXT | SIM | NULL | FK→usuarios | Interrogante (PAD/PADE) |
| `interrogante_tipo` | TEXT | SIM | NULL | CHECK ('usuario') | Discriminador de tipo |
| `escrivao_processo_id` | TEXT | SIM | NULL | FK→usuarios | Escrivão formal |
| `escrivao_processo_tipo` | TEXT | SIM | NULL | CHECK ('usuario') | Discriminador de tipo |
| `historico_encarregados` | JSONB | SIM | '[]' | GIN index | Histórico de troca de encarregados |
| `motorista_id` | TEXT | SIM | NULL | — | Motorista envolvido (AIT) |
| `pdf_nome` | VARCHAR(255) | SIM | NULL | — | Nome do arquivo PDF |
| `pdf_content_type` | VARCHAR(100) | SIM | NULL | — | MIME type do PDF |
| `pdf_tamanho` | BIGINT | SIM | NULL | — | Tamanho em bytes (limite: 100MB) |
| `pdf_upload_em` | TIMESTAMP WITH TZ | SIM | NULL | — | Data do upload |
| `pdf_arquivo` | BYTEA | SIM | NULL | — | Conteúdo binário do PDF |

**Constraint única:** `UNIQUE (numero, documento_iniciador, ano_instauracao)`

**Índices:** `ix_proc_ativo`, `ix_proc_tipo (tipo_geral, tipo_detalhe)`, `ix_proc_concluido`, `ix_proc_data_instauracao`, `ix_proc_data_recebimento`, `ix_proc_ano`, GIN em `andamentos`, `historico_encarregados`, `indicios_categorias`

**Enumerações implícitas:**

`tipo_detalhe` — valores válidos:
- Processos: `PAD`, `PADE`, `CD`, `CJ`
- Procedimentos: `SR`, `SV`, `IPM`, `IPPM`, `FP`, `CP`, `PADS`

`natureza_processo` — mapeamento calculado em Python:
```
PAD → "Processo Administrativo Disciplinar"
PADE → "Processo Administrativo Disciplinar Especial"
CD  → "Conselho de Disciplina"
CJ  → "Conselho de Justificação"
```

`andamentos` — estrutura JSONB (array):
```json
[{
  "id": "uuid",
  "data": "YYYY-MM-DD",
  "tipo": "texto",
  "descricao": "texto",
  "usuario_id": "uuid",
  "usuario_nome": "texto",
  "created_at": "ISO8601"
}]
```

---

## 3. crimes_contravencoes

Catálogo de crimes e contravenções penais. Usado em processos do tipo CJ e indicios.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `tipo` | TEXT | SIM | NULL | — | 'Crime' ou 'Contravenção' |
| `dispositivo_legal` | TEXT | SIM | NULL | — | Código Penal, Lei de Contravenções etc. |
| `artigo` | TEXT | SIM | NULL | — | Número do artigo (ex: "121") |
| `descricao_artigo` | TEXT | SIM | NULL | — | Título do artigo (ex: "Homicídio simples") |
| `paragrafo` | TEXT | SIM | NULL | — | Parágrafo (ex: "§1º", "caput") |
| `inciso` | TEXT | SIM | NULL | — | Inciso em romano (ex: "II") |
| `alinea` | TEXT | SIM | NULL | — | Alínea (ex: "a") |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |

**Índices:** `ix_crimes_tipo_art (tipo, dispositivo_legal, artigo)`, `ix_crimes_ativo`

**Validação em Python** (`validar_campos_crime`):
- `artigo`: obrigatório, regex `^\d+(-[A-Z])?$` (ex: `121`, `121-A`)
- `paragrafo`: opcional, regex `^(§\d+[ºª]?|caput|\d+[ºª])$`
- `inciso`: opcional, romano maiúsculo `^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$`
- `alinea`: opcional, regex `^[a-z]$`

---

## 4. transgressoes

Catálogo de transgressões disciplinares do RDPM (Regulamento Disciplinar da Polícia Militar).

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | SERIAL INTEGER | NÃO | auto-incremento | PK | ⚠️ SERIAL — não UUID |
| `artigo` | INTEGER | SIM | NULL | — | Número do artigo no RDPM |
| `gravidade` | TEXT | SIM | NULL | — | 'Leve', 'Média', 'Grave' (title-case) |
| `inciso` | TEXT | SIM | NULL | — | Inciso romano |
| `texto` | TEXT | SIM | NULL | — | Texto da transgressão |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |
| `created_at` | TIMESTAMP | SIM | NULL | — | Data de criação |

**Índices:** `ix_trans_ativo`, `ix_trans_grav_inc (gravidade, inciso)`

**Nota migração:** ID SERIAL (inteiro), não UUID. Referenciado em `pm_envolvido_rdpm.transgressao_id` e `procedimentos_indicios_rdpm.transgressao_id`.

**Regra crítica:** módulo RDPM realiza HARD DELETE (não soft delete). Ao excluir uma transgressão: `DELETE FROM transgressoes WHERE id = ?` sem marcar `ativo=FALSE`.

---

## 5. infracoes_estatuto_art29

Catálogo de infrações do Art. 29 do Estatuto dos Policiais Militares.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | SERIAL INTEGER | NÃO | auto-incremento | PK | ⚠️ SERIAL — não UUID |
| `inciso` | TEXT | SIM | NULL | — | Inciso (romano: I, II, III...) |
| `texto` | TEXT | SIM | NULL | — | Texto da infração |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |

**Índices:** `ix_art29_ativo`, `ix_art29_inciso`

**Ordenação especial:** ordem por numeral romano via SQL:
```sql
ORDER BY LENGTH(inciso), inciso
```
Funciona para até ~10 incisos. Para valores maiores (XI, XII...) a ordem `LENGTH` falha.

---

## 6. municipios_distritos

Catálogo de municípios e distritos do Estado de Rondônia.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `nome` | TEXT | SIM | NULL | — | Nome do município ou distrito |
| `tipo` | TEXT | SIM | NULL | — | 'municipio' ou 'distrito' |
| `municipio_pai` | TEXT | SIM | NULL | — | ID do município pai (para distritos) |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |

---

## 7. auditoria

Trilha de auditoria imutável. Registra todas operações CREATE/UPDATE/DELETE.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `tabela` | TEXT | NÃO | — | — | Nome da tabela afetada |
| `registro_id` | TEXT | NÃO | — | — | ID do registro afetado |
| `operacao` | TEXT | NÃO | — | — | 'CREATE', 'UPDATE', 'DELETE' |
| `usuario_id` | TEXT | SIM | NULL | FK→usuarios | Usuário que realizou a operação |
| `timestamp` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Quando ocorreu |

**Acesso:** apenas usuários com `perfil='admin'`

---

## 8. mapas_salvos

Mapas mensais de processos gerados e salvos.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `titulo` | TEXT | SIM | NULL | — | Título do mapa |
| `tipo_processo` | TEXT | SIM | NULL | — | Tipo filtrado (ou COMPLETO) |
| `periodo_inicio` | DATE | SIM | NULL | — | Data início do período |
| `periodo_fim` | DATE | SIM | NULL | — | Data fim do período |
| `periodo_descricao` | TEXT | SIM | NULL | — | Descrição textual do período |
| `total_processos` | INTEGER | SIM | NULL | — | Total de processos contabilizados |
| `total_concluidos` | INTEGER | SIM | NULL | — | Total de processos concluídos |
| `total_andamento` | INTEGER | SIM | NULL | — | Total em andamento |
| `usuario_id` | TEXT | SIM | NULL | FK→usuarios | Usuário que gerou |
| `usuario_nome` | TEXT | SIM | NULL | — | Nome denormalizado do usuário |
| `dados_mapa` | JSONB | SIM | '{}' | GIN index | Estrutura completa do mapa |
| `nome_arquivo` | TEXT | SIM | NULL | — | Nome do arquivo PDF gerado |
| `data_geracao` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Quando foi gerado |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |

---

## 9. prazos_processo

Controle de prazos processuais e prorrogações.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `processo_id` | TEXT | NÃO | — | FK→processos_procedimentos | Processo ao qual pertence |
| `tipo_prazo` | TEXT | NÃO | — | — | 'ORIGINAL' ou 'PRORROGACAO_N' (sequencial) |
| `data_inicio` | DATE | NÃO | — | — | Data de início do prazo |
| `data_vencimento` | DATE | NÃO | — | — | Data de vencimento calculada |
| `dias_adicionados` | INTEGER | SIM | NULL | — | Dias adicionados na prorrogação |
| `motivo` | TEXT | SIM | NULL | — | Motivo da prorrogação |
| `autorizado_por` | TEXT | SIM | NULL | — | Quem autorizou a prorrogação |
| `autorizado_tipo` | TEXT | SIM | NULL | — | Tipo do autorizador |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |
| `numero_portaria` | TEXT | SIM | NULL | — | Portaria de prorrogação |
| `data_portaria` | DATE | SIM | NULL | — | Data da portaria |
| `ordem_prorrogacao` | INTEGER | SIM | NULL | — | Número sequencial da prorrogação |
| `created_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Criação |
| `updated_at` | TIMESTAMP | SIM | NULL | — | Última atualização |

**Índices:** `ix_prazo_proc (processo_id)`, `ix_prazo_venc (data_vencimento) WHERE ativo=TRUE`

**Regra — dias por tipo de processo:**

| Tipo | Dias originais | Máx. prorrogação | Máx. total |
|------|---------------|-----------------|-----------|
| SV | 15 | 15 | 30 |
| SR | 30 | 30 | 60 |
| IPM | 40 | 20 | 60 |
| IPPM | 40 | 20 | 60 |
| FP | 30 | 30 | 60 |
| CP | 60 | 60 | 120 |
| PAD | 60 | 60 | 120 |
| PADE | 60 | 60 | 120 |
| CD | 60 | 60 | 120 |
| CJ | 60 | 60 | 120 |

---

## 10. procedimento_pms_envolvidos

PMs envolvidos em um determinado procedimento.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `procedimento_id` | TEXT | NÃO | — | FK→processos_procedimentos | Procedimento ao qual pertence |
| `pm_id` | TEXT | NÃO | — | — | ID do PM (referência a usuarios) |
| `pm_tipo` | TEXT | SIM | NULL | — | Tipo do PM ('usuario') |
| `ordem` | INTEGER | SIM | NULL | — | Ordem de exibição |
| `status_pm` | TEXT | SIM | NULL | — | Status do PM no procedimento |

---

## 11. pm_envolvido_indicios

Registro de indícios por PM envolvido. Nível intermediário da hierarquia de indícios.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `pm_envolvido_id` | TEXT | NÃO | — | FK→procedimento_pms_envolvidos | PM envolvido de referência |
| `procedimento_id` | TEXT | NÃO | — | FK→processos_procedimentos | Procedimento de referência |
| `categorias_indicios` | JSONB | SIM | '[]' | GIN index | Categorias de indícios atribuídas |
| `categoria` | TEXT | SIM | NULL | — | Categoria principal |
| `ativo` | BOOLEAN | SIM | TRUE | — | Soft delete |

---

## 12. pm_envolvido_crimes

Crimes/contravenções imputados a um PM em seus indícios.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `pm_indicios_id` | TEXT | NÃO | — | FK→pm_envolvido_indicios | Registro de indícios do PM |
| `crime_id` | TEXT | NÃO | — | FK→crimes_contravencoes | Crime/contravenção imputada |

---

## 13. pm_envolvido_rdpm

Transgressões RDPM imputadas a um PM em seus indícios.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `pm_indicios_id` | TEXT | NÃO | — | FK→pm_envolvido_indicios | Registro de indícios do PM |
| `transgressao_id` | INTEGER | NÃO | — | FK→transgressoes | Transgressão RDPM imputada |

---

## 14. pm_envolvido_art29

Infrações Art.29 imputadas a um PM em seus indícios.

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `pm_indicios_id` | TEXT | NÃO | — | FK→pm_envolvido_indicios | Registro de indícios do PM |
| `art29_id` | INTEGER | NÃO | — | FK→infracoes_estatuto_art29 | Infração Art.29 imputada |

---

## 15. procedimentos_indicios_crimes

Crimes/contravenções associados ao procedimento (nível de procedimento, não por PM).

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `procedimento_id` | TEXT | NÃO | — | FK→processos_procedimentos | Procedimento |
| `crime_id` | TEXT | NÃO | — | FK→crimes_contravencoes | Crime/contravenção |
| `created_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Criação |

---

## 16. procedimentos_indicios_rdpm

Transgressões RDPM associadas ao procedimento (nível de procedimento).

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `procedimento_id` | TEXT | NÃO | — | FK→processos_procedimentos | Procedimento |
| `transgressao_id` | INTEGER | NÃO | — | FK→transgressoes | Transgressão RDPM |
| `created_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Criação |

---

## 17. procedimentos_indicios_art29

Infrações Art.29 associadas ao procedimento (nível de procedimento).

| Coluna | Tipo | Nulo | Padrão | Restrições | Descrição |
|--------|------|------|--------|------------|-----------|
| `id` | TEXT | NÃO | — | PK | UUID |
| `procedimento_id` | TEXT | NÃO | — | FK→processos_procedimentos | Procedimento |
| `art29_id` | INTEGER | NÃO | — | FK→infracoes_estatuto_art29 | Infração Art.29 |
| `created_at` | TIMESTAMP | SIM | CURRENT_TIMESTAMP | — | Criação |

---

## Diagrama de Relacionamentos (ERD simplificado)

```
usuarios
  ↑ FK responsavel_id, presidente_id, interrogante_id, escrivao_processo_id, motorista_id
processos_procedimentos ←──────────────────────────────────────────────────┐
  │ FK processo_id                                                           │
  ├──→ prazos_processo                                                       │
  │                                                                          │
  │ FK procedimento_id                                                       │
  ├──→ procedimento_pms_envolvidos                                           │
  │       │ FK pm_envolvido_id + procedimento_id                             │
  │       └──→ pm_envolvido_indicios ─────────────────────────────────────┘
  │               │ FK pm_indicios_id
  │               ├──→ pm_envolvido_crimes ──→ crimes_contravencoes
  │               ├──→ pm_envolvido_rdpm ────→ transgressoes
  │               └──→ pm_envolvido_art29 ───→ infracoes_estatuto_art29
  │
  │ FK procedimento_id
  ├──→ procedimentos_indicios_crimes ──→ crimes_contravencoes
  ├──→ procedimentos_indicios_rdpm ────→ transgressoes
  └──→ procedimentos_indicios_art29 ───→ infracoes_estatuto_art29

auditoria ──→ usuarios (usuario_id)
mapas_salvos ──→ usuarios (usuario_id)
municipios_distritos (auto-referência: municipio_pai → id)
```

---

## Notas para Migração Rust/Tauri

| Aspecto | Situação atual | Atenção |
|---------|---------------|---------|
| IDs | TEXT UUID (Python uuid4) exceto `transgressoes` e `infracoes_estatuto_art29` (SERIAL) | Gerar UUIDs em Rust para tabelas TEXT PK |
| JSONB fields | `andamentos`, `historico_encarregados`, `indicios_categorias`, `dados_mapa`, `categorias_indicios` | Usar `serde_json::Value` com `sqlx` |
| BYTEA (PDF) | `pdf_arquivo` em `processos_procedimentos` | `Vec<u8>` — evitar carregar em memória desnecessariamente |
| Soft delete | `ativo BOOLEAN` em quase todas as tabelas | Sempre filtrar `WHERE ativo = TRUE` |
| Hard delete | Apenas `transgressoes` (RDPM) | Tratar diferente nas queries |
| Senhas legado | Pode ser bcrypt (60 chars `$2b$`) ou SHA-256 hex (64 chars) | Detectar pelo prefixo/comprimento |
| SERIAL IDs | `transgressoes.id`, `infracoes_estatuto_art29.id` | Não gerar UUID — deixar o banco gerar |
