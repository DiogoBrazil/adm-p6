// Verificação de segurança: só executa se estiver na página correta
if (document.title.includes('Transgressão') || document.getElementById('transgressaoForm')) {

// Variáveis globais
let usuarioLogado = null;
let modoEdicao = false;
let transgressaoId = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Inicializar sistema de permissões
    if (window.permissoes) {
        await window.permissoes.inicializar();
    }
    
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        return; // Para a execução se não estiver autenticado
    }
    
    inicializarFormulario();
    verificarModoEdicao();
});

async function verificarAutenticacao() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            
            if (userNameElement) userNameElement.textContent = usuarioLogado.nome;
            if (userEmailElement) userEmailElement.textContent = usuarioLogado.email;
            
            return true;
        } else {
            console.log('Usuário não está logado, redirecionando...');
            window.stop();
            window.location.replace('login.html');
            return false;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.replace('login.html');
        return false;
    }
}

function inicializarFormulario() {
    const form = document.getElementById('transgressaoForm');
    if (!form) {
        console.error('Formulário não encontrado');
        return;
    }
    
    // Evento de submit do formulário
    form.addEventListener('submit', handleSubmit);
    
    // Modal de feedback
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', fecharModalFeedback);
    }
    
    // Inicializar validações de campos
    inicializarValidacoesCampos();
    
    console.log('✅ Formulário inicializado com sucesso');
}

