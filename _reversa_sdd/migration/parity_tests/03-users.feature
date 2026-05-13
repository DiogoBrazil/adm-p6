# language: pt
# spec-id: PT-003
# rastreabilidade:
#   process_flows: _reversa_sdd/flowcharts/usuarios.md; _reversa_sdd/usuarios/requirements.md
#   target_architecture: users
#   paradigma_alvo: Rust/Tauri com DTOs tipados e validadores

Funcionalidade: CRUD de usuarios
  Como admin
  Quero gerenciar usuarios, operadores e encarregados
  Para manter os mesmos cadastros do legado

  @paridade @critico
  Cenário: Criar operador com normalizacao e senha valida
    Dado uma sessao admin
    Quando users.create recebe nome, email, matricula, tipo_usuario, perfil e senha valida
    Então o usuario e salvo ativo
    E nome fica em uppercase
    E email fica em lowercase
    E a senha e armazenada com bcrypt
    E uma auditoria de CREATE e registrada

  @paridade @critico
  Cenário: Rejeitar duplicidade de matricula ou email
    Dado um usuario existente com matricula ou email
    Quando users.create recebe a mesma matricula ou email
    Então o sistema retorna erro de unicidade
    E nenhum usuario adicional e criado

  @paridade @critico
  Cenário: Bloquear autodesativacao de admin
    Dado uma sessao admin do proprio usuario alvo
    Quando users.update tenta desativar esse mesmo usuario admin
    Então o sistema retorna erro de regra de negocio
    E o usuario permanece ativo

  @paridade
  Cenário: Soft delete preserva historico
    Dado uma sessao admin e um usuario ativo
    Quando users.delete e executado
    Então o usuario deixa de aparecer em listagens ativas
    E registros historicos continuam referenciaveis
    E uma auditoria de DELETE e registrada
