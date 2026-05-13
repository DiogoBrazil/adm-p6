# Mapas — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `gerar_mapa_mensal(mes, ano, tipo_processo)` | login | Mapa de um tipo no mês/ano |
| `gerar_mapa_mensal_completo(mes, ano)` | login | Mapa de todos os tipos |
| `salvar_mapa_mensal(mes, ano, tipo, dados, usuario_id?)` | login | Persiste mapa com metadados |
| `listar_mapas_salvos(mes?, ano?, tipo?)` | login | Histórico de mapas |
| `obter_mapa_salvo(mapa_id)` | login | Dados completos de um mapa |
| `excluir_mapa_salvo(mapa_id)` | login | Remove mapa do banco |
| `obter_tipos_processo_para_mapa()` | login | Lista de tipos disponíveis |

## Lógica de Filtro do Mapa Mensal

```
data_inicio = "{ano}-{mes:02d}-01"
data_fim    = "{ano}-{mes+1:02d}-01" (ou "{ano+1}-01-01" se mes=12)

Para cada processo em processos_procedimentos WHERE ativo=TRUE AND tipo_detalhe=X:
  Em Andamento: data_instauracao < data_fim AND (concluido=FALSE OR data_conclusao >= data_fim)
  Concluído:    data_conclusao >= data_inicio AND data_conclusao < data_fim
```

## Query Principal

A query de `gerar_mapa_mensal` faz JOIN com `usuarios` para obter os dados de:
- `responsavel` (encarregado): nome, posto, matrícula
- `presidente`: nome, posto, matrícula
- `interrogante`: nome, posto, matrícula
- `escrivao_processo`: nome, posto, matrícula

Campos especiais recuperados: `unidade_deprecada`, `deprecante` (para CP — Carta Precatória).

## Estrutura de Saída — Mapa Individual

```json
{
  "sucesso": true,
  "dados": [
    {
      "id": "uuid",
      "numero": "001/2025",
      "tipo_detalhe": "IPM",
      "concluido": false,
      "status_processo": "Em andamento",
      "responsavel_nome": "CAP PM SILVA",
      "responsavel_posto": "CAP PM",
      "data_instauracao": "2025-01-10",
      ...
    }
  ],
  "meta": {
    "mes": 1,
    "ano": 2025,
    "tipo_processo": "IPM",
    "total": 5,
    "total_andamento": 3,
    "total_concluidos": 2
  }
}
```

## Estrutura de Saída — Mapa Completo

```json
{
  "sucesso": true,
  "dados": {
    "IPM": { "dados": [...], "totais": {"total": 3, "andamento": 2, "concluidos": 1} },
    "PAD": { "dados": [...], "totais": {...} },
    "SR":  { "dados": [...], "totais": {...} }
  }
}
```

## Salvar Mapa — Estrutura no Banco

O router monta `dados_completos` antes de chamar o service:

```python
dados_completos = {
    "meta": {
        "mes": int, "ano": int, "mes_nome": str,
        "tipo_processo": str,
        "total_processos": int,
        "total_concluidos": int,
        "total_andamento": int
    },
    "dados": dados_mapa  # lista (individual) ou dict (completo)
}
```

## Dependências

- `app/services/mapas_relatorios.py` — lógica de geração e persistência
- Tabela: `processos_procedimentos` (leitura)
- Tabela: `usuarios` (JOIN para nomes)
- Tabela de mapas salvos (🟡 — nome exato não confirmado; inferido de `salvar_mapa_mensal`)

## Dívida Técnica

- 🟡 Tabela de mapas salvos não identificada no schema documentado em `erd-complete.md` — pode ser nova
- 🟡 Parâmetros `mes`, `ano`, `tipo_processo` filtros em `listar_mapas_salvos` são recebidos mas o service chama `listar_mapas_anteriores(db_manager)` sem repassá-los — filtros ignorados
