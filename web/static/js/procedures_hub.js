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
    // Remover modal existente se houver
    let existing = document.getElementById('confirmModal');
    if (existing) existing.remove();

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

    modal.style.display = 'flex';

    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    const closeModal = () => { modal.style.display = 'none'; };
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => { closeModal(); onConfirm(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

// Função de logout
async function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                const startTs = Date.now();
                await eel.fazer_logout()();
                const loader = document.getElementById('globalLoader');
                if (loader) loader.classList.remove('hidden');
                const elapsed = Date.now() - startTs;
                const toWait = Math.max(0, 1000 - elapsed);
                if (toWait > 0) await new Promise(r => setTimeout(r, toWait));
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
