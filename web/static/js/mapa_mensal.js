// mapa_mensal.js - JavaScript para funcionalidade do Mapa Mensal

// Variáveis globais para paginação e filtro de mapas anteriores
let todosOsMapas = [];
let mapasFiltrados = [];
let paginaAtualMapas = 1;
const mapasPorPagina = 3;
let timeoutBusca = null;

document.addEventListener('DOMContentLoaded', function() {
    inicializarMapaMensal();
});

function inicializarMapaMensal() {
    console.log('🗓️ Inicializando Mapa Mensal...');
    
    // Inicializar elementos da página
    inicializarAnos();
    carregarTiposProcesso();
    
    // Só carrega mapas anteriores se estiver na página de mapas anteriores
    if (document.getElementById('listaMapas')) {
        carregarMapasAnteriores();
        configurarEventosBuscaMapas();
    }
    
    // Event listeners
    const form = document.getElementById('filtroMapaForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            gerarMapaMensal();
        });
    }
    
    // Definir mês e ano atuais como padrão
    const hoje = new Date();
    const mesEl = document.getElementById('mes');
    const anoEl = document.getElementById('ano');
    if (mesEl) mesEl.value = hoje.getMonth() + 1;
    if (anoEl) anoEl.value = hoje.getFullYear();
}

function configurarEventosBuscaMapas() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    // Evento de digitação com debounce
    searchInput.addEventListener('input', function(e) {
        const termo = e.target.value.trim();
        
        // Mostrar/ocultar botão limpar
        const btnLimpar = document.getElementById('btnLimpar');
        if (btnLimpar) {
            if (termo) {
                btnLimpar.classList.remove('d-none');
            } else {
                btnLimpar.classList.add('d-none');
            }
        }
        
        // Debounce da busca
        if (timeoutBusca) {
            clearTimeout(timeoutBusca);
        }
        
        timeoutBusca = setTimeout(() => {
            filtrarMapas(termo);
        }, 300);
    });
    
    // Configurar botões de paginação
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (paginaAtualMapas > 1) {
                paginaAtualMapas--;
                renderizarMapasPaginados();
            }
        });
    }
    
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const totalPaginas = Math.ceil(mapasFiltrados.length / mapasPorPagina);
            if (paginaAtualMapas < totalPaginas) {
                paginaAtualMapas++;
                renderizarMapasPaginados();
            }
        });
    }
}

function limparBusca() {
    const searchInput = document.getElementById('searchInput');
    const btnLimpar = document.getElementById('btnLimpar');
    const searchInfo = document.getElementById('searchInfo');
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (btnLimpar) {
        btnLimpar.classList.add('d-none');
    }
    
    if (searchInfo) {
        searchInfo.classList.add('d-none');
    }
    
    // Resetar filtro
    mapasFiltrados = [...todosOsMapas];
    paginaAtualMapas = 1;
    renderizarMapasPaginados();
}

function filtrarMapas(termo) {
    if (!termo) {
        mapasFiltrados = [...todosOsMapas];
    } else {
        const termoLower = termo.toLowerCase();
        mapasFiltrados = todosOsMapas.filter(mapa => {
            // Buscar em: título, tipo_processo, periodo_descricao
            const titulo = (mapa.titulo || '').toLowerCase();
            const tipo = (mapa.tipo_processo || '').toLowerCase();
            const periodo = (mapa.periodo_descricao || '').toLowerCase();
            
            return titulo.includes(termoLower) || 
                   tipo.includes(termoLower) || 
                   periodo.includes(termoLower);
        });
    }
    
    // Atualizar info de busca
    const searchInfo = document.getElementById('searchInfo');
    const searchInfoText = document.getElementById('searchInfoText');
    
    if (searchInfo && searchInfoText) {
        if (termo && mapasFiltrados.length !== todosOsMapas.length) {
            searchInfo.classList.remove('d-none');
            searchInfoText.textContent = `${mapasFiltrados.length} mapa(s) encontrado(s) de ${todosOsMapas.length} total`;
        } else {
            searchInfo.classList.add('d-none');
        }
    }
    
    // Resetar para primeira página
    paginaAtualMapas = 1;
    renderizarMapasPaginados();
}

function inicializarAnos() {
    const selectAno = document.getElementById('ano');
    if (!selectAno) return;
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
            if (!selectTipo) return; // página pode não ter filtros
            
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
        ocultarDownloadContainer();
        
        const resultado = await eel.gerar_mapa_mensal(mes, ano, tipoProcesso)();
        
        if (resultado.sucesso) {
            console.log(`✅ Mapa gerado: ${resultado.dados.length} processos encontrados`);
            
            // Salvar mapa automaticamente
            const salvamento = await salvarMapaAutomaticamente(resultado);
            
            if (salvamento && salvamento.sucesso) {
                // Armazenar dados globalmente para uso no download
                window.ultimoMapaGerado = resultado;
                
                // Exibir botão de download
                exibirDownloadContainer();
                
                mostrarAlerta('Mapa gerado com sucesso! Clique no botão para fazer o download.', 'success');
            } else {
                mostrarAlerta('Mapa gerado, mas houve erro ao salvar. Tente gerar novamente.', 'warning');
            }
            
            // Garantir que os resultados permaneçam ocultos
            ocultarResultados();
        } else {
            console.error('❌ Erro ao gerar mapa:', resultado.mensagem);
            mostrarAlerta('Erro ao gerar mapa: ' + resultado.mensagem, 'danger');
            ocultarResultados();
            ocultarDownloadContainer();
        }
    } catch (error) {
        console.error('❌ Erro ao gerar mapa mensal:', error);
        mostrarAlerta('Erro ao gerar mapa mensal.', 'danger');
        ocultarResultados();
        ocultarDownloadContainer();
    } finally {
        mostrarLoading(false);
    }
}

function exibirResultados(resultado) {
    const { dados, meta } = resultado;
    
    if (dados.length === 0) {
        ocultarResultados();
        return;
    }
    
    // Mantemos a geração de dados em memória para PDF, mas não renderizamos a seção
    window.dadosProcessos = dados;
    ocultarResultados();
}

