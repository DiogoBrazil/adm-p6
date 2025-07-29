
async function loadResponsaveis() {
    try {
        const users = await eel.listar_todos_usuarios()();
        const responsavelSelect = document.getElementById('responsavel');
        responsavelSelect.innerHTML = users.map(user => `<option value="${user.id}" data-type="${user.tipo}">${user.nome}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tipoGeralSelect = document.getElementById('tipo_geral');
    const processoTipoGroup = document.getElementById('processo_tipo_group');
    const procedimentoTipoGroup = document.getElementById('procedimento_tipo_group');
    const tipoProcessoSelect = document.getElementById('tipo_processo');
    const tipoProcedimentoSelect = document.getElementById('tipo_procedimento');

    function toggleTipoFields() {
        if (tipoGeralSelect.value === 'processo') {
            processoTipoGroup.style.display = 'block';
            procedimentoTipoGroup.style.display = 'none';
            tipoProcessoSelect.setAttribute('required', 'required');
            tipoProcedimentoSelect.removeAttribute('required');
            tipoProcedimentoSelect.value = ''; // Limpa o valor se o campo for ocultado
        } else if (tipoGeralSelect.value === 'procedimento') {
            processoTipoGroup.style.display = 'none';
            procedimentoTipoGroup.style.display = 'block';
            tipoProcessoSelect.removeAttribute('required');
            tipoProcedimentoSelect.setAttribute('required', 'required');
            tipoProcessoSelect.value = ''; // Limpa o valor se o campo for ocultado
        } else {
            processoTipoGroup.style.display = 'none';
            procedimentoTipoGroup.style.display = 'none';
            tipoProcessoSelect.removeAttribute('required');
            tipoProcedimentoSelect.removeAttribute('required');
            tipoProcessoSelect.value = '';
            tipoProcedimentoSelect.value = '';
        }
    }

    tipoGeralSelect.addEventListener('change', toggleTipoFields);
    toggleTipoFields(); // Chamar no carregamento inicial
});

document.getElementById('processForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const numero = document.getElementById('numero').value.trim();
    const tipo_geral = document.getElementById('tipo_geral').value;
    const documento_iniciador = document.getElementById('documento_iniciador').value;
    const processo_sei = document.getElementById('processo_sei').value.trim();
    const responsavelSelect = document.getElementById('responsavel');
    const responsavel_id = responsavelSelect.value;
    const responsavel_tipo = responsavelSelect.options[responsavelSelect.selectedIndex].dataset.type;

    let tipo_detalhe = '';
    if (tipo_geral === 'processo') {
        tipo_detalhe = document.getElementById('tipo_processo').value;
    } else if (tipo_geral === 'procedimento') {
        tipo_detalhe = document.getElementById('tipo_procedimento').value;
    }

    try {
        if (!numero || !tipo_geral || !tipo_detalhe || !documento_iniciador || !responsavel_id || !responsavel_tipo) {
            alert('Por favor, preencha todos os campos obrigatórios!');
            return;
        }
        
        const result = await eel.registrar_processo(numero, tipo_geral, tipo_detalhe, documento_iniciador, processo_sei, responsavel_id, responsavel_tipo)();
        if (result.sucesso) {
            alert(result.mensagem);
            document.getElementById('processForm').reset();
        } else {
            alert(result.mensagem);
        }
    } catch (error) {
        console.error('Erro ao registrar processo/procedimento:', error);
    }
});

window.addEventListener('load', async () => {
    await loadResponsaveis();
});
