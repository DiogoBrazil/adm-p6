# Mapas — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `processos_procedimentos` com dados
- [ ] Tabela de mapas salvos disponível (confirmar nome)
- [ ] Guard `guard_login` implementado

## Tarefas

- [ ] T-01 — Implementar `gerar_mapa_mensal(mes, ano, tipo_processo)`
  - Origem: `app/services/mapas_relatorios.py:32`
  - Critério: filtra por tipo_detalhe; "Em andamento" = instaurado até o mês; "Concluído" = concluído no mês; JOIN usuarios para nomes
  - Confiança: 🟢

- [ ] T-02 — Implementar `gerar_mapa_completo(mes, ano)`
  - Origem: `app/services/mapas_relatorios.py:250`
  - Critério: chama gerar_mapa_mensal para cada tipo disponível; retorna dict por tipo
  - Confiança: 🟢

- [ ] T-03 — Implementar `salvar_mapa_mensal(db_manager, dados_completos, usuario_logado?)`
  - Origem: `app/services/mapas_relatorios.py:358`
  - Critério: INSERT na tabela de mapas com metadados e dados JSONB
  - Confiança: 🟢

- [ ] T-04 — Implementar `listar_mapas_anteriores()`
  - Origem: `app/services/mapas_relatorios.py:442`
  - Critério: retorna lista de mapas com metadados (sem dados completos)
  - Confiança: 🟢

- [ ] T-05 — Implementar `obter_dados_mapa_salvo(mapa_id)`
  - Origem: `app/services/mapas_relatorios.py:496`
  - Critério: retorna mapa completo com metadados + dados
  - Confiança: 🟢

- [ ] T-06 — Implementar `excluir_mapa_salvo(mapa_id)`
  - Origem: `app/services/mapas_relatorios.py:549`
  - Critério: DELETE da tabela de mapas
  - Confiança: 🟢

- [ ] T-07 — Implementar `obter_tipos_processo_para_mapa()`
  - Origem: `app/services/mapas_relatorios.py:1573`
  - Critério: retorna lista de tipos disponíveis (IPM, PAD, SR, etc.)
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Mapa de Janeiro/2025 retorna apenas processos instaurados até Jan/2025
- [ ] TT-02 — Processos concluídos em Fevereiro não aparecem no mapa de Janeiro
- [ ] TT-03 — Mapa completo inclui todos os tipos configurados

## Ordem Sugerida

1. T-07 (tipos — necessário para UI)
2. T-01, T-02 (geração)
3. T-03, T-04, T-05, T-06 (persistência)

## Lacunas

- 🔴 Confirmar nome exato da tabela que armazena mapas salvos (não identificada no ERD)
- 🟡 Filtros `mes/ano/tipo` em `listar_mapas_salvos` são recebidos pelo router mas não repassados ao service — corrigir na migração
