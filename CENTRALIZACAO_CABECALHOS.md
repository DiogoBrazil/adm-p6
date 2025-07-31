## Centralização dos Cabeçalhos da Tabela

### ✅ Alteração Realizada

#### 📋 HTML (procedure_list.html)
- **Centralização aplicada a todas as colunas do cabeçalho**
- Adicionado `style="text-align:center;"` em todos os elementos `<th>`

### 🎯 Colunas Centralizadas

1. **Tipo** - `style="text-align:center;"` 
2. **Ano** - `style="text-align:center;"`
3. **Número** - `style="text-align:center;"`
4. **SEI** - `style="text-align:center;"`
5. **Encarregado** - `style="text-align:center;"`
6. **PM Envolvido** - `style="text-align:center;"`
7. **Tipo de Envolvimento** - `style="text-align:center;"`
8. **Ações** - `style="text-align:center;"` (já estava centralizada)

### 📄 Código Aplicado

```html
<thead>
    <tr>
        <th width="10%" style="text-align:center;">Tipo</th>
        <th width="8%" style="text-align:center;">Ano</th>
        <th width="12%" style="text-align:center;">Número</th>
        <th width="12%" style="text-align:center;">SEI</th>
        <th width="22%" style="text-align:center;">Encarregado</th>
        <th width="22%" style="text-align:center;">PM Envolvido</th>
        <th width="9%" style="text-align:center;">Tipo de Envolvimento</th>
        <th width="5%" style="text-align:center;">Ações</th>
    </tr>
</thead>
```

### 🎨 Resultado Visual
- **Antes**: Nomes das colunas alinhados à esquerda (padrão)
- **Depois**: Todos os nomes das colunas centralizados no cabeçalho

### ✅ Status
**Concluído** - Todos os nomes das colunas agora estão centralizados no cabeçalho da tabela!

### 🚀 Como Verificar
1. Execute a aplicação: `python main.py`
2. Acesse: `http://localhost:8000/procedure_list.html`
3. Observe que todos os títulos das colunas estão centralizados