function gerarTabelaProcessos(processos, tipoProcesso) {
    const corpoTabela = document.getElementById('corpoTabelaProcessos');
    corpoTabela.innerHTML = '';
    
    // Armazenar dados originais globalmente para acesso posterior
    window.dadosProcessos = processos;
    
    processos.forEach((processo, index) => {
        const linha = criarLinhaProcesso(processo, tipoProcesso, index + 1);
        corpoTabela.appendChild(linha);
    });
}

function formatarPmParaExibicao(pm) {
    // Garantir que temos os dados necessários
    if (!pm) return 'PM não informado';
    
    // Combinar posto/graduação com nome, removendo espaços extras
    const posto = pm.posto_graduacao ? pm.posto_graduacao.trim() : '';
    const nome = pm.nome ? pm.nome.trim() : 'Nome não informado';
    
    // Se temos posto, usar junto com o nome
    if (posto && posto !== '') {
        return `${posto} ${nome}`;
    }
    
    // Se não temos posto, usar apenas o nome
    return nome;
}

function criarLinhaProcesso(processo, tipoProcesso, numero) {
    const linha = document.createElement('tr');
    linha.className = 'processo-linha';
    linha.dataset.processoId = processo.id;
    
    // Definir status com classes melhoradas
    const statusClass = processo.concluido ? 'status-badge concluido' : 'status-badge andamento';
    const statusIcon = processo.concluido ? 'check-circle-fill' : 'clock-fill';
    const statusTexto = processo.concluido ? 'Concluído' : 'Em Andamento';
    
    // Gerar lista de PMs (máximo 2 visíveis) com formatação melhorada
    const pmsHtml = processo.pms_envolvidos.slice(0, 2).map(pm => 
        `<span class="pm-badge">${formatarPmParaExibicao(pm)}</span>`
    ).join(' ');
    const pmsMais = processo.pms_envolvidos.length > 2 ? 
        `<span class="pm-badge">+${processo.pms_envolvidos.length - 2} mais</span>` : '';
    
    // Gerar solução resumida
    const solucaoHtml = criarSolucaoResumida(processo, tipoProcesso);
    
    linha.innerHTML = `
        <td data-label="#">${numero}</td>
        <td data-label="Número">
            <div class="d-flex flex-column">
                <div class="processo-numero fw-bold">${processo.numero}/${processo.ano}</div>
                <div class="d-flex align-items-center gap-2">
                    <span class="tipo-badge">${tipoProcesso}</span>
                    <small class="text-muted">${getDescricaoNumero(processo, tipoProcesso)}</small>
                </div>
            </div>
        </td>
        <td data-label="Status">
            <span class="${statusClass}">
                <i class="bi bi-${statusIcon} me-1"></i>${statusTexto}
            </span>
        </td>
        <td data-label="Encarregado">
            <div class="fw-semibold text-truncate" title="${processo.responsavel.completo || 'Não informado'}">
                ${processo.responsavel.completo || 'Não informado'}
            </div>
        </td>
        <td data-label="PMs Envolvidos">
            <div class="pms-container">
                ${pmsHtml}${pmsMais}
            </div>
        </td>
        <td data-label="Solução">
            ${solucaoHtml}
    </td>
    `;
    
    return linha;
}

// detalhes removidos

function criarSolucaoResumida(processo, tipoProcesso) {
    if (!processo.concluido) {
        return '<span class="text-muted">-</span>';
    }
    
    // Buscar solução na estrutura correta
    const solucaoFinal = processo.solucao_final || processo.solucao?.solucao_final || processo.solucao?.solucao_tipo;
    
    const cor = getCorSolucao(solucaoFinal, tipoProcesso);
    const badgeClass = cor.includes('success') ? 'bg-success' : 
                       cor.includes('warning') ? 'bg-warning' : 
                       cor.includes('danger') ? 'bg-danger' : 'bg-secondary';
    
    return `<span class="solucao-badge ${badgeClass} text-white">${solucaoFinal || 'Não informado'}</span>`;
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
        <div class="pm-badge">${formatarPmParaExibicao(pm)}</div>
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

// toggleDetalhes removido

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
    if (!loading) return;
    if (mostrar) loading.classList.remove('d-none');
    else loading.classList.add('d-none');
}

