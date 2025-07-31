
// Variável para usuário logado
let usuarioLogado = null;

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email;
            return true;
        } else {
            showAlert('Sessão expirada. Redirecionando para login...', 'error');
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

// Função para voltar à página de listagem
function voltarParaListagem() {
    window.location.href = 'user_list.html';
}

// Função para mostrar alertas
function showAlert(message, type = 'error') {
    showModalFeedback(message, type);
}

function showModalFeedback(message, type = 'error') {
    const modal = document.getElementById('modalFeedback');
    const icon = document.getElementById('modalIcon');
    const msg = document.getElementById('modalMessage');
    const btn = document.getElementById('modalCloseBtn');
    if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle" style="color:#38c172;"></i>';
    } else {
        icon.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#e3342f;"></i>';
    }
    msg.textContent = message;
    modal.style.display = 'flex';
    btn.onclick = () => {
        modal.style.display = 'none';
    };
    // Fecha automaticamente após 2.5s se sucesso e vai para listagem
    if (type === 'success') {
        setTimeout(() => {
            modal.style.display = 'none';
        }, 1200);
    }
}

// Função para cadastrar ou atualizar usuário
async function submitUser(tipo_usuario, posto_graduacao, matricula, nome, email, senha, profile, modoEdicao, userId) {
    try {
        let result;
        if (modoEdicao) {
            // Atualizar usuário
            result = await eel.atualizar_usuario(userId, tipo_usuario, posto_graduacao, matricula, nome, email, senha, profile)();
        } else {
            // Cadastrar novo usuário
            result = await eel.cadastrar_usuario(tipo_usuario, posto_graduacao, matricula, nome, email, senha, profile)();
        }
        if (result.sucesso) {
            showAlert(result.mensagem, 'success');
            // Redireciona para listagem tanto no cadastro quanto na edição após sucesso
            setTimeout(() => {
                window.location.href = 'user_list.html';
            }, 1200); // Aguarda 1.2s para mostrar o alerta
        } else {
            showAlert(result.mensagem, 'error');
        }
    } catch (error) {
        console.error('Erro ao cadastrar/atualizar usuário:', error);
        showAlert('Erro ao conectar com o servidor!', 'error');
    }
}

// Event listeners
// Detecta modo edição pelo parâmetro da URL
function getUrlParams() {
    const params = {};
    window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
        params[key] = decodeURIComponent(value);
    });
    return params;
}

let modoEdicao = false;
let userIdEdicao = null;
let tipoUsuarioEdicao = null;

// Função async para carregar dados de edição
async function carregarDadosEdicao() {
    const params = getUrlParams();
    if (params.id && params.type) {
        modoEdicao = true;
        userIdEdicao = params.id;
        tipoUsuarioEdicao = params.type;
        
        // Atualizar título e labels para modo edição
        document.querySelector('.card-header h2').textContent = 'Editar Usuário';
        
        // Carregar dados do usuário para edição
        const user = await eel.obter_usuario_por_id(userIdEdicao, tipoUsuarioEdicao)();
        if (user) {
            document.getElementById('tipo_usuario').value = user.tipo;
            document.getElementById('posto_graduacao').value = user.posto_graduacao;
            document.getElementById('matricula').value = user.matricula;
            document.getElementById('nome').value = user.nome;
            document.getElementById('email').value = user.email || '';
            if (user.tipo === 'operador') {
                document.getElementById('profile').value = user.profile;
                // Atualizar placeholder e label da senha para modo edição
                const senhaInput = document.getElementById('senha');
                const senhaLabel = document.querySelector('label[for="senha"]');
                senhaInput.placeholder = 'Deixe vazio para manter a senha atual';
                senhaLabel.textContent = 'Senha (opcional)';
            }
            // Ajusta campos de acordo com tipo (após definir modo edição)
            toggleOperatorFields();
            // Muda texto do botão
            document.getElementById('btnCadastrar').innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
        }
    }
}

// Lógica para mostrar/esconder campos de operador
document.addEventListener('DOMContentLoaded', () => {
    const tipoUsuarioSelect = document.getElementById('tipo_usuario');
    const operatorFieldsDiv = document.getElementById('operatorFields');
    const senhaInput = document.getElementById('senha');
    const profileSelect = document.getElementById('profile');
    const emailInput = document.getElementById('email');
    const emailGroup = document.getElementById('emailGroup');

    window.toggleOperatorFields = function() {
        if (tipoUsuarioSelect.value === 'operador') {
            operatorFieldsDiv.style.display = 'block';
            // Senha só é obrigatória no cadastro, não na edição
            if (!modoEdicao) {
                senhaInput.setAttribute('required', 'required');
            } else {
                senhaInput.removeAttribute('required');
            }
            profileSelect.setAttribute('required', 'required');
            emailInput.setAttribute('required', 'required');
            emailGroup.style.display = 'block';
        } else {
            operatorFieldsDiv.style.display = 'none';
            senhaInput.removeAttribute('required');
            profileSelect.removeAttribute('required');
            senhaInput.value = '';
            profileSelect.value = '';
            emailInput.removeAttribute('required');
            emailInput.value = '';
            emailGroup.style.display = 'none'; // Esconde campo email para encarregado
        }
    }

    tipoUsuarioSelect.addEventListener('change', toggleOperatorFields);
    
    // Chamar no carregamento inicial para garantir o estado correto
    toggleOperatorFields();
    
    // Carregar dados de edição se necessário
    carregarDadosEdicao();
});

document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo_usuario = document.getElementById('tipo_usuario').value;
    const posto_graduacao = document.getElementById('posto_graduacao').value;
    const matricula = document.getElementById('matricula').value.trim();
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    let senha = null;
    let profile = null;

    // Validação matrícula
    if (!/^1000\d{0,5}$/.test(matricula)) {
        showAlert('A matrícula deve começar com 1000 e ter no máximo 9 dígitos!', 'error');
        return;
    }
    if (matricula.length > 9) {
        showAlert('A matrícula não pode ter mais que 9 dígitos!', 'error');
        return;
    }

    if (tipo_usuario === 'operador') {
        senha = document.getElementById('senha').value;
        profile = document.getElementById('profile').value;
        
        // Validação de senha
        if (modoEdicao) {
            // No modo edição, senha é opcional - se fornecida, deve ter pelo menos 4 caracteres
            if (senha && senha.trim() && senha.trim().length < 4) {
                showAlert('Se informada, a senha deve ter pelo menos 4 caracteres!', 'error');
                return;
            }
            // Se campo vazio, não altera a senha
            senha = senha && senha.trim() ? senha.trim() : null;
        } else {
            // No cadastro, senha é obrigatória
            if (!senha || senha.trim().length < 4) {
                showAlert('Senha é obrigatória e deve ter pelo menos 4 caracteres para operadores!', 'error');
                return;
            }
        }
        
        if (!profile) {
            showAlert('Perfil é obrigatório para operadores!', 'error');
            return;
        }
    }
    if (!tipo_usuario || !posto_graduacao || !matricula || !nome) {
        showAlert('Por favor, preencha todos os campos obrigatórios!', 'error');
        return;
    }
    if (tipo_usuario === 'operador' && !email) {
        showAlert('Email é obrigatório para operadores!', 'error');
        return;
    }
    await submitUser(tipo_usuario, posto_graduacao, matricula, nome, email, senha, profile, modoEdicao, userIdEdicao);
});

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados do usuário logado primeiro
    await carregarUsuarioLogado();
});
