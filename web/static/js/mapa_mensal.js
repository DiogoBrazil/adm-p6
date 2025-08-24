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
            return processo.numero_portaria ? `Portaria ${processo.numero_portaria}/${processo.ano}` : '';
        case 'PADS':
            return processo.numero_memorando ? `Memorando ${processo.numero_memorando}/${processo.ano}` : '';
        case 'PAD':
        case 'CD':
        case 'CJ':
            return processo.numero_portaria ? `Portaria ${processo.numero_portaria}/${processo.ano}` : '';
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
                    <div class="info-value">${processo.numero_portaria}/${processo.ano}</div>
                </div>
            ` : '';
        case 'PADS':
            return processo.numero_memorando ? `
                <div class="info-card">
                    <div class="info-label">Número do Memorando</div>
                    <div class="info-value">${processo.numero_memorando}/${processo.ano}</div>
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
        
        // Criar conteúdo do PDF
        const pdfContent = criarConteudoPDF(tituloMapa, infoMapa, estatisticas);
        
        // Gerar PDF usando jsPDF
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

function criarConteudoPDF(titulo, infoMapa, estatisticas) {
    // Obter dados da tabela
    const tabela = document.getElementById('tabelaProcessos');
    const linhas = tabela.querySelectorAll('tbody tr.processo-linha');
    
    let processosData = [];
    linhas.forEach((linha, index) => {
        const processoId = linha.dataset.processoId;
        
        // Extrair dados da linha principal
        const colunas = linha.querySelectorAll('td');
        const numero = colunas[0].textContent.trim();
        const numeroProcesso = colunas[1].querySelector('.processo-numero')?.textContent.trim() || '';
        const descricao = colunas[1].querySelector('small')?.textContent.trim() || '';
        const statusElement = colunas[2].querySelector('.status-badge');
        const status = statusElement ? statusElement.textContent.trim().replace(/.*\s/, '') : '';
        const encarregado = colunas[3].textContent.trim();
        
        // Extrair PMs de forma mais robusta
        const pmBadges = colunas[4].querySelectorAll('.pm-badge');
        const pmsArray = Array.from(pmBadges).map(badge => {
            let texto = badge.textContent.trim();
            // Remover prefixos como "+2" se existirem
            if (texto.startsWith('+')) {
                return `+${texto.slice(1)} outros`;
            }
            return texto;
        });
        
        const solucaoElement = colunas[5].querySelector('.solucao-badge');
        const solucao = solucaoElement ? solucaoElement.textContent.trim() : 
                       colunas[5].textContent.trim() !== '-' ? colunas[5].textContent.trim() : 'Não finalizado';
        
        processosData.push({
            numero,
            numeroProcesso,
            descricao,
            status,
            encarregado,
            pmsEnvolvidos: pmsArray.join(', ') || 'Nenhum PM informado',
            solucao
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
    pdf.setFillColor(30, 60, 114); // Cor do gradiente
    pdf.rect(margin, currentY, contentWidth, 25, 'F');
    
    // Título
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('MAPA MENSAL DE PROCESSOS E PROCEDIMENTOS', pageWidth / 2, currentY + 10, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(content.titulo, pageWidth / 2, currentY + 18, { align: 'center' });
    
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
    
    // Estatísticas
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(12);
    pdf.text('ESTATÍSTICAS', margin, currentY);
    currentY += 8;
    
    const statsWidth = contentWidth / 3;
    let statsX = margin;
    
    Object.entries(content.stats).forEach(([label, value]) => {
        // Box para estatística
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
    
    currentY += 25;
    
    // Tabela de processos
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(12);
    pdf.text('PROCESSOS/PROCEDIMENTOS', margin, currentY);
    currentY += 10;
    
    // Cabeçalho da tabela
    const colWidths = [15, 35, 25, 60, 80, 35]; // Larguras das colunas
    const headers = ['#', 'Número', 'Status', 'Encarregado', 'PMs Envolvidos', 'Solução'];
    
    pdf.setFillColor(42, 82, 152);
    pdf.rect(margin, currentY, contentWidth, 8, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    
    let colX = margin;
    headers.forEach((header, index) => {
        pdf.text(header, colX + 2, currentY + 6);
        colX += colWidths[index];
    });
    
    currentY += 8;
    
    // Dados da tabela
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    
    content.processos.forEach((processo, index) => {
        // Verificar se precisa de nova página
        if (currentY > pageHeight - 40) {
            pdf.addPage();
            currentY = margin;
            
            // Repetir cabeçalho na nova página
            pdf.setFillColor(42, 82, 152);
            pdf.rect(margin, currentY, contentWidth, 8, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'bold');
            
            colX = margin;
            headers.forEach((header, headerIndex) => {
                pdf.text(header, colX + 2, currentY + 6);
                colX += colWidths[headerIndex];
            });
            
            currentY += 8;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
            pdf.setFont(undefined, 'normal');
        }
        
        // Calcular altura necessária para a linha
        const linhaAltura = Math.max(12, 
            Math.ceil(pdf.splitTextToSize(processo.descricao, colWidths[1] - 4).length) * 3,
            Math.ceil(pdf.splitTextToSize(processo.encarregado, colWidths[3] - 4).length) * 3,
            Math.ceil(pdf.splitTextToSize(processo.pmsEnvolvidos, colWidths[4] - 4).length) * 3
        );
        
        // Linha zebrada
        if (index % 2 === 0) {
            pdf.setFillColor(248, 249, 250);
            pdf.rect(margin, currentY, contentWidth, linhaAltura, 'F');
        }
        
        // Bordas
        pdf.setDrawColor(222, 226, 230);
        pdf.rect(margin, currentY, contentWidth, linhaAltura);
        
        // Separadores verticais
        colX = margin;
        colWidths.forEach((width, colIndex) => {
            if (colIndex < colWidths.length - 1) {
                pdf.line(colX + width, currentY, colX + width, currentY + linhaAltura);
            }
            colX += width;
        });
        
        // Dados
        colX = margin;
        const dados = [
            processo.numero,
            processo.numeroProcesso + '\n' + processo.descricao,
            processo.status,
            processo.encarregado,
            processo.pmsEnvolvidos,
            processo.solucao
        ];
        
        dados.forEach((dado, colIndex) => {
            const lines = pdf.splitTextToSize(dado, colWidths[colIndex] - 4);
            pdf.text(lines, colX + 2, currentY + 4);
            colX += colWidths[colIndex];
        });
        
        currentY += linhaAltura;
    });
    
    // Footer
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
    const nomeArquivo = `Mapa_Mensal_${content.titulo.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
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
