# Perguntas para Validação — Gestão P6

> Gerado pelo Revisor em 2026-05-12
> Consolidado de todas as lacunas 🔴 que requerem confirmação humana.
> Responda cada pergunta e me avise quando terminar.

---

## Pergunta 1

**Contexto:** Módulo `processos` — `procedure_form.js:3162` (validação de data futura); `processos_service.py` (ausência de validação equivalente)
**Spec afetada:** [`_reversa_sdd/processos/requirements.md` — RN-10b, RN-11b]
**Pergunta:** Na migração Rust/Tauri, o backend deve validar datas futuras para `data_instauracao` e `data_conclusao`? E deve rejeitar PADS sem nenhuma transgressão? (Recomendado: **sim** para ambos)
**Impacto:** Se sim, adicionar validação server-side em `registrar_processo` e `atualizar_processo`. Se não, documentar como decisão deliberada.

**Resposta:** Sim.

---

## Pergunta 2

**Contexto:** Módulo `processos` — `prazos_andamentos_manager.py` chamado por `registrar_processo`; tabela de prazo_base não encontrada como constante no código
**Spec afetada:** [`_reversa_sdd/prazos/requirements.md` — RN-06; `_reversa_sdd/processos/questions.md` — Q-07]
**Pergunta:** Confirmar a tabela de `prazo_base` por tipo de processo/procedimento:
  - SR / SV = 30 dias?
  - IPM / IPPM = 30 dias?
  - PADS = 30 dias?
  - PAD / PADE = 60 dias?
  - CP / FP = ? dias?
  - CD / CJ = ? dias?
**Impacto:** Define constante crítica para `adicionar_prazo_inicial`. Sem isso, prazos serão criados com valores incorretos.

**Resposta:** SR / SV = 30 dias | IPM  = 40 dias | PADS = 30 dias | PAD / PADE = 30 dias | CP / FP = 15 dias | CD / CJ = 30 dias.

---

## Pergunta 3

**Contexto:** Módulo `processos` — `processos_service.py:87` (PM "A APURAR"); `main.py:1646-5178` (~60 handlers legados não migrados)
**Spec afetada:** [`_reversa_sdd/processos/tasks.md` — T-08; `_reversa_sdd/traceability/code-spec-matrix.md`]
**Pergunta:** Qual a estratégia para os ~60 handlers em `main.py:1646-5178` que não foram migrados para `app/routers/processos.py`? As opções são: (a) mapear e migrar todos antes de iniciar o Rust, (b) mapear apenas os usados na UI atual, (c) desconsiderar os não usados.
**Impacto:** Determina o escopo real do módulo de processos na migração.

**Resposta:** (c) desconsiderar os não usados.

---

## Pergunta 4

**Contexto:** Módulo `processos` — `pm_envolvido_indicios.categorias_indicios` (JSONB novo) vs `processos_procedimentos.indicios_categorias` (TEXT legado)
**Spec afetada:** [`_reversa_sdd/processos/design.md` — Riscos; `_reversa_sdd/processos/questions.md` — Q-06]
**Pergunta:** O campo TEXT `indicios_categorias` em `processos_procedimentos` ainda é lido por alguma funcionalidade ativa? Pode ser ignorado na migração Rust (usar apenas `pm_envolvido_indicios.categorias_indicios` JSONB)?
**Impacto:** Define se o campo legado precisa ser mantido compatível ou pode ser descontinuado.

**Resposta:** usar apenas `pm_envolvido_indicios.categorias_indicios` JSONB.

---

## Pergunta 5

**Contexto:** Módulo `processos` — `processos_procedimentos` tem tabelas `procedimentos_indicios_crimes`, `procedimentos_indicios_transgressoes`, `procedimentos_indicios_art29` criadas em `0001_bootstrap_core_tables.py` mas sem uso confirmado no Python
**Spec afetada:** [`_reversa_sdd/processos/questions.md` — Q-03]
**Pergunta:** As tabelas `procedimentos_indicios_*` (três tabelas) são utilizadas por alguma funcionalidade não mapeada? Devem ser incluídas na migração Rust ou removidas?
**Impacto:** Determina se essas tabelas precisam de specs próprias ou podem ser tratadas como legado descontinuado.

