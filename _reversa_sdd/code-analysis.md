# Análise Técnica do Código — adm-p6

> Gerado pelo Arqueólogo em 2026-05-12
> Nível: completo | Organização: por módulo
> Aplicação desktop de gestão disciplinar da Polícia Militar de Rondônia (Python + Eel → migração para Rust + Tauri)

---

## Arquitetura Geral

```
Frontend (HTML/JS/CSS no browser Eel)
    ↕ WebSocket (@eel.expose / eel.função_js)
Backend Python (main.py + app/)
    ↕ psycopg2
PostgreSQL 16 (Docker, porta 5438)
```

**Padrão de camadas:**
1. `app/routers/*.py` — Handlers `@eel.expose` (interface JS↔Python). Validam sessão via guards, delegam ao serviço.
2. `app/services/*.py` — Lógica de negócio, acesso direto ao banco.
3. `app/*.py` (catalogos, rdpm, art29, processos) — Módulos de domínio com SQL direto.
4. `prazos_andamentos_manager.py` — Manager com estado para prazos.
5. `db_config.py` / `app/services/db.py` — Conexão e `DatabaseManager`.

**Sessão:** variável global `usuario_logado` (dict) em `main.py`. Sem token JWT — válida enquanto o processo Eel estiver rodando.

---

## Módulo 1 — auth

**Arquivo principal:** `app/routers/auth.py`
**Tabela:** `usuarios`

### Funções expostas

| Função | Parâmetros | Guard | Descrição |
|--------|-----------|-------|-----------|
| `fazer_login` | email, senha | — | Verifica credenciais e define sessão |
| `obter_usuario_logado` | — | — | Retorna dados do usuário da sessão |
| `fazer_logout` | — | — | Limpa variável de sessão |

### Algoritmo de login (🟢 CONFIRMADO — `main.py:183`)

```
1. Buscar usuario WHERE email = ? AND ativo = TRUE AND is_operador = TRUE
2. Se não encontrado → retornar erro
3. Se hash começa com '$2' → bcrypt.checkpw()
   Senão → sha256(senha) == hash_armazenado
4. Se ok E era SHA-256 → upgrade para bcrypt (UPDATE)
5. Definir usuario_logado global
6. Retornar {sucesso, usuario, is_admin: (perfil == 'admin')}
```

### Regras de negócio

- 🟢 Apenas usuários com `is_operador = TRUE` podem fazer login
- 🟢 Migração automática SHA-256 → bcrypt no primeiro login válido com hash legado
- 🟢 Sessão em memória — perde com o fechamento do app
- 🟢 `is_admin = (perfil == 'admin')` calculado no login

---

## Módulo 2 — catalogos

**Arquivos:** `app/routers/catalogos.py`, `app/catalogos.py`
**Tabelas:** `crimes_contravencoes`, `municipios_distritos`

### Funções expostas

| Função | Guard | Descrição |
|--------|-------|-----------|
| `listar_crimes_contravencoes` | login | Lista crimes ativos ordenados por tipo, dispositivo_legal, artigo |
| `obter_crime_por_id` | login | Busca crime por ID |
| `cadastrar_crime` | admin | Cria crime + valida campos + auditoria |
| `atualizar_crime` | admin | Atualiza crime + valida campos + auditoria |
| `excluir_crime_contravencao` | admin | Soft delete (ativo = FALSE) |
| `buscar_municipios_distritos` | login | Busca case-insensitive por nome; formata distritos como "Distrito (Município pai)" |

### Validação de crimes (`app/utils.py:validar_campos_crime`)

```python
artigo   → apenas números (regex: ^[0-9]+$)
paragrafo → ordinal (1º, 2º) ou "único"; auto-converte número puro para ordinal
inciso   → apenas romanos maiúsculos (IVXLCDM); auto-uppercase
alinea   → única letra minúscula (a-z); auto-lowercase
```

### Regras de negócio

- 🟢 CRUD de crimes/contravenções requer perfil `admin`
- 🟢 Exclusão é soft (ativo = FALSE), não hard delete
- 🟢 Auditoria registrada em CREATE e UPDATE
- 🟢 Municípios/distritos com `municipio_pai` exibem formato composto

---

## Módulo 3 — rdpm

