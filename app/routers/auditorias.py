"""
Router de Auditorias - Funções @eel.expose para consulta de auditorias.
Delega toda lógica de negócio para app/services/auditorias.py
"""

from app.services import auditorias as auditorias_service


def register(eel, db_manager, guard_login, guard_admin):
    """
    Registra todas as rotas @eel.expose de auditorias.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
        guard_admin: Função de validação de admin
    """
    
    @eel.expose
    def listar_auditorias(search_term=None, page=1, per_page=10, filtros=None):
        """Lista auditorias com paginação e filtros"""
        err = guard_admin()  # Apenas admins podem ver auditorias
        if err:
            return err
        
        return auditorias_service.listar_auditorias(
            db_manager, search_term, page, per_page, filtros
        )
    
    @eel.expose
    def obter_auditoria_detalhada(auditoria_id):
        """Obtém detalhes completos de um registro de auditoria"""
        err = guard_admin()
        if err:
            return err
        
        return auditorias_service.obter_auditoria_detalhada(db_manager, auditoria_id)
    
    @eel.expose
    def obter_auditorias_por_registro(tabela, registro_id):
        """Obtém todas as auditorias de um registro específico"""
        err = guard_admin()
        if err:
            return err
        
        return auditorias_service.obter_auditorias_por_registro(db_manager, tabela, registro_id)
    
    @eel.expose
    def obter_auditorias_por_usuario(usuario_id, page=1, per_page=10):
        """Obtém todas as auditorias realizadas por um usuário"""
        err = guard_admin()
        if err:
            return err
        
        return auditorias_service.obter_auditorias_por_usuario(
            db_manager, usuario_id, page, per_page
        )
    
    @eel.expose
    def obter_estatisticas_auditoria(data_inicio=None, data_fim=None):
        """Obtém estatísticas gerais de auditoria"""
        err = guard_admin()
        if err:
            return err
        
        return auditorias_service.obter_estatisticas_auditoria(
            db_manager, data_inicio, data_fim
        )
