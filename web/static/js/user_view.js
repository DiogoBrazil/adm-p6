// user_view.js - JavaScript para a página de visualização de usuários

// Variáveis globais
let currentUserId = null;
let currentUserType = null;
let userData = null;
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

// Função para obter parâmetros da URL
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        id: urlParams.get('id'),
        type: urlParams.get('type')
    };
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

    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.style.display = 'flex';
    
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));
    
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Função para mostrar loading
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// Função para esconder loading
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Função para formatar data
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// Função para carregar dados do usuário
async function loadUserData() {
    showLoading();
    
    try {
        const user = await eel.obter_usuario_por_id(currentUserId, currentUserType)();
        
        if (!user) {
            showAlert('Usuário não encontrado!', 'error');
            setTimeout(() => {
                window.location.href = 'user_list.html';
            }, 2000);
            return;
        }
        
        userData = user;
        populateUserData(user);
        
        // Carregar estatísticas se aplicável
        if (currentUserType === 'operador' || currentUserType === 'encarregado') {
            await loadUserStats();
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        showAlert('Erro ao carregar dados do usuário!', 'error');
        setTimeout(() => {
            window.location.href = 'user_list.html';
        }, 2000);
    } finally {
        hideLoading();
    }
}

// Função para popular os dados na interface
function populateUserData(user) {
    // Header do usuário
    document.getElementById('viewUserName').textContent = user.nome;
    document.getElementById('viewUserTitle').textContent = `${user.posto_graduacao} - ${user.matricula}`;
    
    // Ícone baseado no tipo
    const userTypeIcon = document.getElementById('userTypeIcon');
    if (user.tipo === 'operador') {
        if (user.profile === 'admin') {
            userTypeIcon.className = 'fas fa-user-shield';
        } else {
            userTypeIcon.className = 'fas fa-user-cog';
        }
    } else {
        userTypeIcon.className = 'fas fa-user-tie';
    }
    
    // Badge de status
    const userBadge = document.getElementById('userBadge');
    const badgeText = document.getElementById('badgeText');
    if (user.ativo) {
        userBadge.className = 'user-badge';
        badgeText.textContent = 'Ativo';
    } else {
        userBadge.className = 'user-badge inactive';
        badgeText.textContent = 'Inativo';
    }
    
    // Informações básicas
    document.getElementById('infoNome').textContent = user.nome;
    document.getElementById('infoPosto').textContent = user.posto_graduacao;
    document.getElementById('infoMatricula').textContent = user.matricula;
    document.getElementById('infoEmail').textContent = user.email || 'Não informado';
    
    // Tipo de usuário
    let tipoTexto = '';
    if (user.tipo === 'operador') {
        tipoTexto = user.profile === 'admin' ? 'Operador (Administrador)' : 'Operador (Comum)';
    } else {
        tipoTexto = 'Encarregado';
    }
    document.getElementById('infoTipo').textContent = tipoTexto;
    
    // Perfil (só para operadores)
    if (user.tipo === 'operador') {
        document.getElementById('profileItem').style.display = 'block';
        document.getElementById('infoPerfil').textContent = user.profile === 'admin' ? 'Administrador' : 'Comum';
    }
    
    // Informações do sistema
    document.getElementById('infoDataCriacao').textContent = formatDate(user.created_at);
    document.getElementById('infoUltimaAtualizacao').textContent = formatDate(user.updated_at);
    document.getElementById('infoStatus').textContent = user.ativo ? 'Ativo' : 'Inativo';
    document.getElementById('infoId').textContent = user.id;
    
    // Observações específicas
    updateObservations(user);
}

// Função para atualizar observações
function updateObservations(user) {
    const observacaoAcesso = document.getElementById('observacaoAcesso');
    const emailObservation = document.getElementById('emailObservation');
    
    // Observação sobre acesso
    if (user.tipo === 'operador') {
        if (user.profile === 'admin') {
            observacaoAcesso.textContent = 'Este operador possui acesso administrativo completo ao sistema, incluindo gerenciamento de usuários e configurações.';
        } else {
            observacaoAcesso.textContent = 'Este operador possui acesso comum ao sistema para registro e consulta de processos e procedimentos.';
        }
    } else {
        observacaoAcesso.textContent = 'Este encarregado pode ser responsável por processos e procedimentos, mas não possui acesso direto ao sistema.';
    }
    
    // Observação sobre email
    if (!user.email) {
        emailObservation.style.display = 'block';
    } else {
        emailObservation.style.display = 'none';
    }
}

// Função para carregar estatísticas do usuário
async function loadUserStats() {
    try {
        const result = await eel.obter_estatisticas_usuario(currentUserId, currentUserType)();
        
        if (result.sucesso) {
            const stats = result.estatisticas;
            
            // Mostrar card de estatísticas
            const statsCard = document.getElementById('statsCard');
            statsCard.style.display = 'block';
            
            // Atualizar os números das estatísticas
            document.getElementById('statProcessos').textContent = 
                stats.encarregado_sindicancia + stats.encarregado_pads + stats.encarregado_ipm + 
                stats.encarregado_atestado_origem + stats.encarregado_feito_preliminar;
            
            document.getElementById('statEscrivao').textContent = stats.escrivao;
            
            document.getElementById('statEnvolvido').textContent = 
                stats.envolvido_sindicado + stats.envolvido_acusado + stats.envolvido_indiciado + 
                stats.envolvido_investigado + stats.envolvido_acidentado;
            
            // Criar grid detalhado sempre, independente dos valores
            updateDetailedStats(stats);
        } else {
            console.warn('Erro ao carregar estatísticas:', result.erro);
            // Não mostrar erro, apenas ocultar as estatísticas
            document.getElementById('statsCard').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        // Não mostrar erro, apenas ocultar as estatísticas
        document.getElementById('statsCard').style.display = 'none';
    }
}

// Função para atualizar estatísticas detalhadas
function updateDetailedStats(stats) {
    const statsGrid = document.querySelector('.stats-grid');
    
    // Limpar grid atual
    statsGrid.innerHTML = '';
    
    // Definir estatísticas como responsável
    const responsavelStats = [
        { 
            label: 'Sindicância (SR/SV)', 
            value: stats.encarregado_sindicancia, 
            desc: 'Encarregado de Sindicância', 
            gradient: 'linear-gradient(135deg, #28a745 0%, #34ce57 100%)'
        },
        { 
            label: 'PADS', 
            value: stats.encarregado_pads, 
            desc: 'Encarregado de PADS', 
            gradient: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)'
        },
        { 
            label: 'IPM', 
            value: stats.encarregado_ipm, 
            desc: 'Encarregado de IPM', 
            gradient: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)'
        },
        { 
            label: 'Atestado Origem', 
            value: stats.encarregado_atestado_origem, 
            desc: 'Encarregado de AO', 
            gradient: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)'
        },
        { 
            label: 'Feito Preliminar', 
            value: stats.encarregado_feito_preliminar, 
            desc: 'Encarregado de FP', 
            gradient: 'linear-gradient(135deg, #20c997 0%, #1a9d87 100%)'
        },
        { 
            label: 'Escrivão', 
            value: stats.escrivao, 
            desc: 'Atuando como escrivão', 
            gradient: 'linear-gradient(135deg, #fd7e14 0%, #dc6502 100%)'
        }
    ];
    
    // Definir estatísticas como envolvido
    const envolvidoStats = [
        { 
            label: 'Sindicado', 
            value: stats.envolvido_sindicado, 
            desc: 'Envolvido como sindicado', 
            gradient: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)'
        },
        { 
            label: 'Acusado', 
            value: stats.envolvido_acusado, 
            desc: 'Envolvido como acusado', 
            gradient: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
        },
        { 
            label: 'Indiciado', 
            value: stats.envolvido_indiciado, 
            desc: 'Envolvido como indiciado', 
            gradient: 'linear-gradient(135deg, #e83e8c 0%, #d91a72 100%)'
        },
        { 
            label: 'Investigado', 
            value: stats.envolvido_investigado, 
            desc: 'Envolvido como investigado', 
            gradient: 'linear-gradient(135deg, #6c757d 0%, #545b62 100%)'
        },
        { 
            label: 'Acidentado', 
            value: stats.envolvido_acidentado, 
            desc: 'Envolvido como acidentado', 
            gradient: 'linear-gradient(135deg, #795548 0%, #5d4037 100%)'
        }
    ];
    
    // Criar seção "Como Responsável"
    const responsavelSection = document.createElement('div');
    responsavelSection.className = 'stats-section';
    responsavelSection.innerHTML = `
        <div class="section-title">
            <i class="fas fa-user-shield"></i>
            Como Responsável
        </div>
    `;
    statsGrid.appendChild(responsavelSection);
    
    // Adicionar estatísticas de responsável
    responsavelStats.forEach(stat => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-item';
        statElement.title = stat.desc;
        statElement.style.background = stat.gradient;
        
        if (stat.value === 0) {
            statElement.style.opacity = '0.7';
        }
        
        statElement.innerHTML = `
            <div class="stat-number">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        
        statsGrid.appendChild(statElement);
    });
    
    // Criar seção "Como Envolvido"
    const envolvidoSection = document.createElement('div');
    envolvidoSection.className = 'stats-section';
    envolvidoSection.innerHTML = `
        <div class="section-title">
            <i class="fas fa-user-times"></i>
            Como Envolvido
        </div>
    `;
    statsGrid.appendChild(envolvidoSection);
    
    // Adicionar estatísticas de envolvido
    envolvidoStats.forEach(stat => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-item';
        statElement.title = stat.desc;
        statElement.style.background = stat.gradient;
        
        if (stat.value === 0) {
            statElement.style.opacity = '0.7';
        }
        
        statElement.innerHTML = `
            <div class="stat-number">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        
        statsGrid.appendChild(statElement);
    });
}

// Função para editar usuário atual
function editCurrentUser() {
    if (currentUserId && currentUserType) {
        window.location.href = `user_form.html?id=${currentUserId}&type=${currentUserType}`;
    }
}

// Função para voltar
function goBack() {
    window.location.href = 'user_list.html';
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    // Obter parâmetros da URL
    const params = getUrlParams();
    
    if (!params.id || !params.type) {
        showAlert('Parâmetros inválidos!', 'error');
        setTimeout(() => {
            window.location.href = 'user_list.html';
        }, 2000);
        return;
    }
    
    currentUserId = params.id;
    currentUserType = params.type;
    
    // Carrega dados do usuário logado primeiro
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Só carrega os dados se o login estiver ok
        await loadUserData();
    }
});
