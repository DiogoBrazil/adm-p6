---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
kind: tokens_derived
producedBy: screen-translator
source: web/static/css + web/*.html
hash: "sha256:7e151ebb3a00f68c45580fbfeed5a5816e07b0e25b21ebe84c2e1b726d6ddcd9"
---

# Tokens Derivados

> Catalogo minimo derivado do CSS legado para orientar a UI Tauri modernizada. Estes tokens nao congelam o visual antigo; servem como ponte ate existir um design-system formal.

## Cores

| Token | Valor | Origem/uso |
|---|---:|---|
| `color.surface.canvas` | `#f8fafc` | fundo geral moderno detectado em `dashboard_layout.css` |
| `color.surface.panel` | `#ffffff` | paineis, formularios e modais |
| `color.text.primary` | `#1f2937` | texto principal |
| `color.text.secondary` | `#64748b` | metadados e textos auxiliares |
| `color.border.default` | `#e5e7eb` | bordas de campos, tabelas e paineis |
| `color.brand.primary` | `#10b981` | verde institucional recorrente |
| `color.brand.secondary` | `#1e40af` | azul operacional recorrente |
| `color.action.primary` | `#007bff` | acoes principais legadas |
| `color.action.success` | `#28a745` | sucesso/confirmacao |
| `color.action.warning` | `#ffc107` | alerta/atencao |
| `color.action.danger` | `#dc3545` | exclusao/erro |
| `color.action.info` | `#17a2b8` | informacao |
| `color.neutral.muted` | `#6c757d` | acoes secundarias |

## Tipografia

| Token | Valor | Origem/uso |
|---|---|---|
| `font.family.ui` | `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif` | familias recorrentes no CSS legado |
| `font.family.mono` | `"Courier New", monospace` | auditoria/dados tecnicos |
| `font.size.body` | `14px` | densidade operacional |
| `font.size.title` | `20px` | titulos de tela |
| `font.size.section` | `16px` | secoes internas |

## Espacamento e raio

| Token | Valor | Origem/uso |
|---|---:|---|
| `space.1` | `4px` | microgap |
| `space.2` | `8px` | gap comum |
| `space.3` | `12px` | grupos compactos |
| `space.4` | `16px` | padding padrao |
| `space.6` | `24px` | blocos de formulario |
| `radius.sm` | `4px` | inputs compactos |
| `radius.md` | `8px` | cards e botoes |
| `shadow.panel` | `0 4px 12px rgba(0, 0, 0, 0.08)` | paineis |
| `shadow.modal` | `0 20px 60px rgba(0, 0, 0, 0.30)` | modais |

## Componentes-base

- `AppShell`: sidebar/topbar com sessao, logout e navegacao por modulos.
- `PageHeader`: titulo, descricao curta opcional e acoes primarias.
- `DataToolbar`: busca, filtros, exportacao/relatorio e paginacao.
- `DataTable`: listagens de processos, usuarios, catalogos, auditoria e mapas.
- `CrudForm`: formularios de criacao/edicao com validacao e estados.
- `DetailTabs`: visualizacao detalhada de processos/usuarios.
- `ReportPanel`: graficos, estatisticas, mapas e geracao de arquivos.
- `ConfirmDialog`: confirmacoes destrutivas restritas a admin.
- `StatusBadge`: prazos, estados de processo, gravidade e resultado.

## Regras de aplicacao

- Escrita so aparece habilitada para perfil admin. Perfis nao admin veem telas em modo leitura.
- Botoes destrutivos usam `color.action.danger` e exigem `ConfirmDialog`.
- Listagens devem preservar busca, filtros, paginacao e exportacoes disponiveis no legado.
- Graficos, mapas e relatorios podem mudar layout, mas devem preservar dados, agregacoes e formatos gerados.
