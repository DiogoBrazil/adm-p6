# RDPM — Transgressões Disciplinares

## Visão Geral

Módulo que gerencia o catálogo de transgressões disciplinares da Polícia Militar conforme o Regulamento Disciplinar da Polícia Militar (RDPM). Fornece dados de referência para classificação de indícios em processos disciplinares.

## Responsabilidades

- CRUD de transgressões disciplinares (restrito a admins)
- Listagem e busca de transgressões para usuários autenticados
- Garantir unicidade de `(gravidade, inciso)` na atualização
- Registro de auditoria em todas as operações (incluindo DELETE)

## Regras de Negócio

- 🟢 **RN-01** — CRUD requer `perfil = 'admin'` (`app/routers/rdpm.py:16,39,54`)
- 🟢 **RN-02** — **Hard delete** (DELETE real, não soft delete) — único módulo com essa exceção (`app/rdpm.py`)
- 🟢 **RN-03** — Auditoria registrada em CREATE, UPDATE **e DELETE** (`app/routers/rdpm.py`)
- 🟢 **RN-04** — Listagem ordena por artigo + inciso (`app/rdpm.py`)
- 🟢 **RN-05** — Gravidade formatada em title-case na leitura: `gravidade.title()` (`app/rdpm.py`)
- 🟢 **RN-06** — Unicidade de `(gravidade, inciso)` case-insensitive verificada na atualização (excluindo o próprio registro) (`app/rdpm.py`)
- 🟢 **RN-07** — `id` é SERIAL (inteiro auto-increment), não UUID (`alembic/versions/0001_bootstrap_core_tables.py:105`)

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Listar todas as transgressões | Must | Retorna lista ordenada por artigo+inciso com gravidade em title-case |
| RF-02 | Buscar transgressão por ID | Must | Retorna transgressão ou erro |
| RF-03 | Cadastrar transgressão | Must | Persiste + auditoria CREATE |
| RF-04 | Atualizar transgressão com check de unicidade | Must | Rejeita duplicata (gravidade,inciso); auditoria UPDATE |
| RF-05 | Excluir transgressão (hard delete) | Must | DELETE real; auditoria DELETE |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Integridade | Exclusão deve ser bloqueada quando houver referência em `pm_envolvido_rdpm` | Schema sem CASCADE + decisão do usuário em `questions.md#13` | 🟢 |
| Segurança | Escrita restrita a admins | `app/routers/rdpm.py:16,39,54` | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Listar transgressões
  Dado usuário logado
  Quando chamar listar_todas_transgressoes()
  Então retornar lista com gravidade em title-case, ordenada por artigo+inciso

Cenário: Atualizar com duplicata
  Dado transgressão A=(Grave, "I") e transgressão B=(Grave, "II") no banco
  Quando atualizar B para (Grave, "I")
  Então retornar erro de duplicidade

Cenário: Excluir transgressão
  Dado admin e transgressão existente
  Quando excluir_transgressao(id)
  Então DELETE real no banco + auditoria DELETE registrada

Cenário: Excluir transgressão referenciada
  Dado transgressão com registros em pm_envolvido_rdpm
  Quando excluir_transgressao(id)
  Então retornar erro descritivo e não executar DELETE
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Listar transgressões | Must | Necessário para formulário de indícios |
| CRUD (admin) | Must | Manutenção do catálogo legal |
| Check de unicidade na atualização | Must | Integridade do catálogo |
| Hard delete protegido | Should | Manter DELETE real apenas quando não houver referências; bloquear exclusão referenciada |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `app/routers/rdpm.py` | `register()` — 5 handlers | 🟢 |
| `app/rdpm.py` | Funções de acesso ao banco | 🟢 |
