# Usuários — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `usuarios` com todos os campos (ver `erd-complete.md`)
- [ ] Guard `guard_login` e `guard_admin` implementados
- [ ] `hash_password` (bcrypt) implementado
- [ ] `registrar_auditoria` disponível

## Tarefas

- [ ] T-01 — Implementar `cadastrar_usuario(...)` com validações e unicidade
  - Origem: `app/services/usuarios.py:79-176`
  - Critério: rejeita matrícula ou email duplicado; nome em UPPER; email em lower; senha como hash; auditoria CREATE
  - Confiança: 🟢

- [ ] T-02 — Implementar `listar_usuarios(search, page, per_page)` com paginação
  - Origem: `app/services/usuarios.py:179-192` + `db_config.py:get_paginated_users`
  - Critério: busca por nome/matrícula; retorna `{usuarios, total, page, per_page}`
  - Confiança: 🟢

- [ ] T-03 — Implementar `listar_todos_usuarios()`
  - Origem: `app/services/usuarios.py:195-251`
  - Critério: retorna todos os ativos com `vinculo_texto` e `nome_completo` calculados; ordenado por nome ASC
  - Confiança: 🟢

- [ ] T-04 — Implementar `listar_encarregados_operadores()`
  - Origem: `app/routers/usuarios.py:65`
  - Critério: filtra `is_encarregado=TRUE OR is_operador=TRUE` entre ativos
  - Confiança: 🟢

- [ ] T-05 — Implementar `obter_usuario_por_id(id)`
  - Origem: `app/services/usuarios.py:14-75`
  - Critério: retorna todos os campos + `vinculo_texto` calculado; retorna null se não encontrado
  - Confiança: 🟢

- [ ] T-06 — Implementar `obter_usuario_detalhado(id)`
  - Origem: `app/services/usuarios.py:254-300`
  - Critério: retorna campos editáveis (sem senha hash); `{sucesso, usuario}` ou `{sucesso:false, mensagem}`
  - Confiança: 🟢

- [ ] T-07 — Implementar `atualizar_usuario(id, ...)` com re-validação
  - Origem: `app/services/usuarios.py:303-420`
  - Critério: mesmas validações do cadastro; senha opcional na atualização (só atualiza se fornecida); auditoria UPDATE
  - Confiança: 🟢

- [ ] T-08 — Implementar `deletar_usuario(id)` (soft delete)
  - Origem: `app/services/usuarios.py:423-435`
  - Critério: `ativo=FALSE`; não aparece em listagens após exclusão
  - Confiança: 🟢

- [ ] T-09 — Implementar `verificar_admin()`
  - Origem: `app/routers/usuarios.py:122-126`
  - Critério: sem guard; retorna bool baseado no `perfil` do `usuario_logado` da sessão
  - Confiança: 🟢

- [ ] T-10 — Implementar `obter_estatisticas_usuario(id)`
  - Origem: `app/services/usuarios.py:438-620`
  - Critério: 15 contagens por papel em processos ativos; verifica tanto `processos_procedimentos` legado quanto `procedimento_pms_envolvidos`
  - Confiança: 🟢

- [ ] T-11 — Implementar `obter_processos_usuario_responsavel(id)`
  - Origem: `app/routers/usuarios.py:137`
  - Critério: retorna processos ativos onde `responsavel_id=id`
  - Confiança: 🟢

- [ ] T-12 — Implementar `obter_processos_usuario_escrivao(id)`
  - Origem: `app/routers/usuarios.py:150`
  - Critério: retorna processos ativos onde `escrivao_id=id`
  - Confiança: 🟢

- [ ] T-13 — Implementar `obter_processos_usuario_envolvido(id)`
  - Origem: `app/routers/usuarios.py:163`
  - Critério: retorna processos ativos via JOIN com `procedimento_pms_envolvidos`
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Matrícula duplicada retorna erro descritivo
- [ ] TT-02 — Email duplicado retorna erro descritivo
- [ ] TT-03 — Operador sem email retorna erro
- [ ] TT-04 — Senha armazenada como hash (não texto puro)
- [ ] TT-05 — Nome salvo em UPPER CASE; email em lower case
- [ ] TT-06 — Usuário desativado não aparece em listar_todos_usuarios()

## Ordem Sugerida

1. T-01 (cadastro — base de tudo)
2. T-02, T-03, T-04 (listagens)
3. T-05, T-06 (obtenção individual)
4. T-07 (atualização)
5. T-08, T-09 (delete e verificação admin)
6. T-10, T-11, T-12, T-13 (estatísticas e processos vinculados — dependem do módulo processos)
