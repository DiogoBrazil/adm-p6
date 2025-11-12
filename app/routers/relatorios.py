"""
Router de Relatórios - Funções @eel.expose para geração de relatórios.
Delega toda lógica de negócio para app/services/mapas_relatorios.py
"""

from app.services import mapas_relatorios as mapas_service


def register(eel, db_manager, guard_login):
    """
    Registra todas as rotas @eel.expose de relatórios.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
    """
    
    @eel.expose
    def gerar_relatorio_anual_pdf(ano):
        """Gera relatório anual completo em PDF"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_relatorio_anual_pdf(db_manager, ano)
    
    @eel.expose
    def gerar_relatorio_estatisticas_gerais(ano=None):
        """Gera relatório de estatísticas gerais do sistema"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_relatorio_estatisticas_gerais(db_manager, ano)
    
    @eel.expose
    def gerar_relatorio_processos_por_encarregado(ano=None):
        """Gera relatório de processos agrupados por encarregado"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_relatorio_processos_por_encarregado(db_manager, ano)
    
    @eel.expose
    def gerar_relatorio_processos_por_tipo(ano=None):
        """Gera relatório de processos agrupados por tipo"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_relatorio_processos_por_tipo(db_manager, ano)
    
    @eel.expose
    def gerar_relatorio_prazos_vencidos(dias_atras=30):
        """Gera relatório de processos com prazos vencidos"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_relatorio_prazos_vencidos(db_manager, dias_atras)
    
    @eel.expose
    def exportar_relatorio_csv(tipo_relatorio, filtros=None):
        """Exporta relatório em formato CSV"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.exportar_relatorio_csv(db_manager, tipo_relatorio, filtros)
    
    @eel.expose
    def exportar_relatorio_excel(tipo_relatorio, filtros=None):
        """Exporta relatório em formato Excel"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.exportar_relatorio_excel(db_manager, tipo_relatorio, filtros)
