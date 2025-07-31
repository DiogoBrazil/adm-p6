
// Variáveis globais
let todosOsProcedimentos = [];
let procedimentosFiltrados = [];

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        if (resultado.logado && resultado.usuario) {
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email || 'usuário';
        } else {
            // Se não estiver logado, redireciona para login
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        // Em caso de erro, redireciona para login
        window.location.href = 'login.html';
    }
}

// Função para realizar logout
function realizarLogout() {
    showConfirmModal(
        'Confirmar Logout',
        'Tem certeza que deseja sair do sistema?',
        async () => {
            try {
                await eel.fazer_logout()();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
                showAlert('Erro ao fazer logout!', 'error');
            }
        }
    );
}

// Função para mostrar modal de confirmação
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';
    modal.classList.add('show');

    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
        onConfirm();
    };

    cancelBtn.onclick = () => {
        modal.style.display = 'none';
        modal.classList.remove('show');
    };

    // Fechar modal clicando fora dele
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    };
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const alertDiv = document.createElement('div');
    alertDiv.id = alertId;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button onclick="closeAlert('${alertId}')" class="alert-close">&times;</button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        closeAlert(alertId);
    }, 5000);
}

// Função para fechar alerta
function closeAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (alert) {
        alert.remove();
    }
}

// Função para carregar todos os procedimentos
async function carregarProcedimentos() {
    try {
        const procedimentos = await eel.listar_processos()();
        console.log("Resposta do servidor (procedimentos):", procedimentos);
        todosOsProcedimentos = procedimentos || [];
        procedimentosFiltrados = [...todosOsProcedimentos];
        console.log("Total de procedimentos carregados:", todosOsProcedimentos.length);
        
        // Verificar imediatamente se temos procedimentos
        if (todosOsProcedimentos.length === 0) {
            console.log("Nenhum procedimento encontrado, mostrando mensagem");
            // Exibir mensagem diretamente
            const emptyState = document.getElementById('emptyState');
            const tableResponsive = document.querySelector('.table-responsive');
            
            if (tableResponsive) tableResponsive.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                emptyState.innerHTML = `
                    <i class="fas fa-folder-open"></i>
                    <h3>Nenhum procedimento encontrado</h3>
                    <p>Não há processos ou procedimentos cadastrados no sistema.</p>
                `;
            }
        } else {
            // Apenas chamar exibirProcedimentos se houver dados
            exibirProcedimentos();
        }
    } catch (error) {
        console.error('Erro ao carregar procedimentos:', error);
        showAlert('Erro ao carregar lista de procedimentos!', 'error');
        
        // Em caso de erro, também mostrar a mensagem de nenhum registro
        const emptyState = document.getElementById('emptyState');
        const tableResponsive = document.querySelector('.table-responsive');
        
        if (tableResponsive) tableResponsive.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h3>Erro ao carregar registros</h3>
                <p>Ocorreu um erro ao tentar carregar os procedimentos.</p>
            `;
        }
    }
}

// Funções auxiliares para formatação
function extrairAno(procedimento) {
    // Tentar extrair o ano do número formatado ou da data de criação
    if (procedimento.numero_formatado) {
        const match = procedimento.numero_formatado.match(/(\d{4})/);
        if (match) return match[1];
    }
    
    if (procedimento.numero) {
        const match = procedimento.numero.match(/(\d{4})/);
        if (match) return match[1];
    }
    
    // Se não encontrar no número, usar o ano da data de criação
    if (procedimento.data_criacao) {
        const ano = new Date(procedimento.data_criacao).getFullYear();
        if (ano && ano > 2000) return ano.toString();
    }
    
    return new Date().getFullYear().toString(); // Ano atual como fallback
}

function obterNumeroDocumento(procedimento) {
    // Priorizar números específicos baseados no documento iniciador
    if (procedimento.documento_iniciador === 'Portaria' && procedimento.numero_portaria) {
        return procedimento.numero_portaria;
    }
    
    if (procedimento.documento_iniciador === 'Memorando Disciplinar' && procedimento.numero_memorando) {
        return procedimento.numero_memorando;
    }
    
    if (procedimento.documento_iniciador === 'Feito Preliminar' && procedimento.numero_feito) {
        return procedimento.numero_feito;
    }
    
    // Fallback para número formatado ou número geral
    return procedimento.numero_formatado || procedimento.numero || 'S/N';
}

function formatarNomeCompleto(nome) {
    if (!nome || nome === 'Não informado' || nome === 'N/A') {
        return 'Não informado';
    }
    
    // Se já está no formato correto (contém posto/graduação e matrícula), retornar como está
    if (nome.includes('SGT') || nome.includes('CEL') || nome.includes('TEN') || nome.includes('MAJ') || nome.includes('CAP')) {
        return nome;
    }
    
    // Se é apenas o nome, retornar como está (será melhorado quando tivermos mais dados)
    return nome;
}

// Função para exibir procedimentos na tabela
function exibirProcedimentos() {
    const tableBody = document.getElementById('procedureTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    console.log("Procedimentos filtrados:", procedimentosFiltrados.length);
    
    // Limpar a tabela
    tableBody.innerHTML = '';
    
    // Verificar se temos procedimentos para mostrar
    if (procedimentosFiltrados.length === 0) {
        // Não há procedimentos, ocultar a tabela e mostrar a mensagem
        if (tableResponsive) tableResponsive.style.display = 'none';
        
        if (emptyState) {
            emptyState.style.display = 'block';
            
            // Mensagem diferente para busca vs. sem registros
            const searchTerm = document.getElementById('searchInput').value.trim();
            if (searchTerm && todosOsProcedimentos.length > 0) {
                // Resultado da busca está vazio
                emptyState.innerHTML = `
                    <i class="fas fa-search"></i>
                    <h3>Nenhum registro encontrado</h3>
                    <p>Não foi encontrado nenhum processo ou procedimento com o termo "${searchTerm}".</p>
                `;
            } else {
                // Não há registros no sistema
                emptyState.innerHTML = `
                    <i class="fas fa-folder-open"></i>
                    <h3>Nenhum procedimento encontrado</h3>
                    <p>Não há processos ou procedimentos cadastrados ou sua pesquisa não encontrou resultados.</p>
                `;
            }
            
            console.log("Mensagem 'Nenhum registro encontrado' exibida");
        } else {
            console.error("Elemento 'emptyState' não encontrado!");
        }
    } else {
        // Há procedimentos, mostrar a tabela e ocultar a mensagem
        if (tableResponsive) tableResponsive.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        
        // Preencher a tabela com os procedimentos
        tableBody.innerHTML = procedimentosFiltrados.map(procedimento => {
            // Extrair o ano do número do procedimento
            const ano = extrairAno(procedimento);
            
            // Obter o número da portaria/memorando/feito
            const numero = obterNumeroDocumento(procedimento);
            
            // Formatar nome do encarregado
            const encarregado = procedimento.responsavel_completo || formatarNomeCompleto(procedimento.responsavel) || 'Não informado';
            
            // Formatar nome do PM envolvido
            const pmEnvolvido = procedimento.nome_pm_completo || formatarNomeCompleto(procedimento.nome_pm) || 'Não informado';
            
            // Obter tipo de envolvimento sem cores
            const tipoEnvolvimento = procedimento.status_pm || 'Não informado';
            
            return `
                <tr>
                    <td><strong>${ano}</strong></td>
                    <td>
                        <strong>${numero}</strong>
                        ${procedimento.processo_sei ? `<br><small>SEI: ${procedimento.processo_sei}</small>` : ''}
                    </td>
                    <td><strong>${procedimento.tipo_detalhe || 'N/A'}</strong></td>
                    <td>${encarregado}</td>
                    <td>${pmEnvolvido}</td>
                    <td>${tipoEnvolvimento}</td>
                    <td>
                        <div class="action-buttons-inline">
                            <button onclick="editarProcedimento('${procedimento.id}')" class="btn-edit" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="excluirProcedimento('${procedimento.id}', '${numero.replace(/'/g, '\\\'')}')" class="btn-delete" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Função para buscar procedimentos
function buscarProcedimentos() {
    const termoBusca = document.getElementById('searchInput').value.toLowerCase().trim();
    const clearButton = document.getElementById('clearButton');
    
    if (termoBusca === '') {
        procedimentosFiltrados = [...todosOsProcedimentos];
        clearButton.style.display = 'none';
    } else {
        procedimentosFiltrados = todosOsProcedimentos.filter(procedimento => {
            // Extrair dados formatados para busca
            const ano = extrairAno(procedimento);
            const numero = obterNumeroDocumento(procedimento);
            const encarregado = formatarNomeCompleto(procedimento.responsavel_completo || procedimento.responsavel);
            const pmEnvolvido = formatarNomeCompleto(procedimento.nome_pm);
            
            return (
                // Busca por ano
                ano.toLowerCase().includes(termoBusca) ||
                // Busca por número do documento
                numero.toLowerCase().includes(termoBusca) ||
                // Busca por número formatado (fallback)
                (procedimento.numero_formatado || '').toLowerCase().includes(termoBusca) ||
                // Busca por número original (fallback)
                (procedimento.numero || '').toLowerCase().includes(termoBusca) ||
                // Busca por números específicos dos documentos
                (procedimento.numero_portaria || '').toLowerCase().includes(termoBusca) ||
                (procedimento.numero_memorando || '').toLowerCase().includes(termoBusca) ||
                (procedimento.numero_feito || '').toLowerCase().includes(termoBusca) ||
                // Busca por tipo de detalhe (PADS, IPM, SR, etc.)
                (procedimento.tipo_detalhe || '').toLowerCase().includes(termoBusca) ||
                // Busca por encarregado formatado
                encarregado.toLowerCase().includes(termoBusca) ||
                // Busca por responsável (fallback)
                (procedimento.responsavel || '').toLowerCase().includes(termoBusca) ||
                (procedimento.responsavel_completo || '').toLowerCase().includes(termoBusca) ||
                // Busca por PM envolvido formatado
                pmEnvolvido.toLowerCase().includes(termoBusca) ||
                // Busca por nome do PM (fallback)
                (procedimento.nome_pm || '').toLowerCase().includes(termoBusca) ||
                // Busca por tipo de envolvimento
                (procedimento.status_pm || '').toLowerCase().includes(termoBusca) ||
                // Busca por número do processo SEI
                (procedimento.processo_sei || '').toLowerCase().includes(termoBusca)
            );
        });
        clearButton.style.display = 'inline-block';
    }
    
    exibirProcedimentos();
}

// Função para realizar busca via botão
function realizarBusca() {
    buscarProcedimentos();
    
    // Destacar visualmente que a busca foi realizada
    const searchButton = document.getElementById('searchButton');
    const originalText = searchButton.innerHTML;
    
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
    searchButton.disabled = true;
    
    // Simular delay para feedback visual
    setTimeout(() => {
        searchButton.innerHTML = originalText;
        searchButton.disabled = false;
        
        // Mostrar feedback sobre o resultado
        const termoBusca = document.getElementById('searchInput').value.trim();
        if (termoBusca && procedimentosFiltrados.length === 0) {
            showAlert(`Nenhum resultado encontrado para "${termoBusca}"`, 'warning');
        } else if (termoBusca && procedimentosFiltrados.length > 0) {
            showAlert(`${procedimentosFiltrados.length} resultado(s) encontrado(s)`, 'success');
        }
    }, 300);
}

// Função para limpar busca
function limparBusca() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearButton').style.display = 'none';
    procedimentosFiltrados = [...todosOsProcedimentos];
    exibirProcedimentos();
}

