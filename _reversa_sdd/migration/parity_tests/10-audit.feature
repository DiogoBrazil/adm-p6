# language: pt
# spec-id: PT-010
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/auditorias.md; _reversa_sdd/auditorias/requirements.md
#   target_architecture: audit
#   paradigma_alvo: Rust/Tauri com helper/middleware de auditoria

Funcionalidade: Auditoria
  Como admin
  Quero consultar eventos de auditoria
  Para rastrear alteracoes no sistema

  @paridade @critico
  Cenário: Escritas geram auditoria
    Dado uma sessao admin
    Quando um usuario, processo, catalogo ou mapa e criado, editado ou removido
    Então um registro de auditoria e gravado com modulo, acao, usuario, data e identificador do registro

  @paridade @critico
  Cenário: Apenas admin consulta auditoria
    Dado registros de auditoria existentes
    Quando uma sessao admin executa audit.list
    Então a listagem paginada e retornada
    Quando uma sessao comum executa audit.list
    Então o sistema retorna erro de autorizacao

  @paridade
  Cenário: Filtros de auditoria preservam resultado
    Dado registros com usuarios, modulos e datas diferentes
    Quando audit.list recebe filtros equivalentes ao legado
    Então o conjunto retornado contem os mesmos registros esperados
