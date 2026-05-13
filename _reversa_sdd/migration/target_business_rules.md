---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: target_business_rules
producedBy: curator
hash: "sha256:3bdefd153e29eafd00b30076e21c7d9f9e940e0fa90abeba1c7e516e61faab6f"
---

# Target Business Rules

> Catalogo das regras de negocio do legado com decisao de migracao: MIGRAR, DESCARTAR ou DECISAO HUMANA.
> Cada item rastreia para a origem em `_reversa_sdd/` e respeita `paradigm_decision.md`.

## Resumo

- Total de regras analisadas: 79
- MIGRAR: 68
- DESCARTAR: 9 (detalhe em `discard_log.md`)
- DECISAO HUMANA: 0

## Regras MIGRAR

### BR-MIGRAR-001 — Autenticacao e sessao
- **Origem**: `_reversa_sdd/autenticacao/requirements.md` RN-01 a RN-07; `_reversa_sdd/permissions.md` Auth
- **Confianca original**: 🟢
- **Descricao**: autenticar apenas usuarios `is_operador=TRUE` e `ativo=TRUE`; manter login/logout/consulta de usuario; calcular `is_admin` por `perfil == 'admin'`; criar admin padrao quando ausente; sessao nao persiste apos fechamento do app.
- **Justificativa de migracao**: fluxo essencial e requisito de paridade funcional.
- **Compatibilidade com paradigma alvo**: modelar usuario de sessao como struct Rust em estado Tauri controlado, nao como dict global solto.

### BR-MIGRAR-002 — Hash de senha e compatibilidade com legado
- **Origem**: `_reversa_sdd/autenticacao/requirements.md` RN-02/RN-03; `_reversa_sdd/usuarios/requirements.md` RN-13; `_reversa_sdd/gaps.md` U-01
- **Confianca original**: 🟢
- **Descricao**: login deve aceitar bcrypt e SHA-256 legado, fazer upgrade transparente para bcrypt e usar bcrypt tambem em atualizacao de usuario.
- **Justificativa de migracao**: preserva acesso de usuarios existentes e corrige bug confirmado.
- **Compatibilidade com paradigma alvo**: representar algoritmo detectado como enum/funcao explicita; retorno por `Result`.

### BR-MIGRAR-003 — RBAC por perfil
- **Origem**: `_reversa_sdd/permissions.md`
- **Confianca original**: 🟢
- **Descricao**: manter perfis `comum` e `admin`; perfil comum fica somente leitura; criacao, edicao e remocao ficam restritas a admin em todos os modulos, incluindo processos; auditorias restritas a admin.
- **Justificativa de migracao**: controle de acesso essencial do sistema, ajustado por decisao humana durante o `/reversa-migrate`.
- **Compatibilidade com paradigma alvo**: guards Tauri reutilizaveis por comando, com erro tipado de autorizacao.

### BR-MIGRAR-004 — Catalogos de crimes/contravencoes e municipios
- **Origem**: `_reversa_sdd/catalogos/requirements.md` RN-01 a RN-10
- **Confianca original**: 🟢
- **Descricao**: CRUD admin de crimes/contravencoes; soft delete; validacao de artigo/paragrafo/inciso/alinea; busca case-insensitive de municipios/distritos com formatacao de municipio pai.
- **Justificativa de migracao**: catalogos alimentam formularios e indicios.
- **Compatibilidade com paradigma alvo**: validadores puros e structs para campos legais.

### BR-MIGRAR-005 — RDPM
- **Origem**: `_reversa_sdd/rdpm/requirements.md` RN-01 a RN-07; `_reversa_sdd/gaps.md` R-01
- **Confianca original**: 🟢
- **Descricao**: CRUD admin de transgressoes; id SERIAL; listagem ordenada por artigo/inciso; gravidade title-case; unicidade `(gravidade, inciso)`; hard delete somente quando nao houver referencia em `pm_envolvido_rdpm`.
- **Justificativa de migracao**: catalogo legal ativo; protecao de integridade confirmada pelo usuario.
- **Compatibilidade com paradigma alvo**: usar tipo numerico para id e erro de dominio para exclusao bloqueada.

