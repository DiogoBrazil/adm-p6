# Atualização das Regras de Numeração - Sistema ADM-P6

**Data:** 05 de agosto de 2025  
**Versão:** 2.1

## 📋 Resumo da Alteração

Foi implementada uma melhoria nas regras de numeração para permitir que **portarias de diferentes tipos de procedimento** possam usar o mesmo número no mesmo ano e local.

## 🔄 Mudanças Implementadas

### 1. **Migração do Banco de Dados**
- **Arquivo:** `migrar_constraint_tipo_procedimento.py`
- **Constraints atualizadas:**
  ```sql
  -- Antes:
  UNIQUE(numero, documento_iniciador, ano_instauracao, local_origem)
  UNIQUE(numero_controle, documento_iniciador, ano_instauracao, local_origem)
  
  -- Depois:
  UNIQUE(numero, documento_iniciador, tipo_detalhe, ano_instauracao, local_origem)
  UNIQUE(numero_controle, documento_iniciador, tipo_detalhe, ano_instauracao, local_origem)
  ```

### 2. **Backend (main.py)**
- Validações atualizadas nas funções `registrar_processo()` e `atualizar_processo()`
- Inclusão do `tipo_detalhe` nas consultas de verificação de conflitos
- Mensagens de erro mais específicas incluindo o tipo do procedimento

### 3. **Frontend (procedure_form.js)**
- Função `validarNumeroDuplicado()` atualizada para incluir `tipo_detalhe`
- Mensagens de erro melhoradas no cliente

## ✅ Cenários Agora PERMITIDOS

### **Portarias de Diferentes Tipos de Procedimento:**
- ✅ Portaria 100/IPM/2025/7ºBPM e Portaria 100/SR/2025/7ºBPM
- ✅ Portaria 100/IPM/2025/7ºBPM e Portaria 100/SV/2025/7ºBPM  
- ✅ Portaria 100/IPM/2025/7ºBPM e Portaria 100/AO/2025/7ºBPM
- ✅ Portaria 100/IPM/2025/7ºBPM e Portaria 100/CP/2025/7ºBPM

### **Memorandos de Diferentes Tipos de Processo:**
- ✅ Memorando 200/PADS/2025/7ºBPM e Memorando 200/PAD/2025/7ºBPM
- ✅ Memorando 200/PADS/2025/7ºBPM e Memorando 200/CD/2025/7ºBPM
- ✅ Memorando 200/PADS/2025/7ºBPM e Memorando 200/CJ/2025/7ºBPM

## ❌ Cenários Ainda BLOQUEADOS

### **Mesmo Tipo/Número/Ano/Local:**
- ❌ Duas Portarias IPM 100/2025/7ºBPM
- ❌ Dois Memorandos PADS 200/2025/7ºBPM

### **Número de Controle Duplicado:**
- ❌ Dois IPMs com controle "IPM-001/2025" no mesmo local
- ❌ Dois PADS com controle "PADS-050/2025" no mesmo local

## 🎯 Benefícios

1. **Maior Flexibilidade:** Permite reutilização de números de portaria para diferentes procedimentos
2. **Organização Melhorada:** Cada tipo de procedimento pode ter sua própria sequência numérica
3. **Compatibilidade:** Mantém todas as validações de segurança existentes
4. **Transparência:** Mensagens de erro mais claras indicando o tipo específico

## 🧪 Testes Realizados

- ✅ Migração do banco sem perda de dados (32 registros preservados)
- ✅ Constraints funcionando corretamente 
- ✅ Validações no backend e frontend
- ✅ Mensagens de erro adequadas
- ✅ Compatibilidade com dados existentes

## 📝 Arquivos Modificados

### Novos Arquivos:
- `migrar_constraint_tipo_procedimento.py` - Script de migração
- `testar_novas_regras_numeracao.py` - Testes das novas regras
- `ATUALIZACAO_REGRAS_NUMERACAO.md` - Esta documentação

### Arquivos Modificados:
- `main.py` - Validações do backend
- `web/static/js/procedure_form.js` - Validações do frontend

## 🔒 Backup

Backup automático criado antes da migração:
- `backups/pre_tipo_procedimento_constraint_20250805_165602.db`

---

**⚠️ Importante:** Esta atualização mantém total compatibilidade com os dados existentes e não afeta nenhum processo/procedimento já cadastrado no sistema.
