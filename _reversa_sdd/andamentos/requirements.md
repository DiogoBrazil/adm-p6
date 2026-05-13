# Andamentos — Requisitos

## Visão Geral

Módulo de registro de andamentos (movimentações) dos processos. Diferente dos prazos (que têm tabela própria), os andamentos são armazenados como JSONB no campo `processos_procedimentos.andamentos` — uma lista de objetos ordenada cronologicamente (mais recente primeiro).

## Responsabilidades

- Adicionar andamento a um processo
- Listar andamentos de um processo
- Remover andamento específico de um processo
- Listar tipos de andamento disponíveis
- Calcular prazo de processo por tipo

## Regras de Negócio

- 🟢 **RN-01** — Andamentos armazenados como JSONB no campo `processos_procedimentos.andamentos` — não em tabela separada (`prazos_andamentos.py:113`)
- 🟢 **RN-02** — Novo andamento inserido no **início** da lista (mais recente primeiro) (`prazos_andamentos.py:142`)
- 🟢 **RN-03** — Cada andamento contém: `{id: UUID, texto: str, data: str, usuario: str}` (`prazos_andamentos.py:134`)
- 🟢 **RN-04** — Se `usuario_nome` não informado, padrão = `"Sistema"` (`prazos_andamentos.py:139`)
- 🟢 **RN-05** — Remoção por `id` — filtra a lista e reescreve o JSONB
- 🟡 **RN-06** — `listar_andamentos` normaliza campos alternativos (`texto/descricao/descricao_andamento/observacoes`) para compatibilidade com registros legados (`prazos_andamentos.py:210`)
- 🟡 **RN-07** — Existe alias `listar_andamentos_processo` → `listar_andamentos` para compatibilidade

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Adicionar andamento a um processo | Must | Insere no início da lista JSONB; retorna andamento criado |
| RF-02 | Listar andamentos de um processo | Must | Retorna lista normalizada com campos `texto`, `usuario`, `data`, `id` |
| RF-03 | Remover andamento por ID | Should | Remove da lista JSONB; reescreve o campo |
| RF-04 | Listar tipos de andamento disponíveis | Could | Retorna enum de tipos válidos |
| RF-05 | Calcular prazo por tipo de processo | Could | Retorna data_vencimento dado tipo e data_inicio |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Somente usuários logados | `guard_login()` em todos os handlers | 🟢 |
| Consistência | Andamentos lidos e escritos atomicamente via UPDATE | `prazos_andamentos.py:145` | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Adicionar andamento
  Dado processo ativo com ID "uuid-x"
  Quando adicionar_andamento("uuid-x", "Notificado o sindicado", "CAP PM SILVA")
  Então andamento inserido no início da lista; campo andamentos atualizado no banco

Cenário: Listar andamentos normaliza campos legados
  Dado andamento com campo "descricao_andamento" em vez de "texto"
  Quando listar_andamentos("uuid-x")
  Então andamento retornado com campo "texto" preenchido com o valor de "descricao_andamento"

Cenário: Remover andamento
  Dado andamento com id "uuid-andamento-y"
  Quando remover_andamento("uuid-x", "uuid-andamento-y")
  Então andamento removido; restante da lista preservado
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Adicionar + listar + remover | Must | CRUD básico da tela de andamentos |
| Tipos de andamento | Could | Auxiliar de UI |
| Calcular prazo | Could | Auxiliar de cálculo |

## Rastreabilidade de Código

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `app/routers/andamentos.py` | 6 handlers @eel.expose | 🟢 |
| `app/services/prazos_andamentos.py` | `adicionar_andamento`, `listar_andamentos`, `remover_andamento` | 🟢 |
