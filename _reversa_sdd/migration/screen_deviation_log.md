---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: screen_deviation_log
producedBy: screen-translator
mode: append-only
hash: "sha256:ed87dd2feb66dbe42965d3a3e898d5182fac4e8fb1ef82d28d957ef7e6fe9a06"
---

# Screen Deviation Log

> Registro de divergencias entre o legado e a spec gerada em `target_screens.md`.

## Resumo

- **Total**: 4
- **Pendentes**: 0
- **Aprovadas**: 4
- **Rejeitadas**: 0

## Entradas

### DEV-001

| Campo | Valor |
|---|---|
| Tela afetada | Todas |
| Tipo | `modernizacao` |
| Descricao | Layout, agrupamento visual, responsividade e componentes podem divergir do HTML/Eel legado. |
| Motivo | Usuario escolheu modo modernizado; requisito preserva funcionalidades, nao pixel-perfect. |
| Origem no legado | `web/*.html`, `web/static/css/*` |
| Implicacao para parity tests | Usar comparacao semantica: textos de negocio, campos, acoes, permissoes, estados e dados exibidos. |
| Aprovacao | `aprovado` |
| Aprovado por | usuario |
| Aprovado em | 2026-05-12T22:51:48Z |
| Propaga para `parity_specs.md § Excecoes` | sim |

### DEV-002

| Campo | Valor |
|---|---|
| Tela afetada | Todas |
| Tipo | `plataforma` |
| Descricao | Chamadas `eel.*` serao substituidas por comandos Tauri tipados via `invoke`. |
| Motivo | Eel e a tecnologia a ser removida; alvo aprovado e Rust/Tauri. |
| Origem no legado | `main.py`, `web/static/js/*`, `web/*.html` |
| Implicacao para parity tests | Validar contrato dos comandos Tauri e envelope de resposta, nao a API JS do Eel. |
| Aprovacao | `aprovado` |
| Aprovado por | usuario |
| Aprovado em | 2026-05-12T22:51:48Z |
| Propaga para `parity_specs.md § Excecoes` | sim |

### DEV-003

| Campo | Valor |
|---|---|
| Tela afetada | Todas |
| Tipo | `tecnica` |
| Descricao | Design-system formal ausente; tokens foram derivados de CSS legado em `tokens-derived.md`. |
| Motivo | O pipeline nao possui `_reversa_sdd/design-system/tokens.md`; a implementacao precisa de tokens minimos. |
| Origem no legado | `web/static/css/*`, estilos inline em `web/*.html` |
| Implicacao para parity tests | Nao validar valores exatos de cor/espacamento; validar hierarquia funcional e estados. |
| Aprovacao | `aprovado` |
| Aprovado por | usuario |
| Aprovado em | 2026-05-12T22:51:48Z |
| Propaga para `parity_specs.md § Excecoes` | sim |

### DEV-004

| Campo | Valor |
|---|---|
| Tela afetada | `UserFormBackup`, `TransgressaoListDebug`, `EstatisticasEncarregadosBackup`, `TestExclusao` |
| Tipo | `modernizacao` |
| Descricao | Telas auxiliares de backup, debug e teste foram especificadas como rotas administrativas/nao criticas ou evidencias historicas, nao como fluxo primario. |
| Motivo | O brief exige migrar funcionalidades usadas; artefatos auxiliares nao devem poluir a navegacao principal. |
| Origem no legado | `web/user_form_backup.html`, `web/transgressao_list_debug.html`, `web/estatisticas_encarregados_backup.html`, `web/test_exclusao.html` |
| Implicacao para parity tests | Validar que fluxos primarios equivalentes existem; nao exigir exposicao em menu principal. |
| Aprovacao | `aprovado` |
| Aprovado por | usuario |
| Aprovado em | 2026-05-12T22:51:48Z |
| Propaga para `parity_specs.md § Excecoes` | sim |

## Telas com mais de uma deviation

| Tela | IDs |
|---|---|
| Todas | DEV-001, DEV-002, DEV-003 |
| UserFormBackup | DEV-001, DEV-002, DEV-003, DEV-004 |
| TransgressaoListDebug | DEV-001, DEV-002, DEV-003, DEV-004 |
| EstatisticasEncarregadosBackup | DEV-001, DEV-002, DEV-003, DEV-004 |
| TestExclusao | DEV-001, DEV-002, DEV-003, DEV-004 |

## Notas

Nao ha deviations pendentes. O Inspector deve montar parity tests semanticos e aceitar as excecoes acima como consequencia aprovada do modo modernizado.
