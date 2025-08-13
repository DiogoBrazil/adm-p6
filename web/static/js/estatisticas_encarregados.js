// Estatísticas por Encarregado - JavaScript

// Variáveis globais
let usuarioLogado = null;
let dadosEstatisticas = [];
let dadosFiltrados = [];
let ordemAtual = { coluna: null, direcao: 'asc' };

// Event listeners principais
document.addEventListener('DOMContentLoaded', async function() {
    // Carregar dados do usuário
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Carregar estatísticas
        await carregarEstatisticas();
        
        // Inicializar funcionalidades
        inicializarPesquisa();
        inicializarOrdenacao();
    }
});

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

// Função para carregar estatísticas
async function carregarEstatisticas() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.table-container');
    
    try {
        // Mostrar loading
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
        tableContainer.style.display = 'none';
        
        // Chamar função backend
        const resultado = await eel.obter_estatisticas_encarregados()();
        
        if (resultado.sucesso) {
            dadosEstatisticas = resultado.dados;
            dadosFiltrados = [...dadosEstatisticas];
            
            // Renderizar tabela
            renderizarTabela();
            
            // Esconder loading e mostrar tabela
            loadingState.style.display = 'none';
            tableContainer.style.display = 'block';
            
        } else {
            throw new Error(resultado.erro || 'Erro ao carregar estatísticas');
        }
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showAlert('Erro ao carregar estatísticas: ' + error.message, 'error');
        
        // Mostrar empty state
        loadingState.style.display = 'none';
        emptyState.style.display = 'flex';
        tableContainer.style.display = 'none';
    }
}

// Função para animar contadores (mantida para compatibilidade)
function animarContadores() {
    const contadores = document.querySelectorAll('.summary-content h3');
    contadores.forEach(contador => {
        const valor = parseInt(contador.textContent) || 0;
        if (valor > 0) {
            animateCounter(contador, 0, valor, 1500);
        }
    });
}

