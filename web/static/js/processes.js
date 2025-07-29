
async function loadResponsaveis() {
    try {
        const users = await eel.listar_todos_usuarios()();
        const responsavelSelect = document.getElementById('responsavel');
        responsavelSelect.innerHTML = users.map(user => `<option value="${user.id}">${user.nome}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
    }
}
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

document.getElementById('processForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const numero = document.getElementById('numero').value.trim();
    const tipo = document.getElementById('tipo').value;
    const responsavel = document.getElementById('responsavel').value;
    try {
        if (!numero || !responsavel) {
            alert('Por favor, preencha todos os campos!');
            return;
        }
        
        const result = await eel.registrar_processo(numero, tipo, responsavel)();
        if (result.sucesso) {
            alert(result.mensagem);
            document.getElementById('processForm').reset();
            await loadProcessos();
        } else {
            alert(result.mensagem);
        }
    } catch (error) {
        console.error('Erro ao registrar processo:', error);
    }
});
window.addEventListener('load', async () => {
    await loadResponsaveis();
    await loadProcessos();
});
