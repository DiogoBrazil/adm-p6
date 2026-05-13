# language: pt
# spec-id: PT-006
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/prazos.md; _reversa_sdd/prazos/requirements.md
#   target_architecture: deadlines
#   paradigma_alvo: Rust/Tauri com funcoes deterministicas

Funcionalidade: Prazos
  Como admin
  Quero calcular e prorrogar prazos
  Para acompanhar vencimentos operacionais

  @paridade @critico @regulatorio
  Cenário: Prazo inicial e calculado por tipo
    Dado um procedimento criado com tipo conhecido
    Quando deadlines.create_initial_deadline e executado
    Então o prazo ativo tem dias base equivalentes ao legado
    E IPM usa 40 dias
    E IPPM nao existe como tipo valido

  @paridade @critico
  Cenário: Prorrogacao inicia no dia seguinte ao vencimento
    Dado um prazo ativo com data de vencimento definida
    Quando deadlines.add_extension recebe dias, portaria, data da portaria e motivo
    Então o novo prazo inicia no dia seguinte ao vencimento anterior
    E o prazo anterior deixa de ser ativo
    E a ordem de prorrogacao e preservada

  @paridade
  Cenário: Dashboard de prazos lista vencidos e a vencer
    Dado procedimentos com prazos vencidos e nao vencidos
    Quando deadlines.dashboard e executado
    Então as categorias e contagens batem com o legado para a mesma data de referencia
