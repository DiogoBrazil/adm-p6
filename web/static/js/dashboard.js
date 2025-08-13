
// Dashboard JavaScript - Menu Toggle e Responsividade

// Variáveis globais
let usuarioLogado = null;

// Event listeners principais
document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar funcionalidades do sidebar
    initializeSidebar();
    
    // Inicializar animações
    initializeAnimations();
    
    // Carregar dados do usuário
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Atualizar estatísticas
        updateStats();
        sessionStorage.removeItem('justLoggedIn');
    }
});

// Função para inicializar sidebar
function initializeSidebar() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const navLinks = document.querySelectorAll('.nav-link');

    // Toggle menu móvel
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
            
            // Criar overlay se não existir
            let overlay = document.querySelector('.sidebar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                document.body.appendChild(overlay);
                
                // Fechar menu ao clicar no overlay
                overlay.addEventListener('click', function() {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                });
            }
            
            // Ativar/desativar overlay
            overlay.classList.toggle('active', sidebar.classList.contains('open'));
        });
    }

    // Gerenciar estado ativo dos links de navegação
    const currentPath = window.location.pathname;
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        const parentItem = link.closest('.nav-item');
        
        if (href && currentPath.includes(href) && href !== '/') {
            parentItem.classList.add('active');
        } else if (href === '/' && (currentPath === '/' || currentPath === '/dashboard')) {
            parentItem.classList.add('active');
        }
    });

    // Fechar menu móvel ao redimensionar para desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('open');
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        }
    });
}

// Função para inicializar animações
function initializeAnimations() {
    // Animação de entrada dos elementos
    const animatedElements = document.querySelectorAll('.stat-card, .action-btn');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
            }
        });
    }, {
        threshold: 0.1
    });

    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
}

// Função para atualizar estatísticas do dashboard
function updateStats() {
    // Carregar estatísticas dos processos em andamento
    carregarEstatisticasProcessos();
}

// Função para carregar estatísticas dos processos
async function carregarEstatisticasProcessos() {
    try {
        const resultado = await eel.obter_estatisticas_processos_andamento()();
        
        if (resultado.sucesso) {
            criarCardsProcessos(resultado.andamento, resultado.concluidos, resultado.total_processos);
        } else {
            console.error('Erro ao carregar estatísticas:', resultado.erro);
            showAlert('Erro ao carregar estatísticas dos processos', 'error');
        }
    } catch (error) {
        console.error('Erro na chamada Eel:', error);
        showAlert('Erro ao conectar com o servidor', 'error');
    }
}

