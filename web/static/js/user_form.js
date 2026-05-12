// Variável para usuário logado
let usuarioLogado = null;
let modoEdicao = false;
let usuarioIdEdicao = null;
let usuarioTipoEdicao = null;

console.log('🚀 Script user_form.js carregado!'); // Debug inicial

// Função para obter parâmetros da URL
function obterParametrosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type');
    
    if (id && type) {
        modoEdicao = true;
        usuarioIdEdicao = id;
        usuarioTipoEdicao = type;
        console.log('Modo edição ativado - ID:', id, 'Tipo:', type);
    }
    
    return { id, type };
}

// Função para carregar dados do usuário para edição
async function carregarDadosUsuarioEdicao(userId, userType) {
    try {
        console.log('Carregando dados do usuário para edição...', userId, userType);
        
        const resultado = await eel.obter_usuario_detalhado(userId, userType)();
        
        if (resultado.sucesso) {
            const usuario = resultado.usuario;
            console.log('Dados do usuário carregados:', usuario);
            
            // Preencher título
            const titulo = document.querySelector('.card-header h2');
            if (titulo) {
                titulo.textContent = 'Editar Usuário';
            }
            
            // Preencher campos básicos
            document.getElementById('tipo_usuario').value = usuario.tipo_usuario || '';
            
            // Atualizar opções de posto/graduação antes de selecionar
            atualizarPostoGraduacao();
            
            // Aguardar um pouco para garantir que as opções foram carregadas
            setTimeout(() => {
                document.getElementById('posto_graduacao').value = usuario.posto_graduacao || '';
                document.getElementById('nome').value = usuario.nome || '';
                document.getElementById('matricula').value = usuario.matricula || '';
                document.getElementById('is_encarregado').checked = usuario.is_encarregado || false;
                document.getElementById('is_operador').checked = usuario.is_operador || false;
                
                // Atualizar campos de operador
                toggleOperatorFields();
                
                // Preencher campos de operador se for operador
                if (usuario.is_operador) {
                    document.getElementById('email').value = usuario.email || '';
                    document.getElementById('perfil').value = usuario.perfil || '';
                    // Senha não é preenchida por segurança
                    document.querySelector('label[for="senha"]').innerHTML = 'Nova Senha (deixe em branco para manter a atual)';
                }
                
                // Mudar texto do botão
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.textContent = 'Atualizar Usuário';
                }
                
                console.log('Formulário preenchido com dados do usuário');
            }, 100);
            
            return true;
        } else {
            showAlert('Erro ao carregar dados do usuário: ' + resultado.mensagem, 'error');
            return false;
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        showAlert('Erro ao carregar dados do usuário!', 'error');
        return false;
    }
}

// Mapas de postos/graduações
const postosOficial = [
    'CEL PM', 'TC PM', 'MAJ PM', 'CAP PM', 
    '1º TEN PM', '2º TEN PM', 'ASP OF PM'
];

const graduacoesPraca = [
    'ST PM', '1º SGT PM', '2º SGT PM', 
    '3º SGT PM', 'CB PM', 'SD PM'
];

