# language: pt
# spec-id: PT-001
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/auth.md; _reversa_sdd/autenticacao/requirements.md
#   target_architecture: auth
#   paradigma_alvo: Rust/Tauri idiomatico com Result e AppState

Funcionalidade: Autenticacao e sessao
  Como operador ativo
  Quero entrar e sair do sistema
  Para acessar os modulos permitidos sem perder compatibilidade com usuarios legados

  @paridade @critico
  Cenário: Login de operador ativo com senha bcrypt
    Dado um usuario operador ativo com senha bcrypt valida
    Quando o comando Tauri auth.login recebe email e senha corretos
    Então o sistema retorna ok igual a verdadeiro
    E a sessao atual contem id, nome, perfil e is_admin calculado por perfil
    E a tela inicial navegavel e Dashboard

  @paridade @critico
  Cenário: Login de operador ativo com hash SHA-256 legado faz upgrade transparente
    Dado um usuario operador ativo com senha armazenada em SHA-256 legado
    Quando o comando Tauri auth.login recebe a senha correta
    Então o login e aceito
    E o hash armazenado passa a usar bcrypt
    E o usuario nao precisa redefinir a senha

  @paridade @critico
  Cenário: Usuario inativo ou nao operador nao autentica
    Dado um usuario inativo ou com is_operador falso
    Quando o comando Tauri auth.login recebe credenciais corretas
    Então o sistema retorna erro de autenticacao
    E nenhuma sessao e criada

  @paridade
  Cenário: Logout limpa sessao local
    Dado um usuario autenticado
    Quando o comando Tauri auth.logout e executado
    Então a sessao atual fica vazia
    E comandos protegidos passam a retornar erro de autorizacao
