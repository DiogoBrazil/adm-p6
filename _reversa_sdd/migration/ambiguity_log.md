# Ambiguity Log

> Consolidado de decisoes abertas do Time de Migracao.

## PENDENTES

Nenhum item pendente apos decisoes humanas registradas no Curator.

## RESOLVIDOS COM DECISAO HUMANA

| ID | Origem | Decisao |
|---|---|---|
| BR-HUMANA-001 | `target_business_rules.md#br-humana-001--ownership-em-processos` | Criacao, edicao e remocao somente para admins; demais perfis somente leitura |
| BR-HUMANA-002 | `target_business_rules.md#br-humana-002--seguranca-de-login-adicional` | Manter comportamento atual, sem timeout/log/rate limiting na primeira versao |
| BR-HUMANA-003 | `target_business_rules.md#br-humana-003--ippm-prazo-base` | IPPM nao existe; desconsiderar referencias. O correto e IPM com prazo inicial de 40 dias |
| P-01 | `_reversa_sdd/questions.md#pergunta-1` | Validar datas futuras e PADS sem transgressao no backend Rust/Tauri |
| P-02 | `_reversa_sdd/questions.md#pergunta-2` | Tabela de prazos base confirmada para tipos citados |
| P-03 | `_reversa_sdd/questions.md#pergunta-3` | Desconsiderar handlers nao usados pela UI atual |
| U-01 | `_reversa_sdd/questions.md#pergunta-7` | Usar bcrypt em atualizacao de senha |
| R-01 | `_reversa_sdd/questions.md#pergunta-13` | Bloquear exclusao RDPM referenciada |
| L-01 | `_reversa_sdd/questions.md#pergunta-14` | Implementar relatorios stub, prioridade mapa mensal PDF |

## REFERIDOS A CODIFICACAO

| ID | Item | Observacao |
|---|---|---|
| COD-001 | Usar Context7 para duvidas tecnicas Rust/Tauri/PostgreSQL/sqlx | Registrado no migration brief |
| COD-002 | Normalizar envelope de resposta Tauri | Decisao de paradigma; validar impacto no frontend |
| COD-003 | Fallback de leitura para campos legados JSON/TEXT | Necessario para dados historicos |
| COD-004 | Ajustar RBAC alvo | Perfil comum somente leitura; comandos de escrita exigem admin |
| COD-005 | Remover IPPM dos tipos alvo | Usar apenas IPM com prazo inicial de 40 dias |
