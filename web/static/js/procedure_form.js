// Variável para usuário logado
let usuarioLogado = null;
let editandoProcedimento = null;

// Array para armazenar PMs adicionais (além do primeiro)
let pmsAdicionais = [];

// Array para armazenar transgressões selecionadas
// Novo formato: [{id: "8", inciso: "V", texto: "...", natureza: "leve"}, ...]
let transgressoesSelecionadas = [];

// Array para armazenar indícios por PM específico
// Formato: {pm_id: {categoria: "categoria", crimes: [...], rdpm: [...], art29: [...]}}
let indiciosPorPM = {};

// Array para armazenar municípios/distritos
let municipiosDisponiveis = [];

// Novos: caches de opções de indícios
let opcoesCrimes = [];
let opcoesRDPM = [];
let opcoesArt29 = [];

// Suporte a modo edição
let modoEdicaoId = null;

// ============================================
// FUNÇÕES DE BUSCA DE MUNICÍPIOS
// ============================================

async function carregarMunicipios() {
    try {
        console.log('Carregando municípios/distritos...');
        const response = await eel.buscar_municipios_distritos('')();
        
        if (response && response.sucesso && response.municipios) {
            municipiosDisponiveis = response.municipios;
            console.log(`Carregados ${municipiosDisponiveis.length} municípios/distritos`);
            preencherDropdownMunicipios();
        } else {
            console.error('Resposta inválida ao carregar municípios:', response);
            if (response && response.erro) {
                console.error('Erro do servidor:', response.erro);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar municípios:', error);
    }
}

function preencherDropdownMunicipios() {
    const dropdown = document.getElementById('local_fatos_dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    municipiosDisponiveis.forEach(municipio => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; font-size: 14px; line-height: 1.3;';
        
        const tipoIcon = municipio.tipo === 'municipio' ? '🏢' : '🏘️';
        const tipoBadge = municipio.tipo === 'municipio' ? 
            '<span style="background:#28a745;color:white;padding:2px 6px;border-radius:3px;font-size:11px;">MUNICÍPIO</span>' : 
            '<span style="background:#007bff;color:white;padding:2px 6px;border-radius:3px;font-size:11px;">DISTRITO</span>';
        
        option.innerHTML = `
            <div style="font-weight: bold; color: #1976d2; display: flex; align-items: center; gap: 5px;">
                ${tipoIcon} ${municipio.nome_display}
            </div>
            <div style="color: #666; margin-top: 2px; font-size: 12px;">${tipoBadge}</div>
        `;
        
        option.addEventListener('click', function() {
            selecionarMunicipio(municipio.nome_display);
        });
        
        option.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f8f9fa';
        });
        
        option.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
        });
        
        dropdown.appendChild(option);
    });
}

function selecionarMunicipio(nomeMunicipio) {
    const input = document.getElementById('local_fatos');
    const dropdown = document.getElementById('local_fatos_dropdown');
    
    if (input) {
        input.value = nomeMunicipio;
        // Remover erro de validação se houver
        const errorElement = input.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
        input.classList.remove('error');
    }
    
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    console.log('Município selecionado:', nomeMunicipio);
}

function filtrarMunicipios() {
    const searchTerm = document.getElementById('local_fatos').value.toLowerCase();
    const dropdown = document.getElementById('local_fatos_dropdown');
    const options = dropdown.querySelectorAll('.dropdown-option');
    
    console.log('Filtrando municípios com termo:', searchTerm);
    
    let visibleCount = 0;
    
    options.forEach(option => {
        const text = option.textContent.toLowerCase();
        const isVisible = text.includes(searchTerm);
        option.style.display = isVisible ? 'block' : 'none';
        if (isVisible) visibleCount++;
    });
    
    // Mostrar dropdown se houver texto e opções visíveis
    if (searchTerm && visibleCount > 0) {
        dropdown.style.display = 'block';
    } else if (!searchTerm) {
        dropdown.style.display = 'block'; // Mostrar todas quando vazio
    } else {
        dropdown.style.display = 'none'; // Ocultar se não houver resultados
    }
    
    console.log('Municípios visíveis:', visibleCount);
}

// ============================================
// FUNÇÕES DE VALIDAÇÃO DE DUPLICATAS
// ============================================

async function validarNumeroDuplicado(numero, documentoIniciador, localOrigem, dataInstauracao, processoIdAtual = null) {
    /*
    Valida se já existe um processo/procedimento com o mesmo número, documento iniciador, tipo, local e ano
    
    Args:
        numero: Número do processo/procedimento
        documentoIniciador: Tipo do documento (Portaria, Memorando Disciplinar, Feito Preliminar)
        localOrigem: Unidade onde foi instaurado (7ºBPM, 8ºBPM, etc)
        dataInstauracao: Data de instauração (YYYY-MM-DD)
        processoIdAtual: ID do processo atual (para edição)
    
    Returns:
        boolean: true se duplicado, false se válido
    */
    
    if (!numero || !documentoIniciador || !localOrigem || !dataInstauracao) {
        return false; // Campos obrigatórios serão validados em outro lugar
    }
    
    try {
        // Extrair ano da data
        const ano = dataInstauracao.substring(0, 4);
        
        // Obter tipo_detalhe atual do formulário
        const tipoGeral = document.getElementById('tipo_geral')?.value;
        let tipoDetalhe = '';
        
        if (tipoGeral === 'processo') {
            tipoDetalhe = document.getElementById('tipo_processo')?.value || '';
        } else if (tipoGeral === 'procedimento') {
            tipoDetalhe = document.getElementById('tipo_procedimento')?.value || '';
        }
        
        if (!tipoDetalhe) {
            return false; // Tipo não selecionado ainda
        }
        
        // Buscar processos existentes com mesmo número, documento, tipo, local e ano
        const processos = await eel.listar_processos()();
        
        const duplicata = processos.find(processo => 
            processo.numero === numero &&
            processo.documento_iniciador === documentoIniciador &&
            processo.tipo_detalhe === tipoDetalhe &&
            processo.local_origem === localOrigem &&
            processo.data_instauracao && 
            processo.data_instauracao.substring(0, 4) === ano &&
            processo.id !== processoIdAtual // Excluir o próprio processo na edição
        );
        
        return !!duplicata;
        
    } catch (error) {
        console.error('Erro ao validar número duplicado:', error);
        return false; // Em caso de erro, assumir que não há duplicata
    }
}

function obterTodosPmsEnvolvidos() {
    const pms = [];
    
    // PM principal (sempre obrigatório)
    const pmPrincipalId = document.getElementById('nome_pm').value;
    const pmPrincipalNome = document.getElementById('nome_pm_nome').value;
    const pmPrincipalStatus = document.getElementById('status_pm')?.value || '';
    
    if (pmPrincipalId && pmPrincipalNome) {
        pms.push({
            id: pmPrincipalId,
            nome_completo: pmPrincipalNome,
            tipo: 'operador', // Será determinado no backend
            ordem: 1,
            status_pm: pmPrincipalStatus || null
        });
    }
    
    // PMs adicionais
    pmsAdicionais.forEach((pm, index) => {
        if (pm.id) {
            pms.push({
                id: pm.id,
                nome_completo: pm.nome,
                tipo: 'operador', // Será determinado no backend
                ordem: index + 2,
                status_pm: pm.status_pm || (document.getElementById('status_pm')?.value || null)
            });
        }
    });
    
    return pms;
}

// ============================================
// FUNÇÕES DE MÁSCARA E VALIDAÇÃO
// ============================================

// Função para aplicar máscara do RGF (XX.XX.XXXX)
function aplicarMascaraRGF(input) {
    let value = input.value.replace(/\D/g, ''); // Remove não-dígitos
    
    if (value.length <= 2) {
        value = value;
    } else if (value.length <= 4) {
        value = value.substring(0, 2) + '.' + value.substring(2);
    } else {
        value = value.substring(0, 2) + '.' + value.substring(2, 4) + '.' + value.substring(4, 8);
    }
    
    input.value = value;
}

// Função para aplicar máscara do SEI (XXXX.XXXXXX/XXXX-XX)
function aplicarMascaraSEI(input) {
    let value = input.value.replace(/\D/g, ''); // Remove não-dígitos
    
    if (value.length <= 4) {
        value = value;
    } else if (value.length <= 10) {
        value = value.substring(0, 4) + '.' + value.substring(4);
    } else if (value.length <= 14) {
        value = value.substring(0, 4) + '.' + value.substring(4, 10) + '/' + value.substring(10);
    } else {
        value = value.substring(0, 4) + '.' + value.substring(4, 10) + '/' + value.substring(10, 14) + '-' + value.substring(14, 16);
    }
    
    input.value = value;
}

// Função para validar formato RGF
function validarRGF(value) {
    if (!value || value.trim() === '') return true; // Campo opcional
    const regex = /^\d{2}\.\d{2}\.\d{4}$/;
    return regex.test(value);
}

// Função para validar formato SEI
function validarSEI(value) {
    if (!value || value.trim() === '') return true; // Campo opcional
    const regex = /^\d{4}\.\d{6}\/\d{4}-\d{2}$/;
    return regex.test(value);
}

// Função para exibir erro de validação
function exibirErroValidacao(input, mensagem) {
    // Remove erro anterior se existir
    removerErroValidacao(input);
    
    input.classList.add('error');
    
    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-message';
    errorSpan.textContent = mensagem;
    
    input.parentNode.appendChild(errorSpan);
}

// Função para remover erro de validação
function removerErroValidacao(input) {
    input.classList.remove('error');
    
    const errorSpan = input.parentNode.querySelector('.error-message');
    if (errorSpan) {
        errorSpan.remove();
    }
}

// ============================================
// OUTRAS FUNÇÕES
// ============================================

// Função para voltar à página anterior
function voltarParaListagem() {
    window.location.href = 'procedure_list.html';
}

// Função para mostrar alertas
function showAlert(message, type = 'error') {
    showModalFeedback(message, type);
}

function showModalFeedback(message, type = 'error') {
    const modal = document.getElementById('modalFeedback');
    const icon = document.getElementById('modalIcon');
    const msg = document.getElementById('modalMessage');
    const btn = document.getElementById('modalCloseBtn');
    
    if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle" style="color:#38c172;"></i>';
    } else {
        icon.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#e3342f;"></i>';
    }
    
    msg.textContent = message;
    modal.style.display = 'flex';
    
    btn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Fechar modal clicando fora dele
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// ============================
// Inicialização da página
// ============================
document.addEventListener('DOMContentLoaded', async () => {
    // Detectar modo edição por querystring ?id=
    try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
            editandoProcedimento = { id };
        }
    } catch (e) { /* noop */ }

    // Carregar usuário
    await carregarUsuarioLogado();
    // Carregar municípios
    await carregarMunicipios();
    // Carregar opções de indícios
    await carregarOpcoesIndicios();

    // Ativar controles pós-resumo (remessa/julgamento/solução/indícios)
    wireNovosControlesPosResumo();

    // Se for edição, carregar dados completos e então preencher
    if (editandoProcedimento && editandoProcedimento.id) {
        await carregarProcedimentoEdicao(editandoProcedimento.id);
    }
});

async function carregarOpcoesIndicios() {
    try {
        const crimesResp = await eel.listar_crimes_contravencoes()();
        opcoesCrimes = (crimesResp?.crimes || crimesResp?.data || crimesResp?.dados || []).filter(c => c && (c.ativo === undefined || c.ativo === true));
        const rdpmResp = await eel.listar_transgressoes()();
        if (rdpmResp?.sucesso) opcoesRDPM = rdpmResp.transgressoes || rdpmResp.dados || [];
        const artResp = await eel.listar_infracoes_estatuto_art29()();
        opcoesArt29 = (artResp?.infracoes || artResp?.data || artResp?.dados || []).filter(a => a && (a.ativo === undefined || a.ativo === true));

        // Inicializa chips/autocomplete para cada grupo
        initChipsAutocomplete({
            type: 'crimes',
            inputId: 'indicios_crimes_input',
            chipsId: 'indicios_crimes_chips',
            dropdownId: 'indicios_crimes_dropdown',
            options: opcoesCrimes,
            optionText: (o) => {
                const base = `${o.tipo || ''} ${o.dispositivo_legal || ''}${o.artigo ? ' art. ' + o.artigo : ''}`.trim();
                const compl = [o.paragrafo, o.inciso, o.alinea].filter(Boolean).join(' ');
                const desc = o.descricao_artigo ? ` - ${o.descricao_artigo}` : '';
                return [base, compl].filter(Boolean).join(' ') + desc;
            },
            optionId: (o) => String(o.id)
        });
        initChipsAutocomplete({
            type: 'rdpm',
            inputId: 'indicios_rdpm_input',
            chipsId: 'indicios_rdpm_chips',
            dropdownId: 'indicios_rdpm_dropdown',
            options: opcoesRDPM,
            optionText: (o) => `Inciso ${o.inciso} - ${o.texto}`,
            optionId: (o) => String(o.id)
        });
        initChipsAutocomplete({
            type: 'art29',
            inputId: 'indicios_art29_input',
            chipsId: 'indicios_art29_chips',
            dropdownId: 'indicios_art29_dropdown',
            options: opcoesArt29,
            optionText: (o) => `Inciso ${o.inciso} - ${o.texto}`,
            optionId: (o) => String(o.id)
        });
    } catch (e) {
        console.error('Erro ao carregar opções de indícios:', e);
    }
}
// Helper para renderizar chips após prefill
function renderSelectedChips(type, chipsId) {
    const chips = document.getElementById(chipsId);
    if (!chips) return;
    chips.innerHTML = '';
    for (const [id, label] of selectedChips[type]) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = label;
        const rm = document.createElement('span');
        rm.className = 'remove';
        rm.textContent = '×';
        rm.onclick = () => {
            selectedChips[type].delete(id);
            renderSelectedChips(type, chipsId);
        };
        chip.appendChild(rm);
        chips.appendChild(chip);
    }
}


// Estado dos chips selecionados
const selectedChips = {
    crimes: new Map(), // id -> label
    rdpm: new Map(),
    art29: new Map(),
};

function initChipsAutocomplete({ type, inputId, chipsId, dropdownId, options, optionText, optionId }) {
    const input = document.getElementById(inputId);
    const chips = document.getElementById(chipsId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !chips || !dropdown) return;

    function renderChips() {
        chips.innerHTML = '';
        for (const [id, label] of selectedChips[type]) {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = label;
            const rm = document.createElement('span');
            rm.className = 'remove';
            rm.textContent = '×';
            rm.onclick = () => {
                selectedChips[type].delete(id);
                renderChips();
            };
            chip.appendChild(rm);
            chips.appendChild(chip);
        }
    }

    function openDropdown() {
        const q = (input.value || '').toLowerCase();
        const filtered = (options || []).filter(o => optionText(o).toLowerCase().includes(q));
        dropdown.innerHTML = '';
        if (filtered.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        filtered.slice(0, 100).forEach(o => {
            const id = optionId(o);
            const label = optionText(o);
            // Skip if already selected
            if (selectedChips[type].has(id)) return;
            const item = document.createElement('div');
            item.className = 'chips-item';
            item.textContent = label;
            item.onclick = () => {
                selectedChips[type].set(id, label);
                input.value = '';
                dropdown.style.display = 'none';
                renderChips();
                input.focus();
            };
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    }

    // Events
    input.addEventListener('focus', openDropdown);
    input.addEventListener('input', openDropdown);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdown.style.display = 'none';
        if (e.key === 'Backspace' && input.value === '' && selectedChips[type].size > 0) {
            // Remove last chip
            const lastKey = Array.from(selectedChips[type].keys()).pop();
            selectedChips[type].delete(lastKey);
            renderChips();
        }
    });
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== input) dropdown.style.display = 'none';
    });

    renderChips();
}

