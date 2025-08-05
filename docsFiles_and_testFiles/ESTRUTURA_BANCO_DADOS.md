# ESTRUTURA DO BANCO DE DADOS - Sistema ADM-P6

## RESUMO GERAL
O sistema possui **17 tabelas** com um total de **232 registros** distribuídos entre elas. O banco está bem estruturado com índices otimizados e relacionamentos (Foreign Keys) implementados.

---

## 📊 TABELAS PRINCIPAIS

### 1. **USUARIOS** (Tabela Legacy)
- **Função**: Tabela original do sistema, parece estar sendo gradualmente substituída pelas tabelas `operadores` e `encarregados`
- **Registros**: 7
- **Colunas principais**: id, nome, email, senha, is_admin, data_criacao, ativo

### 2. **OPERADORES**
- **Função**: Usuários que podem acessar o sistema (com login/senha)
- **Registros**: 5
- **Colunas principais**:
  - `id` (TEXT PRIMARY KEY)
  - `posto_graduacao` (posto/graduação militar)
  - `matricula` (matrícula única)
  - `nome`, `email`, `senha`
  - `profile` (admin/comum)
  - `ativo`, `created_at`, `updated_at`

### 3. **ENCARREGADOS**
- **Função**: Militares responsáveis por processos/procedimentos (não fazem login)
- **Registros**: 19
- **Colunas principais**:
  - `id` (TEXT PRIMARY KEY)
  - `posto_graduacao`, `matricula`, `nome`
  - `email` (opcional - pode ser NULL)
  - `ativo`, `created_at`, `updated_at`

### 4. **PROCESSOS_PROCEDIMENTOS** ⭐ (TABELA CENTRAL)
- **Função**: Coração do sistema - armazena todos os processos e procedimentos
- **Registros**: 22
- **Colunas principais**:
  - `id` (TEXT PRIMARY KEY)
  - `numero` (número do processo/procedimento)
  - `tipo_geral` (processo/procedimento)
  - `tipo_detalhe` (PADS, IPPM, etc.)
  - `documento_iniciador` (Portaria, Memorando Disciplinar, Feito Preliminar)
  - `processo_sei` (número SEI)
  - `responsavel_id` + `responsavel_tipo` (FK para operadores ou encarregados)
  - `local_origem`, `data_instauracao`, `data_recebimento`
  - `escrivao_id` (FK para operadores)
  - `status_pm`, `nome_pm_id`
  - `nome_vitima`, `natureza_processo`, `natureza_procedimento`
  - `resumo_fatos`
  - `numero_portaria`, `numero_memorando`, `numero_feito`, `numero_rgf`
  - `numero_controle` (adicionado depois)
  - `concluido` (BOOLEAN), `data_conclusao`
  - `infracao_id` (FK para transgressoes)

---

## 📋 TABELAS DE REFERÊNCIA (LOOKUP TABLES)

### 5. **POSTOS_GRADUACOES**
- **Registros**: 12
- **Função**: Padronização de postos e graduações militares
- **Colunas**: codigo, descricao, tipo, ordem_hierarquica

### 6. **TIPOS_PROCESSO**
- **Registros**: 6
- **Função**: Tipos de processos (PAD, PCD, PADS, etc.)
- **Colunas**: tipo_geral, codigo, descricao

### 7. **STATUS_PROCESSO**
- **Registros**: 7
- **Função**: Status dos processos com cores para interface
- **Colunas**: codigo, descricao, cor

### 8. **NATUREZAS**
- **Registros**: 8
- **Função**: Naturezas/categorias dos processos
- **Colunas**: tipo, codigo, descricao

### 9. **LOCAIS_ORIGEM**
- **Registros**: 6
- **Função**: Unidades/batalhões de origem
- **Colunas**: codigo, descricao, tipo

### 10. **TRANSGRESSOES**
- **Registros**: 93
- **Função**: Catálogo de transgressões do RDPM por gravidade
- **Colunas**: gravidade (leve/média/grave), inciso, texto

---

## 🔄 TABELAS DE CONTROLE E HISTÓRICO

