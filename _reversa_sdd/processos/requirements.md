# Processos e Procedimentos

## Visão Geral

Módulo central do sistema. Gerencia o ciclo de vida completo de processos administrativos disciplinares (PAD, PADE, CD, CJ) e procedimentos preliminares (SR, SV, IPM, IPPM, FP, CP, PADS) da PMRO. Concentra as regras de negócio mais complexas do sistema, incluindo controle de papéis, natureza, penalidade, deduplicação e armazenamento de PDF.

## Responsabilidades

- CRUD completo de processos e procedimentos (22+ funções Eel)
- Validação de unicidade de número por ano/origem/tipo
- Determinação da natureza do processo com base nas transgressões
- Gerenciamento de PMs envolvidos com seus status individuais
- Armazenamento e recuperação de PDF associado (BYTEA)
- Histórico de substituição de encarregados
- Estatísticas por tipo e solução
- Soft delete com auditoria

## Regras de Negócio

- 🟢 **RN-01** — Todos os tipos: `tipo_geral IN ('processo','procedimento')` + `tipo_detalhe` específico (`main.py:102`)
- 🟢 **RN-02** — Documento iniciador: `Portaria | Memorando Disciplinar | Feito Preliminar` (CHECK no banco)
- 🟢 **RN-03** — Unicidade: `(numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)` (`processos_service.py:456`)
- 🟢 **RN-04** — PAD/CD/CJ: `responsavel_id=NULL`; usa `presidente_id` no lugar (`processos_service.py:493`)
- 🟢 **RN-05** — Natureza calculada com base em transgressões: múltiplas → "Múltiplas"; única → normaliza case (`processos_service.py:17`)
- 🟢 **RN-06** — `penalidade_tipo` e `penalidade_dias` somente se `solucao_tipo == 'Punido'` (`processos_service.py:541`)
- 🟢 **RN-07** — `penalidade_dias` somente para `Prisao` ou `Detencao` (`processos_service.py:546`)
- 🟢 **RN-08** — Soluções para processos: `Punido | Absolvido | Arquivado` (`procedure_form.js:1039`)
- 🟢 **RN-09** — Soluções para procedimentos: `Homologado | Avocado | Arquivado` (`procedure_form.js:1040`)
- 🟢 **RN-10** — Datas não podem ser futuras (client-side: `procedure_form.js:3162`)
- 🟢 **RN-10b** — Na migração Rust/Tauri, o backend deve rejeitar datas futuras para `data_instauracao` e `data_conclusao` (confirmado pelo usuário em `questions.md#1`). O legado valida apenas no frontend.
- 🟢 **RN-11** — PADS deve ter ao menos uma transgressão (client-side: `procedure_form.js:3121`)
- 🟢 **RN-11b** — Na migração Rust/Tauri, o backend deve rejeitar PADS sem nenhuma transgressão (confirmado pelo usuário em `questions.md#1`). O legado valida apenas no frontend.
- 🟢 **RN-12** — PDF armazenado como BYTEA; transferido como base64 pelo Eel (`processos_service.py`)
- 🟢 **RN-13** — Soft delete: `ativo=FALSE` com auditoria (`app/processos.py`)
- 🟢 **RN-14** — `nome_vitima` armazenado como JSON array (suporta múltiplas vítimas) (`processos_service.py:557`)
- 🟢 **RN-15** — PM especial "A APURAR" exibe apenas o nome sem posto/matrícula (`processos_service.py:87`)
- 🟡 **RN-16** — Limite de PDF: 100 MB (validado somente no frontend)

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Registrar processo/procedimento com validação | Must | Persiste sem duplicar número; natureza calculada |
| RF-02 | Atualizar processo/procedimento | Must | Idem validação do registro |
| RF-03 | Listar processos com filtros | Must | Filtros por tipo, status, encarregado, ano |
| RF-04 | Obter processo por ID com PMs envolvidos | Must | Retorna dados completos incluindo indícios |
| RF-05 | Excluir processo (soft delete) | Must | `ativo=FALSE` + auditoria |
| RF-06 | Controlar PMs envolvidos por processo | Must | Múltiplos PMs com status individual |
| RF-07 | Salvar/obter/remover PDF | Should | PDF como base64→BYTEA; metadados armazenados |
| RF-08 | Histórico de encarregados | Should | JSON append no historico_encarregados |
| RF-09 | Estatísticas PADS por solução | Should | Agrupamento por solucao_tipo |
| RF-10 | Estatísticas IPM/IPPM por tipo de indício | Should | Contagem crimes CPM, RDPM, Art.29 |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Somente usuários logados podem operar processos | `app/routers/processos.py` — todos os handlers usam `guard_login()` | 🟢 |
| Integridade | Validação de duplicidade server-side | `processos_service.py:456-488` | 🟢 |
| Performance | Sem pool de conexões — uma conexão por request | `db_config.py:get_pg_connection()` | 🟡 |

## Critérios de Aceitação

```gherkin
Cenário: Registrar procedimento SR
  Dado usuário logado
  Quando registrar_processo(numero="001", tipo_geral="procedimento", tipo_detalhe="SR", documento_iniciador="Portaria", ...)
  Então processo criado; prazo_base=30 dias

Cenário: Registrar PAD (sem encarregado)
  Dado usuário logado
  Quando registrar_processo(tipo_geral="processo", tipo_detalhe="PAD", presidente_id="uuid-pm", ...)
  Então processo criado com responsavel_id=NULL; presidente_id preenchido

Cenário: Duplicata de número
  Dado processo "001/Portaria/2025" já existe
  Quando tentar registrar outro "001/Portaria/2025" no mesmo local_origem
  Então retornar erro de duplicidade

Cenário: PADS concluído como Punido
  Dado processo PADS
  Quando atualizar com concluido=true, solucao_tipo="Punido", penalidade_tipo="Prisao", penalidade_dias=15
  Então persistir penalidade completa

Cenário: Solução não-Punido apaga penalidade
  Dado processo com solucao_tipo="Absolvido"
  Então penalidade_tipo=NULL e penalidade_dias=NULL (regra no backend)

Cenário: Salvar PDF
  Dado processo existente
  Quando salvar_pdf_processo(id, nome, base64_content, content_type)
  Então PDF decodificado e armazenado como BYTEA; metadados salvos
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Registrar/Atualizar processo | Must | Core do sistema |
| Listar + filtrar | Must | Acesso às listagens |
| Obter por ID | Must | Visualização de detalhes |
| Controle de PMs envolvidos | Must | Dado essencial do processo |
| Excluir (soft delete) | Must | Gestão do acervo |
| PDF (salvar/obter/remover) | Should | Documentação legal |
| Histórico de encarregados | Should | Rastreabilidade administrativa |
| Estatísticas | Could | Relatórios gerenciais |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `app/routers/processos.py` | 10 handlers registrados | 🟢 |
| `main.py:1646-5178` | ~60 handlers legados não migrados para routers; fora do escopo da migração quando não usados pela UI atual (confirmado pelo usuário em `questions.md#3`) | 🟢 |
| `app/services/processos_service.py` | `registrar_processo`, `atualizar_processo`, `buscar_pms_envolvidos`, `salvar_pdf_processo` etc. | 🟢 |
| `app/processos.py` | `excluir_processo` | 🟢 |
