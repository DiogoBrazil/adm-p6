"""
Router de Andamentos - Funções @eel.expose para gerenciamento de andamentos.
Delega toda lógica de negócio para app/services/prazos_andamentos.py
"""

from app.services import prazos_andamentos as prazos_service


def register(eel, db_manager, guard_login, get_usuario_logado):
    """
    Registra todas as rotas @eel.expose de andamentos.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
        get_usuario_logado: Função para obter usuário logado
    """
    
    @eel.expose
    def adicionar_andamento(processo_id, texto, usuario_nome=None):
        """Adiciona um novo andamento (progresso) ao processo/procedimento"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.adicionar_andamento(db_manager, processo_id, texto, usuario_nome)
    
    @eel.expose
    def listar_andamentos(processo_id):
        """Lista todos os andamentos de um processo/procedimento"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.listar_andamentos(db_manager, processo_id)
    
    @eel.expose
    def listar_andamentos_processo(processo_id):
        """Lista todos os andamentos de um processo (alias para compatibilidade)"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.listar_andamentos_processo(db_manager, processo_id)
    
    @eel.expose
    def remover_andamento(processo_id, andamento_id):
        """Remove um andamento específico do processo/procedimento"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.remover_andamento(db_manager, processo_id, andamento_id)
    
    @eel.expose
    def obter_tipos_andamento():
        """Obtém os tipos de andamento disponíveis"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.obter_tipos_andamento(db_manager)
    
    @eel.expose
    def calcular_prazo_processo(tipo_processo, data_inicio, dias_prazo=None):
        """Calcula o prazo final de um processo considerando dias úteis"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.calcular_prazo_processo(
            db_manager, tipo_processo, data_inicio, dias_prazo
        )
