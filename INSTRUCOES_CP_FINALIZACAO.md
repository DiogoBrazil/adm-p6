# ✅ FINALIZAÇÃO DA IMPLEMENTAÇÃO DE CARTA PRECATÓRIA (CP)

## 📊 STATUS ATUAL

### ✅ CONCLUÍDO:
1. **Migração do Banco** - `025_add_carta_precatoria_fields.sql` 
   - Colunas criadas: `unidade_deprecada`, `deprecante`, `pessoas_inquiridas`
   
2. **Backend (main.py)**
   - Parâmetros adicionados em `registrar_processo()`
   - Parâmetros adicionados em `atualizar_processo()`
   - INSERTs e UPDATEs atualizados

3. **Frontend HTML (procedure_form.html)**
   - Campo "Unidade onde foi deprecada" (antes de "Unidade onde foi instaurado")
   - Campo "Deprecante" (após "Local onde ocorreram os fatos")
   - Campo "Pessoas a serem inquiridas" (após grupo de PMs)
   - IDs corrigidos: `nome_vitima_group`, `natureza_procedimento_group`

### 🔧 FALTA IMPLEMENTAR NO JAVASCRIPT:

#### 1. Adicionar ao arquivo `procedure_form.js` (no início do arquivo):

```javascript
// ============================================
// FUNÇÕES PARA CARTA PRECATÓRIA (CP)
// ============================================

let pessoasInquiridasCount = 1;

function adicionarPessoaInquirida() {
    pessoasInquiridasCount++;
    const container = document.getElementById('pessoas_inquiridas_list');
    
    const novaLinha = document.createElement('div');
    novaLinha.className = 'pessoa-inquirida-item mb-2 d-flex align-items-center';
    novaLinha.id = `pessoa_inquirida_${pessoasInquiridasCount}`;
    
    novaLinha.innerHTML = `
        <input type="text" 
               class="form-control pessoa-inquirida-input" 
               placeholder="Digite o nome da pessoa a ser inquirida"
               id="pessoa_inquirida_input_${pessoasInquiridasCount}"
               style="flex: 1;">
        <button type="button" 
                class="btn btn-sm btn-danger ms-2" 
                onclick="removerPessoaInquirida(${pessoasInquiridasCount})"
                title="Remover"
                style="margin-left: 8px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(novaLinha);
}

function removerPessoaInquirida(id) {
    const elemento = document.getElementById(`pessoa_inquirida_${id}`);
    if (elemento) {
        elemento.remove();
    }
}

function coletarPessoasInquiridas() {
    const inputs = document.querySelectorAll('.pessoa-inquirida-input');
    const pessoas = [];
    
    inputs.forEach(input => {
        const valor = input.value.trim();
        if (valor) {
            pessoas.push(valor);
        }
    });
    
    return JSON.stringify(pessoas);
}

