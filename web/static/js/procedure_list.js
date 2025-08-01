
// Variáveis globais
let todosOsProcedimentos = [];
let procedimentosFiltrados = [];
let filtrosAtivos = {};

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

// Função para carregar todos os procedimentos com cálculo de prazos
async function carregarProcedimentos() {
    console.log("📝 Iniciando carregamento de procedimentos com prazos...");
    try {
        // Usar a nova função que calcula prazos automaticamente
        const resultado = await eel.listar_processos_com_prazos()();
        console.log("✅ Resposta do servidor (procedimentos com prazos):", resultado);
        
        if (resultado.sucesso) {
            todosOsProcedimentos = resultado.processos || [];
            procedimentosFiltrados = [...todosOsProcedimentos];
            console.log("📊 Total de procedimentos carregados:", todosOsProcedimentos.length);
            
            // Verificar imediatamente se temos procedimentos
            if (todosOsProcedimentos.length === 0) {
                console.log("⚠️ Nenhum procedimento encontrado, mostrando mensagem");
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
                console.log("✅ Dados carregados, chamando exibirProcedimentos()");
                // Apenas chamar exibirProcedimentos se houver dados
                exibirProcedimentos();
            }
        } else {
            console.error('❌ Erro retornado pelo servidor:', resultado.mensagem);
            showAlert(resultado.mensagem || 'Erro ao carregar procedimentos!', 'error');
            mostrarMensagemErro('Erro ao carregar registros', resultado.mensagem);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar procedimentos:', error);
        showAlert('Erro ao carregar lista de procedimentos!', 'error');
        mostrarMensagemErro('Erro ao carregar registros', 'Ocorreu um erro ao tentar carregar os procedimentos.');
    }
}

// Função auxiliar para mostrar mensagem de erro
function mostrarMensagemErro(titulo, mensagem) {
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    if (tableResponsive) tableResponsive.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <h3>${titulo}</h3>
            <p>${mensagem}</p>
        `;
    }
}

// Funções auxiliares para formatação

// Função para gerar o HTML do status de prazo com cores
function gerarStatusPrazoHTML(procedimento) {
    const prazo = procedimento.prazo;
    
    if (!prazo) {
        return '<span class="status-prazo sem-data" title="Sem informações de prazo">Sem dados</span>';
    }
    
    let classe = 'sem-data';
    let icone = '';
    let texto = prazo.status_prazo || 'Sem dados';
    let tooltip = '';
    
    // Determinar classe CSS e ícone baseado no status
    if (!procedimento.data_recebimento) {
        classe = 'sem-data';
        icone = '<i class="fas fa-question-circle"></i> ';
        texto = 'Sem data recebimento';
        tooltip = 'Processo sem data de recebimento informada';
    } else if (prazo.vencido) {
        classe = 'vencido';
        icone = '<i class="fas fa-exclamation-triangle"></i> ';
        tooltip = `Vencido há ${Math.abs(prazo.dias_restantes)} dias. Data limite: ${prazo.data_limite_formatada}`;
    } else if (prazo.dias_restantes !== null) {
        if (prazo.dias_restantes <= 5) {
            classe = 'urgente';
            icone = '<i class="fas fa-clock"></i> ';
            tooltip = `URGENTE: Vence em ${prazo.dias_restantes} dias. Data limite: ${prazo.data_limite_formatada}`;
        } else if (prazo.dias_restantes <= 10) {
            classe = 'atencao';
            icone = '<i class="fas fa-bell"></i> ';
            tooltip = `ATENÇÃO: Vence em ${prazo.dias_restantes} dias. Data limite: ${prazo.data_limite_formatada}`;
        } else {
            classe = 'em-dia';
            icone = '<i class="fas fa-check-circle"></i> ';
            tooltip = `Em dia: Vence em ${prazo.dias_restantes} dias. Data limite: ${prazo.data_limite_formatada}`;
        }
    }
    
    // Adicionar informações do prazo no tooltip
    if (prazo.prazo_base_dias) {
        tooltip += `\n\nPrazo base: ${prazo.prazo_base_dias} dias`;
        if (prazo.prorrogacoes_dias > 0) {
            tooltip += `\nProrrogações: +${prazo.prorrogacoes_dias} dias`;
            tooltip += `\nPrazo total: ${prazo.prazo_total_dias} dias`;
        }
    }
    
    return `<span class="status-prazo ${classe}" title="${tooltip}">${icone}${texto}</span>`;
}
function extrairAno(procedimento) {
    // Priorizar o ano da data_instauracao
    if (procedimento.data_instauracao) {
        try {
            const ano = new Date(procedimento.data_instauracao).getFullYear();
            if (ano && ano > 2000) return ano.toString();
        } catch (e) {
            console.warn('Erro ao extrair ano da data_instauracao:', e);
        }
    }
    
    // Fallback: tentar extrair o ano do número formatado
    if (procedimento.numero_formatado) {
        const match = procedimento.numero_formatado.match(/(\d{4})/);
        if (match) return match[1];
    }
    
    if (procedimento.numero) {
        const match = procedimento.numero.match(/(\d{4})/);
        if (match) return match[1];
    }
    
    // Se não encontrar, usar o ano da data de criação
    if (procedimento.data_criacao) {
        const ano = new Date(procedimento.data_criacao).getFullYear();
        if (ano && ano > 2000) return ano.toString();
    }
    
    return new Date().getFullYear().toString(); // Ano atual como fallback
}

function obterNumeroDocumento(procedimento) {
    // Usar diretamente o campo "numero" da tabela
    return procedimento.numero || 'S/N';
}

// Função para exibir procedimentos na tabela
function exibirProcedimentos() {
    console.log("🔄 Iniciando exibirProcedimentos()");
    const tableBody = document.getElementById('procedureTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    console.log("🔍 Elementos encontrados:", {
        tableBody: !!tableBody,
        emptyState: !!emptyState,
        tableResponsive: !!tableResponsive,
        procedimentosFiltrados: procedimentosFiltrados.length
    });
    
    // Limpar a tabela
    if (tableBody) {
        tableBody.innerHTML = '';
    }
    
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
            // Extrair o ano da data_instauracao
            const ano = extrairAno(procedimento);
            
            // Obter o número do campo "numero"
            const numero = obterNumeroDocumento(procedimento);
            
            // Backend já retorna formatado: "posto/grad + matrícula + nome"
            const encarregadoCompleto = procedimento.responsavel || 'Não informado';
            
            // Backend já retorna formatado: "posto/grad + matrícula + nome"
            const pmEnvolvido = procedimento.pm_envolvido_nome || 'Não informado';
            
            // Obter tipo de envolvimento
            const tipoEnvolvimento = procedimento.status_pm || 'Não informado';
            
            // Gerar HTML do status do prazo com cores
            const statusPrazoHTML = gerarStatusPrazoHTML(procedimento);
            
            return `
                <tr>
                    <td><strong>${procedimento.tipo_detalhe || 'N/A'}</strong></td>
                    <td><strong>${ano}</strong></td>
                    <td>
                        <strong>${numero}</strong>
                    </td>
                    <td>
                        ${procedimento.local_origem || '<em style="color:#999;">Não informado</em>'}
                    </td>
                    <td>
                        ${procedimento.processo_sei ? procedimento.processo_sei : '<em style="color:#999;">Não informado</em>'}
                    </td>
                    <td>${encarregadoCompleto}</td>
                    <td>${pmEnvolvido}</td>
                    <td>${tipoEnvolvimento}</td>
                    <td style="text-align: center;">${statusPrazoHTML}</td>
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
    
    // Começar com os dados já filtrados pelos filtros avançados
    let dadosParaBusca = todosOsProcedimentos;
    
    // Se há filtros ativos, aplicá-los primeiro
    if (Object.values(filtrosAtivos).some(valor => valor && valor.trim())) {
        dadosParaBusca = todosOsProcedimentos.filter(procedimento => {
            // Filtro por tipo
            if (filtrosAtivos.tipo && procedimento.tipo_detalhe !== filtrosAtivos.tipo) {
                return false;
            }
            
            // Filtro por ano
            if (filtrosAtivos.ano && extrairAno(procedimento) !== filtrosAtivos.ano) {
                return false;
            }
            
            // Filtro por origem
            if (filtrosAtivos.origem && procedimento.local_origem !== filtrosAtivos.origem) {
                return false;
            }
            
            // Filtro por encarregado
            if (filtrosAtivos.encarregado && procedimento.responsavel !== filtrosAtivos.encarregado) {
                return false;
            }
            
            // Filtro por status PM
            if (filtrosAtivos.status && procedimento.status_pm !== filtrosAtivos.status) {
                return false;
            }
            
            // Filtro por documento iniciador
            if (filtrosAtivos.documento && procedimento.documento_iniciador !== filtrosAtivos.documento) {
                return false;
            }
            
            return true;
        });
    }
    
    if (termoBusca === '') {
        procedimentosFiltrados = dadosParaBusca;
        clearButton.style.display = 'none';
    } else {
        procedimentosFiltrados = dadosParaBusca.filter(procedimento => {
            // Extrair dados formatados para busca
            const ano = extrairAno(procedimento);
            const numero = obterNumeroDocumento(procedimento);
            const encarregadoCompleto = procedimento.responsavel || 'Não informado';
            const pmEnvolvido = procedimento.pm_envolvido_nome || 'Não informado';
            
            return (
                // Busca por ano
                ano.toLowerCase().includes(termoBusca) ||
                // Busca por número do documento
                numero.toLowerCase().includes(termoBusca) ||
                // Busca por número formatado (fallback)
                (procedimento.numero_formatado || '').toLowerCase().includes(termoBusca) ||
                // Busca por número original (fallback)
                (procedimento.numero || '').toLowerCase().includes(termoBusca) ||
                // Busca por processo SEI
                (procedimento.processo_sei || '').toLowerCase().includes(termoBusca) ||
                // Busca por números específicos dos documentos
                (procedimento.numero_portaria || '').toLowerCase().includes(termoBusca) ||
                (procedimento.numero_memorando || '').toLowerCase().includes(termoBusca) ||
                (procedimento.numero_feito || '').toLowerCase().includes(termoBusca) ||
                // Busca por tipo de detalhe (PADS, IPM, SR, etc.)
                (procedimento.tipo_detalhe || '').toLowerCase().includes(termoBusca) ||
                // Busca por local de origem
                (procedimento.local_origem || '').toLowerCase().includes(termoBusca) ||
                // Busca por encarregado completo
                encarregadoCompleto.toLowerCase().includes(termoBusca) ||
                // Busca por responsável (fallback)
                (procedimento.responsavel || '').toLowerCase().includes(termoBusca) ||
                // Busca por PM envolvido
                pmEnvolvido.toLowerCase().includes(termoBusca) ||
                // Busca por nome do PM (fallback)
                (procedimento.pm_envolvido_nome || '').toLowerCase().includes(termoBusca) ||
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

// === SISTEMA DE FILTROS COM MODAL ===

// Função para abrir o modal de filtros
function abrirModalFiltros() {
    console.log('abrirModalFiltros chamada');
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'flex';
        
        // Carregar opções dos filtros quando abrir
        carregarOpcoesDosFiltros();
        
        // Atualizar indicador visual
        atualizarIndicadorFiltros();
    } else {
        console.error('Modal de filtros não encontrado');
    }
}

// Função para fechar o modal de filtros
function fecharModalFiltros() {
    const modal = document.getElementById('modalFiltros');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Função para aplicar filtros do modal
function aplicarFiltrosModal() {
    aplicarFiltros();
    fecharModalFiltros();
}

// Função para limpar filtros do modal
function limparFiltrosModal() {
    limparFiltros();
    fecharModalFiltros();
}

// Função para carregar as opções dos filtros baseado nos dados
function carregarOpcoesDosFiltros() {
    if (todosOsProcedimentos.length === 0) return;
    
    // Coletar valores únicos para cada filtro
    const tipos = [...new Set(todosOsProcedimentos.map(p => p.tipo_detalhe).filter(t => t))].sort();
    const anos = [...new Set(todosOsProcedimentos.map(p => extrairAno(p)).filter(a => a))].sort().reverse();
    const origens = [...new Set(todosOsProcedimentos.map(p => p.local_origem).filter(o => o))].sort();
    const encarregados = [...new Set(todosOsProcedimentos.map(p => p.responsavel).filter(e => e))].sort();
    const status = [...new Set(todosOsProcedimentos.map(p => p.status_pm).filter(s => s))].sort();
    
    // Povoar os selects
    povoarSelect('filtroTipo', tipos);
    povoarSelect('filtroAno', anos);
    povoarSelect('filtroOrigem', origens);
    povoarSelect('filtroEncarregado', encarregados);
    povoarSelect('filtroStatus', status);
}

// Função auxiliar para povoar um select com opções
function povoarSelect(selectId, opcoes) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Manter a opção "Todos"
    const primeiraOpcao = select.children[0];
    select.innerHTML = '';
    select.appendChild(primeiraOpcao);
    
    // Adicionar as opções
    opcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao;
        option.textContent = opcao;
        select.appendChild(option);
    });
}

// Função para aplicar todos os filtros
function aplicarFiltros() {
    // Coletar valores dos filtros
    filtrosAtivos = {
        tipo: document.getElementById('filtroTipo').value,
        ano: document.getElementById('filtroAno').value,
        origem: document.getElementById('filtroOrigem').value,
        encarregado: document.getElementById('filtroEncarregado').value,
        status: document.getElementById('filtroStatus').value,
        documento: document.getElementById('filtroDocumento').value
    };
    
    // Aplicar filtros
    procedimentosFiltrados = todosOsProcedimentos.filter(procedimento => {
        // Filtro por tipo
        if (filtrosAtivos.tipo && procedimento.tipo_detalhe !== filtrosAtivos.tipo) {
            return false;
        }
        
        // Filtro por ano
        if (filtrosAtivos.ano && extrairAno(procedimento) !== filtrosAtivos.ano) {
            return false;
        }
        
        // Filtro por origem
        if (filtrosAtivos.origem && procedimento.local_origem !== filtrosAtivos.origem) {
            return false;
        }
        
        // Filtro por encarregado
        if (filtrosAtivos.encarregado && procedimento.responsavel !== filtrosAtivos.encarregado) {
            return false;
        }
        
        // Filtro por status PM
        if (filtrosAtivos.status && procedimento.status_pm !== filtrosAtivos.status) {
            return false;
        }
        
        // Filtro por documento iniciador
        if (filtrosAtivos.documento && procedimento.documento_iniciador !== filtrosAtivos.documento) {
            return false;
        }
        
        return true;
    });
    
    // Aplicar também a busca de texto se houver
    const termoBusca = document.getElementById('searchInput').value.trim();
    if (termoBusca) {
        buscarProcedimentos();
    } else {
        exibirProcedimentos();
    }
    
    // Atualizar indicador visual
    atualizarIndicadorFiltros();
    
    showAlert(`Filtros aplicados! ${procedimentosFiltrados.length} registro(s) encontrado(s).`, 'info');
}

// Função para limpar todos os filtros
function limparFiltros() {
    // Limpar valores dos selects
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroAno').value = '';
    document.getElementById('filtroOrigem').value = '';
    document.getElementById('filtroEncarregado').value = '';
    document.getElementById('filtroStatus').value = '';
    document.getElementById('filtroDocumento').value = '';
    
    // Limpar busca de texto também
    document.getElementById('searchInput').value = '';
    
    // Resetar filtros
    filtrosAtivos = {};
    procedimentosFiltrados = [...todosOsProcedimentos];
    
    // Atualizar exibição
    exibirProcedimentos();
    atualizarIndicadorFiltros();
    
    // Ocultar botão limpar busca
    document.getElementById('clearButton').style.display = 'none';
    
    showAlert('Todos os filtros foram limpos!', 'success');
}

// Função para atualizar indicador visual de filtros ativos
function atualizarIndicadorFiltros() {
    const toggleBtn = document.getElementById('filterToggle');
    let filtrosAplicados = 0;
    
    // Contar quantos filtros estão ativos
    Object.values(filtrosAtivos).forEach(valor => {
        if (valor && valor.trim()) filtrosAplicados++;
    });
    
    // Remover indicador anterior
    const indicadorExistente = toggleBtn.querySelector('.filter-indicator');
    if (indicadorExistente) {
        indicadorExistente.remove();
    }
    
    // Adicionar novo indicador se houver filtros ativos
    if (filtrosAplicados > 0) {
        const indicador = document.createElement('span');
        indicador.className = 'filter-indicator';
        indicador.textContent = filtrosAplicados;
        toggleBtn.appendChild(indicador);
    }
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
        
        // Enter para buscar
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarProcedimentos();
            }
        });
    }
    
    // Event listener para fechar modal ao clicar fora dele
    const modalFiltros = document.getElementById('modalFiltros');
    if (modalFiltros) {
        modalFiltros.addEventListener('click', function(e) {
            if (e.target === modalFiltros) {
                fecharModalFiltros();
            }
        });
    }
    
    // Event listener para tecla ESC fechar o modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modalFiltros');
            if (modal && modal.style.display === 'flex') {
                fecharModalFiltros();
            }
        }
    });
});
