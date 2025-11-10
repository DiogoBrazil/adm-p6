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
                const startTs = Date.now();
                await eel.fazer_logout()();
                const loader = document.getElementById('globalLoader');
                if (loader) loader.classList.remove('hidden');
                const elapsed = Date.now() - startTs;
                const toWait = Math.max(0, 1000 - elapsed);
                if (toWait > 0) await new Promise(r => setTimeout(r, toWait));
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
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
    // Remover modal existente se houver
    let existingModal = document.getElementById('confirmModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-feedback';
    modal.innerHTML = `
        <div class="modal-content">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; font-size: 3rem; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 15px; color: #333; font-size: 1.5rem;">${title}</h3>
            <p style="margin-bottom: 25px; color: #666; font-size: 1rem;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="confirmCancel" class="btn-secondary" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Cancelar</button>
                <button id="confirmOk" class="btn-danger" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.style.display = 'flex';

    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    const closeModal = () => { modal.style.display = 'none'; };
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => { closeModal(); onConfirm(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
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
        // Se for apenas data (YYYY-MM-DD), formatar sem hora
        if (dateString.length === 10 && dateString.includes('-')) {
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        }
        
        // Caso contrário, usar formatação completa
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
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
        
        // Carregar estatísticas
        await loadUserStats();
        
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
    
    // Informações do usuário
    document.getElementById('infoNome').textContent = user.nome;
    document.getElementById('infoPosto').textContent = user.posto_graduacao;
    document.getElementById('infoMatricula').textContent = user.matricula;
    document.getElementById('infoEmail').textContent = user.email || 'Não informado';
    document.getElementById('infoStatus').textContent = user.ativo ? 'Ativo' : 'Inativo';
    
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
        const profileRow = document.getElementById('profileItem');
        profileRow.style.display = 'table-row';
        document.getElementById('infoPerfil').textContent = user.profile === 'admin' ? 'Administrador' : 'Comum';
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
            
            // Criar grid detalhado com todas as estatísticas
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
            label: 'PAD', 
            value: stats.encarregado_pad, 
            desc: 'Encarregado de PAD', 
            gradient: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)'
        },
        { 
            label: 'PADE', 
            value: stats.encarregado_pade, 
            desc: 'Encarregado de PADE', 
            gradient: 'linear-gradient(135deg, #20c997 0%, #1a9d87 100%)'
        },
        { 
            label: 'Feito Preliminar', 
            value: stats.encarregado_feito_preliminar, 
            desc: 'Encarregado de FP', 
            gradient: 'linear-gradient(135deg, #fd7e14 0%, #dc6502 100%)'
        },
        { 
            label: 'Carta Precatória', 
            value: stats.encarregado_cp, 
            desc: 'Encarregado de CP', 
            gradient: 'linear-gradient(135deg, #e83e8c 0%, #d91a72 100%)'
        },
        { 
            label: 'Conselho Disciplina', 
            value: stats.encarregado_cd, 
            desc: 'Encarregado de CD', 
            gradient: 'linear-gradient(135deg, #6610f2 0%, #5a0bc2 100%)'
        },
        { 
            label: 'Conselho Justificação', 
            value: stats.encarregado_cj, 
            desc: 'Encarregado de CJ', 
            gradient: 'linear-gradient(135deg, #fd7e14 0%, #e66a00 100%)'
        },
        { 
            label: 'Escrivão', 
            value: stats.escrivao, 
            desc: 'Atuando como escrivão', 
            gradient: 'linear-gradient(135deg, #6c757d 0%, #545b62 100%)'
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
    // Inicializar sistema de permissões
    if (window.permissoes) {
        await window.permissoes.inicializar();
    }
    
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