**Arquivos:** `app/routers/rdpm.py`, `app/rdpm.py`
**Tabela:** `transgressoes` (id SERIAL, não UUID)

### Funções expostas

| Função | Guard | Descrição |
|--------|-------|-----------|
| `listar_todas_transgressoes` | login | Lista todas, ordena por artigo + inciso; gravidade em title-case |
| `obter_transgressao_por_id` | login | Busca por ID |
| `cadastrar_transgressao` | admin | Insere + auditoria |
| `atualizar_transgressao` | admin | Verifica duplicidade + atualiza + auditoria |
| `excluir_transgressao` | admin | **Hard delete** (DELETE) — atenção na migração |

### Regras de negócio

- 🟢 Atualização verifica unicidade de `(gravidade, inciso)` case-insensitive (excluindo próprio registro)
- 🟢 **HARD DELETE** — diferente de todos os outros módulos
- 🟢 Gravidade formatada em title-case na leitura (`row['gravidade'].title()`)
- 🟢 ID é SERIAL (inteiro), não UUID
- 🟢 Auditoria em CREATE, UPDATE e DELETE

---

## Módulo 4 — art29

**Arquivos:** `app/routers/art29.py`, `app/art29.py`
**Tabela:** `infracoes_estatuto_art29` (id UUID, ativo BOOLEAN)

### Funções expostas

| Função | Guard | Descrição |
|--------|-------|-----------|
| `listar_infracoes_estatuto_art29` | login | Lista ativos com ordenação por inciso romano |
| `obter_infracao_estatuto_art29` | login | Busca por ID |
| `criar_infracao_estatuto_art29` | admin | Verifica unicidade de inciso + cria |
| `editar_infracao_estatuto_art29` | admin | Verifica unicidade + atualiza |
| `excluir_infracao_estatuto_art29` | admin | Soft delete (ativo = FALSE) |

### Algoritmo de ordenação de incisos (🟢 CONFIRMADO — `app/art29.py:14`)

```sql
ORDER BY
    CASE WHEN inciso ~ '^[IVXLC]' THEN LENGTH(inciso) ELSE 999 END,
    inciso
```
Incisos que começam com letras romanas (I, II, III, IV...) são ordenados pelo comprimento do texto (I < II < III), os demais ficam ao final.

### Regras de negócio

- 🟢 Inciso único por registro ativo (case-insensitive)
- 🟢 Inciso e texto obrigatórios (validados no router antes de chamar o módulo)
- 🟢 Soft delete (ativo = FALSE)
- 🟢 `id` é UUID

---

## Módulo 5 — processos

**Arquivos:** `app/routers/processos.py`, `app/processos.py`, `app/services/processos_service.py`
**Tabela:** `processos_procedimentos` (tabela central do sistema)

### Tipos de processos/procedimentos

| tipo_geral | tipo_detalhe | Descrição |
|------------|-------------|-----------|
| procedimento | SR | Sindicância Regular |
| procedimento | SV | Sindicância Verificatória |
| procedimento | IPM | Inquérito Policial Militar |
| procedimento | IPPM | Inquérito Policial Policial Militar |
| procedimento | FP | Feito Preliminar |
| procedimento | CP | Comissão de Processo |
| procedimento | PADS | Processo Administrativo Disciplinar Sumário |
| processo | PAD | Processo Administrativo Disciplinar |
| processo | PADE | PAD Especial |
| processo | CD | Conselho de Disciplina |
| processo | CJ | Conselho de Justificação |

### Documento Iniciador (CHECK constraint)

- `Portaria`
- `Memorando Disciplinar`
- `Feito Preliminar`

### Papéis nos processos

| Campo | Tipo | Contexto |
|-------|------|---------|
| `responsavel_id` | FK usuarios | Encarregado (todos os tipos) |
| `escrivao_id` | FK usuarios | Escrivão (procedimentos) |
| `presidente_id` | FK usuarios | Presidente (PAD/CD/CJ/PADE) |
| `interrogante_id` | FK usuarios | Interrogante (PAD/CD/CJ/PADE) |
| `escrivao_processo_id` | FK usuarios | Escrivão do processo formal (PAD/CD/CJ) |
| `motorista_id` | FK usuarios | Motorista responsável (sinistros de trânsito) |
| `nome_pm_id` | FK usuarios | PM envolvido principal |

