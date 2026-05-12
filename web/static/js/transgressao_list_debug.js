// DEBUG: Versão simplificada do JavaScript para teste
console.log('🚀 JavaScript de transgressões carregado - versão debug');

// Variáveis globais
let transgressaoParaExcluir = null;

// Função de teste para exclusão
function confirmarExclusaoTransgressao(id, gravidade, inciso) {
    console.log('🗑️ Função confirmarExclusaoTransgressao chamada com:', {id, gravidade, inciso});
    
    transgressaoParaExcluir = id;
    
    const modalConfirmacao = document.getElementById('modalConfirmacao');
    const transgressaoInciso = document.getElementById('transgressaoInciso');
    const transgressaoDescricao = document.getElementById('transgressaoDescricao');
    
    console.log('🔍 Elementos encontrados:', {
        modalConfirmacao: !!modalConfirmacao,
        transgressaoInciso: !!transgressaoInciso,
        transgressaoDescricao: !!transgressaoDescricao
    });
    
    if (transgressaoInciso) transgressaoInciso.textContent = inciso;
    if (transgressaoDescricao) transgressaoDescricao.textContent = gravidade;
    
    if (modalConfirmacao) {
        modalConfirmacao.style.display = 'flex';
        console.log('✅ Modal de confirmação exibido');
    } else {
        console.error('❌ Modal de confirmação não encontrado');
        alert('Modal não encontrado! Elementos disponíveis: ' + document.querySelectorAll('[id]').length);
    }
}

async function confirmarExclusao() {
    console.log('🗑️ Função confirmarExclusao chamada');
    
    if (!transgressaoParaExcluir) {
        console.error('❌ Nenhuma transgressão selecionada para exclusão');
        alert('Nenhuma transgressão selecionada');
        return;
    }
    
    console.log(`🎯 Excluindo transgressão ID: ${transgressaoParaExcluir}`);
    
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    const originalText = btnConfirmarExclusao ? btnConfirmarExclusao.innerHTML : '';
    
    try {
        // Loading state
        if (btnConfirmarExclusao) {
            btnConfirmarExclusao.disabled = true;
            btnConfirmarExclusao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        }
        
        console.log(`🗑️ Chamando eel.excluir_transgressao com ID: ${transgressaoParaExcluir}`);
        
        // Simulação da chamada eel (para teste)
        const resultado = { success: true, message: 'Transgressão excluída com sucesso!' };
        
        if (resultado.success) {
            alert('Transgressão excluída com sucesso!');
            
            // Fechar modal
            const modalConfirmacao = document.getElementById('modalConfirmacao');
            if (modalConfirmacao) modalConfirmacao.style.display = 'none';
            
            console.log('✅ Exclusão simulada com sucesso');
        } else {
            alert('Erro ao excluir transgressão: ' + resultado.error);
        }
        
    } catch (error) {
        console.error('Erro ao excluir transgressão:', error);
        alert('Erro ao excluir transgressão. Tente novamente.');
    } finally {
        // Restaurar estado do botão
        if (btnConfirmarExclusao) {
            btnConfirmarExclusao.disabled = false;
            btnConfirmarExclusao.innerHTML = originalText;
        }
        
        transgressaoParaExcluir = null;
    }
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 DOM carregado, inicializando eventos...');
    
    // Modal de confirmação
    const btnCancelar = document.getElementById('btnCancelar');
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
    const modalConfirmacao = document.getElementById('modalConfirmacao');
    
    console.log('🔍 Verificando elementos do modal:', {
        btnCancelar: !!btnCancelar,
        btnConfirmarExclusao: !!btnConfirmarExclusao,
        modalConfirmacao: !!modalConfirmacao
    });
    
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            console.log('🚫 Botão cancelar clicado');
            if (modalConfirmacao) modalConfirmacao.style.display = 'none';
            transgressaoParaExcluir = null;
        });
    } else {
        console.error('❌ Botão cancelar não encontrado');
    }
    
    if (btnConfirmarExclusao) {
        btnConfirmarExclusao.addEventListener('click', confirmarExclusao);
        console.log('✅ Event listener adicionado ao botão confirmar exclusão');
    } else {
        console.error('❌ Botão confirmar exclusão não encontrado');
    }
    
    // Fechar modal clicando fora
    if (modalConfirmacao) {
        modalConfirmacao.addEventListener('click', function(e) {
            if (e.target === modalConfirmacao) {
                modalConfirmacao.style.display = 'none';
                transgressaoParaExcluir = null;
                console.log('🚫 Modal fechado clicando fora');
            }
        });
    }
    
    console.log('✅ Eventos inicializados com sucesso');
});

// Função para testar se tudo está funcionando
function testarFuncionalidade() {
    console.log('🧪 Testando funcionalidade de exclusão...');
    confirmarExclusaoTransgressao(999, 'Teste', 'Artigo Teste');
}

// Expor função de teste globalmente
window.testarFuncionalidade = testarFuncionalidade;
window.confirmarExclusaoTransgressao = confirmarExclusaoTransgressao;

console.log('🎯 JavaScript de debug carregado completamente');
