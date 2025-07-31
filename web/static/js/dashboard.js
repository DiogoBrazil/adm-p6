
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

// Funções de loading e animação removidas - não são necessárias no dashboard

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

// Função para carregar lista de usuários removida - não é necessária no dashboard

// Função de cadastro removida - não é necessária no dashboard

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

// Função para animar números removida - não é necessária no dashboard atual

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados iniciais
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Só mostra mensagem de boas-vindas se o usuário acabou de fazer login
        if (sessionStorage.getItem('justLoggedIn') === 'true') {
            showAlert(`Bem-vindo, ${usuarioLogado.nome}! Dashboard carregado com sucesso.`, 'success');
            // Remove a marcação para não mostrar novamente
            sessionStorage.removeItem('justLoggedIn');
        }
    }
});

// Event listener do formulário de cadastro removido - não existe no dashboard

// Atalho de teclado para logout (Ctrl+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        realizarLogout();
    }
});

// Auto-focus removido - não há campos de entrada no dashboard
