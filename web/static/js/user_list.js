// Variáveis de paginação
let currentPage = 1;
const usersPerPage = 10;
let totalUsers = 0;

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
    if (confirm(`Tem certeza que deseja desativar o usuário ${userName} (${userType})?`)) {
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
}

// Event listeners
window.addEventListener('load', async () => {
    await loadUsers();
});

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