# language: pt
# spec-id: PT-005
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/processos.md; _reversa_sdd/processos/requirements.md
#   target_architecture: proceedings
#   paradigma_alvo: Rust/Tauri com aggregates e enums de dominio

Funcionalidade: Processos e procedimentos
  Como admin
  Quero cadastrar, editar, consultar e concluir procedimentos
  Para preservar o modulo central do sistema

  @paridade @critico @regulatorio
  Cenário: Criar IPM com prazo inicial de 40 dias
    Dado uma sessao admin e dados validos de procedimento tipo IPM
    Quando proceedings.create e executado
    Então o procedimento e criado
    E o prazo inicial ativo tem 40 dias
    E nenhuma referencia a IPPM e criada
    E uma auditoria de CREATE e registrada

  @paridade @critico
  Cenário: Rejeitar datas futuras
    Dado uma sessao admin
    Quando proceedings.create ou proceedings.update recebe data_instauracao ou data_conclusao futura
    Então o sistema retorna erro de validacao
    E nenhum dado invalido e persistido

  @paridade @critico
  Cenário: Rejeitar PADS sem transgressao
    Dado uma sessao admin
    Quando proceedings.create recebe tipo PADS sem transgressao associada
    Então o sistema retorna erro de regra de negocio
    E o procedimento nao e criado

  @paridade @critico
  Cenário: Consultar procedimento completo agrega envolvidos, indicios, prazos e andamentos
    Dado um procedimento existente com envolvidos, indicios, prazos e andamentos
    Quando proceedings.get_complete e executado
    Então a resposta contem os mesmos blocos de dados observaveis no legado
    E os campos JSONB legados sao normalizados para DTOs tipados

  @paridade @critico
  Cenário: Reabrir processo concluido
    Dado um procedimento concluido
    Quando uma sessao admin executa a transicao de reabertura
    Então o procedimento volta ao estado ativo permitido
    E a transicao fica auditada
