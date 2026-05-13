# language: pt
# spec-id: PT-002
# rastreabilidade:
#   process_flows: _reversa_sdd/permissions.md; _reversa_sdd/migration/target_business_rules.md BR-MIGRAR-003
#   target_architecture: guards Tauri compartilhados
#   paradigma_alvo: Rust/Tauri idiomatico

Funcionalidade: RBAC por perfil
  Como administrador do sistema
  Quero que somente admins alterem dados
  Para preservar a regra aprovada de leitura para demais perfis

  @paridade @critico
  Cenário: Admin pode criar, editar e remover em todos os modulos
    Dado uma sessao com perfil admin
    Quando comandos de criacao, edicao e remocao sao executados em usuarios, processos, catalogos, mapas e auditoria aplicavel
    Então cada comando autorizado segue para validacao de dominio
    E nao retorna erro de autorizacao

  @paridade @critico
  Cenário: Perfil comum possui apenas leitura
    Dado uma sessao com perfil comum
    Quando o usuario executa comandos de listagem, detalhe, estatisticas ou relatorios
    Então os comandos retornam dados permitidos
    Quando o usuario executa qualquer comando de criar, editar ou remover
    Então o sistema retorna erro de autorizacao
    E nenhum dado e alterado no PostgreSQL

  @paridade @critico
  Cenário: Acoes de escrita nao aparecem habilitadas na UI para nao admin
    Dado uma sessao com perfil comum
    Quando qualquer tela modernizada e renderizada
    Então botoes de criar, editar, excluir, salvar e confirmar escrita ficam ocultos ou desabilitados
    E os dados permanecem consultaveis
