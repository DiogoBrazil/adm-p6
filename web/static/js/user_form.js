
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

// Função para cadastrar usuário
async function registerUser(nome, email, senha) {
    try {
        const result = await eel.cadastrar_usuario(nome, email, senha)();
        
        if (result.sucesso) {
            showAlert(result.mensagem, 'success');
            document.getElementById('userForm').reset();
        } else {
            showAlert(result.mensagem, 'error');
        }
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        showAlert('Erro ao conectar com o servidor!', 'error');
    }
}

// Event listeners
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    
    if (!nome || !email || !senha) {
        showAlert('Por favor, preencha todos os campos!', 'error');
        return;
    }
    
    await registerUser(nome, email, senha);
});
