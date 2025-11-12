def register(eel, db_manager, get_usuario_logado, set_usuario_logado):
    """Registra handlers Eel de autenticação e sessão."""

    @eel.expose
    def fazer_login(email, senha):
        if not email or not senha:
            return {"sucesso": False, "mensagem": "Email e senha são obrigatórios!"}

        user = db_manager.verify_login(email, senha)
        if user:
            set_usuario_logado(user)
            return {
                "sucesso": True,
                "mensagem": f"Bem-vindo, {user['nome']}!",
                "usuario": user,
            }
        else:
            return {"sucesso": False, "mensagem": "Email ou senha incorretos!"}

    @eel.expose
    def obter_usuario_logado():
        user = get_usuario_logado()
        if user:
            return {"logado": True, "usuario": user}
        return {"logado": False}

    @eel.expose
    def fazer_logout():
        set_usuario_logado(None)
        return {"sucesso": True, "mensagem": "Logout realizado com sucesso!"}

