---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: target_domain_model
producedBy: designer
hash: "sha256:6c368a78aa0d476ccf3debb4fb30dae6427f07b9ce8abf9d4c91c9c470aee772"
---

# Target Domain Model

> Modelo de dominio do sistema novo com rastreabilidade para o legado.

## Aggregates

### AGG-IdentitySession
- **Aggregate root**: Session
- **Invariantes**: usuario ativo; `is_operador=true`; perfil calculado no login; senha nunca retornada.
- **Comandos aceitos**: `login`, `logout`, `current_user`.
- **Origem no legado**: `_reversa_sdd/autenticacao/requirements.md`, BR-MIGRAR-001/002.

### AGG-User
- **Aggregate root**: User
- **Invariantes**: matricula unica; email unico para operador; email lowercase; nome uppercase; escrita apenas admin; admin nao desativa a propria conta.
- **Comandos aceitos**: criar, atualizar, desativar, reativar, listar, obter, estatisticas.
- **Origem no legado**: `_reversa_sdd/usuarios/requirements.md`, BR-MIGRAR-009/016.

### AGG-LegalCatalog
- **Aggregate root**: LegalCatalogItem
- **Invariantes**: crime valida artigo/paragrafo/inciso/alinea; RDPM tem id inteiro e hard delete protegido; Art29 tem inciso unico ativo.
- **Comandos aceitos**: criar/editar/remover/listar/buscar catalogos.
- **Origem no legado**: BR-MIGRAR-004/005/006.

### AGG-Proceeding
- **Aggregate root**: Proceeding
- **Invariantes**: tipos validos sem IPPM; unicidade numero/documento/ano/origem/tipo; PADS exige transgressao; datas alvo nao futuras; penalidade apenas se `Punido`; dias apenas para Prisao/Detencao; soft delete; PDF ate 100 MB.
- **Comandos aceitos**: registrar, atualizar, concluir, reabrir, excluir, salvar/remover/obter PDF, listar, obter detalhe.
- **Origem no legado**: BR-MIGRAR-007/008/016.

### AGG-Deadline
- **Aggregate root**: Deadline
- **Invariantes**: prazo inicial automatico; prazo ativo unico; prorrogacao inicia apos vencimento atual; IPM=40 dias; IPPM inexistente.
- **Comandos aceitos**: adicionar inicial, prorrogar, concluir, listar, dashboard.
- **Origem no legado**: BR-MIGRAR-010.

### AGG-MovementLog
- **Aggregate root**: MovementList
- **Invariantes**: andamentos em JSONB do processo; novo item no inicio; remover por id; fallback de campos legados.
- **Comandos aceitos**: adicionar, listar, remover.
- **Origem no legado**: BR-MIGRAR-011.

### AGG-EvidenceSet
- **Aggregate root**: EvidenceSet
- **Invariantes**: um conjunto ativo por PM envolvido; salvar substitui vinculos; categorias derivadas de catalogos; tabelas `procedimentos_indicios_*` incluidas.
- **Comandos aceitos**: salvar, carregar, listar por procedimento, remover, buscar catalogos.
- **Origem no legado**: BR-MIGRAR-012.

### AGG-Report
- **Aggregate root**: ReportRequest
- **Invariantes**: mapas consideram ativos; em andamento ate mes; concluidos no mes; relatorios stub devem existir; exportacoes preservam dados essenciais.
- **Comandos aceitos**: gerar mapa, salvar mapa, listar mapas, gerar relatorio anual, estatisticas gerais, por encarregado, por tipo, prazos vencidos, CSV, Excel.
- **Origem no legado**: BR-MIGRAR-013/014.

### AGG-AuditEntry
- **Aggregate root**: AuditEntry
- **Invariantes**: operacao em CREATE/UPDATE/DELETE; leitura apenas admin; escrita passiva em comandos de escrita.
- **Comandos aceitos**: registrar, listar, obter detalhe, por registro, por usuario, estatisticas.
- **Origem no legado**: BR-MIGRAR-015.

## Entidades

