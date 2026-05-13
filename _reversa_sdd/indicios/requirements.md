# Indícios — Requisitos

## Visão Geral

Módulo de gestão de indícios associados a PMs envolvidos em procedimentos disciplinares. Cada PM envolvido pode ter indícios de quatro tipos: categorias gerais (JSONB), crimes/contravenções do CPM, transgressões do RDPM e infrações do Art.29 do Estatuto. A estrutura usa tabelas de relacionamento separadas por tipo de indício.

## Responsabilidades

- Salvar conjunto de indícios (crimes + RDPM + Art.29 + categorias) para um PM envolvido
- Carregar indícios de um PM envolvido
- Listar todos os PMs envolvidos de um procedimento com seus indícios
- Remover todos os indícios de um PM envolvido
- Buscar crimes, transgressões RDPM e infrações Art.29 para seleção pelo usuário

## Regras de Negócio

- 🟢 **RN-01** — Indícios associados ao `pm_envolvido_id` (FK para `procedimento_pms_envolvidos`)
- 🟢 **RN-02** — Estrutura em 4 tabelas: `pm_envolvido_indicios` (principal) + `pm_envolvido_crimes` + `pm_envolvido_rdpm` + `pm_envolvido_art29`
- 🟢 **RN-03** — `categorias_indicios` é JSONB array de strings em `pm_envolvido_indicios` (`indicios.py:categorias_json`)
- 🟢 **RN-04** — Salvar é idempotente: se já existir registro, DELETE os vínculos e recria (não duplica) (`indicios.py:71-79`)
- 🟢 **RN-05** — Apenas 1 registro ativo por PM envolvido (`pm_envolvido_indicios.ativo=TRUE`)
- 🟢 **RN-06** — Campos opcionais recebidos como `[{'id': 'uuid'}, ...]` ou `[uuid_str]` — normalizado no salvar
- 🟢 **RN-07** — Categorias são extensíveis pelo admin e derivadas dos catálogos `transgressoes`, `infracoes_estatuto_art29` e `crimes_contravencoes` (confirmado pelo usuário em `questions.md#11`). Os códigos `crimes_cpm`, `transgressoes_rdpm`, `transgressoes_art29` e `sem_indicios` aparecem como categorias operacionais/estatísticas no legado.

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Salvar indícios de PM envolvido | Must | Upsert: cria ou substitui; retorna sucesso |
| RF-02 | Carregar indícios de PM envolvido | Must | Retorna categorias + crimes + RDPM + Art.29 |
| RF-03 | Listar PMs envolvidos com indícios | Must | Retorna array de PMs com seus indícios para um procedimento |
| RF-04 | Remover indícios de PM envolvido | Should | Deleta registro + vínculos; ativo=FALSE ou DELETE |
| RF-05 | Buscar crimes para seleção | Must | Busca por termo em `catalogos_crimes` |
| RF-06 | Buscar transgressões RDPM | Must | Busca por termo e gravidade em `catalogos_rdpm` |
| RF-07 | Buscar infrações Art.29 | Must | Busca por termo em `infracoes_estatuto_art29` |
| RF-08 | Obter categorias de indícios | Should | Retorna categorias válidas a partir dos catálogos administráveis |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Somente usuários logados | `guard_login()` em todos os handlers | 🟢 |
| Consistência | Salvar idempotente — sem duplicação | DELETE vínculos antes de recriar | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Salvar indícios de PM
  Dado PM envolvido "uuid-pm-x" sem indícios
  Quando salvar_indicios_pm_envolvido("uuid-pm-x",
        {categorias: ["crimes_cpm"], crimes: [{id: "crime-uuid"}], rdpm: [], art29: []})
  Então pm_envolvido_indicios com categorias_indicios=["crimes_cpm"];
        pm_envolvido_crimes com crime_id="crime-uuid"

Cenário: Substituir indícios existentes
  Dado PM com indícios existentes (2 crimes)
  Quando salvar_indicios_pm_envolvido com 1 crime diferente
  Então crimes anteriores removidos; novo crime inserido (sem duplicação)

Cenário: Listar PMs com indícios de procedimento
  Quando listar_pms_envolvidos_com_indicios("proc-uuid-y")
  Então retorna [{pm_id, nome, categorias, crimes: [...], rdpm: [...], art29: [...]}]
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Salvar + carregar + buscar | Must | Fluxo principal da tela de indícios |
| Listar com indícios | Must | Necessário para obter_processo completo |
| Remover | Should | Gestão de dados |
| Categorias | Should | Auxiliar de UI |

## Rastreabilidade de Código

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `app/routers/indicios.py` | 8 handlers @eel.expose | 🟢 |
| `app/services/indicios.py` | `salvar_indicios_pm_envolvido`, `carregar_indicios_pm_envolvido`, `listar_pms_envolvidos_com_indicios` | 🟢 |
