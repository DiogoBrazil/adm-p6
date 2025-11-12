"""
Router de Indícios - Funções @eel.expose para gerenciamento de indícios de PMs envolvidos.
Delega toda lógica de negócio para app/services/indicios.py
"""

from app.services import indicios as indicios_service


def register(eel, db_manager, guard_login):
    """
    Registra todas as rotas @eel.expose de indícios.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
    """
    
    @eel.expose
    def salvar_indicios_pm_envolvido(pm_envolvido_id, indicios_data, conn=None, cursor=None):
        """Salva os indícios específicos de um PM envolvido em um procedimento"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.salvar_indicios_pm_envolvido(
            db_manager, pm_envolvido_id, indicios_data, conn, cursor
        )
    
    @eel.expose
    def carregar_indicios_pm_envolvido(pm_envolvido_id):
        """Carrega os indícios de um PM envolvido"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.carregar_indicios_pm_envolvido(db_manager, pm_envolvido_id)
    
    @eel.expose
    def listar_pms_envolvidos_com_indicios(procedimento_id):
        """Lista todos os PMs envolvidos em um procedimento com seus indícios"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.listar_pms_envolvidos_com_indicios(db_manager, procedimento_id)
    
    @eel.expose
    def remover_indicios_pm_envolvido(pm_envolvido_id):
        """Remove todos os indícios de um PM envolvido"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.remover_indicios_pm_envolvido(db_manager, pm_envolvido_id)
    
    @eel.expose
    def buscar_crimes_para_indicios(termo=''):
        """Busca crimes/contravenções para associar aos indícios"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.buscar_crimes_para_indicios(db_manager, termo)
    
    @eel.expose
    def buscar_rdpm_para_indicios(termo='', gravidade=None):
        """Busca transgressões RDPM para associar aos indícios"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.buscar_rdpm_para_indicios(db_manager, termo, gravidade)
    
    @eel.expose
    def buscar_art29_para_indicios(termo=''):
        """Busca infrações Art.29 para associar aos indícios"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.buscar_art29_para_indicios(db_manager, termo)
    
    @eel.expose
    def obter_categorias_indicios():
        """Obtém as categorias de indícios disponíveis"""
        err = guard_login()
        if err:
            return err
        
        return indicios_service.obter_categorias_indicios(db_manager)
