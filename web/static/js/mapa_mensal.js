// mapa_mensal.js - JavaScript para funcionalidade do Mapa Mensal

document.addEventListener('DOMContentLoaded', function() {
    inicializarMapaMensal();
});

function inicializarMapaMensal() {
    console.log('🗓️ Inicializando Mapa Mensal...');
    
    // Inicializar elementos da página
    inicializarAnos();
    carregarTiposProcesso();
    
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
    
    // Gerar tabela
    gerarTabelaProcessos(dados, meta.tipo_processo);
    
    // Mostrar resultados
    document.getElementById('resultados').classList.remove('d-none');
    document.getElementById('estadoVazio').classList.add('d-none');
}

function gerarTabelaProcessos(processos, tipoProcesso) {
    const corpoTabela = document.getElementById('corpoTabelaProcessos');
    corpoTabela.innerHTML = '';
    
    // Armazenar dados originais globalmente para acesso posterior
    window.dadosProcessos = processos;
    
    processos.forEach((processo, index) => {
        const linha = criarLinhaProcesso(processo, tipoProcesso, index + 1);
        corpoTabela.appendChild(linha);
        
        // Criar linha de detalhes (inicialmente oculta)
        const linhaDetalhes = criarLinhaDetalhes(processo, tipoProcesso);
        corpoTabela.appendChild(linhaDetalhes);
    });
}

function criarLinhaProcesso(processo, tipoProcesso, numero) {
    const linha = document.createElement('tr');
    linha.className = 'processo-linha';
    linha.dataset.processoId = processo.id;
    
    const statusClass = processo.concluido ? 'status-concluido' : 'status-andamento';
    const statusIcon = processo.concluido ? 'check-circle-fill' : 'clock-fill';
    const statusTexto = processo.concluido ? 'Concluído' : 'Em Andamento';
    
    // Gerar lista de PMs (máximo 2 visíveis)
    const pmsHtml = processo.pms_envolvidos.slice(0, 2).map(pm => 
        `<span class="pm-badge">${pm.posto_graduacao || ''} ${pm.nome}</span>`
    ).join(' ');
    const pmsMais = processo.pms_envolvidos.length > 2 ? 
        `<span class="pm-badge">+${processo.pms_envolvidos.length - 2}</span>` : '';
    
    // Gerar solução resumida
    const solucaoHtml = criarSolucaoResumida(processo, tipoProcesso);
    
    linha.innerHTML = `
        <td data-label="#">${numero}</td>
        <td data-label="Número">
            <div class="processo-numero">${processo.numero}/${processo.ano}</div>
            <small class="text-muted">${getDescricaoNumero(processo, tipoProcesso)}</small>
        </td>
        <td data-label="Status">
            <span class="status-badge ${statusClass}">
                <i class="bi bi-${statusIcon} me-1"></i>${statusTexto}
            </span>
        </td>
        <td data-label="Encarregado">
            <div class="fw-semibold">${processo.responsavel.completo || 'Não informado'}</div>
        </td>
        <td data-label="PMs Envolvidos">
            <div class="pms-container">
                ${pmsHtml}${pmsMais}
            </div>
        </td>
        <td data-label="Solução">
            ${solucaoHtml}
        </td>
        <td data-label="Ações">
            <button class="expand-btn" onclick="toggleDetalhes(this)" title="Ver detalhes">
                <i class="bi bi-eye"></i>
            </button>
        </td>
    `;
    
    return linha;
}

function criarLinhaDetalhes(processo, tipoProcesso) {
    const linha = document.createElement('tr');
    linha.className = 'details-row d-none';
    linha.dataset.processoId = processo.id;
    
    linha.innerHTML = `
        <td colspan="7">
            <div class="details-content">
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-label">Data de Instauração</div>
                        <div class="info-value">${formatarData(processo.data_instauracao)}</div>
                    </div>
                    ${processo.data_conclusao ? `
                        <div class="info-card">
                            <div class="info-label">Data de Conclusão</div>
                            <div class="info-value">${formatarData(processo.data_conclusao)}</div>
                        </div>
                    ` : ''}
                    ${getNumeroDocumento(processo, tipoProcesso)}
                    ${processo.numero_rgf ? `
                        <div class="info-card">
                            <div class="info-label">Número do RGF</div>
                            <div class="info-value">${processo.numero_rgf}</div>
                        </div>
                    ` : ''}
                </div>
                
                ${processo.resumo_fatos ? `
                    <div class="info-card">
                        <div class="info-label">Resumo dos Fatos</div>
                        <div class="info-value">${processo.resumo_fatos}</div>
                    </div>
                ` : ''}
                
                ${criarSecaoEnvolvidos(processo.pms_envolvidos, tipoProcesso)}
                ${criarSecaoIndicios(processo.indicios)}
                ${criarSecaoSolucaoCompleta(processo, tipoProcesso)}
                ${criarSecaoMovimentacao(processo.ultima_movimentacao)}
            </div>
        </td>
    `;
    
    return linha;
}

function criarSolucaoResumida(processo, tipoProcesso) {
    if (!processo.concluido) {
        return '<span class="text-muted">-</span>';
    }
    
    const cor = getCorSolucao(processo.solucao_final, tipoProcesso);
    const badgeClass = cor.includes('success') ? 'bg-success' : 
                       cor.includes('warning') ? 'bg-warning' : 
                       cor.includes('danger') ? 'bg-danger' : 'bg-secondary';
    
    return `<span class="solucao-badge ${badgeClass} text-white">${processo.solucao_final || 'Não informado'}</span>`;
}

function getDescricaoNumero(processo, tipoProcesso) {
    switch (tipoProcesso) {
        case 'SR':
        case 'IPM':
            return processo.numero_portaria ? `Portaria nº ${processo.numero_portaria}/${processo.ano}` : '';
        case 'PADS':
            return processo.numero_memorando ? `Memorando nº ${processo.numero_memorando}/${processo.ano}` : '';
        case 'PAD':
        case 'CD':
        case 'CJ':
            return processo.numero_portaria ? `Portaria nº ${processo.numero_portaria}/${processo.ano}` : '';
        default:
            return '';
    }
}

