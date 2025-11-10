
// Variáveis globais
let todosOsProcedimentos = [];
let procedimentosFiltrados = [];
let filtrosAtivos = {};

// Variáveis de paginação
let currentPage = 1;
const proceduresPerPage = 6;
let totalProcedures = 0;

// Variável para debounce da busca
let searchTimeout = null;

// Variáveis para autocomplete
let opcoesEncarregados = [];
let opcoesPmEnvolvidos = [];
let opcoesVitimas = [];

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
                const startTs = Date.now();
                await eel.fazer_logout()();
                const loader = document.getElementById('globalLoader');
                if (loader) loader.classList.remove('hidden');
                const elapsed = Date.now() - startTs;
                const toWait = Math.max(0, 1000 - elapsed);
                if (toWait > 0) await new Promise(r => setTimeout(r, toWait));
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
    // Remover modal existente se houver
    let existingModal = document.getElementById('confirmModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar novo modal
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-feedback';
    modal.innerHTML = `
        <div class="modal-content">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b6b; font-size: 3rem; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 15px; color: #333; font-size: 1.5rem;">${title}</h3>
            <p style="margin-bottom: 25px; color: #666; font-size: 1rem;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="confirmCancel" class="btn-secondary" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Cancelar</button>
                <button id="confirmOk" class="btn-danger" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Event listeners
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    // Remover listeners anteriores
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    okBtn.replaceWith(okBtn.cloneNode(true));
    
    // Novos listeners
    document.getElementById('confirmCancel').addEventListener('click', closeModal);
    document.getElementById('confirmOk').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    // Fechar ao clicar fora do modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
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

// Função para mostrar modal de sucesso
function showSuccessModal(message, autoCloseTime = 2000) {
    // Criar o modal se não existir
    let modalSuccess = document.getElementById('modalSuccess');
    if (!modalSuccess) {
        modalSuccess = document.createElement('div');
        modalSuccess.id = 'modalSuccess';
        modalSuccess.className = 'modal-success-overlay';
        modalSuccess.innerHTML = `
            <div class="modal-success">
                <div class="modal-success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="modal-success-content">
                    <h3>Sucesso!</h3>
                    <p id="modalSuccessMessage"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modalSuccess);
    }
    
    // Atualizar mensagem
    document.getElementById('modalSuccessMessage').innerHTML = message;
    
    // Mostrar modal com animação
    modalSuccess.style.display = 'flex';
    setTimeout(() => {
        modalSuccess.classList.add('show');
    }, 10);
    
    // Fechar automaticamente após o tempo especificado
    setTimeout(() => {
        modalSuccess.classList.remove('show');
        setTimeout(() => {
            modalSuccess.style.display = 'none';
        }, 300); // Aguardar animação de fade out
    }, autoCloseTime);
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
    
    // Mostrar loader e ocultar tabela e empty state
    const loaderContainer = document.getElementById('loaderContainer');
    const emptyState = document.getElementById('emptyState');
    const tableResponsive = document.querySelector('.table-responsive');
    
    if (loaderContainer) loaderContainer.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';
    if (tableResponsive) tableResponsive.style.display = 'none';
    
    try {
        // Obter termo de busca
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';

        // Construir objeto de filtros se houver filtros ativos
        let filtrosObj = null;
        if (Object.keys(filtrosAtivos).length > 0) {
            filtrosObj = {};
            Object.keys(filtrosAtivos).forEach(key => {
                if (filtrosAtivos[key] && filtrosAtivos[key].trim()) {
                    filtrosObj[key] = filtrosAtivos[key].trim();
                }
            });
            // Se não há filtros válidos, deixar como null
            if (Object.keys(filtrosObj).length === 0) {
                filtrosObj = null;
            }
        }

        console.log("🔍 Parâmetros de busca:", {
            searchTerm,
            filtros: filtrosObj,
            page: currentPage,
            perPage: proceduresPerPage
        });

        // Usar a nova função com paginação e filtros
        const resultado = await eel.listar_processos_com_prazos(searchTerm, currentPage, proceduresPerPage, filtrosObj)();
        console.log("✅ Resposta do servidor (procedimentos com prazos):", resultado);
        
        if (resultado.sucesso) {
            todosOsProcedimentos = resultado.processos || [];
            procedimentosFiltrados = [...todosOsProcedimentos];
            totalProcedures = resultado.total || 0;
            
            console.log("📊 Total de procedimentos carregados:", todosOsProcedimentos.length);
            console.log("📊 Total geral no banco:", totalProcedures);
            
            // Atualizar controles de paginação
            updatePaginationControls();
            
            // Ocultar loader
            if (loaderContainer) loaderContainer.style.display = 'none';
            
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
            // Ocultar loader em caso de erro
            if (loaderContainer) loaderContainer.style.display = 'none';
            console.error('❌ Erro retornado pelo servidor:', resultado.mensagem);
            showAlert(resultado.mensagem || 'Erro ao carregar procedimentos!', 'error');
            mostrarMensagemErro('Erro ao carregar registros', resultado.mensagem);
        }
    } catch (error) {
        // Ocultar loader em caso de exceção
        if (loaderContainer) loaderContainer.style.display = 'none';
        console.error('❌ Erro ao carregar procedimentos:', error);
        console.error('❌ Tipo do erro:', typeof error);
        console.error('❌ Stack trace:', error.stack);
        showAlert('Erro ao carregar lista de procedimentos!', 'error');
        mostrarMensagemErro('Erro ao carregar registros', `Erro: ${error.message || error.toString()}`);
    }
}

