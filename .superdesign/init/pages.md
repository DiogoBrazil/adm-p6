# Páginas e dependências

## /mapas/mensal — Mapa do Período
Entry: `src/telas/mapas.ts`
Dependencies:
- `src/api.ts`
  - `src/types.ts`
- `src/dom.ts`
  - `src/api.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`
  - `src-tauri/icons/icon.png`

## /mapas/anteriores — Mapas Salvos
Entry: `src/telas/mapas.ts`
Dependencies:
- `src/api.ts`
  - `src/types.ts`
- `src/dom.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /procedimentos/lista — Procedimentos e detalhe
Entry: `src/telas/processo.ts`
Dependencies:
- `src/api.ts`
  - `src/types.ts`
- `src/dom.ts`
- `src/telas/catalogos.ts`
- `src/telas/indicios.ts`
  - `src/api.ts`
  - `src/dom.ts`
- `src/main.ts`
  - `src/styles.css`

## /dashboard — Painel
Entry: `src/telas/dashboard.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/estatisticas.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /prazos
Entry: `src/telas/prazos.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /estatisticas/anuais — Relatório Anual
Entry: `src/telas/anual.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/estatisticas.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /estatisticas/processos e /stats/procedimentos
Entry: `src/telas/estatisticas.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /estatisticas/encarregados
Entry: `src/telas/encarregados.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /usuarios/lista e /usuarios/novo
Entry: `src/telas/usuarios.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/estatisticas.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

## /auditoria
Entry: `src/telas/auditoria.ts`
Dependencies:
- `src/api.ts`
- `src/dom.ts`
- `src/telas/catalogos.ts`
- `src/main.ts`
  - `src/styles.css`