**Resposta:** Devem ser incluídas na migração Rust.

---

## Pergunta 6

**Contexto:** Módulo `processos` — `processos_service.py` — campos `presidente_tipo`, `interrogante_tipo`, `escrivao_processo_tipo` resolvidos verificando se o ID existe na tabela `usuarios`
**Spec afetada:** [`_reversa_sdd/processos/questions.md` — Q-08]
**Pergunta:** Qual a semântica exata de `responsavel_tipo`? Valores possíveis além de `'usuario'`? O valor legado `'encarregado'` é convertido automaticamente — há outros valores legados?
**Impacto:** Define os valores válidos para o enum de tipo de responsável na spec de processos.

**Resposta:** Para SR, SV, IPM, PADS, CP, FP e PADE o responsavel é definido no como "Encarregado". Para o IPM tem o acrescimo de alem do "Encarregado" tem o "Escrivão". Para PAD, CD e CJ, Em de "Encarregado" temo "Presidente", "Interrogante" e "Escrivão". Se ficar duvidas pode perguntar.

---

## Pergunta 7

**Contexto:** Módulo `usuarios` — `app/services/usuarios.py:348` — `hashlib.sha256()` usado em `atualizar_usuario` para hash de nova senha
**Spec afetada:** [`_reversa_sdd/usuarios/requirements.md` — RN-13; `_reversa_sdd/autenticacao/design.md`]
**Pergunta:** Este comportamento (SHA-256 na atualização, bcrypt no login/cadastro) é intencional ou é um bug? Na migração Rust, a atualização de senha deve usar **bcrypt** (alinhado com o cadastro e o upgrade no login)?
**Impacto:** Define o algoritmo de hash para `atualizar_usuario` na versão Rust. Usuários que atualizaram a senha no sistema legado terão SHA-256 no banco — o upgrade automático no login já resolve isso.

**Resposta:** deve usar **bcrypt**

---

## Pergunta 8

**Contexto:** Módulo `usuarios` — `app/services/usuarios.py` — nenhuma guard verifica `user_id == usuario_logado_id` no `delete_user`
**Spec afetada:** [`_reversa_sdd/usuarios/requirements.md` — RN-11; `_reversa_sdd/usuarios/questions.md` — Q-05]
**Pergunta:** Um administrador deve ser impedido de desativar sua própria conta? Se sim, deve retornar erro descritivo.
**Impacto:** Adiciona verificação em `excluir_usuario` na versão Rust.

**Resposta:** Sim, Um administrador deve ser impedido de desativar sua própria conta.

---

## Pergunta 9

**Contexto:** Módulo `usuarios` — router expõe `atualizar_usuario_old` com comentário "manter por compatibilidade"
**Spec afetada:** [`_reversa_sdd/usuarios/questions.md` — Q-01]
**Pergunta:** Qual JS chama `atualizar_usuario_old`? Pode ser removido na migração Rust?
**Impacto:** Define se o comando Tauri equivalente precisa ser implementado ou descartado.

**Resposta:** Pode ser removido na migração Rust.

---

## Pergunta 10

**Contexto:** Módulo `usuarios` — router usa nome inglês `delete_user`; service usa `deletar_usuario`
**Spec afetada:** [`_reversa_sdd/usuarios/questions.md` — Q-02; `_reversa_sdd/usuarios/contracts.md`]
**Pergunta:** O contrato Tauri na migração deve manter `delete_user` (compatibilidade JS) ou padronizar para `excluir_usuario` (pt-br)?
**Impacto:** Define o nome do `#[tauri::command]` e eventual refatoração no frontend JS.

**Resposta:** deve manter `delete_user`, assim todo o resto do codigo tabelas no banco.

---

## Pergunta 11

**Contexto:** Módulo `indicios` — `obter_categorias_indicios()` existe no router mas a lista não está em constante de código. Inferida de `processos_service.py` via estatística IPM.
**Spec afetada:** [`_reversa_sdd/indicios/requirements.md` — RN-07; `_reversa_sdd/indicios/questions.md` — Q-01]
**Pergunta:** Quais são exatamente as categorias válidas de indícios? A lista é fixa ou extensível pelo admin?
  - Inferidas: `crimes_cpm`, `transgressoes_rdpm`, `transgressoes_art29`, `sem_indicios`
