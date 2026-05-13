---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: target_screens
producedBy: screen-translator
mode: modernized
sourcePlatform: html-eel
targetPlatform: tauri
adapter: html_eel__tauri
screenCount: 26
hash: "sha256:b87601efe98a2b02e535dc73b1e659af95e85c3c64d28d0dcb167d099a00df52"
---

# Target Screens

> Especificacao executavel das telas do sistema novo. O modo aprovado e modernizado: a UI pode mudar, mas funcionalidades, permissoes, textos de negocio, dados, filtros, relatorios, estatisticas e fluxos equivalentes devem ser mantidos.

## Resumo

- **Modo aplicado**: modernizado
- **Telas geradas**: 26
- **Adapter**: `html_eel__tauri`, derivado de `html_legacy__spa`
- **Formato de spec**: `route-component` com arvore de componentes para Tauri webview
- **Tokens consumidos**: `_reversa_sdd/design-system/tokens-derived.md`
- **Golden files**: 0; manifest em `_reversa_sdd/screens/golden/manifest.yaml`
- **Deviations registradas**: 4 em `screen_deviation_log.md`

## Contratos Globais

```yaml
spec.kind: route-component
spec.layout: AppShell
spec.states: [idle, loading, error, success]
spec.ipc:
  transport: tauri.invoke
  response_envelope:
    ok: boolean
    data: object | array | string | null
    error: string | null
spec.permissions:
  write_actions: admin_only
  non_admin_profiles: read_only
  destructive_actions: admin_only_with_confirm_dialog
spec.text_policy:
  preserve_business_labels: true
  preserve_error_meaning: true
  linguistic_rewrite_requires_approval: true
spec.visual_policy:
  mode: modernized
  tokens: tokens-derived
  deviations: [DEV-001, DEV-002, DEV-003]
```

## Telas

### Login

**Origem**: `web/login.html`
**Modo aplicado**: modernizado
**Componentes do design-system**: `AuthLayout`, `CrudForm`, `Button`
**Pontos de interpolacao**: nenhum
**Transicoes de saida**: `Dashboard`
**Tela critica?**: sim

```yaml
spec.route: /login
spec.component:
  component: LoginPage
  title: "Login"
  command_map:
    submit: auth.login
  children:
    - component: FormField
      name: email
      label: "Email"
      input: email
      validation: { required: true }
    - component: FormField
      name: senha
      label: "Senha"
      input: password
      validation: { required: true }
    - component: Button
      label: "Entrar"
      action: form.submit
spec.state_messages:
  loading: "Autenticando..."
  error: "{{error_message}}"
  success: "Login realizado com sucesso."
```

### Dashboard

**Origem**: `web/dashboard.html`
**Modo aplicado**: modernizado
**Componentes do design-system**: `AppShell`, `PageHeader`, `ReportPanel`, `StatusBadge`
**Pontos de interpolacao**: `{{estatisticas_processos}}`, `{{relatorio_anual}}`
**Transicoes de saida**: `ProceduresHub`, `UsersHub`, `EstatisticasProcessos`, `EstatisticasEncarregados`, `MapaMensal`
**Tela critica?**: sim

```yaml
spec.route: /dashboard
spec.component:
  component: DashboardPage
  title: "Dashboard"
  command_map:
    load_stats: reports.get_process_statistics_in_progress
    list_report_years: reports.list_annual_report_years
    generate_annual_report: reports.generate_annual_report
  children:
    - component: MetricGrid
      source: "{{estatisticas_processos}}"
    - component: DeadlineOverview
      source: deadlines.dashboard
    - component: ReportAction
      label: "Gerar relatório anual"
      command: reports.generate_annual_report
spec.state_messages:
  loading: "Carregando dashboard..."
  error: "{{error_message}}"
  success: "Dashboard atualizado."
```

### ProceduresHub

