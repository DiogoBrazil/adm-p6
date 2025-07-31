// Variável para usuário logado
let usuarioLogado = null;
let editandoProcedimento = null;

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
    
    if (procedimentoId) {
        try {
            const procedimento = await eel.obter_processo(procedimentoId)();
            if (procedimento) {
                editandoProcedimento = procedimento;
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
            } else {
                showAlert('Procedimento não encontrado!', 'error');
                setTimeout(() => {
                    window.location.href = 'procedure_list.html';
                }, 2000);
            }
        } catch (error) {
            console.error('Erro ao carregar procedimento:', error);
            showAlert('Erro ao carregar dados do procedimento!', 'error');
        }
    }
}

// Função para preencher formulário com dados do procedimento
async function preencherFormularioEdicao(procedimento) {
    // Preencher campos básicos
    document.getElementById('numero_rgf').value = procedimento.numero_rgf || '';
    document.getElementById('tipo_geral').value = procedimento.tipo_geral || '';
    document.getElementById('documento_iniciador').value = procedimento.documento_iniciador || '';
    document.getElementById('processo_sei').value = procedimento.processo_sei || '';

    // Novos campos
    if (document.getElementById('local_origem')) document.getElementById('local_origem').value = procedimento.local_origem || '';
    if (document.getElementById('data_instauracao')) document.getElementById('data_instauracao').value = procedimento.data_instauracao || '';
    if (document.getElementById('data_recebimento')) document.getElementById('data_recebimento').value = procedimento.data_recebimento || '';
    if (document.getElementById('escrivao_id')) document.getElementById('escrivao_id').value = procedimento.escrivao_id || '';
    if (document.getElementById('escrivao_nome')) document.getElementById('escrivao_nome').value = procedimento.escrivao_nome || '';
    if (document.getElementById('status_pm')) document.getElementById('status_pm').value = procedimento.status_pm || '';
    if (document.getElementById('nome_pm')) document.getElementById('nome_pm').value = procedimento.nome_pm_id || '';
    if (document.getElementById('nome_pm_nome')) document.getElementById('nome_pm_nome').value = procedimento.nome_pm_nome || '';
    if (document.getElementById('nome_vitima')) document.getElementById('nome_vitima').value = procedimento.nome_vitima || '';
    if (document.getElementById('natureza_processo')) document.getElementById('natureza_processo').value = procedimento.natureza_processo || '';
    if (document.getElementById('natureza_procedimento')) document.getElementById('natureza_procedimento').value = procedimento.natureza_procedimento || '';
    if (document.getElementById('resumo_fatos')) document.getElementById('resumo_fatos').value = procedimento.resumo_fatos || '';
    if (document.getElementById('numero_portaria')) document.getElementById('numero_portaria').value = procedimento.numero_portaria || '';
    if (document.getElementById('numero_memorando')) document.getElementById('numero_memorando').value = procedimento.numero_memorando || '';
    if (document.getElementById('numero_feito')) document.getElementById('numero_feito').value = procedimento.numero_feito || '';
    
    // Preencher campos de responsável
    if (procedimento.responsavel_id) {
        document.getElementById('responsavel_id').value = procedimento.responsavel_id || '';
        document.getElementById('responsavel_nome').value = procedimento.responsavel || '';
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

    // Preencher responsável
    if (procedimento.responsavel_id && procedimento.responsavel_tipo) {
        if (document.getElementById('responsavel')) document.getElementById('responsavel').value = procedimento.responsavel_id;
        if (document.getElementById('responsavel_nome')) document.getElementById('responsavel_nome').value = procedimento.responsavel_nome || '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados do usuário logado primeiro
    const loginOk = await carregarUsuarioLogado();
    if (loginOk) {
        await verificarEdicao();
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
        nomePm: document.getElementById('group_nome_pm'),
        nomeVitima: document.getElementById('group_nome_vitima'),
        naturezaProcesso: document.getElementById('group_natureza_processo'),
        naturezaProcedimento: document.getElementById('group_natureza_procedimento'),
    };

    // Mapeamento dos campos de input/select
    const fields = {
        tipoGeral: document.getElementById('tipo_geral'),
        tipoProcedimento: document.getElementById('tipo_procedimento'),
        tipoProcesso: document.getElementById('tipo_processo'),
        documentoIniciador: document.getElementById('documento_iniciador'),
        statusPm: document.getElementById('status_pm'),
        labelNomePm: document.getElementById('label_nome_pm'),
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
        toggleGroup(fieldGroups.nomeVitima, tipoGeral === 'procedimento');

        // Lógica para Escrivão (se Procedimento for IPM)
        toggleGroup(fieldGroups.escrivao, tipoGeral === 'procedimento' && tipoProcedimento === 'IPM');

        // 2. Lógica para Natureza (depende do Tipo de Cadastro e Tipo de Processo)
        const showNaturezaProcesso = tipoGeral === 'processo' && tipoProcesso === 'PADS';
        const showNaturezaProcedimento = tipoGeral === 'procedimento';
        toggleGroup(fieldGroups.naturezaProcesso, showNaturezaProcesso);
        toggleGroup(fieldGroups.naturezaProcedimento, showNaturezaProcedimento);

        // 3. Lógica para Documento que Iniciou
        toggleGroup(fieldGroups.numeroPortaria, documentoIniciador === 'Portaria');
        toggleGroup(fieldGroups.numeroMemorando, documentoIniciador === 'Memorando Disciplinar');
        toggleGroup(fieldGroups.numeroFeito, documentoIniciador === 'Feito Preliminar');

        // 4. Lógica para Status do PM Envolvido
        const showNomePm = statusPm !== '';
        toggleGroup(fieldGroups.nomePm, showNomePm);
        if (showNomePm) {
            fields.labelNomePm.textContent = `Nome do ${statusPm} *`;
        }
    }

    // Adiciona 'data-required' aos campos que são obrigatórios condicionalmente
    // para que a função toggleGroup saiba quando aplicar 'required'
    document.querySelectorAll('#group_tipo_procedimento select, #group_tipo_processo select, #group_escrivao select, #group_numero_portaria input, #group_numero_memorando input, #group_numero_feito input, #group_nome_pm input, #group_natureza_processo select, #group_natureza_procedimento select').forEach(el => {
        el.setAttribute('data-required', 'true');
    });


    // Adicionar event listeners para os campos que controlam a visibilidade
    if (fields.tipoGeral) fields.tipoGeral.addEventListener('change', updateFormVisibility);
    if (fields.tipoProcedimento) fields.tipoProcedimento.addEventListener('change', updateFormVisibility);
    if (fields.tipoProcesso) fields.tipoProcesso.addEventListener('change', updateFormVisibility);
    if (fields.documentoIniciador) fields.documentoIniciador.addEventListener('change', updateFormVisibility);
    if (fields.statusPm) fields.statusPm.addEventListener('change', updateFormVisibility);

    // Chamar a função uma vez no início para configurar o estado inicial do formulário
    updateFormVisibility();

    // --- MODAL DE BUSCA DE USUÁRIO ---
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

    document.getElementById('btnExecutarBuscaUsuario').onclick = buscarUsuariosModal;
    document.getElementById('inputBuscaUsuario').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') buscarUsuariosModal();
    });

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
                    document.getElementById('nome_pm_nome').value = texto;
                    document.getElementById('nome_pm').value = id;
                }
                fecharModalBuscaUsuario();
            };
        });
    }
});

