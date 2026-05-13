# Auditorias — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `listar_auditorias(search?, page, per_page, filtros?)` | admin | Listagem paginada com filtros |
| `obter_auditoria_detalhada(auditoria_id)` | admin | Detalhes de um registro |
| `obter_auditorias_por_registro(tabela, registro_id)` | admin | Histórico de uma entidade |
| `obter_auditorias_por_usuario(usuario_id, page, per_page)` | admin | Ações de um operador |
| `obter_estatisticas_auditoria(data_inicio?, data_fim?)` | admin | Contagens por operação/tabela |

## Estrutura da Tabela `auditoria`

```sql
auditoria (
  id          UUID PRIMARY KEY,  -- 🟡 inferido
  tabela      VARCHAR,           -- ex.: 'processos_procedimentos', 'usuarios'
  registro_id VARCHAR,           -- UUID do registro afetado
  operacao    VARCHAR,           -- 'CREATE' | 'UPDATE' | 'DELETE'
  usuario_id  UUID NULLABLE,     -- FK para usuarios.id; NULL = Sistema
  timestamp   TIMESTAMP          -- momento da operação
)
```

## Fluxo — Listar Auditorias

```
listar_auditorias(db_manager, search_term, page, per_page, filtros):
1. Construir WHERE dinâmico:
   - search_term → LOWER(u.nome) LIKE % OR LOWER(a.tabela) LIKE % OR LOWER(a.registro_id) LIKE %
   - filtros.operacao → a.operacao = ?
   - filtros.tabela   → a.tabela = ?
2. COUNT total (para paginação)
3. SELECT a.tabela, a.registro_id, a.operacao, a.timestamp,
          COALESCE(u.nome, 'Sistema') as usuario_nome,
          COALESCE(u.posto_graduacao, '') as usuario_posto
   FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id
   ORDER BY a.timestamp DESC
   LIMIT per_page OFFSET (page-1)*per_page
4. Retornar {sucesso, auditorias, total, total_pages, current_page, per_page}
```

## Mecanismo de Escrita (Passivo)

A auditoria é gravada pelos outros módulos via:

```python
db_manager.registrar_auditoria(
    tabela='processos_procedimentos',
    registro_id=str(uuid),
    operacao='CREATE',  # | 'UPDATE' | 'DELETE'
    usuario_id=usuario_logado_id
)
```

Este módulo é somente leitura — não há função de escrita exposta via Eel.

## Módulos que Registram Auditoria

| Módulo | Operações auditadas |
|--------|---------------------|
| processos | CREATE, UPDATE, DELETE |
| usuarios | CREATE, UPDATE |
| catalogos | CREATE, UPDATE, DELETE (inferido) |
| rdpm | CREATE, UPDATE, DELETE (inferido) |
| art29 | CREATE, UPDATE, DELETE (inferido) |

## Dependências

- `app/services/auditorias.py` — lógica de consulta
- `db_config.py:registrar_auditoria()` — escrita (usada pelos outros módulos)
- Tabelas: `auditoria`, `usuarios` (JOIN para nome)
