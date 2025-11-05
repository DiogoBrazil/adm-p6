// mapa_mensal.js - JavaScript para funcionalidade do Mapa Mensal

document.addEventListener('DOMContentLoaded', function() {
    inicializarMapaMensal();
});

function inicializarMapaMensal() {
    console.log('🗓️ Inicializando Mapa Mensal...');
    
    // Inicializar elementos da página
    inicializarAnos();
    carregarTiposProcesso();
    carregarMapasAnteriores();
    
    // Event listeners
    document.getElementById('filtroMapaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        gerarMapaMensal();
    });
    
    // Definir mês e ano atuais como padrão
    const hoje = new Date();
    document.getElementById('mes').value = hoje.getMonth() + 1;
    document.getElementById('ano').value = hoje.getFullYear();
}

function inicializarAnos() {
    const selectAno = document.getElementById('ano');
    const anoAtual = new Date().getFullYear();
    
    // Adicionar anos de 2020 até ano atual + 1
    for (let ano = 2020; ano <= anoAtual + 1; ano++) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAno.appendChild(option);
    }
}

async function carregarTiposProcesso() {
    try {
        console.log('📋 Carregando tipos de processo...');
        
        const resultado = await eel.obter_tipos_processo_para_mapa()();
        
        if (resultado.sucesso) {
            const selectTipo = document.getElementById('tipoProcesso');
            
            // Limpar opções existentes (exceto a primeira)
            selectTipo.innerHTML = '<option value="">Selecione...</option>';
            
            resultado.tipos.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo.codigo;
                option.textContent = `${tipo.nome} (${tipo.total} registros)`;
                selectTipo.appendChild(option);
            });
            
            console.log(`✅ ${resultado.tipos.length} tipos de processo carregados`);
        } else {
            console.error('❌ Erro ao carregar tipos:', resultado.mensagem);
            mostrarAlerta('Erro ao carregar tipos de processo: ' + resultado.mensagem, 'danger');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar tipos de processo:', error);
        mostrarAlerta('Erro ao carregar tipos de processo.', 'danger');
    }
}

async function gerarMapaMensal() {
    const mes = document.getElementById('mes').value;
    const ano = document.getElementById('ano').value;
    const tipoProcesso = document.getElementById('tipoProcesso').value;
    
    // Validar campos
    if (!mes || !ano || !tipoProcesso) {
        mostrarAlerta('Por favor, preencha todos os campos.', 'warning');
        return;
    }
    
    try {
        console.log(`📊 Gerando mapa mensal: ${mes}/${ano} - ${tipoProcesso}`);
        
        // Mostrar loading
        mostrarLoading(true);
        ocultarResultados();
        
        const resultado = await eel.gerar_mapa_mensal(mes, ano, tipoProcesso)();
        
        if (resultado.sucesso) {
            console.log(`✅ Mapa gerado: ${resultado.dados.length} processos encontrados`);
            exibirResultados(resultado);
            
            // Salvar o mapa automaticamente
            salvarMapaAutomaticamente(resultado);
        } else {
            console.error('❌ Erro ao gerar mapa:', resultado.mensagem);
            mostrarAlerta('Erro ao gerar mapa: ' + resultado.mensagem, 'danger');
            mostrarEstadoVazio();
        }
    } catch (error) {
        console.error('❌ Erro ao gerar mapa mensal:', error);
        mostrarAlerta('Erro ao gerar mapa mensal.', 'danger');
        mostrarEstadoVazio();
    } finally {
        mostrarLoading(false);
    }
}