function ocultarResultados() {
    document.getElementById('resultados')?.classList.add('d-none');
    document.getElementById('estadoVazio')?.classList.add('d-none');
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
        if (!['IPM','SR','PADS','PAD','CD','CJ'].includes(tipo)) return '';
        const dadosOriginais = (window.dadosProcessos || []).find(p => String(p.id) === String(procId));
        if (!dadosOriginais || !Array.isArray(dadosOriginais.pms_envolvidos)) return '';
        const blocos = [];
        dadosOriginais.pms_envolvidos.forEach(pm => {
            const nomePM = formatarPmParaExibicao(pm);
            const linhas = [];
            
            if (pm.indicios) {
                const { categorias, crimes, transgressoes, art29 } = pm.indicios;
                
                // Se não houver nenhum indício específico, mostrar apenas categorias
                if ((!crimes || !crimes.length) && (!transgressoes || !transgressoes.length) && (!art29 || !art29.length)) {
                    if (categorias && categorias.length) {
                        categorias.forEach(cat => linhas.push(`<div class="pm-muted">• ${cat}</div>`));
                    } else {
                        linhas.push('<div class="pm-muted">• Não houve indícios.</div>');
                    }
                } else {
                    // Listar cada crime individualmente com sua categoria
                    if (crimes && crimes.length) {
                        const categoriaCrime = categorias ? categorias.filter(c => 
                            c.includes('crime comum') || c.includes('crime militar')
                        ) : [];
                        
                        crimes.forEach(c => {
                            const catTexto = categoriaCrime.length > 0 ? categoriaCrime.join(', ') : 'Indícios de crime';
                            linhas.push(`<div class="pm-muted"><strong>${catTexto}:</strong></div>`);
                            linhas.push(`<div class="pm-muted" style="margin-left: 10px;">• Crime: ${c.texto_completo}</div>`);
                        });
                    }
                    
                    // Listar cada transgressão RDPM individualmente
                    if (transgressoes && transgressoes.length) {
                        const categoriaRdpm = categorias ? categorias.filter(c => 
                            c.includes('transgressão disciplinar')
                        ) : [];
                        
                        transgressoes.forEach(t => {
                            const catTexto = categoriaRdpm.length > 0 ? categoriaRdpm[0] : 'Indícios de transgressão disciplinar';
                            linhas.push(`<div class="pm-muted"><strong>${catTexto}:</strong></div>`);
                            linhas.push(`<div class="pm-muted" style="margin-left: 10px;">• ${t.texto_completo} (RDPM)</div>`);
                        });
                    }
                    
                    // Listar cada Art. 29 individualmente
                    if (art29 && art29.length) {
                        const categoriaArt29 = categorias ? categorias.filter(c => 
                            c.includes('estatuto')
                        ) : [];
                        
                        art29.forEach(a => {
                            const catTexto = categoriaArt29.length > 0 ? categoriaArt29[0] : 'Indícios de infração ao Estatuto dos PM';
                            linhas.push(`<div class="pm-muted"><strong>${catTexto}:</strong></div>`);
                            linhas.push(`<div class="pm-muted" style="margin-left: 10px;">• ${a.texto_completo}</div>`);
                        });
                    }
                }
            } else {
                linhas.push('<div class="pm-muted">• Não houve indícios.</div>');
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

        // Índicios/Transgressões para IPM/SR e PADS/PAD/CD/CJ
        if (['IPM','SR','PADS','PAD','CD','CJ'].includes(tipo)) {
            const indiciosHTML = montarIndiciosPMHTML(p.id, tipo);
            if (indiciosHTML) {
                const tituloIndicios = tipoAtual === 'PADS' ? 'TRANSGRESSÕES PRATICADAS' : 'INDÍCIOS APONTADOS';
                linhas.push([tituloIndicios, `<div class="pm-value-block">${indiciosHTML}</div>`]);
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

// Função para formatar a última movimentação
function formatarUltimaMovimentacao(movimentacao) {
    if (!movimentacao) {
        return 'Não informado';
    }
    
    // Se for uma string, retornar diretamente
    if (typeof movimentacao === 'string') {
        return movimentacao;
    }
    
    // Se for um objeto, formatar adequadamente
    if (typeof movimentacao === 'object') {
        let texto = '';
        
        // Adicionar apenas a descrição se existir
        if (movimentacao.descricao) {
            texto += movimentacao.descricao;
        }
        
        // Adicionar destino se existir
        if (movimentacao.destino) {
            if (texto) texto += ' - ';
            texto += `Destino: ${movimentacao.destino}`;
        }
        
        return texto || 'Não informado';
    }
    
    return 'Não informado';
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
                formatarUltimaMovimentacao(dadosOriginais?.ultima_movimentacao)
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
    
    // Informações em três colunas centralizadas
    const infoWidth = contentWidth / 3;
    let infoX = margin;
    
    const infoObj = content.info || {};
    Object.entries(infoObj).forEach(([label, value]) => {
        // Calcular a largura total do texto (label + valor)
        pdf.setFont(undefined, 'bold');
        const labelWidth = pdf.getTextWidth(`${label}: `);
        pdf.setFont(undefined, 'normal');
        const valueWidth = pdf.getTextWidth(value);
        const totalWidth = labelWidth + valueWidth;
        
        // Centralizar dentro da coluna
        const startX = infoX + (infoWidth - totalWidth) / 2;
        
        pdf.setFont(undefined, 'bold');
        pdf.text(`${label}:`, startX, currentY);
        pdf.setFont(undefined, 'normal');
        pdf.text(value, startX + labelWidth, currentY);
        
        infoX += infoWidth;
    });
    
    currentY += 15;
    
    const statsWidth = contentWidth / 3;
    let statsX = margin;
    
    const statsObj = content.stats || {};
    Object.entries(statsObj).forEach(([label, value]) => {
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
    
    // Espaçamento adequado entre estatísticas e processos
    currentY += 25;
    
    // Separar processos por status
    const processosConcluidos = content.processos.filter(p => p.status === 'Concluído');
    const processosAndamento = content.processos.filter(p => p.status === 'Em Andamento');
    
    // Processar processos concluídos (1 por página para todos os tipos)
    processosConcluidos.forEach((processo, index) => {
        // Para concluídos, sempre quebra página (exceto o primeiro)
        if (index > 0) {
            pdf.addPage();
            currentY = margin + 10;
        }
        
        currentY = renderizarProcesso(processo, 10); // Espaçamento normal para concluídos
    });
    
    // Processar processos em andamento (2 por página)
    processosAndamento.forEach((processo, index) => {
        // Para andamentos, verificar se precisa quebrar página (a cada 2 processos)
        if (index > 0 && index % 2 === 0) {
            pdf.addPage();
            currentY = margin + 10;
        } else if (index === 0 && processosConcluidos.length > 0) {
            // Se há concluídos antes, quebrar página para começar os andamentos
            pdf.addPage();
            currentY = margin + 10;
        } else if (index > 0 && index % 2 === 1) {
            // Segundo processo na mesma página - espaçamento bem reduzido para PADS andamentos
            if (window.tipoProcessoAtual === 'PADS') {
                currentY += 3; // Espaçamento mínimo para PADS
            } else {
                currentY += 5; // Espaçamento normal para outros tipos
            }
        }
        
        // Espaçamento final diferenciado por tipo
        const espacamentoFinal = (window.tipoProcessoAtual === 'PADS' && processo.status === 'Em Andamento') ? 3 : 5;
        currentY = renderizarProcesso(processo, espacamentoFinal);
    });
    
    // Função local para renderizar cada processo
    function renderizarProcesso(processo, espacamento = 10) {
        // Título do processo - altura reduzida para PADS em andamento
        const alturaHeader = (window.tipoProcessoAtual === 'PADS' && processo.status === 'Em Andamento') ? 10 : 12;
        pdf.setFillColor(42, 82, 152);
        pdf.rect(margin, currentY, contentWidth, alturaHeader, 'F');
        
        pdf.setTextColor(255, 255, 255);
        const fontSizeHeader = (window.tipoProcessoAtual === 'PADS' && processo.status === 'Em Andamento') ? 10 : 11;
        pdf.setFontSize(fontSizeHeader);
        pdf.setFont(undefined, 'bold');
        const yPosTexto = currentY + (alturaHeader === 10 ? 7 : 8);
        const tipoProcesso = window.tipoProcessoAtual || 'PROCESSO';
        pdf.text(`${processo.numero}. ${tipoProcesso} Nº ${processo.numeroProcesso}`, margin + 3, yPosTexto);
        
        // Status no canto direito
        const statusColor = processo.status === 'Concluído' ? [40, 167, 69] : [255, 193, 7];
        pdf.setFillColor(...statusColor);
        const alturaStatus = alturaHeader - 2;
        pdf.rect(pageWidth - margin - 45, currentY + 1, 40, alturaStatus, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(8);
        pdf.text(processo.status, pageWidth - margin - 42, currentY + (alturaStatus === 8 ? 6 : 7));
        
        currentY += alturaHeader + 3;
        
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
                wrappedIndicios = indicios.map(l => ({ text: l.text || '', bold: !!l.bold }));
            } else if (indicios) {
                const arr = pdf.splitTextToSize(indicios, colWidths[2] - 6);
                wrappedIndicios = arr.map(t => ({ text: t, bold: false }));
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
                const tituloIndicios = window.tipoProcessoAtual === 'PADS' ? 'TRANSGRESSÕES PRATICADAS' : 'INDÍCIOS APONTADOS';
                pdf.text(tituloIndicios, margin + colWidths[0] + colWidths[1] + 2, tableY + 5);
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
            // Labels que devem sempre ficar em negrito na primeira coluna
            const labelsSempreNegrito = new Set([
                'PMs Envolvidos:',
                'Encarregado:',
                'Número RGF:',
                'Data Conclusão:',
                'Data Remessa:',
                'Data Instauração:',
                'Número de controle:',
                'Documento/Número:'
            ]);

            const labelIsBold = labelsSempreNegrito.has(label) || isBold;
            const valueIsBold = label === 'PMs Envolvidos:' ? false : isBold;
            pdf.setFont(undefined, labelIsBold ? 'bold' : 'normal');
            pdf.text(label, margin + 2, tableY + 4);
            pdf.setFont(undefined, valueIsBold ? 'bold' : 'normal');
            pdf.text(wrappedValue, margin + colWidths[0] + 2, tableY + 4);
            if (wrappedIndicios.length) {
                // Desenhar cada linha respeitando bold por linha (quebras já calculadas)
                let lineY = tableY + 4;
                wrappedIndicios.forEach(({ text, bold }) => {
                    pdf.setFont(undefined, bold ? 'bold' : 'normal');
                    pdf.setFontSize(baseFontSize);
                    pdf.text(text, margin + colWidths[0] + colWidths[1] + 2, lineY);
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
            const tituloIndicios = window.tipoProcessoAtual === 'PADS' ? 'TRANSGRESSÕES PRATICADAS' : 'INDÍCIOS APONTADOS';
            pdf.text(tituloIndicios, margin + colWidths[0] + colWidths[1] + 2, tableY + 5);
            
            tableY += 8;
            pdf.setTextColor(0, 0, 0);
        }
        
    // Criar cabeçalho da tabela (apenas uma vez)
    criarCabecalhoTabela();
        
        // Preparar conteúdo de indícios como fluxo contínuo na terceira coluna, começando na primeira linha
        let indiciosWrappedLines = [];
        
        // Função para formatar transgressões
        function formatarTransgressao(transgressao) {
            // Se já tiver texto_completo formatado, usar ele
            if (transgressao.texto_completo) {
                return transgressao.texto_completo;
            }
            
            const gravidade = transgressao.gravidade ? transgressao.gravidade.charAt(0).toUpperCase() + transgressao.gravidade.slice(1) : 'Leve';
            const inciso = transgressao.inciso || 'I';
            const tipo = transgressao.tipo === 'estatuto' ? 'do Estatuto' : 'do RDPM';
            
            // Se for RDPM e tiver artigo, incluir na formatação
            if (transgressao.tipo !== 'estatuto' && transgressao.artigo) {
                return `Art. ${transgressao.artigo} (${gravidade}) - Inciso ${inciso} ${tipo}`;
            }
            
            return `${gravidade} - Inciso ${inciso} ${tipo}`;
        }
        
        if ((['IPM', 'SR'].includes(window.tipoProcessoAtual) && processo.status === 'Concluído') || 
            (['PADS', 'PAD', 'CD', 'CJ'].includes(window.tipoProcessoAtual))) {
            const dadosOriginais = window.dadosProcessos ?
                window.dadosProcessos.find(p => p.id == processo.id) : null;
            if (dadosOriginais) {
                const linhasIndicios = [];
                
                // Mostrar indícios por PM (funciona para IPM/SR/PADS/PAD/CD/CJ)
                if (dadosOriginais.pms_envolvidos && dadosOriginais.pms_envolvidos.length > 0) {
                    dadosOriginais.pms_envolvidos.forEach((pm, idx) => {
                        const nomePM = formatarPmParaExibicao(pm);
                        linhasIndicios.push({ text: `${nomePM.toUpperCase()}:`, bold: true });
                        if (pm.indicios) {
                            const { categorias, crimes, transgressoes, art29 } = pm.indicios;
                            
                            // Verificar se há indícios específicos (crimes/transgressões)
                            const temIndiciosEspecificos = (crimes && crimes.length) || (transgressoes && transgressoes.length) || (art29 && art29.length);
                            
                            if (!temIndiciosEspecificos && categorias && categorias.length) {
                                // Apenas categorias, sem indícios específicos
                                categorias.forEach(c => linhasIndicios.push({ text: `• ${c}`, bold: false }));
                            } else if (temIndiciosEspecificos) {
                                // Listar cada crime individualmente com sua categoria
                                if (crimes && crimes.length) {
                                    const categoriaCrime = categorias ? categorias.filter(c => 
                                        c.includes('crime comum') || c.includes('crime militar')
                                    ) : [];
                                    
                                    crimes.forEach(crime => {
                                        const catTexto = categoriaCrime.length > 0 ? categoriaCrime.join(', ') : 'Indícios de crime';
                                        linhasIndicios.push({ text: `${catTexto}:`, bold: true });
                                        linhasIndicios.push({ text: `  - Crime: ${crime.texto_completo}`, bold: false });
                                    });
                                }
                                
                                // Listar cada transgressão RDPM individualmente
                                if (transgressoes && transgressoes.length) {
                                    const categoriaRdpm = categorias ? categorias.filter(c => 
                                        c.includes('transgressão disciplinar')
                                    ) : [];
                                    
                                    transgressoes.forEach(t => {
                                        const catTexto = categoriaRdpm.length > 0 ? categoriaRdpm[0] : 'Indícios de transgressão disciplinar';
                                        linhasIndicios.push({ text: `${catTexto}:`, bold: true });
                                        linhasIndicios.push({ text: `  - ${formatarTransgressao(t)}`, bold: false });
                                    });
                                }
                                
                                // Listar cada Art. 29 individualmente
                                if (art29 && art29.length) {
                                    art29.forEach(a => {
                                        linhasIndicios.push({ text: `Indícios de transgressão disciplinar:`, bold: true });
                                        linhasIndicios.push({ text: `  - ${a.texto_completo}`, bold: false });
                                    });
                                }
                            } else {
                                linhasIndicios.push({ text: '• Não houve', bold: false });
                            }
                        } else {
                            linhasIndicios.push({ text: '• Não houve', bold: false });
                        }
                        // sem linha em branco entre PMs para otimizar espaço
                    });
                }
                
                // Agrupar por item e quebrar mantendo cada item indivisível entre linhas da tabela
                const itensWrapped = [];
                linhasIndicios.forEach(({ text, bold }) => {
                    const parts = pdf.splitTextToSize(text, colWidths[2] - 6);
                    const linhas = parts.map(p => ({ text: p, bold }));
                    itensWrapped.push(linhas);
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
                const solucaoFinal = dadosOriginais?.solucao_final || dadosOriginais?.solucao?.solucao_final || dadosOriginais?.solucao?.solucao_tipo || processo.solucao;
                linhasEsq.push(['Solução/Resultado:', solucaoFinal || 'Não informado', true]);
            }
            if (['PAD', 'PADS', 'CD', 'CJ'].includes(window.tipoProcessoAtual)) {
                const dadosOriginais = window.dadosProcessos ?
                    window.dadosProcessos.find(p => p.id == processo.id) : null;
                const solucaoFinal = dadosOriginais?.solucao_final || dadosOriginais?.solucao?.solucao_final || dadosOriginais?.solucao?.solucao_tipo || processo.detalhes.solucaoCompleta.resultado;
                linhasEsq.push(['Solução/Resultado:', solucaoFinal || 'Não informado', true]);
                
                // Para PADS, mostrar também a penalidade se houver
                if (window.tipoProcessoAtual === 'PADS' && dadosOriginais?.solucao?.penalidade_tipo) {
                    const penalidade = dadosOriginais.solucao.penalidade_tipo;
                    const dias = dadosOriginais.solucao.penalidade_dias ? ` (${dadosOriginais.solucao.penalidade_dias} dias)` : '';
                    linhasEsq.push(['Tipo de Penalidade:', `${penalidade}${dias}`, true]);
                }
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
        
        // Atualizar currentY para o próximo processo e retornar
        return tableY + espacamento; // Usar o espaçamento passado como parâmetro
    }
    
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

// ===============================
// FUNÇÕES PARA MAPAS ANTERIORES
// ===============================

async function carregarMapasAnteriores() {
    try {
        console.log('📋 Carregando mapas anteriores...');
        
        // Suportar ambos os IDs (página de mapas ou seção na página de geração)
        const loadingEl = document.getElementById('loadingMapas') || document.getElementById('loadingMapasAnteriores');
        if (loadingEl) {
            loadingEl.classList.remove('d-none');
        }
        
        const resultado = await eel.listar_mapas_anteriores()();
        
        if (resultado.sucesso) {
            // Armazenar mapas globalmente
            todosOsMapas = resultado.mapas;
            mapasFiltrados = [...todosOsMapas];
            paginaAtualMapas = 1;
            
            renderizarMapasPaginados();
            console.log(`✅ ${resultado.mapas.length} mapas anteriores carregados`);
        } else {
            console.error('❌ Erro ao carregar mapas:', resultado.mensagem);
            mostrarEstadoVazioMapas();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar mapas anteriores:', error);
        mostrarEstadoVazioMapas();
    } finally {
        const loadingEl = document.getElementById('loadingMapas') || document.getElementById('loadingMapasAnteriores');
        if (loadingEl) {
            loadingEl.classList.add('d-none');
        }
    }
}

function renderizarMapasPaginados() {
    if (mapasFiltrados.length === 0) {
        mostrarEstadoVazioMapas();
        ocultarPaginacao();
        return;
    }
    
    // Calcular índices da página atual
    const inicio = (paginaAtualMapas - 1) * mapasPorPagina;
    const fim = inicio + mapasPorPagina;
    const mapasDaPagina = mapasFiltrados.slice(inicio, fim);
    
    // Renderizar mapas da página
    exibirMapasAnteriores(mapasDaPagina);
    
    // Atualizar controles de paginação
    atualizarPaginacao();
}

function atualizarPaginacao() {
    const totalPaginas = Math.ceil(mapasFiltrados.length / mapasPorPagina);
    const paginationContainer = document.getElementById('paginationContainer');
    const pageInfo = document.getElementById('pageInfo');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    
    if (!paginationContainer || !pageInfo || !btnPrev || !btnNext) return;
    
    // Mostrar/ocultar paginação
    if (totalPaginas > 1) {
        paginationContainer.classList.remove('d-none');
    } else {
        paginationContainer.classList.add('d-none');
        return;
    }
    
    // Atualizar texto
    pageInfo.textContent = `Página ${paginaAtualMapas} de ${totalPaginas}`;
    
    // Atualizar botões
    btnPrev.disabled = paginaAtualMapas === 1;
    btnNext.disabled = paginaAtualMapas === totalPaginas;
}

function ocultarPaginacao() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.classList.add('d-none');
    }
}

function exibirMapasAnteriores(mapas) {
    const container = document.getElementById('listaMapas') || document.getElementById('listaMapasAnteriores');
    
    if (!container) {
        console.error('Container de mapas não encontrado');
        return;
    }
    
    if (mapas.length === 0) {
        mostrarEstadoVazioMapas();
        return;
    }
    
    let html = '';
    
    mapas.forEach(mapa => {
        const dataFormatada = formatarDataHora(mapa.data_geracao);
        
        html += `
            <div class="mapa-card">
                <div class="mapa-header">
                    <div>
                        <h3 class="mapa-titulo">${mapa.titulo}</h3>
                        <span class="mapa-tipo">${mapa.tipo_processo}</span>
                    </div>
                    <div class="mapa-acoes">
                        <button class="btn btn-primary btn-sm" onclick="visualizarMapaAnterior('${mapa.id}', this)">
                            <i class="bi bi-file-earmark-pdf me-1"></i>Visualizar PDF
                        </button>
                        <button class="btn btn-danger btn-sm mt-2" onclick="confirmarExclusaoMapa('${mapa.id}', '${mapa.titulo.replace(/'/g, "\\'")}')">
                            <i class="bi bi-trash me-1"></i>Excluir Mapa
                        </button>
                    </div>
                </div>
                <div class="mapa-info">
                    <div class="mapa-info-item">
                        <i class="bi bi-calendar3"></i>
                        <span><strong>Período:</strong> ${mapa.periodo_descricao}</span>
                    </div>
                    <div class="mapa-info-item">
                        <i class="bi bi-person"></i>
                        <span><strong>Gerado por:</strong> ${mapa.usuario_nome}</span>
                    </div>
                    <div class="mapa-info-item">
                        <i class="bi bi-clock"></i>
                        <span><strong>Data:</strong> ${dataFormatada}</span>
                    </div>
                </div>
                <div class="mapa-stats">
                    <span class="mapa-stat total">
                        <i class="bi bi-list-ol"></i> ${mapa.total_processos} Total
                    </span>
                    <span class="mapa-stat concluidos">
                        <i class="bi bi-check-circle-fill"></i> ${mapa.total_concluidos} Concluídos
                    </span>
                    <span class="mapa-stat andamento">
                        <i class="bi bi-clock-fill"></i> ${mapa.total_andamento} Em Andamento
                    </span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function mostrarEstadoVazioMapas() {
    const container = document.getElementById('listaMapas') || document.getElementById('listaMapasAnteriores');
    
    if (!container) {
        console.error('Container de mapas não encontrado');
        return;
    }
    
    container.innerHTML = `
        <div class="estado-vazio-mapas">
            <i class="bi bi-file-earmark-text"></i>
            <h6>Nenhum mapa anterior encontrado</h6>
            <p class="mb-0">Gere um mapa mensal para que apareça aqui.</p>
        </div>
    `;
}

async function salvarMapaAutomaticamente(dadosResultado) {
    try {
        console.log('💾 Salvando mapa automaticamente...');
        
        const resultado = await eel.salvar_mapa_mensal(dadosResultado)();
        
        if (resultado.sucesso) {
            console.log('✅ Mapa salvo com sucesso');
            return resultado;
        } else {
            console.warn('⚠️ Erro ao salvar mapa:', resultado.mensagem);
            return null;
        }
    } catch (error) {
        console.error('❌ Erro ao salvar mapa automaticamente:', error);
        return null;
    }
}

function exibirDownloadContainer() {
    const container = document.getElementById('downloadContainer');
    if (container) {
        container.classList.remove('d-none');
        // Scroll suave até o container
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function ocultarDownloadContainer() {
    const container = document.getElementById('downloadContainer');
    if (container) {
        container.classList.add('d-none');
    }
}

async function downloadMapaGerado() {
    try {
        if (!window.ultimoMapaGerado) {
            mostrarAlerta('Nenhum mapa foi gerado ainda.', 'warning');
            return;
        }
        
        console.log('📥 Iniciando download do mapa...');
        
        // Desabilitar botão durante o download
        const btnDownload = document.getElementById('btnDownloadMapa');
        const textoOriginal = btnDownload.innerHTML;
        btnDownload.disabled = true;
        btnDownload.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Gerando PDF...';
        
        // Construir conteúdo para PDF
        const conteudo = construirConteudoPDFParaDownload(window.ultimoMapaGerado);
        
        // Gerar e baixar PDF
        await gerarDocumentoPDF(conteudo, conteudo.titulo);
        
        // Remover o container de download após sucesso
        ocultarDownloadContainer();
        
        // Limpar dados globais
        window.ultimoMapaGerado = null;
        
        mostrarAlerta('Download concluído! O mapa está salvo e pode ser acessado em "Mapas Anteriores".', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao fazer download:', error);
        mostrarAlerta('Erro ao gerar PDF para download.', 'danger');
        
        // Restaurar botão em caso de erro
        const btnDownload = document.getElementById('btnDownloadMapa');
        if (btnDownload) {
            btnDownload.disabled = false;
            btnDownload.innerHTML = '<i class="bi bi-download me-2"></i>Baixar Mapa em PDF';
        }
    }
}

function construirConteudoPDFParaDownload(dadosResultado) {
    const { dados, meta } = dadosResultado;
    
    // Disponibiliza dados originais para o gerador
    window.tipoProcessoAtual = meta.tipo_processo || '';
    window.dadosProcessos = dados;
    
    // Montar info e stats
    const info = {
        'Período': meta.mes_nome && meta.ano ? `${meta.mes_nome}/${meta.ano}` : (meta.periodo_descricao || '—'),
        'Tipo': meta.tipo_processo || '—',
        'Data de Geração': meta.data_geracao || new Date().toLocaleString('pt-BR')
    };
    
    const stats = {
        'Total': String(meta.total_processos ?? dados.length ?? 0),
        'Em Andamento': String(meta.total_andamento ?? 0),
        'Concluídos': String(meta.total_concluidos ?? 0)
    };
    
    // Montar processos
    const processos = dados.map((p, idx) => {
        const status = p.concluido ? 'Concluído' : 'Em Andamento';
        const numeroProc = `${p.numero}/${p.ano || (p.data_instauracao ? String(p.data_instauracao).slice(0,4) : '')}`;
        const encarregado = p?.responsavel?.completo || 'Não informado';
        const pmsStr = (Array.isArray(p.pms_envolvidos) ? p.pms_envolvidos.map(formatarPmParaExibicao) : []).join(', ') || 'Nenhum PM informado';
        
        // Documento/número
        let documentoNumero = 'Não informado';
        if (meta.tipo_processo === 'PADS' && p.numero_memorando) {
            documentoNumero = `Memorando nº ${p.numero_memorando}/${p.ano || ''}`;
        } else if (p.numero_portaria) {
            documentoNumero = `Portaria nº ${p.numero_portaria}/${p.ano || ''}`;
        }
        
        const detalhes = {
            numeroPortaria: documentoNumero,
            numeroControle: p.numero || 'Não informado',
            dataInstauracao: p.data_instauracao ? formatarData(p.data_instauracao) : 'Não informado',
            dataConclusao: status === 'Em Andamento' ? 'Não se aplica' : (p.data_conclusao ? formatarData(p.data_conclusao) : 'Não informado'),
            numeroRGF: p.numero_rgf || 'Não informado',
            resumoFatos: p.resumo_fatos || 'Não informado',
            ultimaMovimentacao: p.ultima_movimentacao ? formatarUltimaMovimentacao(p.ultima_movimentacao) : 'Não informado',
            solucaoCompleta: {
                dataRemessa: p?.solucao?.data_remessa ? formatarData(p.solucao.data_remessa) : 'Não informado',
                dataJulgamento: ['PAD','PADS','CD','CJ'].includes(meta.tipo_processo) ? 
                    (p?.solucao?.data_julgamento ? formatarData(p.solucao.data_julgamento) : 'Não informado') : 'Não se aplica',
                penalidade: ['PAD','PADS','CD','CJ'].includes(meta.tipo_processo) ? 
                    (p?.solucao?.penalidade_tipo || 'Não se aplica') : 'Não se aplica',
            }
        };
        
        const solucao = p.solucao_final || p?.solucao?.solucao_final || p?.solucao?.solucao_tipo || 'Não informado';
        
        return {
            id: p.id,
            numero: String(idx + 1),
            numeroProcesso: numeroProc,
            descricao: '',
            status,
            encarregado,
            pmsEnvolvidos: pmsStr,
            solucao,
            detalhes
        };
    });
    
    return {
        titulo: `${meta.tipo_processo || ''} - ${meta.mes_nome || ''}/${meta.ano || ''}`,
        info,
        stats,
        processos
    };
}

// Constrói o payload esperado por gerarDocumentoPDF a partir do JSON salvo no banco
function construirConteudoPDFDeMapaSalvo(mapaSalvo) {
    // Se já estiver no formato novo, apenas retornar
    if (mapaSalvo && Array.isArray(mapaSalvo.processos) && mapaSalvo.info && mapaSalvo.stats) {
        // Configurar contexto auxiliar usado no gerador
        window.tipoProcessoAtual = mapaSalvo.titulo?.split(' - ')?.[0] || mapaSalvo.meta?.tipo_processo || '';
        window.dadosProcessos = mapaSalvo.processosOriginais || [];
        return mapaSalvo;
    }

    const meta = mapaSalvo?.meta || {};
    const dados = mapaSalvo?.dados || [];

    // Disponibiliza dados originais para trechos do gerador que consultam o array completo
    window.tipoProcessoAtual = meta.tipo_processo || '';
    window.dadosProcessos = dados;

    // Montar info e stats na mesma forma usada pelo gerador atual
    const info = {
        'Período': meta.mes_nome && meta.ano ? `${meta.mes_nome}/${meta.ano}` : (meta.periodo_descricao || '—'),
        'Tipo': meta.tipo_processo || '—',
        'Data de Geração': meta.data_geracao || new Date().toLocaleString('pt-BR')
    };

    const stats = {
        'Total': String(meta.total_processos ?? dados.length ?? 0),
        'Em Andamento': String(meta.total_andamento ?? (dados.filter(p => !p.concluido).length)),
        'Concluídos': String(meta.total_concluidos ?? (dados.filter(p => p.concluido).length))
    };

    // Montar processos na estrutura consumida por gerarDocumentoPDF
    const processos = dados.map((p, idx) => {
        const status = p.concluido ? 'Concluído' : 'Em Andamento';
        const numeroProc = `${p.numero}/${p.ano || (p.data_instauracao ? String(p.data_instauracao).slice(0,4) : '')}`;
        const encarregado = p?.responsavel?.completo || 'Não informado';
        const pmsStr = (Array.isArray(p.pms_envolvidos) ? p.pms_envolvidos.map(formatarPmParaExibicao) : []).join(', ') || 'Nenhum PM informado';

        // Documento/número: Portaria ou Memorando conforme tipo
        let documentoNumero = 'Não informado';
        if (meta.tipo_processo === 'PADS' && p.numero_memorando) {
            documentoNumero = `Memorando nº ${p.numero_memorando}/${p.ano || ''}`;
        } else if (p.numero_portaria) {
            documentoNumero = `Portaria nº ${p.numero_portaria}/${p.ano || ''}`;
        }

        const detalhes = {
            numeroPortaria: documentoNumero,
            numeroControle: p.numero || 'Não informado',
            dataInstauracao: p.data_instauracao ? formatarData(p.data_instauracao) : 'Não informado',
            dataConclusao: status === 'Em Andamento' ? 'Não se aplica' : (p.data_conclusao ? formatarData(p.data_conclusao) : 'Não informado'),
            numeroRGF: p.numero_rgf || 'Não informado',
            resumoFatos: p.resumo_fatos || 'Não informado',
            solucaoCompleta: {
                dataRemessa: p?.solucao?.data_remessa ? formatarData(p.solucao.data_remessa) : 'Não informado',
                dataJulgamento: ['PAD','PADS','CD','CJ'].includes(meta.tipo_processo) ? (p?.solucao?.data_julgamento ? formatarData(p.solucao.data_julgamento) : 'Não informado') : 'Não se aplica',
                penalidade: ['PAD','PADS','CD','CJ'].includes(meta.tipo_processo) ? (p?.solucao?.penalidade_tipo || 'Não se aplica') : 'Não se aplica',
            }
        };

        const solucao = p.solucao_final || p?.solucao?.solucao_final || p?.solucao?.solucao_tipo || 'Não informado';

        return {
            id: p.id,
            numero: String(idx + 1),
            numeroProcesso: numeroProc,
            descricao: '',
            status,
            encarregado,
            pmsEnvolvidos: pmsStr,
            solucao,
            detalhes
        };
    });

    return {
        titulo: `${meta.tipo_processo || ''} - ${meta.mes_nome || ''}/${meta.ano || ''}`,
        info,
        stats,
        processos
    };
}

async function visualizarMapaAnterior(mapaId, botaoEl) {
    try {
        console.log(`📄 Visualizando mapa: ${mapaId}`);
        
        // Mostrar loading no botão (sem depender de event)
        const botao = botaoEl instanceof HTMLElement ? botaoEl : null;
        const textoOriginal = botao ? botao.innerHTML : null;
        if (botao) {
            botao.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Carregando...';
            botao.disabled = true;
        }
        
        const resultado = await eel.obter_dados_mapa_salvo(mapaId)();
        
        if (resultado.sucesso) {
            // Normalizar dados salvos para o formato consumido pelo gerador e criar PDF idêntico ao atual
            const conteudo = construirConteudoPDFDeMapaSalvo(resultado.dados_mapa);
            await gerarDocumentoPDF(conteudo, resultado.titulo);
        } else {
            mostrarAlerta('Erro ao carregar mapa: ' + resultado.mensagem, 'danger');
        }
        
        // Restaurar botão
        if (botao) {
            botao.innerHTML = textoOriginal;
            botao.disabled = false;
        }
        
    } catch (error) {
        console.error('❌ Erro ao visualizar mapa anterior:', error);
        mostrarAlerta('Erro ao visualizar mapa anterior.', 'danger');
        
        // Restaurar botão em caso de erro
        if (botaoEl instanceof HTMLElement) {
            botaoEl.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>Visualizar PDF';
            botaoEl.disabled = false;
        }
    }
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

// ============================================
// EXCLUSÃO DE MAPAS
// ============================================

let mapaParaExcluir = null;

function confirmarExclusaoMapa(mapaId, mapaTitulo) {
    console.log('🗑️ Solicitando confirmação de exclusão:', { mapaId, mapaTitulo });
    
    mapaParaExcluir = mapaId;
    
    // Criar modal se não existir
    let modal = document.getElementById('modalExclusaoMapa');
    if (!modal) {
        criarModalExclusaoMapa();
        modal = document.getElementById('modalExclusaoMapa');
    }
    
    // Preencher informações do mapa
    const tituloElement = document.getElementById('mapaExclusaoTitulo');
    if (tituloElement) {
        tituloElement.textContent = mapaTitulo;
    }
    
    // Exibir modal
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
}

function criarModalExclusaoMapa() {
    const modalHTML = `
        <div id="modalExclusaoMapa" class="modal-exclusao-overlay" onclick="fecharModalSeClicarFora(event)">
            <div class="modal-exclusao-content" onclick="event.stopPropagation()">
                <div class="modal-exclusao-header">
                    <i class="bi bi-exclamation-triangle-fill text-danger"></i>
                    <h3>Confirmar Exclusão</h3>
                </div>
                <div class="modal-exclusao-body">
                    <p>Tem certeza que deseja excluir este mapa mensal?</p>
                    <div class="mapa-exclusao-info">
                        <strong id="mapaExclusaoTitulo"></strong>
                    </div>
                    <p class="text-warning mt-3">
                        <i class="bi bi-info-circle me-1"></i>
                        Esta ação não pode ser desfeita!
                    </p>
                </div>
                <div class="modal-exclusao-footer">
                    <button class="btn btn-secondary" onclick="fecharModalExclusaoMapa()">
                        <i class="bi bi-x-circle me-1"></i>Cancelar
                    </button>
                    <button class="btn btn-danger" id="btnConfirmarExclusaoMapa" onclick="excluirMapa()">
                        <i class="bi bi-trash me-1"></i>Excluir
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalSeClicarFora(event) {
    if (event.target.id === 'modalExclusaoMapa') {
        fecharModalExclusaoMapa();
    }
}

function fecharModalExclusaoMapa() {
    const modal = document.getElementById('modalExclusaoMapa');
    if (modal) {
        modal.style.display = 'none';
    }
    mapaParaExcluir = null;
}

async function excluirMapa() {
    if (!mapaParaExcluir) {
        console.error('❌ Nenhum mapa selecionado para exclusão');
        return;
    }
    
    console.log(`🗑️ Excluindo mapa ID: ${mapaParaExcluir}`);
    
    const btnConfirmar = document.getElementById('btnConfirmarExclusaoMapa');
    const originalText = btnConfirmar ? btnConfirmar.innerHTML : '';
    
    try {
        // Loading state
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Excluindo...';
        }
        
        const resultado = await eel.excluir_mapa_salvo(mapaParaExcluir)();
        
        if (resultado.sucesso) {
            mostrarAlerta('✅ Mapa excluído com sucesso!', 'success');
            
            // Fechar modal
            fecharModalExclusaoMapa();
            
            // Recarregar lista de mapas
            await carregarMapasAnteriores();
        } else {
            mostrarAlerta('❌ Erro ao excluir mapa: ' + resultado.mensagem, 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro ao excluir mapa:', error);
        mostrarAlerta('❌ Erro ao excluir mapa. Tente novamente.', 'error');
    } finally {
        // Restaurar estado do botão
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = originalText;
        }
    }
}

