# Indícios — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `salvar_indicios_pm_envolvido(pm_id, data, conn?, cursor?)` | login | Upsert de indícios (categorias + crimes + RDPM + Art.29) |
| `carregar_indicios_pm_envolvido(pm_id)` | login | Lê indícios consolidados de um PM envolvido |
| `listar_pms_envolvidos_com_indicios(procedimento_id)` | login | PMs do procedimento com seus indícios |
| `remover_indicios_pm_envolvido(pm_id)` | login | Remove todos os indícios do PM |
| `buscar_crimes_para_indicios(termo)` | login | Busca em `catalogos_crimes` |
| `buscar_rdpm_para_indicios(termo, gravidade?)` | login | Busca em `catalogos_rdpm` |
| `buscar_art29_para_indicios(termo)` | login | Busca em `infracoes_estatuto_art29` |
| `obter_categorias_indicios()` | login | Lista de categorias válidas |

## Modelo de Dados

```
procedimento_pms_envolvidos
  id (UUID) ←──────────────────────┐
  procedimento_id                   │
  pm_id                             │  FK
  status_pm                         │
                                    │
pm_envolvido_indicios               │
  id (UUID)                         │
  pm_envolvido_id ──────────────────┘
  procedimento_id
  categorias_indicios  JSONB  -- ["crimes_cpm", "transgressoes_rdpm"]
  categoria            TEXT   -- primeira categoria (campo legado)
  ativo                BOOLEAN
          │
          ├── pm_envolvido_crimes
          │     id (UUID)
          │     pm_indicios_id ──► pm_envolvido_indicios.id
          │     crime_id ──────► catalogos_crimes.id
          │
          ├── pm_envolvido_rdpm
          │     id (UUID)
          │     pm_indicios_id
          │     rdpm_id ─────► catalogos_rdpm.id
          │
          └── pm_envolvido_art29
                id (UUID)
                pm_indicios_id
                art29_id ────► infracoes_estatuto_art29.id
```

## Fluxo Principal — Salvar Indícios (Upsert)

```
salvar_indicios_pm_envolvido(pm_envolvido_id, indicios_data):
1. Verificar que pm_envolvido_id existe em procedimento_pms_envolvidos
2. Buscar registro em pm_envolvido_indicios WHERE pm_envolvido_id AND ativo=TRUE
3. Se existe:
   a. DELETE pm_envolvido_crimes WHERE pm_indicios_id = id
   b. DELETE pm_envolvido_rdpm WHERE pm_indicios_id = id
   c. DELETE pm_envolvido_art29 WHERE pm_indicios_id = id
4. Se não existe:
   a. INSERT pm_envolvido_indicios (id=UUID, categorias_indicios='[]', ativo=TRUE)
5. Atualizar categorias:
   a. categorias = indicios_data['categorias'] ou []
   b. UPDATE pm_envolvido_indicios SET categorias_indicios=JSON, categoria=categorias[0]
6. Inserir crimes: para cada {id} em indicios_data['crimes']
   → INSERT pm_envolvido_crimes (id=UUID, pm_indicios_id, crime_id)
7. Inserir RDPM: para cada {id} em indicios_data['rdpm']
   → INSERT pm_envolvido_rdpm (id=UUID, pm_indicios_id, rdpm_id)
8. Inserir Art.29: para cada {id} em indicios_data['art29']
   → INSERT pm_envolvido_art29 (id=UUID, pm_indicios_id, art29_id)
9. COMMIT
10. Retornar {sucesso: true, mensagem: "..."}
```

## Input `indicios_data`

```json
{
  "categorias": ["crimes_cpm", "transgressoes_rdpm"],
  "crimes":  [{"id": "uuid-crime-1"}, {"id": "uuid-crime-2"}],
  "rdpm":    [{"id": "uuid-rdpm-1"}],
  "art29":   []
}
```

Cada elemento da lista pode ser `{"id": "uuid"}` ou diretamente `"uuid"` — normalizado no código.

## Dependências

- `app/services/indicios.py` — lógica central
- Tabelas: `pm_envolvido_indicios`, `pm_envolvido_crimes`, `pm_envolvido_rdpm`, `pm_envolvido_art29`
- Catálogos: `catalogos_crimes`, `catalogos_rdpm`, `infracoes_estatuto_art29`

## Dívida Técnica

- 🔴 Debug prints extensivos em `salvar_indicios_pm_envolvido` — remover na migração
- 🟡 Campo `categoria` (TEXT) em `pm_envolvido_indicios` coexiste com `categorias_indicios` (JSONB array) — campo legado, contém apenas a primeira categoria
- 🟡 `conn/cursor` opcionais em `salvar_indicios_pm_envolvido` permitem chamada dentro de outra transação — padrão não usado consistentemente no projeto
