# Matriz de Permissões (RBAC) — Gestão P6

> Gerado pelo Detetive em 2026-05-12

---

## Papéis de Usuário

| Papel | Como funciona | is_operador | perfil |
|-------|--------------|-------------|--------|
| **Não autenticado** | Nenhum acesso | — | — |
| **Comum** | Operador com acesso padrão (leitura + operação) | TRUE | `comum` |
| **Admin** | Operador com acesso total, incluindo cadastros e auditoria | TRUE | `admin` |
| **Encarregado** (sem operador) | Policial vinculado a processos, mas sem acesso ao sistema | FALSE | NULL |

> 🟢 CONFIRMADO: Guards `_guard_login()` e `_guard_admin()` em `main.py:674-685`
> A flag `is_admin` é derivada no login: `is_admin = (perfil == 'admin')`

---

## Matriz de Permissões por Módulo

### Legenda
- ✅ Permitido
- ❌ Negado (retorna 401 equivalente: `{sucesso: false, mensagem: "Sessão expirada..."}`)
- 🚫 Acesso negado admin: `{sucesso: false, mensagem: "Acesso negado: apenas administradores."}`

---

### Auth

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| `fazer_login` | ✅ | ✅ | ✅ |
| `obter_usuario_logado` | ✅ | ✅ | ✅ |
| `fazer_logout` | ✅ | ✅ | ✅ |

> 🟢 CONFIRMADO: auth não usa guards — funções são abertas por design

---

### Usuários

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| `listar_usuarios` | ❌ | ✅ | ✅ |
| `listar_todos_usuarios` | ❌ | ✅ | ✅ |
| `listar_encarregados_operadores` | ❌ | ✅ | ✅ |
| `obter_usuario_por_id` | ❌ | ✅ | ✅ |
| `obter_usuario_detalhado` | ❌ | ✅ | ✅ |
| `verificar_admin` | ✅ | ✅ | ✅ |
| `obter_estatisticas_usuario` | ❌ | ✅ | ✅ |
| `obter_processos_usuario_*` | ❌ | ✅ | ✅ |
| `cadastrar_usuario` | ❌ | 🚫 | ✅ |
| `atualizar_usuario` | ❌ | 🚫 | ✅ |
| `delete_user` | ❌ | 🚫 | ✅ |

> 🟢 CONFIRMADO: `app/routers/usuarios.py` — guard_login para leitura, guard_admin para escrita

---

### Catálogos — Crimes/Contravenções

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| `listar_crimes_contravencoes` | ❌ | ✅ | ✅ |
| `obter_crime_por_id` | ❌ | ✅ | ✅ |
| `cadastrar_crime` | ❌ | 🚫 | ✅ |
| `atualizar_crime` | ❌ | 🚫 | ✅ |
| `excluir_crime_contravencao` | ❌ | 🚫 | ✅ |
| `buscar_municipios_distritos` | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/catalogos.py`

---

### RDPM — Transgressões

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| `listar_todas_transgressoes` | ❌ | ✅ | ✅ |
| `obter_transgressao_por_id` | ❌ | ✅ | ✅ |
| `cadastrar_transgressao` | ❌ | 🚫 | ✅ |
| `atualizar_transgressao` | ❌ | 🚫 | ✅ |
| `excluir_transgressao` | ❌ | 🚫 | ✅ |

> 🟢 CONFIRMADO: `app/routers/rdpm.py`

---

### Art. 29 — Infrações do Estatuto

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| `listar_infracoes_estatuto_art29` | ❌ | ✅ | ✅ |
| `obter_infracao_estatuto_art29` | ❌ | ✅ | ✅ |
| `criar_infracao_estatuto_art29` | ❌ | 🚫 | ✅ |
| `editar_infracao_estatuto_art29` | ❌ | 🚫 | ✅ |
| `excluir_infracao_estatuto_art29` | ❌ | 🚫 | ✅ |

> 🟢 CONFIRMADO: `app/routers/art29.py`

---

### Processos / Procedimentos

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| Todas as operações CRUD | ❌ | ✅ | ✅ |
| `excluir_processo` (soft delete) | ❌ | ✅ | ✅ |
| Upload/download PDF | ❌ | ✅ | ✅ |
| Estatísticas | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/processos.py` — apenas guard_login em todas as operações
> 🟡 INFERIDO: Qualquer operador comum pode excluir processos de outros — sem ownership check

---

### Prazos

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| Todas as operações | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/prazos.py` — apenas guard_login

---

### Andamentos

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| Todas as operações | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/andamentos.py` — apenas guard_login

---

### Indícios

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| Todas as operações | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/indicios.py` — apenas guard_login

---

### Mapas

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| Todas as operações | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/mapas.py` — apenas guard_login

---

### Relatórios

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| Todas as operações | ❌ | ✅ | ✅ |

> 🟢 CONFIRMADO: `app/routers/relatorios.py` — apenas guard_login

---

### Auditorias

| Operação | Não autenticado | Comum | Admin |
|----------|----------------|-------|-------|
| `listar_auditorias` | ❌ | 🚫 | ✅ |
| `obter_auditoria_detalhada` | ❌ | 🚫 | ✅ |
| `obter_auditorias_por_registro` | ❌ | 🚫 | ✅ |
| `obter_auditorias_por_usuario` | ❌ | 🚫 | ✅ |
| `obter_estatisticas_auditoria` | ❌ | 🚫 | ✅ |

> 🟢 CONFIRMADO: `app/routers/auditorias.py` — guard_admin em **todas** as operações

---

## Resumo Visual

```
                    | Não Auth | Comum | Admin
--------------------|----------|-------|-------
Login               |    ✅    |  ✅   |  ✅
Ver processos       |    ❌    |  ✅   |  ✅
CRUD processos      |    ❌    |  ✅   |  ✅
Ver catálogos       |    ❌    |  ✅   |  ✅
CRUD catálogos      |    ❌    |  🚫   |  ✅
Ver usuários        |    ❌    |  ✅   |  ✅
CRUD usuários       |    ❌    |  🚫   |  ✅
Prazos/Andamentos   |    ❌    |  ✅   |  ✅
Indícios/Mapas      |    ❌    |  ✅   |  ✅
Relatórios          |    ❌    |  ✅   |  ✅
Auditorias          |    ❌    |  🚫   |  ✅
```

---

## Lacunas Identificadas

| # | Lacuna | Impacto |
|---|--------|---------|
| 🔴 L1 | Nenhum controle de ownership em processos — qualquer operador pode excluir processo de outro | Médio |
| 🔴 L2 | Sessão global em memória — não suporta múltiplos usuários simultâneos na mesma instância | Alto (arquitetural) |
| 🟡 L3 | Não há rate limiting no login — senhas podem ser tentadas sem limitação | Baixo (desktop local) |
| 🟡 L4 | `verificar_admin` retorna perfil sem guard — qualquer um pode chamar antes do login | Baixo (informacional) |
