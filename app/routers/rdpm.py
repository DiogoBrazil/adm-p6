from app import rdpm as rdpm_mod


def register(eel, db_manager, guard_login, guard_admin, get_usuario_logado):
    """Registra handlers Eel para transgressões (RDPM)."""

    @eel.expose
    def listar_todas_transgressoes():
        g = guard_login()
        if g:
            return g
        return rdpm_mod.listar_todas_transgressoes(db_manager)

    @eel.expose
    def cadastrar_transgressao(dados_transgressao):
        g = guard_admin()
        if g:
            return g
        r = rdpm_mod.cadastrar_transgressao(db_manager, dados_transgressao)
        if r.get('success'):
            try:
                usuario = get_usuario_logado() or {}
                transgressao_id = r.get('id')
                db_manager.registrar_auditoria('transgressoes', str(transgressao_id), 'CREATE', usuario.get('id'))
            except Exception:
                pass
            return {'success': True, 'message': 'Transgressão cadastrada com sucesso', 'id': r.get('id')}
        return {'success': False, 'error': r.get('error', 'Falha ao cadastrar transgressão')}

    @eel.expose
    def obter_transgressao_por_id(transgressao_id):
        g = guard_login()
        if g:
            return g
        return rdpm_mod.obter_transgressao_por_id(db_manager, transgressao_id)

    @eel.expose
    def atualizar_transgressao(dados_transgressao):
        g = guard_admin()
        if g:
            return g
        r = rdpm_mod.atualizar_transgressao(db_manager, dados_transgressao)
        if r.get('success'):
            try:
                usuario = get_usuario_logado() or {}
                db_manager.registrar_auditoria('transgressoes', str(dados_transgressao.get('id')), 'UPDATE', usuario.get('id'))
            except Exception:
                pass
            return {'success': True, 'message': 'Transgressão atualizada com sucesso'}
        return {'success': False, 'error': r.get('error', 'Falha ao atualizar transgressão')}

    @eel.expose
    def excluir_transgressao(transgressao_id):
        g = guard_admin()
        if g:
            return g
        r = rdpm_mod.excluir_transgressao(db_manager, transgressao_id)
        if r.get('success'):
            try:
                usuario = get_usuario_logado() or {}
                db_manager.registrar_auditoria('transgressoes', str(transgressao_id), 'DELETE', usuario.get('id'))
            except Exception:
                pass
            return {'success': True, 'message': 'Transgressão excluída com sucesso'}
        return {'success': False, 'error': r.get('error', 'Falha ao excluir transgressão')}