function getNumeroDocumento(processo, tipoProcesso) {
    switch (tipoProcesso) {
        case 'SR':
        case 'IPM':
        case 'PAD':
        case 'CD':
        case 'CJ':
            return processo.numero_portaria ? `
                <div class="info-card">
                    <div class="info-label">Número da Portaria</div>
                    <div class="info-value">Portaria nº ${processo.numero_portaria}/${processo.ano}</div>
                </div>
            ` : '';
        case 'PADS':
            return processo.numero_memorando ? `
                <div class="info-card">
                    <div class="info-label">Número do Memorando</div>
                    <div class="info-value">Memorando nº ${processo.numero_memorando}/${processo.ano}</div>
                </div>
            ` : '';
        default:
            return '';
    }
}

function criarSecaoEnvolvidos(pmsEnvolvidos, tipoProcesso) {
    if (!pmsEnvolvidos || pmsEnvolvidos.length === 0) {
        return '';
    }
    
    const titulo = getTituloEnvolvidos(tipoProcesso);
    const envolvidos = pmsEnvolvidos.map(pm => `
        <div class="pm-badge">${pm.posto_graduacao || ''} ${pm.nome}</div>
        ${criarIndiciosPM(pm.indicios)}
    `).join('');
    
    return `
        <div class="info-card">
            <div class="info-label">${titulo}</div>
            <div class="info-value">${envolvidos}</div>
        </div>
    `;
}