### BR-MIGRAR-006 — Art. 29
- **Origem**: `_reversa_sdd/art29/requirements.md` RN-01 a RN-06
- **Confianca original**: 🟢
- **Descricao**: CRUD admin de infracoes; UUID; soft delete; inciso unico entre ativos; inciso/texto obrigatorios; ordenacao especial de incisos romanos.
- **Justificativa de migracao**: fonte de classificacao de indicios.
- **Compatibilidade com paradigma alvo**: encapsular ordenacao romana em funcao testavel.

### BR-MIGRAR-007 — Processos e procedimentos
- **Origem**: `_reversa_sdd/processos/requirements.md` RN-01 a RN-16; `_reversa_sdd/domain.md` RN-08 a RN-15
- **Confianca original**: 🟢 / 🟡
- **Descricao**: migrar CRUD completo de processos/procedimentos usados; tipos `processo/procedimento`; documento iniciador; unicidade; papeis; natureza por transgressoes; penalidade apenas para `Punido`; dias apenas para `Prisao/Detencao`; solucoes por tipo; PDF BYTEA/base64; soft delete; vitimas em array; PM especial "A APURAR"; limite de PDF 100 MB como validacao alvo.
- **Justificativa de migracao**: modulo central do sistema e principal criterio de paridade.
- **Compatibilidade com paradigma alvo**: enums para tipos, solucoes, penalidades e papeis; validacoes backend centralizadas.

### BR-MIGRAR-008 — Correcoes confirmadas de processos
- **Origem**: `_reversa_sdd/processos/requirements.md` RN-10b/RN-11b; `_reversa_sdd/questions.md` perguntas 1, 3, 4, 5 e 6
- **Confianca original**: 🟢
- **Descricao**: backend Rust/Tauri deve rejeitar datas futuras para `data_instauracao` e `data_conclusao`; rejeitar PADS sem transgressao; desconsiderar handlers legados nao usados pela UI; usar `pm_envolvido_indicios.categorias_indicios` JSONB; incluir tabelas `procedimentos_indicios_*`; preservar papeis confirmados.
- **Justificativa de migracao**: decisoes humanas ja tomadas no Reviewer.
- **Compatibilidade com paradigma alvo**: tratar como regras de dominio, nao como detalhes de UI.

### BR-MIGRAR-009 — Usuarios
- **Origem**: `_reversa_sdd/usuarios/requirements.md` RN-01 a RN-13; `_reversa_sdd/questions.md` perguntas 7 a 10
- **Confianca original**: 🟢
- **Descricao**: CRUD de usuarios; `tipo_usuario`; matricula/email unicos; email obrigatorio para operadores; senha obrigatoria/minimo 4 para operadores; perfil `admin/comum`; nome uppercase; email lowercase; soft delete; auditoria; PM "A APURAR"; flags independentes `is_encarregado`/`is_operador`; bloquear autodesativacao de admin; manter comando `delete_user`.
- **Justificativa de migracao**: funcionalidade administrativa essencial.
- **Compatibilidade com paradigma alvo**: structs separadas para criar/atualizar/listar; comandos Tauri podem manter nomes legados quando isso reduz risco.

### BR-MIGRAR-010 — Prazos
- **Origem**: `_reversa_sdd/prazos/requirements.md` RN-01 a RN-08; `_reversa_sdd/questions.md` pergunta 2
- **Confianca original**: 🟢 / 🟡
- **Descricao**: prazo inicial automatico; prorrogacao a partir do dia seguinte ao vencimento; portaria/data/ordem; tipos `inicial/prorrogacao`; prazo ativo por `ativo=1`; prazos base confirmados; dashboard e relatorios de prazo.
- **Justificativa de migracao**: regra operacional critica para acompanhamento de processos.
- **Compatibilidade com paradigma alvo**: servico de dominio de prazos com funcoes deterministicas de calculo.

