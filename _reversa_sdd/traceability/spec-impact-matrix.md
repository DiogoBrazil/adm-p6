# Spec Impact Matrix — Gestão P6

> Gerado pelo Arquiteto em 2026-05-12
>
> Esta matriz mapeia qual componente/módulo impacta quais outros.
> Use para avaliar o risco de uma mudança antes de implementar.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ●● | Impacto alto — mudança quase certa |
| ● | Impacto médio — pode ser necessário ajuste |
| ○ | Impacto baixo — improvável mas possível |
| — | Sem impacto direto |

---

## Matriz de Impacto: Módulos × Componentes Afetados

| Módulo alterado | auth | processos | usuarios | catalogos | rdpm | art29 | prazos | andamentos | indicios | mapas | relatorios | auditorias | DB schema |
|----------------|------|-----------|---------|----------|------|-------|--------|------------|---------|-------|------------|------------|----------|
| **auth** | ●● | ● | ● | — | — | — | — | — | — | — | — | — | — |
| **processos** | — | ●● | ○ | ○ | ○ | ○ | ●● | ●● | ●● | ●● | ●● | ● | ●● |
| **usuarios** | ● | ● | ●● | — | — | — | — | — | — | ○ | ○ | ● | ● |
| **catalogos** (crimes) | — | ○ | — | ●● | — | — | — | — | ●● | ○ | ○ | ● | ● |
| **rdpm** | — | ○ | — | — | ●● | — | — | — | ●● | ○ | ○ | ● | ● |
| **art29** | — | ○ | — | — | — | ●● | — | — | ●● | ○ | ○ | ● | ● |
| **prazos** | — | ● | — | — | — | — | ●● | ● | — | ○ | ● | ○ | ● |
| **andamentos** | — | ●● | — | — | — | — | ● | ●● | — | ○ | — | ○ | — |
| **indicios** | — | ●● | — | ●● | ●● | ●● | — | — | ●● | — | ○ | ○ | ● |
| **mapas** | — | ●● | ● | — | — | — | — | — | — | ●● | ○ | — | ● |
| **relatorios** | — | ●● | ● | — | ○ | ○ | ● | — | ○ | ● | ●● | — | — |
| **auditorias** | ● | ○ | ○ | ○ | ○ | ○ | — | — | — | — | — | ●● | ● |

---

## Análise de Criticidade dos Componentes

### Alta Criticidade (●● em 4+ colunas)

| Componente | Motivo |
|-----------|--------|
| **processos_procedimentos** (tabela) | Tabela central do sistema; todo módulo de workflow a referencia |
| **usuarios** (tabela) | FKs em processos, indícios, mapas, auditoria |
| **processos_service.py** | Toda lógica de negócio de processos; 1.800+ linhas |
| **prazos_andamentos_manager.py** | Controla o ciclo de vida de prazos; acoplado ao startup |

### Caminhos de Mudança de Alto Risco

```
Mudança em auth.py
  → sesão global (usuario_logado)
  → guards (guard_login / guard_admin)
  → todos os 12 routers (todos dependem dos guards)
  → UI de login + permissions.js

Mudança em processos_procedimentos (schema)
  → processos_service.py (INSERT/UPDATE de 40+ campos)
  → procedure_form.js (serialização dos dados)
  → procedure_view.js (renderização)
  → mapa_mensal.js (leitura de campos)
  → relatorios (queries analíticas)
  → prazos (data_recebimento, tipo_detalhe)
  → andamentos (campo JSONB embutido)

Mudança em indicios (schema)
  → 4 tabelas (pm_envolvido_indicios, pm_envolvido_crimes, pm_envolvido_rdpm, pm_envolvido_art29)
  → crimes_contravencoes (FK lógica)
  → transgressoes (FK lógica)
  → infracoes_estatuto_art29 (FK lógica)
  → modal-indicios-solucao.js (3 versões no código!)
```

---

## Módulos Isolados (Baixo Risco)

| Módulo | Dependências de entrada | Impacto de mudança |
|--------|------------------------|-------------------|
| **municipios_distritos** | Apenas catalogos.py | Isolado — mudança de baixo risco |
| **mapas_salvos** | Apenas mapas.py | Isolado — sem FKs declaradas |
| **auditoria** | Escrita via db_manager.registrar_auditoria() | Impacto mínimo — append-only |

---

## Componentes Compartilhados (Alta Atenção na Migração)

| Componente | Consumido por |
|-----------|--------------|
| `db_manager.registrar_auditoria()` | processos, catalogos, rdpm, art29, usuarios |
| `db_manager.hash_password()` | auth (cadastro inicial), usuarios |
| `_guard_login()` / `_guard_admin()` | Todos os 12 routers |
| `prazos_andamentos.py` | Router prazos + Router andamentos |
| `mapas_relatorios.py` | Router mapas + Router relatorios |

---

## Impacto na Migração Rust/Tauri

| Área | Risco | Nota |
|------|-------|------|
| Protocolo WebSocket (Eel) | 🔴 Alto | Substituído por comandos Tauri — cada `@eel.expose` vira um `#[tauri::command]` |
| Sessão global | 🔴 Alto | `usuario_logado` → `tauri::State<Mutex<Option<Usuario>>>` |
| JSONB inline (andamentos, etc.) | 🟡 Médio | Banco não muda; só a leitura/escrita via Rust (serde_json) |
| bcrypt | 🟢 Baixo | Crate `bcrypt` disponível em Rust |
| ReportLab (PDF) | 🔴 Alto | Sem equivalente direto em Rust — possíveis: printpdf, wkhtmltopdf, ou geração via webview |
| psycopg2 | 🟡 Médio | Substituído por `sqlx` + driver PostgreSQL |
| Padrão de resposta duplo | 🟡 Médio | Oportunidade de uniformizar para `Result<T, E>` em Rust |
