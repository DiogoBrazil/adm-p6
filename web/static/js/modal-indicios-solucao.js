// Modal de Indícios para Solução (versão simplificada conforme fluxo do usuário)
console.log('Script modal-indicios-solucao.js carregado');

class ModalIndiciosSolucao {
    constructor() {
        console.log('Construtor ModalIndiciosSolucao iniciado');
        this.indiciosAdicionados = [];
        this.crimesSelecionados = [];
        this.transgressoesSelecionadas = [];
        try {
            this.initModal();
            this.attachEventListeners();
            console.log('ModalIndiciosSolucao criado com sucesso');
        } catch (error) {
            console.error('Erro ao criar ModalIndiciosSolucao:', error);
        }
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

    async abrir(pmId = null, dadosExistentes = null) {
        console.log('Abrindo modal de indícios...');
        console.log('PM ID:', pmId);
        console.log('Dados existentes:', dadosExistentes);
        
        try {
            // Carregar PMs envolvidos
            await this.carregarPMsEnvolvidos();
            
            // Limpar formulário
            this.limparFormulario();
            
            // Se há dados existentes e um PM específico, pré-preencher
            if (pmId && dadosExistentes) {
                await this.preencherDadosExistentes(pmId, dadosExistentes);
            }
            
            // Mostrar modal
            this.modalElement.style.display = 'block';
            console.log('Modal de indícios aberto com sucesso');
        } catch (error) {
            console.error('Erro ao abrir modal de indícios:', error);
        }
    }

    async preencherDadosExistentes(pmId, dados) {
        console.log('📋 Preenchendo dados existentes para PM:', pmId, dados);
        
        try {
            // Selecionar o PM no dropdown
            const selectPM = document.getElementById('pm_envolvido_select');
            if (selectPM) {
                selectPM.value = pmId;
            }
            
            // Preencher categoria
            if (dados.categoria) {
                const selectCategoria = document.getElementById('categoria_indicio');
                if (selectCategoria) {
                    selectCategoria.value = dados.categoria;
                    selectCategoria.dispatchEvent(new Event('change')); // Mostrar campos apropriados
                }
            }
            
            // Aguardar campos aparecerem
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Preencher crimes selecionados
            if (dados.crimes && dados.crimes.length > 0) {
                console.log('🔍 Carregando crimes existentes:', dados.crimes);
                this.crimesSelecionados = dados.crimes.map(crime => ({
                    id: crime.id,
                    nome: this.formatarCrimeTexto(crime),
                    tipo: 'crime'
                }));
                this.atualizarCrimesSelecionados();
            }
            
            // Preencher transgressões selecionadas  
            if (dados.rdpm && dados.rdpm.length > 0) {
                console.log('🔍 Carregando transgressões RDPM existentes:', dados.rdpm);
                dados.rdpm.forEach(rdpm => {
                    this.transgressoesSelecionadas.push({
                        id: rdpm.id,
                        nome: `Inciso ${rdpm.inciso} - ${rdpm.texto}`,
                        tipo: 'rdpm'
                    });
                });
            }
            
            if (dados.art29 && dados.art29.length > 0) {
                console.log('🔍 Carregando infrações Art. 29 existentes:', dados.art29);
                dados.art29.forEach(art29 => {
                    this.transgressoesSelecionadas.push({
                        id: art29.id,
                        nome: `Inciso ${art29.inciso} - ${art29.texto}`,
                        tipo: 'art29'
                    });
                });
            }
            
            if (this.transgressoesSelecionadas.length > 0) {
                this.atualizarTransgressoesSelecionadas();
            }
            
            console.log('✅ Dados existentes carregados no modal');
            
        } catch (error) {
            console.error('❌ Erro ao preencher dados existentes:', error);
        }
    }

    formatarCrimeTexto(crime) {
        const base = `${crime.tipo || ''} ${crime.dispositivo_legal || ''}${crime.artigo ? ' art. ' + crime.artigo : ''}`.trim();
        const complemento = [crime.paragrafo, crime.inciso, crime.alinea].filter(Boolean).join(' ');
        const descricao = crime.descricao_artigo ? ` - ${crime.descricao_artigo}` : '';
        return [base, complemento].filter(Boolean).join(' ') + descricao;
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
        
        const crimesSelecionados = document.getElementById('crimes_selecionados');
        const transgressoesSelecionadas = document.getElementById('transgressoes_selecionadas');
        
        crimesSelecionados.innerHTML = '';
        transgressoesSelecionadas.innerHTML = '';
        crimesSelecionados.style.display = 'none';
        transgressoesSelecionadas.style.display = 'none';
        
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
            console.log('Buscando crimes com termo:', termo);
            const response = await eel.buscar_crimes_para_indicios(termo)();
            console.log('Resposta da busca de crimes:', response);
            
            if (response.sucesso && response.crimes) {
                console.log('Crimes encontrados:', response.crimes);
                this.mostrarResultadosCrimes(response.crimes);
            } else {
                console.log('Nenhum crime encontrado ou erro na resposta');
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
            console.log('Buscando transgressões com termo:', termo);
            const resultados = [];
            
            // Buscar transgressões RDPM
            const rdpmResponse = await eel.buscar_rdpm_para_indicios(termo, '')();
            console.log('Resposta RDPM:', rdpmResponse);
            if (rdpmResponse.sucesso && rdpmResponse.transgressoes) {
                resultados.push(...rdpmResponse.transgressoes.map(r => ({...r, tipo: 'rdpm'})));
            }
            
            // Buscar Art. 29
            const art29Response = await eel.buscar_art29_para_indicios(termo)();
            console.log('Resposta Art. 29:', art29Response);
            if (art29Response.sucesso && art29Response.infracoes) {
                resultados.push(...art29Response.infracoes.map(a => ({...a, tipo: 'art29'})));
            }

            console.log('Transgressões encontradas (total):', resultados);
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

        console.log('Exibindo crimes:', crimes);
        resultadosDiv.innerHTML = crimes.map(crime => {
            const texto = crime.texto_completo || `Art. ${crime.artigo} - ${crime.descricao_artigo}`;
            
            return `<div class="resultado-item" data-id="${crime.id}" data-texto="${texto.replace(/"/g, '&quot;')}" onclick="modalIndiciosSolucao.adicionarCrimeClick(this)">
                <strong>${texto}</strong>
            </div>`;
        }).join('');
        
        resultadosDiv.style.display = 'block';
    }

    mostrarResultadosTransgressoes(transgressoes) {
        const resultadosDiv = document.getElementById('resultados_transgressoes');
        
        if (transgressoes.length === 0) {
            resultadosDiv.style.display = 'none';
            return;
        }

        console.log('Exibindo transgressões:', transgressoes);
        resultadosDiv.innerHTML = transgressoes.map(item => {
            let texto;
            if (item.tipo === 'rdpm') {
                texto = item.texto_completo || `Inciso ${item.inciso} - ${item.texto}`;
            } else { // art29
                texto = item.texto_completo || `Inciso ${item.inciso} - ${item.texto}`;
            }
            
            return `<div class="resultado-item" data-id="${item.id}" data-texto="${texto.replace(/"/g, '&quot;')}" data-tipo="${item.tipo}" onclick="modalIndiciosSolucao.adicionarTransgressaoClick(this)">
                <strong>${texto}</strong>
                ${item.tipo === 'rdpm' ? ' <span class="badge">RDPM</span>' : ' <span class="badge">Art. 29</span>'}
            </div>`;
        }).join('');
        
        resultadosDiv.style.display = 'block';
    }

    adicionarCrimeClick(elemento) {
        const id = elemento.dataset.id;  // Remover parseInt para suportar UUIDs
        const texto = elemento.dataset.texto;
        this.adicionarCrime(id, texto);
    }

    adicionarTransgressaoClick(elemento) {
        console.log('🎯 CLICK NA TRANSGRESSÃO!');
        const id = elemento.dataset.id;  // Remover parseInt para suportar UUIDs
        const texto = elemento.dataset.texto;
        const tipo = elemento.dataset.tipo;
        console.log('Adicionando transgressão:', {id, texto, tipo});
        console.log('Elemento clicado:', elemento);
        this.adicionarTransgressao(id, texto, tipo);
    }

    adicionarCrime(id, texto) {
        // Verificar se já foi adicionado
        if (this.crimesSelecionados.find(c => c.id === id)) {
            return;
        }

        this.crimesSelecionados.push({ id, nome: texto, tipo: 'crime' });
        this.atualizarCrimesSelecionados();
        document.getElementById('busca_crimes').value = '';
        document.getElementById('resultados_crimes').style.display = 'none';
    }

    adicionarTransgressao(id, texto, tipo) {
        console.log('🚨 MÉTODO adicionarTransgressao() CHAMADO!');
        console.log('Tentando adicionar transgressão:', {id, texto, tipo});
        
        // Verificar se já foi adicionado
        if (this.transgressoesSelecionadas.find(t => t.id === id && t.tipo === tipo)) {
            console.log('Transgressão já existe na lista');
            return;
        }

        console.log('Adicionando nova transgressão à lista');
        this.transgressoesSelecionadas.push({ id, nome: texto, tipo });
        console.log('Lista de transgressões após adição:', this.transgressoesSelecionadas);
        
        console.log('🔄 Chamando atualizarTransgressoesSelecionadas()...');
        this.atualizarTransgressoesSelecionadas();
        document.getElementById('busca_transgressoes').value = '';
        document.getElementById('resultados_transgressoes').style.display = 'none';
    }

    atualizarCrimesSelecionados() {
        const container = document.getElementById('crimes_selecionados');
        container.innerHTML = this.crimesSelecionados.map((crime, index) => 
            `<span class="item-selecionado" style="display: inline-block !important; background: #e9ecef !important; padding: 0.25rem 0.5rem !important; margin: 0.125rem !important; border-radius: 0.25rem !important; font-size: 0.9rem !important; visibility: visible !important; opacity: 1 !important;">
                ${crime.nome}
                <button type="button" onclick="modalIndiciosSolucao.removerCrimePorIndex(${index})" style="background: none !important; border: none !important; color: #dc3545 !important; font-weight: bold !important; margin-left: 0.5rem !important; cursor: pointer !important; display: inline !important;">&times;</button>
            </span>`
        ).join('');
        
        // Mostrar o container se há crimes selecionados
        if (this.crimesSelecionados.length > 0) {
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            container.style.marginTop = '0.5rem';
            container.style.padding = '0.5rem';
            container.style.backgroundColor = '#f8f9fa';
            container.style.border = '1px solid #dee2e6';
            container.style.borderRadius = '0.25rem';
            container.style.minHeight = '40px';
            container.style.position = 'relative';
            container.style.zIndex = '1';
        } else {
            container.style.display = 'none';
        }
    }

    atualizarTransgressoesSelecionadas() {
        console.log('🚨 MÉTODO atualizarTransgressoesSelecionadas() CHAMADO!');
        
        // Verificar todos os elementos com este ID
        const todosElementos = document.querySelectorAll('#transgressoes_selecionadas');
        console.log('🔍 TODOS os elementos com ID transgressoes_selecionadas:', todosElementos);
        console.log('🔍 Quantidade encontrada:', todosElementos.length);
        
        todosElementos.forEach((el, index) => {
            console.log(`- Elemento ${index}:`, el);
            console.log(`  - Classe: ${el.className}`);
            console.log(`  - Parent: ${el.parentElement?.tagName} (id: ${el.parentElement?.id})`);
            console.log(`  - offsetHeight: ${el.offsetHeight}`);
            console.log(`  - Display: ${el.style.display || getComputedStyle(el).display}`);
        });
        
        // Usar especificamente o elemento do modal
        const modalElement = document.querySelector('#modalIndiciosSolucao #transgressoes_selecionadas');
        console.log('🎯 Container do MODAL especificamente:', modalElement);
        
        const container = modalElement || document.getElementById('transgressoes_selecionadas');
        console.log('🔧 DEBUG TRANSGRESSÕES:');
        console.log('- Lista atual:', this.transgressoesSelecionadas);
        console.log('- Tamanho da lista:', this.transgressoesSelecionadas.length);
        console.log('- Container escolhido:', container);
        
        if (!container) {
            console.error('❌ Container transgressoes_selecionadas não encontrado!');
            console.log('🔍 Tentando encontrar todos os elementos com IDs similares:');
            const allElements = document.querySelectorAll('[id*="transgressoes"]');
            console.log('- Elementos encontrados:', allElements);
            return;
        }
        
        if (this.transgressoesSelecionadas.length === 0) {
            console.log('📋 Lista vazia, ocultando container');
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        
        console.log('🔨 Gerando HTML para transgressões...');
        
        const htmlGerado = this.transgressoesSelecionadas.map((trans, index) => {
            console.log(`- Item ${index}:`, trans);
            return `<span class="item-selecionado" style="display: inline-block !important; background: #e9ecef !important; padding: 0.25rem 0.5rem !important; margin: 0.125rem !important; border-radius: 0.25rem !important; font-size: 0.9rem !important; visibility: visible !important; opacity: 1 !important;">
                ${trans.nome}
                <button type="button" onclick="modalIndiciosSolucao.removerTransgressaoPorIndex(${index})" style="background: none !important; border: none !important; color: #dc3545 !important; font-weight: bold !important; margin-left: 0.5rem !important; cursor: pointer !important; display: inline !important;">&times;</button>
            </span>`;
        }).join('');
        
        console.log('📝 HTML gerado:', htmlGerado);
        
        container.innerHTML = htmlGerado;
        
        // Mostrar o container com estilos forçados
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        container.style.marginTop = '0.5rem';
        container.style.padding = '0.5rem';
        container.style.backgroundColor = '#f8f9fa';
        container.style.border = '1px solid #dee2e6';
        container.style.borderRadius = '0.25rem';
        container.style.minHeight = '40px';
        container.style.height = 'auto';
        container.style.width = '100%';
        container.style.position = 'relative';
        container.style.zIndex = '1';
        container.style.overflow = 'visible';
        container.style.lineHeight = 'normal';
        container.style.fontSize = '1rem';
        container.style.fontFamily = 'inherit';
        container.style.boxSizing = 'border-box';
        
        // Forçar reflow
        container.offsetHeight;
        
        console.log('✅ Container atualizado:');
        console.log('- innerHTML:', container.innerHTML);
        console.log('- display:', container.style.display);
        console.log('- visibility:', container.style.visibility);
        console.log('- opacity:', container.style.opacity);
        console.log('- clientHeight:', container.clientHeight);
        console.log('- offsetHeight:', container.offsetHeight);
        console.log('- scrollHeight:', container.scrollHeight);
        // 🚨 TESTE: Substituir completamente o container se altura continuar 0
        if (container.offsetHeight === 0) {
            console.log('🔧 Container com altura 0, recriando elemento...');
            
            // Criar novo container
            const novoContainer = document.createElement('div');
            novoContainer.id = 'transgressoes_selecionadas';
            novoContainer.className = 'selected-items-container';
            novoContainer.innerHTML = htmlGerado;
            
            // Aplicar estilos inline
            Object.assign(novoContainer.style, {
                display: 'block',
                visibility: 'visible',
                opacity: '1',
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '0.25rem',
                minHeight: '40px',
                height: 'auto',
                width: '100%',
                position: 'relative',
                zIndex: '1',
                overflow: 'visible',
                lineHeight: 'normal',
                fontSize: '1rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
            });
            
            // Substituir o container antigo
            container.parentNode.replaceChild(novoContainer, container);
            
            console.log('✅ Novo container criado:', novoContainer);
            console.log('- offsetHeight do novo:', novoContainer.offsetHeight);
            console.log('- getBoundingClientRect do novo:', novoContainer.getBoundingClientRect());
        }
    }

    removerCrimePorIndex(index) {
        this.crimesSelecionados.splice(index, 1);
        this.atualizarCrimesSelecionados();
    }

    removerTransgressaoPorIndex(index) {
        this.transgressoesSelecionadas.splice(index, 1);
        this.atualizarTransgressoesSelecionadas();
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
            console.log('🔍 Procurando PMs adicionais no DOM...');
            
            // Buscar tanto no container geral quanto nos campos individuais
            const containerPMs = document.getElementById('pms_adicionais_container');
            console.log('📦 Container de PMs encontrado:', containerPMs);
            
            if (containerPMs) {
                // Buscar por divs com classe pm-adicional-field
                const camposPMAdicional = containerPMs.querySelectorAll('.pm-adicional-field');
                console.log('👥 Campos PM encontrados:', camposPMAdicional.length);
                
                camposPMAdicional.forEach((campo, index) => {
                    console.log(`🔍 Processando PM adicional ${index}:`);
                    
                    const inputNome = campo.querySelector('[id^="pm_adicional_nome_"]');
                    const inputId = campo.querySelector('[id^="pm_adicional_id_"]');
                    const selectStatus = campo.querySelector('[id^="pm_adicional_status_"]');
                    
                    console.log(`  - Input nome:`, inputNome?.value);
                    console.log(`  - Input ID:`, inputId?.value);
                    console.log(`  - Status:`, selectStatus?.value);
                    
                    if (inputNome && inputId && inputNome.value && inputId.value) {
                        // Verificar se já foi adicionado
                        const jaAdicionado = Array.from(selectPM.options).some(opt => opt.value === inputId.value);
                        
                        if (!jaAdicionado) {
                            // Usar o status real se disponível, senão mostrar apenas o nome
                            let statusTexto = '';
                            if (selectStatus && selectStatus.value) {
                                statusTexto = ` (${selectStatus.value})`;
                            }
                            
                            const option = document.createElement('option');
                            option.value = inputId.value;
                            option.textContent = `${inputNome.value}${statusTexto}`;
                            selectPM.appendChild(option);
                            pmsCarregados++;
                            
                            console.log(`✅ PM adicionado ao select: ${inputNome.value}${statusTexto}`);
                        } else {
                            console.log(`⚠️ PM já existe no select: ${inputNome.value}`);
                        }
                    } else {
                        console.log(`❌ Campos incompletos para PM ${index}`);
                    }
                });
            }
            
            // Fallback: buscar por seletores alternativos se nenhum foi encontrado
            if (pmsCarregados <= 1) { // Só PM principal encontrado
                console.log('🔄 Tentando métodos alternativos para encontrar PMs...');
                
                // Buscar todos os inputs de nome de PM adicional
                const todosInputsNome = document.querySelectorAll('[id^="pm_adicional_nome_"]');
                console.log('📋 Todos inputs de nome encontrados:', todosInputsNome.length);
                
                todosInputsNome.forEach((inputNome, index) => {
                    const numero = inputNome.id.split('_').pop();
                    const inputId = document.getElementById(`pm_adicional_id_${numero}`);
                    const selectStatus = document.getElementById(`pm_adicional_status_${numero}`);
                    
                    console.log(`🔍 PM ${numero}:`, {
                        nome: inputNome.value,
                        id: inputId?.value,
                        status: selectStatus?.value
                    });
                    
                    if (inputNome.value && inputId?.value) {
                        // Verificar se já foi adicionado
                        const jaAdicionado = Array.from(selectPM.options).some(opt => opt.value === inputId.value);
                        
                        if (!jaAdicionado) {
                            // Usar o status real se disponível, senão mostrar apenas o nome
                            let statusTexto = '';
                            if (selectStatus?.value) {
                                statusTexto = ` (${selectStatus.value})`;
                            }
                            
                            const option = document.createElement('option');
                            option.value = inputId.value;
                            option.textContent = `${inputNome.value}${statusTexto}`;
                            selectPM.appendChild(option);
                            pmsCarregados++;
                            
                            console.log(`✅ PM encontrado via fallback: ${inputNome.value}${statusTexto}`);
                        }
                    }
                });
            }

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

        // ======== ATUALIZAR VARIÁVEL GLOBAL INDICIOSPORPM ========
        // Garantir que a variável global existe
        if (typeof indiciosPorPM === 'undefined') {
            window.indiciosPorPM = {};
        }
        
        // Criar estrutura de dados compatível com o backend
        const novosCrimes = this.crimesSelecionados.map(crime => ({ id: crime.id }));
        const novosRdpm = this.transgressoesSelecionadas.filter(t => t.tipo === 'rdpm').map(trans => ({ id: trans.id }));
        const novosArt29 = this.transgressoesSelecionadas.filter(t => t.tipo === 'art29').map(trans => ({ id: trans.id }));
        
        // Buscar dados existentes para fazer merge
        const dadosExistentes = (typeof indiciosPorPM !== 'undefined' && indiciosPorPM[pmSelecionado]) 
            ? indiciosPorPM[pmSelecionado] 
            : { categorias: [], crimes: [], rdpm: [], art29: [] };
        
        console.log('📋 Dados existentes do PM:', dadosExistentes);
        console.log('📋 Novos dados sendo adicionados:', { categorias, crimes: novosCrimes.length, rdpm: novosRdpm.length, art29: novosArt29.length });
        
        // Merge: combinar categorias (sem duplicatas)
        const categoriasExistentes = Array.isArray(dadosExistentes.categorias) 
            ? dadosExistentes.categorias 
            : (dadosExistentes.categorias ? [dadosExistentes.categorias] : []);
        
        const categoriasUnicas = [...new Set([...categoriasExistentes, ...categorias])];
        
        // Merge: combinar crimes (evitar duplicatas por ID)
        const crimesExistentes = Array.isArray(dadosExistentes.crimes) ? dadosExistentes.crimes : [];
        const crimesUnicos = [...crimesExistentes];
        novosCrimes.forEach(novoCrime => {
            if (!crimesUnicos.some(c => c.id === novoCrime.id)) {
                crimesUnicos.push(novoCrime);
            }
        });
        
        // Merge: combinar RDPM (evitar duplicatas por ID)
        const rdpmExistentes = Array.isArray(dadosExistentes.rdpm) ? dadosExistentes.rdpm : [];
        const rdpmUnicos = [...rdpmExistentes];
        novosRdpm.forEach(novoRdpm => {
            if (!rdpmUnicos.some(r => r.id === novoRdpm.id)) {
                rdpmUnicos.push(novoRdpm);
            }
        });
        
        // Merge: combinar Art29 (evitar duplicatas por ID)
        const art29Existentes = Array.isArray(dadosExistentes.art29) ? dadosExistentes.art29 : [];
        const art29Unicos = [...art29Existentes];
        novosArt29.forEach(novoArt29 => {
            if (!art29Unicos.some(a => a.id === novoArt29.id)) {
                art29Unicos.push(novoArt29);
            }
        });
        
        // Criar objeto com dados mesclados
        const dadosBackend = {
            categorias: categoriasUnicas,
            crimes: crimesUnicos,
            rdpm: rdpmUnicos,
            art29: art29Unicos
        };
        
        console.log('✅ Dados após merge:', dadosBackend);
        console.log('📊 Total final:', {
            categorias: dadosBackend.categorias.length,
            crimes: dadosBackend.crimes.length,
            rdpm: dadosBackend.rdpm.length,
            art29: dadosBackend.art29.length
        });
        
        // Atualizar variável global
        if (typeof indiciosPorPM !== 'undefined') {
            indiciosPorPM[pmSelecionado] = dadosBackend;
            console.log('✅ Variável global indiciosPorPM atualizada:', indiciosPorPM);
        } else {
            window.indiciosPorPM = {};
            window.indiciosPorPM[pmSelecionado] = dadosBackend;
            console.log('✅ Criada variável global window.indiciosPorPM:', window.indiciosPorPM);
        }
        
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
        // Obter o indício a ser removido
        const indicioRemovido = this.indiciosAdicionados[index];
        
        if (indicioRemovido && indicioRemovido.pmId) {
            // Remover do array de exibição
            this.indiciosAdicionados.splice(index, 1);
            
            // ======== RECONSTRUIR INDICIOSPORPM COM OS ITENS RESTANTES ========
            console.log(`🗑️ Removendo indício individual do PM ${indicioRemovido.pmId}`);
            console.log('� Indício removido:', indicioRemovido);
            
            // Reconstruir indiciosPorPM baseado nos indiciosAdicionados restantes
            const novoIndiciosPorPM = {};
            
            this.indiciosAdicionados.forEach(indicio => {
                if (!indicio.pmId) return;
                
                // Inicializar estrutura para este PM se não existir
                if (!novoIndiciosPorPM[indicio.pmId]) {
                    novoIndiciosPorPM[indicio.pmId] = {
                        categorias: [],
                        crimes: [],
                        rdpm: [],
                        art29: []
                    };
                }
                
                // Merge categorias (sem duplicatas)
                if (indicio.categorias && indicio.categorias.length > 0) {
                    indicio.categorias.forEach(cat => {
                        if (!novoIndiciosPorPM[indicio.pmId].categorias.includes(cat)) {
                            novoIndiciosPorPM[indicio.pmId].categorias.push(cat);
                        }
                    });
                }
                
                // Adicionar crimes
                if (indicio.crimes && indicio.crimes.length > 0) {
                    indicio.crimes.forEach(crime => {
                        if (!novoIndiciosPorPM[indicio.pmId].crimes.some(c => c.id === crime.id)) {
                            novoIndiciosPorPM[indicio.pmId].crimes.push({ id: crime.id });
                        }
                    });
                }
                
                // Adicionar transgressões (separar RDPM e Art. 29)
                if (indicio.transgressoes && indicio.transgressoes.length > 0) {
                    indicio.transgressoes.forEach(trans => {
                        if (trans.tipo === 'rdpm' || trans.tipo === 'RDPM') {
                            if (!novoIndiciosPorPM[indicio.pmId].rdpm.some(r => r.id === trans.id)) {
                                novoIndiciosPorPM[indicio.pmId].rdpm.push({ id: trans.id });
                            }
                        } else if (trans.tipo === 'estatuto' || trans.tipo === 'art29') {
                            if (!novoIndiciosPorPM[indicio.pmId].art29.some(a => a.id === trans.id)) {
                                novoIndiciosPorPM[indicio.pmId].art29.push({ id: trans.id });
                            }
                        }
                    });
                }
            });
            
            // Atualizar variável global
            if (typeof indiciosPorPM !== 'undefined') {
                // Substituir completamente
                Object.keys(indiciosPorPM).forEach(key => delete indiciosPorPM[key]);
                Object.assign(indiciosPorPM, novoIndiciosPorPM);
                
                console.log('✅ indiciosPorPM reconstruído:', indiciosPorPM);
            }
            
            if (typeof window.indiciosPorPM !== 'undefined') {
                Object.keys(window.indiciosPorPM).forEach(key => delete window.indiciosPorPM[key]);
                Object.assign(window.indiciosPorPM, novoIndiciosPorPM);
                
                console.log('✅ window.indiciosPorPM reconstruído:', window.indiciosPorPM);
            }
        } else {
            // Remover apenas do array de exibição se não tiver PM ID
            this.indiciosAdicionados.splice(index, 1);
        }
        
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
console.log('Criando instância do modalIndiciosSolucao...');
const modalIndiciosSolucao = new ModalIndiciosSolucao();
console.log('modalIndiciosSolucao criado:', modalIndiciosSolucao);
window.modalIndiciosSolucao = modalIndiciosSolucao;