```yaml
spec.route: /procedimentos
spec.component:
  component: HubPage
  title: "Procedimentos"
  cards:
    - label: "Listar procedimentos"
      navigate: /procedimentos/lista
    - label: "Novo procedimento"
      navigate: /procedimentos/novo
      permission: admin
spec.states: [idle, loading, error, success]
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### ProcedureList

```yaml
spec.route: /procedimentos/lista
spec.component:
  component: ProceedingsListPage
  title: "Procedimentos"
  command_map:
    load: proceedings.list_with_deadlines
    load_filter_options: proceedings.get_filter_options
    add_movement: movements.add
    remove_movement: movements.remove
    add_extension: deadlines.add_extension
    replace_responsible: proceedings.replace_responsible
    get_pdf: proceedings.get_pdf
    save_pdf: proceedings.save_pdf
    remove_pdf: proceedings.remove_pdf
    delete: proceedings.delete
  children:
    - component: DataToolbar
      features: [search, filters, pagination]
    - component: DataTable
      source: "{{processos}}"
      row_actions: [view, edit, movements, deadlines, pdf, delete]
      write_actions_permission: admin
    - component: ConfirmDialog
      for: delete
spec.transitions: [/procedimentos/novo, /procedimentos/:id]
spec.state_messages:
  loading: "Carregando procedimentos..."
  error: "{{error_message}}"
  success: "Lista de procedimentos atualizada."
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### ProcedureForm

```yaml
spec.route: /procedimentos/novo | /procedimentos/:id/editar
spec.component:
  component: ProceedingFormPage
  title_create: "Novo Procedimento"
  title_edit: "Editar Procedimento"
  permission: admin
  command_map:
    create: proceedings.create
    update: proceedings.update
    load: proceedings.get
    list_users: users.list_all
    list_catalogs: legal_catalogs.list_for_proceeding
    list_pm_evidence: evidence.list_for_pm_involved
  sections:
    - identification
    - responsible_roles
    - involved_people
    - legal_framing
    - deadlines
    - evidence
    - pdf_data
  validations:
    required_fields_from_legacy: true
    ipm_initial_deadline_days: 40
    ignore_ippm_references: true
spec.transitions: [/procedimentos/lista, /procedimentos/:id]
spec.state_messages:
  loading: "Salvando procedimento..."
  error: "{{error_message}}"
  success: "Procedimento salvo com sucesso."
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### ProcedureView

```yaml
spec.route: /procedimentos/:id
spec.component:
  component: ProceedingDetailPage
  title: "Detalhes do Procedimento"
  command_map:
    load: proceedings.get_complete
    list_responsibles: proceedings.list_responsibles
    list_responsible_history: proceedings.list_responsible_history
    list_involved: proceedings.list_involved
    list_movements: movements.list
    list_deadlines: deadlines.list_for_proceeding
  children:
    - component: DetailTabs
      tabs: [dados, envolvidos, enquadramento, prazos, andamentos, historico_encarregados]
    - component: Button
      label: "Editar"
      permission: admin
      action: navigate.edit
spec.transitions: [/procedimentos/:id/editar, /procedimentos/lista]
spec.state_messages:
  loading: "Carregando procedimento..."
  error: "{{error_message}}"
  success: "Procedimento carregado."
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### TransgressaoList

```yaml
spec.route: /catalogos/transgressoes
spec.component:
  component: CatalogListPage
  title: "Transgressões"
  command_map:
    load: legal_catalogs.list_transgressions
    delete: legal_catalogs.delete_transgression
  table_source: "{{transgressoes}}"
  actions: [create, edit, delete]
  write_actions_permission: admin
spec.transitions: [/catalogos/transgressoes/novo]
spec.state_messages: { loading: "Carregando transgressões...", error: "{{error_message}}", success: "Transgressões atualizadas." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### TransgressaoForm

```yaml
spec.route: /catalogos/transgressoes/novo | /catalogos/transgressoes/:id/editar
spec.component:
  component: CatalogFormPage
  title_create: "Nova Transgressão"
  title_edit: "Editar Transgressão"
  permission: admin
  command_map:
    load: legal_catalogs.get_transgression
    create: legal_catalogs.create_transgression
    update: legal_catalogs.update_transgression
    list_all: legal_catalogs.list_transgressions
