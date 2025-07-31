
// Variáveis globais
let todosOsProcedimentos = [];
let procedimentosFiltrados = [];

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        if (resultado.logado && resultado.usuario) {
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email || 'usuário';
        } else {
            // Se não estiver logado, redireciona para login
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        // Em caso de erro, redireciona para login
        window.location.href = 'login.html';
    }
}

// Função para realizar logout
function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                await eel.fazer_logout()();
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
    modal.classList.add('show');

    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        onConfirm();
    };

    cancelBtn.onclick = () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
    };

    // Fechar modal clicando fora dele
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
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
        console.log("Resposta do servidor (procedimentos):", procedimentos);
        todosOsProcedimentos = procedimentos || [];
        procedimentosFiltrados = [...todosOsProcedimentos];
        console.log("Total de procedimentos carregados:", todosOsProcedimentos.length);
        
        // Verificar imediatamente se temos procedimentos
        if (todosOsProcedimentos.length === 0) {
            console.log("Nenhum procedimento encontrado, mostrando mensagem");
            // Exibir mensagem diretamente
            const noProceduresMessage = document.getElementById('noProceduresMessage');
            const tableWrapper = document.getElementById('tableWrapper');
            
            if (tableWrapper) tableWrapper.style.display = 'none';
            if (noProceduresMessage) {
                noProceduresMessage.style.display = 'block';
                noProceduresMessage.innerHTML = `
                    <div class="empty-state" style="display:block; padding:40px; text-align:center;">
                        <i class="fas fa-folder-open" style="font-size:50px; color:#adb5bd; margin-bottom:20px;"></i>
                        <h3 style="font-size:22px; color:#495057; margin-bottom:15px;">Nenhum registro encontrado</h3>
                        <p style="font-size:16px; color:#6c757d;">Não há processos ou procedimentos cadastrados no sistema.</p>
                    </div>
                `;
            }
        } else {
            // Apenas chamar exibirProcedimentos se houver dados
            exibirProcedimentos();
        }
    } catch (error) {
        console.error('Erro ao carregar procedimentos:', error);
        showAlert('Erro ao carregar lista de procedimentos!', 'error');
        
        // Em caso de erro, também mostrar a mensagem de nenhum registro
        const noProceduresMessage = document.getElementById('noProceduresMessage');
        const tableWrapper = document.getElementById('tableWrapper');
        
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (noProceduresMessage) {
            noProceduresMessage.style.display = 'block';
            noProceduresMessage.innerHTML = `
                <div class="empty-state" style="display:block; padding:40px; text-align:center;">
                    <i class="fas fa-exclamation-circle" style="font-size:50px; color:#dc3545; margin-bottom:20px;"></i>
                    <h3 style="font-size:22px; color:#495057; margin-bottom:15px;">Erro ao carregar registros</h3>
                    <p style="font-size:16px; color:#6c757d;">Ocorreu um erro ao tentar carregar os procedimentos.</p>
                </div>
            `;
        }
    }
}