// Função para editar procedimento
function editarProcedimento(id) {
    window.location.href = `procedure_form.html?id=${id}`;
}

// Função para obter a classe CSS para o status do PM
function getStatusBadgeClass(status) {
    if (!status) return 'status-none';
    
    status = status.toLowerCase();
    
    if (status.includes('acusado') || status.includes('investigado')) {
        return 'status-danger';
    } else if (status.includes('testemunha')) {
        return 'status-warning';
    } else if (status.includes('vítima')) {
        return 'status-info';
    } else if (status.includes('sindicado')) {
        return 'status-primary';
    } else {
        return 'status-secondary';
    }
}

// Função para excluir procedimento
function excluirProcedimento(id, numero) {
    showConfirmModal(
        'Confirmar Exclusão',
        `Tem certeza que deseja excluir o procedimento "${numero}"?`,
        async () => {
            try {
                await eel.excluir_processo(id)();
                showAlert('Procedimento excluído com sucesso!', 'success');
                carregarProcedimentos(); // Recarrega a lista
            } catch (error) {
                console.error('Erro ao excluir procedimento:', error);
                showAlert('Erro ao excluir procedimento!', 'error');
            }
        }
    );
}

// Função para verificar e garantir que a mensagem de "nenhum registro" seja exibida corretamente
function verificarEstadoVazioTabela() {
    const tableBody = document.getElementById('procedureTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    const table = document.querySelector('.user-table');
    
    console.log("Verificando estado da tabela:");
    console.log("- procedimentosFiltrados.length:", procedimentosFiltrados.length);
    console.log("- Elemento tableBody existe:", !!tableBody);
    console.log("- Elemento emptyState existe:", !!emptyState);
    console.log("- Elemento tableResponsive existe:", !!tableResponsive);
    
    if (procedimentosFiltrados.length === 0) {
        console.log("Não há registros, exibindo mensagem...");
        // Esconder a tabela
        if (tableResponsive) tableResponsive.style.display = 'none';
        if (table) table.style.display = 'none';
        
        // Mostrar a mensagem
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.style.visibility = 'visible';
            console.log("Visibilidade de emptyState após atualização:", emptyState.style.display);
            
            // Forçar a exibição da mensagem com conteúdo padrão
            emptyState.innerHTML = `
                <i class="fas fa-folder-open"></i>
                <h3>Nenhum procedimento encontrado</h3>
                <p>Não há processos ou procedimentos cadastrados ou sua pesquisa não encontrou resultados.</p>
            `;
        }
    } else {
        console.log("Há registros, exibindo tabela...");
        // Mostrar a tabela
        if (tableResponsive) tableResponsive.style.display = 'block';
        if (table) table.style.display = 'table';
        
        // Esconder a mensagem
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM carregado, inicializando...");

    // Verificar se os elementos existem
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    console.log("Elementos encontrados: ", {
        emptyState: !!emptyState,
        tableResponsive: !!tableResponsive
    });
    
    // Garantir que o estado inicial esteja correto
    if (emptyState) emptyState.style.display = 'none';
    if (tableResponsive) tableResponsive.style.display = 'block';
    
    // Carregar dados
    carregarUsuarioLogado();
    carregarProcedimentos();
    
    // Verificar estado da tabela após pequenos intervalos
    setTimeout(verificarEstadoVazioTabela, 500);
    setTimeout(verificarEstadoVazioTabela, 1000);
    setTimeout(verificarEstadoVazioTabela, 2000);
    
    // Busca em tempo real
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', buscarProcedimentos);
        
        // Enter para buscar com feedback visual
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                realizarBusca();
            }
        });
    }
});
