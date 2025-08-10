/**
 * Modal para gerenciar indícios específicos por PM envolvido
 * Criado para permitir que cada PM tenha suas próprias categorias de indícios
 */

class IndiciosPMModal {
    constructor() {
        this.modalElement = null;
        this.currentPMEnvolvidoId = null;
        this.currentPMData = null;
        this.selectedIndicios = {
            categorias: [],
            crimes: [],
            rdpm: [],
            art29: []
        };
        this.initModal();
    }

    initModal() {
        this.createModalHTML();
        this.attachEventListeners();
    }

    createModalHTML() {
        const modalHTML = `
        <div class="modal fade" id="indiciosPMModal" tabindex="-1" aria-labelledby="indiciosPMModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="indiciosPMModalLabel">
                            <i class="fas fa-search"></i> Indícios Específicos - PM
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Info do PM -->
                        <div class="alert alert-info" id="pmInfoAlert">
                            <strong>PM Selecionado:</strong> <span id="pmNomeCompleto">-</span>
                        </div>

                        <!-- Abas de navegação -->
                        <ul class="nav nav-tabs" id="indiciosTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" id="categorias-tab" data-bs-toggle="tab" data-bs-target="#categorias-pane" type="button" role="tab">
                                    <i class="fas fa-tags"></i> Categorias <span class="badge bg-secondary ms-1" id="contadorCategorias">0</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="crimes-tab" data-bs-toggle="tab" data-bs-target="#crimes-pane" type="button" role="tab">
                                    <i class="fas fa-gavel"></i> Crimes/Contravenções <span class="badge bg-secondary ms-1" id="contadorCrimes">0</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="rdpm-tab" data-bs-toggle="tab" data-bs-target="#rdpm-pane" type="button" role="tab">
                                    <i class="fas fa-balance-scale"></i> RDPM <span class="badge bg-secondary ms-1" id="contadorRDPM">0</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="art29-tab" data-bs-toggle="tab" data-bs-target="#art29-pane" type="button" role="tab">
                                    <i class="fas fa-book"></i> Art. 29 <span class="badge bg-secondary ms-1" id="contadorArt29">0</span>
                                </button>
                            </li>
                        </ul>

                        <!-- Conteúdo das abas -->
                        <div class="tab-content mt-3" id="indiciosTabContent">
                            <!-- Aba Categorias -->
                            <div class="tab-pane fade show active" id="categorias-pane" role="tabpanel">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-plus-circle text-success"></i> Adicionar Categoria</h6>
                                        <div class="input-group mb-3">
                                            <input type="text" class="form-control" id="novaCategoriaInput" placeholder="Digite uma categoria de indício">
                                            <button class="btn btn-success" type="button" id="adicionarCategoriaBtn">
                                                <i class="fas fa-plus"></i> Adicionar
                                            </button>
                                        </div>
                                        
                                        <h6><i class="fas fa-list"></i> Categorias Sugeridas</h6>
                                        <div class="d-flex flex-wrap gap-2" id="categoriasSugeridas">
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Documentos">Documentos</button>
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Testemunhas">Testemunhas</button>
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Material apreendido">Material apreendido</button>
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Perícia">Perícia</button>
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Gravações">Gravações</button>
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Imagens">Imagens</button>
                                            <button class="btn btn-outline-primary btn-sm categoria-sugerida" data-categoria="Relatórios">Relatórios</button>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-check-circle text-primary"></i> Categorias Selecionadas</h6>
                                        <div id="categoriasSelecionadas" class="border rounded p-3 min-height-200">
                                            <small class="text-muted">Nenhuma categoria selecionada</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Aba Crimes -->
                            <div class="tab-pane fade" id="crimes-pane" role="tabpanel">
                                <div class="row">
                                    <div class="col-md-12 mb-3">
                                        <div class="input-group">
                                            <input type="text" class="form-control" id="buscaCrimesInput" placeholder="Buscar crimes/contravenções...">
                                            <button class="btn btn-outline-secondary" type="button" id="buscarCrimesBtn">
                                                <i class="fas fa-search"></i> Buscar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-list"></i> Crimes Disponíveis</h6>
                                        <div id="crimesDisponiveis" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                                            <div class="text-center p-3">
                                                <div class="spinner-border text-primary" role="status">
                                                    <span class="visually-hidden">Carregando...</span>
                                                </div>
                                                <p class="mt-2">Carregando crimes...</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-check-circle text-primary"></i> Crimes Selecionados</h6>
                                        <div id="crimesSelecionados" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                                            <small class="text-muted">Nenhum crime selecionado</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Aba RDPM -->
                            <div class="tab-pane fade" id="rdpm-pane" role="tabpanel">
                                <div class="row">
                                    <div class="col-md-12 mb-3">
                                        <div class="row">
                                            <div class="col-md-8">
                                                <div class="input-group">
                                                    <input type="text" class="form-control" id="buscaRDPMInput" placeholder="Buscar transgressões RDPM...">
                                                    <button class="btn btn-outline-secondary" type="button" id="buscarRDPMBtn">
                                                        <i class="fas fa-search"></i> Buscar
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <select class="form-select" id="filtroGravidadeRDPM">
                                                    <option value="">Todas as gravidades</option>
                                                    <option value="leve">Leve</option>
                                                    <option value="media">Média</option>
                                                    <option value="grave">Grave</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-list"></i> Transgressões Disponíveis</h6>
                                        <div id="rdpmDisponiveis" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                                            <div class="text-center p-3">
                                                <div class="spinner-border text-primary" role="status">
                                                    <span class="visually-hidden">Carregando...</span>
                                                </div>
                                                <p class="mt-2">Carregando transgressões...</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-check-circle text-primary"></i> Transgressões Selecionadas</h6>
                                        <div id="rdpmSelecionadas" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                                            <small class="text-muted">Nenhuma transgressão selecionada</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Aba Art. 29 -->
                            <div class="tab-pane fade" id="art29-pane" role="tabpanel">
                                <div class="row">
                                    <div class="col-md-12 mb-3">
                                        <div class="input-group">
                                            <input type="text" class="form-control" id="buscaArt29Input" placeholder="Buscar infrações do Art. 29...">
                                            <button class="btn btn-outline-secondary" type="button" id="buscarArt29Btn">
                                                <i class="fas fa-search"></i> Buscar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-list"></i> Infrações Disponíveis</h6>
                                        <div id="art29Disponiveis" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                                            <div class="text-center p-3">
                                                <div class="spinner-border text-primary" role="status">
                                                    <span class="visually-hidden">Carregando...</span>
                                                </div>
                                                <p class="mt-2">Carregando infrações...</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-check-circle text-primary"></i> Infrações Selecionadas</h6>
                                        <div id="art29Selecionadas" class="border rounded p-2" style="max-height: 400px; overflow-y: auto;">
                                            <small class="text-muted">Nenhuma infração selecionada</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="me-auto">
                            <button type="button" class="btn btn-warning" id="limparTodosBtn">
                                <i class="fas fa-trash"></i> Limpar Todos
                            </button>
                        </div>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" id="salvarIndiciosBtn">
                            <i class="fas fa-save"></i> Salvar Indícios
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        // Adicionar o modal ao body se não existir
        if (!document.getElementById('indiciosPMModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modalElement = new bootstrap.Modal(document.getElementById('indiciosPMModal'));
    }

    attachEventListeners() {
        const modal = document.getElementById('indiciosPMModal');

        // Adicionar categoria
        modal.querySelector('#adicionarCategoriaBtn').addEventListener('click', () => {
            this.adicionarCategoria();
        });

        modal.querySelector('#novaCategoriaInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.adicionarCategoria();
            }
        });

        // Categorias sugeridas
        modal.querySelectorAll('.categoria-sugerida').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoria = e.target.dataset.categoria;
                this.adicionarCategoriaEspecifica(categoria);
            });
        });

        // Busca de crimes
        modal.querySelector('#buscarCrimesBtn').addEventListener('click', () => {
            this.buscarCrimes();
        });

        modal.querySelector('#buscaCrimesInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.buscarCrimes();
            }
        });

        // Busca de RDPM
        modal.querySelector('#buscarRDPMBtn').addEventListener('click', () => {
            this.buscarRDPM();
        });

        modal.querySelector('#buscaRDPMInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.buscarRDPM();
            }
        });

        modal.querySelector('#filtroGravidadeRDPM').addEventListener('change', () => {
            this.buscarRDPM();
        });

        // Busca de Art. 29
        modal.querySelector('#buscarArt29Btn').addEventListener('click', () => {
            this.buscarArt29();
        });

        modal.querySelector('#buscaArt29Input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.buscarArt29();
            }
        });

        // Salvar e limpar
        modal.querySelector('#salvarIndiciosBtn').addEventListener('click', () => {
            this.salvarIndicios();
        });

        modal.querySelector('#limparTodosBtn').addEventListener('click', () => {
            this.limparTodos();
        });

        // Carregar dados quando o modal é mostrado
        modal.addEventListener('shown.bs.modal', () => {
            this.carregarDadosIniciais();
        });
    }

    /**
     * Abre o modal para um PM específico
     */
    async abrir(pmEnvolvidoId, pmData) {
        console.log('🔧 Abrindo modal de indícios para PM:', pmData);
        
        this.currentPMEnvolvidoId = pmEnvolvidoId;
        this.currentPMData = pmData;

        // Atualizar informações do PM no modal
        document.getElementById('pmNomeCompleto').textContent = pmData.nome_completo || 'PM não identificado';

        // Limpar seleções anteriores
        this.selectedIndicios = {
            categorias: [],
            crimes: [],
            rdpm: [],
            art29: []
        };

        // Carregar indícios existentes
        await this.carregarIndiciosExistentes();

        // Mostrar modal
        this.modalElement.show();
    }

    async carregarIndiciosExistentes() {
        try {
            console.log('📋 Carregando indícios existentes para PM:', this.currentPMEnvolvidoId);
            
            const resultado = await eel.carregar_indicios_pm_envolvido(this.currentPMEnvolvidoId)();
            
            if (resultado.sucesso) {
                this.selectedIndicios = resultado.indicios;
                this.atualizarVisualizacao();
                console.log('✅ Indícios carregados:', this.selectedIndicios);
            } else {
                console.warn('⚠️ Erro ao carregar indícios:', resultado.mensagem);
                this.showToast('Aviso', resultado.mensagem || 'Erro ao carregar indícios existentes', 'warning');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar indícios:', error);
            this.showToast('Erro', 'Erro ao carregar indícios existentes', 'error');
        }
    }

    carregarDadosIniciais() {
        // Carregar dados iniciais de cada aba quando necessário
        this.buscarCrimes();
        this.buscarRDPM();
        this.buscarArt29();
    }

    // ========== CATEGORIAS ==========

    adicionarCategoria() {
        const input = document.getElementById('novaCategoriaInput');
        const categoria = input.value.trim();
        
        if (categoria && !this.selectedIndicios.categorias.includes(categoria)) {
            this.selectedIndicios.categorias.push(categoria);
            input.value = '';
            this.atualizarVisualizacaoCategorias();
            this.atualizarContadores();
        }
    }

    adicionarCategoriaEspecifica(categoria) {
        if (!this.selectedIndicios.categorias.includes(categoria)) {
            this.selectedIndicios.categorias.push(categoria);
            this.atualizarVisualizacaoCategorias();
            this.atualizarContadores();
        }
    }

    removerCategoria(categoria) {
        const index = this.selectedIndicios.categorias.indexOf(categoria);
        if (index > -1) {
            this.selectedIndicios.categorias.splice(index, 1);
            this.atualizarVisualizacaoCategorias();
            this.atualizarContadores();
        }
    }

    atualizarVisualizacaoCategorias() {
        const container = document.getElementById('categoriasSelecionadas');
        
        if (this.selectedIndicios.categorias.length === 0) {
            container.innerHTML = '<small class="text-muted">Nenhuma categoria selecionada</small>';
            return;
        }

        const categoriasHTML = this.selectedIndicios.categorias.map(categoria => `
            <div class="badge bg-primary me-2 mb-2 d-inline-flex align-items-center">
                ${categoria}
                <button type="button" class="btn-close btn-close-white ms-2" 
                        onclick="indiciosPMModal.removerCategoria('${categoria}')" 
                        style="font-size: 0.7em;"></button>
            </div>
        `).join('');

        container.innerHTML = categoriasHTML;
    }

    // ========== CRIMES ==========

    async buscarCrimes() {
        const termo = document.getElementById('buscaCrimesInput').value.trim();
        const container = document.getElementById('crimesDisponiveis');
        
        container.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Buscando...</p></div>';

        try {
            const resultado = await eel.buscar_crimes_para_indicios(termo)();
            
            if (resultado.sucesso) {
                this.renderizarCrimesDisponiveis(resultado.crimes);
            } else {
                container.innerHTML = `<div class="alert alert-warning">${resultado.mensagem}</div>`;
            }
        } catch (error) {
            console.error('Erro ao buscar crimes:', error);
            container.innerHTML = '<div class="alert alert-danger">Erro ao buscar crimes</div>';
        }
    }

    renderizarCrimesDisponiveis(crimes) {
        const container = document.getElementById('crimesDisponiveis');
        
        if (crimes.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhum crime encontrado</div>';
            return;
        }

        const crimesHTML = crimes.map(crime => {
            const jaSelecionado = this.selectedIndicios.crimes.some(c => c.id === crime.id);
            const btnClass = jaSelecionado ? 'btn-success' : 'btn-outline-primary';
            const btnText = jaSelecionado ? 'Selecionado' : 'Selecionar';
            
            return `
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <small class="text-muted">${crime.tipo} - ${crime.dispositivo_legal}</small>
                                <div class="fw-bold">${crime.texto_completo}</div>
                            </div>
                            <button class="btn ${btnClass} btn-sm ms-2" 
                                    onclick="indiciosPMModal.toggleCrime('${crime.id}')"
                                    ${jaSelecionado ? 'disabled' : ''}>
                                ${btnText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = crimesHTML;
    }

    async toggleCrime(crimeId) {
        const jaSelecionado = this.selectedIndicios.crimes.some(c => c.id === crimeId);
        
        if (jaSelecionado) {
            this.selectedIndicios.crimes = this.selectedIndicios.crimes.filter(c => c.id !== crimeId);
        } else {
            // Buscar dados completos do crime
            try {
                const resultado = await eel.buscar_crimes_para_indicios('')();
                if (resultado.sucesso) {
                    const crime = resultado.crimes.find(c => c.id === crimeId);
                    if (crime) {
                        this.selectedIndicios.crimes.push(crime);
                    }
                }
            } catch (error) {
                console.error('Erro ao adicionar crime:', error);
            }
        }
        
        this.atualizarVisualizacaoCrimes();
        this.atualizarContadores();
        this.buscarCrimes(); // Atualizar lista
    }

    atualizarVisualizacaoCrimes() {
        const container = document.getElementById('crimesSelecionados');
        
        if (this.selectedIndicios.crimes.length === 0) {
            container.innerHTML = '<small class="text-muted">Nenhum crime selecionado</small>';
            return;
        }

        const crimesHTML = this.selectedIndicios.crimes.map(crime => `
            <div class="card mb-2">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <small class="text-muted">${crime.tipo} - ${crime.dispositivo_legal}</small>
                            <div class="fw-bold small">${crime.texto_completo}</div>
                        </div>
                        <button class="btn btn-outline-danger btn-sm ms-2" 
                                onclick="indiciosPMModal.removerCrime('${crime.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = crimesHTML;
    }

    removerCrime(crimeId) {
        this.selectedIndicios.crimes = this.selectedIndicios.crimes.filter(c => c.id !== crimeId);
        this.atualizarVisualizacaoCrimes();
        this.atualizarContadores();
        this.buscarCrimes(); // Atualizar lista
    }

    // ========== RDPM ==========

    async buscarRDPM() {
        const termo = document.getElementById('buscaRDPMInput').value.trim();
        const gravidade = document.getElementById('filtroGravidadeRDPM').value;
        const container = document.getElementById('rdpmDisponiveis');
        
        container.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Buscando...</p></div>';

        try {
            const resultado = await eel.buscar_rdpm_para_indicios(termo, gravidade)();
            
            if (resultado.sucesso) {
                this.renderizarRDPMDisponiveis(resultado.transgressoes);
            } else {
                container.innerHTML = `<div class="alert alert-warning">${resultado.mensagem}</div>`;
            }
        } catch (error) {
            console.error('Erro ao buscar RDPM:', error);
            container.innerHTML = '<div class="alert alert-danger">Erro ao buscar transgressões</div>';
        }
    }

    renderizarRDPMDisponiveis(transgressoes) {
        const container = document.getElementById('rdpmDisponiveis');
        
        if (transgressoes.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhuma transgressão encontrada</div>';
            return;
        }

        const transgressoesHTML = transgressoes.map(trans => {
            const jaSelecionado = this.selectedIndicios.rdpm.some(r => r.id === trans.id);
            const btnClass = jaSelecionado ? 'btn-success' : 'btn-outline-primary';
            const btnText = jaSelecionado ? 'Selecionado' : 'Selecionar';
            
            const badgeClass = trans.gravidade === 'grave' ? 'bg-danger' : 
                              trans.gravidade === 'media' ? 'bg-warning' : 'bg-secondary';
            
            return `
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-1">
                                    <span class="badge ${badgeClass} me-2">${trans.gravidade}</span>
                                    <strong>Inciso ${trans.inciso}</strong>
                                </div>
                                <div class="small">${trans.texto}</div>
                            </div>
                            <button class="btn ${btnClass} btn-sm ms-2" 
                                    onclick="indiciosPMModal.toggleRDPM('${trans.id}')"
                                    ${jaSelecionado ? 'disabled' : ''}>
                                ${btnText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = transgressoesHTML;
    }

    async toggleRDPM(rdpmId) {
        const jaSelecionado = this.selectedIndicios.rdpm.some(r => r.id === rdpmId);
        
        if (jaSelecionado) {
            this.selectedIndicios.rdpm = this.selectedIndicios.rdpm.filter(r => r.id !== rdpmId);
        } else {
            // Buscar dados completos da transgressão
            try {
                const resultado = await eel.buscar_rdpm_para_indicios('', null)();
                if (resultado.sucesso) {
                    const rdpm = resultado.transgressoes.find(r => r.id === rdpmId);
                    if (rdpm) {
                        this.selectedIndicios.rdpm.push(rdpm);
                    }
                }
            } catch (error) {
                console.error('Erro ao adicionar RDPM:', error);
            }
        }
        
        this.atualizarVisualizacaoRDPM();
        this.atualizarContadores();
        this.buscarRDPM(); // Atualizar lista
    }

    atualizarVisualizacaoRDPM() {
        const container = document.getElementById('rdpmSelecionadas');
        
        if (this.selectedIndicios.rdpm.length === 0) {
            container.innerHTML = '<small class="text-muted">Nenhuma transgressão selecionada</small>';
            return;
        }

        const rdpmHTML = this.selectedIndicios.rdpm.map(rdpm => {
            const badgeClass = rdpm.gravidade === 'grave' ? 'bg-danger' : 
                              rdpm.gravidade === 'media' ? 'bg-warning' : 'bg-secondary';
            
            return `
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-1">
                                    <span class="badge ${badgeClass} me-2">${rdpm.gravidade}</span>
                                    <strong>Inciso ${rdpm.inciso}</strong>
                                </div>
                                <div class="small">${rdpm.texto}</div>
                            </div>
                            <button class="btn btn-outline-danger btn-sm ms-2" 
                                    onclick="indiciosPMModal.removerRDPM('${rdpm.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = rdpmHTML;
    }

    removerRDPM(rdpmId) {
        this.selectedIndicios.rdpm = this.selectedIndicios.rdpm.filter(r => r.id !== rdpmId);
        this.atualizarVisualizacaoRDPM();
        this.atualizarContadores();
        this.buscarRDPM(); // Atualizar lista
    }

    // ========== ART. 29 ==========

    async buscarArt29() {
        const termo = document.getElementById('buscaArt29Input').value.trim();
        const container = document.getElementById('art29Disponiveis');
        
        container.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Buscando...</p></div>';

        try {
            const resultado = await eel.buscar_art29_para_indicios(termo)();
            
            if (resultado.sucesso) {
                this.renderizarArt29Disponiveis(resultado.infracoes);
            } else {
                container.innerHTML = `<div class="alert alert-warning">${resultado.mensagem}</div>`;
            }
        } catch (error) {
            console.error('Erro ao buscar Art. 29:', error);
            container.innerHTML = '<div class="alert alert-danger">Erro ao buscar infrações</div>';
        }
    }

    renderizarArt29Disponiveis(infracoes) {
        const container = document.getElementById('art29Disponiveis');
        
        if (infracoes.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhuma infração encontrada</div>';
            return;
        }

        const infracoesHTML = infracoes.map(infracao => {
            const jaSelecionado = this.selectedIndicios.art29.some(a => a.id === infracao.id);
            const btnClass = jaSelecionado ? 'btn-success' : 'btn-outline-primary';
            const btnText = jaSelecionado ? 'Selecionado' : 'Selecionar';
            
            return `
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="fw-bold">Inciso ${infracao.inciso}</div>
                                <div class="small">${infracao.texto}</div>
                            </div>
                            <button class="btn ${btnClass} btn-sm ms-2" 
                                    onclick="indiciosPMModal.toggleArt29('${infracao.id}')"
                                    ${jaSelecionado ? 'disabled' : ''}>
                                ${btnText}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = infracoesHTML;
    }

    async toggleArt29(art29Id) {
        const jaSelecionado = this.selectedIndicios.art29.some(a => a.id === art29Id);
        
        if (jaSelecionado) {
            this.selectedIndicios.art29 = this.selectedIndicios.art29.filter(a => a.id !== art29Id);
        } else {
            // Buscar dados completos da infração
            try {
                const resultado = await eel.buscar_art29_para_indicios('')();
                if (resultado.sucesso) {
                    const art29 = resultado.infracoes.find(a => a.id === art29Id);
                    if (art29) {
                        this.selectedIndicios.art29.push(art29);
                    }
                }
            } catch (error) {
                console.error('Erro ao adicionar Art. 29:', error);
            }
        }
        
        this.atualizarVisualizacaoArt29();
        this.atualizarContadores();
        this.buscarArt29(); // Atualizar lista
    }

    atualizarVisualizacaoArt29() {
        const container = document.getElementById('art29Selecionadas');
        
        if (this.selectedIndicios.art29.length === 0) {
            container.innerHTML = '<small class="text-muted">Nenhuma infração selecionada</small>';
            return;
        }

        const art29HTML = this.selectedIndicios.art29.map(art29 => `
            <div class="card mb-2">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="fw-bold">Inciso ${art29.inciso}</div>
                            <div class="small">${art29.texto}</div>
                        </div>
                        <button class="btn btn-outline-danger btn-sm ms-2" 
                                onclick="indiciosPMModal.removerArt29('${art29.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = art29HTML;
    }

    removerArt29(art29Id) {
        this.selectedIndicios.art29 = this.selectedIndicios.art29.filter(a => a.id !== art29Id);
        this.atualizarVisualizacaoArt29();
        this.atualizarContadores();
        this.buscarArt29(); // Atualizar lista
    }

    // ========== UTILS ==========

    atualizarVisualizacao() {
        this.atualizarVisualizacaoCategorias();
        this.atualizarVisualizacaoCrimes();
        this.atualizarVisualizacaoRDPM();
        this.atualizarVisualizacaoArt29();
        this.atualizarContadores();
    }

    atualizarContadores() {
        document.getElementById('contadorCategorias').textContent = this.selectedIndicios.categorias.length;
        document.getElementById('contadorCrimes').textContent = this.selectedIndicios.crimes.length;
        document.getElementById('contadorRDPM').textContent = this.selectedIndicios.rdpm.length;
        document.getElementById('contadorArt29').textContent = this.selectedIndicios.art29.length;
    }

    limparTodos() {
        if (confirm('Tem certeza que deseja limpar todos os indícios selecionados?')) {
            this.selectedIndicios = {
                categorias: [],
                crimes: [],
                rdpm: [],
                art29: []
            };
            this.atualizarVisualizacao();
        }
    }

    async salvarIndicios() {
        if (!this.currentPMEnvolvidoId) {
            this.showToast('Erro', 'PM não identificado', 'error');
            return;
        }

        const btnSalvar = document.getElementById('salvarIndiciosBtn');
        const originalText = btnSalvar.innerHTML;
        
        try {
            btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btnSalvar.disabled = true;

            console.log('💾 Salvando indícios:', this.selectedIndicios);

            const resultado = await eel.salvar_indicios_pm_envolvido(this.currentPMEnvolvidoId, this.selectedIndicios)();
            
            if (resultado.sucesso) {
                this.showToast('Sucesso', 'Indícios salvos com sucesso!', 'success');
                this.modalElement.hide();
                
                // Notificar o formulário pai para atualizar a visualização
                if (window.atualizarVisualizacaoPMsEnvolvidos) {
                    window.atualizarVisualizacaoPMsEnvolvidos();
                }
            } else {
                this.showToast('Erro', resultado.mensagem || 'Erro ao salvar indícios', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar indícios:', error);
            this.showToast('Erro', 'Erro ao salvar indícios', 'error');
        } finally {
            btnSalvar.innerHTML = originalText;
            btnSalvar.disabled = false;
        }
    }

    showToast(title, message, type = 'info') {
        if (window.showToast) {
            window.showToast(title, message, type);
        } else {
            // Fallback para alert
            alert(`${title}: ${message}`);
        }
    }
}

// Inicializar o modal quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    window.indiciosPMModal = new IndiciosPMModal();
});
