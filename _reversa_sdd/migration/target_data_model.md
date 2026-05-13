---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: target_data_model
producedBy: designer
hash: "sha256:e7dd7fea6c6e6a30909e8de8a3f98acce0689063caac21b3f1324afa660e0774"
---

# Target Data Model

> Modelo de dados do sistema novo. O schema PostgreSQL legado e reaproveitado na primeira versao.

## Visao geral

Banco principal: PostgreSQL 16. A primeira versao Rust/Tauri deve operar sobre o schema existente, sem mudancas destrutivas, usando sqlx e mapeamento tipado. O modelo alvo e logico: organiza tabelas por bounded context e define restricoes que a aplicacao deve reforcar quando o banco nao possui constraint formal.

## Entidades de dados

| Entidade | Tabela | Aggregate dono | PK | Bounded context |
|---|---|---|---|---|
| User | `usuarios` | AGG-User | `id TEXT` | Identity/Personnel |
| Proceeding | `processos_procedimentos` | AGG-Proceeding | `id TEXT` | Proceedings |
| InvolvedPerson | `procedimento_pms_envolvidos` | AGG-Proceeding | `id TEXT` | Proceedings |
| Deadline | `prazos_processo` | AGG-Deadline | `id TEXT` | Procedural Tracking |
| EvidenceSet | `pm_envolvido_indicios` | AGG-EvidenceSet | `id TEXT` | Evidence |
| EvidenceCrime | `pm_envolvido_crimes` | AGG-EvidenceSet | `id TEXT` | Evidence |
| EvidenceRdpm | `pm_envolvido_rdpm` | AGG-EvidenceSet | `id TEXT` | Evidence |
| EvidenceArt29 | `pm_envolvido_art29` | AGG-EvidenceSet | `id TEXT` | Evidence |
| ProcedureEvidenceCrime | `procedimentos_indicios_crimes` | AGG-EvidenceSet | `id TEXT` | Evidence |
| ProcedureEvidenceRdpm | `procedimentos_indicios_rdpm` | AGG-EvidenceSet | `id TEXT` | Evidence |
| ProcedureEvidenceArt29 | `procedimentos_indicios_art29` | AGG-EvidenceSet | `id TEXT` | Evidence |
| CrimeCatalog | `crimes_contravencoes` | AGG-LegalCatalog | `id TEXT` | Legal Catalogs |
| RdpmCatalog | `transgressoes` | AGG-LegalCatalog | `id SERIAL` | Legal Catalogs |
| Art29Catalog | `infracoes_estatuto_art29` | AGG-LegalCatalog | `id TEXT` | Legal Catalogs |
| Municipality | `municipios_distritos` | AGG-LegalCatalog | `id TEXT` | Legal Catalogs |
| MapSnapshot | `mapas_salvos` | AGG-Report | `id TEXT` | Reporting |
| AuditEntry | `auditoria` | AGG-AuditEntry | `id TEXT` | Audit |

## Schema alvo

```sql
-- Primeira versao: reaproveitar schema existente.
-- Nao aplicar DDL destrutivo no cutover inicial.
-- sqlx deve mapear tipos existentes para structs Rust.

-- Restricoes reforcadas na aplicacao Rust quando ausentes no banco:
-- 1. tipo_detalhe nao inclui IPPM.
-- 2. escrita exige perfil admin.
-- 3. PADS exige transgressao.
-- 4. datas alvo nao podem ser futuras.
-- 5. RDPM hard delete deve checar referencias antes do DELETE.
-- 6. atualizar_usuario deve salvar bcrypt.
```

## Relacionamentos

| Origem | Destino | Cardinalidade | Integridade | Notas |
|---|---|---|---|---|
| `processos_procedimentos.responsavel_id` | `usuarios.id` | N:1 | logica | NULL para PAD/CD/CJ |
| `processos_procedimentos.presidente_id` | `usuarios.id` | N:1 | logica | processos formais |
| `procedimento_pms_envolvidos.procedimento_id` | `processos_procedimentos.id` | N:1 | logica | PMs envolvidos |
| `pm_envolvido_indicios.pm_envolvido_id` | `procedimento_pms_envolvidos.id` | 1:1 | logica | um ativo por PM |
| `pm_envolvido_crimes.crime_id` | `crimes_contravencoes.id` | N:1 | logica | indicios |
| `pm_envolvido_rdpm.transgressao_id` | `transgressoes.id` | N:1 | logica | bloquear exclusao referenciada |
| `pm_envolvido_art29.art29_id` | `infracoes_estatuto_art29.id` | N:1 | logica | indicios |
| `prazos_processo.processo_id` | `processos_procedimentos.id` | N:1 | logica | prazos |
| `auditoria.usuario_id` | `usuarios.id` | N:1 | logica/nullable | operacoes do sistema podem ser NULL |

## Restricoes

- **Unicidade**:
  - `usuarios.matricula`, `usuarios.email`.
  - processo: numero/documento/ano no banco; aplicacao reforca numero/documento/tipo/local/ano.
  - RDPM: `(gravidade, inciso)` case-insensitive na atualizacao.
  - Art29: inciso unico entre ativos.
- **Integridade referencial**: muitas FKs sao logicas; Rust deve validar antes de gravar/remover.
- **Indices criticos**: preservar indices existentes de usuarios, processos, JSONB e catalogos.
- **Remocoes**:
  - Soft delete como padrao.
  - RDPM hard delete protegido por checagem de referencias.

## Consideracoes especificas do paradigma alvo

- Modelos sqlx devem ser separados de DTOs de comando quando houver campos sensiveis (`senha`, `pdf_arquivo`).
- Enums Rust devem validar valores antes de persistir, mesmo quando a coluna e `TEXT`.
- JSONB (`andamentos`, `historico_encarregados`, `categorias_indicios`, `dados_mapa`) deve ser mapeado com structs serializaveis e fallback de leitura.
- `IPPM` deve ser rejeitado ou ignorado em dados de UI/filtros; se existir dado historico, classificar para triagem antes de escrita.

## Origem no legado

| Tabela nova | Origem no legado | Transformacao |
|---|---|---|
| todas | schema existente PostgreSQL | reaproveitamento sem mudanca destrutiva |
| `processos_procedimentos` | idem | aplicacao remove IPPM de tipos alvo e ignora `indicios_categorias` como fonte canonica |
| `usuarios` | idem | atualizar senha passa a bcrypt; leitura aceita SHA-256 legado |
| `transgressoes` | idem | hard delete passa a ser protegido |
| `pm_envolvido_*` | idem | fonte canonica de indicios por PM |
| `procedimentos_indicios_*` | idem | incluir na migracao conforme decisao humana |

## Notas

- Se for decidido evoluir o schema depois, criar migrations Rust/sqlx separadas e versionadas, fora do cutover inicial.
