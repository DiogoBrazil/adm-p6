# ADR-0002: Migração de SHA-256 para bcrypt (com upgrade transparente)

**Status:** Aceito  
**Data:** 2025-11-11 (commit `da0338d`)  
**Confiança:** 🟢 CONFIRMADO

---

## Contexto

O sistema originalmente usava SHA-256 simples (`hashlib.sha256(senha.encode()).hexdigest()`) para hashing de senhas — sem salt, vulnerável a rainbow tables.

**Evidência:** Commit `da0338d`: "Security/Config: switch to bcrypt with legacy upgrade"

---

## Decisão

Adotar **bcrypt** (biblioteca `bcrypt 4.0.1`) como algoritmo padrão para hashing de senhas. Implementar upgrade transparente: na primeira autenticação bem-sucedida com hash SHA-256, atualizar silenciosamente para bcrypt.

---

## Razões

1. SHA-256 sem salt é inseguro para armazenamento de senhas
2. bcrypt é resistente a ataques de força bruta por design (custo configurável)
3. Upgrade transparente evita exigir reset de senha de todos os usuários
4. Identificação do tipo de hash: hashes bcrypt começam com `$2` (check: `hashed.startswith('$2')`)

---

## Alternativas Consideradas

- **Argon2**: mais moderno, mas dependência adicional; bcrypt já estava no requirements
- **Reset forçado de senha**: descartado — impacto operacional alto

---

## Consequências

- **Problema não resolvido:** `atualizar_usuario` ainda usa SHA-256 para novas senhas (inconsistência — ver `app/services/usuarios.py`). Isso significa que usuários com senha atualizada ficam em SHA-256 até o próximo login.
- Hash bcrypt identificável pelo prefixo `$2b$` ou `$2a$`
- Usuário admin padrão criado com bcrypt desde o início

**Para a migração Rust/Tauri:** Unificar todo hashing para bcrypt. Eliminar a inconsistência em atualizar_usuario.
