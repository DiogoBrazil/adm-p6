---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: topology_decision
producedBy: designer
hash: "sha256:579daa845d5a09686b89c458d7b81fa38b119ac8e087b3d3cb8f212c233869cc"
---

# Topology Decision

> Decisao consciente sobre como organizar o sistema novo: preservar a topologia do legado, adotar uma topologia moderna ou aplicar um hibrido.
> Este artefato e leitura obrigatoria do proprio Designer e do agente de codificacao.

## Topologia do legado detectada

- **Padrao organizacional**: hibrido — backend package-by-layer com alguns modulos por dominio; frontend por paginas/telas
- **Confianca**: 🟢 CONFIRMADO
- **Evidencias**:
  - `_reversa_sdd/architecture.md` mostra camadas separadas: Frontend `web/`, Routers `app/routers/*.py`, Services `app/services/*.py` e banco PostgreSQL.
  - `_reversa_sdd/inventory.md` mostra `app/routers/` com handlers por modulo e `app/services/` com servicos, enquanto arquivos como `app/rdpm.py`, `app/art29.py`, `app/catalogos.py` ficam fora de `services`.
  - `_reversa_sdd/architecture.md` registra `main.py` com 7.283 linhas e logica legada nao migrada, alem de duplicacao de `DatabaseManager`.
  - `_reversa_sdd/inventory.md` mostra frontend em `web/` organizado por paginas HTML e JS/CSS, nao por capability compartilhada.
- **Mapa da arvore legada**:
  ```
  adm-p6/
  ├── main.py
  ├── db_config.py
  ├── prazos_andamentos_manager.py
  ├── app/
  │   ├── routers/
  │   ├── services/
  │   ├── catalogos.py
  │   ├── rdpm.py
  │   ├── art29.py
  │   └── processos.py
  ├── alembic/
  └── web/
      ├── *.html
      └── static/{js,css,images}
  ```

## Diagnostico estrutural

- **Acoplamento**: medio-alto. O frontend chama funcoes Eel diretamente; routers delegam a services, mas `main.py` tambem concentra inicializacao, sessao global e handlers legados.
- **Coesao por modulo**: media. Ha nomes de modulos de negocio claros, mas relatorios e mapas compartilham service, prazos e andamentos compartilham service/manager, e parte da logica fica fora dos services.
- **Modulos orfaos / mortos**: handlers legados de `main.py` nao usados pela UI atual foram descartados pelo Curator; `atualizar_usuario_old` tambem foi descartado.
- **Camadas redundantes**: `db_config.py` e `app/services/db.py` duplicam responsabilidades; algumas regras ficam em frontend e backend.
- **Violacoes de fronteira**: validacoes criticas em JS precisam virar dominio backend; services acessam SQL diretamente; resposta tem padrao duplo.
- **Mistura de paradigmas/estilos**: procedural em camadas, paginas JS imperativas, managers com estado e SQL direto.
- **Avaliacao geral**: parcialmente problemática. Os modulos de negocio existem e ajudam a migrar, mas a topologia carrega debitos que a reescrita Rust/Tauri deve corrigir.

## Topologia moderna proposta

- **Padrao**: vertical slices por capability em monolito desktop Tauri, com dominio tipado e repositorios sqlx simples
- **Justificativa**: o sistema e desktop, autocontido, sem mensageria e com banco unico reaproveitado. Vertical slices agrupam comando Tauri, regras de dominio, DTOs e repositorios por capability, evitando tanto um monolito procedural quanto arquitetura enterprise excessiva. Isso honra a escolha transformacional em Rust sem introduzir microservicos, CQRS ou DI pesado.
- **Ganhos concretos esperados**:
  - Testabilidade por capability: processos, prazos, indicios, mapas e relatorios podem ter testes isolados.
  - Onboarding mais rapido: cada pasta contem comando, dominio e persistencia relacionados.
  - Menos acoplamento UI-backend: comandos Tauri tipados substituem chamadas Eel flexiveis.
  - Melhor paridade: capacidades criticas podem ser validadas em Parallel Run.
  - Modelagem Rust idiomatica: enums para tipos/processos/solucoes/perfis, structs para DTOs e `Result` para erros.
- **Custo / risco**:
  - Exige redesenhar fronteiras, nao copiar pastas Python 1-para-1.
  - Exige disciplina para nao duplicar queries ou DTOs entre capabilities.
  - Relatorios/PDF exigem decisao tecnica propria.
