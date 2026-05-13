# ADR-0003: Consolidação de múltiplas tabelas de usuários em tabela única

**Status:** Aceito  
**Data:** 2025-11-11 (commit `4a6d5e0`)  
**Confiança:** 🟢 CONFIRMADO

---

## Contexto

O sistema possuía múltiplas tabelas para diferentes tipos de usuários (policiais, operadores, encarregados, etc.), provavelmente refletindo diferentes perfis que foram separados no design inicial.

**Evidência:** Commit `4a6d5e0`: "Remove deprecated migration scripts and simplify database structure by consolidating user tables and updating constraints for uniqueness and data integrity."

---

## Decisão

Consolidar todas as tabelas de usuários em **uma única tabela `usuarios`** com flags booleanas para distinguir papéis:

```sql
usuarios (
    tipo_usuario  TEXT CHECK IN ('Oficial', 'Praça'),
    is_encarregado BOOLEAN DEFAULT FALSE,
    is_operador    BOOLEAN DEFAULT FALSE,
    perfil         TEXT CHECK IN ('admin', 'comum') OR NULL
)
```

---

## Razões

1. Simplificação de JOINs — processos referenciam usuários em múltiplos papéis (responsavel, escrivao, presidente, etc.)
2. Um PM pode ser simultaneamente encarregado E operador — flags booleanas são mais flexíveis que tabelas separadas
3. Manutenção: um único lugar para cadastrar/desativar usuários
4. Migrations mais simples: `ADD COLUMN` ao invés de criar tabelas novas

---

## Alternativas Consideradas

- **Tabela de roles separada** (`usuario_roles`): descartada — overhead de JOINs para apenas 2 roles
- **Manter tabelas separadas**: descartada — duplicação de dados, JOINs complexos

---

## Consequências

- FKs em `processos_procedimentos` apontam para `usuarios.id` sem distinção de tipo
- `responsavel_tipo`, `presidente_tipo`, etc. sempre valem `'usuario'` — campo legado do design anterior (quando havia múltiplos tipos de entidade)
- A constraint `uq_proc_numero_doc_ano` teve que ser ajustada para refletir o novo design
- Código legado de funções depreciadas removido (`main.py:243`: "FUNÇÕES LEGADAS REMOVIDAS")