// Ligações e lógica dos novos controles após o resumo dos fatos
function wireNovosControlesPosResumo() {
    const chkRemessa = document.getElementById('chk_remessa');
    const groupRemessa = document.getElementById('group_remessa');
    const tipoGeral = document.getElementById('tipo_geral');
    const chkJulgado = document.getElementById('chk_julgado');
    const groupChkJulgado = document.getElementById('group_chk_julgado');
    const groupJulgamento = document.getElementById('group_julgamento');
    const chkSolucao = document.getElementById('chk_solucao');
    const groupSolucaoSelect = document.getElementById('group_solucao_select');
    const selSolucao = document.getElementById('solucao_tipo');
    const groupIndCats = document.getElementById('group_indicios_categorias');
    const selIndCats = document.getElementById('indicios_categorias_select');
    const hiddenIndCats = document.getElementById('indicios_categorias');
    const groupIndCrimes = document.getElementById('group_indicios_crimes');
    const groupIndTransgTipo = document.getElementById('group_indicios_transg_tipo');
    const groupIndRDPM = document.getElementById('group_indicios_rdpm');
    const groupIndArt29 = document.getElementById('group_indicios_art29');
    const selIndTransgTipo = document.getElementById('indicios_transg_tipo');
    const penalGroup = document.getElementById('group_penalidade');
    const penalDiasGroup = document.getElementById('group_penalidade_dias');

    const isProcesso = () => (tipoGeral?.value || '').toLowerCase() === 'processo';
    const isProcedimento = () => (tipoGeral?.value || '').toLowerCase() === 'procedimento';
    const getTipoProcesso = () => document.getElementById('tipo_processo')?.value || '';

    function popularOpcoesSolucao() {
        if (!selSolucao) return;
        const prev = selSolucao.value;
        selSolucao.innerHTML = '';
        const base = [{ v: '', t: 'Selecione...' }];
        const optsProc = [ { v: 'Punido', t: 'Punido' }, { v: 'Absolvido', t: 'Absolvido' }, { v: 'Arquivado', t: 'Arquivado' } ];
        const optsProced = [ { v: 'Homologado', t: 'Homologado' }, { v: 'Avocado', t: 'Avocado' }, { v: 'Arquivado', t: 'Arquivado' } ];
        const arr = isProcesso() ? optsProc : optsProced;
        [...base, ...arr].forEach(o => {
            const op = document.createElement('option');
            op.value = o.v; op.textContent = o.t; selSolucao.appendChild(op);
        });
        if ([...selSolucao.options].some(o => o.value === prev)) selSolucao.value = prev;
    }

    function popularOpcoesPenalidade() {
        const selPenalidade = document.getElementById('penalidade_tipo');
        if (!selPenalidade) return;
        
        const prev = selPenalidade.value;
        selPenalidade.innerHTML = '';
        
        // Opções base que sempre aparecem
        const opcoesBase = [
            { v: '', t: 'Selecione...' },
            { v: 'Prisao', t: 'Prisão' },
            { v: 'Detencao', t: 'Detenção' },
            { v: 'Repreensao', t: 'Repreensão' }
        ];
        
        // Adicionar opções específicas baseadas no tipo de processo
        const tipoProcesso = getTipoProcesso();
        const opcoesAdicionais = [];
        
        switch (tipoProcesso) {
            case 'PAD':
                opcoesAdicionais.push({ v: 'Licenciado_Disciplina', t: 'Licenciado a bem da disciplina' });
                break;
            case 'CD':
                opcoesAdicionais.push({ v: 'Excluido_Disciplina', t: 'Excluído a bem da disciplina' });
                break;
            case 'CJ':
                opcoesAdicionais.push({ v: 'Demitido_Exoficio', t: 'Demitido ex-ofício' });
                break;
            // PADS mantém apenas as opções base
        }
        
        // Combinar opções e adicionar ao select
        [...opcoesBase, ...opcoesAdicionais].forEach(o => {
            const op = document.createElement('option');
            op.value = o.v;
            op.textContent = o.t;
            selPenalidade.appendChild(op);
        });
        
        // Restaurar seleção anterior se ainda existir
        if ([...selPenalidade.options].some(o => o.value === prev)) {
            selPenalidade.value = prev;
        }
    }

    function refreshJulgamentoVisibility() {
        if (isProcesso() && chkRemessa?.checked) {
            groupChkJulgado.style.display = '';
            groupJulgamento.style.display = chkJulgado?.checked ? '' : 'none';
        } else {
            groupChkJulgado.style.display = 'none';
            groupJulgamento.style.display = 'none';
            if (chkJulgado) chkJulgado.checked = false;
        }
    }

    function refreshSolucaoVisibility() {
        const active = chkSolucao?.checked;
        groupSolucaoSelect.style.display = active ? '' : 'none';
        popularOpcoesSolucao();

        const sol = selSolucao.value;
        
        // Mostrar botão de adicionar indícios apenas para PROCEDIMENTO
        // Para PROCESSO, não deve aparecer o botão de indícios
        const containerBtnIndicios = document.getElementById('container_btn_indicios_solucao');
        const containerIndiciosAdicionados = document.getElementById('container_indicios_adicionados');
        
        if (containerBtnIndicios) {
            // Botão só aparece se: checkbox marcado, tipo selecionado E for procedimento
            const mostrarBotaoIndicios = active && sol !== '' && isProcedimento();
            containerBtnIndicios.style.display = mostrarBotaoIndicios ? 'block' : 'none';
        }
        
        if (containerIndiciosAdicionados) {
            // Container de indícios também só aparece para procedimentos
            containerIndiciosAdicionados.style.display = (active && isProcedimento()) ? 'block' : 'none';
        }

        const showIndCats = active && isProcedimento() && (sol === 'Homologado' || sol === 'Avocado');
        if (groupIndCats) groupIndCats.style.display = showIndCats ? '' : 'none';

        const cats = Array.from(document.getElementById('indicios_categorias_select')?.selectedOptions || []).map(o => o.value);
        const hasCrime = cats.includes('Indícios de crime comum') || cats.includes('Indícios de crime militar');
        const hasTransg = cats.includes('Indícios de transgressão disciplinar');
        if (groupIndCrimes) groupIndCrimes.style.display = showIndCats && hasCrime ? '' : 'none';
        if (groupIndTransgTipo) groupIndTransgTipo.style.display = showIndCats && hasTransg ? '' : 'none';
        const t = selIndTransgTipo?.value || 'rdpm';
        if (groupIndRDPM) groupIndRDPM.style.display = showIndCats && hasTransg && t === 'rdpm' ? '' : 'none';
        if (groupIndArt29) groupIndArt29.style.display = showIndCats && hasTransg && t === 'art29' ? '' : 'none';

        // Processo Punido => penalidade
        const showPenal = active && isProcesso() && sol === 'Punido';
        if (penalGroup) {
            penalGroup.style.display = showPenal ? '' : 'none';
            // Atualizar opções de penalidade quando mostrar o campo
            if (showPenal) {
                popularOpcoesPenalidade();
            }
        }
        const pSel = document.getElementById('penalidade_tipo')?.value || '';
        // Dias apenas para Prisao/Detencao
        if (penalDiasGroup) penalDiasGroup.style.display = showPenal && (pSel === 'Prisao' || pSel === 'Detencao') ? '' : 'none';
    }

    // Eventos
    tipoGeral?.addEventListener('change', () => {
        popularOpcoesSolucao();
        refreshJulgamentoVisibility();
        refreshSolucaoVisibility();
    }, { passive: true });
    
    // Adicionar evento para atualizar penalidades quando o tipo de processo mudar
    document.getElementById('tipo_processo')?.addEventListener('change', () => {
        // Se o campo de penalidade estiver visível, atualizar as opções
        const showPenal = chkSolucao?.checked && isProcesso() && selSolucao?.value === 'Punido';
        if (showPenal) {
            popularOpcoesPenalidade();
        }
    });
    chkRemessa?.addEventListener('change', () => {
        groupRemessa.style.display = chkRemessa.checked ? '' : 'none';
        refreshJulgamentoVisibility();
    });
    chkJulgado?.addEventListener('change', refreshJulgamentoVisibility);
    chkSolucao?.addEventListener('change', refreshSolucaoVisibility);
    selSolucao?.addEventListener('change', refreshSolucaoVisibility);
    selIndTransgTipo?.addEventListener('change', refreshSolucaoVisibility);
    document.getElementById('penalidade_tipo')?.addEventListener('change', refreshSolucaoVisibility);
    // sincronizar categorias selecionadas no hidden
    document.getElementById('indicios_categorias_select')?.addEventListener('change', () => {
        const vals = Array.from(document.getElementById('indicios_categorias_select').selectedOptions).map(o => o.value);
        hiddenIndCats.value = JSON.stringify(vals);
        refreshSolucaoVisibility();
    });

    // Event listener para o botão de adicionar indícios
    document.getElementById('btnAdicionarIndicios')?.addEventListener('click', () => {
        console.log('Botão de adicionar indícios clicado');
        if (window.modalIndiciosSolucao) {
            modalIndiciosSolucao.abrir();
        } else {
            console.error('modalIndiciosSolucao não encontrado na janela global');
        }
    });

    // Remove antiga lógica de filtro de selects

    // Estado inicial
    groupRemessa.style.display = chkRemessa?.checked ? '' : 'none';
    refreshJulgamentoVisibility();
    popularOpcoesSolucao();
    groupSolucaoSelect.style.display = chkSolucao?.checked ? '' : 'none';
    refreshSolucaoVisibility();
}

function popularSelect(selectId, lista, mapFn) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    (lista || []).forEach((item) => {
        const mapped = mapFn(item);
        const opt = document.createElement('option');
        opt.value = String(mapped.value);
        opt.textContent = mapped.text;
        sel.appendChild(opt);
    });
}

// Removida versão antiga de preencherFormularioEdicao(id) baseada em ID direto.

// Loader central para modo edição que busca no backend e delega ao preenchimento por objeto
async function carregarProcedimentoEdicao(id) {
    try {
        const procedimento = await eel.obter_processo(id)();
        if (!procedimento) {
            showAlert('Registro não encontrado ou inativo.', 'error');
            setTimeout(voltarParaListagem, 1500);
            return;
        }
        await preencherFormularioEdicao(procedimento); // usa versão por objeto (definida mais abaixo)
        // Ajustar UI (título e botão)
        const titulo = document.querySelector('h2');
        if (titulo) titulo.textContent = 'Editar Registro';
        const submitBtn = document.querySelector('#processForm button[type="submit"]');
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
    } catch (e) {
        console.error('Erro ao carregar procedimento para edição:', e);
        showAlert('Erro ao carregar dados para edição.', 'error');
    }
}

function marcarSelecoesIndicios(selectId, itens, getId) {
    const sel = document.getElementById(selectId);
    if (!sel || !itens) return;
    const ids = new Set((itens || []).map(getId));
    Array.from(sel.options).forEach(opt => {
        opt.selected = ids.has(String(opt.value));
    });
}

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

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    // Criar modal se não existir
    let modal = document.getElementById('confirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal-feedback';
        // Adicionar estilos inline para garantir o posicionamento correto
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0,0,0,0.35) !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 10000 !important;
        `;
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
    
    // Mostrar modal com estilos inline para garantir centralização
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    
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

// Função de logout
async function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                await eel.fazer_logout()();
                showAlert('Logout realizado com sucesso! Redirecionando...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            } catch (error) {
                console.error('Erro no logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
            }
        }
    );
}

async function loadResponsaveis() {
    try {
        const users = await safeListarTodosUsuarios();
        const responsavelSelect = document.getElementById('responsavel');
        const escrivaoSelect = document.getElementById('escrivao_id');

        // Adicionar uma opção padrão "Selecione"
        const defaultOption = '<option value="">Selecione...</option>';

        const userOptions = users.map(user => `<option value="${user.id}" data-type="${user.tipo}">${user.nome}</option>`).join('');
        
        responsavelSelect.innerHTML = defaultOption + userOptions;
        escrivaoSelect.innerHTML = defaultOption + userOptions;

    } catch (error) {
        console.error('Erro ao carregar responsáveis/escrivães:', error);
    }
}

// Função para verificar se está editando um procedimento
async function verificarEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    const procedimentoId = urlParams.get('id');
    
    console.log('🔍 Verificando edição. ID:', procedimentoId);
    
    if (procedimentoId) {
        try {
            console.log('📞 Chamando eel.obter_processo...');
            const procedimento = await eel.obter_processo(procedimentoId)();
            console.log('📋 Resultado da chamada:', procedimento);
            
            if (procedimento) {
                console.log('✅ Procedimento carregado, iniciando preenchimento...');
                editandoProcedimento = procedimento;
                modoEdicaoId = procedimentoId; // Definir modo de edição
                await preencherFormularioEdicao(procedimento);
                
                // Atualizar título da página
                const titulo = document.querySelector('h2');
                if (titulo) {
                    titulo.textContent = 'Editar Procedimento';
                }
                
                // Atualizar texto do botão
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
                }
                
                console.log('✅ Edição configurada com sucesso!');
            } else {
                console.log('❌ Procedimento não encontrado');
                showAlert('Procedimento não encontrado!', 'error');
                setTimeout(() => {
                    window.location.href = 'procedure_list.html';
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar procedimento:', error);
            console.error('❌ Stack trace:', error.stack);
            showAlert('Erro ao carregar dados do procedimento!', 'error');
        }
    }
}

// ============================================
// FUNÇÃO PARA EXIBIR INDÍCIOS GLOBAIS (ANTIGOS)
// ============================================

function exibirIndiciosGlobais(indicios) {
    console.log('📋 Exibindo indícios globais:', indicios);
    
    const container = document.getElementById('lista_indicios_adicionados');
    if (!container) {
        console.warn('❌ Container lista_indicios_adicionados não encontrado');
        return;
    }
    
    // Limpar container primeiro (mas só a parte global)
    const existingGlobal = container.querySelector('.indicio-card-global');
    if (existingGlobal) {
        existingGlobal.remove();
    }
    
    if (!indicios || (!indicios.crimes?.length && !indicios.rdpm?.length && !indicios.art29?.length)) {
        console.log('ℹ️ Nenhum indício global encontrado');
        return;
    }
    
    // Criar card para indícios globais
    const indiciosCard = document.createElement('div');
    indiciosCard.className = 'indicio-card-global';
    indiciosCard.style.cssText = `
        border: 1px solid #007bff;
        border-radius: 0.375rem;
        padding: 1rem;
        margin-bottom: 1rem;
        background: #f8f9ff;
        border-left: 4px solid #007bff;
    `;
    
    let conteudoHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
                <div style="margin-bottom: 0.5rem;">
                    <strong style="color: #007bff;"><i class="fas fa-balance-scale"></i> Indícios do Procedimento (Global)</strong>
                </div>
    `;
    
    // Adicionar crimes se existirem
    if (indicios.crimes && indicios.crimes.length > 0) {
        conteudoHTML += `
                <div style="margin-bottom: 0.5rem;">
                    <strong>Crimes/Contravenções:</strong>
                    <ul style="margin: 0.25rem 0 0 1.5rem;">
        `;
        indicios.crimes.forEach(crime => {
            const base = `${crime.tipo || ''} ${crime.dispositivo_legal || ''}${crime.artigo ? ' art. ' + crime.artigo : ''}`.trim();
            const compl = [crime.paragrafo, crime.inciso, crime.alinea].filter(Boolean).join(' ');
            const desc = crime.descricao_artigo ? ` - ${crime.descricao_artigo}` : '';
            const label = [base, compl].filter(Boolean).join(' ') + desc;
            conteudoHTML += `<li>${label}</li>`;
        });
        conteudoHTML += `</ul></div>`;
    }
    
    // Adicionar RDPM se existirem
    if (indicios.rdpm && indicios.rdpm.length > 0) {
        conteudoHTML += `
                <div style="margin-bottom: 0.5rem;">
                    <strong>Transgressões RDPM:</strong>
                    <ul style="margin: 0.25rem 0 0 1.5rem;">
        `;
        indicios.rdpm.forEach(trans => {
            conteudoHTML += `<li>Inciso ${trans.inciso} - ${trans.texto}</li>`;
        });
        conteudoHTML += `</ul></div>`;
    }
    
    // Adicionar Art. 29 se existirem
    if (indicios.art29 && indicios.art29.length > 0) {
        conteudoHTML += `
                <div style="margin-bottom: 0.5rem;">
                    <strong>Infrações Art. 29:</strong>
                    <ul style="margin: 0.25rem 0 0 1.5rem;">
        `;
        indicios.art29.forEach(infracao => {
            conteudoHTML += `<li>Inciso ${infracao.inciso} - ${infracao.texto}</li>`;
        });
        conteudoHTML += `</ul></div>`;
    }
    
    conteudoHTML += `
            </div>
            <div style="margin-left: 1rem;">
                <span style="
                    background: #007bff;
                    color: white;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.8rem;
                    font-weight: bold;
                ">GLOBAL</span>
            </div>
        </div>
    `;
    
    indiciosCard.innerHTML = conteudoHTML;
    container.insertBefore(indiciosCard, container.firstChild); // Adicionar no início
    
    console.log('✅ Indícios globais exibidos no container');
}

