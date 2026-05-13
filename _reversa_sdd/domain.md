# Domínio — Gestão P6 (SJD GESTOR)

> Gerado pelo Detetive em 2026-05-12
> Sistema de gestão disciplinar da Polícia Militar de Rondônia

---

## Glossário de Domínio

| Termo | Definição | Confiança |
|-------|-----------|-----------|
| **P6** | Seção de Pessoal e Disciplina da Polícia Militar (PM-RO) | 🟢 CONFIRMADO |
| **PM** | Policial Militar (abrange Oficiais e Praças) | 🟢 CONFIRMADO |
| **Processo** | Instrumento formal de apuração disciplinar com rito específico (PAD, PADE, CD, CJ) | 🟢 CONFIRMADO |
| **Procedimento** | Instrumento preliminar ou sumário de apuração (SR, SV, IPM, IPPM, FP, CP, PADS) | 🟢 CONFIRMADO |
| **PAD** | Processo Administrativo Disciplinar — rito ordinário para apuração de transgressões graves | 🟢 CONFIRMADO |
| **PADE** | PAD Especial — variante do PAD com rito diferenciado | 🟢 CONFIRMADO |
| **CD** | Conselho de Disciplina — processo para praças estáveis | 🟢 CONFIRMADO |
| **CJ** | Conselho de Justificação — processo para oficiais | 🟢 CONFIRMADO |
| **SR** | Sindicância Regular — procedimento investigativo com prazo de 30 dias | 🟢 CONFIRMADO |
| **SV** | Sindicância Verificatória — procedimento mais rápido, 15 dias | 🟢 CONFIRMADO |
| **IPM** | Inquérito Policial Militar — investigação criminal militar, 40 dias | 🟢 CONFIRMADO |
| **IPPM** | Inquérito Policial Policial Militar — variante do IPM | 🟢 CONFIRMADO |
| **FP** | Feito Preliminar — procedimento preliminar, quando iniciador é Feito Preliminar: 15 dias | 🟢 CONFIRMADO |
| **CP** | Comissão de Processo — 30 dias | 🟢 CONFIRMADO |
| **PADS** | Processo Administrativo Disciplinar Sumário — exige ao menos 1 transgressão | 🟢 CONFIRMADO |
| **Encarregado** | PM responsável por conduzir a investigação/procedimento | 🟢 CONFIRMADO |
| **Escrivão** | PM responsável por lavrar os termos do procedimento | 🟢 CONFIRMADO |
| **Presidente** | Presidente da comissão em PAD/CD/CJ/PADE (substitui o papel de Encarregado) | 🟢 CONFIRMADO |
| **Interrogante** | Membro responsável pelos interrogatórios em PAD/CD/CJ/PADE | 🟢 CONFIRMADO |
| **Sindicado** | PM em fase de sindicância (status_pm) | 🟢 CONFIRMADO |
| **Acusado** | PM formalmente acusado (status_pm) | 🟢 CONFIRMADO |
| **Indiciado** | PM indiciado em IPM/IPPM (status_pm) | 🟢 CONFIRMADO |
| **Investigado** | PM em fase investigativa (status_pm) | 🟢 CONFIRMADO |
| **RDPM** | Regulamento Disciplinar da Polícia Militar — catálogo de transgressões internas | 🟢 CONFIRMADO |
| **Art. 29** | Art. 29 do Estatuto dos Policiais Militares — catálogo de infrações | 🟢 CONFIRMADO |
| **CPM** | Código Penal Militar — base para crimes militares | 🟢 CONFIRMADO |
| **Transgressão** | Conduta violadora do RDPM, classificada por gravidade (Leve, Média, Grave) | 🟢 CONFIRMADO |
| **Crime Militar** | Conduta tipificada no CPM ou em legislação penal militar especial | 🟢 CONFIRMADO |
| **Portaria** | Documento oficial que inicia um processo ou procedimento | 🟢 CONFIRMADO |
| **Memorando Disciplinar** | Comunicação interna que pode originar um processo | 🟢 CONFIRMADO |
| **Feito Preliminar** | Peça preliminar que substitui Portaria em casos sumários | 🟢 CONFIRMADO |
| **Prazo Processual** | Tempo máximo para conclusão do processo a partir do recebimento | 🟢 CONFIRMADO |
| **Prorrogação** | Extensão do prazo mediante Portaria específica | 🟢 CONFIRMADO |
| **Andamento** | Registro de evento processual (citação, oitiva, diligência, etc.) | 🟢 CONFIRMADO |
| **Indício** | Evidência associada a um PM envolvido — cruzamento com crimes, RDPM e Art.29 | 🟢 CONFIRMADO |
| **Mapa Mensal** | Resumo estatístico mensal dos processos/procedimentos | 🟢 CONFIRMADO |
| **Operador** | PM com acesso ao sistema para consultas e operações (is_operador=TRUE) | 🟢 CONFIRMADO |
| **Oficial** | Policial Militar de posto: CEL PM, TC PM, MAJ PM, CAP PM, 1º TEN PM, 2º TEN PM, ASP OF PM | 🟢 CONFIRMADO |
| **Praça** | Policial Militar de graduação: ST PM, 1º SGT PM, 2º SGT PM, 3º SGT PM, CB PM, SD PM | 🟢 CONFIRMADO |
| **SEI** | Sistema Eletrônico de Informações — protocolo de número no formato `XXXX.XXXXXX/AAAA-DV` | 🟢 CONFIRMADO |
| **RGF** | Registro Geral de Fatos — número de ocorrência, formato `XX.XX.XXXX` | 🟢 CONFIRMADO |
| **A APURAR** | Sentinela: nome reservado para PM ainda não identificado em envolvido | 🟢 CONFIRMADO |
| **Natureza** | Classificação da gravidade agregada das transgressões de um processo: Leve, Média, Grave, Múltiplas | 🟢 CONFIRMADO |
| **Auditoria** | Trilha imutável de operações CREATE/UPDATE/DELETE no sistema | 🟢 CONFIRMADO |

