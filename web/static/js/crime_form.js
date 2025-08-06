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
    
    console.log('✅ Formulário inicializado com sucesso');
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
    try {
        const resultado = await eel.fazer_logout()();
        if (resultado.sucesso) {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = 'login.html';
    }
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