// Funções de paginação
function updatePaginationControls() {
    const totalPages = Math.ceil(totalProcedures / proceduresPerPage);
    const pageInfoSpan = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (pageInfoSpan) {
        pageInfoSpan.textContent = `Página ${currentPage} de ${totalPages}`;
    }
    
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalProcedures / proceduresPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        carregarProcedimentos();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        carregarProcedimentos();
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
    // Verificar se o processo/procedimento está concluído
    if (procedimento.concluido === true || procedimento.concluido === 1) {
        const dataFormatada = procedimento.data_conclusao ? 
            new Date(procedimento.data_conclusao).toLocaleDateString('pt-BR') : 'Data não informada';
        return `<span class="status-prazo concluido" title="Processo/Procedimento concluído em ${dataFormatada}">
                    <i class="fas fa-check-circle"></i> Concluído
                </span>`;
    }
    
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
    // Priorizar numero_controle, depois fallback para numero
    if (procedimento.numero_controle) {
        return procedimento.numero_controle;
    }
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
            
            // Para PAD/CD/CJ, usar presidente + "e outros" e tooltip com funções; senão usar responsável
            const isProcessoFuncoes = procedimento.tipo_geral === 'processo' && ['PAD','CD','CJ'].includes(procedimento.tipo_detalhe);
            const encarregadoCompleto = isProcessoFuncoes
                ? (procedimento.encarregado_display || 'Não se aplica')
                : (procedimento.responsavel || 'Não informado');
            const encarregadoTooltip = isProcessoFuncoes
                ? (procedimento.encarregado_tooltip || encarregadoCompleto)
                : encarregadoCompleto;
            
            // Backend já retorna formatado: "posto/grad + matrícula + nome" (para múltiplos PMs, usar tooltip resumido)
            const pmEnvolvido = procedimento.pm_envolvido_nome || 'Não informado';
            const pmEnvolvidoTooltip = procedimento.pm_envolvido_tooltip || pmEnvolvido;
            
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
                    <td title="${encarregadoTooltip}">${encarregadoCompleto}</td>
                    <td title="${pmEnvolvidoTooltip}">${pmEnvolvido}</td>
                    <td style="text-align: center;">${statusPrazoHTML}</td>
                    <td>
                        <div class="action-buttons-inline">
                            <button class="btn-action view-btn" onclick="visualizarProcedimento('${procedimento.id}')" title="Visualizar">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${window.permissoes && window.permissoes.temPermissaoEscrita() ? `
                            <button class="btn-action" onclick="abrirModalAndamentos('${procedimento.id}', '${numero.replace(/'/g, '\\\'')}')" title="Andamentos">
                                <i class="fas fa-history"></i>
                            </button>
                            <button class="btn-action" data-numero="${encodeURIComponent(numero)}" onclick="abrirModalProrrogacao('${procedimento.id}', decodeURIComponent(this.dataset.numero))" title="Adicionar prorrogação">
                                <i class="fas fa-clock"></i>
                            </button>
                            <button onclick="abrirModalSubstituirEncarregado('${procedimento.id}')" class="btn-action" title="Substituir Encarregado">
                                <i class="fas fa-user-friends"></i>
                            </button>
                            <button onclick="editarProcedimento('${procedimento.id}')" class="btn-edit" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="excluirProcedimento('${procedimento.id}', '${numero.replace(/'/g, '\\\'')}')" class="btn-delete" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        console.log("✅ Tabela preenchida com", procedimentosFiltrados.length, "procedimentos");
    }
    
    // Sempre atualizar os controles de paginação
    updatePaginationControls();
}

// Modal de andamentos (histórico de progresso)
let modalAndamentos;

function abrirModalAndamentos(processoId, numeroProcesso) {
    if (!modalAndamentos) {
        criarModalAndamentos();
    }
    
    // Armazenar o ID do processo no modal
    modalAndamentos.dataset.processoId = processoId;
    modalAndamentos.querySelector('#andamentosNumero').textContent = numeroProcesso;
    
    // Limpar o campo de texto sempre que abrir o modal
    modalAndamentos.querySelector('#textoAndamento').value = '';
    
    // Carregar andamentos existentes
    carregarAndamentos(processoId);
    
    // Mostrar modal
    modalAndamentos.style.display = 'flex';
}

function fecharModalAndamentos() {
    if (modalAndamentos) {
        modalAndamentos.style.display = 'none';
        // Limpar lista ao fechar
        const lista = modalAndamentos.querySelector('#listaAndamentos');
        if (lista) lista.innerHTML = '';
        // Limpar campo de texto ao fechar
        const textoAndamento = modalAndamentos.querySelector('#textoAndamento');
        if (textoAndamento) textoAndamento.value = '';
    }
}

function criarModalAndamentos() {
    modalAndamentos = document.createElement('div');
    modalAndamentos.className = 'modal-andamentos-overlay';
    modalAndamentos.innerHTML = `
        <div class="modal-andamentos">
            <div class="modal-andamentos-header">
                <h3><i class="fas fa-history"></i> Andamentos do Processo</h3>
                <button class="modal-andamentos-close" onclick="fecharModalAndamentos()">&times;</button>
            </div>
            <div class="modal-andamentos-body">
                <div class="processo-info">
                    <i class="fas fa-folder-open"></i>
                    <div>
                        <span class="label">Processo/Procedimento:</span>
                        <span id="andamentosNumero" class="processo-numero"></span>
                    </div>
                </div>
                
                <!-- Formulário para adicionar novo andamento -->
                <div class="adicionar-andamento">
                    <div class="form-group-andamento">
                        <label><i class="fas fa-plus-circle"></i> Adicionar Novo Andamento</label>
                        <textarea id="textoAndamento" rows="3" placeholder="Descreva o andamento..." class="form-control-andamento"></textarea>
                    </div>
                    <button class="btn-adicionar-andamento" onclick="adicionarAndamento()">
                        <i class="fas fa-save"></i> Adicionar Andamento
                    </button>
                </div>
                
                <!-- Lista de andamentos existentes -->
                <div class="andamentos-existentes">
                    <h4><i class="fas fa-list"></i> Histórico de Andamentos</h4>
                    <div id="listaAndamentos" class="lista-andamentos">
                        <!-- Andamentos serão carregados aqui -->
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalAndamentos);
}

