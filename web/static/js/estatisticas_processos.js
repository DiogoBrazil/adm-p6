// Variáveis globais
let chartAtual = null;
let estatisticaAtual = null; // Armazena info da estatística atual

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

// Função para baixar estatística em PDF
async function baixarPDF() {
    const { jsPDF } = window.jspdf;
    
    // Desabilitar botão durante geração
    const btnDownload = document.getElementById('btnDownloadPDF');
    if (btnDownload) {
        btnDownload.disabled = true;
        btnDownload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';
    }
    
    try {
        const contentArea = document.getElementById('contentArea');
        
        // Ocultar elementos com classe hide-in-pdf (botões e paginação)
        const elementosOcultar = contentArea.querySelectorAll('.hide-in-pdf');
        elementosOcultar.forEach(el => el.style.display = 'none');
        
        // Ocultar tabela paginada de motoristas (se existir)
        const tabelaVizualizacao = contentArea.querySelector('#tabelaMotoristasVizualizacao');
        if (tabelaVizualizacao) {
            tabelaVizualizacao.style.display = 'none';
        }
        
        // Mostrar elementos com classe data-table-pdf (tabelas de dados)
        const tabelasMostrar = contentArea.querySelectorAll('.data-table-pdf');
        tabelasMostrar.forEach(el => el.style.display = 'table');
        
        // Capturar o conteúdo como imagem
        const canvas = await html2canvas(contentArea, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
        
        // Restaurar elementos ao estado original
        elementosOcultar.forEach(el => el.style.display = '');
        tabelasMostrar.forEach(el => el.style.display = 'none');
        if (tabelaVizualizacao) {
            tabelaVizualizacao.style.display = 'table';
        }
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 190; // A4 width em mm (com margens)
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Criar PDF
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // Adicionar cabeçalho
        pdf.setFontSize(16);
        pdf.setTextColor(102, 126, 234);
        pdf.text('Sistema P6/7ºBPM - Análise de Processos', 105, 15, { align: 'center' });
        
        // Adicionar data de geração
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        const dataHora = new Date().toLocaleString('pt-BR');
        pdf.text(`Gerado em: ${dataHora}`, 105, 22, { align: 'center' });
        
        // Adicionar ano filtrado se houver
        if (estatisticaAtual && estatisticaAtual.ano) {
            pdf.text(`Ano: ${estatisticaAtual.ano}`, 105, 27, { align: 'center' });
        }
        
        // Adicionar imagem do gráfico/tabela
        let yPosition = estatisticaAtual && estatisticaAtual.ano ? 32 : 27;
        
        if (imgHeight > 250) {
            // Se muito alto, dividir em páginas
            let heightLeft = imgHeight;
            let position = yPosition;
            
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= (297 - position);
            
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= 297;
            }
        } else {
            pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);
        }
        
        // Nome do arquivo
        const tipo = document.getElementById('tipoEstatistica').options[document.getElementById('tipoEstatistica').selectedIndex].text;
        const ano = estatisticaAtual?.ano || 'todos_anos';
        const nomeArquivo = `estatistica_${tipo.toLowerCase().replace(/\s+/g, '_')}_${ano}.pdf`;
        
        pdf.save(nomeArquivo);
        
        console.log('✅ PDF gerado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Por favor, tente novamente.');
    } finally {
        // Reabilitar botão
        if (btnDownload) {
            btnDownload.disabled = false;
            btnDownload.innerHTML = '<i class="fas fa-file-pdf"></i> Baixar PDF';
        }
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
        estatisticaAtual = { tipo: 'pads_solucoes', ano: ano };
        renderizarGraficoPizza(
            'Soluções Finais de PADS',
            resultado.dados,
            'solucao',
            'quantidade'
        );
    } else {
        estatisticaAtual = null;
        mostrarSemDados('Não há dados de PADS concluídos para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 2: IPM INDÍCIOS ====
async function gerarEstatisticaIpmIndicios(ano) {
    const resultado = await eel.obter_estatistica_ipm_indicios(ano || null)();
    
    if (resultado.sucesso) {
        estatisticaAtual = { tipo: 'ipm_indicios', ano: ano };
        renderizarGraficoBarras(
            'Tipos de Indícios em IPM Concluídos',
            resultado.dados,
            'tipo_indicio',
            'quantidade',
            ['#e74c3c', '#f39c12', '#95a5a6'] // Vermelho, Laranja, Cinza
        );
    } else {
        estatisticaAtual = null;
        mostrarSemDados('Não há dados de IPM concluídos para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 3: SR INDÍCIOS ====
async function gerarEstatisticaSrIndicios(ano) {
    const resultado = await eel.obter_estatistica_sr_indicios(ano || null)();
    
    if (resultado.sucesso) {
        estatisticaAtual = { tipo: 'sr_indicios', ano: ano };
        renderizarGraficoBarras(
            'Tipos de Indícios em SR Concluídos',
            resultado.dados,
            'tipo_indicio',
            'quantidade',
            ['#3498db', '#f39c12', '#95a5a6'] // Azul, Laranja, Cinza
        );
    } else {
        estatisticaAtual = null;
        mostrarSemDados('Não há dados de SR concluídos para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 4: TOP 10 TRANSGRESSÕES ====
async function gerarEstatisticaTopTransgressoes(ano) {
    const resultado = await eel.obter_top10_transgressoes(ano || null)();
    
    if (resultado.sucesso && resultado.dados.length > 0) {
        estatisticaAtual = { tipo: 'top_transgressoes', ano: ano };
        renderizarGraficoBarrasTransgressoes(
            'Top 10 transgressões mais recorrentes apontadas em IPM e SR',
            resultado.dados
        );
    } else {
        estatisticaAtual = null;
        mostrarSemDados('Não há dados de transgressões para o período selecionado.');
    }
}

// ==== ESTATÍSTICA 5: MOTORISTAS SINISTROS ====
async function gerarEstatisticaMotoristas(ano) {
    const resultado = await eel.obter_ranking_motoristas_sinistros(ano || null)();
    
    if (resultado.sucesso && resultado.dados.length > 0) {
        estatisticaAtual = { tipo: 'motoristas_sinistros', ano: ano };
        renderizarTabelaMotoristas(resultado.dados);
    } else {
        estatisticaAtual = null;
        mostrarSemDados('Não há dados de sinistros para o período selecionado.');
    }
}

// ==== FUNÇÕES DE RENDERIZAÇÃO ====

function renderizarGraficoPizza(titulo, dados, labelKey, valueKey) {
    const contentArea = document.getElementById('contentArea');
    
    // Criar tabela de dados para o PDF
    const total = dados.reduce((sum, d) => sum + d[valueKey], 0);
    let tabelaDados = `
        <table class="data-table-pdf">
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Quantidade</th>
                    <th>Percentual</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    dados.forEach(d => {
        const percentual = ((d[valueKey] / total) * 100).toFixed(1);
        tabelaDados += `
            <tr>
                <td>${d[labelKey]}</td>
                <td style="text-align: center;">${d[valueKey]}</td>
                <td style="text-align: center;">${percentual}%</td>
            </tr>
        `;
    });
    
    tabelaDados += `
            </tbody>
        </table>
    `;
    
    contentArea.innerHTML = `
        <div class="statistics-title">
            <div class="statistics-title-left">
                <i class="fas fa-chart-pie"></i>
                ${titulo}
            </div>
            <button id="btnDownloadPDF" class="btn-download-pdf hide-in-pdf" onclick="baixarPDF()">
                <i class="fas fa-file-pdf"></i> Baixar PDF
            </button>
        </div>
        <div class="chart-container">
            <canvas id="chartCanvas"></canvas>
        </div>
        ${tabelaDados}
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
    
    // Criar tabela de dados para o PDF
    let tabelaDados = `
        <table class="data-table-pdf">
            <thead>
                <tr>
                    <th>Categoria</th>
                    <th>Quantidade</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    dados.forEach(d => {
        tabelaDados += `
            <tr>
                <td>${d[labelKey]}</td>
                <td style="text-align: center;">${d[valueKey]}</td>
            </tr>
        `;
    });
    
    tabelaDados += `
            </tbody>
        </table>
    `;
    
    contentArea.innerHTML = `
        <div class="statistics-title">
            <div class="statistics-title-left">
                <i class="fas fa-chart-bar"></i>
                ${titulo}
            </div>
            <button id="btnDownloadPDF" class="btn-download-pdf hide-in-pdf" onclick="baixarPDF()">
                <i class="fas fa-file-pdf"></i> Baixar PDF
            </button>
        </div>
        <div class="chart-container">
            <canvas id="chartCanvas"></canvas>
        </div>
        ${tabelaDados}
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
    
    // Criar tabela de dados para o PDF
    let tabelaDados = `
        <table class="data-table-pdf">
            <thead>
                <tr>
                    <th>Artigo</th>
                    <th>Descrição</th>
                    <th>Ocorrências</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    dados.forEach(d => {
        tabelaDados += `
            <tr>
                <td>${d.artigo_label}</td>
                <td>${d.descricao_curta}</td>
                <td style="text-align: center;">${d.quantidade}</td>
            </tr>
        `;
    });
    
    tabelaDados += `
            </tbody>
        </table>
    `;
    
    contentArea.innerHTML = `
        <div class="statistics-title">
            <div class="statistics-title-left">
                <i class="fas fa-chart-bar"></i>
                ${titulo}
            </div>
            <button id="btnDownloadPDF" class="btn-download-pdf hide-in-pdf" onclick="baixarPDF()">
                <i class="fas fa-file-pdf"></i> Baixar PDF
            </button>
        </div>
        <div class="chart-container" style="height: 500px;">
            <canvas id="chartCanvas"></canvas>
        </div>
        ${tabelaDados}
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
    
    // Armazenar dados completos para paginação
    window.dadosMotoristas = dados;
    window.paginaAtualMotoristas = 1;
    window.itensPorPagina = 10;
    
    // Renderizar primeira página
    renderizarPaginaMotoristas();
}

function renderizarPaginaMotoristas() {
    const contentArea = document.getElementById('contentArea');
    const dados = window.dadosMotoristas;
    const paginaAtual = window.paginaAtualMotoristas;
    const itensPorPagina = window.itensPorPagina;
    
    const totalPaginas = Math.ceil(dados.length / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dados.slice(inicio, fim);
    
    let html = `
        <div class="statistics-title">
            <div class="statistics-title-left">
                <i class="fas fa-car-crash"></i>
                Ranking de motoristas em sinistro com viatura PM
            </div>
            <button id="btnDownloadPDF" class="btn-download-pdf hide-in-pdf" onclick="baixarPDF()">
                <i class="fas fa-file-pdf"></i> Baixar PDF
            </button>
        </div>
        <table class="motoristas-table" id="tabelaMotoristasVizualizacao">
            <thead>
                <tr>
                    <th>#</th>
                    <th>PM Motorista</th>
                    <th style="text-align: center;">Total de Sinistros</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    dadosPagina.forEach((item, index) => {
        const numeroGlobal = inicio + index + 1;
        html += `
            <tr>
                <td>${numeroGlobal}</td>
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
        <div class="pagination-container hide-in-pdf">
            <div class="pagination-buttons">
                <button class="pagination-btn" onclick="mudarPaginaMotoristas(-1)" ${paginaAtual === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>
                <button class="pagination-btn" onclick="mudarPaginaMotoristas(1)" ${paginaAtual === totalPaginas ? 'disabled' : ''}>
                    Próxima <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="pagination-info">
                Página ${paginaAtual} de ${totalPaginas} (${dados.length} motoristas)
            </div>
        </div>
    `;
    
    // Tabela completa oculta para PDF
    html += `
        <table class="motoristas-table data-table-pdf" id="tabelaMotoristasCompleta">
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

function mudarPaginaMotoristas(direcao) {
    const totalPaginas = Math.ceil(window.dadosMotoristas.length / window.itensPorPagina);
    window.paginaAtualMotoristas += direcao;
    
    // Garantir que a página está dentro dos limites
    if (window.paginaAtualMotoristas < 1) window.paginaAtualMotoristas = 1;
    if (window.paginaAtualMotoristas > totalPaginas) window.paginaAtualMotoristas = totalPaginas;
    
    renderizarPaginaMotoristas();
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