### PMs envolvidos múltiplos

Tabela `procedimento_pms_envolvidos`:
- Permite N PMs por procedimento (além do `nome_pm_id` principal)
- Cada PM tem `status_pm` próprio: Sindicado, Acusado, Indiciado, Investigado

### Status e solução

- `status_pm`: Sindicado, Acusado, Indiciado, Investigado (TEXT livre)
- `concluido`: BOOLEAN
- `solucao_tipo`: TEXT (ex.: Arquivado, Punido, etc.)
- `penalidade_tipo` + `penalidade_dias`: detalhamento da pena
- `solucao_final`: TEXT livre

### PDF associado (Migration 0006)

- `pdf_arquivo`: BYTEA (binário)
- `pdf_nome`, `pdf_content_type`, `pdf_tamanho`, `pdf_upload_em`
- Limite de 100 MB 🟡 (inferido do frontend — `main.py` não valida tamanho)

### Histórico de encarregados

- `historico_encarregados`: JSON array em coluna TEXT
- Estrutura: `[{encarregado_id, nome, data_substituicao, justificativa}]`

### Algoritmo de natureza do processo (🟢 — `processos_service.py:17`)

```
Se transgressões selecionadas forem de múltiplas naturezas → "Múltiplas"
Se apenas uma natureza → retornar ela (normaliza: media→Média, leve→Leve, grave→Grave)
Se sem transgressões → usar natureza_original
```

### Funções expostas principais

| Função | Descrição |
|--------|-----------|
| `excluir_processo` | Soft delete (ativo = FALSE) + auditoria |
| `obter_estatistica_pads_solucoes` | PADS concluídos agrupados por solução_tipo |
| `obter_estatistica_ipm_indicios` | IPM/IPPM: conta crimes militares (CPM), RDPM e Art.29 |
| `salvar_pdf_processo` | Upload de PDF (base64 → BYTEA) |
| `obter_pdf_processo` | Download de PDF com opção de incluir conteúdo |
| `remover_pdf_processo` | Remove PDF associado |
| *(73 total incluindo main.py)* | CRUD completo, listagem, busca, substituição de encarregado |

### Unique constraint

```sql
UNIQUE (numero, documento_iniciador, ano_instauracao)
```

---

## Módulo 6 — usuarios

**Arquivos:** `app/routers/usuarios.py`, `app/services/usuarios.py`
**Tabela:** `usuarios`

### Funções expostas

| Função | Guard | Descrição |
|--------|-------|-----------|
| `obter_usuario_por_id` | login | Retorna usuário com campo `vinculo_texto` calculado |
| `cadastrar_usuario` | admin | Validações + hash bcrypt + audit |
| `listar_usuarios` | login | Paginado + busca (via `db_manager.get_paginated_users`) |
| `listar_todos_usuarios` | login | Todos ativos, ordena por nome ASC |
| `listar_encarregados_operadores` | login | Usuários com `is_encarregado OR is_operador` |
| `obter_usuario_detalhado` | login | Para formulário de edição |
| `atualizar_usuario` | admin | Valida + update (com ou sem nova senha) |
| `delete_user` | admin | Soft delete (`ativo = FALSE`) |
| `verificar_admin` | — | Retorna bool: `perfil == 'admin'` |
| `obter_estatisticas_usuario` | login | 14 contadores de papel/status |
| `obter_processos_usuario_responsavel` | login | Processos como encarregado |
| `obter_processos_usuario_escrivao` | login | Processos como escrivão |
| `obter_processos_usuario_envolvido` | login | Processos como sindicado/acusado/etc. |

### Validações de cadastro (🟢 CONFIRMADO)

```
tipo_usuario     → deve ser 'Oficial' ou 'Praça'
nome             → mínimo 2 caracteres (após strip)
matricula        → único na tabela
Se is_operador:
  email          → obrigatório, deve conter '@' e '.'
  senha          → obrigatória, mínimo 4 caracteres
  perfil         → obrigatório, deve ser 'admin' ou 'comum'
```

### Regras