async function carregarAndamentos(processoId) {
    try {
        const resultado = await eel.listar_andamentos(processoId)();
        const lista = modalAndamentos.querySelector('#listaAndamentos');
        
        if (resultado.sucesso && resultado.andamentos) {
            if (resultado.andamentos.length === 0) {
                lista.innerHTML = '<p class="andamento-vazio">Nenhum andamento registrado ainda.</p>';
            } else {
                lista.innerHTML = resultado.andamentos.map(andamento => `
                    <div class="andamento-item">
                        <div class="andamento-header">
                            <span class="andamento-data">
                                <i class="fas fa-calendar"></i> 
                                ${formatarDataHora(andamento.data)}
                            </span>
                            <span class="andamento-usuario">
                                <i class="fas fa-user"></i> 
                                ${andamento.usuario}
                            </span>
                            <button class="btn-remover-andamento" onclick="removerAndamento('${andamento.id}')" title="Remover andamento">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="andamento-texto">${andamento.texto}</div>
                    </div>
                `).join('');
            }
        } else {
            lista.innerHTML = '<p class="andamento-erro">Erro ao carregar andamentos.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar andamentos:', error);
        const lista = modalAndamentos.querySelector('#listaAndamentos');
        lista.innerHTML = '<p class="andamento-erro">Erro ao carregar andamentos.</p>';
    }
}

async function adicionarAndamento() {
    const processoId = modalAndamentos.dataset.processoId;
    const texto = modalAndamentos.querySelector('#textoAndamento').value.trim();
    
    if (!texto) {
        showAlert('Por favor, descreva o andamento.', 'error');
        return;
    }
    
    try {
        // Obter nome do usuário logado
        const usuarioResult = await eel.obter_usuario_logado()();
        const usuarioNome = usuarioResult.logado ? usuarioResult.usuario.nome : 'Sistema';
        
        const resultado = await eel.adicionar_andamento(processoId, texto, usuarioNome)();
        
        if (resultado.sucesso) {
            // Fechar o modal de andamentos
            fecharModalAndamentos();
            
            // Mostrar modal de sucesso por 2 segundos
            showSuccessModal('Andamento adicionado com sucesso!', 2000);
        } else {
            showAlert(resultado.mensagem || 'Erro ao adicionar andamento.', 'error');
        }
    } catch (error) {
        console.error('Erro ao adicionar andamento:', error);
        showAlert('Erro ao adicionar andamento.', 'error');
    }
}

