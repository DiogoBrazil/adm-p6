# Usuários — Requisitos

## Visão Geral

Módulo de gerenciamento da entidade `usuarios` — estrutura unificada que consolida PMs e operadores do sistema em uma única tabela. Gerencia cadastro, autenticação via perfil, papéis de encarregado/operador e estatísticas de vinculação com processos.

## Responsabilidades

- CRUD completo de usuários (Oficiais e Praças da PMRO)
- Cadastro de operadores do sistema (email + senha + perfil admin/comum)
- Listagem com paginação e busca
- Estatísticas de vinculação do PM com processos por papel
- Soft delete (`ativo=FALSE`) com auditoria
- Verificação de privilégio de administrador do usuário logado

## Regras de Negócio

- 🟢 **RN-01** — `tipo_usuario IN ('Oficial', 'Praça')` — valores aceitos
- 🟢 **RN-02** — Matrícula única na tabela `usuarios` (`usuarios_service.py:131`)
- 🟢 **RN-03** — Email único, obrigatório para operadores, validado (`usuarios_service.py:136`)
- 🟢 **RN-04** — Senha obrigatória para operadores; mínimo 4 caracteres (`usuarios_service.py:121`)
- 🟢 **RN-05** — `perfil IN ('admin', 'comum')`, obrigatório para operadores (`usuarios_service.py:123`)
- 🟢 **RN-06** — Nome armazenado em UPPER CASE (`usuarios_service.py:143`)
- 🟢 **RN-07** — Email armazenado em lower case (`usuarios_service.py:144`)
- 🟢 **RN-08** — Soft delete: `ativo=FALSE`; não aparece em listagens ativas
- 🟢 **RN-09** — Auditoria registrada em CREATE e UPDATE (`usuarios_service.py:165`)
- 🟢 **RN-10** — PM "A APURAR" — registro especial sem posto/matrícula (`processos_service.py:87`)
- 🟢 **RN-11** — Na migração Rust/Tauri, administrador deve ser impedido de desativar a própria conta, com erro descritivo (confirmado pelo usuário em `questions.md#8`). O legado não possui essa guard.
- 🟢 **RN-12** — `is_encarregado` e `is_operador` são flags booleanas independentes; um PM pode ser ambos
- 🟢 **RN-13** — `atualizar_usuario` armazena nova senha com **SHA-256** (`hashlib.sha256()`), não bcrypt — confirmado em `app/services/usuarios.py:348`. Isso reverte o upgrade SHA-256→bcrypt feito no login. **BUG**: deve usar bcrypt na migração Rust.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Cadastrar usuário (PM ou operador) | Must | Persiste com unicidade de matrícula e email |
| RF-02 | Listar usuários com paginação e busca | Must | Filtro por nome/matrícula; paginação por página |
| RF-03 | Listar todos os usuários ativos | Must | Retorna lista completa sem paginação |
| RF-04 | Listar encarregados e operadores | Must | Filtro por `is_encarregado OR is_operador` |
| RF-05 | Obter usuário por ID | Must | Retorna dados completos incluindo `vinculo_texto` |
| RF-06 | Obter usuário detalhado (para edição) | Must | Retorna apenas campos editáveis, sem senha |
| RF-07 | Atualizar usuário | Must | Valida unicidade de email/matrícula; senha opcional na atualização |
| RF-08 | Desativar usuário (soft delete) | Must | `ativo=FALSE` + auditoria |
| RF-09 | Verificar se usuário logado é admin | Should | Retorna bool baseado no `perfil` da sessão |
| RF-10 | Obter estatísticas de vinculação do usuário | Should | Contagens por papel em processos ativos |
| RF-11 | Listar processos onde usuário é responsável | Should | Filtro por `responsavel_id` |
| RF-12 | Listar processos onde usuário é escrivão | Should | Filtro por `escrivao_id` |
| RF-13 | Listar processos onde usuário está envolvido | Should | Filtro em `procedimento_pms_envolvidos` |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Apenas admins podem criar/atualizar/excluir usuários | `guard_admin()` em cadastrar, atualizar, delete | 🟢 |
| Segurança | Cadastro usa bcrypt; atualização legada usa SHA-256, mas a migração deve usar bcrypt também em `atualizar_usuario` | `db_manager.hash_password(senha)` + `questions.md#7` | 🟢 |
| Integridade | Matrícula e email únicos verificados antes do INSERT | `usuarios_service.py:131,136` | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Cadastrar PM encarregado sem operador
  Dado usuário admin logado
  Quando cadastrar_usuario(tipo_usuario="Praça", posto_graduacao="SD PM", nome="João Silva",
        matricula="12345", is_encarregado=True, is_operador=False)
  Então usuário criado com ativo=TRUE; auditoria CREATE registrada

Cenário: Cadastrar operador admin
  Dado usuário admin logado
  Quando cadastrar_usuario(tipo_usuario="Oficial", posto_graduacao="CAP PM", nome="Maria Santos",
        matricula="67890", is_operador=True, email="maria@pm.ro.gov.br", senha="1234", perfil="admin")
  Então usuário criado; senha armazenada como hash; email em lower case; nome em UPPER CASE

Cenário: Matrícula duplicada
  Dado matrícula "12345" já cadastrada
  Quando tentar cadastrar usuário com mesma matrícula
  Então retornar {sucesso: false, mensagem: "Matrícula já cadastrada!"}

Cenário: Operador sem email
  Dado usuário admin logado
  Quando cadastrar_usuario(is_operador=True, email=None)
  Então retornar {sucesso: false, mensagem: "Email é obrigatório para operadores!"}

Cenário: Soft delete
  Dado usuário ativo com ID "uuid-x"
  Quando delete_user("uuid-x")
  Então ativo=FALSE; usuário não aparece em listar_todos_usuarios()

Cenário: Admin tenta desativar a própria conta
  Dado admin logado com ID "uuid-admin"
  Quando delete_user("uuid-admin")
  Então retornar erro descritivo e manter ativo=TRUE
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| CRUD básico (RF-01 a RF-08) | Must | Gestão fundamental de usuários do sistema |
| Verificar admin (RF-09) | Should | Necessário para controle de UI |
| Estatísticas (RF-10) | Should | Tela de perfil do usuário |
| Processos vinculados (RF-11 a RF-13) | Could | Consultas de apoio à gestão |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `app/routers/usuarios.py` | 13 handlers @eel.expose | 🟢 |
| `app/services/usuarios.py` | `cadastrar_usuario`, `listar_usuarios`, `atualizar_usuario`, `deletar_usuario`, `obter_estatisticas_usuario` | 🟢 |
| `db_config.py` | `hash_password`, `get_paginated_users` | 🟢 |
