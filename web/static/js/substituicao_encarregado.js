// ============================================
// MODAL DE SUBSTITUIÇÃO DE ENCARREGADO
// ============================================

let modalSubstituirEncarregado;

/**
 * Abre o modal de substituição de encarregado
 */
function abrirModalSubstituirEncarregado() {
    if (!modalSubstituirEncarregado) {
        criarModalSubstituirEncarregado();
    }
    
    // Limpar campos
    const select = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
    const textarea = modalSubstituirEncarregado.querySelector('#justificativaSubstituicao');
    
    if (select) select.innerHTML = '<option value="">Carregando...</option>';
    if (textarea) textarea.value = '';
    
    // Carregar lista de encarregados
    carregarEncarregadosParaSubstituicao();
    
    // Mostrar modal
    modalSubstituirEncarregado.style.display = 'flex';
}

/**
 * Fecha o modal de substituição de encarregado
 */
function fecharModalSubstituirEncarregado() {
    if (modalSubstituirEncarregado) {
        modalSubstituirEncarregado.style.display = 'none';
    }
}

/**
 * Cria o modal de substituição de encarregado
 */
function criarModalSubstituirEncarregado() {
    modalSubstituirEncarregado = document.createElement('div');
    modalSubstituirEncarregado.id = 'modalSubstituirEncarregado';
    modalSubstituirEncarregado.className = 'modal-substituir-encarregado-overlay';
    modalSubstituirEncarregado.innerHTML = `
        <div class="modal-substituir-encarregado">
            <div class="modal-substituir-encarregado-header">
                <h3><i class="fas fa-user-friends"></i> Substituir Encarregado</h3>
                <button class="modal-substituir-encarregado-close" onclick="fecharModalSubstituirEncarregado()">&times;</button>
            </div>
            <div class="modal-substituir-encarregado-body">
                <div class="form-group-substituicao">
                    <label for="selectNovoEncarregado"><i class="fas fa-user"></i> Novo Encarregado *</label>
                    <select id="selectNovoEncarregado" class="form-control-substituicao" required>
                        <option value="">Selecione um encarregado...</option>
                    </select>
                </div>
                
                <div class="form-group-substituicao">
                    <label for="justificativaSubstituicao"><i class="fas fa-comment-alt"></i> Justificativa (Opcional)</label>
                    <textarea id="justificativaSubstituicao" rows="3" placeholder="Descreva o motivo da substituição..." class="form-control-substituicao"></textarea>
                </div>
            </div>
            <div class="modal-substituir-encarregado-footer">
                <button class="btn-substituicao-cancel" onclick="fecharModalSubstituirEncarregado()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="btn-substituicao-save" onclick="salvarSubstituicaoEncarregado()">
                    <i class="fas fa-save"></i> Substituir Encarregado
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modalSubstituirEncarregado);
}

/**
 * Carrega a lista de encarregados para substituição
 */
async function carregarEncarregadosParaSubstituicao() {
    try {
        const resultado = await eel.listar_encarregados_operadores()();
        const select = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
        
        if (!select) return;
        
        if (resultado && Array.isArray(resultado)) {
            // Limpar opções existentes
            select.innerHTML = '<option value="">Selecione um encarregado...</option>';
            
            // Adicionar encarregados ao select
            resultado.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = `${usuario.posto_graduacao || ''} ${usuario.matricula || ''} ${usuario.nome || ''}`.trim();
                option.dataset.tipo = usuario.tipo;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">Erro ao carregar encarregados</option>';
        }
    } catch (error) {
        console.error('Erro ao carregar encarregados:', error);
        const select = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
        if (select) {
            select.innerHTML = '<option value="">Erro ao carregar encarregados</option>';
        }
    }
}

/**
 * Salva a substituição de encarregado
 */
async function salvarSubstituicaoEncarregado() {
    const selectNovoEncarregado = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
    const justificativa = modalSubstituirEncarregado.querySelector('#justificativaSubstituicao').value;
    
    const novoEncarregadoId = selectNovoEncarregado.value;
    
    if (!novoEncarregadoId) {
        showAlert('Por favor, selecione um novo encarregado.', 'error');
        return;
    }
    
    try {
        const resultado = await eel.substituir_encarregado(currentProcedureId, novoEncarregadoId, justificativa)();
        
        if (resultado.sucesso) {
            // Fechar modal
            fecharModalSubstituirEncarregado();
            
            // Mostrar mensagem de sucesso
            showAlert('Encarregado substituído com sucesso!', 'success');
            
            // Recarregar os dados do processo
            await carregarDadosProcesso();
        } else {
            showAlert(resultado.mensagem || 'Erro ao substituir encarregado.', 'error');
        }
    } catch (error) {
        console.error('Erro ao substituir encarregado:', error);
        showAlert('Erro ao substituir encarregado.', 'error');
    }
}

// Adicionar evento para fechar o modal ao pressionar ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalSubstituirEncarregado && modalSubstituirEncarregado.style.display === 'flex') {
        fecharModalSubstituirEncarregado();
    }
});

// Adicionar evento para fechar o modal ao clicar fora dele
document.addEventListener('click', function(e) {
    if (modalSubstituirEncarregado && 
        modalSubstituirEncarregado.style.display === 'flex' && 
        e.target === modalSubstituirEncarregado) {
        fecharModalSubstituirEncarregado();
    }
});