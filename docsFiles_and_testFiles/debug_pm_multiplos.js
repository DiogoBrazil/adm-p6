// Script de teste para executar no console do navegador
// Para testar a funcionalidade de PM múltiplos

console.log('=== TESTE DE DEBUG PARA PM MÚLTIPLOS ===');

// 1. Verificar se o container existe
const container = document.getElementById('container_pms_envolvidos');
console.log('Container encontrado:', !!container);

// 2. Verificar quantos PMs existem
const pmsItems = container ? container.querySelectorAll('.pm-item') : [];
console.log('Total de PMs:', pmsItems.length);

// 3. Para cada PM, verificar os campos
pmsItems.forEach((item, index) => {
    const pmIdField = item.querySelector('[data-field="pm_id"]');
    const nomeField = item.querySelector('[data-field="nome"]');
    
    console.log(`PM ${index + 1}:`, {
        item: item,
        pmIdField: pmIdField,
        nomeField: nomeField,
        pmIdValue: pmIdField ? pmIdField.value : 'campo não encontrado',
        nomeValue: nomeField ? nomeField.value : 'campo não encontrado'
    });
});

// 4. Verificar variáveis globais
console.log('currentPmField:', window.currentPmField || 'não definido');
console.log('campoBuscaUsuario:', window.campoBuscaUsuario || 'não definido');

// 5. Simular preenchimento manual do primeiro PM (se existir)
if (pmsItems.length > 0) {
    const primeiroItem = pmsItems[0];
    const pmIdField = primeiroItem.querySelector('[data-field="pm_id"]');
    const nomeField = primeiroItem.querySelector('[data-field="nome"]');
    
    if (pmIdField && nomeField) {
        pmIdField.value = 'teste-id-12345';
        nomeField.value = 'TESTE PM NOME COMPLETO';
        console.log('PM preenchido manualmente:', {
            pmId: pmIdField.value,
            nome: nomeField.value
        });
        
        // Testar a função obterPmsEnvolvidos
        if (typeof obterPmsEnvolvidos === 'function') {
            const resultado = obterPmsEnvolvidos();
            console.log('Resultado obterPmsEnvolvidos após preenchimento manual:', resultado);
        }
    }
}