function exibirResultados(resultado) {
    const { dados, meta } = resultado;
    
    if (dados.length === 0) {
        mostrarEstadoVazio();
        return;
    }
    
    // Atualizar título
    document.getElementById('tituloMapa').innerHTML = `
        <i class="bi bi-file-earmark-text me-2"></i>
        Mapa Mensal - ${meta.tipo_processo} - ${meta.mes_nome}/${meta.ano}
    `;
    
    // Informações do mapa
    document.getElementById('infoMapa').innerHTML = `
        <div class="info-grid">
            <div class="info-card">
                <div class="info-label">Período</div>
                <div class="info-value">${meta.mes_nome}/${meta.ano}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Tipo</div>
                <div class="info-value">${meta.tipo_processo}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Data de Geração</div>
                <div class="info-value">${meta.data_geracao}</div>
            </div>
        </div>
    `;
    
    // Estatísticas
    document.getElementById('estatisticasMapa').innerHTML = `
        <div class="row g-3">
            <div class="col-4">
                <div class="stats-card">
                    <div class="stats-number">${meta.total_processos}</div>
                    <div class="stats-label">Total</div>
                </div>
            </div>
            <div class="col-4">
                <div class="stats-card">
                    <div class="stats-number">${meta.total_andamento}</div>
                    <div class="stats-label">Em Andamento</div>
                </div>
            </div>
            <div class="col-4">
                <div class="stats-card">
                    <div class="stats-number">${meta.total_concluidos}</div>
                    <div class="stats-label">Concluídos</div>
                </div>
            </div>
        </div>
    `;
    
    // Armazenar dados originais globalmente para acesso posterior (para geração de PDF)
    window.dadosProcessos = dados;
    
    // Mostrar resultados
    document.getElementById('resultados').classList.remove('d-none');
    document.getElementById('estadoVazio').classList.add('d-none');
}

function ocultarResultados() {
    document.getElementById('resultados').classList.add('d-none');
    document.getElementById('estadoVazio').classList.add('d-none');
}

// Função para gerar PDF
async function gerarPDF() {
    try {
        // Mostrar loading
        const botaoGerar = document.querySelector('button[onclick="gerarPDF()"]');
        const textoOriginal = botaoGerar.innerHTML;
        botaoGerar.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Gerando PDF...';
        botaoGerar.disabled = true;

        // Obter dados atuais
        const tituloMapa = document.getElementById('tituloMapa').textContent;
        const infoMapa = document.getElementById('infoMapa');
        const estatisticas = document.getElementById('estatisticasMapa');
        
        // Criar conteúdo estruturado a partir da página
        const pdfContent = criarConteudoPDF(tituloMapa, infoMapa, estatisticas);
        // Gerar e baixar PDF diretamente usando jsPDF
        await gerarDocumentoPDF(pdfContent, tituloMapa);
        
        // Restaurar botão
        botaoGerar.innerHTML = textoOriginal;
        botaoGerar.disabled = false;
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
        
        // Restaurar botão
        const botaoGerar = document.querySelector('button[onclick="gerarPDF()"]');
        botaoGerar.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i> Gerar PDF';
        botaoGerar.disabled = false;
    }
}

