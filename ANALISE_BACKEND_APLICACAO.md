# 🔧 ANÁLISE COMPLETA DO BACKEND DA APLICAÇÃO

## 📋 Visão Geral

O backend é uma aplicação **Python** que utiliza o framework **Eel** para criar uma aplicação desktop com interface web. É um sistema de gestão de processos e procedimentos disciplinares da Polícia Militar.

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

#### Backend Principal
- **Python 3.x**: Linguagem principal
- **Eel 0.18.2**: Framework para aplicações desktop com HTML/JS
- **SQLite3**: Banco de dados embarcado
- **Bottle 0.13.4**: Micro-framework web (usado pelo Eel)
- **Gevent/WebSocket**: Comunicação em tempo real

#### Bibliotecas Auxiliares
- **hashlib**: Criptografia de senhas (SHA-256)
- **uuid**: Geração de IDs únicos
- **datetime/timedelta**: Manipulação de datas e prazos
- **json**: Serialização de dados
- **bcrypt**: Criptografia adicional (nas dependências)

---

## 📁 Estrutura de Arquivos

### Arquivos Principais
```
/home/diogo/DEV/aulas/test-eel/
├── main.py                      # Arquivo principal (4801 linhas)
├── prazos_andamentos_manager.py # Gerenciador de prazos
├── usuarios.db                  # Banco de dados SQLite
├── requirements.txt             # Dependências Python
└── web/                        # Frontend (HTML/CSS/JS)
    ├── login.html
    ├── dashboard.html
    └── static/
        ├── css/
        └── js/
```

### Módulos do Sistema

#### 1. **main.py** - Módulo Principal
Contém toda a lógica principal do backend em um único arquivo monolítico:

##### Classes Principais:
- **`DatabaseManager`**: Gerencia conexões e operações do banco de dados
  - Inicialização do banco
  - CRUD de usuários (operadores e encarregados)
  - Autenticação e autorização
  - Estatísticas do sistema

##### Funcionalidades Expostas (@eel.expose):
Total de **74 funções expostas** para o frontend, organizadas em categorias:

###### **Autenticação (3 funções)**
- `fazer_login()`: Autenticação de usuários
- `obter_usuario_logado()`: Verifica sessão atual
- `fazer_logout()`: Encerra sessão

###### **Gestão de Usuários (8 funções)**
- `cadastrar_usuario()`: Cria operador ou encarregado
- `atualizar_usuario()`: Edita dados do usuário
- `excluir_usuario()`: Soft delete de usuário
- `obter_usuario_por_id()`: Busca usuário específico
- `listar_pagina_usuarios()`: Lista paginada
- `obter_estatisticas()`: Dashboard de estatísticas
- `get_user_statistics()`: Estatísticas por usuário
- `obter_estatisticas_usuario()`: Dados detalhados

###### **Gestão de Processos/Procedimentos (15 funções principais)**
- `adicionar_processo()`: Cria novo processo/procedimento
- `listar_processos()`: Lista todos os processos
- `obter_processo()`: Busca processo específico
- `atualizar_processo()`: Edita processo existente
- `excluir_processo()`: Soft delete de processo
- `listar_processos_usuario()`: Processos por usuário
- `listar_processos_paginados()`: Lista com paginação
- `buscar_pms_envolvidos()`: PMs de um procedimento
- `adicionar_multiplos_pms()`: Adiciona vários PMs
- `remover_pm_envolvido()`: Remove PM do procedimento
- `atualizar_status_pm()`: Atualiza status do PM
- `concluir_processo()`: Finaliza processo
- `reabrir_processo()`: Reabre processo concluído
- `salvar_solucao_final()`: Registra solução
- `salvar_indicios_pm()`: Salva indícios por PM

###### **Gestão de Prazos (8 funções)**
- `adicionar_prazo_inicial()`: Define prazo inicial
- `prorrogar_prazo()`: Prorroga prazo existente
- `listar_prazos_processo()`: Histórico de prazos
- `obter_prazo_ativo()`: Prazo vigente
- `listar_processos_com_prazos()`: Processos e seus prazos
- `calcular_dias_restantes()`: Calcula vencimento
- `cancelar_prazo()`: Cancela prazo ativo
- `obter_historico_prazos()`: Timeline de prazos