// Função para exibir procedimentos na tabela
function exibirProcedimentos() {
    const tableBody = document.getElementById('procedureTableBody');
    const noProceduresMessage = document.getElementById('noProceduresMessage');
    const tableWrapper = document.getElementById('tableWrapper');
    
    console.log("Procedimentos filtrados:", procedimentosFiltrados.length);
    
    // Limpar a tabela
    tableBody.innerHTML = '';
    
    // Verificar se temos procedimentos para mostrar
    if (procedimentosFiltrados.length === 0) {
        // Não há procedimentos, ocultar a tabela e mostrar a mensagem
        if (tableWrapper) tableWrapper.style.display = 'none';
        
        if (noProceduresMessage) {
            noProceduresMessage.style.display = 'block';
            
            // Mensagem diferente para busca vs. sem registros
            const searchTerm = document.getElementById('searchInput').value.trim();
            if (searchTerm && todosOsProcedimentos.length > 0) {
                // Resultado da busca está vazio
                noProceduresMessage.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h3>Nenhum registro encontrado</h3>
                        <p>Não foi encontrado nenhum processo ou procedimento com o termo "${searchTerm}".</p>
                    </div>
                `;
            } else {
                // Não há registros no sistema
                noProceduresMessage.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <h3>Nenhum registro encontrado</h3>
                        <p>Não há processos ou procedimentos cadastrados no sistema.</p>
                    </div>
                `;
            }
            
            console.log("Mensagem 'Nenhum registro encontrado' exibida");
        } else {
            console.error("Elemento 'noProceduresMessage' não encontrado!");
        }
    } else {
        // Há procedimentos, mostrar a tabela e ocultar a mensagem
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (noProceduresMessage) noProceduresMessage.style.display = 'none';
        
        // Preencher a tabela com os procedimentos
        tableBody.innerHTML = procedimentosFiltrados.map(procedimento => `
            <tr>
                <td>
                    <strong>${procedimento.numero_formatado || procedimento.numero || 'N/A'}</strong>
                    ${procedimento.processo_sei ? `<br><small>SEI: ${procedimento.processo_sei}</small>` : ''}
                </td>
                <td>
                    <div class="procedure-type">
                        <strong>${procedimento.tipo_detalhe || 'N/A'}</strong>
                        <span class="badge badge-${procedimento.tipo_geral === 'processo' ? 'primary' : 'secondary'}">${procedimento.tipo_geral === 'processo' ? 'Processo' : 'Procedimento'}</span>
                    </div>
                </td>
                <td>
                    <div class="user-info-cell">
                        <strong>${procedimento.responsavel_completo || procedimento.responsavel || 'N/A'}</strong>
                    </div>
                </td>
                <td>${procedimento.nome_pm || 'Não informado'}</td>
                <td>
                    <span class="status-badge ${getStatusBadgeClass(procedimento.status_pm)}">
                        ${procedimento.status_pm || 'Não informado'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons-inline">
                        <button onclick="editarProcedimento('${procedimento.id}')" class="btn-edit" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="excluirProcedimento('${procedimento.id}', '${(procedimento.numero_formatado || procedimento.numero || 'N/A').replace(/'/g, '\\\'')}')" class="btn-delete" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Função para buscar procedimentos
function buscarProcedimentos() {
    const termoBusca = document.getElementById('searchInput').value.toLowerCase().trim();
    const clearButton = document.getElementById('clearButton');
    
    if (termoBusca === '') {
        procedimentosFiltrados = [...todosOsProcedimentos];
        clearButton.style.display = 'none';
    } else {
        procedimentosFiltrados = todosOsProcedimentos.filter(procedimento => {
            return (
                // Busca por número formatado
                (procedimento.numero_formatado || '').toLowerCase().includes(termoBusca) ||
                // Busca por número original
                (procedimento.numero || '').toLowerCase().includes(termoBusca) ||
                // Busca por responsável
                (procedimento.responsavel || '').toLowerCase().includes(termoBusca) ||
                // Busca pelo nome completo do responsável
                (procedimento.responsavel_completo || '').toLowerCase().includes(termoBusca) ||
                // Busca pelo tipo de detalhe (PADS, IPM, etc.)
                (procedimento.tipo_detalhe || '').toLowerCase().includes(termoBusca) ||
                // Busca pelo nome do PM envolvido
                (procedimento.nome_pm || '').toLowerCase().includes(termoBusca) ||
                // Busca pelo status do PM
                (procedimento.status_pm || '').toLowerCase().includes(termoBusca) ||
                // Busca por número do processo SEI
                (procedimento.processo_sei || '').toLowerCase().includes(termoBusca)
            );
        });
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

// Função para obter a classe CSS para o status do PM
function getStatusBadgeClass(status) {
    if (!status) return 'status-none';
    
    status = status.toLowerCase();
    
    if (status.includes('acusado') || status.includes('investigado')) {
        return 'status-danger';
    } else if (status.includes('testemunha')) {
        return 'status-warning';
    } else if (status.includes('vítima')) {
        return 'status-info';
    } else if (status.includes('sindicado')) {
        return 'status-primary';
    } else {
        return 'status-secondary';
    }
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

// Função para verificar e garantir que a mensagem de "nenhum registro" seja exibida corretamente
function verificarEstadoVazioTabela() {
    const tableBody = document.getElementById('procedureTableBody');
    const noProceduresMessage = document.getElementById('noProceduresMessage');
    const tableWrapper = document.getElementById('tableWrapper');
    const table = document.querySelector('.user-table');
    
    console.log("Verificando estado da tabela:");
    console.log("- procedimentosFiltrados.length:", procedimentosFiltrados.length);
    console.log("- Elemento tableBody existe:", !!tableBody);
    console.log("- Elemento noProceduresMessage existe:", !!noProceduresMessage);
    console.log("- Elemento tableWrapper existe:", !!tableWrapper);
    
    if (procedimentosFiltrados.length === 0) {
        console.log("Não há registros, exibindo mensagem...");
        // Esconder a tabela
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (table) table.style.display = 'none';
        
        // Mostrar a mensagem
        if (noProceduresMessage) {
            noProceduresMessage.style.display = 'block';
            noProceduresMessage.style.visibility = 'visible';
            console.log("Visibilidade de noProceduresMessage após atualização:", noProceduresMessage.style.display);
            
            // Forçar a exibição da mensagem
            noProceduresMessage.innerHTML = `
                <div class="empty-state" style="display:block; padding:40px; text-align:center;">
                    <i class="fas fa-folder-open" style="font-size:50px; color:#adb5bd; margin-bottom:20px;"></i>
                    <h3 style="font-size:22px; color:#495057; margin-bottom:15px;">Nenhum registro encontrado</h3>
                    <p style="font-size:16px; color:#6c757d;">Não há processos ou procedimentos cadastrados no sistema.</p>
                </div>
            `;
        }
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM carregado, inicializando...");

    // Verificar se os elementos existem
    const noProceduresMessage = document.getElementById('noProceduresMessage');
    const tableWrapper = document.getElementById('tableWrapper');
    
    console.log("Elementos encontrados: ", {
        noProceduresMessage: !!noProceduresMessage,
        tableWrapper: !!tableWrapper
    });
    
    // Garantir que o estado inicial esteja correto
    if (noProceduresMessage) noProceduresMessage.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'block';
    
    // Carregar dados
    carregarUsuarioLogado();
    carregarProcedimentos();
    
    // Verificar estado da tabela após pequenos intervalos
    setTimeout(verificarEstadoVazioTabela, 500);
    setTimeout(verificarEstadoVazioTabela, 1000);
    setTimeout(verificarEstadoVazioTabela, 2000);
    
    // Busca em tempo real
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', buscarProcedimentos);
        
        // Enter para buscar
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                buscarProcedimentos();
            }
        });
    }
});
