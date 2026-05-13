# Relatórios — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Status | Descrição |
|---------|-------|--------|-----------|
| `gerar_relatorio_anual_pdf(ano)` | login | 🟢 | PDF + estatísticas do ano |
| `gerar_relatorio_estatisticas_gerais(ano?)` | login | 🟢 escopo confirmado | Estatísticas gerais |
| `gerar_relatorio_processos_por_encarregado(ano?)` | login | 🟢 escopo confirmado | Agrupado por encarregado |
| `gerar_relatorio_processos_por_tipo(ano?)` | login | 🟢 escopo confirmado | Agrupado por tipo |
| `gerar_relatorio_prazos_vencidos(dias_atras?)` | login | 🟢 escopo confirmado | Prazos vencidos |
| `exportar_relatorio_csv(tipo, filtros?)` | login | 🟢 escopo confirmado | CSV |
| `exportar_relatorio_excel(tipo, filtros?)` | login | 🟢 escopo confirmado | XLSX |

## Fluxo Principal — Relatório Anual

```
gerar_relatorio_anual(db_manager, ano):
1. COUNT processos por tipo_geral ('processo' vs 'procedimento') no ano
2. SELECT processos por tipo_detalhe + status (Concluído/Em Andamento)
3. SELECT procedimentos por tipo_detalhe + status
4. [+ mais agregações não lidas completamente — natureza, PM, penalidade]
5. _gerar_pdf_relatorio_anual(estatisticas) → PDF bytes
6. base64.b64encode(pdf_bytes) → string
7. Retornar {sucesso: true, pdf_base64: str, estatisticas: {...}}
```

## Estrutura do Relatório Anual (Estatísticas)

```
{
  total_processos: int,        -- tipo_geral='processo'
  total_procedimentos: int,    -- tipo_geral='procedimento'
  total_geral: int,
  por_tipo: [{tipo_detalhe, status, qtd}],
  concluidos: int,
  em_andamento: int,
  ...  (demais campos das queries não lidas)
}
```

## Relação com Módulo Mapas

O módulo de Relatórios compartilha `app/services/mapas_relatorios.py` com o módulo de Mapas:

```
mapas_relatorios.py
├── Mapas: gerar_mapa_mensal, gerar_mapa_completo, salvar_mapa_mensal, ...
└── Relatórios: gerar_relatorio_anual, _gerar_pdf_relatorio_anual, ...
```

Essa co-habitação é 🟡 — seria preferível separar em `mapas_service.py` e `relatorios_service.py`.

## Dependências

- `app/services/mapas_relatorios.py` — lógica de geração de relatórios
- Tabela: `processos_procedimentos` (leitura)
- Biblioteca PDF (🟡 — não identificada; pode ser `reportlab`, `weasyprint` ou outra)

## Dívida Técnica

- 🟢 6 de 7 funções do router não existem no service, mas o usuário confirmou que devem ser implementadas na migração Rust/Tauri; prioridade: mapa mensal PDF
- 🟡 PDF gerado localmente em `_gerar_pdf_relatorio_anual` — verificar dependência de biblioteca
- 🟡 `mapas_relatorios.py` mistura responsabilidades de mapas e relatórios em ~1600 linhas
- 🟢 Debug prints em `gerar_relatorio_anual` (`print(...)`) — remover na migração
