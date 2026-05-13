# Art. 29 — Design Técnico

## Interface

| Símbolo | Guard | Entrada | Saída |
|---------|-------|---------|-------|
| `listar_infracoes_estatuto_art29` | login | — | `{success: true, infracoes: [...]}` |
| `obter_infracao_estatuto_art29` | login | `id: str` | `{success: true, infracao: {...}}` |
| `criar_infracao_estatuto_art29` | admin | `inciso, texto` | `{sucesso: true}` ou erro |
| `editar_infracao_estatuto_art29` | admin | `id, inciso, texto` | `{sucesso: true}` ou erro |
| `excluir_infracao_estatuto_art29` | admin | `id: str` | `{sucesso: true}` ou erro |

## Fluxo Principal — Listar com ordenação romana

```
1. guard_login()
2. SELECT * FROM infracoes_estatuto_art29 WHERE ativo=TRUE
   ORDER BY
     CASE WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso) ELSE 999 END,
     inciso
3. Retornar {success: true, infracoes: [...]}
```
Origem: `app/art29.py:14` — SQL com CASE para ordenação por comprimento de inciso romano.

## Fluxo Principal — Criar com check de unicidade

```
1. guard_admin()
2. Validar: inciso e texto obrigatórios
3. SELECT id FROM infracoes_estatuto_art29
   WHERE LOWER(inciso) = LOWER(?) AND ativo = TRUE
4. Se encontrou → {sucesso: false, mensagem: "Inciso já existe"}
5. INSERT (id=UUID, inciso, texto, ativo=TRUE)
6. Retornar {sucesso: true}
```

## Dependências

- Tabela `infracoes_estatuto_art29` (UUID id)
- Tabela `pm_envolvido_art29` (FK lógica)

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Soft delete (diferente de RDPM que usa hard delete) | `app/art29.py` | 🟢 |
| Ordenação SQL com CASE WHEN para incisos romanos | `app/art29.py:14` | 🟢 |
| ID migrado de SERIAL para UUID | commit `76cb813` | 🟢 |
| Unicidade só para ativos | check `AND ativo=TRUE` | 🟢 |

## Riscos e Lacunas

- 🟡 FK lógica com `pm_envolvido_art29.art29_id` — sem CASCADE; soft delete é mais seguro que hard delete do RDPM