// Função para criar cards dos processos dinamicamente
function criarCardsProcessos(andamento, concluidos, totalProcessos) {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;
    
    // Limpar grid
    statsGrid.innerHTML = '';
    
    // Definir configuração de ícones e cores para cada tipo
    const tiposConfig = {
        'SR': { icon: 'fas fa-search', cor: 'emerald', nome: 'Sindicâncias' },
        'SINDICANCIA': { icon: 'fas fa-search', cor: 'emerald', nome: 'Sindicâncias' },
        'IPM': { icon: 'fas fa-shield-alt', cor: 'blue', nome: 'IPM' },
        'IPPM': { icon: 'fas fa-shield-alt', cor: 'blue', nome: 'IPPM' },
        'PADS': { icon: 'fas fa-gavel', cor: 'purple', nome: 'PADS' },
        'PAD': { icon: 'fas fa-balance-scale', cor: 'red', nome: 'PAD' },
        'FP': { icon: 'fas fa-file-alt', cor: 'orange', nome: 'Feito Preliminar' },
        'FEITO_PRELIMINAR': { icon: 'fas fa-file-alt', cor: 'orange', nome: 'Feito Preliminar' },
        'CJ': { icon: 'fas fa-gavel', cor: 'indigo', nome: 'Conselho de Justificação' },
        'CD': { icon: 'fas fa-user-times', cor: 'rose', nome: 'Conselho de Disciplina' },
        'OUTROS': { icon: 'fas fa-folder', cor: 'gray', nome: 'Outros' }
    };
    
    // Cores CSS correspondentes
    const coresCss = {
        'emerald': '#10b981',
        'blue': '#1e40af', 
        'purple': '#7c3aed',
        'red': '#dc2626',
        'orange': '#ea580c',
        'indigo': '#4f46e5',
        'rose': '#e11d48',
        'gray': '#6b7280'
    };
    
    // Tipos obrigatórios que sempre devem aparecer (mesmo com 0)
    const tiposObrigatorios = ['SR', 'IPM', 'PADS', 'PAD', 'FP', 'CJ', 'CD'];
    
    // Garantir que todos os tipos obrigatórios estejam no objeto andamento
    tiposObrigatorios.forEach(tipo => {
        if (!andamento.hasOwnProperty(tipo)) {
            andamento[tipo] = 0;
        }
    });
    
    let cardIndex = 0;
    
    // Criar cards para todos os tipos (incluindo os com valor 0)
    Object.entries(andamento).forEach(([tipo, quantidade]) => {
        if (tipo === 'TOTAL') return; // Pular o total
        
        const config = tiposConfig[tipo] || tiposConfig['OUTROS'];
        const cor = coresCss[config.cor];
        
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.style.borderLeft = `4px solid ${cor}`;
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        // Adicionar classe especial para cards com valor 0
        if (quantidade === 0) {
            card.classList.add('zero-value');
        }
        
        card.innerHTML = `
            <div class="stat-icon" style="background: linear-gradient(135deg, ${cor}, ${cor}dd);">
                <i class="${config.icon}"></i>
            </div>
            <div class="stat-content">
                <h3>${quantidade}</h3>
                <p>${config.nome}</p>
            </div>
        `;
        
        statsGrid.appendChild(card);
        
        // Animar entrada do card
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, cardIndex * 150);
        
        cardIndex++;
    });
    
    // Se não há nenhum tipo definido, mostrar mensagem
    if (cardIndex === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.innerHTML = `
            <i class="fas fa-inbox"></i>
            <h3>Nenhum processo cadastrado</h3>
            <p>Não há processos ou procedimentos cadastrados no sistema.</p>
        `;
        statsGrid.appendChild(emptyMessage);
    } else {
        // Animar contadores após todos os cards aparecerem
        setTimeout(() => {
            const statNumbers = document.querySelectorAll('.stat-content h3');
            statNumbers.forEach((stat) => {
                const finalValue = parseInt(stat.textContent) || 0;
                animateCounter(stat, 0, finalValue, 1500);
            });
        }, cardIndex * 150);
    }
}

// Animação de contador para estatísticas
function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function para suavizar a animação
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (end - start) * easeOutQuart);
        
        element.textContent = current.toLocaleString('pt-BR');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

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

// Funções de loading e animação removidas - não são necessárias na página inicial

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    // Remover modal existente se houver (garante consistência visual como na lista)
    let existingModal = document.getElementById('confirmModal');
    if (existingModal) existingModal.remove();

    // Criar novo modal com a mesma estilização da lista
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

    // Mostrar modal
    modal.style.display = 'flex';

    // Event listeners
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');

    const closeModal = () => { modal.style.display = 'none'; };

    // Remover listeners anteriores (clonar)
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));

    // Novos listeners
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => { closeModal(); onConfirm(); });

    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
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

// Função para carregar estatísticas removida - rodapé foi removido

// Função para carregar lista de usuários removida - não é necessária na página inicial

// Função de cadastro removida - não é necessária na página inicial

// Função de logout
async function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            const startTs = Date.now();
            try {
                // Chama backend para invalidar sessão
                await eel.fazer_logout()();

                // Mostra loader global por pelo menos 1s
                const loader = document.querySelector('.global-loader') || document.getElementById('globalLoader');
                if (loader) loader.classList.remove('hidden');

                const elapsed = Date.now() - startTs;
                const toWait = Math.max(0, 1000 - elapsed);
                if (toWait > 0) await new Promise(r => setTimeout(r, toWait));

                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro no logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
                // Esconder loader em caso de erro
                const loader = document.querySelector('.global-loader') || document.getElementById('globalLoader');
                if (loader) loader.classList.add('hidden');
            }
        }
    );
}

// Disponibilizar função globalmente para compatibilidade
window.realizarLogout = realizarLogout;

// Função para animar números removida - não é necessária na página inicial atual

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados iniciais
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Mensagem de boas-vindas removida conforme solicitado
        sessionStorage.removeItem('justLoggedIn');
    }
});

// Event listener do formulário de cadastro removido - não existe na página inicial

// Atalho de teclado para logout (Ctrl+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        realizarLogout();
    }
});

// Smooth scroll para ancoras internas
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Auto-focus removido - não há campos de entrada na página inicial
