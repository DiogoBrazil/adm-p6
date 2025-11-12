"""
Router de Usuários - Funções @eel.expose para gerenciamento de usuários.
Delega toda lógica de negócio para app/services/usuarios.py
"""

from app.services import usuarios as usuarios_service


def register(eel, db_manager, guard_login, guard_admin, get_usuario_logado):
    """
    Registra todas as rotas @eel.expose de usuários.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
        guard_admin: Função de validação de admin
        get_usuario_logado: Função para obter usuário logado
    """
    
    @eel.expose
    def obter_usuario_por_id(user_id, user_type):
        """Retorna os dados atuais de um usuário para edição/visualização"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.obter_usuario_por_id(db_manager, user_id, user_type)
    
    @eel.expose
    def cadastrar_usuario(tipo_usuario, posto_graduacao, nome, matricula, 
                          is_encarregado=False, is_operador=False, email=None, 
                          senha=None, perfil=None):
        """Cadastra novo usuário na estrutura unificada"""
        err = guard_admin()
        if err:
            return err
        
        usuario_logado = get_usuario_logado()
        
        return usuarios_service.cadastrar_usuario(
            db_manager, usuario_logado, tipo_usuario, posto_graduacao, nome, matricula,
            is_encarregado, is_operador, email, senha, perfil
        )
    
    @eel.expose
    def listar_usuarios(search_term=None, page=1, per_page=10):
        """Lista todos os usuários cadastrados com paginação e pesquisa"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.listar_usuarios(db_manager, search_term, page, per_page)
    
    @eel.expose
    def listar_todos_usuarios():
        """Lista todos os usuários da estrutura unificada"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.listar_todos_usuarios(db_manager)
    
    @eel.expose
    def listar_encarregados_operadores():
        """Lista todos os usuários que são encarregados ou operadores"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.listar_encarregados_operadores(db_manager)
    
    @eel.expose
    def obter_usuario_detalhado(user_id, user_type):
        """Obtém detalhes completos de um usuário para edição"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.obter_usuario_detalhado(db_manager, user_id, user_type)
    
    @eel.expose
    def atualizar_usuario(user_id, user_type, tipo_usuario, posto_graduacao, nome, 
                          matricula, is_encarregado, is_operador, email, senha, perfil):
        """Atualiza um usuário existente com todos os campos"""
        err = guard_admin()
        if err:
            return err
        
        usuario_logado = get_usuario_logado()
        
        return usuarios_service.atualizar_usuario(
            db_manager, usuario_logado, user_id, user_type, tipo_usuario, posto_graduacao,
            nome, matricula, is_encarregado, is_operador, email, senha, perfil
        )
    
    @eel.expose
    def atualizar_usuario_old(user_id, user_type, posto_graduacao, matricula, nome, 
                              email, senha=None, profile=None):
        """Atualiza um usuário existente (versão antiga - manter por compatibilidade)"""
        err = guard_admin()
        if err:
            return err
        
        return usuarios_service.atualizar_usuario_old(
            db_manager, user_id, user_type, posto_graduacao, matricula, 
            nome, email, senha, profile
        )
    
    @eel.expose
    def delete_user(user_id, user_type):
        """Desativa um usuário"""
        err = guard_admin()
        if err:
            return err
        
        usuario_logado = get_usuario_logado()
        usuario_logado_id = usuario_logado['id'] if usuario_logado else None
        
        return usuarios_service.deletar_usuario(db_manager, user_id, usuario_logado_id)
    
    @eel.expose
    def verificar_admin():
        """Verifica se usuário logado é admin"""
        usuario_logado = get_usuario_logado()
        return usuarios_service.verificar_admin(usuario_logado)
    
    @eel.expose
    def obter_estatisticas_usuario(user_id, user_type):
        """Obtém estatísticas detalhadas de um usuário específico"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.obter_estatisticas_usuario(db_manager, user_id, user_type)
    
    @eel.expose
    def obter_processos_usuario_responsavel(user_id):
        """Obtém processos onde o usuário é responsável (encarregado)"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.obter_processos_usuario_responsavel(db_manager, user_id)
    
    @eel.expose
    def obter_processos_usuario_escrivao(user_id):
        """Obtém processos onde o usuário é escrivão"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.obter_processos_usuario_escrivao(db_manager, user_id)
    
    @eel.expose
    def obter_processos_usuario_envolvido(user_id):
        """Obtém processos onde o usuário está envolvido"""
        err = guard_login()
        if err:
            return err
        
        return usuarios_service.obter_processos_usuario_envolvido(db_manager, user_id)