spec.transitions: [/catalogos/transgressoes]
spec.state_messages: { loading: "Salvando transgressão...", error: "{{error_message}}", success: "Transgressão salva com sucesso." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### CrimeList

```yaml
spec.route: /catalogos/crimes
spec.component:
  component: CatalogListPage
  title: "Crimes e Contravenções"
  command_map:
    load: legal_catalogs.list_crimes
    delete: legal_catalogs.delete_crime
  table_source: "{{crimes_contravencoes}}"
  actions: [create, edit, delete]
  write_actions_permission: admin
spec.transitions: [/catalogos/crimes/novo]
spec.state_messages: { loading: "Carregando crimes e contravenções...", error: "{{error_message}}", success: "Crimes e contravenções atualizados." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### CrimeForm

```yaml
spec.route: /catalogos/crimes/novo | /catalogos/crimes/:id/editar
spec.component:
  component: CatalogFormPage
  title_create: "Novo Crime/Contravenção"
  title_edit: "Editar Crime/Contravenção"
  permission: admin
  command_map:
    load: legal_catalogs.get_crime
    create: legal_catalogs.create_crime
    update: legal_catalogs.update_crime
spec.transitions: [/catalogos/crimes]
spec.state_messages: { loading: "Salvando crime/contravenção...", error: "{{error_message}}", success: "Crime/contravenção salvo com sucesso." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### UsersHub

```yaml
spec.route: /usuarios
spec.component:
  component: HubPage
  title: "Usuários"
  cards:
    - label: "Listar usuários"
      navigate: /usuarios/lista
    - label: "Novo usuário"
      navigate: /usuarios/novo
      permission: admin
spec.states: [idle, loading, error, success]
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### UserList

```yaml
spec.route: /usuarios/lista
spec.component:
  component: UsersListPage
  title: "Usuários"
  command_map:
    load: users.list
    delete: users.delete
  children:
    - component: DataToolbar
      features: [search, pagination]
    - component: DataTable
      source: "{{usuarios}}"
      row_actions: [view, edit, delete]
      write_actions_permission: admin
spec.transitions: [/usuarios/novo, /usuarios/:id]
spec.state_messages: { loading: "Carregando usuários...", error: "{{error_message}}", success: "Usuários atualizados." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### UserForm

```yaml
spec.route: /usuarios/novo | /usuarios/:id/editar
spec.component:
  component: UserFormPage
  title_create: "Novo Usuário"
  title_edit: "Editar Usuário"
  permission: admin
  command_map:
    load: users.get_detailed
    create: users.create
    update: users.update
  fields:
    - vinculo
    - dados_pessoais
    - contato
    - perfil
    - senha
spec.transitions: [/usuarios/lista, /usuarios/:id]
spec.state_messages: { loading: "Salvando usuário...", error: "{{error_message}}", success: "Usuário salvo com sucesso." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### UserView

```yaml
spec.route: /usuarios/:id
spec.component:
  component: UserDetailPage
  title: "Detalhes do Usuário"
  command_map:
    load: users.get_by_id
    load_statistics: users.get_statistics
  children:
    - component: DetailTabs
      tabs: [dados, estatisticas]
    - component: Button
      label: "Editar"
      permission: admin
      action: navigate.edit
spec.transitions: [/usuarios/:id/editar, /usuarios/lista]
spec.state_messages: { loading: "Carregando usuário...", error: "{{error_message}}", success: "Usuário carregado." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### AuditoriaList

```yaml
spec.route: /auditoria
spec.component:
  component: AuditListPage
  title: "Auditoria"
  command_map:
    load: audit.list
    current_user: auth.current_user
  children:
    - component: DataToolbar
      features: [search, filters, pagination]
    - component: DataTable
      source: "{{auditorias}}"
      read_only: true
spec.state_messages: { loading: "Carregando registros de auditoria...", error: "{{error_message}}", success: "Auditoria atualizada." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### EstatisticasEncarregados

```yaml
spec.route: /estatisticas/encarregados
spec.component:
  component: ResponsibleStatisticsPage
  title: "Estatísticas de Encarregados"
  command_map:
    load: reports.get_responsible_statistics
    load_latest: reports.get_latest_proceedings_by_responsible
  children:
    - component: ReportPanel
      source: "{{estatisticas_encarregados}}"
    - component: DataTable
      source: "{{ultimos_feitos}}"
spec.state_messages: { loading: "Carregando estatísticas de encarregados...", error: "{{error_message}}", success: "Estatísticas atualizadas." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### EstatisticasEncarregadosNew

```yaml
spec.route: /estatisticas/encarregados/alternativa
spec.component:
  component: ResponsibleStatisticsPage
  title: "Estatísticas de Encarregados"
  variant: alternative_legacy
  command_map:
    load: reports.get_responsible_statistics
    load_latest: reports.get_latest_proceedings_by_responsible
  visibility: admin_or_feature_flag
spec.state_messages: { loading: "Carregando estatísticas de encarregados...", error: "{{error_message}}", success: "Estatísticas atualizadas." }
spec.deviations: [DEV-001, DEV-002, DEV-003, DEV-004]
```

### EstatisticasProcessos

```yaml
spec.route: /estatisticas/processos
spec.component:
  component: ProcessStatisticsPage
  title: "Estatísticas de Processos"
  command_map:
    years: reports.list_available_years
    pads_solutions: reports.get_pads_solution_statistics
    ipm_evidence: reports.get_ipm_evidence_statistics
    sr_evidence: reports.get_sr_evidence_statistics
    top_transgressions: reports.get_top_transgressions
    driver_ranking: reports.get_driver_incident_ranking
    nature_statistics: reports.get_investigated_nature_statistics
    military_crimes: reports.get_military_crime_statistics
    common_crimes: reports.get_common_crime_statistics
  children:
    - component: YearFilter
    - component: ChartGrid
      source: "{{graficos}}"
    - component: RankingTables
      source: "{{ranking}}"
spec.state_messages: { loading: "Carregando estatísticas de processos...", error: "{{error_message}}", success: "Estatísticas atualizadas." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### MapaMensal

```yaml
spec.route: /mapas/mensal
spec.component:
  component: MonthlyMapPage
  title: "Mapa Mensal"
  command_map:
    list_types: reports.list_process_types_for_map
    generate_complete: reports.generate_complete_monthly_map
    generate_by_type: reports.generate_monthly_map
    save: reports.save_monthly_map
    list_saved: reports.list_saved_maps
    get_saved: reports.get_saved_map
    delete_saved: reports.delete_saved_map
  children:
    - component: MonthYearFilter
    - component: ProcessTypeSelector
    - component: ReportPanel
      source: "{{dados_mapa}}"
    - component: Button
      label: "Salvar mapa"
      permission: admin
spec.transitions: [/mapas/anteriores]
spec.state_messages: { loading: "Gerando mapa mensal...", error: "{{error_message}}", success: "Mapa mensal processado." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### MapasAnteriores

```yaml
spec.route: /mapas/anteriores
spec.component:
  component: SavedMapsPage
  title: "Mapas Anteriores"
  command_map:
    load: reports.list_saved_maps
    get: reports.get_saved_map
    delete: reports.delete_saved_map
  children:
    - component: DataToolbar
      features: [search, filters]
    - component: DataTable
      source: "{{mapas_salvos}}"
      row_actions: [view, delete]
      write_actions_permission: admin
spec.transitions: [/mapas/mensal]
spec.state_messages: { loading: "Carregando mapas salvos...", error: "{{error_message}}", success: "Mapas salvos atualizados." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### EstatutoArt29List

```yaml
spec.route: /catalogos/art29
spec.component:
  component: CatalogListPage
  title: "Estatuto Art. 29"
  command_map:
    load: legal_catalogs.list_art29
    delete: legal_catalogs.delete_art29
  table_source: "{{infracoes_art29}}"
  actions: [create, edit, delete]
  write_actions_permission: admin
spec.transitions: [/catalogos/art29/novo]
spec.state_messages: { loading: "Carregando infrações do Art. 29...", error: "{{error_message}}", success: "Infrações do Art. 29 atualizadas." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### EstatutoArt29Form

```yaml
spec.route: /catalogos/art29/novo | /catalogos/art29/:id/editar
spec.component:
  component: CatalogFormPage
  title_create: "Nova Infração do Art. 29"
  title_edit: "Editar Infração do Art. 29"
  permission: admin
  command_map:
    load: legal_catalogs.get_art29
    create: legal_catalogs.create_art29
    update: legal_catalogs.update_art29
spec.transitions: [/catalogos/art29]
spec.state_messages: { loading: "Salvando infração do Art. 29...", error: "{{error_message}}", success: "Infração do Art. 29 salva com sucesso." }
spec.deviations: [DEV-001, DEV-002, DEV-003]
```

### UserFormBackup

```yaml
spec.route: /_legacy/usuarios/form-backup
spec.component:
  component: LegacyReferencePage
  title: "Formulário de Usuário - Backup"
  visibility: admin_or_disabled_by_default
  purpose: "Rastreabilidade de artefato legado; fluxo primario e UserForm."
spec.state_messages: { loading: "Carregando referência legada...", error: "{{error_message}}", success: "Referência carregada." }
spec.deviations: [DEV-001, DEV-002, DEV-003, DEV-004]
```

### TransgressaoListDebug

```yaml
spec.route: /_legacy/catalogos/transgressoes-debug
spec.component:
  component: LegacyReferencePage
  title: "Transgressões - Debug"
  visibility: admin_or_disabled_by_default
  purpose: "Rastreabilidade de tela de debug; fluxo primario e TransgressaoList."
spec.state_messages: { loading: "Carregando referência legada...", error: "{{error_message}}", success: "Referência carregada." }
spec.deviations: [DEV-001, DEV-002, DEV-003, DEV-004]
```

### EstatisticasEncarregadosBackup

```yaml
spec.route: /_legacy/estatisticas/encarregados-backup
spec.component:
  component: LegacyReferencePage
  title: "Estatísticas de Encarregados - Backup"
  visibility: admin_or_disabled_by_default
  purpose: "Rastreabilidade de backup; fluxo primario e EstatisticasEncarregados."
spec.state_messages: { loading: "Carregando referência legada...", error: "{{error_message}}", success: "Referência carregada." }
spec.deviations: [DEV-001, DEV-002, DEV-003, DEV-004]
```

### TestExclusao

```yaml
spec.route: /_legacy/teste-exclusao
spec.component:
  component: LegacyReferencePage
  title: "Teste de Exclusão"
  visibility: disabled_by_default
  purpose: "Artefato de teste legado; nao entra na navegacao principal."
spec.state_messages: { loading: "Carregando teste legado...", error: "{{error_message}}", success: "Teste carregado." }
spec.deviations: [DEV-001, DEV-002, DEV-003, DEV-004]
```

## Estados por tela modernizada

| Estado | Descricao | Conteudo/mensagem |
|---|---|---|
| Idle | Estado padrao apos entrada na rota | Conteudo inicial, filtros e dados em cache quando existirem |
| Loading | Operacao assincrona em curso | Spinner, skeleton ou indicador compacto sem bloquear toda a janela quando possivel |
| Error | Falha de comando, validacao ou permissao | `{{error_message}}` vindo do envelope Tauri |
| Success | Operacao concluida | Mensagem contextual e atualizacao dos dados afetados |

## Apendice: rastreabilidade ao inventario

| Tela | Origem em `_reversa_sdd/screens/inventory.json` |
|---|---|
| Login | SCR-0001 |
| Dashboard | SCR-0002 |
| ProceduresHub | SCR-0003 |
| ProcedureList | SCR-0004 |
| ProcedureForm | SCR-0005 |
| ProcedureView | SCR-0006 |
| TransgressaoList | SCR-0007 |
| TransgressaoForm | SCR-0008 |
| CrimeList | SCR-0009 |
| CrimeForm | SCR-0010 |
| UsersHub | SCR-0011 |
| UserList | SCR-0012 |
| UserForm | SCR-0013 |
| UserView | SCR-0014 |
| AuditoriaList | SCR-0015 |
| EstatisticasEncarregados | SCR-0016 |
| EstatisticasEncarregadosNew | SCR-0017 |
| EstatisticasProcessos | SCR-0018 |
| MapaMensal | SCR-0019 |
| MapasAnteriores | SCR-0020 |
| EstatutoArt29List | SCR-0021 |
| EstatutoArt29Form | SCR-0022 |
| UserFormBackup | SCR-0023 |
| TransgressaoListDebug | SCR-0024 |
| EstatisticasEncarregadosBackup | SCR-0025 |
| TestExclusao | SCR-0026 |