###### **Gestão de Infrações (12 funções)**
- `listar_crimes_contravencoes()`: Lista crimes/contravenções
- `adicionar_crime_contravencao()`: Adiciona crime
- `atualizar_crime_contravencao()`: Edita crime
- `excluir_crime_contravencao()`: Remove crime
- `buscar_crimes_para_indicios()`: Busca para seleção
- `buscar_transgressoes()`: Lista transgressões RDPM
- `buscar_rdpm_para_indicios()`: RDPM para seleção
- `buscar_infracoes_art29()`: Art. 29 do Estatuto
- `buscar_art29_para_indicios()`: Art. 29 para seleção
- `salvar_indicios_procedimento()`: Salva indícios gerais
- `obter_indicios_procedimento()`: Busca indícios
- `obter_indicios_pm_envolvido()`: Indícios por PM

###### **Buscas e Filtros (6 funções)**
- `buscar_encarregados()`: Autocomplete encarregados
- `buscar_operadores()`: Autocomplete operadores
- `buscar_escrivaes()`: Autocomplete escrivães
- `buscar_municipios_distritos()`: Municípios de RO
- `listar_processos_filtrados()`: Filtros avançados
- `exportar_processos()`: Exportação de dados

###### **Rotas HTTP (4 endpoints Bottle)**
- `/buscar_transgressoes`: API REST para transgressões
- `/buscar_infracoes_art29`: API REST para Art. 29
- `/buscar_municipios_distritos`: API REST para municípios
- `/api/crimes`: API REST para crimes (não implementada)

#### 2. **prazos_andamentos_manager.py** - Gerenciador de Prazos
Classe especializada para gestão de prazos e andamentos:

##### Classe `PrazosAndamentosManager`:
- **Prazos**:
  - `adicionar_prazo_inicial()`: Prazo inicial do processo
  - `prorrogar_prazo()`: Prorrogações com portarias
  - `listar_prazos_processo()`: Histórico completo
  - `obter_prazo_ativo()`: Prazo vigente
  - `calcular_vencimento()`: Cálculo de dias
  
- **Andamentos**:
  - `adicionar_andamento()`: Novo andamento
  - `listar_andamentos()`: Histórico de movimentações
  - `obter_ultimo_andamento()`: Último movimento

- **Regras de Negócio**:
  - Prazos automáticos por tipo de documento
  - Cálculo de prorrogações sequenciais
  - Controle de portarias de prorrogação
  - Ordem de prorrogações

---

## 🔄 Fluxo de Dados

### 1. **Inicialização**
```python
1. DatabaseManager() → Cria/conecta ao banco SQLite
2. init_database() → Cria tabelas se não existirem
3. create_admin_user() → Cria usuário admin padrão
4. PrazosAndamentosManager() → Inicializa gerenciador
5. eel.init('web') → Configura frontend
6. eel.start() → Inicia aplicação
```

### 2. **Comunicação Frontend-Backend**

#### Via Eel (WebSocket)
```javascript
// Frontend chama função Python
await eel.fazer_login(email, senha)();

// Backend responde
return {"sucesso": true, "usuario": {...}}
```

#### Via HTTP (Bottle Routes)
```javascript
// Frontend faz requisição HTTP
fetch('/buscar_transgressoes?gravidade=leve')
  .then(res => res.json())
  .then(data => console.log(data));
```

### 3. **Sessão e Autenticação**
- **Sessão Global**: Variável `usuario_logado` mantém usuário atual
- **Sem tokens**: Autenticação baseada em sessão Python
- **Senha hash**: SHA-256 para armazenamento

---

## 📊 Funcionalidades Principais

### 1. **Sistema de Autenticação**
- Login com email/senha
- Dois tipos de usuários: Operadores e Encarregados
- Perfis: admin, comum, encarregado
- Soft delete (campo `ativo`)

