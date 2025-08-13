
// Variáveis globais
let usuarioLogado = null;

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        </div>
    `;
    
    // Remove alerta após 3 segundos
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 3000);
}

// Funções de loading e animação removidas - não são necessárias na página inicial

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    // Remover modal existente se houver (garante consistência visual como na lista)
    let existingModal = document.getElementById('confirmModal');
    if (existingModal) existingModal.remove();

    // Criar novo modal com a mesma estilização da lista
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-feedback';
    modal.innerHTML = `
        <div class="modal-content">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; font-size: 3rem; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 15px; color: #333; font-size: 1.5rem;">${title}</h3>
            <p style="margin-bottom: 25px; color: #666; font-size: 1rem;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="confirmCancel" class="btn-secondary" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Cancelar</button>
                <button id="confirmOk" class="btn-danger" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Mostrar modal
    modal.style.display = 'flex';

    // Event listeners
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');

    const closeModal = () => { modal.style.display = 'none'; };

    // Remover listeners anteriores (clonar)
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));

    // Novos listeners
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => { closeModal(); onConfirm(); });

    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email;
            
            // Verifica se é admin
            if (!resultado.usuario.is_admin) {
                showAlert('Acesso negado! Apenas administradores podem acessar esta área.', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return false;
            }
            
            return true;
        } else {
            showAlert('Sessão expirada. Redirecionando para login...', 'info');
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

// Função para carregar estatísticas removida - rodapé foi removido

// Função para carregar lista de usuários removida - não é necessária na página inicial

// Função de cadastro removida - não é necessária na página inicial

// Função de logout
async function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            const startTs = Date.now();
            try {
                // Chama backend para invalidar sessão
                await eel.fazer_logout()();

                // Mostra loader global por pelo menos 1s
                const loader = document.getElementById('globalLoader');
                if (loader) loader.classList.remove('hidden');

                const elapsed = Date.now() - startTs;
                const toWait = Math.max(0, 1000 - elapsed);
                if (toWait > 0) await new Promise(r => setTimeout(r, toWait));

                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro no logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
            }
        }
    );
}

// Função para animar números removida - não é necessária na página inicial atual

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados iniciais
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Mensagem de boas-vindas removida conforme solicitado
        sessionStorage.removeItem('justLoggedIn');
    }
});

// Event listener do formulário de cadastro removido - não existe na página inicial

// Atalho de teclado para logout (Ctrl+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        realizarLogout();
    }
});

// Auto-focus removido - não há campos de entrada na página inicial