### BR-MIGRAR-011 — Andamentos
- **Origem**: `_reversa_sdd/andamentos/requirements.md` RN-01 a RN-07; `_reversa_sdd/questions.md` pergunta 12
- **Confianca original**: 🟢 / 🟡
- **Descricao**: andamentos em JSONB de `processos_procedimentos.andamentos`; inserir no inicio; estrutura `{id,texto,data,usuario}`; usuario padrao "Sistema"; remocao por id; normalizacao de campos legados; alias de compatibilidade quando necessario.
- **Justificativa de migracao**: funcionalidade usada no historico processual.
- **Compatibilidade com paradigma alvo**: modelar andamento como struct serializavel e manter fallback de leitura.

### BR-MIGRAR-012 — Indicios
- **Origem**: `_reversa_sdd/indicios/requirements.md` RN-01 a RN-07; `_reversa_sdd/questions.md` pergunta 11
- **Confianca original**: 🟢
- **Descricao**: associar indicios a PM envolvido; usar `pm_envolvido_indicios` + crimes/RDPM/Art29; `categorias_indicios` JSONB; salvar idempotente apagando e recriando vinculos; um registro ativo por PM; aceitar formatos de entrada normalizados; categorias extensiveis por catalogos.
- **Justificativa de migracao**: essencial para IPM/IPPM, estatisticas e relatorios.
- **Compatibilidade com paradigma alvo**: comandos com payloads tipados e transacao sqlx para upsert destrutivo.

### BR-MIGRAR-013 — Mapas mensais
- **Origem**: `_reversa_sdd/mapas/requirements.md` RN-01 a RN-07
- **Confianca original**: 🟢
- **Descricao**: gerar mapa mensal por tipo e completo; processos em andamento instaurados ate o mes; concluidos no mes; salvar metadados e dados JSON; listar/obter/excluir mapas; listar tipos.
- **Justificativa de migracao**: brief cita graficos, listagens, relatorios e estatisticas como escopo.
- **Compatibilidade com paradigma alvo**: separar queries de agregacao de montagem de DTOs de tela/relatorio.

### BR-MIGRAR-014 — Relatorios
- **Origem**: `_reversa_sdd/relatorios/requirements.md` RN-01 a RN-05/RN-10; `_reversa_sdd/questions.md` pergunta 14
- **Confianca original**: 🟢 / 🟡
- **Descricao**: relatorio anual PDF; estatisticas gerais; por encarregado; por tipo; prazos vencidos; CSV; Excel. Prioridade confirmada: mapa mensal PDF.
- **Justificativa de migracao**: escopo confirmado pelo usuario, mesmo para funcoes stub no legado.
- **Compatibilidade com paradigma alvo**: implementar do zero onde nao houver service legado; manter paridade funcional por criterio de saida.

### BR-MIGRAR-015 — Auditoria
- **Origem**: `_reversa_sdd/auditorias/requirements.md` RN-01 a RN-06
- **Confianca original**: 🟢
- **Descricao**: registrar CREATE/UPDATE/DELETE nos modulos; consultar auditorias apenas como admin; listagem paginada; detalhe; historico por registro/usuario; estatisticas.
- **Justificativa de migracao**: rastreabilidade operacional.
- **Compatibilidade com paradigma alvo**: middleware/helper de auditoria reutilizavel chamado pelos comandos de escrita.

### BR-MIGRAR-016 — Transicoes de estado explicitadas
- **Origem**: `_reversa_sdd/state-machines.md`; `_reversa_sdd/questions.md` pergunta 16
- **Confianca original**: 🟢
- **Descricao**: manter ciclo ativo/concluido/excluido de processos; expor reabertura de processo concluido e reativacao de usuario desativado na UI Rust/Tauri.
- **Justificativa de migracao**: decisao humana confirmada e melhoria funcional compativel com backend legado.
- **Compatibilidade com paradigma alvo**: enums/estado explicito para transicoes permitidas.

## Regras DESCARTAR (resumo)