**Impacto:** Define o enum de categorias para validação no Rust. Se extensível, precisa de tabela de catálogo.

**Resposta:** extensível pelo admin, cadastrados na tabela "transgressoes", "infracoes_estatuto_art29", "crimes_contravencoes".

---

## Pergunta 12

**Contexto:** Módulo `andamentos` — existem dois caminhos de escrita: `adicionar_andamento` (UPDATE JSONB em `processos_procedimentos.andamentos`) e `PrazosAndamentosManager.registrar_andamento` (possível tabela separada)
**Spec afetada:** [`_reversa_sdd/andamentos/design.md` — Dívida Técnica]
**Pergunta:** O `PrazosAndamentosManager.registrar_andamento` escreve na mesma coluna JSONB de `processos_procedimentos.andamentos` ou em tabela separada? Os dois caminhos convergem para o mesmo destino?
**Impacto:** Define a fonte canônica de escrita de andamentos na migração. Se há tabela separada, ela precisa de spec própria.

**Resposta:** O `PrazosAndamentosManager.registrar_andamento` escreve na mesma coluna JSONB de `processos_procedimentos.andamentos`.

---

## Pergunta 13

**Contexto:** Módulo `rdpm` — hard delete sem CASCADE declarado; `pm_envolvido_rdpm` referencia `catalogos_rdpm.id` via FK lógica
**Spec afetada:** [`_reversa_sdd/rdpm/requirements.md` — NFR Integridade; `_reversa_sdd/indicios/design.md`]
**Pergunta:** O que deve acontecer ao excluir uma transgressão RDPM que está referenciada em `pm_envolvido_rdpm`? Opções: (a) bloquear a exclusão (adicionar check), (b) permitir e deixar registros órfãos, (c) implementar CASCADE DELETE, (d) soft delete (mudar RDPM de hard→soft delete).
**Impacto:** Define o comportamento de exclusão do RDPM e integridade referencial dos indícios.

**Resposta:** (a) bloquear a exclusão (adicionar check).

---

## Pergunta 14

**Contexto:** Módulo `relatorios` — 6 das 7 funções do router são stubs sem implementação em `mapas_relatorios.py`
**Spec afetada:** [`_reversa_sdd/relatorios/requirements.md` — RF-02 a RF-07]
**Pergunta:** Os 6 relatórios stub (estatísticas gerais, por encarregado, por tipo, prazos vencidos, CSV, Excel) devem ser implementados na versão Rust? Quais são prioritários?
**Impacto:** Define o escopo real do módulo de relatórios e as tasks de implementação.

**Resposta:** Sim devem ser implementados. A prioridade é o relatorio de mapa mensal (pdf).

---

## Pergunta 15

**Contexto:** Módulo `autenticacao` — `main.py:167` — admin padrão `admin@sistema.com / 123456` criado sem flag de "senha temporária"
**Spec afetada:** [`_reversa_sdd/autenticacao/requirements.md` — NFR Segurança; `_reversa_sdd/autenticacao/design.md`]
**Pergunta:** A versão Rust deve exigir troca da senha padrão no primeiro login do admin? Ou manter o comportamento atual (sem obrigatoriedade)?
**Impacto:** Adiciona fluxo de "primeira senha" na spec de autenticação se obrigatório.

**Resposta:**  manter o comportamento atual (sem obrigatoriedade).

---

## Pergunta 16

**Contexto:** Módulo `state-machines` — reativação de usuário e processo; sistema atual não expõe essas operações na UI
**Spec afetada:** [`_reversa_sdd/state-machines.md` — seções 1.1 e 6]
**Pergunta:** A versão Rust deve oferecer na UI: (a) reativação de usuários desativados? (b) reabertura de processos concluídos (via `atualizar_processo(concluido=False)`, já suportada no backend)?
**Impacto:** Define se as transições de estado ocultas precisam virar funcionalidades explícitas na versão Rust.

**Resposta:** Sim, deve oferecer na UI: (a) reativação de usuários desativados? (b) reabertura de processos concluídos (via `atualizar_processo(concluido=False)`, já suportada no backend).

---