// Função para preencher formulário com dados do procedimento
async function preencherFormularioEdicao(procedimento) {
    console.log('🔍 Iniciando preenchimento do formulário de edição...');
    console.log('📋 Dados do procedimento:', procedimento);
    
    try {
        // Preencher campos básicos
        document.getElementById('numero_rgf').value = procedimento.numero_rgf || '';
        document.getElementById('tipo_geral').value = procedimento.tipo_geral || '';
        document.getElementById('documento_iniciador').value = procedimento.documento_iniciador || '';
        document.getElementById('processo_sei').value = procedimento.processo_sei || '';

        // Novos campos
        if (document.getElementById('local_origem')) document.getElementById('local_origem').value = procedimento.local_origem || '';
        if (document.getElementById('local_fatos')) document.getElementById('local_fatos').value = procedimento.local_fatos || '';
        if (document.getElementById('data_instauracao')) document.getElementById('data_instauracao').value = procedimento.data_instauracao || '';
        if (document.getElementById('data_recebimento')) document.getElementById('data_recebimento').value = procedimento.data_recebimento || '';
        if (document.getElementById('status_pm')) document.getElementById('status_pm').value = procedimento.status_pm || '';
        if (document.getElementById('nome_vitima')) document.getElementById('nome_vitima').value = procedimento.nome_vitima || '';
        if (document.getElementById('natureza_processo')) document.getElementById('natureza_processo').value = procedimento.natureza_processo || '';
        if (document.getElementById('natureza_procedimento')) document.getElementById('natureza_procedimento').value = procedimento.natureza_procedimento || '';
        if (document.getElementById('resumo_fatos')) document.getElementById('resumo_fatos').value = procedimento.resumo_fatos || '';
        if (document.getElementById('numero_portaria')) document.getElementById('numero_portaria').value = procedimento.numero_portaria || '';
        if (document.getElementById('numero_memorando')) document.getElementById('numero_memorando').value = procedimento.numero_memorando || '';
        if (document.getElementById('numero_feito')) document.getElementById('numero_feito').value = procedimento.numero_feito || '';
        
        console.log('✅ Campos básicos preenchidos');
        
        // Lógica do número de controle na edição
        if (procedimento.numero_controle) {
            // Verificar se numero_controle é diferente do número do documento
            let numeroDocumento = '';
            if (procedimento.documento_iniciador === 'Portaria') {
                numeroDocumento = procedimento.numero_portaria;
            } else if (procedimento.documento_iniciador === 'Memorando Disciplinar') {
                numeroDocumento = procedimento.numero_memorando;
            } else if (procedimento.documento_iniciador === 'Feito Preliminar') {
                numeroDocumento = procedimento.numero_feito;
            }
            
            if (procedimento.numero_controle !== numeroDocumento) {
                // Número de controle é diferente, marcar checkbox e preencher campo
                if (document.getElementById('numero_controle_diferente')) {
                    document.getElementById('numero_controle_diferente').checked = true;
                }
                if (document.getElementById('numero_controle')) {
                    document.getElementById('numero_controle').value = procedimento.numero_controle;
                }
            }
        }
        
        console.log('✅ Lógica de número de controle processada');
        
        // Lógica dos campos de conclusão na edição
        if (procedimento.concluido !== undefined) {
            const concluidoCheckbox = document.getElementById('concluido');
            if (concluidoCheckbox) {
                concluidoCheckbox.checked = procedimento.concluido === 1 || procedimento.concluido === true;
            }
        }
        
        if (procedimento.data_conclusao) {
            const dataConclusao = document.getElementById('data_conclusao');
            if (dataConclusao) {
                dataConclusao.value = procedimento.data_conclusao;
            }
        }
        
        if (procedimento.solucao_final) {
            const solucaoFinal = document.getElementById('solucao_final');
            if (solucaoFinal) {
                solucaoFinal.value = procedimento.solucao_final;
            }
        }
        
        console.log('✅ Campos de conclusão processados');
        
        // Preencher campos de responsável com formato completo
        if (procedimento.responsavel_id) {
            document.getElementById('responsavel_id').value = procedimento.responsavel_id || '';
            // Usar o formato completo se disponível, senão apenas o nome
            const responsavelTexto = procedimento.responsavel_completo || procedimento.responsavel_nome || '';
            document.getElementById('responsavel_nome').value = responsavelTexto;
        }

        // Preencher campos de escrivão com formato completo
        if (procedimento.escrivao_id) {
            document.getElementById('escrivao_id').value = procedimento.escrivao_id || '';
            document.getElementById('escrivao_nome').value = procedimento.escrivao_completo || '';
        }

        // Preencher campos de PM envolvido com formato completo
        if (procedimento.tipo_geral === 'procedimento' && procedimento.pms_envolvidos && procedimento.pms_envolvidos.length > 0) {
            // Para procedimentos com múltiplos PMs
            const primeiroP = procedimento.pms_envolvidos[0];
            document.getElementById('nome_pm').value = primeiroP.id || '';
            document.getElementById('nome_pm_nome').value = primeiroP.nome_completo || '';
            // Ajustar o status geral para refletir o status do primeiro PM
            if (primeiroP.status_pm && document.getElementById('status_pm')) {
                document.getElementById('status_pm').value = primeiroP.status_pm;
            }
            // Preencher status individual (se existir)
            // Status do PM principal herda do status geral selecionado
            
            // Limpar PMs adicionais existentes
            pmsAdicionais = [];
            document.getElementById('pms_adicionais_container').innerHTML = '';
            
            // Adicionar PMs a partir do segundo (o primeiro já está no campo principal)
            for (let i = 1; i < procedimento.pms_envolvidos.length; i++) {
                const pm = procedimento.pms_envolvidos[i];
                adicionarPmAdicional();
                
                // Preencher o campo recém-criado
                const index = pmsAdicionais.length - 1;
                document.getElementById(`pm_adicional_nome_${index}`).value = pm.nome_completo;
                document.getElementById(`pm_adicional_id_${index}`).value = pm.id;
                pmsAdicionais[index].id = pm.id;
                pmsAdicionais[index].nome = pm.nome_completo;
                pmsAdicionais[index].status_pm = pm.status_pm || '';
                // Preencher select de status do PM adicional
                const statusSelect = document.getElementById(`pm_adicional_status_${index}`);
                if (statusSelect) statusSelect.value = pm.status_pm || '';
            }
        } else if (procedimento.nome_pm_id) {
            // Para processos com PM único
            document.getElementById('nome_pm').value = procedimento.nome_pm_id || '';
            document.getElementById('nome_pm_nome').value = procedimento.pm_completo || '';
        }
        
        console.log('✅ Campos de usuários preenchidos');
        
        // Carregar indícios por PM na edição
        indiciosPorPM = {};
        if (procedimento.pms_envolvidos && procedimento.pms_envolvidos.length > 0) {
            console.log('🔍 Carregando indícios por PM para edição...');
            
            procedimento.pms_envolvidos.forEach((pm, index) => {
                if (pm.indicios) {
                    console.log(`📋 PM ${pm.nome_completo} tem indícios:`, pm.indicios);
                    indiciosPorPM[pm.id] = {
                        categoria: pm.indicios.categoria || '',
                        crimes: pm.indicios.crimes || [],
                        rdpm: pm.indicios.rdpm || [],
                        art29: pm.indicios.art29 || []
                    };
                    
                    // Mostrar indicador visual nos botões de indícios se houver dados
                    const totalIndicios = (pm.indicios.crimes?.length || 0) + 
                                         (pm.indicios.rdpm?.length || 0) + 
                                         (pm.indicios.art29?.length || 0);
                    
                    if (totalIndicios > 0) {
                        console.log(`✅ PM ${pm.nome_completo} tem ${totalIndicios} indícios carregados`);
                    }
                } else {
                    console.log(`ℹ️ PM ${pm.nome_completo} não tem indícios`);
                }
            });
            
            console.log('✅ Indícios por PM carregados:', indiciosPorPM);
        }
        
        // Se for procedimento e tiver PMs, mostrar botão de indícios e atualizar visualização
        if (procedimento.tipo_geral === 'procedimento' && procedimento.pms_envolvidos && procedimento.pms_envolvidos.length > 0) {
            toggleBotaoIndiciosPmPrincipal(true);
            // Aguardar carregar campos e então atualizar visualização dos indícios
            setTimeout(() => {
                atualizarVisualizacaoPMsEnvolvidos();
            }, 500);
        }

        // Aguardar um pouco para garantir que os campos estejam carregados
        await new Promise(resolve => setTimeout(resolve, 100));

        // Disparar evento change para mostrar campos condicionais
        const tipoGeralSelect = document.getElementById('tipo_geral');
        tipoGeralSelect.dispatchEvent(new Event('change'));

        // Aguardar mais um pouco para os campos condicionais aparecerem
        await new Promise(resolve => setTimeout(resolve, 100));

        // Preencher tipo específico baseado no tipo_geral
        if (procedimento.tipo_geral === 'processo') {
            document.getElementById('tipo_processo').value = procedimento.tipo_detalhe || '';
        } else if (procedimento.tipo_geral === 'procedimento') {
            document.getElementById('tipo_procedimento').value = procedimento.tipo_detalhe || '';
        }
        
        // Aguardar mais um pouco e disparar change nos status para mostrar botões corretos
        await new Promise(resolve => setTimeout(resolve, 100));
        if (document.getElementById('status_pm')) {
            document.getElementById('status_pm').dispatchEvent(new Event('change'));
        }

        // Remover a chamada para updateFormVisibility que estava causando erro
        // A visibilidade dos campos já foi configurada pelos eventos change acima
        
        // Carregar transgressões selecionadas para edição
        if (procedimento.transgressoes_selecionadas && procedimento.transgressoes_selecionadas.length > 0) {
            console.log('🏷️ Carregando transgressões para edição:', procedimento.transgressoes_selecionadas);
            
            // Limpar array global e resetar interface
            transgressoesSelecionadas = [];
            
            // Adicionar cada transgressão ao array global (novo formato com suporte a Art. 29)
            procedimento.transgressoes_selecionadas.forEach(transgressao => {
                if (transgressao.tipo === 'estatuto') {
                    // Infração Art. 29 com analogia RDPM
                    transgressoesSelecionadas.push({
                        id: transgressao.id,
                        inciso: transgressao.inciso,
                        texto: transgressao.texto,
                        tipo: 'estatuto',
                        rdmp_analogia: transgressao.rdmp_analogia || {}
                    });
                } else {
                    // Infração RDPM (formato novo com natureza ou formato antigo)
                    transgressoesSelecionadas.push({
                        id: transgressao.id,
                        inciso: transgressao.inciso,
                        texto: transgressao.texto,
                        natureza: transgressao.natureza || 'leve', // fallback para dados antigos
                        tipo: 'rdpm'
                    });
                }
            });
            
            // Atualizar a interface
            atualizarTransgressoesSelecionadas();
            
            console.log('✅ Transgressões carregadas na edição:', transgressoesSelecionadas);
        }

        // ==========================
        // Campos pós-resumo (remessa / julgamento / solução / penalidade / indícios categorias)
        // ==========================
        try {
            // Remessa
            if (procedimento.data_remessa_encarregado) {
                const chkRemessa = document.getElementById('chk_remessa');
                const dtRemessa = document.getElementById('data_remessa_encarregado');
                if (chkRemessa) chkRemessa.checked = true;
                if (dtRemessa) dtRemessa.value = procedimento.data_remessa_encarregado;
                if (chkRemessa) chkRemessa.dispatchEvent(new Event('change'));
            }
            // Julgamento
            if (procedimento.data_julgamento) {
                const chkJulgado = document.getElementById('chk_julgado');
                const dtJulg = document.getElementById('data_julgamento');
                // Para julgamento aparecer precisa da remessa marcada (já tratada acima se houver)
                if (chkJulgado) chkJulgado.checked = true;
                if (dtJulg) dtJulg.value = procedimento.data_julgamento;
                if (chkJulgado) chkJulgado.dispatchEvent(new Event('change'));
            }
            // Solução
            if (procedimento.solucao_tipo) {
                const chkSolucao = document.getElementById('chk_solucao');
                const selSolucao = document.getElementById('solucao_tipo');
                if (chkSolucao) chkSolucao.checked = true;
                if (chkSolucao) chkSolucao.dispatchEvent(new Event('change')); // revela select e repopula opções
                // Pequeno delay para garantir opções populadas conforme tipo (processo/procedimento)
                await new Promise(r => setTimeout(r, 50));
                if (selSolucao) {
                    selSolucao.value = procedimento.solucao_tipo;
                    selSolucao.dispatchEvent(new Event('change'));
                }
                // Penalidade (apenas se processo Punido)
                if (procedimento.penalidade_tipo || procedimento.penalidade_dias != null) {
                    let pen = procedimento.penalidade_tipo || '';
                    if (pen === 'Prisão') pen = 'Prisao';
                    if (pen === 'Detenção') pen = 'Detencao';
                    if (pen === 'Repreensão') pen = 'Repreensao';
                    const penSel = document.getElementById('penalidade_tipo');
                    const penDias = document.getElementById('penalidade_dias');
                    if (penSel) penSel.value = pen;
                    if (penSel) penSel.dispatchEvent(new Event('change'));
                    if (penDias && (pen === 'Prisao' || pen === 'Detencao')) {
                        penDias.value = procedimento.penalidade_dias != null ? String(procedimento.penalidade_dias) : '';
                    }
                }
                // Categorias de indícios
                if (procedimento.indicios_categorias) {
                    const selCats = document.getElementById('indicios_categorias_select');
                    const hidCats = document.getElementById('indicios_categorias');
                    let arr = [];
                    try {
                        const parsed = JSON.parse(procedimento.indicios_categorias);
                        if (Array.isArray(parsed)) arr = parsed;
                    } catch { arr = [procedimento.indicios_categorias]; }
                    if (selCats) {
                        const setVals = new Set(arr);
                        Array.from(selCats.options).forEach(o => { o.selected = setVals.has(o.value); });
                    }
                    if (hidCats) hidCats.value = JSON.stringify(arr);
                    // Disparar change para atualizar visibilidade dos grupos de indícios
                    if (selCats) selCats.dispatchEvent(new Event('change'));
                }
            }
        } catch (eInner) {
            console.warn('Aviso ao preencher campos de solução/remessa:', eInner);
        }

        // ==========================
        // Pré-preencher chips de Indícios (Crimes, RDPM, Art.29)
        // ==========================
        try {
            console.log('🔍 Verificando indícios no procedimento:', procedimento.indicios);
            
            if (procedimento.indicios) {
                // Limpar estados anteriores caso já tenha aberto outra edição sem recarregar página
                selectedChips.crimes.clear();
                selectedChips.rdpm.clear();
                selectedChips.art29.clear();

                console.log('📋 Carregando indícios globais:', {
                    crimes: procedimento.indicios.crimes?.length || 0,
                    rdpm: procedimento.indicios.rdpm?.length || 0,
                    art29: procedimento.indicios.art29?.length || 0
                });

                (procedimento.indicios.crimes || []).forEach(it => {
                    const base = `${it.tipo || ''} ${it.dispositivo_legal || ''}${it.artigo ? ' art. ' + it.artigo : ''}`.trim();
                    const compl = [it.paragrafo, it.inciso, it.alinea].filter(Boolean).join(' ');
                    const desc = it.descricao_artigo ? ` - ${it.descricao_artigo}` : '';
                    const label = [base, compl].filter(Boolean).join(' ') + desc;
                    selectedChips.crimes.set(String(it.id), label);
                    console.log('➕ Crime adicionado:', label);
                });
                (procedimento.indicios.rdpm || []).forEach(it => {
                    const label = `Inciso ${it.inciso} - ${it.texto}`;
                    selectedChips.rdpm.set(String(it.id), label);
                    console.log('➕ RDPM adicionado:', label);
                });
                (procedimento.indicios.art29 || []).forEach(it => {
                    const label = `Inciso ${it.inciso} - ${it.texto}`;
                    selectedChips.art29.set(String(it.id), label);
                    console.log('➕ Art.29 adicionado:', label);
                });

                // Renderizar visualmente
                renderSelectedChips('crimes', 'indicios_crimes_chips');
                renderSelectedChips('rdpm', 'indicios_rdpm_chips');
                renderSelectedChips('art29', 'indicios_art29_chips');

                console.log('✅ Chips renderizados. Total de indícios:', {
                    crimes: selectedChips.crimes.size,
                    rdpm: selectedChips.rdpm.size,
                    art29: selectedChips.art29.size
                });

                // Ajustar automaticamente o seletor de tipo de transgressão conforme dados
                const selTipoTransg = document.getElementById('indicios_transg_tipo');
                if (selTipoTransg) {
                    if (selectedChips.art29.size > 0 && selectedChips.rdpm.size === 0) {
                        selTipoTransg.value = 'art29';
                        selTipoTransg.dispatchEvent(new Event('change'));
                    } else if (selectedChips.rdpm.size > 0 && selectedChips.art29.size === 0) {
                        selTipoTransg.value = 'rdpm';
                        selTipoTransg.dispatchEvent(new Event('change'));
                    } else if (selectedChips.art29.size > 0 && selectedChips.rdpm.size > 0) {
                        // Se ambos existem, manter valor atual; se vazio, prioriza RDPM
                        if (!selTipoTransg.value) {
                            selTipoTransg.value = 'rdpm';
                            selTipoTransg.dispatchEvent(new Event('change'));
                        } else {
                            selTipoTransg.dispatchEvent(new Event('change'));
                        }
                    }
                }
            } else {
                console.log('ℹ️ Nenhum indício global encontrado no procedimento');
            }
        } catch (eChips) {
            console.warn('Falha ao preencher chips de indícios:', eChips);
        }
        
        // ==============================
        // Atualizar visualização dos indícios por PM na lista "Indícios Cadastrados"
        // ==============================
        try {
            console.log('🔍 Verificando modal de indícios e dados por PM:', {
                modalExists: !!window.modalIndiciosSolucao,
                indiciosPorPMCount: Object.keys(indiciosPorPM).length,
                indiciosPorPMLocal: indiciosPorPM,
                indiciosPorPMBackend: procedimento.indicios_por_pm || {}
            });
            
            // Exibir indícios antigos (globais) se existirem
            exibirIndiciosGlobais(procedimento.indicios);
            
            // Carregar indícios por PM vindos do backend primeiro
            if (procedimento.indicios_por_pm && Object.keys(procedimento.indicios_por_pm).length > 0) {
                console.log('📋 Carregando indícios por PM do backend...');
                indiciosPorPM = procedimento.indicios_por_pm; // Atualizar variável global
            }
            
            // Exibir indícios por PM se existirem
            if (window.modalIndiciosSolucao && Object.keys(indiciosPorPM).length > 0) {
                console.log('📋 Atualizando lista de indícios cadastrados...');
                
                // Converter indiciosPorPM para o formato esperado pelo modal
                const indiciosParaLista = [];
                
                for (const [pmId, dadosIndicios] of Object.entries(indiciosPorPM)) {
                    // Buscar nome do PM pelos dados carregados
                    let pmNome = 'PM não identificado';
                    if (procedimento.pms_envolvidos) {
                        const pm = procedimento.pms_envolvidos.find(p => p.id == pmId);
                        pmNome = pm ? pm.nome_completo : `PM ID: ${pmId}`;
                    }
                    
                    // Só adicionar se tiver pelo menos uma categoria ou indícios
                    const temCategorias = dadosIndicios.categoria && dadosIndicios.categoria.trim();
                    const temCrimes = dadosIndicios.crimes && dadosIndicios.crimes.length > 0;
                    const temRdpm = dadosIndicios.rdpm && dadosIndicios.rdpm.length > 0;
                    const temArt29 = dadosIndicios.art29 && dadosIndicios.art29.length > 0;
                    
                    console.log(`🔍 PM ${pmNome} (${pmId}):`, {
                        temCategorias, temCrimes, temRdpm, temArt29,
                        categoria: dadosIndicios.categoria,
                        crimes: dadosIndicios.crimes?.length || 0,
                        rdpm: dadosIndicios.rdpm?.length || 0,
                        art29: dadosIndicios.art29?.length || 0
                    });
                    
                    if (temCategorias || temCrimes || temRdpm || temArt29) {
                        // Preparar crimes para exibição
                        const crimesFormatados = (dadosIndicios.crimes || []).map(crime => {
                            const base = `${crime.tipo || ''} ${crime.dispositivo_legal || ''}${crime.artigo ? ' art. ' + crime.artigo : ''}`.trim();
                            const compl = [crime.paragrafo, crime.inciso, crime.alinea].filter(Boolean).join(' ');
                            const desc = crime.descricao_artigo ? ` - ${crime.descricao_artigo}` : '';
                            const label = [base, compl].filter(Boolean).join(' ') + desc;
                            return {
                                id: crime.id,
                                nome: label
                            };
                        });

                        // Preparar transgressões (RDPM + Art. 29) para exibição
                        const transgressoesFormatadas = [];
                        
                        // Adicionar RDPM
                        (dadosIndicios.rdpm || []).forEach(rdpm => {
                            transgressoesFormatadas.push({
                                id: rdpm.id,
                                nome: `Inciso ${rdpm.inciso} - ${rdpm.texto}`,
                                tipo: 'rdpm'
                            });
                        });
                        
                        // Adicionar Art. 29
                        (dadosIndicios.art29 || []).forEach(art29 => {
                            transgressoesFormatadas.push({
                                id: art29.id,
                                nome: `Inciso ${art29.inciso} - ${art29.texto}`,
                                tipo: 'art29'
                            });
                        });

                        const indicioItem = {
                            pmId: pmId,
                            pmNome: pmNome,
                            categorias: temCategorias ? [dadosIndicios.categoria] : [],
                            crimes: crimesFormatados,
                            transgressoes: transgressoesFormatadas,
                            // Manter dados originais para compatibilidade
                            rdpm: dadosIndicios.rdpm || [],
                            art29: dadosIndicios.art29 || []
                        };
                        
                        indiciosParaLista.push(indicioItem);
                        console.log('➕ Indício adicionado à lista:', indicioItem);
                    }
                }
                
                // Atualizar a lista no modal se houver indícios
                if (indiciosParaLista.length > 0) {
                    window.modalIndiciosSolucao.indiciosAdicionados = indiciosParaLista;
                    window.modalIndiciosSolucao.atualizarListaIndicios();
                    console.log(`✅ ${indiciosParaLista.length} indícios de PMs adicionados à lista`);
                } else {
                    // Limpar lista se não houver indícios
                    window.modalIndiciosSolucao.indiciosAdicionados = [];
                    window.modalIndiciosSolucao.atualizarListaIndicios();
                    console.log('ℹ️ Lista de indícios limpa (nenhum indício encontrado)');
                }
            } else {
                console.log('ℹ️ Modal não disponível ou nenhum indício por PM encontrado');
            }
        } catch (eIndiciosList) {
            console.warn('Aviso ao atualizar lista de indícios:', eIndiciosList);
        }
        
        console.log('✅ Preenchimento do formulário concluído com sucesso');
    } catch (error) {
        console.error('❌ Erro durante o preenchimento do formulário:', error);
        throw error; // Re-lançar o erro para que seja capturado pelo try-catch da função verificarEdicao
    }
}

