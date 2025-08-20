// Estatísticas por Encarregado - JavaScript Atualizado

// Variáveis globais
let usuarioLogado = null;
let dadosEstatisticas = [];
let dadosFiltrados = [];
let currentSort = { field: 'nome', order: 'asc' };
let currentView = 'all';

// Event listeners principais
document.addEventListener('DOMContentLoaded', async function() {
    // Carregar dados do usuário
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Carregar estatísticas
        await carregarEstatisticas();
        
        // Inicializar funcionalidades
        inicializarEventListeners();
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
    const tableWrapper = document.getElementById('tableWrapper');
    
    try {
        // Mostrar loading
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
        tableWrapper.style.display = 'none';
        
        // Chamar função backend
        const resultado = await eel.obter_estatisticas_encarregados()();
        
        if (resultado.sucesso) {
            dadosEstatisticas = resultado.dados;
            dadosFiltrados = [...dadosEstatisticas];
            
            // Calcular totais para cada encarregado
            dadosEstatisticas.forEach(enc => {
                enc.total = enc.sr + enc.fp + enc.ipm + enc.escrivao + enc.pads + enc.pad + enc.cd + enc.cj;
            });
            
            // Renderizar tabela
            renderTable();
            
            // Esconder loading e mostrar tabela
            loadingState.style.display = 'none';
            tableWrapper.style.display = 'block';
            
        } else {
            throw new Error(resultado.erro || 'Erro ao carregar estatísticas');
        }
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showAlert('Erro ao carregar estatísticas: ' + error.message, 'error');
        
        // Mostrar empty state
        loadingState.style.display = 'none';
        emptyState.style.display = 'flex';
        tableWrapper.style.display = 'none';
    }
}

// Função para mudar visualização
function setView(view) {
    currentView = view;
    
    // Atualizar botões
    document.querySelectorAll('.btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.btn').classList.add('active');
    
    renderTable();
}

// Função para renderizar a tabela
function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Filtrar dados
    dadosFiltrados = dadosEstatisticas.filter(enc => {
        const matchesSearch = enc.nome.toLowerCase().includes(searchTerm);
        
        if (currentView === 'all') return matchesSearch;
        if (currentView === 'active') return matchesSearch && enc.total > 0;
        if (currentView === 'overloaded') return matchesSearch && enc.total > 7;
        
        return matchesSearch;
    });

    // Ordenar dados
    dadosFiltrados.sort((a, b) => {
        let aVal = a[currentSort.field];
        let bVal = b[currentSort.field];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (currentSort.order === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    // Renderizar linhas
    tableBody.innerHTML = dadosFiltrados.map(enc => {
        return `
            <tr>
                <td>
                    <div class="encarregado-cell">
                        <div class="encarregado-info">
                            <span class="encarregado-name">${enc.nome}</span>
                        </div>
                    </div>
                </td>
                <td><span class="process-count ${getCountClass(enc.sr, 3)}">${enc.sr}</span></td>
                <td><span class="process-count ${getCountClass(enc.fp, 2)}">${enc.fp}</span></td>
                <td><span class="process-count ${getCountClass(enc.ipm, 2)}">${enc.ipm}</span></td>
                <td><span class="process-count ${getCountClass(enc.escrivao, 2)}">${enc.escrivao}</span></td>
                <td><span class="process-count ${getCountClass(enc.pads, 3)}">${enc.pads}</span></td>
                <td><span class="process-count ${getCountClass(enc.pad, 1)}">${enc.pad}</span></td>
                <td><span class="process-count ${getCountClass(enc.cd, 1)}">${enc.cd}</span></td>
                <td><span class="process-count ${getCountClass(enc.cj, 1)}">${enc.cj}</span></td>
                <td class="total-cell">${enc.total}</td>
            </tr>
        `;
    }).join('');
}

// Função para determinar a classe CSS baseada na contagem
function getCountClass(count, threshold) {
    if (count === 0) return 'zero';
    if (count > threshold) return 'high';
    if (count > 1) return 'medium';
    return 'low';
}

// Função para ordenar tabela
function sortTable(field) {
    // Atualizar cabeçalhos
    document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });

    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.order = 'asc';
    }

    // Adicionar classe ao cabeçalho ordenado
    const th = document.querySelector(`th[onclick="sortTable('${field}')"]`);
    if (th) {
        th.classList.add(currentSort.order === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }

    renderTable();
}

// Função para exportar dados
function exportData() {
    try {
        let csv = 'Encarregado,SR,FP,IPM,Escrivão,PADS,PAD,CD,CJ,Total\n';
        
        dadosFiltrados.forEach(enc => {
            csv += `"${enc.nome}",${enc.sr},${enc.fp},${enc.ipm},${enc.escrivao},${enc.pads},${enc.pad},${enc.cd},${enc.cj},${enc.total}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `encarregados_processos_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showAlert('Dados exportados com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        showAlert('Erro ao exportar dados!', 'error');
    }
}

// Função para inicializar event listeners
function inicializarEventListeners() {
    // Busca em tempo real
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
}

// Função para logout
async function realizarLogout() {
    try {
        const resultado = await eel.fazer_logout()();
        if (resultado.sucesso) {
            showAlert('Logout realizado com sucesso!', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        } else {
            showAlert('Erro ao fazer logout: ' + resultado.erro, 'error');
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        showAlert('Erro ao fazer logout!', 'error');
    }
}

// Sistema de alertas
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;
    alertDiv.textContent = message;
    
    alertContainer.appendChild(alertDiv);
    
    // Remover o alerta após 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Inicializar ordenação padrão quando a página carregar
window.addEventListener('load', () => {
    if (dadosEstatisticas.length > 0) {
        sortTable('total');
    }
});