| ID | Origem | Motivo curto | Vinculo a paradigma? |
|---|---|---|---|
| BR-DESCARTAR-001 | `_reversa_sdd/architecture.md` Stack/Startup | Protocolo Eel/WebSocket proprietario substituido por comandos Tauri | sim |
| BR-DESCARTAR-002 | `_reversa_sdd/inventory.md` Empacotamento | PyInstaller/Chrome fallback nao se aplica a Tauri | sim |
| BR-DESCARTAR-003 | `_reversa_sdd/processos/requirements.md` Rastreabilidade | Handlers legados de `main.py` nao usados pela UI atual fora do escopo | nao |
| BR-DESCARTAR-004 | `_reversa_sdd/questions.md` pergunta 9 | `atualizar_usuario_old` pode ser removido | nao |
| BR-DESCARTAR-005 | `_reversa_sdd/questions.md` pergunta 4 | Campo TEXT `processos_procedimentos.indicios_categorias` nao sera fonte canonica | nao |
| BR-DESCARTAR-006 | `_reversa_sdd/usuarios/requirements.md` RN-13 | SHA-256 em atualizacao de usuario e bug, nao regra alvo | nao |
| BR-DESCARTAR-007 | `_reversa_sdd/gaps.md` Acoes obrigatorias | Debug prints de producao devem ser removidos | sim |
| BR-DESCARTAR-008 | `_reversa_sdd/domain.md` RN-21 | Padrao duplo de resposta `sucesso` vs `success` deve ser normalizado no alvo | sim |
| BR-DESCARTAR-009 | `_reversa_sdd/domain.md` e specs que citam IPPM | Referencias a IPPM devem ser desconsideradas; tipo correto e IPM | nao |

> Detalhe completo em `discard_log.md`.

## Regras DECISAO HUMANA

Nenhuma pendencia humana permanece apos decisao do usuario.

### BR-HUMANA-001 — Ownership em processos
- **Origem**: `_reversa_sdd/permissions.md` Lacunas L1
- **Tipo de ambiguidade**: 🔴 GAP
- **Descricao**: no legado, qualquer operador comum pode excluir/alterar processos sem controle de ownership por responsavel/encarregado.
- **Opcoes**:
  - A. Manter paridade estrita: qualquer operador logado pode operar processos como hoje.
  - B. Restringir alteracao/exclusao a admin ou responsavel vinculado.
- **Recomendacao do Curator**: A por enquanto, porque o brief pede paridade funcional e simplicidade. Registrar B como melhoria futura.
- **Status**: RESOLVIDA — criacao, edicao e remocao somente para admins; demais perfis somente leitura.

### BR-HUMANA-002 — Seguranca de login adicional
- **Origem**: `_reversa_sdd/gaps.md` pontos A-02/A-03; `_reversa_sdd/permissions.md` L3
- **Tipo de ambiguidade**: dependencia de stakeholder
- **Descricao**: legado nao possui timeout por inatividade, log de tentativas falhas ou rate limiting.
- **Opcoes**:
  - A. Manter comportamento atual para paridade e simplicidade.
  - B. Adicionar timeout/log/rate limiting na primeira versao Rust/Tauri.
- **Recomendacao do Curator**: A, pois e app desktop local e o brief nao pediu endurecimento de seguranca agora.
- **Status**: RESOLVIDA — manter comportamento atual, sem timeout/log/rate limiting na primeira versao.

### BR-HUMANA-003 — IPPM prazo base
- **Origem**: `_reversa_sdd/prazos/requirements.md` RN-06; `_reversa_sdd/questions.md` pergunta 2
- **Tipo de ambiguidade**: 🔴 GAP
- **Descricao**: resposta humana confirmou IPM=40 dias, mas nao mencionou IPPM explicitamente. A spec orienta seguir default do legado se nao houver decisao posterior.
- **Opcoes**:
  - A. IPPM segue default 30 dias.
  - B. IPPM segue IPM com 40 dias.
- **Recomendacao do Curator**: A, porque a spec atual diz usar default quando nao houver decisao posterior.
- **Status**: RESOLVIDA — IPPM nao existe; referencias a IPPM devem ser desconsideradas. O tipo correto e IPM com prazo inicial de 40 dias.

## Notas

- A decisao transformacional do `paradigm_decision.md` muda a implementacao interna, mas nao reduz escopo funcional.
- Itens inferidos podem migrar, mas devem receber testes de paridade e validacao durante codificacao.
- Decisoes ja respondidas em `_reversa_sdd/questions.md` foram tratadas como confirmadas, nao como novas pendencias.
