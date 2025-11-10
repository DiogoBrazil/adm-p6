/**
 * Sistema de Permissões de Usuário
 * Gerencia diferenciação entre Admin e Operador Comum
 */

// Variável global para armazenar o usuário logado (namespace permissions)
let _permissoesUsuarioLogado = null;

/**
 * Carrega e armazena informações do usuário logado (permissions.js)
 * @returns {Promise<Object>} Dados do usuário logado
 */
async function _permissoesCarregarUsuario() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado && resultado.logado) {
            _permissoesUsuarioLogado = resultado.usuario;
            return resultado.usuario;
        }
        return null;
    } catch (error) {
        console.error('❌ [Permissions] Erro ao carregar usuário logado:', error);
        return null;
    }
}

/**
 * Verifica se o usuário é administrador
 * @returns {boolean} true se for administrador
 */
function isAdmin() {
    if (!_permissoesUsuarioLogado) {
        return false;
    }
    
    // Verifica se o usuário tem perfil de administrador
    // O campo perfil é uma string: "admin" ou "comum"
    return _permissoesUsuarioLogado.perfil === 'admin';
}

/**
 * Verifica se o usuário é operador comum (apenas leitura)
 * @returns {boolean} true se for operador comum
 */
function isOperadorComum() {
    if (!_permissoesUsuarioLogado) {
        return false;
    }
    
    // É operador comum se o perfil é "comum" e é operador
    return _permissoesUsuarioLogado.perfil === 'comum' && 
           _permissoesUsuarioLogado.is_operador === true;
}

/**
 * Verifica se o usuário tem permissão de escrita
 * @returns {boolean} True se tiver permissão de escrita
 */
function temPermissaoEscrita() {
    return isAdmin();
}

/**
 * Verifica se o usuário tem permissão de leitura
 * @returns {boolean} True se tiver permissão de leitura
 */
function temPermissaoLeitura() {
    return _permissoesUsuarioLogado !== null;
}

/**
 * Desabilita botões de ação para operadores comuns
 * Oculta botões de criar, editar, deletar, etc.
 */
function aplicarPermissoesInterface() {
    if (isOperadorComum()) {
        // Desabilitar botões de criar
        const botoesCreate = document.querySelectorAll(
            '.btn-create, .btn-novo, [onclick*="criar"], [onclick*="novo"], ' +
            'button[type="submit"]:not(.btn-search):not(.btn-filter)'
        );
        botoesCreate.forEach(btn => {
            btn.style.display = 'none';
        });

        // Desabilitar botões de editar
        const botoesEdit = document.querySelectorAll(
            '.btn-edit, .btn-editar, [onclick*="editar"], [onclick*="edit"], ' +
            '.fa-edit, .bi-pencil'
        );
        botoesEdit.forEach(btn => {
            const parent = btn.closest('button, a');
            if (parent) {
                parent.style.display = 'none';
            } else {
                btn.style.display = 'none';
            }
        });

        // Desabilitar botões de deletar
        const botoesDelete = document.querySelectorAll(
            '.btn-delete, .btn-deletar, .btn-excluir, [onclick*="deletar"], ' +
            '[onclick*="excluir"], [onclick*="delete"], .fa-trash, .bi-trash'
        );
        botoesDelete.forEach(btn => {
            const parent = btn.closest('button, a');
            if (parent) {
                parent.style.display = 'none';
            } else {
                btn.style.display = 'none';
            }
        });

        // Ocultar itens do menu que são apenas para admin
        const menuAdminOnly = document.querySelectorAll('.menu-admin-only');
        menuAdminOnly.forEach(item => {
            item.style.display = 'none';
        });

        // Adicionar indicador visual de modo leitura
        adicionarIndicadorModoLeitura();
    }
}

/**
 * Adiciona indicador visual de que o usuário está em modo leitura
 */
function adicionarIndicadorModoLeitura() {
    // Verificar se já existe
    if (document.getElementById('modoLeituraIndicador')) {
        return;
    }

    const indicador = document.createElement('div');
    indicador.id = 'modoLeituraIndicador';
    indicador.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
        color: #000;
        padding: 8px 15px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    indicador.innerHTML = '<i class="fas fa-eye"></i> Modo Leitura';
    document.body.appendChild(indicador);
}

