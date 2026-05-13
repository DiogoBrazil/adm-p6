# Usuários — Contratos Eel (@eel.expose)

## cadastrar_usuario

```
Guard: admin
Entrada: tipo_usuario: str, posto_graduacao: str, nome: str, matricula: str,
         is_encarregado: bool (default False), is_operador: bool (default False),
         email?: str, senha?: str, perfil?: str ('admin'|'comum')
Saída ok:  {sucesso: true, mensagem: "Usuário cadastrado com sucesso!", user_id: UUID}
Saída err: {sucesso: false, mensagem: str}
Efeito:    INSERT INTO usuarios; registrar_auditoria CREATE
```

## listar_usuarios

```
Guard: login
Entrada: search_term?: str, page: int (default 1), per_page: int (default 10)
Saída ok: {usuarios: [{id, tipo_usuario, posto_graduacao, nome, matricula,
                        is_encarregado, is_operador, email, perfil,
                        ativo, vinculo_texto}],
           total: int, page: int, per_page: int}
```

## listar_todos_usuarios

```
Guard: login
Saída: [{id, tipo_usuario, posto_graduacao, nome, matricula,
          is_encarregado, is_operador, email, perfil,
          created_at, updated_at, ativo, vinculo_texto, nome_completo}]
Nota: retorna lista diretamente (sem wrapper {sucesso})
```

## listar_encarregados_operadores

```
Guard: login
Saída: [{id, posto_graduacao, nome, matricula, is_encarregado, is_operador, perfil}]
Nota: filtra is_encarregado=TRUE OR is_operador=TRUE, ativo=TRUE
```

## obter_usuario_por_id

```
Guard: login
Entrada: user_id: str (UUID), user_type: str (mantido para compatibilidade)
Saída ok:  {id, tipo_usuario, posto_graduacao, matricula, nome, is_encarregado,
             is_operador, email, profile, perfil, created_at, updated_at,
             ativo, tipo, vinculo_texto}
Saída err: null
```

## obter_usuario_detalhado

```
Guard: login
Entrada: user_id: str (UUID), user_type: str
Saída ok:  {sucesso: true, usuario: {id, tipo_usuario, posto_graduacao, nome,
             matricula, is_encarregado, is_operador, email, perfil}}
Saída err: {sucesso: false, mensagem: str}
```

## atualizar_usuario

```
Guard: admin
Entrada: user_id: str, user_type: str, tipo_usuario: str, posto_graduacao: str,
         nome: str, matricula: str, is_encarregado: bool, is_operador: bool,
         email?: str, senha?: str, perfil?: str
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE usuarios; registrar_auditoria UPDATE
```

## delete_user

```
Guard: admin
Entrada: user_id: str (UUID), user_type: str
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE usuarios SET ativo=FALSE
Regra migração: manter o nome do comando `delete_user` por compatibilidade com o JS (`questions.md#10`) e bloquear autodesativação do admin logado (`questions.md#8`).
```

## verificar_admin

```
Guard: nenhum (sem guard_login)
Saída: bool — True se perfil da sessão atual for 'admin'
```

## obter_estatisticas_usuario

```
Guard: login
Entrada: user_id: str (UUID), user_type: str
Saída ok:  {sucesso: true, estatisticas: {
             encarregado_sindicancia: int,
             encarregado_pads: int,
             encarregado_ipm: int,
             encarregado_pad: int,
             encarregado_pade: int,
             encarregado_feito_preliminar: int,
             encarregado_cp: int,
             encarregado_cd: int,
             encarregado_cj: int,
             escrivao: int,
             envolvido_sindicado: int,
             envolvido_acusado: int,
             envolvido_indiciado: int,
             envolvido_investigado: int
           }}
Saída err: {sucesso: false, erro: str}
```

## obter_processos_usuario_responsavel / escrivao / envolvido

```
Guard: login
Entrada: user_id: str (UUID)
Saída: [{processo_id, numero, tipo_detalhe, data_instauracao, concluido}]
Nota: retorna lista diretamente (sem wrapper {sucesso})
```

## Padrão de resposta

- Maioria dos contratos usa `sucesso/mensagem` (pt-br)
- `listar_todos_usuarios` e funções de processos do usuário retornam lista direta (sem wrapper)
- `verificar_admin` retorna bool diretamente
- `atualizar_usuario_old` pode ser removido na migração Rust/Tauri (`questions.md#9`)
