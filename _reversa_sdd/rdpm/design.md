# RDPM — Design Técnico

## Interface

| Símbolo | Guard | Entrada | Saída |
|---------|-------|---------|-------|
| `listar_todas_transgressoes` | login | — | `{success: true, transgressoes: [...]}` |
| `obter_transgressao_por_id` | login | `id: int` | `{success: true, transgressao: {...}}` |
| `cadastrar_transgressao` | admin | campos | `{sucesso: true}` ou erro |
| `atualizar_transgressao` | admin | `id` + campos | `{sucesso: true}` ou erro |
| `excluir_transgressao` | admin | `id: int` | `{sucesso: true}` ou erro |

**Estrutura de uma transgressão:**
```json
{
  "id": 42,
  "artigo": 15,
  "gravidade": "Grave",
  "inciso": "XII",
  "texto": "...",
  "ativo": true
}
```

## Fluxo Principal — Listar

```
1. guard_login()
2. SELECT id, artigo, gravidade, inciso, texto FROM transgressoes
   ORDER BY artigo, inciso
3. Para cada linha: gravidade = row['gravidade'].title()
4. Retornar {success: true, transgressoes: [...]}
```

## Fluxo Principal — Atualizar com check de unicidade

```
1. guard_admin()
2. Receber id, gravidade, inciso, artigo, texto
3. SELECT id FROM transgressoes
   WHERE LOWER(gravidade)=LOWER(?) AND LOWER(inciso)=LOWER(?) AND id != ?
4. Se encontrou → retornar {sucesso: false, mensagem: "Já existe transgressão com essa gravidade e inciso"}
5. UPDATE transgressoes SET ... WHERE id=?
6. registrar_auditoria('transgressoes', id, 'UPDATE', usuario_id)
7. Retornar {sucesso: true}
```

## Fluxo Principal — Excluir (hard delete)

```
1. guard_admin()
2. DELETE FROM transgressoes WHERE id=?
3. registrar_auditoria('transgressoes', id, 'DELETE', usuario_id)
4. Retornar {sucesso: true}
```

⚠️ **Risco:** Se houver registros em `pm_envolvido_rdpm` referenciando este `id`, o DELETE pode falhar por FK violation (sem CASCADE definido no schema).

## Dependências

- `db_manager.registrar_auditoria()` — auditoria em todas as operações
- Tabela `transgressoes` (SERIAL id)
- Tabela `pm_envolvido_rdpm` (FK lógica para `transgressoes.id`)

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Hard delete (única exceção no sistema) | `app/rdpm.py` — DELETE FROM | 🟢 |
| ID SERIAL (não UUID) | `alembic/0001:105` | 🟢 |
| Gravidade formatada em title-case apenas na leitura | `app/rdpm.py` — `.title()` no SELECT | 🟢 |
| Padrão de resposta misto (success em listagem, sucesso em escrita) | `app/routers/rdpm.py` | 🟢 |

## Observabilidade

- 🟢 Auditoria em CREATE, UPDATE e DELETE (único módulo que audita DELETE)

## Riscos e Lacunas

- 🔴 Hard delete pode violar FK com `pm_envolvido_rdpm` — não há verificação prévia no código
- 🟡 Sem verificação de unicidade no cadastro (apenas na atualização)