### 2. **Gestão de Processos Completa**
- **Tipos**: Processos (PAD, PCD) e Procedimentos (IPM, Sindicância)
- **Documentos**: Portaria, Memorando, Feito Preliminar
- **Responsáveis**: Encarregado + Escrivão
- **PMs Envolvidos**: Múltiplos por procedimento
- **Status**: Acusado, Indiciado, Sindicado, Investigado

### 3. **Sistema de Prazos Inteligente**
- **Prazos Automáticos**:
  - AO/SV: 15 dias
  - SR/FP/CP: 30 dias
  - IPM: 40 dias
  - PAD/PADS/CD/CJ: 30 dias
- **Prorrogações**: Com portarias e ordem sequencial
- **Cálculo**: Dias úteis/corridos configuráveis

### 4. **Catalogação de Infrações**
- **93 Transgressões RDPM**: Leve, Média, Grave
- **22 Crimes/Contravenções**: Código Penal
- **21 Infrações Art. 29**: Estatuto Militar
- **Sistema de Indícios**: Por procedimento e por PM

### 5. **Conclusão de Processos**
- Solução final detalhada
- Tipos de penalidade
- Dias de punição
- Categorias de indícios
- Reabertura possível

---

## 🔐 Segurança

### Implementações Atuais
1. **Senhas**: Hash SHA-256
2. **Soft Delete**: Dados nunca excluídos fisicamente
3. **Auditoria**: Tabela de logs com triggers automáticos
4. **Validações**: Em Python antes de salvar no banco
5. **SQL Injection**: Uso de prepared statements

### Vulnerabilidades Identificadas
1. **Sessão Global**: Única instância, sem multi-usuário
2. **Sem HTTPS**: Comunicação não criptografada
3. **SHA-256 simples**: Sem salt nas senhas
4. **XSS**: Possível no frontend (validar inputs)
5. **CSRF**: Sem tokens de proteção

---

## 📈 Performance e Otimização

### Pontos Fortes
- **72 índices** no banco para queries rápidas
- **Paginação** implementada para listas grandes
- **Cache natural** do SQLite
- **Queries otimizadas** com JOINs apropriados

### Pontos de Melhoria
- **Arquivo monolítico**: main.py com 4801 linhas
- **N+1 queries**: Algumas funções fazem múltiplas consultas
- **Sem cache**: Dados não são cacheados em memória
- **Sem pool**: Conexões criadas a cada operação

---

## 🚀 Escalabilidade

### Limitações Atuais
1. **Desktop Only**: Não é web multi-usuário
2. **SQLite**: Limitado para concorrência
3. **Monolítico**: Dificulta manutenção
4. **Sem API REST completa**: Apenas 4 endpoints

### Sugestões de Evolução
1. **Refatoração**:
   - Separar em módulos (auth, users, processes, etc.)
   - Implementar padrão MVC ou similar
   - Criar camada de serviços

2. **Migração para Web**:
   - FastAPI ou Flask para API REST
   - PostgreSQL para produção
   - JWT para autenticação
   - Frontend React/Vue separado

3. **Melhorias de Código**:
   - Type hints em todas as funções
   - Docstrings completas
   - Testes unitários
   - Logging estruturado

---

## 🎯 Conclusão

O backend é **funcional e completo** para um sistema desktop monousuário, com todas as funcionalidades necessárias para gestão de processos disciplinares. 

### ✅ Pontos Positivos
- Funcionalidade completa e robusta
- Banco bem estruturado e normalizado
- Regras de negócio implementadas
- Interface intuitiva com Eel

### ⚠️ Pontos de Atenção
- Arquitetura monolítica dificulta manutenção
- Limitações para uso multi-usuário
- Segurança básica necessita melhorias
- Performance pode degradar com volume

### 🔄 Recomendações Prioritárias
1. **Curto Prazo**: Refatorar main.py em módulos
2. **Médio Prazo**: Implementar testes e logging
3. **Longo Prazo**: Migrar para arquitetura web

O sistema está **pronto para uso em produção** como aplicação desktop, mas necessita evolução para escalar como sistema web multi-usuário.
