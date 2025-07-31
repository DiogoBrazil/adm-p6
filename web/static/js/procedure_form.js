
// Variável para usuário logado
let usuarioLogado = null;
let editandoProcedimento = null;

// Função para voltar à página anterior
function voltarParaListagem() {
    window.location.href = 'procedure_list.html';
}

// Função para mostrar alertas
function showAlert(message, type = 'error') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email;
            return true;
        } else {
            showAlert('Sessão expirada. Redirecionando para login...', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        showAlert('Erro ao carregar dados do usuário!', 'error');
        return false;
    }
}

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    // Criar modal se não existir
    let modal = document.getElementById('confirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal-feedback';
        modal.innerHTML = `
            <div class="modal-content">
                <i id="confirmIcon" class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
                <h3 id="confirmTitle" style="margin-bottom: 15px; color: #333;"></h3>
                <p id="confirmMessage" style="margin-bottom: 25px; color: #666;"></p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirmCancel" class="btn-secondary" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>
                    <button id="confirmOk" class="btn-danger" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer;">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Atualizar conteúdo do modal
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Event listeners
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    // Remover listeners anteriores
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));
    
    // Novos listeners
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Função de logout
async function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                await eel.fazer_logout()();
                showAlert('Logout realizado com sucesso! Redirecionando...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            } catch (error) {
                console.error('Erro no logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
            }
        }
    );
}

async function loadResponsaveis() {
    try {
        const users = await eel.listar_todos_usuarios()();
        const responsavelSelect = document.getElementById('responsavel');
        responsavelSelect.innerHTML = users.map(user => `<option value="${user.id}" data-type="${user.tipo}">${user.nome}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
    }
}

// Função para verificar se está editando um procedimento
async function verificarEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    const procedimentoId = urlParams.get('id');
    
    if (procedimentoId) {
        try {
            const procedimento = await eel.obter_processo(procedimentoId)();
            if (procedimento) {
                editandoProcedimento = procedimento;
                await preencherFormularioEdicao(procedimento);
                
                // Atualizar título da página
                const titulo = document.querySelector('h2');
                if (titulo) {
                    titulo.textContent = 'Editar Procedimento';
                }
                
                // Atualizar texto do botão
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
                }
            } else {
                showAlert('Procedimento não encontrado!', 'error');
                setTimeout(() => {
                    window.location.href = 'procedure_list.html';
                }, 2000);
            }
        } catch (error) {
            console.error('Erro ao carregar procedimento:', error);
            showAlert('Erro ao carregar dados do procedimento!', 'error');
        }
    }
}