// Função para carregar dados do usuário logado
async function carregarUsuarioLogado() {
    try {
        const resultado = await eel.obter_usuario_logado()();
        
        if (resultado.logado) {
            usuarioLogado = resultado.usuario;
            document.getElementById('userName').textContent = resultado.usuario.nome;
            document.getElementById('userEmail').textContent = resultado.usuario.email;
            return true;
        } else {
            showAlert('Sessão expirada. Redirecionando para login...', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        showAlert('Erro ao carregar dados do usuário!', 'error');
        return false;
    }
}

// Função para atualizar o select de posto/graduação baseado no tipo
function atualizarPostoGraduacao() {
    const tipoUsuario = document.getElementById('tipo_usuario').value;
    const postoGraduacaoSelect = document.getElementById('posto_graduacao');
    const label = document.getElementById('label_posto_graduacao');
    
    console.log('Tipo usuário selecionado:', tipoUsuario); // Debug
    
    // Limpar opções
    postoGraduacaoSelect.innerHTML = '<option value="">Selecione...</option>';
    
    if (tipoUsuario === 'Oficial') {
        label.textContent = 'Selecione o Posto';
        postosOficial.forEach(posto => {
            const option = document.createElement('option');
            option.value = posto;
            option.textContent = posto;
            postoGraduacaoSelect.appendChild(option);
        });
        console.log('Postos carregados para Oficial'); // Debug
    } else if (tipoUsuario === 'Praça') {
        label.textContent = 'Selecione a Graduação';
        graduacoesPraca.forEach(graduacao => {
            const option = document.createElement('option');
            option.value = graduacao;
            option.textContent = graduacao;
            postoGraduacaoSelect.appendChild(option);
        });
        console.log('Graduações carregadas para Praça'); // Debug
    } else {
        label.textContent = 'Posto/Graduação';
        postoGraduacaoSelect.innerHTML = '<option value="">Primeiro selecione o tipo de usuário</option>';
        console.log('Nenhum tipo selecionado'); // Debug
    }
}

// Função para validar matrícula
function validarMatricula(matricula) {
    // Remove espaços e caracteres não numéricos
    const numeroLimpo = matricula.replace(/\D/g, '');
    
    // Verifica se tem exatamente 9 dígitos
    if (numeroLimpo.length === 0) {
        return {
            valido: false,
            mensagem: 'A matrícula é obrigatória.'
        };
    }
    
    if (numeroLimpo.length < 9) {
        return {
            valido: false,
            mensagem: `A matrícula deve ter exatamente 9 dígitos. Você digitou apenas ${numeroLimpo.length} dígitos.`
        };
    }
    
    if (numeroLimpo.length > 9) {
        return {
            valido: false,
            mensagem: 'A matrícula deve ter exatamente 9 dígitos. Limite excedido.'
        };
    }
    
    // Verifica se os primeiros 4 dígitos são "1000"
    if (!numeroLimpo.startsWith('1000')) {
        return {
            valido: false,
            mensagem: `A matrícula deve começar com "1000". Você digitou "${numeroLimpo.substring(0, 4)}".`
        };
    }
    
    return {
        valido: true,
        matricula: numeroLimpo
    };
}

// Função para configurar validações de campos
function configurarValidacoesCampos() {
    const nomeField = document.getElementById('nome');
    const matriculaField = document.getElementById('matricula');
    
    // Validação do nome - sempre maiúsculo
    if (nomeField) {
        nomeField.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        // Garantir que inicie maiúsculo
        nomeField.addEventListener('blur', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        console.log('Validação de maiúsculo configurada para o nome'); // Debug
    }
    
    // Validação da matrícula - apenas números e formato correto
    if (matriculaField) {
        // Permitir apenas números
        matriculaField.addEventListener('input', (e) => {
            // Remove caracteres não numéricos
            let valor = e.target.value.replace(/\D/g, '');
            
            // Limita a 9 dígitos
            if (valor.length > 9) {
                valor = valor.substring(0, 9);
            }
            
            e.target.value = valor;
            
            // Feedback visual em tempo real
            if (valor.length > 0) {
                if (valor.length < 4) {
                    e.target.style.borderColor = '#ffc107'; // Amarelo - ainda digitando
                } else if (!valor.startsWith('1000')) {
                    e.target.style.borderColor = '#dc3545'; // Vermelho - erro
                } else if (valor.length === 9) {
                    e.target.style.borderColor = '#28a745'; // Verde - correto
                } else {
                    e.target.style.borderColor = '#ffc107'; // Amarelo - ainda digitando
                }
            } else {
                e.target.style.borderColor = ''; // Reset
            }
        });
        
        // Validação completa ao sair do campo
        matriculaField.addEventListener('blur', (e) => {
            const valor = e.target.value;
            if (valor) {
                const validacao = validarMatricula(valor);
                if (!validacao.valido) {
                    showAlert(validacao.mensagem, 'error');
                    e.target.style.borderColor = '#dc3545';
                    // Não remove o foco automaticamente, deixa o usuário decidir
                } else {
                    e.target.value = validacao.matricula;
                    e.target.style.borderColor = '#28a745';
                }
            } else {
                e.target.style.borderColor = '';
            }
        });
        
        console.log('Validação de matrícula configurada'); // Debug
    }
}

// Função para controlar visibilidade dos campos de operador
function toggleOperatorFields() {
    const isOperadorChecked = document.getElementById('is_operador').checked;
    const operatorFields = document.getElementById('operatorFields');
    const emailField = document.getElementById('email');
    const senhaField = document.getElementById('senha');
    const perfilField = document.getElementById('perfil');
    
    console.log('Operador checkbox:', isOperadorChecked); // Debug
    
    if (isOperadorChecked) {
        operatorFields.style.display = 'block';
        emailField.setAttribute('required', 'required');
        perfilField.setAttribute('required', 'required');
        
        // Senha só é obrigatória na criação, não na edição
        if (!modoEdicao) {
            senhaField.setAttribute('required', 'required');
        } else {
            senhaField.removeAttribute('required');
        }
        
        console.log('Campos de operador exibidos e marcados como obrigatórios'); // Debug
    } else {
        operatorFields.style.display = 'none';
        emailField.removeAttribute('required');
        senhaField.removeAttribute('required');
        perfilField.removeAttribute('required');
        // Limpar valores
        emailField.value = '';
        senhaField.value = '';
        perfilField.value = '';
        console.log('Campos de operador ocultos e não obrigatórios'); // Debug
    }
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
    const modal = document.getElementById('modalFeedback');
    const icon = document.getElementById('modalIcon');
    const messageEl = document.getElementById('modalMessage');
    
    messageEl.textContent = message;
    
    // Definir ícone baseado no tipo
    if (type === 'success') {
        icon.className = 'fas fa-check-circle';
        icon.style.color = '#28a745';
    } else if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle';
        icon.style.color = '#dc3545';
    } else {
        icon.className = 'fas fa-info-circle';
        icon.style.color = '#17a2b8';
    }
    
    modal.style.display = 'flex';
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM carregado, iniciando configuração...'); // Debug
    
    // Inicializar sistema de permissões
    if (window.permissoes) {
        await window.permissoes.inicializar();
    }
    
    // Carregar usuário logado
    await carregarUsuarioLogado();
    
    // Verificar se é modo edição
    const { id, type } = obterParametrosURL();
    
    // Verificar se elementos existem
    const tipoUsuarioSelect = document.getElementById('tipo_usuario');
    const operadorCheckbox = document.getElementById('is_operador');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const userForm = document.getElementById('userForm');
    
    console.log('Elementos encontrados:', {
        tipoUsuarioSelect: !!tipoUsuarioSelect,
        operadorCheckbox: !!operadorCheckbox,
        modalCloseBtn: !!modalCloseBtn,
        userForm: !!userForm
    }); // Debug
    
    // Configurar event listeners
    if (tipoUsuarioSelect) {
        tipoUsuarioSelect.addEventListener('change', atualizarPostoGraduacao);
        console.log('Event listener adicionado ao tipo_usuario'); // Debug
    }
    
    if (operadorCheckbox) {
        operadorCheckbox.addEventListener('change', toggleOperatorFields);
        console.log('Event listener adicionado ao is_operador'); // Debug
    }
    
    // Garantir estado inicial correto dos campos de operador
    toggleOperatorFields();
    console.log('Estado inicial dos campos de operador configurado'); // Debug
    
    // Configurar validações de campos
    configurarValidacoesCampos();
    console.log('Validações de campos configuradas'); // Debug
    
    // Se for modo edição, carregar dados do usuário
    if (modoEdicao && id && type) {
        await carregarDadosUsuarioEdicao(id, type);
    }
    
    // Modal close
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            document.getElementById('modalFeedback').style.display = 'none';
        });
    }
    
    // Submit do formulário
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            console.log('Formulário submetido'); // Debug
            
            // Coletar dados do formulário
            const formData = {
                tipo_usuario: document.getElementById('tipo_usuario').value,
                posto_graduacao: document.getElementById('posto_graduacao').value,
                nome: document.getElementById('nome').value.trim(),
                matricula: document.getElementById('matricula').value.trim(),
                is_encarregado: document.getElementById('is_encarregado').checked,
                is_operador: document.getElementById('is_operador').checked,
                email: document.getElementById('email').value.trim() || null,
                senha: document.getElementById('senha').value || null,
                perfil: document.getElementById('perfil').value || null
            };
            
            console.log('Dados do formulário:', formData); // Debug
            
            // Validações básicas
            if (!formData.tipo_usuario || !formData.posto_graduacao || !formData.nome || !formData.matricula) {
                showAlert('Todos os campos obrigatórios devem ser preenchidos!', 'error');
                return;
            }
            
            // Validar formato da matrícula
            const validacaoMatricula = validarMatricula(formData.matricula);
            if (!validacaoMatricula.valido) {
                showAlert(validacaoMatricula.mensagem, 'error');
                return;
            }
            
            // Atualizar matrícula com formato correto
            formData.matricula = validacaoMatricula.matricula;
            
            // Validar campos de operador se necessário
            if (formData.is_operador) {
                // Em modo edição, senha é opcional (mantém a atual se vazio)
                if (!modoEdicao) {
                    if (!formData.email || !formData.senha || !formData.perfil) {
                        showAlert('Para operadores, email, senha e perfil são obrigatórios!', 'error');
                        return;
                    }
                } else {
                    if (!formData.email || !formData.perfil) {
                        showAlert('Para operadores, email e perfil são obrigatórios!', 'error');
                        return;
                    }
                }
            }
            
            try {
                let resultado;
                
                if (modoEdicao) {
                    // Modo edição - atualizar usuário
                    resultado = await eel.atualizar_usuario(
                        usuarioIdEdicao,
                        usuarioTipoEdicao,
                        formData.tipo_usuario,
                        formData.posto_graduacao,
                        formData.nome,
                        formData.matricula,
                        formData.is_encarregado,
                        formData.is_operador,
                        formData.email,
                        formData.senha, // null se não for alterada
                        formData.perfil
                    )();
                    
                    if (resultado.sucesso) {
                        showAlert('Usuário atualizado com sucesso!', 'success');
                        
                        // Redirecionar para listagem após 1 segundo
                        setTimeout(() => {
                            document.getElementById('modalFeedback').style.display = 'none';
                            window.location.href = 'user_list.html';
                        }, 1000);
                    } else {
                        showAlert(resultado.mensagem, 'error');
                    }
                } else {
                    // Modo cadastro - criar novo usuário
                    resultado = await eel.cadastrar_usuario(
                        formData.tipo_usuario,
                        formData.posto_graduacao,
                        formData.nome,
                        formData.matricula,
                        formData.is_encarregado,
                        formData.is_operador,
                        formData.email,
                        formData.senha,
                        formData.perfil
                    )();
                    
                    if (resultado.sucesso) {
                        showAlert('Usuário cadastrado com sucesso!', 'success');
                        
                        // Redirecionar para listagem após 1 segundo
                        setTimeout(() => {
                            document.getElementById('modalFeedback').style.display = 'none';
                            window.location.href = 'user_list.html';
                        }, 1000);
                    } else {
                        showAlert(resultado.mensagem, 'error');
                    }
                }
                
            } catch (error) {
                console.error('Erro ao salvar usuário:', error);
                showAlert('Erro ao conectar com o servidor!', 'error');
            }
        });
    }
    
    console.log('Configuração completa'); // Debug
});

// Função para logout
async function realizarLogout() {
    try {
        await eel.fazer_logout()();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro no logout:', error);
        window.location.href = 'login.html';
    }
}

// Função para voltar à listagem
function voltarParaListagem() {
    window.location.href = 'user_list.html';
}
