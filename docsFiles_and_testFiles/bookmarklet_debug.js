// Copie este código completo e cole diretamente na barra de endereços do navegador
// precedido de "javascript:" (sem as aspas)
// Por exemplo: javascript:(function(){/*COLE O CÓDIGO AQUI*/})();

javascript:(function(){
    // Criar uma div de resultados
    let debugDiv = document.getElementById('debug-pm-multiplos');
    if (debugDiv) debugDiv.remove();
    
    debugDiv = document.createElement('div');
    debugDiv.id = 'debug-pm-multiplos';
    debugDiv.style.cssText = 'position:fixed;top:10px;right:10px;width:400px;max-height:500px;overflow-y:auto;background:white;border:2px solid #007bff;border-radius:8px;padding:15px;z-index:99999;font-family:monospace;font-size:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    
    function log(msg, color='black') {
        const p = document.createElement('p');
        p.style.cssText = `margin:2px 0;color:${color};`;
        p.textContent = new Date().toLocaleTimeString() + ': ' + msg;
        debugDiv.appendChild(p);
        console.log(msg);
    }
    
    debugDiv.innerHTML = '<h3 style="margin:0 0 10px 0;color:#007bff;">Debug PM Múltiplos</h3>';
    document.body.appendChild(debugDiv);
    
    try {
        log('=== INICIANDO DEBUG ===', 'blue');
        
        const container = document.getElementById('container_pms_envolvidos');
        if (!container) {
            log('❌ Container não encontrado!', 'red');
            return;
        }
        log('✅ Container encontrado', 'green');
        
        const pmsItems = container.querySelectorAll('.pm-item');
        log(`📊 Total PMs: ${pmsItems.length}`);
        
        if (pmsItems.length === 0) {
            log('⚠️ Nenhum PM! Adicione um primeiro.', 'orange');
            return;
        }
        
        const item = pmsItems[0];
        const pmIdField = item.querySelector('[data-field="pm_id"]');
        const nomeField = item.querySelector('[data-field="nome"]');
        
        log(`🔍 Campos: ID=${!!pmIdField}, Nome=${!!nomeField}`);
        log(`📋 Valores: ID="${pmIdField?.value}", Nome="${nomeField?.value}"`);
        
        // Teste manual
        if (pmIdField && nomeField) {
            pmIdField.value = 'teste-123';
            nomeField.value = 'TESTE MANUAL';
            log('🧪 Preenchimento manual feito', 'green');
        }
        
        // Teste função
        if (typeof obterPmsEnvolvidos === 'function') {
            const resultado = obterPmsEnvolvidos();
            log(`📊 Resultado função: ${JSON.stringify(resultado)}`);
            if (resultado.length > 0) {
                log('✅ Função OK!', 'green');
            } else {
                log('❌ Array vazio!', 'red');
            }
        } else {
            log('❌ Função não existe!', 'red');
        }
        
        const statusPm = document.getElementById('status_pm');
        log(`📋 Status: "${statusPm?.value || 'nenhum'}"`);
        
        log('=== DEBUG CONCLUÍDO ===', 'blue');
        
    } catch (e) {
        log(`❌ Erro: ${e.message}`, 'red');
    }
})();
