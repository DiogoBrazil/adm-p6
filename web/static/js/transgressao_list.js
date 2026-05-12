// JavaScript de transgressões - versão sem verificação condicional
console.log('🚀 JavaScript de transgressões carregado diretamente');

// Variáveis globais
let usuarioLogado = null;
let transgressoes = [];
let transgressoesFiltradas = [];
let currentPage = 1;
let itemsPerPage = 6; // Limitando a 6 transgressões por página
let transgressaoParaExcluir = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔧 Iniciando sistema de transgressões...');
    
    // Inicializar sistema de permissões
    if (window.permissoes) {
        await window.permissoes.inicializar();
    }
    
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        return; // Para a execução se não estiver autenticado
    }
    
    inicializarEventos();
    await carregarTransgressoes();
});

async function verificarAutenticacao() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            
            if (userNameElement) userNameElement.textContent = usuarioLogado.nome;
            if (userEmailElement) userEmailElement.textContent = usuarioLogado.email;
            
            console.log('✅ Usuário autenticado:', usuarioLogado.nome);
            return true;
        } else {
            console.log('❌ Usuário não está logado, redirecionando...');
            window.stop();
            window.location.replace('login.html');
            return false;
        }
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        window.location.replace('login.html');
        return false;
    }
}

function inicializarEventos() {
    // Busca em tempo real
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', realizarBusca);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                realizarBusca();
            }
        });
    }
    
    // Filtros
    const gravidadeFilter = document.getElementById('gravidadeFilter');
    if (gravidadeFilter) {
        gravidadeFilter.addEventListener('change', aplicarFiltros);
    }
    
    // Controles de paginação
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    
    if (prevPage) prevPage.addEventListener('click', paginaAnterior);
    if (nextPage) nextPage.addEventListener('click', proximaPagina);
    
    // Modal de confirmação
    const btnCancelar = document.getElementById('btnCancelar');
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    const modalConfirmacao = document.getElementById('modalConfirmacao');
    
    console.log('🔍 Verificando elementos do modal:', {
        btnCancelar: !!btnCancelar,
        btnConfirmarExclusao: !!btnConfirmarExclusao,
        modalConfirmacao: !!modalConfirmacao
    });
    
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            console.log('🚫 Botão cancelar clicado');
            if (modalConfirmacao) modalConfirmacao.style.display = 'none';
            transgressaoParaExcluir = null;
        });
    }
    
    if (btnConfirmarExclusao) {
        btnConfirmarExclusao.addEventListener('click', confirmarExclusao);
        console.log('✅ Event listener adicionado ao botão confirmar exclusão');
    } else {
        console.error('❌ Botão confirmar exclusão não encontrado');
    }
    
    // Fechar modal clicando fora
    if (modalConfirmacao) {
        modalConfirmacao.addEventListener('click', function(e) {
            if (e.target === modalConfirmacao) {
                modalConfirmacao.style.display = 'none';
                transgressaoParaExcluir = null;
            }
        });
    }
    
    console.log('✅ Eventos inicializados');
}

// ============================================
// CARREGAMENTO E RENDERIZAÇÃO
// ============================================