- **Esboco da arvore proposta**:
  ```
  src-tauri/
  ├── src/
  │   ├── main.rs
  │   ├── app_state.rs
  │   ├── config.rs
  │   ├── error.rs
  │   ├── db/
  │   │   ├── pool.rs
  │   │   └── migrations.rs
  │   ├── auth/
  │   │   ├── commands.rs
  │   │   ├── domain.rs
  │   │   └── repository.rs
  │   ├── users/
  │   ├── legal_catalogs/
  │   ├── proceedings/
  │   ├── deadlines/
  │   ├── movements/
  │   ├── evidence/
  │   ├── maps_reports/
  │   └── audit/
  └── tauri.conf.json
  ui/
  ├── src/
  │   ├── app/
  │   ├── shared/
  │   └── features/
  │       ├── auth/
  │       ├── users/
  │       ├── catalogs/
  │       ├── proceedings/
  │       ├── deadlines/
  │       ├── evidence/
  │       ├── maps-reports/
  │       └── audit/
  └── package.json
  ```

## Opcoes apresentadas ao usuario

1. **Preservar topologia legada** (conservador)
   - Consequencias: backend Rust copiaria camadas `commands/services/repositories` globais e frontend seguiria paginas por tela. Reduz estranhamento, mas preserva parte do acoplamento e tende a repetir o padrao procedural.
2. **Adotar topologia moderna proposta** (transformacional)
   - Consequencias: organiza por capability vertical, com comandos, dominio e persistencia juntos por modulo. Exige aprendizado, mas maximiza os ganhos de Rust/Tauri e facilita testes de paridade.
3. **Hibrido** (equilibrado)
   - Consequencias: backend usa vertical slices por capability, mas frontend pode preservar nomes/fluxos de telas do legado durante a primeira versao. Bom para reduzir risco visual enquanto melhora a estrutura interna.

## Decisao do usuario

- **Escolha**: 2 — Adotar topologia moderna proposta
- **Justificativa do usuario**: usuario escolheu a topologia moderna proposta pelo Designer.
- **Decidido em**: 2026-05-12T22:51:48Z

## Mapeamento legado → novo

| Modulo / pasta legada | Bounded context novo | Tipo | Observacoes |
|---|---|---|---|
| `app/routers/auth.py`, auth em `main.py` | `auth` | preservado com redesign | Comandos Tauri e estado gerenciado |
| `app/services/usuarios.py`, `app/routers/usuarios.py` | `users` | preservado com redesign | Escrita admin, leitura comum |
| `app/catalogos.py`, `app/rdpm.py`, `app/art29.py`, routers correspondentes | `legal_catalogs` | fundido | Catalogos legais compartilham invariantes de manutencao admin e busca |
| `processos_service.py`, `app/processos.py`, `routers/processos.py` | `proceedings` | preservado com redesign | Core do dominio disciplinar |
| `prazos_andamentos_manager.py`, `routers/prazos.py`, parte de `services/prazos_andamentos.py` | `deadlines` | dividido | Prazos separados de movimentos para coesao |
| `routers/andamentos.py`, parte de `services/prazos_andamentos.py` | `movements` | dividido | Andamentos JSONB e normalizacao legada |
| `services/indicios.py`, `routers/indicios.py` | `evidence` | preservado com redesign | Indicios por PM envolvido |
| `services/mapas_relatorios.py`, routers mapas/relatorios | `maps_reports` | fundido inicialmente | Compartilham queries e geracao de PDF; pode dividir depois se crescer |
| `services/auditorias.py`, `routers/auditorias.py` | `audit` | preservado com redesign | Consulta e registro de auditoria |
| `web/*.html`, `web/static/js/*` | `ui/src/features/*` | dividido | Traducao por funcionalidades, nao copia literal de paginas |
| `main.py` handlers nao usados, `atualizar_usuario_old`, Eel/WebSocket, PyInstaller, IPPM | (descartado) | removido | Ver `discard_log.md` |

## Implicacoes pendentes para proximos passos do Designer

| Etapa do Designer | Implicacao | Como honrar |
|---|---|---|
| Bounded contexts | Evitar decomposicao 1-para-1 | Agrupar por capability e justificar fusoes/divisoes |
| target_architecture | Honrar Rust/Tauri idiomatico | Comandos Tauri, estado gerenciado, DTOs/erros tipados e repositorios sqlx |
| target_domain_model | Validacoes viram dominio | Enums/structs para tipos, solucoes, papeis, prazos e RBAC |
| target_data_model | Banco PostgreSQL reaproveitado | Mapear tabelas existentes sem mudancas destrutivas; manter fallbacks para JSON/TEXT |
| data_migration_plan | Big Bang + Parallel Run | Planejar base clonada, checks de paridade e rollback |

## Notas

- A proposta moderna nao implica microservicos. Continua sendo um monolito desktop Tauri.
- A opcao 3 e uma boa alternativa se o risco de mudanca visual pesar mais que a limpeza estrutural interna.
- Qualquer duvida tecnica Rust/Tauri/sqlx deve usar Context7 conforme `migration_brief.md`.
