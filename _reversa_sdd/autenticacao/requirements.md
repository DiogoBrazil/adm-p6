# Autenticação

## Visão Geral

Módulo responsável pelo ciclo de vida da sessão do usuário no sistema Gestão P6. Controla login, logout e consulta do usuário logado. A sessão é mantida em memória enquanto o processo Eel estiver rodando — não persiste entre reinicializações.

## Responsabilidades

- Validar credenciais (email + senha) contra a tabela `usuarios`
- Suportar dois algoritmos de hash: bcrypt (atual) e SHA-256 (legado), com upgrade automático
- Criar e destruir a sessão global em memória (`usuario_logado`)
- Expor o usuário logado para os demais módulos via `obter_usuario_logado()`
- Criar o usuário administrador padrão na primeira inicialização

## Regras de Negócio

- 🟢 **RN-01** — Somente usuários com `is_operador = TRUE` E `ativo = TRUE` podem fazer login (`main.py:193`)
- 🟢 **RN-02** — Se o hash armazenado começa com `$2`, usar bcrypt; caso contrário, usar SHA-256 (`main.py:204`)
- 🟢 **RN-03** — Após login bem-sucedido com hash SHA-256, atualizar silenciosamente para bcrypt (`main.py:213-218`)
- 🟢 **RN-04** — `is_admin` é calculado no momento do login: `perfil == 'admin'` (`main.py:234`)
- 🟢 **RN-05** — Sessão perde ao fechar o app (variável global em memória) (`main.py:672`)
- 🟢 **RN-06** — `nome_completo` é calculado: `posto_graduacao + " " + nome` (`main.py:237`)
- 🟢 **RN-07** — Admin padrão criado se não existir: `admin@sistema.com` / `123456` (`main.py:161-173`)

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Autenticar usuário com email e senha | Must | Login retorna dados do usuário e `is_admin` calculado |
| RF-02 | Rejeitar login de usuário inativo (`ativo=FALSE`) | Must | Retorna `{sucesso: false}` sem expor motivo |
| RF-03 | Rejeitar login de usuário não-operador (`is_operador=FALSE`) | Must | Retorna `{sucesso: false}` |
| RF-04 | Fazer upgrade transparente de SHA-256 para bcrypt no login | Should | Hash na tabela começa com `$2` após login com hash legado |
| RF-05 | Encerrar sessão (logout) | Must | `usuario_logado` retorna `None` após logout |
| RF-06 | Retornar dados do usuário logado | Must | Retorna dict com id, nome, email, perfil, is_admin |
| RF-07 | Criar admin padrão na inicialização | Should | Usuário `admin@sistema.com` existe se nenhum admin existir |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Senha nunca retornada nas respostas | `main.py:224-238` (dict de retorno não inclui `senha`) | 🟢 |
| Segurança | Hash bcrypt com salt único por senha | `db_config.py:176` (`bcrypt.gensalt()`) | 🟢 |
| Segurança | Credencial padrão conhecida (`123456`) mantida sem obrigatoriedade de troca no primeiro login | `main.py:167` + decisão do usuário em `questions.md#15` | 🟢 |
| Disponibilidade | Sem mecanismo de retry em falha de banco | `main.py:183-241` | 🟡 |

## Critérios de Aceitação

```gherkin
Cenário: Login bem-sucedido com bcrypt
  Dado um usuário com is_operador=TRUE, ativo=TRUE e hash bcrypt
  Quando chamar fazer_login(email, senha_correta)
  Então retornar {sucesso: true, usuario: {...}, is_admin: bool}
  E usuario_logado global deve estar preenchido

Cenário: Login com hash SHA-256 legado faz upgrade
  Dado um usuário com hash SHA-256 no banco
  Quando chamar fazer_login(email, senha_correta)
  Então autenticar com sucesso
  E atualizar hash no banco para bcrypt (começa com "$2")

Cenário: Login com senha incorreta
  Dado um usuário ativo e operador
  Quando chamar fazer_login(email, senha_errada)
  Então retornar {sucesso: false, mensagem: "..."}
  E usuario_logado global deve permanecer None

Cenário: Login de usuário inativo
  Dado um usuário com ativo=FALSE
  Quando chamar fazer_login(email, senha_correta)
  Então retornar {sucesso: false}

Cenário: Login de usuário não-operador
  Dado um usuário com is_operador=FALSE
  Quando chamar fazer_login(email, senha_correta)
  Então retornar {sucesso: false}

Cenário: Logout
  Dado que existe usuario_logado preenchido
  Quando chamar fazer_logout()
  Então usuario_logado deve ser None

Cenário: Consulta sem sessão ativa
  Dado que usuario_logado é None
  Quando chamar obter_usuario_logado()
  Então retornar {logado: false}
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Autenticação com bcrypt | Must | Caminho crítico — todos os outros módulos dependem da sessão |
| Rejeição de inativos/não-operadores | Must | Regra de segurança sem fallback |
| Upgrade SHA-256 → bcrypt | Should | Migração de dados em campo — não bloqueia operação normal |
| Consulta do usuário logado | Must | Chamada frequente pelos 12 routers |
| Criação de admin padrão | Should | Importante para primeira execução; pode ser criado manualmente |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `main.py:183-241` | `verify_login()` em `_DatabaseManagerLegacy` | 🟢 |
| `main.py:674-686` | `_guard_login()`, `_guard_admin()` | 🟢 |
| `app/routers/auth.py` | `register()` → `fazer_login`, `fazer_logout`, `obter_usuario_logado` | 🟢 |
| `main.py:161-173` | `create_admin_user()` | 🟢 |
| `db_config.py:176-178` | `hash_password()` via bcrypt | 🟢 |
