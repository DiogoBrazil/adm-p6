
async function loadProcessos() {
    try {
        const processos = await eel.listar_processos()();
        const processList = document.getElementById('processList');
        processList.innerHTML = processos.map(processo => `
            <div class="list-item">
                <div>${processo.numero}</div>
                <div>
                    <strong>Tipo:</strong> ${processo.tipo_geral} - ${processo.tipo_detalhe}<br>
                    <strong>Documento:</strong> ${processo.documento_iniciador}<br>
                    ${processo.processo_sei ? `<strong>SEI:</strong> ${processo.processo_sei}` : ''}
                </div>
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
