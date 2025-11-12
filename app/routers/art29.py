from app import art29 as art29_mod


def register(eel, db_manager, guard_login, guard_admin, get_usuario_logado):
    """Registra handlers Eel para infrações do Art. 29."""

    @eel.expose
    def listar_infracoes_estatuto_art29():
        g = guard_login()
        if g:
            return g
        return art29_mod.listar_infracoes_estatuto_art29(db_manager)

    @eel.expose
    def obter_infracao_estatuto_art29(infracao_id):
        g = guard_login()
        if g:
            return g
        return art29_mod.obter_infracao_estatuto_art29(db_manager, infracao_id)

    @eel.expose
    def criar_infracao_estatuto_art29(inciso, texto):
        g = guard_admin()
        if g:
            return g
        if not inciso or not str(inciso).strip():
            return {'success': False, 'error': 'Inciso é obrigatório'}
        if not texto or not str(texto).strip():
            return {'success': False, 'error': 'Texto da infração é obrigatório'}
        inciso = str(inciso).strip()
        texto = str(texto).strip()
        r = art29_mod.criar_infracao_estatuto_art29(db_manager, inciso, texto)
        if r.get('success'):
            return {'success': True, 'data': {'id': r.get('id'), 'inciso': inciso, 'texto': texto}}
        return {'success': False, 'error': r.get('error', 'Falha ao criar infração')}

    @eel.expose
    def editar_infracao_estatuto_art29(infracao_id, inciso, texto):
        g = guard_admin()
        if g:
            return g
        if not inciso or not str(inciso).strip():
            return {'success': False, 'error': 'Inciso é obrigatório'}
        if not texto or not str(texto).strip():
            return {'success': False, 'error': 'Texto da infração é obrigatório'}
        inciso = str(inciso).strip()
        texto = str(texto).strip()
        r = art29_mod.editar_infracao_estatuto_art29(db_manager, infracao_id, inciso, texto)
        if r.get('success'):
            return {'success': True, 'data': {'id': infracao_id, 'inciso': inciso, 'texto': texto}}
        return {'success': False, 'error': r.get('error', 'Falha ao editar infração')}

    @eel.expose
    def excluir_infracao_estatuto_art29(infracao_id):
        g = guard_admin()
        if g:
            return g
        r = art29_mod.excluir_infracao_estatuto_art29(db_manager, infracao_id)
        if r.get('success'):
            inciso = r.get('inciso')
            return {'success': True, 'message': f'Infração {inciso} excluída com sucesso'}
        return {'success': False, 'error': r.get('error', 'Falha ao excluir infração')}

