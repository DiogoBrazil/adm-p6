// auditoria_list.js - Gestão de listagem de auditorias

let currentPage = 1;
const perPage = 10;
let totalPages = 1;
let searchTerm = '';
let filtros = {
    operacao: '',
    tabela: ''
};

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', async function() {
    await verificarAutenticacao();
    await carregarUsuarioLogado();
    await carregarAuditorias();
    
    // Configurar indicadores iniciais
    atualizarIndicadorFiltros();
    
    // Event listeners
    document.getElementById('searchInput').addEventListener('input', debounce(function(e) {
        searchTerm = (e.target.value || '').trim();
        currentPage = 1;
        carregarAuditorias();
        
        // Atualizar visibilidade do botão limpar
        atualizarVisibilidadeBotaoLimpar();
    }, 500));
    
    document.getElementById('prevPage').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            carregarAuditorias();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            carregarAuditorias();
        }
    });
});

// ========== AUTENTICAÇÃO ==========

async function verificarAutenticacao() {
    try {
        const usuarioLogado = await eel.obter_usuario_logado()();
        if (!usuarioLogado || !usuarioLogado.logado) {
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.href = 'login.html';
    }
}

async function carregarUsuarioLogado() {
    try {
        const usuarioLogado = await eel.obter_usuario_logado()();
        if (usuarioLogado && usuarioLogado.logado) {
            const user = usuarioLogado.usuario;
            document.getElementById('userName').textContent = user.nome || 'Usuário';
            document.getElementById('userEmail').textContent = user.email || user.matricula || 'usuário';
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

async function realizarLogout() {
    try {
        await eel.fazer_logout()();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = 'login.html';
    }
}

// ========== CARREGAMENTO DE DADOS ==========

async function carregarAuditorias() {
    const loaderContainer = document.getElementById('loaderContainer');
    const tableBody = document.getElementById('auditoriaTableBody');
    const emptyState = document.getElementById('emptyState');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    // Mostrar loader
    loaderContainer.style.display = 'flex';
    tableBody.innerHTML = '';
    emptyState.style.display = 'none';
    
    try {
        const resultado = await eel.listar_auditorias(searchTerm, currentPage, perPage, filtros)();
        
        if (resultado.sucesso) {
            const auditorias = resultado.auditorias || [];
            totalPages = resultado.total_pages || 1;
            
            // Atualizar informações de paginação
            pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage >= totalPages;
            
            if (auditorias.length === 0) {
                emptyState.style.display = 'block';
            } else {
                auditorias.forEach(auditoria => {
                    const row = criarLinhaAuditoria(auditoria);
                    tableBody.appendChild(row);
                });
            }
        } else {
            mostrarAlerta(resultado.mensagem || 'Erro ao carregar auditorias', 'error');
            emptyState.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao carregar auditorias:', error);
        mostrarAlerta('Erro ao carregar lista de auditorias', 'error');
        emptyState.style.display = 'block';
    } finally {
        loaderContainer.style.display = 'none';
    }
}

// ========== RENDERIZAÇÃO ==========

function criarLinhaAuditoria(auditoria) {
    const row = document.createElement('tr');
    
    // Usuário
    const tdUsuario = document.createElement('td');
    tdUsuario.style.textAlign = 'left';
    tdUsuario.innerHTML = `<strong>${auditoria.usuario_nome || 'Sistema'}</strong>`;
    row.appendChild(tdUsuario);
    
    // Tabela
    const tdTabela = document.createElement('td');
    tdTabela.style.textAlign = 'center';
    tdTabela.innerHTML = `<span class="tabela-nome">${formatarNomeTabela(auditoria.tabela)}</span>`;
    row.appendChild(tdTabela);
    
    // Registro ID (primeiros 8 caracteres)
    const tdRegistro = document.createElement('td');
    tdRegistro.style.textAlign = 'center';
    tdRegistro.style.fontFamily = "'Courier New', monospace";
    tdRegistro.style.fontSize = '0.9rem';
    tdRegistro.textContent = auditoria.registro_id.substring(0, 8) + '...';
    tdRegistro.title = auditoria.registro_id; // Tooltip com ID completo
    row.appendChild(tdRegistro);
    
    // Operação
    const tdOperacao = document.createElement('td');
    tdOperacao.style.textAlign = 'center';
    tdOperacao.innerHTML = `<span class="badge-operacao badge-${auditoria.operacao.toLowerCase()}">${auditoria.operacao}</span>`;
    row.appendChild(tdOperacao);
    
    // Data e Hora
    const tdDataHora = document.createElement('td');
    tdDataHora.style.textAlign = 'center';
    tdDataHora.textContent = formatarDataHora(auditoria.timestamp);
    row.appendChild(tdDataHora);
    
    return row;
}

// ========== UTILITÁRIOS ==========

function formatarNomeTabela(tabela) {
    const nomes = {
        'usuarios': 'Usuários',
        'processos_procedimentos': 'Processos/Procedimentos',
        'transgressoes': 'Transgressões RDPM',
        'crimes_contravencoes': 'Crimes/Contravenções',
        'infracoes_estatuto_art29': 'Infrações Art. 29'
    };
    return nomes[tabela] || tabela;
}

function formatarDataHora(timestamp) {
    if (!timestamp) return '-';
    
    try {
        const data = new Date(timestamp);
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const hora = String(data.getHours()).padStart(2, '0');
        const minuto = String(data.getMinutes()).padStart(2, '0');
        const segundo = String(data.getSeconds()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} às ${hora}:${minuto}:${segundo}`;
    } catch (error) {
        return timestamp;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const context = this;
        const later = () => {
            clearTimeout(timeout);
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== BUSCA E FILTROS ==========

function limparBusca() {
    document.getElementById('searchInput').value = '';
    searchTerm = '';
    
    // Limpar filtros também
    document.getElementById('filterOperacao').value = '';
    document.getElementById('filterTabela').value = '';
    filtros = { operacao: '', tabela: '' };
    
    currentPage = 1;
    carregarAuditorias();
    
    // Atualizar indicador visual
    atualizarIndicadorFiltros();
}

function abrirModalFiltros() {
    document.getElementById('filterModal').style.display = 'flex';
}

function fecharModalFiltros() {
    document.getElementById('filterModal').style.display = 'none';
}

function aplicarFiltros() {
    filtros.operacao = document.getElementById('filterOperacao').value;
    filtros.tabela = document.getElementById('filterTabela').value;
    currentPage = 1;
    fecharModalFiltros();
    carregarAuditorias();
    
    // Atualizar indicador visual
    atualizarIndicadorFiltros();
}

function limparFiltros() {
    document.getElementById('filterOperacao').value = '';
    document.getElementById('filterTabela').value = '';
    filtros = { operacao: '', tabela: '' };
    currentPage = 1;
    fecharModalFiltros();
    carregarAuditorias();
    
    // Atualizar indicador visual
    atualizarIndicadorFiltros();
}

// ========== INDICADORES VISUAIS ==========

function atualizarIndicadorFiltros() {
    const toggleBtn = document.getElementById('filterToggle');
    let filtrosAplicados = 0;
    
    // Contar quantos filtros estão ativos
    Object.values(filtros).forEach(valor => {
        if (valor && valor.trim()) filtrosAplicados++;
    });
    
    // Remover indicador anterior
    const indicadorExistente = toggleBtn.querySelector('.filter-indicator');
    if (indicadorExistente) {
        indicadorExistente.remove();
    }
    
    // Adicionar novo indicador se houver filtros ativos
    if (filtrosAplicados > 0) {
        const indicador = document.createElement('span');
        indicador.className = 'filter-indicator';
        indicador.textContent = filtrosAplicados;
        toggleBtn.appendChild(indicador);
    }
    
    // Atualizar visibilidade do botão de limpar
    atualizarVisibilidadeBotaoLimpar();
}

function atualizarVisibilidadeBotaoLimpar() {
    const clearButton = document.getElementById('clearButton');
    const searchInput = document.getElementById('searchInput');
    
    if (!clearButton || !searchInput) return;
    
    const termoBusca = searchInput.value.trim();
    const temFiltrosAtivos = Object.values(filtros).some(valor => valor && valor.trim());
    
    // Mostrar botão se houver busca OU filtros ativos
    if (termoBusca !== '' || temFiltrosAtivos) {
        clearButton.style.display = 'inline-flex';
    } else {
        clearButton.style.display = 'none';
    }
}

// ========== ALERTAS ==========

function mostrarAlerta(mensagem, tipo = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    
    const tipoClasse = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-info';
    
    const icone = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[tipo] || 'fa-info-circle';
    
    const alert = document.createElement('div');
    alert.className = `alert ${tipoClasse}`;
    alert.innerHTML = `
        <i class="fas ${icone}"></i>
        <span>${mensagem}</span>
    `;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}