// ============================================
// FUNÇÕES DE VISIBILIDADE DO FORMULÁRIO (ESCOPO GLOBAL)
// ============================================

// Mapeamento de todos os grupos de campos que podem ser ocultados/exibidos
const fieldGroups = {
    tipoProcedimento: document.getElementById('group_tipo_procedimento'),
    tipoProcesso: document.getElementById('group_tipo_processo'),
    escrivao: document.getElementById('group_escrivao'),
    numeroPortaria: document.getElementById('group_numero_portaria'),
    numeroMemorando: document.getElementById('group_numero_memorando'),
    numeroFeito: document.getElementById('group_numero_feito'),
    checkboxControle: document.getElementById('group_checkbox_controle'),
    numeroControle: document.getElementById('group_numero_controle'),
    nomePm: document.getElementById('group_nome_pm'),
    nomeVitima: document.getElementById('group_nome_vitima'),
    // naturezaProcesso: document.getElementById('group_natureza_processo'), // Removido
    naturezaProcedimento: document.getElementById('group_natureza_procedimento'),
    infracao: document.getElementById('group_infracao'),
};

// Mapeamento dos campos de input/select
const fields = {
    tipoGeral: document.getElementById('tipo_geral'),
    tipoProcedimento: document.getElementById('tipo_procedimento'),
    tipoProcesso: document.getElementById('tipo_processo'),
    documentoIniciador: document.getElementById('documento_iniciador'),
    statusPm: document.getElementById('status_pm'),
    labelNomePm: document.getElementById('label_nome_pm'),
    // naturezaProcesso: document.getElementById('natureza_processo'), // Removido
    numeroControleDiferente: document.getElementById('numero_controle_diferente'),
    labelControleDiferente: document.getElementById('label_controle_diferente'),
    numeroControle: document.getElementById('numero_controle'),
    labelNumeroControle: document.getElementById('label_numero_controle'),
    helpNumeroControle: document.getElementById('help_numero_controle'),
};

// Função para mostrar/ocultar um grupo e gerenciar o atributo 'required'
function toggleGroup(group, show) {
    if (group) {
        group.style.display = show ? 'block' : 'none';
        const inputs = group.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (show) {
                // Apenas adiciona required se o campo já o tiver no HTML
                if (input.hasAttribute('data-required')) {
                   input.setAttribute('required', 'required');
                }
            } else {
                input.removeAttribute('required');
                // Opcional: limpar valor ao ocultar para evitar envio de dados ocultos
                if (input.type !== 'checkbox' && input.type !== 'radio') {
                    input.value = '';
                }
            }
        });
    }
}

// Função principal que atualiza a visibilidade de todo o formulário
function updateFormVisibility() {
    console.log('🔄 updateFormVisibility chamada');
    const tipoGeral = fields.tipoGeral.value;
    const tipoProcedimento = fields.tipoProcedimento ? fields.tipoProcedimento.value : '';
    const tipoProcesso = fields.tipoProcesso ? fields.tipoProcesso.value : '';
    const documentoIniciador = fields.documentoIniciador.value;
    const statusPm = fields.statusPm.value;

    // 1. Lógica para Tipo de Cadastro (Processo vs Procedimento)
    toggleGroup(fieldGroups.tipoProcesso, tipoGeral === 'processo');
    toggleGroup(fieldGroups.tipoProcedimento, tipoGeral === 'procedimento');
    
    // Lógica para Nome da Vítima/Ofendido (apenas para procedimento)
    const showNomeVitima = tipoGeral === 'procedimento';
    toggleGroup(fieldGroups.nomeVitima, showNomeVitima);

    // Lógica para Escrivão (se Procedimento for IPM)
    toggleGroup(fieldGroups.escrivao, tipoGeral === 'procedimento' && tipoProcedimento === 'IPM');

    // 2. Lógica para Natureza (depende do Tipo de Cadastro e Tipo de Processo)
    // Não mostrar mais o campo de natureza processo para PADS
    // const showNaturezaProcesso = tipoGeral === 'processo' && tipoProcesso === 'PADS';
    const showNaturezaProcedimento = tipoGeral === 'procedimento';
    // toggleGroup(fieldGroups.naturezaProcesso, showNaturezaProcesso);
    toggleGroup(fieldGroups.naturezaProcedimento, showNaturezaProcedimento);
    
    // Lógica para Infração (apenas para PADS) - sem depender da natureza principal
    const showInfracao = tipoGeral === 'processo' && tipoProcesso === 'PADS';
    
    // Debug logs temporários
    console.log('Debug Infração:', {
        tipoGeral,
        tipoProcesso,
        showInfracao,
        fieldExists: !!fieldGroups.infracao
    });
    
    toggleGroup(fieldGroups.infracao, showInfracao);
    
    // Se mostrar infração, apenas preparar a interface
    if (showInfracao) {
        console.log('Campo de transgressões mostrado');
        // Não carregar automaticamente - aguardar seleção do usuário no seletor de natureza
        
        // Resetar o seletor de natureza se estiver oculto
        const seletorNatureza = document.getElementById('natureza_nova_transgressao');
        if (seletorNatureza) {
            seletorNatureza.value = '';
        }
        
        // Desabilitar campo de busca até selecionar natureza
        const campoBusca = document.getElementById('infracao_search');
        if (campoBusca) {
            campoBusca.disabled = true;
            campoBusca.placeholder = 'Primeiro selecione a natureza...';
        }
    } else {
        // Se não mostrar infração, cancelar adição e limpar transgressões selecionadas
        cancelarAdicaoTransgressao();
        transgressoesSelecionadas = [];
        atualizarTransgressoesSelecionadas();
    }

    // 3. Lógica para Documento que Iniciou
    toggleGroup(fieldGroups.numeroPortaria, documentoIniciador === 'Portaria');
    toggleGroup(fieldGroups.numeroMemorando, documentoIniciador === 'Memorando Disciplinar');
    toggleGroup(fieldGroups.numeroFeito, documentoIniciador === 'Feito Preliminar');

    // 4. Lógica para Nome do PM (depende do Status do PM)
    const showNomePm = statusPm && statusPm !== 'indiciado';
    toggleGroup(fieldGroups.nomePm, showNomePm);

    // Atualizar label do Nome do PM baseado no status
    if (fields.labelNomePm) {
        switch (statusPm) {
            case 'testemunha':
                fields.labelNomePm.textContent = 'Nome do PM (Testemunha) *';
                break;
            default:
                fields.labelNomePm.textContent = 'Nome do PM *';
        }
    }

    // 5. Lógica para Número de Controle
    updateNumeroControleLogic();
}

// Função para controlar a lógica do número de controle
function updateNumeroControleLogic() {
    const tipoGeral = fields.tipoGeral.value;
    const tipoProcedimento = fields.tipoProcedimento ? fields.tipoProcedimento.value : '';
    const tipoProcesso = fields.tipoProcesso ? fields.tipoProcesso.value : '';
    
    // Mostrar checkbox apenas se tipo for selecionado
    const showCheckbox = tipoGeral && (
        (tipoGeral === 'processo' && tipoProcesso) ||
        (tipoGeral === 'procedimento' && tipoProcedimento)
    );
    toggleGroup(fieldGroups.checkboxControle, showCheckbox);
    
    // Atualizar textos do checkbox baseado no tipo
    if (showCheckbox) {
        updateNumeroControleLabels(tipoGeral, tipoProcedimento, tipoProcesso);
    }
    
    // Mostrar campo de controle se checkbox marcado
    const showControle = showCheckbox && fields.numeroControleDiferente && fields.numeroControleDiferente.checked;
    toggleGroup(fieldGroups.numeroControle, showControle);
}

// Função para atualizar labels do campo número de controle
function updateNumeroControleLabels(tipoGeral, tipoProcedimento, tipoProcesso) {
    if (!fields.labelNumeroControle || !fields.helpNumeroControle) return;
    
    let label = 'Número de Controle *';
    let help = '';
    
    if (tipoGeral === 'procedimento') {
        switch (tipoProcedimento) {
            case 'IPM':
                label = 'Número do IPM *';
                help = 'Número de controle do IPM';
                break;
            case 'SR':
                label = 'Número da SR *';
                help = 'Número de controle da SR';
                break;
            case 'ISO':
                label = 'Número da ISO *';
                help = 'Número de controle da ISO';
                break;
            case 'CP':
                label = 'Número da CP *';
                help = 'Número de controle da CP';
                break;
        }
    } else if (tipoGeral === 'processo') {
        switch (tipoProcesso) {
            case 'PAD':
                label = 'Número do PAD *';
                help = 'Número de controle do PAD';
                break;
            case 'PADS':
                label = 'Número do PADS *';
                help = 'Número de controle do PADS';
                break;
            default:
                label = 'Número do PAD *';
                help = 'Número de controle do PAD';
                break;
            case 'CD':
                label = 'Número do CD *';
                help = 'Número de controle do CD';
                break;
            case 'CJ':
                label = 'Número do CJ *';
                help = 'Número de controle do CJ';
                break;
        }
    }
    
    fields.labelNumeroControle.textContent = label;
    fields.helpNumeroControle.textContent = help;
}