// Função para preencher formulário com dados do procedimento
async function preencherFormularioEdicao(procedimento) {
    // Preencher campos básicos
    document.getElementById('numero').value = procedimento.numero || '';
    document.getElementById('tipo_geral').value = procedimento.tipo_geral || '';
    document.getElementById('documento_iniciador').value = procedimento.documento_iniciador || '';
    document.getElementById('processo_sei').value = procedimento.processo_sei || '';
    
    // Aguardar um pouco para garantir que os campos estejam carregados
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Disparar evento change para mostrar campos condicionais
    const tipoGeralSelect = document.getElementById('tipo_geral');
    tipoGeralSelect.dispatchEvent(new Event('change'));
    
    // Aguardar mais um pouco para os campos condicionais aparecerem
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Preencher tipo específico baseado no tipo_geral
    if (procedimento.tipo_geral === 'processo') {
        document.getElementById('tipo_processo').value = procedimento.tipo_detalhe || '';
    } else if (procedimento.tipo_geral === 'procedimento') {
        document.getElementById('tipo_procedimento').value = procedimento.tipo_detalhe || '';
    }
    
    // Preencher responsável
    if (procedimento.responsavel_id && procedimento.responsavel_tipo) {
        const selectId = procedimento.responsavel_tipo === 'encarregado' ? 'encarregado' : 'operador';
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            selectElement.value = procedimento.responsavel_id;
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados do usuário logado primeiro
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Só carrega os responsáveis se o login estiver ok
        await loadResponsaveis();
        
        // Verificar se está editando um procedimento
        await verificarEdicao();
    }
    
    // Configurar campos condicionais
    const tipoGeralSelect = document.getElementById('tipo_geral');
    const processoTipoGroup = document.getElementById('processo_tipo_group');
    const procedimentoTipoGroup = document.getElementById('procedimento_tipo_group');
    const tipoProcessoSelect = document.getElementById('tipo_processo');
    const tipoProcedimentoSelect = document.getElementById('tipo_procedimento');

    function toggleTipoFields() {
        if (tipoGeralSelect.value === 'processo') {
            processoTipoGroup.style.display = 'block';
            procedimentoTipoGroup.style.display = 'none';
            tipoProcessoSelect.setAttribute('required', 'required');
            tipoProcedimentoSelect.removeAttribute('required');
            tipoProcedimentoSelect.value = ''; // Limpa o valor se o campo for ocultado
        } else if (tipoGeralSelect.value === 'procedimento') {
            processoTipoGroup.style.display = 'none';
            procedimentoTipoGroup.style.display = 'block';
            tipoProcessoSelect.removeAttribute('required');
            tipoProcedimentoSelect.setAttribute('required', 'required');
            tipoProcessoSelect.value = ''; // Limpa o valor se o campo for ocultado
        } else {
            processoTipoGroup.style.display = 'none';
            procedimentoTipoGroup.style.display = 'none';
            tipoProcessoSelect.removeAttribute('required');
            tipoProcedimentoSelect.removeAttribute('required');
            tipoProcessoSelect.value = '';
            tipoProcedimentoSelect.value = '';
        }
    }

    tipoGeralSelect.addEventListener('change', toggleTipoFields);
    toggleTipoFields(); // Chamar no carregamento inicial
});

document.getElementById('processForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const numero = document.getElementById('numero').value.trim();
    const tipo_geral = document.getElementById('tipo_geral').value;
    const documento_iniciador = document.getElementById('documento_iniciador').value;
    const processo_sei = document.getElementById('processo_sei').value.trim();
    const responsavelSelect = document.getElementById('responsavel');
    const responsavel_id = responsavelSelect.value;
    const responsavel_tipo = responsavelSelect.options[responsavelSelect.selectedIndex].dataset.type;

    let tipo_detalhe = '';
    if (tipo_geral === 'processo') {
        tipo_detalhe = document.getElementById('tipo_processo').value;
    } else if (tipo_geral === 'procedimento') {
        tipo_detalhe = document.getElementById('tipo_procedimento').value;
    }

    try {
        if (!numero || !tipo_geral || !tipo_detalhe || !documento_iniciador || !responsavel_id || !responsavel_tipo) {
            showAlert('Por favor, preencha todos os campos obrigatórios!', 'error');
            return;
        }
        
        let result;
        if (editandoProcedimento) {
            // Modo edição
            result = await eel.atualizar_processo(
                editandoProcedimento.id, 
                numero, 
                tipo_geral, 
                tipo_detalhe, 
                documento_iniciador, 
                processo_sei, 
                responsavel_id, 
                responsavel_tipo
            )();
        } else {
            // Modo criação
            result = await eel.registrar_processo(
                numero, 
                tipo_geral, 
                tipo_detalhe, 
                documento_iniciador, 
                processo_sei, 
                responsavel_id, 
                responsavel_tipo
            )();
        }
        
        if (result.sucesso) {
            showAlert(result.mensagem, 'success');
            
            if (editandoProcedimento) {
                // Se está editando, volta para a lista após 2 segundos
                setTimeout(() => {
                    window.location.href = 'procedure_list.html';
                }, 2000);
            } else {
                // Se está criando, limpa o formulário
                document.getElementById('processForm').reset();
                // Resetar visibilidade dos campos condicionais
                document.getElementById('processo_tipo_group').style.display = 'none';
                document.getElementById('procedimento_tipo_group').style.display = 'none';
            }
        } else {
            showAlert(result.mensagem, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar processo/procedimento:', error);
        showAlert('Erro ao conectar com o servidor!', 'error');
    }
});