async function removerAndamento(andamentoId) {
    if (!confirm('Tem certeza que deseja remover este andamento?')) {
        return;
    }
    
    const processoId = modalAndamentos.dataset.processoId;
    
    try {
        const resultado = await eel.remover_andamento(processoId, andamentoId)();
        
        if (resultado.sucesso) {
            showAlert('Andamento removido com sucesso!', 'success');
            // Recarregar lista
            carregarAndamentos(processoId);
        } else {
            showAlert(resultado.mensagem || 'Erro ao remover andamento.', 'error');
        }
    } catch (error) {
        console.error('Erro ao remover andamento:', error);
        showAlert('Erro ao remover andamento.', 'error');
    }
}

function formatarDataHora(dataString) {
    try {
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dataString;
    }
}

// Modal de prorrogação
let modalProrrogacao;
async function abrirModalProrrogacao(processoId, numeroFmt) {
    try {
        // Buscar dados do procedimento para verificar se está concluído
        const procedimento = await eel.obter_processo(processoId)();
        
        if (!procedimento) {
            showAlert('Erro ao carregar dados do procedimento.', 'error');
            return;
        }
        
        // Verificar se o procedimento está concluído
        if (procedimento.concluido === 1 || procedimento.concluido === true) {
            const tipoTexto = procedimento.tipo_geral === 'processo' ? 'processo' : 'procedimento';
            showErrorModal(
                'Ação Não Permitida',
                `Não é possível adicionar prorrogação de prazo pois este ${tipoTexto} já está concluído.`,
                'fa-exclamation-triangle'
            );
            return;
        }
        
        // Se não está concluído, abrir o modal normalmente
        if (!modalProrrogacao) {
            criarModalProrrogacao();
        }
        modalProrrogacao.querySelector('#prorProcId').value = processoId;
        modalProrrogacao.querySelector('#prorNumero').textContent = numeroFmt;
        modalProrrogacao.style.display = 'flex';
        // Focar no primeiro campo após abrir
        setTimeout(() => {
            modalProrrogacao.querySelector('#prorDias').focus();
        }, 100);
    } catch (error) {
        console.error('Erro ao verificar status do procedimento:', error);
        showAlert('Erro ao processar a solicitação. Por favor, tente novamente.', 'error');
    }
}

function fecharModalProrrogacao() {
    if (modalProrrogacao) {
        modalProrrogacao.style.display = 'none';
        // Limpar campos ao fechar
        modalProrrogacao.querySelector('#prorDias').value = '';
        modalProrrogacao.querySelector('#prorPortaria').value = '';
        modalProrrogacao.querySelector('#prorDataPortaria').value = '';
        modalProrrogacao.querySelector('#prorMotivo').value = '';
    }
}

function criarModalProrrogacao() {
    modalProrrogacao = document.createElement('div');
    modalProrrogacao.className = 'modal-prorrogacao-overlay';
    modalProrrogacao.innerHTML = `
        <div class="modal-prorrogacao">
            <div class="modal-prorrogacao-header">
                <h3><i class="fas fa-clock"></i> Adicionar Prorrogação de Prazo</h3>
                <button class="modal-prorrogacao-close" onclick="fecharModalProrrogacao()">&times;</button>
            </div>
            <div class="modal-prorrogacao-body">
                <input type="hidden" id="prorProcId" />
                <div class="processo-info">
                    <i class="fas fa-folder-open"></i>
                    <div>
                        <span class="label">Processo/Procedimento:</span>
                        <span id="prorNumero" class="processo-numero"></span>
                    </div>
                </div>
                
                <div class="form-group-prorrogacao">
                    <label><i class="fas fa-calendar-plus"></i> Dias de prorrogação *</label>
                    <input type="number" id="prorDias" min="1" placeholder="Ex: 10" class="form-control-prorrogacao" required />
                </div>
                
                <div class="form-row-prorrogacao">
                    <div class="form-group-prorrogacao">
                        <label><i class="fas fa-file-alt"></i> Número da Portaria</label>
                        <input type="text" id="prorPortaria" placeholder="Ex: 123" class="form-control-prorrogacao" />
                    </div>
                    <div class="form-group-prorrogacao">
                        <label><i class="fas fa-calendar"></i> Data da Portaria</label>
                        <input type="date" id="prorDataPortaria" class="form-control-prorrogacao" />
                    </div>
                </div>
                
                <div class="form-group-prorrogacao">
                    <label><i class="fas fa-comment-alt"></i> Motivo/Justificativa (opcional)</label>
                    <textarea id="prorMotivo" rows="3" placeholder="Descreva o motivo da prorrogação..." class="form-control-prorrogacao"></textarea>
                </div>
            </div>
            <div class="modal-prorrogacao-footer">
                <button class="btn-prorrogacao-save" onclick="salvarProrrogacao()">
                    <i class="fas fa-save"></i> Salvar Prorrogação
                </button>
                <button class="btn-prorrogacao-cancel" onclick="fecharModalProrrogacao()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>`;
    document.body.appendChild(modalProrrogacao);
}

