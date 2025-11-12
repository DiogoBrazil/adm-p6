"""
Router de Prazos - Funções @eel.expose para gerenciamento de prazos.
Delega toda lógica de negócio para app/services/prazos_andamentos.py
"""

from app.services import prazos_andamentos as prazos_service


def register(eel, db_manager, guard_login, prazos_manager):
    """
    Registra todas as rotas @eel.expose de prazos.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
        prazos_manager: Instância do PrazosAndamentosManager
    """
    
    @eel.expose
    def listar_prazos_processo(processo_id):
        """Lista todos os prazos de um processo"""
        err = guard_login()
        if err:
            return err
        
        try:
            prazos = prazos_manager.listar_prazos_processo(processo_id)
            return {"sucesso": True, "prazos": prazos}
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao listar prazos: {str(e)}"}
    
    @eel.expose
    def adicionar_prorrogacao(processo_id, dias_prorrogacao, numero_portaria=None, 
                             data_portaria=None, motivo=None, autorizado_por=None, 
                             autorizado_tipo=None):
        """Cria uma prorrogação para o prazo ativo do processo"""
        err = guard_login()
        if err:
            return err
        
        try:
            resultado = prazos_manager.prorrogar_prazo(
                processo_id=processo_id,
                dias_prorrogacao=int(dias_prorrogacao),
                motivo=motivo,
                autorizado_por=autorizado_por,
                autorizado_tipo=autorizado_tipo,
                numero_portaria=numero_portaria,
                data_portaria=data_portaria
            )
            return resultado
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao adicionar prorrogação: {str(e)}"}
    
    @eel.expose
    def obter_prazos_vencendo(dias_antecedencia=7):
        """Obtém prazos que estão vencendo nos próximos dias"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.obter_prazos_vencendo(db_manager, prazos_manager, dias_antecedencia)
    
    @eel.expose
    def obter_prazos_vencidos():
        """Obtém prazos que já venceram"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.obter_prazos_vencidos(db_manager, prazos_manager)
    
    @eel.expose
    def obter_dashboard_prazos():
        """Obtém dados para dashboard de prazos"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.obter_dashboard_prazos(db_manager, prazos_manager)
    
    @eel.expose
    def gerar_relatorio_prazos(filtros=None):
        """Gera relatório de prazos com filtros opcionais"""
        err = guard_login()
        if err:
            return err
        
        return prazos_service.gerar_relatorio_prazos(db_manager, prazos_manager, filtros)
    
    @eel.expose
    def concluir_prazo_processo(processo_id, responsavel_id=None):
        """Conclui o prazo ativo de um processo"""
        err = guard_login()
        if err:
            return err
        
        try:
            resultado = prazos_manager.concluir_prazo(
                processo_id=processo_id,
                responsavel_id=responsavel_id
            )
            return resultado
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao concluir prazo: {str(e)}"}
    
    @eel.expose
    def registrar_andamento_processo(processo_id, tipo_andamento, descricao, 
                                    data_andamento=None, responsavel_id=None, 
                                    observacoes=None):
        """Registra um novo andamento para um processo"""
        err = guard_login()
        if err:
            return err
        
        try:
            resultado = prazos_manager.registrar_andamento(
                processo_id=processo_id,
                tipo_andamento=tipo_andamento,
                descricao=descricao,
                data_andamento=data_andamento,
                responsavel_id=responsavel_id,
                observacoes=observacoes
            )
            return resultado
        except Exception as e:
            return {"sucesso": False, "mensagem": f"Erro ao registrar andamento: {str(e)}"}