- 🟢 Nome armazenado em UPPERCASE
- 🟢 Email normalizado para lowercase
- 🟢 `cadastrar_usuario` usa `db_manager.hash_password` (bcrypt)
- 🟡 `atualizar_usuario` usa SHA-256 para nova senha (inconsistência com criação — use bcrypt na migração)
- 🟢 Soft delete
- 🟢 `vinculo_texto` calculado: "Encarregado / Operador (admin)" etc.
- 🟢 `nome_completo` = posto_graduacao + " " + nome

### Estatísticas de usuário (14 contadores)

```
encarregado_sindicancia, encarregado_pads, encarregado_ipm,
encarregado_feito_preliminar, encarregado_pad, encarregado_pade,
encarregado_cp, encarregado_cd, encarregado_cj, escrivao,
envolvido_sindicado, envolvido_acusado, envolvido_indiciado, envolvido_investigado
```

---

## Módulo 7 — prazos

**Arquivos:** `app/routers/prazos.py`, `app/services/prazos_andamentos.py`, `prazos_andamentos_manager.py`
**Tabela:** `prazos_processo`

### Funções expostas

| Função | Descrição |
|--------|-----------|
| `listar_prazos_processo` | Lista prazos de um processo (via PrazosAndamentosManager) |
| `adicionar_prorrogacao` | Prorroga prazo ativo: `int(dias_prorrogacao)` aplicado |
| `obter_prazos_vencendo` | Prazos nos próximos N dias (padrão 7) |
| `obter_prazos_vencidos` | Prazos já vencidos |
| `obter_dashboard_prazos` | Dados para dashboard |
| `gerar_relatorio_prazos` | Relatório com filtros |
| `concluir_prazo_processo` | Marca prazo como concluído |
| `registrar_andamento_processo` | Registra andamento via manager |

### Algoritmo de cálculo de prazos (🟢 CONFIRMADO — `prazos_andamentos.py:443`)

```python
prazos_base = {
    'SV': 15,    # Sindicância Verificatória
    'SR': 30,    # Sindicância Regular
    'IPM': 40,   # Inquérito Policial Militar
    'FP': 30,    # Feito Preliminar
    'CP': 30,    # Comissão de Processo
    'PAD': 30, 'PADE': 30, 'CD': 30, 'CJ': 30, 'PADS': 30,
    'Feito Preliminar': 15  # quando documento_iniciador == 'Feito Preliminar'
}
# Precedência: documento_iniciador == 'Feito Preliminar' → 15 dias
# Depois: tipo_detalhe
# Default: 30 dias

data_limite = data_recebimento + timedelta(days=prazo_total)
dias_restantes = (data_limite - hoje).days
```

### Status de prazo

| Condição | Status |
|----------|--------|
| `dias_restantes < 0` | `"Vencido há N dias"` |
| `== 0` | `"Vence hoje"` |
| `<= 5` | `"Vence em N dias (URGENTE)"` |
| `<= 10` | `"Vence em N dias (ATENÇÃO)"` |
| `> 10` | `"Vence em N dias"` |

### Algoritmo de prorrogação (🟢 CONFIRMADO — `prazos_andamentos_manager.py:57`)

```
1. Buscar prazo atual (ativo = TRUE) do processo
2. Se não existir → criar prazo inicial automaticamente com base em data_recebimento
3. Nova data_vencimento = data_vencimento_atual + timedelta(dias_prorrogacao)
4. Armazenar: numero_portaria, data_portaria, ordem_prorrogacao
```

---

## Módulo 8 — andamentos

**Arquivos:** `app/routers/andamentos.py`, `app/services/prazos_andamentos.py`
**Armazenamento:** JSONB em `processos_procedimentos.andamentos`

### Funções expostas

| Função | Descrição |
|--------|-----------|
| `adicionar_andamento` | Insere no início da lista (mais recente primeiro) |
| `listar_andamentos` | Lista com normalização de campos |
| `listar_andamentos_processo` | Alias de listar_andamentos |
| `remover_andamento` | Remove por ID da lista JSON |
| `obter_tipos_andamento` | Retorna lista fixa de tipos |
| `calcular_prazo_processo` | Delega para `calcular_prazo_processo()` |

### Estrutura do andamento (🟢 CONFIRMADO)

