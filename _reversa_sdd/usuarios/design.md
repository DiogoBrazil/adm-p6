# Usuários — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `cadastrar_usuario(...)` | admin | Cria PM ou operador na tabela unificada |
| `listar_usuarios(search, page, per_page)` | login | Paginação + busca por nome/matrícula |
| `listar_todos_usuarios()` | login | Lista completa sem paginação |
| `listar_encarregados_operadores()` | login | Filtro por `is_encarregado OR is_operador` |
| `obter_usuario_por_id(id, type)` | login | Dados + vinculo_texto calculado |
| `obter_usuario_detalhado(id, type)` | login | Campos editáveis (sem senha) |
| `atualizar_usuario(id, type, ...)` | admin | UPDATE com re-validação |
| `delete_user(id, type)` | admin | Soft delete → `ativo=FALSE` |
| `verificar_admin()` | — | Bool: sessão atual é admin? |
| `obter_estatisticas_usuario(id, type)` | login | Contagens por papel em processos |
| `obter_processos_usuario_responsavel(id)` | login | Processos como encarregado |
| `obter_processos_usuario_escrivao(id)` | login | Processos como escrivão |
| `obter_processos_usuario_envolvido(id)` | login | Processos como PM envolvido |

## Estrutura da Tabela `usuarios`

```sql
usuarios (
  id              UUID PRIMARY KEY,
  tipo_usuario    VARCHAR  -- 'Oficial' | 'Praça'
  posto_graduacao VARCHAR,
  nome            VARCHAR  -- sempre UPPER CASE
  matricula       VARCHAR  UNIQUE,
  is_encarregado  BOOLEAN  DEFAULT FALSE,
  is_operador     BOOLEAN  DEFAULT FALSE,
  email           VARCHAR  UNIQUE NULLABLE -- lower case
  senha           VARCHAR  NULLABLE        -- bcrypt hash
  perfil          VARCHAR  -- 'admin' | 'comum' | NULL
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP,
  ativo           BOOLEAN  DEFAULT TRUE
)
```

## Fluxo Principal — Cadastrar Usuário

```
1. guard_admin()
2. Validar campos obrigatórios: tipo_usuario, posto_graduacao, nome, matricula
3. Validar nome.length >= 2
4. Validar tipo_usuario IN ('Oficial', 'Praça')
5. Se is_operador:
   a. Validar email presente e formato válido
   b. Validar senha presente e length >= 4
   c. Validar perfil IN ('admin', 'comum')
6. Verificar unicidade de matrícula (SELECT por matricula)
7. Verificar unicidade de email (se fornecido)
8. Gerar UUID
9. nome_upper = nome.strip().upper()
10. email_clean = email.strip().lower() se email else None
11. senha_hash = hash_password(senha) se senha else None
12. INSERT INTO usuarios (todos os campos)
13. registrar_auditoria('usuarios', user_id, 'CREATE', usuario_logado_id)
14. Retornar {sucesso: true, mensagem: "...", user_id: UUID}
```

## Fluxo Principal — Obter Estatísticas do Usuário

Executa 15+ queries separadas para montar o dict de estatísticas:

| Chave | Critério da query |
|-------|------------------|
| `encarregado_sindicancia` | `responsavel_id=id AND tipo_detalhe IN ('SR','SV')` |
| `encarregado_pads` | `responsavel_id=id AND tipo_detalhe='PADS'` |
| `encarregado_ipm` | `responsavel_id=id AND tipo_detalhe='IPM'` |
| `encarregado_feito_preliminar` | `responsavel_id=id AND tipo_detalhe='FP'` |
| `encarregado_pad` | `(responsavel_id OR presidente_id OR interrogante_id OR escrivao_processo_id)=id AND tipo_detalhe='PAD'` |
| `encarregado_pade` | idem para 'PADE' |
| `encarregado_cp` | `responsavel_id=id AND tipo_detalhe='CP'` |
| `encarregado_cd` | `(4 campos)=id AND tipo_detalhe='CD'` |
| `encarregado_cj` | `(4 campos)=id AND tipo_detalhe='CJ'` |
| `escrivao` | `escrivao_id=id` |
| `envolvido_sindicado/acusado/indiciado/investigado` | `processos_procedimentos.nome_pm_id=id` + JOIN `procedimento_pms_envolvidos` |

**Nota:** A query de envolvido consulta ambas as fontes (`nome_pm_id` legado + `procedimento_pms_envolvidos`) e soma os counts.

## Campo Calculado `vinculo_texto`

```python
vinculos = []
if user['is_encarregado']:
    vinculos.append("Encarregado")
if user['is_operador']:
    perfil_texto = f"Operador ({user['perfil']})" if user['perfil'] else "Operador"
    vinculos.append(perfil_texto)

vinculo_texto = " / ".join(vinculos) if vinculos else "Sem vínculo"
```

Exemplos: `"Encarregado"`, `"Operador (admin)"`, `"Encarregado / Operador (comum)"`, `"Sem vínculo"`

## Campo Calculado `nome_completo`

```python
nome_completo = f"{user['posto_graduacao']} {user['nome']}"
# Ex: "CAP PM JOÃO SILVA"
```

## Postos e Graduações

| Tipo | Valores |
|------|---------|
| Oficial | CEL PM, TC PM, MAJ PM, CAP PM, 1º TEN PM, 2º TEN PM, ASP OF PM |
| Praça | ST PM, 1º SGT PM, 2º SGT PM, 3º SGT PM, CB PM, SD PM |

## Dependências

- `app/services/usuarios.py` — lógica central
- `db_config.py` — `hash_password()`, `get_paginated_users()`, `update_user()`, `delete_user()`
- `db_manager.registrar_auditoria()` — auditoria CREATE/UPDATE
- Tabelas: `usuarios`, `processos_procedimentos`, `procedimento_pms_envolvidos`

## Inconsistências Internas

- 🟡 `atualizar_usuario_old()` coexiste com `atualizar_usuario()` — versão legada mantida "por compatibilidade"
- 🟡 `delete_user` no router delega para `deletar_usuario` no service; nome inconsistente
- 🟡 `obter_usuario_detalhado` usa `get_pg_connection()` diretamente em vez de `db_manager.get_connection()`
- 🟡 Estatísticas de envolvido verificam campo `nome_pm_id` (legado, um PM por processo) + tabela `procedimento_pms_envolvidos` (novo, múltiplos PMs) — duplicação de lógica
