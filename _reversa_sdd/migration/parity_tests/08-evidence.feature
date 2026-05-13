# language: pt
# spec-id: PT-008
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/indicios.md; _reversa_sdd/indicios/requirements.md
#   target_architecture: evidence
#   paradigma_alvo: Rust/Tauri com transacao sqlx

Funcionalidade: Indicios
  Como admin
  Quero associar indicios a PM envolvido
  Para alimentar estatisticas e relatorios

  @paridade @critico
  Cenário: Salvar indicios e idempotente por PM envolvido
    Dado uma sessao admin e um PM envolvido existente
    Quando evidence.save_for_involved_pm recebe crimes, RDPM, Art. 29 e categorias
    Então os vinculos antigos sao substituidos pelos novos em uma transacao
    E existe um registro ativo por PM envolvido
    E repetir o mesmo payload nao duplica vinculos

  @paridade @critico
  Cenário: Buscar catalogos para indicios
    Dado catalogos ativos de crimes, RDPM e Art. 29
    Quando evidence.search_catalogs recebe um termo
    Então a resposta contem resultados equivalentes ao legado para o mesmo termo
    E categorias JSONB continuam preservadas

  @paridade
  Cenário: Carregar indicios de PM envolvido
    Dado um PM envolvido com indicios salvos
    Quando evidence.load_for_involved_pm e executado
    Então os ids e categorias retornam no formato esperado pela UI modernizada