// Função para renderizar tabela
function renderizarTabela() {
    const tbody = document.getElementById('statsTableBody');
    const totalRegistros = document.getElementById('totalRegistros');
    
    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 40px; color: #9ca3af;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
                    Nenhum registro encontrado
                </td>
            </tr>
        `;
        totalRegistros.textContent = '0 registros encontrados';
        return;
    }
    
    tbody.innerHTML = dadosFiltrados.map(item => {
        const total = item.sr + item.fp + item.ipm + item.escrivao + item.pads + item.pad + item.cd + item.cj;
        
        return `
            <tr>
                <td>${item.nome}</td>
                <td class="${item.sr === 0 ? 'zero' : ''}">${item.sr}</td>
                <td class="${item.fp === 0 ? 'zero' : ''}">${item.fp}</td>
                <td class="${item.ipm === 0 ? 'zero' : ''}">${item.ipm}</td>
                <td class="${item.escrivao === 0 ? 'zero' : ''}">${item.escrivao}</td>
                <td class="${item.pads === 0 ? 'zero' : ''}">${item.pads}</td>
                <td class="${item.pad === 0 ? 'zero' : ''}">${item.pad}</td>
                <td class="${item.cd === 0 ? 'zero' : ''}">${item.cd}</td>
                <td class="${item.cj === 0 ? 'zero' : ''}">${item.cj}</td>
                <td class="highlight">${total}</td>
            </tr>
        `;
    }).join('');
    
    totalRegistros.textContent = `${dadosFiltrados.length} registro${dadosFiltrados.length !== 1 ? 's' : ''} encontrado${dadosFiltrados.length !== 1 ? 's' : ''}`;
}

// Função para inicializar pesquisa
function inicializarPesquisa() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', function() {
        const termo = this.value.toLowerCase().trim();
        
        if (termo) {
            clearSearch.style.display = 'inline-flex';
            dadosFiltrados = dadosEstatisticas.filter(item => 
                item.nome.toLowerCase().includes(termo)
            );
        } else {
            clearSearch.style.display = 'none';
            dadosFiltrados = [...dadosEstatisticas];
        }
        
        renderizarTabela();
    });
    
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        dadosFiltrados = [...dadosEstatisticas];
        renderizarTabela();
        searchInput.focus();
    });
}

// Função para inicializar ordenação
function inicializarOrdenacao() {
    const headersSortable = document.querySelectorAll('th.sortable');
    
    headersSortable.forEach(header => {
        header.addEventListener('click', function() {
            const coluna = this.dataset.column;
            
            // Determinar direção
            if (ordemAtual.coluna === coluna) {
                ordemAtual.direcao = ordemAtual.direcao === 'asc' ? 'desc' : 'asc';
            } else {
                ordemAtual.coluna = coluna;
                ordemAtual.direcao = 'asc';
            }
            
            // Atualizar ícones
            headersSortable.forEach(h => {
                h.classList.remove('asc', 'desc');
            });
            this.classList.add(ordemAtual.direcao);
            
            // Ordenar dados
            ordenarDados(coluna, ordemAtual.direcao);
            
            // Renderizar tabela
            renderizarTabela();
        });
    });
}

// Função para ordenar dados
function ordenarDados(coluna, direcao) {
    dadosFiltrados.sort((a, b) => {
        let valorA, valorB;
        
        if (coluna === 'nome') {
            valorA = a.nome.toLowerCase();
            valorB = b.nome.toLowerCase();
        } else if (coluna === 'total') {
            valorA = a.sr + a.fp + a.ipm + a.escrivao + a.pads + a.pad + a.cd + a.cj;
            valorB = b.sr + b.fp + b.ipm + b.escrivao + b.pads + b.pad + b.cd + b.cj;
        } else {
            valorA = a[coluna] || 0;
            valorB = b[coluna] || 0;
        }
        
        if (direcao === 'asc') {
            return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
        } else {
            return valorA < valorB ? 1 : valorA > valorB ? -1 : 0;
        }
    });
}

// Função para exportar dados
function exportarDados() {
    if (dadosFiltrados.length === 0) {
        showAlert('Não há dados para exportar', 'info');
        return;
    }
    
    // Criar CSV
    const headers = ['PM', 'SR', 'FP', 'IPM', 'Escrivão', 'PADS', 'PAD', 'CD', 'CJ', 'Total'];
    const csvContent = [
        headers.join(','),
        ...dadosFiltrados.map(item => {
            const total = item.sr + item.fp + item.ipm + item.escrivao + item.pads + item.pad + item.cd + item.cj;
            return [
                `"${item.nome}"`,
                item.sr, item.fp, item.ipm, item.escrivao,
                item.pads, item.pad, item.cd, item.cj, total
            ].join(',');
        })
    ].join('\\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `estatisticas_encarregados_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Dados exportados com sucesso!', 'success');
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert_' + Date.now();
    
    alertContainer.innerHTML = `
        <div id="${alertId}" class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        </div>
    `;
    
    // Remove alerta após 4 segundos
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(100%)';
            setTimeout(() => alert.remove(), 300);
        }
    }, 4000);
}

// Função para animar contadores
function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (end - start) * easeOutQuart);
        
        element.textContent = current.toLocaleString('pt-BR');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Função global para logout
async function realizarLogout() {
    const startTs = Date.now();
    try {
        const loader = document.querySelector('.global-loader') || document.getElementById('globalLoader');
        if (loader) loader.classList.remove('hidden');

        await eel.fazer_logout()();

        const elapsed = Date.now() - startTs;
        const toWait = Math.max(0, 1000 - elapsed);
        if (toWait > 0) await new Promise(r => setTimeout(r, toWait));

        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro no logout:', error);
        showAlert('Erro ao fazer logout!', 'error');
        const loader = document.querySelector('.global-loader') || document.getElementById('globalLoader');
        if (loader) loader.classList.add('hidden');
    }
}

// Disponibilizar função globalmente
window.realizarLogout = realizarLogout;