| Entidade | Aggregate dono | Atributos principais | Origem |
|---|---|---|---|
| User | AGG-User | id, tipo, posto, nome, matricula, flags, email, perfil, ativo | `usuarios` |
| Proceeding | AGG-Proceeding | id, numero, tipo, datas, papeis, solucao, penalidade, pdf | `processos_procedimentos` |
| InvolvedPerson | AGG-Proceeding | id, procedimento_id, pm_id, status, ordem | `procedimento_pms_envolvidos` |
| Deadline | AGG-Deadline | id, processo_id, tipo, datas, ativo, portaria | `prazos_processo` |
| EvidenceSet | AGG-EvidenceSet | id, pm_envolvido_id, categorias, ativo | `pm_envolvido_indicios` |
| MapSnapshot | AGG-Report | periodo, tipo, totais, dados JSON | `mapas_salvos` |
| AuditEntry | AGG-AuditEntry | tabela, registro_id, operacao, usuario, timestamp | `auditoria` |

## Value objects

| Value object | Atributos | Validacoes | Origem |
|---|---|---|---|
| Email | string | lowercase, obrigatorio para operador | BR-MIGRAR-009 |
| PasswordHash | string | bcrypt ou SHA-256 legado detectavel | BR-MIGRAR-002 |
| LegalArticle | artigo, paragrafo, inciso, alinea | regex e normalizacao | BR-MIGRAR-004 |
| ProceedingKind | tipo_geral, tipo_detalhe | enum sem IPPM | BR-DESCARTAR-009 |
| Penalty | tipo, dias | dias apenas Prisao/Detencao | BR-MIGRAR-007 |
| DateRule | datas do processo | data_instauracao/data_conclusao nao futuras | BR-MIGRAR-008 |
| PdfAttachment | nome, content_type, tamanho, bytes | limite 100 MB | BR-MIGRAR-007 |

## Eventos de dominio

O paradigma alvo nao e event-driven. Eventos abaixo sao registros internos opcionais para auditoria/testes, nao mensageria.

| Evento | Publicado por | Consumido por | Schema resumido |
|---|---|---|---|
| UserChanged | AGG-User | audit | user_id, operacao, actor_id |
| ProceedingChanged | AGG-Proceeding | audit, parity tests | processo_id, operacao, actor_id |
| DeadlineChanged | AGG-Deadline | audit | prazo_id, processo_id, operacao |
| ReportGenerated | AGG-Report | audit/parity | tipo, periodo, usuario_id |

## Regras de dominio

| Regra | Local no dominio novo | Origem |
|---|---|---|
| BR-MIGRAR-001 | `auth::domain::Session` | target_business_rules.md |
| BR-MIGRAR-002 | `auth::domain::PasswordHash` | target_business_rules.md |
| BR-MIGRAR-003 | `auth::guards`, `users::commands` | target_business_rules.md |
| BR-MIGRAR-004 a 006 | `legal_catalogs::domain` | target_business_rules.md |
| BR-MIGRAR-007/008/016 | `proceedings::domain` | target_business_rules.md |
| BR-MIGRAR-010 | `deadlines::domain` | target_business_rules.md |
| BR-MIGRAR-011 | `movements::domain` | target_business_rules.md |
| BR-MIGRAR-012 | `evidence::domain` | target_business_rules.md |
| BR-MIGRAR-013/014 | `maps_reports::domain` | target_business_rules.md |
| BR-MIGRAR-015 | `audit::domain` | target_business_rules.md |

## Rastreabilidade para o legado

| Elemento novo | Origem no legado | Tipo |
|---|---|---|
| `auth` | `auth.py`, `main.py` login | fundido |
| `legal_catalogs` | `catalogos`, `rdpm`, `art29` | fundido |
| `proceedings` | `processos_service`, `processos.py`, routers | preservado com redesign |
| `deadlines` / `movements` | `prazos_andamentos.py`, manager | dividido |
| `maps_reports` | `mapas_relatorios.py` | fundido |
| `AppError` | padrao duplo de dicts | novo, substitui `discard_log.md` BR-DESCARTAR-008 |

## Notas

- `IPPM` nao deve existir em enums alvo.
- Escrita em qualquer modulo exige perfil admin; perfil comum e somente leitura.
