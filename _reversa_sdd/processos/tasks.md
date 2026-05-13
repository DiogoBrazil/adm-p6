# Processos — Tarefas de Implementação

## Pré-requisitos

- [ ] Tabela `processos_procedimentos` com todos os campos (ver `erd-complete.md`)
- [ ] Tabela `procedimento_pms_envolvidos` disponível
- [ ] Guard `guard_login` implementado
- [ ] `registrar_auditoria` disponível
- [ ] Módulo de prazos implementado (prazo criado automaticamente após registro)

## Tarefas

- [ ] T-01 — Implementar `_determinar_natureza_processo(natureza_original, transgressoes)`
  - Origem: `app/services/processos_service.py:17-44`
  - Critério: múltiplas naturezas → "Múltiplas"; única → normalizada; sem transgressões → natureza_original
  - Confiança: 🟢

- [ ] T-02 — Implementar normalização de `penalidade_tipo` (acentos → sem acentos)
  - Origem: `processos_service.py:529-539`
  - Critério: `Prisão→Prisao`, `Detenção→Detencao`, `Repreensão→Repreensao`
  - Confiança: 🟢

- [ ] T-03 — Implementar regra: penalidade só para Punido; dias só para Prisao/Detencao
  - Origem: `processos_service.py:541-547`
  - Critério: qualquer solucao_tipo != 'Punido' limpa penalidade_tipo e penalidade_dias
  - Confiança: 🟢

- [ ] T-04 — Implementar `registrar_processo(...)` — validação de unicidade
  - Origem: `processos_service.py:456-488`
  - Critério: rejeita `(numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)` duplicado com erro descritivo
  - Confiança: 🟢

- [ ] T-05 — Implementar `registrar_processo(...)` — persistência completa
  - Origem: `processos_service.py:549-660`
  - Critério: INSERT com todos os campos; retorna processo_id; insere PMs envolvidos
  - Confiança: 🟢

- [ ] T-06 — Implementar PAD/CD/CJ sem encarregado
  - Origem: `processos_service.py:493`
  - Critério: tipo PAD/CD/CJ → responsavel_id=NULL; usa presidente_id
  - Confiança: 🟢

- [ ] T-07 — Implementar `atualizar_processo(id, ...)` com mesmas validações do registro
  - Origem: `processos_service.py:1625+`
  - Critério: idem T-03, T-04 mas para UPDATE
  - Confiança: 🟢

- [ ] T-08 — Implementar `listar_processos(filtros)` com paginação
  - Origem: `main.py` (handlers legados)
  - Critério: filtros por tipo, status concluido, encarregado, ano; paginação offset/limit
  - Confiança: 🟡

- [ ] T-09 — Implementar `obter_processo(id)` com PMs e indícios
  - Origem: `processos_service.py:buscar_pms_envolvidos`
  - Critério: retorna processo + array de PMs com nome_completo + indícios associados
  - Confiança: 🟢

- [ ] T-10 — Implementar `excluir_processo(id)` (soft delete + auditoria)
  - Origem: `app/processos.py:5`, `app/routers/processos.py:11`
  - Critério: `ativo=FALSE`; registra auditoria DELETE
  - Confiança: 🟢

- [ ] T-11 — Implementar `substituir_encarregado(id, novo_id, justificativa)`
  - Origem: `main.py` (handler legado)
  - Critério: atualiza responsavel_id; appenda `{id, nome, data_substituicao, justificativa}` ao historico_encarregados JSON
  - Confiança: 🟢

- [ ] T-12 — Implementar `salvar_pdf_processo(id, nome, base64, ct)`
  - Origem: `processos_service.py` (PDF service)
  - Critério: decodifica base64→bytes; armazena BYTEA + metadados
  - Confiança: 🟢

- [ ] T-13 — Implementar `obter_pdf_processo(id, incluir_conteudo)`
  - Origem: `processos_service.py`
  - Critério: retorna metadados; se incluir_conteudo=true, inclui base64 do BYTEA
  - Confiança: 🟢

- [ ] T-14 — Implementar `remover_pdf_processo(id)`
  - Origem: `processos_service.py`
  - Critério: limpa todos os campos PDF (NULL)
  - Confiança: 🟢

- [ ] T-15 — Adicionar validações no backend que existem somente no frontend
  - Origem: `procedure_form.js:3162` (datas futuras), `procedure_form.js:3121` (PADS sem transgressão)
  - Critério: backend rejeita datas futuras; PADS sem transgressão retorna erro
  - Confiança: 🟢 (regra confirmada pelo usuário em `questions.md#1`; lacuna apenas no legado)

- [ ] T-16 — Implementar `obter_estatistica_pads_solucoes(ano?)`
  - Origem: `app/routers/processos.py:26`
  - Critério: PADS concluídos agrupados por solucao_tipo
  - Confiança: 🟢

- [ ] T-17 — Implementar `obter_estatistica_ipm_indicios(ano?)`
  - Origem: `app/routers/processos.py:102`
  - Critério: IPM/IPPM por crimes CPM, transgressões RDPM+Art.29, sem indícios
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01 — Registrar procedimento SR cria prazo de 30 dias automaticamente
- [ ] TT-02 — Registrar PAD: responsavel_id=NULL; presidente_id preenchido
- [ ] TT-03 — Duplicata de número retorna erro descritivo
- [ ] TT-04 — Solução Absolvido limpa penalidade no backend
- [ ] TT-05 — PDF salvo e recuperado como base64 idêntico ao original
- [ ] TT-06 — Soft delete: processo não aparece em listagem após excluir

## Ordem Sugerida

1. T-01, T-02, T-03 (funções auxiliares de negócio)
2. T-04, T-05 (registro — depende de T-01-03)
3. T-06 (PAD/CD/CJ — complemento do T-05)
4. T-07 (atualização — reutiliza T-01-03)
5. T-08, T-09, T-10 (listagem, detalhe, exclusão)
6. T-11 (substituição de encarregado)
7. T-12 a T-14 (PDF)
8. T-15 (validações de segurança — alta prioridade apesar de ser lacuna)
9. T-16, T-17 (estatísticas)

## Lacunas Pendentes (🔴)

- Nenhuma lacuna bloqueante após validação do usuário.
- Decisão de escopo: handlers legados em `main.py` que não são usados pela UI atual devem ser desconsiderados na migração (`questions.md#3`).