---

## Regras de Negócio

### RN-01 — Acesso ao sistema (login)
🟢 CONFIRMADO — `main.py:183`

Somente usuários com `is_operador = TRUE` E `ativo = TRUE` podem fazer login.
A autenticação valida email + senha. Usuários apenas encarregados (is_encarregado=TRUE, is_operador=FALSE) **não** conseguem fazer login.

### RN-02 — Migração automática de hash de senha
🟢 CONFIRMADO — `main.py:204-218`

Se o hash armazenado não começa com `$2` (identifica SHA-256 legado), o sistema:
1. Valida com SHA-256
2. Se correto, atualiza silenciosamente para bcrypt no mesmo login bem-sucedido

Nenhuma notificação ao usuário. Transparente.

### RN-03 — Senha padrão do administrador
🟢 CONFIRMADO — `main.py:167-173`

Na inicialização, se não existir usuário `admin@sistema.com` com perfil `admin`, o sistema cria automaticamente:
- Email: `admin@sistema.com` / Senha: `123456`
- Posto: CEL PM / Nome: ADMINISTRADOR / Matrícula: `000000`

⚠️ Essa credencial deve ser alterada em produção — não há verificação de primeira execução.

### RN-04 — Nomes e emails
🟢 CONFIRMADO — `app/services/usuarios.py`

- `nome` armazenado em **UPPERCASE** (normalização automática)
- `email` normalizado para **lowercase**
- `nome_completo` calculado: `posto_graduacao + " " + nome`

### RN-05 — Matrícula
🟡 INFERIDO — frontend `user_form.html` (placeholder "inicia com 1000")

Matrícula com 9 dígitos, começando com "1000" (ex: `100012345`). Regra validada apenas no frontend; o banco exige apenas `UNIQUE NOT NULL`.

### RN-06 — Validação de campos de crimes/contravenções
🟢 CONFIRMADO — `app/utils.py:validar_campos_crime`

| Campo | Regra |
|-------|-------|
| `artigo` | apenas dígitos (`^[0-9]+$`) |
| `paragrafo` | ordinal (`1º`, `2º`) ou "único"; números puros convertidos automaticamente para ordinal |
| `inciso` | algarismos romanos maiúsculos (IVXLCDM); forçado para uppercase |
| `alinea` | única letra minúscula (a-z); forçado para lowercase |

### RN-07 — Soft delete como padrão
🟢 CONFIRMADO — múltiplos módulos

Quase todas as entidades usam soft delete (`ativo = FALSE`). **Exceção única:** `transgressoes` do RDPM usa hard DELETE. Verificar FKs antes de replicar.

### RN-08 — Unicidade de processo
🟢 CONFIRMADO — `alembic/versions/0001_bootstrap_core_tables.py:86`

```
CONSTRAINT uq_proc_numero_doc_ano UNIQUE (numero, documento_iniciador, ano_instauracao)
```

Na prática, o código verifica: `(numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)` — mais restritivo que a constraint do banco.

### RN-09 — PAD/CD/CJ não têm Encarregado
🟢 CONFIRMADO — `app/services/processos_service.py:493`

Para processos do tipo `(tipo_geral='processo' AND tipo_detalhe IN ('PAD','CD','CJ'))`, os campos `responsavel_id` e `responsavel_tipo` são forçados para NULL. Esses processos usam `presidente_id` no lugar.

### RN-10 — PADS exige transgressão
🟢 CONFIRMADO — `web/static/js/procedure_form.js:3121`

Validação client-side: PADS sem transgressão selecionada não pode ser submetido.
🟢 CONFIRMADO pelo usuário (`questions.md#1`): a migração Rust/Tauri deve adicionar a mesma validação no backend.

### RN-11 — Penalidade somente para "Punido"
🟢 CONFIRMADO — `app/services/processos_service.py:541`

```
se solucao_tipo != 'Punido':
    penalidade_tipo = None
    penalidade_dias = None
```

Backend descarta penalidade se solução não for "Punido", independente do que chegar do frontend.

### RN-12 — Dias de penalidade somente para Prisão/Detenção
🟢 CONFIRMADO — `app/services/processos_service.py:546`

