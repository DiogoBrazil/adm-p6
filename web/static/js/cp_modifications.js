// ============================================
// MODIFICAÇÕES PARA CARTA PRECATÓRIA (CP)
// Adicionar ao arquivo procedure_form.js
// ============================================

// PASSO 1: Adicionar função para alternar campos específicos de CP
// Adicionar após a função existente de mostrar/ocultar campos

function ajustarCamposCartaPrecatoria(tipoProcedimento) {
    const isCP = (tipoProcedimento === 'CP');
    
    // Campos ESPECÍFICOS de CP
    const camposCP = [
        'unidade_deprecada_group',
        'deprecante_group',
        'pessoas_inquiridas_container'
    ];
    
    // Campos que NÃO devem aparecer em CP
    const camposOcultarCP = [
        'nome_vitima_group',
        'natureza_procedimento_group'
    ];
    
    // Mostrar/Ocultar campos específicos de CP
    camposCP.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.display = isCP ? 'block' : 'none';
            
            // Marcar campos como obrigatórios em CP
            if (isCP && (fieldId === 'unidade_deprecada_group' || fieldId === 'deprecante_group')) {
                const input = field.querySelector('select, input');
                if (input) {
                    input.setAttribute('required', 'required');
                    const label = field.querySelector('label');
                    if (label && !label.textContent.includes('*')) {
                        label.innerHTML = label.textContent + ' <span class="text-danger">*</span>';
                    }
                }
            } else {
                const input = field.querySelector('select, input');
                if (input) {
                    input.removeAttribute('required');
                }
            }
        }
    });
    
    // Ocultar campos que não são usados em CP
    camposOcultarCP.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.display = isCP ? 'none' : 'block';
            // Remover obrigatoriedade se oculto
            if (isCP) {
                const input = field.querySelector('select, input, textarea');
                if (input) {
                    input.removeAttribute('required');
                    input.value = ''; // Limpar valor
                }
            }
        }
    });
    
    // Ajustar checkboxes - mostrar apenas os permitidos em CP
    const checkboxesPermitidos = ['remessa_encarregado_group', 'concluido_group'];
    const todosCheckboxes = document.querySelectorAll('[id$="_group"]');
    
    if (isCP) {
        todosCheckboxes.forEach(checkbox => {
            const checkboxId = checkbox.id;
            if (checkboxId.includes('checkbox') || checkboxId.includes('_check')) {
                const isPermitido = checkboxesPermitidos.includes(checkboxId);
                checkbox.style.display = isPermitido ? 'block' : 'none';
            }
        });
    }
}

// PASSO 2: Adicionar evento ao select de tipo de procedimento
// Modificar a função existente que detecta mudança de tipo

document.getElementById('tipo_procedimento')?.addEventListener('change', function() {
    const tipoProcedimento = this.value;
    ajustarCamposCartaPrecatoria(tipoProcedimento);
    
    // ... código existente ...
});

// PASSO 3: Adicionar função para gerenciar múltiplas pessoas inquiridas
// Similar à função de múltiplos PMs

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
               style="flex: 1; max-width: calc(100% - 60px);">
        <button type="button" 
                class="btn btn-danger" 
                onclick="removerPessoaInquirida(${pessoasInquiridasCount})"
                title="Remover pessoa"
                style="padding: 6px 12px; margin-left: 8px; flex-shrink: 0; background-color: #dc3545; border-color: #dc3545;">
            <i class="fas fa-trash-alt"></i>
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

// PASSO 4: Modificar função de coleta de dados do formulário
// Na função submitProcedureForm, adicionar:

function submitProcedureForm(event) {
    event.preventDefault();
    
    // ... código existente ...
    
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
        if (!deprecante) {
            alert('Por favor, informe o Deprecante.');
            return false;
        }
        if (!pessoas_inquiridas || pessoas_inquiridas === '[]') {
            alert('Por favor, adicione pelo menos uma pessoa a ser inquirida.');
            return false;
        }
    }
    
    // Adicionar aos parâmetros da chamada do backend
    // Na chamada eel.registrar_processo(...) adicionar:
    // unidade_deprecada, deprecante, pessoas_inquiridas
    
    // ... resto do código ...
}

// PASSO 5: Função para carregar dados de CP ao editar
// Na função carregarDadosParaEdicao, adicionar:

function carregarDadosParaEdicao(procedimento) {
    // ... código existente ...
    
    // Carregar campos de CP se existirem
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
                container.innerHTML = ''; // Limpar
                
                pessoasInquiridasCount = 0;
                pessoas.forEach((pessoa, index) => {
                    pessoasInquiridasCount++;
                    const novaLinha = document.createElement('div');
                    novaLinha.className = 'pessoa-inquirida-item mb-2 d-flex align-items-center';
                    novaLinha.id = `pessoa_inquirida_${pessoasInquiridasCount}`;
                    
                    novaLinha.innerHTML = `
                        <input type="text" 
                               class="form-control pessoa-inquirida-input" 
                               value="${pessoa}"
                               id="pessoa_inquirida_input_${pessoasInquiridasCount}"
                               style="flex: 1; max-width: calc(100% - 60px);">
                        <button type="button" 
                                class="btn btn-danger" 
                                onclick="removerPessoaInquirida(${pessoasInquiridasCount})"
                                title="Remover pessoa"
                                style="padding: 6px 12px; margin-left: 8px; flex-shrink: 0; background-color: #dc3545; border-color: #dc3545;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    `;
                    
                    container.appendChild(novaLinha);
                });
            } catch (e) {
                console.error('Erro ao carregar pessoas inquiridas:', e);
            }
        }
        
        // Ajustar visibilidade dos campos
        ajustarCamposCartaPrecatoria('CP');
    }
}
