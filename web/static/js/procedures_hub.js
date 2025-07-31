// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email || 'usuário';
            return true;
        } else {
            // Redireciona para login se não estiver logado
            window.location.href = 'login.html';
            return false;
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
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
                <div class="modal-header">
                    <h3 id="modalTitle">${title}</h3>
                </div>
                <div class="modal-body">
                    <p id="modalMessage">${message}</p>
                </div>
                <div class="modal-actions">
                    <button id="confirmBtn" class="btn-primary">Confirmar</button>
                    <button id="cancelBtn" class="btn-secondary">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Atualizar conteúdo do modal
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    // Mostrar modal
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Event listeners
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    
    const closeModal = () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
    };
    
    // Remover listeners anteriores
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    
    // Novos listeners
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('confirmBtn').addEventListener('click', () => {
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
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro no logout:', error);
            }
        }
    );
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados do usuário
    await carregarUsuarioLogado();
});