// Função para controlar a lógica da conclusão
function updateConclusaoLogic() {
    const tipoGeral = fields.tipoGeral.value;
    const concluidoChecked = document.getElementById('concluido') && document.getElementById('concluido').checked;
    
    // Atualizar texto do label baseado no tipo
    const labelConcluido = document.getElementById('label_concluido');
    if (labelConcluido) {
        if (tipoGeral === 'processo') {
            labelConcluido.textContent = 'Processo concluído';
        } else if (tipoGeral === 'procedimento') {
            labelConcluido.textContent = 'Procedimento concluído';
        } else {
            labelConcluido.textContent = 'Processo/Procedimento concluído';
        }
    }
    
    // Mostrar campo de data se checkbox marcado
    const groupDataConclusao = document.getElementById('group_data_conclusao');
    const dataConclusao = document.getElementById('data_conclusao');
    
    // Não exibir/obrigar solução final no concluído (apenas data)
    const groupSolucaoFinal = document.getElementById('group_solucao_final');
    const solucaoFinal = document.getElementById('solucao_final');
    
    if (groupDataConclusao && dataConclusao) {
        if (concluidoChecked) {
            groupDataConclusao.style.display = 'block';
            dataConclusao.setAttribute('required', 'required');
        } else {
            groupDataConclusao.style.display = 'none';
            dataConclusao.removeAttribute('required');
            dataConclusao.value = ''; // Limpar o valor
        }
    }
    
    if (groupSolucaoFinal && solucaoFinal) {
        // Sempre oculto e não obrigatório
        groupSolucaoFinal.style.display = 'none';
        solucaoFinal.removeAttribute('required');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados do usuário logado primeiro
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        await verificarEdicao();
    }

    // Converter nome da vítima para maiúsculas automaticamente enquanto digita
    const nomeVitimaInput = document.getElementById('nome_vitima');
    if (nomeVitimaInput) {
        nomeVitimaInput.addEventListener('input', function(e) {
            const cursorPosition = e.target.selectionStart;
            const value = e.target.value.toUpperCase();
            e.target.value = value;
            e.target.setSelectionRange(cursorPosition, cursorPosition);
        });
    }

    // Função para popular o select de Nome do PM
    async function loadPmOptions() {
        try {
            const users = await safeListarTodosUsuarios();
            const pmSelect = document.getElementById('nome_pm');
            // Inclui todos os usuários ativos (operadores e encarregados)
            const pmOptions = users
                .filter(user => user.ativo)
                .map(user => `<option value="${user.id}" data-type="${user.tipo}">${user.nome} (${user.tipo === 'operador' ? 'Operador' : 'Encarregado'})</option>`)
                .join('');
            pmSelect.innerHTML = '<option value="">Selecione...</option>' + pmOptions;
        } catch (error) {
            console.error('Erro ao carregar PMs:', error);
        }
    }

    // Atualiza o select de Nome do PM sempre que o status do PM mudar
    document.getElementById('status_pm').addEventListener('change', loadPmOptions);

    // --- LÓGICA DE VISIBILIDADE DINÂMICA DO FORMULÁRIO ---

    const form = document.getElementById('processForm');
    
    // Mapeamento de todos os grupos de campos que podem ser ocultados/exibidos
    const fieldGroups = {
        tipoProcedimento: document.getElementById('group_tipo_procedimento'),
        tipoProcesso: document.getElementById('group_tipo_processo'),
        escrivao: document.getElementById('group_escrivao'),
        numeroPortaria: document.getElementById('group_numero_portaria'),
        numeroMemorando: document.getElementById('group_numero_memorando'),
        numeroFeito: document.getElementById('group_numero_feito'),
        checkboxControle: document.getElementById('group_checkbox_controle'),
        numeroControle: document.getElementById('group_numero_controle'),
        nomePm: document.getElementById('group_nome_pm'),
        nomeVitima: document.getElementById('group_nome_vitima'),
        // naturezaProcesso: document.getElementById('group_natureza_processo'), // Removido
        naturezaProcedimento: document.getElementById('group_natureza_procedimento'),
        infracao: document.getElementById('group_infracao'),
    };

    // Mapeamento dos campos de input/select
    const fields = {
        tipoGeral: document.getElementById('tipo_geral'),
        tipoProcedimento: document.getElementById('tipo_procedimento'),
        tipoProcesso: document.getElementById('tipo_processo'),
        documentoIniciador: document.getElementById('documento_iniciador'),
        statusPm: document.getElementById('status_pm'),
        labelNomePm: document.getElementById('label_nome_pm'),
        // naturezaProcesso: document.getElementById('natureza_processo'), // Removido
        numeroControleDiferente: document.getElementById('numero_controle_diferente'),
        labelControleDiferente: document.getElementById('label_controle_diferente'),
        numeroControle: document.getElementById('numero_controle'),
        labelNumeroControle: document.getElementById('label_numero_controle'),
        helpNumeroControle: document.getElementById('help_numero_controle'),
    };

    // Função para mostrar/ocultar um grupo e gerenciar o atributo 'required'
    function toggleGroup(group, show) {
        if (group) {
            group.style.display = show ? 'block' : 'none';
            const inputs = group.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (show) {
                    // Apenas adiciona required se o campo já o tiver no HTML
                    if (input.hasAttribute('data-required')) {
                       input.setAttribute('required', 'required');
                    }
                } else {
                    input.removeAttribute('required');
                    // Opcional: limpar valor ao ocultar para evitar envio de dados ocultos
                    if (input.type !== 'checkbox' && input.type !== 'radio') {
                        input.value = '';
                    }
                }
            });
        }
    }
    
    // Função principal que atualiza a visibilidade de todo o formulário
    function updateFormVisibility() {
        const tipoGeral = fields.tipoGeral.value;
        const tipoProcedimento = fields.tipoProcedimento ? fields.tipoProcedimento.value : '';
        const tipoProcesso = fields.tipoProcesso ? fields.tipoProcesso.value : '';
        const documentoIniciador = fields.documentoIniciador.value;
        const statusPm = fields.statusPm.value;

        // 1. Lógica para Tipo de Cadastro (Processo vs Procedimento)
        toggleGroup(fieldGroups.tipoProcesso, tipoGeral === 'processo');
        toggleGroup(fieldGroups.tipoProcedimento, tipoGeral === 'procedimento');
        
        // Lógica para Nome da Vítima/Ofendido (apenas para procedimento)
        const showNomeVitima = tipoGeral === 'procedimento';
        toggleGroup(fieldGroups.nomeVitima, showNomeVitima);

        // Lógica para Escrivão (se Procedimento for IPM)
        toggleGroup(fieldGroups.escrivao, tipoGeral === 'procedimento' && tipoProcedimento === 'IPM');

        // 2. Lógica para Natureza (depende do Tipo de Cadastro e Tipo de Processo)
        // const showNaturezaProcesso = tipoGeral === 'processo' && tipoProcesso === 'PADS'; // Removido
        const showNaturezaProcedimento = tipoGeral === 'procedimento';
        // toggleGroup(fieldGroups.naturezaProcesso, showNaturezaProcesso); // Removido
        toggleGroup(fieldGroups.naturezaProcedimento, showNaturezaProcedimento);
        
        // Lógica para Infração (apenas para PADS) - sem depender da natureza principal
        const showInfracao = tipoGeral === 'processo' && tipoProcesso === 'PADS';
        
        // Debug logs temporários
        console.log('Debug Infração:', {
            tipoGeral,
            tipoProcesso,
            showInfracao,
            fieldExists: !!fieldGroups.infracao
        });
        
        toggleGroup(fieldGroups.infracao, showInfracao);
        
        // Se mostrar infração, apenas preparar a interface
        if (showInfracao) {
            console.log('Campo de transgressões mostrado');
            // Não carregar automaticamente - aguardar seleção do usuário no seletor de natureza
            
            // Resetar o seletor de natureza se estiver oculto
            const seletorNatureza = document.getElementById('natureza_nova_transgressao');
            if (seletorNatureza) {
                seletorNatureza.value = '';
            }
            
            // Desabilitar campo de busca até selecionar natureza
            const campoBusca = document.getElementById('infracao_search');
            if (campoBusca) {
                campoBusca.disabled = true;
                campoBusca.placeholder = 'Primeiro selecione a natureza...';
            }
        }

        // 3. Lógica para Documento que Iniciou
        toggleGroup(fieldGroups.numeroPortaria, documentoIniciador === 'Portaria');
        toggleGroup(fieldGroups.numeroMemorando, documentoIniciador === 'Memorando Disciplinar');
        toggleGroup(fieldGroups.numeroFeito, documentoIniciador === 'Feito Preliminar');

        // 4. Lógica para checkbox e campo de número de controle
        updateNumeroControleLogic();

        // 5. Lógica para Status do PM Envolvido
        const showNomePm = statusPm !== '';
        toggleGroup(fieldGroups.nomePm, showNomePm);
        if (showNomePm) {
            fields.labelNomePm.textContent = `Nome do ${statusPm} *`;
            
            // Para procedimentos, mostrar botão de adicionar mais PMs após selecionar o primeiro
            const isProcedimento = tipoGeral === 'procedimento';
            const botaoAdicionarPm = document.getElementById('botao_adicionar_pm');
            
            if (isProcedimento) {
                // Verificar se já tem um PM principal selecionado
                const pmPrincipalSelecionado = document.getElementById('nome_pm').value !== '';
                botaoAdicionarPm.style.display = pmPrincipalSelecionado ? 'block' : 'none';
                
                // Remover a lógica do botão de indícios por PM específico
                // toggleBotaoIndiciosPmPrincipal(pmPrincipalSelecionado);
            } else {
                botaoAdicionarPm.style.display = 'none';
                // Para processos, limpar PMs adicionais se existirem
                document.getElementById('pms_adicionais_container').style.display = 'none';
                pmsAdicionais = [];
                
                // Esconder botão de indícios para processos
                // toggleBotaoIndiciosPmPrincipal(false);
            }
        } else {
            // Quando não há status de PM selecionado, esconder todos os botões relacionados
            const botaoAdicionarPm = document.getElementById('botao_adicionar_pm');
            if (botaoAdicionarPm) {
                botaoAdicionarPm.style.display = 'none';
            }
            // toggleBotaoIndiciosPmPrincipal(false);
        }
    }

    // Função específica para controlar a lógica do número de controle
    function updateNumeroControleLogic() {
        const tipoGeral = fields.tipoGeral.value;
        const tipoProcedimento = fields.tipoProcedimento ? fields.tipoProcedimento.value : '';
        const tipoProcesso = fields.tipoProcesso ? fields.tipoProcesso.value : '';
        const documentoIniciador = fields.documentoIniciador.value;
        
        // Determinar se precisa mostrar checkbox (não é FP)
        const isFP = tipoGeral === 'procedimento' && tipoProcedimento === 'FP';
        const showCheckbox = documentoIniciador !== '' && !isFP;
        
        toggleGroup(fieldGroups.checkboxControle, showCheckbox);
        
        if (showCheckbox) {
            // Atualizar texto do checkbox baseado no documento
            if (documentoIniciador === 'Portaria') {
                fields.labelControleDiferente.textContent = 'Número de controle é diferente do número da portaria';
            } else if (documentoIniciador === 'Memorando Disciplinar') {
                fields.labelControleDiferente.textContent = 'Número de controle é diferente do número do memorando';
            }
            
            // Atualizar label e help do campo de controle baseado no tipo
            updateNumeroControleLabels(tipoGeral, tipoProcedimento, tipoProcesso);
        }
        
        // Mostrar campo de controle se checkbox marcado
        const showControle = showCheckbox && fields.numeroControleDiferente && fields.numeroControleDiferente.checked;
        toggleGroup(fieldGroups.numeroControle, showControle);
    }

    // Função para atualizar labels do campo número de controle
    function updateNumeroControleLabels(tipoGeral, tipoProcedimento, tipoProcesso) {
        if (!fields.labelNumeroControle || !fields.helpNumeroControle) return;
        
        let label = 'Número de Controle *';
        let help = '';
        
        if (tipoGeral === 'procedimento') {
            switch (tipoProcedimento) {
                case 'IPM':
                    label = 'Número do IPM *';
                    help = 'Número de controle do IPM';
                    break;
                case 'SR':
                    label = 'Número da SR *';
                    help = 'Número de controle da SR';
                    break;
                case 'ISO':
                    label = 'Número da ISO *';
                    help = 'Número de controle da ISO';
                    break;
                case 'CP':
                    label = 'Número da CP *';
                    help = 'Número de controle da CP';
                    break;
            }
        } else if (tipoGeral === 'processo') {
            switch (tipoProcesso) {
                case 'PADS':
                    label = 'Número do PADS *';
                    help = 'Número de controle do PADS';
                    break;
                case 'PAD':
                    label = 'Número do PAD *';
                    help = 'Número de controle do PAD';
                    break;
                case 'CD':
                    label = 'Número do CD *';
                    help = 'Número de controle do CD';
                    break;
                case 'CJ':
                    label = 'Número do CJ *';
                    help = 'Número de controle do CJ';
                    break;
            }
        }
        
        fields.labelNumeroControle.textContent = label;
        fields.helpNumeroControle.textContent = help;
    }

    // Função para controlar a lógica da conclusão
    function updateConclusaoLogic() {
        const tipoGeral = fields.tipoGeral.value;
        const concluidoChecked = document.getElementById('concluido') && document.getElementById('concluido').checked;
        
        // Atualizar texto do label baseado no tipo
        const labelConcluido = document.getElementById('label_concluido');
        if (labelConcluido) {
            if (tipoGeral === 'processo') {
                labelConcluido.textContent = 'Processo concluído';
            } else if (tipoGeral === 'procedimento') {
                labelConcluido.textContent = 'Procedimento concluído';
            } else {
                labelConcluido.textContent = 'Processo/Procedimento concluído';
            }
        }
        
        // Mostrar campo de data se checkbox marcado
        const groupDataConclusao = document.getElementById('group_data_conclusao');
        const dataConclusao = document.getElementById('data_conclusao');
        
        // Não exibir/obrigar solução final no concluído (apenas data)
        const groupSolucaoFinal = document.getElementById('group_solucao_final');
        const solucaoFinal = document.getElementById('solucao_final');
        
        if (groupDataConclusao && dataConclusao) {
            if (concluidoChecked) {
                groupDataConclusao.style.display = 'block';
                dataConclusao.setAttribute('required', 'required');
            } else {
                groupDataConclusao.style.display = 'none';
                dataConclusao.removeAttribute('required');
                dataConclusao.value = ''; // Limpar o valor
            }
        }
        
        if (groupSolucaoFinal && solucaoFinal) {
            groupSolucaoFinal.style.display = 'none';
            solucaoFinal.removeAttribute('required');
        }
    }

    // Adiciona 'data-required' aos campos que são obrigatórios condicionalmente
    // para que a função toggleGroup saiba quando aplicar 'required'
    document.querySelectorAll('#group_tipo_procedimento select, #group_tipo_processo select, #group_escrivao select, #group_numero_portaria input, #group_numero_memorando input, #group_numero_feito input, #group_nome_pm input, #group_natureza_procedimento select').forEach(el => {
        el.setAttribute('data-required', 'true');
    });


    // Adicionar event listeners para os campos que controlam a visibilidade
    if (fields.tipoGeral) fields.tipoGeral.addEventListener('change', updateFormVisibility);
    if (fields.tipoProcedimento) fields.tipoProcedimento.addEventListener('change', updateFormVisibility);
    if (fields.tipoProcesso) fields.tipoProcesso.addEventListener('change', updateFormVisibility);
    if (fields.documentoIniciador) fields.documentoIniciador.addEventListener('change', updateFormVisibility);
    if (fields.statusPm) fields.statusPm.addEventListener('change', updateFormVisibility);
    if (fields.numeroControleDiferente) fields.numeroControleDiferente.addEventListener('change', updateNumeroControleLogic);
    
    // Event listener para checkbox de conclusão
    const concluidoCheckbox = document.getElementById('concluido');
    if (concluidoCheckbox) {
        concluidoCheckbox.addEventListener('change', updateConclusaoLogic);
    }
    
    // Event listener para tipo geral (para atualizar texto da conclusão)
    if (fields.tipoGeral) {
        fields.tipoGeral.addEventListener('change', updateConclusaoLogic);
    }

    // Chamar a função uma vez no início para configurar o estado inicial do formulário
    updateFormVisibility();
    updateConclusaoLogic(); // Configurar estado inicial da conclusão

    // --- MODAL DE BUSCA DE USUÁRIO ---
    
    document.getElementById('btnFecharModalBusca').onclick = fecharModalBuscaUsuario;

    document.getElementById('btnBuscarEncarregado').onclick = function() {
        abrirModalBuscaUsuario('encarregado');
    };
    document.getElementById('btnBuscarEscrivao').onclick = function() {
        abrirModalBuscaUsuario('escrivao');
    };
    document.getElementById('btnBuscarPm').onclick = function() {
        abrirModalBuscaUsuario('pm');
    };
    
    // Botão para adicionar mais PMs (procedimentos)
    document.getElementById('btnAdicionarMaisPm').onclick = function() {
        adicionarPmAdicional();
    };

    document.getElementById('btnExecutarBuscaUsuario').onclick = buscarUsuariosModal;
    document.getElementById('inputBuscaUsuario').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') buscarUsuariosModal();
    });
});

// --- FIM MODAL DE BUSCA DE USUÁRIO ---

