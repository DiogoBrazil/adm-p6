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
    document.getElementById('infoSituacao').textContent = data.situacao || '-';
    document.getElementById('infoAnoInstauracao').textContent = data.ano_instauracao || '-';

    // Numeração e Documentos
    document.getElementById('infoNumeroControle').textContent = data.numero_controle || '-';
    document.getElementById('infoNumeroPortaria').textContent = data.numero_portaria || '-';
    document.getElementById('infoNumeroMemorando').textContent = data.numero_memorando || '-';
    document.getElementById('infoNumeroFeito').textContent = data.numero_feito || '-';
    document.getElementById('infoNumeroRGF').textContent = data.numero_rgf || '-';
    
    // Carregar encarregados
    loadEncarregados(data.id);
    
    // Carregar envolvidos
    loadEnvolvidos(data.id);
    
    // Natureza e Solução
    document.getElementById('infoNaturezaProcedimento').textContent = data.natureza_procedimento || '-';
    document.getElementById('infoSolucaoFinal').textContent = data.solucao_final || '-';
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
async function loadEncarregados(procedureId) {
    try {
        const container = document.getElementById('encarregadosContainer');
        const data = await eel.obter_encarregados_procedimento(procedureId)();
        
        if (data.sucesso && data.encarregados.length > 0) {
            container.innerHTML = data.encarregados.map(encarregado => `
                <div class="info-section">
                    <h4>
                        <i class="fas fa-user-shield"></i>
                        ${encarregado.tipo_encarregado}
                    </h4>
                    <ul class="info-list">
                        <li>
                            <i class="fas fa-user"></i>
                            <strong>${encarregado.posto_graduacao || ''} ${encarregado.nome}</strong>
                        </li>
                        <li>
                            <i class="fas fa-id-badge"></i>
                            Matrícula: ${encarregado.matricula || 'Não informada'}
                        </li>
                    </ul>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">Nenhum encarregado cadastrado</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar encarregados:', error);
        document.getElementById('encarregadosContainer').innerHTML = '<p class="empty-state">Erro ao carregar encarregados</p>';
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

// Função para carregar observações
function loadObservacoes(data) {
    const container = document.getElementById('observacoesContainer');
    
    if (data.observacoes && data.observacoes.trim()) {
        container.innerHTML = `
            <div class="info-section">
                <p>${data.observacoes}</p>
            </div>
        `;
    } else {
        container.innerHTML = '<p class="empty-state">Nenhuma observação registrada</p>';
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
function loadIndicios(data) {
    const container = document.getElementById('indiciosContainer');
    if (!container) return;

    const indicios = data.indicios || {};
    const crimes = Array.isArray(indicios.crimes) ? indicios.crimes : [];
    const rdpm = Array.isArray(indicios.rdpm) ? indicios.rdpm : [];
    const art29 = Array.isArray(indicios.art29) ? indicios.art29 : [];

    const total = crimes.length + rdpm.length + art29.length;
    if (total === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum indício registrado</p>';
        return;
    }

    const sec = [];
    if (crimes.length) {
        const list = crimes.map(c => `<li><strong>${c.codigo || 'N/A'}</strong> - ${c.descricao || ''}</li>`).join('');
        sec.push(`
        <div class="info-section">
            <h4><i class="fas fa-scale-balanced"></i> Crimes/Contravenções</h4>
            <ul class="info-list">${list}</ul>
        </div>`);
    }
    if (rdpm.length) {
        const list = rdpm.map(r => `<li>Inciso ${r.inciso || '-'}: ${r.texto || ''}${r.natureza ? ` [${r.natureza}]` : ''}</li>`).join('');
        sec.push(`
        <div class="info-section">
            <h4><i class="fas fa-gavel"></i> RDPM</h4>
            <ul class="info-list">${list}</ul>
        </div>`);
    }
    if (art29.length) {
        const list = art29.map(a => `<li>Art. 29 - Inciso ${a.inciso || '-'}: ${a.texto || ''}</li>`).join('');
        sec.push(`
        <div class="info-section">
            <h4><i class="fas fa-book"></i> Estatuto (Art. 29)</h4>
            <ul class="info-list">${list}</ul>
        </div>`);
    }

    // Categorias livres (JSON texto)
    if (data.indicios_categorias) {
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

// Função para formatar data
function formatDate(dateString) {
    if (!dateString) return null;
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return dateString;
    }
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
