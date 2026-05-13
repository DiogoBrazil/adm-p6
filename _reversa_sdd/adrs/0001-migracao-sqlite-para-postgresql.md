# ADR-0001: Migração de SQLite para PostgreSQL

**Status:** Aceito  
**Data:** ~2025-11-08 (evidência: commit `7790856`)  
**Confiança:** 🟢 CONFIRMADO

---

## Contexto

O sistema iniciou com SQLite como banco de dados. À medida que o projeto cresceu em complexidade (múltiplas tabelas relacionadas, JSONB, constraints de unicidade compostas), o SQLite tornou-se limitante.

**Evidências no Git:**
- `342b1ab` (2025-11-09): "Refactor SQLite to PostgreSQL migration scripts and add database management tools"
- `7790856` (2025-11-08): "remove SQLite-specific column checks and adapt to PostgreSQL"
- `8dc79a3` (2025-11-11): "Alembic: load DATABASE_URL from .env at project root"

---

## Decisão

Migrar todo o banco de dados de SQLite para **PostgreSQL 16**, rodando em Docker na porta `5438` (não padrão para evitar conflito com instalações locais do Postgres na 5432).

---

## Razões

1. Suporte nativo a **JSONB** — necessário para `andamentos`, `historico_encarregados`, `categorias_indicios` e `dados_mapa`
2. **Constraints compostas** com UNIQUE multi-coluna mais confiáveis
3. **Índices parciais** (`WHERE ativo = TRUE`) para performance
4. **Alembic** para controle versionado de schema
5. Aplicação desktop com banco local em Docker — PostgreSQL ainda é viável no contexto

---

## Alternativas Consideradas

- **SQLite com extensões JSON**: descartado — suporte limitado a JSONB real
- **MySQL/MariaDB**: descartado — equipe familiarizada com PostgreSQL

---

## Consequências

- Aplicação requer Docker rodando localmente para funcionar
- Configuração via `.env` com variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- Porta 5438 não padrão pode causar confusão em novos ambientes
- `main.py` ainda cria tabelas via `CREATE TABLE IF NOT EXISTS` — redundante com Alembic, mas mantido como fallback