document.getElementById('processForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar campos com máscara antes de submeter
    const rgfInput = document.getElementById('numero_rgf');
    const seiInput = document.getElementById('processo_sei');
    
    let isValid = true;
    
    // Validar RGF (se preenchido)
    if (rgfInput.value && !validarRGF(rgfInput.value)) {
        exibirErroValidacao(rgfInput, 'Formato inválido. Use: XX.XX.XXXX (ex: 25.08.8415)');
        isValid = false;
    }
    
    // Validar SEI (se preenchido)
    if (seiInput.value && !validarSEI(seiInput.value)) {
        exibirErroValidacao(seiInput, 'Formato inválido. Use: XXXX.XXXXXX/XXXX-XX (ex: 0021.033044/2025-34)');
        isValid = false;
    }
    
    if (!isValid) {
        showAlert('Por favor, corrija os erros nos campos destacados.', 'error');
        return;
    }
    
    // Validação específica para PADS - deve ter pelo menos uma transgressão
    const tipoGeral = document.getElementById('tipo_geral')?.value;
    const tipoProcesso = document.getElementById('tipo_processo')?.value;
    
    if (tipoGeral === 'processo' && tipoProcesso === 'PADS') {
        if (transgressoesSelecionadas.length === 0) {
            showAlert('Para um PADS, é obrigatório selecionar pelo menos uma transgressão.', 'error');
            return;
        }
        console.log(`Validação PADS: ${transgressoesSelecionadas.length} transgressões selecionadas`);
    }

    // Coleta todos os campos do formulário
    const numero_rgf = document.getElementById('numero_rgf').value.trim();
    const tipo_geral = document.getElementById('tipo_geral').value;
    const documento_iniciador = document.getElementById('documento_iniciador').value;
    const processo_sei = document.getElementById('processo_sei').value.trim();
    const responsavel_id = document.getElementById('responsavel_id').value;
    
    // Determinar o tipo_detalhe baseado no tipo_geral selecionado
    let tipo_detalhe = '';
    if (tipo_geral === 'processo' && document.getElementById('tipo_processo')) {
        tipo_detalhe = document.getElementById('tipo_processo').value;
    } else if (tipo_geral === 'procedimento' && document.getElementById('tipo_procedimento')) {
        tipo_detalhe = document.getElementById('tipo_procedimento').value;
    }

    // Obter o tipo do responsável (encarregado ou operador)
    // Como não temos acesso direto ao tipo, vamos assumir "encarregado" como padrão
    const responsavel_tipo = "encarregado";  // Default - ajustar conforme necessário

    // Novos campos
    const local_origem = document.getElementById('local_origem')?.value || null;
    const local_fatos = document.getElementById('local_fatos')?.value || null;
    const data_instauracao = document.getElementById('data_instauracao')?.value || null;
    const data_recebimento = document.getElementById('data_recebimento')?.value || null;
    const escrivao_id = document.getElementById('escrivao_id')?.value || null;
    const status_pm = document.getElementById('status_pm')?.value || null;
    const nome_pm_id = document.getElementById('nome_pm')?.value || null;
    const nome_vitima = document.getElementById('nome_vitima')?.value?.toUpperCase() || null;
    const natureza_processo = document.getElementById('natureza_processo')?.value || null;
    const natureza_procedimento = document.getElementById('natureza_procedimento')?.value || null;
    const transgressoes_ids = document.getElementById('transgressoes_ids')?.value || null;
    const resumo_fatos = document.getElementById('resumo_fatos')?.value || null;
    const numero_portaria = document.getElementById('numero_portaria')?.value || null;
    const numero_memorando = document.getElementById('numero_memorando')?.value || null;
    const numero_feito = document.getElementById('numero_feito')?.value || null;
    
    // Campos de conclusão
    const concluido = document.getElementById('concluido')?.checked || false;
    const data_conclusao = document.getElementById('data_conclusao')?.value || null;
    const solucao_final = document.getElementById('solucao_final')?.value || null;

    // Determinar o número do documento baseado no tipo de documento iniciador
    let numero_documento = '';
    if (documento_iniciador === 'Portaria' && numero_portaria) {
        numero_documento = numero_portaria.trim();
    } else if (documento_iniciador === 'Memorando Disciplinar' && numero_memorando) {
        numero_documento = numero_memorando.trim();
    } else if (documento_iniciador === 'Feito Preliminar' && numero_feito) {
        numero_documento = numero_feito.trim();
    }

    // Determinar o número de controle
    let numero_controle = '';
    const numeroControleDiferente = document.getElementById('numero_controle_diferente')?.checked || false;
    
    if (numeroControleDiferente) {
        // Se marcou checkbox, usa o valor do campo específico
        numero_controle = document.getElementById('numero_controle')?.value?.trim() || '';
    } else {
        // Se não marcou checkbox, usa o número do documento iniciador
        numero_controle = numero_documento;
    }

    // Validação do campo obrigatório local_fatos
    if (!local_fatos) {
        showAlert('É obrigatório informar o local onde ocorreram os fatos!', 'error');
        document.getElementById('local_fatos')?.focus();
        return;
    }

    // Validação básica
    if (!tipo_geral || !tipo_detalhe || !documento_iniciador || !responsavel_id || !numero_documento || !numero_controle) {
        showAlert('Por favor, preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    // Validação de PM principal obrigatório quando há status_pm
    if (status_pm && !nome_pm_id) {
        showAlert('É obrigatório selecionar o PM envolvido!', 'error');
        return;
    }

    // Validação de número duplicado (apenas para cadastro novo)
    if (!editandoProcedimento) {
        const anoInstauracao = data_instauracao ? new Date(data_instauracao).getFullYear().toString() : new Date().getFullYear().toString();
        const isDuplicado = await validarNumeroDuplicado(numero_documento, documento_iniciador, local_origem, data_instauracao);
        
        if (isDuplicado) {
            const tipoGeral = document.getElementById('tipo_geral')?.value;
            let tipoDetalhe = '';
            
            if (tipoGeral === 'processo') {
                tipoDetalhe = document.getElementById('tipo_processo')?.value || '';
            } else if (tipoGeral === 'procedimento') {
                tipoDetalhe = document.getElementById('tipo_procedimento')?.value || '';
            }
            
            showAlert(
                `Já existe um(a) ${documento_iniciador.toLowerCase()} ${tipoDetalhe} com o número ${numero_documento} para o ano ${anoInstauracao} no ${local_origem}. ` +
                'Verifique se o número está correto ou se o processo já foi cadastrado.',
                'error'
            );
            return;
        }
    }

    try {
        // Coletar PMs envolvidos para procedimentos
        const pmsParaEnvio = tipo_geral === 'procedimento' ? obterTodosPmsEnvolvidos() : null;
        
        // Coletar novos campos (migração 014)
        const data_remessa_encarregado = document.getElementById('data_remessa_encarregado')?.value || null;
        const data_julgamento = document.getElementById('data_julgamento')?.value || null;
        const solucao_tipo = document.getElementById('solucao_tipo')?.value || null;
        const penalidade_tipo = document.getElementById('penalidade_tipo')?.value || null;
        const penalidade_dias_raw = document.getElementById('penalidade_dias')?.value || null;
        const penalidade_dias = penalidade_dias_raw && penalidade_dias_raw !== '' ? parseInt(penalidade_dias_raw, 10) : null;
        const indicios_categorias = document.getElementById('indicios_categorias')?.value || null;

        // Ler seleções múltiplas
    // Coletar IDs dos chips selecionados
    const indicios_crimes = Array.from(selectedChips.crimes.keys());
    const indicios_rdpm = Array.from(selectedChips.rdpm.keys());
    const indicios_art29 = Array.from(selectedChips.art29.keys());
    
    // Coletar indícios por PM específico (novo sistema)
    const indicios_por_pm = indiciosPorPM || {};
    
    console.log('📤 Enviando dados do formulário:');
    console.log('📋 Indícios globais:', {
        crimes: indicios_crimes.length,
        rdpm: indicios_rdpm.length,
        art29: indicios_art29.length
    });
    console.log('📋 Indícios por PM:', indicios_por_pm);
    console.log('📋 Total de PMs com indícios:', Object.keys(indicios_por_pm).length);

        let result;
        if (editandoProcedimento) {
            // Modo edição
            result = await eel.atualizar_processo(
                editandoProcedimento.id,
                numero_documento, // Agora usando o número do documento específico
                tipo_geral,
                tipo_detalhe,
                documento_iniciador,
                processo_sei,
                responsavel_id,
                responsavel_tipo,
                local_origem,
                local_fatos,
                data_instauracao,
                data_recebimento,
                escrivao_id,
                status_pm,
                nome_pm_id,
                nome_vitima,
                natureza_processo,
                natureza_procedimento,
                resumo_fatos,
                numero_portaria,
                numero_memorando,
                numero_feito,
                numero_rgf,
                numero_controle,
                concluido,
                data_conclusao,
                solucao_final,
                pmsParaEnvio,
                transgressoes_ids,
                // novos campos
                data_remessa_encarregado,
                data_julgamento,
                solucao_tipo,
                penalidade_tipo,
                penalidade_dias,
                indicios_categorias,
                indicios_crimes,
                indicios_rdpm,
                indicios_art29,
                indicios_por_pm
            )();
        } else {
            // Modo criação
            result = await eel.registrar_processo(
                numero_documento, // Agora usando o número do documento específico
                tipo_geral,
                tipo_detalhe,
                documento_iniciador,
                processo_sei,
                responsavel_id,
                responsavel_tipo,
                local_origem,
                local_fatos,
                data_instauracao,
                data_recebimento,
                escrivao_id,
                status_pm,
                nome_pm_id,
                nome_vitima,
                natureza_processo,
                natureza_procedimento,
                resumo_fatos,
                numero_portaria,
                numero_memorando,
                numero_feito,
                numero_rgf,
                numero_controle,
                concluido,
                data_conclusao,
                solucao_final,
                pmsParaEnvio,
                transgressoes_ids,
                // novos campos
                data_remessa_encarregado,
                data_julgamento,
                solucao_tipo,
                penalidade_tipo,
                penalidade_dias,
                indicios_categorias,
                indicios_crimes,
                indicios_rdpm,
                indicios_art29,
                indicios_por_pm
            )();
        }        if (result.sucesso) {
            showAlert(result.mensagem, 'success');
            // Redireciona para listagem tanto no cadastro quanto na edição após sucesso
            setTimeout(() => {
                window.location.href = 'procedure_list.html';
            }, 1200); // Aguarda 1.2s para mostrar o modal
        } else {
            showAlert(result.mensagem, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar processo/procedimento:', error);
        console.error('Detalhes do erro:', {
            message: error.message,
            stack: error.stack,
            toString: error.toString()
        });
        showAlert('Erro ao conectar com o servidor!', 'error');
    }
});

// ============================================
// FUNÇÕES DE GERENCIAMENTO DE MÚLTIPLOS PMS (ESCOPO GLOBAL)
// ============================================

function adicionarPmAdicional() {
    const container = document.getElementById('pms_adicionais_container');
    const index = pmsAdicionais.length;
    
    // Criar novo campo para PM adicional
    const novoField = document.createElement('div');
    novoField.className = 'pm-adicional-field';
    novoField.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;';
    
    novoField.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; flex: 1 1 auto;">
            <input type="text" id="pm_adicional_nome_${index}" readonly required style="flex:1; background:#f5f5f5; cursor:pointer;" placeholder="Selecione outro PM...">
            <input type="hidden" id="pm_adicional_id_${index}">
            <button type="button" class="btn-lupa-adicional" data-index="${index}" title="Buscar PM" style="background: none; border: none; cursor: pointer;">
                <i class="fas fa-search"></i>
            </button>
        </div>
        <div style="flex: 0 0 240px; display:flex; align-items:center; gap:6px;">
            <label for="pm_adicional_status_${index}" style="font-size: 0.85rem; color:#555;">Status</label>
            <select id="pm_adicional_status_${index}" style="width: 150px;">
                <option value="">(geral)</option>
                <option value="Acusado">Acusado</option>
                <option value="Sindicado">Sindicado</option>
                <option value="Investigado">Investigado</option>
                <option value="Indiciado">Indiciado</option>
            </select>
        </div>
        <div style="flex: 0 0 auto; display:flex; gap:4px; align-items:center;">
            <button type="button" class="btn-remover-pm" data-index="${index}" 
                    style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    container.appendChild(novoField);
    container.style.display = 'block';
    
    // Adicionar event listeners aos novos botões
    const btnBuscar = novoField.querySelector('.btn-lupa-adicional');
    const btnRemover = novoField.querySelector('.btn-remover-pm');
    
    btnBuscar.addEventListener('click', function() {
        buscarPmAdicional(index);
    });
    
    btnRemover.addEventListener('click', function() {
        removerPmAdicional(index);
    });
    
    // Adicionar placeholder no array
    pmsAdicionais.push({ id: null, nome: '', status_pm: '', campo: novoField });

    // Listener do select de status para armazenar no array
    const statusSelect = novoField.querySelector(`#pm_adicional_status_${index}`);
    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            if (pmsAdicionais[index]) {
                pmsAdicionais[index].status_pm = this.value;
            }
        });
    }
}

function buscarPmAdicional(index) {
    // Definir qual campo está sendo buscado
    window.campoPmAdicionalIndex = index;
    abrirModalBuscaUsuario('pm_adicional');
}

function removerPmAdicional(index) {
    const campo = pmsAdicionais[index].campo;
    campo.remove();
    pmsAdicionais.splice(index, 1);
    
    // Se não há mais PMs adicionais, esconder o container
    if (pmsAdicionais.length === 0) {
        document.getElementById('pms_adicionais_container').style.display = 'none';
    }
    
    // Reindexar os campos restantes
    reindexarPmsAdicionais();
}

function reindexarPmsAdicionais() {
    const container = document.getElementById('pms_adicionais_container');
    const campos = container.querySelectorAll('.pm-adicional-field');
    
    // Limpar array e reconstruir
    pmsAdicionais = [];
    
    campos.forEach((campo, novoIndex) => {
        // Atualizar IDs dos inputs
        const inputNome = campo.querySelector('input[type="text"]');
        const inputId = campo.querySelector('input[type="hidden"]');
        const btnBuscar = campo.querySelector('.btn-lupa-adicional');
        const btnRemover = campo.querySelector('.btn-remover-pm');
        
        inputNome.id = `pm_adicional_nome_${novoIndex}`;
        inputId.id = `pm_adicional_id_${novoIndex}`;
        
        // Limpar event listeners anteriores
        const novoBtnBuscar = btnBuscar.cloneNode(true);
        const novoBtnRemover = btnRemover.cloneNode(true);
        
        btnBuscar.parentNode.replaceChild(novoBtnBuscar, btnBuscar);
        btnRemover.parentNode.replaceChild(novoBtnRemover, btnRemover);
        
        // Adicionar novos event listeners
        novoBtnBuscar.addEventListener('click', function() {
            buscarPmAdicional(novoIndex);
        });
        
        novoBtnRemover.addEventListener('click', function() {
            removerPmAdicional(novoIndex);
        });
        
        // Reconstruir array
        const statusSelect = campo.querySelector('select[id^="pm_adicional_status_"]');
        pmsAdicionais.push({
            id: inputId.value || null,
            nome: inputNome.value || '',
            status_pm: statusSelect ? statusSelect.value : '',
            campo: campo
        });
    });
}

// ============================================
// FUNÇÕES DE MODAL DE BUSCA DE USUÁRIO (ESCOPO GLOBAL)
// ============================================

let campoBuscaUsuario = null; // Qual campo está buscando (encarregado, escrivao, pm)

function abrirModalBuscaUsuario(campo) {
    campoBuscaUsuario = campo;
    document.getElementById('modalBuscaUsuario').style.display = 'flex';
    document.getElementById('inputBuscaUsuario').value = '';
    document.getElementById('resultadosBuscaUsuario').innerHTML = '';
    document.getElementById('inputBuscaUsuario').focus();
}

function fecharModalBuscaUsuario() {
    document.getElementById('modalBuscaUsuario').style.display = 'none';
    campoBuscaUsuario = null;
}

async function buscarUsuariosModal() {
    const termo = document.getElementById('inputBuscaUsuario').value.trim();
    const resultadosDiv = document.getElementById('resultadosBuscaUsuario');
    resultadosDiv.innerHTML = '<div style="padding:10px; color:#888;">Buscando...</div>';
    let usuarios = [];
    try {
        // Busca todos os usuários ativos
        usuarios = await safeListarTodosUsuarios();
        if (termo) {
            const termoLower = termo.toLowerCase();
            usuarios = usuarios.filter(u =>
                (u.nome && u.nome.toLowerCase().includes(termoLower)) ||
                (u.matricula && u.matricula.toLowerCase().includes(termoLower))
            );
        }
    } catch (err) {
        resultadosDiv.innerHTML = '<div style="padding:10px; color:#c00;">Erro ao buscar usuários.</div>';
        return;
    }
    if (!usuarios.length) {
        resultadosDiv.innerHTML = '<div style="padding:10px; color:#888;">Nenhum usuário encontrado.</div>';
        return;
    }
    resultadosDiv.innerHTML = usuarios.map(u => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
            <div>
                <span style="font-weight:500;">${u.posto_graduacao || ''}</span>
                <span style="margin-left:8px; color:#555;">${u.matricula || ''}</span>
                <span style="margin-left:8px; color:#222;">${u.nome}</span>
                <span style="margin-left:8px; font-size:12px; color:#888;">(${u.tipo})</span>
            </div>
            <button class="btnEscolherUsuario" data-id="${u.id}" data-nome="${u.nome}" data-matricula="${u.matricula}" data-pg="${u.posto_graduacao}" style="background:none; border:none; color:#28a745; font-size:20px; cursor:pointer;" title="Escolher"><i class="fas fa-check-circle"></i></button>
        </div>
    `).join('');
    // Adiciona evento aos botões de escolha
    document.querySelectorAll('.btnEscolherUsuario').forEach(btn => {
        btn.onclick = function() {
            const id = this.getAttribute('data-id');
            const nome = this.getAttribute('data-nome');
            const matricula = this.getAttribute('data-matricula');
            const pg = this.getAttribute('data-pg');
            const texto = `${pg ? pg + ' ' : ''}${matricula ? matricula + ' ' : ''}${nome}`;
            
            if (campoBuscaUsuario === 'encarregado') {
                document.getElementById('responsavel_nome').value = texto;
                document.getElementById('responsavel_id').value = id;
            } else if (campoBuscaUsuario === 'escrivao') {
                document.getElementById('escrivao_nome').value = texto;
                document.getElementById('escrivao_id').value = id;
            } else if (campoBuscaUsuario === 'pm') {
                // PM principal
                document.getElementById('nome_pm_nome').value = texto;
                document.getElementById('nome_pm').value = id;
                
                // Se for procedimento, mostrar botão para adicionar mais PMs
                const tipoGeral = document.getElementById('tipo_geral').value;
                if (tipoGeral === 'procedimento') {
                    document.getElementById('botao_adicionar_pm').style.display = 'block';
                    // Mostrar botão de indícios para PM principal em procedimentos
                    toggleBotaoIndiciosPmPrincipal(true);
                }
            } else if (campoBuscaUsuario === 'pm_adicional') {
                // PM adicional
                const index = window.campoPmAdicionalIndex;
                document.getElementById(`pm_adicional_nome_${index}`).value = texto;
                document.getElementById(`pm_adicional_id_${index}`).value = id;
                
                // Atualizar array de PMs adicionais
                if (pmsAdicionais[index]) {
                    pmsAdicionais[index].id = id;
                    pmsAdicionais[index].nome = texto;
                }
            }
            fecharModalBuscaUsuario();
        };
    });
}

// Função para listar todos os usuários de forma segura
async function safeListarTodosUsuarios() {
    try {
        const users = await eel.listar_todos_usuarios()();
        if (!Array.isArray(users)) return [];
        return users;
    } catch (err) {
        console.error('Erro detalhado ao carregar lista de usuários:', err);
        return [];
    }
}

// ============================================
// FUNÇÕES PARA INFRAÇÕES
// ============================================

// Função para carregar infrações baseadas na natureza selecionada
function carregarInfracoesPorNatureza(natureza) {
    console.log('🔍 Carregando infrações para natureza:', natureza);
    
    // Mapear natureza para gravidade (valores recebidos do select)
    const naturezaParaGravidade = {
        'Leve': 'leve',
        'Média': 'media', 
        'Grave': 'grave'
    };
    
    const gravidade = naturezaParaGravidade[natureza];
    console.log('📊 Mapeamento:', { natureza, gravidade, mapeamentos: naturezaParaGravidade });
    
    if (!gravidade) {
        console.error('❌ Gravidade não encontrada para natureza:', natureza);
        console.log('Naturezas disponíveis:', Object.keys(naturezaParaGravidade));
        return;
    }
    
    console.log('🔍 Buscando transgressões para gravidade:', gravidade);
    
    fetch(`/buscar_transgressoes?gravidade=${encodeURIComponent(gravidade)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados recebidos:', data);
            
            if (data.erro) {
                console.error('Erro do servidor:', data.erro);
                showAlert('Erro ao carregar infrações: ' + data.erro, 'error');
                return;
            }
            
            const searchInput = document.getElementById('infracao_search');
            const dropdownContent = document.getElementById('infracao_dropdown');
            
            if (!searchInput || !dropdownContent) {
                console.error('Elementos não encontrados no DOM:', {
                    searchInput: !!searchInput,
                    dropdownContent: !!dropdownContent
                });
                return;
            }
            
            // Limpar dropdown anterior
            dropdownContent.innerHTML = '';
            searchInput.value = '';
            
            // Habilitar campo de busca
            console.log('🔓 Habilitando campo de busca...');
            searchInput.disabled = false;
            searchInput.placeholder = 'Digite para filtrar transgressões...';
            console.log('✅ Campo de busca habilitado:', {
                disabled: searchInput.disabled,
                placeholder: searchInput.placeholder
            });
            
            // Verificar se há dados
            if (!Array.isArray(data) || data.length === 0) {
                console.log('Nenhuma transgressão encontrada');
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = 'Nenhuma transgressão encontrada';
                option.style.color = '#999';
                option.style.fontStyle = 'italic';
                dropdownContent.appendChild(option);
                return;
            }
            
            console.log(`Adicionando ${data.length} infrações ao dropdown`);
            
            // Adicionar infrações ao dropdown
            data.forEach(infracao => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = `${infracao.inciso} - ${infracao.texto}`;
                option.title = infracao.texto; // Tooltip com texto completo
                option.onclick = () => selecionarInfracao({
                    ...infracao,
                    natureza: gravidade // Adicionar natureza selecionada
                });
                dropdownContent.appendChild(option);
            });
            
            console.log('Dropdown populado com sucesso');
            
            // Mostrar o dropdown após populá-lo
            dropdownContent.style.display = 'block';
            console.log('📋 Dropdown exibido');
            
            // Focar no campo de busca
            searchInput.focus();
            console.log('🎯 Campo de busca focado');
        })
        .catch(error => {
            console.error('Erro ao carregar infrações:', error);
            showAlert('Erro ao carregar infrações. Verifique a conexão.', 'error');
        });
}

