# ADR-0005: Soft delete como padrão; hard delete em transgressões RDPM

**Status:** Aceito  
**Data:** ~2025-11-08 (observado no código; sem commit único identificável)  
**Confiança:** 🟢 CONFIRMADO (soft delete) | 🟡 INFERIDO (razão do hard delete)

---

## Contexto

O sistema lida com dados auditáveis que não devem ser apagados permanentemente (processos, usuários, crimes). No entanto, o catálogo RDPM tem comportamento diferente.

---

## Decisão

- **Padrão:** soft delete (`ativo = FALSE`) para todas as entidades
- **Exceção:** `transgressoes` (RDPM) usa **hard DELETE** (`DELETE FROM transgressoes WHERE id = ?`)

---

## Razões

**Soft delete (padrão):**
1. Preservação de referências históricas — processos antigos continuam apontando para crimes desativados sem quebrar FKs
2. Auditoria completa — operação DELETE é registrada em `auditoria` mas o dado permanece
3. Possibilidade de recuperação manual

**Hard delete em transgressoes:**
1. 🟡 INFERIDO: RDPM é um catálogo legal estático — transgressões extintas não deixam referências históricas em processos
2. 🟡 INFERIDO: O modelo de referência usa IDs SERIAL, não UUID, sugerindo que era esperado um conjunto fixo menor
3. 🟢 CONFIRMADO pelo usuário (`questions.md#13`): existem referências em `pm_envolvido_rdpm`; na migração, bloquear a exclusão de transgressão referenciada antes do DELETE.

---

## Alternativas Consideradas

- Hard delete para todos: descartado — processos antigos perderiam referências
- Soft delete para transgressoes: aparentemente não adotado (razão desconhecida)

---

## Consequências

- **Risco de integridade:** `pm_envolvido_rdpm.transgressao_id → transgressoes.id` sem ON DELETE CASCADE. Deletar uma transgressão referenciada causará FK violation no PostgreSQL.
- Na migração Rust/Tauri: verificar se deve-se converter hard delete de transgressoes para soft delete ou adicionar verificação antes do DELETE.
