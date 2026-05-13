# language: pt
# spec-id: PT-011
# rastreabilidade:
#   process_flows: _reversa_sdd/migration/target_data_model.md; _reversa_sdd/migration/data_migration_plan.md
#   target_architecture: db + sqlx repositories
#   paradigma_alvo: Rust/Tauri com PostgreSQL reaproveitado

Funcionalidade: Paridade de dados PostgreSQL
  Como responsavel pela migracao
  Quero validar dados em base clonada
  Para impedir perda ou corrupcao no cutover

  @paridade @critico
  Cenário: Contagens por tabela critica batem
    Dado uma base legada clonada
    Quando o alvo executa checks de contagem para usuarios, processos, prazos, auditorias, catalogos, indicios e mapas
    Então as contagens batem com o legado
    E registros soft-deleted permanecem rastreaveis quando aplicavel

  @paridade @critico
  Cenário: Checksums por agregado batem
    Dado uma base legada clonada
    Quando checksums normalizados por agregado sao calculados
    Então usuarios, processos completos, prazos, andamentos, indicios e mapas produzem checksums equivalentes

  @paridade @critico
  Cenário: Dados legados em JSONB continuam legiveis
    Dado registros com andamentos e categorias de indicios em JSONB legado
    Quando repositories sqlx carregam os registros
    Então os DTOs alvo preservam o conteudo observavel
    E campos desconhecidos nao quebram leitura
