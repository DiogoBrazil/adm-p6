
async function loadProcessos() {
    try {
        const processos = await eel.listar_processos()();
        const processList = document.getElementById('processList');
        processList.innerHTML = processos.map(processo => `
            <div class="list-item">
                <div>${processo.numero}</div>
                <div>${processo.tipo}</div>
                <div>${processo.responsavel}</div>
                <div>${new Date(processo.data_criacao).toLocaleDateString('pt-BR')}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar processos:', error);
    }
}

window.addEventListener('load', async () => {
    await loadProcessos();
});
