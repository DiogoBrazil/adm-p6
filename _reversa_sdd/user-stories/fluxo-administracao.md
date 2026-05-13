# User Stories — Fluxo de Administração

## Contexto

Administradores do SJD Gestor gerenciam o cadastro de usuários, catálogos de referência (crimes, transgressões, Art.29) e têm acesso ao log de auditoria do sistema.

## US-A01 — Cadastrar operador do sistema

**Como** administrador  
**Quero** cadastrar um novo operador com acesso ao sistema  
**Para** dar ao PM acesso às funcionalidades do SJD Gestor

**Critérios de aceite:**
- Informo: tipo (Oficial/Praça), posto/graduação, nome, matrícula, email, senha, perfil (admin/comum)
- Matrícula deve ser única
- Email deve ser único e válido
- Nome é armazenado em maiúsculas
- Email é armazenado em minúsculas
- Senha mínima de 4 caracteres; armazenada como hash
- Auditoria CREATE registrada

---

## US-A02 — Gerenciar encarregados

**Como** administrador  
**Quero** marcar um PM como encarregado no sistema  
**Para** que ele possa ser selecionado como responsável de processos

**Critérios de aceite:**
- Um PM pode ser encarregado sem ser operador (sem acesso ao sistema)
- Um PM pode ser ambos (encarregado + operador)
- `is_encarregado=TRUE` aparece na lista de encarregados disponíveis para processos

---

## US-A03 — Consultar perfil e estatísticas de um PM

**Como** operador logado  
**Quero** visualizar o perfil completo de um PM  
**Para** saber em quantos processos ele está envolvido e em que papel

**Critérios de aceite:**
- Vejo: posto, matrícula, nome, vínculo (encarregado/operador/sem vínculo)
- Vejo contagens por papel: sindicâncias como encarregado, PADs, IPMs, processos como escrivão
- Vejo contagens por envolvimento: sindicado, acusado, indiciado, investigado

---

## US-A04 — Manter catálogo RDPM

**Como** administrador  
**Quero** gerenciar as transgressões do RDPM no catálogo  
**Para** manter a lista de infrações atualizada para seleção nos processos

**Critérios de aceite:**
- Posso criar nova transgressão informando: artigo, inciso, gravidade (leve/média/grave), texto
- Artigo + inciso devem ser únicos entre ativos
- Posso editar descrição e gravidade de uma transgressão existente
- Posso desativar (soft delete) uma transgressão
- **Exceção:** remoção definitiva (hard delete) disponível para exclusão real de registros errados

---

## US-A05 — Manter catálogo Art.29

**Como** administrador  
**Quero** gerenciar as infrações do Art.29 do Estatuto  
**Para** que possam ser selecionadas como indícios nos procedimentos

**Critérios de aceite:**
- Posso criar nova infração informando: inciso (ex.: "I", "II", "XXIII"), texto
- Inciso deve ser único entre ativos
- Incisos romanos são ordenados por comprimento; demais ao final
- Posso editar e desativar (soft delete)

---

## US-A06 — Consultar log de auditoria

**Como** administrador  
**Quero** consultar o histórico de operações do sistema  
**Para** investigar alterações indevidas e rastrear responsabilidades

**Critérios de aceite:**
- Vejo todas as operações registradas (CREATE/UPDATE/DELETE) com timestamp
- Posso filtrar por tipo de operação e por tabela
- Posso buscar por nome do usuário, tabela ou ID do registro
- Posso ver o histórico completo de um processo específico
- Posso ver todas as ações de um operador específico
- Operações do sistema (sem usuário) aparecem como "Sistema"

---

## US-A07 — Fazer login

**Como** operador do sistema  
**Quero** autenticar com email e senha  
**Para** acessar as funcionalidades do SJD Gestor

**Critérios de aceite:**
- Informo email e senha
- Sistema verifica hash bcrypt (com upgrade automático de hash legado SHA-256)
- Em caso de sucesso: sessão criada com nome, perfil e ID
- Em caso de falha: mensagem de erro genérica (sem indicar qual campo está errado)
- Sessão persiste apenas enquanto o aplicativo está aberto (em memória)

---

## US-A08 — Gerar relatório anual

**Como** gestor  
**Quero** gerar o relatório anual de processos e procedimentos  
**Para** ter um documento PDF formal com estatísticas do ano

**Critérios de aceite:**
- Seleciono o ano
- O sistema gera PDF com: total de processos, total de procedimentos, por tipo, concluídos vs em andamento
- O PDF é retornado como base64 para download pelo frontend
