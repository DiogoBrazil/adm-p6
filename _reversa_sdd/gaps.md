# Lacunas — Gestão P6

> Atualizado pelo Revisor em 2026-05-12 após respostas do usuário em `_reversa_sdd/questions.md`.

---

## Resultado

As 16 perguntas de validação foram respondidas. Não há lacunas bloqueantes para iniciar a migração Rust/Tauri.

---

## Decisões Confirmadas

| ID | Decisão | Origem |
|----|---------|--------|
| P-01 | Backend Rust/Tauri deve validar datas futuras para `data_instauracao` e `data_conclusao` | questions.md#1 |
| P-02 | Backend Rust/Tauri deve rejeitar PADS sem transgressão | questions.md#1 |
| P-03 | Prazos base: SR/SV=30, IPM=40, PADS=30, PAD/PADE=30, CP/FP=15, CD/CJ=30 | questions.md#2 |
| P-04 | Handlers legados de `main.py` não usados pela UI atual podem ser desconsiderados | questions.md#3 |
| P-05 | Usar apenas `pm_envolvido_indicios.categorias_indicios` JSONB; ignorar `processos_procedimentos.indicios_categorias` TEXT | questions.md#4 |
| P-06 | Incluir tabelas `procedimentos_indicios_*` na migração Rust | questions.md#5 |
| P-07 | Papéis por tipo de processo confirmados: encarregado, presidente, interrogante e escrivão conforme `questions.md#6` | questions.md#6 |
| U-01 | `atualizar_usuario` deve usar bcrypt na migração Rust/Tauri | questions.md#7 |
| U-02 | Admin não pode desativar a própria conta | questions.md#8 |
| U-03 | `atualizar_usuario_old` pode ser removido | questions.md#9 |
| U-04 | Manter contrato `delete_user` por compatibilidade | questions.md#10 |
| I-01 | Categorias de indícios são extensíveis pelo admin via catálogos | questions.md#11 |
| N-01 | `PrazosAndamentosManager.registrar_andamento` escreve em `processos_procedimentos.andamentos` | questions.md#12 |
| R-01 | RDPM deve bloquear exclusão de transgressão referenciada | questions.md#13 |
| L-01 | Relatórios stub devem ser implementados; prioridade: mapa mensal PDF | questions.md#14 |
| A-01 | Manter admin padrão sem troca obrigatória no primeiro login | questions.md#15 |
| S-01 | UI Rust/Tauri deve oferecer reativação de usuários e reabertura de processos | questions.md#16 |

---

## Pontos Residuais Não Bloqueantes

| ID | Ponto | Severidade | Encaminhamento |
|----|-------|------------|----------------|
| A-02 | Sem timeout de sessão por inatividade no legado | Cosmético | Decisão futura de produto/segurança |
| A-03 | Sem log de tentativas de login falhas | Cosmético | Decisão futura de produto/segurança |
| U-05 | Campo `nome_pm_id` legado pode causar dupla contagem em estatísticas se ainda for alimentado | Moderado | Validar durante desenho das queries Rust |
| I-02 | Campo `categoria` TEXT legado coexiste com `categorias_indicios` JSONB em `pm_envolvido_indicios` | Moderado | Preferir JSONB e manter fallback de leitura se houver dados antigos |

---

## Ações Obrigatórias na Migração

1. Remover debug prints de `app/services/indicios.py`, `app/services/processos_service.py` e relatórios.
2. Corrigir hash de senha em `atualizar_usuario`: usar bcrypt.
3. Implementar validação backend para datas futuras e PADS sem transgressão.
4. Implementar hard delete RDPM com proteção de integridade referencial.
5. Implementar relatórios stub confirmados, priorizando mapa mensal PDF.
