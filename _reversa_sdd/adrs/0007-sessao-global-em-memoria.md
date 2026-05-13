# ADR-0007: Sessão de usuário como variável global em memória

**Status:** Aceito (legado — não replicar na migração)  
**Data:** Desde o início do projeto  
**Confiança:** 🟢 CONFIRMADO

---

## Contexto

A aplicação é desktop single-user (Eel roda um browser local). Precisava de um mecanismo de sessão para saber quem está logado.

**Evidência:** `main.py:672` — `usuario_logado = None` (variável global)

---

## Decisão

Usar uma **variável global Python** (`usuario_logado`) para armazenar o usuário autenticado. Login define a variável, logout a limpa, e os guards verificam se ela é `None`.

---

## Razões

1. Aplicação desktop single-user — não há múltiplas sessões concorrentes
2. Simplicidade máxima: sem tokens, sem cookies, sem Redis
3. Eel é um servidor HTTP embarcado no processo — a variável global é acessível em toda a aplicação

---

## Alternativas Consideradas

- **JWT tokens**: descartado — overcomplicated para app desktop single-user
- **Flask/Django session**: descartado — não disponível no Eel simples

---

## Consequências

- **Sessão perde ao fechar o app** — comportamento intencional para desktop
- Não suporta múltiplos usuários simultâneos na mesma instância
- Sem timeout automático — sessão dura enquanto o processo Eel estiver rodando

**Para migração Rust/Tauri:**
- Tauri usa um processo Rust que persiste. Sessão pode ser gerenciada com `tauri::State<Mutex<Option<Usuario>>>` ou similar
- Considerar timeout de sessão por inatividade
- O pattern de "guard" pode ser replicado com um middleware/extração de state no Tauri command handler
