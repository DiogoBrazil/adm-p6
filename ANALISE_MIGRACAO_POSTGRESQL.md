# Análise Completa: Migração SQLite → PostgreSQL

**Data:** 05/11/2025  
**Sistema:** Aplicação de Gestão de Processos Disciplinares  
**Objetivo:** Garantir 100% de compatibilidade funcional após migração

---

## 📋 ÍNDICE

1. [Diferenças Críticas SQLite vs PostgreSQL](#diferenças)
2. [Funcionalidades Analisadas](#funcionalidades)
3. [Problemas Encontrados e Soluções](#problemas)
4. [Checklist de Compatibilidade](#checklist)
5. [Plano de Testes](#testes)
6. [Script de Reset do Banco](#reset)

---

## 🔍 DIFERENÇAS CRÍTICAS SQLite vs PostgreSQL {#diferenças}

### 1. **Tipos de Dados Booleanos**
- **SQLite:** Usa INTEGER (0/1) para booleanos
- **PostgreSQL:** Tipo nativo BOOLEAN (TRUE/FALSE)
- **Status:** ✅ CORRIGIDO
- **Ação:** Todas comparações `= 0` e `= 1` substituídas por `= FALSE` e `= TRUE`

### 2. **Placeholders de Parâmetros**
- **SQLite:** Usa `?` como placeholder
- **PostgreSQL:** Usa `%s` como placeholder
- **Status:** ✅ CORRIGIDO
- **Ação:** 530+ placeholders substituídos em main.py, 87 em prazos_andamentos_manager.py

### 3. **Cursor com Dicionários**
- **SQLite:** `sqlite3.Row` retorna objetos acessíveis por índice e nome
- **PostgreSQL:** `RealDictCursor` retorna apenas dicionários
- **Status:** ⚠️ PARCIALMENTE CORRIGIDO
- **Ação:** Muitos `fetchone()[0]` corrigidos, mas pode haver mais casos

### 4. **Funções de Data**
- **SQLite:** `strftime('%Y', campo)`, `julianday()`
- **PostgreSQL:** `TO_CHAR(campo, 'YYYY')`, `CURRENT_DATE - campo`
- **Status:** ✅ CORRIGIDO
- **Ação:** Todas funções de data substituídas

### 5. **Funções de String**
- **SQLite:** Possui `GLOB` para pattern matching
- **PostgreSQL:** Não tem GLOB, usar LIKE ou expressões regulares
- **Status:** ⚠️ VERIFICAR
- **Ação:** Buscar todas ocorrências de GLOB

### 6. **DEFAULT Values**
- **SQLite:** Aceita DEFAULT 0 ou DEFAULT 1 em BOOLEAN
- **PostgreSQL:** Requer DEFAULT FALSE ou DEFAULT TRUE
- **Status:** ✅ CORRIGIDO
- **Ação:** Tabela usuarios corrigida

---

## 🎯 FUNCIONALIDADES ANALISADAS {#funcionalidades}

### A. **AUTENTICAÇÃO E USUÁRIOS**

#### 1. Login (`fazer_login`)
- ✅ **Funciona:** Login testado com sucesso
- 🔧 **Correções:** Acesso a campos do cursor por nome (dicionário)

#### 2. Cadastro de Usuário (`cadastrar_usuario`)
- ⚠️ **A Testar:** Não testado ainda
- 🔧 **Correções:** Valores booleanos diretos (Python True/False)

#### 3. Listagem de Usuários (`listar_usuarios`, `listar_todos_usuarios`)
- ⚠️ **A Testar:** Não testado ainda
- 🔍 **Verificar:** Paginação, contagem total

#### 4. Atualização de Usuário (`atualizar_usuario`)
- ⚠️ **A Testar:** Não testado ainda

#### 5. Exclusão/Desativação (`delete_user`)
- ⚠️ **A Testar:** Não testado ainda
- 🔍 **Verificar:** SET ativo = FALSE

---

### B. **PROCESSOS/PROCEDIMENTOS**

#### 1. Registro (`registrar_processo`)
- ⚠️ **A Testar:** Cadastro completo não testado
- 🔍 **Verificar:** 
  - Inserção de datas
  - Relacionamentos (responsavel_id, etc)
  - Transações e rollback
  - Validação de UNIQUE constraints

#### 2. Listagem com Prazos (`listar_processos_com_prazos`)
- ⚠️ **Parcialmente Funciona:** Lista carrega, mas filtros quebram
- 🔧 **Correções Aplicadas:**
  - Acesso por dicionário em vez de tupla
  - Substituição de julianday por CURRENT_DATE
  - Conversão de datas para string
- ❌ **Problema Ativo:** IndexError em filtros (placeholders vs parâmetros)

#### 3. Busca de PMs Envolvidos (`buscar_pms_envolvidos`)
- ⚠️ **A Testar:** Retorna 0 PMs (pode ser dados vazios ou erro)

#### 4. Cálculo de Prazos (`calcular_prazo_processo`)
- ⚠️ **A Testar:** Lógica de cálculo não verificada

#### 5. Filtros Avançados
- ❌ **Problema Ativo:** Filtro de "vencidos" causa IndexError
- 🔍 **Verificar:** Todos os tipos de filtro (tipo, origem, encarregado, etc)

---

### C. **ESTATÍSTICAS**

#### 1. Estatísticas do Sistema (`obter_estatisticas`)
- ⚠️ **A Testar:** COUNT(*) queries

#### 2. Estatísticas por Encarregado (`obter_estatisticas_encarregados`)
- ⚠️ **A Testar:** Múltiplas subqueries com COUNT

#### 3. Estatísticas por Tipo de Processo
- `obter_estatistica_pads_solucoes`
- `obter_estatistica_ipm_indicios`
- `obter_estatistica_sr_indicios`
- `obter_top10_transgressoes`
- `obter_ranking_motoristas_sinistros`
- `obter_estatistica_naturezas_apuradas`
- `obter_estatistica_crimes_militares_ipm`
- `obter_estatistica_crimes_comuns`
- ⚠️ **Todas A Testar:** Contagens e agrupamentos

#### 4. Anos Disponíveis (`obter_anos_disponiveis`)
- ⚠️ **A Testar:** DISTINCT com TO_CHAR

---

### D. **BUSCAS E AUTOCOMPLETAR**

#### 1. Buscar Transgressões (`api_buscar_transgressoes`, `buscar_transgressoes`)
- ⚠️ **A Testar:** GLOB vs LIKE
- 🔍 **Verificar:** Linha 392-402 usa GLOB

#### 2. Buscar Infrações Art. 29
- ⚠️ **A Testar:** LIKE queries

#### 3. Buscar Municípios/Distritos
- ⚠️ **A Testar:** LIKE queries

---

### E. **RELATÓRIOS E EXPORTAÇÃO**

#### 1. Gerar PDFs
- ⚠️ **A Testar:** Queries de dados para relatórios
- 🔍 **Verificar:** Formatação de datas nos relatórios

#### 2. Mapas Mensais
- ⚠️ **A Testar:** Agregações por mês/ano

---

### F. **PRAZOS E ANDAMENTOS** (`prazos_andamentos_manager.py`)

#### 1. Adicionar Prazo (`adicionar_prazo`)
- ⚠️ **A Testar:** INSERT com datas

#### 2. Listar Prazos (`listar_prazos_processo`)
- ⚠️ **A Testar:** SELECT com COALESCE

#### 3. Adicionar Andamento (`adicionar_andamento`)
- ⚠️ **A Testar:** INSERT

#### 4. Obter Processos com Prazos Vencidos (`obter_processos_com_prazos_vencidos`)
- ⚠️ **A Testar:** Comparação de datas

---

## 🐛 PROBLEMAS ENCONTRADOS E SOLUÇÕES {#problemas}

### ✅ RESOLVIDOS

1. **Boolean = integer**
   - Erro: `boolean = integer` não existe
   - Solução: Substituir `= 1` por `= TRUE`, `= 0` por `= FALSE`
   - Script: `corrigir_booleanos.py`

2. **Placeholders ?**
   - Erro: Sintaxe inválida
   - Solução: Substituir `?` por `%s`
   - Arquivos: main.py, prazos_andamentos_manager.py

3. **strftime()**
   - Erro: Função não existe
   - Solução: `strftime('%Y', campo)` → `TO_CHAR(campo, 'YYYY')`
   - Script: `corrigir_strftime.py`

4. **fetchone()[0] com RealDictCursor**
   - Erro: KeyError: 0
   - Solução: `fetchone()[0]` → `fetchone()['count']`
   - Script: `corrigir_fetchone.py`

5. **julianday()**
   - Erro: Função não existe
   - Solução: `julianday('now') - julianday(campo)` → `CURRENT_DATE - campo`

6. **Desempacotamento de tupla com dicionário**
   - Erro: KeyError ou ValueError
   - Solução: Acessar por chaves: `processo['id']` em vez de `processo[0]`

### ❌ PROBLEMAS ATIVOS

1. **IndexError em filtros avançados**
   - Localização: `listar_processos_com_prazos` linha 4589
   - Sintoma: `list index out of range` ao aplicar filtro de vencidos
   - Causa Provável: Mismatch entre número de `%s` e parâmetros
   - Debug: Adicionado logging para identificar
   - Status: ⏳ AGUARDANDO DEBUG OUTPUT

### ⚠️ POSSÍVEIS PROBLEMAS NÃO VERIFICADOS

1. **GLOB pattern matching**
   - Localização: Linha 392-402 em busca de transgressões
   - SQLite: `inciso GLOB '[IVX]*'`
   - PostgreSQL: Não tem GLOB, precisa usar SIMILAR TO ou regex
   - Impacto: Ordenação de transgressões pode não funcionar

2. **Acesso por índice numérico em outros locais**
   - Potencial: Podem existir mais `row[0]`, `row[1]` etc.
   - Ação: Fazer busca completa por padrões

3. **Transações não explícitas**
   - SQLite: Autocommit por padrão
   - PostgreSQL: Pode precisar de BEGIN/COMMIT explícitos

4. **CAST e conversões de tipo**
   - Algumas queries podem ter CAST que funciona diferente

---

## ✅ CHECKLIST DE COMPATIBILIDADE {#checklist}

### Fase 1: Correções de Sintaxe (COMPLETO)
- [x] Substituir `?` por `%s`
- [x] Substituir `= 0/1` por `= FALSE/TRUE` 
- [x] Substituir `strftime()` por `TO_CHAR()`
- [x] Substituir `julianday()` por operadores de data
- [x] Corrigir `DEFAULT 0/1` para `DEFAULT FALSE/TRUE`
- [x] Adicionar `RealDictCursor` em todas conexões
- [x] Corrigir acesso a resultados por índice

### Fase 2: Testes de Funcionalidades Básicas (EM ANDAMENTO)
- [x] Login
- [ ] Cadastro de usuário
- [ ] Listagem de usuários
- [x] Listagem de processos (sem filtros)
- [ ] Cadastro de processo
- [ ] Atualização de processo
- [ ] Exclusão de processo

### Fase 3: Testes de Funcionalidades Avançadas (PENDENTE)
- [ ] Filtros avançados (todos os tipos)
- [ ] Buscar PMs envolvidos
- [ ] Cálculo de prazos
- [ ] Estatísticas gerais
- [ ] Estatísticas por encarregado
- [ ] Relatórios PDF
- [ ] Mapas mensais
- [ ] Busca de transgressões
- [ ] Busca de infrações
- [ ] Autocompletar municípios

### Fase 4: Correções Específicas (PENDENTE)
- [ ] Substituir GLOB por SIMILAR TO ou regex
- [ ] Verificar todas queries de data
- [ ] Testar transações e rollback
- [ ] Verificar constraints e validações
- [ ] Testar com dados reais em volume

---

## 🧪 PLANO DE TESTES {#testes}

### 1. Reset e Preparação
```sql
-- Limpar todas tabelas mantendo apenas admin
DELETE FROM processos_procedimentos;
DELETE FROM usuarios WHERE email != 'admin@sistema.com';
-- Resetar outras tabelas conforme necessário
```

### 2. Teste de CRUD Usuários
1. Cadastrar 3 usuários diferentes (Oficial encarregado, Praça encarregado, Praça operador)
2. Listar todos
3. Buscar por nome
4. Atualizar dados
5. Desativar um

### 3. Teste de CRUD Processos
1. Cadastrar IPM
2. Cadastrar Sindicância  
3. Cadastrar PAD
4. Cadastrar Feito Preliminar
5. Listar todos
6. Aplicar cada tipo de filtro
7. Buscar por texto

### 4. Teste de Prazos
1. Processo recente (no prazo)
2. Processo vencido
3. Processo com prorrogação
4. Filtrar por vencidos
5. Filtrar por no prazo

### 5. Teste de Estatísticas
1. Estatísticas gerais do sistema
2. Estatísticas por encarregado
3. Cada tipo de estatística específica
4. Com filtro de ano

### 6. Teste de Relatórios
1. Gerar PDF de processo
2. Gerar mapa mensal
3. Exportar dados

---

## 🔧 SCRIPT DE RESET DO BANCO {#reset}

```python
#!/usr/bin/env python3
"""
Script para resetar banco PostgreSQL mantendo apenas admin
"""

import psycopg2
from db_config import get_pg_connection

def reset_database():
    """Limpa todos os dados exceto usuário admin"""
    conn = get_pg_connection()
    cursor = conn.cursor()
    
    try:
        print("🗑️ Iniciando reset do banco de dados...")
        
        # Desabilitar constraints temporariamente
        cursor.execute("SET session_replication_role = 'replica';")
        
        # Listar todas as tabelas
        cursor.execute("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename != 'usuarios'
        """)
        
        tables = [row[0] for row in cursor.fetchall()]
        
        # Deletar dados de todas as tabelas exceto usuarios
        for table in tables:
            print(f"  Limpando tabela: {table}")
            cursor.execute(f"DELETE FROM {table}")
        
        # Deletar usuários exceto admin
        print("  Limpando usuários (mantendo admin)")
        cursor.execute("DELETE FROM usuarios WHERE email != 'admin@sistema.com'")
        
        # Reabilitar constraints
        cursor.execute("SET session_replication_role = 'origin';")
        
        conn.commit()
        print("✅ Reset concluído com sucesso!")
        
        # Mostrar contagens
        cursor.execute("SELECT COUNT(*) FROM usuarios")
        print(f"📊 Usuários restantes: {cursor.fetchone()[0]}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Erro ao resetar banco: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    reset_database()
```

---

## 📝 PRÓXIMOS PASSOS

1. **IMEDIATO:** Resolver IndexError em filtros (aguardando debug output)
2. **CURTO PRAZO:** 
   - Substituir GLOB por SIMILAR TO
   - Fazer busca exaustiva por `row[índice]`
   - Testar cada funcionalidade do checklist
3. **MÉDIO PRAZO:**
   - Reset do banco
   - Testes completos com dados novos
   - Documentar todas as mudanças de comportamento

---

**Última atualização:** 05/11/2025 - Análise inicial completa
