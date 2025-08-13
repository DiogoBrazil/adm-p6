// Verificação de segurança: só executa se estiver na página correta
if (document.title.includes('Crime') || document.getElementById('crimeForm')) {

// Variáveis globais
let usuarioLogado = null;
let modoEdicao = false;
let crimeId = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        return; // Para a execução se não estiver autenticado
    }
    
    inicializarFormulario();
    verificarModoEdicao();
});

async function verificarAutenticacao() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            
            if (userNameElement) userNameElement.textContent = usuarioLogado.nome;
            if (userEmailElement) userEmailElement.textContent = usuarioLogado.email;
            
            return true;
        } else {
            console.log('Usuário não está logado, redirecionando...');
            window.stop();
            window.location.replace('login.html');
            return false;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.replace('login.html');
        return false;
    }
}

function inicializarFormulario() {
    const form = document.getElementById('crimeForm');
    if (!form) {
        console.error('Formulário não encontrado');
        return;
    }
    
    // Evento de submit do formulário
    form.addEventListener('submit', handleSubmit);
    
    // Modal de feedback
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', fecharModalFeedback);
    }
    
    // Inicializar validações de campos
    inicializarValidacoesCampos();
    
    console.log('✅ Formulário inicializado com sucesso');
}

function inicializarValidacoesCampos() {
    // Campo Artigo - apenas números
    const artigoInput = document.getElementById('artigo');
    if (artigoInput) {
        artigoInput.addEventListener('input', function(e) {
            // Remove tudo que não for número
            let value = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = value;
            
            // Validação visual
            if (value && /^[0-9]+$/.test(value)) {
                setFieldValidation(e.target, true, 'Formato válido');
            } else if (value) {
                setFieldValidation(e.target, false, 'Apenas números são permitidos');
            } else {
                clearFieldValidation(e.target);
            }
        });
        
        artigoInput.addEventListener('keypress', function(e) {
            // Permite apenas números
            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    // Campo Parágrafo - formato ordinal (1º, 2º, 3º, único)
    const paragrafoInput = document.getElementById('paragrafo');
    if (paragrafoInput) {
        paragrafoInput.addEventListener('input', function(e) {
            let value = e.target.value;
            
            // Permite "único" (case insensitive)
            if (value.toLowerCase() === 'unico' || value.toLowerCase() === 'único') {
                e.target.value = 'único';
                setFieldValidation(e.target, true, 'Formato válido');
                return;
            }
            
            // Remove tudo que não for número ou º, mas mantém números para digitação
            value = value.replace(/[^0-9º]/g, '');
            
            // Remove múltiplos º
            value = value.replace(/º+/g, 'º');
            
            e.target.value = value;
            
            // Validação visual (mais flexível durante digitação)
            if (value === '' || value === 'único' || /^[0-9]+º?$/.test(value)) {
                if (value) setFieldValidation(e.target, true, 'Formato válido');
                else clearFieldValidation(e.target);
            } else {
                setFieldValidation(e.target, false, 'Use formato ordinal (1º, 2º) ou "único"');
            }
        });
        
        // Evento blur para adicionar º automaticamente quando sair do campo
        paragrafoInput.addEventListener('blur', function(e) {
            let value = e.target.value.trim();
            
            // Se é "único", mantém
            if (value.toLowerCase() === 'unico') {
                e.target.value = 'único';
                setFieldValidation(e.target, true, 'Formato válido');
                return;
            }
            
            // Se tem apenas números, adiciona º
            if (/^[0-9]+$/.test(value)) {
                e.target.value = value + 'º';
                setFieldValidation(e.target, true, 'Formato válido');
            } else if (value === '') {
                clearFieldValidation(e.target);
            }
        });
        
        paragrafoInput.addEventListener('keypress', function(e) {
            const currentValue = e.target.value;
            
            // Permite backspace, delete, tab, enter
            if (['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                return;
            }
            
            // Se está digitando "único"
            if (currentValue.toLowerCase() === '' || currentValue.toLowerCase().startsWith('u')) {
                const allowedChars = 'únicoÚNICO';
                if (allowedChars.includes(e.key)) {
                    return; // Permite caracteres de "único"
                } else if (/[0-9]/.test(e.key) && currentValue === '') {
                    return; // Permite começar com número se campo vazio
                } else {
                    e.preventDefault();
                    return;
                }
            }
            
            // Se já tem texto que não é "único", permite apenas números
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    // Campo Inciso - números romanos maiúsculos
    const incisoInput = document.getElementById('inciso');
    if (incisoInput) {
        incisoInput.addEventListener('input', function(e) {
            // Remove tudo que não for I, V, X, L, C, D, M
            let value = e.target.value.replace(/[^IVXLCDMivxlcdm]/g, '');
            // Converte para maiúscula
            value = value.toUpperCase();
            e.target.value = value;
            
            // Validação visual
            if (value === '' || /^[IVXLCDM]+$/.test(value)) {
                if (value) setFieldValidation(e.target, true, 'Formato válido');
                else clearFieldValidation(e.target);
            } else {
                setFieldValidation(e.target, false, 'Apenas números romanos (I, V, X, L, C, D, M)');
            }
        });
        
        incisoInput.addEventListener('keypress', function(e) {
            // Permite apenas números romanos
            if (!/[IVXLCDMivxlcdm]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    // Campo Alínea - apenas uma letra minúscula
    const alineaInput = document.getElementById('alinea');
    if (alineaInput) {
        alineaInput.addEventListener('input', function(e) {
            // Remove tudo que não for letra
            let value = e.target.value.replace(/[^a-zA-Z]/g, '');
            // Pega apenas a primeira letra e converte para minúscula
            value = value.charAt(0).toLowerCase();
            e.target.value = value;
            
            // Validação visual
            if (value === '' || /^[a-z]$/.test(value)) {
                if (value) setFieldValidation(e.target, true, 'Formato válido');
                else clearFieldValidation(e.target);
            } else {
                setFieldValidation(e.target, false, 'Apenas uma letra minúscula');
            }
        });
        
        alineaInput.addEventListener('keypress', function(e) {
            const currentValue = e.target.value;
            
            // Permite backspace, delete, tab, enter
            if (['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                return;
            }
            
            // Se já tem um caractere, não permite mais
            if (currentValue.length >= 1) {
                e.preventDefault();
                return;
            }
            
            // Permite apenas letras
            if (!/[a-zA-Z]/.test(e.key)) {
                e.preventDefault();
            }
        });
    }
}

function setFieldValidation(field, isValid, message) {
    // Remove classes anteriores
    field.classList.remove('valid', 'invalid');
    
    // Adiciona nova classe
    field.classList.add(isValid ? 'valid' : 'invalid');
    
    // Remove mensagem anterior
    const existingMsg = field.parentNode.querySelector('.validation-message');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    // Adiciona nova mensagem
    if (message) {
        const msgElement = document.createElement('span');
        msgElement.className = `validation-message ${isValid ? 'valid' : 'invalid'}`;
        msgElement.textContent = message;
        field.parentNode.appendChild(msgElement);
    }
}

function clearFieldValidation(field) {
    field.classList.remove('valid', 'invalid');
    const existingMsg = field.parentNode.querySelector('.validation-message');
    if (existingMsg) {
        existingMsg.remove();
    }
}

function verificarModoEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        modoEdicao = true;
        crimeId = id;
        document.getElementById('formTitle').textContent = 'Editar Crime/Contravenção';
        document.getElementById('btnSalvar').innerHTML = '<i class="fas fa-save"></i> Atualizar';
        carregarCrimeParaEdicao(id);
    }
}

async function carregarCrimeParaEdicao(id) {
    try {
        console.log(`🔍 Carregando crime para edição: ${id}`);
        
        const resultado = await eel.obter_crime_por_id(id)();
        
        if (resultado.success) {
            const crime = resultado.data;
            
            // Preencher o formulário
            document.getElementById('crimeId').value = crime.id;
            document.getElementById('tipo').value = crime.tipo;
            document.getElementById('dispositivo_legal').value = crime.dispositivo_legal;
            document.getElementById('artigo').value = crime.artigo;
            document.getElementById('descricao_artigo').value = crime.descricao_artigo;
            document.getElementById('paragrafo').value = crime.paragrafo || '';
            document.getElementById('inciso').value = crime.inciso || '';
            document.getElementById('alinea').value = crime.alinea || '';
            document.getElementById('ativo').checked = crime.ativo;
            
            console.log('✅ Crime carregado para edição');
        } else {
            showAlert(resultado.error || 'Erro ao carregar dados do crime', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar crime para edição:', error);
        showAlert('Erro ao carregar dados do crime', 'error');
    }
}

// ============================================
// MANIPULAÇÃO DO FORMULÁRIO
// ============================================

async function handleSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const dados = Object.fromEntries(formData.entries());
    
    // Converter checkbox para boolean
    dados.ativo = document.getElementById('ativo').checked;
    
    // Validar campos obrigatórios
    if (!validarFormulario(dados)) {
        return;
    }
    
    try {
        let resultado;
        
        if (modoEdicao) {
            dados.id = crimeId;
            resultado = await eel.atualizar_crime(dados)();
            
            if (resultado.success) {
                showAlert('Crime atualizado com sucesso!', 'success', () => {
                    window.location.href = 'crime_list.html';
                });
            } else {
                showAlert(resultado.error || 'Erro ao atualizar crime', 'error');
            }
        } else {
            resultado = await eel.cadastrar_crime(dados)();
            
            if (resultado.success) {
                showAlert('Crime cadastrado com sucesso!', 'success', () => {
                    window.location.href = 'crime_list.html';
                });
            } else {
                showAlert(resultado.error || 'Erro ao cadastrar crime', 'error');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar crime:', error);
        showAlert('Erro ao salvar crime. Tente novamente.', 'error');
    }
}

function validarFormulario(dados) {
    if (!dados.tipo) {
        showAlert('Por favor, selecione o tipo (Crime ou Contravenção)', 'error');
        return false;
    }
    
    if (!dados.dispositivo_legal) {
        showAlert('Por favor, selecione o dispositivo legal', 'error');
        return false;
    }
    
    if (!dados.artigo.trim()) {
        showAlert('Por favor, informe o número do artigo', 'error');
        return false;
    }
    
    if (!dados.descricao_artigo.trim()) {
        showAlert('Por favor, informe a descrição do artigo', 'error');
        return false;
    }
    
    return true;
}

// ============================================
// NAVEGAÇÃO
// ============================================

function voltarParaLista() {
    window.location.href = 'crime_list.html';
}

async function realizarLogout() {
    const showConfirm = (title, message, onConfirm) => {
        let modal = document.getElementById('confirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'modal-feedback';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div><i class="fas fa-exclamation-triangle" style="color:#dc3545;"></i></div>
                    </div>
                    <div class="modal-body">
                        <h3 id="confirmTitle" style="margin-bottom:10px;"></h3>
                        <p id="confirmMessage"></p>
                    </div>
                    <div class="modal-actions">
                        <button id="confirmCancel" class="btn-secondary">Cancelar</button>
                        <button id="confirmOk" class="btn-danger">Sair</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
        modal.querySelector('#confirmTitle').textContent = title;
        modal.querySelector('#confirmMessage').textContent = message;
        modal.style.display = 'flex';
        const cancelBtn = modal.querySelector('#confirmCancel');
        const okBtn = modal.querySelector('#confirmOk');
        const close = () => (modal.style.display = 'none');
        cancelBtn.onclick = close;
        okBtn.onclick = () => { close(); onConfirm(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };
    };

    showConfirm('Sair do sistema', 'Tem certeza que deseja encerrar a sessão?', async () => {
        const start = Date.now();
        try { await eel.fazer_logout()(); } catch (e) { console.warn('logout falhou; redirecionando'); }
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'flex';
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1000 - elapsed);
        setTimeout(() => { window.location.href = 'login.html'; }, wait);
    });
}

// ============================================
// MODAIS E FEEDBACK
// ============================================

function showAlert(message, type = 'info', onClose = null) {
    const modal = document.getElementById('modalFeedback');
    const modalMessage = document.getElementById('modalMessage');
    const modalIcon = document.getElementById('modalIcon');
    
    if (!modal || !modalMessage || !modalIcon) {
        console.error('Elementos do modal não encontrados');
        alert(message); // Fallback
        if (onClose) onClose();
        return;
    }
    
    modalMessage.textContent = message;
    
    // Configurar ícone e cor baseado no tipo
    modalIcon.innerHTML = '';
    modalIcon.className = '';
    
    switch (type) {
        case 'success':
            modalIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            modalIcon.className = 'modal-icon-success';
            break;
        case 'error':
            modalIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            modalIcon.className = 'modal-icon-error';
            break;
        case 'warning':
            modalIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            modalIcon.className = 'modal-icon-warning';
            break;
        default:
            modalIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
            modalIcon.className = 'modal-icon-info';
    }
    
    // Armazenar callback para usar quando fechar o modal
    modal.onCloseCallback = onClose;
    
    modal.style.display = 'flex';
    
    // Para casos de sucesso, configurar redirecionamento automático após 1 segundo
    if (type === 'success' && onClose) {
        setTimeout(() => {
            // Verificar se o modal ainda está aberto
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
                onClose();
            }
        }, 1000);
    }
}

function fecharModalFeedback() {
    const modal = document.getElementById('modalFeedback');
    if (modal) {
        modal.style.display = 'none';
        
        // Executar callback se existir
        if (modal.onCloseCallback) {
            const callback = modal.onCloseCallback;
            modal.onCloseCallback = null; // Limpar callback para evitar dupla execução
            callback();
        }
    }
}

// ============================================
// UTILITÁRIOS
// ============================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

} // Fecha o bloco condicional de verificação da página
