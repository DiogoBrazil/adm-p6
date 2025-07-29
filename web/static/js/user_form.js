
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

// Lógica para mostrar/esconder campos de operador
document.addEventListener('DOMContentLoaded', () => {
    const tipoUsuarioSelect = document.getElementById('tipo_usuario');
    const operatorFieldsDiv = document.getElementById('operatorFields');
    const senhaInput = document.getElementById('senha');
    const profileSelect = document.getElementById('profile');

    function toggleOperatorFields() {
        if (tipoUsuarioSelect.value === 'operador') {
            operatorFieldsDiv.style.display = 'block';
            senhaInput.setAttribute('required', 'required');
            profileSelect.setAttribute('required', 'required');
        } else {
            operatorFieldsDiv.style.display = 'none';
            senhaInput.removeAttribute('required');
            profileSelect.removeAttribute('required');
            senhaInput.value = ''; // Limpa a senha se o campo for ocultado
            profileSelect.value = ''; // Limpa o perfil se o campo for ocultado
        }
    }

    tipoUsuarioSelect.addEventListener('change', toggleOperatorFields);
    // Chamar no carregamento inicial para garantir o estado correto
    toggleOperatorFields();
});

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
            if (!modoEdicao) document.getElementById('userForm').reset();
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

document.addEventListener('DOMContentLoaded', async () => {
    // ...existing code...
    const params = getUrlParams();
    if (params.id && params.type) {
        modoEdicao = true;
        userIdEdicao = params.id;
        tipoUsuarioEdicao = params.type;
        // Carregar dados do usuário para edição
        const user = await eel.obter_usuario_por_id(userIdEdicao, tipoUsuarioEdicao)();
        if (user) {
            document.getElementById('tipo_usuario').value = user.tipo;
            document.getElementById('posto_graduacao').value = user.posto_graduacao;
            document.getElementById('matricula').value = user.matricula;
            document.getElementById('nome').value = user.nome;
            document.getElementById('email').value = user.email;
            if (user.tipo === 'operador') {
                document.getElementById('profile').value = user.profile;
                // Senha não é retornada por segurança, campo fica vazio
            }
            // Ajusta campos de acordo com tipo
            document.getElementById('tipo_usuario').dispatchEvent(new Event('change'));
            // Muda texto do botão
            document.getElementById('btnCadastrar').innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
        }
    }
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
    if (tipo_usuario === 'operador') {
        senha = document.getElementById('senha').value;
        profile = document.getElementById('profile').value;
        if (modoEdicao && !senha) {
            senha = null; // Não altera senha se campo vazio
        } else if (!modoEdicao && (!senha || senha.length < 4)) {
            showAlert('Senha é obrigatória e deve ter pelo menos 4 caracteres para operadores!', 'error');
            return;
        }
        if (!profile) {
            showAlert('Perfil é obrigatório para operadores!', 'error');
            return;
        }
    }
    if (!tipo_usuario || !posto_graduacao || !matricula || !nome || !email) {
        showAlert('Por favor, preencha todos os campos obrigatórios!', 'error');
        return;
    }
    await submitUser(tipo_usuario, posto_graduacao, matricula, nome, email, senha, profile, modoEdicao, userIdEdicao);
});