```
se penalidade_tipo NOT IN ('Prisao', 'Detencao'):
    penalidade_dias = None
```

Repreensão, Licenciado_Disciplina, Excluido_Disciplina e Demitido_Exoficio não têm dias.

### RN-13 — Datas não podem ser futuras
🟢 CONFIRMADO — `web/static/js/procedure_form.js:3162`

Validação client-side impede que os campos abaixo sejam datas futuras:
- `data_instauracao`, `data_recebimento`, `data_conclusao`, `data_remessa_encarregado`, `data_julgamento`

🟢 CONFIRMADO pelo usuário (`questions.md#1`): a migração Rust/Tauri deve adicionar validação backend para `data_instauracao` e `data_conclusao`.

### RN-14 — Prazos processuais base
🟢 CONFIRMADO — `app/services/prazos_andamentos.py:443` + validação do usuário em `questions.md#2`

| Tipo | Prazo base |
|------|-----------|
| SR | 30 dias |
| IPM | 40 dias |
| SV | 30 dias |
| FP | 15 dias |
| CP | 15 dias |
| PAD, PADE, CD, CJ, PADS | 30 dias |
| Feito Preliminar (documento_iniciador) | 15 dias |

**Precedência:** `documento_iniciador == 'Feito Preliminar'` tem prioridade sobre `tipo_detalhe`.
**Default:** 30 dias para tipos não mapeados.

### RN-15 — Natureza do processo por transgressões
🟢 CONFIRMADO — `app/services/processos_service.py:17`

```
se múltiplas naturezas entre as transgressões → "Múltiplas"
se apenas uma natureza → normalizar (media→Média, leve→Leve, grave→Grave)
se sem transgressões → usar natureza_original
```

### RN-16 — Andamentos: inserção no início
🟢 CONFIRMADO — `app/services/prazos_andamentos.py`

Novos andamentos são inseridos no início da lista JSON (mais recente primeiro na estrutura interna). A exibição ordena ascendente (mais antigo primeiro) com numeração `#1, #2, ...`.

### RN-17 — Histórico de encarregados
🟢 CONFIRMADO — `main.py` + schema

Substituição de encarregado não apaga o anterior. Estrutura JSON:
```json
[{"encarregado_id": "...", "nome": "...", "data_substituicao": "...", "justificativa": "..."}]
```

### RN-18 — Indicios: upsert destrutivo
🟢 CONFIRMADO — `app/services/indicios.py`

Ao salvar indícios de um PM: DELETE em crimes, rdpm e art29 ligados ao `pm_indicios_id`, depois re-INSERT. Não há versionamento de indícios.

### RN-19 — Estatística IPM: "Não houve indícios"
🟢 CONFIRMADO — `app/routers/processos.py:166`

Um PM em IPM/IPPM concluído conta como "Sem Indícios" se:
- categoria ILIKE `%não houve indícios%`, **OU**
- nenhum registro de indícios (`pm_envolvido_indicios`) cadastrado (interpretado como arquivado)

### RN-20 — Inconsistência de hash na atualização de usuário
🟢 CONFIRMADO — `app/services/usuarios.py` + validação do usuário em `questions.md#7`

`cadastrar_usuario` usa `bcrypt` via `db_manager.hash_password`.
`atualizar_usuario` usa SHA-256 diretamente para novas senhas — inconsistência confirmada pelo Arqueólogo. Senhas de usuários atualizados ficam em SHA-256 até o próximo login.

**Na migração Rust/Tauri: uniformizar para bcrypt em ambas as operações.**

### RN-21 — Padrão de resposta duplo
🟡 INFERIDO — observado em múltiplos módulos

Dois padrões de resposta coexistem:
- `{sucesso: bool, mensagem: str, dados: [...]}` — módulos principais (processos, usuários, etc.)
- `{success: bool, error: str, data: [...]}` — módulos de catálogos/RDPM/Art.29

O frontend trata ambos com fallback (`dados || data`, `sucesso || success`).

---

## Entidades e Relacionamentos Principais

```
usuarios (1)──(N) processos_procedimentos [responsavel_id / presidente_id / escrivao_id]
usuarios (1)──(N) procedimento_pms_envolvidos [pm_id]
processos_procedimentos (1)──(N) procedimento_pms_envolvidos [procedimento_id]
procedimento_pms_envolvidos (1)──(1) pm_envolvido_indicios [pm_envolvido_id]
pm_envolvido_indicios (1)──(N) pm_envolvido_crimes → crimes_contravencoes
pm_envolvido_indicios (1)──(N) pm_envolvido_rdpm → transgressoes
pm_envolvido_indicios (1)──(N) pm_envolvido_art29 → infracoes_estatuto_art29
processos_procedimentos (1)──(N) prazos_processo [processo_id]
processos_procedimentos.andamentos → JSONB inline (sem tabela própria)
processos_procedimentos.historico_encarregados → JSONB inline
```

> 🟢 CONFIRMADO pelo usuário (`questions.md#5`): tabelas `procedimentos_indicios_crimes/rdpm/art29` devem ser incluídas na migração Rust, mesmo sem uso ativo confirmado no código Python analisado.
