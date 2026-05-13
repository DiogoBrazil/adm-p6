# Processos e Procedimentos — Lacunas e Questões Abertas

## Q-01 🔴 — Validação de datas futuras no backend

**Lacuna:** A validação que impede o registro de datas futuras (`data_instauracao`, `data_conclusao`) existe apenas no frontend (`procedure_form.js:3162`). O backend em `processos_service.py` não realiza essa verificação.

**Impacto:** Um cliente com acesso direto à API Eel pode registrar processos com datas inválidas no banco.

**Pergunta:** Deve-se adicionar validação de datas futuras no backend na migração para Tauri/Rust? (Recomendado: **sim**)

---

## Q-02 🔴 — Validação de PADS sem transgressão no backend

**Lacuna:** A regra que exige ao menos uma transgressão para processos do tipo PADS é validada apenas no frontend (`procedure_form.js:3121`). O backend não rejeita o registro sem transgressões.

**Impacto:** Registros PADS sem transgressão podem ser inseridos contornando o frontend.

**Pergunta:** Confirmar que a regra deve ser implementada no backend da versão Rust?

---

## Q-03 🟡 — Tabelas `procedimentos_indicios_*` sem uso confirmado

**Observação:** A migração `0001_bootstrap_core_tables.py` cria três tabelas (`procedimentos_indicios_crimes`, `procedimentos_indicios_transgressoes`, `procedimentos_indicios_art29`) mas nenhuma delas foi localizada em uso ativo no código Python analisado. Os indícios efetivos são armazenados em `pm_envolvido_indicios`.

**Pergunta:** Essas tabelas são utilizadas por alguma funcionalidade não mapeada (ex.: relatório legado)? Devem ser incluídas na migração Rust ou removidas?

---

## Q-04 🟡 — Limite de 100 MB para PDF validado apenas no frontend

**Observação:** O limite de 100 MB para upload de PDF está implementado somente no JavaScript (`procedure_form.js`). O backend aceita qualquer tamanho de BYTEA.

**Pergunta:** Deve-se implementar validação de tamanho máximo no backend? Qual o limite desejado?

---

## Q-05 🟡 — ~60 handlers em `main.py` não migrados para `app/routers/processos.py`

**Observação:** Cerca de 60 handlers relacionados a processos ainda residem em `main.py` (linhas 1646–5178) e não foram formalmente migrados para o módulo de routers. Eles coexistem com os 10 handlers migrados em `app/routers/processos.py`.

**Pergunta:** Qual é a estratégia de migração desses handlers? Migrar todos antes de iniciar Rust, ou mapear apenas os utilizados na UI atual?

---

## Q-06 🟡 — Campo `indicios_categorias` TEXT vs `pm_envolvido_indicios.categorias_indicios` JSONB

**Observação:** Existe duplicidade aparente: `processos_procedimentos.indicios_categorias` (TEXT legado) e a nova estrutura `pm_envolvido_indicios.categorias_indicios` (JSONB por PM). Não está claro se ambas são alimentadas simultaneamente.

**Pergunta:** O campo TEXT `indicios_categorias` ainda é lido por alguma funcionalidade ativa? Pode ser deprecado?

---

## Q-07 🟡 — Prazo automático criado pelo `prazos_andamentos_manager`

**Observação:** O fluxo de `registrar_processo` chama o gerenciador de prazos para criar automaticamente um prazo após o registro. O prazo_base varia por tipo (SR=30 dias, IPM=30 dias, PAD=60 dias — inferido, não confirmado em código).

**Pergunta:** Confirmar a tabela de prazo_base por tipo de processo/procedimento.

---

## Q-08 🟡 — Campos `presidente_tipo`, `interrogante_tipo`, `escrivao_processo_tipo`

**Observação:** O campo `_tipo` associado a cada papel (presidente, interrogante, escrivão) é resolvido verificando se o ID existe na tabela `usuarios`. O campo `tipo` parece distinguir entre PM interno e civil externo, mas a lógica exata de resolução não foi totalmente confirmada.

**Pergunta:** Qual a semântica exata de `responsavel_tipo`? Valores possíveis além de PM/civil?
