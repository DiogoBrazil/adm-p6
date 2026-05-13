# language: pt
# spec-id: PT-004
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/catalogos.md; _reversa_sdd/flowcharts/rdpm.md; _reversa_sdd/flowcharts/art29.md
#   target_architecture: legal_catalogs
#   paradigma_alvo: Rust/Tauri com enums e validadores puros

Funcionalidade: Catalogos legais
  Como admin
  Quero manter crimes, transgressoes RDPM e Art. 29
  Para alimentar processos e indicios

  @paridade @critico
  Cenário: CRUD de crimes e contravencoes preserva validacoes
    Dado uma sessao admin
    Quando legal_catalogs.create_crime recebe artigo, paragrafo, inciso, alinea e descricao validos
    Então o registro e criado
    E pode ser listado, editado e removido conforme regra de integridade

  @paridade @critico
  Cenário: RDPM respeita unicidade de gravidade e inciso
    Dado uma transgressao RDPM ativa com gravidade e inciso
    Quando legal_catalogs.create_transgression recebe a mesma gravidade e inciso
    Então o sistema retorna erro de unicidade
    E a listagem continua ordenada por artigo e inciso

  @paridade @critico
  Cenário: Exclusao de RDPM referenciada e bloqueada
    Dado uma transgressao RDPM referenciada em pm_envolvido_rdpm
    Quando legal_catalogs.delete_transgression e executado
    Então o sistema retorna erro de integridade
    E a transgressao permanece ativa

  @paridade @critico
  Cenário: Art. 29 usa inciso unico entre ativos e ordenacao romana
    Dado uma sessao admin
    Quando infracoes do Art. 29 sao listadas
    Então a ordenacao respeita incisos romanos
    E criar inciso duplicado ativo retorna erro