function ajustarCamposCartaPrecatoria(tipoProcedimento) {
    const isCP = (tipoProcedimento === 'CP');
    
    console.log('Ajustando campos para CP:', isCP);
    
    // Campos ESPECÍFICOS de CP
    const camposCP = {
        'unidade_deprecada_group': isCP,
        'deprecante_group': isCP,
        'pessoas_inquiridas_container': isCP
    };
    
    // Campos que NÃO devem aparecer em CP
    const camposOcultar = {
        'nome_vitima_group': !isCP,
        'natureza_procedimento_group': !isCP
    };
    
    // Aplicar visibilidade
    Object.entries(camposCP).forEach(([id, mostrar]) => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.style.display = mostrar ? 'block' : 'none';
            
            // Tornar obrigatório se for CP
            const input = campo.querySelector('select, input');
            if (input && mostrar) {
                input.setAttribute('required', 'required');
            } else if (input) {
                input.removeAttribute('required');
            }
        }
    });
    
    Object.entries(camposOcultar).forEach(([id, mostrar]) => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.style.display = mostrar ? 'block' : 'none';
            
            // Limpar valores quando ocultar
            if (!mostrar) {
                const input = campo.querySelector('select, input, textarea');
                if (input) {
                    input.removeAttribute('required');
                    input.value = '';
                }
            }
        }
    });
}
```

#### 2. Procurar no arquivo a função que trata mudança de tipo de procedimento e adicionar:

Procure por algo como:
```javascript
document.getElementById('tipo_procedimento')?.addEventListener('change', function() {
```

E adicione dentro da função:
```javascript
const tipoProcedimento = this.value;
ajustarCamposCartaPrecatoria(tipoProcedimento);
```

#### 3. Na função de submit do formulário (procure por `submitProcedureForm` ou similar):

Adicionar coleta dos dados de CP:
```javascript
// Coletar campos específicos de CP
const unidade_deprecada = document.getElementById('unidade_deprecada')?.value || null;
const deprecante = document.getElementById('deprecante')?.value || null;
const pessoas_inquiridas = tipo_detalhe === 'CP' ? coletarPessoasInquiridas() : null;

// Validação específica para CP
if (tipo_detalhe === 'CP') {
    if (!unidade_deprecada) {
        alert('Por favor, selecione a Unidade onde foi deprecada.');
        return false;
    }
    if (!deprecante || !deprecante.trim()) {
        alert('Por favor, informe o Deprecante.');
        return false;
    }
    if (!pessoas_inquiridas || pessoas_inquiridas === '[]') {
        alert('Por favor, adicione pelo menos uma pessoa a ser inquirida.');
        return false;
    }
}
```

E adicionar nos parâmetros da chamada `eel.registrar_processo`:
```javascript
unidade_deprecada, deprecante, pessoas_inquiridas
```

#### 4. Na função de edição (procure por onde carrega os dados do procedimento):

Adicionar após carregar os dados normais:
```javascript
// Carregar campos de CP
if (procedimento.tipo_detalhe === 'CP') {
    if (document.getElementById('unidade_deprecada')) {
        document.getElementById('unidade_deprecada').value = procedimento.unidade_deprecada || '';
    }
    if (document.getElementById('deprecante')) {
        document.getElementById('deprecante').value = procedimento.deprecante || '';
    }
    
    // Carregar pessoas inquiridas
    if (procedimento.pessoas_inquiridas) {
        try {
            const pessoas = JSON.parse(procedimento.pessoas_inquiridas);
            const container = document.getElementById('pessoas_inquiridas_list');
            container.innerHTML = '';
            
            pessoasInquiridasCount = 0;
            pessoas.forEach((pessoa) => {
                pessoasInquiridasCount++;
                const novaLinha = document.createElement('div');
                novaLinha.className = 'pessoa-inquirida-item mb-2 d-flex align-items-center';
                novaLinha.id = `pessoa_inquirida_${pessoasInquiridasCount}`;
                
                const isFirst = pessoasInquiridasCount === 1;
                
                novaLinha.innerHTML = `
                    <input type="text" 
                           class="form-control pessoa-inquirida-input" 
                           value="${pessoa}"
                           id="pessoa_inquirida_input_${pessoasInquiridasCount}"
                           style="flex: 1;">
                    ${!isFirst ? `
                    <button type="button" 
                            class="btn btn-sm btn-danger ms-2" 
                            onclick="removerPessoaInquirida(${pessoasInquiridasCount})"
                            title="Remover"
                            style="margin-left: 8px;">
                        <i class="fas fa-times"></i>
                    </button>
                    ` : ''}
                `;
                
                container.appendChild(novaLinha);
            });
        } catch (e) {
            console.error('Erro ao carregar pessoas inquiridas:', e);
        }
    }
    
    // Ajustar visibilidade
    ajustarCamposCartaPrecatoria('CP');
}
```

---

## 🎯 TESTE FINAL

Após implementar o JavaScript:

1. Criar novo procedimento CP
2. Preencher todos os campos específicos
3. Adicionar múltiplas pessoas inquiridas
4. Salvar e verificar no banco
5. Editar o CP e verificar se os dados são carregados corretamente

---

## 📝 CONSULTA SQL PARA TESTAR

```sql
SELECT numero, tipo_detalhe, unidade_deprecada, deprecante, pessoas_inquiridas 
FROM processos_procedimentos 
WHERE tipo_detalhe = 'CP';
```
