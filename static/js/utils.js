// utils.js - Funções utilitárias compartilhadas

/**
 * Formata uma data no padrão brasileiro
 * @param {string|Date} date - Data para formatar
 * @returns {string} Data formatada
 */
function formatDateBR(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Data inválida';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Formata data e hora no padrão brasileiro
 * @param {string|Date} datetime - Data/hora para formatar
 * @returns {string} Data/hora formatada
 */
function formatDateTimeBR(datetime) {
    if (!datetime) return 'N/A';
    const d = new Date(datetime);
    if (isNaN(d.getTime())) return 'Data/hora inválida';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Debounce function para limitar chamadas de função
 * @param {Function} func - Função para executar
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função debounced
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Capitaliza primeira letra de cada palavra
 * @param {string} str - String para capitalizar
 * @returns {string} String capitalizada
 */
function capitalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Sanitiza HTML para prevenir XSS
 * @param {string} str - String para sanitizar
 * @returns {string} String sanitizada
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Valida email
 * @param {string} email - Email para validar
 * @returns {boolean} True se válido
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Copia texto para área de transferência
 * @param {string} text - Texto para copiar
 * @returns {Promise<boolean>} True se copiado com sucesso
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Erro ao copiar:', err);
        return false;
    }
}

/**
 * Formata número com separadores de milhar
 * @param {number} num - Número para formatar
 * @returns {string} Número formatado
 */
function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

/**
 * Verifica se string está vazia ou contém apenas espaços
 * @param {string} str - String para verificar
 * @returns {boolean} True se vazia
 */
function isEmpty(str) {
    return !str || str.trim().length === 0;
}

/**
 * Obtém parâmetro da URL
 * @param {string} param - Nome do parâmetro
 * @returns {string|null} Valor do parâmetro
 */
function getUrlParameter(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Remove acentos de uma string
 * @param {string} str - String para remover acentos
 * @returns {string} String sem acentos
 */
function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Trunca texto com reticências
 * @param {string} str - Texto para truncar
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} Texto truncado
 */
function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}
