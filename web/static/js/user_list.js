
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

// Função para carregar usuários
async function loadUsers() {
    try {
        const users = await eel.listar_usuarios()();
        const usersList = document.getElementById('usersList');
        
        if (users.length === 0) {
            usersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>Nenhum usuário cadastrado</h3>
                    <p>Use o formulário ao lado para cadastrar o primeiro usuário</p>
                </div>
            `;
        } else {
            usersList.innerHTML = users.map(user => `
                <div class="user-item">
                    <div class="user-avatar">
                        ${user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-details">
                        <h4>${user.nome}</h4>
                        <p>${user.email}</p>
                    </div>
                    <div class="user-date">
                        ${new Date(user.data_criacao).toLocaleDateString('pt-BR')}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showAlert('Erro ao carregar lista de usuários!', 'error');
    }
}

// Carrega usuários ao inicializar
window.addEventListener('load', async () => {
    await loadUsers();
});
