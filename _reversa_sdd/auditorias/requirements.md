# Auditorias — Requisitos

## Visão Geral

Módulo de consulta ao log de auditoria do sistema. A tabela `auditoria` é alimentada passivamente por todos os outros módulos via `db_manager.registrar_auditoria()`. Este módulo provê as funções de leitura: listagem paginada, detalhe de registro, histórico por entidade, histórico por usuário e estatísticas.

## Responsabilidades

- Listar registros de auditoria com paginação e filtros
- Obter detalhes de um registro de auditoria
- Obter histórico de auditorias de um registro específico (por tabela + ID)
- Obter histórico de ações de um usuário
- Gerar estatísticas de auditoria por período

## Regras de Negócio

- 🟢 **RN-01** — Apenas administradores podem acessar auditorias (`guard_admin()` em todos os handlers)
- 🟢 **RN-02** — Auditoria registrada automaticamente em CREATE/UPDATE/DELETE pelos outros módulos via `registrar_auditoria(tabela, registro_id, operacao, usuario_id)`
- 🟢 **RN-03** — `operacao IN ('CREATE', 'UPDATE', 'DELETE')` — valores da coluna `operacao`
- 🟢 **RN-04** — `usuario_id` pode ser NULL (operações do Sistema sem usuário logado)
- 🟢 **RN-05** — Listagem paginada; ordenação por `timestamp DESC`
- 🟢 **RN-06** — Busca por texto filtra: nome do usuário, tabela, registro_id

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Listar auditorias com paginação | Must | Filtros por operação e tabela; busca por texto |
| RF-02 | Obter auditoria detalhada | Must | Retorna registro completo com nome do usuário |
| RF-03 | Obter auditorias por registro | Should | Histórico de operações em uma entidade específica |
| RF-04 | Obter auditorias por usuário | Should | Histórico de ações de um operador |
| RF-05 | Estatísticas de auditoria | Could | Contagens por operação e tabela em período |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Somente admins podem consultar auditorias | `guard_admin()` em todos os handlers | 🟢 |
| Rastreabilidade | Cada operação relevante registrada antes de ser confirmada | `registrar_auditoria` em todos os módulos | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Listar auditorias
  Dado admin logado
  Quando listar_auditorias(page=1, per_page=10)
  Então retornar auditorias paginadas com nome do usuário, tabela, operação e timestamp

Cenário: Filtrar por operação
  Quando listar_auditorias(filtros={operacao: "DELETE"})
  Então retornar apenas auditorias de DELETE

Cenário: Histórico de um processo
  Quando obter_auditorias_por_registro(tabela="processos_procedimentos", registro_id="uuid-x")
  Então retornar CREATE + todos os UPDATE + DELETE de "uuid-x"

Cenário: Acesso negado a não-admin
  Dado usuário comum logado
  Quando listar_auditorias()
  Então retornar erro de autorização
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Listar + obter detalhado | Must | Acesso básico ao log de auditoria |
| Por registro + por usuário | Should | Rastreabilidade de entidade/operador |
| Estatísticas | Could | Dashboard de segurança |

## Rastreabilidade de Código

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `app/routers/auditorias.py` | 5 handlers @eel.expose | 🟢 |
| `app/services/auditorias.py` | `listar_auditorias`, `obter_auditoria_detalhada`, `obter_auditorias_por_registro`, `obter_auditorias_por_usuario`, `obter_estatisticas_auditoria` | 🟢 |
| `db_config.py:registrar_auditoria` | Escrita de registros (passiva) | 🟢 |
