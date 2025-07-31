
// Variáveis globais
const loginForm = document.getElementById('loginForm');
const btnLogin = document.getElementById('btnLogin');
const btnText = document.querySelector('.btn-text');
const loading = document.querySelector('.loading');
const alertContainer = document.getElementById('alertContainer');

// Função para mostrar alertas
function showAlert(message, type = 'error') {
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${message}
        </div>
    `;
    
    // Remove alerta após 5 segundos
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Função de loading
function setLoading(loading_state) {
    if (loading_state) {
        btnLogin.classList.add('loading');
        btnLogin.disabled = true;
    } else {
        btnLogin.classList.remove('loading');
        btnLogin.disabled = false;
    }
}

// Função de login
async function realizarLogin(email, senha) {
    try {
        setLoading(true);
        
        // Chama função Python
        const resultado = await eel.fazer_login(email, senha)();
        
        if (resultado.sucesso) {
            showAlert(resultado.mensagem, 'success');
            
            // Marca que o usuário acabou de fazer login
            sessionStorage.setItem('justLoggedIn', 'true');
            
            // Redireciona para dashboard após 1.5 segundos
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showAlert(resultado.mensagem, 'error');
            // Limpa senha em caso de erro
            document.getElementById('senha').value = '';
            document.getElementById('senha').focus();
        }
    } catch (error) {
        showAlert('Erro ao conectar com o servidor!', 'error');
        console.error('Erro:', error);
    } finally {
        setLoading(false);
    }
}

// Event listener do formulário
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    
    if (!email || !senha) {
        showAlert('Por favor, preencha todos os campos!', 'error');
        return;
    }
    
    await realizarLogin(email, senha);
});



// Foco inicial no campo email
window.addEventListener('load', () => {
    document.getElementById('email').focus();
});

// Permite login com Enter
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !btnLogin.disabled) {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// Efeito visual nos campos
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.style.transform = 'scale(1.02)';
    });
    
    input.addEventListener('blur', function() {
        this.parentElement.style.transform = 'scale(1)';
    });
});

// Tooltip nas credenciais
const credentialBox = document.querySelector('.credential-box');
credentialBox.title = 'Clique para preencher automaticamente';
credentialBox.style.cursor = 'pointer';
