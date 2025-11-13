"""
Router de Mapas - Funções @eel.expose para geração de mapas mensais.
Delega toda lógica de negócio para app/services/mapas_relatorios.py
"""

from app.services import mapas_relatorios as mapas_service


def register(eel, db_manager, guard_login, get_usuario_logado=None):
    """
    Registra todas as rotas @eel.expose de mapas.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        guard_login: Função de validação de login
        get_usuario_logado: Função para obter usuário logado
    """
    
    @eel.expose
    def gerar_mapa_mensal(mes, ano, tipo_processo):
        """Gera mapa mensal para um tipo específico de processo/procedimento"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_mapa_mensal(db_manager, mes, ano, tipo_processo)
    
    @eel.expose
    def gerar_mapa_mensal_completo(mes, ano):
        """Gera mapa mensal completo com todos os tipos de processos"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.gerar_mapa_completo(db_manager, mes, ano)
    
    @eel.expose
    def salvar_mapa_mensal(mes, ano, tipo_processo, dados_mapa, usuario_id=None):
        """Salva um mapa mensal gerado no banco de dados"""
        err = guard_login()
        if err:
            return err
        
        # Obter informações do usuário logado
        usuario_logado = get_usuario_logado() if get_usuario_logado else {}
        
        # Nome dos meses
        meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
        
        # Montar objeto de dados com metadata
        dados_completos = {
            'meta': {
                'mes': int(mes),
                'ano': int(ano),
                'mes_nome': meses[int(mes)] if 1 <= int(mes) <= 12 else '',
                'tipo_processo': tipo_processo,
                'total_processos': len(dados_mapa) if isinstance(dados_mapa, list) else 0,
                'total_concluidos': sum(1 for p in dados_mapa if p.get('concluido')) if isinstance(dados_mapa, list) else 0,
                'total_andamento': sum(1 for p in dados_mapa if not p.get('concluido')) if isinstance(dados_mapa, list) else 0,
            },
            'dados': dados_mapa
        }
        
        return mapas_service.salvar_mapa_mensal(
            db_manager, dados_completos, usuario_logado
        )
    
    @eel.expose
    def listar_mapas_salvos(mes=None, ano=None, tipo_processo=None):
        """Lista mapas mensais salvos com filtros opcionais"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.listar_mapas_salvos(db_manager, mes, ano, tipo_processo)
    
    @eel.expose
    def obter_mapa_salvo(mapa_id):
        """Obtém detalhes de um mapa salvo específico"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.obter_mapa_salvo(db_manager, mapa_id)
    
    @eel.expose
    def excluir_mapa_salvo(mapa_id):
        """Exclui um mapa mensal salvo"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.excluir_mapa_salvo(db_manager, mapa_id)
    
    @eel.expose
    def obter_tipos_processo_para_mapa():
        """Obtém lista de tipos de processo disponíveis para geração de mapas"""
        err = guard_login()
        if err:
            return err
        
        return mapas_service.obter_tipos_processo_para_mapa(db_manager)