/**
 * Bloqueia formulários de edição para operadores comuns
 */
function bloquearFormulariosEdicao() {
    if (isOperadorComum()) {
        const formularios = document.querySelectorAll('form');
        formularios.forEach(form => {
            // Desabilitar todos os inputs, exceto os de busca
            const inputs = form.querySelectorAll('input:not([type="search"]), textarea, select');
            inputs.forEach(input => {
                // Não desabilitar campos de filtro/busca
                if (!input.closest('.filtros-container') && 
                    !input.closest('.search-container') &&
                    !input.classList.contains('search-input')) {
                    input.setAttribute('readonly', 'readonly');
                    input.style.cursor = 'not-allowed';
                    input.style.backgroundColor = '#f5f5f5';
                }
            });

            // Desabilitar botões de submit
            const submitButtons = form.querySelectorAll('button[type="submit"]');
            submitButtons.forEach(btn => {
                if (!btn.classList.contains('btn-search') && !btn.classList.contains('btn-filter')) {
                    btn.style.display = 'none';
                }
            });
        });
    }
}

/**
 * Previne ações de escrita via JavaScript
 * Intercepta clicks em botões de ação
 */
function prevenirAcoesEscrita() {
    if (isOperadorComum()) {
        document.addEventListener('click', function(e) {
            const target = e.target.closest('button, a');
            if (!target) return;

            const onClick = target.getAttribute('onclick') || '';
            const acoesProibidas = [
                'criar', 'novo', 'editar', 'edit', 'atualizar', 'update',
                'deletar', 'excluir', 'delete', 'salvar', 'save'
            ];

            const temAcaoProibida = acoesProibidas.some(acao => 
                onClick.toLowerCase().includes(acao) ||
                target.textContent.toLowerCase().includes(acao) ||
                target.classList.toString().toLowerCase().includes(acao)
            );

            if (temAcaoProibida) {
                e.preventDefault();
                e.stopPropagation();
                mostrarAlertaPermissao();
                return false;
            }
        }, true);
    }
}

/**
 * Mostra alerta de falta de permissão
 */
function mostrarAlertaPermissao() {
    const alerta = document.createElement('div');
    alerta.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        text-align: center;
        min-width: 300px;
    `;
    alerta.innerHTML = `
        <i class="fas fa-lock" style="font-size: 48px; color: #ffc107; margin-bottom: 15px;"></i>
        <h3 style="margin: 0 0 10px 0; color: #333;">Sem Permissão</h3>
        <p style="margin: 0 0 20px 0; color: #666;">
            Você tem apenas permissão de leitura.<br>
            Entre em contato com o administrador para realizar alterações.
        </p>
        <button onclick="this.parentElement.remove()" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 25px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        ">Entendi</button>
    `;
    document.body.appendChild(alerta);

    setTimeout(() => {
        if (alerta.parentElement) {
            alerta.remove();
        }
    }, 5000);
}

/**
 * Inicializa o sistema de permissões
 * Deve ser chamado no DOMContentLoaded de cada página
 */
async function inicializarPermissoes() {
    // Verificar se eel está disponível
    if (typeof eel === 'undefined') {
        console.error('❌ Sistema de permissões: Eel não disponível');
        return;
    }
    
    await _permissoesCarregarUsuario();
    
    if (isOperadorComum()) {
        console.log('👁️ Modo leitura ativado');
        
        // Aplicar restrições após pequeno delay para garantir que o DOM esteja pronto
        setTimeout(() => {
            aplicarPermissoesInterface();
            bloquearFormulariosEdicao();
            prevenirAcoesEscrita();
        }, 100);
    }
}

// Exportar funções para uso global
window.permissoes = {
    inicializar: inicializarPermissoes,
    isAdmin,
    isOperadorComum,
    temPermissaoEscrita,
    temPermissaoLeitura,
    getUsuario: () => _permissoesUsuarioLogado
};
