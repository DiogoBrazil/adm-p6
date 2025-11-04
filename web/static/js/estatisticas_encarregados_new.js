// Estatísticas por Encarregado - JavaScript Atualizado

// Variáveis globais
let usuarioLogado = null;
let dadosEstatisticas = [];
let dadosFiltrados = [];
let currentSort = { field: 'nome', order: 'asc' };

// Event listeners principais
document.addEventListener('DOMContentLoaded', async function() {
    // Carregar dados do usuário
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Carregar estatísticas
        await carregarEstatisticas();
        
        // Inicializar funcionalidades
        inicializarEventListeners();
        
        // Atualizar indicador de filtros (caso haja filtros persistidos)
        atualizarIndicadorFiltros();
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

// Função para renderizar a tabela
function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Filtrar dados apenas por busca
    dadosFiltrados = dadosEstatisticas.filter(enc => {
        return enc.nome.toLowerCase().includes(searchTerm);
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
    const clearButton = document.getElementById('clearButton');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            // Mostrar/esconder botão limpar
            if (this.value.trim() !== '') {
                clearButton.style.display = 'flex';
            } else {
                clearButton.style.display = 'none';
            }
            
            // Renderizar tabela
            renderTable();
        });
    }
}

// Função para limpar busca
function limparBusca() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    
    if (searchInput) {
        searchInput.value = '';
        clearButton.style.display = 'none';
        renderTable();
        searchInput.focus();
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

// ===== FUNCIONALIDADES DE FILTROS VIA MODAL =====

// Filtros aplicados via modal
let filtrosAtivos = {
    encarregado: '',
    tipoFeito: ''
};

// Função para abrir modal de filtros
function abrirModalFiltros() {
    console.log('Abrindo modal de filtros');
    
    // Popular dropdown de encarregados
    popularDropdownEncarregados();
    
    // Mostrar modal
    const modal = document.getElementById('modal-filtros');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Função para fechar modal de filtros
function fecharModalFiltros() {
    console.log('Fechando modal de filtros');
    const modal = document.getElementById('modal-filtros');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Função para popular dropdown de encarregados
function popularDropdownEncarregados() {
    const select = document.getElementById('filtro-encarregado');
    if (!select || !dadosEstatisticas) return;
    
    // Limpar opções existentes exceto a primeira
    select.innerHTML = '<option value="">Todos os Encarregados</option>';
    
    // Adicionar opções usando ID como value
    dadosEstatisticas.forEach(encarregado => {
        if (encarregado && encarregado.id && encarregado.nome) {
            const option = document.createElement('option');
            option.value = encarregado.id;  // Usar ID ao invés do nome
            option.textContent = encarregado.nome;
            if (filtrosAtivos.encarregado === encarregado.nome) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    });
}

// Função para aplicar filtros do modal
function aplicarFiltrosModal() {
    console.log('Aplicando filtros do modal');
    
    // Obter valores dos filtros
    const encarregadoSelect = document.getElementById('filtro-encarregado');
    const tipoFeitoSelect = document.getElementById('filtro-tipo-feito');
    
    if (encarregadoSelect && tipoFeitoSelect) {
        filtrosAtivos.encarregado = encarregadoSelect.value;
        filtrosAtivos.tipoFeito = tipoFeitoSelect.value;
        
        console.log('Filtros aplicados:', filtrosAtivos);
        
        // Aplicar filtros
        aplicarFiltros();
        
        // Fechar modal
        fecharModalFiltros();
        
        // Atualizar indicador de filtros ativos
        atualizarIndicadorFiltros();
    }
}

// Função para limpar filtros do modal
function limparFiltrosModal() {
    console.log('Limpando filtros do modal');
    
    // Resetar filtros
    filtrosAtivos.encarregado = '';
    filtrosAtivos.tipoFeito = '';
    
    // Resetar selects
    const encarregadoSelect = document.getElementById('filtro-encarregado');
    const tipoFeitoSelect = document.getElementById('filtro-tipo-feito');
    
    if (encarregadoSelect) encarregadoSelect.value = '';
    if (tipoFeitoSelect) tipoFeitoSelect.value = '';
    
    // Aplicar filtros (sem filtros = mostrar todos)
    aplicarFiltros();
    
    // Fechar modal
    fecharModalFiltros();
    
    // Atualizar indicador de filtros ativos
    atualizarIndicadorFiltros();
}

// Função para aplicar filtros aos dados
function aplicarFiltros() {
    if (!dadosEstatisticas) return;
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // Começar com todos os dados
    dadosFiltrados = [...dadosEstatisticas];
    
    // Aplicar filtro de busca
    if (searchTerm) {
        dadosFiltrados = dadosFiltrados.filter(enc => 
            enc.nome.toLowerCase().includes(searchTerm)
        );
    }
    
    // Aplicar filtro por encarregado específico
    if (filtrosAtivos.encarregado) {
        dadosFiltrados = dadosFiltrados.filter(enc => 
            enc.nome === filtrosAtivos.encarregado
        );
    }
    
    // Aplicar filtro por tipo de feito (mostrar apenas encarregados que têm esse tipo)
    if (filtrosAtivos.tipoFeito) {
        dadosFiltrados = dadosFiltrados.filter(enc => {
            // Mapear tipo de feito para propriedade
            const tipoMap = {
                'SR': 'sr',
                'FP': 'fp', 
                'IPM': 'ipm',
                'Escrivão': 'escrivao',
                'PADs': 'pads',
                'PAD': 'pad',
                'CD': 'cd',
                'CJ': 'cj'
            };
            
            const propriedade = tipoMap[filtrosAtivos.tipoFeito];
            return propriedade && enc[propriedade] > 0;
        });
    }
    
    console.log(`Dados filtrados: ${dadosFiltrados.length} de ${dadosEstatisticas.length}`);
    
    // Renderizar tabela com dados filtrados
    renderTableWithFilters();
}

// Função para renderizar tabela com filtros aplicados
function renderTableWithFilters() {
    const tableBody = document.getElementById('tableBody');
    
    // Ordenar dados filtrados
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
    
    // Atualizar contadores
    updateTableInfo();
}

// Função para atualizar indicador de filtros ativos
function atualizarIndicadorFiltros() {
    const toggleBtn = document.getElementById('filterToggle');
    if (!toggleBtn) return;
    
    let filtrosAplicados = 0;
    
    // Contar quantos filtros estão ativos
    Object.values(filtrosAtivos).forEach(valor => {
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
        
        // Mudar cor do botão para indicar filtros ativos
        toggleBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
    } else {
        // Resetar aparência original
        toggleBtn.style.background = 'linear-gradient(135deg, #007bff, #0056b3)';
    }
}

// Função para fechar modal clicando no backdrop
function fecharModalPorBackdrop(event, modalId = 'modal-filtros') {
    if (event.target.id === modalId) {
        if (modalId === 'modal-filtros') {
            fecharModalFiltros();
        } else if (modalId === 'modal-ultimos-feitos') {
            fecharModalUltimosFeitos();
        }
    }
}

// Atualizar função renderTable para usar os filtros
const renderTableOriginal = renderTable;
renderTable = function() {
    aplicarFiltros();
};

// Função para atualizar informações da tabela
function updateTableInfo() {
    // Esta função pode ser expandida para mostrar contadores de registros filtrados
    console.log(`Mostrando ${dadosFiltrados.length} de ${dadosEstatisticas.length} encarregados`);
}

// =================== MODAL ÚLTIMOS FEITOS ===================

// Função para abrir modal de últimos feitos
async function abrirModalUltimosFeitos() {
    console.log('Abrindo modal de últimos feitos');
    
    const encarregadoSelect = document.getElementById('filtro-encarregado');
    const encarregadoId = encarregadoSelect.value;
    
    if (!encarregadoId) {
        alert('Por favor, selecione um encarregado primeiro.');
        return;
    }
    
    const modal = document.getElementById('modal-ultimos-feitos');
    const content = document.getElementById('ultimos-feitos-content');
    
    if (!modal || !content) return;
    
    // Mostrar loading
    content.innerHTML = '<div style="text-align: center; padding: 32px;"><i class="fas fa-spinner fa-spin" style="font-size: 32px; color: #667eea;"></i><p style="margin-top: 16px;">Buscando feitos...</p></div>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    try {
        console.log('Buscando feitos para encarregado ID:', encarregadoId);
        const resultado = await eel.obter_ultimos_feitos_encarregado(encarregadoId)();
        
        if (resultado.sucesso) {
            if (resultado.dados.length === 0) {
                content.innerHTML = `
                    <div class="msg-sem-feitos">
                        <i class="fas fa-inbox"></i>
                        <p style="margin: 0; font-size: 16px;">Nenhum feito encontrado para este encarregado.</p>
                    </div>
                `;
            } else {
                renderizarTabelaUltimosFeitos(resultado.dados, content);
            }
        } else {
            content.innerHTML = `
                <div class="msg-sem-feitos">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p style="margin: 0; font-size: 16px; color: #dc3545;">Erro ao buscar feitos: ${resultado.erro}</p>
                </div>
            `;
        }
    } catch (erro) {
        console.error('Erro ao buscar últimos feitos:', erro);
        content.innerHTML = `
            <div class="msg-sem-feitos">
                <i class="fas fa-exclamation-triangle"></i>
                <p style="margin: 0; font-size: 16px; color: #dc3545;">Erro ao buscar feitos.</p>
            </div>
        `;
    }
}

// Função para renderizar tabela de últimos feitos
function renderizarTabelaUltimosFeitos(feitos, container) {
    const encarregadoSelect = document.getElementById('filtro-encarregado');
    const nomeEncarregado = encarregadoSelect.options[encarregadoSelect.selectedIndex].text;
    
    let html = `
        <div style="margin-bottom: 16px;">
            <p style="margin: 0; font-size: 14px; color: #6c757d;">
                <strong>Encarregado:</strong> ${nomeEncarregado}
            </p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #6c757d;">
                <strong>Total de feitos encontrados:</strong> ${feitos.length}
            </p>
        </div>
        <table class="ultimos-feitos-table">
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Número</th>
                    <th>Data Instauração</th>
                    <th>Data Recebimento</th>
                    <th>Data Remessa</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    feitos.forEach(feito => {
        const tipoBadgeClass = feito.tipo.toLowerCase();
        const dataInstauracao = feito.data_instauracao ? formatarData(feito.data_instauracao) : '-';
        const dataRecebimento = feito.data_recebimento ? formatarData(feito.data_recebimento) : '-';
        const dataRemessa = feito.data_remessa ? formatarData(feito.data_remessa) : '-';
        
        html += `
            <tr>
                <td><span class="tipo-badge ${tipoBadgeClass}">${feito.tipo}</span></td>
                <td><strong>${feito.numero}</strong></td>
                <td>${dataInstauracao}</td>
                <td>${dataRecebimento}</td>
                <td>${dataRemessa}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Função para fechar modal de últimos feitos
function fecharModalUltimosFeitos() {
    console.log('Fechando modal de últimos feitos');
    const modal = document.getElementById('modal-ultimos-feitos');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Função auxiliar para formatar data
function formatarData(dataStr) {
    if (!dataStr) return '-';
    
    // Se já está no formato DD/MM/YYYY, retornar
    if (dataStr.includes('/')) return dataStr;
    
    // Se está no formato YYYY-MM-DD, converter
    const partes = dataStr.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    
    return dataStr;
}
