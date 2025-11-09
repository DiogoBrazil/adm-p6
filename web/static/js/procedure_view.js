// procedure_view.js - JavaScript para a página de visualização de processos/procedimentos

// Variáveis globais
let currentProcedureId = null;
let procedureData = null;
let usuarioLogado = null;

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email;
            return true;
        } else {
            showAlert('Sessão expirada. Redirecionando para login...', 'error');
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

// Função de logout
async function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                const startTs = Date.now();
                await eel.fazer_logout()();
                const loader = document.getElementById('globalLoader');
                if (loader) loader.classList.remove('hidden');
                const elapsed = Date.now() - startTs;
                const toWait = Math.max(0, 1000 - elapsed);
                if (toWait > 0) await new Promise(r => setTimeout(r, toWait));
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro no logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
            }
        }
    );
}

// Função para mostrar alertas
function showAlert(message, type = 'error') {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    // Criar modal se não existir
    let modal = document.getElementById('confirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal-feedback';
        modal.innerHTML = `
            <div class="modal-content">
                <i id="confirmIcon" class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
                <h3 id="confirmTitle" style="margin-bottom: 15px; color: #333;"></h3>
                <p id="confirmMessage" style="margin-bottom: 25px; color: #666;"></p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirmCancel" class="btn-secondary" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>
                    <button id="confirmOk" class="btn-danger" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer;">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Atualizar conteúdo do modal
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Event listeners
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    // Remover listeners anteriores
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));
    
    // Novos listeners
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Função para obter ID do procedimento da URL
function getProcedureIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Função para carregar dados do procedimento
async function loadProcedureData() {
    try {
        const data = await eel.obter_procedimento_completo(currentProcedureId)();
        
        if (data.sucesso) {
            procedureData = data.procedimento;
            populateProcedureData(procedureData);
        } else {
            showAlert(data.mensagem || 'Erro ao carregar dados do procedimento!', 'error');
            setTimeout(() => {
                window.location.href = 'procedure_list.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Erro ao carregar procedimento:', error);
        showAlert('Erro ao carregar dados do procedimento!', 'error');
        setTimeout(() => {
            window.location.href = 'procedure_list.html';
        }, 2000);
    }
}

// Função para popular os dados na interface
function populateProcedureData(data) {
    // Header
    document.getElementById('procedureNumber').textContent = data.numero || 'Número não informado';
    document.getElementById('procedureType').textContent = data.tipo_procedimento || 'Tipo não informado';
    
    // Status do procedimento
    const statusElement = document.getElementById('procedureStatus');
    const statusInfo = getStatusInfo(data);
    statusElement.className = `procedure-badge ${statusInfo.class}`;
    statusElement.innerHTML = `<i class="${statusInfo.icon}"></i><span>${statusInfo.text}</span>`;
    
    // Informações básicas
    document.getElementById('infoTipo').textContent = data.tipo_procedimento || '-';
    document.getElementById('infoTipoGeral').textContent = data.tipo_geral || '-';
    document.getElementById('infoDocumentoIniciador').textContent = data.documento_iniciador || '-';
    document.getElementById('infoDataAbertura').textContent = formatDate(data.data_abertura) || '-';
    document.getElementById('infoDataRecebimento').textContent = formatDate(data.data_recebimento) || '-';
    document.getElementById('infoDataConclusao').textContent = formatDate(data.data_conclusao) || '-';
    document.getElementById('infoLocalOrigem').textContent = data.local_origem || '-';
    document.getElementById('infoLocalFatos').textContent = data.local_fatos || '-';
    document.getElementById('infoProcessoSei').textContent = data.processo_sei || '-';
    
    // Resumo dos Fatos (card separado)
    const resumoContainer = document.getElementById('resumoFatosContainer');
    if (data.resumo_fatos && data.resumo_fatos.trim()) {
        resumoContainer.textContent = data.resumo_fatos;
    } else {
        resumoContainer.innerHTML = '<p style="color: #999; font-style: italic;">Nenhum resumo dos fatos cadastrado.</p>';
    }
    document.getElementById('infoSituacao').textContent = data.situacao || '-';
    document.getElementById('infoAnoInstauracao').textContent = data.ano_instauracao || '-';

    // Numeração e Documentos
    document.getElementById('infoNumeroControle').textContent = data.numero_controle || '-';
    document.getElementById('infoNumeroPortaria').textContent = data.numero_portaria || '-';
    document.getElementById('infoNumeroMemorando').textContent = data.numero_memorando || '-';
    document.getElementById('infoNumeroFeito').textContent = data.numero_feito || '-';
    document.getElementById('infoNumeroRGF').textContent = data.numero_rgf || '-';
    
    // Carregar encarregados
    loadEncarregados(data.id, data.tipo_procedimento);
    
    // Carregar envolvidos
    loadEnvolvidos(data.id);
    
    // Natureza e Solução
    document.getElementById('infoNaturezaProcedimento').textContent = data.natureza_procedimento || '-';
    document.getElementById('infoSolucaoFinal') && (document.getElementById('infoSolucaoFinal').textContent = data.solucao_final || '-');
    // Novos campos: solução/penalidade e remessa/julgamento
    document.getElementById('infoSolucaoTipo') && (document.getElementById('infoSolucaoTipo').textContent = data.solucao_tipo || '-');
    // Mapear enum ASCII para rótulo com acento
    const penalLabel = (function(v){
        if (v === 'Prisao') return 'Prisão';
        if (v === 'Detencao') return 'Detenção';
        if (v === 'Repreensao') return 'Repreensão';
        return v;
    })(data.penalidade_tipo);
    const penalTxt = (penalLabel ? penalLabel : '-') +
        (data.penalidade_dias ? ` (${data.penalidade_dias} dia${Number(data.penalidade_dias) === 1 ? '' : 's'})` : '');
    document.getElementById('infoPenalidade') && (document.getElementById('infoPenalidade').textContent = penalTxt.trim() || '-');
    document.getElementById('infoDataRemessa') && (document.getElementById('infoDataRemessa').textContent = formatDate(data.data_remessa_encarregado) || '-');
    document.getElementById('infoDataJulgamento') && (document.getElementById('infoDataJulgamento').textContent = formatDate(data.data_julgamento) || '-');

    // Carregar observações
    loadObservacoes(data);

    // Carregar transgressões
    loadTransgressoes(data);

    // Carregar indícios
    loadIndicios(data);

    // Esconder Natureza (Procedimento) quando for um Tipo Geral = processo
    try {
        if (String(data.tipo_geral).toLowerCase() === 'processo') {
            const row = document.getElementById('infoNaturezaProcedimento')?.closest('tr');
            if (row) row.style.display = 'none';
        }
    } catch (e) { /* noop */ }

    // Carregar prazos e prorrogações (histórico)
    loadPrazos(data.id);
}

// Função para obter informações de status
function getStatusInfo(data) {
    if (data.data_conclusao) {
        return {
            class: 'concluido',
            icon: 'fas fa-check-circle',
            text: 'Concluído'
        };
    }
    
    if (data.prazo_final) {
        const prazoFinal = new Date(data.prazo_final);
        const hoje = new Date();
        
        if (prazoFinal < hoje) {
            return {
                class: 'vencido',
                icon: 'fas fa-exclamation-triangle',
                text: 'Vencido'
            };
        } else {
            return {
                class: 'em-prazo',
                icon: 'fas fa-clock',
                text: 'Em Prazo'
            };
        }
    }
    
    return {
        class: 'em-andamento',
        icon: 'fas fa-play-circle',
        text: 'Em Andamento'
    };
}

// Função para carregar encarregados
async function loadEncarregados(procedureId, tipoProcedimento) {
    try {
        const container = document.getElementById('encarregadosContainer');
        const tituloCard = document.getElementById('tituloEncarregados');
        const data = await eel.obter_encarregados_procedimento(procedureId)();
        
        // Ajustar título do card baseado no tipo
        if (tipoProcedimento && ['CJ', 'CD', 'PAD'].includes(tipoProcedimento)) {
            tituloCard.innerHTML = '<i class="fas fa-gavel"></i> Composição do Conselho';
        } else {
            tituloCard.innerHTML = '<i class="fas fa-user-shield"></i> Encarregado(s)';
        }
        
        let encarregadosHtml = '';
        
        if (data.sucesso && data.encarregados.length > 0) {
            const tituloSecao = ['CJ', 'CD', 'PAD'].includes(tipoProcedimento) 
                ? 'Membros do Conselho' 
                : 'Encarregado(s) Atual(is)';
            
            encarregadosHtml = `
                <div class="encarregados-atuais">
                    <h4>
                        <i class="fas fa-user-shield"></i>
                        ${tituloSecao}
                    </h4>
                    <div class="encarregados-lista">
                        ${data.encarregados.map(encarregado => `
                            <div class="encarregado-item">
                                <div class="encarregado-info">
                                    <span class="encarregado-nome">
                                        <strong>${encarregado.posto_graduacao || ''} ${encarregado.nome}</strong>
                                    </span>
                                    <span class="encarregado-matricula">
                                        <i class="fas fa-id-badge"></i>
                                        ${encarregado.matricula || 'Não informada'}
                                    </span>
                                    <span class="encarregado-tipo">
                                        ${encarregado.tipo_encarregado}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            encarregadosHtml = '<p class="empty-state">Nenhum encarregado cadastrado</p>';
        }
        
        container.innerHTML = encarregadosHtml;
        
        // Carregar histórico de encarregados após carregar os encarregados atuais
        await loadHistoricoEncarregados(procedureId);
    } catch (error) {
        console.error('Erro ao carregar encarregados:', error);
        document.getElementById('encarregadosContainer').innerHTML = '<p class="empty-state">Erro ao carregar encarregados</p>';
    }
}

// Função para carregar histórico de encarregados
async function loadHistoricoEncarregados(procedureId) {
    try {
        const data = await eel.obter_historico_encarregados(procedureId)();
        
        if (data.sucesso && data.historico && data.historico.length > 0) {
            const container = document.getElementById('encarregadosContainer');
            const historicoHtml = `
                <div class="historico-encarregados">
                    <h4>
                        <i class="fas fa-history"></i>
                        Histórico de Substituições
                    </h4>
                    <div class="historico-lista">
                        ${data.historico.map(registro => `
                            <div class="historico-item">
                                <div class="historico-data">
                                    <i class="fas fa-calendar-day"></i>
                                    ${formatDate(registro.data_substituicao)}
                                </div>
                                <div class="historico-substituicao">
                                    <div class="encarregado-anterior">
                                        <span class="encarregado-nome">${registro.encarregado_anterior ? (registro.encarregado_anterior.posto_graduacao || '') + ' ' + (registro.encarregado_anterior.nome || '') : 'N/A'}</span>
                                        ${registro.encarregado_anterior ? `<span class="encarregado-matricula">${registro.encarregado_anterior.matricula || ''}</span>` : ''}
                                    </div>
                                    <div class="seta-substituicao">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                    <div class="novo-encarregado">
                                        <span class="encarregado-nome">${registro.novo_encarregado ? (registro.novo_encarregado.posto_graduacao || '') + ' ' + (registro.novo_encarregado.nome || '') : 'N/A'}</span>
                                        ${registro.novo_encarregado ? `<span class="encarregado-matricula">${registro.novo_encarregado.matricula || ''}</span>` : ''}
                                    </div>
                                </div>
                                ${registro.justificativa ? `
                                    <div class="historico-justificativa">
                                        <i class="fas fa-comment-dots"></i>
                                        ${registro.justificativa}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            // Adicionar histórico ao final do container
            container.innerHTML += historicoHtml;
        }
    } catch (error) {
        console.error('Erro ao carregar histórico de encarregados:', error);
        // Não mostrar erro pois é opcional
    }
}



// Função para carregar envolvidos
async function loadEnvolvidos(procedureId) {
    try {
        const container = document.getElementById('envolvidosContainer');
        const data = await eel.obter_envolvidos_procedimento(procedureId)();
        
        if (data.sucesso && data.envolvidos.length > 0) {
            container.innerHTML = data.envolvidos.map(envolvido => {
                const nomeCompleto = `${envolvido.posto_graduacao ? envolvido.posto_graduacao + ' ' : ''}${envolvido.nome || ''}`.trim();
                const temMatricula = envolvido.matricula && String(envolvido.matricula).trim() !== '';
                return `
                <div class="info-section">
                    <h4>
                        <i class="fas fa-users"></i>
                        ${envolvido.tipo_envolvimento}
                    </h4>
                    <ul class="info-list">
                        <li>
                            <i class="fas fa-user"></i>
                            <strong>${nomeCompleto}</strong>
                        </li>
                        ${temMatricula ? `
                        <li>
                            <i class="fas fa-id-badge"></i>
                            Matrícula: ${envolvido.matricula}
                        </li>` : ''}
                        ${envolvido.observacoes ? `
                        <li>
                            <i class="fas fa-sticky-note"></i>
                            Observações: ${envolvido.observacoes}
                        </li>
                        ` : ''}
                    </ul>
                </div>`;
            }).join('');
        } else {
            container.innerHTML = '<p class="empty-state">Nenhum envolvido cadastrado</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar envolvidos:', error);
        document.getElementById('envolvidosContainer').innerHTML = '<p class="empty-state">Erro ao carregar envolvidos</p>';
    }
}

// Função para carregar andamentos do processo
async function loadObservacoes(data) {
    const container = document.getElementById('observacoesContainer');
    
    try {
        // Buscar andamentos do processo
        const resultado = await eel.listar_andamentos_processo(data.id)();
        
        if (resultado.sucesso && resultado.andamentos && resultado.andamentos.length > 0) {
            const andamentosHTML = `
                <div class="table-responsive">
                    <table class="table andamentos-table">
                        <thead>
                            <tr>
                                <th style="width: 80px;">#</th>
                                <th style="width: 150px;">Data</th>
                                <th style="width: 200px;">Responsável</th>
                                <th>Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultado.andamentos.map((andamento, index) => {
                                const dataFormatada = andamento.data ? formatDate(andamento.data) : '-';
                                const usuarioNome = andamento.usuario_nome || 'Sistema';
                                
                                return `
                                    <tr class="andamento-row">
                                        <td>
                                            <span class="andamento-numero">#${resultado.andamentos.length - index}</span>
                                        </td>
                                        <td>
                                            <span class="andamento-data">
                                                <i class="fas fa-calendar"></i> ${dataFormatada}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="andamento-usuario">
                                                <i class="fas fa-user"></i> ${usuarioNome}
                                            </span>
                                        </td>
                                        <td class="andamento-content">
                                            ${andamento.descricao || 'Sem descrição'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = andamentosHTML;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum andamento registrado para este processo</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao carregar andamentos:', error);
        container.innerHTML = `
            <div class="empty-state error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erro ao carregar andamentos</p>
            </div>
        `;
    }
}

// Função auxiliar para formatar data
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        // Se for apenas data (YYYY-MM-DD), formatar sem hora
        if (dateString.length === 10 && dateString.includes('-')) {
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        }
        
        // Se for data com hora (YYYY-MM-DD HH:MM:SS), extrair apenas a data
        if (dateString.includes(' ')) {
            const datePart = dateString.split(' ')[0];
            const [year, month, day] = datePart.split('-');
            return `${day}/${month}/${year}`;
        }
        
        // Fallback: tentar criar objeto Date (evitando problema de timezone)
        const [year, month, day] = dateString.substring(0, 10).split('-');
        return `${day}/${month}/${year}`;
        
    } catch (error) {
        console.error('Erro ao formatar data:', error, dateString);
        return dateString;
    }
}

// Função para carregar transgressões
function loadTransgressoes(data) {
    const container = document.getElementById('transgressoesContainer');
    const lista = data.transgressoes_selecionadas || [];
    if (!lista || lista.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma transgressão registrada</p>';
        return;
    }
    const itens = lista.map(t => {
        if (t.tipo === 'estatuto') {
            const ana = t.rdmp_analogia || {};
            const anaTxt = ana.id ? ` (Analogia RDPM: Inciso ${ana.inciso || '-'} - ${ana.texto || ''})` : '';
            return `<li><strong>Art. 29</strong> - Inciso ${t.inciso || '-'}: ${t.texto || ''}${anaTxt}</li>`;
        }
        // RDPM
        const natureza = t.natureza ? ` [${t.natureza}]` : '';
        return `<li><strong>RDPM</strong> - Inciso ${t.inciso || '-'}: ${t.texto || ''}${natureza}</li>`;
    }).join('');
    container.innerHTML = `<ul class="info-list">${itens}</ul>`;
}

// Função para carregar indícios
async function loadIndicios(data) {
    const container = document.getElementById('indiciosContainer');
    if (!container) return;

    const indicios = data.indicios || {};
    const crimes = Array.isArray(indicios.crimes) ? indicios.crimes : [];
    const rdpm = Array.isArray(indicios.rdpm) ? indicios.rdpm : [];
    const art29 = Array.isArray(indicios.art29) ? indicios.art29 : [];
    const indiciosPorPm = data.indicios_por_pm || {};

    const total = crimes.length + rdpm.length + art29.length + Object.keys(indiciosPorPm).length;
    if (total === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum indício registrado</p>';
        return;
    }

    const sec = [];
    
    // Indícios por PM Envolvido (mais importante - mostrar primeiro)
    if (Object.keys(indiciosPorPm).length > 0) {
        // Buscar dados dos PMs envolvidos
        let pmsEnvolvidos = [];
        try {
            const resultado = await eel.obter_envolvidos_procedimento(data.id)();
            if (resultado.sucesso && resultado.envolvidos) {
                pmsEnvolvidos = resultado.envolvidos;
            }
        } catch (error) {
            console.error('Erro ao buscar PMs envolvidos:', error);
        }
        
        // Criar tabela de indícios por PM
        let tabelaHTML = `
            <div class="info-section indicio-pm-section">
                <h4><i class="fas fa-fingerprint"></i> Indícios por PM Envolvido</h4>
                <div class="table-responsive">
                    <table class="table indicios-table">
                        <thead>
                            <tr>
                                <th style="width: 30%;">PM</th>
                                <th style="width: 70%;">Indícios</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        for (const [pmId, pmIndicios] of Object.entries(indiciosPorPm)) {
            const categorias = pmIndicios.categorias || [];
            const crimespm = pmIndicios.crimes || [];
            const rdpmpm = pmIndicios.rdpm || [];
            const art29pm = pmIndicios.art29 || [];
            
            if (categorias.length > 0 || crimespm.length > 0 || rdpmpm.length > 0 || art29pm.length > 0) {
                // Encontrar o nome do PM
                const pm = pmsEnvolvidos.find(p => p.usuario_id === pmId);
                const nomePM = pm ? `${pm.posto_graduacao || ''} ${pm.nome || ''}`.trim() : 'PM Desconhecido';
                
                let conteudo = '';
                
                // Categorias gerais
                if (categorias.length > 0) {
                    conteudo += `<div class="mb-2"><strong>Categoria:</strong> ${categorias.join(', ')}</div>`;
                }
                
                // Crimes específicos
                if (crimespm.length > 0) {
                    const listCrimes = crimespm.map(c => `
                        <li><strong>${c.codigo || 'N/A'}</strong> - ${c.descricao || ''}</li>
                    `).join('');
                    conteudo += `
                        <div class="mb-2">
                            <strong>Crimes/Contravenções:</strong>
                            <ul class="info-list">${listCrimes}</ul>
                        </div>
                    `;
                }
                
                // RDPM específicas
                if (rdpmpm.length > 0) {
                    const listRdpm = rdpmpm.map(r => `
                        <li>Inciso ${r.inciso || '-'}: ${r.texto || ''}${r.natureza ? ` [${r.natureza}]` : ''}</li>
                    `).join('');
                    conteudo += `
                        <div class="mb-2">
                            <strong>RDPM:</strong>
                            <ul class="info-list">${listRdpm}</ul>
                        </div>
                    `;
                }
                
                // Art. 29 específicas
                if (art29pm.length > 0) {
                    const listArt29 = art29pm.map(a => `
                        <li>Art. 29 - Inciso ${a.inciso || '-'}: ${a.texto || ''}</li>
                    `).join('');
                    conteudo += `
                        <div class="mb-2">
                            <strong>Estatuto (Art. 29):</strong>
                            <ul class="info-list">${listArt29}</ul>
                        </div>
                    `;
                }
                
                tabelaHTML += `
                    <tr>
                        <td><strong>${nomePM}</strong></td>
                        <td>${conteudo}</td>
                    </tr>
                `;
            }
        }
        
        tabelaHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        sec.push(tabelaHTML);
    }
    
    // Indícios gerais do procedimento
    if (crimes.length) {
        const list = crimes.map(c => `<li><strong>${c.codigo || 'N/A'}</strong> - ${c.descricao || ''}</li>`).join('');
        sec.push(`
        <div class="info-section">
            <h4><i class="fas fa-scale-balanced"></i> Crimes/Contravenções (Geral)</h4>
            <ul class="info-list">${list}</ul>
        </div>`);
    }
    if (rdpm.length) {
        const list = rdpm.map(r => `<li>Inciso ${r.inciso || '-'}: ${r.texto || ''}${r.natureza ? ` [${r.natureza}]` : ''}</li>`).join('');
        sec.push(`
        <div class="info-section">
            <h4><i class="fas fa-gavel"></i> RDPM (Geral)</h4>
            <ul class="info-list">${list}</ul>
        </div>`);
    }
    if (art29.length) {
        const list = art29.map(a => `<li>Art. 29 - Inciso ${a.inciso || '-'}: ${a.texto || ''}</li>`).join('');
        sec.push(`
        <div class="info-section">
            <h4><i class="fas fa-book"></i> Estatuto - Art. 29 (Geral)</h4>
            <ul class="info-list">${list}</ul>
        </div>`);
    }

    // Categorias livres (JSON texto) - campo legado
    if (data.indicios_categorias && Object.keys(indiciosPorPm).length === 0) {
        let catText = '';
        try {
            const cats = JSON.parse(data.indicios_categorias);
            if (Array.isArray(cats)) catText = cats.join(', ');
            else if (typeof cats === 'object') catText = Object.values(cats).join(', ');
        } catch (_) {
            catText = data.indicios_categorias;
        }
        if (catText && String(catText).trim() !== '') {
            sec.push(`
            <div class="info-section">
                <h4><i class="fas fa-tags"></i> Categorias</h4>
                <p>${catText}</p>
            </div>`);
        }
    }

    container.innerHTML = sec.join('');
}

// Função para editar procedimento atual
function editarProcedimento() {
    if (currentProcedureId) {
        window.location.href = `procedure_form.html?id=${currentProcedureId}`;
    }
}

// Função para voltar à lista
function voltarParaLista() {
    window.location.href = 'procedure_list.html';
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    // Obter ID do procedimento da URL
    currentProcedureId = getProcedureIdFromURL();
    
    if (!currentProcedureId) {
        showAlert('ID do procedimento não encontrado!', 'error');
        setTimeout(() => {
            window.location.href = 'procedure_list.html';
        }, 2000);
        return;
    }
    
    // Carregar dados do usuário logado primeiro
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        // Só carrega os dados do procedimento se o login estiver ok
        await loadProcedureData();
    }
});

// ==========================
// Prazos e Prorrogações
// ==========================
function formatOrdinal(n) {
    if (!n || n <= 0) return '';
    return `${n}ª`;
}

async function loadPrazos(procedureId) {
    const tbody = document.getElementById('prazosBody');
    if (!tbody) return;
    try {
        // placeholder de carregando já está no HTML; vamos manter se demorar
        const resp = await eel.listar_prazos_processo(procedureId)();
        if (!resp || !resp.sucesso) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#b00;">${(resp && resp.mensagem) || 'Erro ao carregar prazos'}</td></tr>`;
            return;
        }
        const prazos = resp.prazos || [];
        if (prazos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#777;">Nenhum prazo registrado</td></tr>';
            return;
        }
        const rows = prazos.map(p => {
            const isInicial = p.tipo_prazo === 'inicial';
            const tipoTxt = isInicial ? 'Inicial' : `Prorrogação ${formatOrdinal(p.ordem_prorrogacao)}`;
            const diasTxt = p.dias_adicionados != null ? p.dias_adicionados : '-';
            const portaria = p.numero_portaria || '-';
            const dataPortaria = p.data_portaria ? formatDate(p.data_portaria) : '-';
            const inicio = p.data_inicio ? formatDate(p.data_inicio) : '-';
            const venc = p.data_vencimento ? formatDate(p.data_vencimento) : '-';
            const ativoBadge = p.ativo ? '<span class="badge-status em-prazo" title="Prazo ativo"><i class="fas fa-check"></i></span>' : '';
            return `<tr>
                <td>${tipoTxt} ${ativoBadge}</td>
                <td>${inicio}</td>
                <td>${venc}</td>
                <td style="text-align:center;">${diasTxt}</td>
                <td>${portaria}</td>
                <td>${dataPortaria}</td>
                <td style="text-align:center;">${isInicial ? '-' : (p.ordem_prorrogacao || '-')}</td>
            </tr>`;
        }).join('');
        tbody.innerHTML = rows;
    } catch (err) {
        console.error('Erro ao carregar prazos:', err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#b00;">Erro ao carregar prazos</td></tr>';
    }
}
