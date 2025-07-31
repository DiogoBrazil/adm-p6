// Variáveis de paginação
let currentPage = 1;
const usersPerPage = 10;
let totalUsers = 0;

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

// Função para carregar usuários
async function loadUsers() {
    try {
        const searchInput = document.getElementById('searchUserInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';

        const response = await eel.listar_usuarios(searchTerm, currentPage, usersPerPage)();
        const users = response.users;
        totalUsers = response.total;

        const usersTableBody = document.getElementById('usersTableBody');
        const emptyState = document.getElementById('emptyState');
        const pageInfoSpan = document.getElementById('pageInfo');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        
        if (users.length === 0) {
            usersTableBody.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            usersTableBody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.posto_graduacao}</td>
                    <td>${user.matricula}</td>
                    <td>${user.nome}</td>
                    <td>${user.tipo === 'operador' ? (user.profile === 'admin' ? 'Operador (Admin)' : 'Operador') : 'Encarregado'}</td>
                    <td class="actions-cell">
                        <button class="btn-action edit-btn" onclick="editUser('${user.id}', '${user.tipo}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete-btn" onclick="deleteUser('${user.id}', '${user.tipo}', '${user.nome}')" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Atualizar controles de paginação
        const totalPages = Math.ceil(totalUsers / usersPerPage);
        pageInfoSpan.textContent = `Página ${currentPage} de ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showAlert('Erro ao carregar lista de usuários!', 'error');
    }
}

// Funções de paginação
function nextPage() {
    currentPage++;
    loadUsers();
}

function prevPage() {
    currentPage--;
    loadUsers();
}

// Função para editar usuário (apenas um placeholder por enquanto)
function editUser(userId, userType) {
    window.location.href = `user_form.html?id=${userId}&type=${userType}`;
}

// Função para deletar usuário
async function deleteUser(userId, userType, userName) {
    const tipoTexto = userType === 'operador' ? 'operador' : 'encarregado';
    
    showConfirmModal(
        'Confirmar Exclusão',
        `Tem certeza que deseja desativar o ${tipoTexto} ${userName}?`,
        async () => {
            try {
                const result = await eel.delete_user(userId, userType)();
                if (result.sucesso) {
                    showAlert(result.mensagem, 'success');
                    loadUsers(); // Recarrega a lista após a exclusão
                } else {
                    showAlert(result.mensagem, 'error');
                }
            } catch (error) {
                console.error('Erro ao desativar usuário:', error);
                showAlert('Erro ao desativar usuário!', 'error');
            }
        }
    );
}

// Event listeners
document.getElementById('prevPage').addEventListener('click', prevPage);
document.getElementById('nextPage').addEventListener('click', nextPage);

// Adicionar evento para pesquisa ao digitar e ao clicar no botão
document.getElementById('searchUserInput').addEventListener('keyup', (event) => {
    const clearBtn = document.querySelector('.btn-clear');
    if (event.target.value.length > 0) {
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        if (clearBtn) clearBtn.style.display = 'none';
    }
    if (event.key === 'Enter') {
        currentPage = 1; // Resetar para a primeira página ao pesquisar
        loadUsers();
    }
});

function clearSearch() {
    const searchInput = document.getElementById('searchUserInput');
    if (searchInput) {
        searchInput.value = '';
        currentPage = 1;
        loadUsers();
        const clearBtn = document.querySelector('.btn-clear');
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados do usuário logado primeiro
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Só carrega os usuários se o login estiver ok
        loadUsers();
    }
});