function criarSecaoSolucaoCompleta(processo, tipoProcesso) {
    if (!processo.concluido) {
        return '';
    }
    
    const labelSolucao = getTipoSolucaoLabel(tipoProcesso);
    const cor = getCorSolucao(processo.solucao_final, tipoProcesso);
    
    return `
        <div class="info-card">
            <div class="info-label">Solução Final</div>
            <div class="info-value">
                ${processo.data_conclusao ? `
                    <div class="mb-2">
                        <strong>Data de Conclusão:</strong> ${formatarData(processo.data_conclusao)}
                    </div>
                ` : ''}
                <div class="mb-2">
                    <strong>${labelSolucao}:</strong> 
                    <span class="solucao-badge ${cor}">${processo.solucao_final || 'Não informado'}</span>
                </div>
                ${processo.penalidade_tipo ? `
                    <div class="mb-2">
                        <strong>Penalidade:</strong> ${processo.penalidade_tipo}
                        ${processo.penalidade_dias ? ` (${processo.penalidade_dias} dias)` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function toggleDetalhes(botao) {
    const linha = botao.closest('tr');
    const processoId = linha.dataset.processoId;
    const linhaDetalhes = linha.nextElementSibling;
    const icone = botao.querySelector('i');
    
    if (linhaDetalhes.classList.contains('d-none')) {
        linhaDetalhes.classList.remove('d-none');
        icone.className = 'bi bi-eye-slash';
        botao.title = 'Ocultar detalhes';
    } else {
        linhaDetalhes.classList.add('d-none');
        icone.className = 'bi bi-eye';
        botao.title = 'Ver detalhes';
    }
}

function getTituloEnvolvidos(tipoProcesso) {
    switch (tipoProcesso) {
        case 'SR':
            return 'Sindicado(s)';
        case 'IPM':
            return 'Indiciado(s)/Investigado(s)';
        case 'PAD':
        case 'PADS':
        case 'CD':
        case 'CJ':
            return 'Acusado(s)';
        default:
            return 'Envolvido(s)';
    }
}

function criarListaEnvolvidos(envolvidos, tipoProcesso) {
    if (!envolvidos || envolvidos.length === 0) {
        return '<p class="text-muted mb-0">Nenhum envolvido informado</p>';
    }
    
    return envolvidos.map(pm => {
        let html = `
            <div class="pm-envolvido">
                <strong>${pm.completo}</strong>
                ${pm.tipo_envolvimento ? `<br><small class="text-muted">${pm.tipo_envolvimento}</small>` : ''}
        `;
        
        // Adicionar indícios específicos do PM (para procedimentos SR/IPM)
        if (pm.indicios && (tipoProcesso === 'SR' || tipoProcesso === 'IPM')) {
            html += criarIndiciosPM(pm.indicios, pm.nome);
        }
        
        html += '</div>';
        return html;
    }).join('');
}

function criarIndiciosPM(indicios, nomePM) {
    let html = '';
    
    // Categorias gerais de indícios
    if (indicios.categorias && indicios.categorias.length > 0) {
        html += '<div class="mt-2"><small class="fw-bold text-primary">Apontamento de Indícios:</small>';
        indicios.categorias.forEach(categoria => {
            let corCategoria = 'text-info';
            let iconCategoria = 'info-circle';
            
            if (categoria.toLowerCase().includes('não houve')) {
                corCategoria = 'text-success';
                iconCategoria = 'check-circle';
            } else if (categoria.toLowerCase().includes('indícios')) {
                corCategoria = 'text-warning';
                iconCategoria = 'exclamation-triangle';
            }
            
            html += `<div class="ms-2">
                <small class="${corCategoria}">
                    <i class="bi bi-${iconCategoria}"></i> ${categoria}
                </small>
            </div>`;
        });
        html += '</div>';
    }
    
    // Crimes específicos
    if (indicios.crimes && indicios.crimes.length > 0) {
        html += '<div class="mt-2"><small class="fw-bold text-danger">Crimes Específicos:</small>';
        indicios.crimes.forEach(crime => {
            html += `<div class="ms-2">
                <small class="text-danger">
                    <i class="bi bi-exclamation-diamond"></i> ${crime.texto_completo}
                </small>
            </div>`;
        });
        html += '</div>';
    }
    
    // Transgressões RDPM específicas
    if (indicios.transgressoes && indicios.transgressoes.length > 0) {
        html += '<div class="mt-2"><small class="fw-bold text-warning">Transgressões RDPM Específicas:</small>';
        indicios.transgressoes.forEach(trans => {
            html += `<div class="ms-2">
                <small class="text-warning">
                    <i class="bi bi-exclamation-triangle"></i> ${trans.texto_completo}
                </small>
            </div>`;
        });
        html += '</div>';
    }
    
    // Infrações Art. 29 específicas
    if (indicios.art29 && indicios.art29.length > 0) {
        html += '<div class="mt-2"><small class="fw-bold text-secondary">Infrações Art. 29 Específicas:</small>';
        indicios.art29.forEach(art29 => {
            html += `<div class="ms-2">
                <small class="text-secondary">
                    <i class="bi bi-list-check"></i> ${art29.texto_completo}
                </small>
            </div>`;
        });
        html += '</div>';
    }
    
    return html;
}

function criarSecaoIndicios(indicios) {
    const temIndicios = indicios.crimes.length > 0 || indicios.transgressoes.length > 0 || indicios.art29.length > 0;
    
    if (!temIndicios) {
        return '';
    }
    
    let html = '<div class="mt-3"><h6 class="section-title">Indícios Gerais do Procedimento</h6>';
    html += '<div class="alert alert-info p-2 mb-2"><small><i class="bi bi-info-circle"></i> Estes são os indícios gerais do procedimento. Para SR e IPM, veja os indícios específicos de cada envolvido na seção acima.</small></div>';
    
    // Crimes
    if (indicios.crimes.length > 0) {
        html += '<div class="mb-2"><strong>Crimes/Contravenções:</strong></div>';
        indicios.crimes.forEach(crime => {
            html += `<div class="indicio-item">${crime.texto_completo}</div>`;
        });
    }
    
    // Transgressões RDPM
    if (indicios.transgressoes.length > 0) {
        html += '<div class="mb-2 mt-2"><strong>Transgressões RDPM:</strong></div>';
        indicios.transgressoes.forEach(trans => {
            html += `<div class="indicio-item">${trans.texto_completo}</div>`;
        });
    }
    
    // Infrações Art. 29
    if (indicios.art29.length > 0) {
        html += '<div class="mb-2 mt-2"><strong>Infrações Estatuto Art. 29:</strong></div>';
        indicios.art29.forEach(art29 => {
            html += `<div class="indicio-item">${art29.texto_completo}</div>`;
        });
    }
    
    html += '</div>';
    return html;
}

function criarSecaoSolucao(processo, tipoProcesso) {
    if (!processo.concluido) {
        return '';
    }
    
    let html = '<div class="solucao-box mt-3">';
    html += '<h6 class="section-title">Solução/Conclusão</h6>';
    
    if (processo.solucao.data_remessa) {
        html += `<div class="info-item">
            <span class="info-label">Data de Remessa do Encarregado:</span> 
            ${formatarData(processo.solucao.data_remessa)}
        </div>`;
    }
    
    // Para PADS, PAD, CD, CJ mostrar data do julgamento
    if (['PAD', 'PADS', 'CD', 'CJ'].includes(tipoProcesso) && processo.solucao.data_julgamento) {
        html += `<div class="info-item">
            <span class="info-label">Data do Julgamento:</span> 
            ${formatarData(processo.solucao.data_julgamento)}
        </div>`;
    }
    
    // Mostrar solução baseada no tipo de processo
    if (processo.solucao.solucao_tipo || processo.solucao.solucao_final) {
        const labelSolucao = getTipoSolucaoLabel(tipoProcesso);
        const textoSolucao = processo.solucao.solucao_tipo || processo.solucao.solucao_final;
        const corSolucao = getCorSolucao(textoSolucao, tipoProcesso);
        
        html += `<div class="info-item">
            <span class="info-label">${labelSolucao}:</span> 
            <span class="badge ${corSolucao}">${textoSolucao}</span>
        </div>`;
    }
    
    // Para tipos que podem ter penalidade (PADS, PAD, CD, CJ), mostrar penalidade
    if (['PAD', 'PADS', 'CD', 'CJ'].includes(tipoProcesso) && processo.solucao.penalidade_tipo) {
        html += `<div class="info-item">
            <span class="info-label">Penalidade:</span> 
            <span class="badge bg-danger text-white">${processo.solucao.penalidade_tipo}</span>
            ${processo.solucao.penalidade_dias ? ` <small class="text-muted">(${processo.solucao.penalidade_dias} dias)</small>` : ''}
        </div>`;
    }
    
    // Data da conclusão - por último e destacada
    if (processo.data_conclusao) {
        html += `<div class="info-item">
            <span class="info-label">Data da Conclusão:</span> 
            <strong class="text-primary">${formatarData(processo.data_conclusao)}</strong>
        </div>`;
    }
    
    html += '</div>';
    return html;
}

function getTipoSolucaoLabel(tipoProcesso) {
    switch (tipoProcesso) {
        case 'SR':
        case 'IPM':
            return 'Solução'; // Para procedimentos (pode ser: Homologado, Avocado, Arquivado)
        case 'PAD':
        case 'PADS':
        case 'CD':
        case 'CJ':
            return 'Decisão Final'; // Para processos (pode ser: Punido, Absolvido, Arquivado)
        default:
            return 'Solução';
    }
}

function getCorSolucao(solucao, tipoProcesso) {
    if (!solucao) return 'bg-secondary';
    
    const solucaoLower = solucao.toLowerCase();
    
    // Para IPM e SR
    if (['SR', 'IPM'].includes(tipoProcesso)) {
        if (solucaoLower.includes('homologado')) {
            return 'bg-success text-white';
        } else if (solucaoLower.includes('avocado')) {
            return 'bg-warning text-dark';
        } else if (solucaoLower.includes('arquivado')) {
            return 'bg-secondary text-white';
        }
    }
    
    // Para PAD, PADS, CD, CJ
    if (['PAD', 'PADS', 'CD', 'CJ'].includes(tipoProcesso)) {
        if (solucaoLower.includes('punido')) {
            return 'bg-danger text-white';
        } else if (solucaoLower.includes('absolvido')) {
            return 'bg-success text-white';
        } else if (solucaoLower.includes('arquivado')) {
            return 'bg-secondary text-white';
        }
    }
    
    // Padrão
    return 'bg-info text-white';
}

function criarSecaoMovimentacao(movimentacao) {
    if (!movimentacao) {
        return '';
    }
    
    return `
        <div class="movimentacao-box mt-3">
            <h6 class="section-title">Última Movimentação</h6>
            <div class="info-item">
                <span class="info-label">Descrição:</span> ${movimentacao.descricao}
            </div>
            ${movimentacao.destino ? `
                <div class="info-item">
                    <span class="info-label">Destino:</span> ${movimentacao.destino}
                </div>
            ` : ''}
        </div>
    `;
}

function formatarData(data) {
    if (!data) return '';
    
    try {
        const date = new Date(data + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return data;
    }
}

function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    if (mostrar) {
        loading.classList.remove('d-none');
    } else {
        loading.classList.add('d-none');
    }
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
        *{ box-sizing: border-box; }
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
        .pm-two-per-page{ display: grid; grid-template-rows: 1fr 1fr; gap: 6mm; min-height: calc(100vh - 24mm); }
        @media print { @page { size: A4 landscape; margin: 12mm; } body{ background:#fff; }
            #${containerId}{ display:block; }
        }
    `;

    const container = document.createElement('div');
    container.id = containerId;
    container.className = 'pm-print-root';

    const pageContainer = document.createElement('div');
    pageContainer.className = 'pm-page-container';

    // Header
    const header = document.createElement('header');
    header.className = 'pm-report-header';
    header.innerHTML = `
        <h1>Mapa Mensal de Procedimentos e Processos (${tipoAtual || '—'})</h1>
        <p><strong>Período de Referência:</strong> ${periodo || '—'} | <strong>Gerado em:</strong> ${dataGeracao}</p>
    `;

    // Stats
    const stats = document.createElement('section');
    stats.className = 'pm-stats-summary';
    const statsEntries = Object.entries(content.stats || {});
    if (statsEntries.length) {
        statsEntries.forEach(([label, value]) => {
            const stat = document.createElement('div');
            stat.className = 'pm-stat';
            stat.innerHTML = `<h3>${value}</h3><p>${label}</p>`;
            stats.appendChild(stat);
        });
    }

    // Wrapper de páginas
    const printWrapper = document.createElement('div');
    printWrapper.className = 'pm-print-pages';

    // Separar concluídos e andamentos
    const processos = Array.isArray(content.processos) ? content.processos : [];
    const concluidos = processos.filter(p => normalizarStatus(p.status) === 'Concluído');
    const andamentos = processos.filter(p => normalizarStatus(p.status) === 'Em Andamento');

    // Helpers de criação de elementos
    const criarCardMetaTable = (p, tipo) => {
        const table = document.createElement('table');
        table.className = 'pm-table';
        const linhas = [
            ['Documento/Número', p.detalhes?.numeroPortaria || 'Não informado'],
            ['Número de Controle', p.detalhes?.numeroControle || 'Não informado'],
            ['Data de Instauração', p.detalhes?.dataInstauracao || 'Não informado'],
            ['Data de Remessa', p.detalhes?.solucaoCompleta?.dataRemessa || 'Não informado'],
        ];
        if (['PAD','PADS','CD','CJ'].includes(tipo)) {
            const dj = p.detalhes?.solucaoCompleta?.dataJulgamento || 'Não informado';
            linhas.push(['Data de Julgamento', dj]);
        }
        linhas.push(['Data de Conclusão', p.detalhes?.dataConclusao || 'Não informado']);
        linhas.push(['Número RGF', p.detalhes?.numeroRGF || 'Não informado']);
        linhas.push(['Encarregado', p.encarregado || 'Não informado']);
        linhas.push(['PMs Envolvidos', p.pmsEnvolvidos || 'Nenhum PM informado']);
        table.innerHTML = linhas.map(([k,v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
        return table;
    };

    const getLabelSolucao = (tipo) => ['PAD','PADS','CD','CJ'].includes(tipo) ? 'DECISÃO FINAL' : 'SOLUÇÃO';

    const montarIndiciosPMHTML = (procId, tipo) => {
        if (!['IPM','SR'].includes(tipo)) return '';
        const dadosOriginais = (window.dadosProcessos || []).find(p => String(p.id) === String(procId));
        if (!dadosOriginais || !Array.isArray(dadosOriginais.pms_envolvidos)) return '';
        const blocos = [];
        dadosOriginais.pms_envolvidos.forEach(pm => {
            const nomePM = `${pm.posto_graduacao || ''} ${pm.nome}`.trim();
            const linhas = [];
            if (pm.indicios) {
                const { categorias, crimes, transgressoes, art29 } = pm.indicios;
                if (categorias && categorias.length) {
                    categorias.forEach(cat => linhas.push(`<div class="pm-muted">• ${cat}</div>`));
                } else {
                    linhas.push('<div class="pm-muted">• Não houve indícios.</div>');
                }
                if (crimes && crimes.length) {
                    crimes.forEach(c => linhas.push(`<div class="pm-muted">• Crime: ${c.texto_completo}</div>`));
                }
                if (transgressoes && transgressoes.length) {
                    transgressoes.forEach(t => linhas.push(`<div class="pm-muted">• Transgressão: ${t.texto_completo}</div>`));
                }
                if (art29 && art29.length) {
                    art29.forEach(a => linhas.push(`<div class="pm-muted">• Art. 29: ${a.texto_completo}</div>`));
                }
            }
            blocos.push(`<h4>${nomePM}:</h4>${linhas.join('')}`);
        });
        return blocos.join('');
    };

    const criarCardConcluido = (p, tipo) => {
        const art = document.createElement('article');
        art.className = 'pm-process-card pm-concluido';
        const headerCard = document.createElement('div');
        headerCard.className = 'pm-card-header';
        headerCard.innerHTML = `
            <h2>Processo/Procedimento Nº ${p.numeroProcesso}</h2>
            <span class="pm-status concluido">Concluído</span>
        `;
        const body = document.createElement('div');
        body.className = 'pm-card-body';
    body.appendChild(criarCardMetaTable(p, tipo));

        // Tabela condensada
        const table = document.createElement('table');
        table.className = 'pm-table pm-table-condensed';
        const labelSolucao = getLabelSolucao(tipo);
        const dadosOriginais = (window.dadosProcessos || []).find(x => String(x.id) === String(p.id));
        const solucaoValor = ['PAD','PADS','CD','CJ'].includes(tipo)
            ? (p.detalhes?.solucaoCompleta?.penalidade || p.solucao || 'Não informado')
            : ((dadosOriginais?.solucao_final || dadosOriginais?.solucao?.solucao_final || p.solucao) || 'Não informado');

        const linhas = [
            ['RESUMO DOS FATOS', `<div class="pm-value-block">${p.detalhes?.resumoFatos || 'Não informado'}</div>`],
            [labelSolucao, `<div class="pm-value-block">${solucaoValor}</div>`],
        ];

        // Índicios só para IPM/SR
        if (['IPM','SR'].includes(tipo)) {
            const indiciosHTML = montarIndiciosPMHTML(p.id, tipo);
            if (indiciosHTML) {
                linhas.push(['INDÍCIOS APONTADOS', `<div class="pm-value-block">${indiciosHTML}</div>`]);
            }
        }

        table.innerHTML = linhas.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');

        body.appendChild(table);
        art.appendChild(headerCard);
        art.appendChild(body);
        return art;
    };

    const criarCardAndamento = (p, tipo) => {
        const art = document.createElement('article');
        art.className = 'pm-process-card pm-andamento';
        const headerCard = document.createElement('div');
        headerCard.className = 'pm-card-header';
        headerCard.innerHTML = `
            <h2>Processo/Procedimento Nº ${p.numeroProcesso}</h2>
            <span class="pm-status andamento">Em Andamento</span>
        `;
        const body = document.createElement('div');
        body.className = 'pm-card-body';
        body.appendChild(criarCardMetaTable(p, tipo));
        art.appendChild(headerCard);
        art.appendChild(body);
        return art;
    };

    // Páginas: concluídos 1 por página
    concluidos.forEach(p => {
        const page = document.createElement('div');
        page.className = 'pm-print-page';
        const card = criarCardConcluido(p, tipoAtual);
        page.appendChild(card);
        printWrapper.appendChild(page);
    });

    // Páginas: andamentos 2 por página
    for (let i = 0; i < andamentos.length; i += 2) {
        const page = document.createElement('div');
    page.className = 'pm-print-page pm-two-per-page';
    page.appendChild(criarCardAndamento(andamentos[i], tipoAtual));
    if (andamentos[i + 1]) page.appendChild(criarCardAndamento(andamentos[i + 1], tipoAtual));
        printWrapper.appendChild(page);
    }

    // Montar DOM final
    pageContainer.appendChild(header);
    pageContainer.appendChild(stats);
    pageContainer.appendChild(printWrapper);
    container.appendChild(pageContainer);
    document.head.appendChild(style);
    document.body.appendChild(container);

    // Imprimir e limpar
    await new Promise(resolve => setTimeout(resolve, 50)); // garantir render

    const cleanup = () => {
        document.getElementById(containerId)?.remove();
        document.getElementById(styleId)?.remove();
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    if (typeof window.print === 'function') {
        window.print();
    } else {
        // Se não houver print, lança para cair no fallback jsPDF
        cleanup();
        throw new Error('window.print não disponível');
    }
}

function criarConteudoPDF(titulo, infoMapa, estatisticas) {
    // Obter dados completos da tabela e dos dados originais armazenados
    const tabela = document.getElementById('tabelaProcessos');
    const linhas = tabela.querySelectorAll('tbody tr.processo-linha');
    
    // Extrair tipo de processo do título para usar na lógica
    const tipoProcessoMatch = titulo.match(/Mapa Mensal - (\w+) -/);
    window.tipoProcessoAtual = tipoProcessoMatch ? tipoProcessoMatch[1] : '';
    
    let processosData = [];
    linhas.forEach((linha, index) => {
        const processoId = linha.dataset.processoId;
        
        // Buscar dados originais do processo pelos dados armazenados globalmente
        const dadosOriginais = window.dadosProcessos ? 
            window.dadosProcessos.find(p => p.id == processoId) : null;
        
        // Extrair dados da linha principal
        const colunas = linha.querySelectorAll('td');
        const numero = colunas[0].textContent.trim();
        const numeroProcesso = colunas[1].querySelector('.processo-numero')?.textContent.trim() || '';
        const descricao = colunas[1].querySelector('small')?.textContent.trim() || '';
    const statusElement = colunas[2].querySelector('.status-badge');
    const statusRaw = statusElement ? statusElement.textContent.trim() : '';
    const status = normalizarStatus(statusRaw);
        const encarregado = colunas[3].textContent.trim();
        
        // Extrair PMs de forma mais robusta
        const pmBadges = colunas[4].querySelectorAll('.pm-badge');
        const pmsArray = Array.from(pmBadges).map(badge => {
            let texto = badge.textContent.trim();
            if (texto.startsWith('+')) {
                return `${texto} outros`;
            }
            return texto;
        });
        
        const solucaoElement = colunas[5].querySelector('.solucao-badge');
        const solucao = solucaoElement ? solucaoElement.textContent.trim() : 
                       colunas[5].textContent.trim() !== '-' ? colunas[5].textContent.trim() : 'Não se aplica';
        
        // Extrair dados dos detalhes usando dados originais quando disponíveis
        let detalhes = {
            dataInstauracao: dadosOriginais?.data_instauracao ? 
                formatarData(dadosOriginais.data_instauracao) : 'Não informado',
            dataConclusao: status === 'Em Andamento' ? 'Não se aplica' : 
                (dadosOriginais?.data_conclusao ? formatarData(dadosOriginais.data_conclusao) : 'Não informado'),
            numeroPortaria: dadosOriginais?.numero_portaria ? 
                `Portaria nº ${dadosOriginais.numero_portaria}/${dadosOriginais.ano}` : 
                (dadosOriginais?.numero_memorando ? `Memorando nº ${dadosOriginais.numero_memorando}/${dadosOriginais.ano}` : 'Não informado'),
            numeroControle: dadosOriginais?.numero || 'Não informado',
            numeroRGF: dadosOriginais?.numero_rgf || 'Não informado',
            resumoFatos: dadosOriginais?.resumo_fatos || 'Não informado',
            tipoProcesso: window.tipoProcessoAtual || '', // Armazenar tipo para uso posterior
            solucaoCompleta: {
                dataRemessa: dadosOriginais?.solucao?.data_remessa ? 
                    formatarData(dadosOriginais.solucao.data_remessa) : 'Não informado',
                dataJulgamento: ['PAD', 'PADS', 'CD', 'CJ'].includes(window.tipoProcessoAtual) ? 
                    (dadosOriginais?.solucao?.data_julgamento ? formatarData(dadosOriginais.solucao.data_julgamento) : 'Não informado') : 'Não se aplica',
                penalidade: ['PAD', 'PADS', 'CD', 'CJ'].includes(window.tipoProcessoAtual) ? 
                    (dadosOriginais?.solucao?.penalidade_tipo || 'Não se aplica') : 'Não se aplica'
            },
            ultimaMovimentacao: status === 'Concluído' ? 'Não se aplica' : 
                (dadosOriginais?.ultima_movimentacao || 'Não informado')
        };
        
        processosData.push({
            id: processoId, // Adicionar ID para busca posterior
            numero,
            numeroProcesso,
            descricao,
            status,
            encarregado,
            pmsEnvolvidos: pmsArray.join(', ') || 'Nenhum PM informado',
            solucao,
            detalhes
        });
    });
    
    return {
        titulo: titulo.replace(/.*Mapa Mensal - /, ''),
        info: extrairInfoMapa(infoMapa),
        stats: extrairEstatisticas(estatisticas),
        processos: processosData
    };
}

function extrairInfoMapa(infoElement) {
    const cards = infoElement.querySelectorAll('.info-card');
    let info = {};
    
    cards.forEach(card => {
        const label = card.querySelector('.info-label').textContent.trim();
        const value = card.querySelector('.info-value').textContent.trim();
        info[label] = value;
    });
    
    return info;
}

function extrairEstatisticas(statsElement) {
    const cards = statsElement.querySelectorAll('.stats-card');
    let stats = {};
    
    cards.forEach(card => {
        const number = card.querySelector('.stats-number').textContent.trim();
        const label = card.querySelector('.stats-label').textContent.trim();
        stats[label] = number;
    });
    
    return stats;
}

async function gerarDocumentoPDF(content, titulo) {
    const { jsPDF } = window.jspdf;
    
    // Criar PDF em orientação paisagem (horizontal)
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    let currentY = margin;
    
    // Header com gradiente simulado
    pdf.setFillColor(30, 60, 114);
    pdf.rect(margin, currentY, contentWidth, 25, 'F');
    
    // Título
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('MAPA MENSAL P6/7ºBPM', pageWidth / 2, currentY + 13, { align: 'center' });
    
    currentY += 35;
    
    // Informações e Estatísticas
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    
    // Informações em três colunas
    const infoWidth = contentWidth / 3;
    let infoX = margin;
    
    Object.entries(content.info).forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, infoX, currentY);
        pdf.setFont(undefined, 'normal');
        pdf.text(value, infoX, currentY + 5);
        infoX += infoWidth;
    });
    
    currentY += 15;
    
    const statsWidth = contentWidth / 3;
    let statsX = margin;
    
    Object.entries(content.stats).forEach(([label, value]) => {
        pdf.setFillColor(248, 249, 250);
        pdf.rect(statsX, currentY - 5, statsWidth - 5, 15, 'F');
        pdf.setDrawColor(42, 82, 152);
        pdf.rect(statsX, currentY - 5, statsWidth - 5, 15);
        
        pdf.setTextColor(42, 82, 152);
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text(value, statsX + (statsWidth - 5) / 2, currentY + 2, { align: 'center' });
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        pdf.text(label.toUpperCase(), statsX + (statsWidth - 5) / 2, currentY + 8, { align: 'center' });
        
        statsX += statsWidth;
    });
    
    // Aproximar mais a tabela dos dados
    currentY += 12;
    
    // Iterar sobre cada processo
    content.processos.forEach((processo, index) => {
        // Verificar se há espaço suficiente (aproximadamente 100mm para cada processo)
        if (currentY > pageHeight - 110) {
            pdf.addPage();
            currentY = margin + 10;
        }
        
        // Título do processo
        pdf.setFillColor(42, 82, 152);
        pdf.rect(margin, currentY, contentWidth, 12, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${processo.numero}. PROCESSO/PROCEDIMENTO Nº ${processo.numeroProcesso}`, margin + 3, currentY + 8);
        
        // Status no canto direito
        const statusColor = processo.status === 'Concluído' ? [40, 167, 69] : [255, 193, 7];
        pdf.setFillColor(...statusColor);
        pdf.rect(pageWidth - margin - 45, currentY + 1, 40, 10, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(8);
        pdf.text(processo.status, pageWidth - margin - 42, currentY + 7);
        
        currentY += 15;
        
        // Configurações da tabela com 3 colunas
        const colWidths = [45, (contentWidth - 45) * 0.5, (contentWidth - 45) * 0.5]; // Label | Valor | Indícios
        let tableY = currentY;
        
        // Função auxiliar para criar linha da tabela com 3 colunas (com quebra de página)
    function criarLinhaTabela(label, valor, indicios = '', isBold = false) {
            // Configurar fonte base (poderá ser ajustada por célula)
            const baseFontSize = isBold ? 9 : 8;
            pdf.setFont(undefined, isBold ? 'bold' : 'normal');
            pdf.setFontSize(baseFontSize);

            // Fundo alternado para melhor legibilidade
            pdf.setFillColor(248, 249, 250);

            // Quebrar texto se necessário
            const wrappedValue = pdf.splitTextToSize(valor || '', colWidths[1] - 6);
            // Suporte a indicios como string ou como array de objetos { text, bold }
            let wrappedIndicios = [];
            if (Array.isArray(indicios)) {
                wrappedIndicios = indicios.map(l => ({ text: l.text || '', bold: !!l.bold, single: !!l.single }));
            } else if (indicios) {
                const arr = pdf.splitTextToSize(indicios, colWidths[2] - 6);
                wrappedIndicios = arr.map(t => ({ text: t, bold: false, single: false }));
            }
            const cellHeight = Math.max(6, Math.max(wrappedValue.length, wrappedIndicios.length) * 3 + 3);

            // Verificar espaço e fazer quebra de página se necessário
            const footerReserve = 25; // espaço reservado para rodapé
            if (tableY + cellHeight > pageHeight - footerReserve) {
                pdf.addPage();
                // Cabeçalho de continuação do processo
                currentY = margin;
                pdf.setFillColor(42, 82, 152);
                pdf.rect(margin, currentY, contentWidth, 10, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(10);
                pdf.setFont(undefined, 'bold');
                pdf.text(`${processo.numero}. PROCESSO/PROCEDIMENTO Nº ${processo.numeroProcesso} (continuação)`, margin + 3, currentY + 7);
                currentY += 12;

                // Recriar cabeçalho da tabela
                tableY = currentY;
                pdf.setFont(undefined, 'bold');
                pdf.setFontSize(9);
                pdf.setFillColor(42, 82, 152);
                pdf.rect(margin, tableY, colWidths[0], 8, 'F');
                pdf.rect(margin + colWidths[0], tableY, colWidths[1], 8, 'F');
                pdf.rect(margin + colWidths[0] + colWidths[1], tableY, colWidths[2], 8, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.text('CAMPO', margin + 2, tableY + 5);
                pdf.text('INFORMAÇÃO', margin + colWidths[0] + 2, tableY + 5);
                pdf.text('INDÍCIOS APONTADOS', margin + colWidths[0] + colWidths[1] + 2, tableY + 5);
                tableY += 8;
                pdf.setTextColor(0, 0, 0);

                // Reconfigurar fonte da linha atual
                pdf.setFont(undefined, isBold ? 'bold' : 'normal');
                pdf.setFontSize(isBold ? 9 : 8);
            }

            // Desenhar células com borda
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(margin, tableY, colWidths[0], cellHeight, 'FD');
            pdf.rect(margin + colWidths[0], tableY, colWidths[1], cellHeight, 'FD');
            pdf.rect(margin + colWidths[0] + colWidths[1], tableY, colWidths[2], cellHeight, 'FD');

            // Adicionar texto
            pdf.setTextColor(0, 0, 0);
            // Label em negrito apenas para a linha "PMs Envolvidos:" (e conforme isBold para as demais)
            const labelIsBold = label === 'PMs Envolvidos:' ? true : isBold;
            const valueIsBold = label === 'PMs Envolvidos:' ? false : isBold;
            pdf.setFont(undefined, labelIsBold ? 'bold' : 'normal');
            pdf.text(label, margin + 2, tableY + 4);
            pdf.setFont(undefined, valueIsBold ? 'bold' : 'normal');
            pdf.text(wrappedValue, margin + colWidths[0] + 2, tableY + 4);
            if (wrappedIndicios.length) {
                // Desenhar cada linha respeitando bold por linha; se for linha 'single', reduzir fonte para caber em uma linha
                let lineY = tableY + 4;
                wrappedIndicios.forEach((line) => {
                    const { text, bold, single } = line;
                    // Ajuste de fonte para caber em uma linha caso 'single'
                    if (single) {
                        // Tentar caber na largura em uma linha sem quebra
                        const available = colWidths[2] - 6;
                        // Começar da baseFontSize ou 8 e reduzir até 6
                        let trySize = baseFontSize;
                        if (trySize > 8) trySize = 8;
                        pdf.setFont(undefined, bold ? 'bold' : 'normal');
                        pdf.setFontSize(trySize);
                        let w = pdf.getTextWidth(text);
                        while (w > available && trySize > 6) {
                            trySize -= 0.5;
                            pdf.setFontSize(trySize);
                            w = pdf.getTextWidth(text);
                        }
                        pdf.text(text, margin + colWidths[0] + colWidths[1] + 2, lineY);
                        // Restaurar tamanho base
                        pdf.setFontSize(baseFontSize);
                    } else {
                        pdf.setFont(undefined, bold ? 'bold' : 'normal');
                        pdf.setFontSize(baseFontSize);
                        pdf.text(text, margin + colWidths[0] + colWidths[1] + 2, lineY);
                    }
                    lineY += 3;
                });
                // Restaurar fonte para próxima célula
                pdf.setFont(undefined, isBold ? 'bold' : 'normal');
                pdf.setFontSize(baseFontSize);
            }

            tableY += cellHeight;
            return cellHeight;
        }
        
        // Função para criar cabeçalho da tabela de 3 colunas
        function criarCabecalhoTabela() {
            pdf.setFont(undefined, 'bold');
            pdf.setFontSize(9);
            pdf.setFillColor(42, 82, 152);
            
            // Desenhar cabeçalho
            pdf.rect(margin, tableY, colWidths[0], 8, 'F');
            pdf.rect(margin + colWidths[0], tableY, colWidths[1], 8, 'F');
            pdf.rect(margin + colWidths[0] + colWidths[1], tableY, colWidths[2], 8, 'F');
            
            // Texto do cabeçalho
            pdf.setTextColor(255, 255, 255);
            pdf.text('CAMPO', margin + 2, tableY + 5);
            pdf.text('INFORMAÇÃO', margin + colWidths[0] + 2, tableY + 5);
            pdf.text('INDÍCIOS APONTADOS', margin + colWidths[0] + colWidths[1] + 2, tableY + 5);
            
            tableY += 8;
            pdf.setTextColor(0, 0, 0);
        }
        
    // Criar cabeçalho da tabela (apenas uma vez)
    criarCabecalhoTabela();
        
        // Preparar conteúdo de indícios como fluxo contínuo na terceira coluna, começando na primeira linha
        let indiciosWrappedLines = [];
        if (['IPM', 'SR'].includes(window.tipoProcessoAtual) && processo.status === 'Concluído') {
            const dadosOriginais = window.dadosProcessos ?
                window.dadosProcessos.find(p => p.id == processo.id) : null;
            if (dadosOriginais && dadosOriginais.pms_envolvidos && dadosOriginais.pms_envolvidos.length > 0) {
                const linhasIndicios = [];
                dadosOriginais.pms_envolvidos.forEach((pm, idx) => {
                    const nomePM = `${pm.posto_graduacao || ''} ${pm.nome}`.trim();
                    linhasIndicios.push({ text: `${nomePM.toUpperCase()}:`, bold: true });
                    if (pm.indicios) {
                        const { categorias, crimes, transgressoes, art29 } = pm.indicios;
                        if ((categorias && categorias.length) || (crimes && crimes.length) || (transgressoes && transgressoes.length) || (art29 && art29.length)) {
                            if (categorias && categorias.length) {
                                categorias.forEach(c => linhasIndicios.push({ text: `• ${c}`, bold: false }));
                            }
                            if (crimes && crimes.length) {
                                crimes.forEach(crime => linhasIndicios.push({ text: `- Crime: ${crime.texto_completo}` , bold: false, single: true }));
                            }
                            if (transgressoes && transgressoes.length) {
                                transgressoes.forEach(t => linhasIndicios.push({ text: `- Transgressão: ${t.texto_completo}`, bold: false }));
                            }
                            if (art29 && art29.length) {
                                art29.forEach(a => linhasIndicios.push({ text: `- Art. 29: ${a.texto_completo}`, bold: false }));
                            }
                        } else {
                            linhasIndicios.push({ text: '• Não houve', bold: false });
                        }
                    } else {
                        linhasIndicios.push({ text: '• Não houve', bold: false });
                    }
                    // sem linha em branco entre PMs para otimizar espaço
                });
                // Agrupar por item e quebrar mantendo cada item indivisível entre linhas da tabela
                const itensWrapped = [];
                linhasIndicios.forEach(({ text, bold, single }) => {
                    if (single) {
                        // manter como um item de linha única; ajuste de fonte será feito na renderização
                        itensWrapped.push([{ text, bold, single: true }]);
                    } else {
                        const parts = pdf.splitTextToSize(text, colWidths[2] - 6);
                        const linhas = parts.map(p => ({ text: p, bold, single: false }));
                        itensWrapped.push(linhas);
                    }
                });
                indiciosWrappedLines = itensWrapped; // agora é um array de itens, cada item é um array de linhas {text,bold}
            }
        }

        // Montar linhas da tabela (apenas 2 primeiras colunas), enquanto a 3ª é preenchida gradualmente
        const linhasEsq = [];
        linhasEsq.push(['Documento/Número:', processo.detalhes.numeroPortaria, false]);
        linhasEsq.push(['Número de controle:', processo.detalhes.numeroControle, false]);
        linhasEsq.push(['Data Instauração:', processo.detalhes.dataInstauracao, false]);
        linhasEsq.push(['Data Remessa:', processo.detalhes.solucaoCompleta.dataRemessa, false]);
        if (['PAD', 'PADS', 'CD', 'CJ'].includes(window.tipoProcessoAtual)) {
            linhasEsq.push(['Data Julgamento:', processo.detalhes.solucaoCompleta.dataJulgamento, false]);
        }
        linhasEsq.push(['Data Conclusão:', processo.detalhes.dataConclusao, false]);
        linhasEsq.push(['Número RGF:', processo.detalhes.numeroRGF, false]);
        linhasEsq.push(['Encarregado:', processo.encarregado, false]);
    linhasEsq.push(['PMs Envolvidos:', processo.pmsEnvolvidos, false]);
        if (processo.status === 'Concluído') {
            if (['IPM', 'SR'].includes(window.tipoProcessoAtual)) {
                const dadosOriginais = window.dadosProcessos ?
                    window.dadosProcessos.find(p => p.id == processo.id) : null;
                const solucaoFinal = dadosOriginais?.solucao_final || dadosOriginais?.solucao?.solucao_final || processo.solucao;
                linhasEsq.push(['Solução/Resultado:', solucaoFinal || 'Não informado', true]);
            }
            if (['PAD', 'PADS', 'CD', 'CJ'].includes(window.tipoProcessoAtual)) {
                linhasEsq.push(['Solução/Resultado:', processo.detalhes.solucaoCompleta.penalidade, true]);
            }
        }
        if (processo.detalhes.resumoFatos && processo.detalhes.resumoFatos !== 'Não informado') {
            linhasEsq.push(['Resumo dos Fatos:', processo.detalhes.resumoFatos, true]);
        }
        if (processo.status === 'Em Andamento' && processo.detalhes.ultimaMovimentacao !== 'Não informado') {
            linhasEsq.push(['ÚLTIMA MOVIMENTAÇÃO:', processo.detalhes.ultimaMovimentacao, true]);
        }

        // Distribuir itens de indícios pelas linhas, sem quebrar um item entre linhas
        let idxItem = 0;
        linhasEsq.forEach(([label, valor, negrito]) => {
            const wrappedValor = pdf.splitTextToSize(valor || '', colWidths[1] - 6);
            const capacidade = Math.max(1, wrappedValor.length);
            let linhasDireita = [];
            let linhasUsadas = 0;
            while (idxItem < indiciosWrappedLines.length) {
                const item = indiciosWrappedLines[idxItem]; // array de linhas {text,bold}
                const tamanhoItem = item.length;
                // se cabe o item inteiro, adiciona; se não cabe e ainda não adicionou nada, adiciona mesmo assim (a linha crescerá)
                if (linhasUsadas + tamanhoItem <= capacidade || linhasUsadas === 0) {
                    linhasDireita.push(...item);
                    linhasUsadas += tamanhoItem;
                    idxItem++;
                } else {
                    break;
                }
                // Se já usamos pelo menos a capacidade, para nesta linha
                if (linhasUsadas >= capacidade) break;
            }
            criarLinhaTabela(label, valor, linhasDireita, negrito);
        });

        // Caso sobrem itens, adicionar linhas extras para acomodar o restante
        while (idxItem < indiciosWrappedLines.length) {
            const item = indiciosWrappedLines[idxItem];
            idxItem++;
            criarLinhaTabela(' ', ' ', item, false);
        }
        
    // Atualizar currentY para o próximo processo
    currentY = tableY + 10; // Espaço menor entre processos
    });
    
    // Footer em todas as páginas
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        const footerY = pageHeight - 15;
        pdf.setDrawColor(42, 82, 152);
        pdf.line(margin, footerY, pageWidth - margin, footerY);
        
        pdf.setFontSize(8);
        pdf.setTextColor(102, 117, 127);
        pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, footerY + 8);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 8, { align: 'center' });
        pdf.text('Sistema ADM-P6', pageWidth - margin, footerY + 8, { align: 'right' });
    }
    
    // Salvar PDF
    const nomeArquivo = `Mapa_Mensal_Detalhado_${content.titulo.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(nomeArquivo);
}

function mostrarEstadoVazio() {
    document.getElementById('estadoVazio').classList.remove('d-none');
    document.getElementById('resultados').classList.add('d-none');
}

function mostrarAlerta(mensagem, tipo = 'info') {
    // Criar ou encontrar container de alertas
    let alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alert-container';
        alertContainer.className = 'position-fixed top-0 end-0 p-3';
        alertContainer.style.zIndex = '1050';
        document.body.appendChild(alertContainer);
    }
    
    // Criar alerta
    const alertId = 'alert-' + Date.now();
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensagem}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
            const bsAlert = new bootstrap.Alert(alertElement);
            bsAlert.close();
        }
    }, 5000);
}
