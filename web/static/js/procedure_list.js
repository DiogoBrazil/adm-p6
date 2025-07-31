
// Variáveis globais
let todosOsProcedimentos = [];
let procedimentosFiltrados = [];

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const usuario = await eel.obter_usuario_logado()();
        if (usuario) {
            document.getElementById('userName').textContent = usuario.nome;
            document.getElementById('userEmail').textContent = usuario.email || 'usuário';
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
    }
}

// Função para realizar logout
function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                await eel.realizar_logout()();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
            }
        }
    );
}

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';

    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };

    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Fechar modal clicando fora dele
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const alertDiv = document.createElement('div');
    alertDiv.id = alertId;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button onclick="closeAlert('${alertId}')" class="alert-close">&times;</button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        closeAlert(alertId);
    }, 5000);
}

// Função para fechar alerta
function closeAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (alert) {
        alert.remove();
    }
}

// Função para carregar todos os procedimentos
async function carregarProcedimentos() {
    try {
        const procedimentos = await eel.listar_processos()();
        todosOsProcedimentos = procedimentos || [];
        procedimentosFiltrados = [...todosOsProcedimentos];
        exibirProcedimentos();
    } catch (error) {
        console.error('Erro ao carregar procedimentos:', error);
        showAlert('Erro ao carregar lista de procedimentos!', 'error');
    }
}

// Função para exibir procedimentos na tabela
function exibirProcedimentos() {
    const tableBody = document.getElementById('procedureTableBody');
    const noProceduresMessage = document.getElementById('noProceduresMessage');
    
    if (procedimentosFiltrados.length === 0) {
        tableBody.innerHTML = '';
        noProceduresMessage.style.display = 'block';
        return;
    }
    
    noProceduresMessage.style.display = 'none';
    
    tableBody.innerHTML = procedimentosFiltrados.map(procedimento => `
        <tr>
            <td>${procedimento.numero || 'N/A'}</td>
            <td>
                <div class="procedure-type">
                    <strong>${procedimento.tipo_geral || 'N/A'}</strong>
                    ${procedimento.tipo_detalhe ? `<br><small>${procedimento.tipo_detalhe}</small>` : ''}
                </div>
            </td>
            <td>${procedimento.responsavel || 'N/A'}</td>
            <td>${procedimento.data_criacao ? new Date(procedimento.data_criacao).toLocaleDateString('pt-BR') : 'N/A'}</td>
            <td>
                <div class="action-buttons-inline">
                    <button onclick="editarProcedimento(${procedimento.id})" class="btn-edit" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="excluirProcedimento(${procedimento.id}, '${(procedimento.numero || 'N/A').replace(/'/g, '\\\'')}')" class="btn-delete" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Função para buscar procedimentos
function buscarProcedimentos() {
    const termoBusca = document.getElementById('searchInput').value.toLowerCase().trim();
    const clearButton = document.getElementById('clearButton');
    
    if (termoBusca === '') {
        procedimentosFiltrados = [...todosOsProcedimentos];
        clearButton.style.display = 'none';
    } else {
        procedimentosFiltrados = todosOsProcedimentos.filter(procedimento => 
            (procedimento.responsavel || '').toLowerCase().includes(termoBusca)
        );
        clearButton.style.display = 'inline-block';
    }
    
    exibirProcedimentos();
}

// Função para limpar busca
function limparBusca() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearButton').style.display = 'none';
    procedimentosFiltrados = [...todosOsProcedimentos];
    exibirProcedimentos();
}

// Função para editar procedimento
function editarProcedimento(id) {
    window.location.href = `procedure_form.html?id=${id}`;
}

// Função para excluir procedimento
function excluirProcedimento(id, numero) {
    showConfirmModal(
        'Confirmar Exclusão',
        `Tem certeza que deseja excluir o procedimento "${numero}"?`,
        async () => {
            try {
                await eel.excluir_processo(id)();
                showAlert('Procedimento excluído com sucesso!', 'success');
                carregarProcedimentos(); // Recarrega a lista
            } catch (error) {
                console.error('Erro ao excluir procedimento:', error);
                showAlert('Erro ao excluir procedimento!', 'error');
            }
        }
    );
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    carregarUsuarioLogado();
    carregarProcedimentos();
    
    // Busca em tempo real
    document.getElementById('searchInput').addEventListener('input', buscarProcedimentos);
    
    // Enter para buscar
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarProcedimentos();
        }
    });
});