async function carregarTransgressoes() {
    try {
        console.log('📊 Carregando transgressões...');
        
        mostrarLoading(true);
        
        const resultado = await eel.listar_todas_transgressoes()();
        
        console.log('📋 Resultado da API:', resultado);
        
        if (resultado.success) {
            transgressoes = resultado.data || [];
            transgressoesFiltradas = [...transgressoes];
            
            console.log(`✅ ${transgressoes.length} transgressões carregadas`);
            
            currentPage = 1;
            renderizarTabela();
            atualizarPaginacao();
            
            if (transgressoes.length === 0) {
                mostrarEstadoVazio();
            } else {
                ocultarEstadoVazio();
            }
        } else {
            console.error('❌ Erro ao carregar transgressões:', resultado.error);
            showAlert('Erro ao carregar transgressões: ' + resultado.error, 'error');
            mostrarEstadoVazio();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar transgressões:', error);
        showAlert('Erro ao carregar transgressões. Tente novamente.', 'error');
        mostrarEstadoVazio();
    } finally {
        mostrarLoading(false);
    }
}

function renderizarTabela() {
    const tbody = document.getElementById('transgressoesTableBody');
    if (!tbody) {
        console.error('❌ Elemento tbody não encontrado');
        return;
    }
    
    console.log('🔄 Renderizando tabela com', transgressoesFiltradas.length, 'transgressões');
    
    // Calcular itens da página atual
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itensPagina = transgressoesFiltradas.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (itensPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                    <i class="fas fa-search"></i>
                    Nenhuma transgressão encontrada
                </td>
            </tr>
        `;
        return;
    }
    
    itensPagina.forEach(transgressao => {
        const row = document.createElement('tr');
        
        // Calcular natureza baseada no artigo
        const artigoParaNatureza = {
            15: 'Leve',
            16: 'Média',
            17: 'Grave'
        };
        const natureza = artigoParaNatureza[transgressao.artigo] || transgressao.gravidade || 'N/A';
        
        // Escapar aspas para evitar erros no onclick
        const incisoEscaped = transgressao.inciso.replace(/'/g, "\\'");
        
        console.log(`🔨 Criando botão para transgressão ID: ${transgressao.id}, artigo: ${transgressao.artigo}, natureza: ${natureza}, inciso: ${incisoEscaped}`);
        
        row.innerHTML = `
            <td style="text-align: center; font-weight: bold;">${transgressao.artigo || '-'}</td>
            <td><span class="badge badge-${getBadgeClass(natureza)}">${natureza}</span></td>
            <td style="text-align: center; font-weight: bold;">${transgressao.inciso}</td>
            <td class="texto-cell">${transgressao.texto}</td>
            <td style="text-align: center;">
                <span class="status-badge ${transgressao.ativo ? 'status-ativo' : 'status-inativo'}">
                    <i class="fas fa-${transgressao.ativo ? 'check-circle' : 'times-circle'}"></i>
                    ${transgressao.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button class="btn-action btn-edit" onclick="editarTransgressao(${transgressao.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="confirmarExclusaoTransgressao(${transgressao.id}, ${transgressao.artigo}, '${incisoEscaped}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    console.log('✅ Tabela renderizada com', itensPagina.length, 'itens');
}

function getBadgeClass(natureza) {
    switch(natureza) {
        case 'Leve': return 'success';
        case 'Média': return 'warning';
        case 'Grave': return 'danger';
        default: return 'secondary';
    }
}

// ============================================
// BUSCA E FILTROS
// ============================================

function realizarBusca() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    
    if (!searchInput) return;
    
    const termo = searchInput.value.toLowerCase().trim();
    
    if (termo === '') {
        transgressoesFiltradas = [...transgressoes];
        if (clearButton) clearButton.style.display = 'none';
    } else {
        transgressoesFiltradas = transgressoes.filter(transgressao => 
            transgressao.inciso.toLowerCase().includes(termo) ||
            transgressao.texto.toLowerCase().includes(termo) ||
            transgressao.gravidade.toLowerCase().includes(termo)
        );
        if (clearButton) clearButton.style.display = 'inline-block';
    }
    
    aplicarFiltros();
}

function aplicarFiltros() {
    const gravidadeFilter = document.getElementById('gravidadeFilter');
    
    let transgressoesFiltro = [...transgressoesFiltradas];
    
    // Filtro por gravidade
    if (gravidadeFilter && gravidadeFilter.value) {
        transgressoesFiltro = transgressoesFiltro.filter(t => t.gravidade === gravidadeFilter.value);
    }
    
    transgressoesFiltradas = transgressoesFiltro;
    currentPage = 1;
    renderizarTabela();
    atualizarPaginacao();
    
    console.log(`🔍 ${transgressoesFiltradas.length} transgressões após filtros`);
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    if (clearButton) {
        clearButton.style.display = 'none';
    }
    
    transgressoesFiltradas = [...transgressoes];
    aplicarFiltros();
}

// ============================================
// PAGINAÇÃO
// ============================================

function atualizarPaginacao() {
    const totalPages = Math.ceil(transgressoesFiltradas.length / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages || 1}`;
    }
    
    if (prevPage) {
        prevPage.disabled = currentPage <= 1;
    }
    
    if (nextPage) {
        nextPage.disabled = currentPage >= totalPages;
    }
}

function paginaAnterior() {
    if (currentPage > 1) {
        currentPage--;
        renderizarTabela();
        atualizarPaginacao();
    }
}

function proximaPagina() {
    const totalPages = Math.ceil(transgressoesFiltradas.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderizarTabela();
        atualizarPaginacao();
    }
}

// ============================================
// AÇÕES DE CRUD
// ============================================

function novaTransgressao() {
    window.location.href = 'transgressao_form.html';
}

function editarTransgressao(id) {
    window.location.href = `transgressao_form.html?id=${id}`;
}

function confirmarExclusaoTransgressao(id, artigo, inciso) {
    console.log('🗑️ Função confirmarExclusaoTransgressao chamada com:', {id, artigo, inciso});
    
    transgressaoParaExcluir = id;
    
    const modalConfirmacao = document.getElementById('modalConfirmacao');
    const transgressaoInciso = document.getElementById('transgressaoInciso');
    const transgressaoDescricao = document.getElementById('transgressaoDescricao');
    
    console.log('🔍 Elementos encontrados:', {
        modalConfirmacao: !!modalConfirmacao,
        transgressaoInciso: !!transgressaoInciso,
        transgressaoDescricao: !!transgressaoDescricao
    });
    
    // Calcular natureza baseada no artigo
    const artigoParaNatureza = {
        15: 'Leve',
        16: 'Média',
        17: 'Grave'
    };
    const natureza = artigoParaNatureza[artigo] || 'N/A';
    
    if (transgressaoInciso) transgressaoInciso.textContent = inciso;
    if (transgressaoDescricao) transgressaoDescricao.textContent = `Artigo ${artigo} - ${natureza}`;
    
    if (modalConfirmacao) {
        modalConfirmacao.style.display = 'flex';
        console.log('✅ Modal de confirmação exibido');
    } else {
        console.error('❌ Modal de confirmação não encontrado');
    }
}

async function confirmarExclusao() {
    console.log('🗑️ Função confirmarExclusao chamada');
    
    if (!transgressaoParaExcluir) {
        console.error('❌ Nenhuma transgressão selecionada para exclusão');
        return;
    }
    
    console.log(`🎯 Excluindo transgressão ID: ${transgressaoParaExcluir}`);
    
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    const originalText = btnConfirmarExclusao ? btnConfirmarExclusao.innerHTML : '';
    
    try {
        // Loading state
        if (btnConfirmarExclusao) {
            btnConfirmarExclusao.disabled = true;
            btnConfirmarExclusao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        }
        
        console.log(`🗑️ Excluindo transgressão ID: ${transgressaoParaExcluir}`);
        
        const resultado = await eel.excluir_transgressao(transgressaoParaExcluir)();
        
        if (resultado.success) {
            showAlert('Transgressão excluída com sucesso!', 'success');
            
            // Fechar modal
            const modalConfirmacao = document.getElementById('modalConfirmacao');
            if (modalConfirmacao) modalConfirmacao.style.display = 'none';
            
            // Recarregar dados
            await carregarTransgressoes();
        } else {
            showAlert('Erro ao excluir transgressão: ' + resultado.error, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao excluir transgressão:', error);
        showAlert('Erro ao excluir transgressão. Tente novamente.', 'error');
    } finally {
        // Restaurar estado do botão
        if (btnConfirmarExclusao) {
            btnConfirmarExclusao.disabled = false;
            btnConfirmarExclusao.innerHTML = originalText;
        }
        
        transgressaoParaExcluir = null;
    }
}

// ============================================
// UTILITÁRIOS
// ============================================

function voltarParaDashboard() {
    window.location.href = 'dashboard.html';
}

function mostrarEstadoVazio() {
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('transgressoesTable');
    const pagination = document.querySelector('.pagination-controls');
    
    if (emptyState) emptyState.style.display = 'block';
    if (table) table.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
}

function ocultarEstadoVazio() {
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('transgressoesTable');
    const pagination = document.querySelector('.pagination-controls');
    
    if (emptyState) emptyState.style.display = 'none';
    if (table) table.style.display = 'table';
    if (pagination) pagination.style.display = 'flex';
}

function mostrarLoading(show) {
    console.log(show ? '⏳ Carregando...' : '✅ Carregamento concluído');
}

function showAlert(message, type = 'info', duration = 3000) {
    console.log(`📢 Alert: ${type.toUpperCase()} - ${message}`);
    
    const modal = document.getElementById('modalFeedback');
    const icon = document.getElementById('modalIcon');
    const messageElement = document.getElementById('modalMessage');
    const closeBtn = document.getElementById('modalCloseBtn');
    
    if (!modal || !icon || !messageElement || !closeBtn) {
        console.log('Elementos do modal não encontrados, usando alert nativo');
        alert(message);
        return;
    }
    
    // Configurar ícone e cor baseado no tipo
    let iconClass = 'fas fa-info-circle';
    let iconColor = '#17a2b8';
    
    if (type === 'success') {
        iconClass = 'fas fa-check-circle';
        iconColor = '#28a745';
    } else if (type === 'error' || type === 'danger') {
        iconClass = 'fas fa-exclamation-triangle';
        iconColor = '#dc3545';
    } else if (type === 'warning') {
        iconClass = 'fas fa-exclamation-circle';
        iconColor = '#ffc107';
    }
    
    icon.innerHTML = `<i class="${iconClass}" style="color: ${iconColor}; font-size: 2rem;"></i>`;
    messageElement.textContent = message;
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Auto fechar após duração especificada
    if (duration > 0) {
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        }, duration);
    }
    
    // Evento de fechar
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Fechar ao clicar fora do modal
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

async function realizarLogout() {
    const showConfirmModal = (title, message, onConfirm) => {
        let modal = document.getElementById('confirmModal');
        if (modal) modal.remove();
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal-feedback';
        modal.innerHTML = `
            <div class="modal-content">
                <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; font-size: 3rem; margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px; color: #333; font-size: 1.5rem;">${title}</h3>
                <p style="margin-bottom: 25px; color: #666; font-size: 1rem;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirmCancel" class="btn-secondary">Cancelar</button>
                    <button id="confirmOk" class="btn-danger">Sair</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        const cancelBtn = modal.querySelector('#confirmCancel');
        const okBtn = modal.querySelector('#confirmOk');
        const close = () => (modal.style.display = 'none');
        cancelBtn.onclick = close;
        okBtn.onclick = () => { close(); onConfirm(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };
    };

    showConfirmModal('Confirmar Logout', 'Tem certeza que deseja encerrar a sessão?', async () => {
        const start = Date.now();
        try { await eel.fazer_logout()(); } catch (e) { console.warn('logout falhou, redirecionando assim mesmo'); }
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'flex';
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1000 - elapsed);
        setTimeout(() => { window.location.href = 'login.html'; }, wait);
    });
}

// ============================================
// VERIFICAÇÃO DE SEGURANÇA
// ============================================

// Fim da verificação de segurança - removida temporariamente
