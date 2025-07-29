
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

// Função para controlar loading do botão
function setLoading(loading) {
    const btnText = document.getElementById('btnText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const btnCadastrar = document.getElementById('btnCadastrar');

    if (loading) {
        btnText.textContent = 'Cadastrando...';
        loadingSpinner.style.display = 'block';
        btnCadastrar.disabled = true;
    } else {
        btnText.textContent = 'Cadastrar Usuário';
        loadingSpinner.style.display = 'none';
        btnCadastrar.disabled = false;
    }
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

// Função para carregar estatísticas
async function carregarEstatisticas() {
    try {
        const stats = await eel.obter_estatisticas()();
        
        document.getElementById('totalUsuarios').textContent = stats.total_usuarios;
        document.getElementById('totalGeral').textContent = stats.total_geral;
        document.getElementById('novosHoje').textContent = stats.novos_hoje;
        document.getElementById('dbPath').textContent = stats.banco_path;
        
        // Anima os números
        animateNumbers();
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Função para carregar lista de usuários
async function carregarUsuarios() {
    try {
        const usuarios = await eel.listar_usuarios()();
        const usersList = document.getElementById('usersList');
        
        if (usuarios.length === 0) {
            usersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>Nenhum usuário cadastrado</h3>
                    <p>Use o formulário ao lado para cadastrar o primeiro usuário</p>
                </div>
            `;
        } else {
            usersList.innerHTML = usuarios.map(user => `
                <div class="user-item fade-in">
                    <div class="user-avatar-small">
                        ${user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-details-small">
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

// Função para cadastrar usuário
async function cadastrarUsuario(nome, email, senha) {
    try {
        setLoading(true);
        
        const resultado = await eel.cadastrar_usuario(nome, email, senha)();
        
        if (resultado.sucesso) {
            showAlert(resultado.mensagem, 'success');
            
            // Limpa o formulário
            document.getElementById('cadastroForm').reset();
            
            // Recarrega dados
            await carregarUsuarios();
            await carregarEstatisticas();
        } else {
            showAlert(resultado.mensagem, 'error');
        }
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        showAlert('Erro ao conectar com o servidor!', 'error');
    } finally {
        setLoading(false);
    }
}

// Função de logout
async function realizarLogout() {
    if (confirm('Tem certeza que deseja sair do sistema?')) {
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
}

// Função para animar números das estatísticas
function animateNumbers() {
    document.querySelectorAll('.stat-value').forEach(element => {
        const finalValue = parseInt(element.textContent);
        let currentValue = 0;
        const increment = Math.ceil(finalValue / 30);
        
        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= finalValue) {
                element.textContent = finalValue;
                clearInterval(timer);
            } else {
                element.textContent = currentValue;
            }
        }, 50);
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados iniciais
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        await carregarEstatisticas();
        await carregarUsuarios();
        showAlert(`Bem-vindo, ${usuarioLogado.nome}! Dashboard carregado com sucesso.`, 'success');
    }
});

// Event listener do formulário de cadastro
document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    
    if (!nome || !email || !senha) {
        showAlert('Por favor, preencha todos os campos!', 'error');
        return;
    }
    
    await cadastrarUsuario(nome, email, senha);
});

// Atalho de teclado para logout (Ctrl+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        realizarLogout();
    }
});

// Auto-focus no primeiro campo
window.addEventListener('load', () => {
    document.getElementById('nome').focus();
});