function criarConteudoPDF(tituloMapa, infoMapa, estatisticas) {
    // Extrair informações do DOM
    const infoCards = infoMapa.querySelectorAll('.info-card');
    const info = {};
    infoCards.forEach(card => {
        const label = card.querySelector('.info-label')?.textContent || '';
        const value = card.querySelector('.info-value')?.textContent || '';
        if (label && value) info[label] = value;
    });
    
    const statsCards = estatisticas.querySelectorAll('.stats-card');
    const stats = {};
    statsCards.forEach((card, index) => {
        const number = card.querySelector('.stats-number')?.textContent || '0';
        const label = card.querySelector('.stats-label')?.textContent || '';
        if (index === 0) stats.total = parseInt(number);
        else if (index === 1) stats.andamento = parseInt(number);
        else if (index === 2) stats.concluidos = parseInt(number);
    });
    
    // Usar dados dos processos armazenados globalmente
    const processos = window.dadosProcessos || [];
    
    // Converter para formato esperado pela função de PDF
    const processosFormatados = processos.map((processo, index) => {
        const status = processo.concluido ? 'Concluído' : 'Em Andamento';
        const pmsTexto = processo.pms_envolvidos ? 
            processo.pms_envolvidos.map(pm => pm.completo || `${pm.posto_graduacao || ''} ${pm.nome || ''}`.trim()).join(', ') :
            'Nenhum PM informado';
            
        return {
            id: processo.id,
            numero: index + 1,
            numeroProcesso: `${processo.numero}/${processo.ano}`,
            descricao: processo.numero_portaria ? 
                `Portaria nº ${processo.numero_portaria}/${processo.ano}` : 
                (processo.numero_memorando ? `Memorando nº ${processo.numero_memorando}/${processo.ano}` : ''),
            status: status,
            encarregado: processo.responsavel?.completo || 'Não informado',
            pmsEnvolvidos: pmsTexto,
            solucao: processo.concluido ? 
                (processo.solucao?.solucao_tipo || 'Concluído') : 
                'Em Andamento',
            detalhes: {
                dataInstauracao: formatarData(processo.data_instauracao),
                dataConclusao: processo.data_conclusao ? formatarData(processo.data_conclusao) : 'Não se aplica',
                numeroPortaria: processo.numero_portaria ? 
                    `Portaria nº ${processo.numero_portaria}/${processo.ano}` : 
                    (processo.numero_memorando ? `Memorando nº ${processo.numero_memorando}/${processo.ano}` : 'Não informado'),
                numeroControle: processo.numero || 'Não informado',
                numeroRGF: processo.numero_rgf || 'Não informado',
                resumoFatos: processo.resumo_fatos || 'Não informado',
                tipoProcesso: info.Tipo || '',
                solucaoCompleta: {
                    dataRemessa: processo.solucao?.data_remessa ? 
                        formatarData(processo.solucao.data_remessa) : 'Não informado',
                    dataJulgamento: processo.solucao?.data_julgamento ? 
                        formatarData(processo.solucao.data_julgamento) : 'Não se aplica',
                    resultado: processo.solucao?.solucao_final || processo.solucao?.solucao_tipo || 'Não informado'
                }
            }
        };
    });
    
    return {
        titulo: tituloMapa,
        info: info,
        stats: stats,
        processos: processosFormatados
    };
}

// Função auxiliar para formatar data
function formatarData(data) {
    if (!data) return 'Não informado';
    
    try {
        const dataObj = new Date(data);
        return dataObj.toLocaleDateString('pt-BR');
    } catch (error) {
        return data;
    }
}

// Normaliza status lido do DOM (corrige caso venha só "Andamento")
function normalizarStatus(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('concl')) return 'Concluído';
    return 'Em Andamento';
}

