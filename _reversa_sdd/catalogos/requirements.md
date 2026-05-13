# Catálogos

## Visão Geral

Módulo responsável pelos catálogos legais utilizados em processos disciplinares: crimes e contravenções (CPM e legislação correlata) e municípios/distritos de Rondônia. Fornece dados de referência para os demais módulos (indícios, formulários de processo).

## Responsabilidades

- CRUD completo de crimes e contravenções (restrito a admins)
- Listagem e busca de crimes ativos para usuários autenticados
- Busca de municípios e distritos de Rondônia (lookup para formulários)
- Validação de formato dos campos legais (artigo, parágrafo, inciso, alínea)
- Registro de auditoria em CREATE e UPDATE

## Regras de Negócio

- 🟢 **RN-01** — CRUD de crimes requer `perfil = 'admin'` (`app/routers/catalogos.py:34`)
- 🟢 **RN-02** — Exclusão é soft delete (`ativo = FALSE`), não hard delete (`app/catalogos.py`)
- 🟢 **RN-03** — Auditoria registrada em CREATE e UPDATE (não em DELETE) (`app/routers/catalogos.py`)
- 🟢 **RN-04** — Listagem ordena por `tipo, dispositivo_legal, artigo` (`app/catalogos.py`)
- 🟢 **RN-05** — Validação de campos: `artigo` só dígitos; `paragrafo` ordinal; `inciso` romanos maiúsculos; `alinea` letra minúscula (`app/utils.py:validar_campos_crime`)
- 🟢 **RN-06** — `paragrafo` numérico puro é auto-convertido para ordinal (ex: `1` → `1º`) (`app/utils.py`)
- 🟢 **RN-07** — `inciso` é forçado para uppercase (`app/utils.py`)
- 🟢 **RN-08** — `alinea` é forçada para lowercase (`app/utils.py`)
- 🟢 **RN-09** — Busca de municípios/distritos é case-insensitive (ILIKE) (`app/catalogos.py`)
- 🟢 **RN-10** — Distritos com `municipio_pai` são formatados como "Distrito (Município pai)" (`app/catalogos.py`)

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | Listar crimes/contravenções ativos | Must | Retorna lista ordenada; somente `ativo=TRUE` |
| RF-02 | Buscar crime por ID | Must | Retorna crime ou erro se não encontrado |
| RF-03 | Cadastrar crime com validação de campos | Must | Rejeita formatos inválidos; registra auditoria |
| RF-04 | Atualizar crime com validação | Must | Idem cadastro; registra auditoria |
| RF-05 | Excluir crime (soft delete) | Must | `ativo=FALSE`; não remove do banco |
| RF-06 | Buscar municípios/distritos por nome | Must | Case-insensitive; distritos com nome composto |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | Escrita restrita a admins | `app/routers/catalogos.py:34,41,66` — `guard_admin()` | 🟢 |
| Integridade | Validação de formato de campos legais antes de persistir | `app/utils.py:validar_campos_crime` | 🟢 |

## Critérios de Aceitação

```gherkin
Cenário: Listar crimes como usuário autenticado
  Dado um usuário logado (qualquer perfil)
  Quando chamar listar_crimes_contravencoes()
  Então retornar lista de crimes com ativo=TRUE ordenada por tipo, dispositivo_legal, artigo

Cenário: Cadastrar crime como admin
  Dado um usuário com perfil=admin
  Quando chamar cadastrar_crime com artigo="157", paragrafo="1º", inciso="I", alinea="a"
  Então criar crime no banco e registrar auditoria CREATE

Cenário: Cadastrar crime com artigo inválido
  Dado um usuário admin
  Quando cadastrar_crime com artigo="15A"
  Então retornar erro de validação sem persistir

Cenário: Cadastrar como usuário comum
  Dado um usuário com perfil=comum
  Quando chamar cadastrar_crime(...)
  Então retornar {sucesso: false, mensagem: "Acesso negado: apenas administradores."}

Cenário: Excluir crime
  Dado um admin e um crime existente
  Quando chamar excluir_crime_contravencao(id)
  Então setar ativo=FALSE; crime não aparece mais em listagens

Cenário: Buscar município por nome parcial
  Dado "Porto Velho" no banco
  Quando chamar buscar_municipios_distritos("porto")
  Então retornar resultados incluindo "Porto Velho" (case-insensitive)

Cenário: Distrito com município pai
  Dado distrito "Jaci-Paraná" com municipio_pai "Porto Velho"
  Quando listar
  Então nome exibido: "Jaci-Paraná (Porto Velho)"
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Listar crimes | Must | Necessário para formulário de indícios |
| Buscar municípios | Must | Usado em formulário de processos |
| Cadastrar/Atualizar crime | Must | Manutenção do catálogo legal |
| Validação de campos | Must | Integridade de dados legais |
| Excluir crime (soft) | Should | Administração do catálogo |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `app/routers/catalogos.py` | `register()` — 6 handlers `@eel.expose` | 🟢 |
| `app/catalogos.py` | Funções de acesso ao banco | 🟢 |
| `app/utils.py` | `validar_campos_crime()` | 🟢 |