// Função para selecionar uma infração do RDPM
function selecionarInfracao(infracao) {
    console.log('Selecionando infração RDPM:', infracao);
    
    // Verificar se a transgressão já foi selecionada
    const jaExiste = transgressoesSelecionadas.find(t => t.id === infracao.id && t.tipo === 'rdpm');
    if (jaExiste) {
        showAlert('Esta transgressão já foi selecionada!', 'warning');
        return;
    }
    
    // Adicionar à lista de selecionadas com natureza e tipo
    transgressoesSelecionadas.push({
        id: infracao.id,
        inciso: infracao.inciso,
        texto: infracao.texto,
        natureza: infracao.natureza,
        tipo: 'rdpm'
    });
    
    // Atualizar interface
    atualizarTransgressoesSelecionadas();
    
    // Limpar campo de busca e ocultar dropdown
    const searchInput = document.getElementById('infracao_search');
    const dropdownContent = document.getElementById('infracao_dropdown');
    const seletorNatureza = document.getElementById('natureza_nova_transgressao');
    
    if (searchInput && dropdownContent) {
        searchInput.value = '';
        searchInput.disabled = true;
        searchInput.placeholder = 'Primeiro selecione a natureza...';
        dropdownContent.style.display = 'none';
    }
    
    // Resetar seletor de natureza
    if (seletorNatureza) {
        seletorNatureza.value = '';
    }
    
    console.log('Transgressão adicionada. Total:', transgressoesSelecionadas.length);
}

// Função para atualizar a lista de transgressões selecionadas
function atualizarTransgressoesSelecionadas() {
    const container = document.getElementById('transgressoes_selecionadas');
    const hiddenInput = document.getElementById('transgressoes_ids');
    const botaoAdicionar = document.getElementById('botao_adicionar_transgressao');
    const campoBusca = document.getElementById('campo_busca_transgressao');
    
    if (!container || !hiddenInput) return;
    
    // Limpar container
    container.innerHTML = '';
    
    if (transgressoesSelecionadas.length === 0) {
        // Nenhuma transgressão selecionada
        container.style.display = 'none';
        if (botaoAdicionar) botaoAdicionar.style.display = 'none';
        if (campoBusca) campoBusca.style.display = 'block';
        hiddenInput.value = '';
        return;
    }
    
    // Mostrar container
    container.style.display = 'block';
    
    // Adicionar cada transgressão
    transgressoesSelecionadas.forEach((transgressao, index) => {
        const item = document.createElement('div');
        item.className = 'transgressao-item';
        
        // Determinar classe CSS baseada no tipo e natureza
        let naturezaClass = '';
        let prefixo = '';
        let naturezaTexto = '';
        
        if (transgressao.tipo === 'estatuto') {
            naturezaClass = 'estatuto';
            prefixo = 'Art. 29';
            naturezaTexto = `Analogia: ${transgressao.rdmp_analogia.natureza}`;
        } else {
            // RDPM
            naturezaClass = transgressao.natureza === 'media' ? 'media' : transgressao.natureza;
            prefixo = 'RDPM';
            naturezaTexto = transgressao.natureza;
        }
        
        item.innerHTML = `
            <div class="transgressao-texto">
                <div class="transgressao-inciso">
                    ${prefixo} ${transgressao.inciso}
                    <span class="natureza-tag ${naturezaClass}">${naturezaTexto}</span>
                </div>
                <div class="transgressao-descricao">${transgressao.texto}</div>
                ${transgressao.tipo === 'estatuto' ? `
                    <div class="analogia-info" style="margin-top: 5px; padding: 5px; background-color: #f0f0f0; border-radius: 3px; font-size: 0.85em;">
                        <strong>Analogia RDPM:</strong> ${transgressao.rdmp_analogia.inciso} - ${transgressao.rdmp_analogia.texto}
                    </div>
                ` : ''}
            </div>
            <button type="button" class="btn-remover-transgressao" onclick="removerTransgressao(${index})" title="Remover transgressão">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(item);
    });
    
    // Atualizar campo hidden com novo formato que inclui tipo, natureza e analogia
    const dadosTransgressoes = transgressoesSelecionadas.map(t => {
        if (t.tipo === 'estatuto') {
            return {
                id: t.id,
                tipo: 'estatuto',
                rdmp_analogia: {
                    id: t.rdmp_analogia.id,
                    natureza: t.rdmp_analogia.natureza
                }
            };
        } else {
            return {
                id: t.id,
                natureza: t.natureza,
                tipo: 'rdpm'
            };
        }
    });
    hiddenInput.value = JSON.stringify(dadosTransgressoes);
    
    // Controlar visibilidade dos botões e campo de busca
    if (botaoAdicionar) botaoAdicionar.style.display = 'block';
    if (campoBusca) campoBusca.style.display = 'none';
    
    console.log('Interface atualizada. Transgressões:', dadosTransgressoes);
}

// Função para remover uma transgressão
function removerTransgressao(index) {
    console.log('Removendo transgressão no índice:', index);
    
    if (index >= 0 && index < transgressoesSelecionadas.length) {
        transgressoesSelecionadas.splice(index, 1);
        atualizarTransgressoesSelecionadas();
        
        // Se não há mais transgressões, mostrar campo de busca novamente
        if (transgressoesSelecionadas.length === 0) {
            const campoBusca = document.getElementById('campo_busca_transgressao');
            if (campoBusca) campoBusca.style.display = 'block';
        }
    }
}

// Função para mostrar campo de busca para adicionar nova transgressão
function mostrarCampoBuscaTransgressao() {
    console.log('Mostrando campo de busca para nova transgressão');
    
    const campoBusca = document.getElementById('campo_busca_transgressao');
    const botaoAdicionar = document.getElementById('botao_adicionar_transgressao');
    
    console.log('campoBusca element:', campoBusca);
    console.log('botaoAdicionar element:', botaoAdicionar);
    
    if (campoBusca) {
        campoBusca.style.display = 'block';
        console.log('Campo de busca exibido');
        
        // Resetar seletor de natureza
        const seletorNatureza = document.getElementById('natureza_nova_transgressao');
        if (seletorNatureza) {
            seletorNatureza.value = '';
        }
        
        // Desabilitar campo de busca até selecionar natureza
        const searchInput = document.getElementById('infracao_search');
        if (searchInput) {
            searchInput.disabled = true;
            searchInput.placeholder = 'Primeiro selecione a natureza...';
            searchInput.value = '';
        }
        
        // Focar no seletor de natureza
        if (seletorNatureza) {
            seletorNatureza.focus();
            console.log('Focus definido no seletor de natureza');
        }
    } else {
        console.log('Elemento campo_busca_transgressao não encontrado');
    }
    
    if (botaoAdicionar) {
        botaoAdicionar.style.display = 'none';
    }
}

// Função para cancelar adição de nova transgressão
function cancelarAdicaoTransgressao() {
    const campoBusca = document.getElementById('campo_busca_transgressao');
    const botaoAdicionar = document.getElementById('botao_adicionar_transgressao');
    const searchInput = document.getElementById('infracao_search');
    const dropdown = document.getElementById('infracao_dropdown');
    
    // Novos campos
    const tipoInfracao = document.getElementById('tipo_infracao');
    const naturezaSelect = document.getElementById('natureza_nova_transgressao');
    const grupoNaturezaRdpm = document.getElementById('grupo_natureza_rdpm');
    const grupoAnalogiaRdpm = document.getElementById('grupo_analogia_rdpm');
    const analogiaNatureza = document.getElementById('analogia_natureza');
    const analogiaSearch = document.getElementById('analogia_search');
    const analogiaDropdown = document.getElementById('analogia_dropdown');
    
    if (campoBusca && transgressoesSelecionadas.length > 0) {
        campoBusca.style.display = 'none';
    }
    
    if (botaoAdicionar && transgressoesSelecionadas.length > 0) {
        botaoAdicionar.style.display = 'block';
    }
    
    // Resetar campos principais
    if (searchInput) {
        searchInput.value = '';
        searchInput.disabled = true;
        searchInput.placeholder = 'Primeiro selecione o tipo de infração...';
    }
    
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Resetar novos campos
    if (tipoInfracao) tipoInfracao.value = '';
    if (naturezaSelect) naturezaSelect.value = '';
    if (grupoNaturezaRdpm) grupoNaturezaRdpm.style.display = 'none';
    if (grupoAnalogiaRdpm) grupoAnalogiaRdpm.style.display = 'none';
    if (analogiaNatureza) analogiaNatureza.value = '';
    if (analogiaSearch) {
        analogiaSearch.value = '';
        analogiaSearch.disabled = true;
        analogiaSearch.placeholder = 'Primeiro selecione a natureza da analogia...';
    }
    if (analogiaDropdown) analogiaDropdown.style.display = 'none';
    
    // Limpar variável temporária
    infracaoArt29Temporaria = null;
}

// Função para filtrar infrações durante a busca
function filtrarInfracoes() {
    const searchTerm = document.getElementById('infracao_search').value.toLowerCase();
    const dropdownContent = document.getElementById('infracao_dropdown');
    const options = document.querySelectorAll('#infracao_dropdown .dropdown-option');
    
    console.log('Filtrando infrações com termo:', searchTerm);
    
    let visibleCount = 0;
    
    options.forEach(option => {
        const text = option.textContent.toLowerCase();
        const isVisible = text.includes(searchTerm);
        option.style.display = isVisible ? 'block' : 'none';
        if (isVisible) visibleCount++;
    });
    
    // Mostrar dropdown se houver texto e opções visíveis
    if (searchTerm && visibleCount > 0) {
        dropdownContent.style.display = 'block';
    } else if (!searchTerm) {
        dropdownContent.style.display = 'block'; // Mostrar todas quando vazio
    } else {
        dropdownContent.style.display = 'none'; // Ocultar se não houver resultados
    }
    
    console.log('Opções visíveis:', visibleCount);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

// Inicialização quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
    // Configurar máscaras para os campos
    const rgfInput = document.getElementById('numero_rgf');
    const seiInput = document.getElementById('processo_sei');
    
    // Event listeners para aplicar máscaras
    rgfInput.addEventListener('input', function() {
        aplicarMascaraRGF(this);
        removerErroValidacao(this);
    });
    
    seiInput.addEventListener('input', function() {
        aplicarMascaraSEI(this);
        removerErroValidacao(this);
    });
    
    // Event listeners para validação ao sair do campo
    rgfInput.addEventListener('blur', function() {
        if (this.value && !validarRGF(this.value)) {
            exibirErroValidacao(this, 'Formato inválido. Use: XX.XX.XXXX (ex: 25.08.8415)');
        } else {
            removerErroValidacao(this);
        }
    });
    
    seiInput.addEventListener('blur', function() {
        if (this.value && !validarSEI(this.value)) {
            exibirErroValidacao(this, 'Formato inválido. Use: XXXX.XXXXXX/XXXX-XX (ex: 0021.033044/2025-34)');
        } else {
            removerErroValidacao(this);
        }
    });
    
    // Event listeners para o dropdown de infrações
    const infracaoSearch = document.getElementById('infracao_search');
    const infracaoDropdown = document.getElementById('infracao_dropdown');
    const btnAdicionarTransgressao = document.getElementById('btnAdicionarTransgressao');
    
    if (infracaoSearch && infracaoDropdown) {
        console.log('Configurando event listeners para dropdown de infrações');
        
        // Mostrar dropdown ao focar no campo de busca
        infracaoSearch.addEventListener('focus', function() {
            console.log('Campo de infração focado');
            const dropdown = document.getElementById('infracao_dropdown');
            if (dropdown && dropdown.children.length > 0) {
                dropdown.style.display = 'block';
                console.log('🔍 Dropdown mostrado no foco');
            }
        });
        
        // Mostrar dropdown ao clicar no campo de busca
        infracaoSearch.addEventListener('click', function() {
            console.log('Campo de infração clicado');
            const dropdown = document.getElementById('infracao_dropdown');
            if (dropdown && dropdown.children.length > 0) {
                dropdown.style.display = 'block';
                console.log('🔍 Dropdown mostrado no clique');
            }
        });
        
        // Filtrar infrações enquanto digita
        infracaoSearch.addEventListener('input', function() {
            console.log('Input mudou, filtrando infrações');
            filtrarInfracoes();
        });
        
        // Ocultar dropdown ao pressionar Escape
        infracaoSearch.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                infracaoDropdown.style.display = 'none';
                // Se há transgressões selecionadas, cancelar adição
                if (transgressoesSelecionadas.length > 0) {
                    cancelarAdicaoTransgressao();
                }
            }
        });
        
        // Ocultar dropdown ao clicar fora - mas não se estivermos no processo de adição
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('infracao_dropdown');
            const searchField = document.getElementById('infracao_search');
            const naturezaSelector = document.getElementById('natureza_nova_transgressao');
            const campoBusca = document.getElementById('campo_busca_transgressao');
            
            // Não fechar se estamos clicando dentro da área de adição de transgressão
            if (campoBusca && campoBusca.contains(event.target)) {
                console.log('Clique dentro da área de adição, mantendo dropdown');
                return;
            }
            
            // Não fechar se clicar no dropdown ou campo de busca
            if ((searchField && searchField.contains(event.target)) || 
                (dropdown && dropdown.contains(event.target)) ||
                (naturezaSelector && naturezaSelector.contains(event.target))) {
                console.log('Clique dentro do dropdown/busca, mantendo dropdown');
                return;
            }
            
            console.log('Clique fora do dropdown, ocultando');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
        });
        
        // Prevenir que cliques no dropdown fechem o dropdown
        infracaoDropdown.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    } else {
        console.log('Elementos do dropdown de infrações não encontrados');
    }
    
    // Event listener para botão de adicionar transgressão (usando delegação de eventos)
    document.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'btnAdicionarTransgressao') {
            console.log('Botão adicionar transgressão clicado!');
            mostrarCampoBuscaTransgressao();
        }
    });
    
    // Também tentar adicionar diretamente ao botão se ele existir
    if (btnAdicionarTransgressao) {
        console.log('Adicionando event listener direto ao botão');
        btnAdicionarTransgressao.addEventListener('click', function(e) {
            console.log('Event listener direto: Botão adicionar transgressão clicado!');
            mostrarCampoBuscaTransgressao();
        });
    } else {
        console.log('Botão btnAdicionarTransgressao não encontrado no DOM');
    }
    
    // Event listener para mudança na natureza do processo (PADS) - REMOVIDO
    // const naturezaProcesso = document.getElementById('natureza_processo');
    // if (naturezaProcesso) {
    //     naturezaProcesso.addEventListener('change', function() {
    //         updateFormVisibility(); // Isso já vai chamar carregarInfracoesPorNatureza
    //     });
    // }
    
    // Event listener para seletor de tipo de infração
    document.addEventListener('change', function(event) {
        if (event.target && event.target.id === 'tipo_infracao') {
            const tipoSelecionado = event.target.value;
            console.log('Tipo de infração selecionado:', tipoSelecionado);
            
            const grupoNaturezaRdpm = document.getElementById('grupo_natureza_rdpm');
            const grupoAnalogiaRdpm = document.getElementById('grupo_analogia_rdpm');
            const infracaoSearch = document.getElementById('infracao_search');
            const naturezaSelect = document.getElementById('natureza_nova_transgressao');
            
            if (tipoSelecionado === 'rdpm') {
                // Mostrar seletor de natureza RDPM
                grupoNaturezaRdpm.style.display = 'block';
                grupoAnalogiaRdpm.style.display = 'none';
                infracaoSearch.placeholder = 'Primeiro selecione a natureza...';
                infracaoSearch.disabled = true;
                
                // Resetar campos
                naturezaSelect.value = '';
                infracaoSearch.value = '';
                
            } else if (tipoSelecionado === 'estatuto') {
                // Mostrar campo de busca diretamente para Art. 29
                grupoNaturezaRdpm.style.display = 'none';
                grupoAnalogiaRdpm.style.display = 'none';
                infracaoSearch.placeholder = 'Digite para buscar incisos do Art. 29...';
                infracaoSearch.disabled = false;
                infracaoSearch.focus();
                
                // Carregar todos os incisos do Art. 29
                carregarInfracoesArt29();
                
            } else {
                // Ocultar tudo
                grupoNaturezaRdpm.style.display = 'none';
                grupoAnalogiaRdpm.style.display = 'none';
                infracaoSearch.placeholder = 'Primeiro selecione o tipo de infração...';
                infracaoSearch.disabled = true;
                infracaoSearch.value = '';
            }
        }
    });
    
    // Event listener para seletor de natureza da nova transgressão (RDPM)
    document.addEventListener('change', function(event) {
        if (event.target && event.target.id === 'natureza_nova_transgressao') {
            const naturezaSelecionada = event.target.value;
            console.log('Natureza selecionada para nova transgressão:', naturezaSelecionada);
            
            if (naturezaSelecionada) {
                // Carregar transgressões da natureza selecionada
                carregarInfracoesPorNatureza(naturezaSelecionada);
            } else {
                // Desabilitar campo de busca se não há natureza selecionada
                const searchInput = document.getElementById('infracao_search');
                if (searchInput) {
                    searchInput.disabled = true;
                    searchInput.placeholder = 'Primeiro selecione a natureza...';
                    searchInput.value = '';
                }
                
                // Ocultar dropdown
                const dropdown = document.getElementById('infracao_dropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            }
        }
    });
    
    // Event listener para seletor de natureza da analogia RDPM
    document.addEventListener('change', function(event) {
        if (event.target && event.target.id === 'analogia_natureza') {
            const naturezaSelecionada = event.target.value;
            console.log('Natureza da analogia RDPM selecionada:', naturezaSelecionada);
            
            if (naturezaSelecionada) {
                // Carregar transgressões RDPM para analogia
                carregarTransgressoesParaAnalogia(naturezaSelecionada);
            } else {
                // Desabilitar campo de busca de analogia
                const analogiaSearch = document.getElementById('analogia_search');
                if (analogiaSearch) {
                    analogiaSearch.disabled = true;
                    analogiaSearch.placeholder = 'Primeiro selecione a natureza da analogia...';
                    analogiaSearch.value = '';
                }
                
                // Ocultar dropdown de analogia
                const analogiaDropdown = document.getElementById('analogia_dropdown');
                if (analogiaDropdown) {
                    analogiaDropdown.style.display = 'none';
                }
            }
        }
    });
});

// Função para carregar infrações do Art. 29
function carregarInfracoesArt29(termo = '') {
    console.log('🔍 Carregando infrações do Art. 29...');
    
    fetch(`/buscar_infracoes_art29?termo=${encodeURIComponent(termo)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados do Art. 29 recebidos:', data);
            
            if (data.erro) {
                console.error('Erro do servidor:', data.erro);
                showAlert('Erro ao carregar infrações do Art. 29: ' + data.erro, 'error');
                return;
            }
            
            const searchInput = document.getElementById('infracao_search');
            const dropdownContent = document.getElementById('infracao_dropdown');
            
            if (!searchInput || !dropdownContent) {
                console.error('Elementos não encontrados no DOM');
                return;
            }
            
            // Limpar dropdown anterior
            dropdownContent.innerHTML = '';
            
            // Habilitar campo de busca
            searchInput.disabled = false;
            searchInput.placeholder = 'Digite para buscar incisos do Art. 29...';
            
            // Verificar se há dados
            if (!Array.isArray(data) || data.length === 0) {
                console.log('Nenhuma infração do Art. 29 encontrada');
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = 'Nenhuma infração encontrada';
                option.style.color = '#999';
                option.style.fontStyle = 'italic';
                dropdownContent.appendChild(option);
                return;
            }
            
            console.log(`Adicionando ${data.length} infrações do Art. 29 ao dropdown`);
            
            // Adicionar infrações ao dropdown
            data.forEach(infracao => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = `Art. 29, ${infracao.inciso} - ${infracao.texto}`;
                option.title = infracao.texto; // Tooltip com texto completo
                option.onclick = () => selecionarInfracaoArt29(infracao);
                dropdownContent.appendChild(option);
            });
            
            // Mostrar o dropdown após populá-lo
            dropdownContent.style.display = 'block';
            console.log('📋 Dropdown do Art. 29 exibido');
            
            // Focar no campo de busca
            searchInput.focus();
        })
        .catch(error => {
            console.error('Erro ao carregar infrações do Art. 29:', error);
            showAlert('Erro ao carregar infrações do Art. 29. Verifique a conexão.', 'error');
        });
}

