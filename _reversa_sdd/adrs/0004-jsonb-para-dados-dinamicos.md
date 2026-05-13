# ADR-0004: Uso de JSONB para dados dinâmicos inline

**Status:** Aceito  
**Data:** 2025-11-11 (commit `85b7088`)  
**Confiança:** 🟢 CONFIRMADO

---

## Contexto

Alguns dados do sistema têm estrutura variável ou são lists que crescem ao longo do tempo: andamentos, histórico de encarregados, categorias de indícios, dados de mapa. A alternativa seria criar tabelas separadas para cada um.

**Evidências:**
- `85b7088`: "Add Alembic and refactor JSONB handling (andamentos, historico_encarregados, categorias_indicios, dados_mapa)"
- `f628755`: "JSONB indicios_categorias end-to-end: backend returns JSON arrays; procedure view/form handle arrays directly with legacy fallback"
- `92e1123`: "Migrate indicios_categorias stats to JSONB using jsonb_array_elements_text"

---

## Decisão

Armazenar como JSONB inline na tabela principal os seguintes campos:
- `processos_procedimentos.andamentos` — array de eventos processuais
- `processos_procedimentos.historico_encarregados` — array de substituições
- `pm_envolvido_indicios.categorias_indicios` — array de categorias de indícios
- `mapas_salvos.dados_mapa` — objeto com dados do mapa mensal

---

## Razões

1. Andamentos e histórico são append-only; relational overkill para esse pattern
2. JSONB no PostgreSQL permite indexação e queries com `jsonb_array_elements_text`
3. Simplifica o backend — sem JOINs para carregar um processo com seus andamentos
4. Migração retroativa: `f628755` converteu strings textuais para JSONB real

---

## Alternativas Consideradas

- **Tabela `andamentos_processo`**: descartada — estrutura mais complexa, sem ganho significativo para dados de audit trail simples
- **JSON em TEXT**: descartada em favor de JSONB — JSONB permite queries nativas no Postgres

---

## Consequências

- **Sem integridade referencial** para andamentos — um andamento deletado diretamente no JSON não é auditado
- Backend precisa fazer `json.dumps` / parse manualmente para Python antes de salvar (corrigido com Alembic `0003_alter_columns_to_jsonb.py`)
- Legado: alguns registros ainda podem ter `indicios_categorias` como string — código com fallback (`json.loads` com `except`)
- Dados de mapa são serializados como JSON — difícil de fazer queries analíticas diretamente no banco

**Para migração Rust/Tauri:** Andamentos podem continuar como JSONB (banco não muda) ou ser migrados para tabela separada em versões futuras. Manter compatibilidade com JSONB é obrigatório pois o banco não será alterado.
