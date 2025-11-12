"""
Módulo de inicialização dos routers.
Contém a função registrar_todas_rotas() que auto-registra todos os módulos de rota.
"""

from app.routers import (
    auth,
    catalogos,
    rdpm,
    art29,
    processos,
    usuarios,
    prazos,
    andamentos,
    indicios,
    mapas,
    relatorios,
    auditorias
)


def registrar_todas_rotas(eel, db_manager, prazos_manager, guards, helpers):
    """
    Registra todas as rotas @eel.expose de todos os módulos de router.
    
    Esta função é o ponto central de configuração de rotas. Ela importa e
    chama a função register() de cada módulo de router, passando as 
    dependências necessárias.
    
    Args:
        eel: Instância do eel
        db_manager: Instância do DatabaseManager
        prazos_manager: Instância do PrazosAndamentosManager
        guards: Dict com funções de validação:
            - 'login': Função _guard_login
            - 'admin': Função _guard_admin
        helpers: Dict com funções auxiliares:
            - 'get_usuario_logado': Função para obter usuário logado
            - 'set_usuario_logado': Função para definir usuário logado
    """
    
    # Extrair guards e helpers
    guard_login = guards['login']
    guard_admin = guards['admin']
    get_usuario_logado = helpers['get_usuario_logado']
    set_usuario_logado = helpers.get('set_usuario_logado')
    
    # Registrar routers existentes (mantidos da implementação anterior)
    auth.register(eel, db_manager, get_usuario_logado, set_usuario_logado)
    catalogos.register(eel, db_manager, guard_login, guard_admin, get_usuario_logado)
    rdpm.register(eel, db_manager, guard_login, guard_admin, get_usuario_logado)
    art29.register(eel, db_manager, guard_login, guard_admin, get_usuario_logado)
    processos.register(eel, db_manager, guard_login, get_usuario_logado)
    
    # Registrar novos routers criados
    usuarios.register(eel, db_manager, guard_login, guard_admin, get_usuario_logado)
    prazos.register(eel, db_manager, guard_login, prazos_manager)
    andamentos.register(eel, db_manager, guard_login, get_usuario_logado)
    indicios.register(eel, db_manager, guard_login)
    mapas.register(eel, db_manager, guard_login)
    relatorios.register(eel, db_manager, guard_login)
    auditorias.register(eel, db_manager, guard_login, guard_admin)
    
    print("✅ Todas as rotas foram registradas com sucesso!")
    print(f"   - Auth")
    print(f"   - Catálogos")
    print(f"   - RDPM")
    print(f"   - Art. 29")
    print(f"   - Processos")
    print(f"   - Usuários")
    print(f"   - Prazos")
    print(f"   - Andamentos")
    print(f"   - Indícios")
    print(f"   - Mapas")
    print(f"   - Relatórios")
    print(f"   - Auditorias")
