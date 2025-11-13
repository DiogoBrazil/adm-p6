import uuid

from app.utils import validar_campos_crime
from app import catalogos as catalogos_mod


def register(eel, db_manager, guard_login, guard_admin, get_usuario_logado):
    """Registra handlers Eel para CRUD de crimes/contravenções.

    Args:
        eel: módulo eel já importado
        db_manager: instância de DatabaseManager
        guard_login: função de guarda de login
        guard_admin: função de guarda de admin
        get_usuario_logado: callable que retorna o usuário logado atual
    """

    @eel.expose
    def listar_crimes_contravencoes():
        g = guard_login()
        if g:
            return g
        return catalogos_mod.listar_crimes_contravencoes(db_manager)

    @eel.expose
    def obter_crime_por_id(crime_id):
        g = guard_login()
        if g:
            return g
        return catalogos_mod.obter_crime_por_id(db_manager, crime_id)

    @eel.expose
    def excluir_crime_contravencao(crime_id):
        g = guard_admin()
        if g:
            return g
        return catalogos_mod.excluir_crime_contravencao(db_manager, crime_id)

    @eel.expose
    def cadastrar_crime(dados_crime):
        g = guard_admin()
        if g:
            return g

        # Validação
        validation_errors = validar_campos_crime(dados_crime)
        if validation_errors:
            return {
                'success': False,
                'error': 'Erro de validação: ' + '; '.join(validation_errors),
            }

        r = catalogos_mod.cadastrar_crime(db_manager, dados_crime)
        if r.get('success'):
            try:
                usuario = get_usuario_logado() or {}
                db_manager.registrar_auditoria(
                    'crimes_contravencoes', str(r.get('id') or ''), 'CREATE', usuario.get('id')
                )
            except Exception:
                pass
        return r

    @eel.expose
    def atualizar_crime(dados_crime):
        g = guard_admin()
        if g:
            return g

        # Validação
        validation_errors = validar_campos_crime(dados_crime)
        if validation_errors:
            return {
                'success': False,
                'error': 'Erro de validação: ' + '; '.join(validation_errors),
            }

        r = catalogos_mod.atualizar_crime(db_manager, dados_crime)
        if r.get('success'):
            try:
                usuario = get_usuario_logado() or {}
                db_manager.registrar_auditoria(
                    'crimes_contravencoes', str(dados_crime.get('id') or ''), 'UPDATE', usuario.get('id')
                )
            except Exception:
                pass
        return r