async function salvarProrrogacao() {
    const procId = modalProrrogacao.querySelector('#prorProcId').value;
    const dias = parseInt(modalProrrogacao.querySelector('#prorDias').value || '0', 10);
    const numPortaria = modalProrrogacao.querySelector('#prorPortaria').value || null;
    const dataPortaria = modalProrrogacao.querySelector('#prorDataPortaria').value || null;
    const motivo = modalProrrogacao.querySelector('#prorMotivo').value || null;
    
    if (!dias || dias <= 0) {
        showAlert('Por favor, informe a quantidade de dias da prorrogação.', 'error');
        modalProrrogacao.querySelector('#prorDias').focus();
        return;
    }
    
    try {
        const res = await eel.adicionar_prorrogacao(procId, dias, numPortaria, dataPortaria, motivo, null, null)();
        if (res && res.sucesso) {
            // Montar mensagem de sucesso
            let mensagemSucesso = res.mensagem || 'Prorrogação salva com sucesso!';
            if (res.ordem_prorrogacao) {
                mensagemSucesso += `<br><strong>Prorrogação nº ${res.ordem_prorrogacao}</strong>`;
            }
            if (res.nova_data_vencimento) {
                mensagemSucesso += `<br>Novo vencimento: <strong>${res.nova_data_vencimento}</strong>`;
            }
            
            // Fechar modal de prorrogação primeiro
            fecharModalProrrogacao();
            
            // Mostrar modal de sucesso com auto-fechamento em 2 segundos
            showSuccessModal(mensagemSucesso, 2000);
            
            // Recarregar procedimentos após o modal de sucesso fechar
            setTimeout(() => {
                carregarProcedimentos();
            }, 2300); // Aguardar o modal fechar + 300ms
        } else {
            // Mostrar mensagem de erro
            showAlert(res?.mensagem || 'Erro ao salvar prorrogação. Por favor, tente novamente.', 'error');
        }
    } catch (e) {
        console.error('Erro ao salvar prorrogação:', e);
        showAlert('Erro ao processar a solicitação. Por favor, tente novamente.', 'error');
    }
}

