// alerts.js - Sistema de alertas e notificações

/**
 * Mostra alerta de sucesso
 * @param {string} message - Mensagem para exibir
 * @param {number} duration - Duração em ms (padrão: 3000)
 */
function showSuccess(message, duration = 3000) {
    showAlert(message, 'success', duration);
}

/**
 * Mostra alerta de erro
 * @param {string} message - Mensagem para exibir
 * @param {number} duration - Duração em ms (padrão: 5000)
 */
function showError(message, duration = 5000) {
    showAlert(message, 'error', duration);
}

/**
 * Mostra alerta de aviso
 * @param {string} message - Mensagem para exibir
 * @param {number} duration - Duração em ms (padrão: 4000)
 */
function showWarning(message, duration = 4000) {
    showAlert(message, 'warning', duration);
}

/**
 * Mostra alerta de informação
 * @param {string} message - Mensagem para exibir
 * @param {number} duration - Duração em ms (padrão: 3000)
 */
function showInfo(message, duration = 3000) {
    showAlert(message, 'info', duration);
}

/**
 * Função principal para mostrar alertas
 * @param {string} message - Mensagem
 * @param {string} type - Tipo (success, error, warning, info)
 * @param {number} duration - Duração em ms
 */
function showAlert(message, type = 'info', duration = 3000) {
    // Remove alertas existentes
    const existingAlerts = document.querySelectorAll('.custom-alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Cria o alerta
    const alert = document.createElement('div');
    alert.className = `custom-alert custom-alert-${type}`;
    
    // Define ícone baseado no tipo
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    alert.innerHTML = `
        <div class="custom-alert-content">
            <i class="fas ${icon}"></i>
            <span>${message}</span>
            <button class="custom-alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="custom-alert-progress"></div>
    `;
    
    // Adiciona ao body
    document.body.appendChild(alert);
    
    // Anima entrada
    setTimeout(() => alert.classList.add('show'), 10);
    
    // Anima barra de progresso
    const progress = alert.querySelector('.custom-alert-progress');
    progress.style.animation = `alertProgress ${duration}ms linear forwards`;
    
    // Remove após duração
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 300);
    }, duration);
}

/**
 * Mostra modal de confirmação
 * @param {string} message - Mensagem
 * @param {Function} onConfirm - Callback ao confirmar
 * @param {Function} onCancel - Callback ao cancelar (opcional)
 */
function showConfirm(message, onConfirm, onCancel = null) {
    const modal = document.createElement('div');
    modal.className = 'custom-confirm-modal';
    modal.innerHTML = `
        <div class="custom-confirm-overlay"></div>
        <div class="custom-confirm-dialog">
            <div class="custom-confirm-header">
                <i class="fas fa-question-circle"></i>
                <h3>Confirmação</h3>
            </div>
            <div class="custom-confirm-body">
                <p>${message}</p>
            </div>
            <div class="custom-confirm-footer">
                <button class="btn btn-secondary btn-cancel">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="btn btn-primary btn-confirm">
                    <i class="fas fa-check"></i> Confirmar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const btnConfirm = modal.querySelector('.btn-confirm');
    const btnCancel = modal.querySelector('.btn-cancel');
    const overlay = modal.querySelector('.custom-confirm-overlay');
    
    const closeModal = () => {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 300);
    };
    
    btnConfirm.addEventListener('click', () => {
        if (onConfirm) onConfirm();
        closeModal();
    });
    
    btnCancel.addEventListener('click', () => {
        if (onCancel) onCancel();
        closeModal();
    });
    
    overlay.addEventListener('click', () => {
        if (onCancel) onCancel();
        closeModal();
    });
    
    // Anima entrada
    setTimeout(() => modal.classList.add('show'), 10);
}

/**
 * Mostra loading spinner
 * @param {string} message - Mensagem (opcional)
 * @returns {Object} Objeto com método hide() para esconder
 */
function showLoading(message = 'Carregando...') {
    const loading = document.createElement('div');
    loading.className = 'custom-loading';
    loading.innerHTML = `
        <div class="custom-loading-overlay"></div>
        <div class="custom-loading-content">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">${message}</p>
        </div>
    `;
    
    document.body.appendChild(loading);
    setTimeout(() => loading.classList.add('show'), 10);
    
    return {
        hide: () => {
            loading.classList.remove('show');
            setTimeout(() => loading.remove(), 300);
        }
    };
}

// Estilos CSS inline para os alertas (caso não esteja no CSS principal)
const style = document.createElement('style');
style.textContent = `
    .custom-alert {
        position: fixed;
        top: 20px;
        right: 20px;
        min-width: 300px;
        max-width: 500px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        overflow: hidden;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 9999;
    }
    
    .custom-alert.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .custom-alert-content {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .custom-alert-content i:first-child {
        font-size: 24px;
        flex-shrink: 0;
    }
    
    .custom-alert-content span {
        flex: 1;
        font-size: 14px;
    }
    
    .custom-alert-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        opacity: 0.6;
        transition: opacity 0.2s;
    }
    
    .custom-alert-close:hover {
        opacity: 1;
    }
    
    .custom-alert-progress {
        height: 3px;
        background: rgba(0,0,0,0.1);
    }
    
    .custom-alert-success { border-left: 4px solid #28a745; }
    .custom-alert-success .fa-check-circle { color: #28a745; }
    
    .custom-alert-error { border-left: 4px solid #dc3545; }
    .custom-alert-error .fa-exclamation-circle { color: #dc3545; }
    
    .custom-alert-warning { border-left: 4px solid #ffc107; }
    .custom-alert-warning .fa-exclamation-triangle { color: #ffc107; }
    
    .custom-alert-info { border-left: 4px solid #17a2b8; }
    .custom-alert-info .fa-info-circle { color: #17a2b8; }
    
    @keyframes alertProgress {
        from { width: 100%; }
        to { width: 0%; }
    }
    
    .custom-confirm-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .custom-confirm-modal.show {
        opacity: 1;
    }
    
    .custom-confirm-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
    }
    
    .custom-confirm-dialog {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        min-width: 400px;
        max-width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    
    .custom-confirm-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px;
        border-bottom: 1px solid #dee2e6;
    }
    
    .custom-confirm-header i {
        font-size: 24px;
        color: #0d6efd;
    }
    
    .custom-confirm-header h3 {
        margin: 0;
        font-size: 18px;
    }
    
    .custom-confirm-body {
        padding: 20px;
    }
    
    .custom-confirm-footer {
        padding: 16px 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    }
    
    .custom-loading {
        position: fixed;
        inset: 0;
        z-index: 10001;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .custom-loading.show {
        opacity: 1;
    }
    
    .custom-loading-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.6);
    }
    
    .custom-loading-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: white;
    }
`;
document.head.appendChild(style);