// Gera um HTML completo estilizado para impressão em modo paisagem
async function gerarRelatorioHTMLParaImpressao(content) {
    // Inferir tipo e período
    const tipoAtual = (window.tipoProcessoAtual && String(window.tipoProcessoAtual)) || (content.titulo?.split(' - ')[0] || '').trim();
    const periodo = content.info?.['Período'] || '';
    const dataGeracao = content.info?.['Data de Geração'] || new Date().toLocaleString('pt-BR');

    // Container e estilo
    const containerId = 'print-mapa-mensal-container';
    const styleId = 'print-mapa-mensal-style';

    // Evitar múltiplos
    document.getElementById(containerId)?.remove();
    document.getElementById(styleId)?.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        :root{ --bg:#f0f2f5; --border:#ddd; --muted:#606770; --primary:#004a99; }
        * { box-sizing: border-box; }
        .pm-print-root{ font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#fff; color:#1c1e21; }
        .pm-page-container{ padding: 0 12mm; }
        .pm-report-header{ text-align:center; border-bottom:2px solid #e0e0e0; padding: 0 0 6px 0; margin: 0 0 8px 0; }
        .pm-report-header h1{ margin:0; font-size: 18px; color: var(--primary); }
        .pm-report-header p{ margin:4px 0 0; color: var(--muted); font-size: 12px; }
        .pm-stats-summary{ display:flex; gap:8px; justify-content: space-between; margin: 8px 0 12px 0; }
        .pm-stat{ flex:1; text-align:center; background:#f7f7f7; border-radius:6px; padding:6px; }
        .pm-stat h3{ margin:0; font-size: 16px; color:#333; }
        .pm-stat p{ margin:0; font-size:10px; text-transform: uppercase; color:#555; }
        .pm-process-card{ border: 1px solid var(--border); border-radius:8px; overflow:hidden; background:#fff; }
        .pm-process-card + .pm-process-card{ margin-top: 6mm; }
        .pm-card-header{ display:flex; justify-content: space-between; align-items:center; background:#e9ecef; color:#343a40; padding:8px 10px; border-bottom:1px solid var(--border); }
        .pm-card-header h2{ margin:0; font-size: 14px; color: var(--primary); }
        .pm-status{ padding:4px 10px; border-radius: 14px; font-size: 11px; font-weight:600; border:1px solid transparent; white-space:nowrap; }
        .pm-status.concluido{ background:#d4edda; color:#155724; border-color:#c3e6cb; }
        .pm-status.andamento{ background:#fff3cd; color:#856404; border-color:#ffeeba; }
        .pm-card-body{ padding:10px; }
        .pm-table{ width:100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 8px 0; }
        .pm-table th, .pm-table td{ border:1px solid #e6e6e6; padding:6px 8px; vertical-align: top; font-size: 12px; }
        .pm-table th{ width: 30%; background: #fafafa; color:#555; text-align:left; font-weight:600; }
        .pm-table-condensed th{ width: 25%; }
        .pm-value-block{ line-height: 1.4; }
        .pm-value-block h4{ margin:2px 0 2px; font-size: 12px; font-weight:700; color:#222; }
        .pm-muted{ color:#555; }
        .pm-print-pages{ margin: 10px 0; }
        .pm-print-page{ page-break-after: always; }
        .pm-print-page:last-child{ page-break-after: auto; }
        @media print {
            @page { margin: 12mm; size: A4 landscape; }
            body { margin: 0; padding: 0; }
            .pm-print-root { background: #fff !important; }
        }
    `;
    document.head.appendChild(style);

    // Separar processos por status
    const processosAndamento = content.processos.filter(p => normalizarStatus(p.status) === 'Em Andamento');
    const processosConcluidos = content.processos.filter(p => normalizarStatus(p.status) === 'Concluído');

    // Função para gerar seção de processos
    function gerarSecaoProcessos(processos, titulo, tipoStatus) {
        if (processos.length === 0) {
            return `<div class="pm-stats-summary">
                <div class="pm-stat">
                    <h3>0</h3>
                    <p>${titulo}</p>
                </div>
            </div>`;
        }

        const statusClass = tipoStatus === 'concluido' ? 'concluido' : 'andamento';
        
        const processosHtml = processos.map(processo => `
            <div class="pm-process-card">
                <div class="pm-card-header">
                    <h2>${processo.numeroProcesso}</h2>
                    <span class="pm-status ${statusClass}">${processo.status}</span>
                </div>
                <div class="pm-card-body">
                    <table class="pm-table pm-table-condensed">
                        <tr>
                            <th>Encarregado</th>
                            <td>${processo.encarregado}</td>
                            <th>PMs Envolvidos</th>
                            <td>${processo.pmsEnvolvidos}</td>
                        </tr>
                        <tr>
                            <th>Data Instauração</th>
                            <td>${processo.detalhes.dataInstauracao}</td>
                            <th>Data Conclusão</th>
                            <td>${processo.detalhes.dataConclusao}</td>
                        </tr>
                        <tr>
                            <th>Documento Origem</th>
                            <td>${processo.detalhes.numeroPortaria}</td>
                            <th>Solução</th>
                            <td>${processo.solucao}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `).join('');

        return `
            <div class="pm-stats-summary">
                <div class="pm-stat">
                    <h3>${processos.length}</h3>
                    <p>${titulo}</p>
                </div>
            </div>
            ${processosHtml}
        `;
    }

    // Gerar HTML completo
    const htmlContent = `
        <div id="${containerId}" class="pm-print-root">
            <div class="pm-page-container">
                <!-- Cabeçalho do Relatório -->
                <div class="pm-report-header">
                    <h1>${content.titulo}</h1>
                    <p>Gerado em: ${dataGeracao}</p>
                </div>

                <!-- Resumo Estatísticas -->
                <div class="pm-stats-summary">
                    <div class="pm-stat">
                        <h3>${content.stats.total || 0}</h3>
                        <p>Total de Processos</p>
                    </div>
                    <div class="pm-stat">
                        <h3>${content.stats.andamento || 0}</h3>
                        <p>Em Andamento</p>
                    </div>
                    <div class="pm-stat">
                        <h3>${content.stats.concluidos || 0}</h3>
                        <p>Concluídos</p>
                    </div>
                </div>

                <div class="pm-print-pages">
                    <!-- Seção de Processos em Andamento -->
                    ${processosAndamento.length > 0 ? `
                        <div class="pm-print-page">
                            <h3 style="color: var(--primary); margin: 8px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                                Processos em Andamento
                            </h3>
                            ${gerarSecaoProcessos(processosAndamento, 'Em Andamento', 'andamento')}
                        </div>
                    ` : ''}

                    <!-- Seção de Processos Concluídos -->
                    ${processosConcluidos.length > 0 ? `
                        <div class="pm-print-page">
                            <h3 style="color: var(--primary); margin: 8px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px;">
                                Processos Concluídos
                            </h3>
                            ${gerarSecaoProcessos(processosConcluidos, 'Concluídos', 'concluido')}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Adicionar ao DOM
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    return document.getElementById(containerId);
}

// Função principal para gerar PDF usando jsPDF
async function gerarDocumentoPDF(content, titulo) {
    try {
        // Carregar jsPDF se não estiver carregado
        if (typeof jsPDF === 'undefined') {
            throw new Error('jsPDF não está carregado');
        }

        console.log('Iniciando geração de PDF...', content);
        
        // Criar elemento HTML para impressão
        const elementoImpressao = await gerarRelatorioHTMLParaImpressao(content);
        
        // Aguardar um momento para o CSS ser aplicado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Configurar jsPDF (orientação paisagem)
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Configurações para html2canvas
        const opcoes = {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: elementoImpressao.scrollWidth,
            height: elementoImpressao.scrollHeight,
            scrollX: 0,
            scrollY: 0
        };

        console.log('Convertendo HTML para canvas...');
        
        // Converter HTML para canvas usando html2canvas
        const canvas = await html2canvas(elementoImpressao, opcoes);
        const imgData = canvas.toDataURL('image/png', 0.95);
        
        // Carregar e adicionar logo no cabeçalho
        const logo = new Image();
        logo.src = 'static/images/pm_ro-removebg-preview.png';
        
        await new Promise((resolve, reject) => {
            logo.onload = resolve;
            logo.onerror = () => {
                console.warn('⚠️ Não foi possível carregar o logo');
                resolve(); // Continua mesmo sem logo
            };
        });
        
        // Dimensões da página em mm (A4 paisagem)
        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 10;
        
        let yOffset = margin;
        
        // Se o logo foi carregado com sucesso, adicioná-lo
        if (logo.complete && logo.naturalHeight !== 0) {
            // Adicionar logo centralizado (42mm de largura para paisagem - 40% maior)
            const logoWidth = 42;
            const logoHeight = (logo.height * logoWidth) / logo.width;
            const logoX = (pageWidth - logoWidth) / 2; // Centralizar
            pdf.addImage(logo, 'PNG', logoX, yOffset, logoWidth, logoHeight);
            yOffset += logoHeight + 5; // Espaço após o logo
        }
        
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = pageHeight - yOffset - margin; // Ajustar altura disponível
        
        // Calcular dimensões da imagem
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(maxWidth / (imgWidth * 0.264583), maxHeight / (imgHeight * 0.264583));
        
        const finalWidth = imgWidth * 0.264583 * ratio;
        const finalHeight = imgHeight * 0.264583 * ratio;
        
        // Centralizar na página (considerando o espaço do logo)
        const x = (pageWidth - finalWidth) / 2;
        const espacoDisponivel = pageHeight - yOffset - margin;
        const y = yOffset + (espacoDisponivel - finalHeight) / 2;
        
        console.log('Adicionando imagem ao PDF...');
        
        // Adicionar imagem ao PDF
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        
        // Nome do arquivo
        const nomeArquivo = `mapa_mensal_${titulo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
        
        console.log('Salvando PDF:', nomeArquivo);
        
        // Salvar PDF
        pdf.save(nomeArquivo);
        
        // Remover elemento temporário
        elementoImpressao.remove();
        document.getElementById('print-mapa-mensal-style')?.remove();
        
        console.log('PDF gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        throw error;
    }
}

// Funções de utilidade e estado
function mostrarEstadoVazio() {
    document.getElementById('resultados').classList.add('d-none');
    document.getElementById('estadoVazio').classList.remove('d-none');
}

function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    if (mostrar) {
        loading.classList.remove('d-none');
    } else {
        loading.classList.add('d-none');
    }
}

function mostrarAlerta(mensagem, tipo = 'info') {
    // Implementar sistema de alertas
    const alertContainer = document.createElement('div');
    alertContainer.className = `alert alert-${tipo} alert-dismissible fade show`;
    alertContainer.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container-fluid') || document.body;
    container.insertBefore(alertContainer, container.firstChild);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        alertContainer.remove();
    }, 5000);
}

// Função para salvar mapa automaticamente
async function salvarMapaAutomaticamente(resultado) {
    try {
        console.log('💾 Salvando mapa automaticamente...');
        
        const dadosParaSalvar = {
            dados: resultado.dados,
            meta: resultado.meta
        };
        
        const resultadoSalvar = await eel.salvar_mapa_mensal(dadosParaSalvar)();
        
        if (resultadoSalvar.sucesso) {
            console.log('✅ Mapa salvo automaticamente');
            // Atualizar lista de mapas anteriores
            carregarMapasAnteriores();
        } else {
            console.warn('⚠️ Erro ao salvar mapa:', resultadoSalvar.mensagem);
        }
    } catch (error) {
        console.error('❌ Erro ao salvar mapa automaticamente:', error);
    }
}

// Carregar mapas anteriores
async function carregarMapasAnteriores() {
    try {
        console.log('📂 Carregando mapas anteriores...');
        
        const resultado = await eel.listar_mapas_anteriores()();
        
        if (resultado.sucesso) {
            const container = document.getElementById('mapasAnteriores');
            
            if (resultado.mapas.length === 0) {
                container.innerHTML = '<p class="text-muted text-center py-3">Nenhum mapa salvo encontrado.</p>';
                return;
            }
            
            const mapasHtml = resultado.mapas.map(mapa => {
                const data = new Date(mapa.data_criacao).toLocaleString('pt-BR');
                return `
                    <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${mapa.tipo_processo} - ${mapa.periodo_descricao}</h6>
                            <small class="text-muted">Criado em: ${data}</small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="visualizarMapaAnterior(${mapa.id})">
                                <i class="bi bi-eye"></i> Visualizar PDF
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = mapasHtml;
            
            console.log(`✅ ${resultado.mapas.length} mapas anteriores carregados`);
        } else {
            console.error('❌ Erro ao carregar mapas anteriores:', resultado.mensagem);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar mapas anteriores:', error);
    }
}

// Visualizar mapa anterior (gerar PDF)
async function visualizarMapaAnterior(mapaId) {
    try {
        console.log(`👁️ Visualizando mapa anterior: ${mapaId}`);
        
        const resultado = await eel.obter_dados_mapa_salvo(mapaId)();
        
        if (resultado.sucesso) {
            console.log('✅ Dados do mapa carregados, gerando PDF...');
            
            // Converter dados salvos para formato de PDF
            const pdfContent = converterDadosSalvosParaPDF(resultado.dados);
            
            // Gerar PDF
            await gerarDocumentoPDF(pdfContent, pdfContent.titulo);
            
            console.log('✅ PDF do mapa anterior gerado com sucesso!');
        } else {
            console.error('❌ Erro ao carregar dados do mapa:', resultado.mensagem);
            mostrarAlerta('Erro ao carregar dados do mapa: ' + resultado.mensagem, 'danger');
        }
    } catch (error) {
        console.error('❌ Erro ao visualizar mapa anterior:', error);
        mostrarAlerta('Erro ao visualizar mapa anterior.', 'danger');
    }
}

function converterDadosSalvosParaPDF(dadosSalvos) {
    // Os dados salvos têm a estrutura: { dados: [...], meta: {...} }
    const dados = dadosSalvos.dados || [];
    const meta = dadosSalvos.meta || {};
    
    // Armazenar dados globalmente para uso nas funções de PDF
    window.dadosProcessos = dados;
    window.tipoProcessoAtual = meta.tipo_processo;
    
    // Construir informações do mapa
    const info = {
        'Tipo de Processo': meta.tipo_processo || '',
        'Período': meta.mes_nome && meta.ano ? `${meta.mes_nome}/${meta.ano}` : meta.periodo_descricao || '',
        'Data de Geração': meta.data_geracao || new Date().toLocaleString('pt-BR')
    };
    
    // Construir estatísticas
    const stats = {
        'total': meta.total_processos || 0,
        'concluidos': meta.total_concluidos || 0,
        'andamento': meta.total_andamento || 0
    };
    
    // Converter processos para o formato esperado
    const processos = dados.map((processo, index) => {
        return {
            id: processo.id,
            numero: index + 1,
            numeroProcesso: `${processo.numero}/${processo.ano}`,
            descricao: processo.numero_portaria ? 
                `Portaria nº ${processo.numero_portaria}/${processo.ano}` : 
                (processo.numero_memorando ? `Memorando nº ${processo.numero_memorando}/${processo.ano}` : ''),
            status: processo.concluido ? 'Concluído' : 'Em Andamento',
            encarregado: processo.responsavel?.completo || 'Não informado',
            pmsEnvolvidos: processo.pms_envolvidos?.map(pm => pm.completo).join(', ') || 'Nenhum PM informado',
            solucao: processo.concluido ? 
                (processo.solucao?.solucao_tipo || 'Concluído') : 
                'Em Andamento',
            detalhes: {
                dataInstauracao: formatarData(processo.data_instauracao),
                dataConclusao: processo.data_conclusao ? formatarData(processo.data_conclusao) : 'Não se aplica',
                numeroPortaria: processo.numero_portaria ? 
                    `Portaria nº ${processo.numero_portaria}/${processo.ano}` : 
                    (processo.numero_memorando ? `Memorando nº ${processo.numero_memorando}/${processo.ano}` : 'Não informado'),
                numeroControle: processo.numero || 'Não informado',
                numeroRGF: processo.numero_rgf || 'Não informado',
                resumoFatos: processo.resumo_fatos || 'Não informado',
                tipoProcesso: meta.tipo_processo || '',
                solucaoCompleta: {
                    dataRemessa: processo.solucao?.data_remessa ? 
                        formatarData(processo.solucao.data_remessa) : 'Não informado',
                    dataJulgamento: ['PAD', 'PADS', 'CD', 'CJ'].includes(meta.tipo_processo) ? 
                        (processo.solucao?.data_julgamento ? formatarData(processo.solucao.data_julgamento) : 'Não informado') : 'Não se aplica',
                    resultado: processo.solucao?.solucao_final || processo.solucao?.solucao_tipo || 'Não informado'
                },
                ultimaMovimentacao: processo.status === 'Concluído' ? 'Não se aplica' : 
                    formatarUltimaMovimentacao(processo.ultima_movimentacao)
            }
        };
    });
    
    return {
        titulo: meta.tipo_processo ? `${meta.tipo_processo} - ${info.Período}` : info.Período,
        info: info,
        stats: stats,
        processos: processos
    };
}

function formatarUltimaMovimentacao(movimentacao) {
    if (!movimentacao) return 'Não informado';
    if (typeof movimentacao === 'string') return movimentacao;
    return JSON.stringify(movimentacao);
}

function formatarDataHora(dataString) {
    try {
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dataString;
    }
}
