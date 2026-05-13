# Art. 29 — Infrações do Estatuto PM

## Visão Geral

Módulo que gerencia o catálogo de infrações previstas no Art. 29 do Estatuto dos Policiais Militares. Complementa o RDPM como fonte de classificação de indícios. Usa UUID como PK e soft delete.

## Responsabilidades

- CRUD de infrações do Art. 29 (restrito a admins)
- Listagem com ordenação especial por inciso romano
- Garantir unicidade de inciso entre registros ativos
- Soft delete (diferente do RDPM)

## Regras de Negócio

- 🟢 **RN-01** — CRUD requer `perfil = 'admin'` (`app/routers/art29.py`)
- 🟢 **RN-02** — Soft delete (`ativo = FALSE`) — diferente do RDPM (`app/art29.py`)
- 🟢 **RN-03** — Inciso único entre registros ativos, case-insensitive (`app/art29.py`)
- 🟢 **RN-04** — Inciso e texto obrigatórios (`app/routers/art29.py`)
- 🟢 **RN-05** — Ordenação especial: incisos romanos (I, II, III...) por comprimento; demais ao final (`app/art29.py:14`)
- 🟢 **RN-06** — `id` é UUID (migrado de SERIAL pelo commit `76cb813`)

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Listar infrações ativas com ordenação romana | Must | Incisos romanos ordenados I < II < III; demais ao final |
| RF-02 | Buscar infração por ID | Must | Retorna infração ou erro |
| RF-03 | Criar infração com unicidade de inciso | Must | Rejeita inciso duplicado (ativo, case-insensitive) |
| RF-04 | Editar infração com unicidade | Must | Idem criação para o próprio registro |
| RF-05 | Excluir infração (soft delete) | Must | `ativo=FALSE`; não aparece mais em listagens |

## Critérios de Aceitação

```gherkin
Cenário: Ordenação de incisos romanos
  Dado infrações com incisos "I", "II", "III", "IV", "X", "ABC"
  Quando listar_infracoes_estatuto_art29()
  Então ordem: I, II, III, IV, X, ABC (romanos por comprimento, demais ao final)

Cenário: Criar infração com inciso duplicado
  Dado infração ativa com inciso "XV"
  Quando criar_infracao_estatuto_art29(inciso="XV", texto="...")
  Então retornar erro de unicidade

Cenário: Criar infração com inciso de inativo reutilizado
  Dado infração com inciso "XV" e ativo=FALSE
  Quando criar_infracao_estatuto_art29(inciso="XV", texto="...")
  Então criar com sucesso (inativo não conta para unicidade)
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Listar com ordenação romana | Must | Necessário para módulo de indícios |
| CRUD (admin) | Must | Manutenção do catálogo legal |
| Unicidade de inciso | Must | Integridade do catálogo |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `app/routers/art29.py` | `register()` — 5 handlers | 🟢 |
| `app/art29.py` | Funções de banco + algoritmo de ordenação | 🟢 |
