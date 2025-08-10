class IndiciosPMModal {
    constructor() {
        this.currentPMEnvolvidoId = null;
        this.pmNome = '';
        this.selectedIndicios = {
            categorias: [],
            crimes: [],
            rdpm: [],
            art29: []
        };
        this.initModal();
        this.attachEventListeners();
    }

    initModal() {
        this.createModalHTML();
    }

    createModalHTML() {
        const modalHTML = `
        <div id="indiciosPMModal" class="modal-custom" style="display: none;">
            <div class="modal-overlay" onclick="indiciosPMModal.fechar()"></div>
            <div class="modal-dialog-custom">
                <div class="modal-content-custom">
                    <div class="modal-header-custom">
                        <h5 class="modal-title-custom">
                            <i class="fas fa-search"></i> Indícios Específicos - <span id="pmNomeCompleto">PM</span>
                        </h5>
                        <button type="button" class="btn-close-custom" onclick="indiciosPMModal.fechar()">&times;</button>
                    </div>
                    <div class="modal-body-custom">
                        <!-- Abas de navegação -->
                        <div class="tabs-container-custom">
                            <div class="tabs-nav-custom">
                                <button class="tab-button-custom active" data-tab="categorias">
                                    <i class="fas fa-tags"></i> Categorias <span class="badge-custom" id="contadorCategorias">0</span>
                                </button>
                                <button class="tab-button-custom" data-tab="crimes">
                                    <i class="fas fa-gavel"></i> Crimes/Contravenções <span class="badge-custom" id="contadorCrimes">0</span>
                                </button>
                                <button class="tab-button-custom" data-tab="rdpm">
                                    <i class="fas fa-balance-scale"></i> RDPM <span class="badge-custom" id="contadorRDPM">0</span>
                                </button>
                                <button class="tab-button-custom" data-tab="art29">
                                    <i class="fas fa-book"></i> Art. 29 <span class="badge-custom" id="contadorArt29">0</span>
                                </button>
                            </div>

                            <!-- Conteúdo das abas -->
                            <div class="tab-content-custom">
                                <!-- Aba Categorias -->
                                <div class="tab-pane-custom active" id="categorias-pane">
                                    <div class="tab-content-inner">
                                        <div class="add-section">
                                            <h6><i class="fas fa-plus-circle"></i> Adicionar Categoria</h6>
                                            <div class="input-group-custom">
                                                <input type="text" id="novaCategoriaInput" placeholder="Digite uma categoria de indício" class="form-control-custom">
                                                <button type="button" id="adicionarCategoriaBtn" class="btn-success-custom">
                                                    <i class="fas fa-plus"></i> Adicionar
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <h6><i class="fas fa-list"></i> Categorias Sugeridas</h6>
                                        <div id="categorias-sugeridas" class="checkbox-list-custom">
                                            <!-- Categorias sugeridas serão carregadas aqui -->
                                        </div>

                                        <h6><i class="fas fa-check-square"></i> Categorias Selecionadas</h6>
                                        <div id="categorias-selecionadas" class="selected-items-custom">
                                            <!-- Categorias selecionadas aparecerão aqui -->
                                        </div>
                                    </div>
                                </div>

                                <!-- Aba Crimes -->
                                <div class="tab-pane-custom" id="crimes-pane">
                                    <div class="tab-content-inner">
                                        <h6><i class="fas fa-gavel"></i> Crimes e Contravenções</h6>
                                        <div id="crimes-list" class="checkbox-list-custom">
                                            <!-- Crimes serão carregados aqui -->
                                        </div>
                                    </div>
                                </div>

                                <!-- Aba RDPM -->
                                <div class="tab-pane-custom" id="rdpm-pane">
                                    <div class="tab-content-inner">
                                        <h6><i class="fas fa-balance-scale"></i> Transgressões RDPM</h6>
                                        <div id="rdpm-list" class="checkbox-list-custom">
                                            <!-- RDPM serão carregados aqui -->
                                        </div>
                                    </div>
                                </div>

                                <!-- Aba Art. 29 -->
                                <div class="tab-pane-custom" id="art29-pane">
                                    <div class="tab-content-inner">
                                        <h6><i class="fas fa-book"></i> Infrações Art. 29</h6>
                                        <div id="art29-list" class="checkbox-list-custom">
                                            <!-- Art. 29 serão carregados aqui -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer-custom">
                        <button type="button" class="btn-secondary-custom" onclick="indiciosPMModal.fechar()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="button" class="btn-primary-custom" onclick="indiciosPMModal.salvar()">
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

        this.modalElement = document.getElementById('indiciosPMModal');
    }

    attachEventListeners() {
        // Event listeners para as abas
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button-custom')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // Event listener para adicionar categoria
        document.addEventListener('click', (e) => {
            if (e.target.id === 'adicionarCategoriaBtn') {
                this.adicionarCategoria();
            }
        });

        // Event listener para Enter na input de categoria
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'novaCategoriaInput' && e.key === 'Enter') {
                this.adicionarCategoria();
            }
        });
    }

    switchTab(tabName) {
        // Remover active de todas as abas
        document.querySelectorAll('.tab-button-custom').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-pane-custom').forEach(pane => {
            pane.classList.remove('active');
        });

        // Ativar aba clicada
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-pane`).classList.add('active');
    }

    async abrir(pmEnvolvidoId, pmNome) {
        this.currentPMEnvolvidoId = pmEnvolvidoId;
        this.pmNome = pmNome;

        // Atualizar título
        document.getElementById('pmNomeCompleto').textContent = pmNome;

        // Carregar dados
        await this.carregarDados();

        // Carregar indícios existentes
        await this.carregarIndiciosExistentes();

        // Mostrar modal
        this.modalElement.style.display = 'block';
    }

    fechar() {
        this.modalElement.style.display = 'none';
    }

    async carregarDados() {
        try {
            // Carregar categorias sugeridas
            const categorias = await eel.listar_categorias_indicios()();
            this.renderizarCategoriasSugeridas(categorias);

            // Carregar crimes
            const crimes = await eel.listar_crimes_contravencoes()();
            this.renderizarCrimes(crimes);

            // Carregar RDPM
            const rdpm = await eel.listar_transgressoes_rdpm()();
            this.renderizarRDPM(rdpm);

            // Carregar Art. 29
            const art29 = await eel.listar_infracoes_art29()();
            this.renderizarArt29(art29);

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    async carregarIndiciosExistentes() {
        try {
            const indicios = await eel.carregar_indicios_pm_envolvido(this.currentPMEnvolvidoId)();
            this.selectedIndicios = indicios;
            this.atualizarContadores();
            this.marcarIndiciosSelecionados();
        } catch (error) {
            console.error('Erro ao carregar indícios existentes:', error);
        }
    }

    renderizarCategoriasSugeridas(categorias) {
        const container = document.getElementById('categorias-sugeridas');
        container.innerHTML = '';

        categorias.forEach(categoria => {
            const div = document.createElement('div');
            div.className = 'checkbox-item-custom';
            div.innerHTML = `
                <label class="checkbox-label-custom">
                    <input type="checkbox" value="${categoria}" data-type="categorias">
                    <span class="checkmark-custom"></span>
                    ${categoria}
                </label>
            `;
            container.appendChild(div);
        });
    }

    renderizarCrimes(crimes) {
        const container = document.getElementById('crimes-list');
        container.innerHTML = '';

        crimes.forEach(crime => {
            const div = document.createElement('div');
            div.className = 'checkbox-item-custom';
            div.innerHTML = `
                <label class="checkbox-label-custom">
                    <input type="checkbox" value="${crime.id}" data-type="crimes">
                    <span class="checkmark-custom"></span>
                    <strong>${crime.artigo}</strong> - ${crime.descricao}
                </label>
            `;
            container.appendChild(div);
        });
    }

    renderizarRDPM(rdpm) {
        const container = document.getElementById('rdpm-list');
        container.innerHTML = '';

        rdpm.forEach(item => {
            const div = document.createElement('div');
            div.className = 'checkbox-item-custom';
            div.innerHTML = `
                <label class="checkbox-label-custom">
                    <input type="checkbox" value="${item.id}" data-type="rdpm">
                    <span class="checkmark-custom"></span>
                    <strong>Art. ${item.artigo}</strong> - ${item.descricao}
                </label>
            `;
            container.appendChild(div);
        });
    }

    renderizarArt29(art29) {
        const container = document.getElementById('art29-list');
        container.innerHTML = '';

        art29.forEach(item => {
            const div = document.createElement('div');
            div.className = 'checkbox-item-custom';
            div.innerHTML = `
                <label class="checkbox-label-custom">
                    <input type="checkbox" value="${item.id}" data-type="art29">
                    <span class="checkmark-custom"></span>
                    <strong>${item.inciso}</strong> - ${item.descricao}
                </label>
            `;
            container.appendChild(div);
        });
    }

    adicionarCategoria() {
        const input = document.getElementById('novaCategoriaInput');
        const categoria = input.value.trim();

        if (categoria && !this.selectedIndicios.categorias.includes(categoria)) {
            this.selectedIndicios.categorias.push(categoria);
            input.value = '';
            this.atualizarVisualizacaoCategoriasPersonalizadas();
            this.atualizarContadores();
        }
    }

    atualizarVisualizacaoCategoriasPersonalizadas() {
        const container = document.getElementById('categorias-selecionadas');
        container.innerHTML = '';

        this.selectedIndicios.categorias.forEach(categoria => {
            const div = document.createElement('div');
            div.className = 'selected-item-custom';
            div.innerHTML = `
                <span>${categoria}</span>
                <button type="button" class="remove-item-custom" onclick="indiciosPMModal.removerCategoria('${categoria}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }

    removerCategoria(categoria) {
        this.selectedIndicios.categorias = this.selectedIndicios.categorias.filter(c => c !== categoria);
        this.atualizarVisualizacaoCategoriasPersonalizadas();
        this.atualizarContadores();
    }

    marcarIndiciosSelecionados() {
        // Marcar categorias
        document.querySelectorAll('[data-type="categorias"]').forEach(checkbox => {
            checkbox.checked = this.selectedIndicios.categorias.includes(checkbox.value);
        });

        // Marcar crimes
        document.querySelectorAll('[data-type="crimes"]').forEach(checkbox => {
            checkbox.checked = this.selectedIndicios.crimes.includes(parseInt(checkbox.value));
        });

        // Marcar RDPM
        document.querySelectorAll('[data-type="rdpm"]').forEach(checkbox => {
            checkbox.checked = this.selectedIndicios.rdpm.includes(parseInt(checkbox.value));
        });

        // Marcar Art. 29
        document.querySelectorAll('[data-type="art29"]').forEach(checkbox => {
            checkbox.checked = this.selectedIndicios.art29.includes(parseInt(checkbox.value));
        });

        this.atualizarVisualizacaoCategoriasPersonalizadas();
    }

    atualizarContadores() {
        document.getElementById('contadorCategorias').textContent = this.selectedIndicios.categorias.length;
        document.getElementById('contadorCrimes').textContent = this.selectedIndicios.crimes.length;
        document.getElementById('contadorRDPM').textContent = this.selectedIndicios.rdpm.length;
        document.getElementById('contadorArt29').textContent = this.selectedIndicios.art29.length;
    }

    async salvar() {
        try {
            // Coletar seleções dos checkboxes
            this.coletarSelecoes();

            console.log('💾 Salvando indícios:', this.selectedIndicios);

            const resultado = await eel.salvar_indicios_pm_envolvido(this.currentPMEnvolvidoId, this.selectedIndicios)();
            
            if (resultado.sucesso) {
                this.showToast('Sucesso', 'Indícios salvos com sucesso!', 'success');
                this.modalElement.style.display = 'none';
                
                // Notificar o formulário pai para atualizar a visualização
                if (window.atualizarVisualizacaoPMsEnvolvidos) {
                    window.atualizarVisualizacaoPMsEnvolvidos();
                }
            } else {
                this.showToast('Erro', resultado.mensagem || 'Erro ao salvar indícios', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar indícios:', error);
            this.showToast('Erro', 'Erro interno ao salvar indícios', 'error');
        }
    }

    coletarSelecoes() {
        // Coletar categorias dos checkboxes (as personalizadas já estão em selectedIndicios.categorias)
        const categoriasSugeridas = [];
        document.querySelectorAll('[data-type="categorias"]:checked').forEach(checkbox => {
            if (!this.selectedIndicios.categorias.includes(checkbox.value)) {
                categoriasSugeridas.push(checkbox.value);
            }
        });
        this.selectedIndicios.categorias = [...this.selectedIndicios.categorias, ...categoriasSugeridas];

        // Coletar crimes
        this.selectedIndicios.crimes = [];
        document.querySelectorAll('[data-type="crimes"]:checked').forEach(checkbox => {
            this.selectedIndicios.crimes.push(parseInt(checkbox.value));
        });

        // Coletar RDPM
        this.selectedIndicios.rdpm = [];
        document.querySelectorAll('[data-type="rdpm"]:checked').forEach(checkbox => {
            this.selectedIndicios.rdpm.push(parseInt(checkbox.value));
        });

        // Coletar Art. 29
        this.selectedIndicios.art29 = [];
        document.querySelectorAll('[data-type="art29"]:checked').forEach(checkbox => {
            this.selectedIndicios.art29.push(parseInt(checkbox.value));
        });
    }

    showToast(titulo, mensagem, tipo) {
        // Implementação simples de toast
        const toast = document.createElement('div');
        toast.className = `toast-custom toast-${tipo}`;
        toast.innerHTML = `
            <strong>${titulo}:</strong> ${mensagem}
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Inicializar o modal quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    window.indiciosPMModal = new IndiciosPMModal();
});
