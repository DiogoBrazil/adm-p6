# Usuários — Lacunas e Questões Abertas

## Q-01 🟢 — `atualizar_usuario_old` mantido "por compatibilidade"

**Observação:** O router expõe `atualizar_usuario_old(user_id, user_type, posto_graduacao, matricula, nome, email, senha, profile)` com o comentário explícito "manter por compatibilidade". Há dois handlers de atualização coexistindo.

**Pergunta:** Qual JS chama `atualizar_usuario_old`? Pode ser removido na migração Rust ou ainda está em uso ativo?

**Resposta do usuário:** Pode ser removido na migração Rust.

---

## Q-02 🟢 — Inconsistência de nome: `delete_user` vs `deletar_usuario`

**Observação:** O router expõe a função como `delete_user` (inglês) enquanto o service a implementa como `deletar_usuario` (português). A inconsistência de idioma pode causar confusão no frontend.

**Pergunta:** O contrato Eel na migração Rust deve usar `delete_user` (manter compatibilidade JS) ou `excluir_usuario` (padronizar em pt-br)?

**Resposta do usuário:** Manter `delete_user`, preservando compatibilidade com o restante do código e das tabelas.

---

## Q-03 🟡 — Estatísticas consultam `nome_pm_id` legado (campo em processos_procedimentos)

**Observação:** O serviço de estatísticas consulta `processos_procedimentos.nome_pm_id` para contar envolvimentos, campo que parece ser legado de quando o processo tinha apenas um PM. A nova estrutura usa `procedimento_pms_envolvidos`. Ambas as fontes são consultadas e somadas, podendo haver dupla contagem.

**Pergunta:** O campo `nome_pm_id` em `processos_procedimentos` ainda é alimentado? Se não, a query legada pode retornar sempre zero e ser removida.

---

## Q-04 🟡 — `obter_usuario_detalhado` usa `get_pg_connection()` diretamente

**Observação:** Diferente das outras funções que usam `db_manager.get_connection()`, `obter_usuario_detalhado` chama `get_pg_connection()` diretamente, bypassando o `DatabaseManager`. Isso impede mock em testes e é inconsistente.

**Pergunta:** Confirmar que na migração Rust todos os acessos devem passar pelo mesmo pool de conexões.

---

## Q-05 🟢 — Operador não pode excluir a si mesmo?

**Lacuna:** Não foi encontrada no código nenhuma verificação que impeça um operador de desativar sua própria conta. A guard `guard_admin` garante que só admins chegam ao `delete_user`, mas não verifica se `user_id == usuario_logado_id`.

**Pergunta:** Deve-se impedir que um admin exclua a si mesmo? Comportamento esperado?

**Resposta do usuário:** Sim. Um administrador deve ser impedido de desativar sua própria conta.
