# Autenticação — Design Técnico

## Interface

| Símbolo | Assinatura | Retorno | Guard |
|---------|-----------|---------|-------|
| `fazer_login` | `(email: str, senha: str)` | `{sucesso, usuario, is_admin}` ou `{sucesso: false, mensagem}` | — |
| `fazer_logout` | `()` | `{sucesso: true}` | — |
| `obter_usuario_logado` | `()` | `{logado: bool, usuario?: dict}` | — |

**Estrutura do objeto de sessão (usuario_logado):**
```python
{
  "id": str,                # UUID
  "tipo_usuario": str,      # "Oficial" | "Praça"
  "posto_graduacao": str,
  "nome": str,              # UPPERCASE
  "matricula": str,
  "email": str,
  "is_encarregado": bool,
  "is_operador": bool,
  "perfil": str,            # "admin" | "comum"
  "is_admin": bool,         # calculado: perfil == "admin"
  "created_at": str,
  "updated_at": str,
  "nome_completo": str      # posto_graduacao + " " + nome
}
```

## Fluxo Principal — Login

```
1. JS chama eel.fazer_login(email, senha) via WebSocket
2. router auth.py recebe, chama db_manager.verify_login(email, senha)
3. verify_login(): SELECT * FROM usuarios WHERE email=? AND ativo=TRUE AND is_operador=TRUE
4. Se não encontrado → return None → {sucesso: false}
5. Ler campo "senha" do registro
6. Se hash começa com "$2" → bcrypt.checkpw(senha, hash)
   Senão → sha256(senha) == hash (legado)
7. Se ok E era SHA-256 → UPDATE usuarios SET senha=bcrypt_hash (upgrade silencioso)
8. Montar dict de sessão + is_admin calculado
9. _set_usuario_logado(user) → define variável global usuario_logado
10. Retornar {sucesso: true, usuario: {...}, is_admin: bool}
```
`main.py:183-241`, `app/routers/auth.py`

## Fluxo Alternativo — Logout

```
1. JS chama eel.fazer_logout()
2. _set_usuario_logado(None) → usuario_logado = None
3. Retornar {sucesso: true}
```

## Fluxo Alternativo — Consulta de sessão

```
1. JS chama eel.obter_usuario_logado()
2. user = _get_usuario_logado()
3. Se None → {logado: false}
   Senão → {logado: true, usuario: user}
```

## Dependências

- `main.py` — define `usuario_logado` (global), `_guard_login()`, `_guard_admin()`
- `db_config.py:PostgresConnectionManager` — `hash_password()`, `verify_login()`
- `app/services/db.py:DatabaseManager` — alternativa de conexão; também tem `hash_password()`
- Tabela `usuarios` (PostgreSQL)

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Sessão como variável global (não JWT, não cookie) | `main.py:672` — `usuario_logado = None` | 🟢 |
| Funções de auth não usam guard (são abertas) | `app/routers/auth.py` — sem `guard_login()` | 🟢 |
| `is_admin` calculado no login, não armazenado | `main.py:234` | 🟢 |
| Upgrade bcrypt acontece dentro do mesmo request de login | `main.py:213-218` — UPDATE dentro do `verify_login` | 🟢 |
| Dois DatabaseManager existem (`main.py` e `app/services/db.py`) com lógica duplicada | `main.py:26` vs `app/services/db.py:10` | 🟢 |

## Estado Interno

`usuario_logado` — variável Python global em `main.py`. Único estado de sessão.

| Estado | Valor |
|--------|-------|
| Não autenticado | `None` |
| Autenticado | `dict` com campos do usuário |

Ciclo de vida: `None` → (login) → `dict` → (logout ou fechamento do app) → `None`

## Observabilidade

- 🟢 `print("✓ Auditoria registrada: ...")` — auditoria de login **não** é registrada na tabela `auditoria` (somente CREATE/UPDATE/DELETE de entidades)
- 🟡 Nenhum log de tentativas de login falhas
- 🟡 Sem rate limiting ou bloqueio por tentativas excessivas

## Riscos e Lacunas

- 🟢 Credencial padrão `admin@sistema.com / 123456` deve manter o comportamento atual, sem obrigatoriedade de troca no primeiro login (confirmado pelo usuário em `questions.md#15`)
- 🟡 Dois `DatabaseManager` com implementação duplicada (`main.py` e `app/services/db.py`) — risco de divergência
- 🟢 `atualizar_usuario` usa SHA-256 para nova senha — **confirmado** em `app/services/usuarios.py:348` (`hashlib.sha256(senha.encode()).hexdigest()`) — inconsistência real: login faz upgrade SHA-256→bcrypt, mas atualização reverte para SHA-256 [Revisão: 🟡→🟢]
- 🟡 Sem timeout de sessão por inatividade
