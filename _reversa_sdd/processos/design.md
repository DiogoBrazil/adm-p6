# Processos e Procedimentos — Design Técnico

## Interface (principais funções)

| Símbolo | Guard | Descrição |
|---------|-------|-----------|
| `registrar_processo(...)` | login | Cria novo processo/procedimento (40+ parâmetros) |
| `atualizar_processo(id, ...)` | login | Atualiza processo existente |
| `listar_processos(filtros)` | login | Lista com paginação e filtros |
| `obter_processo(id)` | login | Detalhe com PMs e indícios |
| `excluir_processo(id)` | login | Soft delete + auditoria |
| `substituir_encarregado(id, novo_id, justificativa)` | login | Substitui + appenda ao historico_encarregados |
| `salvar_pdf_processo(id, nome, base64, ct)` | login | Armazena PDF como BYTEA |
| `obter_pdf_processo(id, incluir_conteudo)` | login | Metadados ± base64 do PDF |
| `remover_pdf_processo(id)` | login | Limpa campos PDF |
| `obter_estatistica_pads_solucoes(ano?)` | login | PADS por solucao_tipo |
| `obter_estatistica_ipm_indicios(ano?)` | login | Indícios IPM/IPPM por tipo |

## Fluxo Principal — Registrar Processo

```
1. guard_login()
2. Receber 40+ parâmetros do formulário
3. Converter concluido para bool (pode vir como int, str ou bool)
4. Se tipo_geral='processo' AND tipo_detalhe IN ('PAD','CD','CJ'):
   → responsavel_id = None, responsavel_tipo = None
5. Resolver tipos de presidente, interrogante, escrivao_processo (verificar se id existe em usuarios)
6. Normalizar penalidade_tipo (mapeamento de acentuação):
   'Prisão'→'Prisao', 'Detenção'→'Detencao', etc.
7. Se solucao_tipo != 'Punido': penalidade_tipo=None, penalidade_dias=None
8. Se penalidade_tipo NOT IN ('Prisao','Detencao'): penalidade_dias=None
9. Converter nome_vitima para JSON array se necessário
10. Verificar unicidade: (numero, documento_iniciador, tipo_detalhe, local_origem, ano_instauracao)
11. Calcular ano_instauracao a partir de data_instauracao (ou ano corrente)
12. Gerar processo_id = UUID
13. INSERT INTO processos_procedimentos (40+ campos)
14. INSERT pms_envolvidos em procedimento_pms_envolvidos
15. registrar_auditoria('processos_procedimentos', id, 'CREATE', usuario_id)
16. Retornar {sucesso: true, processo_id: uuid}
```
Origem: `app/services/processos_service.py:342-660`

## Fluxo Principal — Determinar Natureza

```
_determinar_natureza_processo(natureza_original, transgressoes_selecionadas):
  1. Se transgressoes_selecionadas vazio → retornar natureza_original
  2. Coletar naturezas únicas das transgressões:
     media→Média, leve→Leve, grave→Grave
  3. Se len(naturezas_unicas) > 1 → "Múltiplas"
  4. Se len == 1 → retornar a única natureza normalizada
  5. Fallback → natureza_original
```
Origem: `app/services/processos_service.py:17`

## Fluxo Principal — Salvar PDF

```
1. Receber nome_arquivo, conteudo_base64, content_type
2. base64.b64decode(conteudo_base64) → bytes
3. UPDATE processos_procedimentos SET
   pdf_arquivo=bytes, pdf_nome=nome, pdf_content_type=ct,
   pdf_tamanho=len(bytes), pdf_upload_em=NOW()
   WHERE id=processo_id
4. Retornar {sucesso: true}
```
Origem: `app/services/processos_service.py`

## Fluxo Principal — Obter PDF

```
1. SELECT pdf_nome, pdf_content_type, pdf_tamanho, pdf_upload_em [, pdf_arquivo]
   WHERE id=processo_id
2. Se incluir_conteudo=True: base64.b64encode(pdf_arquivo) → string
3. Retornar {sucesso: true, pdf: {nome, content_type, tamanho, upload_em, conteudo?}}
```

## Tipos de Processo e Seus Papéis

| tipo_detalhe | tipo_geral | Encarregado | Presidente | Escrivão Proc. | Interrogante |
|-------------|-----------|:-----------:|:----------:|:--------------:|:------------:|
| SR, SV, IPM, IPPM, FP, CP, PADS | procedimento | ✅ | — | — | — |
| IPM | procedimento | ✅ | — | ✅ | — |
| PAD, PADE | processo | — | ✅ | ✅ | ✅ |
| CD, CJ | processo | — | ✅ | ✅ | ✅ |

Confirmação de negócio (`questions.md#6`): SR, SV, IPM, PADS, CP, FP e PADE usam responsável como "Encarregado"; IPM também possui "Escrivão"; PAD, CD e CJ usam "Presidente", "Interrogante" e "Escrivão". Na migração, manter os tipos de responsável alinhados a esses papéis.

## Tipos de Penalidade

| penalidade_tipo | Com dias? | Disponível para |
|----------------|-----------|----------------|
| Prisao | ✅ | Todos os processos |
| Detencao | ✅ | Todos |
| Repreensao | — | Todos |
| Licenciado_Disciplina | — | PAD/CJ 🟡 |
| Excluido_Disciplina | — | PAD/CJ 🟡 |
| Demitido_Exoficio | — | PAD/CJ 🟡 |

## Dependências

- `app/services/processos_service.py` — lógica central
- `prazos_andamentos_manager.py` — prazo criado automaticamente após registrar
- `db_manager.registrar_auditoria()` — auditoria
- Tabelas: `processos_procedimentos`, `procedimento_pms_envolvidos`, `prazos_processo`

## Estado Interno

Ciclo de vida do processo armazenado na tabela:
- `ativo=TRUE, concluido=FALSE` → Em Andamento
- `ativo=TRUE, concluido=TRUE` → Concluído
- `ativo=FALSE` → Excluído (qualquer estado anterior)

## Observabilidade

- 🟢 Auditoria CREATE/UPDATE/DELETE na tabela `auditoria`
- 🔴 Debug prints extensivos em `processos_service.py` — remover na migração

## Riscos e Lacunas

- 🟢 Validação de datas futuras deve ser implementada também no backend Rust/Tauri (confirmado pelo usuário em `questions.md#1`)
- 🟢 Validação de PADS sem transgressão deve ser implementada também no backend Rust/Tauri (confirmado pelo usuário em `questions.md#1`)
- 🟢 ~60 handlers ainda em `main.py` não usados pela UI atual podem ser desconsiderados na migração (confirmado pelo usuário em `questions.md#3`)
- 🟢 `indicios_categorias` TEXT legado pode ser ignorado; usar apenas `pm_envolvido_indicios.categorias_indicios` JSONB (confirmado pelo usuário em `questions.md#4`)
