# Auditorias — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `auditoria` disponível
- [ ] Guard `guard_admin` implementado
- [ ] `registrar_auditoria` implementado (escrita — usado por outros módulos)

## Tarefas

- [ ] T-01 — Implementar `listar_auditorias(search?, page, per_page, filtros?)`
  - Origem: `app/services/auditorias.py:12`
  - Critério: paginação; filtro por operação e tabela; busca por nome/tabela/registro_id; LEFT JOIN usuarios; ordenado por timestamp DESC
  - Confiança: 🟢

- [ ] T-02 — Implementar `obter_auditoria_detalhada(auditoria_id)`
  - Origem: `app/services/auditorias.py`
  - Critério: retorna registro completo com nome do usuário
  - Confiança: 🟢

- [ ] T-03 — Implementar `obter_auditorias_por_registro(tabela, registro_id)`
  - Origem: `app/services/auditorias.py`
  - Critério: todos os registros WHERE tabela=X AND registro_id=Y; ordenado por timestamp
  - Confiança: 🟢

- [ ] T-04 — Implementar `obter_auditorias_por_usuario(usuario_id, page, per_page)`
  - Origem: `app/services/auditorias.py`
  - Critério: WHERE usuario_id=X; paginação; ordenado por timestamp DESC
  - Confiança: 🟢

- [ ] T-05 — Implementar `obter_estatisticas_auditoria(data_inicio?, data_fim?)`
  - Origem: `app/services/auditorias.py`
  - Critério: COUNT por operação, COUNT por tabela; filtro opcional por período
  - Confiança: 🟢

- [ ] T-06 — Implementar `registrar_auditoria(tabela, registro_id, operacao, usuario_id?)` (escrita)
  - Origem: `db_config.py:DatabaseManager.registrar_auditoria`
  - Critério: INSERT INTO auditoria; chamado por todos os módulos após operações mutáveis
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — CREATE de processo gera registro de auditoria com operacao='CREATE'
- [ ] TT-02 — Usuário comum não consegue chamar listar_auditorias (guard_admin)
- [ ] TT-03 — Busca por nome do usuário filtra corretamente
- [ ] TT-04 — usuario_id=NULL aparece como "Sistema" no nome

## Ordem Sugerida

1. T-06 (registrar_auditoria — escrita, base de todo o módulo)
2. T-01, T-02, T-03, T-04, T-05 (consultas)
