# Code-Spec Matrix — Rastreabilidade Código ↔ Spec

Mapeamento de arquivos do legado para as units de spec geradas.

| Arquivo do legado | Unit correspondente | Cobertura |
|-------------------|---------------------|-----------|
| `main.py` (linhas 1-100) | `autenticacao/` | 🟢 |
| `main.py` (linhas 101-1645) | `autenticacao/`, `catalogos/` | 🟢 |
| `main.py` (linhas 1646-5178) | `processos/` (handlers legados ~60) | 🟡 parcial |
| `app/routers/__init__.py` | transversal | 🟢 |
| `app/routers/catalogos.py` | `catalogos/` | 🟢 |
| `app/routers/rdpm.py` | `rdpm/` | 🟢 |
| `app/routers/art29.py` | `art29/` | 🟢 |
| `app/routers/processos.py` | `processos/` | 🟢 |
| `app/routers/usuarios.py` | `usuarios/` | 🟢 |
| `app/routers/prazos.py` | `prazos/` | 🟢 |
| `app/routers/andamentos.py` | `andamentos/` | 🟢 |
| `app/routers/indicios.py` | `indicios/` | 🟢 |
| `app/routers/mapas.py` | `mapas/` | 🟢 |
| `app/routers/relatorios.py` | `relatorios/` | 🟢 |
| `app/routers/auditorias.py` | `auditorias/` | 🟢 |
| `app/services/processos_service.py` | `processos/` | 🟢 |
| `app/services/usuarios.py` | `usuarios/` | 🟢 |
| `app/services/prazos_andamentos.py` | `prazos/`, `andamentos/` | 🟢 |
| `app/services/indicios.py` | `indicios/` | 🟢 |
| `app/services/mapas_relatorios.py` | `mapas/`, `relatorios/` | 🟢 |
| `app/services/auditorias.py` | `auditorias/` | 🟢 |
| `app/processos.py` | `processos/` (soft delete) | 🟢 |
| `app/catalogos.py` | `catalogos/` | 🟢 |
| `prazos_andamentos_manager.py` | `prazos/` | 🟢 |
| `db_config.py` | transversal (autenticacao, auditorias) | 🟢 |
| `alembic/versions/0001_bootstrap_core_tables.py` | `erd-complete.md` | 🟢 |
| `alembic/versions/0006_add_pdf_processos.py` | `processos/` | 🟢 |
| `docker-compose.yml` | `architecture.md`, `deployment.md` | 🟢 |
| `requirements.txt` | `architecture.md` | 🟢 |
| `web/static/js/procedure_form.js` | `processos/` (validações frontend) | 🟡 parcial |
| `web/static/js/user_form.js` | `usuarios/` (opções de posto/graduação) | 🟡 parcial |
| `web/static/js/` (demais arquivos) | n/a | n/a |

## Arquivos sem unit correspondente (candidatos a análise)

| Arquivo | Motivo |
|---------|--------|
| `main.py:1646-5178` | ~60 handlers legados de processos não migrados para routers — mapeamento individual pendente |
| `app/services/db.py` | DatabaseManager alternativo — possível duplicata de `db_config.py:DatabaseManager` |
| `web/static/js/*.js` (além dos mapeados) | Lógica de UI — coberta indiretamente pelas specs dos módulos backend |

## Cobertura Estimada

- **Arquivos mapeados com cobertura 🟢:** 26/28 (~93%)
- **Cobertura parcial 🟡:** 3 arquivos
- **Sem unit (n/a):** 2 entradas

> A cobertura 🟡 em `main.py:1646-5178` representa a maior lacuna: ~60 handlers legados de processos que precisam de mapeamento individual antes da migração Rust.
