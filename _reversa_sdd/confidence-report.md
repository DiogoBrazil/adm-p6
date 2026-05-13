# Relatório de Confiança — Gestão P6

> Atualizado pelo Revisor em 2026-05-12 após validação humana em `_reversa_sdd/questions.md`.

---

## Resumo Geral

| Nível | Quantidade | Percentual |
|-------|-----------|------------|
| 🟢 CONFIRMADO | 131 | 88% |
| 🟡 INFERIDO   | 14 | 9% |
| 🔴 LACUNA     | 4 | 3% |
| **Total**     | 149 | 100% |

**Confiança geral: 93%** (calculado como `(131 + 14×0.5) / 149 = 138/149`)

> Revisão cruzada via engine externa: **não realizada** (Codex plugin externo não disponível nesta sessão).

---

## Por Spec

| Spec | 🟢 | 🟡 | 🔴 | Confiança |
|------|----|----|-----|-----------|
| `autenticacao/` | 18 | 4 | 0 | 91% |
| `catalogos/` | 12 | 0 | 0 | **100%** |
| `rdpm/` | 9 | 0 | 0 | **100%** |
| `art29/` | 6 | 0 | 0 | **100%** |
| `processos/` | 23 | 2 | 0 | 96% |
| `usuarios/` | 16 | 1 | 1 | 89% |
| `prazos/` | 8 | 2 | 0 | 89% |
| `andamentos/` | 8 | 1 | 0 | 94% |
| `indicios/` | 10 | 1 | 1 | 88% |
| `mapas/` | 8 | 0 | 0 | **100%** |
| `relatorios/` | 10 | 1 | 0 | 95% |
| `auditorias/` | 8 | 0 | 0 | **100%** |

> Fórmula por spec: `(🟢 + 🟡×0.5) / total`.

---

## Lacunas Bloqueantes

Nenhuma lacuna bloqueante permanece após as respostas do usuário.

---

## Lacunas Residuais Não Bloqueantes

- **Autenticação:** sem timeout de sessão e sem log de tentativas falhas. São decisões futuras de produto/segurança, não bloqueiam equivalência com o legado.
- **Usuários:** `nome_pm_id` legado pode causar dupla contagem se ainda for alimentado; validar durante desenho das queries Rust.
- **Indícios:** campo `categoria` TEXT legado coexiste com `categorias_indicios` JSONB; preferir JSONB e manter fallback se houver dados antigos.

---

## Reclassificações Após Validação Humana

| De | Para | Item | Resolução |
|----|------|------|-----------|
| 🔴 | 🟢 | Validação backend de datas futuras | Implementar no Rust/Tauri |
| 🔴 | 🟢 | Validação backend de PADS sem transgressão | Implementar no Rust/Tauri |
| 🟡 | 🟢 | `prazo_base` por tipo | Tabela confirmada pelo usuário |
| 🟡 | 🟢 | Handlers legados não usados | Desconsiderar fora da UI atual |
| 🟡 | 🟢 | `indicios_categorias` TEXT legado | Ignorar; usar JSONB por PM |
| 🟡 | 🟢 | Tabelas `procedimentos_indicios_*` | Incluir na migração Rust |
| 🔴 | 🟢 | Autodesativação de admin | Bloquear na migração |
| 🟡 | 🟢 | `atualizar_usuario_old` | Remover na migração |
| 🟡 | 🟢 | Nome `delete_user` | Manter por compatibilidade |
| 🔴 | 🟢 | Categorias de indícios | Extensíveis via catálogos |
| 🟡 | 🟢 | Escrita de andamentos pelo manager | Converge para JSONB em `processos_procedimentos.andamentos` |
| 🔴 | 🟢 | Exclusão RDPM referenciada | Bloquear exclusão |
| 🔴 | 🟢 | Relatórios stub | Implementar; prioridade mapa mensal PDF |
| 🔴 | 🟢 | Admin padrão sem troca obrigatória | Manter comportamento legado |
| 🔴 | 🟢 | Reativação/reabertura na UI | Oferecer na UI Rust/Tauri |

---

## Recomendações para a Migração

- Implementar primeiro as correções confirmadas de integridade: bcrypt em atualização de senha, validações backend de processo e proteção no hard delete RDPM.
- Priorizar relatórios pelo mapa mensal PDF, depois os demais stubs.
- Manter compatibilidade de contratos onde o usuário confirmou nome legado, especialmente `delete_user`.
- Tratar campos legados (`nome_pm_id`, `categoria` TEXT) como fallback de leitura, não como fonte canônica nova.
