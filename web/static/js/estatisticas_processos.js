// Variáveis globais
let chartAtual = null;

// Inicializar página
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📊 Página de Análise de Processos carregada');
    await carregarAnos();
});

// Carregar anos disponíveis
async function carregarAnos() {
    try {
        const resultado = await eel.obter_anos_disponiveis()();
        
        if (resultado.sucesso) {
            const select = document.getElementById('anoEstatistica');
            
            resultado.anos.forEach(ano => {
                const option = document.createElement('option');
                option.value = ano;
                option.textContent = ano;
                select.appendChild(option);
            });
            
            console.log('✅ Anos carregados:', resultado.anos);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar anos:', error);
    }
}

// Função principal para gerar estatística
async function gerarEstatistica() {
    const tipo = document.getElementById('tipoEstatistica').value;
    const ano = document.getElementById('anoEstatistica').value;
    
    if (!tipo) {
        alert('Por favor, selecione um tipo de estatística.');
        return;
    }
    
    console.log(`📊 Gerando estatística: ${tipo} - Ano: ${ano || 'Todos'}`);
    
    mostrarLoading();
    
    try {
        switch(tipo) {
            case 'pads_solucoes':
                await gerarEstatisticaPadsSolucoes(ano);
                break;
            case 'ipm_indicios':
                await gerarEstatisticaIpmIndicios(ano);
                break;
            case 'sr_indicios':
                await gerarEstatisticaSrIndicios(ano);
                break;
            case 'top_transgressoes':
                await gerarEstatisticaTopTransgressoes(ano);
                break;
            case 'motoristas_sinistros':
                await gerarEstatisticaMotoristas(ano);
                break;
        }
    } catch (error) {
        console.error('❌ Erro ao gerar estatística:', error);
        mostrarErro('Erro ao gerar estatística. Por favor, tente novamente.');
    }
}

// ==== ESTATÍSTICA 1: PADS SOLUÇÕES ====
async function gerarEstatisticaPadsSolucoes(ano) {
    const resultado = await eel.obter_estatistica_pads_solucoes(ano || null)();
    
    if (resultado.sucesso && resultado.dados.length > 0) {
        renderizarGraficoPizza(
            'Soluções Finais de PADS',
            resultado.dados,
            'solucao',
            'quantidade'
        );
    } else {
        mostrarSemDados('Não há dados de PADS concluídos para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 2: IPM INDÍCIOS ====
async function gerarEstatisticaIpmIndicios(ano) {
    const resultado = await eel.obter_estatistica_ipm_indicios(ano || null)();
    
    if (resultado.sucesso) {
        renderizarGraficoBarras(
            'Tipos de Indícios em IPM Concluídos',
            resultado.dados,
            'tipo_indicio',
            'quantidade',
            ['#e74c3c', '#f39c12', '#95a5a6'] // Vermelho, Laranja, Cinza
        );
    } else {
        mostrarSemDados('Não há dados de IPM concluídos para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 3: SR INDÍCIOS ====
async function gerarEstatisticaSrIndicios(ano) {
    const resultado = await eel.obter_estatistica_sr_indicios(ano || null)();
    
    if (resultado.sucesso) {
        renderizarGraficoBarras(
            'Tipos de Indícios em SR Concluídos',
            resultado.dados,
            'tipo_indicio',
            'quantidade',
            ['#3498db', '#f39c12', '#95a5a6'] // Azul, Laranja, Cinza
        );
    } else {
        mostrarSemDados('Não há dados de SR concluídos para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 4: TOP 10 TRANSGRESSÕES ====
async function gerarEstatisticaTopTransgressoes(ano) {
    const resultado = await eel.obter_top10_transgressoes(ano || null)();
    
    if (resultado.sucesso && resultado.dados.length > 0) {
        renderizarGraficoBarrasTransgressoes(
            'Top 10 transgressões mais recorrentes apontadas em IPM e SR',
            resultado.dados
        );
    } else {
        mostrarSemDados('Não há dados de transgressões para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 5: MOTORISTAS SINISTROS ====
async function gerarEstatisticaMotoristas(ano) {
    const resultado = await eel.obter_ranking_motoristas_sinistros(ano || null)();
    
    if (resultado.sucesso && resultado.dados.length > 0) {
        renderizarTabelaMotoristas(resultado.dados);
    } else {
        mostrarSemDados('Não há dados de sinistros para o período selecionado.');
    }
}

// ==== FUNÇÕES DE RENDERIZAÇÃO ====

function renderizarGraficoPizza(titulo, dados, labelKey, valueKey) {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="statistics-title">
            <i class="fas fa-chart-pie"></i>
            ${titulo}
        </div>
        <div class="chart-container">
            <canvas id="chartCanvas"></canvas>
        </div>
    `;
    
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (chartAtual) {
        chartAtual.destroy();
    }
    
    const labels = dados.map(d => d[labelKey]);
    const values = dados.map(d => d[valueKey]);
    
    chartAtual = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#667eea',
                    '#f093fb',
                    '#f5576c',
                    '#4facfe',
                    '#00f2fe'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            size: 14
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoBarras(titulo, dados, labelKey, valueKey, cores) {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="statistics-title">
            <i class="fas fa-chart-bar"></i>
            ${titulo}
        </div>
        <div class="chart-container">
            <canvas id="chartCanvas"></canvas>
        </div>
    `;
    
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    
    if (chartAtual) {
        chartAtual.destroy();
    }
    
    const labels = dados.map(d => d[labelKey]);
    const values = dados.map(d => d[valueKey]);
    
    chartAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade',
                data: values,
                backgroundColor: cores || '#667eea',
                borderColor: cores || '#5568d3',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Quantidade: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderizarGraficoBarrasTransgressoes(titulo, dados) {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div class="statistics-title">
            <i class="fas fa-chart-bar"></i>
            ${titulo}
        </div>
        <div class="chart-container" style="height: 500px;">
            <canvas id="chartCanvas"></canvas>
        </div>
    `;
    
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    
    if (chartAtual) {
        chartAtual.destroy();
    }
    
    const labels = dados.map(d => d.artigo_label); // Usar artigo_label como label principal
    const values = dados.map(d => d.quantidade);
    const descricoes = dados.map(d => d.descricao_curta);
    
    chartAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ocorrências',
                data: values,
                backgroundColor: '#667eea',
                borderColor: '#5568d3',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return labels[context[0].dataIndex];
                        },
                        label: function(context) {
                            return `Ocorrências: ${context.parsed.y}`;
                        },
                        afterLabel: function(context) {
                            return descricoes[context.dataIndex];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function renderizarTabelaMotoristas(dados) {
    const contentArea = document.getElementById('contentArea');
    
    let html = `
        <div class="statistics-title">
            <i class="fas fa-car-crash"></i>
            Ranking de motoristas em sinistro com viatura PM
        </div>
        <table class="motoristas-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>PM Motorista</th>
                    <th style="text-align: center;">Total de Sinistros</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    dados.forEach((item, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td class="motorista-nome">${item.pm_completo}</td>
                <td style="text-align: center;">
                    <span class="sinistros-count">${item.total_sinistros}</span>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    contentArea.innerHTML = html;
}

// ==== FUNÇÕES AUXILIARES ====

function mostrarLoading() {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p class="loading-text">Carregando dados...</p>
        </div>
    `;
}

function mostrarSemDados(mensagem) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>Nenhum dado encontrado</h3>
            <p>${mensagem}</p>
        </div>
    `;
}

function mostrarErro(mensagem) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div class="empty-state" style="color: #e74c3c;">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Erro ao carregar dados</h3>
            <p>${mensagem}</p>
        </div>
    `;
}