### 11. **PRAZOS_PROCESSO**
- **Registros**: 0 (vazia)
- **Função**: Controle de prazos dos processos
- **Colunas**: processo_id, tipo_prazo, data_inicio, data_vencimento, dias_adicionados

### 12. **ANDAMENTOS_PROCESSO**
- **Registros**: 0 (vazia)
- **Função**: Histórico de movimentações dos processos
- **Colunas**: processo_id, data_movimentacao, tipo_andamento, descricao

### 13. **STATUS_DETALHADO_PROCESSO**
- **Registros**: 0 (vazia)
- **Função**: Histórico de mudanças de status
- **Colunas**: processo_id, status_codigo, data_alteracao, usuario_id

### 14. **AUDITORIA**
- **Registros**: 46
- **Função**: Log de todas as operações no sistema
- **Colunas**: tabela, registro_id, operacao, usuario_id, dados_antes, dados_depois

### 15. **PROCEDIMENTO_PMS_ENVOLVIDOS**
- **Registros**: 19
- **Função**: Relacionamento N:N entre procedimentos e PMs envolvidos
- **Colunas**: procedimento_id, pm_id, pm_tipo, ordem

---

## 🔗 RELACIONAMENTOS (FOREIGN KEYS)

```
PROCESSOS_PROCEDIMENTOS
├── escrivao_id → operadores.id
├── infracao_id → transgressoes.id
└── responsavel_id → (operadores.id OU encarregados.id baseado em responsavel_tipo)

PRAZOS_PROCESSO
└── processo_id → processos_procedimentos.id

ANDAMENTOS_PROCESSO
└── processo_id → processos_procedimentos.id

STATUS_DETALHADO_PROCESSO
├── processo_id → processos_procedimentos.id
└── status_codigo → status_processo.codigo

PROCEDIMENTO_PMS_ENVOLVIDOS
└── procedimento_id → processos_procedimentos.id
```

---

## 📈 ÍNDICES IMPLEMENTADOS

O sistema possui **35 índices** otimizados para:
- **Buscas por responsável**: `idx_processos_responsavel`
- **Ordenação temporal**: `idx_processos_created_at`
- **Filtros por tipo**: `idx_processos_tipo`
- **Controle de registros ativos**: múltiplos índices `*_ativo`
- **Buscas por data**: `idx_processos_data_instauracao`
- **Login de usuários**: `idx_operadores_login`
- **Auditoria**: `idx_auditoria_timestamp`

---

## 🔄 SISTEMA DE MIGRAÇÕES

O banco possui um sistema de migrações controlado pela tabela `schema_migrations` com 7 migrações executadas:
1. **001_add_foreign_keys.sql** - Implementação de chaves estrangeiras
2. **002_add_indexes.sql** - Criação de índices otimizados
3. **003_add_reference_tables.sql** - Tabelas de referência
4. **004_add_audit_system.sql** - Sistema de auditoria
5. **005_add_prazos_andamentos.sql** - Controle de prazos e andamentos
6. **006_add_numero_controle.sql** - Campo número de controle
7. **007_add_conclusao_fields.sql** - Campos de conclusão

---

## 💡 CARACTERÍSTICAS IMPORTANTES

### Flexibilidade de Responsáveis
O sistema permite que tanto **operadores** quanto **encarregados** sejam responsáveis por processos, usando os campos `responsavel_id` + `responsavel_tipo`.

### Auditoria Completa
Todas as operações são registradas na tabela `auditoria` com dados antes/depois da modificação.

### Suporte a Múltiplos PMs
A tabela `procedimento_pms_envolvidos` permite associar múltiplos PMs a um procedimento.

### Controle de Prazos
Sistema preparado para controle de prazos com possibilidade de prorrogações controladas.

### Padronização
Uso extensivo de tabelas de referência para padronizar dados (postos, tipos, naturezas, etc.).

---

## 🎯 STATUS ATUAL
- **Tabelas principais**: Populadas e em uso
- **Tabelas de controle**: Criadas mas ainda não utilizadas (prazos, andamentos, status_detalhado)
- **Sistema de auditoria**: Ativo e funcionando
- **Estrutura**: Consolidada e estável