```json
{
  "id": "uuid",
  "texto": "descrição",
  "data": "YYYY-MM-DD HH:MM:SS",
  "usuario": "Nome ou Sistema"
}
```

### Tipos de andamento (🟢 CONFIRMADO — lista fixa)

Instauração, Distribuição, Citação, Interrogatório, Oitiva de Testemunha, Juntada de Documento, Diligência, Perícia, Manifestação da Defesa, Relatório, Decisão, Recurso, Cumprimento, Arquivamento, Outros

### Compatibilidade de campos

Na leitura, o serviço normaliza chaves alternativas:
```
texto   ← texto | descricao | descricao_andamento | observacoes
usuario ← usuario | usuario_nome | responsavel_nome | responsavel
```

---

## Módulo 9 — indicios

**Arquivos:** `app/routers/indicios.py`, `app/services/indicios.py`
**Tabelas:** `pm_envolvido_indicios`, `pm_envolvido_crimes`, `pm_envolvido_rdpm`, `pm_envolvido_art29`

### Funções expostas

| Função | Descrição |
|--------|-----------|
| `salvar_indicios_pm_envolvido` | Upsert completo: limpa crimes/rdpm/art29 e reinserem |
| `carregar_indicios_pm_envolvido` | Carrega categorias + crimes + rdpm + art29 com JOIN |
| `listar_pms_envolvidos_com_indicios` | Lista PMs do procedimento com resumo quantitativo |
| `remover_indicios_pm_envolvido` | Remove todos os indícios do PM |
| `buscar_crimes_para_indicios` | Busca em `crimes_contravencoes` (ILIKE, LIMIT 50) |
| `buscar_rdpm_para_indicios` | Busca em `transgressoes` (ILIKE + gravidade, LIMIT 50) |
| `buscar_art29_para_indicios` | Busca em `infracoes_estatuto_art29` (ILIKE, LIMIT 50) |
| `obter_categorias_indicios` | 🟢 Escopo confirmado: categorias extensíveis via catálogos administráveis (`questions.md#11`) |

### Estrutura de indícios por PM (🟢 CONFIRMADO)

```
procedimento_pms_envolvidos.id (pm_envolvido_id)
    └── pm_envolvido_indicios.id (pm_indicios_id)
            ├── pm_envolvido_crimes → crimes_contravencoes
            ├── pm_envolvido_rdpm   → transgressoes
            └── pm_envolvido_art29  → infracoes_estatuto_art29
```

### Algoritmo de save (upsert)

```
1. Buscar pm_envolvido_indicios WHERE pm_envolvido_id
2. Se existe: DELETE crimes, rdpm, art29 (via pm_indicios_id)
   Se não existe: INSERT novo registro
3. UPDATE categorias_indicios (JSON) e categoria (primeira categoria)
4. INSERT crimes, rdpm, art29 individualmente
```

---

## Módulo 10 — mapas

**Arquivos:** `app/routers/mapas.py`, `app/services/mapas_relatorios.py`
**Tabela:** `mapas_salvos`

### Funções expostas

| Função | Descrição |
|--------|-----------|
| `gerar_mapa_mensal` | Gera dados do mapa para tipo específico |
| `gerar_mapa_mensal_completo` | Gera dados agregados de todos os tipos |
| `salvar_mapa_mensal` | Persiste mapa com metadata calculada |
| `listar_mapas_salvos` | Lista mapas salvos |
| `obter_mapa_salvo` | Detalhe de mapa salvo |
| `excluir_mapa_salvo` | Exclusão do mapa salvo |
| `obter_tipos_processo_para_mapa` | Lista tipos disponíveis |

### Algoritmo de cálculo de totais na persistência (🟢 — `mapas.py:53`)

```python
if tipo_processo == 'COMPLETO' and isinstance(dados_mapa, dict):
    # dados_mapa = {tipo: {dados: [...], totais: {...}}}
    total_processos = sum(len(tipo_data['dados']) for tipo_data in dados_mapa.values())
    total_concluidos = sum(1 for tipo_data in dados_mapa.values()
                         for p in tipo_data['dados'] if p.get('concluido'))
elif isinstance(dados_mapa, list):
    # dados_mapa = [processos]
    total_processos = len(dados_mapa)
    total_concluidos = sum(1 for p in dados_mapa if p.get('concluido'))
```

