// Script da lista de crimes/contravenções - escopo global (sem wrapper condicional)
console.log('🔧 Crime list JS carregado');

// Variáveis globais
let usuarioLogado = null;
let crimesData = [];
let crimeParaExcluir = null;

// Variáveis para paginação
let currentPage = 1;
let crimesPerPage = 5;
let totalCrimes = 0;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar sistema de permissões
    if (window.permissoes) {
        await window.permissoes.inicializar();
    }
    
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        return; // Para a execução se não estiver autenticado
    }
    inicializarEventos();
    carregarCrimes();
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
            
            return true;
        } else {
            console.log('Usuário não está logado, redirecionando...');
            window.stop();
            window.location.replace('login.html');
            return false;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.replace('login.html');
        return false;
    }
}

function inicializarEventos() {
    // Evento de busca
    const searchInput = document.getElementById('searchInput');
    
    if (!searchInput) {
        console.warn('Elemento de busca não encontrado');
        return;
    }
    
    searchInput.addEventListener('input', debounce(filtrarCrimes, 300));
    
    // Botão limpar
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearSearch);
    }
    
    // Filtros (removidos - mantidos apenas para compatibilidade)
    const tipoFilter = document.getElementById('tipoFilter');
    const dispositivoFilter = document.getElementById('dispositivoFilter');
    
    // Modal de confirmação
    const btnCancelar = document.getElementById('btnCancelar');
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    
    if (btnCancelar) btnCancelar.addEventListener('click', fecharModalConfirmacao);
    if (btnConfirmarExclusao) btnConfirmarExclusao.addEventListener('click', confirmarExclusao);
    
    // Modal de feedback
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', fecharModalFeedback);
    
    // Paginação
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    
    if (prevPage) prevPage.addEventListener('click', () => changePage(currentPage - 1));
    if (nextPage) nextPage.addEventListener('click', () => changePage(currentPage + 1));
    
    // Enter na busca
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            filtrarCrimes();
        }
    });
}

// ============================================
// CARREGAR DADOS
// ============================================

async function carregarCrimes() {
    // Verifica se estamos na página correta
    if (!document.getElementById('crimesTable')) {
        console.warn('Elemento crimesTable não encontrado - possivelmente não estamos na página de crimes');
        return;
    }
    
    try {
        mostrarLoading(true);
        
        console.log('🔍 Carregando crimes e contravenções...');
        const crimes = await eel.listar_crimes_contravencoes()();
        
        if (crimes && crimes.success) {
            // Filtrar apenas crimes ativos (ativo === true)
            const todosOsCrimes = crimes.data || [];
            crimesData = todosOsCrimes.filter(crime => crime.ativo === true);
            totalCrimes = crimesData.length;
            currentPage = 1;
            console.log(`✅ ${crimesData.length} registros ativos carregados (${todosOsCrimes.length} total no banco)`);
            exibirCrimes(crimesData);
        } else {
            console.error('❌ Erro ao carregar crimes:', crimes);
            showAlert('Erro ao carregar dados dos crimes', 'error');
            exibirEstadoVazio();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar crimes:', error);
        showAlert('Erro ao conectar com o servidor', 'error');
        exibirEstadoVazio();
    } finally {
        mostrarLoading(false);
    }
}

// ============================================
// EXIBIR DADOS
// ============================================

function exibirCrimes(crimes) {
    // Função principal que renderiza todos os crimes (usado no carregamento inicial)
    renderizarTabela(crimes);
}

function exibirEstadoVazio() {
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    if (tableResponsive) tableResponsive.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    
    // Esconder controles de paginação
    const paginationControls = document.querySelector('.pagination-controls');
    if (paginationControls) paginationControls.style.display = 'none';
}

// ============================================
// FILTRAR E BUSCAR
// ============================================

function filtrarCrimes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Mostrar/esconder botão limpar
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.style.display = searchTerm ? 'inline-block' : 'none';
    }
    
    let crimesFiltrados = [...crimesData]; // Copia os dados originais
    
    // Filtro por busca textual
    if (searchTerm) {
        crimesFiltrados = crimesFiltrados.filter(crime => 
            crime.artigo.toLowerCase().includes(searchTerm) ||
            crime.descricao_artigo.toLowerCase().includes(searchTerm) ||
            crime.dispositivo_legal.toLowerCase().includes(searchTerm)
        );
    }
    
    console.log(`🔍 Aplicando busca: "${searchTerm}"`);
    console.log(`📋 ${crimesFiltrados.length} registros encontrados de ${crimesData.length} total`);
    
    // Reset para primeira página quando filtrar
    currentPage = 1;
    renderizarTabela(crimesFiltrados);
}