// Função para buscar procedimentos
function buscarProcedimentos() {
    const termoBusca = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Clear do timeout anterior para implementar debounce
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Busca em tempo real com delay de 300ms para otimizar performance
    searchTimeout = setTimeout(() => {
        currentPage = 1; // Resetar para a primeira página ao pesquisar
        carregarProcedimentos(); // Recarregar com o novo termo de busca
    }, 300);
    
    // Atualizar visibilidade do botão de limpar
    atualizarVisibilidadeBotaoLimpar();
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
async function aplicarFiltrosModal() {
    fecharModalFiltros();
    await aplicarFiltros();
}

// Função para limpar filtros do modal
async function limparFiltrosModal() {
    fecharModalFiltros();
    await limparFiltros();
}

// Função para carregar as opções dos filtros baseado no banco de dados completo
async function carregarOpcoesDosFiltros() {
    try {
        console.log("🔄 Carregando opções dos filtros do banco de dados...");
        const resultado = await eel.obter_opcoes_filtros()();
        
        if (resultado.sucesso) {
            const opcoes = resultado.opcoes;
            
            // Armazenar opções para datalist
            opcoesEncarregados = opcoes.encarregados || [];
            opcoesPmEnvolvidos = opcoes.pm_envolvidos || [];
            opcoesVitimas = opcoes.vitimas || [];
            
            // Povoar os selects normais
            povoarSelect('filtroTipo', opcoes.tipos);
            povoarSelect('filtroAno', opcoes.anos);
            povoarSelect('filtroOrigem', opcoes.origens);
            povoarSelect('filtroLocalFatos', opcoes.locais_fatos);
            // Removido: filtroStatus
            povoarSelect('filtroDocumento', opcoes.documentos);
            
            // Configurar datalist para os campos especiais
            configurarDatalist();
            
            console.log("✅ Opções dos filtros carregadas:", opcoes);
        } else {
            console.error("❌ Erro ao carregar opções dos filtros:", resultado.mensagem);
            // Fallback para o método antigo se houver erro
            carregarOpcoesDosFiltrosLegacy();
        }
    } catch (error) {
        console.error("❌ Erro ao carregar opções dos filtros:", error);
        // Fallback para o método antigo se houver erro
        carregarOpcoesDosFiltrosLegacy();
    }
}

// Função legacy (fallback) para carregar opções dos filtros baseado apenas na página atual
function carregarOpcoesDosFiltrosLegacy() {
    if (todosOsProcedimentos.length === 0) return;
    
    // Coletar valores únicos para cada filtro
    const tipos = [...new Set(todosOsProcedimentos.map(p => p.tipo_detalhe).filter(t => t))].sort();
    const anos = [...new Set(todosOsProcedimentos.map(p => extrairAno(p)).filter(a => a))].sort().reverse();
    const origens = [...new Set(todosOsProcedimentos.map(p => p.local_origem).filter(o => o))].sort();
    const encarregados = [...new Set(todosOsProcedimentos.map(p => p.responsavel).filter(e => e))].sort();
    // Removido: status_pm do fallback
    
    // Povoar os selects
    povoarSelect('filtroTipo', tipos);
    povoarSelect('filtroAno', anos);
    povoarSelect('filtroOrigem', origens);
    // Removido: povoar filtroStatus
    
    // Povoar datalists para campos especiais no fallback
    if (encarregados.length > 0) {
        opcoesEncarregados = encarregados;
        povoarDatalist('listaEncarregados', opcoesEncarregados);
    }
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
async function aplicarFiltros() {
    console.log("🔍 Aplicando filtros avançados...");
    
    // Coletar valores dos filtros
    filtrosAtivos = {
        tipo: document.getElementById('filtroTipo').value,
        ano: document.getElementById('filtroAno').value,
        origem: document.getElementById('filtroOrigem').value,
        local_fatos: document.getElementById('filtroLocalFatos').value,
        encarregado: getDatalistValue('filtroEncarregado'),
    // Removido: status PM
        pm_envolvido: getDatalistValue('filtroPmEnvolvido'),
        vitima: getDatalistValue('filtroVitima'),
        documento: document.getElementById('filtroDocumento').value,
        situacao: document.getElementById('filtroSituacao').value,
        data_inicio: document.getElementById('filtroDataInicio').value,
        data_fim: document.getElementById('filtroDataFim').value
    };
    
    console.log("🏷️ Filtros coletados:", filtrosAtivos);
    
    // Contar filtros aplicados para exibir mensagem
    const filtrosAplicados = [];
    Object.keys(filtrosAtivos).forEach(key => {
        if (filtrosAtivos[key] && filtrosAtivos[key].trim()) {
            const nomeAmigavel = {
                'tipo': 'Tipo',
                'ano': 'Ano', 
                'origem': 'Origem',
                'local_fatos': 'Local dos Fatos',
                'encarregado': 'Responsável',
                // Removido: Status PM
                'pm_envolvido': 'PM Envolvido',
                'vitima': 'Vítima/Ofendido',
                'documento': 'Documento',
                'situacao': 'Situação',
                'data_inicio': 'Data Início',
                'data_fim': 'Data Fim'
            };
            filtrosAplicados.push(`${nomeAmigavel[key]}: ${filtrosAtivos[key]}`);
        }
    });
    
    // Resetar para primeira página
    currentPage = 1;
    
    // Recarregar com os filtros aplicados (sem modificar o campo de busca)
    await carregarProcedimentos();
    
    // Atualizar indicador visual
    atualizarIndicadorFiltros();
    
    // Mensagens de filtros removidas conforme solicitado
    // if (filtrosAplicados.length > 0) {
    //     showAlert(`Filtros aplicados: ${filtrosAplicados.join(', ')}`, 'success');
    // } else {
    //     showAlert('Filtros limpos! Mostrando todos os registros.', 'info');
    // }
}

// Função para limpar todos os filtros
async function limparFiltros() {
    console.log("🧹 Limpando todos os filtros...");
    
    // Limpar valores dos selects
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroAno').value = '';
    document.getElementById('filtroOrigem').value = '';
    document.getElementById('filtroLocalFatos').value = '';
    // Removido: limpar filtroStatus
    document.getElementById('filtroDocumento').value = '';
    document.getElementById('filtroSituacao').value = '';
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    
    // Limpar campos de datalist
    limparCampoDatalist('filtroEncarregado');
    limparCampoDatalist('filtroPmEnvolvido');
    limparCampoDatalist('filtroVitima');
    
    // Resetar filtros (sem tocar no campo de busca)
    filtrosAtivos = {};
    
    // Resetar para primeira página
    currentPage = 1;
    
    // Recarregar dados sem filtros (mantendo busca se existir)
    await carregarProcedimentos();
    
    // Atualizar indicadores visuais
    atualizarIndicadorFiltros();
    atualizarVisibilidadeBotaoLimpar();
    
    // Mensagem removida conforme solicitado
    // showAlert('Todos os filtros foram limpos!', 'success');
}

// Função para limpar busca e filtros
function limparBusca() {
    console.log("🧹 Limpando busca e filtros...");
    
    // Limpar campo de busca
    document.getElementById('searchInput').value = '';
    
    // Limpar valores dos selects
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroAno').value = '';
    document.getElementById('filtroOrigem').value = '';
    document.getElementById('filtroLocalFatos').value = '';
    document.getElementById('filtroDocumento').value = '';
    document.getElementById('filtroSituacao').value = '';
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    
    // Limpar campos de datalist
    limparCampoDatalist('filtroEncarregado');
    limparCampoDatalist('filtroPmEnvolvido');
    limparCampoDatalist('filtroVitima');
    
    // Resetar filtros
    filtrosAtivos = {};
    
    // Resetar para primeira página
    currentPage = 1;
    
    // Recarregar dados sem busca e sem filtros
    carregarProcedimentos();
    
    // Atualizar indicadores visuais
    atualizarIndicadorFiltros();
    atualizarVisibilidadeBotaoLimpar();
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
    
    // Atualizar visibilidade do botão de limpar
    atualizarVisibilidadeBotaoLimpar();
}

// Função para atualizar visibilidade do botão de limpar
function atualizarVisibilidadeBotaoLimpar() {
    const clearButton = document.getElementById('clearButton');
    const searchInput = document.getElementById('searchInput');
    
    if (!clearButton || !searchInput) return;
    
    const termoBusca = searchInput.value.toLowerCase().trim();
    const temFiltrosAtivos = Object.values(filtrosAtivos).some(valor => valor && valor.trim());
    
    // Mostrar botão se houver busca OU filtros ativos
    if (termoBusca !== '' || temFiltrosAtivos) {
        clearButton.style.display = 'inline-block';
    } else {
        clearButton.style.display = 'none';
    }
}

// Função para configurar datalist
function configurarDatalist() {
    povoarDatalist('listaEncarregados', opcoesEncarregados);
    povoarDatalist('listaPmEnvolvidos', opcoesPmEnvolvidos);
    povoarDatalist('listaVitimas', opcoesVitimas);
}

// Função para povoar um datalist com opções
function povoarDatalist(datalistId, opcoes) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    
    // Limpar opções existentes (exceto a primeira "Todos")
    const primeiraOpcao = datalist.querySelector('option[value=""]');
    datalist.innerHTML = '';
    if (primeiraOpcao) {
        datalist.appendChild(primeiraOpcao);
    } else {
        const opcaoTodos = document.createElement('option');
        opcaoTodos.value = '';
        opcaoTodos.textContent = 'Todos';
        datalist.appendChild(opcaoTodos);
    }
    
    // Adicionar as opções
    opcoes.forEach(opcao => {
        const option = document.createElement('option');
        option.value = opcao;
        option.textContent = opcao;
        datalist.appendChild(option);
    });
}

// Função para limpar um campo com datalist
function limparCampoDatalist(campoId) {
    const input = document.getElementById(campoId);
    if (input) input.value = '';
}

// Função helper para obter valor de campo com datalist (igual aos inputs normais)
function getDatalistValue(campoId) {
    const input = document.getElementById(campoId);
    return input ? input.value : '';
}

// Função para editar procedimento
function editarProcedimento(id) {
    window.location.href = `procedure_form.html?id=${id}`;
}

// Função para visualizar procedimento (abre página dedicada)
function visualizarProcedimento(id) {
    window.location.href = `procedure_view.html?id=${id}`;
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
                showSuccessModal('Procedimento excluído com sucesso!', 2000);
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
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM carregado, inicializando...");

    // Inicializar sistema de permissões
    await window.permissoes.inicializar();

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
    
    // Carregar opções dos filtros do banco de dados completo
    carregarOpcoesDosFiltros();
    
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
    
    // Event listeners para paginação
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', prevPage);
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', nextPage);
    }
    
    // Event listener para busca em tempo real com debounce
    const searchInputElement = document.getElementById('searchInput');
    if (searchInputElement) {
        searchInputElement.addEventListener('input', buscarProcedimentos);
    }
});