function inicializarValidacoesCampos() {
    // Campo Inciso - números romanos maiúsculos
    const incisoInput = document.getElementById('inciso');
    if (incisoInput) {
        incisoInput.addEventListener('input', function(e) {
            // Remove tudo que não for I, V, X, L, C, D, M
            let value = e.target.value.replace(/[^IVXLCDMivxlcdm]/g, '');
            // Converte para maiúscula
            value = value.toUpperCase();
            e.target.value = value;
            
            // Validação visual
            if (value === '' || /^[IVXLCDM]+$/.test(value)) {
                if (value) setFieldValidation(e.target, true, 'Formato válido');
                else clearFieldValidation(e.target);
            } else {
                setFieldValidation(e.target, false, 'Apenas números romanos (I, V, X, L, C, D, M)');
            }
        });
        
        incisoInput.addEventListener('keypress', function(e) {
            // Permite apenas números romanos
            if (!/[IVXLCDMivxlcdm]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
}

function setFieldValidation(field, isValid, message) {
    // Remove classes anteriores
    field.classList.remove('valid', 'invalid');
    
    // Adiciona nova classe
    field.classList.add(isValid ? 'valid' : 'invalid');
    
    // Remove mensagem anterior
    const existingMsg = field.parentNode.querySelector('.validation-message');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    // Adiciona nova mensagem
    if (message) {
        const msgElement = document.createElement('span');
        msgElement.className = `validation-message ${isValid ? 'valid' : 'invalid'}`;
        msgElement.textContent = message;
        field.parentNode.appendChild(msgElement);
    }
}

function clearFieldValidation(field) {
    field.classList.remove('valid', 'invalid');
    const existingMsg = field.parentNode.querySelector('.validation-message');
    if (existingMsg) {
        existingMsg.remove();
    }
}

function verificarModoEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        modoEdicao = true;
        transgressaoId = id;
        document.getElementById('formTitle').textContent = 'Editar Transgressão Disciplinar';
        document.getElementById('btnSalvar').innerHTML = '<i class="fas fa-save"></i> Atualizar';
        carregarTransgressaoParaEdicao(id);
    }
}

async function carregarTransgressaoParaEdicao(id) {
    try {
        console.log(`🔍 Carregando transgressão para edição: ${id}`);
        
        const resultado = await eel.obter_transgressao_por_id(id)();
        
        if (resultado.success) {
            const transgressao = resultado.data;
            
            // Preencher o formulário
            document.getElementById('transgressaoId').value = transgressao.id;
            document.getElementById('artigo').value = transgressao.artigo;
            document.getElementById('inciso').value = transgressao.inciso;
            document.getElementById('texto').value = transgressao.texto;
            document.getElementById('ativo').checked = transgressao.ativo;
            
            console.log('✅ Transgressão carregada para edição');
        } else {
            console.error('Erro ao carregar transgressão:', resultado.error);
            showAlert('Erro ao carregar transgressão: ' + resultado.error, 'error');
            setTimeout(() => voltarParaLista(), 2000);
        }
    } catch (error) {
        console.error('Erro ao carregar transgressão:', error);
        showAlert('Erro ao carregar transgressão. Redirecionando...', 'error');
        setTimeout(() => voltarParaLista(), 2000);
    }
}

// ============================================
// SUBMISSÃO DO FORMULÁRIO
// ============================================

async function handleSubmit(event) {
    event.preventDefault();
    
    const btnSalvar = document.getElementById('btnSalvar');
    const originalText = btnSalvar.innerHTML;
    
    try {
        // Loading state
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        // Coletar dados do formulário
        const artigo = document.getElementById('artigo').value.trim();
        
        // Calcular gravidade baseada no artigo
        const artigoParaGravidade = {
            '15': 'leve',
            '16': 'media',
            '17': 'grave'
        };
        
        const dadosTransgressao = {
            artigo: parseInt(artigo),
            gravidade: artigoParaGravidade[artigo],
            inciso: document.getElementById('inciso').value.trim(),
            texto: document.getElementById('texto').value.trim(),
            ativo: document.getElementById('ativo').checked
        };
        
        // Validações básicas
        if (!dadosTransgressao.artigo || !dadosTransgressao.inciso || !dadosTransgressao.texto) {
            showModalFeedback('Por favor, preencha todos os campos obrigatórios.', 'error', 2000);
            return;
        }
        
        // Validação de duplicata - verificar se já existe transgressão com mesma gravidade e inciso
        if (!modoEdicao) {
            const duplicataExiste = await verificarDuplicataTransgressao(dadosTransgressao.gravidade, dadosTransgressao.inciso);
            if (duplicataExiste) {
                showModalFeedback(`❌ Já existe uma transgressão no artigo ${artigo} com inciso ${dadosTransgressao.inciso}. Por favor, verifique os dados informados.`, 'error', 2000);
                return;
            }
        } else {
            // No modo edição, verificar duplicata excluindo o próprio registro
            const duplicataExiste = await verificarDuplicataTransgressaoEdicao(
                dadosTransgressao.gravidade, 
                dadosTransgressao.inciso, 
                document.getElementById('transgressaoId').value
            );
            if (duplicataExiste) {
                showModalFeedback(`❌ Já existe outra transgressão no artigo ${artigo} com inciso ${dadosTransgressao.inciso}. Por favor, verifique os dados informados.`, 'error', 2000);
                return;
            }
        }
        
        let resultado;
        
        if (modoEdicao) {
            dadosTransgressao.id = document.getElementById('transgressaoId').value;
            console.log('📝 Atualizando transgressão:', dadosTransgressao);
            resultado = await eel.atualizar_transgressao(dadosTransgressao)();
        } else {
            console.log('📝 Cadastrando nova transgressão:', dadosTransgressao);
            resultado = await eel.cadastrar_transgressao(dadosTransgressao)();
        }
        
        if (resultado.success) {
            const acao = modoEdicao ? 'atualizada' : 'cadastrada';
            showModalFeedback(`✅ Transgressão ${acao} com sucesso!`, 'success', 2000);
            
            // Aguardar um pouco e redirecionar
            setTimeout(() => {
                voltarParaLista();
            }, 2500);
        } else {
            showModalFeedback('Erro: ' + resultado.error, 'error', 2000);
        }
        
    } catch (error) {
        console.error('Erro ao salvar transgressão:', error);
        showModalFeedback('Erro ao salvar transgressão. Tente novamente.', 'error', 2000);
    } finally {
        // Restaurar estado do botão
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = originalText;
    }
}

// ============================================
// UTILITÁRIOS
// ============================================

function voltarParaLista() {
    window.location.href = 'transgressao_list.html';
}

function showAlert(message, type = 'info', duration = 3000) {
    console.log(`📢 Alert: ${type.toUpperCase()} - ${message}`);
    
    const alertContainer = document.getElementById('alertContainer');
    const alertClass = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-danger' : 'alert-info';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
            <button type="button" class="btn-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Remove alerta após 5 segundos
    setTimeout(() => {
        const alert = alertContainer.querySelector('.alert');
        if (alert) alert.remove();
    }, 5000);
}

function showModalFeedback(message, type = 'info', duration = 2000) {
    console.log(`📢 Modal Feedback: ${type.toUpperCase()} - ${message}`);
    
    const modal = document.getElementById('modalFeedback');
    const icon = document.getElementById('modalIcon');
    const messageElement = document.getElementById('modalMessage');
    const closeBtn = document.getElementById('modalCloseBtn');
    
    if (!modal || !icon || !messageElement || !closeBtn) {
        console.log('Elementos do modal não encontrados, usando alert nativo');
        alert(message);
        return;
    }
    
    // Configurar ícone e cor baseado no tipo
    let iconClass = 'fas fa-info-circle';
    let iconColor = '#17a2b8';
    
    if (type === 'success') {
        iconClass = 'fas fa-check-circle';
        iconColor = '#28a745';
    } else if (type === 'error' || type === 'danger') {
        iconClass = 'fas fa-exclamation-triangle';
        iconColor = '#dc3545';
    } else if (type === 'warning') {
        iconClass = 'fas fa-exclamation-circle';
        iconColor = '#ffc107';
    }
    
    icon.innerHTML = `<i class="${iconClass}" style="color: ${iconColor}; font-size: 2rem;"></i>`;
    messageElement.textContent = message;
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Auto fechar após duração especificada (padrão 2 segundos)
    if (duration > 0) {
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        }, duration);
    }
    
    // Evento de fechar manual
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Fechar ao clicar fora do modal
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function fecharModalFeedback() {
    const modal = document.getElementById('modalFeedback');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function realizarLogout() {
    const showConfirm = (title, message, onConfirm) => {
        let modal = document.getElementById('confirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'modal-feedback';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div><i class="fas fa-exclamation-triangle" style="color:#dc3545;"></i></div>
                    </div>
                    <div class="modal-body">
                        <h3 id="confirmTitle" style="margin-bottom:10px;">${title}</h3>
                        <p id="confirmMessage">${message}</p>
                    </div>
                    <div class="modal-actions">
                        <button id="confirmCancel" class="btn-secondary">Cancelar</button>
                        <button id="confirmOk" class="btn-danger">Sair</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        } else {
            modal.querySelector('#confirmTitle').textContent = title;
            modal.querySelector('#confirmMessage').textContent = message;
        }
        modal.style.display = 'flex';
        const cancelBtn = modal.querySelector('#confirmCancel');
        const okBtn = modal.querySelector('#confirmOk');
        const close = () => (modal.style.display = 'none');
        cancelBtn.onclick = close;
        okBtn.onclick = () => { close(); onConfirm(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };
    };

    showConfirm('Confirmar Logout', 'Tem certeza que deseja encerrar a sessão?', async () => {
        const start = Date.now();
        try { await eel.fazer_logout()(); } catch (e) { console.warn('logout falhou, prosseguindo'); }
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'flex';
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 1000 - elapsed);
        setTimeout(() => { window.location.href = 'login.html'; }, wait);
    });
}

// ============================================
// VALIDAÇÕES ESPECÍFICAS
// ============================================

async function verificarDuplicataTransgressao(gravidade, inciso) {
    try {
        console.log(`🔍 Verificando duplicata: ${gravidade} - ${inciso}`);
        
        // Usando a função existente para listar todas as transgressões
        const resultado = await eel.listar_todas_transgressoes()();
        
        if (resultado.success) {
            const transgressoes = resultado.data || [];
            
            // Verificar se existe alguma transgressão com a mesma gravidade e inciso
            const duplicata = transgressoes.find(t => 
                t.gravidade.toLowerCase() === gravidade.toLowerCase() && 
                t.inciso.toUpperCase() === inciso.toUpperCase()
            );
            
            if (duplicata) {
                console.log(`❌ Duplicata encontrada: ID ${duplicata.id}`);
                return true;
            }
            
            console.log(`✅ Nenhuma duplicata encontrada`);
            return false;
        } else {
            console.error('Erro ao verificar duplicatas:', resultado.error);
            return false; // Em caso de erro, permite continuar
        }
    } catch (error) {
        console.error('Erro ao verificar duplicata:', error);
        return false; // Em caso de erro, permite continuar
    }
}

async function verificarDuplicataTransgressaoEdicao(gravidade, inciso, idAtual) {
    try {
        console.log(`🔍 Verificando duplicata para edição: ${gravidade} - ${inciso} (excluindo ID ${idAtual})`);
        
        // Usando a função existente para listar todas as transgressões
        const resultado = await eel.listar_todas_transgressoes()();
        
        if (resultado.success) {
            const transgressoes = resultado.data || [];
            
            // Verificar se existe alguma transgressão com a mesma gravidade e inciso, excluindo o registro atual
            const duplicata = transgressoes.find(t => 
                t.id != idAtual && // Excluir o próprio registro
                t.gravidade.toLowerCase() === gravidade.toLowerCase() && 
                t.inciso.toUpperCase() === inciso.toUpperCase()
            );
            
            if (duplicata) {
                console.log(`❌ Duplicata encontrada: ID ${duplicata.id}`);
                return true;
            }
            
            console.log(`✅ Nenhuma duplicata encontrada`);
            return false;
        } else {
            console.error('Erro ao verificar duplicatas:', resultado.error);
            return false; // Em caso de erro, permite continuar
        }
    } catch (error) {
        console.error('Erro ao verificar duplicata:', error);
        return false; // Em caso de erro, permite continuar
    }
}

// ============================================
// VERIFICAÇÃO DE SEGURANÇA
// ============================================

} // Fim da verificação de segurança
