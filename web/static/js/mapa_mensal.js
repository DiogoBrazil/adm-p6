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
    
    // Atualizar título e informações do mapa
    document.getElementById('tituloMapa').innerHTML = 
        `<i class="bi bi-file-earmark-text"></i> Mapa Mensal - ${meta.tipo_processo} - ${meta.mes_nome}/${meta.ano}`;
    
    // Informações do mapa
    document.getElementById('infoMapa').innerHTML = `
        <div class="info-item">
            <span class="info-label">Período:</span> ${meta.mes_nome} de ${meta.ano}
        </div>
        <div class="info-item">
            <span class="info-label">Tipo:</span> ${meta.tipo_processo}
        </div>
        <div class="info-item">
            <span class="info-label">Data de Geração:</span> ${meta.data_geracao}
        </div>
    `;
    
    // Estatísticas
    document.getElementById('estatisticasMapa').innerHTML = `
        <div class="row text-center">
            <div class="col-4">
                <div class="fw-bold text-primary fs-4">${meta.total_processos}</div>
                <small class="text-muted">Total</small>
            </div>
            <div class="col-4">
                <div class="fw-bold text-success fs-4">${meta.total_concluidos}</div>
                <small class="text-muted">Concluídos</small>
            </div>
            <div class="col-4">
                <div class="fw-bold text-warning fs-4">${meta.total_andamento}</div>
                <small class="text-muted">Em Andamento</small>
            </div>
        </div>
    `;
    
    // Lista de processos
    const listaProcessos = document.getElementById('listaProcessos');
    listaProcessos.innerHTML = '';
    
    dados.forEach((processo, index) => {
        const cardProcesso = criarCardProcesso(processo, meta.tipo_processo, index + 1);
        listaProcessos.appendChild(cardProcesso);
    });
    
    // Mostrar resultados
    document.getElementById('resultados').classList.remove('d-none');
    document.getElementById('estadoVazio').classList.add('d-none');
}

function criarCardProcesso(processo, tipoProcesso, numero) {
    const card = document.createElement('div');
    card.className = 'card card-processo';
    
    const statusClass = processo.concluido ? 'status-concluido' : 'status-andamento';
    const statusIcon = processo.concluido ? 'check-circle' : 'clock';
    
    // Determinar campos específicos por tipo
    let camposEspecificos = '';
    let numeroDocumento = '';
    
    switch (tipoProcesso) {
        case 'SR':
        case 'IPM':
            numeroDocumento = processo.numero_portaria ? 
                `<div class="info-item">
                    <span class="info-label">Número da Portaria:</span> ${processo.numero_portaria}/${processo.ano}
                </div>` : '';
            break;
        case 'PADS':
            numeroDocumento = processo.numero_memorando ? 
                `<div class="info-item">
                    <span class="info-label">Número do Memorando:</span> ${processo.numero_memorando}/${processo.ano}
                </div>` : '';
            break;
        case 'PAD':
        case 'CD':
        case 'CJ':
            numeroDocumento = processo.numero_portaria ? 
                `<div class="info-item">
                    <span class="info-label">Número da Portaria:</span> ${processo.numero_portaria}/${processo.ano}
                </div>` : '';
            break;
    }
    
    card.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
                <strong>${numero}. ${processo.numero}/${processo.ano}</strong>
            </h6>
            <span class="badge ${statusClass}">
                <i class="bi bi-${statusIcon}"></i> ${processo.status}
            </span>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <h6 class="section-title">Informações Básicas</h6>
                    ${numeroDocumento}
                    ${processo.numero_rgf ? `
                        <div class="info-item">
                            <span class="info-label">Número do RGF:</span> ${processo.numero_rgf}
                        </div>
                    ` : ''}
                    <div class="info-item">
                        <span class="info-label">Encarregado:</span> ${processo.responsavel.completo || 'Não informado'}
                    </div>
                    ${processo.nome_vitima ? `
                        <div class="info-item">
                            <span class="info-label">Vítima/Ofendido:</span> ${processo.nome_vitima}
                        </div>
                    ` : ''}
                </div>
                <div class="col-md-6">
                    <h6 class="section-title">${getTituloEnvolvidos(tipoProcesso)}</h6>
                    ${criarListaEnvolvidos(processo.pms_envolvidos, tipoProcesso)}
                </div>
            </div>
            
            <div class="mt-3">
                <h6 class="section-title">Resumo dos Fatos</h6>
                <p class="mb-0">${processo.resumo_fatos || 'Não informado'}</p>
            </div>
            
            ${criarSecaoIndicios(processo.indicios)}
            ${criarSecaoSolucao(processo, tipoProcesso)}
            ${criarSecaoMovimentacao(processo.ultima_movimentacao)}
        </div>
    `;
    
    return card;
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
