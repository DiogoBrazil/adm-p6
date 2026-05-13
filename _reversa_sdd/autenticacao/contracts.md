# Autenticação — Contratos Eel (@eel.expose)

> No legado Python+Eel, cada função `@eel.expose` é chamada pelo JS como `eel.nome_funcao(args)()`.
> Na migração Rust+Tauri, cada contrato vira um `#[tauri::command]`.

---

## fazer_login

**Legado:** `@eel.expose` em `app/routers/auth.py`

```
Entrada:
  email: str   — endereço de email do usuário
  senha: str   — senha em texto plano

Saída (sucesso):
  {
    "sucesso": true,
    "usuario": {
      "id": str,
      "tipo_usuario": "Oficial" | "Praça",
      "posto_graduacao": str,
      "nome": str,
      "matricula": str,
      "email": str,
      "is_encarregado": bool,
      "is_operador": bool,
      "perfil": "admin" | "comum",
      "is_admin": bool,
      "created_at": str,
      "updated_at": str,
      "nome_completo": str
    }
  }

Saída (falha):
  {"sucesso": false, "mensagem": str}

Efeitos colaterais:
  - Define variável global usuario_logado
  - (Condicional) Atualiza hash SHA-256 → bcrypt no banco
```

---

## fazer_logout

```
Entrada: (nenhuma)

Saída:
  {"sucesso": true}

Efeitos colaterais:
  - Define usuario_logado = None
```

---

## obter_usuario_logado

```
Entrada: (nenhuma)

Saída (autenticado):
  {"logado": true, "usuario": {... mesmo objeto do fazer_login ...}}

Saída (não autenticado):
  {"logado": false}
```

---

## Notas de Migração para Tauri

```rust
// Equivalente Tauri sugerido:
#[tauri::command]
async fn fazer_login(
    email: String,
    senha: String,
    state: tauri::State<'_, AppState>,
    db: tauri::State<'_, DbPool>,
) -> Result<LoginResponse, String>

// AppState contém: Mutex<Option<Usuario>>
// LoginResponse serializa para o mesmo shape do legado
```

- Os campos `sucesso/mensagem` (pt-br) devem ser mantidos para compatibilidade com o frontend
- Ou o frontend pode ser atualizado para usar `Result<T, E>` do Tauri diretamente