function renderizarTabela(crimes) {
    const tbody = document.querySelector('#crimesTable tbody');
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    if (crimes.length === 0) {
        exibirEstadoVazio();
        return;
    }
    
    // Mostrar tabela e esconder estado vazio
    if (tableResponsive) tableResponsive.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    // Calcular crimes para página atual
    const startIndex = (currentPage - 1) * crimesPerPage;
    const endIndex = startIndex + crimesPerPage;
    const crimesPaginados = crimes.slice(startIndex, endIndex);
    
    // Limpar tbody
    tbody.innerHTML = '';
    
    crimesPaginados.forEach(crime => {
        const row = document.createElement('tr');
        
        // Badge para tipo
        const tipoBadge = crime.tipo === 'Crime' 
            ? '<span class="badge badge-danger">Crime</span>'
            : '<span class="badge badge-warning">Contravenção</span>';
        
        // Status badge
        const statusBadge = crime.ativo 
            ? '<span class="badge badge-success">Ativo</span>'
            : '<span class="badge badge-secondary">Inativo</span>';
        
        // Informações complementares individuais
        const paragrafoCelula = crime.paragrafo ? `<span style="font-weight: bold; color: #666;">§${crime.paragrafo}</span>` : '<span style="color: #ccc;">-</span>';
        const incisoCelula = crime.inciso ? `<span style="font-weight: bold; color: #666;">${crime.inciso}</span>` : '<span style="color: #ccc;">-</span>';
        const alineaCelula = crime.alinea ? `<span style="font-weight: bold; color: #666;">${crime.alinea}</span>` : '<span style="color: #ccc;">-</span>';
        
        // Truncar descrição se muito longa
        const descricaoTruncada = crime.descricao_artigo.length > 40 
            ? crime.descricao_artigo.substring(0, 40) + '...'
            : crime.descricao_artigo;
        
        row.innerHTML = `
            <td>${tipoBadge}</td>
            <td title="${crime.dispositivo_legal}">${crime.dispositivo_legal}</td>
            <td><strong>Art. ${crime.artigo}</strong></td>
            <td title="${crime.descricao_artigo}">${descricaoTruncada}</td>
            <td style="text-align:center;">${paragrafoCelula}</td>
            <td style="text-align:center;">${incisoCelula}</td>
            <td style="text-align:center;">${alineaCelula}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;">
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button class="btn-action btn-edit" onclick="editarCrime('${crime.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="confirmarExclusaoCrime('${crime.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Atualizar controles de paginação
    updatePaginationControls(crimes.length);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    
    const clearButton = document.getElementById('clearButton');
    if (clearButton) clearButton.style.display = 'none';
    
    currentPage = 1;
    renderizarTabela(crimesData);
}

// ============================================
// PAGINAÇÃO
// ============================================

function updatePaginationControls(totalFilteredCrimes) {
    const paginationControls = document.querySelector('.pagination-controls');
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!paginationControls) return;
    
    const totalPages = Math.ceil(totalFilteredCrimes / crimesPerPage);
    
    if (totalFilteredCrimes === 0 || totalPages <= 1) {
        paginationControls.style.display = 'none';
        return;
    }
    
    paginationControls.style.display = 'flex';
    
    // Atualizar botões
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    
    // Atualizar texto
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
}

function changePage(newPage) {
    // Obter crimes filtrados atuais
    const crimesFiltrados = obterCrimesFiltrados();
    const totalPages = Math.ceil(crimesFiltrados.length / crimesPerPage);
    
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    renderizarTabela(crimesFiltrados);
}

function obterCrimesFiltrados() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    let crimesFiltrados = [...crimesData];
    
    if (searchTerm) {
        crimesFiltrados = crimesFiltrados.filter(crime => 
            crime.artigo.toLowerCase().includes(searchTerm) ||
            crime.descricao_artigo.toLowerCase().includes(searchTerm) ||
            crime.dispositivo_legal.toLowerCase().includes(searchTerm)
        );
    }
    
    return crimesFiltrados;
}

// ============================================
// AÇÕES DOS REGISTROS
// ============================================

function editarCrime(crimeId) {
    console.log(`✏️ Editando crime: ${crimeId}`);
    window.location.href = `crime_form.html?id=${crimeId}`;
}

function confirmarExclusaoCrime(crimeId) {
    console.log(`🗑️ Preparando exclusão do crime: ${crimeId}`);
    
    const crime = crimesData.find(c => c.id === crimeId);
    if (!crime) {
        showAlert('Crime não encontrado', 'error');
        return;
    }
    
    crimeParaExcluir = crime;
    
    // Verificar se os elementos existem
    const modal = document.getElementById('modalConfirmacao');
    const crimeArtigo = document.getElementById('crimeArtigo');
    const crimeDescricao = document.getElementById('crimeDescricao');
    
    console.log('🔍 Elementos encontrados:', {
        modal: !!modal,
        crimeArtigo: !!crimeArtigo,
        crimeDescricao: !!crimeDescricao
    });
    
    if (!modal) {
        console.error('❌ Modal não encontrado!');
        showAlert('Erro: Modal não encontrado', 'error');
        return;
    }
    
    if (!crimeArtigo || !crimeDescricao) {
        console.error('❌ Elementos do modal não encontrados!');
        showAlert('Erro: Elementos do modal não encontrados', 'error');
        return;
    }
    
    // Preencher informações no modal
    crimeArtigo.textContent = `${crime.dispositivo_legal} - Art. ${crime.artigo}`;
    crimeDescricao.textContent = crime.descricao_artigo;
    
    console.log('✅ Modal preenchido, tentando exibir...');
    
    // Mostrar modal com estilos inline para garantir centralização
    modal.style.cssText = `
        display: flex !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 10000 !important;
        background: rgba(0, 0, 0, 0.5) !important;
    `;
    
    // Força a remoção da classe que pode estar oculta
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    
    console.log('✅ Modal deve estar visível agora');
    console.log('📊 Estilos do modal:', modal.style.cssText);
}

async function confirmarExclusao() {
    if (!crimeParaExcluir) return;
    
    try {
        console.log(`🗑️ Excluindo crime: ${crimeParaExcluir.id}`);
        
        const resultado = await eel.excluir_crime_contravencao(crimeParaExcluir.id)();
        
        if (resultado && (resultado.sucesso || resultado.success)) {
            console.log('✅ Crime excluído com sucesso');
            showAlert('Crime excluído com sucesso!', 'success');
            
            // Recarregar dados
            await carregarCrimes();
        } else {
            console.error('❌ Erro ao excluir crime:', resultado);
            showAlert(resultado?.mensagem || resultado?.message || 'Erro ao excluir crime', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao excluir crime:', error);
        showAlert('Erro ao conectar com o servidor', 'error');
    } finally {
        fecharModalConfirmacao();
    }
}

// ============================================
// MODAIS
// ============================================

function fecharModalConfirmacao() {
    document.getElementById('modalConfirmacao').style.display = 'none';
    crimeParaExcluir = null;
}

function fecharModalFeedback() {
    document.getElementById('modalFeedback').style.display = 'none';
}

// ============================================
// NAVEGAÇÃO
// ============================================

function voltarParaDashboard() {
    window.location.href = 'dashboard.html';
}

function novoRegistro() {
    window.location.href = 'crime_form.html';
}

async function realizarLogout() {
    console.log('🚪 realizarLogout chamada');
    const showConfirmModal = (title, message, onConfirm) => {
        console.log('📋 Criando modal de confirmação');
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
        console.log('✅ Modal criado e exibido');
        
        const cancelBtn = modal.querySelector('#confirmCancel');
        const okBtn = modal.querySelector('#confirmOk');
        const close = () => (modal.style.display = 'none');
        
        cancelBtn.onclick = close;
        okBtn.onclick = () => { close(); onConfirm(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };
    };

    showConfirmModal('Sair do sistema', 'Tem certeza que deseja encerrar a sessão?', async () => {
        console.log('🔄 Executando logout...');
        const start = Date.now();
        try { await eel.fazer_logout()(); } catch (e) { console.warn('logout falhou, prosseguindo'); }
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'flex';
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1000 - elapsed);
        setTimeout(() => { window.location.href = 'login.html'; }, wait);
    });
}

// ============================================
// UTILITÁRIOS
// ============================================

function mostrarLoading(show) {
    // Não há mais elemento loading no HTML atual
    console.log(show ? 'Carregando...' : 'Carregamento concluído');
}

function showAlert(message, type = 'info', duration = 3000) {
    console.log(`📢 Alert: ${type.toUpperCase()} - ${message}`);
    
    const modal = document.getElementById('modalFeedback');
    const icon = document.getElementById('modalIcon');
    const messageEl = document.getElementById('modalMessage');
    
    // Definir ícone baseado no tipo
    let iconClass = 'fas fa-info-circle';
    let iconColor = '#007bff';
    
    switch (type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            iconColor = '#28a745';
            break;
        case 'error':
            iconClass = 'fas fa-exclamation-circle';
            iconColor = '#dc3545';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            iconColor = '#ffc107';
            break;
    }
    
    icon.innerHTML = `<i class="${iconClass}" style="color: ${iconColor}; font-size: 3rem; margin-bottom: 1rem;"></i>`;
    messageEl.textContent = message;
    
    modal.style.display = 'flex';
    
    // Auto-close para mensagens de sucesso
    if (type === 'success' && duration > 0) {
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                fecharModalFeedback();
            }
        }, duration);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// CSS ADICIONAL PARA BADGES
// ============================================

// Adicionar estilos via JavaScript (será movido para CSS depois)
const style = document.createElement('style');
style.textContent = `
    .badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1;
        text-align: center;
        white-space: nowrap;
        vertical-align: baseline;
        border-radius: 0.25rem;
    }
    
    .badge-danger {
        color: #fff;
        background-color: #dc3545;
    }
    
    .badge-warning {
        color: #212529;
        background-color: #ffc107;
    }
    
    .badge-success {
        color: #fff;
        background-color: #28a745;
    }
    
    .badge-secondary {
        color: #fff;
        background-color: #6c757d;
    }
    
    .crime-info {
        background-color: #f8f9fa;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 1rem 0;
        border-left: 4px solid #007bff;
    }
    
    .filter-section {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
        flex-wrap: wrap;
    }
    
    .filter-select {
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 0.25rem;
        background-color: #fff;
        font-size: 0.9rem;
        min-width: 200px;
    }
    
    .filter-select:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
`;
document.head.appendChild(style);

// Garantir que realizarLogout esteja disponível globalmente
window.realizarLogout = realizarLogout;