// Modal de substituição de encarregado
let modalSubstituirEncarregado;

function abrirModalSubstituirEncarregado(processoId) {
    if (!modalSubstituirEncarregado) {
        criarModalSubstituirEncarregado();
    }
    
    // Armazenar o ID do processo no modal
    modalSubstituirEncarregado.dataset.processoId = processoId;
    
    // Limpar campos
    modalSubstituirEncarregado.querySelector('#selectNovoEncarregado').innerHTML = '<option value="">Carregando...</option>';
    modalSubstituirEncarregado.querySelector('#justificativaSubstituicao').value = '';
    
    // Carregar lista de usuários
    carregarUsuariosParaSubstituicao();
    
    // Mostrar modal
    modalSubstituirEncarregado.style.display = 'flex';
}

function fecharModalSubstituirEncarregado() {
    if (modalSubstituirEncarregado) {
        modalSubstituirEncarregado.style.display = 'none';
    }
}

function criarModalSubstituirEncarregado() {
    modalSubstituirEncarregado = document.createElement('div');
    modalSubstituirEncarregado.className = 'modal-substituir-encarregado-overlay';
    modalSubstituirEncarregado.innerHTML = `
        <div class="modal-substituir-encarregado">
            <div class="modal-substituir-encarregado-header">
                <h3><i class="fas fa-user-friends"></i> Substituir Encarregado</h3>
                <button class="modal-substituir-encarregado-close" onclick="fecharModalSubstituirEncarregado()">&times;</button>
            </div>
            <div class="modal-substituir-encarregado-body">
                <div class="form-group-substituicao">
                    <label><i class="fas fa-user"></i> Novo Encarregado *</label>
                    <select id="selectNovoEncarregado" class="form-control-substituicao" required>
                        <option value="">Selecione um encarregado...</option>
                    </select>
                </div>
                
                <div class="form-group-substituicao">
                    <label><i class="fas fa-comment-alt"></i> Justificativa (Opcional)</label>
                    <textarea id="justificativaSubstituicao" rows="3" placeholder="Descreva o motivo da substituição..." class="form-control-substituicao"></textarea>
                </div>
            </div>
            <div class="modal-substituir-encarregado-footer">
                <button class="btn-substituicao-cancel" onclick="fecharModalSubstituirEncarregado()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="btn-substituicao-save" onclick="salvarSubstituicaoEncarregado()">
                    <i class="fas fa-save"></i> Substituir Encarregado
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modalSubstituirEncarregado);
}

async function carregarUsuariosParaSubstituicao() {
    try {
        const resultado = await eel.listar_encarregados_operadores()();
        const select = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
        
        if (resultado && Array.isArray(resultado)) {
            // Limpar opções existentes
            select.innerHTML = '<option value="">Selecione um encarregado...</option>';
            
            // Adicionar usuários ao select
            resultado.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = usuario.nome_completo;
                option.dataset.tipo = usuario.tipo;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">Erro ao carregar usuários</option>';
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        const select = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
        select.innerHTML = '<option value="">Erro ao carregar usuários</option>';
    }
}

async function salvarSubstituicaoEncarregado() {
    const processoId = modalSubstituirEncarregado.dataset.processoId;
    const selectNovoEncarregado = modalSubstituirEncarregado.querySelector('#selectNovoEncarregado');
    const justificativa = modalSubstituirEncarregado.querySelector('#justificativaSubstituicao').value;
    
    const novoEncarregadoId = selectNovoEncarregado.value;
    
    if (!novoEncarregadoId) {
        showAlert('Por favor, selecione um novo encarregado.', 'error');
        return;
    }
    
    try {
        const resultado = await eel.substituir_encarregado(processoId, novoEncarregadoId, justificativa)();
        
        if (resultado.sucesso) {
            // Fechar modal
            fecharModalSubstituirEncarregado();
            
            // Mostrar modal de sucesso por 2 segundos
            showSuccessModal('Encarregado substituído com sucesso!', 2000);
            
            // Recarregar a lista de procedimentos
            await carregarProcedimentos();
        } else {
            showAlert(resultado.mensagem || 'Erro ao substituir encarregado.', 'error');
        }
    } catch (error) {
        console.error('Erro ao substituir encarregado:', error);
        showAlert('Erro ao substituir encarregado.', 'error');
    }
}

// Função para exibir modal de erro/aviso centralizado
function showErrorModal(title, message, iconClass = 'fa-exclamation-triangle') {
    // Verificar se já existe o modal, senão criar
    let modal = document.getElementById('errorModalOverlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'errorModalOverlay';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 2rem;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                text-align: center;
            ">
                <div id="errorModalIcon" style="font-size: 4rem; margin-bottom: 1rem;"></div>
                <h3 id="errorModalTitle" style="margin-bottom: 1rem; color: #333;"></h3>
                <p id="errorModalMessage" style="margin-bottom: 1.5rem; color: #666; line-height: 1.6;"></p>
                <button id="errorModalBtn" style="
                    background-color: #e74c3c;
                    color: white;
                    border: none;
                    padding: 0.75rem 2rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: bold;
                    transition: background-color 0.3s;
                " onmouseover="this.style.backgroundColor='#c0392b'" 
                   onmouseout="this.style.backgroundColor='#e74c3c'">
                    OK
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Fechar ao clicar no botão
        document.getElementById('errorModalBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Fechar ao clicar fora do modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Atualizar conteúdo
    const iconElement = document.getElementById('errorModalIcon');
    const titleElement = document.getElementById('errorModalTitle');
    const messageElement = document.getElementById('errorModalMessage');
    
    iconElement.innerHTML = `<i class="fas ${iconClass}" style="color: #e74c3c;"></i>`;
    titleElement.textContent = title;
    messageElement.innerHTML = message;
    
    // Mostrar modal
    modal.style.display = 'flex';
}
