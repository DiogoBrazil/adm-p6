// Modal de Indícios para Solução (versão simplificada conforme fluxo do usuário)
class ModalIndiciosSolucao {
    constructor() {
        this.indiciosAdicionados = [];
        this.crimesSelecionados = [];
        this.transgressoesSelecionadas = [];
        this.initModal();
        this.attachEventListeners();
    }

    initModal() {
        this.createModalHTML();
    }

    createModalHTML() {
        const modalHTML = `
        <div id="modalIndiciosSolucao" class="modal-custom" style="display: none;">
            <div class="modal-overlay" onclick="modalIndiciosSolucao.fechar()"></div>
            <div class="modal-dialog-custom">
                <div class="modal-content-custom">
                    <div class="modal-header-custom">
                        <h5 class="modal-title-custom">
                            <i class="fas fa-plus"></i> Adicionar Indícios
                        </h5>
                        <button type="button" class="btn-close-custom" onclick="modalIndiciosSolucao.fechar()">&times;</button>
                    </div>
                    <div class="modal-body-custom">
                        <form id="formIndiciosSolucao">
                            <!-- Categoria de Indício -->
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label for="categoria_indicio"><strong>Categoria de Indício *</strong></label>
                                <select id="categoria_indicio" class="form-control-custom" multiple size="4" style="height: auto;">
                                    <option value="Indícios de crime comum">Indícios de crime comum</option>
                                    <option value="Indícios de crime militar">Indícios de crime militar</option>
                                    <option value="Indícios de transgressão disciplinar">Indícios de transgressão disciplinar</option>
                                    <option value="Não houve indícios">Não houve indícios, seja de transgressão ou crime</option>
                                </select>
                                <small class="form-help">Segure Ctrl (ou Cmd) para selecionar múltiplos itens.</small>
                            </div>

                            <!-- Campo de busca por crimes (aparece se selecionar crime) -->
                            <div id="campo_crimes" class="form-group" style="margin-bottom: 1rem; display: none;">
                                <label for="busca_crimes"><strong>Crimes e Contravenções</strong></label>
                                <input type="text" id="busca_crimes" class="form-control-custom" placeholder="Digite o artigo ou descrição do crime...">
                                <div id="resultados_crimes" class="search-results-custom" style="display: none;">
                                    <!-- Resultados da busca de crimes aparecerão aqui -->
                                </div>
                                <div id="crimes_selecionados" class="selected-items-container" style="margin-top: 0.5rem;">
                                    <!-- Crimes selecionados aparecerão aqui -->
                                </div>
                            </div>

                            <!-- Campo de busca por transgressões (aparece se selecionar transgressão) -->
                            <div id="campo_transgressoes" class="form-group" style="margin-bottom: 1rem; display: none;">
                                <label for="busca_transgressoes"><strong>Transgressões RDPM e Art. 29</strong></label>
                                <input type="text" id="busca_transgressoes" class="form-control-custom" placeholder="Digite o artigo ou inciso da transgressão...">
                                <div id="resultados_transgressoes" class="search-results-custom" style="display: none;">
                                    <!-- Resultados da busca de transgressões aparecerão aqui -->
                                </div>
                                <div id="transgressoes_selecionadas" class="selected-items-container" style="margin-top: 0.5rem;">
                                    <!-- Transgressões selecionadas aparecerão aqui -->
                                </div>
                            </div>

                            <!-- Select para escolher PM envolvido -->
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label for="pm_envolvido_select"><strong>PM Envolvido *</strong></label>
                                <select id="pm_envolvido_select" class="form-control-custom">
                                    <option value="">Selecione um PM...</option>
                                    <!-- Opções serão carregadas dinamicamente -->
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer-custom">
                        <button type="button" class="btn-secondary-custom" onclick="modalIndiciosSolucao.fechar()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="button" class="btn-primary-custom" onclick="modalIndiciosSolucao.adicionar()">
                            <i class="fas fa-plus"></i> Adicionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        // Adicionar o modal ao body se não existir
        if (!document.getElementById('modalIndiciosSolucao')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modalElement = document.getElementById('modalIndiciosSolucao');
    }

    attachEventListeners() {
        // Event listener para mudança de categoria
        document.getElementById('categoria_indicio').addEventListener('change', () => {
            this.atualizarCamposVisiveis();
        });

        // Event listeners para busca de crimes
        let timeoutCrimes;
        document.getElementById('busca_crimes').addEventListener('input', (e) => {
            clearTimeout(timeoutCrimes);
            timeoutCrimes = setTimeout(() => {
                this.buscarCrimes(e.target.value);
            }, 300);
        });

        // Event listeners para busca de transgressões
        let timeoutTransgressoes;
        document.getElementById('busca_transgressoes').addEventListener('input', (e) => {
            clearTimeout(timeoutTransgressoes);
            timeoutTransgressoes = setTimeout(() => {
                this.buscarTransgressoes(e.target.value);
            }, 300);
        });

        // Esconder resultados quando clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#campo_crimes')) {
                document.getElementById('resultados_crimes').style.display = 'none';
            }
            if (!e.target.closest('#campo_transgressoes')) {
                document.getElementById('resultados_transgressoes').style.display = 'none';
            }
        });
    }

    async abrir() {
        // Carregar PMs envolvidos
        await this.carregarPMsEnvolvidos();
        
        // Limpar formulário
        this.limparFormulario();
        
        // Mostrar modal
        this.modalElement.style.display = 'block';
    }

    fechar() {
        this.modalElement.style.display = 'none';
        this.limparFormulario();
    }

    limparFormulario() {
        document.getElementById('categoria_indicio').selectedIndex = -1;
        document.getElementById('busca_crimes').value = '';
        document.getElementById('busca_transgressoes').value = '';
        document.getElementById('pm_envolvido_select').selectedIndex = 0;
        
        // Limpar resultados e itens selecionados
        document.getElementById('resultados_crimes').style.display = 'none';
        document.getElementById('resultados_transgressoes').style.display = 'none';
        document.getElementById('crimes_selecionados').innerHTML = '';
        document.getElementById('transgressoes_selecionadas').innerHTML = '';
        
        // Esconder campos
        document.getElementById('campo_crimes').style.display = 'none';
        document.getElementById('campo_transgressoes').style.display = 'none';
        
        this.crimesSelecionados = [];
        this.transgressoesSelecionadas = [];
    }

    atualizarCamposVisiveis() {
        const categoriasSelecionadas = Array.from(document.getElementById('categoria_indicio').selectedOptions).map(o => o.value);
        
        const temCrime = categoriasSelecionadas.some(cat => 
            cat.includes('crime comum') || cat.includes('crime militar')
        );
        
        const temTransgressao = categoriasSelecionadas.some(cat => 
            cat.includes('transgressão disciplinar')
        );
        
        // Mostrar/esconder campos conforme seleção
        document.getElementById('campo_crimes').style.display = temCrime ? 'block' : 'none';
        document.getElementById('campo_transgressoes').style.display = temTransgressao ? 'block' : 'none';
        
        // Limpar campos que ficaram escondidos
        if (!temCrime) {
            document.getElementById('busca_crimes').value = '';
            document.getElementById('crimes_selecionados').innerHTML = '';
            this.crimesSelecionados = [];
        }
        
        if (!temTransgressao) {
            document.getElementById('busca_transgressoes').value = '';
            document.getElementById('transgressoes_selecionadas').innerHTML = '';
            this.transgressoesSelecionadas = [];
        }
    }

    async buscarCrimes(termo) {
        const resultadosDiv = document.getElementById('resultados_crimes');
        
        if (!termo || termo.length < 2) {
            resultadosDiv.style.display = 'none';
            return;
        }

        try {
            const response = await eel.buscar_crimes_para_indicios(termo)();
            
            if (response.sucesso && response.crimes) {
                this.mostrarResultadosCrimes(response.crimes);
            } else {
                resultadosDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Erro ao buscar crimes:', error);
            resultadosDiv.style.display = 'none';
        }
    }

    async buscarTransgressoes(termo) {
        const resultadosDiv = document.getElementById('resultados_transgressoes');
        
        if (!termo || termo.length < 2) {
            resultadosDiv.style.display = 'none';
            return;
        }

        try {
            const resultados = [];
            
            // Buscar transgressões RDPM
            const rdpmResponse = await eel.buscar_rdpm_para_indicios(termo, '')();
            if (rdpmResponse.sucesso && rdpmResponse.transgressoes) {
                resultados.push(...rdpmResponse.transgressoes.map(r => ({...r, tipo: 'rdpm'})));
            }
            
            // Buscar Art. 29
            const art29Response = await eel.buscar_art29_para_indicios(termo)();
            if (art29Response.sucesso && art29Response.infracoes) {
                resultados.push(...art29Response.infracoes.map(a => ({...a, tipo: 'art29'})));
            }

            this.mostrarResultadosTransgressoes(resultados);
        } catch (error) {
            console.error('Erro ao buscar transgressões:', error);
            resultadosDiv.style.display = 'none';
        }
    }

    mostrarResultadosCrimes(crimes) {
        const resultadosDiv = document.getElementById('resultados_crimes');
        
        if (crimes.length === 0) {
            resultadosDiv.style.display = 'none';
            return;
        }

        resultadosDiv.innerHTML = crimes.map(crime => 
            `<div class="resultado-item" onclick="modalIndiciosSolucao.adicionarCrime(${crime.id}, '${crime.nome}')">
                <strong>${crime.nome}</strong>
            </div>`
        ).join('');
        
        resultadosDiv.style.display = 'block';
    }

    mostrarResultadosTransgressoes(transgressoes) {
        const resultadosDiv = document.getElementById('resultados_transgressoes');
        
        if (transgressoes.length === 0) {
            resultadosDiv.style.display = 'none';
            return;
        }

        resultadosDiv.innerHTML = transgressoes.map(item => 
            `<div class="resultado-item" onclick="modalIndiciosSolucao.adicionarTransgressao(${item.id}, '${item.nome || item.artigo || item.descricao}', '${item.tipo}')">
                <strong>${item.nome || item.artigo || item.descricao}</strong>
                ${item.tipo === 'rdpm' ? ' <span class="badge">RDPM</span>' : ' <span class="badge">Art. 29</span>'}
            </div>`
        ).join('');
        
        resultadosDiv.style.display = 'block';
    }

    adicionarCrime(id, nome) {
        // Verificar se já foi adicionado
        if (this.crimesSelecionados.find(c => c.id === id)) {
            return;
        }

        this.crimesSelecionados.push({ id, nome, tipo: 'crime' });
        this.atualizarCrimesSelecionados();
        document.getElementById('busca_crimes').value = '';
        document.getElementById('resultados_crimes').style.display = 'none';
    }

    adicionarTransgressao(id, nome, tipo) {
        // Verificar se já foi adicionado
        if (this.transgressoesSelecionadas.find(t => t.id === id && t.tipo === tipo)) {
            return;
        }

        this.transgressoesSelecionadas.push({ id, nome, tipo });
        this.atualizarTransgressoesSelecionadas();
        document.getElementById('busca_transgressoes').value = '';
        document.getElementById('resultados_transgressoes').style.display = 'none';
    }

    atualizarCrimesSelecionados() {
        const container = document.getElementById('crimes_selecionados');
        container.innerHTML = this.crimesSelecionados.map(crime => 
            `<span class="item-selecionado">
                ${crime.nome}
                <button type="button" onclick="modalIndiciosSolucao.removerCrime(${crime.id})">&times;</button>
            </span>`
        ).join('');
    }

    atualizarTransgressoesSelecionadas() {
        const container = document.getElementById('transgressoes_selecionadas');
        container.innerHTML = this.transgressoesSelecionadas.map(trans => 
            `<span class="item-selecionado">
                ${trans.nome}
                <button type="button" onclick="modalIndiciosSolucao.removerTransgressao(${trans.id}, '${trans.tipo}')">&times;</button>
            </span>`
        ).join('');
    }

    removerCrime(id) {
        this.crimesSelecionados = this.crimesSelecionados.filter(c => c.id !== id);
        this.atualizarCrimesSelecionados();
    }

    removerTransgressao(id, tipo) {
        this.transgressoesSelecionadas = this.transgressoesSelecionadas.filter(t => !(t.id === id && t.tipo === tipo));
        this.atualizarTransgressoesSelecionadas();
    }

    async carregarPMsEnvolvidos() {
        const selectPM = document.getElementById('pm_envolvido_select');
        selectPM.innerHTML = '<option value="">Selecione um PM...</option>';

        try {
            let pmsCarregados = 0;

            // 1. Carregar PM principal se existir
            const pmPrincipal = document.getElementById('nome_pm_nome').value;
            const pmPrincipalId = document.getElementById('nome_pm').value;
            
            if (pmPrincipal && pmPrincipalId) {
                const statusPM = document.getElementById('status_pm').value;
                const statusTexto = statusPM ? ` (${statusPM})` : ' (Principal)';
                
                const option = document.createElement('option');
                option.value = pmPrincipalId;
                option.textContent = `${pmPrincipal}${statusTexto}`;
                selectPM.appendChild(option);
                pmsCarregados++;
            }

            // 2. Atualizar array de PMs adicionais primeiro
            if (window.atualizarArrayPmsAdicionais) {
                window.atualizarArrayPmsAdicionais();
            }

            // 3. Carregar PMs adicionais se existirem
            if (window.pmsAdicionais && window.pmsAdicionais.length > 0) {
                window.pmsAdicionais.forEach((pm, index) => {
                    if (pm.nome && pm.id) {
                        const statusTexto = pm.status_pm ? ` (${pm.status_pm})` : ` (Adicional ${index + 1})`;
                        
                        const option = document.createElement('option');
                        option.value = pm.id;
                        option.textContent = `${pm.nome}${statusTexto}`;
                        selectPM.appendChild(option);
                        pmsCarregados++;
                    }
                });
            }

            // 4. Verificar se há campos de PMs adicionais no DOM e tentar extrair os dados
            const camposPMAdicionais = document.querySelectorAll('[id^="pm_adicional_container_"]');
            camposPMAdicionais.forEach((campo, index) => {
                const inputNome = campo.querySelector('[id^="pm_adicional_nome_"]');
                const inputId = campo.querySelector('[id^="pm_adicional_id_"]');
                const selectStatus = campo.querySelector('[id^="pm_adicional_status_"]');
                
                if (inputNome && inputId && inputNome.value && inputId.value) {
                    // Verificar se já foi adicionado
                    const jaAdicionado = Array.from(selectPM.options).some(opt => opt.value === inputId.value);
                    
                    if (!jaAdicionado) {
                        const statusTexto = selectStatus && selectStatus.value ? ` (${selectStatus.value})` : ` (Adicional ${index + 1})`;
                        
                        const option = document.createElement('option');
                        option.value = inputId.value;
                        option.textContent = `${inputNome.value}${statusTexto}`;
                        selectPM.appendChild(option);
                        pmsCarregados++;
                    }
                }
            });

            console.log('PMs carregados no select:', pmsCarregados);
            
            if (pmsCarregados === 0) {
                const optionVazia = document.createElement('option');
                optionVazia.value = '';
                optionVazia.textContent = 'Nenhum PM encontrado - verifique se os PMs foram selecionados no formulário';
                optionVazia.disabled = true;
                selectPM.appendChild(optionVazia);
            }
            
        } catch (error) {
            console.error('Erro ao carregar PMs envolvidos:', error);
        }
    }

    async adicionar() {
        // Validar formulário
        const categorias = Array.from(document.getElementById('categoria_indicio').selectedOptions).map(o => o.value);
        const pmSelecionado = document.getElementById('pm_envolvido_select').value;

        if (categorias.length === 0) {
            this.showToast('Erro', 'Selecione pelo menos uma categoria de indício', 'error');
            return;
        }

        if (!pmSelecionado) {
            this.showToast('Erro', 'Selecione um PM envolvido', 'error');
            return;
        }

        // Verificar se há crimes ou transgressões selecionados para categorias que exigem
        const categoriaComIndicio = categorias.some(cat => cat.includes('crime') || cat.includes('transgressão'));
        const totalSelecionados = this.crimesSelecionados.length + this.transgressoesSelecionadas.length;
        
        if (categoriaComIndicio && totalSelecionados === 0) {
            this.showToast('Erro', 'Para indícios de crime ou transgressão, selecione pelo menos um item específico', 'error');
            return;
        }

        // Criar objeto com os dados
        const novoIndicio = {
            id: Date.now(), // ID temporário
            categorias: categorias,
            crimes: this.crimesSelecionados,
            transgressoes: this.transgressoesSelecionadas,
            pmId: pmSelecionado,
            pmNome: document.getElementById('pm_envolvido_select').selectedOptions[0].textContent
        };

        // Adicionar à lista global
        this.indiciosAdicionados.push(novoIndicio);

        // Atualizar visualização
        this.atualizarListaIndicios();

        // Fechar modal
        this.fechar();

        this.showToast('Sucesso', 'Indício adicionado com sucesso!', 'success');
    }

    atualizarListaIndicios() {
        const container = document.getElementById('lista_indicios_adicionados');
        container.innerHTML = '';

        this.indiciosAdicionados.forEach((indicio, index) => {
            const div = document.createElement('div');
            div.className = 'indicio-card';
            div.style.cssText = `
                border: 1px solid #dee2e6;
                border-radius: 0.375rem;
                padding: 1rem;
                margin-bottom: 1rem;
                background: #f8f9fa;
            `;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>PM:</strong> ${indicio.pmNome}
                        </div>
                        <div style="margin-bottom: 0.5rem;">
                            <strong>Categorias:</strong> ${indicio.categorias.join(', ')}
                        </div>
                        ${indicio.crimes && indicio.crimes.length > 0 ? `
                            <div style="margin-bottom: 0.5rem;">
                                <strong>Crimes:</strong>
                                <ul style="margin: 0.25rem 0 0 1.5rem;">
                                    ${indicio.crimes.map(crime => `<li>${crime.nome}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${indicio.transgressoes && indicio.transgressoes.length > 0 ? `
                            <div style="margin-bottom: 0.5rem;">
                                <strong>Transgressões:</strong>
                                <ul style="margin: 0.25rem 0 0 1.5rem;">
                                    ${indicio.transgressoes.map(trans => 
                                        `<li>${trans.nome} <span style="color: #6c757d; font-size: 0.8em;">(${trans.tipo === 'rdpm' ? 'RDPM' : 'Art. 29'})</span></li>`
                                    ).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    <button type="button" onclick="modalIndiciosSolucao.removerIndicio(${index})" 
                            style="background: #dc3545; color: white; border: none; border-radius: 0.25rem; padding: 0.25rem 0.5rem; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            container.appendChild(div);
        });

        // Mostrar/esconder o botão de adicionar mais indícios
        const containerBtn = document.getElementById('container_btn_indicios_solucao');
        if (containerBtn) {
            const btnTexto = containerBtn.querySelector('#btnAdicionarIndicios');
            if (btnTexto) {
                btnTexto.innerHTML = this.indiciosAdicionados.length > 0 ? 
                    '<i class="fas fa-plus"></i> Adicionar Mais Indícios' : 
                    '<i class="fas fa-plus"></i> Adicionar Indícios';
            }
        }
    }

    removerIndicio(index) {
        this.indiciosAdicionados.splice(index, 1);
        this.atualizarListaIndicios();
        this.showToast('Sucesso', 'Indício removido com sucesso!', 'success');
    }

    showToast(titulo, mensagem, tipo) {
        // Implementação simples de toast
        const toast = document.createElement('div');
        toast.className = `toast-custom toast-${tipo}`;
        toast.innerHTML = `<strong>${titulo}:</strong> ${mensagem}`;
        
        // Adicionar estilos básicos
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            max-width: 300px;
            ${tipo === 'success' ? 'background-color: #28a745;' : ''}
            ${tipo === 'error' ? 'background-color: #dc3545;' : ''}
            ${tipo === 'warning' ? 'background-color: #ffc107; color: #000;' : ''}
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }
}

// Instância global
const modalIndiciosSolucao = new ModalIndiciosSolucao();