// Função para carregar transgressões RDPM para analogia
function carregarTransgressoesParaAnalogia(natureza) {
    console.log('🔍 Carregando transgressões RDPM para analogia:', natureza);
    
    // Mapear natureza para gravidade
    const naturezaParaGravidade = {
        'Leve': 'leve',
        'Média': 'media', 
        'Grave': 'grave'
    };
    
    const gravidade = naturezaParaGravidade[natureza];
    if (!gravidade) {
        console.error('❌ Gravidade não encontrada para analogia:', natureza);
        return;
    }
    
    fetch(`/buscar_transgressoes?gravidade=${encodeURIComponent(gravidade)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados RDPM para analogia recebidos:', data);
            
            if (data.erro) {
                console.error('Erro do servidor:', data.erro);
                showAlert('Erro ao carregar transgressões RDPM: ' + data.erro, 'error');
                return;
            }
            
            const analogiaSearch = document.getElementById('analogia_search');
            const analogiaDropdown = document.getElementById('analogia_dropdown');
            
            if (!analogiaSearch || !analogiaDropdown) {
                console.error('Elementos de analogia não encontrados no DOM');
                return;
            }
            
            // Limpar dropdown anterior
            analogiaDropdown.innerHTML = '';
            
            // Habilitar campo de busca
            analogiaSearch.disabled = false;
            analogiaSearch.placeholder = 'Digite para filtrar transgressões RDPM...';
            
            // Verificar se há dados
            if (!Array.isArray(data) || data.length === 0) {
                console.log('Nenhuma transgressão RDPM encontrada para analogia');
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = 'Nenhuma transgressão encontrada';
                option.style.color = '#999';
                option.style.fontStyle = 'italic';
                analogiaDropdown.appendChild(option);
                return;
            }
            
            console.log(`Adicionando ${data.length} transgressões RDPM ao dropdown de analogia`);
            
            // Adicionar transgressões ao dropdown
            data.forEach(transgressao => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = `RDPM ${transgressao.inciso} - ${transgressao.texto}`;
                option.title = transgressao.texto; // Tooltip com texto completo
                option.onclick = () => confirmarAnalogiaRdpm(transgressao, gravidade);
                analogiaDropdown.appendChild(option);
            });
            
            // Mostrar o dropdown após populá-lo
            analogiaDropdown.style.display = 'block';
            console.log('📋 Dropdown de analogia RDMP exibido');
            
            // Focar no campo de busca
            analogiaSearch.focus();
        })
        .catch(error => {
            console.error('Erro ao carregar transgressões RDPM para analogia:', error);
            showAlert('Erro ao carregar transgressões RDPM. Verifique a conexão.', 'error');
        });
}

// Variável global para armazenar infração do Art. 29 temporariamente
let infracaoArt29Temporaria = null;

// Função para selecionar uma infração do Art. 29
function selecionarInfracaoArt29(infracao) {
    console.log('Selecionando infração do Art. 29:', infracao);
    
    // Armazenar temporariamente
    infracaoArt29Temporaria = infracao;
    
    // Ocultar dropdown principal
    const dropdown = document.getElementById('infracao_dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Mostrar seção de analogia
    const grupoAnalogia = document.getElementById('grupo_analogia_rdpm');
    if (grupoAnalogia) {
        grupoAnalogia.style.display = 'block';
    }
    
    // Atualizar campo de busca para mostrar seleção
    const searchInput = document.getElementById('infracao_search');
    if (searchInput) {
        searchInput.value = `Art. 29, ${infracao.inciso} - ${infracao.texto}`;
        searchInput.disabled = true;
    }
    
    console.log('Aguardando seleção de analogia RDPM...');
}

// Função para confirmar analogia com RDPM
function confirmarAnalogiaRdpm(transgressaoRdpm, naturezaRdpm) {
    console.log('Confirmando analogia:', { art29: infracaoArt29Temporaria, rdpm: transgressaoRdpm });
    
    if (!infracaoArt29Temporaria) {
        console.error('Nenhuma infração do Art. 29 selecionada');
        return;
    }
    
    // Criar objeto de transgressão completo
    const transgressaoCompleta = {
        id: infracaoArt29Temporaria.id,
        inciso: infracaoArt29Temporaria.inciso,
        texto: infracaoArt29Temporaria.texto,
        tipo: 'estatuto',
        rdmp_analogia: {
            id: transgressaoRdpm.id,
            inciso: transgressaoRdpm.inciso,
            texto: transgressaoRdpm.texto,
            natureza: naturezaRdpm
        }
    };
    
    // Adicionar à lista de transgressões selecionadas
    transgressoesSelecionadas.push(transgressaoCompleta);
    
    // Atualizar interface
    atualizarTransgressoesSelecionadas();
    
    // Limpar campos temporários
    infracaoArt29Temporaria = null;
    
    // Ocultar campo de busca e mostrar botão adicionar
    cancelarAdicaoTransgressao();
    
    console.log('Infração do Art. 29 com analogia RDPM adicionada:', transgressaoCompleta);
}

// ============================================
// FUNCIONALIDADE BUSCA LOCAL DOS FATOS
// ============================================

// Event listeners para o dropdown de busca de local dos fatos
document.addEventListener('DOMContentLoaded', function() {
    const localFatosInput = document.getElementById('local_fatos');
    const localFatosDropdown = document.getElementById('local_fatos_dropdown');
    
    if (localFatosInput && localFatosDropdown) {
        console.log('Configurando event listeners para dropdown de municípios');
        
        // Carregar municípios quando a página carrega
        carregarMunicipios();
        
        // Mostrar dropdown ao focar no campo de busca
        localFatosInput.addEventListener('focus', function() {
            console.log('Campo de município focado');
            if (localFatosDropdown.children.length > 0) {
                localFatosDropdown.style.display = 'block';
                console.log('🔍 Dropdown de municípios mostrado no foco');
            }
        });
        
        // Mostrar dropdown ao clicar no campo de busca
        localFatosInput.addEventListener('click', function() {
            console.log('Campo de município clicado');
            if (localFatosDropdown.children.length > 0) {
                localFatosDropdown.style.display = 'block';
                console.log('🔍 Dropdown de municípios mostrado no clique');
            }
        });
        
        // Filtrar municípios enquanto digita
        localFatosInput.addEventListener('input', function() {
            console.log('Input de município mudou, filtrando');
            filtrarMunicipios();
        });
        
        // Ocultar dropdown ao pressionar Escape
        localFatosInput.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                localFatosDropdown.style.display = 'none';
                console.log('Dropdown de municípios ocultado com Escape');
            }
        });
        
        // Ocultar dropdown ao clicar fora
        document.addEventListener('click', function(event) {
            // Não fechar se clicar no dropdown ou campo de busca
            if ((localFatosInput && localFatosInput.contains(event.target)) || 
                (localFatosDropdown && localFatosDropdown.contains(event.target))) {
                console.log('Clique dentro do dropdown/busca de municípios, mantendo dropdown');
                return;
            }
            
            console.log('Clique fora do dropdown de municípios, ocultando');
            if (localFatosDropdown) {
                localFatosDropdown.style.display = 'none';
            }
        });
    }
    
    // Event listener para o botão de indícios do PM principal
    const btnIndiciosPmPrincipal = document.getElementById('btnIndiciosPmPrincipal');
    if (btnIndiciosPmPrincipal) {
        btnIndiciosPmPrincipal.addEventListener('click', function() {
            abrirIndiciosPM(0, 'principal');
        });
    }
});

// ============================================
// FUNÇÕES PARA INTEGRAÇÃO COM MODAL DE INDÍCIOS POR PM
// ============================================

/**
 * Abre o modal de indícios para um PM específico
 * @param {number} index - Índice do PM (0 para principal, 1+ para adicionais)
 * @param {string} tipo - 'principal' ou 'adicional'
 */
async function abrirIndiciosPM(index, tipo) {
    console.log(`🔧 Abrindo indícios para PM ${tipo} index ${index}`);
    
    let pmId, pmNome, pmEnvolvidoId;
    
    if (tipo === 'principal') {
        pmId = document.getElementById('nome_pm').value;
        pmNome = document.getElementById('nome_pm_nome').value;
        
        if (!pmId || !pmNome) {
            showAlert('Primeiro selecione o PM principal antes de gerenciar seus indícios', 'warning');
            return;
        }
        
        // Para o PM principal, precisamos buscar ou criar o registro na tabela procedimento_pms_envolvidos
        if (modoEdicaoId) {
            // Em modo de edição, buscar o PM envolvido existente
            try {
                const resultado = await eel.listar_pms_envolvidos_com_indicios(modoEdicaoId)();
                if (resultado.sucesso && resultado.pms_envolvidos.length > 0) {
                    const pmPrincipalEncontrado = resultado.pms_envolvidos.find(pm => pm.ordem === 1);
                    if (pmPrincipalEncontrado) {
                        pmEnvolvidoId = pmPrincipalEncontrado.pm_envolvido_id;
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar PM principal:', error);
            }
        }
        
        if (!pmEnvolvidoId) {
            showAlert('PM principal não encontrado no procedimento. Salve o procedimento primeiro.', 'warning');
            return;
        }
    } else {
        // PM adicional
        if (!pmsAdicionais[index] || !pmsAdicionais[index].id) {
            showAlert('Primeiro selecione o PM adicional antes de gerenciar seus indícios', 'warning');
            return;
        }
        
        pmId = pmsAdicionais[index].id;
        pmNome = pmsAdicionais[index].nome;
        
        // Para PMs adicionais em modo de edição, buscar o pm_envolvido_id
        if (modoEdicaoId) {
            try {
                const resultado = await eel.listar_pms_envolvidos_com_indicios(modoEdicaoId)();
                if (resultado.sucesso) {
                    const pmAdicionalEncontrado = resultado.pms_envolvidos.find(pm => 
                        pm.pm_id === pmId && pm.ordem === (index + 2) // +2 porque index 0 = ordem 2
                    );
                    if (pmAdicionalEncontrado) {
                        pmEnvolvidoId = pmAdicionalEncontrado.pm_envolvido_id;
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar PM adicional:', error);
            }
        }
        
        if (!pmEnvolvidoId) {
            showAlert('PM adicional não encontrado no procedimento. Salve o procedimento primeiro.', 'warning');
            return;
        }
    }
    
    // Montar dados do PM para o modal
    const pmData = {
        id: pmId,
        nome_completo: pmNome,
        tipo: tipo,
        index: index
    };
    
    // Buscar dados existentes de indícios para este PM
    let dadosExistentes = null;
    if (indiciosPorPM && indiciosPorPM[pmId]) {
        dadosExistentes = indiciosPorPM[pmId];
        console.log(`📋 Encontrados dados existentes para PM ${pmNome}:`, dadosExistentes);
    }
    
    // Abrir modal passando dados existentes se houver
    if (window.modalIndiciosSolucao) {
        await window.modalIndiciosSolucao.abrir(pmId, dadosExistentes);
    } else {
        console.error('❌ Modal de indícios não está disponível');
        showAlert('Modal de indícios não está disponível', 'error');
    }
}

/**
 * Atualiza a visualização dos PMs envolvidos (callback do modal)
 */
async function atualizarVisualizacaoPMsEnvolvidos() {
    console.log('🔄 Atualizando visualização dos PMs envolvidos');
    
    if (!modoEdicaoId) return;
    
    try {
        const resultado = await eel.listar_pms_envolvidos_com_indicios(modoEdicaoId)();
        if (resultado.sucesso) {
            // Atualizar indicadores visuais dos indícios
            resultado.pms_envolvidos.forEach(pm => {
                const totalIndicios = pm.resumo_indicios.total;
                let badge = '';
                
                if (totalIndicios > 0) {
                    badge = `<span class="badge bg-info ms-2">${totalIndicios} indícios</span>`;
                }
                
                // Atualizar PM principal
                if (pm.ordem === 1) {
                    const btnIndiciosPrincipal = document.getElementById('btnIndiciosPmPrincipal');
                    if (btnIndiciosPrincipal) {
                        if (totalIndicios > 0) {
                            btnIndiciosPrincipal.innerHTML = `<i class="fas fa-search-plus"></i> ${totalIndicios} Indícios`;
                            btnIndiciosPrincipal.style.background = '#28a745';
                        } else {
                            btnIndiciosPrincipal.innerHTML = `<i class="fas fa-search-plus"></i> Indícios`;
                            btnIndiciosPrincipal.style.background = '#17a2b8';
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Erro ao atualizar visualização dos PMs:', error);
    }
}

/**
 * Mostra/esconde o botão de indícios do PM principal conforme necessário
 */
function toggleBotaoIndiciosPmPrincipal(mostrar) {
    const btnIndicios = document.getElementById('btnIndiciosPmPrincipal');
    if (btnIndicios) {
        btnIndicios.style.display = mostrar ? 'block' : 'none';
    }
}

// Expor função globalmente para callback do modal
window.atualizarVisualizacaoPMsEnvolvidos = atualizarVisualizacaoPMsEnvolvidos;