---

## Módulo 11 — relatorios

**Arquivos:** `app/routers/relatorios.py`, `app/services/mapas_relatorios.py`
**Biblioteca:** ReportLab 4.0.7

### Funções expostas

| Função | Descrição |
|--------|-----------|
| `gerar_relatorio_anual_pdf` | PDF anual completo (ReportLab) |
| `gerar_relatorio_estatisticas_gerais` | Estatísticas gerais, filtro por ano |
| `gerar_relatorio_processos_por_encarregado` | Agrupado por responsável |
| `gerar_relatorio_processos_por_tipo` | Agrupado por tipo_detalhe |
| `gerar_relatorio_prazos_vencidos` | Processos com prazo vencido (filtro por dias_atras) |
| `exportar_relatorio_csv` | Export em CSV |
| `exportar_relatorio_excel` | Export em Excel |

---

## Módulo 12 — auditorias

**Arquivos:** `app/routers/auditorias.py`, `app/services/auditorias.py`
**Tabela:** `auditoria`

### Funções expostas (todas requerem guard_admin)

| Função | Descrição |
|--------|-----------|
| `listar_auditorias` | Paginado + search (nome usuario, tabela, registro_id) + filtros (operacao, tabela) |
| `obter_auditoria_detalhada` | Detalhe de um registro |
| `obter_auditorias_por_registro` | Histórico de um registro específico |
| `obter_auditorias_por_usuario` | Ações de um usuário (paginado) |
| `obter_estatisticas_auditoria` | Estatísticas por período |

### Operações auditadas

| Operação | Onde |
|----------|------|
| CREATE | cadastro de usuário, crime, transgressão |
| UPDATE | atualização de usuário, crime, transgressão |
| DELETE | desativação de usuário, crime; hard delete de transgressão |

### Algoritmo de paginação (🟢 CONFIRMADO)

```python
total_pages = (total + per_page - 1) // per_page  # arredondamento para cima
offset = (page - 1) * per_page
```

---

## Guards e Segurança

```python
_guard_login() → retorna erro se usuario_logado is None
_guard_admin() → retorna erro se not usuario_logado.get('is_admin')
```

Padrão de uso nos routers:
```python
err = guard_login()
if err:
    return err  # {"sucesso": False, "mensagem": "Sessão expirada..."}
```

---

## Padrão de resposta

```json
// Sucesso
{"sucesso": true, "mensagem": "...", "dados": [...]}
{"success": true, "data": [...]}  // módulos catalogos/rdpm/art29

// Erro
{"sucesso": false, "mensagem": "..."}
{"success": false, "error": "..."}
```

⚠️ Inconsistência: alguns módulos usam `sucesso/mensagem` (pt-br) e outros `success/error` (en). Documentado para uniformização na migração Rust/Tauri.

---

## Problemas identificados para a migração

| Item | Descrição | Impacto |
|------|-----------|---------|
| 🟢 Inconsistência de hash | `cadastrar_usuario` usa bcrypt, `atualizar_usuario` usa SHA-256 | Corrigir na migração Rust/Tauri: `atualizar_usuario` deve usar bcrypt (`questions.md#7`) |
| 🔴 Padrão de resposta duplo | `sucesso/mensagem` vs `success/error` | Frontend JS precisa tratar os dois |
| 🟡 Session global | `usuario_logado` como variável global | Não suporta múltiplos usuários simultâneos |
| 🟡 Andamentos em JSON | `processos_procedimentos.andamentos` é TEXT/JSONB | Sem integridade referencial — tratar no Tauri |
| 🟢 HARD DELETE em transgressoes | Único módulo com DELETE real | Manter hard delete, mas bloquear se houver referência em `pm_envolvido_rdpm` (`questions.md#13`) |
| 🟡 Debug prints | `salvar_indicios_pm_envolvido` tem muitos `print()` de debug | Remover na migração |
| 🟢 pm_envolvido_indicios duplo | Existe `pm_envolvido_indicios` E `procedimentos_indicios_*` | Incluir `procedimentos_indicios_*` na migração Rust conforme decisão do usuário (`questions.md#5`) |
