# language: pt
# spec-id: PT-007
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/andamentos.md; _reversa_sdd/andamentos/requirements.md
#   target_architecture: movements
#   paradigma_alvo: Rust/Tauri com structs serializaveis

Funcionalidade: Andamentos
  Como operador autorizado
  Quero consultar e manter andamentos do procedimento
  Para preservar o historico processual

  @paridade @critico
  Cenário: Adicionar andamento no inicio do JSONB
    Dado uma sessao admin e um procedimento com andamentos existentes
    Quando movements.add recebe texto e usuario
    Então o novo andamento fica na primeira posicao
    E contem id, texto, data e usuario
    E o JSONB continua legivel pelo DTO alvo

  @paridade @critico
  Cenário: Remover andamento por id
    Dado uma sessao admin e um procedimento com andamento existente
    Quando movements.remove recebe o id do andamento
    Então o andamento e removido do JSONB
    E os demais andamentos permanecem inalterados

  @paridade
  Cenário: Normalizar andamentos legados com campos alternativos
    Dado um procedimento com andamentos em formato legado
    Quando movements.list e executado
    Então a resposta retorna uma lista tipada sem perder texto, data ou usuario
