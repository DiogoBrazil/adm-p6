---
schemaVersion: 1
generatedAt: 2026-05-12T22:51:48Z
reversa:
  version: "1.2.38"
kind: paradigm_decision
producedBy: paradigm_advisor
hash: "sha256:b07dd64b4aa51aa157421d5eb9244fd894d3be526a8aa8fffa273d9aecad91e8"
---

# Paradigm Decision

> Decisao consciente sobre como tratar a mudanca de paradigma entre o legado Python/Eel e a stack alvo Rust/Tauri.
> Este artefato e leitura obrigatoria primeiro para qualquer agente posterior e para o agente de codificacao.

## Paradigma do legado detectado

- **Paradigma principal**: procedural em camadas
- **Confianca**: 🟢 CONFIRMADO
- **Evidencias**:
  - `_reversa_sdd/architecture.md` descreve uma aplicacao desktop Python + Eel com frontend HTML/JS, routers `app/routers/*.py`, services `app/services/*.py` e acesso direto ao PostgreSQL via psycopg2.
  - `_reversa_sdd/code-analysis.md` define o padrao de camadas como handlers `@eel.expose` que validam sessao, delegam para services e usam SQL direto.
  - `_reversa_sdd/inventory.md` identifica `main.py` como entry point que inicializa Eel, DB, manager de prazos e registra 73 funcoes expostas ao frontend.
  - `_reversa_sdd/domain.md` apresenta regras como funcoes e fluxos de dados, sem aggregates, interfaces de repositorio ou DI formal.
- **Variacoes observadas**:
  - Backend: procedural em camadas com services e SQL direto.
  - Frontend: JavaScript vanilla imperativo, acoplado a chamadas Eel.
  - Persistencia: acesso direto ao banco, com uso misto de SQLAlchemy/Alembic para schema e psycopg2 para operacao.

## Stack alvo declarada

- Linguagem: Rust
- Framework: Tauri
- Banco: PostgreSQL com sqlx
- Infra: aplicacao desktop
- Mensageria: nenhuma por enquanto
- Observabilidade: sem necessidade por enquanto

## Paradigma natural inferido

- **Paradigma**: Rust idiomatico com ownership, tipagem forte, structs/enums, erros estruturados e async pontual para I/O.
- **Justificativa**: Rust favorece imutabilidade por default, modelagem explicita de estados, tratamento de erro por `Result`, ownership/borrowing para evitar efeitos colaterais acidentais e integracao Tauri por comandos explicitamente tipados. Com sqlx, consultas e mapeamentos tendem a ser organizados em structs e funcoes assíncronas ou bloqueantes controladas.
- **Alternativas viaveis**:
  - Procedural conservador em Rust: possivel, mas tende a virar uma traducao sintatica do legado e perde parte do beneficio de tipos, erros e modularidade.
  - OO simulado: possivel com traits e structs, mas nao e necessario para este dominio desktop CRUD-heavy.
  - Event-driven: desnecessario no escopo atual, pois o brief declara sem mensageria e sem necessidade de observabilidade por enquanto.

## Gap identificado

- **Severidade**: medio
- **Implicacoes concretas**:
  - Validacoes hoje espalhadas entre frontend e backend precisam virar regras centrais no Rust. Exemplo: `_reversa_sdd/domain.md` RN-10 e RN-13 confirmam que PADS sem transgressao e datas futuras devem ser validados no backend Rust/Tauri.
  - Dados flexiveis em dict/JSON precisam virar structs/enums. Exemplo: `_reversa_sdd/domain.md` lista `tipo_detalhe`, `solucao_tipo`, `penalidade_tipo`, papeis de processo e status de PM como regras que devem ser modeladas com tipos seguros.
  - Sessao global Python precisa virar estado controlado do Tauri. Exemplo: `_reversa_sdd/code-analysis.md` descreve `usuario_logado` como variavel global em `main.py`; em Tauri, isso deve ser um estado gerenciado.
  - SQL direto precisa ser organizado em modulos de persistencia com sqlx sem criar arquitetura excessiva. Exemplo: `_reversa_sdd/architecture.md` descreve services com acesso direto ao PostgreSQL; a migracao deve preservar simplicidade, mas separar comandos, regras e queries.
  - A interface pode mudar, mas os comandos e fluxos devem preservar paridade funcional. Exemplo: `_reversa_sdd/migration/migration_brief.md` exige 100% das funcionalidades usadas, com liberdade para ajustar layout, botoes e organizacao visual.

## Opcoes apresentadas ao usuario

1. **Adotar paradigma natural da stack** (transformacional)
   - Consequencias: usar Rust idiomatico, structs/enums, `Result`, erros estruturados, validacoes backend fortes, comandos Tauri tipados, repositorios simples com sqlx e modelagem explicita dos estados do dominio.
2. **Forcar paradigma similar ao legado** (conservador)
   - Consequencias: manter funcoes grandes e procedurais semelhantes ao Python, reduzindo mudanca mental imediata, mas acumulando debito tecnico e perdendo parte dos beneficios de Rust.
3. **Hibrido** (equilibrado)
   - Consequencias: preservar fluxos e nomes reconheciveis do legado, mas aplicar tipos e modulos idiomaticos onde reduzem risco.

## Decisao do usuario

- **Escolha**: 1
- **Justificativa do usuario**: o usuario escolheu adotar o paradigma natural da stack Rust/Tauri.
- **Decidido em**: 2026-05-12T22:51:48Z

## Apetite derivado

- `derived_appetite`: transformational

## Implicacoes pendentes para proximos agentes

| Agente | Implicacao | Como honrar |
|---|---|---|
| Curator | Paridade funcional continua obrigatoria, mas detalhes acidentais do legado podem ser descartados | Separar regra de negocio essencial de implementacao acidental Python/Eel |
| Curator | Validacoes confirmadas devem entrar no sistema novo mesmo quando ausentes no backend legado | Manter correcoes confirmadas pelo usuario como regras alvo |
| Strategist | Mudanca para Rust idiomatico aumenta transformacao interna | Planejar migracao por dominios, com contratos de paridade e marcos de validacao |
| Designer | Modelar dominio com structs/enums, erros tipados, comandos Tauri e persistencia sqlx organizada | Propor arquitetura simples, sem DI/container pesado, mas com separacao clara entre command, service/domain e repository |
| Screen Translator | UI pode ser modernizada, mas funcionalidades e fluxos usados devem permanecer | Traduzir telas por capacidade funcional, nao por copia literal de HTML/CSS |
| Inspector | Paridade deve validar comportamento, nao igualdade visual | Gerar testes de paridade para CRUDs, listagens, relatorios, estatisticas, validacoes e fluxos de processo |

## Notas

- Evitar mensageria, CQRS, microservicos ou observabilidade complexa nesta fase; o brief explicitamente pede simplicidade e nao declara necessidade desses componentes.
- Quando houver duvidas tecnicas sobre Rust, Tauri, PostgreSQL, sqlx ou bibliotecas relacionadas, usar MCP Context7 como fonte de documentacao atualizada.
- A decisao transformacional autoriza modernizacao interna, mas nao autoriza perda de funcionalidade.
