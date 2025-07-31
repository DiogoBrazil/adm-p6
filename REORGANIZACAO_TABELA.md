## Reorganização da Tabela de Procedimentos

### Alterações Realizadas

#### ✅ 1. HTML (procedure_list.html)
- **Cabeçalho da tabela reorganizado**
- Coluna "Tipo" movida para a **primeira posição**
- Ajuste das larguras das colunas:
  - Tipo: 10%
  - Ano: 8% 
  - Número: 12%
  - SEI: 12%
  - Encarregado: 22%
  - PM Envolvido: 22%
  - Tipo de Envolvimento: 9%
  - Ações: 5%

#### ✅ 2. JavaScript (procedure_list.js)
- **Reorganização das células** na função `exibirProcedimentos()`
- Primeira célula agora exibe: `procedimento.tipo_detalhe`
- Ordem das colunas na renderização:
  1. **Tipo** (`tipo_detalhe`)
  2. **Ano** (extraído da data)
  3. **Número** (número do documento)
  4. **SEI** (processo_sei)
  5. **Encarregado** (responsável completo)
  6. **PM Envolvido** (nome PM completo)
  7. **Tipo de Envolvimento** (status_pm)
  8. **Ações** (botões editar/excluir)

### ✅ Funcionalidades Mantidas
- **Busca por tipo**: A função de busca já incluía `tipo_detalhe`
- **Responsividade**: Larguras ajustadas proporcionalmente
- **Ordenação**: Mantida a ordenação existente
- **Estilização**: Mantidos todos os estilos existentes

### 🎯 Resultado
A tabela agora exibe a coluna **"Tipo"** como primeira coluna, facilitando a identificação rápida do tipo de procedimento (PADS, IPM, SR, etc.) logo na primeira visualização.

### 📋 Como Testar
1. Execute a aplicação: `python main.py`
2. Acesse: `http://localhost:8000/procedure_list.html`
3. Verifique se a coluna "Tipo" aparece primeiro
4. Teste a busca por tipo de procedimento

### ✅ Status
**Concluído** - Reorganização implementada com sucesso!
