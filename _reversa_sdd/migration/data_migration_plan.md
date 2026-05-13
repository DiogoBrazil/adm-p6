---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: data_migration_plan
producedBy: designer
hash: "sha256:356474ba9b0428a60159829dcd71582e4415c168edf46ccc9b718d8ff94cc8fa"
---

# Data Migration Plan

> Plano de migracao dos dados do legado para o sistema novo.

## Resumo

- Volume estimado: nao informado; tabelas classificadas como operacionais/seed em `data-dictionary.md`.
- Janela de migracao: ver `cutover_plan.md`.
- Estrategia: **reaproveitamento de banco + validacao por base clonada**. Nao ha ETL estrutural obrigatorio na primeira versao, pois o PostgreSQL existente sera usado pelo Tauri via sqlx.

## Mapeamento legado → novo

| Origem | Destino | Tipo | Notas |
|---|---|---|---|
| `usuarios` | `users` structs/repository | reaproveitamento | hash pode ser bcrypt ou SHA-256 legado |
| `processos_procedimentos` | `proceedings` | reaproveitamento com regras alvo | IPPM desconsiderado; `indicios_categorias` nao canonico |
| `prazos_processo` | `deadlines` | reaproveitamento | `ativo=1` preservado |
| `processos_procedimentos.andamentos` | `movements` | JSONB reaproveitado | fallback de campos legados |
| `pm_envolvido_*` | `evidence` | reaproveitamento | fonte canonica de indicios |
| `procedimentos_indicios_*` | `evidence` | reaproveitamento | incluir conforme decisao humana |
| `crimes_contravencoes`, `transgressoes`, `infracoes_estatuto_art29`, `municipios_distritos` | `legal_catalogs` | reaproveitamento | preservar IDs existentes |
| `mapas_salvos` | `maps_reports` | reaproveitamento | dados JSONB preservados |
| `auditoria` | `audit` | reaproveitamento | append-only operacional |

## Transformacoes

### T-01: Hash de senha
- **Aplica em**: `usuarios.senha`
- **Regra**: login aceita SHA-256 legado e bcrypt; apos login SHA-256 bem-sucedido, atualizar para bcrypt. `atualizar_usuario` sempre salva bcrypt.
- **Tratamento de invalidos**: rejeitar login e registrar erro controlado.
- **Origem**: BR-MIGRAR-002.

### T-02: IPPM inexistente
- **Aplica em**: tipos, filtros, fixtures e qualquer dado `tipo_detalhe='IPPM'`.
- **Regra**: nao oferecer IPPM no sistema novo. Se houver dado historico com IPPM, listar em relatorio de pre-cutover para decisao manual.
- **Tratamento de invalidos**: bloquear novas escritas; leitura historica apenas se existir dado real e for necessario.
- **Origem**: BR-DESCARTAR-009.

### T-03: Indicios canonicos
- **Aplica em**: `processos_procedimentos.indicios_categorias`, `pm_envolvido_indicios.categorias_indicios`.
- **Regra**: usar `pm_envolvido_indicios.categorias_indicios` como fonte canonica.
- **Tratamento de invalidos**: manter fallback de leitura se dados antigos dependerem do campo legado.
- **Origem**: BR-DESCARTAR-005, BR-MIGRAR-012.

### T-04: JSONB de andamentos
- **Aplica em**: `processos_procedimentos.andamentos`.
- **Regra**: normalizar campos `texto`, `descricao`, `descricao_andamento`, `observacoes` para DTO de leitura.
- **Tratamento de invalidos**: retornar item com texto fallback e registrar warning tecnico.
- **Origem**: BR-MIGRAR-011.

### T-05: RDPM hard delete protegido
- **Aplica em**: `transgressoes`, `pm_envolvido_rdpm`.
- **Regra**: antes de deletar transgressao, checar referencias; se houver, retornar erro.
- **Tratamento de invalidos**: nao deletar.
- **Origem**: BR-MIGRAR-005.

## Estrategia de ETL

- **Ferramenta**: scripts SQL de validacao + comandos administrativos Rust/Tauri quando necessario.
- **Fluxo**:
  1. Clonar ou fazer backup do PostgreSQL.
  2. Executar scripts de diagnostico: contagens, IPPM, hashes SHA-256, JSON invalido, referencias RDPM.
  3. Rodar app Tauri contra base clonada.
  4. Comparar resultados com legado em Parallel Run.
  5. Corrigir divergencias antes do cutover.
- **Idempotencia**: diagnosticos sao read-only; upgrades de hash ocorrem por usuario no login e podem ser repetidos com seguranca.
- **Throughput esperado**: nao aplicavel sem ETL bulk.

## Backfill e delta

- **Backfill**: nao requerido se o banco existente for reaproveitado.
- **Captura de delta**: nao requerida; durante cutover, congelar uso do legado.
- **Reconciliação periodica**: durante homologacao, comparar contagens e amostras entre legado e Tauri.

## Cutover de dados

- **Janela**: definida em `cutover_plan.md`.
- **Sequencia de corte**:
  1. Congelar uso do legado.
  2. Fazer backup do PostgreSQL.
  3. Rodar diagnosticos finais.
  4. Iniciar Tauri apontando para banco alvo.
  5. Executar smoke tests e comparacoes.
- **Verificacao pos-corte**:
  - **Contagens**: usuarios, processos, prazos, PMs envolvidos, indicios, mapas, auditoria.
  - **Checksums/amostras**: relatorios/mapas criticos, PDFs, processos com andamentos, processos com indicios.

## Validacao de qualidade

| Metrica | Alvo | Fonte |
|---|---|---|
| Contagem por tabela operacional | igual | SQL direto legado vs Tauri/sqlx |
| Processos por status/tipo | igual, excluindo IPPM se so existir como referencia fantasma | relatorios de paridade |
| Mapas mensais | igual em amostras | legado + novo |
| Relatorios PDF | mesmo conteudo essencial | comparacao funcional |
| Integridade RDPM | 0 exclusoes referenciadas | script de diagnostico |
| Hashes SHA-256 | aceitos e migrados no login | teste de auth |

## Riscos especificos de dados

- RISK-004: Dados legados JSON/TEXT incompatíveis.
- RISK-008: Cutover sem base comparavel.
- RISK-002: Relatorios e mapas divergentes.

## Notas

- A primeira versao deve evitar mudanca destrutiva de schema.
- Qualquer migration futura deve ser pequena, reversivel e validada em base clonada.