// --- FIM MODAL DE BUSCA DE USUÁRIO ---

document.getElementById('processForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
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
    const data_instauracao = document.getElementById('data_instauracao')?.value || null;
    const data_recebimento = document.getElementById('data_recebimento')?.value || null;
    const escrivao_id = document.getElementById('escrivao_id')?.value || null;
    const status_pm = document.getElementById('status_pm')?.value || null;
    const nome_pm_id = document.getElementById('nome_pm')?.value || null;
    const nome_vitima = document.getElementById('nome_vitima')?.value || null;
    const natureza_processo = document.getElementById('natureza_processo')?.value || null;
    const natureza_procedimento = document.getElementById('natureza_procedimento')?.value || null;
    const resumo_fatos = document.getElementById('resumo_fatos')?.value || null;
    const numero_portaria = document.getElementById('numero_portaria')?.value || null;
    const numero_memorando = document.getElementById('numero_memorando')?.value || null;
    const numero_feito = document.getElementById('numero_feito')?.value || null;

    // Determinar o número do documento baseado no tipo de documento iniciador
    let numero_documento = '';
    if (documento_iniciador === 'Portaria' && numero_portaria) {
        numero_documento = numero_portaria.trim();
    } else if (documento_iniciador === 'Memorando Disciplinar' && numero_memorando) {
        numero_documento = numero_memorando.trim();
    } else if (documento_iniciador === 'Feito Preliminar' && numero_feito) {
        numero_documento = numero_feito.trim();
    }

    // Validação básica
    if (!numero_rgf || !tipo_geral || !tipo_detalhe || !documento_iniciador || !responsavel_id || !numero_documento) {
        showAlert('Por favor, preencha todos os campos obrigatórios!', 'error');
        return;
    }

    try {
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
                numero_rgf
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
                numero_rgf
            )();
        }

        if (result.sucesso) {
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
